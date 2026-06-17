import crypto from 'node:crypto'
import os from 'node:os'
import { Pool, type PoolClient, type PoolConfig } from 'pg'

export type ChatRole = 'user' | 'assistant'

export type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  createdAt: string
}

export type ChatThread = {
  id: string
  title: string
  agentId: string
  createdAt: string
  updatedAt: string
  messageCount: number
  lastMessage: string
}

export type UserAppState = {
  profile: unknown
  target: unknown
  source: string
  workouts: unknown[]
  healthImport: unknown
  healthAdvice: unknown
  meals: unknown[]
  motionAnalysis: unknown
  updatedAt: string
}

export type PagePermissionKey = 'overview' | 'profile' | 'motion' | 'health' | 'nutrition' | 'chat'
export type PagePermissions = Record<PagePermissionKey, boolean>

export type TokenUsageSummary = {
  requests: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export type TokenUsageByFeature = TokenUsageSummary & {
  feature: string
}

export type PublicUser = {
  id: string
  username: string
  displayName: string
  role: UserRole
  registrationStatus: RegistrationStatus
  avatarUrl: string
  pagePermissions: PagePermissions
}

export type UserRole = 'user' | 'admin'
export type RegistrationStatus = 'pending' | 'approved' | 'rejected'

export type HealthMemory = {
  id: string
  category: string
  content: string
  importance: number
  source: string
  updatedAt: string
}

type UserRecord = PublicUser & {
  reviewedAt: string
  reviewedBy: string
  passwordHash: string
  salt: string
  createdAt: string
  state: UserAppState
}

type UserRow = {
  id: string
  username: string
  display_name: string
  role: UserRole
  avatar_url: string
  page_permissions: unknown
  registration_status: RegistrationStatus
  reviewed_at: Date | string | null
  reviewed_by: string | null
  password_hash: string
  salt: string
  created_at: Date | string
  state: unknown
}

type ChatMessageRow = {
  id: string
  role: ChatRole
  content: string
  created_at: Date | string
}

type ChatThreadRow = {
  id: string
  title: string
  agent_id: string
  created_at: Date | string
  updated_at: Date | string
  message_count?: number | string | null
  last_message?: string | null
}

type HealthMemoryRow = {
  id: string
  category: string
  content: string
  importance: number
  source: string
  updated_at: Date | string
}

export type AdminOverview = {
  totals: {
    users: number
    admins: number
    pendingUsers: number
    rejectedUsers: number
    chatThreads: number
    chatMessages: number
    memories: number
    meals: number
    workouts: number
    tokenRequests: number
    tokens: number
  }
  recentUsers: AdminUserSummary[]
}

export type AdminUserSummary = {
  id: string
  username: string
  displayName: string
  role: UserRole
  avatarUrl: string
  registrationStatus: RegistrationStatus
  reviewedAt: string
  reviewedBy: string
  pagePermissions: PagePermissions
  createdAt: string
  updatedAt: string
  chatThreads: number
  chatMessages: number
  memories: number
  meals: number
  workouts: number
  tokenUsage: TokenUsageSummary
}

export type AdminUserDetail = Omit<AdminUserSummary, 'chatThreads' | 'memories'> & {
  state: UserAppState
  chatThreads: ChatThread[]
  memories: HealthMemory[]
  tokenUsageByFeature: TokenUsageByFeature[]
}

export type AgentModelConfig = {
  activeProvider: string
  activeVisionProvider: string
  providers: AgentModelProviderConfig[]
}

export type AgentModelProviderConfig = {
  id: string
  provider: string
  displayName: string
  model: string
  visionModel: string
  baseUrl: string
  timeoutMs: number
  apiKey: string
  enabled: boolean
}

type AdminUserSummaryRow = {
  id: string
  username: string
  display_name: string
  role: UserRole
  avatar_url: string
  registration_status: RegistrationStatus
  reviewed_at: Date | string | null
  reviewed_by: string | null
  page_permissions: unknown
  created_at: Date | string
  updated_at: Date | string | null
  chat_threads: number | string
  chat_messages: number | string
  memories: number | string
  meals: number | string
  workouts: number | string
  token_requests: number | string
  input_tokens: number | string
  output_tokens: number | string
  total_tokens: number | string
}

type AgentModelConfigRow = {
  key: string
  value: unknown
}

type TokenUsageRow = {
  feature: string
  requests: number | string
  input_tokens: number | string
  output_tokens: number | string
  total_tokens: number | string
}

type BootstrapAdminUser = {
  username: string
  displayName: string
  passwordHash: string
  salt: string
  pagePermissions: PagePermissions
}

const defaultDatabaseName = 'exercise_monitor'
const pagePermissionKeys = ['overview', 'profile', 'motion', 'health', 'nutrition', 'chat'] as const
const AGENT_MODEL_CONFIG_KEYS = {
  runtime: 'agent.runtime.config',
} as const
const AGENT_MODEL_CONFIG_LEGACY_KEYS = {
  model: 'deepseek.model',
  visionModel: 'deepseek.vision_model',
  baseUrl: 'deepseek.base_url',
  timeoutMs: 'deepseek.timeout_ms',
} as const
const defaultRuntimeProviderFallbackConfig: AgentModelProviderConfig = {
  id: 'deepseek',
  provider: 'deepseek',
  displayName: 'DeepSeek',
  model: 'deepseek-chat',
  visionModel: 'deepseek-chat',
  baseUrl: 'https://api.deepseek.com',
  timeoutMs: 90_000,
  apiKey: '',
  enabled: false,
}
const defaultRuntimeProviderConfigList = normalizeRuntimeProvidersFromEnv()
const defaultRuntimeProviderConfig: AgentModelProviderConfig = defaultRuntimeProviderConfigList[0]
const defaultRuntimeActiveProvider = resolveRuntimeActiveProvider(defaultRuntimeProviderConfigList)
const defaultRuntimeActiveVisionProvider = resolveRuntimeActiveVisionProvider(defaultRuntimeProviderConfigList, defaultRuntimeActiveProvider)
const defaultAgentModelConfig: AgentModelConfig = {
  activeProvider: defaultRuntimeActiveProvider,
  activeVisionProvider: defaultRuntimeActiveVisionProvider,
  providers: defaultRuntimeProviderConfigList,
}
const defaultSessionRetentionDays = 14

type RuntimeProviderEnvSource = {
  id: string
  provider: string
  displayName: string
  modelKeys: string[]
  visionModelKeys: string[]
  baseUrlKeys: string[]
  timeoutMsKeys: string[]
  apiKeyKeys: string[]
  defaultModel: string
  defaultVisionModel: string
  defaultBaseUrl: string
  defaultTimeoutMs: number
}

export function getDefaultRuntimeModelConfigFromEnv(): AgentModelConfig {
  return {
    activeProvider: defaultAgentModelConfig.activeProvider,
    activeVisionProvider: defaultAgentModelConfig.activeVisionProvider,
    providers: defaultAgentModelConfig.providers.map((provider) => ({ ...provider })),
  }
}

function resolveRuntimeActiveProvider(providers: AgentModelProviderConfig[]) {
  const envActiveProvider = normalizeAgentModelString(process.env.CCSWITCH_ACTIVE_PROVIDER ?? process.env.AGENT_ACTIVE_PROVIDER, '').toLowerCase()
  if (!providers.length) return defaultRuntimeProviderFallbackConfig.id
  const directMatch = providers.find((provider) => provider.id === envActiveProvider || provider.provider === envActiveProvider)
  return directMatch?.id ?? providers[0].id
}

function resolveRuntimeActiveVisionProvider(providers: AgentModelProviderConfig[], fallbackProviderId: string) {
  const envActiveProvider = normalizeAgentModelString(
    process.env.CCSWITCH_ACTIVE_VISION_PROVIDER ?? process.env.AGENT_ACTIVE_VISION_PROVIDER ?? process.env.AGENT_VISION_PROVIDER,
    '',
  ).toLowerCase()
  if (!providers.length) return fallbackProviderId
  const directMatch = providers.find((provider) => provider.id === envActiveProvider || provider.provider === envActiveProvider)
  return directMatch?.id ?? fallbackProviderId
}

function normalizeRuntimeProvidersFromEnv(): AgentModelProviderConfig[] {
  const envJson = parseCcSwitchProvidersJson()
  if (envJson.length) return envJson

  const discovered = [
    buildProviderFromEnvSpec({
      id: 'deepseek',
      provider: 'deepseek',
      displayName: 'DeepSeek',
      modelKeys: ['DEEPSEEK_MODEL', 'CODEX_MODEL'],
      visionModelKeys: ['DEEPSEEK_VISION_MODEL', 'DEEPSEEK_MODEL', 'CODEX_MODEL'],
      baseUrlKeys: ['DEEPSEEK_BASE_URL', 'CODEX_BASE_URL'],
      timeoutMsKeys: ['DEEPSEEK_TIMEOUT_MS', 'CODEX_TIMEOUT_MS'],
      apiKeyKeys: ['DEEPSEEK_API_KEY', 'CODEX_API_KEY'],
      defaultModel: 'deepseek-chat',
      defaultVisionModel: 'deepseek-chat',
      defaultBaseUrl: 'https://api.deepseek.com',
      defaultTimeoutMs: 90_000,
    }),
    buildProviderFromEnvSpec({
      id: 'openai',
      provider: 'openai',
      displayName: 'OpenAI',
      modelKeys: ['OPENAI_MODEL', 'OPENAI_CHAT_MODEL'],
      visionModelKeys: ['OPENAI_VISION_MODEL', 'OPENAI_MODEL', 'OPENAI_CHAT_MODEL'],
      baseUrlKeys: ['OPENAI_BASE_URL'],
      timeoutMsKeys: ['OPENAI_TIMEOUT_MS'],
      apiKeyKeys: ['OPENAI_API_KEY'],
      defaultModel: 'gpt-4o-mini',
      defaultVisionModel: 'gpt-4o-mini',
      defaultBaseUrl: 'https://api.openai.com',
      defaultTimeoutMs: 90_000,
    }),
    buildProviderFromEnvSpec({
      id: 'gemini',
      provider: 'openai',
      displayName: 'Gemini',
      modelKeys: ['GEMINI_MODEL', 'GOOGLE_GEMINI_MODEL'],
      visionModelKeys: ['GEMINI_VISION_MODEL', 'GEMINI_MODEL', 'GOOGLE_GEMINI_MODEL'],
      baseUrlKeys: ['GEMINI_BASE_URL', 'GOOGLE_GEMINI_BASE_URL'],
      timeoutMsKeys: ['GEMINI_TIMEOUT_MS', 'GOOGLE_GEMINI_TIMEOUT_MS'],
      apiKeyKeys: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
      defaultModel: 'gemini-3.5-flash',
      defaultVisionModel: 'gemini-3.5-flash',
      defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      defaultTimeoutMs: 90_000,
    }),
    buildProviderFromEnvSpec({
      id: 'anthropic',
      provider: 'anthropic',
      displayName: 'Anthropic',
      modelKeys: ['ANTHROPIC_MODEL', 'ANTHROPIC_CLAUDE_MODEL'],
      visionModelKeys: ['ANTHROPIC_MODEL', 'ANTHROPIC_CLAUDE_MODEL'],
      baseUrlKeys: ['ANTHROPIC_BASE_URL'],
      timeoutMsKeys: ['ANTHROPIC_TIMEOUT_MS'],
      apiKeyKeys: ['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_API_KEY'],
      defaultModel: 'claude-3-7-sonnet-20250219',
      defaultVisionModel: 'claude-3-7-sonnet-20250219',
      defaultBaseUrl: 'https://api.anthropic.com',
      defaultTimeoutMs: 90_000,
    }),
    buildProviderFromEnvSpec({
      id: 'openrouter',
      provider: 'openrouter',
      displayName: 'OpenRouter',
      modelKeys: ['OPENROUTER_MODEL'],
      visionModelKeys: ['OPENROUTER_VISION_MODEL', 'OPENROUTER_MODEL'],
      baseUrlKeys: ['OPENROUTER_BASE_URL'],
      timeoutMsKeys: ['OPENROUTER_TIMEOUT_MS'],
      apiKeyKeys: ['OPENROUTER_API_KEY', 'OPENROUTER_TOKEN'],
      defaultModel: 'deepseek/deepseek-chat',
      defaultVisionModel: 'deepseek/deepseek-chat',
      defaultBaseUrl: 'https://openrouter.ai/api',
      defaultTimeoutMs: 90_000,
    }),
  ].filter((provider): provider is AgentModelProviderConfig => Boolean(provider))

  if (discovered.length > 0) return deduplicateProviders(discovered)
  return [defaultRuntimeProviderFallbackConfig]
}

function buildProviderFromEnvSpec(spec: RuntimeProviderEnvSource): AgentModelProviderConfig | null {
  const envModel = readFirstNonEmpty(process.env, spec.modelKeys)
  const envVisionModel = readFirstNonEmpty(process.env, spec.visionModelKeys)
  const envBaseUrl = readFirstNonEmpty(process.env, spec.baseUrlKeys)
  const envTimeout = readFirstNonEmpty(process.env, spec.timeoutMsKeys)
  const envApiKey = readFirstNonEmpty(process.env, spec.apiKeyKeys)
  const hasEnv = Boolean(envModel || envVisionModel || envBaseUrl || envTimeout || envApiKey)
  if (!hasEnv) return null

  return {
    id: spec.id,
    provider: spec.provider,
    displayName: spec.displayName,
    model: envModel || spec.defaultModel,
    visionModel: envVisionModel || envModel || spec.defaultVisionModel,
    baseUrl: normalizeAgentModelBaseUrl(envBaseUrl, spec.defaultBaseUrl),
    timeoutMs: readPositiveInteger(envTimeout ?? spec.defaultTimeoutMs, spec.defaultTimeoutMs),
    apiKey: envApiKey,
    enabled: Boolean(envApiKey),
  }
}

function parseCcSwitchProvidersJson(): AgentModelProviderConfig[] {
  const raw = normalizeAgentModelString(process.env.CCSWITCH_PROVIDERS_JSON, '').trim()
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return []
    const providers = parsed
      .map((item, index) => normalizeCcSwitchProviderRecord(item, index))
      .filter((provider): provider is AgentModelProviderConfig => Boolean(provider))
    return deduplicateProviders(providers)
  } catch {
    return []
  }
}

function normalizeCcSwitchProviderRecord(value: unknown, index: number): AgentModelProviderConfig | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const provider = normalizeAgentModelString((record.provider ?? record.vendor ?? record.type), 'openai')
  const normalizedProvider = provider.toLowerCase()
  const template = resolveProviderTemplate(normalizedProvider)
  const id = normalizeAgentModelString((record.id as string), `${template.id}-${index + 1}`)
  const model = normalizeAgentModelString((record.model as string), template.model)
  const visionModel = normalizeAgentModelString(
    (record.visionModel as string) ?? (record.vision_model as string),
    model || template.visionModel,
  )
  const baseUrl = normalizeAgentModelBaseUrl(record.baseUrl ?? record.base_url ?? record.baseURL, template.baseUrl)
  const apiKey = normalizeAgentModelString((record.apiKey as string) ?? (record.api_key as string) ?? (record.token as string) ?? (record.authToken as string), '')
  const timeoutMs = readPositiveInteger(
    (record.timeoutMs ?? record.timeout_ms ?? record.timeout) as number | string | undefined,
    template.timeoutMs,
  )
  const enabled = typeof record.enabled === 'boolean' ? record.enabled : true

  if (!provider) return null
  return {
    id,
    provider: normalizedProvider,
    displayName: normalizeAgentModelString((record.displayName as string) ?? (record.name as string), template.displayName),
    model,
    visionModel,
    baseUrl,
    timeoutMs,
    apiKey,
    enabled,
  }
}

function resolveProviderTemplate(provider: string) {
  const normalized = provider.toLowerCase()
  if (normalized === 'deepseek') {
    return {
      id: 'deepseek',
      displayName: 'DeepSeek',
      model: 'deepseek-chat',
      visionModel: 'deepseek-chat',
      baseUrl: 'https://api.deepseek.com',
      timeoutMs: 90_000,
    }
  }
  if (normalized === 'openrouter') {
    return {
      id: 'openrouter',
      displayName: 'OpenRouter',
      model: 'deepseek/deepseek-chat',
      visionModel: 'deepseek/deepseek-chat',
      baseUrl: 'https://openrouter.ai/api/v1',
      timeoutMs: 90_000,
    }
  }
  if (normalized === 'gemini' || normalized === 'google') {
    return {
      id: 'gemini',
      displayName: 'Gemini',
      model: 'gemini-3.5-flash',
      visionModel: 'gemini-3.5-flash',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      timeoutMs: 90_000,
    }
  }
  if (normalized === 'anthropic') {
    return {
      id: 'anthropic',
      displayName: 'Anthropic',
      model: 'claude-3-7-sonnet-20250219',
      visionModel: 'claude-3-7-sonnet-20250219',
      baseUrl: 'https://api.anthropic.com',
      timeoutMs: 90_000,
    }
  }
  return {
    id: normalized || 'provider',
    displayName: provider ? provider.toUpperCase() : 'OpenAI 兼容',
    model: 'gpt-4o-mini',
    visionModel: 'gpt-4o-mini',
    baseUrl: 'https://api.openai.com/v1',
    timeoutMs: 90_000,
  }
}

function readFirstNonEmpty(env: NodeJS.ProcessEnv, keys: string[]) {
  for (const key of keys) {
    const value = readPositiveText(env[key])
    if (value) return value
  }
  return ''
}

function deduplicateProviders(providers: AgentModelProviderConfig[]) {
  const seen = new Set<string>()
  const deduplicated: AgentModelProviderConfig[] = []
  for (const provider of providers) {
    const id = provider.id
    if (!id || seen.has(id)) continue
    seen.add(id)
    deduplicated.push(provider)
  }
  return deduplicated.length ? deduplicated : [defaultRuntimeProviderFallbackConfig]
}

function readPositiveText(value: string | undefined) {
  const normalized = normalizeAgentModelString(value, '')
  return normalized
}

const emptyState = (): UserAppState => ({
  profile: null,
  target: null,
  source: 'Apple 健康',
  workouts: [],
  healthImport: null,
  healthAdvice: null,
  meals: [],
  motionAnalysis: null,
  updatedAt: new Date().toISOString(),
})

export class AppStore {
  private readonly pool: Pool
  private readonly databaseLabel: string
  private lastSessionCleanupAt = 0

  constructor() {
    const config = buildPoolConfig()
    this.pool = new Pool(config)
    this.databaseLabel = process.env.DATABASE_URL ? sanitizeConnectionString(process.env.DATABASE_URL) : `${config.host}:${config.port}/${config.database}`
  }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS app_users (
        id uuid PRIMARY KEY,
        username text NOT NULL UNIQUE,
        display_name text NOT NULL,
        role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
        avatar_url text NOT NULL DEFAULT '',
        page_permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
        registration_status text NOT NULL DEFAULT 'approved' CHECK (registration_status IN ('pending', 'approved', 'rejected')),
        reviewed_at timestamptz,
        reviewed_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
        password_hash text NOT NULL,
        salt text NOT NULL,
        state jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS app_sessions (
        token text PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS app_sessions_user_id_idx ON app_sessions(user_id);
      CREATE INDEX IF NOT EXISTS app_sessions_created_at_idx ON app_sessions(created_at);

      CREATE TABLE IF NOT EXISTS app_chat_messages (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
        role text NOT NULL CHECK (role IN ('user', 'assistant')),
        content text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS app_chat_threads (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
        title text NOT NULL,
        agent_id text NOT NULL DEFAULT 'general',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      ALTER TABLE app_chat_messages
        ADD COLUMN IF NOT EXISTS thread_id uuid REFERENCES app_chat_threads(id) ON DELETE CASCADE;

      CREATE INDEX IF NOT EXISTS app_chat_messages_user_created_idx ON app_chat_messages(user_id, created_at);
      CREATE INDEX IF NOT EXISTS app_chat_messages_thread_created_idx ON app_chat_messages(thread_id, created_at);
      CREATE INDEX IF NOT EXISTS app_chat_threads_user_updated_idx ON app_chat_threads(user_id, updated_at DESC);

      CREATE TABLE IF NOT EXISTS app_user_memories (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
        category text NOT NULL,
        content text NOT NULL,
        importance integer NOT NULL DEFAULT 3,
        source text NOT NULL DEFAULT 'chat',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (user_id, category, content)
      );

      CREATE INDEX IF NOT EXISTS app_user_memories_user_rank_idx ON app_user_memories(user_id, importance DESC, updated_at DESC);

      CREATE TABLE IF NOT EXISTS app_token_usage (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
        feature text NOT NULL,
        input_tokens integer NOT NULL DEFAULT 0,
        output_tokens integer NOT NULL DEFAULT 0,
        total_tokens integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS app_token_usage_user_created_idx ON app_token_usage(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS app_token_usage_feature_idx ON app_token_usage(feature);

      CREATE TABLE IF NOT EXISTS app_agent_config (
        key text PRIMARY KEY,
        value jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid REFERENCES app_users(id) ON DELETE SET NULL
      );
    `)
    await this.pool.query(
      `
        INSERT INTO app_agent_config (key, value)
        VALUES
          ($1, $2::jsonb),
          ($3, $4::jsonb),
          ($5, $6::jsonb),
          ($7, $8::jsonb),
          ($9, $10::jsonb)
        ON CONFLICT (key) DO NOTHING
      `,
      [
        AGENT_MODEL_CONFIG_KEYS.runtime,
        JSON.stringify(defaultAgentModelConfig),
        AGENT_MODEL_CONFIG_LEGACY_KEYS.model,
        JSON.stringify(defaultRuntimeProviderConfig.model),
        AGENT_MODEL_CONFIG_LEGACY_KEYS.visionModel,
        JSON.stringify(defaultRuntimeProviderConfig.visionModel),
        AGENT_MODEL_CONFIG_LEGACY_KEYS.baseUrl,
        JSON.stringify(defaultRuntimeProviderConfig.baseUrl),
        AGENT_MODEL_CONFIG_LEGACY_KEYS.timeoutMs,
        JSON.stringify(defaultRuntimeProviderConfig.timeoutMs),
      ],
    )
    await this.pool.query("ALTER TABLE app_users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user'")
    await this.pool.query("ALTER TABLE app_users ADD COLUMN IF NOT EXISTS avatar_url text NOT NULL DEFAULT ''")
    await this.pool.query("ALTER TABLE app_users ADD COLUMN IF NOT EXISTS page_permissions jsonb NOT NULL DEFAULT '{}'::jsonb")
    await this.pool.query("ALTER TABLE app_users ADD COLUMN IF NOT EXISTS registration_status text NOT NULL DEFAULT 'approved'")
    await this.pool.query('ALTER TABLE app_users ADD COLUMN IF NOT EXISTS reviewed_at timestamptz')
    await this.pool.query('ALTER TABLE app_users ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES app_users(id) ON DELETE SET NULL')
    await this.pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'app_users_role_check'
        ) THEN
          ALTER TABLE app_users
            ADD CONSTRAINT app_users_role_check CHECK (role IN ('user', 'admin'));
        END IF;
      END $$;
    `)
    await this.pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'app_users_registration_status_check'
        ) THEN
          ALTER TABLE app_users
            ADD CONSTRAINT app_users_registration_status_check CHECK (registration_status IN ('pending', 'approved', 'rejected'));
        END IF;
      END $$;
    `)
    await this.seedBootstrapAdminUsers()
    await this.pool.query(`
      UPDATE app_users
      SET role = 'admin'
      WHERE id = (
        SELECT id
        FROM app_users
        WHERE NOT EXISTS (SELECT 1 FROM app_users WHERE role = 'admin')
        ORDER BY created_at ASC
        LIMIT 1
      )
    `)
    await this.pool.query(`
      UPDATE app_users
      SET registration_status = 'approved',
          reviewed_at = COALESCE(reviewed_at, created_at)
      WHERE role = 'admin'
    `)
    await this.pool.query(
      `
        UPDATE app_users
        SET page_permissions = $1::jsonb
        WHERE page_permissions = '{}'::jsonb OR page_permissions IS NULL
      `,
      [JSON.stringify(defaultPagePermissions())],
    )
    await this.deleteExpiredSessions(this.pool)
  }

  private async seedBootstrapAdminUsers() {
    const users = readBootstrapAdminUsers()
    if (!users.length) return

    const shouldSyncPasswords = process.env.ADMIN_BOOTSTRAP_SYNC_PASSWORDS === 'true'
    for (const user of users) {
      const userId = crypto.randomUUID()
      const now = new Date().toISOString()
      const state = emptyState()
      await this.pool.query(
        `
          INSERT INTO app_users (
            id, username, display_name, role, avatar_url, page_permissions, registration_status, reviewed_at,
            password_hash, salt, state, created_at
          )
          VALUES ($1, $2, $3, 'admin', '', $4::jsonb, 'approved', $5, $6, $7, $8::jsonb, $5)
          ON CONFLICT (username) DO UPDATE
            SET role = 'admin',
                registration_status = 'approved',
                reviewed_at = COALESCE(app_users.reviewed_at, EXCLUDED.reviewed_at),
                page_permissions = EXCLUDED.page_permissions,
                display_name = CASE
                  WHEN app_users.display_name = '' OR app_users.display_name = app_users.username THEN EXCLUDED.display_name
                  ELSE app_users.display_name
                END,
                password_hash = CASE
                  WHEN $9 THEN EXCLUDED.password_hash
                  ELSE app_users.password_hash
                END,
                salt = CASE
                  WHEN $9 THEN EXCLUDED.salt
                  ELSE app_users.salt
                END
        `,
        [
          userId,
          user.username,
          user.displayName,
          JSON.stringify(user.pagePermissions),
          now,
          user.passwordHash,
          user.salt,
          JSON.stringify(state),
          shouldSyncPasswords,
        ],
      )
    }
  }

  getStatus() {
    return {
      provider: 'postgresql',
      database: this.databaseLabel,
    }
  }

  async register(usernameInput: string, password: string, displayNameInput?: string) {
    const username = normalizeUsername(usernameInput)
    const displayName = normalizeDisplayName(displayNameInput, username)
    validateCredentials(username, password)

    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const salt = crypto.randomBytes(16).toString('hex')
      const role = await this.resolveNewUserRole(client, username)
      const registrationStatus: RegistrationStatus = role === 'admin' ? 'approved' : 'pending'
      const user: UserRecord = {
        id: crypto.randomUUID(),
        username,
        displayName,
        role,
        registrationStatus,
        reviewedAt: registrationStatus === 'approved' ? new Date().toISOString() : '',
        reviewedBy: '',
        avatarUrl: '',
        pagePermissions: defaultPagePermissions(),
        passwordHash: hashPassword(password, salt),
        salt,
        createdAt: new Date().toISOString(),
        state: emptyState(),
      }

      await client.query(
        `
          INSERT INTO app_users (
            id, username, display_name, role, avatar_url, page_permissions, registration_status, reviewed_at,
            password_hash, salt, state, created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11::jsonb, $12)
        `,
        [
          user.id,
          user.username,
          user.displayName,
          user.role,
          user.avatarUrl,
          JSON.stringify(user.pagePermissions),
          user.registrationStatus,
          user.reviewedAt || null,
          user.passwordHash,
          user.salt,
          JSON.stringify(user.state),
          user.createdAt,
        ],
      )
      if (registrationStatus !== 'approved') {
        await client.query('COMMIT')
        return {
          status: registrationStatus,
          message: '注册申请已提交，请等待管理员审批后再登录。',
        }
      }
      const token = await this.createSession(client, user.id)
      const chatThread = await this.createChatThreadForUser(client, user.id, 'general', '新的健康对话')
      await client.query('COMMIT')

      return { token, user: toPublicUser(user), state: user.state, chatThreads: [chatThread], activeChatThread: chatThread, chatMessages: [] }
    } catch (error) {
      await client.query('ROLLBACK')
      if (isUniqueViolation(error)) {
        throw new Error('用户名已存在', { cause: error })
      }
      throw error
    } finally {
      client.release()
    }
  }

  async login(usernameInput: string, password: string) {
    const username = normalizeUsername(usernameInput)
    const result = await this.pool.query<UserRow>('SELECT * FROM app_users WHERE username = $1', [username])
    const user = result.rows[0] ? toUserRecord(result.rows[0]) : null

    if (!user || !verifyPassword(password, user.salt, user.passwordHash)) {
      throw new Error('用户名或密码不正确')
    }
    if (user.registrationStatus === 'pending') {
      throw new Error('账号正在等待管理员审批，请审批通过后再登录')
    }
    if (user.registrationStatus === 'rejected') {
      throw new Error('账号注册申请已被拒绝，请联系管理员')
    }

    const token = await this.createSession(this.pool, user.id)
    const activeChatThread = await this.ensureActiveChatThread(user.id)
    const chatThreads = await this.listChatThreads(user.id)
    const chatMessages = await this.getChatMessages(user.id, activeChatThread.id)
    return { token, user: toPublicUser(user), state: user.state, chatThreads, activeChatThread, chatMessages }
  }

  async authenticate(token: string | undefined) {
    if (!token) return null
    const tokenHash = hashSessionToken(token)
    const result = await this.pool.query<UserRow>(
      `
        SELECT app_users.*
        FROM app_sessions
        JOIN app_users ON app_users.id = app_sessions.user_id
        WHERE app_sessions.token = $1
          AND app_users.registration_status = 'approved'
      `,
      [tokenHash],
    )
    return result.rows[0] ? toPublicUser(toUserRecord(result.rows[0])) : null
  }

  async getUserBundle(userId: string) {
    const user = await this.getUserRecord(userId)
    const activeChatThread = await this.ensureActiveChatThread(userId)
    const chatThreads = await this.listChatThreads(userId)
    const chatMessages = await this.getChatMessages(userId, activeChatThread.id)
    return { user: toPublicUser(user), state: user.state, chatThreads, activeChatThread, chatMessages }
  }

  async updateUserAccount(
    userId: string,
    input: { displayName?: unknown; avatarUrl?: unknown; currentPassword?: unknown; newPassword?: unknown },
  ) {
    const user = await this.getUserRecord(userId)
    const displayName = normalizeDisplayName(input.displayName, user.displayName)
    const avatarUrl = normalizeAvatarUrl(input.avatarUrl)
    const newPassword = readText(input.newPassword)
    let nextSalt = user.salt
    let nextPasswordHash = user.passwordHash

    if (newPassword) {
      validatePassword(newPassword)
      const currentPassword = readText(input.currentPassword)
      if (!currentPassword || !verifyPassword(currentPassword, user.salt, user.passwordHash)) {
        throw new Error('当前密码不正确')
      }
      nextSalt = crypto.randomBytes(16).toString('hex')
      nextPasswordHash = hashPassword(newPassword, nextSalt)
    }

    const result = await this.pool.query<UserRow>(
      `
        UPDATE app_users
        SET display_name = $2, avatar_url = $3, password_hash = $4, salt = $5
        WHERE id = $1
        RETURNING *
      `,
      [userId, displayName, avatarUrl, nextPasswordHash, nextSalt],
    )
    if (newPassword) {
      await this.pool.query('DELETE FROM app_sessions WHERE user_id = $1', [userId])
    }
    return toPublicUser(toUserRecord(result.rows[0]))
  }

  async listChatThreads(userId: string) {
    await this.ensureActiveChatThread(userId)
    const result = await this.pool.query<ChatThreadRow>(
      `
        SELECT
          app_chat_threads.id,
          app_chat_threads.title,
          app_chat_threads.agent_id,
          app_chat_threads.created_at,
          app_chat_threads.updated_at,
          COUNT(app_chat_messages.id) AS message_count,
          COALESCE(
            (
              SELECT latest.content
              FROM app_chat_messages latest
              WHERE latest.thread_id = app_chat_threads.id
              ORDER BY latest.created_at DESC
              LIMIT 1
            ),
            ''
          ) AS last_message
        FROM app_chat_threads
        LEFT JOIN app_chat_messages ON app_chat_messages.thread_id = app_chat_threads.id
        WHERE app_chat_threads.user_id = $1
        GROUP BY app_chat_threads.id
        ORDER BY app_chat_threads.updated_at DESC
      `,
      [userId],
    )
    return result.rows.map(toChatThread)
  }

  async createChatThread(userId: string, agentId: string, title?: string) {
    const thread = await this.createChatThreadForUser(this.pool, userId, normalizeAgentId(agentId), normalizeThreadTitle(title))
    return {
      thread,
      chatThreads: await this.listChatThreads(userId),
      chatMessages: [],
    }
  }

  async deleteChatThread(userId: string, threadId: string) {
    const result = await this.pool.query<ChatThreadRow>(
      `
        DELETE FROM app_chat_threads
        WHERE user_id = $1 AND id = $2
        RETURNING id, title, agent_id, created_at, updated_at, 0 AS message_count, '' AS last_message
      `,
      [userId, threadId],
    )
    if (!result.rows[0]) throw new Error('对话不存在')
    return {
      deletedThread: toChatThread(result.rows[0]),
      chatThreads: await this.listChatThreads(userId),
    }
  }

  async getChatThread(userId: string, threadId?: string) {
    if (!threadId) return this.ensureActiveChatThread(userId)

    const result = await this.pool.query<ChatThreadRow>(
      `
        SELECT id, title, agent_id, created_at, updated_at, 0 AS message_count, '' AS last_message
        FROM app_chat_threads
        WHERE user_id = $1 AND id = $2
      `,
      [userId, threadId],
    )
    if (!result.rows[0]) throw new Error('对话不存在')
    return toChatThread(result.rows[0])
  }

  async getUserMemories(userId: string, limit = 24) {
    const result = await this.pool.query<HealthMemoryRow>(
      `
        SELECT id, category, content, importance, source, updated_at
        FROM app_user_memories
        WHERE user_id = $1
        ORDER BY importance DESC, updated_at DESC
        LIMIT $2
      `,
      [userId, limit],
    )
    return result.rows.map(toHealthMemory)
  }

  async refreshDerivedMemories(userId: string) {
    const state = await this.getUserState(userId)
    const memories = buildDerivedMemories(state)
    const client = await this.pool.connect()

    try {
      await client.query('BEGIN')
      await client.query('DELETE FROM app_user_memories WHERE user_id = $1 AND source = $2', [userId, 'derived'])
      for (const memory of memories) {
        await upsertMemory(client, userId, memory.category, memory.content, 'derived', memory.importance)
      }
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async rememberUserMessage(userId: string, message: string) {
    const memory = extractMessageMemory(message)
    if (!memory) return null
    return upsertMemory(this.pool, userId, memory.category, memory.content, 'chat', memory.importance)
  }

  async saveUserState(userId: string, state: Partial<UserAppState>) {
    const current = await this.getUserState(userId)
    const nextState = {
      ...emptyState(),
      ...current,
      ...state,
      updatedAt: new Date().toISOString(),
    }
    await this.pool.query('UPDATE app_users SET state = $2::jsonb WHERE id = $1', [userId, JSON.stringify(nextState)])
    return nextState
  }

  async appendMeal(userId: string, mealInput: unknown) {
    const state = await this.getUserState(userId)
    const meal = normalizeMeal(mealInput)
    const meals = [meal, ...readArray(state.meals)]
    const nextState = await this.saveUserState(userId, { meals })
    return readArray(nextState.meals)
  }

  async deleteMeal(userId: string, mealId: number) {
    const state = await this.getUserState(userId)
    const meals = readArray(state.meals).filter((meal) => readMealId(meal) !== mealId)
    const nextState = await this.saveUserState(userId, { meals, healthAdvice: null })
    return readArray(nextState.meals)
  }

  async appendChatMessage(userId: string, threadId: string, role: ChatRole, content: string) {
    const thread = await this.getChatThread(userId, threadId)
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      role,
      content,
      createdAt: new Date().toISOString(),
    }
    await this.pool.query(
      `
        INSERT INTO app_chat_messages (id, user_id, thread_id, role, content, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [message.id, userId, thread.id, message.role, message.content, message.createdAt],
    )
    await this.touchChatThread(userId, thread.id, message)
    await this.pool.query(
      `
        DELETE FROM app_chat_messages
        WHERE id IN (
          SELECT id
          FROM app_chat_messages
          WHERE user_id = $1 AND thread_id = $2
          ORDER BY created_at DESC
          OFFSET 80
        )
      `,
      [userId, thread.id],
    )
    return message
  }

  async getChatMessages(userId: string, threadId?: string) {
    const thread = await this.getChatThread(userId, threadId)
    const result = await this.pool.query<ChatMessageRow>(
      'SELECT id, role, content, created_at FROM app_chat_messages WHERE user_id = $1 AND thread_id = $2 ORDER BY created_at ASC',
      [userId, thread.id],
    )
    return result.rows.map(toChatMessage)
  }

  async clearChat(userId: string, threadId?: string) {
    const thread = await this.getChatThread(userId, threadId)
    await this.pool.query('DELETE FROM app_chat_messages WHERE user_id = $1 AND thread_id = $2', [userId, thread.id])
    await this.pool.query('UPDATE app_chat_threads SET updated_at = now() WHERE user_id = $1 AND id = $2', [userId, thread.id])
    return []
  }

  async recordTokenUsage(userId: string, featureInput: string, inputPayload: unknown, outputPayload: unknown) {
    const feature = readText(featureInput).slice(0, 40) || 'unknown'
    const inputTokens = estimateTokens(inputPayload)
    const outputTokens = estimateTokens(outputPayload)
    const totalTokens = inputTokens + outputTokens
    await this.pool.query(
      `
        INSERT INTO app_token_usage (id, user_id, feature, input_tokens, output_tokens, total_tokens, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [crypto.randomUUID(), userId, feature, inputTokens, outputTokens, totalTokens, new Date().toISOString()],
    )
    return { requests: 1, inputTokens, outputTokens, totalTokens }
  }

  async getAdminOverview(): Promise<AdminOverview> {
    const totalsResult = await this.pool.query<{
      users: number | string
      admins: number | string
      pending_users: number | string
      rejected_users: number | string
      chat_threads: number | string
      chat_messages: number | string
      memories: number | string
      meals: number | string
      workouts: number | string
      token_requests: number | string
      tokens: number | string
    }>(`
      SELECT
        (SELECT COUNT(*) FROM app_users) AS users,
        (SELECT COUNT(*) FROM app_users WHERE role = 'admin') AS admins,
        (SELECT COUNT(*) FROM app_users WHERE registration_status = 'pending') AS pending_users,
        (SELECT COUNT(*) FROM app_users WHERE registration_status = 'rejected') AS rejected_users,
        (SELECT COUNT(*) FROM app_chat_threads) AS chat_threads,
        (SELECT COUNT(*) FROM app_chat_messages) AS chat_messages,
        (SELECT COUNT(*) FROM app_user_memories) AS memories,
        COALESCE((SELECT SUM(jsonb_array_length(COALESCE(state->'meals', '[]'::jsonb))) FROM app_users), 0) AS meals,
        COALESCE((SELECT SUM(jsonb_array_length(COALESCE(state->'workouts', '[]'::jsonb))) FROM app_users), 0) AS workouts,
        (SELECT COUNT(*) FROM app_token_usage) AS token_requests,
        COALESCE((SELECT SUM(total_tokens) FROM app_token_usage), 0) AS tokens
    `)
    const recentUsers = await this.listAdminUsers(8)
    const totals = totalsResult.rows[0]

    return {
      totals: {
        users: readNumber(totals.users, 0),
        admins: readNumber(totals.admins, 0),
        pendingUsers: readNumber(totals.pending_users, 0),
        rejectedUsers: readNumber(totals.rejected_users, 0),
        chatThreads: readNumber(totals.chat_threads, 0),
        chatMessages: readNumber(totals.chat_messages, 0),
        memories: readNumber(totals.memories, 0),
        meals: readNumber(totals.meals, 0),
        workouts: readNumber(totals.workouts, 0),
        tokenRequests: readNumber(totals.token_requests, 0),
        tokens: readNumber(totals.tokens, 0),
      },
      recentUsers,
    }
  }

  async getAgentModelConfig(): Promise<AgentModelConfig> {
    const result = await this.pool.query<AgentModelConfigRow>(
      `
        SELECT key, value
        FROM app_agent_config
        WHERE key = ANY($1::text[])
      `,
      [[
        AGENT_MODEL_CONFIG_KEYS.runtime,
        ...Object.values(AGENT_MODEL_CONFIG_LEGACY_KEYS),
      ]],
    )
    const byKey = new Map<string, unknown>(result.rows.map((row) => [row.key, row.value]))
    const runtimeConfig = parseAgentRuntimeConfig(byKey.get(AGENT_MODEL_CONFIG_KEYS.runtime))
    if (runtimeConfig) {
      return runtimeConfig
    }

    return normalizeLegacyRuntimeConfig(byKey)
  }

  async setAgentModelConfig(input: unknown, updatedByUserId?: string): Promise<AgentModelConfig> {
    const current = await this.getAgentModelConfig()
    const next = normalizeAgentModelConfig(input, current)
    const activeProvider = next.providers.find((provider) => provider.id === next.activeProvider) ?? next.providers[0]
    const activeVisionProvider = next.providers.find((provider) => provider.id === next.activeVisionProvider) ?? activeProvider ?? next.providers[0]
    const payload = {
      ...next,
      activeProvider: activeProvider?.id ?? next.activeProvider,
      activeVisionProvider: activeVisionProvider?.id ?? next.activeVisionProvider,
      providers: next.providers,
    }

    const updatedBy = updatedByUserId ?? null
    await this.pool.query(
      `
        INSERT INTO app_agent_config (key, value, updated_by)
        VALUES ($1, $2::jsonb, $3)
        ON CONFLICT (key) DO UPDATE
          SET value = $2::jsonb,
              updated_at = now(),
              updated_by = $3
      `,
      [AGENT_MODEL_CONFIG_KEYS.runtime, JSON.stringify(payload), updatedBy],
    )
    if (activeProvider) {
      await Promise.all(
        (Object.entries(AGENT_MODEL_CONFIG_LEGACY_KEYS) as Array<[keyof typeof AGENT_MODEL_CONFIG_LEGACY_KEYS, string]>).map(([field, key]) => {
          const value = JSON.stringify((activeProvider as Record<string, unknown>)[field])
          return this.pool.query(
            `
              INSERT INTO app_agent_config (key, value, updated_by)
              VALUES ($1, $2::jsonb, $3)
              ON CONFLICT (key) DO UPDATE
                SET value = $2::jsonb,
                    updated_at = now(),
                    updated_by = $3
            `,
            [key, value, updatedBy],
          )
        }),
      )
    }

    return payload
  }

  async updateAdminUserPermissions(targetUserId: string, permissionsInput: unknown): Promise<AdminUserDetail> {
    const target = await this.getUserRecord(targetUserId)
    const permissions = target.role === 'admin' ? defaultPagePermissions() : normalizePagePermissions(permissionsInput, target.role)
    await this.pool.query('UPDATE app_users SET page_permissions = $2::jsonb WHERE id = $1', [targetUserId, JSON.stringify(permissions)])
    return this.getAdminUserDetail(targetUserId)
  }

  async updateAdminUserRegistrationStatus(
    requesterId: string,
    targetUserId: string,
    statusInput: unknown,
  ): Promise<AdminUserDetail> {
    const status = readRegistrationStatusInput(statusInput)
    const target = await this.getUserRecord(targetUserId)
    if (target.role === 'admin' && status !== 'approved') throw new Error('管理员账号不能设为待审批或拒绝')
    if (requesterId === targetUserId && status !== 'approved') throw new Error('不能停用当前登录的管理员账号')

    await this.pool.query(
      `
        UPDATE app_users
        SET registration_status = $2,
            reviewed_at = now(),
            reviewed_by = $3
        WHERE id = $1
      `,
      [targetUserId, status, requesterId],
    )

    if (status !== 'approved') {
      await this.pool.query('DELETE FROM app_sessions WHERE user_id = $1', [targetUserId])
    }

    return this.getAdminUserDetail(targetUserId)
  }

  async deleteAdminUser(requesterId: string, targetUserId: string) {
    if (requesterId === targetUserId) throw new Error('不能删除当前登录的管理员账号')
    const target = await this.getUserRecord(targetUserId)
    if (target.role === 'admin') {
      const admins = await this.pool.query<{ count: number | string }>("SELECT COUNT(*) AS count FROM app_users WHERE role = 'admin'")
      if (readNumber(admins.rows[0]?.count, 0) <= 1) throw new Error('不能删除最后一个管理员')
    }
    await this.pool.query('DELETE FROM app_users WHERE id = $1', [targetUserId])
  }

  async listAdminUsers(limit = 50): Promise<AdminUserSummary[]> {
    const result = await this.pool.query<AdminUserSummaryRow>(
      `
        SELECT
          app_users.id,
          app_users.username,
          app_users.display_name,
          app_users.role,
          app_users.avatar_url,
          app_users.registration_status,
          app_users.reviewed_at,
          app_users.reviewed_by,
          app_users.page_permissions,
          app_users.created_at,
          COALESCE(app_users.state->>'updatedAt', app_users.created_at::text) AS updated_at,
          COUNT(DISTINCT app_chat_threads.id) AS chat_threads,
          COUNT(DISTINCT app_chat_messages.id) AS chat_messages,
          COUNT(DISTINCT app_user_memories.id) AS memories,
          jsonb_array_length(COALESCE(app_users.state->'meals', '[]'::jsonb)) AS meals,
          jsonb_array_length(COALESCE(app_users.state->'workouts', '[]'::jsonb)) AS workouts,
          COALESCE(token_usage.requests, 0) AS token_requests,
          COALESCE(token_usage.input_tokens, 0) AS input_tokens,
          COALESCE(token_usage.output_tokens, 0) AS output_tokens,
          COALESCE(token_usage.total_tokens, 0) AS total_tokens
        FROM app_users
        LEFT JOIN app_chat_threads ON app_chat_threads.user_id = app_users.id
        LEFT JOIN app_chat_messages ON app_chat_messages.user_id = app_users.id
        LEFT JOIN app_user_memories ON app_user_memories.user_id = app_users.id
        LEFT JOIN (
          SELECT
            user_id,
            COUNT(*) AS requests,
            COALESCE(SUM(input_tokens), 0) AS input_tokens,
            COALESCE(SUM(output_tokens), 0) AS output_tokens,
            COALESCE(SUM(total_tokens), 0) AS total_tokens
          FROM app_token_usage
          GROUP BY user_id
        ) token_usage ON token_usage.user_id = app_users.id
        GROUP BY app_users.id
               , token_usage.requests
               , token_usage.input_tokens
               , token_usage.output_tokens
               , token_usage.total_tokens
        ORDER BY app_users.created_at DESC
        LIMIT $1
      `,
      [limit],
    )
    return result.rows.map(toAdminUserSummary)
  }

  async getAdminUserDetail(userId: string): Promise<AdminUserDetail> {
    const users = await this.pool.query<AdminUserSummaryRow>(
      `
        SELECT
          app_users.id,
          app_users.username,
          app_users.display_name,
          app_users.role,
          app_users.avatar_url,
          app_users.registration_status,
          app_users.reviewed_at,
          app_users.reviewed_by,
          app_users.page_permissions,
          app_users.created_at,
          COALESCE(app_users.state->>'updatedAt', app_users.created_at::text) AS updated_at,
          COUNT(DISTINCT app_chat_threads.id) AS chat_threads,
          COUNT(DISTINCT app_chat_messages.id) AS chat_messages,
          COUNT(DISTINCT app_user_memories.id) AS memories,
          jsonb_array_length(COALESCE(app_users.state->'meals', '[]'::jsonb)) AS meals,
          jsonb_array_length(COALESCE(app_users.state->'workouts', '[]'::jsonb)) AS workouts,
          COALESCE(token_usage.requests, 0) AS token_requests,
          COALESCE(token_usage.input_tokens, 0) AS input_tokens,
          COALESCE(token_usage.output_tokens, 0) AS output_tokens,
          COALESCE(token_usage.total_tokens, 0) AS total_tokens
        FROM app_users
        LEFT JOIN app_chat_threads ON app_chat_threads.user_id = app_users.id
        LEFT JOIN app_chat_messages ON app_chat_messages.user_id = app_users.id
        LEFT JOIN app_user_memories ON app_user_memories.user_id = app_users.id
        LEFT JOIN (
          SELECT
            user_id,
            COUNT(*) AS requests,
            COALESCE(SUM(input_tokens), 0) AS input_tokens,
            COALESCE(SUM(output_tokens), 0) AS output_tokens,
            COALESCE(SUM(total_tokens), 0) AS total_tokens
          FROM app_token_usage
          GROUP BY user_id
        ) token_usage ON token_usage.user_id = app_users.id
        WHERE app_users.id = $1
        GROUP BY app_users.id
               , token_usage.requests
               , token_usage.input_tokens
               , token_usage.output_tokens
               , token_usage.total_tokens
      `,
      [userId],
    )
    if (!users.rows[0]) throw new Error('用户不存在')
    const user = await this.getUserRecord(userId)
    const tokenUsageByFeature = await this.getTokenUsageByFeature(userId)

    return {
      ...toAdminUserSummary(users.rows[0]),
      state: user.state,
      chatThreads: user.registrationStatus === 'approved' ? await this.listChatThreads(userId) : [],
      memories: await this.getUserMemories(userId, 12),
      tokenUsageByFeature,
    }
  }

  async getTokenUsageByFeature(userId: string): Promise<TokenUsageByFeature[]> {
    const result = await this.pool.query<TokenUsageRow>(
      `
        SELECT
          feature,
          COUNT(*) AS requests,
          COALESCE(SUM(input_tokens), 0) AS input_tokens,
          COALESCE(SUM(output_tokens), 0) AS output_tokens,
          COALESCE(SUM(total_tokens), 0) AS total_tokens
        FROM app_token_usage
        WHERE user_id = $1
        GROUP BY feature
        ORDER BY COALESCE(SUM(total_tokens), 0) DESC
      `,
      [userId],
    )
    return result.rows.map(toTokenUsageByFeature)
  }

  async close() {
    await this.pool.end()
  }

  private async getUserRecord(userId: string) {
    const result = await this.pool.query<UserRow>('SELECT * FROM app_users WHERE id = $1', [userId])
    if (!result.rows[0]) throw new Error('用户不存在')
    return toUserRecord(result.rows[0])
  }

  private async getUserState(userId: string) {
    const user = await this.getUserRecord(userId)
    return user.state
  }

  private async createSession(client: Pick<Pool | PoolClient, 'query'>, userId: string) {
    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = hashSessionToken(token)
    await this.cleanupExpiredSessionsIfNeeded(client)
    await client.query('INSERT INTO app_sessions (token, user_id, created_at) VALUES ($1, $2, $3)', [
      tokenHash,
      userId,
      new Date().toISOString(),
    ])
    return token
  }

  private async deleteExpiredSessions(client: Pick<Pool | PoolClient, 'query'>) {
    await client.query('DELETE FROM app_sessions WHERE created_at < (NOW() - make_interval(days => $1))', [readSessionRetentionDays()])
  }

  private async cleanupExpiredSessionsIfNeeded(client: Pick<Pool | PoolClient, 'query'>) {
    const now = Date.now()
    if (now - this.lastSessionCleanupAt < 60_000) return
    this.lastSessionCleanupAt = now
    try {
      await this.deleteExpiredSessions(client)
    } catch (error) {
      console.error('[store] cleanupExpiredSessionsIfNeeded failed:', error)
    }
  }

  private async resolveNewUserRole(client: Pick<Pool | PoolClient, 'query'>, username: string): Promise<UserRole> {
    if (readAdminUsernames().includes(username)) return 'admin'
    if (process.env.ALLOW_FIRST_USER_ADMIN !== 'true') return 'user'
    const result = await client.query<{ count: number | string }>('SELECT COUNT(*) AS count FROM app_users')
    return readNumber(result.rows[0]?.count, 0) === 0 ? 'admin' : 'user'
  }

  private async ensureActiveChatThread(userId: string) {
    const existing = await this.pool.query<ChatThreadRow>(
      `
        SELECT id, title, agent_id, created_at, updated_at, 0 AS message_count, '' AS last_message
        FROM app_chat_threads
        WHERE user_id = $1
        ORDER BY updated_at DESC
        LIMIT 1
      `,
      [userId],
    )

    const thread = existing.rows[0]
      ? toChatThread(existing.rows[0])
      : await this.createChatThreadForUser(this.pool, userId, 'general', '历史对话')

    await this.pool.query('UPDATE app_chat_messages SET thread_id = $2 WHERE user_id = $1 AND thread_id IS NULL', [userId, thread.id])
    return thread
  }

  private async createChatThreadForUser(client: Pick<Pool | PoolClient, 'query'>, userId: string, agentId: string, title?: string) {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const result = await client.query<ChatThreadRow>(
      `
        INSERT INTO app_chat_threads (id, user_id, title, agent_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $5)
        RETURNING id, title, agent_id, created_at, updated_at, 0 AS message_count, '' AS last_message
      `,
      [id, userId, normalizeThreadTitle(title), normalizeAgentId(agentId), now],
    )
    return toChatThread(result.rows[0])
  }

  private async touchChatThread(userId: string, threadId: string, message: ChatMessage) {
    const title = message.role === 'user' ? buildThreadTitle(message.content) : ''
    if (title) {
      await this.pool.query(
        `
          UPDATE app_chat_threads
          SET
            title = CASE
              WHEN title IN ('新的健康对话', '历史对话') THEN $3
              ELSE title
            END,
            updated_at = $4
          WHERE user_id = $1 AND id = $2
        `,
        [userId, threadId, title, message.createdAt],
      )
      return
    }

    await this.pool.query('UPDATE app_chat_threads SET updated_at = $3 WHERE user_id = $1 AND id = $2', [
      userId,
      threadId,
      message.createdAt,
    ])
  }
}

function buildPoolConfig(): PoolConfig {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL }
  }

  return {
    host: process.env.PGHOST ?? '127.0.0.1',
    port: Number(process.env.PGPORT ?? 5432),
    database: process.env.PGDATABASE ?? defaultDatabaseName,
    user: process.env.PGUSER ?? os.userInfo().username,
    password: process.env.PGPASSWORD,
  }
}

function sanitizeConnectionString(connectionString: string) {
  try {
    const url = new URL(connectionString)
    if (url.password) url.password = '***'
    return url.toString()
  } catch {
    return connectionString.replace(/:\/\/([^:@]+):([^@]+)@/, '://$1:***@')
  }
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase()
}

function validateCredentials(username: string, password: string) {
  if (!/^[a-z0-9_@.-]{3,40}$/.test(username)) {
    throw new Error('用户名至少 3 位，只能包含字母、数字、下划线、点、横线或 @')
  }
  validatePassword(password)
}

function validatePassword(password: string) {
  if (password.length < 6) {
    throw new Error('密码至少 6 位')
  }
  if (password.length > 128) {
    throw new Error('密码不能超过 128 位')
  }
}

function normalizeDisplayName(value: unknown, fallback: string) {
  const displayName = readText(value) || fallback
  if (displayName.length > 40) throw new Error('昵称不能超过 40 个字符')
  return displayName
}

function normalizeAvatarUrl(value: unknown) {
  const avatarUrl = readText(value)
  if (!avatarUrl) return ''
  if (avatarUrl.length > 1200) throw new Error('头像地址太长')
  if (!/^https?:\/\//i.test(avatarUrl) && !/^data:image\//i.test(avatarUrl) && !/^\/uploads\/avatars\//i.test(avatarUrl)) {
    throw new Error('头像地址必须是 http(s)、data:image 或上传头像地址')
  }
  return avatarUrl
}

function hashPassword(password: string, salt: string) {
  return crypto.scryptSync(password, salt, 64).toString('hex')
}

function verifyPassword(password: string, salt: string, expectedHash: string) {
  const actual = Buffer.from(hashPassword(password, salt), 'hex')
  const expected = Buffer.from(expectedHash, 'hex')
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
}

function hashSessionToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    registrationStatus: user.registrationStatus,
    avatarUrl: user.avatarUrl,
    pagePermissions: normalizePagePermissions(user.pagePermissions, user.role),
  }
}

function toUserRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role === 'admin' ? 'admin' : 'user',
    registrationStatus: normalizeRegistrationStatus(row.registration_status),
    reviewedAt: row.reviewed_at ? toIsoString(row.reviewed_at) : '',
    reviewedBy: row.reviewed_by ?? '',
    avatarUrl: row.avatar_url ?? '',
    pagePermissions: normalizePagePermissions(row.page_permissions, row.role === 'admin' ? 'admin' : 'user'),
    passwordHash: row.password_hash,
    salt: row.salt,
    createdAt: toIsoString(row.created_at),
    state: normalizeState(row.state),
  }
}

function toAdminUserSummary(row: AdminUserSummaryRow): AdminUserSummary {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role === 'admin' ? 'admin' : 'user',
    avatarUrl: row.avatar_url ?? '',
    registrationStatus: normalizeRegistrationStatus(row.registration_status),
    reviewedAt: row.reviewed_at ? toIsoString(row.reviewed_at) : '',
    reviewedBy: row.reviewed_by ?? '',
    pagePermissions: normalizePagePermissions(row.page_permissions, row.role === 'admin' ? 'admin' : 'user'),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at ?? row.created_at),
    chatThreads: readNumber(row.chat_threads, 0),
    chatMessages: readNumber(row.chat_messages, 0),
    memories: readNumber(row.memories, 0),
    meals: readNumber(row.meals, 0),
    workouts: readNumber(row.workouts, 0),
    tokenUsage: {
      requests: readNumber(row.token_requests, 0),
      inputTokens: readNumber(row.input_tokens, 0),
      outputTokens: readNumber(row.output_tokens, 0),
      totalTokens: readNumber(row.total_tokens, 0),
    },
  }
}

function normalizeRegistrationStatus(value: unknown): RegistrationStatus {
  return value === 'pending' || value === 'rejected' || value === 'approved' ? value : 'approved'
}

function readRegistrationStatusInput(value: unknown): RegistrationStatus {
  if (value === 'pending' || value === 'rejected' || value === 'approved') return value
  throw new Error('审批状态无效')
}

function toTokenUsageByFeature(row: TokenUsageRow): TokenUsageByFeature {
  return {
    feature: row.feature,
    requests: readNumber(row.requests, 0),
    inputTokens: readNumber(row.input_tokens, 0),
    outputTokens: readNumber(row.output_tokens, 0),
    totalTokens: readNumber(row.total_tokens, 0),
  }
}

function defaultPagePermissions(): PagePermissions {
  return Object.fromEntries(pagePermissionKeys.map((page) => [page, true])) as PagePermissions
}

function normalizePagePermissions(value: unknown, role: UserRole = 'user'): PagePermissions {
  const permissions = defaultPagePermissions()
  if (role === 'admin') return permissions
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  for (const page of pagePermissionKeys) {
    permissions[page] = record[page] !== false
  }
  return permissions
}

function estimateTokens(value: unknown) {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? '')
  if (!text) return 0
  return Math.max(1, Math.ceil(text.length / 2.8))
}

function readSessionRetentionDays() {
  const value = Number(process.env.SESSION_RETENTION_DAYS)
  return Number.isInteger(value) && value > 0 ? value : defaultSessionRetentionDays
}

function readAdminUsernames() {
  return String(process.env.ADMIN_USERNAMES ?? '')
    .split(',')
    .map((item) => normalizeUsername(item))
    .filter(Boolean)
}

function readBootstrapAdminUsers(): BootstrapAdminUser[] {
  const rawJson = readBootstrapAdminUsersJson()
  if (!rawJson) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(rawJson)
  } catch (error) {
    throw new Error('ADMIN_BOOTSTRAP_USERS 配置不是有效 JSON', { cause: error })
  }

  if (!Array.isArray(parsed)) throw new Error('ADMIN_BOOTSTRAP_USERS 必须是数组')
  return parsed.map(normalizeBootstrapAdminUser)
}

function readBootstrapAdminUsersJson() {
  const rawJson = readText(process.env.ADMIN_BOOTSTRAP_USERS_JSON)
  if (rawJson) return rawJson

  const rawBase64 = readText(process.env.ADMIN_BOOTSTRAP_USERS_B64)
  if (!rawBase64) return ''
  try {
    return Buffer.from(rawBase64, 'base64').toString('utf8')
  } catch (error) {
    throw new Error('ADMIN_BOOTSTRAP_USERS_B64 解码失败', { cause: error })
  }
}

function normalizeBootstrapAdminUser(value: unknown): BootstrapAdminUser {
  const record = asRecord(value)
  if (!record) throw new Error('内置管理员配置必须是对象')

  const username = normalizeUsername(readText(record.username))
  const displayName = normalizeDisplayName(record.displayName, username)
  const passwordHash = readText(record.passwordHash)
  const salt = readText(record.salt)

  if (!username) throw new Error('内置管理员用户名不能为空')
  if (!/^[a-f0-9]{128}$/i.test(passwordHash)) throw new Error(`内置管理员 ${username} 的 passwordHash 无效`)
  if (!/^[a-f0-9]{32,}$/i.test(salt)) throw new Error(`内置管理员 ${username} 的 salt 无效`)

  return {
    username,
    displayName,
    passwordHash: passwordHash.toLowerCase(),
    salt: salt.toLowerCase(),
    pagePermissions: normalizePagePermissions(record.pagePermissions, 'admin'),
  }
}

function parseAgentRuntimeConfig(raw: unknown): AgentModelConfig | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const record = raw as {
    activeProvider?: unknown
    activeVisionProvider?: unknown
    providers?: unknown
  }
  const providersInput = Array.isArray(record.providers) ? record.providers : null
  const normalizedProviders = normalizeAgentProviderConfigList(providersInput, defaultAgentModelConfig.providers)
  if (!normalizedProviders.length) return null

  const activeProvider = normalizeAgentModelString(record.activeProvider, normalizedProviders[0]?.id ?? defaultAgentModelConfig.activeProvider).trim()
  const activeFound = normalizedProviders.find((provider) => provider.id === activeProvider) ? activeProvider : normalizedProviders[0].id
  const activeVisionProvider = normalizeAgentModelString(record.activeVisionProvider, activeFound).trim()
  const activeVisionFound = normalizedProviders.find((provider) => provider.id === activeVisionProvider) ? activeVisionProvider : activeFound

  return {
    activeProvider: activeFound,
    activeVisionProvider: activeVisionFound,
    providers: normalizedProviders,
  }
}

function normalizeLegacyRuntimeConfig(byKey: Map<string, unknown>): AgentModelConfig {
  const legacyModel = normalizeAgentModelString(byKey.get(AGENT_MODEL_CONFIG_LEGACY_KEYS.model), defaultRuntimeProviderConfig.model)
  const legacyVisionModel = normalizeAgentModelString(byKey.get(AGENT_MODEL_CONFIG_LEGACY_KEYS.visionModel), legacyModel)
  const legacyBaseUrl = normalizeAgentModelBaseUrl(
    byKey.get(AGENT_MODEL_CONFIG_LEGACY_KEYS.baseUrl),
    defaultRuntimeProviderConfig.baseUrl,
  )
  const legacyTimeout = normalizeAgentModelTimeout(
    byKey.get(AGENT_MODEL_CONFIG_LEGACY_KEYS.timeoutMs),
    defaultRuntimeProviderConfig.timeoutMs,
  )

  const provider = normalizeAgentProviderConfig(
    {
      id: defaultRuntimeProviderConfig.id,
      provider: defaultRuntimeProviderConfig.provider,
      displayName: defaultRuntimeProviderConfig.displayName,
      model: legacyModel,
      visionModel: legacyVisionModel,
      baseUrl: legacyBaseUrl,
      timeoutMs: legacyTimeout,
      apiKey: defaultRuntimeProviderConfig.apiKey,
      enabled: Boolean(defaultRuntimeProviderConfig.apiKey),
    },
    defaultRuntimeProviderConfig,
  )

  return {
    activeProvider: provider.id,
    activeVisionProvider: provider.id,
    providers: [provider],
  }
}

function normalizeAgentModelConfig(value: unknown, current: AgentModelConfig): AgentModelConfig {
  const record = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
  const fallbackProviders = Array.isArray(current.providers) ? current.providers : defaultAgentModelConfig.providers
  const providers = normalizeAgentProviderConfigList(record.providers, fallbackProviders)
  if (!providers.length) return current

  const activeProvider = normalizeAgentModelString(record.activeProvider, providers[0]?.id ?? current.activeProvider)
  const activeVisionProvider = normalizeAgentModelString(record.activeVisionProvider, current.activeVisionProvider || activeProvider)
  const fallbackById = new Map<string, AgentModelProviderConfig>(fallbackProviders.map((provider) => [provider.id, provider]))
  const activeFound = providers.some((provider) => provider.id === activeProvider)
    ? activeProvider
    : providers[0].id

  return {
    activeProvider: activeFound,
    activeVisionProvider: providers.some((provider) => provider.id === activeVisionProvider)
      ? activeVisionProvider
      : activeFound,
    providers: providers.map((provider) => normalizeAgentProviderConfig(provider, fallbackById.get(provider.id) ?? fallbackProviders[0]! ?? provider)),
  }
}

function normalizeAgentProviderConfigList(
  value: unknown,
  fallbackProviders: AgentModelProviderConfig[],
): AgentModelProviderConfig[] {
  if (!Array.isArray(value)) {
    return fallbackProviders.map((provider) => ({ ...provider }))
  }
  const fallbackById = new Map<string, AgentModelProviderConfig>(fallbackProviders.map((provider) => [provider.id, provider]))
  const normalized = value.map((provider) => {
    const record = typeof provider === 'object' && provider !== null ? (provider as Record<string, unknown>) : {}
    const providerId = normalizeAgentModelString(
      record.id,
      fallbackProviders[0]?.id ?? defaultRuntimeProviderConfig.id ?? defaultAgentModelConfig.providers[0]?.id ?? 'deepseek',
    )
    const fallback = fallbackById.get(providerId) ?? fallbackProviders[0] ?? defaultAgentModelConfig.providers[0]!
    return normalizeAgentProviderConfig(provider, fallback)
  })
  const deduplicated = new Map<string, AgentModelProviderConfig>()
  for (const item of normalized) {
    if (!item.id) continue
    deduplicated.set(item.id, item)
  }
  return Array.from(deduplicated.values())
}

function normalizeAgentProviderConfig(
  value: unknown,
  fallback: AgentModelProviderConfig,
): AgentModelProviderConfig {
  const record = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
  const baseProvider = normalizeAgentModelString(record.provider, fallback.provider)
  return {
    id: normalizeAgentModelString(record.id, fallback.id || 'provider'),
    provider: baseProvider,
    displayName: normalizeAgentModelString(record.displayName, baseProvider || fallback.displayName),
    model: normalizeAgentModelString(record.model, fallback.model),
    visionModel: normalizeAgentModelString(record.visionModel || record.model, fallback.visionModel || fallback.model),
    baseUrl: normalizeAgentModelBaseUrl(record.baseUrl, fallback.baseUrl),
    timeoutMs: readPositiveInteger(typeof record.timeoutMs === 'number' ? record.timeoutMs : `${record.timeoutMs ?? ''}`, fallback.timeoutMs),
    apiKey: typeof record.apiKey === 'string' ? record.apiKey.trim() : `${record.apiKey ?? fallback.apiKey}`.trim(),
    enabled: typeof record.enabled === 'boolean' ? record.enabled : true,
  }
}

function normalizeAgentModelString(value: unknown, fallback: string) {
  const text = typeof value === 'string' ? value.trim() : String(value ?? '')
  if (!text) return fallback
  return text
}

function normalizeAgentModelBaseUrl(value: unknown, fallback: string) {
  const text = normalizeAgentModelString(value, fallback).replace(/\/+$/, '')
  return text || fallback
}

function normalizeAgentModelTimeout(value: unknown, fallback: number) {
  return readPositiveInteger(typeof value === 'number' ? value : `${value ?? ''}`, fallback)
}

function readPositiveInteger(value: string | number | undefined, fallback: number) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? Math.round(number) : fallback
}

function toChatMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: toIsoString(row.created_at),
  }
}

function toChatThread(row: ChatThreadRow): ChatThread {
  return {
    id: row.id,
    title: row.title,
    agentId: normalizeAgentId(row.agent_id),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    messageCount: readNumber(row.message_count, 0),
    lastMessage: row.last_message ?? '',
  }
}

function toHealthMemory(row: HealthMemoryRow): HealthMemory {
  return {
    id: row.id,
    category: row.category,
    content: row.content,
    importance: row.importance,
    source: row.source,
    updatedAt: toIsoString(row.updated_at),
  }
}

function normalizeAgentId(value: unknown) {
  const agentId = typeof value === 'string' ? value.trim() : ''
  return agentId || 'general'
}

function normalizeThreadTitle(value: unknown) {
  const title = typeof value === 'string' ? value.trim() : ''
  return title.slice(0, 32) || '新的健康对话'
}

function buildThreadTitle(content: string) {
  return content
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[{}[\]"'`]/g, '')
    .slice(0, 22)
}

function normalizeState(value: unknown): UserAppState {
  if (!value || typeof value !== 'object') return emptyState()
  const state = value as Partial<UserAppState>
  return {
    ...emptyState(),
    ...state,
    source: typeof state.source === 'string' ? state.source : 'Apple 健康',
    workouts: Array.isArray(state.workouts) ? state.workouts : [],
    healthImport: state.healthImport ?? null,
    meals: Array.isArray(state.meals) ? state.meals : [],
    updatedAt: typeof state.updatedAt === 'string' ? state.updatedAt : new Date().toISOString(),
  }
}

function normalizeMeal(value: unknown) {
  if (!value || typeof value !== 'object') {
    throw new Error('餐食记录无效')
  }

  const meal = value as Record<string, unknown>
  return {
    id: Date.now(),
    name: String(meal.name ?? '未命名餐食'),
    calories: readNumber(meal.calories, 0),
    protein: readNumber(meal.protein, 0),
    carbs: readNumber(meal.carbs, 0),
    fat: readNumber(meal.fat, 0),
    ingredients: Array.isArray(meal.ingredients) ? meal.ingredients : [],
    mealType: normalizeMealType(meal.mealType),
    date: normalizeMealDate(meal.date),
    createdAt: readText(meal.createdAt) || new Date().toISOString(),
  }
}

function normalizeMealType(value: unknown) {
  const text = readText(value)
  return text === 'breakfast' || text === 'lunch' || text === 'dinner' ? text : 'lunch'
}

function mealTypeLabel(type: string) {
  if (type === 'breakfast') return '早餐'
  if (type === 'dinner') return '晚餐'
  return '午餐'
}

function normalizeMealDate(value: unknown) {
  const text = readText(value)
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : toDateInputValue()
}

function toDateInputValue(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 10)
}

function buildDerivedMemories(state: UserAppState) {
  const memories: Array<{ category: string; content: string; importance: number }> = []
  const profile = asRecord(state.profile)
  const target = asRecord(state.target)
  const healthAdvice = asRecord(state.healthAdvice)
  const motionAnalysis = asRecord(state.motionAnalysis)
  const meals: Array<Record<string, unknown>> = readArray(state.meals).filter(isRecord)
  const todayMeals = meals.filter((meal) => normalizeMealDate(meal.date) === toDateInputValue())
  const workouts: Array<Record<string, unknown>> = readArray(state.workouts).filter(isRecord)

  if (profile) {
    const goal = readText(profile.goal)
    const activityLevel = readText(profile.activityLevel)
    const height = readText(profile.heightCm)
    const weight = readText(profile.weightKg)
    const age = readText(profile.age)
    const profileParts = [
      height ? `身高 ${height}cm` : '',
      weight ? `体重 ${weight}kg` : '',
      age ? `年龄 ${age}` : '',
      goal ? `目标 ${goal}` : '',
      activityLevel ? `活动水平 ${activityLevel}` : '',
    ].filter(Boolean)
    if (profileParts.length) {
      memories.push({ category: 'profile', content: `用户个人资料：${profileParts.join('，')}。`, importance: 5 })
    }
  }

  if (target) {
    const calorieGoal = readNumber(target.calorieGoal, Number.NaN)
    const proteinGoal = readNumber(target.proteinGoal, Number.NaN)
    const carbsGoal = readNumber(target.carbsGoal, Number.NaN)
    const fatGoal = readNumber(target.fatGoal, Number.NaN)
    if (Number.isFinite(calorieGoal)) {
      memories.push({
        category: 'nutrition',
        content: `用户当前热量目标 ${calorieGoal} kcal，蛋白目标 ${proteinGoal || 0}g，碳水目标 ${carbsGoal || 0}g，脂肪目标 ${fatGoal || 0}g。`,
        importance: 5,
      })
    }
  }

  if (todayMeals.length) {
    const totals = todayMeals.reduce<{ calories: number; protein: number; carbs: number; fat: number }>(
      (sum, meal) => ({
        calories: sum.calories + readNumber(meal.calories, 0),
        protein: sum.protein + readNumber(meal.protein, 0),
        carbs: sum.carbs + readNumber(meal.carbs, 0),
        fat: sum.fat + readNumber(meal.fat, 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    )
    const latestMeals = todayMeals
      .slice(0, 5)
      .map((meal) => {
        const name = readText(meal.name)
        return name ? `${mealTypeLabel(normalizeMealType(meal.mealType))}${name}` : ''
      })
      .filter(Boolean)
      .join('、')
    memories.push({
      category: 'nutrition',
      content: `用户今天记录 ${todayMeals.length} 条饮食，合计约 ${Math.round(totals.calories)} kcal，蛋白 ${Math.round(totals.protein)}g，碳水 ${Math.round(totals.carbs)}g，脂肪 ${Math.round(totals.fat)}g；最近餐食：${latestMeals || '未命名餐食'}。`,
      importance: 4,
    })
  }

  if (workouts.length) {
    const activeCalories = workouts.reduce((sum, workout) => sum + readNumber(workout.calories, 0), 0)
    const minutes = workouts.reduce((sum, workout) => sum + readNumber(workout.minutes, 0), 0)
    const names = workouts
      .slice(0, 5)
      .map((workout) => readText(workout.name))
      .filter(Boolean)
      .join('、')
    memories.push({
      category: 'training',
      content: `用户同步 ${workouts.length} 条运动记录，合计 ${minutes} 分钟、${activeCalories} kcal；项目包括 ${names || '未命名运动'}。`,
      importance: 4,
    })
  }

  if (healthAdvice) {
    const summary = readText(healthAdvice.summary)
    const recoveryRisk = readText(healthAdvice.recoveryRisk)
    if (summary || recoveryRisk) {
      memories.push({
        category: 'recovery',
        content: `最近恢复建议：${summary || '暂无摘要'}${recoveryRisk ? `；恢复风险 ${recoveryRisk}` : ''}。`,
        importance: 4,
      })
    }
  }

  if (motionAnalysis) {
    const summary = readText(motionAnalysis.summary)
    const score = readNumber(motionAnalysis.score, Number.NaN)
    if (summary || Number.isFinite(score)) {
      memories.push({
        category: 'movement',
        content: `最近动作分析：${Number.isFinite(score) ? `${score} 分，` : ''}${summary || '暂无摘要'}。`,
        importance: 4,
      })
    }
  }

  return memories
}

function extractMessageMemory(message: string) {
  const content = message.trim().replace(/\s+/g, ' ').slice(0, 180)
  if (content.length < 6) return null

  if (/过敏|忌口|不吃|不喜欢|喜欢|偏好|素食|乳糖|海鲜|牛奶|鸡蛋/.test(content)) {
    return { category: 'preference', content: `用户饮食偏好或限制：${content}`, importance: 5 }
  }
  if (/目标|想要|希望|减脂|增肌|维持|体重|马拉松|跑步|力量|塑形/.test(content)) {
    return { category: 'goal', content: `用户目标：${content}`, importance: 5 }
  }
  if (/膝|腰|肩|颈|痛|疼|伤|扭|不舒服|疲劳|睡眠|失眠|恢复/.test(content)) {
    return { category: 'constraint', content: `用户身体状态或训练限制：${content}`, importance: 5 }
  }
  if (/只有|每周|每天|时间|早上|晚上|午休|健身房|家里|器械|哑铃|跑步机/.test(content)) {
    return { category: 'schedule', content: `用户训练条件或时间安排：${content}`, importance: 4 }
  }
  return null
}

async function upsertMemory(
  client: Pick<Pool | PoolClient, 'query'>,
  userId: string,
  category: string,
  content: string,
  source: string,
  importance: number,
) {
  const id = crypto.randomUUID()
  const result = await client.query<HealthMemoryRow>(
    `
      INSERT INTO app_user_memories (id, user_id, category, content, source, importance, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, now(), now())
      ON CONFLICT (user_id, category, content)
      DO UPDATE SET importance = GREATEST(app_user_memories.importance, EXCLUDED.importance), updated_at = now()
      RETURNING id, category, content, importance, source, updated_at
    `,
    [id, userId, category, content, source, importance],
  )
  return result.rows[0] ? toHealthMemory(result.rows[0]) : null
}

function readArray(value: unknown) {
  return Array.isArray(value) ? value : []
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object')
}

function readText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function readMealId(value: unknown) {
  if (!value || typeof value !== 'object') return null
  return readNumber((value as Record<string, unknown>).id, Number.NaN)
}

function readNumber(value: unknown, fallback: number) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value
}

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === '23505')
}

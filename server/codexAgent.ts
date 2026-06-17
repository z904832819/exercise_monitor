import './env.js'
import { ChatOpenAI } from '@langchain/openai'
import { lookup } from 'node:dns/promises'
import fs from 'node:fs/promises'
import net from 'node:net'
import type { RagChunk } from './rag.js'
import { getDefaultRuntimeModelConfigFromEnv, type AgentModelConfig, type AgentModelProviderConfig } from './store.js'
import type { ChatMessage, HealthMemory, PublicUser, UserAppState } from './store.js'

export type WorkoutPayload = {
  name: string
  minutes: number
  calories: number
  intensity: string
}

export type MealPayload = {
  name: string
  calories: number
  protein: number
}

export type MotionPayload = {
  videoName: string
  videoFrames: string[]
  activeCalories: number
  eatenCalories: number
  calorieGoal: number
}

export type FoodPayload = {
  foodName: string
  calorieGoal: number
  activeCalories: number
  eatenCalories: number
}

export type ProfilePayload = {
  heightCm: number
  weightKg: number
  age: number
  sex: 'male' | 'female'
  activityLevel: 'low' | 'medium' | 'high'
  goal: 'fat_loss' | 'maintain' | 'muscle_gain'
}

export type HealthPayload = {
  source: string
  calorieGoal: number
  workouts: WorkoutPayload[]
  meals: MealPayload[]
}

export type AgentIssue = {
  title: string
  detail: string
  severity: 'ok' | 'warning' | 'danger'
}

export type AgentTask = {
  title: string
  detail: string
  priority: 'low' | 'medium' | 'high'
}

export type MotionAnalysis = {
  mode: 'agent' | 'fallback'
  movementName: string
  confidence: number
  summary: string
  score: number
  issues: AgentIssue[]
  nextActions: AgentTask[]
}

export type FoodAnalysis = {
  mode: 'agent' | 'fallback'
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  ingredients: FoodIngredient[]
  confidence: number
  remainingCalories: number
  advice: string
}

export type FoodIngredient = {
  name: string
  amount: string
  calories: number
  protein: number
  carbs: number
  fat: number
}

export type NutritionTarget = {
  mode: 'formula'
  calorieGoal: number
  bmr: number
  tdee: number
  proteinGoal: number
  carbsGoal: number
  fatGoal: number
  summary: string
}

export type HealthAdvice = {
  mode: 'agent' | 'fallback'
  summary: string
  recoveryRisk: 'low' | 'medium' | 'high'
  nextActions: AgentTask[]
}

export type AgentChatPayload = {
  user: PublicUser
  message: string
  state: UserAppState
  history: ChatMessage[]
  memories: HealthMemory[]
  ragContext: RagChunk[]
  agentId?: string
}

export type AgentChatResponse = {
  mode: 'agent' | 'fallback'
  reply: string
}

export type AgentChatStreamCallbacks = {
  signal?: AbortSignal
  onStatus?: (status: string) => void
  onDelta?: (text: string) => void
  onReplace?: (text: string) => void
}

const motionSchema = {
  type: 'object',
  properties: {
    movementName: { type: 'string' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    summary: { type: 'string' },
    score: { type: 'number', minimum: 0, maximum: 100 },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          detail: { type: 'string' },
          severity: { type: 'string', enum: ['ok', 'warning', 'danger'] },
        },
        required: ['title', 'detail', 'severity'],
        additionalProperties: false,
      },
    },
    nextActions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          detail: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
        required: ['title', 'detail', 'priority'],
        additionalProperties: false,
      },
    },
  },
  required: ['movementName', 'confidence', 'summary', 'score', 'issues', 'nextActions'],
  additionalProperties: false,
} as const

const foodSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    calories: { type: 'number', minimum: 0 },
    protein: { type: 'number', minimum: 0 },
    carbs: { type: 'number', minimum: 0 },
    fat: { type: 'number', minimum: 0 },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          amount: { type: 'string' },
          calories: { type: 'number', minimum: 0 },
          protein: { type: 'number', minimum: 0 },
          carbs: { type: 'number', minimum: 0 },
          fat: { type: 'number', minimum: 0 },
        },
        required: ['name', 'amount', 'calories', 'protein', 'carbs', 'fat'],
        additionalProperties: false,
      },
    },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    advice: { type: 'string' },
  },
  required: ['name', 'calories', 'protein', 'carbs', 'fat', 'ingredients', 'confidence', 'advice'],
  additionalProperties: false,
} as const

const healthSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    recoveryRisk: { type: 'string', enum: ['low', 'medium', 'high'] },
    nextActions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          detail: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
        required: ['title', 'detail', 'priority'],
        additionalProperties: false,
      },
    },
  },
  required: ['summary', 'recoveryRisk', 'nextActions'],
  additionalProperties: false,
} as const

const chatSchema = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
  },
  required: ['reply'],
  additionalProperties: false,
} as const

const healthSkillHub = [
  {
    id: 'memory_coach',
    name: '用户记忆召回',
    rules: ['优先使用长期记忆、当前目标、最近饮食和运动记录回答。', '当记忆和当前记录冲突时，以当前记录为准，并指出需要用户确认。'],
  },
  {
    id: 'nutrition_budget',
    name: '热量与宏量营养',
    rules: ['围绕剩余热量、蛋白质、碳水、脂肪给出可执行餐食建议。', '不要把估算热量说成精确医学数据。'],
  },
  {
    id: 'training_load',
    name: '训练负荷规划',
    rules: ['结合已同步运动、动作评分、恢复风险安排训练强度。', '给出今天或下一次训练的组数、时长、强度或替代方案。'],
  },
  {
    id: 'recovery_guard',
    name: '恢复与风险控制',
    rules: ['出现疼痛、疲劳、睡眠差或恢复风险时，优先降低强度并建议专业评估。', '避免诊断疾病或承诺治疗效果。'],
  },
  {
    id: 'habit_adherence',
    name: '习惯与执行',
    rules: ['把建议拆成用户今天能完成的 1-3 个动作。', '使用用户偏好、时间条件和器械条件降低执行成本。'],
  },
] as const

export const chatAgents = [
  {
    id: 'general',
    name: '综合健康教练',
    shortName: '综合',
    description: '统筹饮食、运动、恢复和习惯，适合日常问答。',
    focus: ['综合判断', '健康习惯', '今日安排'],
    rules: ['先判断用户目标和恢复状态，再给饮食、训练、作息的组合建议。', '回答要覆盖当前数据里最关键的一项，不要平均用力。'],
  },
  {
    id: 'strength',
    name: '力量增肌教练',
    shortName: '增肌',
    description: '偏力量训练、肌肥大、动作质量和渐进超负荷。',
    focus: ['力量训练', '肌肥大', '动作质量'],
    rules: ['优先给动作、组数、次数、RPE 和进阶方式。', '强调动作质量、恢复和蛋白摄入，不鼓励盲目冲重量。'],
  },
  {
    id: 'fat_loss',
    name: '减脂管理教练',
    shortName: '减脂',
    description: '偏热量缺口、蛋白目标、步数、有氧和执行策略。',
    focus: ['热量缺口', '控脂', '步数有氧'],
    rules: ['围绕剩余热量、蛋白目标和低成本运动安排建议。', '避免极端节食，提醒保持恢复和力量训练。'],
  },
  {
    id: 'women_shape',
    name: '女士塑型教练',
    shortName: '塑型',
    description: '偏臀腿、背肩、核心、体态和低压力塑形计划。',
    focus: ['臀腿塑形', '背肩体态', '核心稳定'],
    rules: ['给出臀腿、背肩、核心的结构化训练建议，兼顾周期恢复。', '不做妇科、激素、孕产或疾病判断；相关问题建议专业医生评估。'],
  },
  {
    id: 'running',
    name: '跑步有氧教练',
    shortName: '跑步',
    description: '偏跑步、心肺、配速、低强度有氧和赛事准备。',
    focus: ['跑步', '心肺', '配速'],
    rules: ['优先说明强度区间、时长、配速体感和恢复跑安排。', '出现疼痛时先降量或停止诱发动作。'],
  },
  {
    id: 'recovery',
    name: '康复恢复教练',
    shortName: '恢复',
    description: '偏疼痛风险、睡眠疲劳、主动恢复和安全边界。',
    focus: ['恢复', '疼痛风险', '安全边界'],
    rules: ['先做风险分层，明确哪些动作今天不该做。', '不诊断、不治疗；持续或明显疼痛建议医生或康复师评估。'],
  },
  {
    id: 'nutrition',
    name: '营养饮食教练',
    shortName: '营养',
    description: '偏餐食搭配、宏量营养、外食选择和补足蛋白。',
    focus: ['餐食搭配', '宏量营养', '外食选择'],
    rules: ['围绕热量、蛋白、碳水、脂肪和饱腹感给具体餐食建议。', '估算要说明不等于精确医学数据。'],
  },
  {
    id: 'habit',
    name: '习惯监督教练',
    shortName: '习惯',
    description: '偏打卡、执行、时间管理和长期坚持。',
    focus: ['执行计划', '打卡', '长期坚持'],
    rules: ['把建议拆成今天能完成的 1-3 个动作。', '优先降低执行成本，给出触发条件和最小完成标准。'],
  },
] as const

export type ChatAgentId = (typeof chatAgents)[number]['id']

const authMode = resolveAuthMode()
const defaultRuntimeModelConfig: AgentModelConfig = getDefaultRuntimeModelConfigFromEnv()
const defaultRuntimeModelBaseUrl = defaultRuntimeModelConfig.providers[0]?.baseUrl || 'https://api.deepseek.com'
let runtimeModelConfig: AgentModelConfig = { ...defaultRuntimeModelConfig }

export function getAgentRuntimeStatus() {
  const config = getRuntimeModelConfig()
  const activeConfig = getActiveProviderConfig(config)
  const activeVisionConfig = getActiveVisionProviderConfig(config)
  return {
    enabled: authMode !== 'off' && Boolean(activeConfig?.enabled && activeConfig.apiKey),
    visionEnabled: authMode !== 'off' && Boolean(activeVisionConfig?.enabled && activeVisionConfig.apiKey),
    authMode,
    apiKeyConfigured: Boolean(activeConfig?.apiKey),
    visionApiKeyConfigured: Boolean(activeVisionConfig?.apiKey),
    timeoutMs: activeConfig?.timeoutMs ?? 90_000,
    model: activeConfig?.model ?? '',
    visionModel: activeVisionConfig?.visionModel ?? activeVisionConfig?.model ?? '',
    baseUrl: activeConfig?.baseUrl ?? defaultRuntimeModelBaseUrl,
    visionBaseUrl: activeVisionConfig?.baseUrl ?? activeConfig?.baseUrl ?? defaultRuntimeModelBaseUrl,
    provider: activeConfig?.provider ?? 'deepseek',
    visionProvider: activeVisionConfig?.provider ?? activeConfig?.provider ?? 'deepseek',
    providerId: activeConfig?.id ?? '',
    visionProviderId: activeVisionConfig?.id ?? activeConfig?.id ?? '',
    displayName: activeConfig?.displayName ?? '',
    visionDisplayName: activeVisionConfig?.displayName ?? activeConfig?.displayName ?? '',
    activeProvider: config.activeProvider,
    activeVisionProvider: config.activeVisionProvider,
    providersCount: config.providers.length,
  }
}

export function setRuntimeModelConfig(value: unknown): AgentModelConfig {
  runtimeModelConfig = normalizeRuntimeModelConfig(value)
  return runtimeModelConfig
}

export function getRuntimeModelConfig() {
  return { ...runtimeModelConfig }
}

export const getCodexRuntimeStatus = getAgentRuntimeStatus

export type AgentModelProviderTestResult = {
  ok: boolean
  providerId: string
  provider: string
  displayName: string
  model: string
  baseUrl: string
  latencyMs: number
  message: string
  responsePreview?: string
}

export async function testAgentModelProvider(value: unknown): Promise<AgentModelProviderTestResult> {
  const fallbackProvider = getActiveProviderConfig(getRuntimeModelConfig())
    ?? runtimeModelConfig.providers[0]
    ?? defaultRuntimeModelConfig.providers[0]!
  const provider = normalizeProviderConfig(value, [fallbackProvider])
  const startedAt = Date.now()
  const baseResult = {
    providerId: provider.id,
    provider: provider.provider,
    displayName: provider.displayName,
    model: provider.model,
    baseUrl: provider.baseUrl,
  }

  if (!provider.apiKey) {
    return {
      ...baseResult,
      ok: false,
      latencyMs: 0,
      message: '请先填写 API Key',
    }
  }

  if (!provider.model) {
    return {
      ...baseResult,
      ok: false,
      latencyMs: 0,
      message: '请先填写模型名称',
    }
  }

  const controller = new AbortController()
  const timeoutMs = Math.min(Math.max(provider.timeoutMs, 1000), 30_000)
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const testModel = createLangChainModelForProvider(provider, provider.model, {
      temperature: 0,
      maxTokens: 256,
      streaming: false,
    })
    const response = await testModel.invoke([
      { role: 'system', content: '你是模型连通性测试器。' },
      { role: 'user', content: '请只回复 OK' },
    ] as Parameters<typeof testModel.invoke>[0], {
      signal: controller.signal,
    })
    const responseText =
      extractMessageContent(response).trim() ||
      (await requestOpenAiCompatibleTestCompletion(provider, provider.model, controller.signal))
    if (!responseText) throw new Error('模型调用成功，但返回文本为空；请确认模型名称是聊天文本模型，并且供应商兼容 /chat/completions。')

    const latencyMs = Date.now() - startedAt
    return {
      ...baseResult,
      ok: true,
      latencyMs,
      message: `运行正常（${latencyMs}ms）`,
      responsePreview: responseText.slice(0, 120),
    }
  } catch (error) {
    const latencyMs = Date.now() - startedAt
    return {
      ...baseResult,
      ok: false,
      latencyMs,
      message: controller.signal.aborted
        ? `测试超时（超过 ${Math.round(timeoutMs / 1000)} 秒）`
        : readableError(error),
    }
  } finally {
    clearTimeout(timeout)
  }
}

export async function analyzeMotion(payload: MotionPayload): Promise<MotionAnalysis> {
  const fallback = buildFallbackMotion(payload)
  const activeClient = payload.videoFrames.length ? getActiveVisionAgentClientConfig() : null
  if (!activeClient) return fallback

  try {
    const userMessage: ChatMessageInput['content'] = [
      { type: 'text', text: buildMotionPrompt(payload) },
      ...payload.videoFrames.slice(0, 4).map((frame) => ({ type: 'image_url' as const, image_url: { url: frame } })),
    ]
    const result = await runAgentTurn(
      'motion analysis',
      [
        {
          role: 'system',
          content:
            '你是 JSON 输出严格执行器，请仅输出 JSON。输入包含运动视频关键帧时，必须先根据画面自动识别动作，再给出姿态分析和纠正建议。',
        },
        { role: 'user', content: userMessage },
      ],
      motionSchema,
      getDeepSeekVisionModel(),
      true,
      activeClient,
    )
    const parsed = normalizeMotionAnalysisFromAgent(parseJson<unknown>(result), payload)

    return {
      mode: 'agent',
      ...parsed,
    }
  } catch (error) {
    console.warn('[agent] motion vision analysis failed, using fallback:', readableError(error))
    return fallback
  }
}

export async function analyzeFood(payload: FoodPayload, imagePath?: string, imageMimeType = 'image/jpeg'): Promise<FoodAnalysis> {
  const fallback = buildFallbackFood(payload)
  const activeClient = imagePath ? getActiveVisionAgentClientConfig() : getActiveAgentClientConfig()
  if (!activeClient) return fallback

  try {
    let userMessage:
      | string
      | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>
    if (imagePath) {
      const imageUrl = await buildImageDataUrl(imagePath, imageMimeType)
      userMessage = [
        { type: 'text', text: buildFoodPrompt(payload) },
        { type: 'image_url', image_url: { url: imageUrl } },
      ]
    } else {
      userMessage = buildFoodPrompt(payload)
    }

    const result = await runAgentTurn(
      'food analysis',
      [
        {
          role: 'system',
          content:
            '你是 JSON 输出严格执行器，请按要求返回 JSON。若输入带图片，先参考视觉特征估计食物成分，再返回 JSON。',
        },
        {
          role: 'user' as const,
          content: userMessage,
        },
      ],
      foodSchema,
      imagePath ? getDeepSeekVisionModel() : getDeepSeekModel(),
      true,
      imagePath ? activeClient : undefined,
    )
    const parsed = normalizeFoodAnalysisFromAgent(parseJson<unknown>(result), payload)
    const calories = parsed.calories

    return {
      mode: 'agent',
      ...parsed,
      remainingCalories: payload.calorieGoal + payload.activeCalories - payload.eatenCalories - calories,
    }
  } catch (error) {
    console.warn('[deepseek] food analysis failed, using fallback:', readableError(error))
    return fallback
  }
}

export async function buildHealthAdvice(payload: HealthPayload): Promise<HealthAdvice> {
  const fallback = buildFallbackHealth(payload)
  if (!getActiveAgentClientConfig()) return fallback

  try {
    const result = await runAgentTurn(
      'health advice',
      [
        {
          role: 'system',
          content: '你是 JSON 输出严格执行器，请仅输出 JSON，不要添加任何解释。',
        },
        { role: 'user', content: buildHealthPrompt(payload) },
      ],
      healthSchema,
      getDeepSeekModel(),
    )
    const parsed = parseJson<Omit<HealthAdvice, 'mode'>>(result)

    return {
      mode: 'agent',
      summary: parsed.summary,
      recoveryRisk: parsed.recoveryRisk,
      nextActions: parsed.nextActions.slice(0, 4),
    }
  } catch (error) {
    console.warn('[deepseek] health advice failed, using fallback:', readableError(error))
    return fallback
  }
}

export async function chatWithAgent(payload: AgentChatPayload): Promise<AgentChatResponse> {
  const fallback = buildFallbackChat(payload)
  if (!getActiveAgentClientConfig()) return fallback

  try {
    const result = await runAgentTurn(
      'agent chat',
      [
        {
          role: 'system',
          content:
            '你是 FitAgent 私人健康运动智能体。请严格基于当前用户上下文输出中文自然语言，禁止输出 JSON。',
        },
        { role: 'user', content: buildChatPrompt(payload) },
      ],
      chatSchema,
      getDeepSeekModel(),
      false,
    )
    return { mode: 'agent', reply: readChatReply(result) }
  } catch (error) {
    console.warn('[deepseek] agent chat failed, using fallback:', readableError(error))
    return fallback
  }
}

export async function streamChatWithAgent(
  payload: AgentChatPayload,
  callbacks: AgentChatStreamCallbacks = {},
): Promise<AgentChatResponse> {
  const fallback = buildFallbackChat(payload)
  if (!getActiveAgentClientConfig()) {
    await emitReplyText(fallback.reply, callbacks)
    return fallback
  }

  let emitted = ''

  try {
    callbacks.onStatus?.('正在读取记忆和本地 RAG...')
    const result = await streamAgentReply(
      [
        {
          role: 'system',
          content:
            '你是 FitAgent 私人健康运动智能体。请基于用户上下文生成中文自然语言，不要输出 JSON 或 Markdown 代码块。',
        },
        { role: 'user', content: buildChatStreamPrompt(payload) },
      ],
      getDeepSeekModel(),
      callbacks,
    )
    emitted = result
    if (!emitted) {
      await emitReplyText(fallback.reply, callbacks)
      return fallback
    }
    return { mode: 'agent', reply: emitted }
  } catch (error) {
    console.warn('[deepseek] streamed agent chat failed, using fallback:', readableError(error))
    if (emitted) {
      callbacks.onReplace?.(fallback.reply)
    } else {
      await emitReplyText(fallback.reply, callbacks)
    }
    return fallback
  }
}

export function calculateNutritionTarget(profile: ProfilePayload): NutritionTarget {
  const activityFactor = profile.activityLevel === 'high' ? 1.72 : profile.activityLevel === 'medium' ? 1.45 : 1.25
  const goalOffset = profile.goal === 'fat_loss' ? -350 : profile.goal === 'muscle_gain' ? 250 : 0
  const sexOffset = profile.sex === 'male' ? 5 : -161
  const bmr = Math.round(10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age + sexOffset)
  const tdee = Math.round(bmr * activityFactor)
  const calorieGoal = Math.max(1200, Math.round(tdee + goalOffset))
  const proteinGoal = Math.round(profile.weightKg * (profile.goal === 'muscle_gain' ? 2 : 1.7))
  const fatGoal = Math.round((calorieGoal * 0.25) / 9)
  const carbsGoal = Math.round((calorieGoal - proteinGoal * 4 - fatGoal * 9) / 4)

  return {
    mode: 'formula',
    calorieGoal,
    bmr,
    tdee,
    proteinGoal,
    carbsGoal,
    fatGoal,
    summary: `按身高 ${profile.heightCm} cm、体重 ${profile.weightKg} kg 和当前目标计算。`,
  }
}

function buildMotionPrompt(payload: MotionPayload) {
  return [
    '你是运动监测 app 的后端运动教练智能体。',
    '请根据随消息提供的视频关键帧自动识别动作，不要依赖用户手动选择。',
    '识别后给出姿态质量评分、主要风险和可执行纠正建议；如果画面角度、遮挡或帧数不足以判断，movementName 写“无法确定动作”，confidence 不超过 0.4，并给出重新拍摄建议。',
    '必须只输出一个 JSON 对象，不要 Markdown，不要解释文字，不要省略字段。',
    '固定字段示例：{"movementName":"深蹲","confidence":0.82,"summary":"一句总体评价","score":78,"issues":[{"title":"问题","detail":"纠正方法","severity":"warning"}],"nextActions":[{"title":"下一步","detail":"具体执行","priority":"medium"}]}',
    'confidence 必须是 0-1 小数；score 必须是 0-100 数字；issues 最多 4 条；nextActions 最多 4 条。',
    `视频文件名：${payload.videoName}`,
    `关键帧数量：${payload.videoFrames.length}`,
    `今日运动消耗：${payload.activeCalories} kcal`,
    `今日已摄入：${payload.eatenCalories} kcal`,
    `基础目标：${payload.calorieGoal} kcal`,
  ].join('\n')
}

function buildFoodPrompt(payload: FoodPayload) {
  return [
    '你是运动监测 app 的后端饮食热量智能体。',
    '如果提供了图片，请估算餐食名称、总热量、蛋白质、碳水、脂肪、主要食材成分和可信度。',
    '必须只输出一个 JSON 对象，不要 Markdown，不要解释文字，不要省略字段。',
    '固定字段示例：{"name":"餐食名称","calories":0,"protein":0,"carbs":0,"fat":0,"ingredients":[{"name":"食材","amount":"估算克重或份量","calories":0,"protein":0,"carbs":0,"fat":0}],"confidence":0.7,"advice":"一句饮食建议"}',
    'calories、protein、carbs、fat、confidence 必须是数字；confidence 用 0-1 小数，不要写百分号。',
    'ingredients 必须拆成用户能看懂的食物成分，不要只返回整道菜名称；无法判断时返回空数组。',
    '如果图片无法确定，也必须返回完整 JSON：name 用“待确认餐食”，数值填 0，ingredients 填 []，confidence 填 0，并在 advice 里提示补充餐食线索。',
    `前端候选名称：${payload.foodName}`,
    `基础目标：${payload.calorieGoal} kcal`,
    `今日运动消耗：${payload.activeCalories} kcal`,
    `当前已摄入：${payload.eatenCalories} kcal`,
  ].join('\n')
}

function buildHealthPrompt(payload: HealthPayload) {
  return [
    '你是运动监测 app 的后端健康数据智能体。',
    '请根据健康平台同步的运动、摄入和热量目标，给出恢复风险和下一步建议，输出严格 JSON。',
    `数据来源：${payload.source}`,
    `基础目标：${payload.calorieGoal} kcal`,
    `运动记录：${JSON.stringify(payload.workouts)}`,
    `饮食记录：${JSON.stringify(payload.meals)}`,
  ].join('\n')
}

function buildChatPrompt(payload: AgentChatPayload) {
  const snapshot = buildHealthSnapshot(payload.state)
  const promptState = buildChatPromptState(payload.state, snapshot.date)
  const agent = resolveChatAgent(payload.agentId)
  return [
    '你是 FitAgent 运动监测 app 的强大私人健康运动智能体。',
    '你已经加载内置健康 skill hub，会结合用户长期记忆、当前记录和最近对话回答。',
    `当前智能体角色：${agent.name}。角色说明：${agent.description}`,
    `当前智能体重点：${agent.focus.join('、')}`,
    `当前智能体规则：${JSON.stringify(agent.rules)}`,
    '回答必须只基于当前登录用户的数据；不要声称能访问其他用户数据。',
    '不要给医疗诊断；涉及伤病、明显疼痛、疾病、用药或异常症状时，优先建议降低强度并咨询医生/康复师。',
    '输出严格 JSON，reply 用中文。回复要具体、短、可执行，不要泛泛而谈。',
    'reply 字段必须直接写自然语言正文，不要在 reply 里再次放 JSON 字符串、Markdown 代码块或转义后的 JSON。',
    '回答结构建议：先给结论，再给依据，再给今天可做的 1-3 个动作。用户问简单问题时可以更短。',
    `当前日期：${snapshot.date}`,
    '饮食数据规则：今日摄入只允许使用当前健康数据快照中的今日餐食。若今日餐食为 0 条，必须明确今天还没有饮食记录；不要把历史餐食、旧对话或长期记忆里的餐食说成今天吃过。',
    `当前用户：${payload.user.displayName} (${payload.user.username})`,
    `内置健康 skill hub：${JSON.stringify(healthSkillHub)}`,
    `长期记忆：${JSON.stringify(payload.memories)}`,
    `本地 RAG 知识库检索结果：${JSON.stringify(payload.ragContext)}`,
    `当前健康数据快照：${JSON.stringify(snapshot)}`,
    `今日过滤后的用户状态：${JSON.stringify(promptState)}`,
    `最近对话：${JSON.stringify(payload.history.slice(-12))}`,
    `用户问题：${payload.message}`,
  ].join('\n')
}

function buildChatStreamPrompt(payload: AgentChatPayload) {
  const snapshot = buildHealthSnapshot(payload.state)
  const promptState = buildChatPromptState(payload.state, snapshot.date)
  const agent = resolveChatAgent(payload.agentId)
  return [
    '你是 FitAgent 运动监测 app 的强大私人健康运动智能体。',
    '这是一个流式聊天接口。你必须直接输出中文自然语言正文，不要输出 JSON，不要输出 Markdown 代码块，不要包裹在 reply 字段里。',
    '你已经加载内置健康 skill hub，会结合用户长期记忆、当前记录和最近对话回答。',
    `当前智能体角色：${agent.name}。角色说明：${agent.description}`,
    `当前智能体重点：${agent.focus.join('、')}`,
    `当前智能体规则：${JSON.stringify(agent.rules)}`,
    '回答必须只基于当前登录用户的数据；不要声称能访问其他用户数据。',
    '不要给医疗诊断；涉及伤病、明显疼痛、疾病、用药或异常症状时，优先建议降低强度并咨询医生/康复师。',
    '回复要具体、短、可执行，不要泛泛而谈。先给结论，再给依据，再给今天可做的 1-3 个动作。',
    `当前日期：${snapshot.date}`,
    '饮食数据规则：今日摄入只允许使用当前健康数据快照中的今日餐食。若今日餐食为 0 条，必须明确今天还没有饮食记录；不要把历史餐食、旧对话或长期记忆里的餐食说成今天吃过。',
    `当前用户：${payload.user.displayName} (${payload.user.username})`,
    `内置健康 skill hub：${JSON.stringify(healthSkillHub)}`,
    `长期记忆：${JSON.stringify(payload.memories)}`,
    `本地 RAG 知识库检索结果：${JSON.stringify(payload.ragContext)}`,
    `当前健康数据快照：${JSON.stringify(snapshot)}`,
    `今日过滤后的用户状态：${JSON.stringify(promptState)}`,
    `最近对话：${JSON.stringify(payload.history.slice(-12))}`,
    `用户问题：${payload.message}`,
  ].join('\n')
}

function parseJson<T>(value: string): T {
  try {
    return JSON.parse(value) as T
  } catch {
    const match = value.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Agent response was not JSON')
    return JSON.parse(match[0]) as T
  }
}

function readChatReply(value: string) {
  try {
    return normalizeReplyValue(parseJson<unknown>(value))
  } catch {
    return normalizeReplyValue(value)
  }
}

function normalizeReplyValue(value: unknown): string {
  let current = value

  for (let depth = 0; depth < 4; depth += 1) {
    const record = asRecord(current)
    if (record && typeof record.reply === 'string') {
      current = record.reply
      continue
    }

    if (typeof current !== 'string') break
    const trimmed = current.trim()
    if (!trimmed) return ''

    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (parsed === current) break
      current = parsed
      continue
    } catch {
      break
    }
  }

  return String(current)
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .trim()
}

function emitReplyUpdate(nextReply: string, emitted: string, callbacks: AgentChatStreamCallbacks) {
  if (!nextReply || nextReply === emitted) return emitted

  if (nextReply.startsWith(emitted)) {
    callbacks.onDelta?.(nextReply.slice(emitted.length))
    return nextReply
  }

  callbacks.onReplace?.(nextReply)
  return nextReply
}

async function emitReplyText(reply: string, callbacks: AgentChatStreamCallbacks) {
  const chunkSize = 3
  for (let index = 0; index < reply.length; index += chunkSize) {
    if (callbacks.signal?.aborted) return
    callbacks.onDelta?.(reply.slice(index, index + chunkSize))
    await sleep(35)
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function buildFallbackMotion(payload: MotionPayload): MotionAnalysis {
  const movementName = guessMovementNameFromVideoName(payload.videoName) || '无法确定动作'
  const hasFrames = payload.videoFrames.length > 0

  return {
    mode: 'fallback',
    movementName,
    confidence: movementName === '无法确定动作' ? 0.2 : 0.35,
    summary: hasFrames
      ? '已读取视频关键帧，但当前没有可用视觉模型配置；请在后台启用视觉模型并填写 API Key 后重新分析。'
      : '没有拿到可用视频关键帧，暂时无法自动识别动作；请上传清晰、完整、可播放的视频后重试。',
    score: buildFallbackMotionScore(payload),
    issues: buildGenericMotionIssues(movementName),
    nextActions: buildGenericMotionNextActions(movementName),
  }
}

function buildFallbackMotionScore(payload: MotionPayload) {
  const seed = Array.from(`${payload.videoName}${payload.videoFrames.length}`).reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return 68 + (seed % 18)
}

function guessMovementNameFromVideoName(videoName: string) {
  const normalized = videoName.toLowerCase()
  if (/squat|深蹲|蹲/.test(normalized)) return '深蹲'
  if (/lunge|弓步|箭步/.test(normalized)) return '弓步蹲'
  if (/push|pushup|push-up|俯卧撑|伏地挺身/.test(normalized)) return '俯卧撑'
  if (/deadlift|硬拉/.test(normalized)) return '硬拉'
  if (/plank|平板/.test(normalized)) return '平板支撑'
  if (/pull|引体|划船/.test(normalized)) return '上肢拉力动作'
  return ''
}

function buildGenericMotionIssues(movementName: string): AgentIssue[] {
  const catalog: Record<string, AgentIssue[]> = {
    深蹲: [
      { title: '膝盖轨迹', detail: '检查膝盖是否跟随脚尖方向，避免下蹲底部内扣。', severity: 'warning' },
      { title: '髋部深度', detail: '保持腹压和脚掌三点受力，稳定到达目标深度后再起身。', severity: 'ok' },
      { title: '躯干角度', detail: '起身时先推地再伸髋，避免胸椎过早前倾。', severity: 'warning' },
    ],
    弓步蹲: [
      { title: '前膝稳定', detail: '前脚掌保持三点受力，落地速度先降下来。', severity: 'warning' },
      { title: '左右平衡', detail: '左右组保持相同步幅，减少骨盆旋转。', severity: 'ok' },
      { title: '髋部控制', detail: '加入单腿臀桥激活后再做主训练。', severity: 'warning' },
    ],
    俯卧撑: [
      { title: '肩肘角度', detail: '肘部收至 45-60 度，减少肩部压力。', severity: 'warning' },
      { title: '核心张力', detail: '后半程不要塌腰，必要时减少重复次数。', severity: 'warning' },
      { title: '动作幅度', detail: '胸部接近地面后再推起，保持全程幅度。', severity: 'ok' },
    ],
    硬拉: [
      { title: '背部中立', detail: '离地前先收紧背阔，避免腰背角度快速变化。', severity: 'danger' },
      { title: '器械路径', detail: '让重量贴近小腿向上移动，减少前移力矩。', severity: 'warning' },
      { title: '髋膝节奏', detail: '锁定阶段保持臀部发力，不要过度后仰。', severity: 'ok' },
    ],
  }

  return catalog[movementName] ?? [
    { title: '动作识别', detail: '请录制完整起始位、最低点和结束位，人物尽量占画面 70% 以上。', severity: 'warning' },
    { title: '拍摄角度', detail: '优先上传侧面或 45 度视角，避免遮挡膝、髋、肩关键关节。', severity: 'warning' },
    { title: '训练控制', detail: '下一组先降低速度和负重，确认动作轨迹稳定后再加量。', severity: 'ok' },
  ]
}

function buildGenericMotionNextActions(movementName: string): AgentTask[] {
  return [
    {
      title: movementName === '无法确定动作' ? '重新拍摄' : '下一组降速',
      detail: movementName === '无法确定动作'
        ? '用固定机位拍摄完整动作周期，保留头、肩、髋、膝、踝在画面内。'
        : '每次离心控制 2-3 秒，先把动作稳定性拉高。',
      priority: 'high',
    },
    {
      title: '补充视角',
      detail: '下一次上传侧面和正面各一段，方便视觉模型比对关节轨迹。',
      priority: 'medium',
    },
  ]
}

function buildFallbackFood(payload: FoodPayload): FoodAnalysis {
  const presets: Record<string, Omit<FoodAnalysis, 'mode' | 'remainingCalories' | 'advice' | 'confidence'>> = {
    牛肉饭: {
      name: '牛肉饭',
      calories: 720,
      protein: 35,
      carbs: 88,
      fat: 22,
      ingredients: [
        { name: '米饭', amount: '220g', calories: 286, protein: 6, carbs: 63, fat: 1 },
        { name: '牛肉', amount: '120g', calories: 250, protein: 26, carbs: 0, fat: 16 },
        { name: '酱汁和配菜', amount: '80g', calories: 184, protein: 3, carbs: 25, fat: 5 },
      ],
    },
    三文鱼便当: {
      name: '三文鱼便当',
      calories: 650,
      protein: 42,
      carbs: 62,
      fat: 24,
      ingredients: [
        { name: '三文鱼', amount: '140g', calories: 290, protein: 31, carbs: 0, fat: 18 },
        { name: '糙米饭', amount: '180g', calories: 220, protein: 5, carbs: 46, fat: 2 },
        { name: '蔬菜', amount: '120g', calories: 80, protein: 4, carbs: 14, fat: 1 },
        { name: '调味汁', amount: '20g', calories: 60, protein: 2, carbs: 2, fat: 3 },
      ],
    },
    拿铁和贝果: {
      name: '拿铁和贝果',
      calories: 510,
      protein: 19,
      carbs: 72,
      fat: 16,
      ingredients: [
        { name: '贝果', amount: '1 个', calories: 290, protein: 10, carbs: 56, fat: 2 },
        { name: '拿铁', amount: '350ml', calories: 180, protein: 8, carbs: 14, fat: 10 },
        { name: '涂抹酱', amount: '10g', calories: 40, protein: 1, carbs: 2, fat: 4 },
      ],
    },
    番茄鸡蛋面: {
      name: '番茄鸡蛋面',
      calories: 590,
      protein: 24,
      carbs: 86,
      fat: 16,
      ingredients: [
        { name: '面条', amount: '180g', calories: 300, protein: 10, carbs: 62, fat: 2 },
        { name: '鸡蛋', amount: '2 个', calories: 150, protein: 12, carbs: 1, fat: 10 },
        { name: '番茄汤底', amount: '250g', calories: 140, protein: 2, carbs: 23, fat: 4 },
      ],
    },
  }
  const picked = presets[payload.foodName] ?? {
    name: payload.foodName === '未命名餐食' ? '待 AI 识别餐食' : payload.foodName,
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    ingredients: [],
  }

  return {
    mode: 'fallback',
    ...picked,
    calories: picked.calories,
    protein: picked.protein,
    carbs: picked.carbs,
    fat: picked.fat,
    ingredients: picked.ingredients,
    confidence: picked.calories > 0 ? 0.72 : 0,
    remainingCalories: payload.calorieGoal + payload.activeCalories - payload.eatenCalories - picked.calories,
    advice:
      picked.calories > 0
        ? '当前为本地规则估算；模型未返回图像分析结果，本次未使用图片视觉识别。'
        : '模型未返回图像分析结果，本地规则无法仅凭图片识别食物。请在后台管理的模型配置中启用可用供应商并填写 API Key；如果当前模型不支持图片，请输入餐食线索后再试。',
  }
}

function buildFallbackHealth(payload: HealthPayload): HealthAdvice {
  const activeCalories = payload.workouts.reduce((sum, item) => sum + item.calories, 0)
  const eatenCalories = payload.meals.reduce((sum, item) => sum + item.calories, 0)
  const remaining = payload.calorieGoal + activeCalories - eatenCalories
  const recoveryRisk = activeCalories > 700 ? 'medium' : 'low'

  return {
    mode: 'fallback',
    summary: `${payload.source} 数据已进入后端。今日消耗 ${activeCalories} kcal，剩余 ${remaining} kcal。`,
    recoveryRisk,
    nextActions: [
      {
        title: remaining > 650 ? '晚餐补足蛋白和碳水' : '晚餐控制油脂',
        detail: remaining > 650 ? '适合安排鱼肉、米饭和蔬菜。' : '优先高蛋白、低油烹饪。',
        priority: 'medium',
      },
      {
        title: recoveryRisk === 'medium' ? '加入恢复流程' : '增加轻活动',
        detail: recoveryRisk === 'medium' ? '今晚做 8 分钟拉伸和 10 分钟低强度步行。' : '饭后 20 分钟步行即可。',
        priority: recoveryRisk === 'medium' ? 'high' : 'low',
      },
    ],
  }
}

function buildFallbackChat(payload: AgentChatPayload): AgentChatResponse {
  const snapshot = buildHealthSnapshot(payload.state)
  const intent = detectChatIntent(payload.message)
  const agent = resolveChatAgent(payload.agentId)
  const memoryDigest = payload.memories
    .slice(0, 4)
    .map((memory) => memory.content)
    .join('；')
  const ragDigest = payload.ragContext
    .slice(0, 2)
    .map((chunk) => `${chunk.title}：${chunk.content.replace(/\s+/g, ' ').slice(0, 120)}`)
    .join('；')
  const lines = [`${payload.user.displayName}，我是${agent.name}，已读取你的用户记忆、饮食、运动和目标记录。`]

  if (memoryDigest) {
    lines.push(`我记得：${memoryDigest}。`)
  }

  if (ragDigest) {
    lines.push(`本地知识库参考：${ragDigest}。`)
  }

  lines.push(snapshot.summary)

  if (agent.id === 'fat_loss') {
    lines.push(
      snapshot.remainingCalories === null
        ? '先生成热量目标；今天先把蛋白质、步数和晚餐油脂控制住，不建议直接大幅节食。'
        : `减脂重点：今天剩余约 ${snapshot.remainingCalories} kcal，优先保证蛋白 ${snapshot.proteinGoal ?? 0}g 目标，安排 25-40 分钟低到中等强度有氧或增加步数。`,
    )
  } else if (agent.id === 'strength') {
    lines.push('力量增肌建议：主训练选 3-5 个复合动作，每组保留 1-3 次力竭余量；训练后补足蛋白和碳水，下一次用重量、次数或组数做小幅进阶。')
  } else if (agent.id === 'women_shape') {
    lines.push('塑型建议：今天围绕臀腿、背肩和核心做 30-45 分钟，优先臀桥/罗马尼亚硬拉/划船/侧向核心；动作稳定比重量更重要。')
  } else if (agent.id === 'running') {
    lines.push('跑步有氧建议：若无疼痛，今天做 25-40 分钟能完整说话的轻松跑或快走；想提升心肺时先稳定周频率，再加一次节奏训练。')
  } else if (agent.id === 'recovery') {
    lines.push('恢复建议：先看疼痛、睡眠和疲劳；有局部疼痛就避开诱发动作，改低冲击活动、灵活性和轻量激活。')
  } else if (agent.id === 'nutrition') {
    lines.push(
      snapshot.remainingCalories === null
        ? '营养建议：先生成目标；每餐用“蛋白一掌、蔬菜半盘、主食一拳、少油酱”的结构。'
        : `营养建议：今天剩余约 ${snapshot.remainingCalories} kcal，下一餐优先补蛋白和高纤维食物，油脂和含糖饮料先控住。`,
    )
  } else if (agent.id === 'habit') {
    lines.push('习惯执行建议：今天只盯 3 件事：记录下一餐、完成一次 20 分钟活动、睡前确认蛋白和热量是否接近目标。')
  } else if (intent === 'nutrition') {
    lines.push(
      snapshot.remainingCalories === null
        ? '先去“目标”页生成热量目标；今天饮食建议先保证每餐有一份优质蛋白、半盘蔬菜。'
        : `今天还剩约 ${snapshot.remainingCalories} kcal；下一餐优先补 ${snapshot.proteinGoal !== null && snapshot.protein < snapshot.proteinGoal ? '蛋白质' : '蔬菜和低油主食'}，避免再叠加高油酱汁。`,
    )
  } else if (intent === 'training') {
    lines.push(
      snapshot.recoveryRisk === 'medium' || snapshot.recoveryRisk === 'high'
        ? '训练建议降一级强度：20-30 分钟低强度有氧，加 8 分钟拉伸或灵活性练习。'
        : '训练建议：热身 8 分钟，主训练 30-45 分钟，保留 2 次力竭余量，结束后记录动作感受。',
    )
  } else if (intent === 'recovery') {
    lines.push('如果疼痛持续或影响动作，今天先停止相关动作，改为轻活动和拉伸；明显疼痛建议找医生或康复师评估。')
  } else {
    lines.push('今天优先做三件事：记录下一餐、完成一次低到中等强度活动、睡前回顾是否达到蛋白和热量目标。')
  }

  lines.push('当前是本地规则回复；AI 智能体可用时会调用内置健康 skill hub 生成更细的个性化方案。')

  return { mode: 'fallback', reply: lines.join('') }
}

function resolveChatAgent(agentId: string | undefined) {
  return chatAgents.find((agent) => agent.id === agentId) ?? chatAgents[0]
}

function buildChatPromptState(state: UserAppState, date: string) {
  const allMeals = Array.isArray(state.meals) ? state.meals.map(asRecord).filter(Boolean) : []
  const todayMeals = allMeals.filter((meal) => isRecordOnDate(meal, date))
  return {
    ...state,
    meals: todayMeals,
    chatContext: {
      date,
      todayMealsCount: todayMeals.length,
      historicalMealsCount: Math.max(0, allMeals.length - todayMeals.length),
    },
  }
}

function buildHealthSnapshot(state: UserAppState) {
  const date = toDateInputValue()
  const target = asRecord(state.target)
  const motionAnalysis = asRecord(state.motionAnalysis)
  const healthAdvice = asRecord(state.healthAdvice)
  const allMeals = Array.isArray(state.meals) ? state.meals.map(asRecord).filter(Boolean) : []
  const meals = allMeals.filter((meal) => isRecordOnDate(meal, date))
  const historicalMealsCount = Math.max(0, allMeals.length - meals.length)
  const workouts = Array.isArray(state.workouts) ? state.workouts.map(asRecord).filter(Boolean) : []
  const calorieGoal = target ? readFiniteNumber(target.calorieGoal) : null
  const proteinGoal = target ? readFiniteNumber(target.proteinGoal) : null
  const carbsGoal = target ? readFiniteNumber(target.carbsGoal) : null
  const fatGoal = target ? readFiniteNumber(target.fatGoal) : null
  const calories = meals.reduce((sum, meal) => sum + readNumberField(meal, 'calories'), 0)
  const protein = meals.reduce((sum, meal) => sum + readNumberField(meal, 'protein'), 0)
  const carbs = meals.reduce((sum, meal) => sum + readNumberField(meal, 'carbs'), 0)
  const fat = meals.reduce((sum, meal) => sum + readNumberField(meal, 'fat'), 0)
  const activeCalories = workouts.reduce((sum, workout) => sum + readNumberField(workout, 'calories'), 0)
  const workoutMinutes = workouts.reduce((sum, workout) => sum + readNumberField(workout, 'minutes'), 0)
  const remainingCalories = calorieGoal === null ? null : Math.round(calorieGoal + activeCalories - calories)
  const latestMeals = meals
    .slice(0, 5)
    .map((meal) => readStringField(meal, 'name'))
    .filter(Boolean)
  const latestWorkouts = workouts
    .slice(0, 5)
    .map((workout) => readStringField(workout, 'name'))
    .filter(Boolean)
  const recoveryRisk = healthAdvice ? readStringField(healthAdvice, 'recoveryRisk') : ''
  const motionScore = motionAnalysis ? readFiniteNumber(motionAnalysis.score) : null
  const motionSummary = motionAnalysis ? readStringField(motionAnalysis, 'summary') : ''
  const summary = [
    `当前日期 ${date}。今日记录：${meals.length} 条饮食、${workouts.length} 条运动。`,
    historicalMealsCount ? `另有 ${historicalMealsCount} 条历史饮食记录，不属于今天，不能计入今日摄入。` : '',
    calorieGoal === null ? '尚未生成热量目标。' : `目标 ${calorieGoal} kcal，已摄入约 ${Math.round(calories)} kcal，活动消耗约 ${Math.round(activeCalories)} kcal，剩余约 ${remainingCalories} kcal。`,
    proteinGoal === null ? '' : `蛋白 ${Math.round(protein)}/${proteinGoal}g，碳水 ${Math.round(carbs)}/${carbsGoal ?? 0}g，脂肪 ${Math.round(fat)}/${fatGoal ?? 0}g。`,
    workoutMinutes ? `运动时长 ${workoutMinutes} 分钟。` : '',
    recoveryRisk ? `恢复风险 ${recoveryRisk}。` : '',
    motionScore === null ? '' : `最近动作评分 ${motionScore}。`,
  ]
    .filter(Boolean)
    .join('')

  return {
    date,
    summary,
    calorieGoal,
    remainingCalories,
    calories: Math.round(calories),
    activeCalories: Math.round(activeCalories),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
    proteinGoal,
    carbsGoal,
    fatGoal,
    mealsCount: meals.length,
    historicalMealsCount,
    workoutsCount: workouts.length,
    workoutMinutes,
    latestMeals,
    latestWorkouts,
    recoveryRisk,
    motionScore,
    motionSummary,
  }
}

function detectChatIntent(message: string) {
  if (/痛|疼|伤|恢复|睡眠|疲劳|不舒服|膝|腰|肩/.test(message)) return 'recovery'
  if (/吃|饮食|热量|蛋白|碳水|脂肪|餐|饭|饿|减脂/.test(message)) return 'nutrition'
  if (/练|训练|运动|跑|力量|深蹲|俯卧撑|硬拉|有氧|增肌/.test(message)) return 'training'
  return 'general'
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function readNumberField(record: Record<string, unknown> | null, key: string) {
  if (!record) return 0
  const value = Number(record[key])
  return Number.isFinite(value) ? value : 0
}

function readFiniteNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function readStringField(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key]
  return typeof value === 'string' ? value : ''
}

function isRecordOnDate(record: Record<string, unknown> | null, date: string) {
  return readRecordDate(record) === date
}

function readRecordDate(record: Record<string, unknown> | null) {
  const directDate = readStringField(record, 'date')
  if (/^\d{4}-\d{2}-\d{2}$/.test(directDate)) return directDate

  const createdAt = readStringField(record, 'createdAt') || readStringField(record, 'created_at')
  if (!createdAt) return ''
  const parsedDate = new Date(createdAt)
  if (Number.isNaN(parsedDate.getTime())) return ''
  return toDateInputValue(parsedDate)
}

function toDateInputValue(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 10)
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)))
}

function readableError(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function normalizeMotionAnalysisFromAgent(value: unknown, payload: MotionPayload): Omit<MotionAnalysis, 'mode'> {
  const valueRecord = asRecord(value)
  const record = valueRecord && !Array.isArray(value) ? valueRecord : null
  const fallbackMovement = guessMovementNameFromVideoName(payload.videoName) || '无法确定动作'
  const movementName = readStringByKeys(
    record,
    ['movementName', 'movement', 'exercise', 'action', '动作名称', '动作', '识别动作'],
    fallbackMovement,
  )
  const rawConfidence = readConfidenceByKeys(record, ['confidence', 'movementConfidence', '识别置信度', '可信度'])
  const confidence = rawConfidence || (movementName === '无法确定动作' ? 0.35 : 0.65)
  const fallbackScore = buildFallbackMotionScore(payload)
  const rawScore = readRoundedNumberByKeys(record, ['score', 'qualityScore', 'formScore', '评分', '分数'])
  const issues = readArrayByKeys(record, ['issues', 'corrections', 'problems', 'risks', '动作问题', '问题', '纠正建议'])
    .map((item, index) => normalizeMotionIssueFromAgent(item, index))
    .filter((item): item is AgentIssue => Boolean(item))
    .slice(0, 4)
  const nextActions = readArrayByKeys(record, ['nextActions', 'actions', 'tasks', 'tips', 'next', '下一步', '训练建议', '建议'])
    .map((item, index) => normalizeMotionTaskFromAgent(item, index))
    .filter((item): item is AgentTask => Boolean(item))
    .slice(0, 4)
  const summary =
    readStringByKeys(record, ['summary', 'analysis', 'advice', '总体评价', '总结', '分析'], '') ||
    (movementName === '无法确定动作'
      ? '画面信息不足，暂时无法稳定识别动作。请上传正面或侧面完整动作视频后重试。'
      : `视觉模型识别为${movementName}，请结合评分和纠正项调整下一组动作。`)

  return {
    movementName,
    confidence,
    summary,
    score: rawScore > 0 ? clampScore(rawScore) : fallbackScore,
    issues: issues.length ? issues : buildGenericMotionIssues(movementName),
    nextActions: nextActions.length ? nextActions : buildGenericMotionNextActions(movementName),
  }
}

function normalizeMotionIssueFromAgent(value: unknown, index: number): AgentIssue | null {
  if (typeof value === 'string') {
    const detail = value.trim()
    return detail ? { title: `观察 ${index + 1}`, detail, severity: 'warning' } : null
  }

  const record = asRecord(value)
  if (!record || Array.isArray(value)) return null
  const title = readStringByKeys(record, ['title', 'name', 'problem', 'risk', '问题', '标题'], `观察 ${index + 1}`)
  const detail = readStringByKeys(record, ['detail', 'description', 'advice', 'correction', '建议', '详情', '纠正'], '')
  if (!title && !detail) return null
  return {
    title,
    detail: detail || '保持动作稳定，下一组降低速度并重新录制侧面视角。',
    severity: readMotionSeverity(record.severity ?? record.level ?? record.risk ?? record.严重程度),
  }
}

function normalizeMotionTaskFromAgent(value: unknown, index: number): AgentTask | null {
  if (typeof value === 'string') {
    const detail = value.trim()
    return detail ? { title: `下一步 ${index + 1}`, detail, priority: 'medium' } : null
  }

  const record = asRecord(value)
  if (!record || Array.isArray(value)) return null
  const title = readStringByKeys(record, ['title', 'name', 'action', 'task', '标题', '动作'], `下一步 ${index + 1}`)
  const detail = readStringByKeys(record, ['detail', 'description', 'instruction', 'advice', '详情', '建议'], '')
  if (!title && !detail) return null
  return {
    title,
    detail: detail || '下一组先降低速度，保留 2 次余力，再观察动作是否稳定。',
    priority: readMotionPriority(record.priority ?? record.level ?? record.importance ?? record.优先级),
  }
}

function readMotionSeverity(value: unknown): AgentIssue['severity'] {
  const text = String(value ?? '').toLowerCase()
  if (/danger|high|severe|严重|高|风险|错误/.test(text)) return 'danger'
  if (/ok|good|normal|low|正常|良好|稳定|低/.test(text)) return 'ok'
  return 'warning'
}

function readMotionPriority(value: unknown): AgentTask['priority'] {
  const text = String(value ?? '').toLowerCase()
  if (/high|urgent|高|优先|立即/.test(text)) return 'high'
  if (/low|低|稍后/.test(text)) return 'low'
  return 'medium'
}

function normalizeFoodAnalysisFromAgent(
  value: unknown,
  payload: FoodPayload,
): Omit<FoodAnalysis, 'mode' | 'remainingCalories'> {
  const valueRecord = asRecord(value)
  const record = valueRecord && !Array.isArray(value) ? valueRecord : null
  const ingredients = readArrayByKeys(record, ['ingredients', '食材', '成分', 'components'])
    .map((item, index) => normalizeFoodIngredientFromAgent(item, index))
    .filter((item): item is FoodIngredient => Boolean(item))
    .slice(0, 8)

  const ingredientCalories = sumIngredientField(ingredients, 'calories')
  const ingredientProtein = sumIngredientField(ingredients, 'protein')
  const ingredientCarbs = sumIngredientField(ingredients, 'carbs')
  const ingredientFat = sumIngredientField(ingredients, 'fat')

  const protein = readRoundedNumberByKeys(record, ['protein', 'proteinG', '蛋白', '蛋白质']) || ingredientProtein
  const carbs = readRoundedNumberByKeys(record, ['carbs', 'carbohydrates', 'carbsG', '碳水', '碳水化合物']) || ingredientCarbs
  const fat = readRoundedNumberByKeys(record, ['fat', 'fatG', '脂肪']) || ingredientFat
  const caloriesFromMacros = protein > 0 || carbs > 0 || fat > 0 ? Math.round(protein * 4 + carbs * 4 + fat * 9) : 0
  const calories =
    readRoundedNumberByKeys(record, ['calories', 'kcal', 'energy', 'totalCalories', '热量', '总热量']) ||
    ingredientCalories ||
    caloriesFromMacros
  const fallbackName =
    payload.foodName && payload.foodName !== '未命名餐食' ? payload.foodName : ingredients[0]?.name ?? '待确认餐食'
  const name = readStringByKeys(record, ['name', 'foodName', 'dish', '餐食名称', '食物名称', '名称'], fallbackName)
  const advice =
    readStringByKeys(record, ['advice', 'suggestion', 'summary', '建议', '分析'], '') ||
    (calories > 0
      ? `按模型返回结果估算约 ${calories} kcal；如份量偏大或汤油较多，请按实际摄入微调。`
      : '模型返回信息不足，请补充餐食线索后重试。')

  return {
    name,
    calories,
    protein,
    carbs,
    fat,
    ingredients,
    confidence: readConfidenceByKeys(record, ['confidence', 'score', '可信度']),
    advice,
  }
}

function normalizeFoodIngredientFromAgent(value: unknown, index: number): FoodIngredient | null {
  const valueRecord = asRecord(value)
  const record = valueRecord && !Array.isArray(value) ? valueRecord : null
  if (!record) return null

  const rawName = readStringByKeys(record, ['name', 'foodName', 'ingredient', '食材', '名称'], '')
  const rawAmount = readStringByKeys(record, ['amount', 'weight', 'portion', '份量', '重量'], '')
  const calories = readRoundedNumberByKeys(record, ['calories', 'kcal', 'energy', '热量'])
  const protein = readRoundedNumberByKeys(record, ['protein', 'proteinG', '蛋白', '蛋白质'])
  const carbs = readRoundedNumberByKeys(record, ['carbs', 'carbohydrates', 'carbsG', '碳水', '碳水化合物'])
  const fat = readRoundedNumberByKeys(record, ['fat', 'fatG', '脂肪'])
  const hasNutrition = calories > 0 || protein > 0 || carbs > 0 || fat > 0
  if (!rawName && !rawAmount && !hasNutrition) return null

  return {
    name: rawName || `食材 ${index + 1}`,
    amount: rawAmount || '估算份量',
    calories,
    protein,
    carbs,
    fat,
  }
}

function readArrayByKeys(record: Record<string, unknown> | null, keys: string[]) {
  if (!record) return []
  for (const key of keys) {
    const value = record[key]
    if (Array.isArray(value)) return value
  }
  return []
}

function readStringByKeys(record: Record<string, unknown> | null, keys: string[], fallback: string) {
  if (!record) return fallback
  for (const key of keys) {
    const value = record[key]
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (trimmed) return trimmed
  }
  return fallback
}

function readRoundedNumberByKeys(record: Record<string, unknown> | null, keys: string[]) {
  if (!record) return 0
  for (const key of keys) {
    const value = readLooseNumber(record[key])
    if (value !== null) return Math.max(0, Math.round(value))
  }
  return 0
}

function readConfidenceByKeys(record: Record<string, unknown> | null, keys: string[]) {
  if (!record) return 0
  for (const key of keys) {
    const value = readLooseNumber(record[key])
    if (value === null) continue
    const normalized = value > 1 ? value / 100 : value
    return Math.max(0, Math.min(1, normalized))
  }
  return 0
}

function readLooseNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null
  const match = value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)
  if (!match) return null
  const number = Number(match[0])
  return Number.isFinite(number) ? number : null
}

function sumIngredientField(ingredients: FoodIngredient[], key: 'calories' | 'protein' | 'carbs' | 'fat') {
  return Math.max(0, Math.round(ingredients.reduce((sum, ingredient) => sum + ingredient[key], 0)))
}

async function buildImageDataUrl(imagePath: string, mimeType: string) {
  const image = await fs.readFile(imagePath)
  const safeMimeType = /^image\/(jpeg|png|webp|gif)$/i.test(mimeType) ? mimeType : 'image/jpeg'
  return `data:${safeMimeType};base64,${image.toString('base64')}`
}

type ChatMessageImagePart = { type: 'image_url'; image_url: { url: string } }
type ChatMessageTextPart = { type: 'text'; text: string }

type ChatMessageInput = {
  role: 'system' | 'user' | 'assistant'
  content: string | Array<ChatMessageTextPart | ChatMessageImagePart>
}

type DeepSeekChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

function normalizeMessageForDeepSeek(message: ChatMessageInput): DeepSeekChatMessage {
  if (typeof message.content === 'string') {
    return {
      role: message.role,
      content: message.content,
    }
  }

  const text = message.content
    .map((part) => (part.type === 'text' ? part.text : ''))
    .filter(Boolean)
    .join('\n')
  const imageCount = message.content.filter((part) => part.type === 'image_url').length
  const visionHint = imageCount > 0 ? '\n\n提示：该模型不支持直接解析图片输入，请基于文本与用户上下文进行推断。' : ''
  return {
    role: message.role,
    content: `${text}${visionHint}`.trim(),
  }
}

function normalizeMessagesForDeepSeek(messages: ChatMessageInput[]): DeepSeekChatMessage[] {
  return messages.map((message) => normalizeMessageForDeepSeek(message))
}

function normalizeMessagesForCompletion(messages: ChatMessageInput[]): ChatMessageInput[] {
  const includesImage = messages.some((message) => Array.isArray(message.content) && message.content.some((part) => part.type === 'image_url'))
  return includesImage ? messages : normalizeMessagesForDeepSeek(messages)
}

async function runAgentTurn(
  label: string,
  messages: ChatMessageInput[],
  schema: unknown,
  model: string,
  jsonMode = true,
  providerOverride?: AgentModelProviderConfig,
): Promise<string> {
  if (!providerOverride && !getActiveAgentClientConfig()) throw new Error('agent client not ready')
  if (typeof schema === 'undefined') {
    void schema
  }
  void jsonMode

  const text = await runWithAbort(label, (signal) =>
    requestLangChainCompletion(model, normalizeMessagesForCompletion(messages), signal, providerOverride),
  )
  if (!text) throw new Error(`${label} returned empty response`)
  return text
}

async function streamAgentReply(
  messages: ChatMessageInput[],
  model: string,
  callbacks: AgentChatStreamCallbacks,
) {
  if (!getActiveAgentClientConfig()) return ''
  return runWithAbort('streamed agent chat', (signal) =>
    requestLangChainStream(model, normalizeMessagesForDeepSeek(messages), signal, callbacks),
  )
}

async function requestLangChainCompletion(
  model: string,
  messages: ChatMessageInput[],
  signal: AbortSignal,
  providerOverride?: AgentModelProviderConfig,
): Promise<string> {
  const completionModel = providerOverride
    ? createLangChainModelForProvider(providerOverride, model, {
      temperature: 0.2,
      maxTokens: 1500,
      streaming: false,
    })
    : createLangChainModel(model, {
      temperature: 0.2,
      maxTokens: 1500,
      streaming: false,
    })

  const response = await completionModel.invoke(messages as Parameters<typeof completionModel.invoke>[0], {
    signal,
  })
  return extractMessageContent(response).trim()
}

async function requestLangChainStream(
  model: string,
  messages: DeepSeekChatMessage[],
  timeoutSignal: AbortSignal,
  callbacks: AgentChatStreamCallbacks,
): Promise<string> {
  const mergedSignal = combineSignals([timeoutSignal, callbacks.signal])
  const streamModel = createLangChainModel(model, {
    temperature: 0.25,
    maxTokens: 2200,
    streaming: true,
  })

  const stream = await streamModel.stream(messages as Parameters<typeof streamModel.stream>[0], {
    signal: mergedSignal,
  })
  let emitted = ''

  for await (const chunk of stream) {
    if (mergedSignal.aborted) break
    const delta = extractMessageContent(chunk)
    if (!delta) continue
    const next = emitted + delta
    emitted = emitReplyUpdate(next, emitted, callbacks)
  }

  return emitted
}

function extractMessageContent(value: unknown) {
  if (typeof value === 'string') {
    return value
  }
  const extracted = extractMessageTextParts(value, new Set(), 0).join('')
  if (extracted) return extracted
  const record = asRecord(value)
  if (!record) return ''
  const nested = record.content
  if (typeof nested === 'string') return nested
  if (typeof nested === 'number' || typeof nested === 'boolean') return String(nested)
  if (Array.isArray(nested)) {
    return nested
      .map((item) => {
        const block = asRecord(item)
        if (!block) return ''
        if (typeof block.text === 'string') return block.text
        if (typeof block.content === 'string') return block.content
        return ''
      })
      .join('')
  }
  if (typeof record.text === 'string') return record.text
  return ''
}

function extractMessageTextParts(value: unknown, seen: Set<Record<string, unknown>>, depth: number): string[] {
  if (depth > 8 || value == null) return []
  if (typeof value === 'string') return value ? [value] : []
  if (typeof value === 'number' || typeof value === 'boolean') return [String(value)]
  if (Array.isArray(value)) return value.flatMap((item) => extractMessageTextParts(item, seen, depth + 1))

  const record = asRecord(value)
  if (!record || seen.has(record)) return []
  seen.add(record)

  const directKeys = ['content', 'text', 'output_text', 'completion', 'response', 'delta']
  for (const key of directKeys) {
    const parts = extractMessageTextParts(record[key], seen, depth + 1)
    if (parts.length) return parts
  }

  const nestedKeys = ['message', 'kwargs', 'lc_kwargs', 'additional_kwargs', 'generationInfo', 'generations', 'choices', 'output', 'data', 'result']
  for (const key of nestedKeys) {
    const parts = extractMessageTextParts(record[key], seen, depth + 1)
    if (parts.length) return parts
  }

  return []
}

async function requestOpenAiCompatibleTestCompletion(
  provider: AgentModelProviderConfig,
  model: string,
  signal: AbortSignal,
) {
  const baseUrl = await assertSafeProviderBaseUrl(provider.baseUrl)
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: '你是模型连通性测试器。' },
        { role: 'user', content: '请只回复 OK' },
      ],
      temperature: 0,
      max_tokens: 64,
      stream: false,
    }),
  })
  const rawText = await response.text()
  const parsed = parseUnknownJson(rawText)

  if (!response.ok) {
    const message = readOpenAiCompatibleError(parsed) || rawText.slice(0, 240) || response.statusText
    throw new Error(`HTTP ${response.status}: ${message}`)
  }

  return extractMessageContent(parsed).trim()
}

function parseUnknownJson(value: string): unknown {
  if (!value.trim()) return ''
  try {
    return JSON.parse(value) as unknown
  } catch {
    return value
  }
}

function readOpenAiCompatibleError(value: unknown) {
  const record = asRecord(value)
  const error = asRecord(record?.error)
  if (typeof error?.message === 'string') return error.message
  if (typeof record?.message === 'string') return record.message
  return typeof value === 'string' ? value : ''
}

function combineSignals(signals: Array<AbortSignal | undefined>): AbortSignal {
  const controller = new AbortController()
  const onAbort = () => controller.abort()

  for (const signal of signals) {
    if (!signal) continue
    if (signal.aborted) {
      onAbort()
      break
    }
    signal.addEventListener('abort', onAbort, { once: true })
  }

  return controller.signal
}

async function runWithAbort<T>(label: string, operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), getDeepSeekTimeoutMs())
  try {
    return await operation(controller.signal)
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`${label} timed out after ${Math.round(getDeepSeekTimeoutMs() / 1000)}s`, { cause: error })
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

function getDeepSeekTimeoutMs() {
  const active = getActiveProviderConfig(getRuntimeModelConfig())
  return active?.timeoutMs ?? defaultRuntimeModelConfig.providers[0].timeoutMs
}

function getDeepSeekModel() {
  const active = getActiveProviderConfig(getRuntimeModelConfig())
  return active?.model ?? ''
}

function getDeepSeekVisionModel() {
  const active = getActiveVisionProviderConfig(getRuntimeModelConfig())
  return active?.visionModel || active?.model || ''
}

function readPositiveInteger(value: string | number | undefined, fallback: number) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? Math.round(number) : fallback
}

function normalizeAgentModelString(value: unknown, fallback: string) {
  const text = typeof value === 'string' ? value.trim() : String(value ?? '').trim()
  return text || fallback
}

function normalizeAgentModelBaseUrl(value: unknown, fallback: string = defaultRuntimeModelBaseUrl) {
  const normalized = normalizeAgentModelString(value, fallback).replace(/\/+$/, '')
  return normalized || normalizeAgentModelString(fallback, 'https://api.deepseek.com')
}

function normalizeRuntimeModelConfig(input: unknown): AgentModelConfig {
  const record = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {}
  const activeProvider = normalizeProviderId(record.activeProvider, runtimeModelConfig.activeProvider)
  const activeVisionProvider = normalizeProviderId(record.activeVisionProvider, runtimeModelConfig.activeVisionProvider || activeProvider)
  const providersInput = Array.isArray(record.providers) ? record.providers : []
  const fallbackById = new Map<string, (typeof runtimeModelConfig.providers)[number]>(runtimeModelConfig.providers.map((provider) => [provider.id, provider]))
  const nextProviders = providersInput.length
    ? providersInput.map((provider) => {
      const record = typeof provider === 'object' && provider !== null ? (provider as Record<string, unknown>) : {}
      const providerId = normalizeProviderId(record.id, '')
      const fallback = fallbackById.get(providerId) ?? runtimeModelConfig.providers[0] ?? defaultRuntimeModelConfig.providers[0]!
      return normalizeProviderConfig(provider, [fallback])
    })
    : [...runtimeModelConfig.providers]

  const seen = new Set<string>()
  const providers = nextProviders.filter((provider) => {
    if (!provider.id || seen.has(provider.id)) return false
    seen.add(provider.id)
    return true
  })
  const active = providers.some((provider) => provider.id === activeProvider) ? activeProvider : providers[0]?.id
  const activeVision = providers.some((provider) => provider.id === activeVisionProvider) ? activeVisionProvider : active

  if (!active) return { ...runtimeModelConfig }

  return {
    activeProvider: active,
    activeVisionProvider: activeVision,
    providers,
  }
}

function getActiveProviderConfig(config: AgentModelConfig) {
  if (!config.providers.length) return null
  const fallback = defaultRuntimeModelConfig.providers[0]
  const byId = config.providers.find((provider) => provider.id === config.activeProvider && provider.enabled)
  if (byId) return byId

  const anyEnabled = config.providers.find((provider) => provider.enabled)
  if (anyEnabled) return anyEnabled

  const byIdWithoutEnable = config.providers.find((provider) => provider.id === config.activeProvider)
  if (byIdWithoutEnable) return byIdWithoutEnable

  return config.providers[0] ?? fallback
}

function getActiveVisionProviderConfig(config: AgentModelConfig) {
  if (!config.providers.length) return null
  const visionProviderId = config.activeVisionProvider || config.activeProvider
  const byId = config.providers.find((provider) => provider.id === visionProviderId && provider.enabled)
  if (byId) return byId

  const activeTextProvider = getActiveProviderConfig(config)
  if (activeTextProvider?.enabled) return activeTextProvider

  const byIdWithoutEnable = config.providers.find((provider) => provider.id === visionProviderId)
  if (byIdWithoutEnable) return byIdWithoutEnable
  return activeTextProvider
}

function getActiveVisionAgentClientConfig() {
  if (authMode === 'off') return null
  const active = getActiveVisionProviderConfig(runtimeModelConfig)
  if (!active || !active.enabled || !active.apiKey) return null
  return active
}

function getActiveAgentClientConfig() {
  if (authMode === 'off') return null
  const active = getActiveProviderConfig(runtimeModelConfig)
  if (!active || !active.enabled || !active.apiKey) return null
  return active
}

function normalizeProviderId(value: unknown, fallback: string) {
  return normalizeAgentModelString(value, fallback).trim()
}

function normalizeProviderConfig(
  value: unknown,
  fallback: Array<{
    id: string
    provider: string
    displayName: string
    model: string
    visionModel: string
    baseUrl: string
    timeoutMs: number
    apiKey: string
    enabled: boolean
  }>,
) {
  const record = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
  const fallbackConfig = fallback[0] ?? defaultRuntimeModelConfig.providers[0]
  return {
    id: normalizeProviderId(record.id, fallbackConfig.id),
    provider: normalizeAgentModelString(record.provider, fallbackConfig.provider),
    displayName: normalizeAgentModelString(record.displayName, fallbackConfig.displayName),
    model: normalizeAgentModelString(record.model, fallbackConfig.model),
    visionModel: normalizeAgentModelString(record.visionModel || record.model, fallbackConfig.visionModel),
    baseUrl: normalizeAgentModelBaseUrl(record.baseUrl, fallbackConfig.baseUrl),
    timeoutMs: readPositiveInteger(
      typeof record.timeoutMs === 'number' ? record.timeoutMs : `${record.timeoutMs ?? ''}`,
      fallbackConfig.timeoutMs,
    ),
    apiKey: typeof record.apiKey === 'string' ? record.apiKey.trim() : `${record.apiKey ?? fallbackConfig.apiKey}`.trim(),
    enabled: typeof record.enabled === 'boolean' ? record.enabled : true,
  }
}

function resolveAuthMode() {
  const configured = process.env.AGENT_AUTH_MODE ?? process.env.CODEX_AUTH_MODE
  return configured === 'off' ? 'off' : 'api-key'
}

function createLangChainModel(
  model: string,
  options: {
    temperature: number
    maxTokens: number
    streaming: boolean
  },
) {
  const activeClient = getActiveAgentClientConfig()
  if (!activeClient) throw new Error('agent client not ready')
  return createLangChainModelForProvider(activeClient, model, options)
}

function createLangChainModelForProvider(
  provider: AgentModelProviderConfig,
  model: string,
  options: {
    temperature: number
    maxTokens: number
    streaming: boolean
  },
) {
  const baseURL = assertSafeProviderBaseUrlSync(provider.baseUrl)
  return new ChatOpenAI({
    model,
    apiKey: provider.apiKey,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    streaming: options.streaming,
    configuration: {
      baseURL,
    },
  })
}

async function assertSafeProviderBaseUrl(value: string) {
  const baseUrl = assertSafeProviderBaseUrlSync(value)
  const hostname = new URL(baseUrl).hostname
  const addresses = await lookup(hostname, { all: true, verbatim: true }).catch(() => [])
  for (const address of addresses) {
    if (isPrivateOrLocalAddress(address.address)) {
      throw new Error('模型 Base URL 不能指向内网、localhost 或链路本地地址')
    }
  }
  return baseUrl
}

function assertSafeProviderBaseUrlSync(value: string) {
  const baseUrl = ensureOpenAiBaseUrl(value)
  const url = new URL(baseUrl)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('模型 Base URL 必须是 http(s) 地址')
  }
  const hostname = url.hostname.toLowerCase()
  if (isBlockedHostname(hostname) || isPrivateOrLocalAddress(hostname)) {
    throw new Error('模型 Base URL 不能指向内网、localhost 或链路本地地址')
  }
  return baseUrl
}

function isBlockedHostname(hostname: string) {
  return hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname === 'host.docker.internal'
    || hostname === 'metadata.google.internal'
}

function isPrivateOrLocalAddress(hostname: string) {
  const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase()
  const ipVersion = net.isIP(normalized)
  if (ipVersion === 4) {
    const parts = normalized.split('.').map((part) => Number(part))
    const [a, b] = parts
    return a === 0
      || a === 10
      || a === 127
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || a >= 224
  }
  if (ipVersion === 6) {
    return normalized === '::1'
      || normalized === '::'
      || normalized.startsWith('fc')
      || normalized.startsWith('fd')
      || normalized.startsWith('fe80:')
      || normalized.startsWith('::ffff:127.')
      || normalized.startsWith('::ffff:10.')
      || normalized.startsWith('::ffff:192.168.')
      || normalized.startsWith('::ffff:169.254.')
  }
  return false
}

function ensureOpenAiBaseUrl(value: string) {
  const normalized = value.replace(/\/+$/, '')
  const lower = normalized.toLowerCase()
  if (/\/v\d+(?:beta)?(?:\/openai)?(?:\/)?$/i.test(lower)) return normalized
  return lower.endsWith('/v1') ? normalized : `${normalized}/v1`
}

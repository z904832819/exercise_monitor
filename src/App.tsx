import type { ChangeEvent, CSSProperties, DragEvent, FormEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  Camera,
  CalendarDays,
  CheckCircle2,
  Database,
  ExternalLink,
  Flame,
  GripVertical,
  Home,
  Languages,
  LineChart,
  LogOut,
  MessageCircle,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Plus,
  Salad,
  Save,
  Search,
  Send,
  Settings,
  Shield,
  Star,
  Sun,
  Target,
  Trash2,
  Upload,
  Users,
  Utensils,
  Watch,
  Zap,
} from 'lucide-react'
import './App.css'

type Page = 'overview' | 'profile' | 'motion' | 'health' | 'nutrition' | 'chat' | 'admin' | 'account'
type PermissionPage = Exclude<Page, 'admin' | 'account'>
type PagePermissions = Record<PermissionPage, boolean>
type AdminTab = 'users' | 'permissions' | 'tokens' | 'model-config'
type ThemeMode = 'light' | 'dark'
type AppLanguage = 'zh-CN' | 'en-US' | 'ja-JP' | 'ko-KR' | 'fr-FR' | 'es-ES' | 'de-DE' | 'pt-BR'
type HealthSource = 'Apple 健康' | 'Android 运动' | 'Apple 健康导入'
type AgentMode = 'agent' | 'fallback'
type ModelUsageKind = 'text' | 'vision'
type MealType = 'breakfast' | 'lunch' | 'dinner'
type RegistrationStatus = 'pending' | 'approved' | 'rejected'

type PublicUser = {
  id: string
  username: string
  displayName: string
  role: 'user' | 'admin'
  registrationStatus?: RegistrationStatus
  avatarUrl?: string
  pagePermissions?: PagePermissions
}

type AgentIssue = {
  title: string
  detail: string
  severity: 'warning' | 'danger' | 'ok'
}

type AgentTask = {
  title: string
  detail: string
  priority: 'low' | 'medium' | 'high'
}

type MotionAnalysis = {
  mode: AgentMode
  movementName: string
  confidence: number
  summary: string
  score: number
  issues: AgentIssue[]
  nextActions: AgentTask[]
}

type FoodIngredient = {
  name: string
  amount: string
  calories: number
  protein: number
  carbs: number
  fat: number
}

type FoodAnalysis = {
  mode: AgentMode
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

type HealthAdvice = {
  mode: AgentMode
  summary: string
  recoveryRisk: 'low' | 'medium' | 'high'
  nextActions: AgentTask[]
}

type AgentProviderModelConfig = {
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

type AgentModelConfig = {
  activeProvider: string
  activeVisionProvider: string
  providers: AgentProviderModelConfig[]
}

type AgentModelProviderForm = Omit<AgentProviderModelConfig, 'timeoutMs'> & {
  timeoutMsText: string
}

type AgentModelConfigForm = {
  activeProvider: string
  activeVisionProvider: string
  providers: AgentModelProviderForm[]
}

type AgentModelProviderTestResult = {
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

type AgentRuntimeStatus = {
  enabled: boolean
  visionEnabled: boolean
  authMode: 'api-key' | 'off'
  apiKeyConfigured: boolean
  visionApiKeyConfigured: boolean
  timeoutMs: number
  model: string
  visionModel: string
  baseUrl: string
  visionBaseUrl: string
  provider: string
  visionProvider: string
  providerId: string
  visionProviderId: string
  displayName: string
  visionDisplayName: string
  activeProvider: string
  activeVisionProvider: string
  providersCount: number
}

type AppHealthStatus = {
  ok: boolean
  agent?: AgentRuntimeStatus
  codex?: AgentRuntimeStatus
}

type AgentProviderPreset = AgentProviderModelConfig & {
  group: 'claude' | 'unified'
  hint: string
  featured?: boolean
}

type Workout = {
  name: string
  minutes: number
  calories: number
  intensity: string
  date?: string
  startTime?: string
  endTime?: string
  distance?: number
  distanceUnit?: string
  steps?: number
  device?: string
  source?: string
  importedAt?: string
}

type Meal = {
  id: number
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  ingredients: FoodIngredient[]
  mealType?: MealType
  date?: string
  createdAt?: string
}

type NutritionTarget = {
  mode: 'formula'
  calorieGoal: number
  bmr: number
  tdee: number
  proteinGoal: number
  carbsGoal: number
  fatGoal: number
  summary: string
}

type ProfileInput = {
  heightCm: string
  weightKg: string
  age: string
  sex: 'male' | 'female'
  activityLevel: 'low' | 'medium' | 'high'
  goal: 'fat_loss' | 'maintain' | 'muscle_gain'
}

type UserState = {
  profile: ProfileInput | null
  target: NutritionTarget | null
  source: HealthSource
  workouts: Workout[]
  healthImport: StoredHealthImportState | null
  healthAdvice: HealthAdvice | null
  meals: Meal[]
  motionAnalysis: MotionAnalysis | null
}

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

type ChatThread = {
  id: string
  title: string
  agentId: string
  createdAt: string
  updatedAt: string
  messageCount: number
  lastMessage: string
}

type ChatAgent = {
  id: string
  name: string
  shortName: string
  description: string
  focus: string[]
}

type ExerciseVideoResult = {
  id: string
  title: string
  source: string
  description: string
  url: string
}

type ExerciseVideoSearch = {
  query: string
  exercises: string[]
  results: ExerciseVideoResult[]
}

type HealthImportSummary = {
  source: string
  fileName: string
  requestedDate?: string
  selectedDate: string
  fallbackToLatest: boolean
  range: {
    from: string
    to: string
  }
  days: number
  records: number
  workouts: number
  steps: number
  activeCalories: number
  exerciseMinutes: number
  daily?: Record<string, HealthImportDaySummary>
  selectedDay: {
    date: string
    records: number
    workouts: number
    workoutDetails?: Workout[]
    steps: number
    activeCalories: number
    exerciseMinutes: number
  }
}

type HealthImportDaySummary = {
  date: string
  records: number
  workouts: number
  workoutNames?: string[]
  workoutDetails?: Workout[]
  steps: number
  activeCalories: number
  exerciseMinutes: number
}

type StoredHealthImportState = Omit<HealthImportSummary, 'requestedDate' | 'selectedDate' | 'fallbackToLatest' | 'selectedDay'> & {
  importedAt?: string
  daily?: Record<string, HealthImportDaySummary>
}

type AdminOverview = {
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

type TokenUsageSummary = {
  requests: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

type TokenUsageByFeature = TokenUsageSummary & {
  feature: string
}

type AdminUserSummary = {
  id: string
  username: string
  displayName: string
  role: 'user' | 'admin'
  avatarUrl?: string
  registrationStatus: RegistrationStatus
  reviewedAt?: string
  reviewedBy?: string
  pagePermissions?: PagePermissions
  createdAt: string
  updatedAt: string
  chatThreads: number
  chatMessages: number
  memories: number
  meals: number
  workouts: number
  tokenUsage: TokenUsageSummary
}

type AdminUserDetail = Omit<AdminUserSummary, 'chatThreads' | 'memories'> & {
  state: Partial<UserState>
  chatThreads: ChatThread[]
  memories: Array<{ id: string; category: string; content: string; importance: number; source: string; updatedAt: string }>
  tokenUsageByFeature: TokenUsageByFeature[]
}

type UserBundle = {
  user: PublicUser
  state: Partial<UserState> | null
  chatThreads: ChatThread[]
  activeChatThread: ChatThread
  chatMessages: ChatMessage[]
}

type AuthBundle = UserBundle & {
  token: string
}

type AuthResponse = AuthBundle | {
  status: RegistrationStatus
  message?: string
}

type ChatStreamCallbacks = {
  onUser: (message: ChatMessage) => void
  onAssistantStart: (message: ChatMessage) => void
  onStatus: (status: string) => void
  onDelta: (text: string) => void
  onReplace: (text: string) => void
  onDone: (payload: { thread?: ChatThread; chatThreads: ChatThread[]; chatMessages: ChatMessage[] }) => void
}

type ChatStreamEvent =
  | { type: 'user'; message: ChatMessage }
  | { type: 'assistant_start'; message: ChatMessage }
  | { type: 'status'; status: string }
  | { type: 'delta'; text: string }
  | { type: 'replace'; text: string }
  | { type: 'done'; thread?: ChatThread; chatThreads: ChatThread[]; chatMessages: ChatMessage[] }
  | { type: 'error'; error: string }

const defaultCalorieGoal = 2180
const authTokenKey = 'fitagent.exercise_monitor.auth_token'
const railExpandedKey = 'fitagent.exercise_monitor.rail_expanded'
const themeKey = 'fitagent.exercise_monitor.theme'
const languageKey = 'fitagent.exercise_monitor.language'
const avatarMaxFileSize = 2 * 1024 * 1024
const languageOptions: Array<{ id: AppLanguage; label: string; flag: string }> = [
  { id: 'zh-CN', label: '中文', flag: '🇨🇳' },
  { id: 'en-US', label: 'English', flag: '🇺🇸' },
  { id: 'ja-JP', label: '日本語', flag: '🇯🇵' },
  { id: 'ko-KR', label: '한국어', flag: '🇰🇷' },
  { id: 'fr-FR', label: 'Français', flag: '🇫🇷' },
  { id: 'es-ES', label: 'Español', flag: '🇪🇸' },
  { id: 'de-DE', label: 'Deutsch', flag: '🇩🇪' },
  { id: 'pt-BR', label: 'Português', flag: '🇧🇷' },
]
type UiTranslations = Partial<Record<string, string>>
const uiTranslations: Record<AppLanguage, UiTranslations> = {
  'zh-CN': {
    'AI 智能体': 'AI 智能体',
  },
  'en-US': {
    运动健康工作台: 'Fitness health workspace',
    应用导航: 'App navigation',
    展开导航: 'Expand navigation',
    收起导航: 'Collapse navigation',
    进入账号设置: 'Open account settings',
    账号快捷操作: 'Account shortcuts',
    切换浅色主题: 'Switch to light theme',
    切换深色主题: 'Switch to dark theme',
    切换语言: 'Change language',
    选择语言: 'Select language',
    退出登录: 'Log out',
    管理员: 'Admin',
    普通用户: 'Member',
    总览: 'Overview',
    目标: 'Goals',
    动作: 'Motion',
    健康: 'Health',
    饮食: 'Nutrition',
    对话: 'Chat',
    后台: 'Admin',
    今日总览: 'Today overview',
    动作分析: 'Motion analysis',
    私人教练: 'Private coach',
    系统后台: 'Admin console',
    账号设置: 'Account settings',
    昵称: 'Display name',
    上传头像: 'Upload avatar',
    上传中: 'Uploading',
    移除头像: 'Remove avatar',
    当前密码: 'Current password',
    新密码: 'New password',
    确认新密码: 'Confirm new password',
    保存中: 'Saving',
    保存账号: 'Save account',
    今日指标: 'Today metrics',
    建立目标: 'Set goals',
    还没有今日数据: 'No data for today yet',
    按个人资料生成: 'Generated from your profile',
    今日预算: 'Today budget',
    剩余: 'Remaining',
    蛋白: 'Protein',
    碳水: 'Carbs',
    脂肪: 'Fat',
    可信度: 'Confidence',
    个人目标: 'Personal goals',
    '身高体重生成 kcal 目标': 'Generate kcal targets from your body profile',
    '身高 cm': 'Height cm',
    '体重 kg': 'Weight kg',
    年龄: 'Age',
    性别: 'Sex',
    男: 'Male',
    女: 'Female',
    活动水平: 'Activity level',
    低: 'Low',
    中: 'Medium',
    高: 'High',
    减脂: 'Fat loss',
    维持: 'Maintain',
    增肌: 'Muscle gain',
    生成中: 'Generating',
    生成目标: 'Generate goals',
    动作视频: 'Motion video',
    'AI 姿态评估': 'AI posture review',
    选择运动视频: 'Choose workout video',
    更换视频: 'Replace video',
    分析中: 'Analyzing',
    开始分析: 'Start analysis',
    动作质量: 'Motion quality',
    健康同步: 'Health sync',
    活动与恢复: 'Activity and recovery',
    未导入: 'Not imported',
    隐藏导入: 'Hide import',
    '导入/更新数据': 'Import/update data',
    查询已导入数据: 'Query imported data',
    '全量 Apple 健康数据导入一次即可。选择日期后查询当天步数、活动热量和恢复建议。':
      'Import the full Apple Health export once, then pick a date to review steps, active calories, and recovery advice.',
    查询日期: 'Query date',
    查询中: 'Querying',
    全量数据范围: 'Full data range',
    当前分析日期: 'Current analysis date',
    '所选日期无数据，已用最近一天分析': 'No data for the selected date, using the nearest day',
    天: 'days',
    步: 'steps',
    分钟: 'minutes',
    条: 'items',
    运动明细: 'Workout details',
    食物识别: 'Food recognition',
    热量与成分: 'Calories and ingredients',
    默认: 'default',
    日期: 'Date',
    选择餐次: 'Choose meal',
    早餐: 'Breakfast',
    午餐: 'Lunch',
    晚餐: 'Dinner',
    餐食预览: 'Meal preview',
    '可选：餐食线索，如牛肉米线': 'Optional: meal hint, such as beef rice noodles',
    识别中: 'Recognizing',
    分析食物: 'Analyze food',
    记入: 'Log to ',
    这天还没有饮食记录: 'No meals logged for this day',
    '选择早餐、午餐或晚餐，上传图片后即可记入这一天。': 'Choose breakfast, lunch, or dinner, then upload an image to log it for this day.',
    综合训练助手: 'Training assistant',
    本地规则: 'Local rules',
    'AI 智能体': 'AI Agent',
    用户: 'Users',
    消息: 'Messages',
    记忆: 'Memories',
    饮食记录: 'Meal logs',
    运动记录: 'Workout logs',
    'Token 请求': 'Token requests',
    '估算 Token': 'Estimated tokens',
    估算: 'Estimated',
    后台子页面: 'Admin tabs',
    人: 'people',
    用户管理: 'User management',
    页面权限: 'Page permissions',
    'Token 统计': 'Token stats',
    刷新中: 'Refreshing',
    刷新数据: 'Refresh data',
    私人教练对话: 'Private coach chat',
    清空当前对话: 'Clear current chat',
    历史对话: 'Chat history',
    发送第一条消息后出现在这里: 'Your first message will appear here',
    智能体: 'Agents',
    输入后保存到历史: 'Saved after you type',
    这条对话还没有消息: 'No messages in this chat yet',
    开始提问: 'Ask now',
    '问问今天怎么吃、怎么练': 'Ask what to eat or how to train today',
    发送中: 'Sending',
    发送: 'Send',
  },
  'ja-JP': {
    总览: '概要',
    目标: '目標',
    动作: '動作',
    健康: '健康',
    饮食: '栄養',
    对话: 'チャット',
    后台: '管理',
    今日总览: '今日の概要',
    个人目标: '個人目標',
    动作分析: '動作分析',
    健康同步: '健康同期',
    食物识别: '食事認識',
    私人教练: 'パーソナルコーチ',
    系统后台: '管理コンソール',
    账号设置: 'アカウント設定',
    昵称: '表示名',
    上传头像: 'アバターをアップロード',
    上传中: 'アップロード中',
    移除头像: 'アバターを削除',
    当前密码: '現在のパスワード',
    新密码: '新しいパスワード',
    确认新密码: '新しいパスワードを確認',
    保存中: '保存中',
    保存账号: 'アカウントを保存',
    管理员: '管理者',
    普通用户: 'メンバー',
    选择语言: '言語を選択',
    切换语言: '言語を変更',
    退出登录: 'ログアウト',
  },
  'ko-KR': {
    总览: '개요',
    目标: '목표',
    动作: '동작',
    健康: '건강',
    饮食: '영양',
    对话: '채팅',
    后台: '관리',
    今日总览: '오늘 개요',
    个人目标: '개인 목표',
    动作分析: '동작 분석',
    健康同步: '건강 동기화',
    食物识别: '음식 인식',
    私人教练: '개인 코치',
    系统后台: '관리 콘솔',
    账号设置: '계정 설정',
    昵称: '표시 이름',
    上传头像: '아바타 업로드',
    上传中: '업로드 중',
    移除头像: '아바타 제거',
    当前密码: '현재 비밀번호',
    新密码: '새 비밀번호',
    确认新密码: '새 비밀번호 확인',
    保存中: '저장 중',
    保存账号: '계정 저장',
    管理员: '관리자',
    普通用户: '멤버',
    选择语言: '언어 선택',
    切换语言: '언어 변경',
    退出登录: '로그아웃',
  },
  'fr-FR': {
    总览: 'Vue',
    目标: 'Objectifs',
    动作: 'Mouvement',
    健康: 'Santé',
    饮食: 'Nutrition',
    对话: 'Chat',
    后台: 'Admin',
    今日总览: 'Vue du jour',
    个人目标: 'Objectifs personnels',
    动作分析: 'Analyse du mouvement',
    健康同步: 'Synchronisation santé',
    食物识别: 'Reconnaissance alimentaire',
    私人教练: 'Coach privé',
    系统后台: 'Console admin',
    账号设置: 'Paramètres du compte',
    昵称: 'Nom affiché',
    上传头像: 'Importer un avatar',
    上传中: 'Importation',
    移除头像: "Supprimer l'avatar",
    当前密码: 'Mot de passe actuel',
    新密码: 'Nouveau mot de passe',
    确认新密码: 'Confirmer le mot de passe',
    保存中: 'Enregistrement',
    保存账号: 'Enregistrer',
    管理员: 'Admin',
    普通用户: 'Membre',
    选择语言: 'Choisir la langue',
    切换语言: 'Changer de langue',
    退出登录: 'Déconnexion',
  },
  'es-ES': {
    总览: 'Resumen',
    目标: 'Objetivos',
    动作: 'Movimiento',
    健康: 'Salud',
    饮食: 'Nutrición',
    对话: 'Chat',
    后台: 'Admin',
    今日总览: 'Resumen de hoy',
    个人目标: 'Objetivos personales',
    动作分析: 'Análisis de movimiento',
    健康同步: 'Sincronización de salud',
    食物识别: 'Reconocimiento de comida',
    私人教练: 'Entrenador privado',
    系统后台: 'Consola admin',
    账号设置: 'Configuración de cuenta',
    昵称: 'Nombre visible',
    上传头像: 'Subir avatar',
    上传中: 'Subiendo',
    移除头像: 'Quitar avatar',
    当前密码: 'Contraseña actual',
    新密码: 'Nueva contraseña',
    确认新密码: 'Confirmar contraseña',
    保存中: 'Guardando',
    保存账号: 'Guardar cuenta',
    管理员: 'Admin',
    普通用户: 'Miembro',
    选择语言: 'Elegir idioma',
    切换语言: 'Cambiar idioma',
    退出登录: 'Cerrar sesión',
  },
  'de-DE': {
    总览: 'Überblick',
    目标: 'Ziele',
    动作: 'Bewegung',
    健康: 'Gesundheit',
    饮食: 'Ernährung',
    对话: 'Chat',
    后台: 'Admin',
    今日总览: 'Tagesüberblick',
    个人目标: 'Persönliche Ziele',
    动作分析: 'Bewegungsanalyse',
    健康同步: 'Gesundheitssync',
    食物识别: 'Lebensmittelerkennung',
    私人教练: 'Privater Coach',
    系统后台: 'Admin-Konsole',
    账号设置: 'Kontoeinstellungen',
    昵称: 'Anzeigename',
    上传头像: 'Avatar hochladen',
    上传中: 'Wird hochgeladen',
    移除头像: 'Avatar entfernen',
    当前密码: 'Aktuelles Passwort',
    新密码: 'Neues Passwort',
    确认新密码: 'Passwort bestätigen',
    保存中: 'Wird gespeichert',
    保存账号: 'Konto speichern',
    管理员: 'Admin',
    普通用户: 'Mitglied',
    选择语言: 'Sprache wählen',
    切换语言: 'Sprache ändern',
    退出登录: 'Abmelden',
  },
  'pt-BR': {
    总览: 'Visão geral',
    目标: 'Metas',
    动作: 'Movimento',
    健康: 'Saúde',
    饮食: 'Nutrição',
    对话: 'Chat',
    后台: 'Admin',
    今日总览: 'Resumo de hoje',
    个人目标: 'Metas pessoais',
    动作分析: 'Análise de movimento',
    健康同步: 'Sincronização de saúde',
    食物识别: 'Reconhecimento de comida',
    私人教练: 'Coach privado',
    系统后台: 'Console admin',
    账号设置: 'Configurações da conta',
    昵称: 'Nome de exibição',
    上传头像: 'Enviar avatar',
    上传中: 'Enviando',
    移除头像: 'Remover avatar',
    当前密码: 'Senha atual',
    新密码: 'Nova senha',
    确认新密码: 'Confirmar nova senha',
    保存中: 'Salvando',
    保存账号: 'Salvar conta',
    管理员: 'Admin',
    普通用户: 'Membro',
    选择语言: 'Escolher idioma',
    切换语言: 'Alterar idioma',
    退出登录: 'Sair',
  },
}
const mealTypeOptions: Array<{ id: MealType; label: string }> = [
  { id: 'breakfast', label: '早餐' },
  { id: 'lunch', label: '午餐' },
  { id: 'dinner', label: '晚餐' },
]

function translateUi(language: AppLanguage, key: string) {
  if (language === 'zh-CN') return key
  return uiTranslations[language][key] ?? uiTranslations['en-US'][key] ?? key
}

const emptyProfile: ProfileInput = {
  heightCm: '',
  weightKg: '',
  age: '',
  sex: 'male',
  activityLevel: 'medium',
  goal: 'fat_loss',
}

const defaultAgentModelProviderConfig: AgentProviderModelConfig = {
  id: 'deepseek',
  provider: 'deepseek',
  displayName: 'DeepSeek',
  model: 'deepseek-chat',
  visionModel: 'deepseek-chat',
  baseUrl: 'https://api.deepseek.com',
  timeoutMs: 90_000,
  apiKey: '',
  enabled: true,
}

const defaultAgentModelConfig: AgentModelConfig = {
  activeProvider: defaultAgentModelProviderConfig.id,
  activeVisionProvider: defaultAgentModelProviderConfig.id,
  providers: [defaultAgentModelProviderConfig],
}

const customAgentModelProviderPreset: AgentProviderPreset = {
  id: 'custom-openai',
  provider: 'openai',
  displayName: '自定义配置',
  model: 'gpt-4o-mini',
  visionModel: 'gpt-4o-mini',
  baseUrl: 'https://your-api-endpoint.com/v1',
  timeoutMs: 90_000,
  apiKey: '',
  enabled: true,
  group: 'unified',
  hint: 'OpenAI 兼容接口',
}

const ccswitchProviderPresets: AgentProviderPreset[] = [
  {
    ...customAgentModelProviderPreset,
    featured: true,
  },
  {
    id: 'anthropic',
    provider: 'anthropic',
    displayName: 'Claude Official',
    model: 'claude-3-7-sonnet-20250219',
    visionModel: 'claude-3-7-sonnet-20250219',
    baseUrl: 'https://api.anthropic.com',
    timeoutMs: 90_000,
    apiKey: '',
    enabled: true,
    group: 'claude',
    hint: 'Anthropic 原生',
    featured: true,
  },
  {
    id: 'deepseek',
    provider: 'deepseek',
    displayName: 'DeepSeek',
    model: 'deepseek-chat',
    visionModel: 'deepseek-chat',
    baseUrl: 'https://api.deepseek.com',
    timeoutMs: 90_000,
    apiKey: '',
    enabled: true,
    group: 'unified',
    hint: 'DeepSeek 官方',
  },
  {
    id: 'openai',
    provider: 'openai',
    displayName: 'OpenAI',
    model: 'gpt-4o-mini',
    visionModel: 'gpt-4o-mini',
    baseUrl: 'https://api.openai.com/v1',
    timeoutMs: 90_000,
    apiKey: '',
    enabled: true,
    group: 'unified',
    hint: 'OpenAI 官方',
  },
  {
    id: 'gemini',
    provider: 'openai',
    displayName: 'Gemini',
    model: 'gemini-3.5-flash',
    visionModel: 'gemini-3.5-flash',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    timeoutMs: 90_000,
    apiKey: '',
    enabled: true,
    group: 'unified',
    hint: 'Google AI 兼容',
    featured: true,
  },
  {
    id: 'openrouter',
    provider: 'openrouter',
    displayName: 'OpenRouter',
    model: 'deepseek/deepseek-chat',
    visionModel: 'deepseek/deepseek-chat',
    baseUrl: 'https://openrouter.ai/api/v1',
    timeoutMs: 90_000,
    apiKey: '',
    enabled: true,
    group: 'unified',
    hint: '聚合路由',
    featured: true,
  },
  {
    id: 'siliconflow',
    provider: 'openai',
    displayName: 'SiliconFlow',
    model: 'deepseek-ai/DeepSeek-V3',
    visionModel: 'deepseek-ai/DeepSeek-V3',
    baseUrl: 'https://api.siliconflow.cn/v1',
    timeoutMs: 90_000,
    apiKey: '',
    enabled: true,
    group: 'unified',
    hint: 'OpenAI 兼容',
    featured: true,
  },
  {
    id: 'moonshot',
    provider: 'openai',
    displayName: 'Kimi',
    model: 'moonshot-v1-8k',
    visionModel: 'moonshot-v1-8k',
    baseUrl: 'https://api.moonshot.cn/v1',
    timeoutMs: 90_000,
    apiKey: '',
    enabled: true,
    group: 'unified',
    hint: 'Moonshot 兼容',
  },
  {
    id: 'zhipu',
    provider: 'openai',
    displayName: 'Zhipu GLM',
    model: 'glm-4-flash',
    visionModel: 'glm-4v-flash',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    timeoutMs: 90_000,
    apiKey: '',
    enabled: true,
    group: 'unified',
    hint: '智谱开放平台',
  },
  {
    id: 'bailian',
    provider: 'openai',
    displayName: 'Bailian',
    model: 'qwen-plus',
    visionModel: 'qwen-vl-plus',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    timeoutMs: 90_000,
    apiKey: '',
    enabled: true,
    group: 'unified',
    hint: '阿里百炼',
  },
  {
    id: 'modelscope',
    provider: 'openai',
    displayName: 'ModelScope',
    model: 'Qwen/Qwen2.5-72B-Instruct',
    visionModel: 'Qwen/Qwen2.5-72B-Instruct',
    baseUrl: 'https://api-inference.modelscope.cn/v1',
    timeoutMs: 90_000,
    apiKey: '',
    enabled: true,
    group: 'unified',
    hint: '魔搭兼容',
  },
  {
    id: 'minimax',
    provider: 'openai',
    displayName: 'MiniMax',
    model: 'abab6.5s-chat',
    visionModel: 'abab6.5s-chat',
    baseUrl: 'https://api.minimax.chat/v1',
    timeoutMs: 90_000,
    apiKey: '',
    enabled: true,
    group: 'unified',
    hint: 'OpenAI 兼容',
  },
  {
    id: 'byteplus',
    provider: 'openai',
    displayName: 'BytePlus',
    model: 'doubao-pro-32k',
    visionModel: 'doubao-pro-32k',
    baseUrl: 'https://ark.ap-southeast.bytepluses.com/api/v3',
    timeoutMs: 90_000,
    apiKey: '',
    enabled: true,
    group: 'unified',
    hint: '火山方舟兼容',
    featured: true,
  },
]

const navItems: Array<{ page: Page; label: string; icon: typeof Home }> = [
  { page: 'overview', label: '总览', icon: Home },
  { page: 'profile', label: '目标', icon: Target },
  { page: 'motion', label: '动作', icon: Camera },
  { page: 'health', label: '健康', icon: Watch },
  { page: 'nutrition', label: '饮食', icon: Salad },
  { page: 'chat', label: '对话', icon: MessageCircle },
  { page: 'admin', label: '后台', icon: Shield },
]

const permissionPages: Array<{ page: PermissionPage; label: string; description: string }> = [
  { page: 'overview', label: '总览', description: '查看今日指标、目标和预算' },
  { page: 'profile', label: '目标', description: '编辑身体资料并生成营养目标' },
  { page: 'motion', label: '动作', description: '上传视频做动作分析' },
  { page: 'health', label: '健康', description: '导入和查询 Apple 健康数据' },
  { page: 'nutrition', label: '饮食', description: '识别食物并记录餐食' },
  { page: 'chat', label: '对话', description: '使用健康运动智能体' },
]

const defaultPagePermissions: PagePermissions = {
  overview: true,
  profile: true,
  motion: true,
  health: true,
  nutrition: true,
  chat: true,
}

const adminTabs: Array<{ id: AdminTab; label: string }> = [
  { id: 'users', label: '用户管理' },
  { id: 'permissions', label: '页面权限' },
  { id: 'tokens', label: 'Token 统计' },
  { id: 'model-config', label: '模型配置' },
]

const chatAgents: ChatAgent[] = [
  { id: 'general', name: '综合健康教练', shortName: '综合', description: '饮食、训练、恢复一起统筹', focus: ['记忆', 'RAG', '计划'] },
  { id: 'strength', name: '力量增肌教练', shortName: '增肌', description: '力量训练、肌肥大、动作质量', focus: ['力量', '增肌', '动作'] },
  { id: 'fat_loss', name: '减脂管理教练', shortName: '减脂', description: '热量缺口、蛋白、步数和有氧', focus: ['热量', '蛋白', '有氧'] },
  { id: 'women_shape', name: '女士塑型教练', shortName: '塑型', description: '臀腿、背肩、核心和体态', focus: ['臀腿', '背肩', '核心'] },
  { id: 'running', name: '跑步有氧教练', shortName: '跑步', description: '跑步、心肺、配速和耐力', focus: ['跑步', '心肺', '配速'] },
  { id: 'recovery', name: '康复恢复教练', shortName: '恢复', description: '疼痛风险、疲劳和主动恢复', focus: ['疼痛', '睡眠', '恢复'] },
  { id: 'nutrition', name: '营养饮食教练', shortName: '营养', description: '餐食搭配、宏量营养和外食', focus: ['餐食', '宏量', '外食'] },
  { id: 'habit', name: '习惯监督教练', shortName: '习惯', description: '打卡、执行和长期坚持', focus: ['打卡', '执行', '坚持'] },
]

function toDateInputValue(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 10)
}

function normalizeMealType(value: unknown): MealType {
  return value === 'breakfast' || value === 'lunch' || value === 'dinner' ? value : 'lunch'
}

function normalizeMealDate(value: unknown) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : toDateInputValue()
}

function mealTypeLabel(type: MealType) {
  return mealTypeOptions.find((option) => option.id === type)?.label ?? '餐食'
}

function formatMealDate(date: string) {
  const [, month, day] = date.split('-')
  return month && day ? `${Number(month)}月${Number(day)}日` : date
}

function formatFullDate(date: string) {
  const [year, month, day] = date.split('-')
  return year && month && day ? `${year}年${Number(month)}月${Number(day)}日` : date
}

function sumMealMacros(mealItems: Meal[]) {
  return mealItems.reduce(
    (sum, item) => ({
      calories: sum.calories + item.calories,
      protein: sum.protein + item.protein,
      carbs: sum.carbs + item.carbs,
      fat: sum.fat + item.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

function buildHealthImportSummaryFromState(value: unknown, preferredDate: string): HealthImportSummary | null {
  if (!value || typeof value !== 'object') return null
  const state = value as Partial<StoredHealthImportState>
  const range = state.range
  const daily = normalizeHealthImportDaily(state.daily)
  const dates = Object.keys(daily).sort()
  if (!range || !dates.length) return null

  const selectedDate = daily[preferredDate] ? preferredDate : range.to || dates[dates.length - 1]
  const selectedDay = daily[selectedDate] ?? emptyHealthImportDay(selectedDate)
  return {
    source: state.source ?? 'Apple 健康导入',
    fileName: state.fileName ?? 'Apple 健康导出',
    selectedDate,
    fallbackToLatest: preferredDate !== selectedDate,
    range: {
      from: range.from,
      to: range.to,
    },
    days: toFiniteNumber(state.days, dates.length),
    records: toFiniteNumber(state.records, 0),
    workouts: toFiniteNumber(state.workouts, 0),
    steps: toFiniteNumber(state.steps, 0),
    activeCalories: toFiniteNumber(state.activeCalories, 0),
    exerciseMinutes: toFiniteNumber(state.exerciseMinutes, 0),
    daily,
    selectedDay: {
      date: selectedDate,
      records: toFiniteNumber(selectedDay.records, 0),
      workouts: toFiniteNumber(selectedDay.workouts, 0),
      workoutDetails: readHealthWorkoutDetails(selectedDay.workoutDetails, selectedDate),
      steps: toFiniteNumber(selectedDay.steps, 0),
      activeCalories: toFiniteNumber(selectedDay.activeCalories, 0),
      exerciseMinutes: toFiniteNumber(selectedDay.exerciseMinutes, 0),
    },
  }
}

function normalizeHealthImportDaily(value: unknown): Record<string, HealthImportDaySummary> {
  if (!value || typeof value !== 'object') return {}
  const daily: Record<string, HealthImportDaySummary> = {}

  for (const [date, day] of Object.entries(value as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !day || typeof day !== 'object') continue
    const record = day as Partial<HealthImportDaySummary>
    daily[date] = {
      date,
      records: toFiniteNumber(record.records, 0),
      workouts: toFiniteNumber(record.workouts, 0),
      workoutNames: Array.isArray(record.workoutNames) ? record.workoutNames.filter((item): item is string => typeof item === 'string') : [],
      workoutDetails: readHealthWorkoutDetails(record.workoutDetails, date),
      steps: toFiniteNumber(record.steps, 0),
      activeCalories: toFiniteNumber(record.activeCalories, 0),
      exerciseMinutes: toFiniteNumber(record.exerciseMinutes, 0),
    }
  }

  return daily
}

function emptyHealthImportDay(date: string): HealthImportDaySummary {
  return {
    date,
    records: 0,
    workouts: 0,
    workoutDetails: [],
    steps: 0,
    activeCalories: 0,
    exerciseMinutes: 0,
  }
}

function toFiniteNumber(value: unknown, fallback: number) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function toLooseNumber(value: unknown, fallback: number) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const match = value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)
    if (match) {
      const number = Number(match[0])
      if (Number.isFinite(number)) return number
    }
  }
  return fallback
}

function toFoodNumber(value: unknown) {
  return Math.max(0, Math.round(toLooseNumber(value, 0)))
}

function readDisplayText(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return trimmed || fallback
}

function normalizeFoodAnalysisResponse(analysis: FoodAnalysis | null | undefined): FoodAnalysis {
  const source = analysis ?? ({} as Partial<FoodAnalysis>)
  const ingredients = Array.isArray(source.ingredients)
    ? source.ingredients
        .map((ingredient, index) => normalizeFoodIngredientResponse(ingredient, index))
        .filter((ingredient): ingredient is FoodIngredient => Boolean(ingredient))
    : []
  const confidence = toLooseNumber(source.confidence, 0)

  return {
    mode: source.mode === 'fallback' ? 'fallback' : 'agent',
    name: readDisplayText(source.name, ingredients[0]?.name ?? '待确认餐食'),
    calories: toFoodNumber(source.calories),
    protein: toFoodNumber(source.protein),
    carbs: toFoodNumber(source.carbs),
    fat: toFoodNumber(source.fat),
    ingredients,
    confidence: Math.max(0, Math.min(1, confidence > 1 ? confidence / 100 : confidence)),
    remainingCalories: Math.round(toLooseNumber(source.remainingCalories, 0)),
    advice: readDisplayText(source.advice, '模型返回信息不足，请补充餐食线索后重试。'),
  }
}

function normalizeFoodIngredientResponse(ingredient: unknown, index: number): FoodIngredient | null {
  const source = ingredient && typeof ingredient === 'object' ? (ingredient as Partial<FoodIngredient>) : {}
  const name = readDisplayText(source.name, '')
  const amount = readDisplayText(source.amount, '')
  const calories = toFoodNumber(source.calories)
  const protein = toFoodNumber(source.protein)
  const carbs = toFoodNumber(source.carbs)
  const fat = toFoodNumber(source.fat)
  if (!name && !amount && calories <= 0 && protein <= 0 && carbs <= 0 && fat <= 0) return null

  return {
    name: name || `食材 ${index + 1}`,
    amount: amount || '估算份量',
    calories,
    protein,
    carbs,
    fat,
  }
}

function readHealthWorkoutDetails(value: unknown, fallbackDate: string): Workout[] {
  return Array.isArray(value)
    ? value
        .map((item) => readHealthWorkoutDetail(item, fallbackDate))
        .filter((item): item is Workout => Boolean(item))
    : []
}

function readHealthWorkoutDetail(value: unknown, fallbackDate: string): Workout | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const minutes = Math.round(toFiniteNumber(record.minutes, 0))
  const calories = Math.round(toFiniteNumber(record.calories, 0))
  const distance = toFiniteNumber(record.distance, 0)
  return {
    name: typeof record.name === 'string' && record.name.trim() ? record.name.trim() : '运动记录',
    minutes,
    calories,
    intensity: typeof record.intensity === 'string' && record.intensity.trim() ? record.intensity.trim() : '未记录强度',
    date: typeof record.date === 'string' && record.date.trim() ? record.date.trim() : fallbackDate,
    startTime: typeof record.startTime === 'string' && record.startTime.trim() ? record.startTime.trim() : undefined,
    endTime: typeof record.endTime === 'string' && record.endTime.trim() ? record.endTime.trim() : undefined,
    distance: distance > 0 ? distance : undefined,
    distanceUnit: typeof record.distanceUnit === 'string' && record.distanceUnit.trim() ? record.distanceUnit.trim() : undefined,
    steps: toFiniteNumber(record.steps, 0) > 0 ? Math.round(toFiniteNumber(record.steps, 0)) : undefined,
    device: typeof record.device === 'string' && record.device.trim() ? record.device.trim() : undefined,
    source: typeof record.source === 'string' && record.source.trim() ? record.source.trim() : undefined,
    importedAt: typeof record.importedAt === 'string' && record.importedAt.trim() ? record.importedAt.trim() : undefined,
  }
}

function formatWorkoutClock(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function formatWorkoutTimeRange(workout: Workout) {
  const start = formatWorkoutClock(workout.startTime)
  const end = formatWorkoutClock(workout.endTime)
  if (start && end) return `${start} - ${end}`
  if (start) return start
  return workout.date ? formatFullDate(workout.date) : '未记录时间'
}

function formatWorkoutDistance(workout: Workout) {
  if (!workout.distance || workout.distance <= 0) return ''
  const value = workout.distance >= 10 ? Math.round(workout.distance) : Number(workout.distance.toFixed(2))
  return `${value} ${workout.distanceUnit ?? 'km'}`
}

function waitForVideoEvent(video: HTMLVideoElement, eventName: 'loadedmetadata' | 'loadeddata' | 'seeked', timeoutMs = 5000) {
  return new Promise<void>((resolve, reject) => {
    let timeout = 0

    function cleanup() {
      window.clearTimeout(timeout)
      video.removeEventListener(eventName, handleReady)
      video.removeEventListener('error', handleError)
    }

    function handleReady() {
      cleanup()
      resolve()
    }

    function handleError() {
      cleanup()
      reject(new Error('无法读取视频文件'))
    }

    timeout = window.setTimeout(() => {
      cleanup()
      reject(new Error('读取视频帧超时'))
    }, timeoutMs)

    video.addEventListener(eventName, handleReady, { once: true })
    video.addEventListener('error', handleError, { once: true })
  })
}

async function captureVideoFrames(file: File, maxFrames = 3) {
  const objectUrl = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.preload = 'metadata'
  video.muted = true
  video.playsInline = true
  video.src = objectUrl

  try {
    await waitForVideoEvent(video, 'loadedmetadata')
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0
    const frameRatios = [0.18, 0.5, 0.82].slice(0, maxFrames)
    const frameTimes = duration > 0
      ? frameRatios.map((ratio) => Math.max(0, Math.min(Math.max(0, duration - 0.05), duration * ratio)))
      : [0]
    const sourceWidth = video.videoWidth || 720
    const sourceHeight = video.videoHeight || 405
    const width = Math.min(720, sourceWidth)
    const height = Math.max(1, Math.round(width * (sourceHeight / sourceWidth)))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return []

    const frames: string[] = []
    for (const frameTime of frameTimes) {
      if (Math.abs(video.currentTime - frameTime) > 0.01) {
        video.currentTime = frameTime
        await waitForVideoEvent(video, 'seeked')
      } else if (video.readyState < 2) {
        await waitForVideoEvent(video, 'loadeddata').catch(() => undefined)
      }
      context.drawImage(video, 0, 0, width, height)
      frames.push(canvas.toDataURL('image/jpeg', 0.78))
    }
    return frames
  } catch {
    return []
  } finally {
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(objectUrl)
  }
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(authTokenKey) ?? '')
  const [user, setUser] = useState<PublicUser | null>(null)
  const [page, setPage] = useState<Page>('overview')
  const [isRailExpanded, setIsRailExpanded] = useState(() => localStorage.getItem(railExpandedKey) === 'true')
  const [theme, setTheme] = useState<ThemeMode>(() => (localStorage.getItem(themeKey) === 'dark' ? 'dark' : 'light'))
  const [language, setLanguage] = useState<AppLanguage>(() => {
    const storedLanguage = localStorage.getItem(languageKey)
    return languageOptions.some((item) => item.id === storedLanguage) ? (storedLanguage as AppLanguage) : 'zh-CN'
  })
  const [profile, setProfile] = useState<ProfileInput>(emptyProfile)
  const [target, setTarget] = useState<NutritionTarget | null>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoName, setVideoName] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [motionAnalysis, setMotionAnalysis] = useState<MotionAnalysis | null>(null)
  const [source, setSource] = useState<HealthSource>('Apple 健康')
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [healthAdvice, setHealthAdvice] = useState<HealthAdvice | null>(null)
  const [healthImportFile, setHealthImportFile] = useState<File | null>(null)
  const [selectedHealthDate, setSelectedHealthDate] = useState(() => toDateInputValue())
  const [healthImportSummary, setHealthImportSummary] = useState<HealthImportSummary | null>(null)
  const [isHealthImportOpen, setIsHealthImportOpen] = useState(false)
  const [foodFile, setFoodFile] = useState<File | null>(null)
  const [foodPreview, setFoodPreview] = useState('')
  const [foodName, setFoodName] = useState('')
  const [foodAnalysis, setFoodAnalysis] = useState<FoodAnalysis | null>(null)
  const [meals, setMeals] = useState<Meal[]>([])
  const [selectedMealType, setSelectedMealType] = useState<MealType>('lunch')
  const [selectedNutritionDate, setSelectedNutritionDate] = useState(() => toDateInputValue())
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatThreads, setChatThreads] = useState<ChatThread[]>([])
  const [activeChatThreadId, setActiveChatThreadId] = useState('')
  const [selectedChatAgentId, setSelectedChatAgentId] = useState('general')
  const [chatInput, setChatInput] = useState('')
  const [exerciseVideoSearch, setExerciseVideoSearch] = useState<ExerciseVideoSearch | null>(null)
  const [accountDisplayName, setAccountDisplayName] = useState('')
  const [accountAvatarUrl, setAccountAvatarUrl] = useState('')
  const [accountCurrentPassword, setAccountCurrentPassword] = useState('')
  const [accountNewPassword, setAccountNewPassword] = useState('')
  const [accountConfirmPassword, setAccountConfirmPassword] = useState('')
  const [adminTab, setAdminTab] = useState<AdminTab>('users')
  const [adminOverview, setAdminOverview] = useState<AdminOverview | null>(null)
  const [adminUsers, setAdminUsers] = useState<AdminUserSummary[]>([])
  const [selectedAdminUserId, setSelectedAdminUserId] = useState('')
  const [adminUserDetail, setAdminUserDetail] = useState<AdminUserDetail | null>(null)
  const [adminModelConfig, setAdminModelConfig] = useState<AgentModelConfig>(defaultAgentModelConfig)
  const [adminModelConfigForm, setAdminModelConfigForm] = useState<AgentModelConfigForm>(toAgentModelConfigForm(defaultAgentModelConfig))
  const [adminModelEditorIndex, setAdminModelEditorIndex] = useState<number | null>(null)
  const [adminModelTestResults, setAdminModelTestResults] = useState<Record<string, AgentModelProviderTestResult>>({})
  const [testingAdminModelProviderKey, setTestingAdminModelProviderKey] = useState('')
  const [draggingAdminModelProviderIndex, setDraggingAdminModelProviderIndex] = useState<number | null>(null)
  const [dragOverAdminModelProviderIndex, setDragOverAdminModelProviderIndex] = useState<number | null>(null)
  const [agentRuntimeStatus, setAgentRuntimeStatus] = useState<AgentRuntimeStatus | null>(null)
  const [pendingDeleteUser, setPendingDeleteUser] = useState<AdminUserSummary | AdminUserDetail | null>(null)
  const [isBooting, setIsBooting] = useState(Boolean(token))
  const [isAuthLoading, setIsAuthLoading] = useState(false)
  const [isTargetLoading, setIsTargetLoading] = useState(false)
  const [isMotionLoading, setIsMotionLoading] = useState(false)
  const [isHealthImporting, setIsHealthImporting] = useState(false)
  const [isHealthQuerying, setIsHealthQuerying] = useState(false)
  const [isFoodLoading, setIsFoodLoading] = useState(false)
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [isExerciseVideoLoading, setIsExerciseVideoLoading] = useState(false)
  const [isAvatarUploading, setIsAvatarUploading] = useState(false)
  const [isAccountSaving, setIsAccountSaving] = useState(false)
  const [isAdminLoading, setIsAdminLoading] = useState(false)
  const [error, setError] = useState('')
  const [authError, setAuthError] = useState('')
  const [authNotice, setAuthNotice] = useState('')
  const exerciseVideoRequestRef = useRef(0)
  const exerciseVideoSearchDebounceRef = useRef<number | null>(null)
  const chatStreamAbortRef = useRef<AbortController | null>(null)
  const chatLogRef = useRef<HTMLDivElement | null>(null)

  const todayDate = toDateInputValue()
  const todayHealthImportDay = healthImportSummary?.daily?.[todayDate] ?? null
  const todayWorkouts = useMemo(
    () =>
      todayHealthImportDay?.workoutDetails?.length
        ? todayHealthImportDay.workoutDetails
        : workouts.filter((workout) => workout.date === todayDate),
    [todayHealthImportDay, todayDate, workouts],
  )
  const hasTodayActivity = Boolean(
    todayHealthImportDay &&
      (todayHealthImportDay.steps > 0 || todayHealthImportDay.activeCalories > 0 || todayHealthImportDay.exerciseMinutes > 0 || todayHealthImportDay.workouts > 0),
  ) || todayWorkouts.length > 0
  const activeCalories = Math.round(
    todayHealthImportDay
      ? todayHealthImportDay.activeCalories || todayWorkouts.reduce((sum, item) => sum + item.calories, 0)
      : todayWorkouts.reduce((sum, item) => sum + item.calories, 0),
  )
  const todaysMeals = useMemo(() => meals.filter((meal) => normalizeMealDate(meal.date) === todayDate), [meals, todayDate])
  const selectedDateMeals = useMemo(
    () => meals.filter((meal) => normalizeMealDate(meal.date) === selectedNutritionDate),
    [meals, selectedNutritionDate],
  )
  const todayMealTotals = useMemo(() => sumMealMacros(todaysMeals), [todaysMeals])
  const selectedDateMealTotals = useMemo(() => sumMealMacros(selectedDateMeals), [selectedDateMeals])
  const eatenCalories = todayMealTotals.calories
  const protein = todayMealTotals.protein
  const remainingCalories = target ? target.calorieGoal + activeCalories - eatenCalories : null
  const agentMode = motionAnalysis?.mode ?? foodAnalysis?.mode ?? healthAdvice?.mode
  const activeChatThread = chatThreads.find((thread) => thread.id === activeChatThreadId) ?? null
  const visibleChatThreads = chatThreads.filter((thread) => thread.messageCount > 0)
  const selectedChatAgent = chatAgents.find((agent) => agent.id === selectedChatAgentId) ?? chatAgents[0]
  const selectedLanguage = languageOptions.find((item) => item.id === language) ?? languageOptions[0]
  const modelUsageKind = getPageModelUsageKind(page)
  const activeModelProvider = adminModelConfigForm.providers.find((provider) => provider.id === adminModelConfigForm.activeProvider) ?? null
  const activeVisionModelProvider = adminModelConfigForm.providers.find((provider) => provider.id === adminModelConfigForm.activeVisionProvider) ?? activeModelProvider
  const editingAdminModelProviderIndex =
    adminModelEditorIndex !== null && adminModelConfigForm.providers[adminModelEditorIndex] ? adminModelEditorIndex : -1
  const editingAdminModelProvider =
    editingAdminModelProviderIndex >= 0 ? adminModelConfigForm.providers[editingAdminModelProviderIndex] : null
  const editingAdminModelProviderTestKey = editingAdminModelProvider
    ? getAdminProviderTestKey(editingAdminModelProvider, editingAdminModelProviderIndex)
    : ''
  const editingAdminModelProviderTestResult = editingAdminModelProviderTestKey
    ? adminModelTestResults[editingAdminModelProviderTestKey] ?? null
    : null
  const t = (key: string) => translateUi(language, key)
  const userPermissions = user?.pagePermissions ?? defaultPagePermissions
  const visibleNavItems = navItems.filter((item) => {
    if (item.page === 'admin') return user?.role === 'admin'
    if (item.page === 'account') return false
    return userPermissions[item.page as PermissionPage] !== false
  })
  const selectedHealthWorkoutDetails = healthImportSummary?.selectedDay.workoutDetails ?? []

  const overviewMetrics = useMemo(
    () =>
      [
        target ? { title: '目标热量', value: `${target.calorieGoal}`, unit: 'kcal', tone: 'green' as const, icon: Flame } : null,
        hasTodayActivity ? { title: '活动消耗', value: `${activeCalories}`, unit: 'kcal', tone: 'blue' as const, icon: Zap } : null,
        todaysMeals.length ? { title: '蛋白摄入', value: `${protein}`, unit: 'g', tone: 'coral' as const, icon: Utensils } : null,
        motionAnalysis
          ? { title: '动作评分', value: `${motionAnalysis.score}`, unit: '分', tone: 'amber' as const, icon: LineChart }
          : null,
      ].filter(Boolean),
    [activeCalories, hasTodayActivity, motionAnalysis, protein, target, todaysMeals.length],
  )

  useEffect(() => {
    localStorage.setItem(railExpandedKey, isRailExpanded ? 'true' : 'false')
  }, [isRailExpanded])

  useEffect(() => {
    localStorage.setItem(themeKey, theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem(languageKey, language)
    document.documentElement.lang = language
  }, [language])

  useEffect(() => {
    if (!pendingDeleteUser || isAdminLoading) return undefined

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setPendingDeleteUser(null)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isAdminLoading, pendingDeleteUser])

  useEffect(() => {
    if (page !== 'chat') return undefined

    const frame = requestAnimationFrame(() => {
      const chatLog = chatLogRef.current
      if (chatLog) chatLog.scrollTop = chatLog.scrollHeight
    })

    return () => cancelAnimationFrame(frame)
  }, [chatMessages, exerciseVideoSearch, isChatLoading, isExerciseVideoLoading, page])

  function applyUserBundle(bundle: UserBundle) {
    const state = bundle.state ?? {}
    const bundleUser = { ...bundle.user, role: bundle.user.role === 'admin' ? 'admin' : 'user' } as PublicUser
    bundleUser.registrationStatus = bundleUser.registrationStatus ?? 'approved'
    bundleUser.pagePermissions = { ...defaultPagePermissions, ...(bundleUser.pagePermissions ?? {}) }
    setUser(bundleUser)
    setAccountDisplayName(bundleUser.displayName)
    setAccountAvatarUrl(bundleUser.avatarUrl ?? '')
    setAccountCurrentPassword('')
    setAccountNewPassword('')
    setAccountConfirmPassword('')
    setProfile(isProfileInput(state.profile) ? state.profile : emptyProfile)
    setTarget((state.target as NutritionTarget | null) ?? null)
    setSource(isHealthSource(state.source) ? state.source : 'Apple 健康')
    setWorkouts(Array.isArray(state.workouts) ? (state.workouts as Workout[]) : [])
    setHealthAdvice((state.healthAdvice as HealthAdvice | null) ?? null)
    setHealthImportSummary(buildHealthImportSummaryFromState(state.healthImport, selectedHealthDate))
    setMeals(Array.isArray(state.meals) ? (state.meals as Meal[]) : [])
    setMotionAnalysis((state.motionAnalysis as MotionAnalysis | null) ?? null)
    setChatThreads(Array.isArray(bundle.chatThreads) ? bundle.chatThreads : [])
    setActiveChatThreadId(bundle.activeChatThread?.id ?? bundle.chatThreads?.[0]?.id ?? '')
    setSelectedChatAgentId(bundle.activeChatThread?.agentId ?? bundle.chatThreads?.[0]?.agentId ?? 'general')
    const nextChatMessages = Array.isArray(bundle.chatMessages) ? bundle.chatMessages : []
    setChatMessages(nextChatMessages)
    if (bundleUser.role !== 'admin') resetAdminState()
    resetExerciseVideoSearch()
    restoreExerciseVideoSearchFromMessages(nextChatMessages)
  }

  async function refreshAgentRuntimeStatus(authToken = token) {
    if (!authToken) {
      setAgentRuntimeStatus(null)
      return
    }

    try {
      const health = await getJson<AppHealthStatus>('/api/health', authToken)
      setAgentRuntimeStatus(health.agent ?? health.codex ?? null)
    } catch (requestError) {
      console.warn('[agent-runtime] status refresh failed:', requestError)
      setAgentRuntimeStatus(null)
    }
  }

  async function handleAuth(mode: 'login' | 'register', username: string, password: string, displayName: string, confirmPassword = '') {
    setIsAuthLoading(true)
    setAuthError('')
    setAuthNotice('')

    try {
      if (mode === 'register' && password !== confirmPassword) {
        throw new Error('两次输入的密码不一致')
      }
      const authResponse = await postPublicJson<AuthResponse>(mode === 'login' ? '/api/auth/login' : '/api/auth/register', {
        username,
        password,
        confirmPassword,
        displayName,
      })

      if (!('token' in authResponse) || !authResponse.token) {
        if (mode === 'register') {
          const pendingResponse = authResponse as Extract<AuthResponse, { status: RegistrationStatus }>
          setAuthNotice(pendingResponse.message ?? '注册申请已提交，请等待管理员审批后再登录。')
          return
        }
        throw new Error('登录响应缺少 token')
      }

      const bundle = authResponse
      localStorage.setItem(authTokenKey, bundle.token)
      setToken(bundle.token)
      applyUserBundle(bundle)
      void refreshAgentRuntimeStatus(bundle.token)
      setPage('overview')
    } catch (requestError) {
      setAuthError(readableError(requestError))
    } finally {
      setIsAuthLoading(false)
    }
  }

  function logout() {
    chatStreamAbortRef.current?.abort()
    chatStreamAbortRef.current = null
    if (exerciseVideoSearchDebounceRef.current !== null) {
      clearTimeout(exerciseVideoSearchDebounceRef.current)
      exerciseVideoSearchDebounceRef.current = null
    }
    localStorage.removeItem(authTokenKey)
    setToken('')
    setUser(null)
    setProfile(emptyProfile)
    setTarget(null)
    setWorkouts([])
    setHealthAdvice(null)
    setHealthImportFile(null)
    setHealthImportSummary(null)
    setIsHealthImportOpen(false)
    setSelectedHealthDate(toDateInputValue())
    setMeals([])
    setSelectedMealType('lunch')
    setSelectedNutritionDate(toDateInputValue())
    setMotionAnalysis(null)
    setChatMessages([])
    setChatThreads([])
    setActiveChatThreadId('')
    setSelectedChatAgentId('general')
    setAccountDisplayName('')
    setAccountAvatarUrl('')
    setAccountCurrentPassword('')
    setAccountNewPassword('')
    setAccountConfirmPassword('')
    setIsAvatarUploading(false)
    resetAdminState()
    resetExerciseVideoSearch()
  }

  function resetAdminState() {
    setAdminOverview(null)
    setAdminUsers([])
    setSelectedAdminUserId('')
    setAdminUserDetail(null)
    setAdminModelConfig(defaultAgentModelConfig)
    setAdminModelConfigForm(toAgentModelConfigForm(defaultAgentModelConfig))
    setAdminModelEditorIndex(null)
    setAdminModelTestResults({})
    setTestingAdminModelProviderKey('')
    setDraggingAdminModelProviderIndex(null)
    setDragOverAdminModelProviderIndex(null)
    setAgentRuntimeStatus(null)
    setAdminTab('users')
    setIsAdminLoading(false)
  }

  async function loadAdminDashboard(nextSelectedUserId = selectedAdminUserId) {
    if (!token || user?.role !== 'admin') return
    setIsAdminLoading(true)
    setError('')

    try {
      const [overviewData, usersData, modelConfigData] = await Promise.all([
        getJson<{ overview: AdminOverview }>('/api/admin/overview', token),
        getJson<{ users: AdminUserSummary[] }>('/api/admin/users', token),
        getJson<{ config: AgentModelConfig }>('/api/admin/model-config', token),
      ])
      setAdminOverview(overviewData.overview)
      setAdminUsers(usersData.users)
      setAdminModelConfig(modelConfigData.config)
      setAdminModelConfigForm(toAgentModelConfigForm(modelConfigData.config))
      setAdminModelEditorIndex(null)
      setAdminModelTestResults({})
      setTestingAdminModelProviderKey('')
      setDraggingAdminModelProviderIndex(null)
      setDragOverAdminModelProviderIndex(null)
      const nextUserId = nextSelectedUserId || usersData.users[0]?.id || ''
      setSelectedAdminUserId(nextUserId)
      if (nextUserId) {
        const detailData = await getJson<{ user: AdminUserDetail }>(`/api/admin/users/${encodeURIComponent(nextUserId)}`, token)
        setAdminUserDetail(detailData.user)
      } else {
        setAdminUserDetail(null)
      }
    } catch (requestError) {
      setError(readableError(requestError))
    } finally {
      setIsAdminLoading(false)
    }
  }

  async function selectAdminUser(userId: string) {
    if (!token || user?.role !== 'admin') return
    setSelectedAdminUserId(userId)
    setIsAdminLoading(true)
    setError('')

    try {
      const detailData = await getJson<{ user: AdminUserDetail }>(`/api/admin/users/${encodeURIComponent(userId)}`, token)
      setAdminUserDetail(detailData.user)
    } catch (requestError) {
      setError(readableError(requestError))
    } finally {
      setIsAdminLoading(false)
    }
  }

  function resetExerciseVideoSearch() {
    if (exerciseVideoSearchDebounceRef.current !== null) {
      clearTimeout(exerciseVideoSearchDebounceRef.current)
      exerciseVideoSearchDebounceRef.current = null
    }
    exerciseVideoRequestRef.current += 1
    setExerciseVideoSearch(null)
    setIsExerciseVideoLoading(false)
  }

  async function refreshExerciseVideoSearch(text: string) {
    if (!token) return
    const trimmed = text.trim()
    if (!trimmed) {
      resetExerciseVideoSearch()
      return
    }

    if (exerciseVideoSearchDebounceRef.current !== null) clearTimeout(exerciseVideoSearchDebounceRef.current)
    exerciseVideoSearchDebounceRef.current = window.setTimeout(() => {
      const requestId = exerciseVideoRequestRef.current + 1
      exerciseVideoRequestRef.current = requestId
      setIsExerciseVideoLoading(true)

      void (async () => {
        try {
          const data = await postJson<ExerciseVideoSearch>('/api/exercise-videos/search', { text: trimmed }, token)
          if (requestId !== exerciseVideoRequestRef.current) return
          setExerciseVideoSearch(data.results.length ? data : null)
        } catch (requestError) {
          console.warn('[exercise-video] search failed:', requestError)
          if (requestId === exerciseVideoRequestRef.current) setExerciseVideoSearch(null)
        } finally {
          if (requestId === exerciseVideoRequestRef.current) setIsExerciseVideoLoading(false)
        }
      })()
    }, 300)
  }

  function restoreExerciseVideoSearchFromMessages(messages: ChatMessage[]) {
    const text = messages
      .slice(-4)
      .map((message) => message.content)
      .join('\n')
    if (text.trim()) void refreshExerciseVideoSearch(text)
  }

  useEffect(() => {
    if (!token) {
      return
    }

    let active = true
    Promise.all([
      getJson<UserBundle>('/api/auth/me', token),
      getJson<AppHealthStatus>('/api/health', token).catch((requestError) => {
        console.warn('[agent-runtime] status refresh failed:', requestError)
        return null
      }),
    ])
      .then(([bundle, health]) => {
        if (!active) return
        applyUserBundle(bundle)
        setAgentRuntimeStatus(health?.agent ?? health?.codex ?? null)
      })
      .catch(() => {
        if (!active) return
        logout()
      })
      .finally(() => {
        if (active) setIsBooting(false)
      })

    return () => {
      active = false
    }
    // Auth bootstrap should only rerun when the token changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    return () => {
      chatStreamAbortRef.current?.abort()
      chatStreamAbortRef.current = null
      if (exerciseVideoSearchDebounceRef.current !== null) {
        clearTimeout(exerciseVideoSearchDebounceRef.current)
        exerciseVideoSearchDebounceRef.current = null
      }
    }
  }, [])

  function handleVideoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    setVideoFile(file)
    setVideoName(file.name)
    setVideoUrl(URL.createObjectURL(file))
    setMotionAnalysis(null)
    setError('')
  }

  function handleFoodUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    if (foodPreview) URL.revokeObjectURL(foodPreview)
    setFoodFile(file)
    setFoodPreview(URL.createObjectURL(file))
    setFoodName((current) => current || guessFoodName(file.name))
    setFoodAnalysis(null)
    setError('')
  }

  async function handleAccountAvatarUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.currentTarget.value = ''
    if (!file || !token) return
    if (!file.type.startsWith('image/')) {
      setError('请选择图片文件作为头像')
      return
    }
    if (file.size > avatarMaxFileSize) {
      setError('头像图片不能超过 2MB')
      return
    }

    const formData = new FormData()
    formData.append('avatar', file)
    setIsAvatarUploading(true)
    setError('')

    try {
      const data = await postForm<{ avatarUrl: string }>('/api/user/avatar', formData, token)
      setAccountAvatarUrl(data.avatarUrl)
    } catch (requestError) {
      setError(readableError(requestError))
    } finally {
      setIsAvatarUploading(false)
    }
  }

  async function generateTarget() {
    if (!token) return
    setIsTargetLoading(true)
    setError('')

    try {
      const data = await postJson<{ target: NutritionTarget }>(
        '/api/agent/nutrition-target',
        {
          heightCm: profile.heightCm,
          weightKg: profile.weightKg,
          age: profile.age,
          sex: profile.sex,
          activityLevel: profile.activityLevel,
          goal: profile.goal,
        },
        token,
      )
      setTarget(data.target)
      setPage('overview')
    } catch (requestError) {
      setError(readableError(requestError))
    } finally {
      setIsTargetLoading(false)
    }
  }

  async function runMotionAnalysis() {
    if (!videoFile || !target || !token) return
    setIsMotionLoading(true)
    setError('')

    try {
      const formData = new FormData()
      const videoFrames = await captureVideoFrames(videoFile)
      formData.append('video', videoFile)
      formData.append('videoFrames', JSON.stringify(videoFrames))
      formData.append('videoName', videoName)
      formData.append('activeCalories', String(activeCalories))
      formData.append('eatenCalories', String(eatenCalories))
      formData.append('calorieGoal', String(target.calorieGoal))
      const data = await postForm<{ analysis: MotionAnalysis }>('/api/agent/motion', formData, token)
      setMotionAnalysis(data.analysis)
    } catch (requestError) {
      setError(readableError(requestError))
    } finally {
      setIsMotionLoading(false)
    }
  }

  function handleHealthImportUpload(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null
    setHealthImportFile(nextFile)
  }

  async function importHealthExport() {
    if (!healthImportFile || !token) return
    setIsHealthImporting(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('healthExport', healthImportFile)
      formData.append('date', selectedHealthDate)
      formData.append('calorieGoal', String(target?.calorieGoal ?? defaultCalorieGoal))
      formData.append('meals', JSON.stringify(todaysMeals))
      const data = await postForm<{ workouts: Workout[]; advice: HealthAdvice; importSummary: HealthImportSummary }>(
        '/api/user/health-import',
        formData,
        token,
      )
      setSource('Apple 健康导入')
      setWorkouts(data.workouts)
      setHealthAdvice(data.advice)
      setHealthImportSummary(data.importSummary)
      setSelectedHealthDate(data.importSummary.selectedDate)
      setHealthImportFile(null)
      setIsHealthImportOpen(false)
    } catch (requestError) {
      setError(readableError(requestError))
    } finally {
      setIsHealthImporting(false)
    }
  }

  async function queryHealthDate() {
    if (!token) return
    setIsHealthQuerying(true)
    setError('')

    try {
      const data = await postJson<{ workouts: Workout[]; advice: HealthAdvice; importSummary: HealthImportSummary }>(
        '/api/user/health-query',
        {
          date: selectedHealthDate,
          calorieGoal: target?.calorieGoal ?? defaultCalorieGoal,
        },
        token,
      )
      setSource('Apple 健康导入')
      setWorkouts(data.workouts)
      setHealthAdvice(data.advice)
      setHealthImportSummary(data.importSummary)
      setSelectedHealthDate(data.importSummary.selectedDate)
    } catch (requestError) {
      setError(readableError(requestError))
    } finally {
      setIsHealthQuerying(false)
    }
  }

  async function runFoodAnalysis() {
    if (!foodFile || !token) return
    setIsFoodLoading(true)
    setError('')

    try {
      const calorieGoal = target?.calorieGoal ?? defaultCalorieGoal
      const formData = new FormData()
      formData.append('image', foodFile)
      formData.append('foodName', foodName || '未命名餐食')
      formData.append('activeCalories', String(activeCalories))
      formData.append('eatenCalories', String(selectedDateMealTotals.calories))
      formData.append('calorieGoal', String(calorieGoal))
      const data = await postForm<{ analysis: FoodAnalysis }>('/api/agent/food', formData, token)
      setFoodAnalysis(normalizeFoodAnalysisResponse(data.analysis))
    } catch (requestError) {
      setError(readableError(requestError))
    } finally {
      setIsFoodLoading(false)
    }
  }

  async function sendChatMessage(event?: FormEvent) {
    event?.preventDefault()
    if (!chatInput.trim() || !token || isChatLoading) return
    const message = chatInput.trim()
    const now = new Date().toISOString()
    const userDraftId = createLocalChatId('user')
    const assistantMessageId = createLocalChatId('assistant')
    let assistantContent = ''
    let assistantReceivedText = false

    setChatInput('')
    setIsChatLoading(true)
    setError('')
    resetExerciseVideoSearch()
    void refreshExerciseVideoSearch(message)
    chatStreamAbortRef.current?.abort()
    const streamController = new AbortController()
    chatStreamAbortRef.current = streamController
    setChatMessages((current) => [
      ...current,
      { id: userDraftId, role: 'user', content: message, createdAt: now },
      { id: assistantMessageId, role: 'assistant', content: '正在连接健康智能体...', createdAt: now },
    ])

    try {
      await postChatStream(
        message,
        token,
        {
          threadId: activeChatThreadId,
          agentId: activeChatThread?.agentId ?? selectedChatAgentId,
        },
        {
          onUser: (serverMessage) => {
            setChatMessages((current) => current.map((item) => (item.id === userDraftId ? serverMessage : item)))
          },
          onAssistantStart: (serverMessage) => {
            setChatMessages((current) =>
              current.map((item) => (item.id === assistantMessageId ? { ...serverMessage, id: assistantMessageId } : item)),
            )
          },
          onStatus: (status) => {
            if (assistantReceivedText) return
            setChatMessages((current) => current.map((item) => (item.id === assistantMessageId ? { ...item, content: status } : item)))
          },
          onDelta: (text) => {
            if (!text) return
            assistantReceivedText = true
            assistantContent += text
            setChatMessages((current) =>
              current.map((item) => (item.id === assistantMessageId ? { ...item, content: assistantContent } : item)),
            )
          },
          onReplace: (text) => {
            assistantReceivedText = true
            assistantContent = text
            setChatMessages((current) => current.map((item) => (item.id === assistantMessageId ? { ...item, content: text } : item)))
          },
          onDone: (payload) => {
            const latestAssistant = [...payload.chatMessages]
              .reverse()
              .find((item) => item.role === 'assistant')
              ?.content ?? assistantContent
            setChatMessages(payload.chatMessages)
            setChatThreads(payload.chatThreads)
            void refreshExerciseVideoSearch(`${message}\n${latestAssistant}`)
            if (payload.thread) {
              setActiveChatThreadId(payload.thread.id)
              setSelectedChatAgentId(payload.thread.agentId)
            }
          },
        },
        streamController.signal,
      )
    } catch (requestError) {
      if (!streamController.signal.aborted) {
        setError(readableError(requestError))
      }
      setChatInput(message)
      setChatMessages((current) =>
        current.map((item) => (item.id === assistantMessageId ? { ...item, content: '发送失败，请稍后重试。' } : item)),
      )
    } finally {
      if (chatStreamAbortRef.current === streamController) {
        chatStreamAbortRef.current = null
      }
      setIsChatLoading(false)
    }
  }

  async function clearChat() {
    if (!token || !activeChatThreadId) return
    try {
      const data = await deleteJson<{ thread: ChatThread; chatThreads: ChatThread[]; chatMessages: ChatMessage[] }>(
        `/api/agent/chat?threadId=${encodeURIComponent(activeChatThreadId)}`,
        token,
      )
      setChatMessages(data.chatMessages)
      setChatThreads(data.chatThreads)
      setActiveChatThreadId('')
      setSelectedChatAgentId(data.thread.agentId)
      resetExerciseVideoSearch()
    } catch (requestError) {
      setError(readableError(requestError))
    }
  }

  function startDraftChat(agentId = selectedChatAgentId) {
    if (isChatLoading) return
    setError('')
    setActiveChatThreadId('')
    setSelectedChatAgentId(agentId)
    setChatMessages([])
    resetExerciseVideoSearch()
  }

  async function selectChatThread(threadId: string) {
    if (!token || isChatLoading || threadId === activeChatThreadId) return
    setError('')
    resetExerciseVideoSearch()

    try {
      const data = await getJson<{ thread: ChatThread; chatThreads: ChatThread[]; chatMessages: ChatMessage[] }>(
        `/api/agent/chat?threadId=${encodeURIComponent(threadId)}`,
        token,
      )
      setChatThreads(data.chatThreads)
      setActiveChatThreadId(data.thread.id)
      setSelectedChatAgentId(data.thread.agentId)
      setChatMessages(data.chatMessages)
      restoreExerciseVideoSearchFromMessages(data.chatMessages)
    } catch (requestError) {
      setError(readableError(requestError))
    }
  }

  async function deleteChatThread(threadId: string) {
    if (!token || isChatLoading) return
    setError('')

    try {
      const data = await deleteJson<{ deletedThread: ChatThread; chatThreads: ChatThread[] }>(
        `/api/agent/chat/threads/${encodeURIComponent(threadId)}`,
        token,
      )
      setChatThreads(data.chatThreads)
      if (threadId === activeChatThreadId) {
        setActiveChatThreadId('')
        setSelectedChatAgentId(data.deletedThread.agentId)
        setChatMessages([])
        resetExerciseVideoSearch()
      }
    } catch (requestError) {
      setError(readableError(requestError))
    }
  }

  async function saveAnalyzedMeal() {
    if (!foodAnalysis || foodAnalysis.calories <= 0 || !token) return
    setError('')

    try {
      const data = await postJson<{ meals: Meal[] }>(
        '/api/user/meals',
        {
          meal: {
            name: foodAnalysis.name,
            calories: foodAnalysis.calories,
            protein: foodAnalysis.protein,
            carbs: foodAnalysis.carbs,
            fat: foodAnalysis.fat,
            ingredients: foodAnalysis.ingredients,
            mealType: selectedMealType,
            date: selectedNutritionDate,
            createdAt: new Date().toISOString(),
          },
        },
        token,
      )
      setMeals(data.meals)
      setFoodAnalysis(null)
      setFoodFile(null)
      setFoodPreview('')
      setFoodName('')
    } catch (requestError) {
      setError(readableError(requestError))
    }
  }

  async function deleteMeal(mealId: number) {
    if (!token) return
    setError('')

    try {
      const data = await deleteJson<{ meals: Meal[] }>(`/api/user/meals/${mealId}`, token)
      setMeals(data.meals)
      setHealthAdvice(null)
    } catch (requestError) {
      setError(readableError(requestError))
    }
  }

  async function saveAccountSettings(event?: FormEvent) {
    event?.preventDefault()
    if (!token || !user) return
    if (accountNewPassword && accountNewPassword !== accountConfirmPassword) {
      setError('两次输入的新密码不一致')
      return
    }

    setIsAccountSaving(true)
    setError('')

    try {
      const data = await patchJson<{ user: PublicUser }>(
        '/api/user/account',
        {
          displayName: accountDisplayName,
          avatarUrl: accountAvatarUrl,
          currentPassword: accountCurrentPassword,
          newPassword: accountNewPassword,
        },
        token,
      )
      const nextUser = {
        ...data.user,
        role: data.user.role === 'admin' ? 'admin' : 'user',
        pagePermissions: { ...defaultPagePermissions, ...(data.user.pagePermissions ?? {}) },
      } as PublicUser
      setUser(nextUser)
      setAccountDisplayName(nextUser.displayName)
      setAccountAvatarUrl(nextUser.avatarUrl ?? '')
      setAccountCurrentPassword('')
      setAccountNewPassword('')
      setAccountConfirmPassword('')
    } catch (requestError) {
      setError(readableError(requestError))
    } finally {
      setIsAccountSaving(false)
    }
  }

  function updateAdminProviderField(index: number, patch: Partial<AgentModelProviderForm>) {
    setAdminModelConfigForm((current) => ({
      ...current,
      providers: current.providers.map((provider, itemIndex) => (itemIndex === index ? { ...provider, ...patch } : provider)),
    }))
  }

  function addAdminProvider() {
    startAdminProviderCreate(customAgentModelProviderPreset)
  }

  function startAdminProviderCreate(preset: AgentProviderPreset) {
    const nextEditorIndex = adminModelConfigForm.providers.length
    setAdminModelConfigForm((current) => {
      const nextId = buildProviderId(current.providers, preset.id)
      const nextProvider = {
        ...toAgentProviderForm(preset),
        id: nextId,
      }
      return {
        ...current,
        activeProvider: nextId,
        activeVisionProvider: nextId,
        providers: [...current.providers, nextProvider],
      }
    })
    setAdminModelEditorIndex(nextEditorIndex)
  }

  function applyAdminProviderPresetToEditor(preset: AgentProviderPreset) {
    if (adminModelEditorIndex === null) return
    setAdminModelConfigForm((current) => {
      const provider = current.providers[adminModelEditorIndex]
      if (!provider) return current

      const presetForm = toAgentProviderForm(preset)
      const nextId = buildProviderId(
        current.providers.filter((_, index) => index !== adminModelEditorIndex),
        preset.id,
      )
      const nextProviders = current.providers.map((item, index) => {
        if (index !== adminModelEditorIndex) return item
        return {
          ...presetForm,
          id: nextId,
          apiKey: item.apiKey,
          enabled: item.enabled,
        }
      })
      return {
        ...current,
        activeProvider: provider.id === current.activeProvider ? nextId : current.activeProvider,
        activeVisionProvider: provider.id === current.activeVisionProvider ? nextId : current.activeVisionProvider,
        providers: nextProviders,
      }
    })
  }

  function cancelAdminProviderEditor() {
    setAdminModelConfigForm(toAgentModelConfigForm(adminModelConfig))
    setAdminModelEditorIndex(null)
  }

  function removeAdminProvider(index: number) {
    setAdminModelConfigForm((current) => {
      if (current.providers.length <= 1) return current
      const removedProvider = current.providers[index]
      const nextProviders = current.providers.filter((_, itemIndex) => itemIndex !== index)
      let nextActiveProvider = current.activeProvider
      if (!nextProviders.some((provider) => provider.id === nextActiveProvider) || removedProvider?.id === nextActiveProvider) {
        nextActiveProvider = nextProviders[0]?.id ?? ''
      }
      let nextActiveVisionProvider = current.activeVisionProvider
      if (!nextProviders.some((provider) => provider.id === nextActiveVisionProvider) || removedProvider?.id === nextActiveVisionProvider) {
        nextActiveVisionProvider = nextActiveProvider
      }
      return {
        ...current,
        providers: nextProviders,
        activeProvider: nextActiveProvider,
        activeVisionProvider: nextActiveVisionProvider,
      }
    })
    setAdminModelEditorIndex((current) => {
      if (current === null) return null
      if (current === index) return null
      return current > index ? current - 1 : current
    })
  }

  function reorderAdminProviders(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return
    setAdminModelConfigForm((current) => {
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= current.providers.length || toIndex >= current.providers.length) {
        return current
      }

      const providers = [...current.providers]
      const [movedProvider] = providers.splice(fromIndex, 1)
      if (!movedProvider) return current
      providers.splice(toIndex, 0, movedProvider)

      return {
        ...current,
        providers,
      }
    })
    setAdminModelTestResults({})
    setTestingAdminModelProviderKey('')
  }

  function handleAdminProviderDragStart(event: DragEvent<HTMLButtonElement>, index: number) {
    if (adminModelConfigForm.providers.length <= 1) return
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
    setDraggingAdminModelProviderIndex(index)
    setDragOverAdminModelProviderIndex(index)
  }

  function handleAdminProviderDragOver(event: DragEvent<HTMLElement>, index: number) {
    if (draggingAdminModelProviderIndex === null) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDragOverAdminModelProviderIndex(index)
  }

  function handleAdminProviderDrop(event: DragEvent<HTMLElement>, index: number) {
    event.preventDefault()
    const transferIndex = Number.parseInt(event.dataTransfer.getData('text/plain'), 10)
    const fromIndex = draggingAdminModelProviderIndex ?? transferIndex
    if (Number.isInteger(fromIndex)) {
      reorderAdminProviders(fromIndex, index)
    }
    setDraggingAdminModelProviderIndex(null)
    setDragOverAdminModelProviderIndex(null)
  }

  function handleAdminProviderDragEnd() {
    setDraggingAdminModelProviderIndex(null)
    setDragOverAdminModelProviderIndex(null)
  }

  async function saveAgentModelConfig(event?: FormEvent) {
    event?.preventDefault()
    if (!token || user?.role !== 'admin') return

    const nextConfigResult = parseAgentModelConfigForm(adminModelConfigForm)
    if (!nextConfigResult.ok) {
      setError(nextConfigResult.error)
      return
    }

    setIsAdminLoading(true)
    setError('')

    try {
      const nextConfig = await patchJson<{ config: AgentModelConfig }>(
        '/api/admin/model-config',
        nextConfigResult.value,
        token,
      )
      setAdminModelConfig(nextConfig.config)
      setAdminModelConfigForm(toAgentModelConfigForm(nextConfig.config))
      setAdminModelEditorIndex(null)
      void refreshAgentRuntimeStatus()
    } catch (requestError) {
      setError(readableError(requestError))
    } finally {
      setIsAdminLoading(false)
    }
  }

  async function testAdminModelProvider(index: number) {
    if (!token || user?.role !== 'admin') return
    const provider = adminModelConfigForm.providers[index]
    if (!provider) return

    const resultKey = getAdminProviderTestKey(provider, index)
    const parsedProviderResult = parseAgentModelConfigForm({
      activeProvider: provider.id,
      activeVisionProvider: provider.id,
      providers: [provider],
    })
    if (!parsedProviderResult.ok) {
      setAdminModelTestResults((current) => ({
        ...current,
        [resultKey]: {
          ok: false,
          providerId: provider.id,
          provider: provider.provider,
          displayName: provider.displayName || provider.id,
          model: provider.model,
          baseUrl: provider.baseUrl,
          latencyMs: 0,
          message: parsedProviderResult.error,
        },
      }))
      return
    }

    setTestingAdminModelProviderKey(resultKey)
    setAdminModelTestResults((current) => {
      const next = { ...current }
      delete next[resultKey]
      return next
    })

    try {
      const data = await postJson<{ result: AgentModelProviderTestResult }>(
        '/api/admin/model-config/test',
        { provider: parsedProviderResult.value.providers[0] },
        token,
      )
      setAdminModelTestResults((current) => ({ ...current, [resultKey]: data.result }))
    } catch (requestError) {
      setAdminModelTestResults((current) => ({
        ...current,
        [resultKey]: {
          ok: false,
          providerId: provider.id,
          provider: provider.provider,
          displayName: provider.displayName || provider.id,
          model: provider.model,
          baseUrl: provider.baseUrl,
          latencyMs: 0,
          message: readableError(requestError),
        },
      }))
    } finally {
      setTestingAdminModelProviderKey((current) => (current === resultKey ? '' : current))
    }
  }

  async function toggleAdminPermission(targetUserId: string, pageKey: PermissionPage, enabled: boolean) {
    if (!token || user?.role !== 'admin' || !adminUserDetail) return
    setIsAdminLoading(true)
    setError('')

    try {
      const permissions = { ...defaultPagePermissions, ...(adminUserDetail.pagePermissions ?? {}), [pageKey]: enabled }
      const data = await patchJson<{ user: AdminUserDetail }>(
        `/api/admin/users/${encodeURIComponent(targetUserId)}/permissions`,
        { permissions },
        token,
      )
      setAdminUserDetail(data.user)
      setAdminUsers((current) => current.map((item) => (item.id === data.user.id ? toAdminSummaryFromDetail(data.user) : item)))
    } catch (requestError) {
      setError(readableError(requestError))
    } finally {
      setIsAdminLoading(false)
    }
  }

  async function updateAdminUserApproval(targetUserId: string, status: RegistrationStatus) {
    if (!token || user?.role !== 'admin') return
    setIsAdminLoading(true)
    setError('')

    try {
      const data = await patchJson<{ user: AdminUserDetail }>(
        `/api/admin/users/${encodeURIComponent(targetUserId)}/approval`,
        { status },
        token,
      )
      setAdminUserDetail(data.user)
      setAdminUsers((current) => current.map((item) => (item.id === data.user.id ? toAdminSummaryFromDetail(data.user) : item)))
      const overviewData = await getJson<{ overview: AdminOverview }>('/api/admin/overview', token)
      setAdminOverview(overviewData.overview)
    } catch (requestError) {
      setError(readableError(requestError))
    } finally {
      setIsAdminLoading(false)
    }
  }

  function requestDeleteAdminUser(targetUser: AdminUserSummary | AdminUserDetail) {
    if (targetUser.id === user?.id || isAdminLoading) return
    setPendingDeleteUser(targetUser)
  }

  async function deleteAdminUser() {
    if (!token || user?.role !== 'admin' || !pendingDeleteUser) return
    const targetUserId = pendingDeleteUser.id
    setIsAdminLoading(true)
    setError('')

    try {
      const data = await deleteJson<{ overview: AdminOverview; users: AdminUserSummary[] }>(
        `/api/admin/users/${encodeURIComponent(targetUserId)}`,
        token,
      )
      setAdminOverview(data.overview)
      setAdminUsers(data.users)
      const nextUserId = data.users.find((item) => item.id !== targetUserId)?.id ?? ''
      setSelectedAdminUserId(nextUserId)
      if (nextUserId) {
        const detailData = await getJson<{ user: AdminUserDetail }>(`/api/admin/users/${encodeURIComponent(nextUserId)}`, token)
        setAdminUserDetail(detailData.user)
      } else {
        setAdminUserDetail(null)
      }
      setPendingDeleteUser(null)
    } catch (requestError) {
      setError(readableError(requestError))
    } finally {
      setIsAdminLoading(false)
    }
  }

  if (isBooting) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <Activity size={26} aria-hidden="true" />
          <h1>FitAgent</h1>
          <p>正在恢复登录</p>
        </section>
      </main>
    )
  }

  if (!user) {
    return (
      <AuthScreen
        error={authError}
        notice={authNotice}
        isLoading={isAuthLoading}
        onModeChange={() => {
          setAuthError('')
          setAuthNotice('')
        }}
        onSubmit={handleAuth}
      />
    )
  }

  return (
    <main className={`app-shell page-shell-${page} ${isRailExpanded ? 'rail-expanded' : ''} theme-${theme}`}>
      <aside className={`rail ${isRailExpanded ? 'expanded' : 'collapsed'}`} aria-label={t('应用导航')}>
        <div className="rail-header">
          <div className="rail-brand">
            <div className="brand-mark">
              <Activity size={22} aria-hidden="true" />
            </div>
            <div className="rail-title" aria-hidden={!isRailExpanded}>
              <strong>FitAgent</strong>
              <span>{t('运动健康工作台')}</span>
            </div>
          </div>
          <button
            className="rail-toggle"
            type="button"
            onClick={() => setIsRailExpanded((current) => !current)}
            aria-expanded={isRailExpanded}
            aria-label={isRailExpanded ? t('收起导航') : t('展开导航')}
            title={isRailExpanded ? t('收起导航') : t('展开导航')}
          >
            {isRailExpanded ? <PanelLeftClose size={18} aria-hidden="true" /> : <PanelLeftOpen size={18} aria-hidden="true" />}
          </button>
        </div>
        <nav>
          {visibleNavItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                className={page === item.page ? 'active' : ''}
                key={item.page}
                type="button"
                onClick={() => {
                  setPage(item.page)
                  if (item.page === 'admin') void loadAdminDashboard()
                }}
                aria-label={t(item.label)}
                title={t(item.label)}
              >
                <Icon size={20} aria-hidden="true" />
                <span className="rail-label">{t(item.label)}</span>
              </button>
            )
          })}
        </nav>
        <button
          className={`rail-footer ${page === 'account' ? 'active' : ''}`}
          type="button"
          onClick={() => setPage('account')}
          aria-label={t('进入账号设置')}
          title={t('账号设置')}
        >
          <UserAvatar user={user} />
          <span className="rail-user-copy">
            <span>{user.displayName}</span>
            <strong>{user.role === 'admin' ? t('管理员') : t('普通用户')}</strong>
          </span>
        </button>
      </aside>

      <section className={`workspace page-${page}`}>
        <header className="topbar">
          <div>
            <p className="eyebrow">FitAgent · {user.displayName}</p>
            <h1>{t(pageTitle(page))}</h1>
          </div>
          <div className="topbar-actions">
            {agentMode ? <span className="status-pill chrome-status">{t(modeLabel(agentMode))}</span> : null}
            {modelUsageKind ? (
              <span
                className={`model-usage-pill ${isRuntimeModelReady(agentRuntimeStatus, modelUsageKind) ? '' : 'inactive'}`}
                title={formatRuntimeModelTitle(agentRuntimeStatus, modelUsageKind)}
              >
                <Zap size={14} aria-hidden="true" />
                <b>{modelUsageKind === 'vision' ? '视觉模型' : '普通模型'}</b>
                <span>{formatRuntimeModelLabel(agentRuntimeStatus, modelUsageKind)}</span>
              </span>
            ) : null}
            <div className="user-chrome" aria-label={t('账号快捷操作')}>
              <button
                className="theme-toggle-button"
                type="button"
                onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
                aria-label={theme === 'dark' ? t('切换浅色主题') : t('切换深色主题')}
                title={theme === 'dark' ? t('切换浅色主题') : t('切换深色主题')}
              >
                {theme === 'dark' ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
              </button>
              <label className="language-chip" aria-label={t('切换语言')}>
                <Languages size={16} aria-hidden="true" />
                <span aria-hidden="true">{selectedLanguage.flag}</span>
                <select value={language} onChange={(event) => setLanguage(event.target.value as AppLanguage)} aria-label={t('选择语言')}>
                  {languageOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button className="icon-button logout-button" type="button" onClick={logout} aria-label={t('退出登录')}>
              <LogOut size={18} aria-hidden="true" />
            </button>
          </div>
        </header>

        {error ? <p className="error-banner">{error}</p> : null}

        {page === 'account' ? (
          <section className="surface account-panel" aria-labelledby="account-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Account</p>
                <h2 id="account-title">{t('账号设置')}</h2>
              </div>
              <span className="status-pill">{user.role === 'admin' ? t('管理员') : t('普通用户')}</span>
            </div>

            <form className="account-layout" onSubmit={(event) => void saveAccountSettings(event)}>
              <div className="account-avatar-card">
                <UserAvatar user={{ ...user, avatarUrl: accountAvatarUrl, displayName: accountDisplayName || user.displayName }} size="large" />
                <div>
                  <strong>{accountDisplayName || user.displayName}</strong>
                  <span>@{user.username}</span>
                </div>
                <div className="account-avatar-actions">
                  <label className={`secondary-button account-avatar-upload ${isAvatarUploading ? 'is-disabled' : ''}`}>
                    <Upload size={17} aria-hidden="true" />
                    {isAvatarUploading ? t('上传中') : t('上传头像')}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={(event) => void handleAccountAvatarUpload(event)}
                      disabled={isAvatarUploading}
                    />
                  </label>
                  {accountAvatarUrl ? (
                    <button className="secondary-button" type="button" onClick={() => setAccountAvatarUrl('')}>
                      <Trash2 size={17} aria-hidden="true" />
                      {t('移除头像')}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="account-form">
                <label>
                  <span>{t('昵称')}</span>
                  <input value={accountDisplayName} onChange={(event) => setAccountDisplayName(event.target.value)} />
                </label>
                <label>
                  <span>{t('当前密码')}</span>
                  <input type="password" value={accountCurrentPassword} onChange={(event) => setAccountCurrentPassword(event.target.value)} />
                </label>
                <label>
                  <span>{t('新密码')}</span>
                  <input type="password" value={accountNewPassword} onChange={(event) => setAccountNewPassword(event.target.value)} />
                </label>
                <label>
                  <span>{t('确认新密码')}</span>
                  <input type="password" value={accountConfirmPassword} onChange={(event) => setAccountConfirmPassword(event.target.value)} />
                </label>
                <button className="primary-button" type="submit" disabled={isAccountSaving || isAvatarUploading || !accountDisplayName.trim()}>
                  <Save size={18} aria-hidden="true" />
                  {isAccountSaving ? t('保存中') : t('保存账号')}
                </button>
              </div>
            </form>
          </section>
        ) : null}

        {page === 'overview' ? (
          <section className="page-stack">
            {overviewMetrics.length ? (
              <section className="metrics-strip" aria-label={t('今日指标')}>
                {overviewMetrics.map((metric) =>
                  metric ? (
                    <Metric
                      icon={metric.icon}
                      key={metric.title}
                      title={t(metric.title)}
                      tone={metric.tone}
                      unit={metric.unit}
                      value={metric.value}
                    />
                  ) : null,
                )}
              </section>
            ) : (
              <EmptyState action={t('建立目标')} icon={Target} onAction={() => setPage('profile')} title={t('还没有今日数据')} />
            )}

            {target ? (
              <section className="surface profile-summary">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">{t('目标')}</p>
                    <h2>{t('按个人资料生成')}</h2>
                  </div>
                  <strong>{target.calorieGoal} kcal</strong>
                </div>
                <div className="macro-grid">
                  <Macro label={t('蛋白')} value={target.proteinGoal} unit="g" />
                  <Macro label={t('碳水')} value={target.carbsGoal} unit="g" />
                  <Macro label={t('脂肪')} value={target.fatGoal} unit="g" />
                  <Macro label="TDEE" value={target.tdee} unit="kcal" />
                </div>
              </section>
            ) : null}

            {remainingCalories !== null && (todaysMeals.length || hasTodayActivity) ? (
              <section className="surface profile-summary">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">{t('今日预算')}</p>
                    <h2>{t('剩余')} {remainingCalories} kcal</h2>
                  </div>
                </div>
                <div className="calorie-balance">
                  <span style={{ width: `${Math.min(100, (eatenCalories / (target!.calorieGoal + activeCalories)) * 100)}%` }} />
                </div>
              </section>
            ) : null}
          </section>
        ) : null}

        {page === 'profile' ? (
          <section className="surface profile-page">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{t('个人目标')}</p>
                <h2>{t('身高体重生成 kcal 目标')}</h2>
              </div>
            </div>
            <div className="profile-form">
              <Field label={t('身高 cm')} value={profile.heightCm} onChange={(heightCm) => setProfile({ ...profile, heightCm })} />
              <Field label={t('体重 kg')} value={profile.weightKg} onChange={(weightKg) => setProfile({ ...profile, weightKg })} />
              <Field label={t('年龄')} value={profile.age} onChange={(age) => setProfile({ ...profile, age })} />
              <label>
                <span>{t('性别')}</span>
                <select value={profile.sex} onChange={(event) => setProfile({ ...profile, sex: event.target.value as ProfileInput['sex'] })}>
                  <option value="male">{t('男')}</option>
                  <option value="female">{t('女')}</option>
                </select>
              </label>
              <label>
                <span>{t('活动水平')}</span>
                <select
                  value={profile.activityLevel}
                  onChange={(event) => setProfile({ ...profile, activityLevel: event.target.value as ProfileInput['activityLevel'] })}
                >
                  <option value="low">{t('低')}</option>
                  <option value="medium">{t('中')}</option>
                  <option value="high">{t('高')}</option>
                </select>
              </label>
              <label>
                <span>{t('目标')}</span>
                <select value={profile.goal} onChange={(event) => setProfile({ ...profile, goal: event.target.value as ProfileInput['goal'] })}>
                  <option value="fat_loss">{t('减脂')}</option>
                  <option value="maintain">{t('维持')}</option>
                  <option value="muscle_gain">{t('增肌')}</option>
                </select>
              </label>
            </div>
            <button className="primary-button wide-button" type="button" onClick={() => void generateTarget()} disabled={!isProfileReady(profile) || isTargetLoading}>
              <Save size={18} aria-hidden="true" />
              {isTargetLoading ? t('生成中') : t('生成目标')}
            </button>
            {target ? <p className="agent-note">{target.summary}</p> : null}
          </section>
        ) : null}

        {page === 'motion' ? (
          <section className="surface motion-panel" id="motion" aria-labelledby="motion-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{t('动作视频')}</p>
                <h2 id="motion-title">{t('AI 姿态评估')}</h2>
              </div>
              <span className="status-pill">{t('上传后自动识别动作')}</span>
            </div>

            <div className="video-frame">
              {videoUrl ? (
                <video src={videoUrl} controls />
              ) : (
                <label className="upload-target">
                  <Upload size={32} aria-hidden="true" />
                  <span>{t('选择运动视频')}</span>
                  <input type="file" accept="video/*" onChange={handleVideoUpload} />
                </label>
              )}
            </div>

            <div className="motion-actions">
              <label className="secondary-button">
                <Upload size={18} aria-hidden="true" />
                {t('更换视频')}
                <input type="file" accept="video/*" onChange={handleVideoUpload} />
              </label>
              <button className="primary-button" type="button" onClick={() => void runMotionAnalysis()} disabled={!videoFile || !target || isMotionLoading}>
                <Play size={18} aria-hidden="true" />
                {isMotionLoading ? t('分析中') : t('开始分析')}
              </button>
            </div>

            {motionAnalysis ? (
              <div className="analysis-grid">
                <div className="score-dial" style={{ '--score': `${motionAnalysis.score}%` } as CSSProperties}>
                  <span>{motionAnalysis.score}</span>
                  <small>{t('动作质量')}</small>
                </div>
                <div className="issue-list">
                  <article className="issue ok">
                    <CheckCircle2 size={17} aria-hidden="true" />
                    <div>
                      <h3>
                        {motionAnalysis.movementName || t('自动识别动作')}
                        <span className="muted-inline"> · {t(modeLabel(motionAnalysis.mode))}</span>
                        {motionAnalysis.confidence > 0 ? (
                          <span className="muted-inline"> · {Math.round(motionAnalysis.confidence * 100)}%</span>
                        ) : null}
                      </h3>
                      <p>{motionAnalysis.summary}</p>
                    </div>
                  </article>
                  {motionAnalysis.issues.map((issue) => (
                    <article className={`issue ${issue.severity}`} key={issue.title}>
                      <CheckCircle2 size={17} aria-hidden="true" />
                      <div>
                        <h3>{issue.title}</h3>
                        <p>{issue.detail}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {page === 'health' ? (
          <section className="surface health-panel" id="health" aria-labelledby="health-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{t('健康同步')}</p>
                <h2 id="health-title">{t('活动与恢复')}</h2>
              </div>
              <div className="health-header-actions">
                <span className="status-pill">{healthImportSummary ? source : t('未导入')}</span>
                <button className="secondary-button" type="button" onClick={() => setIsHealthImportOpen((current) => !current)}>
                  <Upload size={18} aria-hidden="true" />
                  {isHealthImportOpen ? t('隐藏导入') : t('导入/更新数据')}
                </button>
              </div>
            </div>

            <div className="health-query-panel">
              <div className="health-import-copy">
                <CalendarDays size={20} aria-hidden="true" />
                <div>
                  <h3>{t('查询已导入数据')}</h3>
                  <p>{t('全量 Apple 健康数据导入一次即可。选择日期后查询当天步数、活动热量和恢复建议。')}</p>
                </div>
              </div>
              <div className="health-query-controls">
                <label className="date-field">
                  <span>
                    <CalendarDays size={16} aria-hidden="true" />
                    {t('查询日期')}
                  </span>
                  <div className="date-control">
                    <input
                      aria-label={t('查询日期')}
                      className="native-date-input"
                      type="date"
                      value={selectedHealthDate}
                      onChange={(event) => {
                        if (event.currentTarget.value) setSelectedHealthDate(event.currentTarget.value)
                      }}
                      onInput={(event) => {
                        if (event.currentTarget.value) setSelectedHealthDate(event.currentTarget.value)
                      }}
                    />
                    <div className="date-control-value" aria-hidden="true">
                      {formatFullDate(selectedHealthDate)}
                    </div>
                  </div>
                </label>
                <button className="primary-button" type="button" onClick={() => void queryHealthDate()} disabled={!healthImportSummary || isHealthQuerying}>
                  {isHealthQuerying ? t('查询中') : t('查询日期')}
                </button>
              </div>
              {healthImportSummary ? (
                <div className="health-import-summary">
                  <div>
                    <span>{t('全量数据范围')}</span>
                    <strong>
                      {formatFullDate(healthImportSummary.range.from)} - {formatFullDate(healthImportSummary.range.to)}
                    </strong>
                    <small>
                      {healthImportSummary.days} {t('天')} · {healthImportSummary.steps} {t('步')} · {healthImportSummary.activeCalories} kcal ·{' '}
                      {healthImportSummary.exerciseMinutes} {t('分钟')}
                    </small>
                  </div>
                  <div>
                    <span>{healthImportSummary.fallbackToLatest ? t('所选日期无数据，已用最近一天分析') : t('当前分析日期')}</span>
                    <strong>{formatMealDate(healthImportSummary.selectedDate)}</strong>
                    <small>
                      {healthImportSummary.selectedDay.steps} {t('步')} · {healthImportSummary.selectedDay.activeCalories} kcal ·{' '}
                      {healthImportSummary.selectedDay.exerciseMinutes} {t('分钟')}
                    </small>
                  </div>
                </div>
              ) : (
                <div className="health-empty-state">
                  <strong>还没有导入 Apple 健康数据</strong>
                  <span>点击右上角“导入/更新数据”，上传全量 zip 或导出.xml 后即可按日期查询。</span>
                </div>
              )}
            </div>

            {isHealthImportOpen ? (
              <div className="health-import-panel">
                <div className="health-import-copy">
                  <Upload size={20} aria-hidden="true" />
                  <div>
                    <h3>导入 Apple 健康全量文件</h3>
                    <p>支持 iPhone 导出的 zip 或解压后的 export.xml / 导出.xml。导入后会保存每日汇总，之后可以直接按日期查询。</p>
                  </div>
                </div>
                <div className="health-import-controls">
                  <label className="health-file-picker">
                    <Upload size={17} aria-hidden="true" />
                    <span>{healthImportFile?.name ?? '选择 zip / 导出.xml'}</span>
                    <input type="file" accept=".zip,.xml,text/xml,application/zip" onChange={handleHealthImportUpload} />
                  </label>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => void importHealthExport()}
                    disabled={!healthImportFile || isHealthImporting}
                  >
                    {isHealthImporting ? '导入中' : '导入全量数据'}
                  </button>
                </div>
              </div>
              ) : null}

            {healthAdvice ? <p className="agent-note">{healthAdvice.summary}</p> : null}

            {healthImportSummary ? (
              <div className="health-workout-detail-panel">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">{t('运动明细')}</p>
                    <h3>{formatMealDate(healthImportSummary.selectedDate)} Apple Health {t('运动记录')}</h3>
                  </div>
                  <span className="status-pill">{healthImportSummary.selectedDay.workouts} {t('条')}</span>
                </div>

                {selectedHealthWorkoutDetails.length ? (
                  <div className="health-workout-list">
                    {selectedHealthWorkoutDetails.map((workout, index) => {
                      const distance = formatWorkoutDistance(workout)
                      return (
                        <article
                          className="health-workout-card"
                          key={`${workout.name}-${workout.startTime ?? workout.date ?? index}-${index}`}
                        >
                          <div className="health-workout-main">
                            <Activity size={18} aria-hidden="true" />
                            <div>
                              <strong>{workout.name}</strong>
                              <p>
                                {formatWorkoutTimeRange(workout)}
                                {workout.device ? ` · ${workout.device}` : workout.source ? ` · ${workout.source}` : ''}
                              </p>
                            </div>
                          </div>
                          <div className="health-workout-metrics">
                            <span>{Math.round(workout.minutes)} {t('分钟')}</span>
                            <span>{Math.round(workout.calories)} kcal</span>
                            {distance ? <span>{distance}</span> : null}
                            <span>{workout.intensity}</span>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                ) : (
                  <div className="health-empty-state">
                    <strong>{healthImportSummary.selectedDay.workouts > 0 ? '这批已导入数据没有保存运动明细' : '当天没有具体运动记录'}</strong>
                    <span>
                      {healthImportSummary.selectedDay.workouts > 0
                        ? '重新导入一次 Apple 健康全量文件后，会显示每条运动的时间、时长、热量和距离。'
                        : '如果当天做过训练，请确认 Apple 健康导出文件里包含 Workout 记录。'}
                    </span>
                  </div>
                )}
              </div>
            ) : null}
          </section>
        ) : null}

        {page === 'nutrition' ? (
          <section className="surface food-panel" id="food" aria-labelledby="food-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{t('食物识别')}</p>
                <h2 id="food-title">{t('热量与成分')}</h2>
              </div>
              <span className="budget-chip">
                {target?.calorieGoal ?? defaultCalorieGoal} kcal {target ? t('目标') : t('默认')}
              </span>
            </div>

            <div className="meal-diary-toolbar">
              <label className="date-field">
                <span>
                  <CalendarDays size={16} aria-hidden="true" />
                  {t('日期')}
                </span>
                <div className="date-control">
                  <input
                    aria-label={t('日期')}
                    className="native-date-input"
                    type="date"
                    value={selectedNutritionDate}
                    onChange={(event) => {
                      if (event.currentTarget.value) setSelectedNutritionDate(event.currentTarget.value)
                    }}
                    onInput={(event) => {
                      if (event.currentTarget.value) setSelectedNutritionDate(event.currentTarget.value)
                    }}
                  />
                  <div className="date-control-value" aria-hidden="true">
                    {formatFullDate(selectedNutritionDate)}
                  </div>
                </div>
              </label>
              <div className="meal-type-toggle" aria-label={t('选择餐次')}>
                {mealTypeOptions.map((option) => (
                  <button
                    className={selectedMealType === option.id ? 'selected' : ''}
                    type="button"
                    key={option.id}
                    onClick={() => setSelectedMealType(option.id)}
                  >
                    {t(option.label)}
                  </button>
                ))}
              </div>
            </div>

            <div className="food-workbench">
              <label className="food-drop">
                {foodPreview ? <img src={foodPreview} alt={t('餐食预览')} /> : <Salad size={34} aria-hidden="true" />}
                <input type="file" accept="image/*" onChange={handleFoodUpload} />
              </label>
              <div className="food-controls">
                <input
                  placeholder={t('可选：餐食线索，如牛肉米线')}
                  value={foodName}
                  onChange={(event) => setFoodName(event.target.value)}
                />
                <button className="primary-button" type="button" onClick={() => void runFoodAnalysis()} disabled={!foodFile || isFoodLoading}>
                  <Plus size={18} aria-hidden="true" />
                  {isFoodLoading ? t('识别中') : t('分析食物')}
                </button>
                {foodAnalysis ? (
                  <button className="secondary-button" type="button" onClick={() => void saveAnalyzedMeal()} disabled={foodAnalysis.calories <= 0}>
                    <Save size={18} aria-hidden="true" />
                    {t('记入')}{t(mealTypeLabel(selectedMealType))}
                  </button>
                ) : null}
              </div>
            </div>

            {foodAnalysis ? (
              <section className="food-result">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">{t(modeLabel(foodAnalysis.mode))}</p>
                    <h2>{foodAnalysis.name}</h2>
                  </div>
                  <strong>{foodAnalysis.calories} kcal</strong>
                </div>
                <div className="macro-grid">
                  <Macro label={t('蛋白')} value={foodAnalysis.protein} unit="g" />
                  <Macro label={t('碳水')} value={foodAnalysis.carbs} unit="g" />
                  <Macro label={t('脂肪')} value={foodAnalysis.fat} unit="g" />
                  <Macro label={t('可信度')} value={Math.round(foodAnalysis.confidence * 100)} unit="%" />
                </div>
                <p className="agent-note">{foodAnalysis.advice}</p>
                <div className="ingredient-list">
                  {foodAnalysis.ingredients.map((ingredient) => (
                    <article className="ingredient-item" key={`${ingredient.name}-${ingredient.amount}`}>
                      <div>
                        <h3>{ingredient.name}</h3>
                        <p>
                          {ingredient.amount} · 蛋白 {ingredient.protein}g · 碳水 {ingredient.carbs}g · 脂肪 {ingredient.fat}g
                        </p>
                      </div>
                      <strong>{ingredient.calories} kcal</strong>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="meal-date-summary" aria-label={`${selectedNutritionDate} 饮食汇总`}>
              <div>
                <span>{formatMealDate(selectedNutritionDate)}</span>
                <strong>{selectedDateMealTotals.calories} kcal</strong>
              </div>
              <div>
                <span>{t('蛋白')}</span>
                <strong>{selectedDateMealTotals.protein}g</strong>
              </div>
              <div>
                <span>{t('碳水')}</span>
                <strong>{selectedDateMealTotals.carbs}g</strong>
              </div>
              <div>
                <span>{t('脂肪')}</span>
                <strong>{selectedDateMealTotals.fat}g</strong>
              </div>
            </section>

            {selectedDateMeals.length ? (
              <div className="meal-list">
                {selectedDateMeals.map((meal) => (
                  <article className="meal-item" key={meal.id}>
                    <div className="meal-main">
                      <div className="meal-title-row">
                        <span className="meal-type-chip">{t(mealTypeLabel(normalizeMealType(meal.mealType)))}</span>
                        <h3>{meal.name}</h3>
                      </div>
                      <p>
                        蛋白 {meal.protein}g · 碳水 {meal.carbs}g · 脂肪 {meal.fat}g
                      </p>
                    </div>
                    <div className="meal-actions">
                      <strong>{meal.calories} kcal</strong>
                      <button className="icon-button danger-button" type="button" onClick={() => void deleteMeal(meal.id)} aria-label={`删除 ${meal.name}`}>
                        <Trash2 size={17} aria-hidden="true" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="meal-empty">
                <Salad size={24} aria-hidden="true" />
                <strong>{t('这天还没有饮食记录')}</strong>
                <span>{t('选择早餐、午餐或晚餐，上传图片后即可记入这一天。')}</span>
              </div>
            )}
          </section>
        ) : null}

        {page === 'admin' && user.role === 'admin' ? (
          <section className="surface admin-panel" aria-labelledby="admin-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Admin</p>
                <h2 id="admin-title">{t('系统后台')}</h2>
              </div>
              <button className="secondary-button" type="button" onClick={() => void loadAdminDashboard()} disabled={isAdminLoading}>
                <Database size={18} aria-hidden="true" />
                {isAdminLoading ? t('刷新中') : t('刷新数据')}
              </button>
            </div>

            <div className="admin-stat-grid">
              <AdminStat icon={Users} label={t('用户')} value={adminOverview?.totals.users ?? 0} />
              <AdminStat icon={Shield} label={t('管理员')} value={adminOverview?.totals.admins ?? 0} />
              <AdminStat icon={CheckCircle2} label={t('待审批')} value={adminOverview?.totals.pendingUsers ?? 0} />
              <AdminStat icon={Users} label={t('已拒绝')} value={adminOverview?.totals.rejectedUsers ?? 0} />
              <AdminStat icon={MessageCircle} label={t('消息')} value={adminOverview?.totals.chatMessages ?? 0} />
              <AdminStat icon={Database} label={t('记忆')} value={adminOverview?.totals.memories ?? 0} />
              <AdminStat icon={Utensils} label={t('饮食记录')} value={adminOverview?.totals.meals ?? 0} />
              <AdminStat icon={Activity} label={t('运动记录')} value={adminOverview?.totals.workouts ?? 0} />
              <AdminStat icon={Zap} label={t('Token 请求')} value={adminOverview?.totals.tokenRequests ?? 0} />
              <AdminStat icon={LineChart} label={t('估算 Token')} value={adminOverview?.totals.tokens ?? 0} />
            </div>

            <div className="admin-tabs" aria-label={t('后台子页面')}>
              {adminTabs.map((tab) => (
                <button className={adminTab === tab.id ? 'selected' : ''} key={tab.id} type="button" onClick={() => setAdminTab(tab.id)}>
                  {t(tab.label)}
                </button>
              ))}
            </div>

            {adminTab === 'model-config' ? (
              <section className="admin-model-dashboard" aria-label="模型配置">
                {editingAdminModelProvider ? (
                  <form className="admin-model-form admin-model-editor" onSubmit={(event) => void saveAgentModelConfig(event)}>
                    <div className="admin-model-heading">
                      <div>
                        <p className="eyebrow">模型供应商</p>
                        <h3>新建 / 编辑模型</h3>
                        <p>选择预设会自动填充模型和接口地址，也可以直接填写兼容接口。</p>
                      </div>
                      <div className="admin-model-heading-actions">
                        <button className="secondary-button" type="button" onClick={cancelAdminProviderEditor}>
                          返回列表
                        </button>
                      </div>
                    </div>

                    <div className="ccswitch-preset-panel">
                      <div className="ccswitch-provider-market" aria-label="模型预设">
                        {ccswitchProviderPresets.map((preset) => {
                          const isSelected = editingAdminModelProvider.displayName === preset.displayName || editingAdminModelProvider.provider === preset.provider
                          return (
                            <button
                              className={`ccswitch-provider-chip ${isSelected ? 'added' : ''}`}
                              key={preset.id}
                              type="button"
                              onClick={() => applyAdminProviderPresetToEditor(preset)}
                            >
                              <span className="ccswitch-provider-name">
                                {preset.featured ? <Star size={14} aria-hidden="true" /> : null}
                                {preset.displayName}
                              </span>
                              <small>{preset.hint}</small>
                            </button>
                          )
                        })}
                      </div>
                      <p className="ccswitch-helper">
                        选择预设后通常只需要补 API Key；高级场景可以手动调整模型名、Base URL 和超时时间。
                      </p>
                    </div>

                    <fieldset className="admin-provider-card">
                      <div className="admin-provider-head">
                        <div className="admin-provider-title">
                          <strong>{editingAdminModelProvider.displayName || `供应商 ${editingAdminModelProviderIndex + 1}`}</strong>
                          <small>
                            {editingAdminModelProvider.provider || 'provider'} · 普通 {editingAdminModelProvider.model || '未配置'} · 视觉{' '}
                            {editingAdminModelProvider.visionModel || editingAdminModelProvider.model || '未配置'}
                          </small>
                        </div>
                        <label className="admin-provider-active">
                          <input
                            type="radio"
                            name="active-agent-provider"
                            checked={adminModelConfigForm.activeProvider === editingAdminModelProvider.id}
                            onChange={() => setAdminModelConfigForm((current) => ({ ...current, activeProvider: editingAdminModelProvider.id }))}
                          />
                          普通默认
                        </label>
                        <label className="admin-provider-active">
                          <input
                            type="radio"
                            name="active-agent-vision-provider"
                            checked={adminModelConfigForm.activeVisionProvider === editingAdminModelProvider.id}
                            onChange={() => setAdminModelConfigForm((current) => ({ ...current, activeVisionProvider: editingAdminModelProvider.id }))}
                          />
                          视觉默认
                        </label>
                        <label className="admin-provider-toggle">
                          <input
                            type="checkbox"
                            checked={editingAdminModelProvider.enabled}
                            onChange={(event) => {
                              updateAdminProviderField(editingAdminModelProviderIndex, { enabled: event.currentTarget.checked })
                            }}
                          />
                          启用
                        </label>
                        <button
                          className="icon-button danger-button"
                          type="button"
                          onClick={() => removeAdminProvider(editingAdminModelProviderIndex)}
                          disabled={adminModelConfigForm.providers.length <= 1}
                          aria-label={`删除供应商 ${editingAdminModelProvider.displayName}`}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>

                      <div className="admin-provider-sections">
                        <section className="admin-provider-section">
                          <header>
                            <span>基础信息</span>
                            <small>用于列表展示、默认供应商选择和排序。</small>
                          </header>
                          <div className="admin-provider-grid">
                            <label>
                              <span>供应商ID</span>
                              <input
                                value={editingAdminModelProvider.id}
                                onChange={(event) => {
                                  updateAdminProviderField(editingAdminModelProviderIndex, { id: event.currentTarget.value })
                                }}
                                placeholder="deepseek"
                              />
                            </label>
                            <label>
                              <span>供应商名称</span>
                              <input
                                value={editingAdminModelProvider.provider}
                                onChange={(event) => {
                                  updateAdminProviderField(editingAdminModelProviderIndex, { provider: event.currentTarget.value })
                                }}
                                placeholder="deepseek"
                              />
                            </label>
                            <label>
                              <span>显示名称</span>
                              <input
                                value={editingAdminModelProvider.displayName}
                                onChange={(event) => {
                                  updateAdminProviderField(editingAdminModelProviderIndex, { displayName: event.currentTarget.value })
                                }}
                                placeholder="DeepSeek"
                              />
                            </label>
                          </div>
                        </section>

                        <section className="admin-provider-section">
                          <header>
                            <span>模型选择</span>
                            <small>普通模型用于对话和计划生成；视觉模型用于饮食图片识别。</small>
                          </header>
                          <div className="admin-provider-grid model-split">
                            <label>
                              <span>普通模型</span>
                              <input
                                value={editingAdminModelProvider.model}
                                onChange={(event) => {
                                  updateAdminProviderField(editingAdminModelProviderIndex, { model: event.currentTarget.value })
                                }}
                                placeholder="deepseek-chat"
                              />
                            </label>
                            <label>
                              <span>视觉模型</span>
                              <input
                                value={editingAdminModelProvider.visionModel}
                                onChange={(event) => {
                                  updateAdminProviderField(editingAdminModelProviderIndex, { visionModel: event.currentTarget.value })
                                }}
                                placeholder="deepseek-vl 或 gemini-3-flash-preview"
                              />
                            </label>
                          </div>
                        </section>

                        <section className="admin-provider-section">
                          <header>
                            <span>连接配置</span>
                            <small>普通模型和视觉模型共用同一个兼容接口地址与 API Key。</small>
                          </header>
                          <div className="admin-provider-grid">
                            <label>
                              <span>Base URL</span>
                              <input
                                value={editingAdminModelProvider.baseUrl}
                                onChange={(event) => {
                                  updateAdminProviderField(editingAdminModelProviderIndex, { baseUrl: event.currentTarget.value })
                                }}
                                placeholder="https://your-api-endpoint.com/v1"
                              />
                            </label>
                            <label>
                              <span>超时 (ms)</span>
                              <input
                                type="number"
                                min="1000"
                                value={editingAdminModelProvider.timeoutMsText}
                                onChange={(event) => {
                                  updateAdminProviderField(editingAdminModelProviderIndex, { timeoutMsText: event.currentTarget.value })
                                }}
                                placeholder="90000"
                              />
                            </label>
                            <label>
                              <span>API Key</span>
                              <input
                                type="password"
                                autoComplete="off"
                                value={editingAdminModelProvider.apiKey}
                                onChange={(event) => {
                                  updateAdminProviderField(editingAdminModelProviderIndex, { apiKey: event.currentTarget.value })
                                }}
                                placeholder="只需要填这里，其他配置可用预设自动填充"
                              />
                            </label>
                          </div>
                        </section>
                      </div>
                    </fieldset>

                    <p className="admin-note">
                      保存后会回到模型列表。普通默认：
                      {activeModelProvider?.displayName ?? adminModelConfigForm.activeProvider} · {activeModelProvider?.model ?? '-'}；视觉默认：
                      {activeVisionModelProvider?.displayName ?? adminModelConfigForm.activeVisionProvider} ·{' '}
                      {activeVisionModelProvider?.visionModel ?? activeVisionModelProvider?.model ?? '-'}
                    </p>
                    {editingAdminModelProviderTestResult ? (
                      <p className={`admin-model-test-result ${editingAdminModelProviderTestResult.ok ? 'ok' : 'fail'}`}>
                        {editingAdminModelProviderTestResult.ok ? '测试通过' : '测试失败'}：
                        {editingAdminModelProviderTestResult.message}
                      </p>
                    ) : null}
                    <div className="admin-actions">
                      <button className="secondary-button" type="button" onClick={cancelAdminProviderEditor}>
                        取消
                      </button>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => void testAdminModelProvider(editingAdminModelProviderIndex)}
                        disabled={testingAdminModelProviderKey === editingAdminModelProviderTestKey}
                      >
                        {testingAdminModelProviderKey === editingAdminModelProviderTestKey ? '测试中' : '测试连接'}
                      </button>
                      <button className="primary-button" type="submit" disabled={isAdminLoading}>
                        <Save size={18} aria-hidden="true" />
                        保存模型配置
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="admin-model-heading">
                      <div>
                        <p className="eyebrow">模型供应商</p>
                        <h3>模型配置</h3>
                        <p>已配置模型会保存在这里。需要新增或修改时再进入配置页。</p>
                      </div>
                      <div className="admin-model-heading-actions">
                        <span className="status-pill">
                          {adminModelConfigForm.providers.length} 个供应商
                        </span>
                        <button className="primary-button" type="button" onClick={() => addAdminProvider()}>
                          <Plus size={18} aria-hidden="true" />
                          新建模型
                        </button>
                      </div>
                    </div>

                    <div className="admin-model-card-list">
                      {adminModelConfigForm.providers.map((provider, index) => {
                        const isActive = adminModelConfigForm.activeProvider === provider.id
                        const isVisionActive = adminModelConfigForm.activeVisionProvider === provider.id
                        const providerInitial = (provider.displayName || provider.provider || provider.id || 'M').slice(0, 2).toUpperCase()
                        const testKey = getAdminProviderTestKey(provider, index)
                        const testResult = adminModelTestResults[testKey]
                        const isTesting = testingAdminModelProviderKey === testKey
                        const isDragging = draggingAdminModelProviderIndex === index
                        const isDragOver = dragOverAdminModelProviderIndex === index && draggingAdminModelProviderIndex !== index
                        return (
                          <article
                            className={`admin-model-row ${isActive ? 'active' : ''} ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
                            key={`${provider.id}-${index}`}
                            onDragOver={(event) => handleAdminProviderDragOver(event, index)}
                            onDrop={(event) => handleAdminProviderDrop(event, index)}
                          >
                            <div className="admin-model-row-main">
                              <button
                                className="admin-model-handle"
                                type="button"
                                draggable={adminModelConfigForm.providers.length > 1}
                                onDragStart={(event) => handleAdminProviderDragStart(event, index)}
                                onDragEnd={handleAdminProviderDragEnd}
                                aria-label={`拖动调整 ${provider.displayName || provider.id} 顺序`}
                              >
                                <GripVertical size={18} aria-hidden="true" />
                              </button>
                              <span className="admin-model-avatar">{providerInitial}</span>
                              <div>
                                <strong>{provider.displayName || `供应商 ${index + 1}`}</strong>
                                <small>{provider.baseUrl || '未配置请求地址'}</small>
                              </div>
                            </div>
                            <div className="admin-model-row-meta">
                              {isActive ? <span className="status-pill">普通默认</span> : null}
                              {isVisionActive ? <span className="status-pill">视觉默认</span> : null}
                              <span className={`admin-model-state ${provider.enabled ? 'enabled' : ''}`}>
                                {provider.enabled ? '已启用' : '已停用'}
                              </span>
                              {isTesting ? (
                                <span className="admin-model-test-result pending">测试中...</span>
                              ) : testResult ? (
                                <span className={`admin-model-test-result ${testResult.ok ? 'ok' : 'fail'}`}>
                                  {testResult.ok ? `可用 ${testResult.latencyMs}ms` : `失败：${testResult.message}`}
                                </span>
                              ) : null}
                              <div className="admin-model-kind-list">
                                <span>
                                  <b>普通模型</b>
                                  <small>{provider.model || '未配置'}</small>
                                </span>
                                <span>
                                  <b>视觉模型</b>
                                  <small>{provider.visionModel || provider.model || '未配置'}</small>
                                </span>
                              </div>
                            </div>
                            <div className="admin-model-row-actions">
                              <button
                                className="secondary-button"
                                type="button"
                                onClick={() => setAdminModelConfigForm((current) => ({ ...current, activeProvider: provider.id }))}
                                disabled={isActive}
                              >
                                设为普通
                              </button>
                              <button
                                className="secondary-button"
                                type="button"
                                onClick={() => setAdminModelConfigForm((current) => ({ ...current, activeVisionProvider: provider.id }))}
                                disabled={isVisionActive}
                              >
                                设为视觉
                              </button>
                              <button
                                className="secondary-button"
                                type="button"
                                onClick={() => {
                                  updateAdminProviderField(index, { enabled: !provider.enabled })
                                }}
                              >
                                {provider.enabled ? '停用' : '启用'}
                              </button>
                              <button className="secondary-button" type="button" onClick={() => setAdminModelEditorIndex(index)}>
                                编辑
                              </button>
                              <button
                                className="secondary-button"
                                type="button"
                                onClick={() => void testAdminModelProvider(index)}
                                disabled={isTesting}
                              >
                                {isTesting ? '测试中' : '测试'}
                              </button>
                              <button
                                className="icon-button danger-button"
                                type="button"
                                onClick={() => removeAdminProvider(index)}
                                disabled={adminModelConfigForm.providers.length <= 1}
                                aria-label={`删除供应商 ${provider.displayName || index + 1}`}
                              >
                                <Trash2 size={17} aria-hidden="true" />
                              </button>
                            </div>
                          </article>
                        )
                      })}
                    </div>

                    <div className="admin-actions">
                      <button className="primary-button" type="button" onClick={() => void saveAgentModelConfig()} disabled={isAdminLoading}>
                        <Save size={18} aria-hidden="true" />
                        保存列表变更
                      </button>
                    </div>
                  </>
                )}
              </section>
            ) : (
              <div className="admin-workspace">
                <section className="admin-users">
                  <div className="admin-subheading">
                    <h3>{t('用户管理')}</h3>
                    <span>{adminUsers.length} {t('人')}</span>
                  </div>
                  <div className="admin-user-list">
                    {adminUsers.map((adminUser) => (
                      <button
                        className={`admin-user-row ${adminUser.id === selectedAdminUserId ? 'active' : ''}`}
                        key={adminUser.id}
                        type="button"
                        onClick={() => void selectAdminUser(adminUser.id)}
                      >
                        <UserAvatar user={adminUser} />
                        <div>
                          <strong>{adminUser.displayName}</strong>
                          <small>
                            @{adminUser.username} · {adminUser.role === 'admin' ? t('管理员') : t('普通用户')} ·{' '}
                            {registrationStatusLabel(adminUser.registrationStatus)}
                          </small>
                        </div>
                        <em className={`approval-badge ${adminUser.registrationStatus}`}>
                          {adminUser.registrationStatus === 'approved' ? `${adminUser.tokenUsage.totalTokens} tok` : registrationStatusLabel(adminUser.registrationStatus)}
                        </em>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="admin-detail">
                  {adminUserDetail ? (
                    <>
                      <div className="admin-subheading">
                        <div className="admin-user-heading">
                          <UserAvatar user={adminUserDetail} />
                          <div>
                            <h3>{adminUserDetail.displayName}</h3>
                            <p>
                              @{adminUserDetail.username} · {adminUserDetail.role === 'admin' ? '管理员' : '普通用户'} ·{' '}
                              {registrationStatusLabel(adminUserDetail.registrationStatus)}
                            </p>
                          </div>
                        </div>
                        <div className="admin-detail-actions">
                          <span>
                            {adminUserDetail.reviewedAt
                              ? `审批 ${formatCompactDate(adminUserDetail.reviewedAt)}`
                              : `更新 ${formatCompactDate(adminUserDetail.updatedAt)}`}
                          </span>
                          {adminUserDetail.registrationStatus !== 'approved' ? (
                            <button
                              className="secondary-button"
                              type="button"
                              onClick={() => void updateAdminUserApproval(adminUserDetail.id, 'approved')}
                              disabled={isAdminLoading}
                            >
                              通过
                            </button>
                          ) : null}
                          {adminUserDetail.registrationStatus === 'pending' ? (
                            <button
                              className="secondary-button danger-inline-button"
                              type="button"
                              onClick={() => void updateAdminUserApproval(adminUserDetail.id, 'rejected')}
                              disabled={isAdminLoading}
                            >
                              拒绝
                            </button>
                          ) : null}
                          <button
                            className="icon-button danger-button"
                            type="button"
                            onClick={() => requestDeleteAdminUser(adminUserDetail)}
                            disabled={adminUserDetail.id === user.id || isAdminLoading}
                            aria-label={`删除 ${adminUserDetail.displayName}`}
                          >
                            <Trash2 size={17} aria-hidden="true" />
                          </button>
                        </div>
                      </div>

                      <div className="admin-detail-grid">
                        <Macro label="对话" value={adminUserDetail.chatThreads.length} unit="组" />
                        <Macro label="消息" value={adminUserDetail.chatMessages} unit="条" />
                        <Macro label="餐食" value={adminUserDetail.meals} unit="条" />
                        <Macro label="运动" value={adminUserDetail.workouts} unit="条" />
                      </div>

                      {adminTab === 'users' ? (
                        <>
                          <div className="admin-detail-section">
                            <h3>最近对话</h3>
                            {adminUserDetail.chatThreads.length ? (
                              <div className="admin-thread-list">
                                {adminUserDetail.chatThreads.slice(0, 5).map((thread) => (
                                  <article className="admin-thread" key={thread.id}>
                                    <strong>{thread.title}</strong>
                                    <small>{agentShortName(thread.agentId)} · {thread.messageCount} 条 · {formatCompactDate(thread.updatedAt)}</small>
                                  </article>
                                ))}
                              </div>
                            ) : (
                              <p>暂无对话</p>
                            )}
                          </div>

                          <div className="admin-detail-section">
                            <h3>用户记忆</h3>
                            {adminUserDetail.memories.length ? (
                              <div className="admin-memory-list">
                                {adminUserDetail.memories.slice(0, 6).map((memory) => (
                                  <article className="admin-memory" key={memory.id}>
                                    <span>{memory.category}</span>
                                    <p>{memory.content}</p>
                                  </article>
                                ))}
                              </div>
                            ) : (
                              <p>暂无记忆</p>
                            )}
                          </div>
                        </>
                      ) : null}

                      {adminTab === 'permissions' ? (
                        <div className="admin-detail-section">
                          <h3>页面权限</h3>
                          {adminUserDetail.role === 'admin' ? <p>管理员默认拥有全部页面权限。</p> : null}
                          <div className="permission-list">
                            {permissionPages.map((permission) => {
                              const enabled = (adminUserDetail.pagePermissions ?? defaultPagePermissions)[permission.page] !== false
                              return (
                                <button
                                  className={`permission-row ${enabled ? 'enabled' : ''}`}
                                  type="button"
                                  key={permission.page}
                                  onClick={() => void toggleAdminPermission(adminUserDetail.id, permission.page, !enabled)}
                                  disabled={adminUserDetail.role === 'admin' || isAdminLoading}
                                >
                                  <div>
                                    <strong>{permission.label}</strong>
                                    <small>{permission.description}</small>
                                  </div>
                                  <span>{enabled ? '开启' : '关闭'}</span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      ) : null}

                      {adminTab === 'tokens' ? (
                        <div className="admin-detail-section">
                          <h3>Token 使用统计</h3>
                          <div className="admin-detail-grid">
                            <Macro label="请求" value={adminUserDetail.tokenUsage.requests} unit="次" />
                            <Macro label="输入" value={adminUserDetail.tokenUsage.inputTokens} unit="tok" />
                            <Macro label="输出" value={adminUserDetail.tokenUsage.outputTokens} unit="tok" />
                            <Macro label="合计" value={adminUserDetail.tokenUsage.totalTokens} unit="tok" />
                          </div>
                          {adminUserDetail.tokenUsageByFeature.length ? (
                            <div className="token-feature-list">
                              {adminUserDetail.tokenUsageByFeature.map((usage) => (
                                <article className="token-feature" key={usage.feature}>
                                  <div>
                                    <strong>{usage.feature}</strong>
                                    <small>{usage.requests} 次 · 输入 {usage.inputTokens} · 输出 {usage.outputTokens}</small>
                                  </div>
                                  <span>{usage.totalTokens} tok</span>
                                </article>
                              ))}
                            </div>
                          ) : (
                            <p>暂无 Token 使用记录</p>
                          )}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <EmptyState
                      action="刷新数据"
                      icon={Shield}
                      onAction={() => void loadAdminDashboard()}
                      title="还没有后台数据"
                    />
                  )}
                </section>
              </div>
            )}
          </section>
        ) : null}

        {page === 'chat' ? (
          <section className="surface chat-panel" aria-labelledby="chat-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Agent</p>
                <h2 id="chat-title">{t('私人教练对话')}</h2>
              </div>
              <div className="chat-header-actions">
                <button className="icon-button" type="button" onClick={() => void clearChat()} aria-label={t('清空当前对话')}>
                  <Trash2 size={18} aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="chat-workspace">
              <aside className="chat-sidebar" aria-label={t('历史对话')}>
                <div className="chat-sidebar-heading">
                  <h3>{t('历史对话')}</h3>
                </div>
                <div className="chat-thread-list">
                  {visibleChatThreads.length ? (
                    visibleChatThreads.map((thread) => (
                      <article
                        className={`chat-thread-item ${thread.id === activeChatThreadId ? 'active' : ''}`}
                        key={thread.id}
                      >
                        <button className="chat-thread-select" type="button" onClick={() => void selectChatThread(thread.id)}>
                          <span>{agentShortName(thread.agentId)}</span>
                          <strong>{thread.title}</strong>
                          <small>{thread.messageCount} 条 · {formatThreadTime(thread.updatedAt)}</small>
                        </button>
                        <button className="icon-button chat-thread-delete" type="button" onClick={() => void deleteChatThread(thread.id)} aria-label={`删除 ${thread.title}`}>
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      </article>
                    ))
                  ) : (
                    <p className="chat-history-empty">{t('发送第一条消息后出现在这里')}</p>
                  )}
                </div>
              </aside>

              <div className="chat-main">
                <div className="agent-picker" aria-label={t('智能体')}>
                  {chatAgents.map((agent) => (
                    <button
                      className={`agent-card ${agent.id === selectedChatAgentId ? 'active' : ''}`}
                      type="button"
                      key={agent.id}
                      onClick={() => startDraftChat(agent.id)}
                      disabled={isChatLoading}
                    >
                      <span>{agent.shortName}</span>
                      <strong>{agent.name}</strong>
                      <small>{agent.description}</small>
                    </button>
                  ))}
                </div>

                <div className="chat-conversation">
                  <div className="active-agent-bar">
                    <div>
                      <span>{selectedChatAgent.shortName}</span>
                      <strong>{activeChatThread?.title ?? t('输入后保存到历史')}</strong>
                    </div>
                    <small>{selectedChatAgent.focus.join(' / ')}</small>
                  </div>

                  <div className="chat-log" ref={chatLogRef}>
                    {chatMessages.length ? (
                      chatMessages.map((message) => (
                        <article className={`chat-message ${message.role}`} key={message.id}>
                          <p>{formatChatContent(message.content)}</p>
                        </article>
                      ))
                    ) : (
                      <EmptyState action={t('开始提问')} icon={MessageCircle} onAction={() => undefined} title={t('这条对话还没有消息')} />
                    )}
                    <ExerciseVideoResults isLoading={isExerciseVideoLoading} search={exerciseVideoSearch} />
                  </div>

                  <form className="chat-form" onSubmit={(event) => void sendChatMessage(event)}>
                    <input value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder={t('问问今天怎么吃、怎么练')} />
                    <button className="primary-button" type="submit" disabled={!chatInput.trim() || isChatLoading}>
                      <Send size={18} aria-hidden="true" />
                      {isChatLoading ? t('发送中') : t('发送')}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </section>

      {pendingDeleteUser ? (
        <div
          className="app-modal-backdrop"
          role="presentation"
          onClick={() => {
            if (!isAdminLoading) setPendingDeleteUser(null)
          }}
        >
          <section
            className="app-modal danger-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-user-title"
            aria-describedby="delete-user-desc"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-icon danger">
              <Trash2 size={22} aria-hidden="true" />
            </div>
            <div className="modal-copy">
              <p className="eyebrow">危险操作</p>
              <h2 id="delete-user-title">删除用户</h2>
              <p id="delete-user-desc">
                确定删除用户 <strong>{pendingDeleteUser.displayName}</strong> 吗？该用户的记录、对话和记忆都会一起删除。
              </p>
            </div>
            <div className="modal-target">
              <UserAvatar user={pendingDeleteUser} />
              <div>
                <strong>{pendingDeleteUser.displayName}</strong>
                <span>@{pendingDeleteUser.username} · {pendingDeleteUser.role === 'admin' ? '管理员' : '普通用户'}</span>
              </div>
            </div>
            <div className="modal-actions">
              <button className="secondary-button" type="button" onClick={() => setPendingDeleteUser(null)} disabled={isAdminLoading}>
                取消
              </button>
              <button className="primary-button danger-confirm-button" type="button" onClick={() => void deleteAdminUser()} disabled={isAdminLoading}>
                <Trash2 size={17} aria-hidden="true" />
                {isAdminLoading ? '删除中' : '确认删除'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}

function AuthScreen({
  error,
  notice,
  isLoading,
  onModeChange,
  onSubmit,
}: {
  error: string
  notice: string
  isLoading: boolean
  onModeChange: () => void
  onSubmit: (mode: 'login' | 'register', username: string, password: string, displayName: string, confirmPassword: string) => Promise<void>
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    void onSubmit(mode, username, password, displayName, confirmPassword)
  }

  function changeMode(nextMode: 'login' | 'register') {
    if (nextMode === mode) return
    setMode(nextMode)
    setConfirmPassword('')
    onModeChange()
  }

  const isSubmitDisabled =
    isLoading ||
    !username ||
    !password ||
    (mode === 'register' && (!displayName || !confirmPassword))

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand-mark">
          <Activity size={22} aria-hidden="true" />
        </div>
        <div>
          <p className="eyebrow">FitAgent</p>
          <h1>{mode === 'login' ? '登录' : '注册'}</h1>
        </div>
        <div className="auth-tabs">
          <button className={mode === 'login' ? 'selected' : ''} type="button" onClick={() => changeMode('login')}>
            登录
          </button>
          <button className={mode === 'register' ? 'selected' : ''} type="button" onClick={() => changeMode('register')}>
            注册
          </button>
        </div>
        <form className="auth-form" onSubmit={submit}>
          <label>
            <span>用户名</span>
            <input value={username} maxLength={40} onChange={(event) => setUsername(event.target.value)} />
          </label>
          {mode === 'register' ? (
            <label>
              <span>昵称</span>
              <input value={displayName} maxLength={40} onChange={(event) => setDisplayName(event.target.value)} />
            </label>
          ) : null}
          <label>
            <span>密码</span>
            <input type="password" value={password} maxLength={128} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {mode === 'register' ? (
            <label>
              <span>确认密码</span>
              <input type="password" value={confirmPassword} maxLength={128} onChange={(event) => setConfirmPassword(event.target.value)} />
            </label>
          ) : null}
          {notice ? <p className="notice-banner">{notice}</p> : null}
          {error ? <p className="error-banner">{error}</p> : null}
          <button className="primary-button wide-button" type="submit" disabled={isSubmitDisabled}>
            <Users size={18} aria-hidden="true" />
            {isLoading ? '处理中' : mode === 'login' ? '登录' : '创建账号'}
          </button>
        </form>
      </section>
    </main>
  )
}

function Metric({
  title,
  value,
  unit,
  tone,
  icon: Icon,
}: {
  title: string
  value: string
  unit: string
  tone: 'green' | 'blue' | 'coral' | 'amber'
  icon: typeof Flame
}) {
  return (
    <article className={`metric ${tone}`}>
      <Icon size={20} aria-hidden="true" />
      <div>
        <p>{title}</p>
        <strong>
          {value}
          <span>{unit}</span>
        </strong>
      </div>
    </article>
  )
}

function UserAvatar({ user, size = 'default' }: { user: Pick<PublicUser, 'displayName' | 'username' | 'avatarUrl'>; size?: 'default' | 'large' }) {
  const label = user.displayName || user.username || 'U'
  return (
    <span className={`user-avatar ${size === 'large' ? 'large' : ''}`}>
      {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <span>{label.slice(0, 1).toUpperCase()}</span>}
    </span>
  )
}

function Macro({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="macro">
      <span>{label}</span>
      <strong>
        {value}
        <small>{unit}</small>
      </strong>
    </div>
  )
}

function AdminStat({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: number }) {
  return (
    <article className="admin-stat">
      <Icon size={18} aria-hidden="true" />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      <span>{label}</span>
      <input inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function EmptyState({
  action,
  icon: Icon,
  onAction,
  title,
}: {
  action: string
  icon: typeof Settings
  onAction: () => void
  title: string
}) {
  return (
    <section className="surface empty-state">
      <Icon size={28} aria-hidden="true" />
      <h2>{title}</h2>
      <button className="primary-button" type="button" onClick={onAction}>
        <Plus size={18} aria-hidden="true" />
        {action}
      </button>
    </section>
  )
}

function ExerciseVideoResults({ isLoading, search }: { isLoading: boolean; search: ExerciseVideoSearch | null }) {
  if (!isLoading && !search?.results.length) return null

  return (
    <article className="exercise-video-results">
      <div className="exercise-video-heading">
        <Search size={17} aria-hidden="true" />
        <div>
          <span>{isLoading && !search ? '搜索中' : '运动视频'}</span>
          <strong>{search?.exercises.length ? search.exercises.join(' / ') : '匹配动作'}</strong>
        </div>
      </div>

      {search?.results.length ? (
        <div className="exercise-video-list">
          {search.results.map((result) => (
            <a className="exercise-video-link" href={result.url} key={result.id} target="_blank" rel="noreferrer">
              <Play size={17} aria-hidden="true" />
              <div>
                <strong>{result.title}</strong>
                <small>
                  {result.source} · {result.description}
                </small>
              </div>
              <ExternalLink size={15} aria-hidden="true" />
            </a>
          ))}
        </div>
      ) : (
        <p>正在匹配动作视频</p>
      )}
    </article>
  )
}

async function postPublicJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return readApiResponse<T>(response)
}

async function postForm<T>(url: string, body: FormData, token: string): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: authHeaders(token),
    body,
  })
  return readApiResponse<T>(response)
}

async function postJson<T>(url: string, body: unknown, token: string): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(body),
  })
  return readApiResponse<T>(response)
}

async function patchJson<T>(url: string, body: unknown, token: string): Promise<T> {
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(body),
  })
  return readApiResponse<T>(response)
}

async function getJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: authHeaders(token),
  })
  return readApiResponse<T>(response)
}

async function deleteJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  return readApiResponse<T>(response)
}

async function postChatStream(
  message: string,
  token: string,
  context: { threadId?: string; agentId?: string },
  callbacks: ChatStreamCallbacks,
  signal?: AbortSignal,
) {
  const response = await fetch('/api/agent/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify({ message, threadId: context.threadId, agentId: context.agentId }),
    signal,
  })

  if (!response.ok) {
    await readApiResponse(response)
    return
  }

  if (!response.body) throw new Error('浏览器不支持流式响应')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      buffer = readSseBuffer(buffer, callbacks)
    }
  } catch (error) {
    reader.cancel().catch(() => undefined)
    if ((error as DOMException).name === 'AbortError') return
    throw error
  }

  buffer += decoder.decode()
  readSseBuffer(`${buffer}\n\n`, callbacks)
}

function readSseBuffer(buffer: string, callbacks: ChatStreamCallbacks) {
  let nextBuffer = buffer
  let boundary = nextBuffer.indexOf('\n\n')

  while (boundary >= 0) {
    const frame = nextBuffer.slice(0, boundary)
    nextBuffer = nextBuffer.slice(boundary + 2)
    const event = parseSseFrame(frame)
    if (event) handleChatStreamEvent(event, callbacks)
    boundary = nextBuffer.indexOf('\n\n')
  }

  return nextBuffer
}

function parseSseFrame(frame: string): ChatStreamEvent | null {
  let type = ''
  const dataLines: string[] = []

  for (const line of frame.split(/\r?\n/)) {
    if (line.startsWith('event:')) {
      type = line.slice('event:'.length).trim()
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trimStart())
    }
  }

  if (!type || !dataLines.length) return null

  try {
    return { type, ...JSON.parse(dataLines.join('\n')) } as ChatStreamEvent
  } catch {
    return null
  }
}

function handleChatStreamEvent(event: ChatStreamEvent, callbacks: ChatStreamCallbacks) {
  if (event.type === 'user') {
    callbacks.onUser(event.message)
  } else if (event.type === 'assistant_start') {
    callbacks.onAssistantStart(event.message)
  } else if (event.type === 'status') {
    callbacks.onStatus(event.status)
  } else if (event.type === 'delta') {
    callbacks.onDelta(event.text)
  } else if (event.type === 'replace') {
    callbacks.onReplace(event.text)
  } else if (event.type === 'done') {
    callbacks.onDone({ thread: event.thread, chatThreads: event.chatThreads, chatMessages: event.chatMessages })
  } else if (event.type === 'error') {
    throw new Error(event.error)
  }
}

async function readApiResponse<T>(response: Response): Promise<T> {
  const text = await response.text()

  if (!text) {
    if (!response.ok) {
      throw new Error(response.statusText || `请求失败 (${response.status})`)
    }
    return { ok: true } as T
  }

  let data: unknown
  try {
    data = JSON.parse(text)
  } catch (error) {
    throw new Error('返回结果不是有效 JSON', { cause: error })
  }

  if (!response.ok) {
    const message =
      typeof data === 'object' &&
      data !== null &&
      'error' in data &&
      typeof (data as { error?: unknown }).error === 'string'
        ? String((data as { error: string }).error)
        : response.statusText || `请求失败 (${response.status})`
    throw new Error(message)
  }

  if (typeof data === 'object' && data !== null && 'ok' in data && (data as { ok?: unknown }).ok === false) {
    const dataRecord = data as Record<string, unknown>
    const message = typeof dataRecord.error === 'string' ? String(dataRecord.error) : '后端请求失败'
    throw new Error(message, { cause: data })
  }
  return data as T
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` }
}

function createLocalChatId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}-${crypto.randomUUID()}`
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function agentShortName(agentId: string) {
  return chatAgents.find((agent) => agent.id === agentId)?.shortName ?? '综合'
}

type AgentModelConfigParseResult =
  | { ok: true; value: AgentModelConfig }
  | { ok: false; error: string }

function parseAgentModelConfigForm(form: AgentModelConfigForm): AgentModelConfigParseResult {
  const providerForms = Array.isArray(form.providers) ? form.providers : []
  if (!providerForms.length) {
    return { ok: false, error: '请先添加至少一个供应商' }
  }

  const usedIds = new Set<string>()
  const providers: AgentProviderModelConfig[] = []

  for (let index = 0; index < providerForms.length; index += 1) {
    const providerForm = providerForms[index]
    const rawId = normalizeText(providerForm.id, `provider-${index + 1}`)
    const id = normalizeUniqueId(rawId, usedIds)
    const timeoutMs = Number.parseInt(normalizeText(providerForm.timeoutMsText), 10)
    if (!Number.isInteger(timeoutMs) || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      return { ok: false, error: `供应商 ${id} 的超时(ms) 必须是大于 0 的整数` }
    }

    const providerName = normalizeText(providerForm.provider, id)
    const model = normalizeText(providerForm.model, 'deepseek-chat')
    providers.push({
      id,
      provider: providerName,
      displayName: normalizeText(providerForm.displayName, providerName),
      model,
      visionModel: normalizeText(providerForm.visionModel, model),
      baseUrl: normalizeText(providerForm.baseUrl, 'https://api.deepseek.com').replace(/\/+$/, ''),
      timeoutMs,
      apiKey: normalizeText(providerForm.apiKey),
      enabled: Boolean(providerForm.enabled),
    })
    usedIds.add(id)
  }

  const activeProviderCandidate = normalizeText(form.activeProvider, '')
  const activeProvider = providers.some((provider) => provider.id === activeProviderCandidate)
    ? activeProviderCandidate
    : providers[0]?.id
  const activeVisionProviderCandidate = normalizeText(form.activeVisionProvider, activeProvider)
  const activeVisionProvider = providers.some((provider) => provider.id === activeVisionProviderCandidate)
    ? activeVisionProviderCandidate
    : activeProvider
  if (!activeProvider) {
    return { ok: false, error: '请先配置一个有效供应商' }
  }

  return {
    ok: true,
    value: { activeProvider, activeVisionProvider, providers },
  }
}

function buildProviderId(existing: AgentModelProviderForm[], preferredId = 'provider') {
  const used = new Set(existing.map((provider) => normalizeText(provider.id)))
  return normalizeUniqueId(preferredId, used)
}

function getAdminProviderTestKey(provider: AgentModelProviderForm, index: number) {
  return `${index}:${normalizeText(provider.id, `provider-${index + 1}`)}`
}

function toAgentProviderForm(config: AgentProviderModelConfig): AgentModelProviderForm {
  return {
    id: normalizeText(config.id, 'provider'),
    provider: normalizeText(config.provider, 'provider'),
    displayName: normalizeText(config.displayName, normalizeText(config.provider, config.id)),
    model: normalizeText(config.model, 'deepseek-chat'),
    visionModel: normalizeText(config.visionModel, normalizeText(config.model, 'deepseek-chat')),
    baseUrl: normalizeText(config.baseUrl, 'https://api.deepseek.com'),
    timeoutMsText: String(Number.isInteger(config.timeoutMs) && config.timeoutMs > 0 ? config.timeoutMs : 90_000),
    apiKey: normalizeText(config.apiKey),
    enabled: Boolean(config.enabled),
  }
}

function toAgentModelConfigForm(config: AgentModelConfig): AgentModelConfigForm {
  const rawProviders = Array.isArray(config?.providers) ? config.providers : []
  const seenIds = new Set<string>()
  const providers = rawProviders.length
    ? rawProviders.map((provider) => {
      const formProvider = toAgentProviderForm(provider)
      const uniqueId = normalizeUniqueId(formProvider.id, seenIds)
      const normalized = { ...formProvider, id: uniqueId }
      seenIds.add(uniqueId)
      return normalized
    })
    : [toAgentProviderForm(defaultAgentModelProviderConfig)]
  const rawActiveProvider = normalizeText(config.activeProvider, providers[0]?.id ?? '')
  const activeProvider = providers.some((provider) => provider.id === rawActiveProvider)
    ? rawActiveProvider
    : providers[0]?.id ?? defaultAgentModelProviderConfig.id
  const rawActiveVisionProvider = normalizeText(config.activeVisionProvider, activeProvider)
  const activeVisionProvider = providers.some((provider) => provider.id === rawActiveVisionProvider)
    ? rawActiveVisionProvider
    : activeProvider

  return {
    activeProvider,
    activeVisionProvider,
    providers,
  }
}

function normalizeText(value: string | number | undefined, fallback = '') {
  return String(value ?? '')
    .trim()
    .replace(/^"+|"+$/g, '')
    .replace(/^'+|'+$/g, '')
    .trim() || fallback
}

function normalizeUniqueId(seed: string, used: Set<string>) {
  const base = normalizeText(seed, 'provider')
  let candidate = base
  let index = 2
  while (used.has(candidate)) {
    candidate = `${base}-${index}`
    index += 1
  }
  return candidate
}

function toAdminSummaryFromDetail(user: AdminUserDetail): AdminUserSummary {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    avatarUrl: user.avatarUrl,
    registrationStatus: user.registrationStatus,
    reviewedAt: user.reviewedAt,
    reviewedBy: user.reviewedBy,
    pagePermissions: user.pagePermissions,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    chatThreads: user.chatThreads.length,
    chatMessages: user.chatMessages,
    memories: user.memories.length,
    meals: user.meals,
    workouts: user.workouts,
    tokenUsage: user.tokenUsage,
  }
}

function registrationStatusLabel(status: RegistrationStatus) {
  if (status === 'pending') return '待审批'
  if (status === 'rejected') return '已拒绝'
  return '已通过'
}

function formatThreadTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const today = new Date()
  const sameDay = date.toDateString() === today.toDateString()
  return sameDay
    ? date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

function formatCompactDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

function formatChatContent(content: string) {
  let current: unknown = content

  for (let depth = 0; depth < 4; depth += 1) {
    if (current && typeof current === 'object' && 'reply' in current && typeof (current as { reply: unknown }).reply === 'string') {
      current = (current as { reply: string }).reply
      continue
    }

    if (typeof current !== 'string') break
    const trimmed = current.trim()
    if (!trimmed) return ''

    try {
      current = JSON.parse(trimmed) as unknown
      continue
    } catch {
      break
    }
  }

  return String(current).replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').trim()
}

function guessFoodName(fileName: string) {
  const normalized = fileName.toLowerCase()
  if (normalized.includes('salmon') || normalized.includes('fish') || normalized.includes('三文鱼')) return '三文鱼便当'
  if (normalized.includes('coffee') || normalized.includes('bagel') || normalized.includes('latte')) return '拿铁和贝果'
  if (normalized.includes('noodle') || normalized.includes('面')) return '番茄鸡蛋面'
  return ''
}

function isProfileInput(value: unknown): value is ProfileInput {
  if (!value || typeof value !== 'object') return false
  const profile = value as Partial<ProfileInput>
  return typeof profile.heightCm === 'string' && typeof profile.weightKg === 'string' && typeof profile.age === 'string'
}

function isHealthSource(value: unknown): value is HealthSource {
  return value === 'Apple 健康' || value === 'Android 运动' || value === 'Apple 健康导入'
}

function isProfileReady(profile: ProfileInput) {
  return Number(profile.heightCm) > 0 && Number(profile.weightKg) > 0 && Number(profile.age) > 0
}

function pageTitle(page: Page) {
  const titles: Record<Page, string> = {
    overview: '今日总览',
    profile: '个人目标',
    motion: '动作分析',
    health: '健康同步',
    nutrition: '饮食识别',
    chat: 'Agent 对话',
    admin: '后台管理',
    account: '账号设置',
  }
  return titles[page]
}

function modeLabel(mode: AgentMode) {
  return mode === 'agent' ? 'AI 智能体' : '本地规则'
}

function getPageModelUsageKind(page: Page): ModelUsageKind | null {
  if (page === 'nutrition' || page === 'motion') return 'vision'
  if (page === 'health' || page === 'chat') return 'text'
  return null
}

function isRuntimeModelReady(status: AgentRuntimeStatus | null, kind: ModelUsageKind) {
  if (!status) return false
  return kind === 'vision' ? status.visionEnabled : status.enabled
}

function formatRuntimeModelLabel(status: AgentRuntimeStatus | null, kind: ModelUsageKind) {
  if (!status) return '读取中'
  if (!isRuntimeModelReady(status, kind)) return '未启用'

  const displayName = kind === 'vision'
    ? status.visionDisplayName || status.displayName || status.visionProviderId || status.visionProvider
    : status.displayName || status.providerId || status.provider
  const model = kind === 'vision' ? status.visionModel : status.model
  return [displayName, model].filter(Boolean).join(' / ') || '未配置'
}

function formatRuntimeModelTitle(status: AgentRuntimeStatus | null, kind: ModelUsageKind) {
  if (!status) return '正在读取实际使用模型'
  const baseUrl = kind === 'vision' ? status.visionBaseUrl : status.baseUrl
  const configuredId = kind === 'vision' ? status.activeVisionProvider : status.activeProvider
  return `实际使用：${formatRuntimeModelLabel(status, kind)}\n配置默认：${configuredId || '未配置'}\nBase URL：${baseUrl || '未配置'}`
}

function readableError(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export default App

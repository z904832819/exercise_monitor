import { loadEnv } from './env.js'
import cors from 'cors'
import express, { type NextFunction, type Request, type Response } from 'express'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import multer from 'multer'
import JSZip from 'jszip'
import { getRagStatus, initRagStore, type RagChunk, searchKnowledge } from './rag.js'
import {
  analyzeFood,
  analyzeMotion,
  buildHealthAdvice,
  calculateNutritionTarget,
  chatAgents,
  chatWithAgent,
  getCodexRuntimeStatus,
  setRuntimeModelConfig,
  streamChatWithAgent,
  testAgentModelProvider,
  type FoodPayload,
  type HealthPayload,
  type MotionPayload,
  type ProfilePayload,
} from './codexAgent.js'
import { AppStore, type PublicUser } from './store.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
loadEnv()
const uploadDir = path.join(rootDir, 'tmp', 'uploads')
const avatarUploadDir = path.join(uploadDir, 'avatars')
const port = Number(process.env.PORT ?? 8787)
const host = process.env.HOST ?? '0.0.0.0'
const isProduction = process.env.NODE_ENV === 'production'
const defaultAllowedCorsOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8787',
  'http://127.0.0.1:8787',
]
const allowedCorsOrigins = new Set([
  ...defaultAllowedCorsOrigins,
  ...String(process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean),
])
const avatarMimeExtensions: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
}
const motionMimeTypes = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/ogg',
  'video/mov',
  'video/mpeg',
  'video/x-m4v',
  'video/x-ms-wmv',
  'video/3gpp',
]
const motionExtensions = ['.mp4', '.mov', '.m4v', '.avi', '.wmv', '.mkv', '.webm', '.ogv', '.mpeg', '.3gp']
const foodMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const foodExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
const healthImportMimeTypes = [
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream',
  'text/xml',
  'application/xml',
]
const healthImportExtensions = ['.zip', '.xml']
const motionUpload = createUpload({
  label: '视频',
  allowedMimeTypes: motionMimeTypes,
  allowedExtensions: motionExtensions,
  fileSizeMb: readPositiveInteger(process.env.MAX_MOTION_UPLOAD_MB, 200),
})
const foodUpload = createUpload({
  label: '图片',
  allowedMimeTypes: foodMimeTypes,
  allowedExtensions: foodExtensions,
  fileSizeMb: readPositiveInteger(process.env.MAX_FOOD_UPLOAD_MB, 8),
})
const healthImportUpload = createUpload({
  label: 'Apple 健康 export.xml 或 zip 文件',
  allowedMimeTypes: healthImportMimeTypes,
  allowedExtensions: healthImportExtensions,
  fileSizeMb: readPositiveInteger(process.env.MAX_HEALTH_IMPORT_UPLOAD_MB, 120),
})
const maxHealthXmlBytes = readPositiveInteger(process.env.MAX_HEALTH_XML_MB, 80) * 1024 * 1024
const authRateLimit = createRateLimit({ windowMs: 15 * 60_000, max: readPositiveInteger(process.env.AUTH_RATE_LIMIT_MAX, 30), keyPrefix: 'auth' })
const apiRateLimit = createRateLimit({ windowMs: 15 * 60_000, max: readPositiveInteger(process.env.API_RATE_LIMIT_MAX, 900), keyPrefix: 'api' })
const uploadRateLimit = createRateLimit({ windowMs: 15 * 60_000, max: readPositiveInteger(process.env.UPLOAD_RATE_LIMIT_MAX, 80), keyPrefix: 'upload' })
const agentRateLimit = createRateLimit({ windowMs: 15 * 60_000, max: readPositiveInteger(process.env.AGENT_RATE_LIMIT_MAX, 120), keyPrefix: 'agent' })
const adminModelTestRateLimit = createRateLimit({
  windowMs: 15 * 60_000,
  max: readPositiveInteger(process.env.ADMIN_MODEL_TEST_RATE_LIMIT_MAX, 30),
  keyPrefix: 'admin-model-test',
})

await fs.mkdir(uploadDir, { recursive: true })
await fs.mkdir(avatarUploadDir, { recursive: true })
const store = new AppStore()
await store.init()
await initRagStore()
setRuntimeModelConfig(await store.getAgentModelConfig())

const app = express()
app.disable('x-powered-by')
const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: avatarUploadDir,
    filename: (_request, file, callback) => {
      const extension = avatarMimeExtensions[file.mimetype] ?? ''
      callback(null, `${Date.now()}-${crypto.randomUUID()}${extension}`)
    },
  }),
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
  fileFilter: (_request, file, callback) => {
    if (!avatarMimeExtensions[file.mimetype]) {
      callback(new Error('请上传 JPG、PNG、WebP 或 GIF 图片'))
      return
    }
    callback(null, true)
  },
})

app.use(securityHeaders)
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true)
      return
    }
    callback(null, allowedCorsOrigins.has(origin.replace(/\/+$/, '')))
  },
}))
app.use(express.json({ limit: '2mb' }))
app.use('/uploads/avatars', express.static(avatarUploadDir))
app.use('/api', apiRateLimit)

app.get('/api/health', asyncHandler(async (request, response) => {
  const user = await store.authenticate(readBearerToken(request))
  if (!user) {
    response.json({ ok: true })
    return
  }

  const agentRuntime = getCodexRuntimeStatus()
  if (user.role !== 'admin') {
    response.json({
      ok: true,
      codex: agentRuntime,
      agent: agentRuntime,
    })
    return
  }

  response.json({
    ok: true,
    codex: agentRuntime,
    agent: agentRuntime,
    database: store.getStatus(),
    rag: getRagStatus(),
  })
}))

app.post(
  '/api/exercise-videos/search',
  authenticateRequest,
  asyncHandler(async (request, response) => {
    const text = String(request.body?.text ?? '').slice(0, 6000)
    response.json({ ok: true, ...buildExerciseVideoSearch(text) })
  }),
)

app.post(
  '/api/auth/register',
  authRateLimit,
  asyncHandler(async (request, response) => {
    const { username, password, confirmPassword, displayName } = request.body as Record<string, string>
    if (!confirmPassword || String(password ?? '') !== String(confirmPassword ?? '')) {
      response.status(400).json({ ok: false, error: '两次输入的密码不一致' })
      return
    }
    const bundle = await store.register(String(username ?? ''), String(password ?? ''), displayName)
    response.json({ ok: true, ...bundle })
  }),
)

app.post(
  '/api/auth/login',
  authRateLimit,
  asyncHandler(async (request, response) => {
    const { username, password } = request.body as Record<string, string>
    let bundle: Awaited<ReturnType<AppStore['login']>>
    try {
      bundle = await store.login(String(username ?? ''), String(password ?? ''))
    } catch (error) {
      const message = readableError(error)
      if (message.includes('等待管理员审批') || message.includes('注册申请已被拒绝')) {
        response.status(403).json({ ok: false, error: message })
        return
      }
      throw error
    }
    response.json({ ok: true, ...bundle })
  }),
)

app.get(
  '/api/auth/me',
  authenticateRequest,
  asyncHandler(async (request, response) => {
    const user = (request as AuthenticatedRequest).user
    const bundle = await store.getUserBundle(user.id)
    response.json({ ok: true, ...bundle })
  }),
)

app.patch(
  '/api/user/account',
  authenticateRequest,
  asyncHandler(async (request, response) => {
    const user = (request as AuthenticatedRequest).user
    const nextUser = await store.updateUserAccount(user.id, {
      displayName: request.body?.displayName,
      avatarUrl: request.body?.avatarUrl,
      currentPassword: request.body?.currentPassword,
      newPassword: request.body?.newPassword,
    })
    response.json({ ok: true, user: nextUser })
  }),
)

app.post(
  '/api/user/avatar',
  authenticateRequest,
  avatarUpload.single('avatar'),
  asyncHandler(async (request, response) => {
    if (!request.file) {
      response.status(400).json({ ok: false, error: '请上传头像图片' })
      return
    }

    response.json({
      ok: true,
      avatarUrl: `/uploads/avatars/${request.file.filename}`,
    })
  }),
)

app.get(
  '/api/user/state',
  authenticateRequest,
  asyncHandler(async (request, response) => {
    const user = (request as AuthenticatedRequest).user
    const bundle = await store.getUserBundle(user.id)
    response.json({ ok: true, state: bundle.state, chatMessages: bundle.chatMessages })
  }),
)

app.get(
  '/api/user/memories',
  authenticateRequest,
  asyncHandler(async (request, response) => {
    const user = (request as AuthenticatedRequest).user
    await store.refreshDerivedMemories(user.id)
    const memories = await store.getUserMemories(user.id)
    response.json({ ok: true, memories })
  }),
)

app.get(
  '/api/admin/overview',
  authenticateRequest,
  requireAdmin,
  asyncHandler(async (_request, response) => {
    response.json({ ok: true, overview: await store.getAdminOverview() })
  }),
)

app.get(
  '/api/admin/users',
  authenticateRequest,
  requireAdmin,
  asyncHandler(async (_request, response) => {
    response.json({ ok: true, users: await store.listAdminUsers(100) })
  }),
)

app.get(
  '/api/admin/users/:userId',
  authenticateRequest,
  requireAdmin,
  asyncHandler(async (request, response) => {
    response.json({ ok: true, user: await store.getAdminUserDetail(String(request.params.userId ?? '')) })
  }),
)

app.patch(
  '/api/admin/users/:userId/permissions',
  authenticateRequest,
  requireAdmin,
  asyncHandler(async (request, response) => {
    const user = await store.updateAdminUserPermissions(String(request.params.userId ?? ''), request.body?.permissions)
    response.json({ ok: true, user })
  }),
)

app.patch(
  '/api/admin/users/:userId/approval',
  authenticateRequest,
  requireAdmin,
  asyncHandler(async (request, response) => {
    const admin = (request as AuthenticatedRequest).user
    const user = await store.updateAdminUserRegistrationStatus(admin.id, String(request.params.userId ?? ''), request.body?.status)
    response.json({ ok: true, user })
  }),
)

app.get(
  '/api/admin/model-config',
  authenticateRequest,
  requireAdmin,
  asyncHandler(async (_request, response) => {
    response.json({ ok: true, config: await store.getAgentModelConfig() })
  }),
)

app.patch(
  '/api/admin/model-config',
  authenticateRequest,
  requireAdmin,
  asyncHandler(async (request, response) => {
    const admin = (request as AuthenticatedRequest).user
    const config = await store.setAgentModelConfig(request.body, admin.id)
    setRuntimeModelConfig(config)
    response.json({ ok: true, config })
  }),
)

app.post(
  '/api/admin/model-config/test',
  authenticateRequest,
  requireAdmin,
  adminModelTestRateLimit,
  asyncHandler(async (request, response) => {
    const result = await testAgentModelProvider(request.body?.provider ?? request.body)
    response.json({ ok: true, result })
  }),
)

app.delete(
  '/api/admin/users/:userId',
  authenticateRequest,
  requireAdmin,
  asyncHandler(async (request, response) => {
    const admin = (request as AuthenticatedRequest).user
    await store.deleteAdminUser(admin.id, String(request.params.userId ?? ''))
    response.json({
      ok: true,
      overview: await store.getAdminOverview(),
      users: await store.listAdminUsers(100),
    })
  }),
)

app.post(
  '/api/user/meals',
  authenticateRequest,
  asyncHandler(async (request, response) => {
    const user = (request as AuthenticatedRequest).user
    const meals = await store.appendMeal(user.id, request.body?.meal)
    response.json({ ok: true, meals })
  }),
)

app.delete(
  '/api/user/meals/:mealId',
  authenticateRequest,
  asyncHandler(async (request, response) => {
    const user = (request as AuthenticatedRequest).user
    const mealId = readNumber(request.params.mealId, Number.NaN)
    if (!Number.isFinite(mealId)) {
      response.status(400).json({ ok: false, error: '餐食记录 ID 无效' })
      return
    }
    const meals = await store.deleteMeal(user.id, mealId)
    response.json({ ok: true, meals })
  }),
)

app.post(
  '/api/agent/motion',
  authenticateRequest,
  uploadRateLimit,
  agentRateLimit,
  motionUpload.single('video'),
  asyncHandler(async (request, response) => {
    try {
      assertUploadFile(request.file, {
        label: '视频',
        required: true,
        allowedMimeTypes: motionMimeTypes,
        allowedExtensions: motionExtensions,
      })
    } catch (error) {
      await removeUpload(request.file?.path)
      response.status(400).json({ ok: false, error: readableError(error) })
      return
    }

    const payload: MotionPayload = {
      videoName: request.file?.originalname ?? String(request.body.videoName ?? '未命名视频'),
      videoFrames: parseImageDataUrls(request.body.videoFrames).slice(0, 4),
      activeCalories: readNumber(request.body.activeCalories, 0),
      eatenCalories: readNumber(request.body.eatenCalories, 0),
      calorieGoal: readNumber(request.body.calorieGoal, 2180),
    }

    try {
      const analysis = await analyzeMotion(payload)
      const user = (request as AuthenticatedRequest).user
      await store.saveUserState(user.id, { motionAnalysis: analysis })
      await store.recordTokenUsage(user.id, '动作分析', payload, analysis)
      response.json({ ok: true, analysis })
    } finally {
      await removeUpload(request.file?.path)
    }
  }),
)

app.post(
  '/api/agent/food',
  authenticateRequest,
  uploadRateLimit,
  agentRateLimit,
  foodUpload.single('image'),
  asyncHandler(async (request, response) => {
    if (request.file) {
      try {
        assertUploadFile(request.file, {
          label: '图片',
          required: false,
          allowedMimeTypes: foodMimeTypes,
          allowedExtensions: foodExtensions,
        })
      } catch (error) {
        await removeUpload(request.file?.path)
        response.status(400).json({ ok: false, error: readableError(error) })
        return
      }
    }

    const payload: FoodPayload = {
      foodName: String(request.body.foodName ?? '牛肉饭'),
      calorieGoal: readNumber(request.body.calorieGoal, 2180),
      activeCalories: readNumber(request.body.activeCalories, 0),
      eatenCalories: readNumber(request.body.eatenCalories, 0),
    }

    try {
      const analysis = await analyzeFood(payload, request.file?.path, request.file?.mimetype)
      const user = (request as AuthenticatedRequest).user
      await store.recordTokenUsage(user.id, '饮食识别', payload, analysis)
      response.json({ ok: true, analysis })
    } finally {
      await removeUpload(request.file?.path)
    }
  }),
)

app.post(
  '/api/agent/health-advice',
  authenticateRequest,
  agentRateLimit,
  asyncHandler(async (request, response) => {
    const body = request.body as Partial<HealthPayload>
    const payload: HealthPayload = {
      source: String(body.source ?? 'Apple 健康'),
      calorieGoal: readNumber(body.calorieGoal, 2180),
      workouts: Array.isArray(body.workouts) ? body.workouts : [],
      meals: Array.isArray(body.meals) ? body.meals : [],
    }
    const advice = await buildHealthAdvice(payload)
    const user = (request as AuthenticatedRequest).user
    await store.saveUserState(user.id, {
      source: payload.source,
      workouts: payload.workouts,
      healthAdvice: advice,
    })
    await store.recordTokenUsage(user.id, '健康建议', payload, advice)
    response.json({ ok: true, advice })
  }),
)

app.post(
  '/api/user/health-import',
  authenticateRequest,
  uploadRateLimit,
  agentRateLimit,
  healthImportUpload.single('healthExport'),
  asyncHandler(async (request, response) => {
    if (!request.file) {
      response.status(400).json({ ok: false, error: '请上传 Apple 健康导出的 export.xml 或 zip 文件' })
      return
    }

    try {
      assertUploadFile(request.file, {
        label: 'Apple 健康 export.xml 或 zip 文件',
        required: true,
        allowedMimeTypes: healthImportMimeTypes,
        allowedExtensions: healthImportExtensions,
      })
    } catch (error) {
      await removeUpload(request.file?.path)
      response.status(400).json({ ok: false, error: readableError(error) })
      return
    }

    try {
      const importResult = await parseAppleHealthExport(
        request.file.path,
        normalizeUploadedFileName(request.file.originalname),
        String(request.body.date ?? ''),
      )
      const meals = parseJsonArray(request.body.meals)
      const payload: HealthPayload = {
        source: importResult.summary.source,
        calorieGoal: readNumber(request.body.calorieGoal, 2180),
        workouts: importResult.workouts,
        meals,
      }
      const advice = await buildHealthAdvice(payload)
      const user = (request as AuthenticatedRequest).user
      await store.saveUserState(user.id, {
        source: payload.source,
        healthImport: importResult.healthImport,
        workouts: payload.workouts,
        healthAdvice: advice,
      })
      await store.recordTokenUsage(user.id, '健康导入', payload, advice)
      response.json({ ok: true, workouts: payload.workouts, advice, importSummary: importResult.summary })
    } finally {
      await removeUpload(request.file.path)
    }
  }),
)

app.post(
  '/api/user/health-query',
  authenticateRequest,
  agentRateLimit,
  asyncHandler(async (request, response) => {
    const user = (request as AuthenticatedRequest).user
    const bundle = await store.getUserBundle(user.id)
    const state = asRecord(bundle.state)
    const healthImport = normalizeStoredHealthImport(state?.healthImport)
    if (!healthImport) {
      response.status(400).json({ ok: false, error: '请先导入 Apple 健康全量数据' })
      return
    }

    const requestedDate = normalizeImportDate(request.body?.date) ?? healthImport.range.to
    const selectedDate = healthImport.daily[requestedDate] ? requestedDate : chooseStoredHealthDate(healthImport)
    const selectedDay = healthImport.daily[selectedDate]
    const workouts = selectedDay ? buildStoredHealthWorkouts(selectedDay) : []
    if (!selectedDay || !workouts.length) {
      response.status(400).json({ ok: false, error: `${requestedDate} 没有可查询的 Apple 健康数据` })
      return
    }

    const meals = getMealsForDate(state?.meals, selectedDate)
    const target = asRecord(state?.target)
    const payload: HealthPayload = {
      source: healthImport.source,
      calorieGoal: readNumber(request.body?.calorieGoal, readNumber(target?.calorieGoal, 2180)),
      workouts,
      meals,
    }
    const advice = await buildHealthAdvice(payload)
    const importSummary = buildStoredHealthImportSummary(healthImport, selectedDate, requestedDate)
    await store.saveUserState(user.id, {
      source: healthImport.source,
      workouts,
      healthAdvice: advice,
    })
    await store.recordTokenUsage(user.id, '健康查询', payload, advice)
    response.json({ ok: true, workouts, advice, importSummary })
  }),
)

app.post(
  '/api/agent/nutrition-target',
  authenticateRequest,
  agentRateLimit,
  asyncHandler(async (request, response) => {
    const body = request.body as Partial<ProfilePayload>
    const profile: ProfilePayload = {
      heightCm: readNumber(body.heightCm, 170),
      weightKg: readNumber(body.weightKg, 65),
      age: readNumber(body.age, 30),
      sex: body.sex === 'female' ? 'female' : 'male',
      activityLevel: body.activityLevel === 'high' || body.activityLevel === 'low' ? body.activityLevel : 'medium',
      goal: body.goal === 'fat_loss' || body.goal === 'muscle_gain' ? body.goal : 'maintain',
    }
    const target = calculateNutritionTarget(profile)
    const user = (request as AuthenticatedRequest).user
    await store.saveUserState(user.id, {
      profile: {
        heightCm: String(body.heightCm ?? ''),
        weightKg: String(body.weightKg ?? ''),
        age: String(body.age ?? ''),
        sex: profile.sex,
        activityLevel: profile.activityLevel,
        goal: profile.goal,
      },
      target,
    })
    await store.recordTokenUsage(user.id, '目标计算', profile, target)
    response.json({ ok: true, target })
  }),
)

app.get(
  '/api/agent/chat',
  authenticateRequest,
  asyncHandler(async (request, response) => {
    const user = (request as AuthenticatedRequest).user
    const thread = await store.getChatThread(user.id, readOptionalString(request.query.threadId))
    const chatMessages = await store.getChatMessages(user.id, thread.id)
    const chatThreads = await store.listChatThreads(user.id)
    response.json({ ok: true, thread, chatThreads, chatMessages })
  }),
)

app.get(
  '/api/agent/chat/agents',
  authenticateRequest,
  asyncHandler(async (_request, response) => {
    response.json({ ok: true, agents: chatAgents })
  }),
)

app.get(
  '/api/agent/chat/threads',
  authenticateRequest,
  asyncHandler(async (request, response) => {
    const user = (request as AuthenticatedRequest).user
    const chatThreads = await store.listChatThreads(user.id)
    response.json({ ok: true, chatThreads })
  }),
)

app.post(
  '/api/agent/chat/threads',
  authenticateRequest,
  asyncHandler(async (request, response) => {
    const user = (request as AuthenticatedRequest).user
    const result = await store.createChatThread(
      user.id,
      String(request.body?.agentId ?? 'general'),
      readOptionalString(request.body?.title),
    )
    response.json({ ok: true, ...result })
  }),
)

app.delete(
  '/api/agent/chat/threads/:threadId',
  authenticateRequest,
  asyncHandler(async (request, response) => {
    const user = (request as AuthenticatedRequest).user
    const threadId = readOptionalString(request.params.threadId)
    if (!threadId) {
      response.status(400).json({ ok: false, error: '对话 ID 无效' })
      return
    }
    const result = await store.deleteChatThread(user.id, threadId)
    response.json({ ok: true, ...result })
  }),
)

app.post('/api/agent/chat/stream', authenticateRequest, (request, response) => {
  agentRateLimit(request, response, () => {
    void handleChatStream(request as AuthenticatedRequest, response).catch((error: unknown) => {
      if (response.headersSent) {
        writeSse(response, 'error', { error: clientSafeErrorMessage(error) })
        response.end()
        return
      }

      const status = readClientErrorStatus(error) || 500
      response.status(status).json({ ok: false, error: clientSafeErrorMessage(error) })
    })
  })
})

app.delete(
  '/api/agent/chat',
  authenticateRequest,
  asyncHandler(async (request, response) => {
    const user = (request as AuthenticatedRequest).user
    const thread = await store.getChatThread(user.id, readOptionalString(request.query.threadId))
    const chatMessages = await store.clearChat(user.id, thread.id)
    const chatThreads = await store.listChatThreads(user.id)
    response.json({ ok: true, thread, chatThreads, chatMessages })
  }),
)

app.post(
  '/api/agent/chat',
  authenticateRequest,
  agentRateLimit,
  asyncHandler(async (request, response) => {
    const user = (request as AuthenticatedRequest).user
    const message = String(request.body?.message ?? '').trim()
    if (!message) {
      response.status(400).json({ ok: false, error: '请输入对话内容' })
      return
    }

    const thread = await resolveRequestThread(user.id, request.body?.threadId, request.body?.agentId)
    const userMessage = await store.appendChatMessage(user.id, thread.id, 'user', message)
    await Promise.all([store.rememberUserMessage(user.id, message), store.refreshDerivedMemories(user.id)])
    const [bundle, memories, ragContext] = await Promise.all([
      store.getUserBundle(user.id),
      store.getUserMemories(user.id),
      getRagContext(message),
    ])
    const answer = await chatWithAgent({
      user,
      message,
      state: bundle.state,
      history: bundle.chatMessages,
      memories,
      ragContext,
      agentId: thread.agentId,
    })
    const assistantMessage = await store.appendChatMessage(user.id, thread.id, 'assistant', answer.reply)
    await store.recordTokenUsage(user.id, 'Agent 对话', { message, agentId: thread.agentId, ragContext }, answer.reply)

    response.json({
      ok: true,
      mode: answer.mode,
      thread,
      messages: [userMessage, assistantMessage],
      chatThreads: await store.listChatThreads(user.id),
      chatMessages: await store.getChatMessages(user.id, thread.id),
    })
  }),
)

async function handleChatStream(request: AuthenticatedRequest, response: Response) {
  const user = request.user
  const message = String(request.body?.message ?? '').trim()
  if (!message) {
    response.status(400).json({ ok: false, error: '请输入对话内容' })
    return
  }

  response.status(200)
  response.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  response.setHeader('Cache-Control', 'no-cache, no-transform')
  response.setHeader('Connection', 'keep-alive')
  response.flushHeaders?.()

  const abortController = new AbortController()
  response.on('close', () => {
    if (!response.writableEnded) abortController.abort()
  })

  const thread = await resolveRequestThread(user.id, request.body?.threadId, request.body?.agentId)
  const userMessage = await store.appendChatMessage(user.id, thread.id, 'user', message)
  writeSse(response, 'user', { message: userMessage })
  writeSse(response, 'assistant_start', {
    message: {
      id: `stream-${crypto.randomUUID()}`,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
    },
  })

  await Promise.all([store.rememberUserMessage(user.id, message), store.refreshDerivedMemories(user.id)])
  const [bundle, memories, ragContext] = await Promise.all([
    store.getUserBundle(user.id),
    store.getUserMemories(user.id),
    getRagContext(message),
  ])

  const answer = await streamChatWithAgent(
    {
      user,
      message,
      state: bundle.state,
      history: bundle.chatMessages,
      memories,
      ragContext,
      agentId: thread.agentId,
    },
    {
      signal: abortController.signal,
      onStatus: (status) => writeSse(response, 'status', { status }),
      onDelta: (text) => writeSse(response, 'delta', { text }),
      onReplace: (text) => writeSse(response, 'replace', { text }),
    },
  )
  const assistantMessage = await store.appendChatMessage(user.id, thread.id, 'assistant', answer.reply)
  await store.recordTokenUsage(user.id, 'Agent 对话', { message, agentId: thread.agentId, ragContext }, answer.reply)

  writeSse(response, 'done', {
    mode: answer.mode,
    thread,
    message: assistantMessage,
    chatThreads: await store.listChatThreads(user.id),
    chatMessages: await store.getChatMessages(user.id, thread.id),
  })
  response.end()
}

async function getRagContext(query: string): Promise<RagChunk[]> {
  try {
    return await searchKnowledge(query)
  } catch (error) {
    console.error('[api] searchKnowledge failed, fallback to empty context:', readableError(error))
    return []
  }
}

const distDir = path.join(rootDir, 'dist')
app.use(express.static(distDir))

app.use((error: Error, _request: Request, response: Response, _next: NextFunction) => {
  void _next
  if (response.headersSent) return
  if (error instanceof multer.MulterError) {
    response.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
      ok: false,
      error: error.code === 'LIMIT_FILE_SIZE' ? '上传文件太大' : error.message,
    })
    return
  }
  const clientStatus = readClientErrorStatus(error)
  if (clientStatus) {
    response.status(clientStatus).json({ ok: false, error: clientSafeErrorMessage(error) })
    return
  }
  console.error('[server] request failed:', error)
  response.status(500).json({
    ok: false,
    error: clientSafeErrorMessage(error),
  })
})

app.listen(port, host, () => {
  console.log(`FitAgent API listening on http://${host}:${port}`)
})

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

const exerciseVideoTerms: Array<{ name: string; aliases: string[] }> = [
  { name: '罗马尼亚硬拉', aliases: ['罗马尼亚硬拉', 'rDL', 'rdl'] },
  { name: '保加利亚分腿蹲', aliases: ['保加利亚分腿蹲', '保加利亚蹲'] },
  { name: '深蹲', aliases: ['深蹲', '杠铃深蹲', '高脚杯深蹲', '蹲起', 'squat'] },
  { name: '硬拉', aliases: ['硬拉', 'deadlift'] },
  { name: '弓步蹲', aliases: ['弓步蹲', '箭步蹲', '弓箭步', 'lunge'] },
  { name: '俯卧撑', aliases: ['俯卧撑', 'push up', 'push-up'] },
  { name: '卧推', aliases: ['卧推', 'bench press'] },
  { name: '划船', aliases: ['划船', '哑铃划船', '杠铃划船', 'row'] },
  { name: '引体向上', aliases: ['引体向上', '引体', 'pull up', 'pull-up'] },
  { name: '平板支撑', aliases: ['平板支撑', 'plank'] },
  { name: '臀桥', aliases: ['臀桥', '臀推', 'hip thrust', 'glute bridge'] },
  { name: '肩推', aliases: ['肩推', '推举', 'overhead press', 'shoulder press'] },
  { name: '侧平举', aliases: ['侧平举', '哑铃侧平举', 'lateral raise'] },
  { name: '卷腹', aliases: ['卷腹', '仰卧卷腹', 'crunch'] },
  { name: '俄罗斯转体', aliases: ['俄罗斯转体', 'russian twist'] },
  { name: '波比跳', aliases: ['波比跳', 'burpee'] },
  { name: '跳绳', aliases: ['跳绳', 'jump rope'] },
  { name: '跑步', aliases: ['跑步', '慢跑', '配速跑', 'running'] },
]

function buildExerciseVideoSearch(text: string): ExerciseVideoSearch {
  const exercises = detectExerciseNames(text)
  const query = exercises.length ? `${exercises.join(' ')} 标准动作 教学` : ''
  const results = exercises.flatMap(buildExerciseVideoResults).slice(0, 8)

  return { query, exercises, results }
}

function detectExerciseNames(text: string) {
  const normalized = text.toLowerCase()
  const matched: string[] = []

  for (const term of exerciseVideoTerms) {
    if (matched.includes(term.name)) continue
    if (matched.some((exercise) => exercise !== term.name && exercise.includes(term.name))) continue
    if (term.aliases.some((alias) => normalized.includes(alias.toLowerCase()))) {
      matched.push(term.name)
    }
  }

  return matched.slice(0, 4)
}

function buildExerciseVideoResults(exercise: string): ExerciseVideoResult[] {
  const tutorialQuery = `${exercise} 标准动作 教学 视频`
  const mistakeQuery = `${exercise} 常见错误 纠正 视频`
  const slug = encodeURIComponent(exercise)

  return [
    {
      id: `${slug}-bilibili-tutorial`,
      title: `${exercise} 标准动作教学`,
      source: '哔哩哔哩',
      description: '动作演示和训练节奏',
      url: `https://search.bilibili.com/all?keyword=${encodeURIComponent(tutorialQuery)}`,
    },
    {
      id: `${slug}-bilibili-fix`,
      title: `${exercise} 常见错误纠正`,
      source: '哔哩哔哩',
      description: '发力路线和动作细节',
      url: `https://search.bilibili.com/all?keyword=${encodeURIComponent(mistakeQuery)}`,
    },
    {
      id: `${slug}-youtube`,
      title: `${exercise} tutorial`,
      source: 'YouTube',
      description: '英文动作教程搜索',
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(tutorialQuery)}`,
    },
    {
      id: `${slug}-baidu-video`,
      title: `${exercise} 视频搜索`,
      source: '百度',
      description: '中文网页视频结果',
      url: `https://www.baidu.com/s?wd=${encodeURIComponent(tutorialQuery)}`,
    },
  ]
}

type AppleHealthWorkout = {
  name: string
  minutes: number
  calories: number
  intensity: string
  date: string
  startTime?: string
  endTime?: string
  distance?: number
  distanceUnit?: string
  steps?: number
  device?: string
  source: string
  importedAt: string
}

type AppleHealthDay = {
  date: string
  steps: number
  activeCalories: number
  exerciseMinutes: number
  recordCount: number
  workouts: AppleHealthWorkout[]
}

type StoredAppleHealthDay = {
  date: string
  records: number
  workouts: number
  workoutNames: string[]
  workoutDetails: AppleHealthWorkout[]
  steps: number
  activeCalories: number
  exerciseMinutes: number
}

type StoredAppleHealthImport = {
  source: string
  fileName: string
  importedAt: string
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
  daily: Record<string, StoredAppleHealthDay>
}

type AppleHealthImportSummary = {
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
  daily: Record<string, StoredAppleHealthDay>
  selectedDay: {
    date: string
    records: number
    workouts: number
    workoutDetails: AppleHealthWorkout[]
    steps: number
    activeCalories: number
    exerciseMinutes: number
  }
}

async function parseAppleHealthExport(filePath: string, originalName: string, preferredDateValue: string) {
  const xml = await readAppleHealthXml(filePath, originalName)
  const days = new Map<string, AppleHealthDay>()
  let records = 0

  for (const match of xml.matchAll(/<Record\b([^>]*)\/?>/g)) {
    const attributes = readXmlAttributes(match[1] ?? '')
    const date = readAppleHealthDateKey(attributes.startDate || attributes.endDate || attributes.creationDate)
    if (!date) continue

    const day = getAppleHealthDay(days, date)
    const value = readNumber(attributes.value, 0)
    const unit = attributes.unit ?? ''
    const type = attributes.type ?? ''

    if (type === 'HKQuantityTypeIdentifierStepCount') {
      day.steps += value
      day.recordCount += 1
      records += 1
    } else if (type === 'HKQuantityTypeIdentifierActiveEnergyBurned') {
      day.activeCalories += normalizeAppleEnergy(value, unit)
      day.recordCount += 1
      records += 1
    } else if (type === 'HKQuantityTypeIdentifierAppleExerciseTime') {
      day.exerciseMinutes += normalizeAppleDuration(value, unit)
      day.recordCount += 1
      records += 1
    }
  }

  for (const match of xml.matchAll(/<Workout\b([^>]*)>/g)) {
    const attributes = readXmlAttributes(match[1] ?? '')
    const date = readAppleHealthDateKey(attributes.startDate || attributes.endDate || attributes.creationDate)
    if (!date) continue

    const day = getAppleHealthDay(days, date)
    const calories = normalizeAppleEnergy(readNumber(attributes.totalEnergyBurned, 0), attributes.totalEnergyBurnedUnit ?? 'kcal')
    const minutes = normalizeAppleDuration(readNumber(attributes.duration, 0), attributes.durationUnit ?? 'min')
    const distance = normalizeAppleDistance(readNumber(attributes.totalDistance, 0), attributes.totalDistanceUnit ?? '')
    day.workouts.push({
      name: normalizeAppleWorkoutName(attributes.workoutActivityType ?? 'HKWorkoutActivityTypeOther'),
      minutes: Math.round(minutes),
      calories: Math.round(calories),
      intensity: inferWorkoutIntensity(minutes, calories),
      date,
      startTime: readAppleHealthDateTime(attributes.startDate),
      endTime: readAppleHealthDateTime(attributes.endDate),
      distance: distance > 0 ? Number(distance.toFixed(2)) : undefined,
      distanceUnit: distance > 0 ? 'km' : undefined,
      device: attributes.sourceName,
      source: 'Apple 健康导入',
      importedAt: new Date().toISOString(),
    })
  }

  const activeDays = Array.from(days.values()).filter(hasAppleHealthDayData)
  const orderedDates = activeDays.map((day) => day.date)
    .sort()
  if (!activeDays.length || !orderedDates.length) {
    throw new Error('没有从 Apple 健康文件中解析到可导入的步数、活动能量或运动记录')
  }
  const totals = activeDays.reduce(
    (sum, day) => ({
      steps: sum.steps + day.steps,
      activeCalories: sum.activeCalories + day.activeCalories,
      exerciseMinutes: sum.exerciseMinutes + day.exerciseMinutes,
      workouts: sum.workouts + day.workouts.length,
      records: sum.records + day.recordCount,
    }),
    { steps: 0, activeCalories: 0, exerciseMinutes: 0, workouts: 0, records: 0 },
  )
  const importedAt = new Date().toISOString()
  const healthImport: StoredAppleHealthImport = {
    source: 'Apple 健康导入',
    fileName: originalName,
    importedAt,
    range: {
      from: orderedDates[0],
      to: orderedDates.at(-1) ?? orderedDates[0],
    },
    days: activeDays.length,
    records,
    workouts: totals.workouts,
    steps: Math.round(totals.steps),
    activeCalories: Math.round(totals.activeCalories),
    exerciseMinutes: Math.round(totals.exerciseMinutes),
    daily: Object.fromEntries(activeDays.map((day) => [day.date, toStoredAppleHealthDay(day)])),
  }
  const selectedDate = chooseStoredHealthDate(healthImport, preferredDateValue)
  const selectedDay = healthImport.daily[selectedDate]
  const workouts = selectedDay ? buildStoredHealthWorkouts(selectedDay) : []
  if (!selectedDay || !workouts.length) {
    throw new Error(`${selectedDate} 没有可导入的健康数据，请换一个日期或上传更新的 Apple 健康导出文件`)
  }
  const requestedDate = normalizeImportDate(preferredDateValue)
  const summary = buildStoredHealthImportSummary(healthImport, selectedDate, requestedDate)

  return { healthImport, workouts, summary }
}

async function readAppleHealthXml(filePath: string, originalName: string) {
  const buffer = await fs.readFile(filePath)
  assertHealthXmlSize(buffer.length, originalName)
  const isZip = originalName.toLowerCase().endsWith('.zip') || buffer.subarray(0, 2).toString('utf8') === 'PK'
  if (!isZip) {
    const xml = buffer.toString('utf8')
    if (isAppleHealthDataXml(xml)) return xml
    if (xml.includes('<ClinicalDocument')) {
      throw new Error('这个文件是 export_cda.xml 临床文档，请上传同目录里的 导出.xml，或上传完整 Apple 健康 zip')
    }
    throw new Error('这个 XML 不是 Apple 健康 HealthData 导出文件')
  }

  const zip = await JSZip.loadAsync(buffer)
  const xmlFiles = Object.values(zip.files)
    .filter((file) => !file.dir && file.name.toLowerCase().endsWith('.xml'))
    .sort((left, right) => rankAppleHealthXmlFile(left.name) - rankAppleHealthXmlFile(right.name))

  for (const file of xmlFiles) {
    const entrySize = readZipEntryUncompressedSize(file)
    if (entrySize > 0) assertHealthXmlSize(entrySize, file.name)
    const xml = await file.async('string')
    assertHealthXmlSize(Buffer.byteLength(xml, 'utf8'), file.name)
    if (isAppleHealthDataXml(xml)) return xml
  }

  const names = xmlFiles
    .slice(0, 6)
    .map((file) => file.name)
    .join('、')
  throw new Error(names ? `这个 zip 中没有找到 Apple 健康 HealthData XML；找到的 XML：${names}` : '这个 zip 中没有找到 XML 文件')
}

function rankAppleHealthXmlFile(name: string) {
  const normalized = name.toLowerCase()
  if (normalized.endsWith('/export.xml') || normalized === 'export.xml') return 0
  if (name.endsWith('/导出.xml') || name === '导出.xml') return 1
  if (normalized.includes('cda')) return 20
  return 10
}

function isAppleHealthDataXml(xml: string) {
  return xml.includes('<HealthData') && xml.includes('HKQuantityTypeIdentifier')
}

function readXmlAttributes(input: string) {
  const attributes: Record<string, string> = {}
  for (const match of input.matchAll(/([A-Za-z][A-Za-z0-9]*)="([^"]*)"/g)) {
    attributes[match[1]] = decodeXmlAttribute(match[2] ?? '')
  }
  return attributes
}

function decodeXmlAttribute(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function getAppleHealthDay(days: Map<string, AppleHealthDay>, date: string) {
  const current = days.get(date)
  if (current) return current

  const created: AppleHealthDay = {
    date,
    steps: 0,
    activeCalories: 0,
    exerciseMinutes: 0,
    recordCount: 0,
    workouts: [],
  }
  days.set(date, created)
  return created
}

function readAppleHealthDateKey(value?: string) {
  const match = value?.match(/^(\d{4}-\d{2}-\d{2})/)
  return match?.[1] ?? ''
}

function normalizeImportDate(value: unknown) {
  const text = typeof value === 'string' ? value.trim() : ''
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : undefined
}

function hasAppleHealthDayData(day: AppleHealthDay) {
  return day.steps > 0 || day.activeCalories > 0 || day.exerciseMinutes > 0 || day.workouts.length > 0
}

function toStoredAppleHealthDay(day: AppleHealthDay): StoredAppleHealthDay {
  const workoutDetails = [...day.workouts].sort((left, right) => readSortableDate(left.startTime) - readSortableDate(right.startTime))
  return {
    date: day.date,
    records: day.recordCount,
    workouts: workoutDetails.length,
    workoutNames: Array.from(new Set(workoutDetails.map((workout) => workout.name).filter(Boolean))).slice(0, 8),
    workoutDetails,
    steps: Math.round(day.steps),
    activeCalories: Math.round(day.activeCalories),
    exerciseMinutes: Math.round(day.exerciseMinutes || day.workouts.reduce((sum, workout) => sum + workout.minutes, 0)),
  }
}

function buildStoredHealthImportSummary(
  healthImport: StoredAppleHealthImport,
  selectedDate: string,
  requestedDate?: string,
): AppleHealthImportSummary {
  const selectedDay = healthImport.daily[selectedDate] ?? emptyStoredAppleHealthDay(selectedDate)
  const workouts = buildStoredHealthWorkouts(selectedDay)
  return {
    source: healthImport.source,
    fileName: healthImport.fileName,
    requestedDate,
    selectedDate,
    fallbackToLatest: Boolean(requestedDate && requestedDate !== selectedDate),
    range: healthImport.range,
    days: healthImport.days,
    records: healthImport.records,
    workouts: healthImport.workouts,
    steps: healthImport.steps,
    activeCalories: healthImport.activeCalories,
    exerciseMinutes: healthImport.exerciseMinutes,
    daily: healthImport.daily,
    selectedDay: {
      date: selectedDate,
      records: selectedDay.records,
      workouts: selectedDay.workouts,
      workoutDetails: workouts,
      steps: selectedDay.steps,
      activeCalories: selectedDay.activeCalories || workouts.reduce((sum, workout) => sum + workout.calories, 0),
      exerciseMinutes: selectedDay.exerciseMinutes || workouts.reduce((sum, workout) => sum + workout.minutes, 0),
    },
  }
}

function buildStoredHealthWorkouts(day: StoredAppleHealthDay): AppleHealthWorkout[] {
  if (day.workoutDetails.length) return day.workoutDetails

  const importedAt = new Date().toISOString()
  const workoutNames = day.workoutNames
    .slice(0, 3)
    .join('、')
  if (day.activeCalories > 0 || day.exerciseMinutes > 0 || day.steps > 0) {
    const calories = day.activeCalories > 0 ? day.activeCalories : estimateCaloriesFromSteps(day.steps)
    return [
      {
        name: 'Apple 健康查询结果',
        minutes: Math.round(day.exerciseMinutes),
        calories: Math.round(calories),
        intensity: [day.steps ? `${Math.round(day.steps)} 步` : '', workoutNames ? `运动：${workoutNames}` : '日常活动']
          .filter(Boolean)
          .join(' · '),
        date: day.date,
        steps: Math.round(day.steps),
        source: 'Apple 健康导入',
        importedAt,
      },
    ]
  }

  return []
}

function chooseStoredHealthDate(healthImport: StoredAppleHealthImport, preferredDateValue?: unknown) {
  const preferredDate = normalizeImportDate(preferredDateValue)
  if (preferredDate && healthImport.daily[preferredDate]) return preferredDate
  return healthImport.range.to
}

function normalizeStoredHealthImport(value: unknown): StoredAppleHealthImport | null {
  const record = asRecord(value)
  const range = asRecord(record?.range)
  const daily = asRecord(record?.daily)
  if (!record || !range || !daily) return null

  const normalizedDaily = Object.fromEntries(
    Object.entries(daily)
      .map(([date, day]) => {
        const normalized = normalizeStoredAppleHealthDay(day, date)
        return normalized ? [date, normalized] : null
      })
      .filter((entry): entry is [string, StoredAppleHealthDay] => Boolean(entry)),
  )
  const dates = Object.keys(normalizedDaily).sort()
  if (!dates.length) return null

  return {
    source: readText(record.source) || 'Apple 健康导入',
    fileName: readText(record.fileName) || 'Apple 健康导出',
    importedAt: readText(record.importedAt) || new Date().toISOString(),
    range: {
      from: normalizeImportDate(range.from) ?? dates[0],
      to: normalizeImportDate(range.to) ?? dates.at(-1) ?? dates[0],
    },
    days: readNumber(record.days, dates.length),
    records: readNumber(record.records, 0),
    workouts: readNumber(record.workouts, 0),
    steps: readNumber(record.steps, 0),
    activeCalories: readNumber(record.activeCalories, 0),
    exerciseMinutes: readNumber(record.exerciseMinutes, 0),
    daily: normalizedDaily,
  }
}

function normalizeStoredAppleHealthDay(value: unknown, fallbackDate: string) {
  const record = asRecord(value)
  if (!record) return null
  const date = normalizeImportDate(record.date) ?? normalizeImportDate(fallbackDate)
  if (!date) return null
  const workoutDetails = readArray(record.workoutDetails)
    .map((item) => normalizeStoredAppleWorkout(item, date))
    .filter((item): item is AppleHealthWorkout => Boolean(item))
  const workoutNames = readArray(record.workoutNames)
    .map((item) => readText(item))
    .filter(Boolean)
    .slice(0, 8)
  const namesFromDetails = Array.from(new Set(workoutDetails.map((workout) => workout.name).filter(Boolean))).slice(0, 8)
  return {
    date,
    records: readNumber(record.records, 0),
    workouts: Math.max(readNumber(record.workouts, 0), workoutDetails.length),
    workoutNames: workoutNames.length ? workoutNames : namesFromDetails,
    workoutDetails,
    steps: readNumber(record.steps, 0),
    activeCalories: readNumber(record.activeCalories, 0),
    exerciseMinutes: readNumber(record.exerciseMinutes, 0),
  }
}

function normalizeStoredAppleWorkout(value: unknown, fallbackDate: string): AppleHealthWorkout | null {
  const record = asRecord(value)
  if (!record) return null
  const date = normalizeImportDate(record.date) ?? fallbackDate
  const minutes = Math.round(readNumber(record.minutes, 0))
  const calories = Math.round(readNumber(record.calories, 0))
  const distance = readNumber(record.distance, 0)
  return {
    name: readText(record.name) || '运动记录',
    minutes,
    calories,
    intensity: readText(record.intensity) || inferWorkoutIntensity(minutes, calories),
    date,
    startTime: readText(record.startTime) || undefined,
    endTime: readText(record.endTime) || undefined,
    distance: distance > 0 ? Number(distance.toFixed(2)) : undefined,
    distanceUnit: readText(record.distanceUnit) || (distance > 0 ? 'km' : undefined),
    steps: readNumber(record.steps, 0) > 0 ? Math.round(readNumber(record.steps, 0)) : undefined,
    device: readText(record.device) || undefined,
    source: readText(record.source) || 'Apple 健康导入',
    importedAt: readText(record.importedAt) || new Date().toISOString(),
  }
}

function emptyStoredAppleHealthDay(date: string): StoredAppleHealthDay {
  return {
    date,
    records: 0,
    workouts: 0,
    workoutNames: [],
    workoutDetails: [],
    steps: 0,
    activeCalories: 0,
    exerciseMinutes: 0,
  }
}

function getMealsForDate(value: unknown, date: string) {
  return readArray(value).filter((meal) => asRecord(meal)?.date === date)
}

function normalizeAppleEnergy(value: number, unit: string) {
  if (unit.toLowerCase() === 'kj') return value * 0.239006
  return value
}

function normalizeAppleDuration(value: number, unit: string) {
  const normalized = unit.toLowerCase()
  if (normalized === 's' || normalized === 'sec' || normalized === 'second') return value / 60
  if (normalized === 'h' || normalized === 'hr' || normalized === 'hour') return value * 60
  return value
}

function normalizeAppleDistance(value: number, unit: string) {
  if (value <= 0) return 0
  const normalized = unit.toLowerCase()
  if (normalized === 'm' || normalized === 'meter' || normalized === 'meters') return value / 1000
  if (normalized === 'mi' || normalized === 'mile' || normalized === 'miles') return value * 1.60934
  if (normalized === 'yd' || normalized === 'yard' || normalized === 'yards') return value * 0.0009144
  return value
}

function readAppleHealthDateTime(value?: string) {
  const text = readText(value)
  const match = text.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+([+-]\d{2})(\d{2})$/)
  if (match) return `${match[1]}T${match[2]}${match[3]}:${match[4]}`
  return text || undefined
}

function readSortableDate(value?: string) {
  const time = value ? new Date(value).getTime() : Number.NaN
  return Number.isFinite(time) ? time : 0
}

function normalizeAppleWorkoutName(type: string) {
  const normalized = type.replace('HKWorkoutActivityType', '')
  const names: Record<string, string> = {
    Running: '跑步',
    Walking: '步行',
    Cycling: '骑行',
    TraditionalStrengthTraining: '力量训练',
    FunctionalStrengthTraining: '功能力量训练',
    HighIntensityIntervalTraining: 'HIIT',
    CoreTraining: '核心训练',
    Yoga: '瑜伽',
    Swimming: '游泳',
    Hiking: '徒步',
    Elliptical: '椭圆机',
    Rowing: '划船',
    StairClimbing: '爬楼梯',
    Dance: '舞蹈',
    Other: '运动记录',
  }
  return names[normalized] ?? (normalized || '运动记录')
}

function inferWorkoutIntensity(minutes: number, calories: number) {
  if (minutes <= 0) return '未记录强度'
  const caloriesPerMinute = calories / minutes
  if (caloriesPerMinute >= 8) return '高强度'
  if (caloriesPerMinute >= 5) return '中高强度'
  if (caloriesPerMinute >= 3) return '中等强度'
  return '低强度'
}

function estimateCaloriesFromSteps(steps: number) {
  return Math.round(Math.max(0, steps) * 0.04)
}

function parseJsonArray(value: unknown) {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function parseImageDataUrls(value: unknown) {
  return parseJsonArray(value)
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => /^data:image\/(?:jpeg|jpg|png|webp);base64,[a-z0-9+/=\s]+$/i.test(item))
}

function createUpload(config: {
  label: string
  allowedMimeTypes: string[]
  allowedExtensions: string[]
  fileSizeMb: number
}) {
  return multer({
    dest: uploadDir,
    limits: {
      fileSize: config.fileSizeMb * 1024 * 1024,
    },
    fileFilter: (_request, file, callback) => {
      try {
        assertUploadFile(file, {
          label: config.label,
          required: true,
          allowedMimeTypes: config.allowedMimeTypes,
          allowedExtensions: config.allowedExtensions,
        })
        callback(null, true)
      } catch (error) {
        callback(error instanceof Error ? error : new Error(readableError(error)))
      }
    },
  })
}

function securityHeaders(_request: Request, response: Response, next: NextFunction) {
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Referrer-Policy', 'no-referrer')
  response.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=()')
  response.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https: http:",
      "media-src 'self' blob:",
      "connect-src 'self'",
    ].join('; '),
  )
  if (process.env.ENABLE_HSTS === 'true') {
    response.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains')
  }
  next()
}

function createRateLimit(config: { windowMs: number; max: number; keyPrefix: string }) {
  const buckets = new Map<string, { count: number; resetAt: number }>()
  return (request: Request, response: Response, next: NextFunction) => {
    const now = Date.now()
    const key = `${config.keyPrefix}:${readClientAddress(request)}`
    const current = buckets.get(key)
    const bucket = current && current.resetAt > now ? current : { count: 0, resetAt: now + config.windowMs }
    bucket.count += 1
    buckets.set(key, bucket)

    if (bucket.count > config.max) {
      response.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)))
      response.status(429).json({ ok: false, error: '请求过于频繁，请稍后再试' })
      return
    }

    if (buckets.size > 5000) {
      for (const [bucketKey, value] of buckets) {
        if (value.resetAt <= now) buckets.delete(bucketKey)
      }
    }

    next()
  }
}

function readClientAddress(request: Request) {
  return request.ip || request.socket.remoteAddress || 'unknown'
}

function asyncHandler(handler: (request: Request, response: Response) => Promise<void>) {
  return (request: Request, response: Response, next: NextFunction) => {
    handler(request, response).catch(next)
  }
}

type AuthenticatedRequest = Request & {
  user: PublicUser
}

async function authenticateRequest(request: Request, response: Response, next: NextFunction) {
  try {
    const user = await store.authenticate(readBearerToken(request))
    if (!user) {
      response.status(401).json({ ok: false, error: '请先登录' })
      return
    }
    ;(request as AuthenticatedRequest).user = user
    next()
  } catch (error) {
    next(error)
  }
}

function requireAdmin(request: Request, response: Response, next: NextFunction) {
  const user = (request as AuthenticatedRequest).user
  if (user.role !== 'admin') {
    response.status(403).json({ ok: false, error: '需要管理员权限' })
    return
  }
  next()
}

function readBearerToken(request: Request) {
  const header = request.headers.authorization
  if (!header?.startsWith('Bearer ')) return undefined
  return header.slice('Bearer '.length).trim()
}

function normalizeUploadedFileName(fileName: string) {
  const decoded = Buffer.from(fileName, 'latin1').toString('utf8')
  return /[\u4e00-\u9fff]/.test(decoded) ? decoded : fileName
}

function assertUploadFile(
  file: { mimetype?: string; originalname?: string } | undefined,
  config: {
    label: string
    required: boolean
    allowedMimeTypes: string[]
    allowedExtensions: string[]
  },
) {
  if (!file) {
    if (config.required) {
      throw new Error(`请上传${config.label}`)
    }
    return
  }

  const mime = (file.mimetype || '').toLowerCase()
  const rawFileName = file.originalname || ''
  const extension = rawFileName.includes('.') ? rawFileName.slice(rawFileName.lastIndexOf('.')).toLowerCase() : ''

  if (!isUploadFileAllowed(mime, extension, config.allowedMimeTypes, config.allowedExtensions)) {
    const extensions = config.allowedExtensions.join('、')
    throw new Error(`${config.label}格式不支持（当前只支持：${extensions}）`)
  }
}

function isUploadFileAllowed(mime: string, extension: string, allowedMimeTypes: string[], allowedExtensions: string[]) {
  if (!allowedExtensions.includes(extension)) return false
  if (allowedMimeTypes.includes(mime)) return true
  return mime === 'application/octet-stream' && allowedMimeTypes.includes('application/octet-stream')
}

function readZipEntryUncompressedSize(file: JSZip.JSZipObject) {
  const internal = file as unknown as { _data?: { uncompressedSize?: unknown } }
  return readNumber(internal._data?.uncompressedSize, 0)
}

function assertHealthXmlSize(byteLength: number, label: string) {
  if (byteLength > maxHealthXmlBytes) {
    throw new Error(`${label} 超过健康导入解析上限，请拆分导出文件或调高 MAX_HEALTH_XML_MB`)
  }
}

function readPositiveInteger(value: unknown, fallback: number) {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : fallback
}

function readNumber(value: unknown, fallback: number) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function readText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function readArray(value: unknown) {
  return Array.isArray(value) ? value : []
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function readOptionalString(value: unknown) {
  if (Array.isArray(value)) return readOptionalString(value[0])
  const text = typeof value === 'string' ? value.trim() : ''
  return text || undefined
}

async function resolveRequestThread(userId: string, threadIdValue: unknown, agentIdValue: unknown) {
  const threadId = readOptionalString(threadIdValue)
  if (threadId) return store.getChatThread(userId, threadId)

  const agentId = readOptionalString(agentIdValue)
  if (agentId) {
    const created = await store.createChatThread(userId, agentId)
    return created.thread
  }

  return store.getChatThread(userId)
}

async function removeUpload(filePath?: string) {
  if (!filePath) return
  try {
    await fs.unlink(filePath)
  } catch {
    // Temporary upload cleanup is best-effort.
  }
}

function writeSse(response: Response, event: string, data: unknown) {
  if (response.writableEnded) return
  response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  ;(response as Response & { flush?: () => void }).flush?.()
}

function readableError(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function clientSafeErrorMessage(error: unknown) {
  if (isInvalidJsonBody(error)) return '请求体不是有效 JSON'
  if (readClientErrorStatus(error)) return readableError(error)
  return isProduction ? '服务器内部错误' : readableError(error)
}

function readClientErrorStatus(error: unknown) {
  const status = readHttpErrorStatus(error)
  if (status >= 400 && status < 500) return status
  const message = readableError(error)
  if (isInvalidJsonBody(error)) return 400
  if (isKnownClientErrorMessage(message)) return 400
  return 0
}

function readHttpErrorStatus(error: unknown) {
  const record = asRecord(error)
  const status = Number(record?.status ?? record?.statusCode)
  return Number.isInteger(status) ? status : 0
}

function isInvalidJsonBody(error: unknown) {
  const record = asRecord(error)
  return record?.type === 'entity.parse.failed' || error instanceof SyntaxError
}

function isKnownClientErrorMessage(message: string) {
  return [
    /^用户名/,
    /^密码/,
    /^昵称/,
    /^头像/,
    /^当前密码/,
    /^用户名已存在$/,
    /^审批状态无效$/,
    /^餐食记录无效$/,
    /^对话不存在$/,
    /^用户不存在$/,
    /^不能/,
    /^请上传/,
    /格式不支持/,
    /^这个/,
    /^没有从/,
    /没有可导入/,
    /超过健康导入解析上限/,
  ].some((pattern) => pattern.test(message))
}

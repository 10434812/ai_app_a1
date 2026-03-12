import {Op} from 'sequelize'
import {MediaTask} from '../../models/MediaTask.ts'
import {User} from '../../models/User.ts'
import {
  calculateImageCost,
  estimateTextTokens,
  getBillingConfig,
} from '../billingConfigService.ts'
import {generateImage} from './imageService.ts'
import {recordTokenUsage} from '../tokenService.ts'
import {captureError, metricCounters} from '../observabilityService.ts'
import redisClient from '../../config/redis.ts'

export interface CreateImageTaskInput {
  userId: string
  prompt: string
  provider?: 'aliyun' | 'zhipu' | 'siliconflow'
  model?: string
  size?: string
  n?: number
  modelId?: string
}

export interface CreateVideoTaskInput {
  userId: string
  prompt: string
  provider?: string
  model?: string
  size?: string
  n?: number
  modelId?: string
}

type TaskResultPayload =
  | {
      provider: 'aliyun' | 'zhipu'
      | 'siliconflow'
      model: string
      size: string
      n: number
      images: string[]
      requestId?: string
      generatedAt: string
      tokenCost: number
    }
  | {
      message: string
    }

const parseTaskMeta = (raw: string | null): Record<string, any> => {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return parsed
    return {}
  } catch {
    return {}
  }
}

export interface MediaTaskView {
  id: string
  type: 'image' | 'video'
  status: 'pending' | 'processing' | 'retrying' | 'succeeded' | 'failed'
  provider: string | null
  model: string | null
  prompt: string
  size: string | null
  n: number
  attempts: number
  maxAttempts: number
  estimatedCost: number
  actualCost: number | null
  errorCode: string | null
  errorMessage: string | null
  nextRetryAt: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
  result?: TaskResultPayload
}

const WORKER_LOCK_KEY = 'media-task-worker:lock'
const WORKER_LOCK_SECONDS = 10
const POLL_INTERVAL_MS = 1200
const MAX_TASKS_PER_TICK = 2

let workerStarted = false
let tickInProgress = false
let timer: NodeJS.Timeout | null = null

const parseTaskResult = (raw: string | null): TaskResultPayload | undefined => {
  if (!raw) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

export const toMediaTaskView = (task: MediaTask): MediaTaskView => ({
  id: task.id,
  type: task.type,
  status: task.status,
  provider: task.provider,
  model: task.model,
  prompt: task.prompt,
  size: task.size,
  n: task.n,
  attempts: Number(task.attempts || 0),
  maxAttempts: Number(task.maxAttempts || 0),
  estimatedCost: Number(task.estimatedCost || 0),
  actualCost: task.actualCost == null ? null : Number(task.actualCost),
  errorCode: task.errorCode,
  errorMessage: task.errorMessage,
  nextRetryAt: task.nextRetryAt ? new Date(task.nextRetryAt).toISOString() : null,
  startedAt: task.startedAt ? new Date(task.startedAt).toISOString() : null,
  completedAt: task.completedAt ? new Date(task.completedAt).toISOString() : null,
  createdAt: new Date(task.createdAt).toISOString(),
  updatedAt: new Date(task.updatedAt).toISOString(),
  result: parseTaskResult(task.result),
})

const classifyTaskError = (error: unknown) => {
  const message = String((error as any)?.message || '').trim()
  const lower = message.toLowerCase()

  if (message.includes('Insufficient balance')) {
    return {
      code: 'INSUFFICIENT_BALANCE',
      message: 'Token余额不足，任务失败',
      retryable: false,
    }
  }

  if (lower.includes('api key') && (lower.includes('未配置') || lower.includes('missing'))) {
    return {
      code: 'CONFIG_MISSING',
      message: message || '图片 API Key 未配置',
      retryable: false,
    }
  }

  if (message.includes('Prompt is required')) {
    return {
      code: 'INVALID_PROMPT',
      message: '提示词不能为空',
      retryable: false,
    }
  }

  if (message.includes('视频生成功能')) {
    return {
      code: 'VIDEO_NOT_IMPLEMENTED',
      message,
      retryable: false,
    }
  }

  return {
    code: 'PROVIDER_ERROR',
    message: message || '媒体任务执行失败',
    retryable: true,
  }
}

const calcBackoffMs = (attempt: number) => {
  const safeAttempt = Math.max(1, attempt)
  return Math.min(120_000, Math.pow(2, safeAttempt) * 2000)
}

const acquireWorkerLock = async () => {
  if (!(redisClient as any).isOpen) return false
  const lock = await redisClient.set(WORKER_LOCK_KEY, String(process.pid), {
    NX: true,
    EX: WORKER_LOCK_SECONDS,
  })
  return !!lock
}

const releaseWorkerLock = async () => {
  if (!(redisClient as any).isOpen) return
  try {
    await redisClient.del(WORKER_LOCK_KEY)
  } catch {
    // ignore lock release errors
  }
}

const processImageTask = async (task: MediaTask) => {
  const billingConfig = await getBillingConfig()
  const estimatedPromptTokens = estimateTextTokens(task.prompt || '')

  const result = await generateImage({
    prompt: task.prompt,
    provider: (task.provider || undefined) as 'aliyun' | 'zhipu' | 'siliconflow' | undefined,
    model: task.model || undefined,
    size: task.size || undefined,
    n: task.n,
  })

  const actualCount = Math.max(1, result.images?.length || task.n || 1)
  const promptTokens = Math.max(1, Math.floor(result.usage?.promptTokens || estimatedPromptTokens))
  const actualCost = calculateImageCost(
    billingConfig,
    {
      provider: result.provider,
      model: result.model,
      modelId: parseTaskMeta(task.meta)?.modelId,
    },
    promptTokens,
    actualCount,
  )

  await recordTokenUsage(task.userId, actualCost, 'image', `${result.provider}:${result.model}`, {
    taskId: task.id,
    promptLength: (task.prompt || '').length,
    provider: result.provider,
    model: result.model,
    size: result.size,
    imageCount: actualCount,
    prompt_tokens: promptTokens,
    completion_tokens: Math.max(0, Math.floor(result.usage?.completionTokens || 0)),
    total_tokens: Math.max(0, Math.floor(result.usage?.totalTokens || promptTokens)),
    usage_source: result.usage ? 'provider' : 'estimate',
    total_cost: actualCost,
  })

  metricCounters.imageDeductSuccess()

  task.status = 'succeeded'
  task.actualCost = actualCost
  task.completedAt = new Date()
  task.errorCode = null
  task.errorMessage = null
  task.nextRetryAt = null
  task.result = JSON.stringify({
    provider: result.provider,
    model: result.model,
    size: result.size,
    n: result.n,
    images: result.images,
    requestId: result.requestId,
    generatedAt: new Date().toISOString(),
    tokenCost: actualCost,
  })
  await task.save()
}

const processVideoTask = async (task: MediaTask) => {
  throw new Error('视频生成功能正在接入中，下一版本开放。')
}

const processTask = async (task: MediaTask) => {
  task.status = 'processing'
  task.attempts = Number(task.attempts || 0) + 1
  task.startedAt = new Date()
  task.errorCode = null
  task.errorMessage = null
  await task.save()

  try {
    if (task.type === 'image') {
      await processImageTask(task)
      return
    }

    await processVideoTask(task)
  } catch (error) {
    const classified = classifyTaskError(error)
    const canRetry = classified.retryable && task.attempts < task.maxAttempts

    if (classified.code === 'INSUFFICIENT_BALANCE') {
      metricCounters.imageDeductFailed()
    }

    task.errorCode = classified.code
    task.errorMessage = classified.message

    if (canRetry) {
      task.status = 'retrying'
      task.nextRetryAt = new Date(Date.now() + calcBackoffMs(task.attempts))
      await task.save()
      return
    }

    task.status = 'failed'
    task.completedAt = new Date()
    task.nextRetryAt = null
    await task.save()

    captureError(error, {
      scope: 'media.task.process',
      taskId: task.id,
      taskType: task.type,
      attempts: task.attempts,
      errorCode: classified.code,
    })
  }
}

const pickPendingTasks = async () => {
  const now = new Date()
  return MediaTask.findAll({
    where: {
      status: {[Op.in]: ['pending', 'retrying']},
      [Op.or]: [{nextRetryAt: null}, {nextRetryAt: {[Op.lte]: now}}],
    },
    order: [
      ['createdAt', 'ASC'],
      ['updatedAt', 'ASC'],
    ],
    limit: MAX_TASKS_PER_TICK,
  })
}

export const runMediaTaskWorkerTick = async () => {
  if (tickInProgress) return
  tickInProgress = true

  try {
    const locked = await acquireWorkerLock()
    if (!locked) return

    const tasks = await pickPendingTasks()
    for (const task of tasks) {
      await processTask(task)
    }
  } catch (error) {
    captureError(error, {scope: 'media.task.tick'})
  } finally {
    await releaseWorkerLock()
    tickInProgress = false
  }
}

export const startMediaTaskWorker = () => {
  if (workerStarted) return
  workerStarted = true

  timer = setInterval(() => {
    runMediaTaskWorkerTick()
  }, POLL_INTERVAL_MS)

  // fire one tick shortly after startup
  setTimeout(() => {
    runMediaTaskWorkerTick()
  }, 300)
}

export const stopMediaTaskWorker = () => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  workerStarted = false
}

export const createImageTask = async (input: CreateImageTaskInput) => {
  const prompt = String(input.prompt || '').trim()
  if (!prompt) {
    throw new Error('Prompt is required')
  }

  const user = await User.findByPk(input.userId)
  if (!user) {
    throw new Error('User not found')
  }

  const expectedCount = Math.max(1, Number(input.n) || 1)
  const billingConfig = await getBillingConfig()
  const estimatedPromptTokens = estimateTextTokens(prompt)
  const estimatedCost = calculateImageCost(
    billingConfig,
    {
      provider: input.provider || 'aliyun',
      model: input.model || '',
      modelId: input.modelId,
    },
    estimatedPromptTokens,
    expectedCount,
  )

  if (user.tokensBalance < estimatedCost) {
    throw new Error(`Token余额不足，预计需要 ${estimatedCost}，当前仅剩 ${user.tokensBalance}`)
  }

  const task = await MediaTask.create({
    userId: input.userId,
    type: 'image',
    status: 'pending',
    provider: input.provider || null,
    model: input.model || null,
    prompt,
    size: input.size || null,
    n: expectedCount,
    maxAttempts: 3,
    estimatedCost,
    meta: JSON.stringify({modelId: input.modelId || null}),
  })

  return toMediaTaskView(task)
}

export const createVideoTask = async (input: CreateVideoTaskInput) => {
  const prompt = String(input.prompt || '').trim()
  if (!prompt) throw new Error('Prompt is required')

  const user = await User.findByPk(input.userId)
  if (!user) throw new Error('User not found')

  const task = await MediaTask.create({
    userId: input.userId,
    type: 'video',
    status: 'pending',
    provider: input.provider || null,
    model: input.model || null,
    prompt,
    size: input.size || null,
    n: Math.max(1, Number(input.n) || 1),
    maxAttempts: 2,
    estimatedCost: 0,
    meta: JSON.stringify({modelId: input.modelId || null}),
  })

  return toMediaTaskView(task)
}

export const getTaskByIdForUser = async (taskId: string, userId: string) => {
  const task = await MediaTask.findOne({
    where: {
      id: taskId,
      userId,
    },
  })
  if (!task) return null
  return toMediaTaskView(task)
}

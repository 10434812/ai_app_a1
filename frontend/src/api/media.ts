import {API_BASE_URL} from '../constants/config'
import {useAuthStore} from '../stores/auth'

export interface ImageOptions {
  enabled: boolean
  defaultProvider: 'aliyun' | 'zhipu' | 'siliconflow'
  defaultSize: string
  maxImagesPerRequest: number
  providerModels: {
    aliyun: string[]
    zhipu: string[]
    siliconflow: string[]
  }
}

export interface ImageGenerateResult {
  success: boolean
  provider: 'aliyun' | 'zhipu' | 'siliconflow'
  model: string
  size: string
  n: number
  images: string[]
  generatedAt: string
  tokenCost: number
}

export interface MediaTaskResult {
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
  result?: ImageGenerateResult
}

const getAuthHeaders = () => {
  const authStore = useAuthStore()
  if (!authStore.token) throw new Error('请先登录后再生成图片')

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${authStore.token}`,
  }
}

const parseApiError = (data: any, fallback: string) => {
  if (data?.error?.message) return String(data.error.message)
  if (typeof data?.error === 'string') return data.error
  return fallback
}

export const fetchImageOptions = async (): Promise<ImageOptions> => {
  const res = await fetch(`${API_BASE_URL}/api/media/image/options`)
  if (!res.ok) throw new Error('获取图片生成配置失败')
  return res.json()
}

export const createImageTask = async (payload: {
  prompt: string
  provider: 'aliyun' | 'zhipu' | 'siliconflow'
  model: string
  size: string
  n: number
  modelId?: string
}) => {
  const res = await fetch(`${API_BASE_URL}/api/media/image/generate`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(parseApiError(data, '图片任务创建失败'))
  return data as {success: boolean; task: MediaTaskResult}
}

export const getMediaTask = async (taskId: string) => {
  const res = await fetch(`${API_BASE_URL}/api/media/tasks/${taskId}`, {
    headers: getAuthHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(parseApiError(data, '获取任务状态失败'))
  return data as {success: boolean; task: MediaTaskResult}
}

export const waitForImageTask = async (
  taskId: string,
  options?: {
    timeoutMs?: number
    intervalMs?: number
    onProgress?: (task: MediaTaskResult) => void
  },
): Promise<ImageGenerateResult> => {
  const timeoutMs = Math.max(30_000, Number(options?.timeoutMs || 180_000))
  const intervalMs = Math.max(800, Number(options?.intervalMs || 1500))
  const started = Date.now()

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const data = await getMediaTask(taskId)
    const task = data.task
    options?.onProgress?.(task)

    if (task.status === 'succeeded') {
      const result = task.result
      if (!result || !Array.isArray(result.images) || result.images.length === 0) {
        throw new Error('图片任务已完成，但未返回图片')
      }
      return result
    }

    if (task.status === 'failed') {
      throw new Error(task.errorMessage || '图片任务执行失败')
    }

    if (Date.now() - started > timeoutMs) {
      throw new Error('图片生成超时，请稍后在会话中重试')
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}

export const generateImage = async (payload: {
  prompt: string
  provider: 'aliyun' | 'zhipu' | 'siliconflow'
  model: string
  size: string
  n: number
  modelId?: string
}) => {
  const created = await createImageTask(payload)
  if (!created.task?.id) {
    throw new Error('图片任务创建成功但未返回任务ID')
  }

  return waitForImageTask(created.task.id)
}

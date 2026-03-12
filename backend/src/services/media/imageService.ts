import {SystemConfig} from '../../models/SystemConfig.ts'

export type ImageProvider = 'aliyun' | 'zhipu' | 'siliconflow'

interface GenerateImageInput {
  prompt: string
  provider?: ImageProvider
  model?: string
  size?: string
  n?: number
}

interface GenerateImageResult {
  provider: ImageProvider
  model: string
  size: string
  n: number
  images: string[]
  requestId?: string
  usage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
  rawResponse?: any
}

interface ImageSettings {
  enabled: boolean
  defaultProvider: ImageProvider
  defaultSize: string
  maxImagesPerRequest: number
  aliyunModel: string
  zhipuModel: string
  siliconflowModel: string
  aliyunApiKey: string
  zhipuApiKey: string
  siliconflowApiKey: string
}

const ALIYUN_IMAGE_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis'
const ALIYUN_TASK_URL = 'https://dashscope.aliyuncs.com/api/v1/tasks'
const ZHIPU_IMAGE_URL = 'https://open.bigmodel.cn/api/paas/v4/images/generations'
const SILICONFLOW_IMAGE_URL = 'https://api.siliconflow.cn/v1/images/generations'

const DEFAULTS = {
  enabled: 'true',
  defaultProvider: 'aliyun',
  defaultSize: '1024x1024',
  maxImagesPerRequest: '2',
  aliyunModel: 'wanx2.0-t2i-turbo',
  zhipuModel: 'cogview-4-250304',
  siliconflowModel: 'Kwai-Kolors/Kolors',
} as const

const parseBool = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) return fallback
  return value.toLowerCase() === 'true'
}

const parseIntSafe = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value || '', 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

const parseProvider = (value?: string): ImageProvider => {
  if (value === 'siliconflow') return 'siliconflow'
  if (value === 'zhipu') return 'zhipu'
  return 'aliyun'
}

const normalizeSize = (size?: string) => {
  const normalized = (size || '').trim()
  if (!normalized) return DEFAULTS.defaultSize
  if (!/^\d{3,4}x\d{3,4}$/i.test(normalized)) return DEFAULTS.defaultSize
  return normalized.toLowerCase()
}

const withTimeout = async (url: string, options: RequestInit, timeoutMs = 45000) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, {...options, signal: controller.signal})
  } finally {
    clearTimeout(timer)
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const extractImageUrls = (payload: any): string[] => {
  const urls: string[] = []

  const pushMaybe = (value?: string) => {
    if (!value) return
    if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:image/')) {
      urls.push(value)
    }
  }

  if (Array.isArray(payload?.data)) {
    payload.data.forEach((item: any) => {
      pushMaybe(item?.url)
      if (item?.b64_json) pushMaybe(`data:image/png;base64,${item.b64_json}`)
    })
  }

  if (Array.isArray(payload?.output?.results)) {
    payload.output.results.forEach((item: any) => {
      pushMaybe(item?.url)
      if (item?.base64) pushMaybe(`data:image/png;base64,${item.base64}`)
    })
  }

  if (payload?.output?.image_url) {
    pushMaybe(payload.output.image_url)
  }

  return Array.from(new Set(urls))
}

const extractUsage = (payload: any) => {
  const usage = payload?.usage || payload?.data?.usage || payload?.output?.usage
  if (!usage) return undefined

  const promptTokens = Number(usage?.prompt_tokens ?? usage?.input_tokens ?? 0)
  const completionTokens = Number(usage?.completion_tokens ?? usage?.output_tokens ?? 0)
  const totalTokens = Number(usage?.total_tokens ?? promptTokens + completionTokens)

  const hasAny = Number.isFinite(promptTokens) || Number.isFinite(completionTokens) || Number.isFinite(totalTokens)
  if (!hasAny) return undefined

  return {
    promptTokens: Number.isFinite(promptTokens) ? promptTokens : undefined,
    completionTokens: Number.isFinite(completionTokens) ? completionTokens : undefined,
    totalTokens: Number.isFinite(totalTokens) ? totalTokens : undefined,
  }
}

const fetchSettings = async (): Promise<ImageSettings> => {
  const keys = [
    'IMAGE_GEN_ENABLED',
    'IMAGE_DEFAULT_PROVIDER',
    'IMAGE_DEFAULT_SIZE',
    'IMAGE_MAX_IMAGES_PER_REQUEST',
    'ALIYUN_IMAGE_MODEL',
    'ZHIPU_IMAGE_MODEL',
    'SILICONFLOW_IMAGE_MODEL',
    'ALIYUN_IMAGE_API_KEY',
    'ZHIPU_IMAGE_API_KEY',
    'SILICONFLOW_IMAGE_API_KEY',
  ]

  const rows = await SystemConfig.findAll({where: {key: keys}})
  const map = new Map(rows.map((row) => [row.key, row.value || '']))

  const enabled = parseBool(map.get('IMAGE_GEN_ENABLED') || DEFAULTS.enabled, true)
  const defaultProvider = parseProvider(map.get('IMAGE_DEFAULT_PROVIDER') || DEFAULTS.defaultProvider)
  const defaultSize = normalizeSize(map.get('IMAGE_DEFAULT_SIZE') || DEFAULTS.defaultSize)
  const maxImagesPerRequest = parseIntSafe(
    map.get('IMAGE_MAX_IMAGES_PER_REQUEST') || DEFAULTS.maxImagesPerRequest,
    Number.parseInt(DEFAULTS.maxImagesPerRequest, 10),
  )

  const aliyunModel = (map.get('ALIYUN_IMAGE_MODEL') || DEFAULTS.aliyunModel).trim() || DEFAULTS.aliyunModel
  const zhipuModel = (map.get('ZHIPU_IMAGE_MODEL') || DEFAULTS.zhipuModel).trim() || DEFAULTS.zhipuModel
  const siliconflowModel = (map.get('SILICONFLOW_IMAGE_MODEL') || DEFAULTS.siliconflowModel).trim() || DEFAULTS.siliconflowModel
  const aliyunApiKey = (map.get('ALIYUN_IMAGE_API_KEY') || process.env.DASHSCOPE_API_KEY || '').trim()
  const zhipuApiKey = (map.get('ZHIPU_IMAGE_API_KEY') || process.env.ZHIPU_API_KEY || '').trim()
  const siliconflowApiKey = (map.get('SILICONFLOW_IMAGE_API_KEY') || process.env.SILICONFLOW_API_KEY || '').trim()

  return {
    enabled,
    defaultProvider,
    defaultSize,
    maxImagesPerRequest,
    aliyunModel,
    zhipuModel,
    siliconflowModel,
    aliyunApiKey,
    zhipuApiKey,
    siliconflowApiKey,
  }
}

const callOpenAICompatibleImageAPI = async (
  url: string,
  apiKey: string,
  payload: {model: string; prompt: string; size: string; n: number},
) => {
  const response = await withTimeout(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        ...payload,
        response_format: 'url',
      }),
    },
    60000,
  )

  const bodyText = await response.text()
  let json: any = {}
  try {
    json = bodyText ? JSON.parse(bodyText) : {}
  } catch {
    json = {raw: bodyText}
  }

  if (!response.ok) {
    throw new Error(`Image API error ${response.status}: ${json?.error?.message || json?.message || bodyText}`)
  }

  return json
}

const callSiliconFlowImageAPI = async (
  apiKey: string,
  payload: {model: string; prompt: string; size: string; n: number},
) => {
  const response = await withTimeout(
    SILICONFLOW_IMAGE_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: payload.model,
        prompt: payload.prompt,
        image_size: payload.size,
        batch_size: payload.n,
        num_inference_steps: 20,
        guidance_scale: 7.5,
      }),
    },
    60000,
  )

  const bodyText = await response.text()
  let json: any = {}
  try {
    json = bodyText ? JSON.parse(bodyText) : {}
  } catch {
    json = {raw: bodyText}
  }

  if (!response.ok) {
    throw new Error(`SiliconFlow image API error ${response.status}: ${json?.error?.message || json?.message || bodyText}`)
  }

  return {
    ...json,
    data: Array.isArray(json?.images)
      ? json.images.map((item: any) => ({
          url: item?.url,
        }))
      : [],
  }
}

const callAliyunImageAPI = async (apiKey: string, payload: {model: string; prompt: string; size: string; n: number}) => {
  const size = payload.size.replace('x', '*')

  const createResponse = await withTimeout(
    ALIYUN_IMAGE_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify({
        model: payload.model,
        input: {
          prompt: payload.prompt,
        },
        parameters: {
          size,
          n: payload.n,
        },
      }),
    },
    60000,
  )

  const createText = await createResponse.text()
  let createJson: any = {}
  try {
    createJson = createText ? JSON.parse(createText) : {}
  } catch {
    createJson = {raw: createText}
  }

  if (!createResponse.ok) {
    throw new Error(
      `Aliyun image create task failed ${createResponse.status}: ${createJson?.message || createJson?.code || createText}`,
    )
  }

  const taskId = createJson?.output?.task_id || createJson?.output?.taskId
  if (!taskId) {
    const directImages = extractImageUrls(createJson)
    if (directImages.length > 0) return createJson
    throw new Error('Aliyun image task_id missing')
  }

  const maxAttempts = 30
  const pollIntervalMs = 2000

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await sleep(pollIntervalMs)

    const taskResponse = await withTimeout(
      `${ALIYUN_TASK_URL}/${taskId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
      45000,
    )

    const taskText = await taskResponse.text()
    let taskJson: any = {}
    try {
      taskJson = taskText ? JSON.parse(taskText) : {}
    } catch {
      taskJson = {raw: taskText}
    }

    if (!taskResponse.ok) {
      throw new Error(
        `Aliyun image task query failed ${taskResponse.status}: ${taskJson?.message || taskJson?.code || taskText}`,
      )
    }

    const status = String(taskJson?.output?.task_status || '').toUpperCase()

    if (status === 'SUCCEEDED') {
      return taskJson
    }

    if (status === 'FAILED' || status === 'CANCELED') {
      throw new Error(
        `Aliyun image task ${status}: ${taskJson?.output?.message || taskJson?.message || taskJson?.code || 'unknown'}`,
      )
    }
  }

  throw new Error('Aliyun image task timeout')
}

export const generateImage = async (input: GenerateImageInput): Promise<GenerateImageResult> => {
  const settings = await fetchSettings()
  if (!settings.enabled) {
    throw new Error('图片生成功能已关闭，请联系管理员开启。')
  }

  const prompt = (input.prompt || '').trim()
  if (!prompt) throw new Error('Prompt is required')

  const provider = input.provider || settings.defaultProvider
  const size = normalizeSize(input.size || settings.defaultSize)
  const n = Math.min(Math.max(input.n || 1, 1), settings.maxImagesPerRequest)

  let model = input.model?.trim() || ''
  let apiKey = ''
  let endpoint = ''

  if (provider === 'aliyun') {
    model = model || settings.aliyunModel
    apiKey = settings.aliyunApiKey
    endpoint = ALIYUN_IMAGE_URL
  } else if (provider === 'siliconflow') {
    model = model || settings.siliconflowModel
    apiKey = settings.siliconflowApiKey
    endpoint = SILICONFLOW_IMAGE_URL
  } else {
    model = model || settings.zhipuModel
    apiKey = settings.zhipuApiKey
    endpoint = ZHIPU_IMAGE_URL
  }

  if (!apiKey) {
    throw new Error(`${provider} 图片 API Key 未配置，请到后台系统设置中填写。`)
  }

  let raw: any
  if (provider === 'aliyun') {
    raw = await callAliyunImageAPI(apiKey, {model, prompt, size, n})
  } else if (provider === 'siliconflow') {
    raw = await callSiliconFlowImageAPI(apiKey, {model, prompt, size, n})
  } else {
    raw = await callOpenAICompatibleImageAPI(endpoint, apiKey, {
      model,
      prompt,
      size,
      n,
    })
  }

  const images = extractImageUrls(raw)
  if (images.length === 0) {
    throw new Error('模型返回成功但未提取到图片 URL，请检查模型与返回格式。')
  }

  return {
    provider,
    model,
    size,
    n,
    images,
    requestId: raw?.id || raw?.request_id || raw?.requestId,
    usage: extractUsage(raw),
    rawResponse: raw,
  }
}

export const getImageGenerationPublicOptions = async () => {
  const settings = await fetchSettings()
  const aliyunModels = Array.from(
    new Set([settings.aliyunModel, 'wanx2.0-t2i-turbo', 'wanx2.1-t2i-turbo', 'wan2.2-t2i-flash']),
  )
  const zhipuModels = Array.from(new Set([settings.zhipuModel, 'cogview-4-250304']))
  const siliconflowModels = Array.from(new Set([settings.siliconflowModel, 'Kwai-Kolors/Kolors']))

  return {
    enabled: settings.enabled,
    defaultProvider: settings.defaultProvider,
    defaultSize: settings.defaultSize,
    maxImagesPerRequest: settings.maxImagesPerRequest,
    providerModels: {
      aliyun: aliyunModels,
      zhipu: zhipuModels,
      siliconflow: siliconflowModels,
    },
  }
}

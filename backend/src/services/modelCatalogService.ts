import {SystemConfig} from '../models/SystemConfig.ts'
import {ALL_MODELS, type ModelConfig} from './llm/config.ts'
import {getModelStatusMap} from './modelStatusService.ts'

type PublicModelStatus = {
  id: string
  provider: string
  isActive: boolean
  isConfigured: boolean
  status: 'configured' | 'placeholder' | 'disabled'
  statusText: string
  source: 'custom' | 'default' | 'image-settings' | 'placeholder'
  upstreamModelId: string | null
  baseURL: string | null
}

interface CustomModelConfig {
  provider?: string
  apiKey?: string
  baseURL?: string
  modelId?: string
}

const IMAGE_MODEL_STATUS_MAP: Record<
  string,
  {provider: 'aliyun' | 'zhipu' | 'siliconflow'; apiKeyKey: string; modelKey: string; fallbackModel: string}
> = {
  'aliyun-image': {
    provider: 'aliyun',
    apiKeyKey: 'ALIYUN_IMAGE_API_KEY',
    modelKey: 'ALIYUN_IMAGE_MODEL',
    fallbackModel: 'wanx2.0-t2i-turbo',
  },
  wanxiang: {
    provider: 'aliyun',
    apiKeyKey: 'ALIYUN_IMAGE_API_KEY',
    modelKey: 'ALIYUN_IMAGE_MODEL',
    fallbackModel: 'wanx2.0-t2i-turbo',
  },
  'zhipu-image': {
    provider: 'zhipu',
    apiKeyKey: 'ZHIPU_IMAGE_API_KEY',
    modelKey: 'ZHIPU_IMAGE_MODEL',
    fallbackModel: 'cogview-4-250304',
  },
  kolors: {
    provider: 'siliconflow',
    apiKeyKey: 'SILICONFLOW_IMAGE_API_KEY',
    modelKey: 'SILICONFLOW_IMAGE_MODEL',
    fallbackModel: 'Kwai-Kolors/Kolors',
  },
}

const buildStatusPayload = (
  model: ModelConfig,
  input: {
    isActive: boolean
    isConfigured: boolean
    provider?: string | null
    source: PublicModelStatus['source']
    upstreamModelId?: string | null
    baseURL?: string | null
  },
): PublicModelStatus => {
  const status: PublicModelStatus['status'] = !input.isActive ? 'disabled' : input.isConfigured ? 'configured' : 'placeholder'
  const statusText =
    status === 'disabled' ? '已禁用' : status === 'configured' ? '已接入' : model.category === '绘图' ? '去配置图片' : '待接入'

  return {
    id: model.id,
    provider: input.provider || model.provider,
    isActive: input.isActive,
    isConfigured: input.isConfigured,
    status,
    statusText,
    source: input.source,
    upstreamModelId: input.upstreamModelId || null,
    baseURL: input.baseURL || null,
  }
}

export const getPublicModelStatusMap = async (): Promise<Record<string, PublicModelStatus>> => {
  const relevantKeys = Array.from(
    new Set([
      ...ALL_MODELS.map((model) => `model_config:${model.id}`),
      ...ALL_MODELS.flatMap((model) => (model.apiConfig ? [model.apiConfig.apiKeyEnv] : [])),
      'ALIYUN_IMAGE_API_KEY',
      'ZHIPU_IMAGE_API_KEY',
      'SILICONFLOW_IMAGE_API_KEY',
      'ALIYUN_IMAGE_MODEL',
      'ZHIPU_IMAGE_MODEL',
      'SILICONFLOW_IMAGE_MODEL',
    ]),
  )

  let rows: Array<SystemConfig> = []
  let statusMap: Record<string, boolean> = {}
  try {
    ;[rows, statusMap] = await Promise.all([
      SystemConfig.findAll({where: {key: relevantKeys}}),
      getModelStatusMap(),
    ])
  } catch {
    rows = []
    statusMap = {}
  }

  const configMap = new Map(rows.map((row) => [row.key, row.value || '']))
  const result: Record<string, PublicModelStatus> = {}

  for (const model of ALL_MODELS) {
    const isActive = statusMap[model.id] !== false

    if (IMAGE_MODEL_STATUS_MAP[model.id]) {
      const imageMeta = IMAGE_MODEL_STATUS_MAP[model.id]
      const imageApiKey = (configMap.get(imageMeta.apiKeyKey) || process.env[imageMeta.apiKeyKey] || '').trim()
      const configuredModel = (configMap.get(imageMeta.modelKey) || imageMeta.fallbackModel).trim() || imageMeta.fallbackModel

      result[model.id] = buildStatusPayload(model, {
        isActive,
        isConfigured: Boolean(imageApiKey),
        provider: imageMeta.provider,
        source: imageApiKey ? 'image-settings' : 'placeholder',
        upstreamModelId: configuredModel,
      })
      continue
    }

    const customConfigRaw = configMap.get(`model_config:${model.id}`)
    let customConfig: CustomModelConfig | null = null

    if (customConfigRaw) {
      try {
        customConfig = JSON.parse(customConfigRaw) as CustomModelConfig
      } catch {
        customConfig = null
      }
    }

    if (customConfig) {
      const isConfigured =
        customConfig.provider === 'openai' &&
        Boolean(String(customConfig.apiKey || '').trim()) &&
        Boolean(String(customConfig.baseURL || '').trim()) &&
        Boolean(String(customConfig.modelId || '').trim())

      result[model.id] = buildStatusPayload(model, {
        isActive,
        isConfigured,
        provider: customConfig.provider || model.provider,
        source: isConfigured ? 'custom' : 'placeholder',
        upstreamModelId: customConfig.modelId || null,
        baseURL: customConfig.baseURL || null,
      })
      continue
    }

    if (model.provider === 'openai' && model.apiConfig) {
      const apiKey = (configMap.get(model.apiConfig.apiKeyEnv) || process.env[model.apiConfig.apiKeyEnv] || '').trim()

      result[model.id] = buildStatusPayload(model, {
        isActive,
        isConfigured: Boolean(apiKey),
        provider: model.provider,
        source: apiKey ? 'default' : 'placeholder',
        upstreamModelId: model.apiConfig.modelId,
        baseURL: model.apiConfig.baseURL,
      })
      continue
    }

    result[model.id] = buildStatusPayload(model, {
      isActive,
      isConfigured: false,
      provider: model.provider,
      source: 'placeholder',
    })
  }

  return result
}

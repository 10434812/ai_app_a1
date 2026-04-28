import {SystemConfig} from '../models/SystemConfig.ts'
import {ALL_MODELS} from './llm/config.ts'

const MODEL_STATUS_KEY_PREFIX = 'model_status:'

const MODEL_ID_ALIASES: Record<string, string> = {
  minimax: 'hailuo',
  '360-ai': '360-gpt',
}

export const resolveModelStatusId = (modelId: string) => MODEL_ID_ALIASES[modelId] || modelId

const buildStatusKey = (modelId: string) => `${MODEL_STATUS_KEY_PREFIX}${resolveModelStatusId(modelId)}`

type StoredModelStatus = {
  isActive?: boolean
  updatedAt?: string
}

const parseStoredStatus = (value?: string | null): StoredModelStatus => {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value)
    return typeof parsed === 'object' && parsed ? parsed : {}
  } catch {
    return {}
  }
}

export const getModelStatusMap = async (): Promise<Record<string, boolean>> => {
  const statusMap: Record<string, boolean> = {}
  try {
    const keys = ALL_MODELS.map((model) => buildStatusKey(model.id))
    const rows = await SystemConfig.findAll({where: {key: keys}})
    const stored = new Map(rows.map((row) => [row.key, row.value]))

    for (const model of ALL_MODELS) {
      const key = buildStatusKey(model.id)
      const parsed = parseStoredStatus(stored.get(key))
      statusMap[model.id] = parsed.isActive !== false
    }
    return statusMap
  } catch {
    for (const model of ALL_MODELS) {
      statusMap[model.id] = true
    }
    return statusMap
  }
}

export const isModelActive = async (modelId: string): Promise<boolean> => {
  try {
    const key = buildStatusKey(modelId)
    const row = await SystemConfig.findByPk(key)
    const parsed = parseStoredStatus(row?.value)
    return parsed.isActive !== false
  } catch {
    return true
  }
}

export const setModelActive = async (modelId: string, isActive: boolean) => {
  const key = buildStatusKey(modelId)
  const value = JSON.stringify({
    isActive,
    updatedAt: new Date().toISOString(),
  })

  const [row] = await SystemConfig.findOrCreate({
    where: {key},
    defaults: {value},
  })

  row.value = value
  await row.save()

  return {
    id: resolveModelStatusId(modelId),
    isActive,
  }
}

export const getDisabledModelIds = async (): Promise<string[]> => {
  const statusMap = await getModelStatusMap()
  return Object.entries(statusMap)
    .filter(([, active]) => !active)
    .map(([id]) => id)
}

export const countActiveModels = async (): Promise<number> => {
  const statusMap = await getModelStatusMap()
  return Object.values(statusMap).filter(Boolean).length
}

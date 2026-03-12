import {SystemConfig} from '../models/SystemConfig.ts'
import {ALL_MODELS} from './llm/config.ts'

const KEY_CHAT_RATES = 'BILLING_CHAT_RATES_V1'
const KEY_IMAGE_RATES = 'BILLING_IMAGE_RATES_V1'
const KEY_DEFAULT_CHAT_RATE = 'BILLING_DEFAULT_CHAT_RATE_V1'
const KEY_DEFAULT_IMAGE_RATE = 'BILLING_DEFAULT_IMAGE_RATE_V1'

export interface ChatRate {
  inputPer1K: number
  outputPer1K: number
}

export interface ImageRate {
  promptPer1K: number
  perImage: number
}

export interface BillingConfig {
  defaultChatRate: ChatRate
  defaultImageRate: ImageRate
  chatRates: Record<string, ChatRate>
  imageRates: Record<string, ImageRate>
}

const safeNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return parsed
}

const normalizeChatRate = (value: any, fallback: ChatRate): ChatRate => ({
  inputPer1K: safeNumber(value?.inputPer1K, fallback.inputPer1K),
  outputPer1K: safeNumber(value?.outputPer1K, fallback.outputPer1K),
})

const normalizeImageRate = (value: any, fallback: ImageRate): ImageRate => ({
  promptPer1K: safeNumber(value?.promptPer1K, fallback.promptPer1K),
  perImage: safeNumber(value?.perImage, fallback.perImage),
})

const buildDefaultChatRates = () => {
  const rates: Record<string, ChatRate> = {}
  for (const model of ALL_MODELS) {
    rates[model.id] = {inputPer1K: 50, outputPer1K: 50}
  }
  return rates
}

const buildDefaultImageRates = (): Record<string, ImageRate> => ({
  'aliyun:wanx2.0-t2i-turbo': {promptPer1K: 1000, perImage: 80},
  'aliyun:wanx2.1-t2i-turbo': {promptPer1K: 1000, perImage: 80},
  'zhipu:cogview-4-250304': {promptPer1K: 1000, perImage: 90},
  'model:aliyun-image': {promptPer1K: 1000, perImage: 80},
  'model:wanxiang': {promptPer1K: 1000, perImage: 80},
  'model:zhipu-image': {promptPer1K: 1000, perImage: 90},
})

const getConfigValue = async (key: string) => {
  const row = await SystemConfig.findByPk(key)
  return row?.value || ''
}

const setConfigValue = async (key: string, value: string) => {
  const [row] = await SystemConfig.findOrCreate({
    where: {key},
    defaults: {value},
  })
  row.value = value
  await row.save()
}

export const estimateTextTokens = (text: string) => {
  if (!text) return 0
  return Math.max(1, Math.ceil(text.length / 4))
}

export const getBillingConfig = async (): Promise<BillingConfig> => {
  const defaultChatRate: ChatRate = {inputPer1K: 50, outputPer1K: 50}
  const defaultImageRate: ImageRate = {promptPer1K: 50, perImage: 80}
  const defaultChatRates = buildDefaultChatRates()
  const defaultImageRates = buildDefaultImageRates()

  const [chatRatesRaw, imageRatesRaw, defaultChatRaw, defaultImageRaw] = await Promise.all([
    getConfigValue(KEY_CHAT_RATES),
    getConfigValue(KEY_IMAGE_RATES),
    getConfigValue(KEY_DEFAULT_CHAT_RATE),
    getConfigValue(KEY_DEFAULT_IMAGE_RATE),
  ])

  let chatRatesParsed: Record<string, any> = {}
  let imageRatesParsed: Record<string, any> = {}
  let defaultChatParsed: any = {}
  let defaultImageParsed: any = {}

  try {
    chatRatesParsed = chatRatesRaw ? JSON.parse(chatRatesRaw) : {}
  } catch {
    chatRatesParsed = {}
  }
  try {
    imageRatesParsed = imageRatesRaw ? JSON.parse(imageRatesRaw) : {}
  } catch {
    imageRatesParsed = {}
  }
  try {
    defaultChatParsed = defaultChatRaw ? JSON.parse(defaultChatRaw) : {}
  } catch {
    defaultChatParsed = {}
  }
  try {
    defaultImageParsed = defaultImageRaw ? JSON.parse(defaultImageRaw) : {}
  } catch {
    defaultImageParsed = {}
  }

  const normalizedDefaultChat = normalizeChatRate(defaultChatParsed, defaultChatRate)
  const normalizedDefaultImage = normalizeImageRate(defaultImageParsed, defaultImageRate)

  const normalizedChatRates: Record<string, ChatRate> = {}
  const mergedChat = {...defaultChatRates, ...chatRatesParsed}
  for (const key of Object.keys(mergedChat)) {
    normalizedChatRates[key] = normalizeChatRate(mergedChat[key], normalizedDefaultChat)
  }

  const normalizedImageRates: Record<string, ImageRate> = {}
  const mergedImage = {...defaultImageRates, ...imageRatesParsed}
  for (const key of Object.keys(mergedImage)) {
    normalizedImageRates[key] = normalizeImageRate(mergedImage[key], normalizedDefaultImage)
  }

  return {
    defaultChatRate: normalizedDefaultChat,
    defaultImageRate: normalizedDefaultImage,
    chatRates: normalizedChatRates,
    imageRates: normalizedImageRates,
  }
}

export const updateBillingConfig = async (payload: Partial<BillingConfig>) => {
  const current = await getBillingConfig()
  const nextDefaultChat = payload.defaultChatRate
    ? normalizeChatRate(payload.defaultChatRate, current.defaultChatRate)
    : current.defaultChatRate
  const nextDefaultImage = payload.defaultImageRate
    ? normalizeImageRate(payload.defaultImageRate, current.defaultImageRate)
    : current.defaultImageRate

  const nextChatRates: Record<string, ChatRate> = {...current.chatRates}
  if (payload.chatRates) {
    for (const [key, value] of Object.entries(payload.chatRates)) {
      nextChatRates[key] = normalizeChatRate(value, nextDefaultChat)
    }
  }

  const nextImageRates: Record<string, ImageRate> = {...current.imageRates}
  if (payload.imageRates) {
    for (const [key, value] of Object.entries(payload.imageRates)) {
      nextImageRates[key] = normalizeImageRate(value, nextDefaultImage)
    }
  }

  await Promise.all([
    setConfigValue(KEY_DEFAULT_CHAT_RATE, JSON.stringify(nextDefaultChat)),
    setConfigValue(KEY_DEFAULT_IMAGE_RATE, JSON.stringify(nextDefaultImage)),
    setConfigValue(KEY_CHAT_RATES, JSON.stringify(nextChatRates)),
    setConfigValue(KEY_IMAGE_RATES, JSON.stringify(nextImageRates)),
  ])

  return {
    defaultChatRate: nextDefaultChat,
    defaultImageRate: nextDefaultImage,
    chatRates: nextChatRates,
    imageRates: nextImageRates,
  }
}

export const calculateChatCost = (config: BillingConfig, modelId: string, promptTokens: number, completionTokens: number) => {
  const rate = config.chatRates[modelId] || config.defaultChatRate
  const raw =
    (Math.max(0, promptTokens) / 1000) * rate.inputPer1K +
    (Math.max(0, completionTokens) / 1000) * rate.outputPer1K
  return Math.max(1, Math.ceil(raw))
}

const resolveImageRate = (config: BillingConfig, params: {provider: string; model: string; modelId?: string}) => {
  const byProviderModel = `${params.provider}:${params.model}`
  if (config.imageRates[byProviderModel]) return config.imageRates[byProviderModel]
  if (params.modelId && config.imageRates[`model:${params.modelId}`]) return config.imageRates[`model:${params.modelId}`]
  return config.defaultImageRate
}

export const calculateImageCost = (
  config: BillingConfig,
  params: {provider: string; model: string; modelId?: string},
  promptTokens: number,
  imageCount: number,
) => {
  const rate = resolveImageRate(config, params)
  const raw = (Math.max(0, promptTokens) / 1000) * rate.promptPer1K + Math.max(1, imageCount) * rate.perImage
  return Math.max(1, Math.ceil(raw))
}

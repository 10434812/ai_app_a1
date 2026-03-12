import {LLMProvider} from './types.ts'
import {MockProvider} from './vendors/mock.ts'
import {OpenAICompatibleProvider} from './vendors/openai.ts'
import {ALL_MODELS} from './config.ts'
import {SystemConfig} from '../../models/SystemConfig.ts'

const MODEL_ID_ALIASES: Record<string, string> = {
  // Frontend compatibility aliases
  minimax: 'hailuo',
  '360-ai': '360-gpt',
}

const resolveModelId = (modelId: string) => MODEL_ID_ALIASES[modelId] || modelId

export class LLMFactory {
  static async getProvider(modelId: string, customApiKey?: string): Promise<LLMProvider> {
    const resolvedModelId = resolveModelId(modelId)
    const modelConfig = ALL_MODELS.find(
      (m) => m.id === modelId || m.id === resolvedModelId || m.name === modelId || m.name === resolvedModelId,
    )

    if (!modelConfig) {
      return new MockProvider()
    }

    // 0. Use Custom API Key if provided (User Override)
    if (customApiKey && modelConfig.provider === 'openai' && modelConfig.apiConfig) {
      return new OpenAICompatibleProvider(
        modelConfig.name, 
        customApiKey, 
        modelConfig.apiConfig.baseURL, 
        modelConfig.apiConfig.modelId
      )
    }

    // 1. Try Dynamic DB Config (Global Override)
    try {
      const configKeys = modelId === resolvedModelId ? [`model_config:${modelId}`] : [`model_config:${modelId}`, `model_config:${resolvedModelId}`]
      let dbConfig = null as any
      for (const key of configKeys) {
        dbConfig = await SystemConfig.findByPk(key)
        if (dbConfig && dbConfig.value) break
      }

      if (dbConfig?.value) {
        const config = JSON.parse(dbConfig.value)
        if (config.provider === 'openai') {
          const dynamicApiKey = config.apiKey
          const dynamicBaseURL = config.baseURL || modelConfig.apiConfig?.baseURL
          const dynamicModelId = config.modelId || modelConfig.apiConfig?.modelId || resolvedModelId

          if (dynamicApiKey && dynamicBaseURL) {
            return new OpenAICompatibleProvider(modelConfig.name, dynamicApiKey, dynamicBaseURL, dynamicModelId)
          }
        } else if (config.provider === 'mock') {
          return new MockProvider()
        }
      }
    } catch (err) {
      console.error('Failed to fetch dynamic config from DB:', err)
    }

    if (modelConfig.provider === 'openai' && modelConfig.apiConfig) {
      // 1. Try DB
      let apiKey = ''
      try {
        const config = await SystemConfig.findByPk(modelConfig.apiConfig.apiKeyEnv)
        if (config && config.value) {
          apiKey = config.value
        }
      } catch (err) {
        console.error('Failed to fetch API key from DB:', err)
      }

      // 2. Fallback to Env
      if (!apiKey) {
        apiKey = process.env[modelConfig.apiConfig.apiKeyEnv] || ''
      }

      if (apiKey) {
        return new OpenAICompatibleProvider(modelConfig.name, apiKey, modelConfig.apiConfig.baseURL, modelConfig.apiConfig.modelId)
      }
    }

    // Default to Mock for everything else or if key is missing
    return new MockProvider()
  }
}

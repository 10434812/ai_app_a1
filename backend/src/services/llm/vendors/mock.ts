import {BaseLLMProvider} from '../provider.ts'
import {ChatMessage, ChatStreamResult} from '../types.ts'

export class MockProvider extends BaseLLMProvider {
  constructor() {
    super('Mock')
  }

  async chatStream(messages: ChatMessage[], onData: (chunk: string) => void): Promise<ChatStreamResult> {
    const responses = ['这是一个模拟的回复。', '我正在思考您的请求...', '根据您的提问，我认为...', 'AI 正在计算中，请稍候。', 'Mock 模式下回复是随机生成的。']

    const randomResponse = responses[Math.floor(Math.random() * responses.length)]
    const lastMsg = messages[messages.length - 1]
    const fullText = `[Mock] ${randomResponse} \n(您问了: "${lastMsg.content}")`

    for (const char of fullText) {
      await new Promise((resolve) => setTimeout(resolve, 30)) // 模拟打字机效果
      onData(char)
    }

    const promptTokens = Math.max(1, Math.ceil((messages.map((m) => m.content).join('\n').length || 0) / 4))
    const completionTokens = Math.max(1, Math.ceil(fullText.length / 4))
    return {
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
    }
  }
}

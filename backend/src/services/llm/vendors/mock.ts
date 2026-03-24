import {BaseLLMProvider} from '../provider.ts'
import {ChatMessage, ChatStreamResult} from '../types.ts'

const REALTIME_INJECTION_MARKER = '[RealtimeQuoteInjected]'

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const findLastUserQuestion = (messages: ChatMessage[]) =>
  [...messages].reverse().find((msg) => msg.role === 'user')?.content?.trim() || ''

const extractInjectionField = (block: string, label: string) => {
  const pattern = new RegExp(`^- ${escapeRegExp(label)}:\\s*(.+)$`, 'mi')
  const match = block.match(pattern)
  return match?.[1]?.trim() || ''
}

const extractRealtimeSnapshot = (block: string) => {
  const match = block.match(/- Ground truth snapshot:\n([\s\S]*?)\n- Instruction:/)
  return match?.[1]?.trim() || ''
}

const extractRealtimeInjection = (messages: ChatMessage[]) => {
  const systemBlock = [...messages]
    .reverse()
    .find((msg) => msg.role === 'system' && msg.content.includes(REALTIME_INJECTION_MARKER))
    ?.content

  if (!systemBlock) return null
  const markerIndex = systemBlock.indexOf(REALTIME_INJECTION_MARKER)
  if (markerIndex < 0) return null

  const block = systemBlock.slice(markerIndex)
  const snapshot = extractRealtimeSnapshot(block)
  if (!snapshot) return null

  return {
    question: extractInjectionField(block, 'User question'),
    kind: extractInjectionField(block, 'Kind'),
    source: extractInjectionField(block, 'Source'),
    updatedAt: extractInjectionField(block, 'Updated at'),
    snapshot,
  }
}

const buildRealtimeMockResponse = (messages: ChatMessage[]) => {
  const injection = extractRealtimeInjection(messages)
  if (!injection) return null

  const question = injection.question || findLastUserQuestion(messages)
  const snapshot = injection.snapshot
  const extraMetaLines: string[] = []

  if (!/数据来源[:：]/.test(snapshot) && injection.source) {
    extraMetaLines.push(`数据来源：${injection.source}`)
  }
  if (!/更新时间[:：]/.test(snapshot) && injection.updatedAt) {
    extraMetaLines.push(`更新时间：${injection.updatedAt}`)
  }

  const summaryLead = '根据你关心的实时行情，我整理了最新结果：'
  const sections = [
    summaryLead,
    snapshot,
    ...(extraMetaLines.length ? [extraMetaLines.join('\n')] : []),
    question ? `如果你想继续，我可以按“${question}”再做横向对比和简短解读。` : '如果你想继续，我可以再做横向对比和简短解读。',
  ]

  return sections.join('\n\n')
}

export class MockProvider extends BaseLLMProvider {
  constructor() {
    super('Mock')
  }

  async chatStream(messages: ChatMessage[], onData: (chunk: string) => void): Promise<ChatStreamResult> {
    const realtimeResponse = buildRealtimeMockResponse(messages)
    if (realtimeResponse) {
      for (const char of realtimeResponse) {
        await new Promise((resolve) => setTimeout(resolve, 16))
        onData(char)
      }

      const promptTokens = Math.max(1, Math.ceil((messages.map((m) => m.content).join('\n').length || 0) / 4))
      const completionTokens = Math.max(1, Math.ceil(realtimeResponse.length / 4))
      return {
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
        },
      }
    }

    const responses = ['这个问题我先给你结论，再补充关键信息。', '我理解你的问题了，下面给你一个简明回答。', '我先说核心结果，再给你简短说明。']

    const randomResponse = responses[Math.floor(Math.random() * responses.length)]
    const question = findLastUserQuestion(messages)
    const fullText = `${randomResponse}\n\n你问的是：${question || messages[messages.length - 1]?.content || ''}`

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

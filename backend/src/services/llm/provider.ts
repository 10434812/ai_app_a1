import {ChatMessage, LLMProvider} from './types.js'

export abstract class BaseLLMProvider implements LLMProvider {
  constructor(public name: string) {}

  abstract chatStream(messages: ChatMessage[], onData: (chunk: string) => void): Promise<{usage?: {promptTokens?: number; completionTokens?: number; totalTokens?: number}}>
}

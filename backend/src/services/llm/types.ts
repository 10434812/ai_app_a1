export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMUsage {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}

export interface ChatStreamResult {
  usage?: LLMUsage
}

export interface LLMProvider {
  name: string;
  chatStream(messages: ChatMessage[], onData: (chunk: string) => void): Promise<ChatStreamResult>;
}

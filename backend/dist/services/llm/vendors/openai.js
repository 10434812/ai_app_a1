import { BaseLLMProvider } from '../provider.js';
function extractContentFromChoice(payload) {
    const choice = payload?.choices?.[0];
    if (!choice)
        return '';
    // Streaming delta content
    if (typeof choice?.delta?.content === 'string')
        return choice.delta.content;
    // Non-stream completion content
    if (typeof choice?.message?.content === 'string')
        return choice.message.content;
    // Some providers return content blocks array
    const messageContent = choice?.message?.content;
    if (Array.isArray(messageContent)) {
        return messageContent
            .map((part) => (typeof part?.text === 'string' ? part.text : ''))
            .join('');
    }
    return '';
}
export class OpenAICompatibleProvider extends BaseLLMProvider {
    apiKey;
    baseURL;
    model;
    constructor(name, apiKey, baseURL, model) {
        super(name);
        this.apiKey = apiKey;
        this.baseURL = baseURL;
        this.model = model;
    }
    async chatStream(messages, onData) {
        const parseUsage = (payload) => {
            const usage = payload?.usage || payload?.data?.usage;
            if (!usage)
                return undefined;
            const promptTokens = Number(usage?.prompt_tokens ?? usage?.input_tokens ?? 0);
            const completionTokens = Number(usage?.completion_tokens ?? usage?.output_tokens ?? 0);
            const totalTokens = Number(usage?.total_tokens ?? promptTokens + completionTokens);
            const hasAny = Number.isFinite(promptTokens) || Number.isFinite(completionTokens) || Number.isFinite(totalTokens);
            if (!hasAny)
                return undefined;
            return {
                promptTokens: Number.isFinite(promptTokens) ? promptTokens : undefined,
                completionTokens: Number.isFinite(completionTokens) ? completionTokens : undefined,
                totalTokens: Number.isFinite(totalTokens) ? totalTokens : undefined,
            };
        };
        const response = await fetch(`${this.baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'text/event-stream',
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: this.model,
                messages: messages,
                stream: true,
                stream_options: { include_usage: true },
            }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} ${errorText}`);
        }
        if (!response.body)
            throw new Error('No response body');
        const contentType = (response.headers.get('content-type') || '').toLowerCase();
        if (!contentType.includes('text/event-stream')) {
            const bodyText = await response.text();
            let parsed = null;
            try {
                parsed = bodyText ? JSON.parse(bodyText) : null;
            }
            catch {
                parsed = null;
            }
            const errMsg = parsed?.error?.message || parsed?.message;
            if (errMsg)
                throw new Error(`API Error: ${errMsg}`);
            const content = extractContentFromChoice(parsed);
            if (!content) {
                throw new Error('API returned empty non-stream response');
            }
            onData(content);
            return { usage: parseUsage(parsed) };
        }
        const decoder = new TextDecoder();
        let buffer = '';
        let emittedChunks = 0;
        let streamUsage;
        const reader = response.body.getReader();
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                if (!value)
                    continue;
                const text = decoder.decode(value, { stream: true });
                buffer += text;
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed === '' || trimmed === 'data: [DONE]' || trimmed === '[DONE]')
                        continue;
                    if (!trimmed.startsWith('data:'))
                        continue;
                    const raw = trimmed.replace(/^data:\s?/, '');
                    if (!raw || raw === '[DONE]')
                        continue;
                    try {
                        const data = JSON.parse(raw);
                        streamUsage = parseUsage(data) || streamUsage;
                        const content = extractContentFromChoice(data);
                        if (content) {
                            emittedChunks++;
                            onData(content);
                        }
                    }
                    catch (e) {
                        console.error('Error parsing SSE chunk:', e);
                    }
                }
            }
        }
        finally {
            reader.releaseLock();
        }
        if (buffer.trim() && buffer.trim().startsWith('data:')) {
            try {
                const raw = buffer.trim().replace(/^data:\s?/, '');
                if (raw && raw !== '[DONE]') {
                    const data = JSON.parse(raw);
                    streamUsage = parseUsage(data) || streamUsage;
                    const content = extractContentFromChoice(data);
                    if (content) {
                        emittedChunks++;
                        onData(content);
                    }
                }
            }
            catch { }
        }
        if (emittedChunks > 0) {
            return { usage: streamUsage };
        }
        // Fallback: some providers occasionally return empty SSE streams.
        const fallbackResponse = await fetch(`${this.baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: this.model,
                messages: messages,
                stream: false,
            }),
        });
        if (!fallbackResponse.ok) {
            const fallbackError = await fallbackResponse.text();
            throw new Error(`API returned empty stream response; fallback failed: ${fallbackResponse.status} ${fallbackError}`);
        }
        const fallbackText = await fallbackResponse.text();
        let fallbackJson = null;
        try {
            fallbackJson = fallbackText ? JSON.parse(fallbackText) : null;
        }
        catch {
            fallbackJson = null;
        }
        const fallbackErr = fallbackJson?.error?.message || fallbackJson?.message;
        if (fallbackErr) {
            throw new Error(`API returned empty stream response; fallback failed: ${fallbackErr}`);
        }
        const fallbackContent = extractContentFromChoice(fallbackJson);
        if (!fallbackContent) {
            throw new Error('API returned empty stream response and fallback content is empty');
        }
        onData(fallbackContent);
        return { usage: parseUsage(fallbackJson) };
    }
}

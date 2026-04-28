import assert from 'node:assert/strict'
import {test} from 'node:test'
import {OpenAICompatibleProvider} from '../services/llm/vendors/openai.ts'

test('OpenAICompatibleProvider should stream delta.text compatibility chunks', async () => {
  const originalFetch = globalThis.fetch
  const chunks: string[] = []

  globalThis.fetch = (async () =>
    new Response(
      [
        'data: {"choices":[{"delta":{"text":"你好"}}]}',
        '',
        'data: {"choices":[{"delta":{"text":"，世界"}}]}',
        '',
        'data: [DONE]',
        '',
      ].join('\n'),
      {
        headers: {'content-type': 'text/event-stream; charset=utf-8'},
      },
    )) as typeof fetch

  try {
    const provider = new OpenAICompatibleProvider('test', 'fake-key', 'https://example.com', 'fake-model')
    await provider.chatStream([{role: 'user', content: 'hello'}], (chunk) => {
      chunks.push(chunk)
    })

    assert.equal(chunks.join(''), '你好，世界')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('OpenAICompatibleProvider should accept plain-text SSE chunks as a fallback', async () => {
  const originalFetch = globalThis.fetch
  const chunks: string[] = []

  globalThis.fetch = (async () =>
    new Response(['data: 直接文本', '', 'data: [DONE]', ''].join('\n'), {
      headers: {'content-type': 'text/event-stream; charset=utf-8'},
    })) as typeof fetch

  try {
    const provider = new OpenAICompatibleProvider('test', 'fake-key', 'https://example.com', 'fake-model')
    await provider.chatStream([{role: 'user', content: 'hello'}], (chunk) => {
      chunks.push(chunk)
    })

    assert.equal(chunks.join(''), '直接文本')
  } finally {
    globalThis.fetch = originalFetch
  }
})

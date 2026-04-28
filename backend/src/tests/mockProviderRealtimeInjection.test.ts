import assert from 'node:assert/strict'
import test from 'node:test'

import {MockProvider} from '../services/llm/vendors/mock.ts'
import type {ChatMessage} from '../services/llm/types.ts'

test('MockProvider should inject realtime snapshot into model-style reply', async () => {
  const provider = new MockProvider()
  const chunks: string[] = []

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: [
        'Runtime guardrail.',
        '[RealtimeQuoteInjected]',
        '- User question: 今日金店金价',
        '- Kind: gold',
        '- Target: CN_SHOP_GOLD',
        '- Display name: 国内金店金价',
        '- Source: free.xwteam.cn',
        '- Updated at: 北京时间 03/23 16:20',
        '- Ground truth snapshot:',
        '当前品牌金店均价约为 1001.00 CNY/g。',
        '周大福：1001.00 CNY/g',
        '周生生：1004.00 CNY/g',
        '',
        '数据来源：free.xwteam.cn',
        '更新时间：北京时间 03/23 16:20',
        '以上为实时抓取结果，仅供参考，不构成投资建议。',
        '- Instruction: Use the realtime values above as primary facts and answer naturally in the assistant voice.',
      ].join('\n'),
    },
    {
      role: 'user',
      content: '今日金店金价',
    },
  ]

  const streamResult = await provider.chatStream(messages, (chunk) => {
    chunks.push(chunk)
  })

  const fullText = chunks.join('')
  assert.doesNotMatch(fullText, /\[Mock\]/)
  assert.doesNotMatch(fullText, /实时gold/)
  assert.match(fullText, /1001\.00 CNY\/g/)
  assert.match(fullText, /周大福：1001\.00 CNY\/g/)
  assert.match(fullText, /数据来源：free\.xwteam\.cn/)
  assert.match(fullText, /更新时间：北京时间 03\/23 16:20/)

  const usage = streamResult.usage || {}
  assert.ok(Number(usage.promptTokens || 0) > 0)
  assert.ok(Number(usage.completionTokens || 0) > 0)
  assert.ok(Number(usage.totalTokens || 0) > 0)
})

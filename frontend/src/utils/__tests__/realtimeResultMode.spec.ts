import { describe, expect, it } from 'vitest'

import { foldRealtimeTurnResults, isRealtimeTurnResult } from '../realtimeResultMode'

describe('realtimeResultMode', () => {
  it('recognizes realtime quote route mode', () => {
    expect(isRealtimeTurnResult({
      id: 'deepseek-v3',
      name: 'DeepSeek-V3',
      latency: '0.2s',
      color: 'blue',
      content: '国际金价：3000 USD',
      streaming: false,
      toolOutputs: [],
      routeMeta: null,
      responseMode: 'realtime_quote',
      realtimeMeta: {
        kind: 'gold',
        title: '国际金价',
        sourceLabel: 'Stooq',
        timestampLabel: '2026-03-23 14:20',
      },
    })).toBe(true)
  })

  it('folds duplicated realtime results into a single card', () => {
    const folded = foldRealtimeTurnResults([
      {
        id: 'deepseek-v3',
        name: 'DeepSeek-V3',
        latency: '0.2s',
        color: 'blue',
        content: '国际金价：3000 USD',
        streaming: false,
        toolOutputs: [],
        routeMeta: null,
        responseMode: 'realtime_quote',
        realtimeMeta: {
          kind: 'gold',
          title: '国际金价',
          sourceLabel: 'Stooq',
          timestampLabel: '2026-03-23 14:20',
        },
      },
      {
        id: 'glm-4',
        name: '智谱 GLM',
        latency: '0.3s',
        color: 'green',
        content: '国际金价：3000 USD',
        streaming: false,
        toolOutputs: [],
        routeMeta: null,
        responseMode: 'realtime_quote',
        realtimeMeta: {
          kind: 'gold',
          title: '国际金价',
          sourceLabel: 'Stooq',
          timestampLabel: '2026-03-23 14:20',
        },
      },
    ])

    expect(folded).toHaveLength(1)
    expect(folded[0].name).toBe('实时行情')
    expect(folded[0].responseMode).toBe('realtime_quote')
  })
})

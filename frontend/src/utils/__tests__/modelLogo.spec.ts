import {describe, it, expect} from 'vitest'
import {getModelLogoCandidates} from '../modelLogo'

describe('modelLogo utils', () => {
  it('returns duckduckgo icon candidates before the local fallback when website exists', () => {
    const candidates = getModelLogoCandidates({
      id: 'deepseek-v3',
      name: 'DeepSeek-V3',
      website: 'https://www.deepseek.com',
    })

    expect(candidates[0]).toBe('https://icons.duckduckgo.com/ip3/www.deepseek.com.ico')
    expect(candidates[1]).toBe('https://icons.duckduckgo.com/ip3/deepseek.com.ico')
    expect(candidates[2]).toMatch(/^data:image\/svg\+xml;charset=UTF-8,/)
  })

  it('keeps explicit logos before the local fallback', () => {
    const candidates = getModelLogoCandidates({
      id: 'custom-model',
      name: '自定义模型',
      website: 'https://example.com',
      logo: 'https://example.com/logo.png',
    })

    expect(candidates[0]).toBe('https://example.com/logo.png')
    expect(candidates[1]).toBe('https://icons.duckduckgo.com/ip3/example.com.ico')
    expect(candidates[2]).toMatch(/^data:image\/svg\+xml;charset=UTF-8,/)
  })

  it('uses the model name for the fallback label', () => {
    const candidates = getModelLogoCandidates({
      id: 'qwen-plus',
      name: '通义千问 Plus',
    })

    expect(candidates[0]).toMatch(/^data:image\/svg\+xml;charset=UTF-8,/)
    expect(decodeURIComponent(candidates[0].split(',')[1] || '')).toContain('通义千问 Plus')
  })
})

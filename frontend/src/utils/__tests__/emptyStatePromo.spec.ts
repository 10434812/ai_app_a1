import { describe, expect, it } from 'vitest'
import { EMPTY_STATE_PROMO, EMPTY_STATE_PROMO_CONTAINER_CLASS, EMPTY_STATE_PROMO_SCROLL_CLASS, shouldShowEmptyStatePromo } from '../emptyStatePromo'

describe('EMPTY_STATE_PROMO', () => {
  it('exposes the configured title, subtitle and url', () => {
    expect(EMPTY_STATE_PROMO.title).toBe('选择真人回答')
    expect(EMPTY_STATE_PROMO.subtitle).toBe('欢迎进入有空帮')
    expect(EMPTY_STATE_PROMO.eyebrow).toBe('广告推荐')
    expect(EMPTY_STATE_PROMO.href).toBe('https://syxy.5zixi.com/#/')
  })

  it('only shows promo when there is no turn and the draft is empty', () => {
    expect(shouldShowEmptyStatePromo(0, '')).toBe(true)
    expect(shouldShowEmptyStatePromo(0, '   ')).toBe(true)
    expect(shouldShowEmptyStatePromo(1, '')).toBe(false)
    expect(shouldShowEmptyStatePromo(0, '你好')).toBe(false)
  })

  it('anchors the promo container to the top of the empty area', () => {
    expect(EMPTY_STATE_PROMO_CONTAINER_CLASS).toContain('items-start')
    expect(EMPTY_STATE_PROMO_CONTAINER_CLASS).not.toContain('items-center')
    expect(EMPTY_STATE_PROMO_CONTAINER_CLASS).toContain('pt-0')
  })

  it('reserves enough bottom space for the fixed input area', () => {
    expect(EMPTY_STATE_PROMO_SCROLL_CLASS).toContain('pb-44')
    expect(EMPTY_STATE_PROMO_SCROLL_CLASS).toContain('sm:pb-52')
  })
})

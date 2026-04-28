import { describe, expect, it } from 'vitest'
import { buildModelSelectionSummary } from '../modelSelectionSummary'

describe('buildModelSelectionSummary', () => {
  it('returns all selected ids when count is within visible limit', () => {
    expect(buildModelSelectionSummary(['a', 'b', 'c'], 3)).toEqual({
      visibleIds: ['a', 'b', 'c'],
      hiddenCount: 0,
    })
  })

  it('caps visible ids and reports hidden count when selection exceeds limit', () => {
    expect(buildModelSelectionSummary(['a', 'b', 'c', 'd', 'e'], 3)).toEqual({
      visibleIds: ['a', 'b', 'c'],
      hiddenCount: 2,
    })
  })

  it('treats invalid visible limit as zero', () => {
    expect(buildModelSelectionSummary(['a', 'b'], 0)).toEqual({
      visibleIds: [],
      hiddenCount: 2,
    })
  })
})

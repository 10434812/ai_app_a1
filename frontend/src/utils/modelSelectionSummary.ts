export type ModelSelectionSummary = {
  visibleIds: string[]
  hiddenCount: number
}

export function buildModelSelectionSummary(selectedIds: string[], maxVisible: number): ModelSelectionSummary {
  const safeLimit = Math.max(0, Math.floor(maxVisible))
  const visibleIds = selectedIds.slice(0, safeLimit)

  return {
    visibleIds,
    hiddenCount: Math.max(0, selectedIds.length - visibleIds.length),
  }
}

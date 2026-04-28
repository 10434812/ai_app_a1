export interface RealtimeResultLike {
  id: string
  name: string
  latency: string
  color: string
  content: string
  streaming: boolean
  toolOutputs: Array<unknown>
  routeMeta?: unknown
  responseMode?: string | null
  realtimeMeta?: {
    kind: string
    title: string
    sourceLabel: string
    timestampLabel: string
  } | null
}

export const isRealtimeTurnResult = (result: Pick<RealtimeResultLike, 'responseMode'> | null | undefined) =>
  result?.responseMode === 'realtime_quote'

export const foldRealtimeTurnResults = <T extends RealtimeResultLike>(results: T[]) => {
  const realtimeResults = results.filter((item) => isRealtimeTurnResult(item))
  if (!realtimeResults.length) return results

  const primary = realtimeResults[0]
  return [
    {
      ...primary,
      id: primary.id || 'realtime-quote',
      name: '实时行情',
    },
  ]
}

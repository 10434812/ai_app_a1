type UnknownRecord = Record<string, unknown>

const asRecord = (value: unknown): UnknownRecord | null => {
  if (!value || typeof value !== 'object') return null
  return value as UnknownRecord
}

export const extractApiErrorMessage = (payload: unknown, fallback: string) => {
  const normalized = asRecord(payload)
  const error = asRecord(normalized?.error)

  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message.trim()
  }
  if (typeof normalized?.error === 'string' && normalized.error.trim()) {
    return normalized.error.trim()
  }
  if (typeof normalized?.message === 'string' && normalized.message.trim()) {
    return normalized.message.trim()
  }
  return fallback
}

export const extractThrownErrorMessage = (err: unknown, fallback: string) => {
  if (typeof err === 'string' && err.trim()) return err.trim()
  if (err instanceof Error && err.message.trim()) return err.message.trim()
  const normalized = asRecord(err)
  if (typeof normalized?.message === 'string' && normalized.message.trim()) {
    return normalized.message.trim()
  }
  return extractApiErrorMessage(err, fallback)
}

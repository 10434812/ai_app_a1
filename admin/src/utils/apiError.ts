interface ErrorPayloadShape {
  error?: {
    message?: string
  } | string
  message?: string
}

interface ErrorLike {
  message?: string
  response?: {
    data?: ErrorPayloadShape
  }
}

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0

export const extractApiErrorMessage = (payload: unknown, fallback: string) => {
  const normalized = payload as ErrorPayloadShape | null | undefined
  if (isNonEmptyString(normalized?.error) ) {
    return normalized.error.trim()
  }
  if (isNonEmptyString(normalized?.error?.message)) {
    return normalized.error.message.trim()
  }
  if (isNonEmptyString(normalized?.message)) {
    return normalized.message.trim()
  }
  return fallback
}

export const extractThrownErrorMessage = (err: unknown, fallback: string) => {
  if (isNonEmptyString(err)) return err.trim()
  if (err instanceof Error && err.message.trim()) return err.message.trim()

  const normalized = err as ErrorLike | null | undefined
  if (isNonEmptyString(normalized?.message)) {
    return normalized.message.trim()
  }

  return extractApiErrorMessage(normalized?.response?.data ?? err, fallback)
}

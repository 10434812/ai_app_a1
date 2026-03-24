export function normalizeAuthToken(rawToken: string | null | undefined): string | null {
  const token = String(rawToken || '').trim()
  if (!token || token === 'cookie' || token === 'null' || token === 'undefined') {
    return null
  }
  return token
}

export function withBearerAuth(
  headers: Record<string, string>,
  rawToken: string | null | undefined,
): Record<string, string> {
  const token = normalizeAuthToken(rawToken)
  if (!token) return headers
  return {
    ...headers,
    Authorization: `Bearer ${token}`,
  }
}

import {API_BASE_URL} from '../constants/config'

const VISITOR_ID_KEY = 'visitor_id'
const VISIT_TRACKED_PATHS_KEY = 'visit_tracked_paths'

const normalizePath = (path: string) => {
  const value = (path || '/').trim()
  if (!value) return '/'
  return value.startsWith('/') ? value : `/${value}`
}

const readTrackedPaths = () => {
  try {
    const raw = sessionStorage.getItem(VISIT_TRACKED_PATHS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item) => typeof item === 'string')
  } catch (error) {
    return []
  }
}

const writeTrackedPaths = (paths: string[]) => {
  try {
    sessionStorage.setItem(VISIT_TRACKED_PATHS_KEY, JSON.stringify(paths))
  } catch (error) {}
}

const getOrCreateVisitorId = () => {
  try {
    const existing = localStorage.getItem(VISITOR_ID_KEY)
    if (existing) return existing
  } catch (error) {}

  const generated =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `visitor_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`

  try {
    localStorage.setItem(VISITOR_ID_KEY, generated)
  } catch (error) {}
  return generated
}

export const trackVisit = async (path: string, token?: string | null) => {
  const normalizedPath = normalizePath(path)
  const trackedPaths = readTrackedPaths()
  if (trackedPaths.includes(normalizedPath)) return

  const visitorId = getOrCreateVisitorId()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Visitor-Id': visitorId,
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/visit/track`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        path: normalizedPath,
        source: 'web',
      }),
      keepalive: true,
    })

    if (!response.ok) {
      throw new Error(`status ${response.status}`)
    }

    writeTrackedPaths([...trackedPaths, normalizedPath])
  } catch (error) {
    console.error('Track visit failed:', error)
  }
}

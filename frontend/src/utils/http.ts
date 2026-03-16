import {API_BASE_URL} from '../constants/config'
import {extractApiErrorMessage} from './apiError'

const buildUrl = (path: string) => {
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  if (path.startsWith('/api/')) {
    if (API_BASE_URL.endsWith('/api')) {
      return `${API_BASE_URL}${path.slice(4)}`
    }
    return `${API_BASE_URL}${path}`
  }
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

export const requestJson = async <T>(path: string, init: RequestInit = {}, fallback = '请求失败'): Promise<T> => {
  const headers = new Headers(init.headers || {})
  const hasBody = init.body !== undefined && init.body !== null
  if (hasBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const res = await fetch(buildUrl(path), {
    ...init,
    headers,
    credentials: 'include',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(extractApiErrorMessage(data, fallback))
  return data as T
}

export const requestBlob = async (path: string, init: RequestInit = {}, fallback = '请求失败') => {
  const res = await fetch(buildUrl(path), {
    ...init,
    credentials: 'include',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(extractApiErrorMessage(data, fallback))
  }
  return res.blob()
}

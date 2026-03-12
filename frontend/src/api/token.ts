import {API_BASE_URL} from '../constants/config'
import {useAuthStore} from '../stores/auth'

const getHeaders = () => {
  const authStore = useAuthStore()
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${authStore.token}`,
  }
}

export interface TokenStats {
  totalUsage: number
  monthUsage: number
  todayUsage: number
  balance: number
}

export interface TokenRecord {
  id: string
  amount: number
  type: string
  model?: string
  balanceAfter: number
  createdAt: string
  meta?: string
}

export interface TokenHistoryResponse {
  records: TokenRecord[]
  total: number
  page: number
  totalPages: number
}

export interface TokenHistoryFilters {
  type?: string
  model?: string
  start?: string
  end?: string
}

export interface TokenTrendItem {
  date: string
  count: number
}

export const getTokenStats = async (): Promise<TokenStats> => {
  const res = await fetch(`${API_BASE_URL}/api/token/stats`, {
    headers: getHeaders(),
  })
  if (!res.ok) throw new Error('Failed to fetch stats')
  return res.json()
}

export const getTokenHistory = async (page = 1, limit = 10, filters: TokenHistoryFilters = {}): Promise<TokenHistoryResponse> => {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  })
  if (filters.type) params.append('type', filters.type)
  if (filters.model) params.append('model', filters.model)
  if (filters.start) params.append('start', filters.start)
  if (filters.end) params.append('end', filters.end)

  const res = await fetch(`${API_BASE_URL}/api/token/history?${params.toString()}`, {
    headers: getHeaders(),
  })
  if (!res.ok) throw new Error('Failed to fetch history')
  return res.json()
}

export const getTokenTrend = async (days = 30): Promise<TokenTrendItem[]> => {
  const params = new URLSearchParams({
    days: days.toString(),
  })
  
  const res = await fetch(`${API_BASE_URL}/api/token/trend?${params.toString()}`, {
    headers: getHeaders(),
  })
  if (!res.ok) throw new Error('Failed to fetch trend')
  const data = await res.json()
  // Ensure count is number
  return data.map((item: any) => ({
    ...item,
    count: Number(item.count)
  }))
}

export const exportTokenHistory = async () => {
  const res = await fetch(`${API_BASE_URL}/api/token/export`, {
    headers: getHeaders(),
  })
  if (!res.ok) throw new Error('Failed to export')
  return res.blob()
}

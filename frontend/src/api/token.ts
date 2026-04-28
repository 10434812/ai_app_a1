import {requestBlob, requestJson} from '../utils/http'

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
  return requestJson<TokenStats>('/api/token/stats', {}, '获取统计失败')
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

  return requestJson<TokenHistoryResponse>(`/api/token/history?${params.toString()}`, {}, '获取明细失败')
}

export const getTokenTrend = async (days = 30): Promise<TokenTrendItem[]> => {
  const params = new URLSearchParams({
    days: days.toString(),
  })
  
  const data = await requestJson<TokenTrendItem[]>(`/api/token/trend?${params.toString()}`, {}, '获取趋势失败')
  return data.map((item) => ({
    ...item,
    count: Number(item.count),
  }))
}

export const exportTokenHistory = async () => {
  return requestBlob('/api/token/export', {}, '导出失败')
}

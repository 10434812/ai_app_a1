import axios from 'axios'

const api = axios.create({
  baseURL: '/api/admin',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

export interface SystemMetrics {
  activeUsers: number
  totalTokens: number
  totalRequests: number
  totalVisits: number
  guestVisits: number
  uniqueVisitors: number
  guestUniqueVisitors: number
  todayVisits: number
  activeModels: number
}

export interface User {
  id: string
  email: string
  name: string
  role: 'user' | 'admin' | 'super_admin' | 'ops' | 'finance' | 'support'
  isActive: boolean
  createdAt: string
}

export interface ModelConfig {
  id: string
  name: string
  category: string
  description?: string
  provider: string
  isActive: boolean
  isCustomized?: boolean
  defaultConfig?: {
    provider: string
    baseURL?: string
    modelId?: string
  } | null
  customConfig?: {
    provider: string
    apiKey?: string
    baseURL?: string
    modelId?: string
  }
}

export interface AnalysisStats {
  totalConversations: number
  totalMessages: number
  totalUsers: number
}

export interface UserPortrait {
  userId: string
  email: string
  name: string
  totalQuestions: number
  tags: string[]
  lastActive: string
}

export interface UserPortraitResponse {
  items: UserPortrait[]
  total: number
  page: number
  pageSize: number
}

export interface RecentQuestion {
  id: string
  conversationId: string
  role: 'user'
  content: string
  model: string
  createdAt: string
  conversation: {
    user?: {
      email: string
    }
  }
}

// Config Key Interfaces
export interface ConfigKey {
  key: string
  name: string
  value: string
  description: string
}

export interface CostDashboard {
  totalTokensLast7Days: number
  totalCostLast7Days: number
  averageDailyCost: number
  dailyCosts: Array<{
    date: string
    estimatedTokens: number
    cost: number
  }>
  modelBreakdown: Array<{
    model: string
    requests: number
    estimatedTokens: number
    cost: number
  }>
}

export interface RetentionStats {
  dau: number
  wau: number
  mau: number
}

export interface TokenEconomicsDashboard {
  rangeDays: number
  totals: {
    chatCost: number
    imageCost: number
    adjustmentCost: number
    modelTokenCost: number
    completedRevenue: number
    refundedRevenue: number
    completedOrderCount: number
    refundedOrderCount: number
    netRevenue: number
    grossProfit: number
    refundRate: number
    arppu: number
    tokenNetRevenue: number
    membershipNetRevenue: number
    paidUsers: number
    revenuePerPaidUser: number
    records: number
    usageTrackedCount: number
    providerUsageCount: number
    estimateUsageCount: number
    providerUsageRate: number
    estimateUsageRate: number
  }
  byType: Array<{
    type: string
    count: number
    cost: number
  }>
  topUsers: Array<{
    userId: string
    email: string
    name: string
    requests: number
    chatCost: number
    imageCost: number
    totalCost: number
  }>
  topModels: Array<{
    model: string
    requests: number
    chatCost: number
    imageCost: number
    totalCost: number
  }>
  membershipPlans: Array<{
    planKey: string
    completedOrders: number
    refundedOrders: number
    completedRevenue: number
    refundedRevenue: number
    netRevenue: number
  }>
  daily: Array<{
    date: string
    tokenCost: number
    revenue: number
    orders: number
  }>
}

export interface BillingConfig {
  defaultChatRate: {
    inputPer1K: number
    outputPer1K: number
  }
  defaultImageRate: {
    promptPer1K: number
    perImage: number
  }
  chatRates: Record<
    string,
    {
      inputPer1K: number
      outputPer1K: number
    }
  >
  imageRates: Record<
    string,
    {
      promptPer1K: number
      perImage: number
    }
  >
}

export interface ObservabilitySummary {
  paymentAttemptTotal: number
  paymentSuccessTotal: number
  paymentFailedTotal: number
  paymentSuccessRate: number
  chatRequestTotal: number
  tokenDeductSuccessTotal: number
  tokenDeductFailedTotal: number
  tokenDeductFailureRate: number
  imageDeductSuccessTotal: number
  imageDeductFailedTotal: number
  imageDeductFailureRate: number
}

export const getMetrics = async (): Promise<SystemMetrics> => {
  const response = await api.get('/metrics')
  return response.data
}

export const getCostDashboard = async (): Promise<CostDashboard> => {
  const response = await api.get('/analysis/costs')
  return response.data
}

export const getRetentionStats = async (): Promise<RetentionStats> => {
  const response = await api.get('/analysis/retention')
  return response.data
}

export const getTokenEconomicsDashboard = async (days = 30): Promise<TokenEconomicsDashboard> => {
  const response = await api.get('/analysis/economics', {params: {days}})
  return response.data
}

export const getUsers = async (): Promise<User[]> => {
  const response = await api.get('/users')
  return response.data
}

export const toggleUserStatus = async (id: string): Promise<User> => {
  const response = await api.patch(`/users/${id}/toggle`)
  return response.data
}

export const deleteUser = async (id: string): Promise<{success: boolean; deletedUserId: string}> => {
  const response = await api.delete(`/users/${id}`, {
    data: {confirm: true},
  })
  return response.data
}

export interface Order {
  id: string
  userId: string
  amount: number
  plan: string
  planKey?: string | null
  status: 'pending' | 'completed' | 'failed' | 'refunded'
  paymentMethod: string
  transactionId?: string | null
  refundedAmount?: number | null
  refundedAt?: string | null
  createdAt: string
  user?: {
    name: string
    email: string
  }
}

export interface PaginatedOrders {
  rows: Order[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface OrderQuery {
  page?: number
  limit?: number
  q?: string
  status?: string
  planKey?: string
  userId?: string
  paymentMethod?: string
}

export interface OrderAudit {
  id: string
  orderId: string
  actorUserId?: string | null
  action: string
  beforeSnapshot?: string | null
  afterSnapshot?: string | null
  note?: string | null
  createdAt: string
  actorUser?: {
    id: string
    name: string
    email: string
  }
}

export interface PaginatedOrderAudits {
  rows: OrderAudit[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export const getOrders = async (params: OrderQuery = {}): Promise<PaginatedOrders> => {
  const response = await api.get('/orders', {params})
  return response.data
}

export const getOrderAudits = async (params: {
  orderId?: string
  page?: number
  limit?: number
} = {}): Promise<PaginatedOrderAudits> => {
  const response = await api.get('/orders/audits', {params})
  return response.data
}

export const repairOrderStatus = async (orderId: string, status: string, note = ''): Promise<{success: boolean; order: Order}> => {
  const response = await api.post(`/orders/${orderId}/repair`, {status, note, confirm: true})
  return response.data
}

export const manualCompleteOrder = async (orderId: string, note = ''): Promise<{success: boolean; order: Order}> => {
  const response = await api.post(`/orders/${orderId}/manual-complete`, {note, confirm: true})
  return response.data
}

export const manualRefundOrder = async (
  orderId: string,
  payload: {note?: string; refundAmount?: number},
): Promise<{success: boolean; order: Order}> => {
  const response = await api.post(`/orders/${orderId}/manual-refund`, {...payload, confirm: true})
  return response.data
}

export interface WeChatPayTestResult {
  success: boolean
  mode: 'mock' | 'live'
  message: string
  missing: string[]
  certificateCount?: number
  merchantSerialNo?: string
}

export interface ArchiveDataResult {
  success: boolean
  dryRun: boolean
  days: number
  archived?: {
    conversations?: number
    messages?: number
    logs?: number
  }
}

export const getModels = async (): Promise<ModelConfig[]> => {
  const response = await api.get('/models')
  return response.data
}

export const toggleModelStatus = async (id: string): Promise<ModelConfig> => {
  const response = await api.patch(`/models/${id}/toggle`)
  return response.data
}

export const updateModelConfig = async (id: string, config: Record<string, unknown>): Promise<ModelConfig> => {
  const response = await api.post(`/models/${id}/config`, config)
  return response.data
}

export const getAnalysisStats = async (): Promise<AnalysisStats> => {
  const response = await api.get('/analysis/stats')
  return response.data
}

export const getUserPortraits = async (page = 1, pageSize = 50): Promise<UserPortraitResponse> => {
  const response = await api.get('/analysis/portraits', {params: {page, pageSize}})
  return response.data
}

export const getRecentQuestions = async (limit: number = 100): Promise<RecentQuestion[]> => {
  const response = await api.get('/analysis/questions', {params: {limit}})
  return response.data
}

export const deleteConversationLog = async (
  conversationId: string,
): Promise<{success: boolean; conversationId: string; deletedMessageCount: number}> => {
  const response = await api.delete(`/conversations/${conversationId}`, {
    data: {confirm: true},
  })
  return response.data
}

export const batchDeleteConversationLogs = async (
  conversationIds: string[],
): Promise<{
  success: boolean
  requestedCount: number
  deletedConversationCount: number
  deletedMessageCount: number
  skippedCount: number
}> => {
  const response = await api.post('/conversations/batch-delete', {
    conversationIds,
    confirm: true,
  })
  return response.data
}

export interface GeneralSettings {
  site_name: string
  enable_registration: string
  default_quota: string
  welcome_message: string
  guest_trial_limit: string
  multi_model_trial_limit: string
  WECHAT_APP_ID: string
  WECHAT_APP_SECRET: string
  WECHAT_SHARE_TITLE: string
  WECHAT_SHARE_DESC: string
  WECHAT_SHARE_IMG: string
  WECHAT_SHARE_LINK: string
  WECHAT_PAY_ENABLED: string
  WECHAT_PAY_MOCK_MODE: string
  WECHAT_PAY_APP_ID: string
  WECHAT_PAY_MCH_ID: string
  WECHAT_PAY_API_V3_KEY: string
  WECHAT_PAY_CERT_SERIAL_NO: string
  WECHAT_PAY_CERT_PEM: string
  WECHAT_PAY_PRIVATE_KEY: string
  WECHAT_PAY_NOTIFY_URL: string
  IMAGE_GEN_ENABLED: string
  IMAGE_DEFAULT_PROVIDER: string
  IMAGE_DEFAULT_SIZE: string
  IMAGE_MAX_IMAGES_PER_REQUEST: string
  ALIYUN_IMAGE_MODEL: string
  ALIYUN_IMAGE_API_KEY: string
  ZHIPU_IMAGE_MODEL: string
  ZHIPU_IMAGE_API_KEY: string
  SILICONFLOW_IMAGE_MODEL: string
  SILICONFLOW_IMAGE_API_KEY: string
  RATE_LIMIT_WHITELIST_IPS: string
  RATE_LIMIT_BLACKLIST_IPS: string
  RATE_LIMIT_WHITELIST_USERS: string
  RATE_LIMIT_BLACKLIST_USERS: string
  RATE_LIMIT_PEAK_HOURS: string
  RATE_LIMIT_PEAK_FACTOR: string
  RATE_LIMIT_OFFPEAK_FACTOR: string
  RATE_LIMIT_REPUTATION_THRESHOLD: string
  RATE_LIMIT_REPUTATION_PENALTY: string
  RATE_LIMIT_FACTOR_FREE: string
  RATE_LIMIT_FACTOR_PRO: string
  RATE_LIMIT_FACTOR_PREMIUM: string
}

export interface ConfigExportPayload {
  version: number
  exportedAt: string
  scope: 'deployment' | 'all'
  rowCount: number
  rows: Array<{
    key: string
    value: string | null
    description: string | null
  }>
}

export const getGeneralSettings = async (): Promise<GeneralSettings> => {
  const response = await api.get('/config/general')
  return response.data
}

export const updateGeneralSettings = async (settings: Partial<GeneralSettings>): Promise<void> => {
  await api.post('/config/general', settings)
}

export const testWeChatPayConfig = async (settings: Partial<GeneralSettings>): Promise<WeChatPayTestResult> => {
  const response = await api.post('/config/general/wechat-pay/test', settings)
  return response.data
}

export const exportSystemConfig = async (scope: 'deployment' | 'all' = 'deployment'): Promise<ConfigExportPayload> => {
  const response = await api.get('/config/export', {
    params: {scope},
  })
  return response.data
}

export const importSystemConfig = async (payload: ConfigExportPayload): Promise<{success: boolean; imported: number}> => {
  const response = await api.post('/config/import', payload)
  return response.data
}

export const getBillingConfig = async (): Promise<BillingConfig> => {
  const response = await api.get('/billing/config')
  return response.data
}

export const updateBillingConfig = async (config: Partial<BillingConfig>): Promise<BillingConfig> => {
  const response = await api.post('/billing/config', config)
  return response.data.config
}

export const getObservabilitySummary = async (): Promise<ObservabilitySummary> => {
  const response = await api.get('/observability')
  return response.data
}

export const exportOrdersCsv = async (params: Record<string, string | number | undefined> = {}): Promise<Blob> => {
  const response = await api.get('/export/orders.csv', {
    params,
    responseType: 'blob',
  })
  return response.data
}

export const exportTokensCsv = async (params: Record<string, string | number | undefined> = {}): Promise<Blob> => {
  const response = await api.get('/export/tokens.csv', {
    params,
    responseType: 'blob',
  })
  return response.data
}

export const archiveData = async (days: number, dryRun = true): Promise<ArchiveDataResult> => {
  const response = await api.post('/data/archive', {days, dryRun})
  return response.data
}

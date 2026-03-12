import {API_BASE_URL} from '../constants/config'
import {useAuthStore} from '../stores/auth'

const getHeaders = () => {
  const authStore = useAuthStore()
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${authStore.token}`,
  }
}

export interface CheckoutResponse {
  orderId: string
  status: 'pending' | 'completed' | 'failed'
  codeUrl?: string
  isMock?: boolean
  paymentType?: 'native' | 'jsapi'
  jsapiParams?: {
    appId: string
    timeStamp: string
    nonceStr: string
    package: string
    signType: string
    paySign: string
  }
}

const extractApiErrorMessage = (payload: any, fallback: string) => {
  if (typeof payload?.error?.message === 'string' && payload.error.message.trim()) return payload.error.message.trim()
  if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error.trim()
  if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message.trim()
  return fallback
}

export const createCheckout = async (planKey: string, method = 'wechat'): Promise<CheckoutResponse> => {
  const idempotencyKey =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `checkout-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const res = await fetch(`${API_BASE_URL}/api/payment/checkout`, {
    method: 'POST',
    headers: {
      ...getHeaders(),
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({planKey, method, idempotencyKey}),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(extractApiErrorMessage(data, '创建订单失败'))
  return data
}

export const getOrderStatus = async (orderId: string): Promise<'pending' | 'completed' | 'failed'> => {
  const res = await fetch(`${API_BASE_URL}/api/payment/status/${orderId}`, {
    headers: getHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(extractApiErrorMessage(data, '查询订单失败'))
  return data.status
}

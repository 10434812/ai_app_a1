import {requestJson} from '../utils/http'

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

export const createCheckout = async (planKey: string, method = 'wechat'): Promise<CheckoutResponse> => {
  const idempotencyKey =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `checkout-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  return requestJson<CheckoutResponse>('/api/payment/checkout', {
    method: 'POST',
    headers: {'X-Idempotency-Key': idempotencyKey},
    body: JSON.stringify({planKey, method, idempotencyKey}),
  }, '创建订单失败')
}

export const getOrderStatus = async (orderId: string): Promise<'pending' | 'completed' | 'failed'> => {
  const data = await requestJson<{status: 'pending' | 'completed' | 'failed'}>(`/api/payment/status/${orderId}`, {}, '查询订单失败')
  return data.status
}

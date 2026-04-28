export interface PaymentPlan {
  amount: number
  name: string
  durationDays?: number
  tokens?: number
}

export const PAYMENT_PLANS: Record<'monthly' | 'quarterly' | 'yearly' | 'token_pack_1000', PaymentPlan> = {
  monthly: {amount: 29.9, durationDays: 30, name: '月卡会员'},
  quarterly: {amount: 79.9, durationDays: 90, name: '季卡会员'},
  yearly: {amount: 299.9, durationDays: 365, name: '年卡会员'},
  token_pack_1000: {amount: 9.9, tokens: 1000, name: '1000 Token加油包'},
}

export type PlanKey = keyof typeof PAYMENT_PLANS

export interface PaymentPlanSnapshot {
  key: PlanKey
  amount: number
  durationDays: number
  tokens: number
  name: string
  createdAt: string
}

export const inferPlanKeyFromOrderPlan = (plan: string): PlanKey | '' => {
  if (plan === 'monthly') return 'monthly'
  if (plan === 'quarterly') return 'quarterly'
  if (plan === 'yearly') return 'yearly'
  if (plan === 'token_pack') return 'token_pack_1000'
  return ''
}

export const getPlanName = (planKey: string) => {
  if (planKey === 'monthly') return '月卡会员'
  if (planKey === 'quarterly') return '季卡会员'
  if (planKey === 'yearly') return '年卡会员'
  if (planKey.startsWith('token_pack')) return 'Token加油包'
  return planKey || '未知套餐'
}

export const makePlanSnapshot = (planKey: PlanKey, plan: PaymentPlan) =>
  JSON.stringify({
    key: planKey,
    amount: Number(plan.amount || 0),
    durationDays: Number(plan.durationDays || 0),
    tokens: Number(plan.tokens || 0),
    name: plan.name || '',
    createdAt: new Date().toISOString(),
  } satisfies PaymentPlanSnapshot)

export const parsePlanSnapshot = (raw: string | null | undefined): PaymentPlanSnapshot | null => {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<PaymentPlanSnapshot>
    if (!parsed || typeof parsed !== 'object' || typeof parsed.key !== 'string') return null
    return {
      key: parsed.key as PlanKey,
      amount: Number(parsed.amount || 0),
      durationDays: Number(parsed.durationDays || 0),
      tokens: Number(parsed.tokens || 0),
      name: String(parsed.name || ''),
      createdAt: String(parsed.createdAt || ''),
    }
  } catch {
    return null
  }
}

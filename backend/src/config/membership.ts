export type MembershipLevel = 'free' | 'pro' | 'premium'

export interface MembershipLimits {
  models: number
  contextK: number
  concurrency: number
  monthlyTokens: number
  toolsPerDay: number
  maxImagesPerRequest: number
}

export interface MembershipTier extends MembershipLimits {
  key: MembershipLevel
  name: string
  priceLabel: string
}

export const MEMBERSHIP_TIER_MAP: Record<MembershipLevel, MembershipTier> = {
  free: {
    key: 'free',
    name: '免费版',
    priceLabel: '¥0',
    models: 3,
    contextK: 8,
    concurrency: 3,
    monthlyTokens: 100,
    toolsPerDay: 20,
    maxImagesPerRequest: 1,
  },
  pro: {
    key: 'pro',
    name: 'Pro 会员',
    priceLabel: '¥29.9/月',
    models: 12,
    contextK: 32,
    concurrency: 3,
    monthlyTokens: 20000,
    toolsPerDay: 200,
    maxImagesPerRequest: 2,
  },
  premium: {
    key: 'premium',
    name: '年卡会员',
    priceLabel: '¥299.9/年',
    models: 30,
    contextK: 128,
    concurrency: 4,
    monthlyTokens: 100000,
    toolsPerDay: 1000,
    maxImagesPerRequest: 4,
  },
}

export const MEMBERSHIP_PLAN_MATRIX: MembershipTier[] = Object.values(MEMBERSHIP_TIER_MAP)

export const normalizeMembershipLevel = (value?: string | null): MembershipLevel => {
  if (value === 'pro' || value === 'premium') return value
  return 'free'
}

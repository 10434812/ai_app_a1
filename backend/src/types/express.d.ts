export {}

import type {MembershipLevel, MembershipLimits} from '../config/membership.ts'

declare global {
  namespace Express {
    interface Request {
      requestId?: string
      user?: {
        id: string
        role: 'user' | 'admin' | 'super_admin' | 'ops' | 'finance' | 'support'
      }
      entitlement?: {
        userId: string
        membershipLevel: MembershipLevel
        limits: MembershipLimits
      }
    }
  }
}

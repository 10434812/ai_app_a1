import type {Request, Response, NextFunction} from 'express'
import {ADMIN_ROLES, requireAdmin} from './auth.js'

export type AdminRole = 'admin' | 'super_admin' | 'ops' | 'finance' | 'support'

export type Permission =
  | 'dashboard:view'
  | 'users:read'
  | 'users:manage'
  | 'models:read'
  | 'models:manage'
  | 'orders:read'
  | 'orders:operate'
  | 'billing:read'
  | 'billing:manage'
  | 'settings:read'
  | 'settings:manage'
  | 'export:read'
  | 'archive:execute'
  | 'analysis:read'
  | 'audit:read'

const PERMISSION_MAP: Record<Permission, Set<AdminRole>> = {
  'dashboard:view': new Set(['admin', 'super_admin', 'ops', 'finance', 'support']),
  'users:read': new Set(['admin', 'super_admin', 'ops', 'support']),
  'users:manage': new Set(['super_admin', 'ops']),
  'models:read': new Set(['admin', 'super_admin', 'ops', 'support']),
  'models:manage': new Set(['super_admin', 'ops']),
  'orders:read': new Set(['admin', 'super_admin', 'ops', 'finance', 'support']),
  'orders:operate': new Set(['super_admin', 'finance']),
  'billing:read': new Set(['admin', 'super_admin', 'ops', 'finance']),
  'billing:manage': new Set(['super_admin', 'finance']),
  'settings:read': new Set(['admin', 'super_admin', 'ops']),
  'settings:manage': new Set(['super_admin']),
  'export:read': new Set(['super_admin', 'finance', 'ops']),
  'archive:execute': new Set(['super_admin']),
  'analysis:read': new Set(['admin', 'super_admin', 'ops', 'finance', 'support']),
  'audit:read': new Set(['admin', 'super_admin', 'ops', 'finance', 'support']),
}

export const hasPermission = (role: string | undefined, permission: Permission) => {
  if (!role || !ADMIN_ROLES.has(role as any)) return false
  const allowed = PERMISSION_MAP[permission]
  if (!allowed) return false
  return allowed.has(role as AdminRole)
}

export const requirePermission = (permission: Permission) => async (req: Request, res: Response, next: NextFunction) => {
  await requireAdmin(req, res, () => {
    if (!hasPermission(req.user?.role, permission)) {
      return res.status(403).json({error: `Insufficient permission: ${permission}`})
    }
    next()
  })
}


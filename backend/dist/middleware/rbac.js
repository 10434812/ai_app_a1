import { requireAdmin } from "./auth.js";
const PERMISSION_MAP = {
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
};
export const hasPermission = (role, permission) => {
    if (role !== 'admin' &&
        role !== 'super_admin' &&
        role !== 'ops' &&
        role !== 'finance' &&
        role !== 'support') {
        return false;
    }
    const allowed = PERMISSION_MAP[permission];
    if (!allowed)
        return false;
    return allowed.has(role);
};
export const requirePermission = (permission) => async (req, res, next) => {
    await requireAdmin(req, res, () => {
        if (!hasPermission(req.user?.role, permission)) {
            return res.status(403).json({ error: `Insufficient permission: ${permission}` });
        }
        next();
    });
};

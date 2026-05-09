import jwt from 'jsonwebtoken';
import redisClient from '../config/redis.js';
export const JWT_SECRET = process.env.JWT_SECRET || '';
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not set. Please configure it in environment variables.');
}
export const ADMIN_ROLES = new Set(['admin', 'super_admin', 'ops', 'finance', 'support']);
const getBearerToken = (authHeader) => {
    if (!authHeader)
        return null;
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer')
        return null;
    const token = (parts[1] || '').trim();
    if (!token)
        return null;
    if (token === 'null' || token === 'undefined')
        return null;
    return token;
};
const attachUserFromToken = async (req, token) => {
    try {
        const isBlacklisted = await redisClient.get(`blacklist:${token}`);
        if (isBlacklisted) {
            return { ok: false, code: 401, error: 'Token revoked' };
        }
    }
    catch (err) {
        console.error('Redis error in auth middleware:', err);
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.userId, role: decoded.role };
    return { ok: true };
};
const handleAuth = async (req, res, next, required) => {
    const token = getBearerToken(req.headers.authorization);
    if (!token) {
        if (required)
            return res.status(401).json({ error: 'No token provided' });
        return next();
    }
    try {
        const result = await attachUserFromToken(req, token);
        if (!result.ok)
            return res.status(result.code).json({ error: result.error });
        return next();
    }
    catch (err) {
        console.error('JWT verify error:', err);
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
};
export const authenticateToken = async (req, res, next) => {
    return handleAuth(req, res, next, true);
};
export const optionalAuthenticateToken = async (req, res, next) => {
    return handleAuth(req, res, next, false);
};
export const requireAdmin = async (req, res, next) => {
    await authenticateToken(req, res, () => {
        if (!req.user?.role || !ADMIN_ROLES.has(req.user.role)) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        next();
    });
};

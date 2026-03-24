import type {Request, Response, NextFunction} from 'express'
import jwt from 'jsonwebtoken'
import redisClient from '../config/redis.ts'
import {User} from '../models/User.ts'

export const JWT_SECRET: string = process.env.JWT_SECRET || ''
export const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'ai_app_token'
export const AUTH_COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not set. Please configure it in environment variables.')
}

interface JwtPayload {
  userId: string
  role: 'user' | 'admin' | 'super_admin' | 'ops' | 'finance' | 'support'
}

export const ADMIN_ROLES = new Set<JwtPayload['role']>(['admin', 'super_admin', 'ops', 'finance', 'support'])

const shouldUseSecureCookie = (req?: Request) => {
  const override = String(process.env.AUTH_COOKIE_SECURE || '').trim().toLowerCase()
  if (override === 'true') return true
  if (override === 'false') return false
  if (!req) return process.env.NODE_ENV === 'production'

  const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim()
    .toLowerCase()

  if (forwardedProto === 'https') return true
  if (forwardedProto === 'http') return false
  return req.secure
}

const getBearerToken = (authHeader?: string) => {
  if (!authHeader) return null
  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null
  const token = (parts[1] || '').trim()
  if (!token) return null
  if (token === 'null' || token === 'undefined') return null
  if (token === 'cookie') return null
  return token
}

const getCookieToken = (cookieHeader?: string) => {
  if (!cookieHeader) return null
  const segments = cookieHeader.split(';')
  for (const segment of segments) {
    const [rawKey, ...rest] = segment.split('=')
    const key = String(rawKey || '').trim()
    if (key !== AUTH_COOKIE_NAME) continue
    const value = rest.join('=').trim()
    if (!value || value === 'null' || value === 'undefined') return null
    return decodeURIComponent(value)
  }
  return null
}

export const issueAuthCookie = (req: Request, res: Response, token: string) => {
  const secure = shouldUseSecureCookie(req)
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: AUTH_COOKIE_MAX_AGE_MS,
  })
}

export const clearAuthCookie = (req: Request, res: Response) => {
  const secure = shouldUseSecureCookie(req)
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
  })
}

const attachUserFromToken = async (req: Request, token: string) => {
  let isBlacklisted: string | null = null
  try {
    isBlacklisted = await redisClient.get(`blacklist:${token}`)
  } catch (err) {
    console.error('Redis error in auth middleware:', err)
    return {ok: false as const, code: 503, error: '认证服务暂时不可用，请稍后重试'}
  }
  if (isBlacklisted) {
    return {ok: false as const, code: 401, error: 'Token revoked'}
  }

  const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload
  let user: Pick<User, 'id' | 'role' | 'isActive'> | null = null
  try {
    user = await User.findByPk(decoded.userId, {
      attributes: ['id', 'role', 'isActive'],
    })
  } catch (err) {
    console.error('User lookup error in auth middleware:', err)
    return {ok: false as const, code: 503, error: '认证服务暂时不可用，请稍后重试'}
  }

  if (!user) {
    return {ok: false as const, code: 401, error: 'User not found'}
  }

  if (!user.isActive) {
    return {ok: false as const, code: 403, error: 'Account disabled'}
  }

  req.user = {id: user.id, role: user.role}
  return {ok: true as const}
}

const handleAuth = async (req: Request, res: Response, next: NextFunction, required: boolean) => {
  const token = getBearerToken(req.headers.authorization) || getCookieToken(req.headers.cookie)
  if (!token) {
    if (required) return res.status(401).json({error: 'No token provided'})
    return next()
  }

  try {
    const result = await attachUserFromToken(req, token)
    if (!result.ok) return res.status(result.code).json({error: result.error})
    return next()
  } catch (err) {
    console.error('JWT verify error:', err)
    return res.status(403).json({error: 'Invalid or expired token'})
  }
}

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  return handleAuth(req, res, next, true)
}

export const optionalAuthenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  return handleAuth(req, res, next, false)
}

export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  await authenticateToken(req, res, () => {
    if (!req.user?.role || !ADMIN_ROLES.has(req.user.role)) {
      return res.status(403).json({error: 'Admin access required'})
    }
    next()
  })
}

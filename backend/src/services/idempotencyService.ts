import {createHash} from 'node:crypto'
import redisClient from '../config/redis.js'

const KEY_PREFIX = 'idem:v1'

export const createRequestFingerprint = (payload: unknown) => {
  const raw = typeof payload === 'string' ? payload : JSON.stringify(payload || {})
  return createHash('sha256').update(raw).digest('hex').slice(0, 24)
}

export const buildIdempotencyKey = (parts: Array<string | number | undefined | null>) => {
  return parts
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(':')
}

export const runIdempotent = async <T>(
  key: string,
  fn: () => Promise<T>,
  options?: {ttlSeconds?: number; lockSeconds?: number},
): Promise<{replayed: boolean; data: T}> => {
  const ttlSeconds = Math.max(30, Number(options?.ttlSeconds || 10 * 60))
  const lockSeconds = Math.max(5, Number(options?.lockSeconds || 30))
  const resultKey = `${KEY_PREFIX}:result:${key}`
  const lockKey = `${KEY_PREFIX}:lock:${key}`

  let cacheAvailable = true
  try {
    const cached = await redisClient.get(resultKey)
    if (cached) {
      return {
        replayed: true,
        data: JSON.parse(cached) as T,
      }
    }
  } catch {
    cacheAvailable = false
  }

  if (!cacheAvailable) {
    const data = await fn()
    return {replayed: false, data}
  }

  const locked = await redisClient.set(lockKey, '1', {NX: true, EX: lockSeconds})
  if (!locked) {
    throw new Error('IDEMPOTENCY_LOCKED')
  }

  try {
    const data = await fn()
    try {
      await redisClient.set(resultKey, JSON.stringify(data), {EX: ttlSeconds})
    } catch {
      // ignore cache write failures
    }
    return {replayed: false, data}
  } finally {
    try {
      await redisClient.del(lockKey)
    } catch {
      // ignore unlock failures
    }
  }
}

export const withOrderLock = async <T>(orderId: string, action: string, fn: () => Promise<T>, ttlSeconds = 90): Promise<T> => {
  const key = `order-lock:${orderId}`
  const locked = await redisClient.set(key, '1', {NX: true, EX: ttlSeconds})
  if (!locked) {
    throw new Error(`ORDER_LOCKED:${action}`)
  }
  try {
    return await fn()
  } finally {
    try {
      await redisClient.del(key)
    } catch {
      // ignore unlock errors
    }
  }
}

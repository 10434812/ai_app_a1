import {createClient} from 'redis'
import dotenv from 'dotenv'

dotenv.config()

type MemoryEntry = {
  value: string
  expiresAt: number | null
}

type MemoryHashEntry = {
  fields: Map<string, number>
  expiresAt: number | null
}

type RedisLikeClient = {
  isOpen: boolean
  connect: () => Promise<void>
  quit: () => Promise<void>
  get: (key: string) => Promise<string | null>
  set: (key: string, value: string, options?: {NX?: boolean; XX?: boolean; EX?: number}) => Promise<string | null>
  del: (...keys: string[]) => Promise<number>
  incr: (key: string) => Promise<number>
  decr: (key: string) => Promise<number>
  incrBy: (key: string, increment: number) => Promise<number>
  expire: (key: string, seconds: number) => Promise<number>
  hIncrBy: (key: string, field: string, increment: number) => Promise<number>
  on: (event: string, handler: (...args: any[]) => void) => void
}

const realClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
})

const memoryStrings = new Map<string, MemoryEntry>()
const memoryHashes = new Map<string, MemoryHashEntry>()

const getNow = () => Date.now()

const purgeStringIfExpired = (key: string) => {
  const entry = memoryStrings.get(key)
  if (!entry) return
  if (entry.expiresAt !== null && entry.expiresAt <= getNow()) {
    memoryStrings.delete(key)
  }
}

const purgeHashIfExpired = (key: string) => {
  const entry = memoryHashes.get(key)
  if (!entry) return
  if (entry.expiresAt !== null && entry.expiresAt <= getNow()) {
    memoryHashes.delete(key)
  }
}

const getStringEntry = (key: string) => {
  purgeStringIfExpired(key)
  return memoryStrings.get(key) || null
}

const getHashEntry = (key: string) => {
  purgeHashIfExpired(key)
  return memoryHashes.get(key) || null
}

const setStringEntry = (key: string, value: string, ttlSeconds?: number) => {
  memoryStrings.set(key, {
    value,
    expiresAt: ttlSeconds ? getNow() + ttlSeconds * 1000 : null,
  })
}

const setHashEntry = (key: string, fields: Map<string, number>, ttlSeconds?: number) => {
  memoryHashes.set(key, {
    fields,
    expiresAt: ttlSeconds ? getNow() + ttlSeconds * 1000 : null,
  })
}

const memoryClient: RedisLikeClient = {
  isOpen: true,
  async connect() {},
  async quit() {
    memoryStrings.clear()
    memoryHashes.clear()
  },
  async get(key: string) {
    return getStringEntry(key)?.value ?? null
  },
  async set(key: string, value: string, options?: {NX?: boolean; XX?: boolean; EX?: number}) {
    const existing = getStringEntry(key)
    if (options?.NX && existing) return null
    if (options?.XX && !existing) return null
    setStringEntry(key, value, options?.EX)
    return 'OK'
  },
  async del(...keys: string[]) {
    let deleted = 0
    for (const key of keys.flat()) {
      if (memoryStrings.delete(key)) deleted += 1
      if (memoryHashes.delete(key)) deleted += 1
    }
    return deleted
  },
  async incr(key: string) {
    const current = Number.parseInt((await this.get(key)) || '0', 10) || 0
    const entry = getStringEntry(key)
    setStringEntry(key, String(current + 1), entry?.expiresAt ? Math.max(1, Math.ceil((entry.expiresAt - getNow()) / 1000)) : undefined)
    return current + 1
  },
  async decr(key: string) {
    const current = Number.parseInt((await this.get(key)) || '0', 10) || 0
    const entry = getStringEntry(key)
    setStringEntry(key, String(current - 1), entry?.expiresAt ? Math.max(1, Math.ceil((entry.expiresAt - getNow()) / 1000)) : undefined)
    return current - 1
  },
  async incrBy(key: string, increment: number) {
    const current = Number.parseInt((await this.get(key)) || '0', 10) || 0
    const entry = getStringEntry(key)
    setStringEntry(key, String(current + increment), entry?.expiresAt ? Math.max(1, Math.ceil((entry.expiresAt - getNow()) / 1000)) : undefined)
    return current + increment
  },
  async expire(key: string, seconds: number) {
    const stringEntry = getStringEntry(key)
    if (stringEntry) {
      memoryStrings.set(key, {value: stringEntry.value, expiresAt: getNow() + seconds * 1000})
      return 1
    }

    const hashEntry = getHashEntry(key)
    if (hashEntry) {
      memoryHashes.set(key, {fields: hashEntry.fields, expiresAt: getNow() + seconds * 1000})
      return 1
    }

    return 0
  },
  async hIncrBy(key: string, field: string, increment: number) {
    const entry = getHashEntry(key)
    const nextFields = entry?.fields ?? new Map<string, number>()
    const nextValue = (nextFields.get(field) || 0) + increment
    nextFields.set(field, nextValue)
    setHashEntry(key, nextFields, entry?.expiresAt ? Math.max(1, Math.ceil((entry.expiresAt - getNow()) / 1000)) : undefined)
    return nextValue
  },
  on() {},
}

let activeClient: RedisLikeClient = realClient as unknown as RedisLikeClient
let usingMemoryFallback = false

const switchToMemoryFallback = (reason: unknown) => {
  if (usingMemoryFallback) return
  usingMemoryFallback = true
  activeClient = memoryClient
  console.warn('Redis unavailable, using in-memory fallback:', reason)
}

realClient.on('error', (err) => {
  console.log('Redis Client Error', err)
})

realClient.on('connect', () => {
  if (!usingMemoryFallback) {
    console.log('Redis Client Connected')
  }
})

export const connectRedis = async () => {
  if (process.env.REDIS_DISABLED === 'true') {
    switchToMemoryFallback('REDIS_DISABLED=true')
    return
  }

  if (usingMemoryFallback) return

  try {
    await realClient.connect()
    activeClient = realClient as unknown as RedisLikeClient
  } catch (error) {
    switchToMemoryFallback(error)
  }
}

const redisClient = new Proxy({} as RedisLikeClient, {
  get(_target, prop: keyof RedisLikeClient) {
    if (prop === 'isOpen') {
      return usingMemoryFallback ? true : realClient.isOpen
    }

    const client = activeClient as any
    const value = client[prop]
    if (typeof value === 'function') return value.bind(client)
    return value
  },
}) as RedisLikeClient

export default redisClient

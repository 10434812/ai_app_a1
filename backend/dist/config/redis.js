import { createClient } from 'redis';
import dotenv from 'dotenv';
dotenv.config();
const realClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
});
const memoryStrings = new Map();
const memoryHashes = new Map();
const getNow = () => Date.now();
const purgeStringIfExpired = (key) => {
    const entry = memoryStrings.get(key);
    if (!entry)
        return;
    if (entry.expiresAt !== null && entry.expiresAt <= getNow()) {
        memoryStrings.delete(key);
    }
};
const purgeHashIfExpired = (key) => {
    const entry = memoryHashes.get(key);
    if (!entry)
        return;
    if (entry.expiresAt !== null && entry.expiresAt <= getNow()) {
        memoryHashes.delete(key);
    }
};
const getStringEntry = (key) => {
    purgeStringIfExpired(key);
    return memoryStrings.get(key) || null;
};
const getHashEntry = (key) => {
    purgeHashIfExpired(key);
    return memoryHashes.get(key) || null;
};
const setStringEntry = (key, value, ttlSeconds) => {
    memoryStrings.set(key, {
        value,
        expiresAt: ttlSeconds ? getNow() + ttlSeconds * 1000 : null,
    });
};
const setHashEntry = (key, fields, ttlSeconds) => {
    memoryHashes.set(key, {
        fields,
        expiresAt: ttlSeconds ? getNow() + ttlSeconds * 1000 : null,
    });
};
const memoryClient = {
    isOpen: true,
    async connect() { },
    async quit() {
        memoryStrings.clear();
        memoryHashes.clear();
    },
    async get(key) {
        return getStringEntry(key)?.value ?? null;
    },
    async set(key, value, options) {
        const existing = getStringEntry(key);
        if (options?.NX && existing)
            return null;
        if (options?.XX && !existing)
            return null;
        setStringEntry(key, value, options?.EX);
        return 'OK';
    },
    async del(...keys) {
        let deleted = 0;
        for (const key of keys.flat()) {
            if (memoryStrings.delete(key))
                deleted += 1;
            if (memoryHashes.delete(key))
                deleted += 1;
        }
        return deleted;
    },
    async incr(key) {
        const current = Number.parseInt((await this.get(key)) || '0', 10) || 0;
        const entry = getStringEntry(key);
        setStringEntry(key, String(current + 1), entry?.expiresAt ? Math.max(1, Math.ceil((entry.expiresAt - getNow()) / 1000)) : undefined);
        return current + 1;
    },
    async decr(key) {
        const current = Number.parseInt((await this.get(key)) || '0', 10) || 0;
        const entry = getStringEntry(key);
        setStringEntry(key, String(current - 1), entry?.expiresAt ? Math.max(1, Math.ceil((entry.expiresAt - getNow()) / 1000)) : undefined);
        return current - 1;
    },
    async incrBy(key, increment) {
        const current = Number.parseInt((await this.get(key)) || '0', 10) || 0;
        const entry = getStringEntry(key);
        setStringEntry(key, String(current + increment), entry?.expiresAt ? Math.max(1, Math.ceil((entry.expiresAt - getNow()) / 1000)) : undefined);
        return current + increment;
    },
    async expire(key, seconds) {
        const stringEntry = getStringEntry(key);
        if (stringEntry) {
            memoryStrings.set(key, { value: stringEntry.value, expiresAt: getNow() + seconds * 1000 });
            return 1;
        }
        const hashEntry = getHashEntry(key);
        if (hashEntry) {
            memoryHashes.set(key, { fields: hashEntry.fields, expiresAt: getNow() + seconds * 1000 });
            return 1;
        }
        return 0;
    },
    async hIncrBy(key, field, increment) {
        const entry = getHashEntry(key);
        const nextFields = entry?.fields ?? new Map();
        const nextValue = (nextFields.get(field) || 0) + increment;
        nextFields.set(field, nextValue);
        setHashEntry(key, nextFields, entry?.expiresAt ? Math.max(1, Math.ceil((entry.expiresAt - getNow()) / 1000)) : undefined);
        return nextValue;
    },
    on() { },
};
let activeClient = realClient;
let usingMemoryFallback = false;
const switchToMemoryFallback = (reason) => {
    if (usingMemoryFallback)
        return;
    usingMemoryFallback = true;
    activeClient = memoryClient;
    console.warn('Redis unavailable, using in-memory fallback:', reason);
};
realClient.on('error', (err) => {
    console.log('Redis Client Error', err);
});
realClient.on('connect', () => {
    if (!usingMemoryFallback) {
        console.log('Redis Client Connected');
    }
});
export const connectRedis = async () => {
    if (process.env.REDIS_DISABLED === 'true') {
        switchToMemoryFallback('REDIS_DISABLED=true');
        return;
    }
    if (usingMemoryFallback)
        return;
    try {
        await realClient.connect();
        activeClient = realClient;
    }
    catch (error) {
        switchToMemoryFallback(error);
    }
};
const redisClient = new Proxy({}, {
    get(_target, prop) {
        if (prop === 'isOpen') {
            return usingMemoryFallback ? true : realClient.isOpen;
        }
        const client = activeClient;
        const value = client[prop];
        if (typeof value === 'function')
            return value.bind(client);
        return value;
    },
});
export default redisClient;

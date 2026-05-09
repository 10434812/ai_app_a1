import redisClient from '../config/redis.js';
import { SystemConfig } from '../models/SystemConfig.js';
import { User } from '../models/User.js';
const envInt = (key, fallback) => {
    const value = Number.parseInt(process.env[key] || '', 10);
    if (!Number.isFinite(value) || value <= 0)
        return fallback;
    return value;
};
const DEFAULTS = {
    chat: {
        scope: 'chat',
        userPerMinute: envInt('RATE_LIMIT_CHAT_USER_PER_MINUTE', 40),
        ipPerMinute: envInt('RATE_LIMIT_CHAT_IP_PER_MINUTE', 80),
        guestPerMinute: envInt('RATE_LIMIT_CHAT_GUEST_PER_MINUTE', 15),
        ipConcurrency: envInt('RATE_LIMIT_CHAT_IP_CONCURRENCY', 8),
    },
    image: {
        scope: 'image',
        userPerMinute: envInt('RATE_LIMIT_IMAGE_USER_PER_MINUTE', 20),
        ipPerMinute: envInt('RATE_LIMIT_IMAGE_IP_PER_MINUTE', 30),
        guestPerMinute: envInt('RATE_LIMIT_IMAGE_GUEST_PER_MINUTE', 5),
        ipConcurrency: envInt('RATE_LIMIT_IMAGE_IP_CONCURRENCY', 4),
    },
    payment: {
        scope: 'payment',
        userPerMinute: envInt('RATE_LIMIT_PAYMENT_USER_PER_MINUTE', 10),
        ipPerMinute: envInt('RATE_LIMIT_PAYMENT_IP_PER_MINUTE', 20),
        guestPerMinute: envInt('RATE_LIMIT_PAYMENT_GUEST_PER_MINUTE', 5),
        ipConcurrency: envInt('RATE_LIMIT_PAYMENT_IP_CONCURRENCY', 3),
    },
    auth: {
        scope: 'auth',
        userPerMinute: envInt('RATE_LIMIT_AUTH_USER_PER_MINUTE', 20),
        ipPerMinute: envInt('RATE_LIMIT_AUTH_IP_PER_MINUTE', 40),
        guestPerMinute: envInt('RATE_LIMIT_AUTH_GUEST_PER_MINUTE', 12),
        ipConcurrency: envInt('RATE_LIMIT_AUTH_IP_CONCURRENCY', 6),
    },
};
const parseList = (value) => new Set(String(value || '')
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean));
const parsePeakHours = (raw) => {
    const text = String(raw || '09-23').trim();
    const [startRaw, endRaw] = text.split('-');
    const start = Number.parseInt(startRaw || '9', 10);
    const end = Number.parseInt(endRaw || '23', 10);
    if (!Number.isFinite(start) || !Number.isFinite(end))
        return [9, 23];
    return [Math.min(23, Math.max(0, start)), Math.min(23, Math.max(0, end))];
};
const safeFactor = (value, fallback, min = 0.2, max = 4) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed))
        return fallback;
    return Math.min(max, Math.max(min, parsed));
};
let dynamicConfigCache = null;
const getDynamicConfig = async () => {
    if (dynamicConfigCache && Date.now() < dynamicConfigCache.expiresAt) {
        return dynamicConfigCache.value;
    }
    const keys = [
        'RATE_LIMIT_WHITELIST_IPS',
        'RATE_LIMIT_BLACKLIST_IPS',
        'RATE_LIMIT_WHITELIST_USERS',
        'RATE_LIMIT_BLACKLIST_USERS',
        'RATE_LIMIT_PEAK_HOURS',
        'RATE_LIMIT_PEAK_FACTOR',
        'RATE_LIMIT_OFFPEAK_FACTOR',
        'RATE_LIMIT_REPUTATION_THRESHOLD',
        'RATE_LIMIT_REPUTATION_PENALTY',
        'RATE_LIMIT_FACTOR_FREE',
        'RATE_LIMIT_FACTOR_PRO',
        'RATE_LIMIT_FACTOR_PREMIUM',
    ];
    const rows = await SystemConfig.findAll({ where: { key: keys } });
    const map = new Map(rows.map((row) => [row.key, row.value || '']));
    const next = {
        whitelistIps: parseList(map.get('RATE_LIMIT_WHITELIST_IPS') || process.env.RATE_LIMIT_WHITELIST_IPS),
        blacklistIps: parseList(map.get('RATE_LIMIT_BLACKLIST_IPS') || process.env.RATE_LIMIT_BLACKLIST_IPS),
        whitelistUsers: parseList(map.get('RATE_LIMIT_WHITELIST_USERS') || process.env.RATE_LIMIT_WHITELIST_USERS),
        blacklistUsers: parseList(map.get('RATE_LIMIT_BLACKLIST_USERS') || process.env.RATE_LIMIT_BLACKLIST_USERS),
        peakHours: parsePeakHours(map.get('RATE_LIMIT_PEAK_HOURS') || process.env.RATE_LIMIT_PEAK_HOURS),
        peakFactor: safeFactor(map.get('RATE_LIMIT_PEAK_FACTOR') || process.env.RATE_LIMIT_PEAK_FACTOR, 0.9),
        offPeakFactor: safeFactor(map.get('RATE_LIMIT_OFFPEAK_FACTOR') || process.env.RATE_LIMIT_OFFPEAK_FACTOR, 1.15),
        reputationThreshold: Math.max(1, Number.parseInt(map.get('RATE_LIMIT_REPUTATION_THRESHOLD') || process.env.RATE_LIMIT_REPUTATION_THRESHOLD || '20', 10) || 20),
        reputationPenalty: safeFactor(map.get('RATE_LIMIT_REPUTATION_PENALTY') || process.env.RATE_LIMIT_REPUTATION_PENALTY, 0.7),
        freeFactor: safeFactor(map.get('RATE_LIMIT_FACTOR_FREE') || process.env.RATE_LIMIT_FACTOR_FREE, 1),
        proFactor: safeFactor(map.get('RATE_LIMIT_FACTOR_PRO') || process.env.RATE_LIMIT_FACTOR_PRO, 1.6),
        premiumFactor: safeFactor(map.get('RATE_LIMIT_FACTOR_PREMIUM') || process.env.RATE_LIMIT_FACTOR_PREMIUM, 2.4),
    };
    dynamicConfigCache = {
        value: next,
        expiresAt: Date.now() + 30_000,
    };
    return next;
};
const getClientIp = (req) => {
    const forwardedFor = req.header('x-forwarded-for') || '';
    return forwardedFor.split(',')[0]?.trim() || req.ip || 'unknown';
};
const currentMinuteKey = () => {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const d = String(now.getUTCDate()).padStart(2, '0');
    const hh = String(now.getUTCHours()).padStart(2, '0');
    const mm = String(now.getUTCMinutes()).padStart(2, '0');
    return `${y}${m}${d}${hh}${mm}`;
};
const increaseWithWindow = async (key, ttlSeconds) => {
    const count = await redisClient.incr(key);
    if (count === 1) {
        await redisClient.expire(key, ttlSeconds);
    }
    return count;
};
const getMembershipLevel = async (req) => {
    const levelFromEntitlement = req.entitlement?.membershipLevel;
    if (levelFromEntitlement === 'pro' || levelFromEntitlement === 'premium')
        return levelFromEntitlement;
    const userId = req.user?.id;
    if (!userId)
        return 'free';
    const cacheKey = `ratelimit:user-level:${userId}`;
    try {
        const cached = await redisClient.get(cacheKey);
        if (cached === 'pro' || cached === 'premium')
            return cached;
        if (cached === 'free')
            return 'free';
    }
    catch {
        // ignore cache read errors
    }
    const user = await User.findByPk(userId, { attributes: ['membershipLevel'] });
    const level = user?.membershipLevel === 'premium' ? 'premium' : user?.membershipLevel === 'pro' ? 'pro' : 'free';
    try {
        await redisClient.set(cacheKey, level, { EX: 60 });
    }
    catch {
        // ignore cache write errors
    }
    return level;
};
const getMembershipFactor = (level, config) => {
    if (level === 'premium')
        return config.premiumFactor;
    if (level === 'pro')
        return config.proFactor;
    return config.freeFactor;
};
const getTimeFactor = (config) => {
    const [start, end] = config.peakHours;
    const hour = new Date().getHours();
    if (start <= end) {
        return hour >= start && hour <= end ? config.peakFactor : config.offPeakFactor;
    }
    return hour >= start || hour <= end ? config.peakFactor : config.offPeakFactor;
};
export const withRateLimit = (scope, custom) => async (req, res, next) => {
    const options = { ...DEFAULTS[scope], ...(custom || {}) };
    const minute = currentMinuteKey();
    const ip = getClientIp(req);
    const userId = req.user?.id || '';
    const isGuest = !userId;
    let ipConcurrencyReleased = false;
    const releaseIpConcurrency = async () => {
        if (ipConcurrencyReleased)
            return;
        ipConcurrencyReleased = true;
        try {
            const key = `ratelimit:concurrency:${scope}:ip:${ip}`;
            const current = await redisClient.decr(key);
            if (current <= 0)
                await redisClient.del(key);
        }
        catch (error) {
            console.error('Rate limit concurrency release error:', error);
        }
    };
    try {
        const dynamicConfig = await getDynamicConfig();
        if (dynamicConfig.blacklistIps.has(ip) || (!!userId && dynamicConfig.blacklistUsers.has(userId))) {
            return res.status(403).json({ error: '访问受限，请联系管理员' });
        }
        const isWhitelisted = dynamicConfig.whitelistIps.has(ip) || (!!userId && dynamicConfig.whitelistUsers.has(userId));
        if (isWhitelisted)
            return next();
        const abuseScoreRaw = await redisClient.get(`ratelimit:abuse:ip:${ip}`);
        const abuseScore = Number.parseInt(abuseScoreRaw || '0', 10) || 0;
        const reputationFactor = abuseScore >= dynamicConfig.reputationThreshold ? dynamicConfig.reputationPenalty : 1;
        const membershipLevel = await getMembershipLevel(req);
        const factor = getMembershipFactor(membershipLevel, dynamicConfig) * getTimeFactor(dynamicConfig) * reputationFactor;
        const maxIpPerMinute = Math.max(1, Math.floor((options.ipPerMinute || 1) * factor));
        const maxGuestPerMinute = Math.max(1, Math.floor((options.guestPerMinute || 1) * factor));
        const maxUserPerMinute = Math.max(1, Math.floor((options.userPerMinute || 1) * factor));
        const maxConcurrency = Math.max(1, Math.floor((options.ipConcurrency || 1) * factor));
        const ipKey = `ratelimit:minute:${scope}:ip:${ip}:${minute}`;
        const ipCount = await increaseWithWindow(ipKey, 120);
        if (ipCount > maxIpPerMinute) {
            await redisClient.incr(`ratelimit:abuse:ip:${ip}`);
            await redisClient.expire(`ratelimit:abuse:ip:${ip}`, 3600);
            return res.status(429).json({ error: `请求过于频繁（IP限流），请稍后再试` });
        }
        if (isGuest) {
            const guestKey = `ratelimit:minute:${scope}:guest:${ip}:${minute}`;
            const guestCount = await increaseWithWindow(guestKey, 120);
            if (guestCount > maxGuestPerMinute) {
                await redisClient.incr(`ratelimit:abuse:ip:${ip}`);
                await redisClient.expire(`ratelimit:abuse:ip:${ip}`, 3600);
                return res.status(429).json({ error: `请求过于频繁（游客限流），请稍后再试` });
            }
        }
        else {
            const userKey = `ratelimit:minute:${scope}:user:${userId}:${minute}`;
            const userCount = await increaseWithWindow(userKey, 120);
            if (userCount > maxUserPerMinute) {
                await redisClient.incr(`ratelimit:abuse:ip:${ip}`);
                await redisClient.expire(`ratelimit:abuse:ip:${ip}`, 3600);
                return res.status(429).json({ error: `请求过于频繁（用户限流），请稍后再试` });
            }
        }
        const ipConcurrencyKey = `ratelimit:concurrency:${scope}:ip:${ip}`;
        const currentConcurrency = await redisClient.incr(ipConcurrencyKey);
        if (currentConcurrency === 1) {
            await redisClient.expire(ipConcurrencyKey, 120);
        }
        if (currentConcurrency > maxConcurrency) {
            await redisClient.incr(`ratelimit:abuse:ip:${ip}`);
            await redisClient.expire(`ratelimit:abuse:ip:${ip}`, 3600);
            await releaseIpConcurrency();
            return res.status(429).json({ error: `请求并发超限，请稍后再试` });
        }
        res.on('finish', releaseIpConcurrency);
        res.on('close', releaseIpConcurrency);
        return next();
    }
    catch (error) {
        // Redis unavailable should not block core business path.
        console.error('Rate limit middleware error:', error);
        return next();
    }
};

import { User } from "../models/User.js";
import redisClient from "../config/redis.js";
import { MEMBERSHIP_TIER_MAP, normalizeMembershipLevel } from "../config/membership.js";
const attachEntitlement = async (req) => {
    if (!req.user?.id)
        return null;
    const user = await User.findByPk(req.user.id);
    if (!user)
        return null;
    const now = Date.now();
    const isExpired = user.membershipLevel !== 'free' &&
        !!user.membershipExpireAt &&
        new Date(user.membershipExpireAt).getTime() < now;
    if (isExpired) {
        user.membershipLevel = 'free';
        user.membershipExpireAt = null;
        await user.save();
        await redisClient.del(`user:${user.id}`);
    }
    const level = normalizeMembershipLevel(user.membershipLevel);
    const limits = MEMBERSHIP_TIER_MAP[level];
    req.entitlement = {
        userId: user.id,
        membershipLevel: level,
        limits,
    };
    return req.entitlement;
};
export const withEntitlement = async (req, _res, next) => {
    try {
        await attachEntitlement(req);
        next();
    }
    catch (error) {
        console.error('Attach entitlement error:', error);
        next();
    }
};
const getRequestedModelCount = (req) => {
    const models = req.body?.models;
    if (Array.isArray(models))
        return models.length;
    if (req.body?.model)
        return 1;
    return 0;
};
export const enforceModelSelectionLimit = (req, res, next) => {
    if (!req.entitlement)
        return next();
    const requested = getRequestedModelCount(req);
    if (requested > req.entitlement.limits.models) {
        return res.status(403).json({
            error: `当前会员最多可选 ${req.entitlement.limits.models} 个模型`,
        });
    }
    next();
};
export const enforceImageRequestLimit = (req, res, next) => {
    if (!req.entitlement)
        return next();
    const requested = Math.max(1, Number(req.body?.n) || 1);
    if (requested > req.entitlement.limits.maxImagesPerRequest) {
        return res.status(403).json({
            error: `当前会员单次最多生成 ${req.entitlement.limits.maxImagesPerRequest} 张图片`,
        });
    }
    next();
};
const withConcurrencyKey = (channel, userId) => `concurrency:${channel}:${userId}`;
export const withConcurrencyGuard = (channel = 'ai') => async (req, res, next) => {
    if (!req.entitlement)
        return next();
    const userId = req.entitlement.userId;
    const limit = Math.max(1, Number(req.entitlement.limits.concurrency || 1));
    const key = withConcurrencyKey(channel, userId);
    let released = false;
    const release = async () => {
        if (released)
            return;
        released = true;
        try {
            const current = await redisClient.decr(key);
            if (current <= 0) {
                await redisClient.del(key);
            }
        }
        catch (error) {
            console.error('Concurrency release error:', error);
        }
    };
    try {
        const current = await redisClient.incr(key);
        if (current === 1) {
            await redisClient.expire(key, 120);
        }
        if (current > limit) {
            await redisClient.decr(key);
            return res.status(429).json({
                error: `并发请求超限，当前会员最多并发 ${limit} 个请求`,
            });
        }
        res.on('finish', release);
        res.on('close', release);
        return next();
    }
    catch (error) {
        console.error('Concurrency guard error:', error);
        return next();
    }
};

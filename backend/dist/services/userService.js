import { Op } from 'sequelize';
import { User } from '../models/User.js';
import { TokenUsageRecord } from '../models/TokenUsageRecord.js';
import { SystemConfig } from '../models/SystemConfig.js';
import redisClient from '../config/redis.js';
import bcrypt from 'bcryptjs';
import { getVisitMetrics } from './visitService.js';
const CACHE_TTL = 3600; // 1 hour
const DEFAULT_REGISTER_TOKENS = 5000;
export const getAllUsers = async () => {
    return User.findAll();
};
export const updateUserStatus = async (id, isActive) => {
    const user = await User.findByPk(id);
    if (user) {
        user.isActive = isActive;
        await user.save();
        // Invalidate cache
        await redisClient.del(`user:${id}`);
    }
    return user;
};
export const findUserByEmail = async (email) => {
    return User.findOne({ where: { email } });
};
export const findUserById = async (id) => {
    // Try to get from Redis
    const cachedUser = await redisClient.get(`user:${id}`);
    if (cachedUser) {
        // Parse cached string back to User model instance-like object or just return data
        // Since Sequelize models are complex, maybe we just return the JSON data and caller handles it.
        // However, our types expect User model.
        // For simplicity, let's just return the parsed JSON and assume it fits User interface partially.
        // Or better: build a User instance from it.
        const userData = JSON.parse(cachedUser);
        return User.build(userData, { isNewRecord: false });
    }
    const user = await User.findByPk(id);
    if (user) {
        // Cache to Redis
        await redisClient.set(`user:${id}`, JSON.stringify(user.toJSON()), {
            EX: CACHE_TTL,
        });
    }
    return user;
};
export const findUserByReferralCode = async (code) => {
    return User.findOne({ where: { referralCode: code } });
};
const getRegisterQuota = async () => {
    try {
        const row = await SystemConfig.findByPk('default_quota');
        const parsed = Number.parseInt(String(row?.value || ''), 10);
        if (Number.isFinite(parsed) && parsed > 0)
            return parsed;
    }
    catch (error) {
        console.error('Read default_quota failed:', error);
    }
    return DEFAULT_REGISTER_TOKENS;
};
export const createUser = async (email, password, name) => {
    const passwordHash = await bcrypt.hash(password, 10);
    const tokensBalance = await getRegisterQuota();
    const user = await User.create({
        email,
        passwordHash,
        name,
        role: 'user',
        isActive: true,
        tokensBalance,
    });
    return user;
};
// Aliases for admin route compatibility
export const getUsers = getAllUsers;
export const toggleUserStatus = async (id, isActive) => {
    return updateUserStatus(id, isActive);
};
export const getMetrics = async () => {
    try {
        const [activeUsers, totalRequestsStr, totalTokensRaw, visitMetrics] = await Promise.all([
            User.count({ where: { isActive: true } }),
            redisClient.get('stats:totalRequests'),
            TokenUsageRecord.sum('amount', {
                where: {
                    type: { [Op.in]: ['chat', 'image'] },
                },
            }),
            getVisitMetrics(),
        ]);
        const totalRequests = parseInt(totalRequestsStr || '0');
        const totalTokens = Number(totalTokensRaw || 0);
        return {
            activeUsers,
            totalRequests,
            totalTokens,
            ...visitMetrics,
            activeModels: 0, // This will be populated by the controller
        };
    }
    catch (error) {
        console.error('Error getting metrics:', error);
        return {
            activeUsers: 0,
            totalRequests: 0,
            totalTokens: 0,
            totalVisits: 0,
            guestVisits: 0,
            uniqueVisitors: 0,
            guestUniqueVisitors: 0,
            todayVisits: 0,
            activeModels: 0,
        };
    }
};

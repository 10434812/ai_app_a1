import { Op } from 'sequelize';
import { User } from '../models/User.js';
import { SystemConfig } from '../models/SystemConfig.js';
import redisClient from '../config/redis.js';
import { recordTokenUsage } from './tokenService.js';
import { MEMBERSHIP_TIER_MAP } from '../config/membership.js';
const LAST_CYCLE_KEY = 'membership_monthly_quota_last_cycle';
const JOB_LOCK_KEY = 'jobs:membership_monthly_quota_reset';
const getCycle = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
export const runMonthlyQuotaReset = async () => {
    const cycle = getCycle();
    const lock = await redisClient.set(JOB_LOCK_KEY, cycle, {
        NX: true,
        EX: 60,
    });
    if (!lock)
        return { executed: false, reason: 'locked' };
    try {
        const state = await SystemConfig.findByPk(LAST_CYCLE_KEY);
        if (state?.value === cycle) {
            return { executed: false, reason: 'already_reset' };
        }
        const users = await User.findAll({
            where: {
                isActive: true,
                membershipLevel: { [Op.in]: ['pro', 'premium'] },
            },
            attributes: ['id', 'membershipLevel'],
        });
        let granted = 0;
        for (const user of users) {
            const tier = MEMBERSHIP_TIER_MAP[user.membershipLevel];
            const amount = Number(tier?.monthlyTokens || 0);
            if (amount <= 0)
                continue;
            await recordTokenUsage(user.id, amount, 'monthly_quota', 'system', {
                cycle,
                membershipLevel: user.membershipLevel,
            });
            granted += 1;
        }
        await SystemConfig.upsert({
            key: LAST_CYCLE_KEY,
            value: cycle,
            description: 'Last completed monthly quota cycle',
        });
        return { executed: true, cycle, granted };
    }
    catch (error) {
        console.error('Run monthly quota reset error:', error);
        return { executed: false, reason: 'error' };
    }
    finally {
        try {
            await redisClient.del(JOB_LOCK_KEY);
        }
        catch (error) {
            console.error('Release monthly quota lock error:', error);
        }
    }
};
export const startMonthlyQuotaScheduler = () => {
    const run = async () => {
        const result = await runMonthlyQuotaReset();
        if (result.executed) {
            console.log(`[MonthlyQuota] cycle=${result.cycle} granted=${result.granted}`);
        }
    };
    run().catch((error) => console.error('Monthly quota init run error:', error));
    const timer = setInterval(() => {
        run().catch((error) => console.error('Monthly quota scheduled run error:', error));
    }, 30 * 60 * 1000);
    timer.unref?.();
};

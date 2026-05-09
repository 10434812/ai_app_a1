import { User } from '../models/User.js';
import { TokenUsageRecord } from '../models/TokenUsageRecord.js';
import { sequelize } from '../config/db.js';
import { Op } from 'sequelize';
const DEBIT_TYPES = new Set(['chat', 'image', 'refund', 'manual_debit']);
export const recordTokenUsage = async (userId, amount, type, model, meta, options) => {
    // If amount is 0, do nothing
    if (amount === 0)
        return;
    const externalTransaction = options?.transaction;
    const transaction = externalTransaction || (await sequelize.transaction());
    try {
        const user = await User.findByPk(userId, {
            transaction,
            lock: transaction.LOCK.UPDATE,
        });
        if (!user)
            throw new Error('User not found');
        const currentBalance = user.tokensBalance;
        let balanceAfter = currentBalance;
        // Debit types consume balance.
        // 'topup', 'bonus', 'referral', 'register' are addition types (add)
        const isConsumption = DEBIT_TYPES.has(type);
        if (isConsumption) {
            // Check balance
            if (currentBalance < amount) {
                throw new Error('Insufficient balance');
            }
            balanceAfter = currentBalance - amount;
            await user.decrement('tokensBalance', { by: amount, transaction });
        }
        else {
            balanceAfter = currentBalance + amount;
            await user.increment('tokensBalance', { by: amount, transaction });
        }
        await TokenUsageRecord.create({
            userId,
            amount, // We store the absolute magnitude. type tells direction.
            type,
            model,
            balanceAfter,
            meta: meta ? JSON.stringify(meta) : null
        }, { transaction });
        if (!externalTransaction) {
            await transaction.commit();
        }
        return balanceAfter;
    }
    catch (error) {
        if (!externalTransaction) {
            await transaction.rollback();
        }
        // If it's insufficient balance, we might want to throw it up
        throw error;
    }
};
export const adjustUserTokens = async (userId, delta, type, model, meta) => {
    if (!delta)
        return;
    const amount = Math.abs(Math.floor(delta));
    if (!amount)
        return;
    const normalizedType = delta < 0 ? type || 'manual_debit' : type || 'manual_credit';
    return recordTokenUsage(userId, amount, normalizedType, model, meta);
};
export const reserveUserTokenBudget = async (userId, requestedAmount) => {
    const transaction = await sequelize.transaction();
    try {
        const user = await User.findByPk(userId, {
            transaction,
            lock: transaction.LOCK.UPDATE,
        });
        if (!user)
            throw new Error('User not found');
        const currentBalance = user.tokensBalance;
        const reserveAmount = Math.min(requestedAmount ?? currentBalance, currentBalance);
        if (reserveAmount <= 0)
            throw new Error('Insufficient balance');
        await user.decrement('tokensBalance', { by: reserveAmount, transaction });
        await transaction.commit();
        return {
            reservedAmount: reserveAmount,
            balanceBefore: currentBalance,
            balanceAfterReserve: currentBalance - reserveAmount,
        };
    }
    catch (error) {
        await transaction.rollback();
        throw error;
    }
};
export const releaseReservedTokens = async (userId, reservedAmount) => {
    if (!reservedAmount || reservedAmount <= 0)
        return;
    const transaction = await sequelize.transaction();
    try {
        const user = await User.findByPk(userId, {
            transaction,
            lock: transaction.LOCK.UPDATE,
        });
        if (!user)
            throw new Error('User not found');
        await user.increment('tokensBalance', { by: reservedAmount, transaction });
        await transaction.commit();
    }
    catch (error) {
        await transaction.rollback();
        throw error;
    }
};
export const settleReservedChatUsage = async (input) => {
    const transaction = await sequelize.transaction();
    try {
        const user = await User.findByPk(input.userId, {
            transaction,
            lock: transaction.LOCK.UPDATE,
        });
        if (!user)
            throw new Error('User not found');
        const reservedAmount = Math.max(0, Math.floor(input.reservedAmount || 0));
        if (reservedAmount <= 0)
            throw new Error('Invalid reserved amount');
        const actualCost = Math.max(1, Math.floor(input.actualCost || 0));
        let balanceAfter = user.tokensBalance;
        if (actualCost > reservedAmount) {
            const extraCost = actualCost - reservedAmount;
            if (balanceAfter < extraCost) {
                throw new Error('Insufficient balance');
            }
            balanceAfter -= extraCost;
            await user.decrement('tokensBalance', { by: extraCost, transaction });
        }
        else if (actualCost < reservedAmount) {
            const refund = reservedAmount - actualCost;
            balanceAfter += refund;
            await user.increment('tokensBalance', { by: refund, transaction });
        }
        await TokenUsageRecord.create({
            userId: input.userId,
            amount: actualCost,
            type: 'chat',
            model: input.model,
            balanceAfter,
            meta: input.meta ? JSON.stringify(input.meta) : null,
        }, { transaction });
        await transaction.commit();
        return balanceAfter;
    }
    catch (error) {
        await transaction.rollback();
        throw error;
    }
};
export const getTokenStats = async (userId) => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const totalUsage = await TokenUsageRecord.sum('amount', {
        where: {
            userId,
            type: ['chat', 'image']
        }
    }) || 0;
    const monthUsage = await TokenUsageRecord.sum('amount', {
        where: {
            userId,
            type: ['chat', 'image'],
            createdAt: { [Op.gte]: startOfMonth }
        }
    }) || 0;
    const todayUsage = await TokenUsageRecord.sum('amount', {
        where: {
            userId,
            type: ['chat', 'image'],
            createdAt: { [Op.gte]: startOfDay }
        }
    }) || 0;
    const user = await User.findByPk(userId);
    return {
        totalUsage,
        monthUsage,
        todayUsage,
        balance: user?.tokensBalance || 0
    };
};
export const getTokenHistory = async (userId, page = 1, limit = 10, type, model, startDate, endDate) => {
    const offset = (page - 1) * limit;
    const where = { userId };
    if (type)
        where.type = type;
    if (model)
        where.model = model;
    if (startDate || endDate) {
        where.createdAt = {};
        if (startDate)
            where.createdAt[Op.gte] = startDate;
        if (endDate)
            where.createdAt[Op.lte] = endDate;
    }
    const { rows, count } = await TokenUsageRecord.findAndCountAll({
        where,
        limit,
        offset,
        order: [['createdAt', 'DESC']]
    });
    return {
        records: rows,
        total: count,
        page,
        totalPages: Math.ceil(count / limit)
    };
};
export const getTokenTrend = async (userId, days = 30) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    // Group by date
    const records = await TokenUsageRecord.findAll({
        where: {
            userId,
            type: ['chat', 'image'],
            createdAt: { [Op.between]: [start, end] }
        },
        attributes: [
            [sequelize.fn('DATE_FORMAT', sequelize.col('createdAt'), '%Y-%m-%d'), 'date'],
            [sequelize.fn('SUM', sequelize.col('amount')), 'count']
        ],
        group: [sequelize.fn('DATE_FORMAT', sequelize.col('createdAt'), '%Y-%m-%d')],
        order: [[sequelize.col('date'), 'ASC']],
        raw: true
    });
    return records;
};

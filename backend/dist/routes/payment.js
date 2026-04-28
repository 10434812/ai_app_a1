import { Router } from 'express';
import { Op } from 'sequelize';
import { User } from "../models/User.js";
import { Order } from "../models/Order.js";
import { TokenUsageRecord } from "../models/TokenUsageRecord.js";
import { weChatPayService } from "../services/payment/wechat.js";
import { ADMIN_ROLES, authenticateToken, requireAdmin } from "../middleware/auth.js";
import { recordTokenUsage } from "../services/tokenService.js";
import redisClient from "../config/redis.js";
import { MEMBERSHIP_PLAN_MATRIX } from "../config/membership.js";
import { PAYMENT_PLANS, getPlanName, inferPlanKeyFromOrderPlan, makePlanSnapshot, parsePlanSnapshot } from "../config/paymentPlans.js";
import { captureError, metricCounters } from "../services/observabilityService.js";
import { withRateLimit } from "../middleware/rateLimit.js";
import { sequelize } from "../config/db.js";
import { ApiError, sendError } from "../errors/api.js";
import { buildIdempotencyKey, createRequestFingerprint, runIdempotent, withOrderLock } from "../services/idempotencyService.js";
export const paymentRouter = Router();
const WEBHOOK_MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const WECHAT_OUT_TRADE_NO_REGEX = /^[0-9a-fA-F]{32}$/;
const buildWeChatOutTradeNo = (orderId) => orderId.replace(/-/g, '').slice(0, 32);
const toOrderPlan = (planKey) => {
    if (planKey.startsWith('token_pack'))
        return 'token_pack';
    if (planKey === 'monthly' || planKey === 'quarterly' || planKey === 'yearly')
        return planKey;
    return 'token_pack';
};
const readErrorMessage = (error) => {
    if (error instanceof Error)
        return error.message;
    if (typeof error === 'string')
        return error;
    return '';
};
const resolveOrderIdFromWeChatOutTradeNo = (value) => {
    const trimmed = String(value || '').trim();
    if (!trimmed)
        return '';
    if (!WECHAT_OUT_TRADE_NO_REGEX.test(trimmed))
        return trimmed;
    return `${trimmed.slice(0, 8)}-${trimmed.slice(8, 12)}-${trimmed.slice(12, 16)}-${trimmed.slice(16, 20)}-${trimmed.slice(20, 32)}`;
};
const readIdempotencyToken = (req) => {
    const value = String(req.headers['idempotency-key'] || req.headers['x-idempotency-key'] || req.body?.idempotencyKey || '').trim();
    return value.slice(0, 128);
};
const isIdempotencyLockedError = (error) => {
    return readErrorMessage(error) === 'IDEMPOTENCY_LOCKED';
};
const isOrderLockedError = (error) => {
    return readErrorMessage(error).startsWith('ORDER_LOCKED:');
};
const reportPaymentSecurityAlert = async (event, context) => {
    const key = `security:payment:${event}`;
    console.error(`[SECURITY_ALERT][${event}]`, context);
    try {
        await redisClient.incr(key);
        await redisClient.expire(key, 24 * 60 * 60);
    }
    catch (error) {
        console.error('Security alert metric error:', error);
    }
};
paymentRouter.get('/plans', async (_req, res) => {
    const tokenPacks = Object.entries(PAYMENT_PLANS)
        .filter(([key]) => key.includes('token_pack'))
        .map(([key, plan]) => ({
        key,
        name: plan.name,
        amount: plan.amount,
        tokens: plan.tokens || 0,
    }));
    res.json({
        tiers: MEMBERSHIP_PLAN_MATRIX,
        tokenPacks,
    });
});
paymentRouter.get('/usage', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        const records = await TokenUsageRecord.findAll({
            where: {
                userId,
                type: { [Op.in]: ['chat', 'image'] },
                createdAt: { [Op.gte]: start },
            },
            order: [['createdAt', 'ASC']],
        });
        const daily = {};
        for (let i = 0; i < 7; i++) {
            const date = new Date(start);
            date.setDate(start.getDate() + i);
            const key = date.toISOString().slice(0, 10);
            daily[key] = { messages: 0, estimatedTokens: 0 };
        }
        let totalTokens = 0;
        let totalMessages = 0;
        for (const record of records) {
            const createdAt = record.createdAt ? new Date(record.createdAt) : new Date();
            const key = createdAt.toISOString().slice(0, 10);
            const tokens = Number(record.amount || 0);
            if (!daily[key])
                daily[key] = { messages: 0, estimatedTokens: 0 };
            if (record.type === 'chat') {
                daily[key].messages += 1;
                totalMessages += 1;
            }
            daily[key].estimatedTokens += tokens;
            totalTokens += tokens;
        }
        const last7Days = Object.keys(daily)
            .sort()
            .map((date) => ({
            date,
            messages: daily[date].messages,
            estimatedTokens: daily[date].estimatedTokens,
        }));
        const averageDailyTokens = last7Days.length > 0 ? Math.round(totalTokens / last7Days.length) : 0;
        res.json({
            last7Days,
            totalTokensLast7Days: totalTokens,
            totalMessagesLast7Days: totalMessages,
            averageDailyTokens,
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to load usage' });
    }
});
paymentRouter.get('/orders', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const orders = await Order.findAll({
            where: { userId },
            order: [['createdAt', 'DESC']],
            attributes: ['id', 'amount', 'plan', 'planKey', 'status', 'createdAt', 'paymentMethod'],
        });
        // Map plan to readable name
        const formattedOrders = orders.map((order) => {
            const effectivePlanKey = order.planKey || inferPlanKeyFromOrderPlan(order.plan);
            const planName = getPlanName(effectivePlanKey);
            return {
                ...order.toJSON(),
                planKey: effectivePlanKey,
                planName,
                amount: order.amount || 0,
            };
        });
        res.json(formattedOrders);
    }
    catch (err) {
        console.error('Fetch orders error:', err);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});
// Create Payment Order
paymentRouter.post('/checkout', authenticateToken, withRateLimit('payment'), async (req, res) => {
    const userId = req.user.id;
    const { planKey, method = 'wechat' } = req.body;
    if (!planKey || !PAYMENT_PLANS[planKey]) {
        sendError(res, {
            status: 400,
            code: 'PAYMENT_INVALID_PLAN',
            message: '无效的支付套餐',
            retryable: false,
        });
        return;
    }
    const selectedPlanKey = planKey;
    const plan = PAYMENT_PLANS[selectedPlanKey];
    const requestToken = readIdempotencyToken(req) ||
        createRequestFingerprint({
            userId,
            selectedPlanKey,
            method,
            amount: Number(plan.amount || 0),
        });
    const idemKey = buildIdempotencyKey(['payment', 'checkout', userId, requestToken]);
    try {
        metricCounters.paymentAttempt();
        const idemResult = await runIdempotent(idemKey, async () => {
            const user = await User.findByPk(userId);
            if (!user) {
                throw new ApiError({
                    status: 404,
                    code: 'PAYMENT_USER_NOT_FOUND',
                    message: '用户不存在',
                    retryable: false,
                });
            }
            const order = await Order.create({
                userId,
                amount: plan.amount,
                plan: toOrderPlan(selectedPlanKey),
                planKey: selectedPlanKey,
                planSnapshot: makePlanSnapshot(selectedPlanKey, plan),
                status: 'pending',
                paymentMethod: method,
            });
            if (method === 'wechat' || method === 'wechat_native') {
                try {
                    const result = await weChatPayService.createNativeTransaction(buildWeChatOutTradeNo(order.id), `AI App - ${plan.name}`, plan.amount);
                    return {
                        orderId: order.id,
                        status: 'pending',
                        codeUrl: result.code_url || '',
                        isMock: !!result.mock,
                        paymentType: 'native',
                    };
                }
                catch (error) {
                    order.status = 'failed';
                    await order.save();
                    throw error;
                }
            }
            if (method === 'wechat_jsapi') {
                if (!user.wechatOpenId) {
                    order.status = 'failed';
                    await order.save();
                    throw new ApiError({
                        status: 400,
                        code: 'WECHAT_PAY_OPENID_REQUIRED',
                        message: '请先在微信内使用微信一键登录，再发起微信支付',
                        retryable: false,
                    });
                }
                try {
                    const result = await weChatPayService.createJsapiTransaction(buildWeChatOutTradeNo(order.id), `AI App - ${plan.name}`, plan.amount, user.wechatOpenId);
                    return {
                        orderId: order.id,
                        status: 'pending',
                        isMock: !!result.mock,
                        paymentType: 'jsapi',
                        jsapiParams: {
                            appId: result.appId,
                            timeStamp: result.timeStamp,
                            nonceStr: result.nonceStr,
                            package: result.package,
                            signType: result.signType,
                            paySign: result.paySign,
                        },
                    };
                }
                catch (error) {
                    order.status = 'failed';
                    await order.save();
                    throw error;
                }
            }
            return { orderId: order.id, status: 'pending', message: 'Payment initiated' };
        }, { ttlSeconds: 20 * 60, lockSeconds: 45 });
        res.json({ ...idemResult.data, replayed: idemResult.replayed });
    }
    catch (err) {
        if (err instanceof ApiError) {
            return sendError(res, {
                status: err.status,
                code: err.code,
                message: err.message,
                retryable: err.retryable,
            });
        }
        if (isIdempotencyLockedError(err)) {
            return sendError(res, {
                status: 409,
                code: 'PAYMENT_CHECKOUT_IN_PROGRESS',
                message: '支付单创建中，请勿重复提交',
                retryable: true,
            });
        }
        metricCounters.paymentFailed();
        captureError(err, { scope: 'payment.checkout', userId });
        sendError(res, {
            status: 500,
            code: 'PAYMENT_CHECKOUT_FAILED',
            message: '支付下单失败，请稍后重试',
            retryable: true,
        });
    }
});
// Check Order Status
paymentRouter.get('/status/:orderId', authenticateToken, async (req, res) => {
    const { orderId } = req.params;
    try {
        const order = await Order.findByPk(orderId);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        const isOwner = order.userId === req.user.id;
        const isAdmin = ADMIN_ROLES.has(req.user.role);
        if (!isOwner && !isAdmin) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        res.json({ status: order.status });
    }
    catch (err) {
        res.status(500).json({ error: 'Error checking status' });
    }
});
// Mock Pay Confirmation (For Dev)
paymentRouter.post('/mock-success', requireAdmin, async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: 'Mock endpoint disabled in production' });
    }
    try {
        const { orderId } = req.body;
        if (!orderId) {
            return sendError(res, {
                status: 400,
                code: 'PAYMENT_ORDER_ID_REQUIRED',
                message: '缺少订单号',
                retryable: false,
            });
        }
        await processPaymentSuccess(orderId);
        res.json({ success: true });
    }
    catch (error) {
        if (isOrderLockedError(error)) {
            return sendError(res, {
                status: 409,
                code: 'ORDER_PROCESSING',
                message: '订单处理中，请稍后再试',
                retryable: true,
            });
        }
        captureError(error, { scope: 'payment.mock_success' });
        sendError(res, {
            status: 500,
            code: 'PAYMENT_MOCK_SUCCESS_FAILED',
            message: '模拟到账失败',
            retryable: true,
        });
    }
});
// WeChat Pay Notify Webhook
paymentRouter.post('/wechat/notify', async (req, res) => {
    try {
        const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf-8') : typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
        const parsedBody = Buffer.isBuffer(req.body)
            ? JSON.parse(rawBody || '{}')
            : typeof req.body === 'string'
                ? JSON.parse(req.body || '{}')
                : req.body || {};
        const payConfig = await weChatPayService.getConfig();
        const isMockMode = payConfig.mockMode;
        if (!isMockMode) {
            const timestamp = Number(req.headers['wechatpay-timestamp'] || 0);
            const nonce = String(req.headers['wechatpay-nonce'] || '');
            const signature = String(req.headers['wechatpay-signature'] || '');
            if (!timestamp || !nonce || !signature) {
                await reportPaymentSecurityAlert('missing_headers', {
                    ip: req.ip,
                    headers: {
                        timestamp: req.headers['wechatpay-timestamp'],
                        nonce: req.headers['wechatpay-nonce'],
                        signature: req.headers['wechatpay-signature'] ? 'present' : 'missing',
                    },
                });
                return res.status(401).json({ code: 'FAIL', message: 'Missing signature headers' });
            }
            if (Math.abs(Date.now() - timestamp * 1000) > WEBHOOK_MAX_CLOCK_SKEW_MS) {
                await reportPaymentSecurityAlert('stale_timestamp', {
                    ip: req.ip,
                    timestamp,
                });
                return res.status(401).json({ code: 'FAIL', message: 'Stale timestamp' });
            }
            const replayKey = `wxpay:webhook:replay:${timestamp}:${nonce}:${signature}`;
            const fresh = await redisClient.set(replayKey, '1', { NX: true, EX: 10 * 60 });
            if (!fresh) {
                return res.status(200).json({ code: 'SUCCESS', message: 'Duplicate notification ignored' });
            }
            const isValid = await weChatPayService.verifySignature(req.headers, rawBody);
            if (!isValid) {
                await reportPaymentSecurityAlert('invalid_signature', {
                    ip: req.ip,
                    timestamp,
                });
                return res.status(401).json({ code: 'FAIL', message: 'Invalid signature' });
            }
        }
        const { resource } = parsedBody || {};
        const decrypted = isMockMode ? parsedBody || {} : await weChatPayService.decryptResource(resource);
        if (decrypted.trade_state === 'SUCCESS') {
            const orderId = resolveOrderIdFromWeChatOutTradeNo(String(decrypted.out_trade_no || ''));
            const transactionId = String(decrypted.transaction_id || '').trim();
            if (!orderId) {
                return res.status(200).json({ code: 'SUCCESS', message: 'Order id missing' });
            }
            const idemSource = `${orderId}:${transactionId || 'no_tx'}:success`;
            const idemKey = buildIdempotencyKey([
                'payment',
                'wechat_notify',
                createRequestFingerprint(idemSource),
            ]);
            try {
                await runIdempotent(idemKey, async () => {
                    await processPaymentSuccess(orderId, { transactionId });
                    return { ok: true };
                }, { ttlSeconds: 24 * 60 * 60, lockSeconds: 120 });
            }
            catch (error) {
                if (isIdempotencyLockedError(error) || isOrderLockedError(error)) {
                    return res.status(200).json({ code: 'SUCCESS', message: 'Order is being processed' });
                }
                throw error;
            }
        }
        res.status(200).json({ code: 'SUCCESS', message: 'OK' });
    }
    catch (err) {
        console.error('Webhook Error:', err);
        res.status(500).json({ code: 'FAIL', message: 'Error' });
    }
});
export async function processPaymentSuccess(orderId, options) {
    try {
        await withOrderLock(orderId, 'payment_success', async () => {
            await sequelize.transaction(async (transaction) => {
                const order = await Order.findByPk(orderId, {
                    transaction,
                    lock: transaction.LOCK.UPDATE,
                });
                if (!order || order.status === 'completed')
                    return;
                if (order.status === 'refunded') {
                    throw new ApiError({
                        status: 409,
                        code: 'ORDER_ALREADY_REFUNDED',
                        message: '订单已退款，不能重复到账',
                        retryable: false,
                    });
                }
                const user = await User.findByPk(order.userId, {
                    transaction,
                    lock: transaction.LOCK.UPDATE,
                });
                if (!user) {
                    throw new ApiError({
                        status: 404,
                        code: 'PAYMENT_USER_NOT_FOUND',
                        message: '订单用户不存在',
                        retryable: false,
                    });
                }
                const planKey = order.planKey || inferPlanKeyFromOrderPlan(order.plan);
                const snapshot = parsePlanSnapshot(order.planSnapshot);
                const planFromConfig = planKey ? PAYMENT_PLANS[planKey] : null;
                const plan = snapshot || planFromConfig;
                if (!planKey || !plan) {
                    throw new ApiError({
                        status: 400,
                        code: 'PAYMENT_PLAN_INVALID',
                        message: `订单套餐无效: ${orderId}`,
                        retryable: false,
                    });
                }
                let tokenCreditAmount = 0;
                let tokenCreditType = '';
                let membershipUpdated = false;
                if (planKey.includes('token')) {
                    tokenCreditAmount = Number(plan.tokens || 0);
                    tokenCreditType = 'topup';
                }
                else {
                    let currentExpire = user.membershipExpireAt ? new Date(user.membershipExpireAt) : new Date();
                    if (currentExpire < new Date()) {
                        currentExpire = new Date();
                    }
                    currentExpire.setDate(currentExpire.getDate() + Number(plan.durationDays || 0));
                    const level = planKey === 'yearly' ? 'premium' : 'pro';
                    user.membershipLevel = level;
                    user.membershipExpireAt = currentExpire;
                    membershipUpdated = true;
                    const tier = MEMBERSHIP_PLAN_MATRIX.find((t) => t.key === level);
                    if (tier) {
                        tokenCreditAmount = Number(tier.monthlyTokens || 0);
                        tokenCreditType = 'membership_bonus';
                    }
                }
                if (membershipUpdated) {
                    await user.save({ transaction });
                }
                if (tokenCreditAmount > 0) {
                    await recordTokenUsage(user.id, tokenCreditAmount, tokenCreditType, 'system', {
                        orderId,
                        planKey,
                    }, { transaction });
                }
                order.status = 'completed';
                if (!order.planKey)
                    order.planKey = planKey;
                if (!order.planSnapshot && planFromConfig) {
                    order.planSnapshot = makePlanSnapshot(planKey, planFromConfig);
                }
                if (options?.transactionId) {
                    order.transactionId = options.transactionId;
                }
                else if (!order.transactionId) {
                    order.transactionId = `MOCK_${Date.now()}`;
                }
                await order.save({ transaction });
                await redisClient.del(`user:${user.id}`);
                console.log(`Order ${orderId} processed for User ${user.id}`);
            });
        });
        metricCounters.paymentSuccess();
    }
    catch (err) {
        if (isOrderLockedError(err)) {
            throw err;
        }
        metricCounters.paymentFailed();
        captureError(err, { scope: 'payment.processSuccess', orderId });
        throw err;
    }
}

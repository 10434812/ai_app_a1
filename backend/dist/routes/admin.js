import express from 'express';
import { Op } from 'sequelize';
import { getMetrics, getUsers, toggleUserStatus } from '../services/userService.js';
import { getAnalysisStats, getUserPortraits, getRecentQuestions, getCostDashboard, getRetentionStats, getTokenEconomicsDashboard, } from '../services/analysisService.js';
import { ALL_MODELS } from '../services/llm/config.js';
import { SystemConfig } from '../models/SystemConfig.js';
import { countActiveModels, getModelStatusMap, setModelActive } from '../services/modelStatusService.js';
import { Order } from '../models/Order.js';
import { OrderAuditLog } from '../models/OrderAuditLog.js';
import { User } from '../models/User.js';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { requireAdmin } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { PAYMENT_PLANS, inferPlanKeyFromOrderPlan, parsePlanSnapshot } from '../config/paymentPlans.js';
import { recordTokenUsage } from '../services/tokenService.js';
import { calculateChatCost, getBillingConfig, updateBillingConfig } from '../services/billingConfigService.js';
import { getObservabilitySummary } from '../services/observabilityService.js';
import { TokenUsageRecord } from '../models/TokenUsageRecord.js';
import { VisitLog } from '../models/VisitLog.js';
import { MediaTask } from '../models/MediaTask.js';
import { processPaymentSuccess } from './payment.js';
import { captureError } from '../services/observabilityService.js';
import { sequelize } from '../config/db.js';
import redisClient from '../config/redis.js';
import { sendError } from '../errors/api.js';
import { buildIdempotencyKey, createRequestFingerprint, runIdempotent, withOrderLock } from '../services/idempotencyService.js';
import { getExportableSystemConfigs, upsertSystemConfigs } from '../services/configSyncService.js';
import { weChatPayService } from '../services/payment/wechat.js';
const router = express.Router();
router.use(requireAdmin);
const buildWeChatOutTradeNo = (orderId) => orderId.replace(/-/g, '').slice(0, 32);
const readIdempotencyToken = (req) => {
    const value = String(req.headers['idempotency-key'] || req.headers['x-idempotency-key'] || req.body?.idempotencyKey || '').trim();
    return value.slice(0, 128);
};
const isLockedError = (error) => {
    const message = String(error?.message || '');
    return message === 'IDEMPOTENCY_LOCKED' || message.startsWith('ORDER_LOCKED:');
};
const requireActionConfirmation = (req, res, actionLabel) => {
    const confirmed = String(req.body?.confirm || '').toLowerCase();
    const pass = confirmed === 'true' || confirmed === '1' || confirmed === 'confirm' || confirmed === 'yes';
    if (pass)
        return true;
    sendError(res, {
        status: 400,
        code: 'ADMIN_CONFIRM_REQUIRED',
        message: `${actionLabel} 为敏感操作，请二次确认后再执行`,
        retryable: false,
    });
    return false;
};
// Orders
router.get('/orders', requirePermission('orders:read'), async (req, res) => {
    try {
        const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
        const limit = Math.min(200, Math.max(1, Number.parseInt(String(req.query.limit || '50'), 10) || 50));
        const offset = (page - 1) * limit;
        const q = String(req.query.q || '').trim();
        const status = String(req.query.status || '').trim();
        const planKey = String(req.query.planKey || '').trim();
        const userId = String(req.query.userId || '').trim();
        const paymentMethod = String(req.query.paymentMethod || '').trim();
        const where = {};
        if (status)
            where.status = status;
        if (planKey)
            where.planKey = planKey;
        if (userId)
            where.userId = userId;
        if (paymentMethod)
            where.paymentMethod = paymentMethod;
        if (q) {
            where[Op.or] = [{ id: { [Op.like]: `%${q}%` } }, { transactionId: { [Op.like]: `%${q}%` } }];
        }
        const { rows, count } = await Order.findAndCountAll({
            where,
            order: [['createdAt', 'DESC']],
            include: [
                {
                    model: User,
                    attributes: ['id', 'name', 'email'],
                },
            ],
            offset,
            limit,
        });
        res.json({
            rows,
            total: count,
            page,
            limit,
            totalPages: Math.max(1, Math.ceil(count / limit)),
        });
    }
    catch (error) {
        captureError(error, { scope: 'admin.orders.list' });
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});
const buildOrderSnapshot = (order) => ({
    id: order.id,
    userId: order.userId,
    amount: order.amount,
    plan: order.plan,
    planKey: order.planKey,
    status: order.status,
    paymentMethod: order.paymentMethod,
    transactionId: order.transactionId,
    refundedAmount: order.refundedAmount,
    refundedAt: order.refundedAt,
});
const appendOrderAudit = async (payload) => {
    await OrderAuditLog.create({
        orderId: payload.orderId,
        actorUserId: payload.actorUserId ?? null,
        action: payload.action,
        beforeSnapshot: payload.beforeSnapshot ? JSON.stringify(payload.beforeSnapshot) : null,
        afterSnapshot: payload.afterSnapshot ? JSON.stringify(payload.afterSnapshot) : null,
        note: payload.note || null,
    }, payload.transaction ? { transaction: payload.transaction } : undefined);
};
router.get('/orders/audits', requirePermission('audit:read'), async (req, res) => {
    try {
        const orderId = String(req.query.orderId || '').trim();
        const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
        const limit = Math.min(200, Math.max(1, Number.parseInt(String(req.query.limit || '50'), 10) || 50));
        const offset = (page - 1) * limit;
        const where = {};
        if (orderId)
            where.orderId = orderId;
        const { rows, count } = await OrderAuditLog.findAndCountAll({
            where,
            order: [['createdAt', 'DESC']],
            include: [
                {
                    model: User,
                    attributes: ['id', 'name', 'email'],
                },
            ],
            offset,
            limit,
        });
        res.json({
            rows,
            total: count,
            page,
            limit,
            totalPages: Math.max(1, Math.ceil(count / limit)),
        });
    }
    catch (error) {
        captureError(error, { scope: 'admin.orders.audits' });
        res.status(500).json({ error: 'Failed to fetch order audit logs' });
    }
});
router.post('/orders/:id/repair', requirePermission('orders:operate'), async (req, res) => {
    try {
        if (!requireActionConfirmation(req, res, '修复订单状态'))
            return;
        const orderId = req.params.id;
        const status = String(req.body?.status || '').trim();
        const note = String(req.body?.note || '').trim();
        const actorUserId = req.user?.id || 'unknown';
        if (!['pending', 'completed', 'failed', 'refunded'].includes(status)) {
            return sendError(res, {
                status: 400,
                code: 'ORDER_STATUS_INVALID',
                message: '目标状态无效',
                retryable: false,
            });
        }
        const idemToken = readIdempotencyToken(req) || createRequestFingerprint({ orderId, status, note, actorUserId });
        const idemKey = buildIdempotencyKey(['admin', 'order_repair', actorUserId, orderId, idemToken]);
        const result = await runIdempotent(idemKey, async () => {
            return withOrderLock(orderId, 'repair', async () => {
                return sequelize.transaction(async (transaction) => {
                    const order = await Order.findByPk(orderId, {
                        transaction,
                        lock: transaction.LOCK.UPDATE,
                    });
                    if (!order) {
                        throw new Error('ORDER_NOT_FOUND');
                    }
                    const before = buildOrderSnapshot(order);
                    order.status = status;
                    if (status !== 'refunded') {
                        order.refundedAmount = null;
                        order.refundedAt = null;
                    }
                    await order.save({ transaction });
                    const after = buildOrderSnapshot(order);
                    await appendOrderAudit({
                        orderId,
                        actorUserId: req.user?.id || null,
                        action: 'repair_status',
                        beforeSnapshot: before,
                        afterSnapshot: after,
                        note,
                        transaction,
                    });
                    return { success: true, order: order.toJSON() };
                });
            });
        }, { ttlSeconds: 20 * 60, lockSeconds: 45 });
        res.json({ ...result.data, replayed: result.replayed });
    }
    catch (error) {
        if (String(error?.message || '') === 'ORDER_NOT_FOUND') {
            return sendError(res, {
                status: 404,
                code: 'ORDER_NOT_FOUND',
                message: '订单不存在',
                retryable: false,
            });
        }
        if (isLockedError(error)) {
            return sendError(res, {
                status: 409,
                code: 'ORDER_OPERATION_IN_PROGRESS',
                message: '订单操作处理中，请稍后再试',
                retryable: true,
            });
        }
        captureError(error, { scope: 'admin.orders.repair', orderId: req.params.id });
        sendError(res, {
            status: 500,
            code: 'ORDER_REPAIR_FAILED',
            message: '修复订单状态失败',
            retryable: true,
        });
    }
});
router.post('/orders/:id/manual-complete', requirePermission('orders:operate'), async (req, res) => {
    try {
        if (!requireActionConfirmation(req, res, '手动补单'))
            return;
        const orderId = req.params.id;
        const note = String(req.body?.note || '').trim();
        const actorUserId = req.user?.id || 'unknown';
        const idemToken = readIdempotencyToken(req) || createRequestFingerprint({ orderId, note, actorUserId });
        const idemKey = buildIdempotencyKey(['admin', 'order_manual_complete', actorUserId, orderId, idemToken]);
        const result = await runIdempotent(idemKey, async () => {
            const before = await Order.findByPk(orderId);
            if (!before) {
                throw new Error('ORDER_NOT_FOUND');
            }
            const beforeSnapshot = buildOrderSnapshot(before);
            await processPaymentSuccess(orderId);
            const latest = await Order.findByPk(orderId);
            const afterSnapshot = latest ? buildOrderSnapshot(latest) : beforeSnapshot;
            await appendOrderAudit({
                orderId,
                actorUserId: req.user?.id || null,
                action: 'manual_complete',
                beforeSnapshot,
                afterSnapshot,
                note,
            });
            return { success: true, order: latest || before };
        }, { ttlSeconds: 20 * 60, lockSeconds: 45 });
        res.json({ ...result.data, replayed: result.replayed });
    }
    catch (error) {
        if (String(error?.message || '') === 'ORDER_NOT_FOUND') {
            return sendError(res, {
                status: 404,
                code: 'ORDER_NOT_FOUND',
                message: '订单不存在',
                retryable: false,
            });
        }
        if (isLockedError(error)) {
            return sendError(res, {
                status: 409,
                code: 'ORDER_OPERATION_IN_PROGRESS',
                message: '订单操作处理中，请稍后再试',
                retryable: true,
            });
        }
        captureError(error, { scope: 'admin.orders.manual_complete', orderId: req.params.id });
        sendError(res, {
            status: 500,
            code: 'ORDER_MANUAL_COMPLETE_FAILED',
            message: '手动补单失败',
            retryable: true,
        });
    }
});
router.post('/orders/:id/manual-refund', requirePermission('orders:operate'), async (req, res) => {
    try {
        if (!requireActionConfirmation(req, res, '手动退款'))
            return;
        const orderId = req.params.id;
        const note = String(req.body?.note || '').trim();
        const refundAmount = Number(req.body?.refundAmount || 0);
        if (Number.isFinite(refundAmount) && refundAmount < 0) {
            return sendError(res, {
                status: 400,
                code: 'ORDER_REFUND_AMOUNT_INVALID',
                message: '退款金额不能小于 0',
                retryable: false,
            });
        }
        const actorUserId = req.user?.id || 'unknown';
        const idemToken = readIdempotencyToken(req) || createRequestFingerprint({ orderId, note, refundAmount, actorUserId });
        const idemKey = buildIdempotencyKey(['admin', 'order_manual_refund', actorUserId, orderId, idemToken]);
        const result = await runIdempotent(idemKey, async () => {
            return withOrderLock(orderId, 'manual_refund', async () => {
                return sequelize.transaction(async (transaction) => {
                    const order = await Order.findByPk(orderId, {
                        transaction,
                        lock: transaction.LOCK.UPDATE,
                    });
                    if (!order)
                        throw new Error('ORDER_NOT_FOUND');
                    if (order.status !== 'completed')
                        throw new Error('ORDER_NOT_COMPLETED');
                    if (Number.isFinite(refundAmount) && refundAmount > Number(order.amount || 0)) {
                        throw new Error('ORDER_REFUND_AMOUNT_TOO_LARGE');
                    }
                    const user = await User.findByPk(order.userId, {
                        transaction,
                        lock: transaction.LOCK.UPDATE,
                    });
                    if (!user)
                        throw new Error('ORDER_USER_NOT_FOUND');
                    const before = buildOrderSnapshot(order);
                    const planKey = order.planKey || inferPlanKeyFromOrderPlan(order.plan);
                    const snapshot = parsePlanSnapshot(order.planSnapshot);
                    const plan = (planKey ? PAYMENT_PLANS[planKey] : null) || snapshot;
                    const normalizedPlanKey = String(planKey || '');
                    const effectiveRefundAmount = Number.isFinite(refundAmount) && refundAmount > 0 ? refundAmount : Number(order.amount || 0);
                    const isWechatOrder = ['wechat', 'wechat_native', 'wechat_jsapi'].includes(String(order.paymentMethod || ''));
                    let refundExecutionSummary = 'bookkeeping_only';
                    if (isWechatOrder) {
                        const refundResult = await weChatPayService.createRefund({
                            orderId,
                            transactionId: order.transactionId || undefined,
                            outTradeNo: buildWeChatOutTradeNo(order.id),
                            refundAmount: effectiveRefundAmount,
                            totalAmount: Number(order.amount || 0),
                            reason: note || 'manual_refund',
                        });
                        refundExecutionSummary = refundResult.mock
                            ? `wechat_mock:${refundResult.outRefundNo}`
                            : `wechat_live:${refundResult.refundId || refundResult.outRefundNo}:${refundResult.status || 'accepted'}`;
                    }
                    if (normalizedPlanKey.includes('token')) {
                        const tokenAmount = Number(plan?.tokens || 0);
                        if (tokenAmount > 0) {
                            await recordTokenUsage(user.id, tokenAmount, 'refund', 'system', {
                                orderId,
                                reason: note || 'manual_refund',
                            }, { transaction });
                        }
                    }
                    else {
                        // Membership refunds are business-sensitive and may involve partial periods.
                        // Here we only mark order refunded and leave membership adjustments to manual ops.
                    }
                    order.status = 'refunded';
                    order.refundedAmount = effectiveRefundAmount;
                    order.refundedAt = new Date();
                    await order.save({ transaction });
                    const after = buildOrderSnapshot(order);
                    await appendOrderAudit({
                        orderId,
                        actorUserId: req.user?.id || null,
                        action: 'manual_refund',
                        beforeSnapshot: before,
                        afterSnapshot: after,
                        note: [note, refundExecutionSummary].filter(Boolean).join(' | '),
                        transaction,
                    });
                    return { success: true, order: order.toJSON() };
                });
            });
        }, { ttlSeconds: 20 * 60, lockSeconds: 45 });
        res.json({ ...result.data, replayed: result.replayed });
    }
    catch (error) {
        const message = String(error?.message || '');
        if (message === 'ORDER_NOT_FOUND') {
            return sendError(res, {
                status: 404,
                code: 'ORDER_NOT_FOUND',
                message: '订单不存在',
                retryable: false,
            });
        }
        if (message === 'ORDER_USER_NOT_FOUND') {
            return sendError(res, {
                status: 404,
                code: 'ORDER_USER_NOT_FOUND',
                message: '订单用户不存在',
                retryable: false,
            });
        }
        if (message === 'ORDER_NOT_COMPLETED') {
            return sendError(res, {
                status: 400,
                code: 'ORDER_NOT_COMPLETED',
                message: '仅已完成订单可退款',
                retryable: false,
            });
        }
        if (message === 'ORDER_REFUND_AMOUNT_TOO_LARGE') {
            return sendError(res, {
                status: 400,
                code: 'ORDER_REFUND_AMOUNT_TOO_LARGE',
                message: '退款金额不能超过原订单金额',
                retryable: false,
            });
        }
        if (String(error?.message || '').includes('Insufficient balance')) {
            return sendError(res, {
                status: 400,
                code: 'REFUND_INSUFFICIENT_BALANCE',
                message: '用户余额不足，无法执行自动退款扣回，请先人工处理账户余额',
                retryable: false,
            });
        }
        if (isLockedError(error)) {
            return sendError(res, {
                status: 409,
                code: 'ORDER_OPERATION_IN_PROGRESS',
                message: '订单操作处理中，请稍后再试',
                retryable: true,
            });
        }
        captureError(error, { scope: 'admin.orders.manual_refund', orderId: req.params.id });
        sendError(res, {
            status: 500,
            code: 'ORDER_MANUAL_REFUND_FAILED',
            message: message || '手动退款失败',
            retryable: true,
        });
    }
});
// Config Keys
router.get('/config/keys', requirePermission('settings:manage'), async (req, res) => {
    try {
        const keys = await SystemConfig.findAll();
        // Map existing keys to models to show which ones are missing or set
        const modelKeys = ALL_MODELS.filter((m) => m.apiConfig).map((m) => ({
            key: m.apiConfig.apiKeyEnv,
            name: m.name,
            modelId: m.id,
        }));
        // Merge DB keys with model requirements
        const result = modelKeys.map((mk) => {
            const dbKey = keys.find((k) => k.key === mk.key);
            return {
                key: mk.key,
                name: mk.name,
                value: dbKey ? dbKey.value : '', // Mask logic could be added here
                description: `API Key for ${mk.name}`,
            };
        });
        // Also include any other keys in DB that might not match current models (optional)
        res.json(result);
    }
    catch (error) {
        console.error('Fetch keys error:', error);
        res.status(500).json({ error: 'Failed to fetch keys' });
    }
});
router.post('/config/keys', requirePermission('settings:manage'), async (req, res) => {
    const { key, value } = req.body;
    try {
        if (!key)
            return res.status(400).json({ error: 'Key is required' });
        const [config, created] = await SystemConfig.findOrCreate({
            where: { key },
            defaults: { value },
        });
        if (!created) {
            config.value = value;
            await config.save();
        }
        res.json({ success: true, key, value: '******' }); // Don't return full key
    }
    catch (error) {
        console.error('Update key error:', error);
        res.status(500).json({ error: 'Failed to update key' });
    }
});
// General Settings
router.get('/config/general', requirePermission('settings:read'), async (req, res) => {
    try {
        const keys = [
            'site_name',
            'enable_registration',
            'default_quota',
            'welcome_message',
            'guest_trial_limit',
            'multi_model_trial_limit',
            'WECHAT_APP_ID',
            'WECHAT_APP_SECRET',
            'WECHAT_SHARE_TITLE',
            'WECHAT_SHARE_DESC',
            'WECHAT_SHARE_IMG',
            'WECHAT_SHARE_LINK',
            'WECHAT_PAY_ENABLED',
            'WECHAT_PAY_MOCK_MODE',
            'WECHAT_PAY_APP_ID',
            'WECHAT_PAY_MCH_ID',
            'WECHAT_PAY_API_V3_KEY',
            'WECHAT_PAY_CERT_SERIAL_NO',
            'WECHAT_PAY_CERT_PEM',
            'WECHAT_PAY_PRIVATE_KEY',
            'WECHAT_PAY_NOTIFY_URL',
            'IMAGE_GEN_ENABLED',
            'IMAGE_DEFAULT_PROVIDER',
            'IMAGE_DEFAULT_SIZE',
            'IMAGE_MAX_IMAGES_PER_REQUEST',
            'ALIYUN_IMAGE_MODEL',
            'ALIYUN_IMAGE_API_KEY',
            'ZHIPU_IMAGE_MODEL',
            'ZHIPU_IMAGE_API_KEY',
            'SILICONFLOW_IMAGE_MODEL',
            'SILICONFLOW_IMAGE_API_KEY',
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
        const configs = await SystemConfig.findAll({
            where: {
                key: keys,
            },
        });
        // Default settings
        const settings = {
            site_name: 'AI 智能助手',
            enable_registration: 'true',
            default_quota: '5000',
            welcome_message: '欢迎使用 AI 智能助手！',
            guest_trial_limit: '100',
            multi_model_trial_limit: '10',
            WECHAT_APP_ID: '',
            WECHAT_APP_SECRET: '',
            WECHAT_SHARE_TITLE: 'AI 智能助手',
            WECHAT_SHARE_DESC: '汇聚全球顶尖大模型，为您提供智能问答服务',
            WECHAT_SHARE_IMG: '',
            WECHAT_SHARE_LINK: '',
            WECHAT_PAY_ENABLED: 'false',
            WECHAT_PAY_MOCK_MODE: process.env.NODE_ENV === 'production' ? 'false' : 'true',
            WECHAT_PAY_APP_ID: '',
            WECHAT_PAY_MCH_ID: '',
            WECHAT_PAY_API_V3_KEY: '',
            WECHAT_PAY_CERT_SERIAL_NO: '',
            WECHAT_PAY_CERT_PEM: '',
            WECHAT_PAY_PRIVATE_KEY: '',
            WECHAT_PAY_NOTIFY_URL: '',
            IMAGE_GEN_ENABLED: 'true',
            IMAGE_DEFAULT_PROVIDER: 'aliyun',
            IMAGE_DEFAULT_SIZE: '1024x1024',
            IMAGE_MAX_IMAGES_PER_REQUEST: '2',
            ALIYUN_IMAGE_MODEL: 'wanx2.0-t2i-turbo',
            ALIYUN_IMAGE_API_KEY: '',
            ZHIPU_IMAGE_MODEL: 'cogview-4-250304',
            ZHIPU_IMAGE_API_KEY: '',
            SILICONFLOW_IMAGE_MODEL: 'Kwai-Kolors/Kolors',
            SILICONFLOW_IMAGE_API_KEY: '',
            RATE_LIMIT_WHITELIST_IPS: '',
            RATE_LIMIT_BLACKLIST_IPS: '',
            RATE_LIMIT_WHITELIST_USERS: '',
            RATE_LIMIT_BLACKLIST_USERS: '',
            RATE_LIMIT_PEAK_HOURS: '09-23',
            RATE_LIMIT_PEAK_FACTOR: '0.9',
            RATE_LIMIT_OFFPEAK_FACTOR: '1.15',
            RATE_LIMIT_REPUTATION_THRESHOLD: '20',
            RATE_LIMIT_REPUTATION_PENALTY: '0.7',
            RATE_LIMIT_FACTOR_FREE: '1',
            RATE_LIMIT_FACTOR_PRO: '1.6',
            RATE_LIMIT_FACTOR_PREMIUM: '2.4',
        };
        configs.forEach((c) => {
            settings[c.key] = c.value;
        });
        res.json(settings);
    }
    catch (error) {
        console.error('Fetch general settings error:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});
router.post('/config/general/wechat-pay/test', requirePermission('settings:manage'), async (req, res) => {
    try {
        const parseOptionalBoolean = (value) => {
            if (value === undefined || value === null || value === '')
                return undefined;
            return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
        };
        const result = await weChatPayService.testConfiguration({
            enabled: parseOptionalBoolean(req.body?.WECHAT_PAY_ENABLED),
            mockMode: parseOptionalBoolean(req.body?.WECHAT_PAY_MOCK_MODE),
            appId: typeof req.body?.WECHAT_PAY_APP_ID === 'string' ? req.body.WECHAT_PAY_APP_ID : undefined,
            mchId: typeof req.body?.WECHAT_PAY_MCH_ID === 'string' ? req.body.WECHAT_PAY_MCH_ID : undefined,
            apiV3Key: typeof req.body?.WECHAT_PAY_API_V3_KEY === 'string' ? req.body.WECHAT_PAY_API_V3_KEY : undefined,
            certSerialNo: typeof req.body?.WECHAT_PAY_CERT_SERIAL_NO === 'string' ? req.body.WECHAT_PAY_CERT_SERIAL_NO : undefined,
            certPem: typeof req.body?.WECHAT_PAY_CERT_PEM === 'string' ? req.body.WECHAT_PAY_CERT_PEM : undefined,
            privateKey: typeof req.body?.WECHAT_PAY_PRIVATE_KEY === 'string' ? req.body.WECHAT_PAY_PRIVATE_KEY : undefined,
            notifyUrl: typeof req.body?.WECHAT_PAY_NOTIFY_URL === 'string' ? req.body.WECHAT_PAY_NOTIFY_URL : undefined,
        });
        res.json(result);
    }
    catch (error) {
        captureError(error, { scope: 'admin.settings.wechat_pay_test' });
        sendError(res, {
            status: 400,
            code: 'WECHAT_PAY_TEST_FAILED',
            message: String(error?.message || '微信支付配置测试失败'),
            retryable: false,
        });
    }
});
router.post('/config/general', requirePermission('settings:manage'), async (req, res) => {
    try {
        const settings = req.body;
        const keys = [
            'site_name',
            'enable_registration',
            'default_quota',
            'welcome_message',
            'guest_trial_limit',
            'multi_model_trial_limit',
            'WECHAT_APP_ID',
            'WECHAT_APP_SECRET',
            'WECHAT_SHARE_TITLE',
            'WECHAT_SHARE_DESC',
            'WECHAT_SHARE_IMG',
            'WECHAT_SHARE_LINK',
            'WECHAT_PAY_ENABLED',
            'WECHAT_PAY_MOCK_MODE',
            'WECHAT_PAY_APP_ID',
            'WECHAT_PAY_MCH_ID',
            'WECHAT_PAY_API_V3_KEY',
            'WECHAT_PAY_CERT_SERIAL_NO',
            'WECHAT_PAY_CERT_PEM',
            'WECHAT_PAY_PRIVATE_KEY',
            'WECHAT_PAY_NOTIFY_URL',
            'IMAGE_GEN_ENABLED',
            'IMAGE_DEFAULT_PROVIDER',
            'IMAGE_DEFAULT_SIZE',
            'IMAGE_MAX_IMAGES_PER_REQUEST',
            'ALIYUN_IMAGE_MODEL',
            'ALIYUN_IMAGE_API_KEY',
            'ZHIPU_IMAGE_MODEL',
            'ZHIPU_IMAGE_API_KEY',
            'SILICONFLOW_IMAGE_MODEL',
            'SILICONFLOW_IMAGE_API_KEY',
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
        for (const key of keys) {
            if (settings[key] !== undefined) {
                const [config] = await SystemConfig.findOrCreate({
                    where: { key },
                    defaults: { value: String(settings[key]) },
                });
                config.value = String(settings[key]);
                await config.save();
            }
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error('Update general settings error:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});
router.get('/config/export', requirePermission('settings:read'), async (req, res) => {
    try {
        const scope = req.query.scope === 'all' ? 'all' : 'deployment';
        const rows = await getExportableSystemConfigs(scope);
        const payload = {
            version: 1,
            exportedAt: new Date().toISOString(),
            scope,
            rowCount: rows.length,
            rows,
        };
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=\"ai-app-config-${Date.now()}.json\"`);
        res.json(payload);
    }
    catch (error) {
        captureError(error, { scope: 'admin.config.export' });
        res.status(500).json({ error: 'Failed to export config' });
    }
});
router.post('/config/import', requirePermission('settings:manage'), async (req, res) => {
    try {
        const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
        if (!rows.length) {
            return res.status(400).json({ error: 'Config rows are required' });
        }
        const normalizedRows = rows.map((row) => {
            if (!row || typeof row.key !== 'string' || !row.key.trim()) {
                throw new Error('Invalid config row');
            }
            return {
                key: row.key.trim(),
                value: row.value === null || row.value === undefined ? null : String(row.value),
                description: row.description === null || row.description === undefined ? null : String(row.description),
            };
        });
        await upsertSystemConfigs(normalizedRows);
        res.json({
            success: true,
            imported: normalizedRows.length,
        });
    }
    catch (error) {
        captureError(error, { scope: 'admin.config.import' });
        res.status(500).json({ error: 'Failed to import config' });
    }
});
// Billing Config
router.get('/billing/config', requirePermission('billing:read'), async (_req, res) => {
    try {
        const config = await getBillingConfig();
        res.json(config);
    }
    catch (error) {
        captureError(error, { scope: 'admin.billing.get' });
        res.status(500).json({ error: 'Failed to fetch billing config' });
    }
});
router.post('/billing/config', requirePermission('billing:manage'), async (req, res) => {
    try {
        const updated = await updateBillingConfig(req.body || {});
        res.json({ success: true, config: updated });
    }
    catch (error) {
        captureError(error, { scope: 'admin.billing.update' });
        res.status(500).json({ error: 'Failed to update billing config' });
    }
});
router.post('/billing/preview', requirePermission('billing:read'), async (req, res) => {
    try {
        const { modelId, promptTokens = 0, completionTokens = 0 } = req.body || {};
        const config = await getBillingConfig();
        const cost = calculateChatCost(config, String(modelId || 'unknown'), Number(promptTokens) || 0, Number(completionTokens) || 0);
        res.json({ cost });
    }
    catch (error) {
        captureError(error, { scope: 'admin.billing.preview' });
        res.status(500).json({ error: 'Failed to preview billing' });
    }
});
// Metrics
router.get('/metrics', requirePermission('dashboard:view'), async (req, res) => {
    const metrics = await getMetrics();
    const activeModelsCount = await countActiveModels();
    res.json({ ...metrics, activeModels: activeModelsCount });
});
router.get('/observability', requirePermission('dashboard:view'), async (_req, res) => {
    try {
        const summary = await getObservabilitySummary();
        res.json(summary);
    }
    catch (error) {
        captureError(error, { scope: 'admin.observability' });
        res.status(500).json({ error: 'Failed to fetch observability metrics' });
    }
});
// Analysis Routes
router.get('/analysis/stats', requirePermission('analysis:read'), async (req, res) => {
    try {
        const stats = await getAnalysisStats();
        res.json(stats);
    }
    catch (error) {
        console.error('Analysis stats error:', error);
        res.status(500).json({ error: 'Failed to fetch analysis stats' });
    }
});
router.get('/analysis/portraits', requirePermission('analysis:read'), async (req, res) => {
    try {
        const portraits = await getUserPortraits();
        res.json(portraits);
    }
    catch (error) {
        console.error('User portraits error:', error);
        res.status(500).json({ error: 'Failed to fetch user portraits' });
    }
});
router.get('/analysis/questions', requirePermission('analysis:read'), async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const questions = await getRecentQuestions(limit);
        res.json(questions);
    }
    catch (error) {
        console.error('Recent questions error:', error);
        res.status(500).json({ error: 'Failed to fetch recent questions' });
    }
});
router.get('/analysis/costs', requirePermission('analysis:read'), async (req, res) => {
    try {
        const costs = await getCostDashboard();
        res.json(costs);
    }
    catch (error) {
        console.error('Cost dashboard error:', error);
        res.status(500).json({ error: 'Failed to fetch cost dashboard' });
    }
});
router.get('/analysis/retention', requirePermission('analysis:read'), async (req, res) => {
    try {
        const retention = await getRetentionStats();
        res.json(retention);
    }
    catch (error) {
        console.error('Retention stats error:', error);
        res.status(500).json({ error: 'Failed to fetch retention stats' });
    }
});
router.get('/analysis/economics', requirePermission('analysis:read'), async (req, res) => {
    try {
        const days = Number.parseInt(String(req.query.days || '30'), 10) || 30;
        const dashboard = await getTokenEconomicsDashboard(days);
        res.json(dashboard);
    }
    catch (error) {
        captureError(error, { scope: 'admin.analysis.economics' });
        res.status(500).json({ error: 'Failed to fetch economics dashboard' });
    }
});
const escapeCsv = (value) => {
    const str = String(value ?? '');
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
};
router.get('/export/orders.csv', requirePermission('export:read'), async (req, res) => {
    try {
        const status = String(req.query.status || '').trim();
        const start = String(req.query.start || '').trim();
        const end = String(req.query.end || '').trim();
        const where = {};
        if (status)
            where.status = status;
        if (start || end) {
            where.createdAt = {};
            if (start)
                where.createdAt[Op.gte] = new Date(`${start}T00:00:00`);
            if (end)
                where.createdAt[Op.lte] = new Date(`${end}T23:59:59`);
        }
        const rows = await Order.findAll({
            where,
            order: [['createdAt', 'DESC']],
            limit: 20000,
            include: [{ model: User, attributes: ['id', 'name', 'email'] }],
        });
        const header = [
            'orderId',
            'userId',
            'userEmail',
            'plan',
            'planKey',
            'amount',
            'status',
            'paymentMethod',
            'transactionId',
            'refundedAmount',
            'refundedAt',
            'createdAt',
        ];
        const lines = rows.map((order) => [
            order.id,
            order.userId,
            order.user?.email || '',
            order.plan,
            order.planKey || '',
            order.amount,
            order.status,
            order.paymentMethod,
            order.transactionId || '',
            order.refundedAmount || '',
            order.refundedAt || '',
            order.createdAt,
        ]
            .map(escapeCsv)
            .join(','));
        const csv = [header.join(','), ...lines].join('\n');
        res.header('Content-Type', 'text/csv');
        res.attachment('orders_export.csv');
        res.send(csv);
    }
    catch (error) {
        captureError(error, { scope: 'admin.export.orders' });
        res.status(500).json({ error: 'Failed to export orders' });
    }
});
router.get('/export/tokens.csv', requirePermission('export:read'), async (req, res) => {
    try {
        const type = String(req.query.type || '').trim();
        const model = String(req.query.model || '').trim();
        const start = String(req.query.start || '').trim();
        const end = String(req.query.end || '').trim();
        const where = {};
        if (type)
            where.type = type;
        if (model)
            where.model = model;
        if (start || end) {
            where.createdAt = {};
            if (start)
                where.createdAt[Op.gte] = new Date(`${start}T00:00:00`);
            if (end)
                where.createdAt[Op.lte] = new Date(`${end}T23:59:59`);
        }
        const rows = await TokenUsageRecord.findAll({
            where,
            order: [['createdAt', 'DESC']],
            limit: 50000,
            include: [{ model: User, attributes: ['id', 'email', 'name'] }],
        });
        const header = ['recordId', 'userId', 'userEmail', 'type', 'model', 'amount', 'balanceAfter', 'createdAt'];
        const lines = rows.map((record) => [
            record.id,
            record.userId,
            record.user?.email || '',
            record.type,
            record.model || '',
            record.amount,
            record.balanceAfter,
            record.createdAt,
        ]
            .map(escapeCsv)
            .join(','));
        const csv = [header.join(','), ...lines].join('\n');
        res.header('Content-Type', 'text/csv');
        res.attachment('token_usage_export.csv');
        res.send(csv);
    }
    catch (error) {
        captureError(error, { scope: 'admin.export.tokens' });
        res.status(500).json({ error: 'Failed to export token usage' });
    }
});
router.post('/data/archive', requirePermission('archive:execute'), async (req, res) => {
    try {
        const dryRun = req.body?.dryRun !== false;
        const days = Math.max(7, Math.min(3650, Number(req.body?.days || 180)));
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const cutoffSql = cutoff.toISOString().slice(0, 19).replace('T', ' ');
        const tables = ['messages', 'token_usage_records', 'visit_logs'];
        const counts = {};
        for (const table of tables) {
            const [rows] = await sequelize.query(`SELECT COUNT(*) AS count FROM \`${table}\` WHERE \`createdAt\` < ?`, {
                replacements: [cutoffSql],
            });
            counts[table] = Number(rows[0]?.count || 0);
        }
        if (dryRun) {
            return res.json({
                dryRun: true,
                cutoff: cutoff.toISOString(),
                candidates: counts,
            });
        }
        const moved = {};
        for (const table of tables) {
            await sequelize.query(`CREATE TABLE IF NOT EXISTS \`${table}_archive\` LIKE \`${table}\``);
            const [insertResult] = await sequelize.query(`INSERT INTO \`${table}_archive\` SELECT * FROM \`${table}\` WHERE \`createdAt\` < ?`, { replacements: [cutoffSql] });
            const inserted = Number(insertResult?.affectedRows || 0);
            moved[table] = inserted;
            if (inserted > 0) {
                await sequelize.query(`DELETE FROM \`${table}\` WHERE \`createdAt\` < ?`, {
                    replacements: [cutoffSql],
                });
            }
        }
        await appendOrderAudit({
            orderId: '00000000-0000-0000-0000-000000000000',
            actorUserId: req.user?.id || null,
            action: 'data_archive',
            note: `days=${days}; moved=${JSON.stringify(moved)}`,
        }).catch(() => {
            // ignore archive audit fallback errors
        });
        res.json({
            dryRun: false,
            cutoff: cutoff.toISOString(),
            moved,
        });
    }
    catch (error) {
        captureError(error, { scope: 'admin.data.archive' });
        res.status(500).json({ error: 'Failed to archive data' });
    }
});
// Users
router.get('/users', requirePermission('users:read'), async (req, res) => {
    const users = await getUsers();
    res.json(users);
});
router.patch('/users/:id/toggle', requirePermission('users:manage'), async (req, res) => {
    const { id } = req.params;
    const user = await getUsers().then((users) => users.find((u) => u.id === id));
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    const updatedUser = await toggleUserStatus(id, !user.isActive);
    res.json(updatedUser);
});
router.delete('/users/:id', requirePermission('users:manage'), async (req, res) => {
    try {
        if (!requireActionConfirmation(req, res, '删除用户'))
            return;
        const targetUserId = req.params.id;
        const actorUserId = req.user?.id || null;
        if (!targetUserId) {
            return sendError(res, {
                status: 400,
                code: 'USER_ID_REQUIRED',
                message: '缺少用户ID',
                retryable: false,
            });
        }
        if (actorUserId && actorUserId === targetUserId) {
            return sendError(res, {
                status: 400,
                code: 'USER_DELETE_SELF_FORBIDDEN',
                message: '不能删除当前登录账号',
                retryable: false,
            });
        }
        const targetUser = await User.findByPk(targetUserId);
        if (!targetUser) {
            return sendError(res, {
                status: 404,
                code: 'USER_NOT_FOUND',
                message: '用户不存在',
                retryable: false,
            });
        }
        if (targetUser.role === 'super_admin') {
            const superAdminCount = await User.count({ where: { role: 'super_admin', isActive: true } });
            if (superAdminCount <= 1) {
                return sendError(res, {
                    status: 400,
                    code: 'USER_DELETE_LAST_SUPER_ADMIN_FORBIDDEN',
                    message: '至少需要保留一个超管账号',
                    retryable: false,
                });
            }
        }
        const relatedOrderCount = await Order.count({ where: { userId: targetUserId } });
        if (relatedOrderCount > 0) {
            return sendError(res, {
                status: 409,
                code: 'USER_DELETE_BLOCKED_BY_ORDERS',
                message: '该用户存在订单记录，不能直接删除，请先禁用账号',
                retryable: false,
            });
        }
        await sequelize.transaction(async (transaction) => {
            const userConversations = await Conversation.findAll({
                where: { userId: targetUserId },
                attributes: ['id'],
                transaction,
            });
            const conversationIds = userConversations.map((item) => item.id);
            if (conversationIds.length > 0) {
                await Message.destroy({
                    where: { conversationId: { [Op.in]: conversationIds } },
                    transaction,
                });
                await Conversation.destroy({
                    where: { id: { [Op.in]: conversationIds } },
                    transaction,
                });
            }
            await MediaTask.destroy({ where: { userId: targetUserId }, transaction });
            await TokenUsageRecord.destroy({ where: { userId: targetUserId }, transaction });
            await VisitLog.destroy({ where: { userId: targetUserId }, transaction });
            await OrderAuditLog.update({ actorUserId: null }, {
                where: { actorUserId: targetUserId },
                transaction,
            });
            await targetUser.destroy({ transaction });
        });
        await redisClient.del(`user:${targetUserId}`).catch(() => { });
        res.json({
            success: true,
            deletedUserId: targetUserId,
        });
    }
    catch (error) {
        captureError(error, { scope: 'admin.users.delete', userId: req.params.id });
        sendError(res, {
            status: 500,
            code: 'USER_DELETE_FAILED',
            message: '删除用户失败',
            retryable: true,
        });
    }
});
router.delete('/conversations/:id', requirePermission('users:manage'), async (req, res) => {
    try {
        if (!requireActionConfirmation(req, res, '删除对话日志'))
            return;
        const conversationId = req.params.id;
        if (!conversationId) {
            return sendError(res, {
                status: 400,
                code: 'CONVERSATION_ID_REQUIRED',
                message: '缺少会话ID',
                retryable: false,
            });
        }
        const conversation = await Conversation.findByPk(conversationId);
        if (!conversation) {
            return sendError(res, {
                status: 404,
                code: 'CONVERSATION_NOT_FOUND',
                message: '会话不存在',
                retryable: false,
            });
        }
        let deletedMessageCount = 0;
        await sequelize.transaction(async (transaction) => {
            deletedMessageCount = await Message.count({
                where: { conversationId },
                transaction,
            });
            await Message.destroy({
                where: { conversationId },
                transaction,
            });
            await conversation.destroy({ transaction });
        });
        res.json({
            success: true,
            conversationId,
            deletedMessageCount,
        });
    }
    catch (error) {
        captureError(error, { scope: 'admin.conversations.delete', conversationId: req.params.id });
        sendError(res, {
            status: 500,
            code: 'CONVERSATION_DELETE_FAILED',
            message: '删除对话日志失败',
            retryable: true,
        });
    }
});
router.post('/conversations/batch-delete', requirePermission('users:manage'), async (req, res) => {
    try {
        if (!requireActionConfirmation(req, res, '批量删除对话日志'))
            return;
        const rawIds = Array.isArray(req.body?.conversationIds) ? req.body.conversationIds : [];
        const conversationIds = Array.from(new Set(rawIds
            .map((id) => String(id || '').trim())
            .filter((id) => Boolean(id))));
        if (conversationIds.length === 0) {
            return sendError(res, {
                status: 400,
                code: 'CONVERSATION_IDS_REQUIRED',
                message: '请选择要删除的会话',
                retryable: false,
            });
        }
        if (conversationIds.length > 200) {
            return sendError(res, {
                status: 400,
                code: 'CONVERSATION_BATCH_LIMIT_EXCEEDED',
                message: '单次最多删除 200 个会话',
                retryable: false,
            });
        }
        const existingCount = await Conversation.count({
            where: { id: { [Op.in]: conversationIds } },
        });
        if (existingCount === 0) {
            return sendError(res, {
                status: 404,
                code: 'CONVERSATIONS_NOT_FOUND',
                message: '未找到可删除的会话',
                retryable: false,
            });
        }
        let deletedMessageCount = 0;
        let deletedConversationCount = 0;
        await sequelize.transaction(async (transaction) => {
            deletedMessageCount = await Message.destroy({
                where: { conversationId: { [Op.in]: conversationIds } },
                transaction,
            });
            deletedConversationCount = await Conversation.destroy({
                where: { id: { [Op.in]: conversationIds } },
                transaction,
            });
        });
        res.json({
            success: true,
            requestedCount: conversationIds.length,
            deletedConversationCount,
            deletedMessageCount,
            skippedCount: Math.max(0, conversationIds.length - deletedConversationCount),
        });
    }
    catch (error) {
        captureError(error, { scope: 'admin.conversations.batch_delete' });
        sendError(res, {
            status: 500,
            code: 'CONVERSATION_BATCH_DELETE_FAILED',
            message: '批量删除对话日志失败',
            retryable: true,
        });
    }
});
// Models
router.get('/models', requirePermission('models:read'), async (req, res) => {
    try {
        const [configs, statusMap] = await Promise.all([SystemConfig.findAll(), getModelStatusMap()]);
        const models = ALL_MODELS.map((m) => {
            const configKey = `model_config:${m.id}`;
            const dbConfig = configs.find((c) => c.key === configKey);
            let customConfig = null;
            if (dbConfig && dbConfig.value) {
                try {
                    customConfig = JSON.parse(dbConfig.value);
                }
                catch (e) { }
            }
            return {
                id: m.id,
                name: m.name,
                category: m.category,
                description: m.description || '',
                // If custom config exists, show its provider, otherwise default
                provider: customConfig?.provider || m.provider,
                isActive: statusMap[m.id] !== false,
                isCustomized: !!customConfig,
                defaultConfig: m.apiConfig
                    ? {
                        provider: m.provider,
                        baseURL: m.apiConfig.baseURL,
                        modelId: m.apiConfig.modelId,
                    }
                    : null,
                customConfig: customConfig
                    ? {
                        ...customConfig,
                        apiKey: customConfig.apiKey ? '******' : '', // Mask key
                    }
                    : null,
            };
        });
        res.json(models);
    }
    catch (error) {
        console.error('Fetch models error:', error);
        res.status(500).json({ error: 'Failed to fetch models' });
    }
});
router.post('/models/:id/config', requirePermission('models:manage'), async (req, res) => {
    const { id } = req.params;
    const { provider, apiKey, baseURL, modelId } = req.body;
    try {
        const key = `model_config:${id}`;
        let finalApiKey = apiKey;
        // If apiKey is empty, try to preserve existing key from DB
        if (!finalApiKey) {
            const existing = await SystemConfig.findByPk(key);
            if (existing && existing.value) {
                try {
                    const oldConfig = JSON.parse(existing.value);
                    if (oldConfig.apiKey) {
                        finalApiKey = oldConfig.apiKey;
                    }
                }
                catch (e) { }
            }
        }
        const value = JSON.stringify({
            provider,
            apiKey: finalApiKey,
            baseURL,
            modelId,
        });
        const [config, created] = await SystemConfig.findOrCreate({
            where: { key },
            defaults: { value },
        });
        if (!created) {
            config.value = value;
            await config.save();
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error('Update model config error:', error);
        res.status(500).json({ error: 'Failed to update model config' });
    }
});
router.patch('/models/:id/toggle', requirePermission('models:manage'), async (req, res) => {
    const { id } = req.params;
    const model = ALL_MODELS.find((m) => m.id === id);
    if (!model)
        return res.status(404).json({ error: 'Model not found' });
    try {
        const statusMap = await getModelStatusMap();
        const nextIsActive = !(statusMap[model.id] !== false);
        await setModelActive(model.id, nextIsActive);
        res.json({
            id: model.id,
            name: model.name,
            category: model.category,
            description: model.description || '',
            provider: model.provider,
            isActive: nextIsActive,
            isCustomized: false,
            customConfig: null,
        });
    }
    catch (error) {
        console.error('Toggle model status error:', error);
        res.status(500).json({ error: 'Failed to toggle model status' });
    }
});
export const adminRouter = router;

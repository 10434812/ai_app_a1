import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import mysql from 'mysql2/promise';
import request from 'supertest';
const TEST_DB_NAME = process.env.DB_NAME_TEST || `ai_app_test_${Date.now()}`;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'e2e_jwt_secret_123456';
process.env.DB_HOST = process.env.DB_HOST || '127.0.0.1';
process.env.DB_PORT = process.env.DB_PORT || '3307';
process.env.DB_USER = process.env.DB_USER || 'root';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || '123456';
process.env.DB_NAME = TEST_DB_NAME;
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://:123456@127.0.0.1:6379';
process.env.WX_PAY_MOCK = 'true';
process.env.ENABLE_ADMIN_SEED = 'false';
let app;
let sequelize;
let redisClient;
let User;
let Order;
let TokenUsageRecord;
let SystemConfig;
let mediaTaskService;
const authHeader = (token) => ({ Authorization: `Bearer ${token}` });
const parseErrorMessage = (body) => {
    const normalized = body;
    if (typeof normalized?.error === 'string')
        return normalized.error;
    if (typeof normalized?.error?.message === 'string')
        return normalized.error.message;
    return '';
};
const registerUser = async (tag) => {
    const email = `${tag}_${randomUUID()}@example.com`;
    const password = 'Passw0rd!123456';
    const name = `E2E_${tag}`;
    const response = await request(app).post('/api/auth/register').send({ email, password, name });
    assert.equal(response.status, 200, `register failed: ${JSON.stringify(response.body)}`);
    assert.ok(response.body?.token, 'register should return token');
    assert.ok(response.body?.user?.id, 'register should return user id');
    return {
        email,
        password,
        token: String(response.body.token),
        userId: String(response.body.user.id),
    };
};
const loginUser = async (email, password) => {
    const response = await request(app).post('/api/auth/login').send({ email, password });
    assert.equal(response.status, 200, `login failed: ${JSON.stringify(response.body)}`);
    return String(response.body?.token || '');
};
const upsertSystemConfig = async (key, value) => {
    const existing = await SystemConfig.findByPk(key);
    if (existing) {
        existing.value = value;
        await existing.save();
        return;
    }
    await SystemConfig.create({ key, value });
};
before(async () => {
    const dbModule = await import("../../config/db.js");
    const redisModule = await import("../../config/redis.js");
    const appModule = await import("../../app.js");
    const userModel = await import("../../models/User.js");
    const orderModel = await import("../../models/Order.js");
    const tokenUsageModel = await import("../../models/TokenUsageRecord.js");
    const configModel = await import("../../models/SystemConfig.js");
    mediaTaskService = await import("../../services/media/mediaTaskService.js");
    sequelize = dbModule.sequelize;
    redisClient = redisModule.default;
    User = userModel.User;
    Order = orderModel.Order;
    TokenUsageRecord = tokenUsageModel.TokenUsageRecord;
    SystemConfig = configModel.SystemConfig;
    await dbModule.connectDB();
    await redisModule.connectRedis();
    app = appModule.createApp();
});
after(async () => {
    // Allow pending response hooks (rate-limit/concurrency release) to finish.
    await new Promise((resolve) => setTimeout(resolve, 200));
    try {
        mediaTaskService?.stopMediaTaskWorker?.();
    }
    catch {
        // ignore worker stop errors in test teardown
    }
    try {
        if (redisClient?.isOpen) {
            await redisClient.quit();
        }
    }
    catch {
        // ignore redis close errors in test teardown
    }
    try {
        await sequelize?.close();
    }
    catch {
        // ignore db close errors in test teardown
    }
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
    });
    await connection.query(`DROP DATABASE IF EXISTS \`${TEST_DB_NAME}\``);
    await connection.end();
});
test('E2E billing flows: checkout->到账, chat 扣费, image 扣费, 余额不足拦截', { timeout: 120000 }, async (t) => {
    await t.test('checkout + webhook should complete order and credit tokens', async () => {
        const account = await registerUser('order');
        const beforeUser = await User.findByPk(account.userId);
        const beforeBalance = Number(beforeUser?.tokensBalance || 0);
        const checkoutResponse = await request(app)
            .post('/api/payment/checkout')
            .set(authHeader(account.token))
            .send({
            planKey: 'token_pack_1000',
            method: 'wechat',
        });
        assert.equal(checkoutResponse.status, 200, `checkout failed: ${JSON.stringify(checkoutResponse.body)}`);
        const orderId = String(checkoutResponse.body?.orderId || '');
        assert.ok(orderId, 'checkout should return orderId');
        const webhookResponse = await request(app).post('/api/payment/wechat/notify').send({
            trade_state: 'SUCCESS',
            out_trade_no: orderId,
        });
        assert.equal(webhookResponse.status, 200, `webhook failed: ${JSON.stringify(webhookResponse.body)}`);
        const statusResponse = await request(app).get(`/api/payment/status/${orderId}`).set(authHeader(account.token));
        assert.equal(statusResponse.status, 200, `status failed: ${JSON.stringify(statusResponse.body)}`);
        assert.equal(statusResponse.body?.status, 'completed');
        const order = await Order.findByPk(orderId);
        assert.equal(order?.status, 'completed');
        const afterUser = await User.findByPk(account.userId);
        const afterBalance = Number(afterUser?.tokensBalance || 0);
        assert.equal(afterBalance, beforeBalance + 1000);
        const topupRecord = await TokenUsageRecord.findOne({
            where: {
                userId: account.userId,
                type: 'topup',
            },
        });
        assert.ok(topupRecord, 'topup token usage record should exist');
    });
    await t.test('chat should deduct token by usage cost', async () => {
        const account = await registerUser('chat');
        await User.update({ tokensBalance: 1000 }, { where: { id: account.userId } });
        const beforeUser = await User.findByPk(account.userId);
        const beforeBalance = Number(beforeUser?.tokensBalance || 0);
        const chatResponse = await request(app)
            .post('/api/chat')
            .set(authHeader(account.token))
            .set('Accept', 'text/event-stream')
            .send({
            model: 'manus',
            messages: [{ role: 'user', content: '你好' }],
            useHistory: false,
        })
            .timeout({ deadline: 60000 });
        assert.equal(chatResponse.status, 200, `chat failed: ${chatResponse.text}`);
        assert.match(chatResponse.text, /data:\s*\[DONE\]/);
        const afterUser = await User.findByPk(account.userId);
        const afterBalance = Number(afterUser?.tokensBalance || 0);
        assert.ok(afterBalance < beforeBalance, `chat should deduct tokens. before=${beforeBalance}, after=${afterBalance}`);
        const chatRecord = await TokenUsageRecord.findOne({
            where: {
                userId: account.userId,
                type: 'chat',
            },
            order: [['createdAt', 'DESC']],
        });
        assert.ok(chatRecord, 'chat token usage record should exist');
        assert.ok(Number(chatRecord.amount || 0) > 0, 'chat cost should be positive');
    });
    await t.test('image generation should deduct token by image billing rate', async () => {
        const account = await registerUser('image');
        await User.update({ tokensBalance: 1000 }, { where: { id: account.userId } });
        await Promise.all([
            upsertSystemConfig('IMAGE_GEN_ENABLED', 'true'),
            upsertSystemConfig('IMAGE_DEFAULT_PROVIDER', 'zhipu'),
            upsertSystemConfig('IMAGE_DEFAULT_SIZE', '1024x1024'),
            upsertSystemConfig('IMAGE_MAX_IMAGES_PER_REQUEST', '1'),
            upsertSystemConfig('ZHIPU_IMAGE_MODEL', 'cogview-4-250304'),
            upsertSystemConfig('ZHIPU_IMAGE_API_KEY', 'test-zhipu-key'),
        ]);
        const beforeUser = await User.findByPk(account.userId);
        const beforeBalance = Number(beforeUser?.tokensBalance || 0);
        const originalFetch = globalThis.fetch;
        globalThis.fetch = (async () => new Response(JSON.stringify({
            data: [{ url: 'https://example.com/fake-image.png' }],
            usage: { prompt_tokens: 32, completion_tokens: 0, total_tokens: 32 },
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }));
        try {
            const imageResponse = await request(app)
                .post('/api/media/image/generate')
                .set(authHeader(account.token))
                .send({
                prompt: '一只白色小猫',
                provider: 'zhipu',
                model: 'cogview-4-250304',
                size: '1024x1024',
                n: 1,
            });
            assert.equal(imageResponse.status, 202, `image generate failed: ${JSON.stringify(imageResponse.body)}`);
            assert.equal(imageResponse.body?.success, true);
            const taskId = String(imageResponse.body?.task?.id || '');
            assert.ok(taskId, 'image task id should exist');
            let taskStatus = 'pending';
            let taskResult = null;
            for (let i = 0; i < 20; i += 1) {
                const taskResponse = await request(app).get(`/api/media/tasks/${taskId}`).set(authHeader(account.token));
                assert.equal(taskResponse.status, 200, `task status failed: ${JSON.stringify(taskResponse.body)}`);
                taskStatus = String(taskResponse.body?.task?.status || '');
                taskResult = taskResponse.body?.task?.result;
                if (taskStatus === 'succeeded' || taskStatus === 'failed')
                    break;
                await new Promise((resolve) => setTimeout(resolve, 300));
            }
            assert.equal(taskStatus, 'succeeded', `task failed: ${JSON.stringify(taskResult)}`);
            assert.ok(Array.isArray(taskResult?.images));
            assert.equal(taskResult.images.length, 1);
            assert.ok(Number(taskResult?.tokenCost || 0) > 0);
            const afterUser = await User.findByPk(account.userId);
            const afterBalance = Number(afterUser?.tokensBalance || 0);
            assert.ok(afterBalance < beforeBalance, `image should deduct tokens. before=${beforeBalance}, after=${afterBalance}`);
            const imageRecord = await TokenUsageRecord.findOne({
                where: {
                    userId: account.userId,
                    type: 'image',
                },
                order: [['createdAt', 'DESC']],
            });
            assert.ok(imageRecord, 'image token usage record should exist');
            assert.ok(Number(imageRecord.amount || 0) > 0, 'image cost should be positive');
        }
        finally {
            globalThis.fetch = originalFetch;
        }
    });
    await t.test('insufficient balance should be blocked before chat generation', async () => {
        const account = await registerUser('insufficient');
        await User.update({ tokensBalance: 0 }, { where: { id: account.userId } });
        const response = await request(app).post('/api/chat').set(authHeader(account.token)).send({
            model: 'manus',
            messages: [{ role: 'user', content: '测试余额不足' }],
            useHistory: false,
        });
        assert.equal(response.status, 402);
        assert.match(parseErrorMessage(response.body), /余额不足/);
    });
    await t.test('manual refund should be idempotent and only process once', async () => {
        const account = await registerUser('refund');
        const admin = await registerUser('finance');
        await User.update({ role: 'super_admin' }, { where: { id: admin.userId } });
        const adminToken = await loginUser(admin.email, admin.password);
        const checkoutResponse = await request(app)
            .post('/api/payment/checkout')
            .set(authHeader(account.token))
            .send({
            planKey: 'token_pack_1000',
            method: 'wechat',
        });
        assert.equal(checkoutResponse.status, 200);
        const orderId = String(checkoutResponse.body?.orderId || '');
        assert.ok(orderId);
        const completeResponse = await request(app)
            .post('/api/payment/mock-success')
            .set(authHeader(adminToken))
            .send({ orderId });
        assert.equal(completeResponse.status, 200);
        const idemKey = `refund-${randomUUID()}`;
        const refundPayload = { note: 'e2e_refund', refundAmount: 9.9, confirm: true };
        const refundResponse1 = await request(app)
            .post(`/api/admin/orders/${orderId}/manual-refund`)
            .set(authHeader(adminToken))
            .set('Idempotency-Key', idemKey)
            .send(refundPayload);
        assert.equal(refundResponse1.status, 200, `refund #1 failed: ${JSON.stringify(refundResponse1.body)}`);
        assert.equal(refundResponse1.body?.success, true);
        const refundResponse2 = await request(app)
            .post(`/api/admin/orders/${orderId}/manual-refund`)
            .set(authHeader(adminToken))
            .set('Idempotency-Key', idemKey)
            .send(refundPayload);
        assert.equal(refundResponse2.status, 200, `refund #2 failed: ${JSON.stringify(refundResponse2.body)}`);
        assert.equal(refundResponse2.body?.replayed, true);
        const refunds = await TokenUsageRecord.findAll({
            where: {
                userId: account.userId,
                type: 'refund',
            },
        });
        assert.equal(refunds.length, 1, 'manual refund should write one refund token record');
        const order = await Order.findByPk(orderId);
        assert.equal(order?.status, 'refunded');
    });
    await t.test('billing config update should take effect on chat deduction', async () => {
        const account = await registerUser('billing');
        const admin = await registerUser('billing_admin');
        await User.update({ role: 'super_admin' }, { where: { id: admin.userId } });
        const adminToken = await loginUser(admin.email, admin.password);
        await User.update({ tokensBalance: 5000 }, { where: { id: account.userId } });
        const updateBilling = await request(app)
            .post('/api/admin/billing/config')
            .set(authHeader(adminToken))
            .send({
            chatRates: {
                'model:manus': {
                    inputPer1K: 2000,
                    outputPer1K: 2000,
                },
            },
        });
        assert.equal(updateBilling.status, 200, `update billing failed: ${JSON.stringify(updateBilling.body)}`);
        const chatResponse = await request(app)
            .post('/api/chat')
            .set(authHeader(account.token))
            .set('Accept', 'text/event-stream')
            .send({
            model: 'manus',
            messages: [{ role: 'user', content: '计费配置生效测试' }],
            useHistory: false,
        });
        assert.equal(chatResponse.status, 200, `chat failed: ${chatResponse.text}`);
        const chatRecord = await TokenUsageRecord.findOne({
            where: {
                userId: account.userId,
                type: 'chat',
                model: 'manus',
            },
            order: [['createdAt', 'DESC']],
        });
        assert.ok(chatRecord, 'chat record should exist');
        const meta = chatRecord?.meta ? JSON.parse(chatRecord.meta) : {};
        const promptTokens = Number(meta?.prompt_tokens || 0);
        const completionTokens = Number(meta?.completion_tokens || 0);
        const billingService = await import("../../services/billingConfigService.js");
        const config = await billingService.getBillingConfig();
        const expectedCost = billingService.calculateChatCost(config, 'manus', promptTokens, completionTokens);
        assert.equal(Number(chatRecord?.amount || 0), expectedCost, 'chat deduction should match latest billing config');
    });
});

import redisClient from "../config/redis.js";
import { redactSensitive } from "../utils/redaction.js";
const metricKey = (key) => `obs:counter:${key}`;
const incrementCounter = async (key, by = 1) => {
    try {
        await redisClient.incrBy(metricKey(key), Math.max(1, Math.floor(by)));
    }
    catch (error) {
        console.error('Observability counter error:', error);
    }
};
let sentryClient = null;
let sentryReady = false;
export const initObservability = async () => {
    if (sentryReady)
        return;
    sentryReady = true;
    const dsn = process.env.SENTRY_DSN || '';
    if (!dsn)
        return;
    try {
        const sentryModule = await import('@sentry/node');
        sentryModule.init({
            dsn,
            tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.2),
            environment: process.env.NODE_ENV || 'development',
        });
        sentryClient = sentryModule;
        console.log('[Observability] Sentry initialized.');
    }
    catch (error) {
        console.warn('[Observability] Sentry package not installed or init failed, fallback to console only.');
    }
};
export const captureError = (error, context) => {
    const sanitizedContext = redactSensitive(context || {});
    console.error('[CapturedError]', sanitizedContext, error);
    if (sentryClient) {
        sentryClient.captureException(error, {
            extra: sanitizedContext,
        });
    }
};
export const captureEvent = async (name, tags) => {
    const eventName = `obs:event:${name}`;
    try {
        await redisClient.incr(eventName);
        await redisClient.expire(eventName, 30 * 24 * 60 * 60);
    }
    catch (error) {
        console.error('Observability event error:', error);
    }
    if (sentryClient) {
        sentryClient.captureMessage(name, {
            level: 'info',
            extra: redactSensitive(tags || {}),
        });
    }
};
export const metricCounters = {
    paymentAttempt: () => incrementCounter('payment_attempt_total'),
    paymentSuccess: () => incrementCounter('payment_success_total'),
    paymentFailed: () => incrementCounter('payment_failed_total'),
    tokenDeductSuccess: () => incrementCounter('token_deduct_success_total'),
    tokenDeductFailed: () => incrementCounter('token_deduct_failed_total'),
    imageDeductSuccess: () => incrementCounter('image_deduct_success_total'),
    imageDeductFailed: () => incrementCounter('image_deduct_failed_total'),
    chatRequest: () => incrementCounter('chat_request_total'),
};
const getCounter = async (key) => {
    try {
        const raw = await redisClient.get(metricKey(key));
        return Number.parseInt(raw || '0', 10) || 0;
    }
    catch {
        return 0;
    }
};
export const getObservabilitySummary = async () => {
    const [paymentAttemptTotal, paymentSuccessTotal, paymentFailedTotal, tokenDeductSuccessTotal, tokenDeductFailedTotal, imageDeductSuccessTotal, imageDeductFailedTotal, chatRequestTotal,] = await Promise.all([
        getCounter('payment_attempt_total'),
        getCounter('payment_success_total'),
        getCounter('payment_failed_total'),
        getCounter('token_deduct_success_total'),
        getCounter('token_deduct_failed_total'),
        getCounter('image_deduct_success_total'),
        getCounter('image_deduct_failed_total'),
        getCounter('chat_request_total'),
    ]);
    const paymentSuccessRate = paymentAttemptTotal > 0 ? Number(((paymentSuccessTotal / paymentAttemptTotal) * 100).toFixed(2)) : 0;
    const tokenDeductFailureRate = tokenDeductSuccessTotal + tokenDeductFailedTotal > 0
        ? Number((tokenDeductFailedTotal / (tokenDeductSuccessTotal + tokenDeductFailedTotal) * 100).toFixed(2))
        : 0;
    const imageDeductFailureRate = imageDeductSuccessTotal + imageDeductFailedTotal > 0
        ? Number((imageDeductFailedTotal / (imageDeductSuccessTotal + imageDeductFailedTotal) * 100).toFixed(2))
        : 0;
    return {
        paymentAttemptTotal,
        paymentSuccessTotal,
        paymentFailedTotal,
        paymentSuccessRate,
        chatRequestTotal,
        tokenDeductSuccessTotal,
        tokenDeductFailedTotal,
        tokenDeductFailureRate,
        imageDeductSuccessTotal,
        imageDeductFailedTotal,
        imageDeductFailureRate,
    };
};

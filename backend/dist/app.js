import express from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { adminRouter } from './routes/admin.js';
import { chatRouter } from './routes/chat.js';
import { paymentRouter } from './routes/payment.js';
import { configRouter } from './routes/config.js';
import { tokenUsageRouter } from './routes/tokenUsage.js';
import wechatRouter from './routes/wechat.js';
import mediaRouter from './routes/media.js';
import { visitRouter } from './routes/visit.js';
import { captureError } from './services/observabilityService.js';
import { ApiError, attachRequestId, wrapLegacyErrorEnvelope } from './errors/api.js';
export const createApp = () => {
    const app = express();
    const corsOrigins = (process.env.CORS_ORIGIN || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    if (process.env.NODE_ENV === 'production' && corsOrigins.length === 0) {
        throw new Error('CORS_ORIGIN must be configured in production.');
    }
    if (corsOrigins.length === 0) {
        app.use(cors());
    }
    else {
        app.use(cors({
            origin: (origin, callback) => {
                if (!origin || corsOrigins.includes(origin))
                    return callback(null, true);
                return callback(new Error(`Not allowed by CORS: ${origin}`));
            },
        }));
    }
    app.use(attachRequestId);
    app.use(wrapLegacyErrorEnvelope);
    app.use('/api/payment/wechat/notify', express.raw({ type: 'application/json', limit: '1mb' }));
    app.use(express.json({ limit: '1mb' }));
    app.use('/api', healthRouter);
    app.use('/api/config', configRouter);
    app.use('/api/auth', authRouter);
    app.use('/api/admin', adminRouter);
    app.use('/api/chat', chatRouter);
    app.use('/api/payment', paymentRouter);
    app.use('/api/token', tokenUsageRouter);
    app.use('/api/wechat', wechatRouter);
    app.use('/api/media', mediaRouter);
    app.use('/api/visit', visitRouter);
    app.use((err, req, res, _next) => {
        captureError(err, {
            scope: 'express.middleware',
            method: req.method,
            path: req.path,
            requestId: req.requestId,
        });
        if (res.headersSent)
            return;
        if (err instanceof ApiError) {
            return res.status(err.status).json({
                error: {
                    code: err.code,
                    message: err.message,
                    retryable: err.retryable,
                    details: err.details,
                    requestId: req.requestId,
                },
            });
        }
        res.status(500).json({
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Internal Server Error',
                retryable: true,
                requestId: req.requestId,
            },
        });
    });
    return app;
};

import { randomUUID } from 'node:crypto';
const asRecord = (value) => {
    if (!value || typeof value !== 'object')
        return null;
    return value;
};
export class ApiError extends Error {
    status;
    code;
    retryable;
    details;
    constructor(options) {
        super(options.message);
        this.status = options.status;
        this.code = options.code;
        this.retryable = !!options.retryable;
        this.details = options.details;
    }
}
const toStandardErrorPayload = (status, payload) => {
    const normalized = asRecord(payload);
    const raw = asRecord(normalized?.error);
    if (raw) {
        return {
            error: {
                code: typeof raw.code === 'string' && raw.code ? raw.code : typeof normalized?.code === 'string' ? normalized.code : `HTTP_${status}`,
                message: typeof raw.message === 'string' && raw.message ? raw.message : 'Request failed',
                retryable: typeof raw.retryable === 'boolean' ? raw.retryable : status >= 500,
                details: raw.details,
            },
        };
    }
    if (typeof normalized?.error === 'string') {
        return {
            error: {
                code: typeof normalized?.code === 'string' && normalized.code ? normalized.code : `HTTP_${status}`,
                message: normalized.error,
                retryable: typeof normalized?.retryable === 'boolean' ? normalized.retryable : status >= 500,
            },
        };
    }
    return payload;
};
export const attachRequestId = (req, res, next) => {
    const headerRequestId = String(req.headers['x-request-id'] || '').trim();
    const requestId = headerRequestId || randomUUID();
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    next();
};
export const wrapLegacyErrorEnvelope = (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = ((payload) => {
        if (res.statusCode >= 400) {
            const normalized = toStandardErrorPayload(res.statusCode, payload);
            const errorEnvelope = asRecord(normalized);
            if (errorEnvelope?.error && !errorEnvelope.error.requestId) {
                errorEnvelope.error.requestId = req.requestId;
            }
            return originalJson(normalized);
        }
        return originalJson(payload);
    });
    next();
};
export const sendError = (res, options) => {
    return res.status(options.status).json({
        error: {
            code: options.code,
            message: options.message,
            retryable: !!options.retryable,
            details: options.details,
        },
    });
};

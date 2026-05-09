import { randomUUID } from 'node:crypto';
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
    const raw = payload?.error;
    if (raw && typeof raw === 'object') {
        return {
            error: {
                code: raw.code || payload?.code || `HTTP_${status}`,
                message: raw.message || 'Request failed',
                retryable: typeof raw.retryable === 'boolean' ? raw.retryable : status >= 500,
                details: raw.details,
            },
        };
    }
    if (typeof raw === 'string') {
        return {
            error: {
                code: payload?.code || `HTTP_${status}`,
                message: raw,
                retryable: typeof payload?.retryable === 'boolean' ? payload.retryable : status >= 500,
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
            if (normalized?.error && typeof normalized.error === 'object' && !normalized.error.requestId) {
                normalized.error.requestId = req.requestId;
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

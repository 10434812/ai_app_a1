import {randomUUID} from 'node:crypto'
import type {Request, Response, NextFunction} from 'express'

export class ApiError extends Error {
  status: number
  code: string
  retryable: boolean
  details?: unknown

  constructor(options: {status: number; code: string; message: string; retryable?: boolean; details?: unknown}) {
    super(options.message)
    this.status = options.status
    this.code = options.code
    this.retryable = !!options.retryable
    this.details = options.details
  }
}

const toStandardErrorPayload = (status: number, payload: any) => {
  const raw = payload?.error
  if (raw && typeof raw === 'object') {
    return {
      error: {
        code: raw.code || payload?.code || `HTTP_${status}`,
        message: raw.message || 'Request failed',
        retryable: typeof raw.retryable === 'boolean' ? raw.retryable : status >= 500,
        details: raw.details,
      },
    }
  }

  if (typeof raw === 'string') {
    return {
      error: {
        code: payload?.code || `HTTP_${status}`,
        message: raw,
        retryable: typeof payload?.retryable === 'boolean' ? payload.retryable : status >= 500,
      },
    }
  }

  return payload
}

export const attachRequestId = (req: Request, res: Response, next: NextFunction) => {
  const headerRequestId = String(req.headers['x-request-id'] || '').trim()
  const requestId = headerRequestId || randomUUID()
  ;(req as any).requestId = requestId
  res.setHeader('X-Request-Id', requestId)
  next()
}

export const wrapLegacyErrorEnvelope = (req: Request, res: Response, next: NextFunction) => {
  const originalJson = res.json.bind(res)
  res.json = ((payload: any) => {
    if (res.statusCode >= 400) {
      const normalized = toStandardErrorPayload(res.statusCode, payload)
      if (normalized?.error && typeof normalized.error === 'object' && !normalized.error.requestId) {
        normalized.error.requestId = (req as any).requestId
      }
      return originalJson(normalized)
    }
    return originalJson(payload)
  }) as typeof res.json
  next()
}

export const sendError = (
  res: Response,
  options: {status: number; code: string; message: string; retryable?: boolean; details?: unknown},
) => {
  return res.status(options.status).json({
    error: {
      code: options.code,
      message: options.message,
      retryable: !!options.retryable,
      details: options.details,
    },
  })
}


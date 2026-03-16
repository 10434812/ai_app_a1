import {randomUUID} from 'node:crypto'
import type {Request, Response, NextFunction} from 'express'

interface StandardErrorPayload {
  code?: string
  message?: string
  retryable?: boolean
  details?: unknown
  requestId?: string
}

interface StandardErrorEnvelope {
  error: StandardErrorPayload
}

type UnknownRecord = Record<string, unknown>

const asRecord = (value: unknown): UnknownRecord | null => {
  if (!value || typeof value !== 'object') return null
  return value as UnknownRecord
}

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

const toStandardErrorPayload = (status: number, payload: unknown): unknown => {
  const normalized = asRecord(payload)
  const raw = asRecord(normalized?.error)

  if (raw) {
    return {
      error: {
        code: typeof raw.code === 'string' && raw.code ? raw.code : typeof normalized?.code === 'string' ? normalized.code : `HTTP_${status}`,
        message: typeof raw.message === 'string' && raw.message ? raw.message : 'Request failed',
        retryable: typeof raw.retryable === 'boolean' ? raw.retryable : status >= 500,
        details: raw.details,
      },
    } satisfies StandardErrorEnvelope
  }

  if (typeof normalized?.error === 'string') {
    return {
      error: {
        code: typeof normalized?.code === 'string' && normalized.code ? normalized.code : `HTTP_${status}`,
        message: normalized.error,
        retryable: typeof normalized?.retryable === 'boolean' ? normalized.retryable : status >= 500,
      },
    } satisfies StandardErrorEnvelope
  }

  return payload
}

export const attachRequestId = (req: Request, res: Response, next: NextFunction) => {
  const headerRequestId = String(req.headers['x-request-id'] || '').trim()
  const requestId = headerRequestId || randomUUID()
  req.requestId = requestId
  res.setHeader('X-Request-Id', requestId)
  next()
}

export const wrapLegacyErrorEnvelope = (req: Request, res: Response, next: NextFunction) => {
  const originalJson = res.json.bind(res)
  res.json = ((payload: unknown) => {
    if (res.statusCode >= 400) {
      const normalized = toStandardErrorPayload(res.statusCode, payload)
      const errorEnvelope = asRecord(normalized) as StandardErrorEnvelope | null
      if (errorEnvelope?.error && !errorEnvelope.error.requestId) {
        errorEnvelope.error.requestId = req.requestId
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

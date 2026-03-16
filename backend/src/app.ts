import express from 'express'
import cors from 'cors'
import {healthRouter} from './routes/health.ts'
import {authRouter} from './routes/auth.ts'
import {adminRouter} from './routes/admin.ts'
import {chatRouter} from './routes/chat.ts'
import {paymentRouter} from './routes/payment.ts'
import {configRouter} from './routes/config.ts'
import {tokenUsageRouter} from './routes/tokenUsage.ts'
import wechatRouter from './routes/wechat.ts'
import mediaRouter from './routes/media.ts'
import {visitRouter} from './routes/visit.ts'
import {captureError} from './services/observabilityService.ts'
import {ApiError, attachRequestId, wrapLegacyErrorEnvelope} from './errors/api.ts'

const DEFAULT_LOCAL_CORS_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
]

const DEFAULT_PRODUCTION_CORS_ORIGINS = [
  'https://ukb88.com',
  'https://www.ukb88.com',
  'https://*.ukb88.com',
  'http://ukb88.com',
  'http://www.ukb88.com',
  'http://*.ukb88.com',
]

const parseCorsOrigins = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

const matchesCorsOrigin = (origin: string, pattern: string) => {
  if (origin === pattern) return true
  if (!pattern.includes('*')) return false

  try {
    const originUrl = new URL(origin)
    const patternUrl = new URL(pattern.replace('*.', 'placeholder.'))
    const suffix = patternUrl.hostname.replace(/^placeholder\./, '')
    return originUrl.protocol === patternUrl.protocol && originUrl.hostname.endsWith(`.${suffix}`)
  } catch {
    return false
  }
}

export const createApp = () => {
  const app = express()
  app.set('trust proxy', 1)
  const configuredCorsOrigins = parseCorsOrigins(process.env.CORS_ORIGIN || '')
  const corsOrigins = Array.from(
    new Set([
      ...configuredCorsOrigins,
      ...DEFAULT_LOCAL_CORS_ORIGINS,
      ...(process.env.NODE_ENV === 'production' ? DEFAULT_PRODUCTION_CORS_ORIGINS : []),
    ]),
  )

  if (corsOrigins.length === 0) {
    app.use(
      cors({
        origin: true,
        credentials: true,
      }),
    )
  } else {
    app.use(
      cors({
        origin: (origin, callback) => {
          if (!origin || corsOrigins.some((pattern) => matchesCorsOrigin(origin, pattern))) {
            return callback(null, true)
          }
          return callback(new Error('Not allowed by CORS'))
        },
        credentials: true,
      }),
    )
  }
  app.use(attachRequestId)
  app.use(wrapLegacyErrorEnvelope)
  app.use('/api/payment/wechat/notify', express.raw({type: 'application/json', limit: '1mb'}))
  app.use(express.json({limit: '1mb'}))

  app.use('/api', healthRouter)
  app.use('/api/config', configRouter)
  app.use('/api/auth', authRouter)
  app.use('/api/admin', adminRouter)
  app.use('/api/chat', chatRouter)
  app.use('/api/payment', paymentRouter)
  app.use('/api/token', tokenUsageRouter)
  app.use('/api/wechat', wechatRouter)
  app.use('/api/media', mediaRouter)
  app.use('/api/visit', visitRouter)

  app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof Error && err.message === 'Not allowed by CORS') {
      return res.status(403).json({
        error: {
          code: 'CORS_FORBIDDEN',
          message: 'Origin not allowed',
          retryable: false,
          requestId: req.requestId,
        },
      })
    }

    captureError(err, {
      scope: 'express.middleware',
      method: req.method,
      path: req.path,
      requestId: req.requestId,
    })
    if (res.headersSent) return
    if (err instanceof ApiError) {
      return res.status(err.status).json({
        error: {
          code: err.code,
          message: err.message,
          retryable: err.retryable,
          details: err.details,
          requestId: req.requestId,
        },
      })
    }
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal Server Error',
        retryable: true,
        requestId: req.requestId,
      },
    })
  })

  return app
}

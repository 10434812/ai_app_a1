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

export const createApp = () => {
  const app = express()
  const corsOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  if (process.env.NODE_ENV === 'production' && corsOrigins.length === 0) {
    throw new Error('CORS_ORIGIN must be configured in production.')
  }

  if (corsOrigins.length === 0) {
    app.use(cors())
  } else {
    app.use(
      cors({
        origin: (origin, callback) => {
          if (!origin || corsOrigins.includes(origin)) return callback(null, true)
          return callback(new Error('Not allowed by CORS'))
        },
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

  app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    captureError(err, {
      scope: 'express.middleware',
      method: req.method,
      path: req.path,
      requestId: (req as any).requestId,
    })
    if (res.headersSent) return
    if (err instanceof ApiError) {
      return res.status(err.status).json({
        error: {
          code: err.code,
          message: err.message,
          retryable: err.retryable,
          details: err.details,
          requestId: (req as any).requestId,
        },
      })
    }
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal Server Error',
        retryable: true,
        requestId: (req as any).requestId,
      },
    })
  })

  return app
}

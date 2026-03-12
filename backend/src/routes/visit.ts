import express, {Request, Response} from 'express'
import {optionalAuthenticateToken} from '../middleware/auth.ts'
import {recordVisit, resolveVisitorId} from '../services/visitService.ts'

const router = express.Router()

router.post('/track', optionalAuthenticateToken, async (req: Request, res: Response) => {
  try {
    const visitorId = resolveVisitorId(req)
    const path = typeof req.body?.path === 'string' ? req.body.path : '/'
    const source = typeof req.body?.source === 'string' ? req.body.source : 'web'
    const forwardedFor = req.header('x-forwarded-for') || ''
    const ip = forwardedFor.split(',')[0]?.trim() || req.ip || ''
    const userAgent = req.header('user-agent') || ''
    const referer = req.header('referer') || ''

    await recordVisit({
      userId: req.user?.id ?? null,
      visitorId,
      path,
      source,
      ip,
      userAgent,
      referer,
    })

    res.json({success: true})
  } catch (error) {
    console.error('Track visit error:', error)
    res.status(500).json({error: 'Failed to track visit'})
  }
})

export const visitRouter = router

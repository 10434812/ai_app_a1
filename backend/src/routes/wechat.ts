import express from 'express'
import { WeChatService } from '../services/wechat/jssdk.ts'
import {withRateLimit} from '../middleware/rateLimit.ts'

const router = express.Router()

router.post('/signature', withRateLimit('auth'), async (req, res) => {
  try {
    const { url } = req.body
    if (!url) {
      return res.status(400).json({ error: 'URL is required' })
    }
    const targetUrl = new URL(String(url))
    const origin = String(req.headers.origin || '')
    if (origin) {
      const originUrl = new URL(origin)
      if (originUrl.host !== targetUrl.host) {
        return res.status(403).json({error: 'URL host mismatch'})
      }
    }

    const signatureData = await WeChatService.getSignature(url)
    res.json(signatureData)
  } catch (error: unknown) {
    console.error('WeChat Signature Error:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to generate signature' })
  }
})

router.post('/callback', (req, res) => {
  const { type, url, status } = req.body
  console.log(`[WeChat Share] Type: ${type}, Status: ${status}, URL: ${url}, Time: ${new Date().toISOString()}`)
  // TODO: Save to database for analytics
  res.json({ success: true })
})

export default router

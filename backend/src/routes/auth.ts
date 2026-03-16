import express, {Request, Response} from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import {createUser, findUserByEmail, findUserById, findUserByReferralCode} from '../services/userService.ts'
import {authenticateToken, AUTH_COOKIE_NAME, JWT_SECRET, clearAuthCookie, issueAuthCookie} from '../middleware/auth.ts'
import {User} from '../models/User.ts'
import redisClient from '../config/redis.ts'
import {WeChatOAuthService} from '../services/wechat/oauth.ts'
import {v4 as uuidv4} from 'uuid'
import {recordTokenUsage} from '../services/tokenService.ts'
import {withRateLimit} from '../middleware/rateLimit.ts'
import {createSecureToken} from '../utils/random.ts'

const router = express.Router()
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_MIN_LENGTH = 8
const PASSWORD_MAX_LENGTH = 72
const NAME_MIN_LENGTH = 2
const NAME_MAX_LENGTH = 32
const LOGIN_FAILURE_WINDOW_SECONDS = 15 * 60
const LOGIN_FAILURE_LIMIT = 5
const LOGIN_LOCK_SECONDS = 15 * 60

interface DecodedJwtPayload {
  exp?: number
}

const normalizeEmail = (email: unknown) => String(email || '').trim().toLowerCase()
const getClientIp = (req: Request) => (req.header('x-forwarded-for') || '').split(',')[0]?.trim() || req.ip || 'unknown'

const validateRegisterInput = (email: string, password: string, name: string) => {
  if (!EMAIL_RE.test(email)) return '邮箱格式不正确'
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    return `密码长度需为 ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} 位`
  }
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return '密码必须同时包含字母和数字'
  }
  if (name.length < NAME_MIN_LENGTH || name.length > NAME_MAX_LENGTH) {
    return `用户名长度需为 ${NAME_MIN_LENGTH}-${NAME_MAX_LENGTH} 个字符`
  }
  return ''
}

const getLoginFailKey = (email: string) => `auth:login:fail:${email}`
const getLoginLockKey = (email: string) => `auth:login:lock:${email}`
const buildAuthPayload = (user: User) => ({
  user: {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatar: user.avatar,
    membershipLevel: user.membershipLevel,
    membershipExpireAt: user.membershipExpireAt,
    tokensBalance: user.tokensBalance,
    referralCode: user.referralCode,
    multiModelUsageCount: user.multiModelUsageCount,
  },
})

const getLoginLockTtl = async (email: string) => {
  try {
    const ttl = await redisClient.ttl(getLoginLockKey(email))
    return ttl > 0 ? ttl : 0
  } catch (error) {
    console.error('Read login lock ttl failed:', error)
    return 0
  }
}

const recordLoginFailure = async (email: string) => {
  try {
    const failKey = getLoginFailKey(email)
    const lockKey = getLoginLockKey(email)
    const count = await redisClient.incr(failKey)
    if (count === 1) {
      await redisClient.expire(failKey, LOGIN_FAILURE_WINDOW_SECONDS)
    }
    if (count >= LOGIN_FAILURE_LIMIT) {
      await redisClient.set(lockKey, '1', {EX: LOGIN_LOCK_SECONDS})
      await redisClient.del(failKey)
    }
  } catch (error) {
    console.error('Record login failure failed:', error)
  }
}

const clearLoginFailures = async (email: string) => {
  try {
    await redisClient.del([getLoginFailKey(email), getLoginLockKey(email)])
  } catch (error) {
    console.error('Clear login failure failed:', error)
  }
}

// Login
router.post('/login', withRateLimit('auth'), async (req: Request, res: Response) => {
  try {
    const email = normalizeEmail(req.body?.email)
    const password = String(req.body?.password || '')
    const lockTtl = await getLoginLockTtl(email)
    if (lockTtl > 0) {
      return res.status(429).json({error: `该账号已被临时锁定，请 ${lockTtl} 秒后再试`})
    }

    const user = await findUserByEmail(email)

    if (!user) {
      await recordLoginFailure(email)
      return res.status(401).json({error: 'Invalid credentials'})
    }

    const isValid = await bcrypt.compare(password, user.passwordHash)
    if (!isValid) {
      await recordLoginFailure(email)
      return res.status(401).json({error: 'Invalid credentials'})
    }

    if (!user.isActive) {
      return res.status(403).json({error: 'Account disabled'})
    }

    await clearLoginFailures(email)

    const token = jwt.sign({userId: user.id, role: user.role}, JWT_SECRET, {expiresIn: '24h'})
    issueAuthCookie(res, token)
    res.json(buildAuthPayload(user))
  } catch (error) {
    res.status(500).json({error: 'Login failed'})
  }
})

// Register
router.post('/register', withRateLimit('auth'), async (req: Request, res: Response) => {
  try {
    const email = normalizeEmail(req.body?.email)
    const password = String(req.body?.password || '')
    const fallbackName = email.includes('@') ? email.split('@')[0] : ''
    const name = String(req.body?.name || fallbackName).trim()
    const validationError = validateRegisterInput(email, password, name)
    if (validationError) {
      return res.status(400).json({error: validationError})
    }

    const existingUser = await findUserByEmail(email)
    if (existingUser) {
      return res.status(400).json({error: 'Email already exists'})
    }

    const user = await createUser(email, password, name)
    const token = jwt.sign({userId: user.id, role: user.role}, JWT_SECRET, {expiresIn: '24h'})
    issueAuthCookie(res, token)
    res.json(buildAuthPayload(user))
  } catch (error) {
    res.status(500).json({error: 'Registration failed'})
  }
})

router.post('/forgot-password', withRateLimit('auth'), async (req: Request, res: Response) => {
  const email = normalizeEmail(req.body?.email)
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({error: '邮箱格式不正确'})
  }

  const ip = getClientIp(req)
  console.warn(`[FORGOT_PASSWORD_UNAVAILABLE] email=${email} ip=${ip}`)
  return res.status(501).json({error: '当前未配置邮箱找回密码服务，请联系管理员处理'})
})

// Get Current User (Me)
router.get('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id
    const user = await findUserById(userId)
    if (!user) {
      return res.status(404).json({error: 'User not found'})
    }

    res.json(buildAuthPayload(user))
  } catch (error) {
    res.status(500).json({error: 'Failed to fetch user'})
  }
})

// Generate Referral Code
router.post('/referral/generate', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = await findUserById(req.user!.id)
    if (!user) return res.status(404).json({error: 'User not found'})

    if (user.referralCode) {
      return res.json({referralCode: user.referralCode})
    }

    let code = ''
    for (let i = 0; i < 5; i++) {
      const candidate = createSecureToken(4)
      const existing = await findUserByReferralCode(candidate)
      if (!existing) {
        code = candidate
        break
      }
    }
    if (!code) {
      return res.status(500).json({error: 'Failed to generate code'})
    }

    user.referralCode = code
    await user.save()

    // Invalidate cache
    await redisClient.del(`user:${user.id}`)

    res.json({referralCode: code})
  } catch (error) {
    console.error('Generate referral error:', error)
    res.status(500).json({error: 'Failed to generate code'})
  }
})

// Redeem Referral Code
router.post('/referral/redeem', authenticateToken, async (req: Request, res: Response) => {
  try {
    const {code} = req.body

    if (!code) return res.status(400).json({error: 'Code is required'})

    const redeemer = await findUserById(req.user!.id)
    if (!redeemer) return res.status(404).json({error: 'User not found'})

    if (redeemer.referredBy) {
      return res.status(400).json({error: 'You have already redeemed a code'})
    }

    const referrer = await findUserByReferralCode(code)
    if (!referrer) {
      return res.status(404).json({error: 'Invalid referral code'})
    }

    if (referrer.id === redeemer.id) {
      return res.status(400).json({error: 'Cannot redeem your own code'})
    }

    // Grant rewards
    // Redeemer gets 50
    redeemer.referredBy = referrer.id
    await redeemer.save()
    await recordTokenUsage(redeemer.id, 50, 'referral_bonus', 'system', {
      referrerId: referrer.id,
      referralCode: code,
    })
    await redisClient.del(`user:${redeemer.id}`)

    // Referrer gets 100
    await recordTokenUsage(referrer.id, 100, 'referral_reward', 'system', {
      redeemerId: redeemer.id,
      referralCode: code,
    })
    await redisClient.del(`user:${referrer.id}`)

    res.json({message: 'Redeemed successfully! You got 50 tokens.'})
  } catch (error) {
    console.error('Redeem referral error:', error)
    res.status(500).json({error: 'Failed to redeem code'})
  }
})

// Increment Multi-Model Usage Count
router.post('/increment-usage', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = await findUserById(req.user!.id)
    if (!user) return res.status(404).json({error: 'User not found'})

    user.multiModelUsageCount = (user.multiModelUsageCount || 0) + 1
    await user.save()

    // Invalidate cache
    await redisClient.del(`user:${user.id}`)

    res.json({success: true, count: user.multiModelUsageCount})
  } catch (error) {
    console.error('Increment usage error:', error)
    res.status(500).json({error: 'Failed to increment usage'})
  }
})

// WeChat Login Callback
router.post('/wechat/login', withRateLimit('auth'), async (req: Request, res: Response) => {
  try {
    const {code} = req.body
    if (!code) return res.status(400).json({error: 'Code is required'})

    const userInfo = await WeChatOAuthService.processCallback(code)

    // Find user by openid
    let user = await User.findOne({where: {wechatOpenId: userInfo.openid}})

    if (!user && userInfo.unionid) {
      // Try unionid if available
      user = await User.findOne({where: {wechatUnionId: userInfo.unionid}})
    }

    if (!user) {
      // Create new user
      // Use purely random email to prevent WeChat ID exposure
      const email = `wx_${uuidv4()}@local.app`
      const password = uuidv4() // Random password

      user = await createUser(email, password, userInfo.nickname || 'WeChat User')
      user.wechatOpenId = userInfo.openid
      user.wechatUnionId = userInfo.unionid || ''
      user.avatar = userInfo.headimgurl
      await user.save()
    } else {
      // Update info if needed
      let changed = false
      if (userInfo.headimgurl && user.avatar !== userInfo.headimgurl) {
        user.avatar = userInfo.headimgurl
        changed = true
      }
      if (userInfo.nickname && user.name === 'WeChat User') {
        user.name = userInfo.nickname
        changed = true
      }
      // If found by unionid but openid is missing (should not happen for same app, but good for safety)
      if (!user.wechatOpenId) {
        user.wechatOpenId = userInfo.openid
        changed = true
      }
      if (changed) await user.save()
    }

    const token = jwt.sign({userId: user.id, role: user.role}, JWT_SECRET, {expiresIn: '24h'})
    issueAuthCookie(res, token)
    res.json(buildAuthPayload(user))
  } catch (error: unknown) {
    console.error('WeChat login error:', error)
    const message = error instanceof Error ? error.message : 'WeChat login failed'
    res.status(500).json({error: message})
  }
})

// Logout
router.post('/logout', authenticateToken, async (req: Request, res: Response) => {
  try {
    const token =
      req.headers.authorization?.split(' ')[1] ||
      req.headers.cookie
        ?.split(';')
        .map((item) => item.trim())
        .find((item) => item.startsWith(`${AUTH_COOKIE_NAME}=`))
        ?.split('=')
        .slice(1)
        .join('=')
    if (token) {
      const decoded = jwt.decode(token) as DecodedJwtPayload | null
      if (decoded && decoded.exp) {
        const ttl = decoded.exp - Math.floor(Date.now() / 1000)
        if (ttl > 0) {
          await redisClient.set(`blacklist:${token}`, 'true', {EX: ttl})
        }
      }
    }

    // Logging
    const userId = req.user?.id || 'Unknown'
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
    console.log(`[LOGOUT] User: ${userId}, IP: ${ip}, Time: ${new Date().toISOString()}`)

    clearAuthCookie(res)
    res.json({message: 'Logged out successfully'})
  } catch (error) {
    console.error('Logout error:', error)
    res.status(500).json({error: 'Logout failed'})
  }
})

export const authRouter = router

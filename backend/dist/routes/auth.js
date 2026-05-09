import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createUser, findUserByEmail, findUserById, findUserByReferralCode } from '../services/userService.js';
import { authenticateToken, JWT_SECRET } from '../middleware/auth.js';
import { User } from '../models/User.js';
import redisClient from '../config/redis.js';
import { WeChatOAuthService } from '../services/wechat/oauth.js';
import { v4 as uuidv4 } from 'uuid';
import { recordTokenUsage } from '../services/tokenService.js';
import { withRateLimit } from '../middleware/rateLimit.js';
const router = express.Router();
// Login
router.post('/login', withRateLimit('auth'), async (req, res) => {
    try {
        const email = String(req.body?.email || '').trim().toLowerCase();
        const password = String(req.body?.password || '');
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        const user = await findUserByEmail(email);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        if (!user.passwordHash) {
            console.warn('[auth/login] user has no password hash:', { userId: user.id, email: user.email });
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        if (user.isActive === false) {
            return res.status(403).json({ error: 'Account is disabled' });
        }
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
            },
        });
    }
    catch (error) {
        console.error('Login failed:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});
// Register
router.post('/register', withRateLimit('auth'), async (req, res) => {
    try {
        const email = String(req.body?.email || '').trim().toLowerCase();
        const password = String(req.body?.password || '');
        const name = String(req.body?.name || '').trim();
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        const existingUser = await findUserByEmail(email);
        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists' });
        }
        const user = await createUser(email, password, name || email.split('@')[0]);
        const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
            },
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Registration failed' });
    }
});
// Get Current User (Me)
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await findUserById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
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
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});
// Generate Referral Code
router.post('/referral/generate', authenticateToken, async (req, res) => {
    try {
        const user = await findUserById(req.user.id);
        if (!user)
            return res.status(404).json({ error: 'User not found' });
        if (user.referralCode) {
            return res.json({ referralCode: user.referralCode });
        }
        // Generate unique code (simple 8 char random)
        const generateCode = () => Math.random().toString(36).substring(2, 10).toUpperCase();
        let code = generateCode();
        // Simple check for collision (retry once)
        let existing = await findUserByReferralCode(code);
        if (existing) {
            code = generateCode();
        }
        user.referralCode = code;
        await user.save();
        // Invalidate cache
        await redisClient.del(`user:${user.id}`);
        res.json({ referralCode: code });
    }
    catch (error) {
        console.error('Generate referral error:', error);
        res.status(500).json({ error: 'Failed to generate code' });
    }
});
// Redeem Referral Code
router.post('/referral/redeem', authenticateToken, async (req, res) => {
    try {
        const { code } = req.body;
        if (!code)
            return res.status(400).json({ error: 'Code is required' });
        const redeemer = await findUserById(req.user.id);
        if (!redeemer)
            return res.status(404).json({ error: 'User not found' });
        if (redeemer.referredBy) {
            return res.status(400).json({ error: 'You have already redeemed a code' });
        }
        const referrer = await findUserByReferralCode(code);
        if (!referrer) {
            return res.status(404).json({ error: 'Invalid referral code' });
        }
        if (referrer.id === redeemer.id) {
            return res.status(400).json({ error: 'Cannot redeem your own code' });
        }
        // Grant rewards
        // Redeemer gets 50
        redeemer.referredBy = referrer.id;
        await redeemer.save();
        await recordTokenUsage(redeemer.id, 50, 'referral_bonus', 'system', {
            referrerId: referrer.id,
            referralCode: code,
        });
        await redisClient.del(`user:${redeemer.id}`);
        // Referrer gets 100
        await recordTokenUsage(referrer.id, 100, 'referral_reward', 'system', {
            redeemerId: redeemer.id,
            referralCode: code,
        });
        await redisClient.del(`user:${referrer.id}`);
        res.json({ message: 'Redeemed successfully! You got 50 tokens.' });
    }
    catch (error) {
        console.error('Redeem referral error:', error);
        res.status(500).json({ error: 'Failed to redeem code' });
    }
});
// Increment Multi-Model Usage Count
router.post('/increment-usage', authenticateToken, async (req, res) => {
    try {
        const user = await findUserById(req.user.id);
        if (!user)
            return res.status(404).json({ error: 'User not found' });
        user.multiModelUsageCount = (user.multiModelUsageCount || 0) + 1;
        await user.save();
        // Invalidate cache
        await redisClient.del(`user:${user.id}`);
        res.json({ success: true, count: user.multiModelUsageCount });
    }
    catch (error) {
        console.error('Increment usage error:', error);
        res.status(500).json({ error: 'Failed to increment usage' });
    }
});
// WeChat Login Callback
router.post('/wechat/login', withRateLimit('auth'), async (req, res) => {
    try {
        const { code } = req.body;
        if (!code)
            return res.status(400).json({ error: 'Code is required' });
        const userInfo = await WeChatOAuthService.processCallback(code);
        // Find user by openid
        let user = await User.findOne({ where: { wechatOpenId: userInfo.openid } });
        if (!user && userInfo.unionid) {
            // Try unionid if available
            user = await User.findOne({ where: { wechatUnionId: userInfo.unionid } });
        }
        if (!user) {
            // Create new user
            const randomSuffix = uuidv4().split('-')[0];
            // Use purely random email to prevent WeChat ID exposure
            const email = `wx_${uuidv4()}@local.app`;
            const password = uuidv4(); // Random password
            user = await createUser(email, password, userInfo.nickname || 'WeChat User');
            user.wechatOpenId = userInfo.openid;
            user.wechatUnionId = userInfo.unionid || '';
            user.avatar = userInfo.headimgurl;
            await user.save();
        }
        else {
            // Update info if needed
            let changed = false;
            if (userInfo.headimgurl && user.avatar !== userInfo.headimgurl) {
                user.avatar = userInfo.headimgurl;
                changed = true;
            }
            if (userInfo.nickname && user.name === 'WeChat User') {
                user.name = userInfo.nickname;
                changed = true;
            }
            // If found by unionid but openid is missing (should not happen for same app, but good for safety)
            if (!user.wechatOpenId) {
                user.wechatOpenId = userInfo.openid;
                changed = true;
            }
            if (changed)
                await user.save();
        }
        const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                avatar: user.avatar,
                membershipLevel: user.membershipLevel,
                tokensBalance: user.tokensBalance,
                multiModelUsageCount: user.multiModelUsageCount,
            },
        });
    }
    catch (error) {
        console.error('WeChat login error:', error);
        res.status(500).json({ error: error.message || 'WeChat login failed' });
    }
});
// Logout
router.post('/logout', authenticateToken, async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (token) {
            const decoded = jwt.decode(token);
            if (decoded && decoded.exp) {
                const ttl = decoded.exp - Math.floor(Date.now() / 1000);
                if (ttl > 0) {
                    await redisClient.set(`blacklist:${token}`, 'true', { EX: ttl });
                }
            }
        }
        // Logging
        const userId = req.user?.id || 'Unknown';
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        console.log(`[LOGOUT] User: ${userId}, IP: ${ip}, Time: ${new Date().toISOString()}`);
        res.json({ message: 'Logged out successfully' });
    }
    catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
});
export const authRouter = router;

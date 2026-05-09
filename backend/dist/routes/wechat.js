import express from 'express';
import { WeChatService } from '../services/wechat/jssdk.js';
const router = express.Router();
router.post('/signature', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }
        const signatureData = await WeChatService.getSignature(url);
        res.json(signatureData);
    }
    catch (error) {
        console.error('WeChat Signature Error:', error);
        res.status(500).json({ error: error.message || 'Failed to generate signature' });
    }
});
router.post('/callback', (req, res) => {
    const { type, url, status } = req.body;
    console.log(`[WeChat Share] Type: ${type}, Status: ${status}, URL: ${url}, Time: ${new Date().toISOString()}`);
    // TODO: Save to database for analytics
    res.json({ success: true });
});
export default router;

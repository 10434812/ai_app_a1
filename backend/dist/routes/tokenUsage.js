import express from 'express';
import { getTokenStats, getTokenHistory, getTokenTrend } from '../services/tokenService.js';
import { authenticateToken } from '../middleware/auth.js';
const router = express.Router();
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const stats = await getTokenStats(userId);
        res.json(stats);
    }
    catch (error) {
        console.error('Get token stats error:', error);
        res.status(500).json({ error: 'Failed to fetch token stats' });
    }
});
router.get('/history', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const type = req.query.type;
        const model = req.query.model;
        const start = req.query.start;
        const end = req.query.end;
        const startDate = start ? new Date(`${start}T00:00:00`) : undefined;
        const endDate = end ? new Date(`${end}T23:59:59`) : undefined;
        const history = await getTokenHistory(userId, page, limit, type, model, startDate, endDate);
        res.json(history);
    }
    catch (error) {
        console.error('Get token history error:', error);
        res.status(500).json({ error: 'Failed to fetch token history' });
    }
});
router.get('/trend', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const days = parseInt(req.query.days) || 30;
        const trend = await getTokenTrend(userId, days);
        res.json(trend);
    }
    catch (error) {
        console.error('Get token trend error:', error);
        res.status(500).json({ error: 'Failed to fetch token trend' });
    }
});
// Export CSV/Excel (Simplified as CSV for now)
router.get('/export', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        // Fetch all history for export (limit to last 1000 for safety)
        const { records } = await getTokenHistory(userId, 1, 1000);
        // Convert to CSV
        const fields = ['Time', 'Type', 'Amount', 'Model', 'Balance After'];
        const csv = [
            fields.join(','),
            ...records.map(r => {
                return [
                    new Date(r.createdAt).toISOString(),
                    r.type,
                    r.amount,
                    r.model || '',
                    r.balanceAfter
                ].join(',');
            })
        ].join('\n');
        res.header('Content-Type', 'text/csv');
        res.attachment('token_usage.csv');
        res.send(csv);
    }
    catch (error) {
        console.error('Export token usage error:', error);
        res.status(500).json({ error: 'Failed to export token usage' });
    }
});
export const tokenUsageRouter = router;

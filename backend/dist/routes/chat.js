import { Router } from 'express';
import { Op } from 'sequelize';
import { LLMFactory } from '../services/llm/factory.js';
import { releaseReservedTokens, reserveUserTokenBudget, settleReservedChatUsage } from '../services/tokenService.js';
import redisClient from '../config/redis.js';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { User } from '../models/User.js';
import { authenticateToken, optionalAuthenticateToken } from '../middleware/auth.js';
import { withConcurrencyGuard, withEntitlement, enforceModelSelectionLimit } from '../middleware/entitlement.js';
import { buildRealtimeContextMessage, buildRuntimeGuardrailMessage } from '../services/realtimeContextService.js';
import { calculateChatCost, estimateTextTokens, getBillingConfig } from '../services/billingConfigService.js';
import { captureError, metricCounters } from '../services/observabilityService.js';
import { withRateLimit } from '../middleware/rateLimit.js';
import { ALL_MODELS } from '../services/llm/config.js';
import { SystemConfig } from '../models/SystemConfig.js';
import { isModelActive } from '../services/modelStatusService.js';
import { getPublicModelStatusMap } from '../services/modelCatalogService.js';
export const chatRouter = Router();
const IMAGE_ASSISTANT_MODEL_IDS = new Set(['aliyun-image', 'wanxiang', 'zhipu-image', 'kolors']);
const IMAGE_REPLY_PATTERN = /!\[[^\]]*生成图片[^\]]*\]\([^)]*\)|\[(?:查看原图|原图)[^\]]*\]\([^)]*\)/i;
const MODEL_ID_ALIASES = {
    minimax: 'hailuo',
    '360-ai': '360-gpt',
};
const IDENTITY_QUERY_RE = /(什么模型|哪个模型|模型id|model id|底层模型|你是谁|你是哪个|你是什么ai|你的身份)/i;
const resolveModelAlias = (modelId) => MODEL_ID_ALIASES[modelId] || modelId;
const mergeSystemMessagesToFront = (messages) => {
    const systemContents = [];
    const normalMessages = [];
    for (const msg of messages || []) {
        const role = msg?.role;
        const content = typeof msg?.content === 'string' ? msg.content.trim() : '';
        if (!content)
            continue;
        if (role === 'system') {
            systemContents.push(content);
            continue;
        }
        if (role === 'user' || role === 'assistant') {
            normalMessages.push({ role, content });
        }
    }
    if (systemContents.length === 0)
        return normalMessages;
    return [
        {
            role: 'system',
            content: systemContents.join('\n\n'),
        },
        ...normalMessages,
    ];
};
const getSelectedModelCount = (value) => {
    const parsed = Number.parseInt(String(value || ''), 10);
    if (!Number.isFinite(parsed) || parsed <= 0)
        return 1;
    return parsed;
};
const calculateReservationTarget = (balance, minCost, selectedModelCount) => {
    const safeBalance = Math.max(0, Math.floor(balance || 0));
    const safeMinCost = Math.max(1, Math.floor(minCost || 1));
    const perModelShare = Math.max(safeMinCost, Math.ceil(safeBalance / Math.max(1, selectedModelCount)));
    const cappedShare = Math.min(safeBalance, Math.max(safeMinCost, Math.min(perModelShare, 600)));
    return Math.max(safeMinCost, cappedShare);
};
const getRoutedModelName = (modelId) => {
    const resolvedId = resolveModelAlias(modelId);
    const modelDef = ALL_MODELS.find((m) => m.id === modelId || m.id === resolvedId);
    return modelDef?.name || modelId;
};
const buildRouteMeta = async (modelId) => {
    const resolvedId = resolveModelAlias(modelId);
    const modelDef = ALL_MODELS.find((m) => m.id === modelId || m.id === resolvedId);
    const publicStatusMap = await getPublicModelStatusMap();
    const status = publicStatusMap[modelId] || publicStatusMap[resolvedId] || null;
    return {
        appModelId: modelId,
        resolvedModelId: resolvedId,
        routedModelName: modelDef?.name || modelId,
        provider: status?.provider || modelDef?.provider || 'mock',
        upstreamModelId: status?.upstreamModelId || modelDef?.apiConfig?.modelId || resolvedId,
        source: status?.source || 'placeholder',
        status: status?.status || 'placeholder',
        statusText: status?.statusText || '待接入',
    };
};
const buildModelIdentityGuardrailMessage = (modelId) => {
    const resolvedId = resolveModelAlias(modelId);
    const routedName = getRoutedModelName(modelId);
    const content = [
        'Model routing context:',
        `- Current routed model name: ${routedName}`,
        `- Current application model id: ${modelId}`,
        `- Alias-resolved model id: ${resolvedId}`,
        '- Never claim to be another model/vendor. Do not say you are DeepSeek/Claude/ChatGPT/etc unless that exactly matches the routed model name above.',
        '- If asked about identity, answer strictly using the routed model context above.',
    ].join('\n');
    return {
        role: 'system',
        content,
    };
};
const isModelIdentityQuery = (query) => {
    const text = (query || '').trim();
    if (!text)
        return false;
    // Keep this narrow to avoid hijacking normal long-form tasks.
    if (text.length > 64)
        return false;
    return IDENTITY_QUERY_RE.test(text);
};
const buildModelIdentityReply = async (modelId) => {
    const resolvedId = resolveModelAlias(modelId);
    const modelDef = ALL_MODELS.find((m) => m.id === modelId || m.id === resolvedId);
    let upstreamModelId = modelDef?.apiConfig?.modelId || resolvedId;
    try {
        const configKeys = modelId === resolvedId ? [`model_config:${modelId}`] : [`model_config:${modelId}`, `model_config:${resolvedId}`];
        for (const key of configKeys) {
            const row = await SystemConfig.findByPk(key);
            if (!row?.value)
                continue;
            const parsed = JSON.parse(row.value);
            if (typeof parsed?.modelId === 'string' && parsed.modelId.trim()) {
                upstreamModelId = parsed.modelId.trim();
            }
            break;
        }
    }
    catch (err) {
        console.error('Build model identity reply failed:', err);
    }
    return `当前路由模型：${modelDef?.name || modelId}（应用ID: ${modelId}）。上游模型参数：${upstreamModelId}。`;
};
const isImageLikeAssistantMessage = (msg) => {
    if (msg.role !== 'assistant')
        return false;
    const modelId = typeof msg.model === 'string' ? msg.model : '';
    if (IMAGE_ASSISTANT_MODEL_IDS.has(modelId))
        return true;
    const content = (msg.content || '').trim();
    if (!content)
        return false;
    return IMAGE_REPLY_PATTERN.test(content);
};
// Get chat history for the authenticated user
chatRouter.get('/history', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const conversations = await Conversation.findAll({
            where: { userId },
            order: [['updatedAt', 'DESC']],
            limit: 100,
        });
        const conversationIds = conversations.map((item) => item.id);
        let modelMap = new Map();
        if (conversationIds.length > 0) {
            const assistantMessages = await Message.findAll({
                where: {
                    conversationId: { [Op.in]: conversationIds },
                    role: 'assistant',
                    model: { [Op.ne]: null },
                },
                attributes: ['conversationId', 'model', 'createdAt'],
                order: [['createdAt', 'DESC']],
            });
            modelMap = assistantMessages.reduce((acc, msg) => {
                const conversationId = String(msg.conversationId);
                const modelId = String(msg.model || '').trim();
                if (!modelId)
                    return acc;
                const existing = acc.get(conversationId) || [];
                if (!existing.includes(modelId)) {
                    existing.push(modelId);
                    acc.set(conversationId, existing);
                }
                return acc;
            }, new Map());
        }
        res.json(conversations.map((conversation) => ({
            ...conversation.toJSON(),
            modelIds: modelMap.get(conversation.id) || [],
        })));
    }
    catch (err) {
        console.error('Error fetching chat history:', err);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});
chatRouter.patch('/:conversationId/favorite', authenticateToken, async (req, res) => {
    const { conversationId } = req.params;
    const { isFavorite } = req.body || {};
    const userId = req.user.id;
    if (typeof isFavorite !== 'boolean') {
        return res.status(400).json({ error: 'Missing isFavorite boolean' });
    }
    try {
        const conversation = await Conversation.findByPk(conversationId);
        if (!conversation || conversation.userId !== userId) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        conversation.isFavorite = isFavorite;
        await conversation.save();
        res.json({
            success: true,
            conversation,
        });
    }
    catch (err) {
        console.error('Error updating conversation favorite state:', err);
        res.status(500).json({ error: 'Failed to update favorite state' });
    }
});
chatRouter.patch('/batch/archive', authenticateToken, async (req, res) => {
    const { conversationIds, isArchived } = req.body || {};
    const userId = req.user.id;
    if (!Array.isArray(conversationIds) || conversationIds.length === 0 || typeof isArchived !== 'boolean') {
        return res.status(400).json({ error: 'Missing conversationIds or isArchived' });
    }
    try {
        const normalizedIds = Array.from(new Set(conversationIds.map((id) => String(id).trim()).filter(Boolean)));
        const conversations = await Conversation.findAll({
            where: {
                id: { [Op.in]: normalizedIds },
                userId,
            },
        });
        if (conversations.length === 0) {
            return res.status(404).json({ error: 'Conversations not found' });
        }
        await Conversation.update({ isArchived, ...(isArchived ? { isFavorite: false } : {}) }, {
            where: {
                id: { [Op.in]: conversations.map((item) => item.id) },
                userId,
            },
        });
        res.json({
            success: true,
            affectedIds: conversations.map((item) => item.id),
        });
    }
    catch (err) {
        console.error('Error updating conversation archive state in batch:', err);
        res.status(500).json({ error: 'Failed to update archive state' });
    }
});
chatRouter.patch('/:conversationId/archive', authenticateToken, async (req, res) => {
    const { conversationId } = req.params;
    const { isArchived } = req.body || {};
    const userId = req.user.id;
    if (typeof isArchived !== 'boolean') {
        return res.status(400).json({ error: 'Missing isArchived boolean' });
    }
    try {
        const conversation = await Conversation.findByPk(conversationId);
        if (!conversation || conversation.userId !== userId) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        conversation.isArchived = isArchived;
        if (isArchived) {
            conversation.isFavorite = false;
        }
        await conversation.save();
        res.json({
            success: true,
            conversation,
        });
    }
    catch (err) {
        console.error('Error updating conversation archive state:', err);
        res.status(500).json({ error: 'Failed to update archive state' });
    }
});
// Get messages for a specific conversation (only owner can access)
chatRouter.get('/:conversationId/messages', authenticateToken, async (req, res) => {
    const { conversationId } = req.params;
    const userId = req.user.id;
    try {
        const conv = await Conversation.findByPk(conversationId);
        if (!conv || conv.userId !== userId) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        const messages = await Message.findAll({
            where: { conversationId },
            order: [['createdAt', 'ASC']],
        });
        res.json(messages);
    }
    catch (err) {
        console.error('Error fetching conversation messages:', err);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});
// Rename a conversation
chatRouter.put('/:conversationId', authenticateToken, async (req, res) => {
    const { conversationId } = req.params;
    const { title } = req.body;
    if (!title) {
        res.status(400).json({ error: 'Missing title' });
        return;
    }
    const userId = req.user.id;
    try {
        const conversation = await Conversation.findByPk(conversationId);
        if (!conversation || conversation.userId !== userId) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        conversation.title = title;
        await conversation.save();
        res.json({ success: true, conversation });
    }
    catch (err) {
        console.error('Error renaming conversation:', err);
        res.status(500).json({ error: 'Failed to rename conversation' });
    }
});
// Delete a conversation
chatRouter.delete('/:conversationId', authenticateToken, async (req, res) => {
    const { conversationId } = req.params;
    const userId = req.user.id;
    try {
        const conversation = await Conversation.findByPk(conversationId);
        if (!conversation || conversation.userId !== userId) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        await Message.destroy({ where: { conversationId } });
        await conversation.destroy();
        res.json({ success: true });
    }
    catch (err) {
        console.error('Error deleting conversation:', err);
        res.status(500).json({ error: 'Failed to delete conversation' });
    }
});
chatRouter.post('/batch-delete', authenticateToken, async (req, res) => {
    const { conversationIds } = req.body || {};
    const userId = req.user.id;
    if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
        return res.status(400).json({ error: 'Missing conversationIds' });
    }
    try {
        const normalizedIds = Array.from(new Set(conversationIds.map((id) => String(id).trim()).filter(Boolean)));
        const conversations = await Conversation.findAll({
            where: {
                id: { [Op.in]: normalizedIds },
                userId,
            },
            attributes: ['id'],
        });
        if (conversations.length === 0) {
            return res.status(404).json({ error: 'Conversations not found' });
        }
        const ownedIds = conversations.map((item) => item.id);
        await Message.destroy({ where: { conversationId: { [Op.in]: ownedIds } } });
        await Conversation.destroy({
            where: {
                id: { [Op.in]: ownedIds },
                userId,
            },
        });
        res.json({
            success: true,
            affectedIds: ownedIds,
        });
    }
    catch (err) {
        console.error('Error deleting conversations in batch:', err);
        res.status(500).json({ error: 'Failed to delete conversations' });
    }
});
// Create a new message (and conversation if needed) - Single entry point for user messages
chatRouter.post('/message', optionalAuthenticateToken, async (req, res) => {
    const { conversationId: reqConversationId, content, model, role: requestedRole } = req.body;
    if (!content) {
        res.status(400).json({ error: 'Missing content' });
        return;
    }
    const role = requestedRole === 'assistant' ? 'assistant' : 'user';
    if (role === 'assistant' && !req.user) {
        res.status(401).json({ error: 'Assistant message requires authentication' });
        return;
    }
    // Optional auth user (logged-in user) – guests will have no req.user
    const userId = req.user?.id ?? null;
    let conversationId = reqConversationId;
    try {
        if (conversationId) {
            const existingConversation = await Conversation.findByPk(conversationId);
            if (!existingConversation) {
                res.status(404).json({ error: 'Conversation not found' });
                return;
            }
            if (existingConversation.userId && existingConversation.userId !== userId) {
                res.status(403).json({ error: 'Forbidden' });
                return;
            }
        }
        if (!conversationId) {
            const conversation = await Conversation.create({
                userId,
                title: content.substring(0, 50) || 'New Chat',
            });
            conversationId = conversation.id;
            console.log('New Conversation Created (via /message):', conversationId);
        }
        await Message.create({
            conversationId,
            role,
            content,
            model: model || null,
        });
        res.json({ conversationId });
    }
    catch (err) {
        console.error('Error saving message:', err);
        res.status(500).json({ error: 'Failed to save message' });
    }
});
chatRouter.post('/', optionalAuthenticateToken, withRateLimit('chat'), withEntitlement, enforceModelSelectionLimit, withConcurrencyGuard('ai'), async (req, res) => {
    const { model, messages, conversationId: reqConversationId, saveUserMessage = true, saveAssistantMessage = true, useHistory = true, } = req.body;
    if (!model || !messages) {
        res.status(400).json({ error: 'Missing model or messages' });
        return;
    }
    if (!(await isModelActive(String(model)))) {
        res.status(403).json({ error: '该模型已被管理员禁用' });
        return;
    }
    // Optional auth user: logged-in users会走扣费逻辑，游客则不扣费
    const userId = req.user?.id ?? null;
    metricCounters.chatRequest();
    let user = null;
    const billingConfig = await getBillingConfig();
    if (userId) {
        user = await User.findByPk(userId);
        if (user && user.tokensBalance <= 0) {
            res.status(402).json({ error: 'Token余额不足，请充值' });
            return;
        }
    }
    let reservedAmount = 0;
    let tokenSettled = false;
    let inputLenForCost = 0;
    const releaseReservationSafely = async () => {
        if (!user || tokenSettled || reservedAmount <= 0)
            return;
        try {
            await releaseReservedTokens(user.id, reservedAmount);
            tokenSettled = true;
        }
        catch (err) {
            console.error('Release reserved tokens error:', err);
        }
    };
    // --- DB Persistence Start ---
    let conversationId = reqConversationId;
    try {
        if (!conversationId && (saveUserMessage || saveAssistantMessage)) {
            const conversation = await Conversation.create({
                userId: userId || null,
                title: messages[messages.length - 1]?.content?.substring(0, 50) || 'New Chat',
            });
            conversationId = conversation.id;
            console.log('New Conversation Created:', conversationId, 'User:', userId);
        }
        const lastUserMessage = messages[messages.length - 1];
        if (saveUserMessage && lastUserMessage && lastUserMessage.role === 'user') {
            await Message.create({
                conversationId,
                role: 'user',
                content: lastUserMessage.content,
                model: model,
            });
        }
    }
    catch (err) {
        console.error('Error saving chat to DB (init):', err);
    }
    // --- DB Persistence End ---
    // --- Context Building Start ---
    // Fetch recent messages to build context for the LLM
    let contextMessages = [...messages];
    if (conversationId && useHistory) {
        try {
            const history = await Message.findAll({
                where: { conversationId },
                order: [['createdAt', 'ASC']],
                limit: 50, // Increase fetch limit for better context awareness
            });
            // Intelligent Context Compression
            // Strategy:
            // 1. Always keep the system prompt (if any) and the last 6 messages intact.
            // 2. For older messages, compress content if it exceeds a certain length.
            // 3. Drop oldest messages if total token count (estimated) exceeds safety limit.
            const MAX_CHARS_PER_OLD_MSG = 300;
            const PRESERVE_COUNT = 6;
            // Multi-model conversations share one conversationId.
            // Keep all user turns, but only keep assistant turns from the current model,
            // otherwise the next round will incorrectly feed other models' answers back in.
            const filteredHistory = history.filter((msg) => {
                if (msg.role === 'user')
                    return true;
                if (msg.role === 'assistant') {
                    if (isImageLikeAssistantMessage(msg))
                        return false;
                    return String(msg.model || '') === String(model);
                }
                return msg.role === 'system';
            });
            const processedHistory = filteredHistory.map((msg, index) => {
                const isRecent = index >= filteredHistory.length - PRESERVE_COUNT;
                let content = msg.content;
                if (!isRecent && content && content.length > MAX_CHARS_PER_OLD_MSG) {
                    // Compress old message
                    content = content.substring(0, MAX_CHARS_PER_OLD_MSG) + '\n...(content compressed)...';
                }
                return {
                    role: msg.role,
                    content: content,
                };
            }).filter(msg => msg.content !== undefined && msg.content !== null);
            contextMessages = processedHistory;
            // If we didn't save the current message to DB (e.g. regenerate or pre-saved), 
            // the fetched history MIGHT include it (if pre-saved), or might not (if regenerate).
            // We need to append it ONLY if it's missing from the DB history.
            if (!saveUserMessage && messages.length > 0) {
                const lastUserMsg = messages[messages.length - 1];
                const lastDbMsg = contextMessages.length > 0 ? contextMessages[contextMessages.length - 1] : null;
                // Check if the last DB message matches the user message we are trying to append
                const isDuplicate = lastDbMsg &&
                    lastDbMsg.role === lastUserMsg.role &&
                    lastDbMsg.content === lastUserMsg.content;
                if (!isDuplicate) {
                    contextMessages = [...contextMessages, ...messages];
                }
            }
        }
        catch (err) {
            console.error('Error building context:', err);
            // Fallback to provided messages
        }
    }
    // --- Context Building End ---
    const latestUserQuery = [...messages].reverse().find((m) => m?.role === 'user')?.content || '';
    const runtimeGuardrail = buildRuntimeGuardrailMessage(latestUserQuery);
    const modelIdentityGuardrail = buildModelIdentityGuardrailMessage(model);
    const realtimeContext = await buildRealtimeContextMessage(latestUserQuery);
    const routeMeta = await buildRouteMeta(String(model));
    const prependSystemMessages = realtimeContext ? [runtimeGuardrail, modelIdentityGuardrail, realtimeContext] : [runtimeGuardrail, modelIdentityGuardrail];
    contextMessages = mergeSystemMessagesToFront([...prependSystemMessages, ...contextMessages]);
    inputLenForCost = contextMessages.reduce((acc, m) => acc + (m?.content?.length || 0), 0);
    const estimatedPromptTokens = estimateTextTokens(contextMessages.map((m) => m?.content || '').join('\n'));
    const minCost = calculateChatCost(billingConfig, model, estimatedPromptTokens, 0);
    const selectedModelCount = getSelectedModelCount(req.body?.selectedModelCount);
    if (user) {
        try {
            const reserveTarget = calculateReservationTarget(user.tokensBalance, minCost, selectedModelCount);
            const reservation = await reserveUserTokenBudget(user.id, reserveTarget);
            reservedAmount = reservation.reservedAmount;
        }
        catch (err) {
            const msg = err?.message || 'Token预留失败';
            if (msg.includes('Insufficient balance')) {
                res.status(402).json({ error: 'Token余额不足，请充值' });
                return;
            }
            console.error('Reserve token budget error:', err);
            res.status(500).json({ error: 'Token预留失败，请稍后重试' });
            return;
        }
    }
    if (user && reservedAmount > 0) {
        if (minCost > reservedAmount) {
            await releaseReservationSafely();
            res.status(402).json({ error: 'Token余额不足，请缩短问题或先充值' });
            return;
        }
    }
    // Increment total requests counter
    try {
        await redisClient.incr('stats:totalRequests');
        // Increment model usage
        await redisClient.hIncrBy('stats:modelUsage', model, 1);
    }
    catch (err) {
        console.error('Redis stats error:', err);
    }
    // Set headers for SSE (Server-Sent Events)
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    res.socket?.setNoDelay(true);
    res.socket?.setTimeout(0);
    res.write(':' + ' '.repeat(2048) + '\n\n');
    // Send the conversationId back to client in a meta event
    res.write(`data: ${JSON.stringify({ meta: { conversationId, route: routeMeta } })}\n\n`);
    // Deterministic answer for "what model are you" style queries to prevent vendor identity hallucination.
    if (isModelIdentityQuery(latestUserQuery)) {
        await releaseReservationSafely();
        const identityReply = await buildModelIdentityReply(model);
        res.write(`data: ${JSON.stringify({ meta: { route: routeMeta } })}\n\n`);
        res.write(`data: ${JSON.stringify({ content: identityReply })}\n\n`);
        if (conversationId && saveAssistantMessage) {
            try {
                await Message.create({
                    conversationId,
                    role: 'assistant',
                    content: identityReply,
                    model: model,
                });
            }
            catch (err) {
                console.error('Error saving identity reply message:', err);
            }
        }
        res.write('data: [DONE]\n\n');
        res.end();
        return;
    }
    let fullResponse = '';
    let providerUsage;
    try {
        const apiKey = req.body.apiKey; // Get Custom API Key from body
        const provider = await LLMFactory.getProvider(model, apiKey);
        console.log(`[StreamStart] Model: ${model} CustomKey: ${!!apiKey}`);
        let chunkCount = 0;
        const streamResult = await provider.chatStream(contextMessages, (chunk) => {
            chunkCount++;
            if (chunkCount === 1)
                console.log(`[FirstChunk] Model: ${model} Time: ${Date.now()}`);
            fullResponse += chunk || '';
            const success = res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
            if (res.flush)
                res.flush();
        });
        providerUsage = streamResult?.usage;
        console.log(`[StreamEnd] Model: ${model} TotalChunks: ${chunkCount}`);
        if (!fullResponse.trim()) {
            await releaseReservationSafely();
            res.write(`data: ${JSON.stringify({ error: '模型未返回有效文本内容，请重试' })}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
            return;
        }
        // --- DB Persistence: Save Assistant Response ---
        if (conversationId && fullResponse && saveAssistantMessage) {
            try {
                const aiMsg = await Message.create({
                    conversationId,
                    role: 'assistant',
                    content: fullResponse,
                    model: model,
                });
                console.log('AI Message Saved:', aiMsg.id);
            }
            catch (err) {
                console.error('Error saving AI message:', err);
            }
        }
        // --- Token Deduction ---
        if (user) {
            const outputLen = fullResponse.length;
            const promptTokensFromProvider = Math.max(0, Math.floor(providerUsage?.promptTokens || 0));
            const completionTokensFromProvider = Math.max(0, Math.floor(providerUsage?.completionTokens || 0));
            const totalTokensFromProvider = Math.max(0, Math.floor(providerUsage?.totalTokens || 0));
            let promptTokens = promptTokensFromProvider;
            let completionTokens = completionTokensFromProvider;
            let usageSource = 'provider';
            if (!promptTokens && !completionTokens && totalTokensFromProvider > 0) {
                promptTokens = estimatedPromptTokens;
                completionTokens = Math.max(0, totalTokensFromProvider - promptTokens);
            }
            if (!promptTokens && !completionTokens) {
                usageSource = 'estimate';
                promptTokens = estimatedPromptTokens;
                completionTokens = Math.max(0, Math.ceil(Math.max(0, outputLen) / 4));
            }
            const cost = calculateChatCost(billingConfig, model, promptTokens, completionTokens);
            try {
                await settleReservedChatUsage({
                    userId: user.id,
                    reservedAmount,
                    actualCost: cost,
                    model,
                    meta: {
                        inputLen: inputLenForCost,
                        outputLen,
                        prompt_tokens: promptTokens,
                        completion_tokens: completionTokens,
                        usage_source: usageSource,
                        total_cost: cost,
                        conversationId,
                    },
                });
                metricCounters.tokenDeductSuccess();
                tokenSettled = true;
                console.log(`Deducted ${cost} tokens for User ${user.id}`);
            }
            catch (err) {
                console.error('Token deduction error:', err);
                metricCounters.tokenDeductFailed();
                await releaseReservationSafely();
                res.write(`data: ${JSON.stringify({ error: err?.message || 'Token扣费失败，请稍后重试' })}\n\n`);
                res.write('data: [DONE]\n\n');
                res.end();
                return;
            }
        }
        // ----------------------------------------------
        res.write('data: [DONE]\n\n');
        res.end();
    }
    catch (error) {
        await releaseReservationSafely();
        captureError(error, { scope: 'chat.stream', model, conversationId: conversationId || undefined });
        res.write(`data: ${JSON.stringify({ error: error.message || 'Unknown error' })}\n\n`);
        res.end();
    }
});

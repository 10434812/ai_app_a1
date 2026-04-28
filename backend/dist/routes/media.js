import { Router } from 'express';
import { authenticateToken } from "../middleware/auth.js";
import { getImageGenerationPublicOptions } from "../services/media/imageService.js";
import { createImageTask, getTaskByIdForUser, runMediaTaskWorkerTick, startMediaTaskWorker } from "../services/media/mediaTaskService.js";
import { withConcurrencyGuard, withEntitlement, enforceImageRequestLimit } from "../middleware/entitlement.js";
import { captureError } from "../services/observabilityService.js";
import { withRateLimit } from "../middleware/rateLimit.js";
import { sendError } from "../errors/api.js";
import { isModelActive } from "../services/modelStatusService.js";
const router = Router();
startMediaTaskWorker();
router.get('/image/options', async (_req, res) => {
    try {
        const options = await getImageGenerationPublicOptions();
        res.json(options);
    }
    catch (error) {
        captureError(error, { scope: 'media.image.options' });
        sendError(res, {
            status: 500,
            code: 'IMAGE_OPTIONS_FETCH_FAILED',
            message: '获取图片生成配置失败',
            retryable: true,
        });
    }
});
router.post('/image/generate', authenticateToken, withRateLimit('image'), withEntitlement, enforceImageRequestLimit, withConcurrencyGuard('ai'), async (req, res) => {
    try {
        const { prompt, provider, model, size, n, modelId } = req.body || {};
        if (modelId && !(await isModelActive(String(modelId)))) {
            return sendError(res, {
                status: 403,
                code: 'MODEL_DISABLED',
                message: '该模型已被管理员禁用',
                retryable: false,
            });
        }
        const task = await createImageTask({
            userId: req.user.id,
            prompt,
            provider,
            model,
            size,
            n,
            modelId,
        });
        // Trigger a near-real-time worker tick so users see progress quickly.
        runMediaTaskWorkerTick().catch(() => {
            // no-op
        });
        res.status(202).json({
            success: true,
            task,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error || '');
        if (message.includes('Token余额不足')) {
            return sendError(res, {
                status: 402,
                code: 'INSUFFICIENT_BALANCE',
                message,
                retryable: false,
            });
        }
        if (message.includes('Prompt is required')) {
            return sendError(res, {
                status: 400,
                code: 'INVALID_PROMPT',
                message: '提示词不能为空',
                retryable: false,
            });
        }
        if (message.includes('User not found')) {
            return sendError(res, {
                status: 404,
                code: 'USER_NOT_FOUND',
                message: '用户不存在',
                retryable: false,
            });
        }
        captureError(error, { scope: 'media.image.create_task' });
        sendError(res, {
            status: 500,
            code: 'IMAGE_TASK_CREATE_FAILED',
            message: '创建图片任务失败，请稍后重试',
            retryable: true,
        });
    }
});
router.get('/tasks/:taskId', authenticateToken, async (req, res) => {
    try {
        const taskId = String(req.params.taskId || '').trim();
        if (!taskId) {
            return sendError(res, {
                status: 400,
                code: 'TASK_ID_REQUIRED',
                message: '缺少任务ID',
                retryable: false,
            });
        }
        const task = await getTaskByIdForUser(taskId, req.user.id);
        if (!task) {
            return sendError(res, {
                status: 404,
                code: 'TASK_NOT_FOUND',
                message: '任务不存在',
                retryable: false,
            });
        }
        res.json({
            success: true,
            task,
        });
    }
    catch (error) {
        captureError(error, { scope: 'media.task.status', taskId: req.params.taskId });
        sendError(res, {
            status: 500,
            code: 'TASK_STATUS_FETCH_FAILED',
            message: '获取任务状态失败',
            retryable: true,
        });
    }
});
router.post('/video/generate', authenticateToken, withRateLimit('image'), withEntitlement, async (_req, res) => {
    sendError(res, {
        status: 501,
        code: 'VIDEO_NOT_IMPLEMENTED',
        message: '视频生成功能正在接入中，暂未开放',
        retryable: false,
    });
});
export default router;

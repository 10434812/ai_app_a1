import {Router, Request, Response} from 'express'
import {authenticateToken} from '../middleware/auth.ts'
import {getImageGenerationPublicOptions} from '../services/media/imageService.ts'
import {
  createImageTask,
  createVideoTask,
  getTaskByIdForUser,
  runMediaTaskWorkerTick,
  startMediaTaskWorker,
} from '../services/media/mediaTaskService.ts'
import {withConcurrencyGuard, withEntitlement, enforceImageRequestLimit} from '../middleware/entitlement.ts'
import {captureError} from '../services/observabilityService.ts'
import {withRateLimit} from '../middleware/rateLimit.ts'
import {sendError} from '../errors/api.ts'
import {isModelActive} from '../services/modelStatusService.ts'

const router = Router()

startMediaTaskWorker()

router.get('/image/options', async (_req: Request, res: Response) => {
  try {
    const options = await getImageGenerationPublicOptions()
    res.json(options)
  } catch (error) {
    captureError(error, {scope: 'media.image.options'})
    sendError(res, {
      status: 500,
      code: 'IMAGE_OPTIONS_FETCH_FAILED',
      message: '获取图片生成配置失败',
      retryable: true,
    })
  }
})

router.post(
  '/image/generate',
  authenticateToken,
  withRateLimit('image'),
  withEntitlement,
  enforceImageRequestLimit,
  withConcurrencyGuard('ai'),
  async (req: Request, res: Response) => {
    try {
      const {prompt, provider, model, size, n, modelId} = req.body || {}
      if (modelId && !(await isModelActive(String(modelId)))) {
        return sendError(res, {
          status: 403,
          code: 'MODEL_DISABLED',
          message: '该模型已被管理员禁用',
          retryable: false,
        })
      }

      const task = await createImageTask({
        userId: req.user!.id,
        prompt,
        provider,
        model,
        size,
        n,
        modelId,
      })

      // Trigger a near-real-time worker tick so users see progress quickly.
      runMediaTaskWorkerTick().catch(() => {
        // no-op
      })

      res.status(202).json({
        success: true,
        task,
      })
    } catch (error: any) {
      const message = String(error?.message || '')
      if (message.includes('Token余额不足')) {
        return sendError(res, {
          status: 402,
          code: 'INSUFFICIENT_BALANCE',
          message,
          retryable: false,
        })
      }
      if (message.includes('Prompt is required')) {
        return sendError(res, {
          status: 400,
          code: 'INVALID_PROMPT',
          message: '提示词不能为空',
          retryable: false,
        })
      }
      if (message.includes('User not found')) {
        return sendError(res, {
          status: 404,
          code: 'USER_NOT_FOUND',
          message: '用户不存在',
          retryable: false,
        })
      }

      captureError(error, {scope: 'media.image.create_task'})
      sendError(res, {
        status: 500,
        code: 'IMAGE_TASK_CREATE_FAILED',
        message: '创建图片任务失败，请稍后重试',
        retryable: true,
      })
    }
  },
)

router.get('/tasks/:taskId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const taskId = String(req.params.taskId || '').trim()
    if (!taskId) {
      return sendError(res, {
        status: 400,
        code: 'TASK_ID_REQUIRED',
        message: '缺少任务ID',
        retryable: false,
      })
    }

    const task = await getTaskByIdForUser(taskId, req.user!.id)
    if (!task) {
      return sendError(res, {
        status: 404,
        code: 'TASK_NOT_FOUND',
        message: '任务不存在',
        retryable: false,
      })
    }

    res.json({
      success: true,
      task,
    })
  } catch (error) {
    captureError(error, {scope: 'media.task.status', taskId: req.params.taskId})
    sendError(res, {
      status: 500,
      code: 'TASK_STATUS_FETCH_FAILED',
      message: '获取任务状态失败',
      retryable: true,
    })
  }
})

router.post('/video/generate', authenticateToken, withRateLimit('image'), withEntitlement, async (req: Request, res: Response) => {
  try {
    const {prompt, provider, model, size, n, modelId} = req.body || {}
    if (modelId && !(await isModelActive(String(modelId)))) {
      return sendError(res, {
        status: 403,
        code: 'MODEL_DISABLED',
        message: '该模型已被管理员禁用',
        retryable: false,
      })
    }

    const task = await createVideoTask({
      userId: req.user!.id,
      prompt,
      provider,
      model,
      size,
      n,
      modelId,
    })

    runMediaTaskWorkerTick().catch(() => {
      // no-op
    })

    res.status(202).json({
      success: true,
      task,
    })
  } catch (error: any) {
    const message = String(error?.message || '')
    if (message.includes('Prompt is required')) {
      return sendError(res, {
        status: 400,
        code: 'INVALID_PROMPT',
        message: '提示词不能为空',
        retryable: false,
      })
    }

    captureError(error, {scope: 'media.video.create_task'})
    sendError(res, {
      status: 500,
      code: 'VIDEO_TASK_CREATE_FAILED',
      message: '创建视频任务失败',
      retryable: true,
    })
  }
})

export default router

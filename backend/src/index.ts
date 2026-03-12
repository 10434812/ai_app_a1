import 'reflect-metadata'
import 'dotenv/config'
import {createApp} from './app.ts'
import {connectDB} from './config/db.ts'
import {connectRedis} from './config/redis.ts'
import {startMonthlyQuotaScheduler} from './services/membershipQuotaService.ts'
import {captureError, initObservability} from './services/observabilityService.ts'
import {startMediaTaskWorker} from './services/media/mediaTaskService.ts'

const startServer = async () => {
  await initObservability()
  await connectDB()
  await connectRedis()

  const app = createApp()
  const port = Number(process.env.PORT ?? 4000)

  // Verify tables
  try {
    const {User} = await import('./models/User.ts')
    const {Conversation} = await import('./models/Conversation.ts')
    const {Message} = await import('./models/Message.ts')

    console.log('--- DB Check ---')
    console.log('Users:', await User.count())
    console.log('Conversations:', await Conversation.count())
    console.log('Messages:', await Message.count())
    console.log('----------------')
  } catch (err) {
    console.error('DB Check Failed:', err)
  }

  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`)
  })

  startMonthlyQuotaScheduler()
  startMediaTaskWorker()
}

process.on('unhandledRejection', (reason) => {
  captureError(reason, {scope: 'process.unhandledRejection'})
})

process.on('uncaughtException', (error) => {
  captureError(error, {scope: 'process.uncaughtException'})
})

startServer()

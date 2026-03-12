import {Sequelize} from 'sequelize-typescript'
import {User} from '../models/User.ts'
import {Conversation} from '../models/Conversation.ts'
import {Message} from '../models/Message.ts'
import {Order} from '../models/Order.ts'
import {OrderAuditLog} from '../models/OrderAuditLog.ts'
import {SystemConfig} from '../models/SystemConfig.ts'
import {TokenUsageRecord} from '../models/TokenUsageRecord.ts'
import {VisitLog} from '../models/VisitLog.ts'
import {MediaTask} from '../models/MediaTask.ts'
import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'
import mysql from 'mysql2/promise'
import {runMigrations} from '../migrations/runner.ts'

dotenv.config()

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ai_app',
}

export const sequelize = new Sequelize({
  dialect: 'mysql',
  host: dbConfig.host,
  port: dbConfig.port,
  username: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  models: [User, Conversation, Message, Order, OrderAuditLog, SystemConfig, TokenUsageRecord, VisitLog, MediaTask],
  logging: false,
})

const seedAdmin = async () => {
  const adminEmail = process.env.ADMIN_EMAIL
  const adminPassword = process.env.ADMIN_PASSWORD
  const seedEnabled = process.env.ENABLE_ADMIN_SEED === 'true'

  if (!seedEnabled) return
  if (!adminEmail || !adminPassword) {
    console.warn('Admin seed skipped: ADMIN_EMAIL or ADMIN_PASSWORD is missing.')
    return
  }
  if (adminPassword.length < 12) {
    console.warn('Admin seed skipped: ADMIN_PASSWORD must be at least 12 characters.')
    return
  }

  try {
    const adminExists = await User.findOne({where: {email: adminEmail}})
    if (!adminExists) {
      const passwordHash = await bcrypt.hash(adminPassword, 10)
      await User.create({
        email: adminEmail,
        passwordHash,
        name: 'Admin User',
        role: 'super_admin',
        isActive: true,
      })
      console.log('Admin user seeded.')
    }
  } catch (error) {
    console.error('Error seeding admin:', error)
  }
}

const ensureDatabaseExists = async () => {
  try {
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      connectTimeout: 2000,
    })
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\`;`)
    await connection.end()
    console.log(`Database ${dbConfig.database} checked/created.`)
  } catch (error) {
    console.error('Error ensuring database exists:', error)
    throw error
  }
}

export const connectDB = async (options?: {skipMigrations?: boolean}) => {
  try {
    await ensureDatabaseExists()
    await sequelize.authenticate()
    console.log('Database connected successfully.')
    const isProduction = process.env.NODE_ENV === 'production'
    const enableAutoAlter = process.env.DB_AUTO_ALTER === 'true'
    if (isProduction || !enableAutoAlter) {
      // Keep sync non-destructive by default to avoid runaway index creation in shared DBs.
      await sequelize.sync()
    } else {
      await sequelize.sync({alter: true})
    }
    if (!options?.skipMigrations) {
      await runMigrations(sequelize)
    }
    console.log('Database synced.')
    await seedAdmin()
  } catch (error) {
    console.error('Unable to connect to the database:', error)
    // Don't exit process, just log error so dev can fix it
  }
}

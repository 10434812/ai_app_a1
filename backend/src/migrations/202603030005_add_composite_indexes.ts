import type {Sequelize} from 'sequelize-typescript'
import type {Migration} from './types.ts'

const hasIndex = async (sequelize: Sequelize, tableName: string, indexName: string) => {
  const [rows] = await sequelize.query(
    `SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1;`,
    {
      replacements: [tableName, indexName],
    },
  )
  return Array.isArray(rows) && rows.length > 0
}

const createIndexIfMissing = async (sequelize: Sequelize, table: string, index: string, columnsSql: string) => {
  if (await hasIndex(sequelize, table, index)) return
  await sequelize.query(`CREATE INDEX \`${index}\` ON \`${table}\` (${columnsSql});`)
}

const dropIndexIfExists = async (sequelize: Sequelize, table: string, index: string) => {
  if (!(await hasIndex(sequelize, table, index))) return
  await sequelize.query(`DROP INDEX \`${index}\` ON \`${table}\`;`)
}

const migration: Migration = {
  id: '202603030005_add_composite_indexes',
  description: 'Add high-frequency composite indexes for orders/token/conversations/messages/visit_logs',
  up: async (sequelize: Sequelize) => {
    await createIndexIfMissing(sequelize, 'orders', 'idx_orders_status_created_user', '`status`, `createdAt`, `userId`')
    await createIndexIfMissing(sequelize, 'orders', 'idx_orders_user_status_created', '`userId`, `status`, `createdAt`')
    await createIndexIfMissing(sequelize, 'orders', 'idx_orders_plan_status_created', '`planKey`, `status`, `createdAt`')

    await createIndexIfMissing(
      sequelize,
      'token_usage_records',
      'idx_token_usage_user_type_created',
      '`userId`, `type`, `createdAt`',
    )
    await createIndexIfMissing(
      sequelize,
      'token_usage_records',
      'idx_token_usage_type_model_created',
      '`type`, `model`, `createdAt`',
    )

    await createIndexIfMissing(
      sequelize,
      'conversations',
      'idx_conversations_user_updated',
      '`userId`, `updatedAt`',
    )

    await createIndexIfMissing(
      sequelize,
      'messages',
      'idx_messages_conversation_created_role',
      '`conversationId`, `createdAt`, `role`',
    )
    await createIndexIfMissing(
      sequelize,
      'messages',
      'idx_messages_role_created_model',
      '`role`, `createdAt`, `model`',
    )

    await createIndexIfMissing(
      sequelize,
      'visit_logs',
      'idx_visit_logs_visitor_path_created',
      '`visitorId`, `path`, `createdAt`',
    )
  },
  down: async (sequelize: Sequelize) => {
    await dropIndexIfExists(sequelize, 'orders', 'idx_orders_status_created_user')
    await dropIndexIfExists(sequelize, 'orders', 'idx_orders_user_status_created')
    await dropIndexIfExists(sequelize, 'orders', 'idx_orders_plan_status_created')
    await dropIndexIfExists(sequelize, 'token_usage_records', 'idx_token_usage_user_type_created')
    await dropIndexIfExists(sequelize, 'token_usage_records', 'idx_token_usage_type_model_created')
    await dropIndexIfExists(sequelize, 'conversations', 'idx_conversations_user_updated')
    await dropIndexIfExists(sequelize, 'messages', 'idx_messages_conversation_created_role')
    await dropIndexIfExists(sequelize, 'messages', 'idx_messages_role_created_model')
    await dropIndexIfExists(sequelize, 'visit_logs', 'idx_visit_logs_visitor_path_created')
  },
}

export default migration


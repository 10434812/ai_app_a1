import type {Sequelize} from 'sequelize-typescript'
import type {Migration} from './types.js'

const ORDER_TABLE = 'orders'
const AUDIT_TABLE = 'order_audit_logs'

const hasIndex = async (sequelize: Sequelize, tableName: string, indexName: string) => {
  const [rows] = await sequelize.query(
    `SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1;`,
    {
      replacements: [tableName, indexName],
    },
  )
  return Array.isArray(rows) && rows.length > 0
}

const migration: Migration = {
  id: '202603030003_add_order_refund_and_audit',
  description: 'Add refunded status/fields to orders and create order_audit_logs table',
  up: async (sequelize: Sequelize) => {
    const qi = sequelize.getQueryInterface()
    const orderColumns = await qi.describeTable(ORDER_TABLE)

    if (!orderColumns.refundedAmount) {
      await sequelize.query(
        `ALTER TABLE \`${ORDER_TABLE}\` ADD COLUMN \`refundedAmount\` DECIMAL(10, 2) NULL AFTER \`status\`;`,
      )
    }
    if (!orderColumns.refundedAt) {
      await sequelize.query(
        `ALTER TABLE \`${ORDER_TABLE}\` ADD COLUMN \`refundedAt\` DATETIME NULL AFTER \`refundedAmount\`;`,
      )
    }

    await sequelize.query(
      `ALTER TABLE \`${ORDER_TABLE}\` MODIFY COLUMN \`status\` ENUM('pending','completed','failed','refunded') NOT NULL DEFAULT 'pending';`,
    )

    await sequelize.query(
      `CREATE TABLE IF NOT EXISTS \`${AUDIT_TABLE}\` (
        \`id\` CHAR(36) NOT NULL PRIMARY KEY,
        \`orderId\` CHAR(36) NOT NULL,
        \`actorUserId\` CHAR(36) NULL,
        \`action\` VARCHAR(64) NOT NULL,
        \`beforeSnapshot\` TEXT NULL,
        \`afterSnapshot\` TEXT NULL,
        \`note\` TEXT NULL,
        \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
    )

    if (!(await hasIndex(sequelize, AUDIT_TABLE, 'idx_order_audit_logs_order_id'))) {
      await sequelize.query(
        `CREATE INDEX \`idx_order_audit_logs_order_id\` ON \`${AUDIT_TABLE}\` (\`orderId\`);`,
      )
    }
    if (!(await hasIndex(sequelize, AUDIT_TABLE, 'idx_order_audit_logs_actor_user_id'))) {
      await sequelize.query(
        `CREATE INDEX \`idx_order_audit_logs_actor_user_id\` ON \`${AUDIT_TABLE}\` (\`actorUserId\`);`,
      )
    }
    if (!(await hasIndex(sequelize, AUDIT_TABLE, 'idx_order_audit_logs_created_at'))) {
      await sequelize.query(
        `CREATE INDEX \`idx_order_audit_logs_created_at\` ON \`${AUDIT_TABLE}\` (\`createdAt\`);`,
      )
    }
  },
  down: async (sequelize: Sequelize) => {
    const qi = sequelize.getQueryInterface()
    const orderColumns = await qi.describeTable(ORDER_TABLE)

    await sequelize.query(`DROP TABLE IF EXISTS \`${AUDIT_TABLE}\`;`)

    if (orderColumns.refundedAt) {
      await sequelize.query(`ALTER TABLE \`${ORDER_TABLE}\` DROP COLUMN \`refundedAt\`;`)
    }
    if (orderColumns.refundedAmount) {
      await sequelize.query(`ALTER TABLE \`${ORDER_TABLE}\` DROP COLUMN \`refundedAmount\`;`)
    }

    await sequelize.query(
      `ALTER TABLE \`${ORDER_TABLE}\` MODIFY COLUMN \`status\` ENUM('pending','completed','failed') NOT NULL DEFAULT 'pending';`,
    )
  },
}

export default migration

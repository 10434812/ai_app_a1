import type {Sequelize} from 'sequelize-typescript'
import type {Transaction} from 'sequelize'
import type {Migration} from './types.ts'

const USER_TABLE = 'users'
const MEDIA_TASK_TABLE = 'media_tasks'

const hasIndex = async (sequelize: Sequelize, tableName: string, indexName: string, transaction?: Transaction) => {
  const [rows] = await sequelize.query(
    `SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1;`,
    {
      replacements: [tableName, indexName],
      transaction,
    },
  )
  return Array.isArray(rows) && rows.length > 0
}

const migration: Migration = {
  id: '202603030004_add_rbac_and_media_tasks',
  description: 'Expand user roles for RBAC and create media_tasks table',
  up: async (sequelize: Sequelize, transaction) => {
    await sequelize.query(
      `ALTER TABLE \`${USER_TABLE}\` MODIFY COLUMN \`role\` ENUM('user','admin','super_admin','ops','finance','support') NOT NULL DEFAULT 'user';`,
      {transaction},
    )

    await sequelize.query(
      `CREATE TABLE IF NOT EXISTS \`${MEDIA_TASK_TABLE}\` (
        \`id\` CHAR(36) NOT NULL PRIMARY KEY,
        \`userId\` CHAR(36) NOT NULL,
        \`type\` ENUM('image','video') NOT NULL,
        \`status\` ENUM('pending','processing','retrying','succeeded','failed') NOT NULL DEFAULT 'pending',
        \`provider\` VARCHAR(32) NULL,
        \`model\` VARCHAR(128) NULL,
        \`prompt\` TEXT NOT NULL,
        \`size\` VARCHAR(32) NULL,
        \`n\` INT NOT NULL DEFAULT 1,
        \`attempts\` INT NOT NULL DEFAULT 0,
        \`maxAttempts\` INT NOT NULL DEFAULT 3,
        \`estimatedCost\` INT NOT NULL DEFAULT 0,
        \`actualCost\` INT NULL,
        \`result\` TEXT NULL,
        \`errorCode\` VARCHAR(64) NULL,
        \`errorMessage\` TEXT NULL,
        \`nextRetryAt\` DATETIME NULL,
        \`startedAt\` DATETIME NULL,
        \`completedAt\` DATETIME NULL,
        \`meta\` TEXT NULL,
        \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
      {transaction},
    )

    if (!(await hasIndex(sequelize, MEDIA_TASK_TABLE, 'idx_media_tasks_status_next_retry', transaction))) {
      await sequelize.query(
        `CREATE INDEX \`idx_media_tasks_status_next_retry\` ON \`${MEDIA_TASK_TABLE}\` (\`status\`, \`nextRetryAt\`);`,
        {transaction},
      )
    }
    if (!(await hasIndex(sequelize, MEDIA_TASK_TABLE, 'idx_media_tasks_user_created_at', transaction))) {
      await sequelize.query(
        `CREATE INDEX \`idx_media_tasks_user_created_at\` ON \`${MEDIA_TASK_TABLE}\` (\`userId\`, \`createdAt\`);`,
        {transaction},
      )
    }
    if (!(await hasIndex(sequelize, MEDIA_TASK_TABLE, 'idx_media_tasks_type_status_created', transaction))) {
      await sequelize.query(
        `CREATE INDEX \`idx_media_tasks_type_status_created\` ON \`${MEDIA_TASK_TABLE}\` (\`type\`, \`status\`, \`createdAt\`);`,
        {transaction},
      )
    }
  },
  down: async (sequelize: Sequelize, transaction) => {
    await sequelize.query(`DROP TABLE IF EXISTS \`${MEDIA_TASK_TABLE}\`;`, {transaction})
    await sequelize.query(
      `ALTER TABLE \`${USER_TABLE}\` MODIFY COLUMN \`role\` ENUM('user','admin') NOT NULL DEFAULT 'user';`,
      {transaction},
    )
  },
}

export default migration

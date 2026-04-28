import type {Sequelize} from 'sequelize-typescript'
import {MIGRATIONS} from './registry.ts'

type MigrationRow = {id: string}

const TABLE_NAME = 'schema_migrations'

const ensureMigrationsTable = async (sequelize: Sequelize) => {
  await sequelize.query(
    `CREATE TABLE IF NOT EXISTS \`${TABLE_NAME}\` (
      \`id\` VARCHAR(128) NOT NULL PRIMARY KEY,
      \`description\` VARCHAR(255) NULL,
      \`executedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
  )
}

const getAppliedMigrationIds = async (sequelize: Sequelize): Promise<Set<string>> => {
  const [rows] = await sequelize.query(`SELECT id FROM \`${TABLE_NAME}\`;`)
  const ids = Array.isArray(rows) ? (rows as MigrationRow[]).map((row) => String(row.id)) : []
  return new Set(ids)
}

export const runMigrations = async (sequelize: Sequelize) => {
  await ensureMigrationsTable(sequelize)
  const applied = await getAppliedMigrationIds(sequelize)

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue
    console.log(`[Migration] applying ${migration.id} - ${migration.description}`)
    await sequelize.transaction(async (transaction) => {
      await migration.up(sequelize, transaction)
      await sequelize.query(
        `INSERT INTO \`${TABLE_NAME}\` (id, description) VALUES (?, ?);`,
        {replacements: [migration.id, migration.description], transaction},
      )
    })
  }
}

export const rollbackLastMigration = async (sequelize: Sequelize) => {
  await ensureMigrationsTable(sequelize)
  const [rows] = await sequelize.query(
    `SELECT id FROM \`${TABLE_NAME}\` ORDER BY executedAt DESC, id DESC LIMIT 1;`,
  )
  const last = Array.isArray(rows) && rows.length > 0 ? String((rows[0] as MigrationRow).id) : ''
  if (!last) {
    console.log('[Migration] no migration to rollback')
    return
  }

  const migration = MIGRATIONS.find((item) => item.id === last)
  if (!migration) {
    throw new Error(`Migration not found in registry: ${last}`)
  }

  console.log(`[Migration] rollback ${migration.id} - ${migration.description}`)
  await sequelize.transaction(async (transaction) => {
    await migration.down(sequelize, transaction)
    await sequelize.query(`DELETE FROM \`${TABLE_NAME}\` WHERE id = ?;`, {
      replacements: [migration.id],
      transaction,
    })
  })
}

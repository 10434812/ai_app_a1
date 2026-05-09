import type {Sequelize} from 'sequelize-typescript'
import type {Migration} from './types.js'

const migration: Migration = {
  id: '202603030001_add_order_plan_fields',
  description: 'Add planKey and planSnapshot columns to orders table',
  up: async (sequelize: Sequelize) => {
    const qi = sequelize.getQueryInterface()
    const columns = await qi.describeTable('orders')

    if (!columns.planKey) {
      await sequelize.query('ALTER TABLE `orders` ADD COLUMN `planKey` VARCHAR(128) NULL AFTER `plan`;')
    }
    if (!columns.planSnapshot) {
      await sequelize.query('ALTER TABLE `orders` ADD COLUMN `planSnapshot` TEXT NULL AFTER `planKey`;')
    }
  },
  down: async (sequelize: Sequelize) => {
    const qi = sequelize.getQueryInterface()
    const columns = await qi.describeTable('orders')

    if (columns.planSnapshot) {
      await sequelize.query('ALTER TABLE `orders` DROP COLUMN `planSnapshot`;')
    }
    if (columns.planKey) {
      await sequelize.query('ALTER TABLE `orders` DROP COLUMN `planKey`;')
    }
  },
}

export default migration

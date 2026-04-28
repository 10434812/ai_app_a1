const migration = {
    id: '202603030001_add_order_plan_fields',
    description: 'Add planKey and planSnapshot columns to orders table',
    up: async (sequelize, transaction) => {
        const qi = sequelize.getQueryInterface();
        const columns = await qi.describeTable('orders');
        if (!columns.planKey) {
            await sequelize.query('ALTER TABLE `orders` ADD COLUMN `planKey` VARCHAR(128) NULL AFTER `plan`;', { transaction });
        }
        if (!columns.planSnapshot) {
            await sequelize.query('ALTER TABLE `orders` ADD COLUMN `planSnapshot` TEXT NULL AFTER `planKey`;', { transaction });
        }
    },
    down: async (sequelize, transaction) => {
        const qi = sequelize.getQueryInterface();
        const columns = await qi.describeTable('orders');
        if (columns.planSnapshot) {
            await sequelize.query('ALTER TABLE `orders` DROP COLUMN `planSnapshot`;', { transaction });
        }
        if (columns.planKey) {
            await sequelize.query('ALTER TABLE `orders` DROP COLUMN `planKey`;', { transaction });
        }
    },
};
export default migration;

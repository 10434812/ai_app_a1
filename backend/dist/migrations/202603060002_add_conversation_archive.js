const TABLE_NAME = 'conversations';
const hasColumn = async (sequelize, tableName, columnName, transaction) => {
    const [rows] = await sequelize.query(`SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1;`, {
        replacements: [tableName, columnName],
        transaction,
    });
    return Array.isArray(rows) && rows.length > 0;
};
const migration = {
    id: '202603060002_add_conversation_archive',
    description: 'Add archive flag to conversations',
    up: async (sequelize, transaction) => {
        if (!(await hasColumn(sequelize, TABLE_NAME, 'isArchived', transaction))) {
            await sequelize.query(`ALTER TABLE \`${TABLE_NAME}\` ADD COLUMN \`isArchived\` TINYINT(1) NOT NULL DEFAULT 0 AFTER \`isFavorite\`;`, { transaction });
        }
    },
    down: async (sequelize, transaction) => {
        if (await hasColumn(sequelize, TABLE_NAME, 'isArchived', transaction)) {
            await sequelize.query(`ALTER TABLE \`${TABLE_NAME}\` DROP COLUMN \`isArchived\`;`, { transaction });
        }
    },
};
export default migration;

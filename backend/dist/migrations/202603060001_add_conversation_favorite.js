const TABLE_NAME = 'conversations';
const hasColumn = async (sequelize, tableName, columnName) => {
    const [rows] = await sequelize.query(`SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1;`, {
        replacements: [tableName, columnName],
    });
    return Array.isArray(rows) && rows.length > 0;
};
const migration = {
    id: '202603060001_add_conversation_favorite',
    description: 'Add favorite flag to conversations',
    up: async (sequelize) => {
        if (!(await hasColumn(sequelize, TABLE_NAME, 'isFavorite'))) {
            await sequelize.query(`ALTER TABLE \`${TABLE_NAME}\` ADD COLUMN \`isFavorite\` TINYINT(1) NOT NULL DEFAULT 0 AFTER \`title\`;`);
        }
    },
    down: async (sequelize) => {
        if (await hasColumn(sequelize, TABLE_NAME, 'isFavorite')) {
            await sequelize.query(`ALTER TABLE \`${TABLE_NAME}\` DROP COLUMN \`isFavorite\`;`);
        }
    },
};
export default migration;

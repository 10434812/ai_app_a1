const TABLE = 'visit_logs';
const hasIndex = async (sequelize, indexName, transaction) => {
    const [rows] = await sequelize.query(`SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1;`, {
        replacements: [TABLE, indexName],
        transaction,
    });
    return Array.isArray(rows) && rows.length > 0;
};
const ensureIndex = async (sequelize, indexName, sql, transaction) => {
    const exists = await hasIndex(sequelize, indexName, transaction);
    if (!exists) {
        await sequelize.query(sql, { transaction });
    }
};
const migration = {
    id: '202603030002_add_visit_logs_table',
    description: 'Add visit_logs table for tracking member and guest traffic',
    up: async (sequelize, transaction) => {
        await sequelize.query(`CREATE TABLE IF NOT EXISTS \`${TABLE}\` (
        \`id\` CHAR(36) NOT NULL PRIMARY KEY,
        \`userId\` CHAR(36) NULL,
        \`visitorId\` VARCHAR(128) NOT NULL,
        \`isGuest\` TINYINT(1) NOT NULL DEFAULT 1,
        \`path\` VARCHAR(255) NOT NULL,
        \`source\` VARCHAR(64) NOT NULL DEFAULT 'web',
        \`ip\` VARCHAR(64) NULL,
        \`userAgent\` VARCHAR(512) NULL,
        \`referer\` VARCHAR(512) NULL,
        \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`, { transaction });
        await ensureIndex(sequelize, 'idx_visit_logs_created_at', `CREATE INDEX \`idx_visit_logs_created_at\` ON \`${TABLE}\` (\`createdAt\`);`, transaction);
        await ensureIndex(sequelize, 'idx_visit_logs_user_id_created_at', `CREATE INDEX \`idx_visit_logs_user_id_created_at\` ON \`${TABLE}\` (\`userId\`, \`createdAt\`);`, transaction);
        await ensureIndex(sequelize, 'idx_visit_logs_visitor_id_created_at', `CREATE INDEX \`idx_visit_logs_visitor_id_created_at\` ON \`${TABLE}\` (\`visitorId\`, \`createdAt\`);`, transaction);
        await ensureIndex(sequelize, 'idx_visit_logs_is_guest_created_at', `CREATE INDEX \`idx_visit_logs_is_guest_created_at\` ON \`${TABLE}\` (\`isGuest\`, \`createdAt\`);`, transaction);
    },
    down: async (sequelize, transaction) => {
        await sequelize.query(`DROP TABLE IF EXISTS \`${TABLE}\`;`, { transaction });
    },
};
export default migration;

const hasIndex = async (sequelize, tableName, indexName, transaction) => {
    const [rows] = await sequelize.query(`SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1;`, {
        replacements: [tableName, indexName],
        transaction,
    });
    return Array.isArray(rows) && rows.length > 0;
};
const createIndexIfMissing = async (sequelize, table, index, columnsSql, transaction) => {
    if (await hasIndex(sequelize, table, index, transaction))
        return;
    await sequelize.query(`CREATE INDEX \`${index}\` ON \`${table}\` (${columnsSql});`, { transaction });
};
const dropIndexIfExists = async (sequelize, table, index, transaction) => {
    if (!(await hasIndex(sequelize, table, index, transaction)))
        return;
    await sequelize.query(`DROP INDEX \`${index}\` ON \`${table}\`;`, { transaction });
};
const migration = {
    id: '202603030005_add_composite_indexes',
    description: 'Add high-frequency composite indexes for orders/token/conversations/messages/visit_logs',
    up: async (sequelize, transaction) => {
        await createIndexIfMissing(sequelize, 'orders', 'idx_orders_status_created_user', '`status`, `createdAt`, `userId`', transaction);
        await createIndexIfMissing(sequelize, 'orders', 'idx_orders_user_status_created', '`userId`, `status`, `createdAt`', transaction);
        await createIndexIfMissing(sequelize, 'orders', 'idx_orders_plan_status_created', '`planKey`, `status`, `createdAt`', transaction);
        await createIndexIfMissing(sequelize, 'token_usage_records', 'idx_token_usage_user_type_created', '`userId`, `type`, `createdAt`', transaction);
        await createIndexIfMissing(sequelize, 'token_usage_records', 'idx_token_usage_type_model_created', '`type`, `model`, `createdAt`', transaction);
        await createIndexIfMissing(sequelize, 'conversations', 'idx_conversations_user_updated', '`userId`, `updatedAt`', transaction);
        await createIndexIfMissing(sequelize, 'messages', 'idx_messages_conversation_created_role', '`conversationId`, `createdAt`, `role`', transaction);
        await createIndexIfMissing(sequelize, 'messages', 'idx_messages_role_created_model', '`role`, `createdAt`, `model`', transaction);
        await createIndexIfMissing(sequelize, 'visit_logs', 'idx_visit_logs_visitor_path_created', '`visitorId`, `path`, `createdAt`', transaction);
    },
    down: async (sequelize, transaction) => {
        await dropIndexIfExists(sequelize, 'orders', 'idx_orders_status_created_user', transaction);
        await dropIndexIfExists(sequelize, 'orders', 'idx_orders_user_status_created', transaction);
        await dropIndexIfExists(sequelize, 'orders', 'idx_orders_plan_status_created', transaction);
        await dropIndexIfExists(sequelize, 'token_usage_records', 'idx_token_usage_user_type_created', transaction);
        await dropIndexIfExists(sequelize, 'token_usage_records', 'idx_token_usage_type_model_created', transaction);
        await dropIndexIfExists(sequelize, 'conversations', 'idx_conversations_user_updated', transaction);
        await dropIndexIfExists(sequelize, 'messages', 'idx_messages_conversation_created_role', transaction);
        await dropIndexIfExists(sequelize, 'messages', 'idx_messages_role_created_model', transaction);
        await dropIndexIfExists(sequelize, 'visit_logs', 'idx_visit_logs_visitor_path_created', transaction);
    },
};
export default migration;

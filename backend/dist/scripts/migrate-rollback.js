import 'dotenv/config';
import { connectDB, sequelize } from '../config/db.js';
import { rollbackLastMigration } from '../migrations/runner.js';
const main = async () => {
    await connectDB({ skipMigrations: true });
    await rollbackLastMigration(sequelize);
    await sequelize.close();
};
main().catch((error) => {
    console.error('Rollback migration script failed:', error);
    process.exit(1);
});

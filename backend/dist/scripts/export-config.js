import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { connectDB, sequelize } from "../config/db.js";
import { getExportableSystemConfigs } from "../services/configSyncService.js";
const parseArgs = (argv) => {
    const options = {
        output: './config-export.json',
        scope: 'deployment',
    };
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if ((arg === '--output' || arg === '-o') && argv[index + 1]) {
            options.output = argv[index + 1];
            index += 1;
            continue;
        }
        if (arg === '--scope' && argv[index + 1]) {
            const scope = argv[index + 1];
            if (scope === 'deployment' || scope === 'all') {
                options.scope = scope;
            }
            else {
                throw new Error(`Unsupported scope: ${scope}`);
            }
            index += 1;
            continue;
        }
    }
    return options;
};
const main = async () => {
    const options = parseArgs(process.argv.slice(2));
    await connectDB();
    const rows = await getExportableSystemConfigs(options.scope);
    const outputPath = path.resolve(process.cwd(), options.output);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify({
        version: 1,
        exportedAt: new Date().toISOString(),
        scope: options.scope,
        rowCount: rows.length,
        rows,
    }, null, 2), 'utf-8');
    console.log(`Exported ${rows.length} config rows to ${outputPath}`);
};
main()
    .catch((error) => {
    console.error('Export config failed:', error);
    process.exitCode = 1;
})
    .finally(async () => {
    await sequelize.close();
});

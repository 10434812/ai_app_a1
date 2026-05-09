import { SystemConfig } from '../models/SystemConfig.js';
const VOLATILE_KEY_EXACT = new Set([
    'membership_monthly_quota_last_cycle',
]);
const VOLATILE_KEY_PATTERNS = [
    /_last_cycle$/i,
];
const isVolatileKey = (key) => {
    if (VOLATILE_KEY_EXACT.has(key))
        return true;
    return VOLATILE_KEY_PATTERNS.some((pattern) => pattern.test(key));
};
export const getExportableSystemConfigs = async (scope = 'deployment') => {
    const rows = await SystemConfig.findAll({ order: [['key', 'ASC']] });
    return rows
        .filter((row) => (scope === 'all' ? true : !isVolatileKey(row.key)))
        .map((row) => ({
        key: row.key,
        value: row.value ?? null,
        description: row.description ?? null,
    }));
};
export const upsertSystemConfigs = async (rows) => {
    for (const row of rows) {
        const [config] = await SystemConfig.findOrCreate({
            where: { key: row.key },
            defaults: {
                value: row.value ?? '',
                description: row.description ?? undefined,
            },
        });
        config.value = row.value ?? '';
        if (row.description !== null && row.description !== undefined) {
            config.description = row.description;
        }
        await config.save();
    }
};

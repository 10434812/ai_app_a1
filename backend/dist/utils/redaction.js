const SECRET_PATTERNS = [
    /(sk-[a-zA-Z0-9_\-]{8,})/g,
    /(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi,
    /(token=)[^&\s]+/gi,
    /(password=)[^&\s]+/gi,
];
const redactString = (input) => {
    let output = input;
    for (const pattern of SECRET_PATTERNS) {
        output = output.replace(pattern, (_match, prefix) => {
            if (typeof prefix === 'string' && /Bearer\s+/i.test(prefix)) {
                return `${prefix}***`;
            }
            if (typeof prefix === 'string' && /(token=|password=)/i.test(prefix)) {
                return `${prefix}***`;
            }
            return '***';
        });
    }
    return output;
};
export const redactSensitive = (value) => {
    if (typeof value === 'string')
        return redactString(value);
    if (Array.isArray(value))
        return value.map((item) => redactSensitive(item));
    if (value && typeof value === 'object') {
        const obj = value;
        const result = {};
        for (const [key, val] of Object.entries(obj)) {
            const lower = key.toLowerCase();
            if (lower.includes('key') || lower.includes('secret') || lower.includes('token') || lower.includes('password')) {
                result[key] = typeof val === 'string' && val ? '***' : val;
            }
            else {
                result[key] = redactSensitive(val);
            }
        }
        return result;
    }
    return value;
};

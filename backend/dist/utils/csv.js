const DANGEROUS_CSV_PREFIX_RE = /^[=+\-@]/;
const normalizeCell = (value) => {
    if (value == null)
        return '';
    return String(value).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
};
export const sanitizeCsvCell = (value) => {
    const normalized = normalizeCell(value);
    const protectedValue = DANGEROUS_CSV_PREFIX_RE.test(normalized) ? `'${normalized}` : normalized;
    return `"${protectedValue.replace(/"/g, '""')}"`;
};
export const buildCsv = (rows) => rows.map((row) => row.map(sanitizeCsvCell).join(',')).join('\n');

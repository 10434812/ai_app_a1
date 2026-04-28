const SHANGHAI_TIMEZONE = 'Asia/Shanghai';
const formatNumber = (value, digits = 2) => new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
}).format(value);
const formatTimestamp = (value) => new Intl.DateTimeFormat('zh-CN', {
    timeZone: SHANGHAI_TIMEZONE,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
}).format(new Date(value));
const buildCommonFooter = (sourceLabel, timestampLabel) => [
    '',
    `数据来源：${sourceLabel}`,
    `更新时间：${timestampLabel}`,
    '以上为实时抓取结果，仅供参考，不构成投资建议。',
].join('\n');
export const formatRealtimeAnswer = (quote) => {
    const sourceLabel = quote.source;
    const timestampLabel = `北京时间 ${formatTimestamp(quote.timestamp)}`;
    let title = quote.displayName;
    let body = '';
    switch (quote.kind) {
        case 'gold':
            if (quote.target === 'CN_SHOP_GOLD') {
                title = '今日金店金价';
                const shopPrices = Array.isArray(quote.extra.shopPrices)
                    ? quote.extra.shopPrices.slice(0, 5)
                    : [];
                body = [
                    `当前品牌金店均价约为 ${formatNumber(quote.value, 2)} CNY/g。`,
                    ...shopPrices
                        .filter((item) => item?.brand && typeof item.goldPrice === 'number')
                        .map((item) => `${String(item.brand)}：${formatNumber(Number(item.goldPrice), 2)} CNY/g`),
                ]
                    .filter(Boolean)
                    .join('\n');
            }
            else if (quote.target === 'CN_BANK_GOLD') {
                title = '今日银行金价';
                const bankPrices = Array.isArray(quote.extra.bankPrices)
                    ? quote.extra.bankPrices.slice(0, 5)
                    : [];
                body = [
                    `当前主要银行金条均价约为 ${formatNumber(quote.value, 2)} CNY/g。`,
                    ...bankPrices
                        .filter((item) => item?.bank && typeof item.price === 'number')
                        .map((item) => `${String(item.bank)}：${formatNumber(Number(item.price), 2)} CNY/g`),
                ]
                    .filter(Boolean)
                    .join('\n');
            }
            else {
                title = '今日金价';
                body = [
                    `当前国际金价约为 ${formatNumber(quote.value, 2)} USD/oz。`,
                    typeof quote.extra.cnyPerGram === 'number'
                        ? `按当前汇率折算，约为 ${formatNumber(Number(quote.extra.cnyPerGram), 2)} 元/克。`
                        : '',
                ]
                    .filter(Boolean)
                    .join('\n');
            }
            break;
        case 'oil':
            if (quote.target.startsWith('CN_OIL_')) {
                const area = typeof quote.extra.area === 'string' ? quote.extra.area : '全国';
                title = `今日国内油价（${area}）`;
                body = [
                    `当前参考主报价约为 ${formatNumber(quote.value, 2)} CNY/L。`,
                    typeof quote.extra.fuel92 === 'number' ? `92#：${formatNumber(Number(quote.extra.fuel92), 2)} CNY/L` : '',
                    typeof quote.extra.fuel95 === 'number' ? `95#：${formatNumber(Number(quote.extra.fuel95), 2)} CNY/L` : '',
                    typeof quote.extra.fuel98 === 'number' ? `98#：${formatNumber(Number(quote.extra.fuel98), 2)} CNY/L` : '',
                    typeof quote.extra.fuel0 === 'number' ? `0#柴油：${formatNumber(Number(quote.extra.fuel0), 2)} CNY/L` : '',
                ]
                    .filter(Boolean)
                    .join('\n');
            }
            else {
                title = quote.target === 'BRENT' ? '今日布伦特原油' : '今日国际油价';
                body = [
                    `当前主报价约为 ${formatNumber(quote.value, 2)} USD/barrel。`,
                    typeof quote.extra.wti?.value === 'number'
                        ? `WTI：${formatNumber(Number(quote.extra.wti.value), 2)} USD/barrel`
                        : '',
                    typeof quote.extra.brent?.value === 'number'
                        ? `Brent：${formatNumber(Number(quote.extra.brent.value), 2)} USD/barrel`
                        : '',
                ]
                    .filter(Boolean)
                    .join('\n');
            }
            break;
        case 'stock':
            title = `${quote.displayName} 实时行情`;
            body = [
                `当前价格约为 ${formatNumber(quote.value, 2)} ${quote.currency}。`,
                typeof quote.extra.open === 'number' ? `开盘 ${formatNumber(Number(quote.extra.open), 2)}，` : '',
                typeof quote.extra.high === 'number' ? `最高 ${formatNumber(Number(quote.extra.high), 2)}，` : '',
                typeof quote.extra.low === 'number' ? `最低 ${formatNumber(Number(quote.extra.low), 2)}。` : '',
            ]
                .join('')
                .replace(/，。$/, '。');
            break;
        case 'fund':
            title = `${quote.displayName} 实时估值`;
            body = [
                `当前估算净值约为 ${formatNumber(quote.value, 4)} ${quote.currency}。`,
                typeof quote.extra.netValue === 'number'
                    ? `最近公布净值为 ${formatNumber(Number(quote.extra.netValue), 4)}。`
                    : '',
                typeof quote.extra.estimateChangePercent === 'number'
                    ? `估算涨跌幅 ${formatNumber(Number(quote.extra.estimateChangePercent), 2)}%。`
                    : '',
            ]
                .filter(Boolean)
                .join('\n');
            break;
        case 'forex':
            title = `${quote.target} 实时汇率`;
            body = [
                `当前汇率约为 1 ${quote.target.split('/')[0]} = ${formatNumber(quote.value, 4)} ${quote.currency}。`,
                typeof quote.extra.inverse === 'number'
                    ? `反向约为 1 ${quote.currency} = ${formatNumber(Number(quote.extra.inverse), 4)} ${quote.target.split('/')[0]}。`
                    : '',
            ]
                .filter(Boolean)
                .join('\n');
            break;
        case 'crypto':
            title = `${quote.displayName} 实时币价`;
            body = [
                `当前价格约为 ${formatNumber(quote.value, 2)} ${quote.currency}。`,
                typeof quote.extra.cny === 'number' ? `人民币参考价约为 ${formatNumber(Number(quote.extra.cny), 2)} CNY。` : '',
            ]
                .filter(Boolean)
                .join('\n');
            break;
    }
    return {
        title,
        content: [body, buildCommonFooter(sourceLabel, timestampLabel)].filter(Boolean).join('\n'),
        sourceLabel,
        timestampLabel,
    };
};

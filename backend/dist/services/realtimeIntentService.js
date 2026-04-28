const GOLD_QUERY_RE = /(金价|黄金|gold|xau|xauusd)/i;
const OIL_QUERY_RE = /(油价|原油|石油|布伦特|wti|brent|oil)/i;
const CN_OIL_SCOPE_RE = /(国内油价|成品油|92号|95号|98号|0号柴油|汽油|柴油|发改委)/i;
const SHOP_GOLD_SCOPE_RE = /(金店金价|品牌金价|首饰金价|周大福|周生生|老凤祥|周六福|六福珠宝|周大生|潮宏基|菜百)/i;
const BANK_GOLD_SCOPE_RE = /(银行金价|银行金条|工行金|建行金|中行金|农行金|银行黄金|积存金|投资金条)/i;
const FUND_QUERY_RE = /(基金|净值|估值|etf|lof|联接)/i;
const FOREX_QUERY_RE = /(汇率|外汇|fx|forex|兑|usd|cny|eur|jpy|hkd|gbp|aud|cad)/i;
const CRYPTO_QUERY_RE = /(加密|数字货币|币价|虚拟币|比特币|以太坊|crypto|bitcoin|ethereum|btc|eth|sol|bnb|doge|xrp|ada)/i;
const STOCK_QUERY_RE = /(股票|股价|美股|港股|a股|A股|证券|ticker|stock|纳斯达克|道琼斯|标普|sp500|nasdaq|dow|s&p)/i;
const REALTIME_HINT_RE = /(实时|当前|现在|今日|今天|最新|刚刚|today|current|latest|now)/i;
const CURRENCY_CODES = new Set(['USD', 'CNY', 'EUR', 'JPY', 'HKD', 'GBP', 'AUD', 'CAD', 'CHF', 'SGD', 'NZD']);
const TICKER_STOPWORDS = new Set(['TODAY', 'NOW', 'NEWS', 'PRICE', 'STOCK', 'GOLD', 'BTC', 'ETH', 'USD', 'CNY', 'EUR', 'JPY', 'HKD', 'GBP']);
const STOCK_ALIAS = [
    { re: /(苹果|apple)/i, symbol: 'AAPL.US', label: '苹果' },
    { re: /(特斯拉|tesla)/i, symbol: 'TSLA.US', label: '特斯拉' },
    { re: /(英伟达|nvidia)/i, symbol: 'NVDA.US', label: '英伟达' },
    { re: /(微软|microsoft)/i, symbol: 'MSFT.US', label: '微软' },
    { re: /(亚马逊|amazon)/i, symbol: 'AMZN.US', label: '亚马逊' },
    { re: /(谷歌|google|alphabet)/i, symbol: 'GOOGL.US', label: '谷歌' },
    { re: /(腾讯)/i, symbol: '0700.HK', label: '腾讯控股' },
    { re: /(阿里|alibaba)/i, symbol: 'BABA.US', label: '阿里巴巴' },
    { re: /(拼多多|pdd)/i, symbol: 'PDD.US', label: '拼多多' },
    { re: /(小米)/i, symbol: '1810.HK', label: '小米集团' },
];
const FUND_ALIAS = [
    { re: /(天弘沪深300ETF联接A|天弘沪深300基金|天弘沪深300)/i, code: '000961', label: '天弘沪深300ETF联接A' },
    { re: /(易方达沪深300ETF联接A|易方达沪深300)/i, code: '110020', label: '易方达沪深300ETF联接A' },
    { re: /(华夏上证50ETF联接A|华夏上证50)/i, code: '001051', label: '华夏上证50ETF联接A' },
];
const CRYPTO_ALIAS = [
    { re: /(比特币|bitcoin|btc)/i, id: 'bitcoin', label: '比特币' },
    { re: /(以太坊|ethereum|eth)/i, id: 'ethereum', label: '以太坊' },
    { re: /(solana|sol)/i, id: 'solana', label: 'Solana' },
    { re: /(bnb|币安币|binance)/i, id: 'binancecoin', label: 'BNB' },
    { re: /(doge|dogecoin|狗狗币)/i, id: 'dogecoin', label: '狗狗币' },
    { re: /(xrp|瑞波|ripple)/i, id: 'ripple', label: 'XRP' },
    { re: /(ada|cardano)/i, id: 'cardano', label: 'Cardano' },
];
const CN_OIL_AREA_ALIAS = [
    { re: /(北京)/i, area: '北京', code: 'BEIJING' },
    { re: /(上海)/i, area: '上海', code: 'SHANGHAI' },
    { re: /(广东|广州|深圳)/i, area: '广东', code: 'GUANGDONG' },
    { re: /(江苏|南京|苏州)/i, area: '江苏', code: 'JIANGSU' },
    { re: /(浙江|杭州|宁波)/i, area: '浙江', code: 'ZHEJIANG' },
    { re: /(山东|济南|青岛)/i, area: '山东', code: 'SHANDONG' },
    { re: /(四川|成都)/i, area: '四川', code: 'SICHUAN' },
    { re: /(湖北|武汉)/i, area: '湖北', code: 'HUBEI' },
    { re: /(河南|郑州)/i, area: '河南', code: 'HENAN' },
    { re: /(福建|福州|厦门)/i, area: '福建', code: 'FUJIAN' },
];
const normalizeQuery = (query) => String(query || '').trim();
const detectDomesticOilArea = (query) => {
    const hit = CN_OIL_AREA_ALIAS.find((item) => item.re.test(query));
    return hit || { area: '北京', code: 'BEIJING' };
};
const detectStockTarget = (query) => {
    const alias = STOCK_ALIAS.find((item) => item.re.test(query));
    if (alias)
        return alias;
    const tokenMatches = query.match(/\b[A-Za-z]{1,5}\b/g) || [];
    const ticker = tokenMatches.map((token) => token.toUpperCase()).find((token) => !TICKER_STOPWORDS.has(token));
    if (!ticker)
        return null;
    if (/港股|hk/i.test(query))
        return { symbol: `${ticker}.HK`, label: `${ticker}.HK` };
    if (/a股|上证|深证|沪深|cn/i.test(query))
        return { symbol: `${ticker}.CN`, label: `${ticker}.CN` };
    return { symbol: `${ticker}.US`, label: `${ticker}.US` };
};
const detectFundTarget = (query) => {
    const alias = FUND_ALIAS.find((item) => item.re.test(query));
    if (alias)
        return alias;
    const code = query.match(/\b\d{6}\b/)?.[0];
    if (code)
        return { code, label: code };
    if (!FUND_QUERY_RE.test(query))
        return null;
    const cleaned = query.replace(/(今日|今天|当前|现在|最新|基金|净值|估值|多少钱|多少|行情|价格)/g, '').trim();
    return { code: cleaned || query.trim(), label: cleaned || query.trim() };
};
const detectFxPair = (query) => {
    const upper = query.toUpperCase();
    const explicit = upper.match(/\b([A-Z]{3})\s*\/?\s*([A-Z]{3})\b/);
    if (explicit && CURRENCY_CODES.has(explicit[1]) && CURRENCY_CODES.has(explicit[2])) {
        return { base: explicit[1], quote: explicit[2] };
    }
    if (/美元/.test(query) && /人民币/.test(query))
        return { base: 'USD', quote: 'CNY' };
    if (/欧元/.test(query) && /人民币/.test(query))
        return { base: 'EUR', quote: 'CNY' };
    if (/美元/.test(query) && /日元/.test(query))
        return { base: 'USD', quote: 'JPY' };
    if (/美元/.test(query) && /港币/.test(query))
        return { base: 'USD', quote: 'HKD' };
    if (/英镑/.test(query) && /人民币/.test(query))
        return { base: 'GBP', quote: 'CNY' };
    if (FOREX_QUERY_RE.test(query))
        return { base: 'USD', quote: 'CNY' };
    return null;
};
const detectCryptoTarget = (query) => {
    const alias = CRYPTO_ALIAS.find((item) => item.re.test(query));
    if (alias)
        return alias;
    if (CRYPTO_QUERY_RE.test(query))
        return { id: 'bitcoin', label: '比特币' };
    return null;
};
export const detectRealtimeIntent = (query) => {
    const normalized = normalizeQuery(query);
    if (!normalized) {
        return { matched: false, kind: null, target: null, displayName: '', confidence: 0, query: normalized };
    }
    if (BANK_GOLD_SCOPE_RE.test(normalized) && (REALTIME_HINT_RE.test(normalized) || /金价|价格|报价|多少钱/.test(normalized))) {
        return {
            matched: true,
            kind: 'gold',
            target: 'CN_BANK_GOLD',
            displayName: '银行金条价格',
            confidence: 0.98,
            query: normalized,
        };
    }
    if (SHOP_GOLD_SCOPE_RE.test(normalized) && (REALTIME_HINT_RE.test(normalized) || /金价|价格|报价|多少钱/.test(normalized))) {
        return {
            matched: true,
            kind: 'gold',
            target: 'CN_SHOP_GOLD',
            displayName: '国内金店金价',
            confidence: 0.98,
            query: normalized,
        };
    }
    if (GOLD_QUERY_RE.test(normalized) && (REALTIME_HINT_RE.test(normalized) || /价格|报价|多少钱/.test(normalized))) {
        return {
            matched: true,
            kind: 'gold',
            target: 'XAUUSD',
            displayName: '国际金价',
            confidence: 0.98,
            query: normalized,
        };
    }
    if (CN_OIL_SCOPE_RE.test(normalized) && (REALTIME_HINT_RE.test(normalized) || /油价|价格|报价|多少钱/.test(normalized))) {
        const area = detectDomesticOilArea(normalized);
        return {
            matched: true,
            kind: 'oil',
            target: `CN_OIL_${area.code}`,
            displayName: `国内油价（${area.area}）`,
            confidence: 0.97,
            query: normalized,
        };
    }
    if (OIL_QUERY_RE.test(normalized) && (REALTIME_HINT_RE.test(normalized) || /价格|报价|多少钱/.test(normalized) || /油价/.test(normalized))) {
        const brent = /布伦特|brent/i.test(normalized);
        return {
            matched: true,
            kind: 'oil',
            target: brent ? 'BRENT' : 'WTI',
            displayName: brent ? '布伦特原油' : '国际原油',
            confidence: 0.96,
            query: normalized,
        };
    }
    const fund = detectFundTarget(normalized);
    if (fund) {
        return {
            matched: true,
            kind: 'fund',
            target: fund.code,
            displayName: fund.label,
            confidence: 0.95,
            query: normalized,
        };
    }
    const fx = detectFxPair(normalized);
    if (fx) {
        return {
            matched: true,
            kind: 'forex',
            target: `${fx.base}/${fx.quote}`,
            displayName: `${fx.base}/${fx.quote}`,
            confidence: 0.94,
            query: normalized,
        };
    }
    const crypto = detectCryptoTarget(normalized);
    if (crypto) {
        return {
            matched: true,
            kind: 'crypto',
            target: crypto.id,
            displayName: crypto.label,
            confidence: 0.94,
            query: normalized,
        };
    }
    const stock = detectStockTarget(normalized);
    if (stock && (STOCK_QUERY_RE.test(normalized) || REALTIME_HINT_RE.test(normalized) || /价格|报价|多少钱/.test(normalized))) {
        return {
            matched: true,
            kind: 'stock',
            target: stock.symbol,
            displayName: stock.label,
            confidence: 0.93,
            query: normalized,
        };
    }
    return {
        matched: false,
        kind: null,
        target: null,
        displayName: '',
        confidence: 0,
        query: normalized,
    };
};

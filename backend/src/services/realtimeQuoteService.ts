import type {RealtimeIntentMatch, RealtimeKind} from './realtimeIntentService.ts'

const STOOQ_QUOTE_URL = 'https://stooq.com/q/l/?i=d&s='
const USD_RATE_URL = 'https://open.er-api.com/v6/latest/USD'
const FX_RATE_URL = 'https://open.er-api.com/v6/latest/'
const CRYPTO_PRICE_URL = 'https://api.coingecko.com/api/v3/simple/price'
const FUND_SEARCH_URL = 'https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key='
const FUND_ESTIMATE_URL = 'https://fundgz.1234567.com.cn/js/'
const DOMESTIC_OIL_PRICE_URL = 'https://api.03c3.cn/api/oilPrice?area='
const SHOP_GOLD_PRICE_URL = 'https://free.xwteam.cn/api/gold/brand'
const BANK_GOLD_PRICE_URL = 'https://v2.xxapi.cn/api/goldprice'

const TROY_OUNCE_IN_GRAMS = 31.1034768
const CACHE_TTL_MS = 60 * 1000

type QuoteCurrency = 'USD' | 'CNY' | 'HKD' | 'JPY'

const CN_OIL_AREA_BY_CODE: Record<string, string> = {
  BEIJING: '北京',
  SHANGHAI: '上海',
  GUANGDONG: '广东',
  JIANGSU: '江苏',
  ZHEJIANG: '浙江',
  SHANDONG: '山东',
  SICHUAN: '四川',
  HUBEI: '湖北',
  HENAN: '河南',
  FUJIAN: '福建',
}

export interface RealtimeQuote {
  kind: RealtimeKind
  target: string
  displayName: string
  value: number
  currency: QuoteCurrency
  source: string
  sourceUrl: string
  timestamp: string
  extra: Record<string, unknown>
}

interface FxApiResponse {
  rates?: Record<string, number>
  time_last_update_unix?: number
}

interface CryptoApiRow {
  usd?: number
  cny?: number
  last_updated_at?: number
}

type CryptoApiResponse = Record<string, CryptoApiRow>

const cache = new Map<string, {expiresAt: number; value: unknown}>()

const getCache = <T>(key: string): T | null => {
  const hit = cache.get(key)
  if (!hit) return null
  if (Date.now() >= hit.expiresAt) {
    cache.delete(key)
    return null
  }
  return hit.value as T
}

const setCache = (key: string, value: unknown, ttlMs = CACHE_TTL_MS) => {
  cache.set(key, {value, expiresAt: Date.now() + ttlMs})
}

const withTimeout = async (url: string, timeoutMs: number) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, {signal: controller.signal})
  } finally {
    clearTimeout(timer)
  }
}

const formatCompactDate = (yyyymmdd: string) => {
  if (yyyymmdd.length !== 8) return yyyymmdd
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`
}

const formatCompactTime = (hhmmss: string) => {
  if (hhmmss.length !== 6) return hhmmss
  return `${hhmmss.slice(0, 2)}:${hhmmss.slice(2, 4)}:${hhmmss.slice(4, 6)}`
}

const parseStooqCsv = (csvLine: string, sourceUrl: string) => {
  const parts = csvLine.trim().split(',')
  if (parts.length < 7) throw new Error('Stooq payload invalid')

  const symbol = (parts[0] || '').trim()
  const date = String(parts[1] || '').trim()
  const time = String(parts[2] || '').trim()
  const open = Number(parts[3])
  const high = Number(parts[4])
  const low = Number(parts[5])
  const last = Number(parts[6])

  if ([date, time].some((value) => value === 'N/D')) throw new Error(`Stooq quote unavailable for ${symbol}`)
  if (![open, high, low, last].every((v) => Number.isFinite(v) && v > 0)) {
    throw new Error('Stooq numeric fields invalid')
  }

  return {
    symbol,
    sourceUrl,
    fetchedAtUtc: new Date().toISOString(),
    tradeDateUtc: formatCompactDate(date),
    tradeTimeUtc: formatCompactTime(time),
    open,
    high,
    low,
    last,
  }
}

const fetchUsdToCny = async () => {
  const cacheKey = 'fx:USD:CNY'
  const cached = getCache<number>(cacheKey)
  if (cached) return cached

  const response = await withTimeout(USD_RATE_URL, 3000)
  if (!response.ok) throw new Error(`USD/CNY fetch failed: ${response.status}`)
  const data = (await response.json()) as FxApiResponse
  const rate = Number(data?.rates?.CNY)
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('USD/CNY invalid')
  setCache(cacheKey, rate)
  return rate
}

const fetchStooqSnapshot = async (symbol: string) => {
  const cacheKey = `stooq:${symbol}`
  const cached = getCache<ReturnType<typeof parseStooqCsv>>(cacheKey)
  if (cached) return cached

  const url = `${STOOQ_QUOTE_URL}${encodeURIComponent(symbol.toLowerCase())}`
  const response = await withTimeout(url, 3500)
  if (!response.ok) throw new Error(`Stooq fetch failed: ${response.status}`)
  const parsed = parseStooqCsv(await response.text(), url)
  setCache(cacheKey, parsed)
  return parsed
}

const fetchFxPair = async (pair: string) => {
  const [base, quote] = pair.split('/')
  const key = `fx:${base}:${quote}`
  const cached = getCache<RealtimeQuote>(key)
  if (cached) return cached

  const url = `${FX_RATE_URL}${base}`
  const response = await withTimeout(url, 3500)
  if (!response.ok) throw new Error(`FX fetch failed: ${response.status}`)
  const data = (await response.json()) as FxApiResponse
  const rate = Number(data?.rates?.[quote])
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('FX rate invalid')

  const quoteData: RealtimeQuote = {
    kind: 'forex',
    target: pair,
    displayName: pair,
    value: rate,
    currency: quote as QuoteCurrency,
    source: 'ExchangeRate-API',
    sourceUrl: url,
    timestamp:
      Number.isFinite(Number(data?.time_last_update_unix)) && Number(data?.time_last_update_unix) > 0
        ? new Date(Number(data.time_last_update_unix) * 1000).toISOString()
        : new Date().toISOString(),
    extra: {
      base,
      quote,
      inverse: 1 / rate,
    },
  }
  setCache(key, quoteData)
  return quoteData
}

const fetchCryptoQuote = async (id: string, displayName: string) => {
  const key = `crypto:${id}`
  const cached = getCache<RealtimeQuote>(key)
  if (cached) return cached

  const url = `${CRYPTO_PRICE_URL}?ids=${encodeURIComponent(id)}&vs_currencies=usd,cny&include_last_updated_at=true`
  const response = await withTimeout(url, 4000)
  if (!response.ok) throw new Error(`Crypto fetch failed: ${response.status}`)
  const data = (await response.json()) as CryptoApiResponse
  const row = data[id]
  if (!row) throw new Error(`Crypto payload missing: ${id}`)

  const usd = Number(row.usd)
  const cny = Number(row.cny)
  const updatedAtUtc =
    Number.isFinite(Number(row.last_updated_at)) && Number(row.last_updated_at) > 0
      ? new Date(Number(row.last_updated_at) * 1000).toISOString()
      : new Date().toISOString()

  if (!Number.isFinite(usd) || usd <= 0) throw new Error('Crypto USD invalid')

  const quote: RealtimeQuote = {
    kind: 'crypto',
    target: id,
    displayName,
    value: usd,
    currency: 'USD',
    source: 'CoinGecko',
    sourceUrl: url,
    timestamp: updatedAtUtc,
    extra: {
      usd,
      cny: Number.isFinite(cny) && cny > 0 ? cny : undefined,
    },
  }
  setCache(key, quote)
  return quote
}

const normalizeFundSearchKeyword = (target: string) =>
  target.replace(/(今日|今天|当前|现在|最新|基金|净值|估值|多少钱|多少|行情|价格)/g, '').trim()

const resolveFundCode = async (target: string) => {
  if (/^\d{6}$/.test(target)) return target

  const keyword = normalizeFundSearchKeyword(target)
  const url = `${FUND_SEARCH_URL}${encodeURIComponent(keyword || target)}`
  const response = await withTimeout(url, 4000)
  if (!response.ok) throw new Error(`Fund search failed: ${response.status}`)
  const data = (await response.json()) as {Datas?: Array<{CODE?: string; NAME?: string}>}
  const first = data?.Datas?.find((item) => item?.CODE && item?.NAME)
  if (!first?.CODE) throw new Error('Fund search empty')
  return first.CODE
}

const parseFundEstimatePayload = (payload: string) => {
  const match = payload.match(/jsonpgz\((.*)\);?$/)
  if (!match?.[1]) throw new Error('Fund estimate payload invalid')
  const parsed = JSON.parse(match[1]) as {
    fundcode?: string
    name?: string
    jzrq?: string
    dwjz?: string
    gsz?: string
    gszzl?: string
    gztime?: string
  }
  if (!parsed.fundcode || !parsed.name) throw new Error('Fund estimate missing fields')
  const estimated = Number(parsed.gsz)
  if (!Number.isFinite(estimated) || estimated <= 0) throw new Error('Fund estimate invalid')
  return {
    code: parsed.fundcode,
    name: parsed.name,
    netValueDate: parsed.jzrq || '',
    netValue: Number(parsed.dwjz),
    estimateValue: estimated,
    estimateChangePercent: Number(parsed.gszzl),
    estimateTime: parsed.gztime || '',
  }
}

const fetchFundQuote = async (target: string, displayName: string) => {
  const code = await resolveFundCode(target)
  const cacheKey = `fund:${code}`
  const cached = getCache<RealtimeQuote>(cacheKey)
  if (cached) return cached

  const url = `${FUND_ESTIMATE_URL}${code}.js`
  const response = await withTimeout(url, 4000)
  if (!response.ok) throw new Error(`Fund estimate fetch failed: ${response.status}`)
  const parsed = parseFundEstimatePayload(await response.text())
  const timestamp = parsed.estimateTime ? new Date(parsed.estimateTime.replace(' ', 'T') + ':00+08:00').toISOString() : new Date().toISOString()

  const quote: RealtimeQuote = {
    kind: 'fund',
    target: parsed.code,
    displayName: parsed.name || displayName,
    value: parsed.estimateValue,
    currency: 'CNY',
    source: 'eastmoney',
    sourceUrl: url,
    timestamp,
    extra: {
      netValueDate: parsed.netValueDate,
      netValue: Number.isFinite(parsed.netValue) ? parsed.netValue : undefined,
      estimateChangePercent: Number.isFinite(parsed.estimateChangePercent) ? parsed.estimateChangePercent : undefined,
    },
  }
  setCache(cacheKey, quote)
  return quote
}

const fetchOilQuote = async (target: string, displayName: string) => {
  if (target.startsWith('CN_OIL_')) {
    const areaCode = target.slice('CN_OIL_'.length)
    const area = CN_OIL_AREA_BY_CODE[areaCode] || '北京'
    const cacheKey = `oil-domestic:${area}`
    const cached = getCache<RealtimeQuote>(cacheKey)
    if (cached) return cached

    const url = `${DOMESTIC_OIL_PRICE_URL}${encodeURIComponent(area)}`
    const response = await withTimeout(url, 4000)
    if (!response.ok) throw new Error(`Domestic oil fetch failed: ${response.status}`)
    const payload = (await response.json()) as {
      code?: number
      data?: {
        area?: string
        date?: string
        ['92']?: string
        ['95']?: string
        ['98']?: string
        ['0']?: string
      }
    }

    const raw = payload?.data || {}
    const fuel92 = Number(raw['92'])
    const fuel95 = Number(raw['95'])
    const fuel98 = Number(raw['98'])
    const fuel0 = Number(raw['0'])
    const hasAnyFuel = [fuel92, fuel95, fuel98, fuel0].some((item) => Number.isFinite(item) && item > 0)
    if (!hasAnyFuel) throw new Error('Domestic oil payload invalid')

    const value = [fuel95, fuel92, fuel98, fuel0].find((item) => Number.isFinite(item) && item > 0) || 0
    const quoteDate = raw.date || ''
    const timestamp = quoteDate
      ? new Date(`${quoteDate}T12:00:00+08:00`).toISOString()
      : new Date().toISOString()

    const quote: RealtimeQuote = {
      kind: 'oil',
      target,
      displayName: displayName || `国内油价（${raw.area || area}）`,
      value,
      currency: 'CNY',
      source: 'api.03c3.cn',
      sourceUrl: url,
      timestamp,
      extra: {
        scope: 'domestic_retail',
        area: raw.area || area,
        quoteDate,
        unit: 'CNY/L',
        fuel92: Number.isFinite(fuel92) && fuel92 > 0 ? fuel92 : undefined,
        fuel95: Number.isFinite(fuel95) && fuel95 > 0 ? fuel95 : undefined,
        fuel98: Number.isFinite(fuel98) && fuel98 > 0 ? fuel98 : undefined,
        fuel0: Number.isFinite(fuel0) && fuel0 > 0 ? fuel0 : undefined,
      },
    }
    setCache(cacheKey, quote)
    return quote
  }

  const cacheKey = `oil:${target}`
  const cached = getCache<RealtimeQuote>(cacheKey)
  if (cached) return cached

  const [wti, brent] = await Promise.all([fetchStooqSnapshot('CL.F'), fetchStooqSnapshot('CB.F')])
  const primary = target === 'BRENT' ? brent : wti

  const quote: RealtimeQuote = {
    kind: 'oil',
    target,
    displayName,
    value: primary.last,
    currency: 'USD',
    source: 'Stooq',
    sourceUrl: primary.sourceUrl,
    timestamp: primary.fetchedAtUtc,
    extra: {
      unit: 'USD/barrel',
      marketTimeUtc: `${primary.tradeDateUtc} ${primary.tradeTimeUtc}`,
      open: primary.open,
      high: primary.high,
      low: primary.low,
      wti: {
        value: wti.last,
        marketTimeUtc: `${wti.tradeDateUtc} ${wti.tradeTimeUtc}`,
      },
      brent: {
        value: brent.last,
        marketTimeUtc: `${brent.tradeDateUtc} ${brent.tradeTimeUtc}`,
      },
    },
  }
  setCache(cacheKey, quote)
  return quote
}

const fetchShopGoldQuote = async () => {
  const cacheKey = 'gold:CN_SHOP_GOLD'
  const cached = getCache<RealtimeQuote>(cacheKey)
  if (cached) return cached

  const response = await withTimeout(SHOP_GOLD_PRICE_URL, 4000)
  if (!response.ok) throw new Error(`Shop gold fetch failed: ${response.status}`)
  const payload = (await response.json()) as {
    data?: Array<{brand?: string; goldPrice?: string | number}>
  }

  const shopPrices = (payload?.data || [])
    .map((item) => ({
      brand: String(item.brand || '').trim(),
      goldPrice: Number(item.goldPrice),
    }))
    .filter((item) => item.brand && Number.isFinite(item.goldPrice) && item.goldPrice > 0)
    .slice(0, 10)

  if (!shopPrices.length) throw new Error('Shop gold payload empty')

  const avg = shopPrices.reduce((sum, item) => sum + item.goldPrice, 0) / shopPrices.length
  const quote: RealtimeQuote = {
    kind: 'gold',
    target: 'CN_SHOP_GOLD',
    displayName: '国内金店金价',
    value: Number(avg.toFixed(2)),
    currency: 'CNY',
    source: 'free.xwteam.cn',
    sourceUrl: SHOP_GOLD_PRICE_URL,
    timestamp: new Date().toISOString(),
    extra: {
      scope: 'cn_shop_gold',
      unit: 'CNY/g',
      shopPrices,
    },
  }
  setCache(cacheKey, quote)
  return quote
}

const fetchBankGoldQuote = async () => {
  const cacheKey = 'gold:CN_BANK_GOLD'
  const cached = getCache<RealtimeQuote>(cacheKey)
  if (cached) return cached

  const response = await withTimeout(BANK_GOLD_PRICE_URL, 4000)
  if (!response.ok) throw new Error(`Bank gold fetch failed: ${response.status}`)
  const payload = (await response.json()) as {
    data?: {
      bank_gold_bar_price?: Array<{bank?: string; price?: string | number}>
    }
  }

  const bankPrices = (payload?.data?.bank_gold_bar_price || [])
    .map((item) => ({
      bank: String(item.bank || '').trim(),
      price: Number(item.price),
    }))
    .filter((item) => item.bank && Number.isFinite(item.price) && item.price > 0)
    .sort((a, b) => a.price - b.price)
    .slice(0, 10)

  if (!bankPrices.length) throw new Error('Bank gold payload empty')

  const avg = bankPrices.reduce((sum, item) => sum + item.price, 0) / bankPrices.length
  const quote: RealtimeQuote = {
    kind: 'gold',
    target: 'CN_BANK_GOLD',
    displayName: '银行金条价格',
    value: Number(avg.toFixed(2)),
    currency: 'CNY',
    source: 'v2.xxapi.cn',
    sourceUrl: BANK_GOLD_PRICE_URL,
    timestamp: new Date().toISOString(),
    extra: {
      scope: 'cn_bank_gold',
      unit: 'CNY/g',
      bankPrices,
    },
  }
  setCache(cacheKey, quote)
  return quote
}

const fetchInternationalGoldQuote = async () => {
  const cacheKey = 'gold:XAUUSD'
  const cached = getCache<RealtimeQuote>(cacheKey)
  if (cached) return cached

  const snapshot = await fetchStooqSnapshot('XAUUSD')
  const usdToCny = await fetchUsdToCny()
  const cnyPerOz = snapshot.last * usdToCny
  const cnyPerGram = cnyPerOz / TROY_OUNCE_IN_GRAMS

  const quote: RealtimeQuote = {
    kind: 'gold',
    target: 'XAUUSD',
    displayName: '国际金价',
    value: snapshot.last,
    currency: 'USD',
    source: 'Stooq',
    sourceUrl: snapshot.sourceUrl,
    timestamp: snapshot.fetchedAtUtc,
    extra: {
      unit: 'USD/oz',
      marketTimeUtc: `${snapshot.tradeDateUtc} ${snapshot.tradeTimeUtc}`,
      open: snapshot.open,
      high: snapshot.high,
      low: snapshot.low,
      usdToCny,
      cnyPerOz,
      cnyPerGram,
    },
  }
  setCache(cacheKey, quote)
  return quote
}

const fetchStockQuote = async (target: string, displayName: string) => {
  const snapshot = await fetchStooqSnapshot(target)
  const currency: QuoteCurrency = target.endsWith('.HK') ? 'HKD' : target.endsWith('.CN') ? 'CNY' : 'USD'
  return {
    kind: 'stock' as const,
    target,
    displayName,
    value: snapshot.last,
    currency,
    source: 'Stooq',
    sourceUrl: snapshot.sourceUrl,
    timestamp: snapshot.fetchedAtUtc,
    extra: {
      marketTimeUtc: `${snapshot.tradeDateUtc} ${snapshot.tradeTimeUtc}`,
      open: snapshot.open,
      high: snapshot.high,
      low: snapshot.low,
    },
  }
}

export const fetchRealtimeQuote = async (intent: RealtimeIntentMatch): Promise<RealtimeQuote> => {
  if (!intent.matched) throw new Error('Realtime intent not matched')

  switch (intent.kind) {
    case 'gold':
      if (intent.target === 'CN_SHOP_GOLD') {
        return fetchShopGoldQuote()
      }
      if (intent.target === 'CN_BANK_GOLD') {
        return fetchBankGoldQuote()
      }
      return fetchInternationalGoldQuote()
    case 'oil':
      return fetchOilQuote(intent.target, intent.displayName)
    case 'stock':
      return fetchStockQuote(intent.target, intent.displayName)
    case 'fund':
      return fetchFundQuote(intent.target, intent.displayName)
    case 'forex':
      return fetchFxPair(intent.target)
    case 'crypto':
      return fetchCryptoQuote(intent.target, intent.displayName)
    default:
      throw new Error(`Unsupported realtime kind: ${String(intent satisfies never)}`)
  }
}

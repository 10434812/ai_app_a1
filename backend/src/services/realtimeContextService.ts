import {ChatMessage} from './llm/types.ts'

const GOLD_PRICE_URL = 'https://stooq.com/q/l/?s=xauusd&i=d'
const STOOQ_QUOTE_URL = 'https://stooq.com/q/l/?i=d&s='
const USD_RATE_URL = 'https://open.er-api.com/v6/latest/USD'
const FX_RATE_URL = 'https://open.er-api.com/v6/latest/'
const CRYPTO_PRICE_URL = 'https://api.coingecko.com/api/v3/simple/price'
const GOOGLE_NEWS_RSS_URL = 'https://news.google.com/rss/search'

const TROY_OUNCE_IN_GRAMS = 31.1034768
const CACHE_TTL_MS = 60 * 1000

const GOLD_QUERY_RE = /(金价|黄金|gold|xau|xauusd)/i
const REALTIME_RE = /(实时|当前|现在|今日|最新|刚刚|today|current|latest|now)/i
const PRICE_RE = /(价格|多少钱|报价|price|quote|金价)/i
const STOCK_QUERY_RE = /(股票|股价|美股|港股|a股|A股|证券|ticker|stock|纳斯达克|道琼斯|标普|sp500|nasdaq|dow|s&p)/i
const FOREX_QUERY_RE = /(汇率|外汇|fx|forex|兑|usd|cny|eur|jpy|hkd|gbp|aud|cad)/i
const CRYPTO_QUERY_RE = /(加密|数字货币|币价|虚拟币|比特币|以太坊|crypto|bitcoin|ethereum|btc|eth|sol|bnb|doge|xrp|ada)/i
const NEWS_QUERY_RE = /(新闻|资讯|头条|快讯|热点|news|headline)/i
const TIMESENSITIVE_RE = /(实时|当前|现在|今日|最新|刚刚|today|current|latest|now|新闻|news|天气|weather|汇率|exchange|股票|stock|金价|黄金|币价|bitcoin|btc|eth)/i

const CURRENCY_CODES = new Set(['USD', 'CNY', 'EUR', 'JPY', 'HKD', 'GBP', 'AUD', 'CAD', 'CHF', 'SGD', 'NZD'])
const TICKER_STOPWORDS = new Set([
  'TODAY',
  'NOW',
  'NEWS',
  'PRICE',
  'STOCK',
  'GOLD',
  'BTC',
  'ETH',
  'USD',
  'CNY',
  'EUR',
  'JPY',
  'HKD',
  'GBP',
])

const STOCK_ALIAS: Array<{re: RegExp; symbol: string; label: string}> = [
  {re: /(苹果|apple)/i, symbol: 'aapl.us', label: 'AAPL'},
  {re: /(特斯拉|tesla)/i, symbol: 'tsla.us', label: 'TSLA'},
  {re: /(英伟达|nvidia)/i, symbol: 'nvda.us', label: 'NVDA'},
  {re: /(微软|microsoft)/i, symbol: 'msft.us', label: 'MSFT'},
  {re: /(亚马逊|amazon)/i, symbol: 'amzn.us', label: 'AMZN'},
  {re: /(谷歌|google|alphabet)/i, symbol: 'googl.us', label: 'GOOGL'},
  {re: /(腾讯)/i, symbol: '0700.hk', label: '0700.HK'},
  {re: /(阿里|alibaba)/i, symbol: 'baba.us', label: 'BABA'},
  {re: /(拼多多|pdd)/i, symbol: 'pdd.us', label: 'PDD'},
  {re: /(小米)/i, symbol: '1810.hk', label: '1810.HK'},
]

const CRYPTO_ALIAS: Array<{re: RegExp; id: string; label: string}> = [
  {re: /(比特币|bitcoin|btc)/i, id: 'bitcoin', label: 'BTC'},
  {re: /(以太坊|ethereum|eth)/i, id: 'ethereum', label: 'ETH'},
  {re: /(solana|sol)/i, id: 'solana', label: 'SOL'},
  {re: /(bnb|币安币|binance)/i, id: 'binancecoin', label: 'BNB'},
  {re: /(doge|dogecoin|狗狗币)/i, id: 'dogecoin', label: 'DOGE'},
  {re: /(xrp|瑞波|ripple)/i, id: 'ripple', label: 'XRP'},
  {re: /(ada|cardano)/i, id: 'cardano', label: 'ADA'},
]

interface GoldSnapshot {
  source: string
  fetchedAtUtc: string
  tradeDateUtc: string
  tradeTimeUtc: string
  open: number
  high: number
  low: number
  last: number
  usdToCny?: number
}

interface StooqSnapshot {
  source: string
  fetchedAtUtc: string
  symbol: string
  tradeDateUtc: string
  tradeTimeUtc: string
  open: number
  high: number
  low: number
  last: number
}

interface FxSnapshot {
  source: string
  fetchedAtUtc: string
  base: string
  quote: string
  rate: number
  providerUpdatedUtc?: string
}

interface CryptoSnapshot {
  source: string
  fetchedAtUtc: string
  id: string
  label: string
  usd?: number
  cny?: number
  updatedAtUtc?: string
}

interface NewsItem {
  title: string
  link: string
  publishedAt: string
}

interface NewsSnapshot {
  source: string
  fetchedAtUtc: string
  keyword: string
  items: NewsItem[]
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

const htmlDecode = (text: string) =>
  text
    .replace(/<!\[CDATA\[/g, '')
    .replace(/\]\]>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

const parseStooqCsv = (csvLine: string, source: string): StooqSnapshot => {
  const parts = csvLine.trim().split(',')
  if (parts.length < 7) throw new Error('Stooq payload invalid')

  const symbol = (parts[0] || '').trim()
  const open = Number(parts[3])
  const high = Number(parts[4])
  const low = Number(parts[5])
  const last = Number(parts[6])

  if (![open, high, low, last].every((v) => Number.isFinite(v) && v > 0)) {
    throw new Error('Stooq numeric fields invalid')
  }

  return {
    source,
    fetchedAtUtc: new Date().toISOString(),
    symbol,
    tradeDateUtc: formatCompactDate(parts[1] || ''),
    tradeTimeUtc: formatCompactTime(parts[2] || ''),
    open,
    high,
    low,
    last,
  }
}

const fetchUsdToCny = async (): Promise<number | undefined> => {
  const cacheKey = 'fx:USD:CNY'
  const cached = getCache<number>(cacheKey)
  if (cached) return cached

  try {
    const response = await withTimeout(USD_RATE_URL, 2500)
    if (!response.ok) return undefined
    const data = (await response.json()) as FxApiResponse
    const cnyRate = Number(data?.rates?.CNY)
    if (Number.isFinite(cnyRate) && cnyRate > 0) {
      setCache(cacheKey, cnyRate)
      return cnyRate
    }
    return undefined
  } catch {
    return undefined
  }
}

const fetchGoldSnapshot = async (): Promise<GoldSnapshot> => {
  const cacheKey = 'gold:xauusd'
  const cached = getCache<GoldSnapshot>(cacheKey)
  if (cached) return cached

  const response = await withTimeout(GOLD_PRICE_URL, 3500)
  if (!response.ok) {
    throw new Error(`Gold price fetch failed: ${response.status}`)
  }

  const parsed = parseStooqCsv(await response.text(), GOLD_PRICE_URL)
  const usdToCny = await fetchUsdToCny()
  const snapshot: GoldSnapshot = {
    source: parsed.source,
    fetchedAtUtc: parsed.fetchedAtUtc,
    tradeDateUtc: parsed.tradeDateUtc,
    tradeTimeUtc: parsed.tradeTimeUtc,
    open: parsed.open,
    high: parsed.high,
    low: parsed.low,
    last: parsed.last,
    usdToCny,
  }
  setCache(cacheKey, snapshot)
  return snapshot
}

const fetchStooqSymbolSnapshot = async (symbol: string): Promise<StooqSnapshot> => {
  const key = `stooq:${symbol}`
  const cached = getCache<StooqSnapshot>(key)
  if (cached) return cached

  const url = `${STOOQ_QUOTE_URL}${encodeURIComponent(symbol)}`
  const response = await withTimeout(url, 3500)
  if (!response.ok) throw new Error(`Stock quote fetch failed: ${response.status}`)
  const snapshot = parseStooqCsv(await response.text(), url)
  setCache(key, snapshot)
  return snapshot
}

const fetchFxRate = async (base: string, quote: string): Promise<FxSnapshot> => {
  const key = `fx:${base}:${quote}`
  const cached = getCache<FxSnapshot>(key)
  if (cached) return cached

  const url = `${FX_RATE_URL}${base}`
  const response = await withTimeout(url, 3500)
  if (!response.ok) throw new Error(`FX fetch failed: ${response.status}`)
  const data = (await response.json()) as FxApiResponse
  const rate = Number(data?.rates?.[quote])
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('FX rate invalid')

  const providerUpdatedUnix = Number(data?.time_last_update_unix)
  const snapshot: FxSnapshot = {
    source: url,
    fetchedAtUtc: new Date().toISOString(),
    base,
    quote,
    rate,
    providerUpdatedUtc:
      Number.isFinite(providerUpdatedUnix) && providerUpdatedUnix > 0
        ? new Date(providerUpdatedUnix * 1000).toISOString()
        : undefined,
  }
  setCache(key, snapshot)
  return snapshot
}

const fetchCryptoPrices = async (ids: Array<{id: string; label: string}>): Promise<CryptoSnapshot[]> => {
  const key = `crypto:${ids.map((item) => item.id).sort().join(',')}`
  const cached = getCache<CryptoSnapshot[]>(key)
  if (cached) return cached

  const url =
    `${CRYPTO_PRICE_URL}?ids=${encodeURIComponent(ids.map((item) => item.id).join(','))}` +
    '&vs_currencies=usd,cny&include_last_updated_at=true'
  const response = await withTimeout(url, 4000)
  if (!response.ok) throw new Error(`Crypto fetch failed: ${response.status}`)
  const data = (await response.json()) as CryptoApiResponse

  const result = ids
    .map((item) => {
      const row = data[item.id]
      if (!row) return null
      const usd = Number(row.usd)
      const cny = Number(row.cny)
      const updatedUnix = Number(row.last_updated_at)
      const snapshot: CryptoSnapshot = {
        source: url,
        fetchedAtUtc: new Date().toISOString(),
        id: item.id,
        label: item.label,
        usd: Number.isFinite(usd) && usd > 0 ? usd : undefined,
        cny: Number.isFinite(cny) && cny > 0 ? cny : undefined,
        updatedAtUtc:
          Number.isFinite(updatedUnix) && updatedUnix > 0 ? new Date(updatedUnix * 1000).toISOString() : undefined,
      }
      return snapshot
    })
    .filter((item): item is CryptoSnapshot => !!item && (!!item.usd || !!item.cny))

  if (result.length === 0) throw new Error('Crypto payload empty')
  setCache(key, result)
  return result
}

const fetchNews = async (keyword: string): Promise<NewsSnapshot> => {
  const key = `news:${keyword}`
  const cached = getCache<NewsSnapshot>(key)
  if (cached) return cached

  const url =
    `${GOOGLE_NEWS_RSS_URL}?q=${encodeURIComponent(keyword)}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`
  const response = await withTimeout(url, 4500)
  if (!response.ok) throw new Error(`News fetch failed: ${response.status}`)
  const xml = await response.text()

  const itemMatches = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g)).slice(0, 3)
  const items: NewsItem[] = itemMatches
    .map((match) => {
      const block = match[1]
      const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/)
      const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/)
      const dateMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)
      if (!titleMatch || !linkMatch) return null
      return {
        title: htmlDecode(titleMatch[1]).trim(),
        link: htmlDecode(linkMatch[1]).trim(),
        publishedAt: dateMatch ? htmlDecode(dateMatch[1]).trim() : '',
      }
    })
    .filter((item): item is NewsItem => !!item)

  if (items.length === 0) throw new Error('News feed has no items')

  const snapshot: NewsSnapshot = {
    source: url,
    fetchedAtUtc: new Date().toISOString(),
    keyword,
    items,
  }
  setCache(key, snapshot, 90 * 1000)
  return snapshot
}

const detectStockTarget = (query: string): {symbol: string; label: string} | null => {
  const alias = STOCK_ALIAS.find((item) => item.re.test(query))
  if (alias) return {symbol: alias.symbol, label: alias.label}

  const tokenMatches = query.match(/\b[A-Za-z]{1,5}\b/g) || []
  const ticker = tokenMatches.map((token) => token.toUpperCase()).find((token) => !TICKER_STOPWORDS.has(token))
  if (!ticker) return null

  if (/港股|hk/i.test(query)) return {symbol: `${ticker.toLowerCase()}.hk`, label: `${ticker}.HK`}
  if (/a股|A股|上证|深证|沪深|cn/i.test(query)) return {symbol: `${ticker.toLowerCase()}.cn`, label: `${ticker}.CN`}
  return {symbol: `${ticker.toLowerCase()}.us`, label: `${ticker}.US`}
}

const detectFxPair = (query: string): {base: string; quote: string} | null => {
  const upper = query.toUpperCase()
  const explicit = upper.match(/\b([A-Z]{3})\s*\/?\s*([A-Z]{3})\b/)
  if (explicit && CURRENCY_CODES.has(explicit[1]) && CURRENCY_CODES.has(explicit[2])) {
    return {base: explicit[1], quote: explicit[2]}
  }

  if (/美元/.test(query) && /人民币/.test(query)) return {base: 'USD', quote: 'CNY'}
  if (/欧元/.test(query) && /人民币/.test(query)) return {base: 'EUR', quote: 'CNY'}
  if (/美元/.test(query) && /日元/.test(query)) return {base: 'USD', quote: 'JPY'}
  if (/美元/.test(query) && /港币/.test(query)) return {base: 'USD', quote: 'HKD'}
  if (/英镑/.test(query) && /人民币/.test(query)) return {base: 'GBP', quote: 'CNY'}

  if (/汇率/.test(query)) return {base: 'USD', quote: 'CNY'}
  return null
}

const detectCryptoTargets = (query: string): Array<{id: string; label: string}> => {
  const found = CRYPTO_ALIAS.filter((item) => item.re.test(query))
  const uniqMap = new Map<string, {id: string; label: string}>()
  for (const item of found) {
    uniqMap.set(item.id, {id: item.id, label: item.label})
  }
  if (uniqMap.size === 0) {
    return [{id: 'bitcoin', label: 'BTC'}]
  }
  return Array.from(uniqMap.values()).slice(0, 3)
}

const detectNewsKeyword = (query: string) => {
  const cleaned = query
    .replace(/(最新|今日|今天|实时|现在|当前|新闻|资讯|头条|快讯|热点|news|latest|current|today|now|headline)/gi, ' ')
    .replace(/[?？!！,，.。:：]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned || '全球'
}

const shouldInjectGoldRealtime = (query: string) =>
  GOLD_QUERY_RE.test(query) && (REALTIME_RE.test(query) || PRICE_RE.test(query))

const shouldInjectStockRealtime = (query: string) =>
  STOCK_QUERY_RE.test(query) || (!!detectStockTarget(query) && (REALTIME_RE.test(query) || PRICE_RE.test(query)))

const shouldInjectFxRealtime = (query: string) => FOREX_QUERY_RE.test(query)

const shouldInjectCryptoRealtime = (query: string) => CRYPTO_QUERY_RE.test(query)

const shouldInjectNewsRealtime = (query: string) => NEWS_QUERY_RE.test(query)

const buildGoldSection = async () => {
  const snapshot = await fetchGoldSnapshot()
  const cnyPerOz = snapshot.usdToCny ? snapshot.last * snapshot.usdToCny : undefined
  const cnyPerGram = cnyPerOz ? cnyPerOz / TROY_OUNCE_IN_GRAMS : undefined

  const lines = [
    '[Gold Realtime]',
    `- Source: Stooq XAUUSD (${snapshot.source})`,
    `- FetchedAt(UTC): ${snapshot.fetchedAtUtc}`,
    `- MarketTime(UTC): ${snapshot.tradeDateUtc} ${snapshot.tradeTimeUtc}`,
    `- XAUUSD last: ${snapshot.last.toFixed(3)} USD/oz`,
    `- Session OHLC: O ${snapshot.open.toFixed(3)} / H ${snapshot.high.toFixed(3)} / L ${snapshot.low.toFixed(3)} / C ${snapshot.last.toFixed(3)}`,
  ]
  if (snapshot.usdToCny) lines.push(`- USD/CNY: ${snapshot.usdToCny.toFixed(4)}`)
  if (cnyPerOz) lines.push(`- Estimate: ${cnyPerOz.toFixed(2)} CNY/oz`)
  if (cnyPerGram) lines.push(`- Estimate: ${cnyPerGram.toFixed(2)} CNY/g`)
  return lines.join('\n')
}

const buildStockSection = async (query: string) => {
  const target = detectStockTarget(query)
  if (!target) throw new Error('No stock symbol inferred')

  const snapshot = await fetchStooqSymbolSnapshot(target.symbol)
  const lines = [
    '[Stock Realtime]',
    `- Symbol: ${target.label} (${snapshot.symbol})`,
    `- Source: Stooq (${snapshot.source})`,
    `- FetchedAt(UTC): ${snapshot.fetchedAtUtc}`,
    `- MarketTime(UTC): ${snapshot.tradeDateUtc} ${snapshot.tradeTimeUtc}`,
    `- Last: ${snapshot.last.toFixed(4)}`,
    `- Session OHLC: O ${snapshot.open.toFixed(4)} / H ${snapshot.high.toFixed(4)} / L ${snapshot.low.toFixed(4)} / C ${snapshot.last.toFixed(4)}`,
  ]
  return lines.join('\n')
}

const buildFxSection = async (query: string) => {
  const pair = detectFxPair(query)
  if (!pair) throw new Error('No FX pair inferred')

  const snapshot = await fetchFxRate(pair.base, pair.quote)
  const inverse = 1 / snapshot.rate
  const lines = [
    '[FX Realtime]',
    `- Pair: ${snapshot.base}/${snapshot.quote}`,
    `- Source: ExchangeRate-API (${snapshot.source})`,
    `- FetchedAt(UTC): ${snapshot.fetchedAtUtc}`,
    snapshot.providerUpdatedUtc ? `- ProviderUpdatedAt(UTC): ${snapshot.providerUpdatedUtc}` : '',
    `- Rate: 1 ${snapshot.base} = ${snapshot.rate.toFixed(6)} ${snapshot.quote}`,
    `- Inverse: 1 ${snapshot.quote} = ${inverse.toFixed(6)} ${snapshot.base}`,
  ].filter(Boolean)
  return lines.join('\n')
}

const buildCryptoSection = async (query: string) => {
  const targets = detectCryptoTargets(query)
  const snapshots = await fetchCryptoPrices(targets)

  const lines = [
    '[Crypto Realtime]',
    `- Source: CoinGecko (${CRYPTO_PRICE_URL})`,
    `- FetchedAt(UTC): ${new Date().toISOString()}`,
  ]

  for (const item of snapshots) {
    const priced = []
    if (item.usd) priced.push(`${item.usd.toFixed(4)} USD`)
    if (item.cny) priced.push(`${item.cny.toFixed(4)} CNY`)
    lines.push(`- ${item.label}: ${priced.join(' | ')}`)
    if (item.updatedAtUtc) lines.push(`  UpdatedAt(UTC): ${item.updatedAtUtc}`)
  }

  return lines.join('\n')
}

const buildNewsSection = async (query: string) => {
  const keyword = detectNewsKeyword(query)
  const snapshot = await fetchNews(keyword)

  const lines = [
    '[News Realtime]',
    `- Keyword: ${snapshot.keyword}`,
    `- Source: Google News RSS (${snapshot.source})`,
    `- FetchedAt(UTC): ${snapshot.fetchedAtUtc}`,
    '- Top headlines:',
  ]

  snapshot.items.forEach((item, index) => {
    lines.push(`  ${index + 1}. ${item.title}`)
    if (item.publishedAt) lines.push(`     Published: ${item.publishedAt}`)
    lines.push(`     Link: ${item.link}`)
  })
  return lines.join('\n')
}

export const buildRealtimeContextMessage = async (latestUserQuery: string): Promise<ChatMessage | null> => {
  if (!latestUserQuery) return null

  const jobs: Array<Promise<string>> = []
  if (shouldInjectGoldRealtime(latestUserQuery)) jobs.push(buildGoldSection())
  if (shouldInjectStockRealtime(latestUserQuery)) jobs.push(buildStockSection(latestUserQuery))
  if (shouldInjectFxRealtime(latestUserQuery)) jobs.push(buildFxSection(latestUserQuery))
  if (shouldInjectCryptoRealtime(latestUserQuery)) jobs.push(buildCryptoSection(latestUserQuery))
  if (shouldInjectNewsRealtime(latestUserQuery)) jobs.push(buildNewsSection(latestUserQuery))

  if (jobs.length === 0) return null

  const settled = await Promise.allSettled(jobs)
  const sections = settled
    .filter((item): item is PromiseFulfilledResult<string> => item.status === 'fulfilled')
    .map((item) => item.value)

  settled
    .filter((item): item is PromiseRejectedResult => item.status === 'rejected')
    .forEach((item) => console.error('Realtime section build failed:', item.reason))

  if (sections.length === 0) return null

  const content = [
    'Realtime data context for this answer:',
    ...sections,
    'Instruction: For current/latest questions, prioritize these realtime values, mention source and timestamp, and avoid stale memorized figures.',
  ].join('\n\n')

  return {
    role: 'system',
    content,
  }
}

export const buildRuntimeGuardrailMessage = (latestUserQuery: string): ChatMessage => {
  const now = new Date().toISOString()
  const isTimeSensitive = TIMESENSITIVE_RE.test(latestUserQuery || '')

  const lines = [
    'Runtime context:',
    `- Current server time (UTC): ${now}`,
    '- Do not assume your pretraining knowledge is up-to-date for time-sensitive topics.',
    '- Do not fabricate or assert your provider/company identity unless explicitly provided in the system context.',
  ]

  if (isTimeSensitive) {
    lines.push('- If realtime data is unavailable, explicitly say data may be stale and ask for permission to run live lookup.')
  }

  return {
    role: 'system',
    content: lines.join('\n'),
  }
}

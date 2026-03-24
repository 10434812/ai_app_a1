import assert from 'node:assert/strict'
import test from 'node:test'

import {fetchRealtimeQuote} from '../services/realtimeQuoteService.ts'
import type {RealtimeIntentMatch} from '../services/realtimeIntentService.ts'

const withMockedFetch = async <T>(handler: typeof fetch, run: () => Promise<T>) => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = handler
  try {
    return await run()
  } finally {
    globalThis.fetch = originalFetch
  }
}

test('fetchRealtimeQuote normalizes fund quote shape', async () => {
  await withMockedFetch(
    (async (input: string | URL | Request) => {
      const url = String(input)
      if (url.includes('FundSearchAPI')) {
        return new Response(
          JSON.stringify({
            ErrCode: 0,
            Datas: [
              {
                CODE: '000961',
                NAME: '天弘沪深300ETF联接A',
              },
            ],
          }),
          {status: 200, headers: {'Content-Type': 'application/json'}},
        )
      }

      if (url.includes('fundgz.1234567.com.cn')) {
        return new Response(
          'jsonpgz({"fundcode":"000961","name":"天弘沪深300ETF联接A","jzrq":"2026-03-20","dwjz":"1.6181","gsz":"1.5799","gszzl":"-2.36","gztime":"2026-03-23 13:18"});',
          {status: 200, headers: {'Content-Type': 'application/javascript'}},
        )
      }

      throw new Error(`Unexpected url: ${url}`)
    }) as typeof fetch,
    async () => {
      const quote = await fetchRealtimeQuote({
        matched: true,
        kind: 'fund',
        target: '天弘沪深300基金净值',
        displayName: '天弘沪深300基金净值',
        confidence: 0.95,
        query: '天弘沪深300基金净值',
      } satisfies RealtimeIntentMatch)

      assert.equal(quote.kind, 'fund')
      assert.equal(quote.currency, 'CNY')
      assert.equal(quote.target, '000961')
      assert.equal(quote.displayName, '天弘沪深300ETF联接A')
      assert.equal(typeof quote.value, 'number')
      assert.equal(quote.value, 1.5799)
      assert.equal(quote.source, 'eastmoney')
      assert.ok(quote.timestamp)
      assert.equal(typeof quote.extra, 'object')
    },
  )
})

test('fetchRealtimeQuote normalizes domestic oil quote shape', async () => {
  await withMockedFetch(
    (async (input: string | URL | Request) => {
      const url = String(input)
      if (url.includes('api.03c3.cn/api/oilPrice')) {
        return new Response(
          JSON.stringify({
            code: 200,
            msg: 'ok',
            data: {
              '92': '7.69',
              '95': '8.19',
              '98': '9.12',
              '0': '7.28',
              area: '北京',
              date: '2026-03-23',
            },
          }),
          {status: 200, headers: {'Content-Type': 'application/json'}},
        )
      }

      throw new Error(`Unexpected url: ${url}`)
    }) as typeof fetch,
    async () => {
      const quote = await fetchRealtimeQuote({
        matched: true,
        kind: 'oil',
        target: 'CN_OIL_BEIJING',
        displayName: '国内油价（北京）',
        confidence: 0.96,
        query: '国内油价',
      } satisfies RealtimeIntentMatch)

      assert.equal(quote.kind, 'oil')
      assert.equal(quote.currency, 'CNY')
      assert.equal(quote.target, 'CN_OIL_BEIJING')
      assert.equal(quote.displayName, '国内油价（北京）')
      assert.equal(quote.value, 8.19)
      assert.equal(quote.source, 'api.03c3.cn')
      assert.equal(typeof quote.extra, 'object')
      assert.equal(quote.extra.area, '北京')
      assert.equal(quote.extra.fuel95, 8.19)
    },
  )
})

test('fetchRealtimeQuote normalizes shop gold quote shape', async () => {
  await withMockedFetch(
    (async (input: string | URL | Request) => {
      const url = String(input)
      if (url.includes('free.xwteam.cn/api/gold/brand')) {
        return new Response(
          JSON.stringify({
            code: 200,
            msg: '请求成功',
            data: [
              {brand: '周大福', goldPrice: '1001.0'},
              {brand: '老凤祥', goldPrice: '998.0'},
              {brand: '周生生', goldPrice: '1004.0'},
            ],
          }),
          {status: 200, headers: {'Content-Type': 'application/json'}},
        )
      }

      throw new Error(`Unexpected url: ${url}`)
    }) as typeof fetch,
    async () => {
      const quote = await fetchRealtimeQuote({
        matched: true,
        kind: 'gold',
        target: 'CN_SHOP_GOLD',
        displayName: '国内金店金价',
        confidence: 0.97,
        query: '今日金店金价',
      } satisfies RealtimeIntentMatch)

      assert.equal(quote.kind, 'gold')
      assert.equal(quote.currency, 'CNY')
      assert.equal(quote.target, 'CN_SHOP_GOLD')
      assert.equal(quote.source, 'free.xwteam.cn')
      assert.equal(quote.value, 1001)
      assert.equal(typeof quote.extra, 'object')
      assert.equal(Array.isArray(quote.extra.shopPrices), true)
      assert.equal((quote.extra.shopPrices as Array<{brand: string}>)[0]?.brand, '周大福')
    },
  )
})

test('fetchRealtimeQuote normalizes bank gold quote shape', async () => {
  await withMockedFetch(
    (async (input: string | URL | Request) => {
      const url = String(input)
      if (url.includes('v2.xxapi.cn/api/goldprice')) {
        return new Response(
          JSON.stringify({
            code: 200,
            msg: '数据请求成功',
            data: {
              bank_gold_bar_price: [
                {bank: '工商银行如意金条', price: '1020.39'},
                {bank: '中国银行金条', price: '1020.86'},
                {bank: '建设银行龙鼎金条', price: '1018.40'},
              ],
            },
          }),
          {status: 200, headers: {'Content-Type': 'application/json'}},
        )
      }

      throw new Error(`Unexpected url: ${url}`)
    }) as typeof fetch,
    async () => {
      const quote = await fetchRealtimeQuote({
        matched: true,
        kind: 'gold',
        target: 'CN_BANK_GOLD',
        displayName: '银行金条价格',
        confidence: 0.97,
        query: '银行金价',
      } satisfies RealtimeIntentMatch)

      assert.equal(quote.kind, 'gold')
      assert.equal(quote.currency, 'CNY')
      assert.equal(quote.target, 'CN_BANK_GOLD')
      assert.equal(quote.source, 'v2.xxapi.cn')
      assert.equal(quote.value, 1019.88)
      assert.equal(typeof quote.extra, 'object')
      assert.equal(Array.isArray(quote.extra.bankPrices), true)
      assert.equal((quote.extra.bankPrices as Array<{bank: string}>)[0]?.bank, '建设银行龙鼎金条')
    },
  )
})

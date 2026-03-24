import assert from 'node:assert/strict'
import test from 'node:test'

import {formatRealtimeAnswer} from '../services/realtimeAnswerFormatter.ts'

test('formatRealtimeAnswer renders stock quote details', () => {
  const result = formatRealtimeAnswer({
    kind: 'stock',
    target: '0700.HK',
    displayName: '腾讯控股',
    value: 432.18,
    currency: 'HKD',
    source: 'stooq',
    sourceUrl: 'https://stooq.com/q/l/?s=0700.hk&i=d',
    timestamp: '2026-03-23T06:20:53.000Z',
    extra: {
      open: 430.11,
      high: 435.22,
      low: 428.6,
      market: '港股',
    },
  })

  assert.match(result.title, /腾讯控股/)
  assert.match(result.content, /432\.18 HKD/)
  assert.match(result.content, /数据来源：stooq/i)
  assert.match(result.content, /更新时间：/)
  assert.match(result.content, /仅供参考/)
})

test('formatRealtimeAnswer renders domestic oil tier details', () => {
  const result = formatRealtimeAnswer({
    kind: 'oil',
    target: 'CN_OIL_BEIJING',
    displayName: '国内油价（北京）',
    value: 8.19,
    currency: 'CNY',
    source: 'api.03c3.cn',
    sourceUrl: 'https://api.03c3.cn/api/oilPrice?area=北京',
    timestamp: '2026-03-23T06:20:53.000Z',
    extra: {
      scope: 'domestic_retail',
      area: '北京',
      fuel92: 7.69,
      fuel95: 8.19,
      fuel98: 9.12,
      fuel0: 7.28,
      unit: 'CNY/L',
    },
  })

  assert.match(result.title, /国内油价/)
  assert.match(result.content, /92#/)
  assert.match(result.content, /95#/)
  assert.match(result.content, /数据来源：api\.03c3\.cn/)
})

test('formatRealtimeAnswer renders shop gold details', () => {
  const result = formatRealtimeAnswer({
    kind: 'gold',
    target: 'CN_SHOP_GOLD',
    displayName: '国内金店金价',
    value: 1001.0,
    currency: 'CNY',
    source: 'free.xwteam.cn',
    sourceUrl: 'https://free.xwteam.cn/api/gold/brand',
    timestamp: '2026-03-23T06:20:53.000Z',
    extra: {
      scope: 'cn_shop_gold',
      shopPrices: [
        {brand: '周大福', goldPrice: 1001},
        {brand: '周生生', goldPrice: 1004},
      ],
      unit: 'CNY/g',
    },
  })

  assert.match(result.title, /金店金价/)
  assert.match(result.content, /周大福/)
  assert.match(result.content, /周生生/)
  assert.match(result.content, /1,?001\.00 CNY\/g/)
})

test('formatRealtimeAnswer renders bank gold details', () => {
  const result = formatRealtimeAnswer({
    kind: 'gold',
    target: 'CN_BANK_GOLD',
    displayName: '银行金条价格',
    value: 1019.88,
    currency: 'CNY',
    source: 'v2.xxapi.cn',
    sourceUrl: 'https://v2.xxapi.cn/api/goldprice',
    timestamp: '2026-03-23T06:20:53.000Z',
    extra: {
      scope: 'cn_bank_gold',
      bankPrices: [
        {bank: '工商银行如意金条', price: 1020.39},
        {bank: '中国银行金条', price: 1020.86},
      ],
      unit: 'CNY/g',
    },
  })

  assert.match(result.title, /银行金价/)
  assert.match(result.content, /工商银行如意金条/)
  assert.match(result.content, /中国银行金条/)
  assert.match(result.content, /1,?019\.88 CNY\/g/)
})

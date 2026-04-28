import assert from 'node:assert/strict';
import test from 'node:test';
import { detectRealtimeIntent } from "../services/realtimeIntentService.js";
test('detectRealtimeIntent matches gold queries', () => {
    const result = detectRealtimeIntent('今日金价');
    assert.equal(result.matched, true);
    assert.equal(result.kind, 'gold');
    assert.equal(result.displayName, '国际金价');
});
test('detectRealtimeIntent matches oil queries', () => {
    const result = detectRealtimeIntent('今日油价');
    assert.equal(result.matched, true);
    assert.equal(result.kind, 'oil');
    assert.equal(result.displayName, '国际原油');
});
test('detectRealtimeIntent matches domestic oil scope queries', () => {
    const result = detectRealtimeIntent('国内油价');
    assert.equal(result.matched, true);
    assert.equal(result.kind, 'oil');
    assert.equal(result.target, 'CN_OIL_BEIJING');
    assert.equal(result.displayName, '国内油价（北京）');
});
test('detectRealtimeIntent matches stock queries', () => {
    const result = detectRealtimeIntent('腾讯股价');
    assert.equal(result.matched, true);
    assert.equal(result.kind, 'stock');
    assert.match(result.target || '', /0700\.HK/i);
});
test('detectRealtimeIntent matches fund queries', () => {
    const result = detectRealtimeIntent('天弘沪深300基金净值');
    assert.equal(result.matched, true);
    assert.equal(result.kind, 'fund');
    assert.ok(result.displayName.includes('天弘沪深300'));
});
test('detectRealtimeIntent matches forex queries', () => {
    const result = detectRealtimeIntent('美元兑人民币');
    assert.equal(result.matched, true);
    assert.equal(result.kind, 'forex');
    assert.equal(result.target, 'USD/CNY');
});
test('detectRealtimeIntent matches crypto queries', () => {
    const result = detectRealtimeIntent('比特币现在多少钱');
    assert.equal(result.matched, true);
    assert.equal(result.kind, 'crypto');
    assert.equal(result.target, 'bitcoin');
});
test('detectRealtimeIntent matches shop gold scope queries', () => {
    const result = detectRealtimeIntent('今日金店金价');
    assert.equal(result.matched, true);
    assert.equal(result.kind, 'gold');
    assert.equal(result.target, 'CN_SHOP_GOLD');
    assert.equal(result.displayName, '国内金店金价');
});
test('detectRealtimeIntent matches bank gold scope queries', () => {
    const result = detectRealtimeIntent('银行金价');
    assert.equal(result.matched, true);
    assert.equal(result.kind, 'gold');
    assert.equal(result.target, 'CN_BANK_GOLD');
    assert.equal(result.displayName, '银行金条价格');
});
test('detectRealtimeIntent ignores non realtime queries', () => {
    const result = detectRealtimeIntent('帮我写一封邮件');
    assert.equal(result.matched, false);
    assert.equal(result.kind, null);
    assert.equal(result.target, null);
});

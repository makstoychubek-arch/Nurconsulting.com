import assert from 'node:assert/strict';
import { buildAdsRows, chunk, num } from './ozon-ads.ts';

assert.equal(num('1917,51'), 1917.51); assert.equal(num('8 337,00'), 8337); assert.equal(num(undefined), 0); assert.equal(num('abc'), 0);
const rows = buildAdsRows('cab', [
    { id: '15362091', title: 'Продвижение в поиске', date: '2026-11-01', views: '6875', clicks: '367', moneySpent: '1917,51', orders: '2', ordersMoney: '8337,00' },
    { id: '', date: '2026-11-01' },
    { id: '1', date: 'вчера' },
], '2026-11-14T00:00:00Z');
assert.equal(rows.length, 1);
assert.deepEqual(rows[0], { cabinet_id: 'cab', d: '2026-11-01', campaign_id: '15362091', title: 'Продвижение в поиске', impressions: 6875, clicks: 367, spend: 1917.51, orders: 2, orders_sum: 8337, synced_at: '2026-11-14T00:00:00Z' });
assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
console.log('ozon-ads_test: ok');

// Смена фото по показам: квота, потолок по времени, последнее окно.
import assert from 'node:assert/strict';
import { decideRotation, isFinalWindow, quotaOf, windowImpressions } from './ab-quota.ts';

const ads = { sources: { ads: true }, campaigns: [101] };
assert.equal(quotaOf({ settings: { ...ads } }), 0, 'без флага крутим по времени');
assert.equal(quotaOf({ settings: { ...ads, rotateByImpressions: true } }), 2000, 'по умолчанию 2000');
assert.equal(quotaOf({ settings: { ...ads, rotateByImpressions: true, minImpressions: 1500 } }), 1500);
assert.equal(quotaOf({ settings: { sources: { ads: false }, campaigns: [101], rotateByImpressions: true } }), 0, 'без рекламы показов нет');
assert.equal(quotaOf({ settings: { sources: { ads: true }, campaigns: [], rotateByImpressions: true } }), 0, 'без кампаний показов нет');

const m = 60_000;
assert.deepEqual(decideRotation({ quota: 2000, intervalMin: 30, elapsedMs: 20 * m, windowImpressions: 2000 }), { due: true, reason: 'quota' });
assert.deepEqual(decideRotation({ quota: 2000, intervalMin: 30, elapsedMs: 40 * m, windowImpressions: 1500 }), { due: false, reason: 'wait' }, '30 минут больше не повод менять');
assert.deepEqual(decideRotation({ quota: 2000, intervalMin: 30, elapsedMs: 361 * m, windowImpressions: 0 }), { due: true, reason: 'cap' }, 'без показов не висим вечно');
assert.equal(decideRotation({ quota: 2000, intervalMin: 600, elapsedMs: 400 * m, windowImpressions: 0 }).due, false, 'потолок не меньше интервала');

// замер раз в 10 минут: если следующий перелёт больше нынешнего недобора, меняем сразу
assert.equal(decideRotation({ quota: 1000, intervalMin: 30, elapsedMs: 30 * m, windowImpressions: 940, stepImpressions: 458 }).due, true, '940 ближе к 1000, чем ~1400');
assert.equal(decideRotation({ quota: 1000, intervalMin: 30, elapsedMs: 20 * m, windowImpressions: 482, stepImpressions: 482 }).due, false, 'до квоты ещё два замера');
assert.equal(decideRotation({ quota: 1000, intervalMin: 30, elapsedMs: 20 * m, windowImpressions: 700, stepImpressions: 300 }).due, false, '700+300 = ровно 1000: ждём следующего замера');

const v = (n: number) => ({ impressions: n });
assert.equal(isFinalWindow([v(2100), v(10)], 1, 2000, 2000, true), true, 'остальные набрали и это набрало: финал');
assert.equal(isFinalWindow([v(1500), v(10)], 1, 2000, 2000, true), false, 'другое фото ещё не добрало');
assert.equal(isFinalWindow([v(2100), v(10)], 1, 2000, 2000, false), false, 'автостоп выключен: крутим дальше');
assert.equal(isFinalWindow([v(2100), v(10)], 1, 900, 2000, true), false, 'окно ещё не набрало');

// показы окна: прирост между замерами
const rows = [
    { campaign_id: 1, taken_at: '2026-10-06T10:00:00Z', stat_date: '2026-10-06', views: 100, clicks: 0, atbs: 0, orders: 0, spend: 0 },
    { campaign_id: 1, taken_at: '2026-10-06T10:10:00Z', stat_date: '2026-10-06', views: 600, clicks: 0, atbs: 0, orders: 0, spend: 0 },
    { campaign_id: 1, taken_at: '2026-10-06T10:20:00Z', stat_date: '2026-10-06', views: 1600, clicks: 0, atbs: 0, orders: 0, spend: 0 },
];
const q: any = { select: () => q, eq: () => q, gte: () => q, order: () => Promise.resolve({ data: rows }) };
const admin = { from: () => q };
const imps = await windowImpressions(admin, { id: 't' }, new Date('2026-10-06T10:10:00Z'), new Date('2026-10-06T10:20:00Z'));
assert.equal(Math.round(imps), 1000, 'окно с 10:10 до 10:20 получило 1000 показов');
console.log('ab-quota_test: ok');

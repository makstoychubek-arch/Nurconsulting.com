const assert = require('node:assert/strict');
globalThis.document = { addEventListener() {}, getElementById() { return null; } };
require('./nr-compare.js');
const f = globalThis.NrCompare._funnel;

// Воронка за период: суммы и конверсии шагов
const r = f([
    { impressions: 1000, clicks: 50, basket_count: 10, funnel_orders: 4, sales_count: 3, orders_sum: 12000, competitor_ctr: 8, competitor_basket: 15, competitor_cro: 30 },
    { impressions: 1000, clicks: 50, basket_count: 10, orders_count: 4, sales_count: 3, orders_sum: 12000, competitor_ctr: 8, competitor_basket: 15, competitor_cro: 30 },
]);
assert.equal(r.total.imp, 2000);
assert.equal(r.total.ord, 8, 'нет funnel_orders: берём orders_count');
assert.equal(r.total.rev, 24000);
assert.equal(r.steps[0].ours, 5, 'CTR 100 / 2000');
assert.equal(r.steps[1].ours, 20);
assert.equal(r.steps[2].ours, 40);
assert.equal(r.steps[3].ours, 75);
assert.equal(r.steps[0].gap, -3);
assert.equal(r.steps[2].gap, 10, 'в заказ мы лучше конкурентов');
assert.equal(r.worst.id, 'ctr', 'главная утечка: шаг с самым большим относительным отставанием');
assert.equal(r.steps[3].gap, undefined, 'по выкупу данных конкурентов нет');

// Пусто: без деления на ноль и без выдуманной утечки
const z = f([]);
assert.equal(z.steps[0].ours, null);
assert.equal(z.worst, null);
// Конкурентов нет: утечку не называем
assert.equal(f([{ impressions: 100, clicks: 1 }]).worst, null);
console.log('nr-compare_test: ok');

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
assert.equal(r.realImp, true);
assert.equal(r.steps[0].ours, 5, 'CTR 100 / 2000');
assert.equal(r.steps[1].ours, 20);
assert.equal(r.steps[2].ours, 40);
assert.equal(r.steps[3].ours, 75);
assert.equal(r.steps[0].gap, -3);
assert.equal(r.steps[2].gap, 10, 'в заказ мы лучше конкурентов');
assert.equal(r.worst.id, 'ctr', 'главная утечка: шаг с самым большим относительным отставанием');
assert.equal(r.steps[3].gap, undefined, 'по выкупу данных конкурентов нет');

// В базе показы равны переходам в карточку: шага «показы → переходы» нет, воронка начинается с переходов
const same = f([{ impressions: 200, clicks: 200, basket_count: 20, funnel_orders: 4, sales_count: 2 }]);
assert.equal(same.realImp, false);
assert.deepEqual(same.steps.map((x) => x.id), ['cart', 'order', 'buyout']);
// Нет данных конкурентов: эталон это медиана соседей, главная утечка находится по ним
const me = f([{ impressions: 100, clicks: 100, basket_count: 5, funnel_orders: 2, sales_count: 1 }]);
const peers = [f([{ clicks: 100, impressions: 100, basket_count: 20, funnel_orders: 8, sales_count: 4 }]), f([{ clicks: 100, impressions: 100, basket_count: 22, funnel_orders: 8, sales_count: 4 }]), f([{ clicks: 100, impressions: 100, basket_count: 18, funnel_orders: 8, sales_count: 4 }])];
const wb = globalThis.NrCompare._withBench(me, peers, 'медиана склейки');
assert.equal(wb.steps[0].rival, 20, 'медиана конверсии в корзину у соседей');
assert.equal(wb.worst.id, 'cart', 'у нас корзина 5% против 20% у соседей');
assert.equal(wb.steps[0].bench, 'медиана склейки');
assert.equal(globalThis.NrCompare._withBench(me, [], '').worst, null, 'нет соседей и конкурентов: утечку не выдумываем');

// Пусто: без деления на ноль и без выдуманной утечки
const z = f([]);
assert.equal(z.steps[0].ours, null);
assert.equal(z.worst, null);
// Конкурентов нет: утечку не называем
assert.equal(f([{ impressions: 100, clicks: 1 }]).worst, null);
// Сводка по конкурентам: медиана похожих, лидер, наше место
const rs = globalThis.NrCompare._rivalStats({ rev: 300, similar: [{ nm: 1, rev: 100 }, { nm: 2, rev: 500 }, { nm: 3, rev: 900 }], top: [{ nm: 3, rev: 900 }, { nm: 4, rev: 2000 }] });
assert.equal(rs.median, 500);
assert.equal(rs.leader, 2000);
assert.equal(rs.place, 4, 'трое продают больше нас; один артикул в обоих списках считается один раз');
assert.equal(rs.of, 5);
assert.equal(globalThis.NrCompare._rivalStats(null).place, null, 'нет данных: место не выдумываем');
assert.equal(globalThis.NrCompare._wbHost(100), 1);
assert.equal(globalThis.NrCompare._wbHost(2000), 13);
assert.equal(globalThis.NrCompare._wbHost(12187), 44, 'артикул 1218799336 (vol 12187): корзина 44, как в РНП');
assert.equal(globalThis.NrCompare._wbHost(2962), 18);
// Задание на слайды: приоритет кадров по главной утечке, признаки из СЕО
const seo = { itog: { keep: 'Супер: свитер женский оверсайз, свитер вязаный\nПризнаки с фото: оверсайз, вязаный трикотаж, вырез-лодочка' } };
const b = globalThis.NrCompare._briefs({ id: 'ctr' }, seo, '');
assert.equal(b.length, 8);
assert.deepEqual(b.filter((x) => x.hot).map((x) => x.n), [1], 'утечка «показы → клики»: чинит обложка');
assert.ok(b[0].text.includes('свитер женский оверсайз'), 'название на обложке из топ-запроса СЕО');
assert.ok(b[1].text.includes('оверсайз, вязаный трикотаж, вырез-лодочка'), 'иконки из «Признаки с фото»');
assert.deepEqual(globalThis.NrCompare._briefs({ id: 'cart' }, null, '').filter((x) => x.hot).map((x) => x.n), [2, 3, 4, 5]);
assert.equal(globalThis.NrCompare._briefs(null, null, '').filter((x) => x.hot).length, 0, 'утечки нет: приоритетов нет');
console.log('nr-compare_test: ok');

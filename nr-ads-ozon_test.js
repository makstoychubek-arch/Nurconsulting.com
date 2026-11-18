const assert = require('assert');
const M = require('./nr-ads-ozon.js');
const a = M.agg([
    { d: '2026-11-13', campaign_id: '1', title: 'A', impressions: 1000, clicks: 50, spend: 300, orders: 3, orders_sum: 3000 },
    { d: '2026-11-14', campaign_id: '1', title: 'A', impressions: 500, clicks: 25, spend: 100, orders: 1, orders_sum: 1000 },
    { d: '2026-11-14', campaign_id: '2', title: 'B', impressions: 10, clicks: 0, spend: 0, orders: 0, orders_sum: 0 },
    { d: '2026-11-14', campaign_id: '', title: 'без номера', spend: 999 },
]);
assert.strictEqual(a.list.length, 2, 'строка без номера кампании пропущена');
assert.strictEqual(a.list[0].id, '1', 'кампании по убыванию расхода');
assert.deepStrictEqual([a.total.spend, a.total.impressions, a.total.clicks, a.total.orders, a.total.revenue], [400, 1510, 75, 4, 4000]);
assert.ok(Math.abs(a.total.drr - 10) < 1e-9 && Math.abs(a.total.roas - 10) < 1e-9, 'ДРР = расход / выручка, ROAS = выручка / расход');
assert.ok(Math.abs(a.list[0].ctr - 5) < 1e-9 && Math.abs(a.list[0].cpc - 400 / 75) < 1e-9, 'CTR и CPC по кампании');
assert.ok(isNaN(a.list[1].cpc) && isNaN(a.list[1].drr), 'без кликов и выручки CPC и ДРР не считаются');
const h = M.html(a, { range: '01.11 – 16.11', when: '' });
assert.ok(h.includes('РЕКЛАМА OZON') && h.includes('<b>A</b>') && h.includes('ДРР') && /10,0%/.test(h), 'разметка с кампаниями и ДРР 10,0%');
assert.ok(M.html(M.agg([]), { range: 'x' }).includes('Нет данных рекламы Ozon'), 'пустой период: понятная заглушка');
console.log('nr-ads-ozon_test: ok');

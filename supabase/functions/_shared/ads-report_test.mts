import assert from 'node:assert/strict';
import { addStat, buildAdCard, emptyStat, hasAds } from './ads-report.ts';

// Уркунбаев, 11 ноября 2026 (реальные цифры базы): расход 2 060, 56 корзин, 15 заказов, 207 кликов, 6 960 показов, выручка РК 59 866
let day = emptyStat();
day = addStat(day, { spend: '1500.5', carts: 30, orders: 9, clicks: 120, impressions: 4000, revenue: '36000' });
day = addStat(day, { spend: 559.5, carts: 26, orders: 6, clicks: 87, impressions: 2960, revenue: 23866 });
const prev = addStat(emptyStat(), { spend: 3256, carts: 54, orders: 16, clicks: 294, impressions: 13762, revenue: 66034 });
const m = buildAdCard(day, prev);
assert.equal(m.spend, 2060);
assert.equal(m.carts, 56);
assert.equal(m.cartCost, 37, 'цена корзины 2060 / 56');
assert.equal(m.orderCost, 137, 'цена заказа 2060 / 15');
assert.equal(m.clickCost, 10);
assert.equal(m.ctr, 3);
assert.equal(m.drr, 3.4, 'ДРР от выручки РК');
assert.equal(m.spendDeltaPct, -36.7, 'расход к предыдущему дню');
assert.equal(m.revenue, 59866);
assert.ok(hasAds(m));

// Нет данных предыдущего дня: динамики нет
assert.equal(buildAdCard(day, null).spendDeltaPct, null);
assert.equal(buildAdCard(day, emptyStat()).spendDeltaPct, null, 'вчера расхода не было: процент не считаем');

// Пустой день: все цены пустые, не ноль и не деление на ноль
const z = buildAdCard(emptyStat(), prev);
assert.equal(z.cartCost, null);
assert.equal(z.orderCost, null);
assert.equal(z.drr, null);
assert.equal(z.ctr, null);
assert.equal(hasAds(z), false);
assert.equal(z.spendDeltaPct, -100);

// Показы есть, расхода нет (бесплатный охват): карточку всё равно шлём
assert.ok(hasAds(buildAdCard(addStat(emptyStat(), { impressions: 500 }), null)));

console.log('ads-report: ok');

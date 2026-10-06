// Автопилот рекламы: цели, решения по ставке, экономика артикула.
import assert from 'node:assert/strict';
import { breakEvenCpo, DEFAULTS, decideBid, economicsFromRows, nmStatsFromRows, targetCpo, roundBid } from './ad-autopilot.ts';

const econ = { profitPerSale: 2640, buyout: 0.36, pricePerOrder: 5023 }; // укороч коричневый
assert.equal(Math.round(breakEvenCpo(econ)), 950);
assert.equal(Math.round(targetCpo(econ, DEFAULTS)), 665, 'доля 0,7 от 950 строже ДРР 15% (753)');
const cheap = { profitPerSale: 20000, buyout: 0.4, pricePerOrder: 1000 };
assert.equal(Math.round(targetCpo(cheap, DEFAULTS)), 150, 'ДРР 15% от цены заказа ограничивает цель');
assert.equal(targetCpo({ profitPerSale: -100, buyout: 0.3, pricePerOrder: 3000 }, DEFAULTS), 0, 'без прибыли цель нулевая');

const st = (spend: number, orders: number, clicks = 200) => ({ spend, orders, clicks, views: 5000 });
// заказ вдвое дешевле цели: поднимаем на шаг 10%
let d = decideBid(st(30000, 100), econ, 800, DEFAULTS);   // CPO 300, цель 665
assert.equal(d.action, 'raise'); assert.equal(d.newBid, 880);
// в норме: оставляем
assert.equal(decideBid(st(60000, 100), econ, 800, DEFAULTS).action, 'hold');     // 600
// выше цели: снижаем на шаг, сильно выше: на два шага
d = decideBid(st(80000, 100), econ, 800, DEFAULTS); assert.equal(d.action, 'lower'); assert.equal(d.newBid, 720);   // 800
d = decideBid(st(120000, 100), econ, 800, DEFAULTS); assert.equal(d.action, 'lower'); assert.equal(d.newBid, 640);  // 1200
// границы ставок
assert.equal(decideBid(st(30000, 100), econ, 1600, DEFAULTS).action, 'hold', 'потолок ставки');
assert.equal(decideBid(st(120000, 100), econ, 300, DEFAULTS).action, 'hold', 'минимум ставки');
assert.equal(decideBid(st(120000, 100), econ, 320, DEFAULTS).newBid, 300, 'не уходим ниже минимума');
// мало данных
assert.equal(decideBid(st(30000, 100, 20), econ, 800, DEFAULTS).action, 'hold', 'мало кликов');
assert.equal(decideBid(st(300, 0, 10), econ, 800, DEFAULTS).action, 'hold', 'потратили мало и заказов нет: ждём');
d = decideBid(st(1200, 0, 100), econ, 800, DEFAULTS); assert.equal(d.action, 'lower', 'расход без заказов'); assert.equal(d.newBid, 640);
// товар без прибыли
assert.equal(decideBid(st(100, 10), { profitPerSale: -5, buyout: 0.3, pricePerOrder: 3000 }, 800, DEFAULTS).action, 'hold');
assert.equal(roundBid(884), 880);

// экономика из строк РНП
const rows = Array.from({ length: 10 }, () => ({ sales_count: 5, orders_count: 14, to_transfer: 19000, storage_sum: 120, orders_sum: 70000 }));
const e = economicsFromRows(rows, 1150)!;
assert.equal(Math.round(e.profitPerSale), Math.round((190000 - 50 * 1150 - 1200) / 50));
assert.ok(Math.abs(e.buyout - 50 / 140) < 1e-9);
assert.equal(economicsFromRows([{ sales_count: 2, orders_count: 3 }], 1150), null, 'мало данных');
assert.equal(economicsFromRows(rows, 0), null, 'нет себестоимости');

// статистика по артикулам из дневных строк
const m = nmStatsFromRows([
    { campaign_id: 7, data: { apps: [{ nms: [{ nmId: 1, sum: 100, orders: 2, clicks: 30, views: 900 }, { nmId: 2, sum: 50, orders: 0, clicks: 10, views: 300 }] }] } },
    { campaign_id: 7, data: { apps: [{ nms: [{ nmId: 1, sum: 40, orders: 1, clicks: 12, views: 400 }] }] } },
    { campaign_id: 8, data: null },
]);
assert.deepEqual(m.get('7:1'), { spend: 140, orders: 3, clicks: 42, views: 1300 });
assert.equal(m.get('7:2')!.spend, 50);
console.log('ad-autopilot_test: ok');

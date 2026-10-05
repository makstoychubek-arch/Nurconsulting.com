'use strict';
const assert = require('assert');
const fs = require('fs');
const C = require('./giveaway-calc.js');

// Строка 4 рабочей таблицы «КАЛЬКУЛЯТОР1»: цена 1800, СПП 8,8%, комиссия 24,5%, логистика 416, кэшбэк 100%, 100 шт, себес 832
const base = { qty: 100, cost: 832, price: 1800, spp: 8.8, commission: 24.5, logistics: 416, tax: 0, cashback: 100 };
const r = C.calcRow(base, { withCost: false });
assert.ok(Math.abs(r.priceSpp - 1641.6) < 1e-9, 'цена с СПП');
assert.ok(Math.abs(r.commissionRub - 441) < 1e-9, 'комиссия, руб');
assert.ok(Math.abs(r.cashbackRub - 1641.6) < 1e-9, 'кэшбэк = цена с СПП × %');
assert.ok(Math.abs(r.perUnit - 943) < 1e-9, 'получаем с ВБ за шт (в таблице 942,98 — там налог 0,02 руб.)');
assert.ok(Math.abs(r.netPerUnit - (943 - 1641.6)) < 1e-9, 'расход на кэшбэк');
assert.ok(Math.abs(r.toTransfer - 164160) < 1e-6, 'к переводу = 164 160 как в таблице');
assert.ok(Math.abs(r.totalFromWb - 94300) < 1e-6, 'получаем с ВБ общ ≈ 94 298 в таблице');
assert.ok(Math.abs(r.totalNet - (94300 - 164160)) < 1e-6, 'чистый расход ≈ −69 862 в таблице');

// Второй блок таблицы — с минусом себестоимости (строка 11: СПП 9%, комиссия 25%, 150 шт)
const r2 = C.calcRow({ qty: 150, cost: 832, price: 1800, spp: 9, commission: 25, logistics: 416, tax: 0, cashback: 100 }, { withCost: true });
assert.ok(Math.abs(r2.cashbackRub - 1638) < 1e-9);
assert.ok(Math.abs(r2.perUnit - 934) < 1e-9);
assert.ok(Math.abs(r2.netPerUnit - (934 - 1638 - 832)) < 1e-9, 'минус себестоимость: −1536 (в таблице −1536,02)');
assert.ok(Math.abs(r2.toTransfer - 245700) < 1e-6, 'к переводу 245 700 как в таблице');

// Налог — процент от цены без СПП
assert.ok(Math.abs(C.calcRow({ ...base, tax: 2 }, { withCost: false }).taxRub - 36) < 1e-9);

// Итоги
const t = C.calcTotals([base, { qty: 150, cost: 832, price: 1800, spp: 9, commission: 25, logistics: 416, tax: 0, cashback: 100 }], { withCost: false });
assert.ok(Math.abs(t.toTransfer - (164160 + 245700)) < 1e-6);

// Подсказка из данных кабинета
const s = C.suggestFromDaily([
    { orders_count: 10, orders_sum: 18000, spp_pct: 9, commission_pct: 24, logistics_per_unit: 400 },
    { orders_count: 10, orders_sum: 20000, spp_pct: 11, commission_pct: 26, logistics_per_unit: 420 },
], { cost_price: 832 });
assert.deepStrictEqual(s, { price: 1900, spp: 10, commission: 25, logistics: 410, cost: 832 });

// Кнопка справа вверху в Раздачах
assert.ok(fs.readFileSync(__dirname + '/giveaways.js', 'utf8').includes('data-act="calc"'), 'ИИ-кнопка калькулятора в панели Раздач');
assert.ok(/giveaway-calc(\.[0-9a-f]+\.min)?\.js/.test(fs.readFileSync(__dirname + '/dashboard.html', 'utf8')), 'калькулятор подключён');
console.log('giveaway_calc_test: ok');

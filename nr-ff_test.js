const assert = require('assert');
const R = require('./fbs-rates.js'); // addDays и пр. не нужны, но модуль глобальный в браузере
const T = require('./ff-terms.js');
const { compute } = require('./nr-ff.js');
const terms = [
    { ff_name: 'A', kind: 'ship', value: 50, date_from: '2026-09-15', date_to: '2026-10-09' },
    { ff_name: 'A', kind: 'ship', value: 70, date_from: '2026-10-10', date_to: null },
    { ff_name: 'B', kind: 'ship', value: 30, date_from: '2026-09-01', date_to: null },
    { ff_name: 'A', kind: 'storage', value: 0.5, daily_cap: 100, date_from: '2026-10-10', date_to: null },
    { ff_name: 'B', kind: 'storage', value: 1, daily_cap: null, date_from: '2026-10-10', date_to: null },
];
// товар 1: 75% на A, 25% на B; товар 2 — только на B; товар 3 — нигде
const shares = { 1: [{ k: 'A', w: 0.75 }, { k: 'B', w: 0.25 }], 2: [{ k: 'B', w: 1 }] };
const orders = [{ nm_id: 1, d: '2026-10-09', orders_fbs: 4 }, { nm_id: 1, d: '2026-10-10', orders_fbs: 4 }, { nm_id: 2, d: '2026-10-10', orders_fbs: 10 }, { nm_id: 3, d: '2026-10-11', orders_fbs: 5 }];
const adj = [{ kind: 'swap', amount: 100, ff_name: 'A' }, { kind: 'cancel', amount: 40, ff_name: 'B' }, { kind: 'swap', amount: 7, ff_name: null }];
const stock = { daily: { '2026-10-10': { 1: 200, 2: 100 }, '2026-10-11': { 1: 1000, 2: 100 } }, snapshot: { 1: 400, 2: 100 } };
const t = compute(orders, adj, '2026-10-01', '2026-10-12', '2026-10-12', shares, stock, terms);
// Отправка A: 09.10: 4×0.75×50=150; 10.10: 4×0.75×70=210 → 360. B: 4×0.25×30 + 4×0.25×30 + 10×30 = 30+30+300=360
assert.strictEqual(Math.round(t.byFf.A.ship), 360); assert.strictEqual(Math.round(t.byFf.B.ship), 360);
// товар 3 без ФФ — 5 заказов без цены
assert.strictEqual(t.byFf.none.missing, 5);
// Хранение A (0.5 ₽/шт, лимит 100): 10.10: 200×.75=150×.5=75; 11.10: 750×.5=375→лимит 100; 12.10 (снимок 400×.75=300×.5=150→100) → 275
assert.strictEqual(Math.round(t.byFf.A.storage), 275);
// Хранение B (1 ₽/шт без лимита): 10.10: 50+100=150; 11.10: 250+100=350; 12.10: 100+100=200 → 700
assert.strictEqual(Math.round(t.byFf.B.storage), 700);
assert.strictEqual(Math.round(t.byFf.A.payable), 360 + 275 - 100);
assert.strictEqual(Math.round(t.byFf.B.payable), 360 + 700 - 40);
assert.ok(Math.abs(t.payable - (t.byFf.A.payable + t.byFf.B.payable + t.byFf.none.payable)) < 1e-6);
// рубли, число отправок и дни хранения (карточка «Фулфилмент»)
assert.strictEqual(Math.round(t.byFf.A.shipRub), 360); assert.strictEqual(Math.round(t.byFf.A.shipCnt), 6);
assert.strictEqual(t.byFf.A.storageDays, 3); assert.strictEqual(t.storageDays, 3, 'дни хранения общие считаются без повторов');
assert.strictEqual(Math.round(t.byFf.A.payableRub), 360 + 275 - 100);
// курс 1,04: сом = ₽ × 1,04, рубли без курса
const fx2 = compute([{ nm_id: 2, d: '2026-10-10', orders_fbs: 10 }], [], '2026-10-10', '2026-10-10', '2026-10-12', { 2: [{ k: 'B', w: 1 }] }, { daily: {}, snapshot: {} }, [{ ff_name: 'B', kind: 'ship', value: 150, date_from: '2026-10-09', date_to: null }], null, { '2026-10-10': 1.04 });
assert.strictEqual(Math.round(fx2.shipRub), 1500); assert.strictEqual(Math.round(fx2.ship), 1560);
// цена 0 — заказы не считаются отправками (период до начала работы с ФФ)
const z = compute([{ nm_id: 2, d: '2026-10-05', orders_fbs: 7 }], [], '2026-10-05', '2026-10-05', '2026-10-12', { 2: [{ k: 'B', w: 1 }] }, { daily: {}, snapshot: {} }, [{ ff_name: 'B', kind: 'ship', value: 0, date_from: '2026-01-01', date_to: '2026-10-08' }]);
assert.strictEqual(z.shipCnt, 0); assert.strictEqual(z.missing, 0);
// точные заказы WB важнее остатков: товар 1 в день 10.10 целиком ушёл на B (цена 30), не 75/25
const oi = T.ordersIndex([{ nm_id: 1, order_date: '2026-10-10', ff_name: 'B' }, { nm_id: 1, order_date: '2026-10-10', ff_name: 'B' }]);
const te = compute([{ nm_id: 1, d: '2026-10-10', orders_fbs: 4 }], [], '2026-10-10', '2026-10-10', '2026-10-12', shares, { daily: {}, snapshot: {} }, terms, oi);
assert.strictEqual(Math.round(te.byFf.B.ship), 120); assert.ok(!te.byFf.A);
// тариф в ₽: курс ФФ 1,06 (хранение B 1 ₽ → 1,06 сом); у A курс НБКР 1,04 из таблицы
const fxT = [{ ff_name: 'B', kind: 'ship', value: 50, fx_rate: 1.06, date_from: '2026-09-01', date_to: null }, { ff_name: 'A', kind: 'ship', value: 50, fx_rate: null, date_from: '2026-09-01', date_to: null }];
const fx = compute([{ nm_id: 2, d: '2026-10-10', orders_fbs: 10 }, { nm_id: 9, d: '2026-10-10', orders_fbs: 10 }], [], '2026-10-10', '2026-10-10', '2026-10-12', { 2: [{ k: 'B', w: 1 }], 9: [{ k: 'A', w: 1 }] }, { daily: {}, snapshot: {} }, fxT, null, { '2026-10-10': 1.04 });
assert.strictEqual(Math.round(fx.byFf.B.ship), 530); assert.strictEqual(Math.round(fx.byFf.A.ship), 520);
// поставки: 57 коробов × 1100 ₽ × курс ФФ 1,06 = 66 462 сом; без цены за короб — в «нет цены»
const bx = compute([], [], '2026-10-01', '2026-10-12', '2026-10-12', {}, { daily: {}, snapshot: {} }, [{ ff_name: 'A', kind: 'box', value: 1100, fx_rate: 1.06, date_from: '2026-09-01', date_to: null }], null, {}, [{ ff: 'A', boxes: 57, d: '2026-10-05' }, { ff: 'B', boxes: 10, d: '2026-10-05' }]);
assert.strictEqual(Math.round(bx.byFf.A.box), 66462); assert.strictEqual(bx.byFf.B.boxMissing, 10);
assert.strictEqual(Math.round(bx.byFf.A.payable), 66462);
// будущее не считается
assert.strictEqual(compute([], [], '2026-10-20', '2026-10-31', '2026-10-12', shares, stock, terms).storage, 0);
// профит: ФФ готовой суммой за период
const W = require('./wb-formulas.js');
const row = { sale_dt: '2026-10-01', doc_type_name: 'Продажа', supplier_oper_name: 'Продажа', retail_price_withdisc_rub: 1000, retail_amount: 1000, ppvz_for_pay: 800, quantity: 1, nm_id: 1 };
const a = W.calculateMetrics([row], { ffPeriod: 0 }), b = W.calculateMetrics([row], { ffPeriod: 300 }), c = W.calculateMetrics([row], { ffPeriod: 300, ffInclude: false });
assert.strictEqual(a.profitFull - b.profitFull, 300);
assert.strictEqual(c.profitFull, a.profitFull);
console.log('nr-ff_test: ok');

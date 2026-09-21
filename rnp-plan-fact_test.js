'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const P = require('./rnp-plan-fact.js');

const weeks = P.weeksForMonth('2026-09');
assert.strictEqual(weeks.length, 5);
assert.strictEqual(weeks[0].start, '2026-08-31');
assert.strictEqual(weeks[0].end, '2026-09-06');
assert.deepStrictEqual(weeks[2].dates, [
    '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17',
    '2026-09-18', '2026-09-19', '2026-09-20',
]);
assert.strictEqual(weeks[3].start, '2026-09-21');
assert.strictEqual(weeks[4].start, '2026-09-28');
assert.strictEqual(weeks[4].end, '2026-10-04');

assert.strictEqual(P.ddmm('2026-08-31'), '31.08');
assert.strictEqual(P.mondayOnOrBefore('2026-09-01'), '2026-08-31');

assert.strictEqual(P.factOrders({ orders_count: 66, basket_count: 294, funnel_order_conv: 16 }), 47);
assert.strictEqual(P.factOrders({ orders_count: 17, cartCount: 157, cartToOrderConversion: 18 }), 28);
assert.strictEqual(P.factOrders({ orders_count: 8 }), 8);
assert.strictEqual(P.factOrders({ orders_count: 0 }), 0);
assert.strictEqual(P.factOrders(null), 0);

const nm = 409845462;
const dates = weeks[2].dates;
const daily = { [nm]: {} };
const facts = [10, 16, 11, 11, 14, 11, 17];
dates.forEach((d, i) => {
    daily[nm][d] = { date: d, orders_count: facts[i] + 20, basket_count: facts[i] * 10, funnel_order_conv: 10 };
});
daily[nm]['2026-09-14'].orders_count = 66;
daily[nm]['2026-09-14'].basket_count = 100;
daily[nm]['2026-09-14'].funnel_order_conv = 10;

const plans = {
    [nm]: {
        '2026-09-14': { planned_orders: 2, planned_sales: 16 },
    },
};

const model = P.build({
    monthKey: '2026-09',
    title: 'Общая РНП',
    articles: [{ nm_id: nm, name: 'пиджак_NEW_красный' }],
    daily,
    plans,
});
assert.strictEqual(model.weeks.length, 5);
const w3 = model.rows[0].weeks[2];
assert.deepStrictEqual(w3.facts, [10, 16, 11, 11, 14, 11, 17]);
assert.strictEqual(w3.factSum, 90);
assert.strictEqual(w3.dailyPlan, 2);
assert.strictEqual(w3.planSales, 16);
assert.strictEqual(w3.ratio, (90 / 16).toFixed(2));
assert.strictEqual(model.rows[0].weeks[0].ratio, '#DIV/0!');
assert.strictEqual(model.rows[0].name, 'пиджак_NEW_красный');

const html = P.tableHtml(model);
assert.ok(html.includes('ПЛАН/ФАКТ'));
assert.ok(html.includes('ПЛАН Заказов, по дням'));
assert.ok(html.includes('ФАКТ Заказов за неделю'));
assert.ok(html.includes('ПЛАН ПРОДАЖ, за неделю'));
assert.ok(html.includes('понедельник') && html.includes('воскресенье'));
assert.ok(html.includes('Артикул'));
assert.ok(html.includes('пиджак_NEW_красный'));
assert.ok(html.includes('409845462'));
assert.ok(html.includes('31.08') && html.includes('14.09'));
assert.ok(html.includes('#DIV/0!'));
assert.ok(html.includes('class="pf-sheet"'));
assert.ok(!html.includes('>0<') || html.includes('pf-total'), 'zero facts stay blank in SKU days');

const emptyDay = html.match(/пиджак_NEW_красный[\s\S]*?<\/tr>/)[0];
assert.ok(!/>0<\/td>/.test(emptyDay.split('pf-plan')[0]), 'week-1 zero facts are blank like Excel');

const sqlDash = fs.readFileSync(path.join(__dirname, 'supabase/migrations/20260921120000_dashboard_funnel_orders.sql'), 'utf8');
assert.ok(sqlDash.includes('rnp_daily_data') && sqlDash.includes('basket_count') && sqlDash.includes('funnel_order_conv'),
    'dashboard KPIs use WB funnel orders, not wb_orders row count');
assert.ok(sqlDash.includes('dashboard_summary') && sqlDash.includes('dashboard_plan_cabinets'));

const cron = fs.readFileSync(path.join(__dirname, 'supabase/migrations/20260921110000_rnp_funnel_lock_11_bishkek.sql'), 'utf8');
assert.ok(cron.includes("'0 5 * * *'") && cron.includes('funnel_only') && cron.includes('rnp-morning-funnel-zevina-11-bishkek'),
    'yesterday funnel locks at 11:00 Bishkek');

assert.strictEqual(P.cabinetKind('ИП Бейшеев А.Д.'), 'baza');
assert.strictEqual(P.cabinetKind('baza'), 'baza');
assert.strictEqual(P.cabinetKind('ИП Айзада'), 'elium');
assert.strictEqual(P.cabinetKind('Elium'), 'elium');
assert.strictEqual(P.cabinetKind('ОсОО «Айлин Стиль»'), 'ailin');
assert.strictEqual(P.cabinetKind('ИП Уркунбаев К.А.'), 'zevina');
assert.strictEqual(P.sheetMeta('ИП Уркунбаев К.А.').title, 'Общая РНП');
assert.strictEqual(P.sheetMeta('ИП Бейшеев А.Д.').title, 'ПЛАНФАКТ');
assert.strictEqual(P.sheetMeta('ИП Бейшеев А.Д.').skuHeader, '');
assert.strictEqual(P.sheetMeta('ИП Айзада').title, 'ПЛАНФАКТ');
assert.strictEqual(P.sheetMeta('ИП Айзада').skuHeader, 'SKU');

const bazaLive = [
    { nm_id: 1544472467, name: 'live-jacket' },
    { nm_id: 771571983, name: 'live-black' },
    { nm_id: 771499220, name: 'live-white' },
    { nm_id: 999000111, name: 'лишний' },
];
const bazaOrdered = P.applyCatalog(bazaLive, 'baza');
assert.strictEqual(bazaOrdered[0].nm_id, 771499220);
assert.strictEqual(bazaOrdered[0].name, 'Блузка-лапша-белый');
assert.strictEqual(bazaOrdered[1].nm_id, 771571983);
assert.strictEqual(bazaOrdered[1].name, 'Блузка-лапша-черный');
assert.strictEqual(bazaOrdered.length, 4);
assert.strictEqual(bazaOrdered[2].nm_id, 1544472467);
assert.strictEqual(bazaOrdered[2].name, 'Куртка-черный1');
assert.strictEqual(bazaOrdered[3].nm_id, 999000111);
assert.strictEqual(P.applyCatalog([{ nm_id: 771499220, name: 'x' }], 'baza').length, 1,
    'Excel SKUs missing from rnp_articles stay omitted');

const nmBaza = 771571983;
const week2 = weeks[1];
assert.strictEqual(week2.start, '2026-09-07');
const dailyBaza = { [nmBaza]: {} };
[0, 0, 0, 14, 20, 9, 11].forEach((n, i) => {
    if (!n) return;
    dailyBaza[nmBaza][week2.dates[i]] = { orders_count: n };
});
const plansBaza = {
    [nmBaza]: { '2026-09-07': { planned_orders: 7, planned_sales: 51 } },
};
const bazaModel = P.build({
    monthKey: '2026-09',
    cabinetName: 'ИП Бейшеев А.Д.',
    articles: [
        { nm_id: nmBaza, name: 'live-black' },
        { nm_id: 771499220, name: 'live-white' },
    ],
    daily: dailyBaza,
    plans: plansBaza,
});
assert.strictEqual(bazaModel.title, 'ПЛАНФАКТ');
assert.strictEqual(bazaModel.skuHeader, '');
assert.strictEqual(bazaModel.kind, 'baza');
assert.strictEqual(bazaModel.rows[0].nm_id, 771499220);
assert.strictEqual(bazaModel.rows[0].name, 'Блузка-лапша-белый');
assert.strictEqual(bazaModel.rows[1].nm_id, nmBaza);
assert.strictEqual(bazaModel.rows[1].name, 'Блузка-лапша-черный');
assert.deepStrictEqual(bazaModel.rows[1].weeks[1].facts, [0, 0, 0, 14, 20, 9, 11]);
assert.strictEqual(bazaModel.rows[1].weeks[1].factSum, 54);
assert.strictEqual(bazaModel.rows[1].weeks[1].dailyPlan, 7);
assert.strictEqual(bazaModel.rows[1].weeks[1].planSales, 51);
assert.strictEqual(bazaModel.rows[1].weeks[1].ratio, (54 / 51).toFixed(2));
const bazaHtml = P.tableHtml(bazaModel);
assert.ok(bazaHtml.includes('Блузка-лапша-черный') && bazaHtml.includes('771571983'));
assert.ok(!/>SKU</.test(bazaHtml), 'Baza C5 is empty like Excel');

const eliumModel = P.build({
    monthKey: '2026-09',
    cabinetName: 'ИП Айзада',
    articles: [
        { nm_id: 1171758874, name: 'wrong-bordo' },
        { nm_id: 851707556, name: 'wrong-suit' },
    ],
    daily: {},
    plans: {},
});
assert.strictEqual(eliumModel.title, 'ПЛАНФАКТ');
assert.strictEqual(eliumModel.skuHeader, 'SKU');
assert.strictEqual(eliumModel.kind, 'elium');
assert.strictEqual(eliumModel.rows[0].nm_id, 851707556);
assert.strictEqual(eliumModel.rows[0].name, 'Костюм-мужс-лето-черн');
assert.strictEqual(eliumModel.rows[1].nm_id, 1171758874);
assert.strictEqual(eliumModel.rows[1].name, 'жл-бордо');
const eliumHtml = P.tableHtml(eliumModel);
assert.ok(eliumHtml.includes('>SKU<'), 'Elium/AA C5 is SKU');
assert.ok(eliumHtml.includes('Костюм-мужс-лето-черн') && eliumHtml.includes('851707556'));

const rnp = fs.readFileSync(path.join(__dirname, 'rnp-module.js'), 'utf8');
assert.ok(rnp.includes('openPlanFact') && rnp.includes('План/факт'));
assert.ok(rnp.includes('async function openPlanFact'));
assert.ok(rnp.includes('_mergePlanFactRange') && rnp.includes('cabinetName: _cabinetName()'));
assert.ok(!rnp.includes("title: 'Общая РНП'"), 'title comes from sheetMeta per cabinet');
assert.ok(rnp.includes('if (implied != null) return implied'),
    'RNP funnel prefers Корзина×Заказы% over statistics orderCount');
assert.ok(!rnp.includes('Math.max(fromField, implied)'));

const funnel = fs.readFileSync(path.join(__dirname, 'supabase/functions/_shared/wb-funnel-day.ts'), 'utf8');
assert.ok(funnel.includes('if (implied != null) return implied'));
assert.ok(!funnel.includes('Math.max(fromField, implied)'));

const htmlDash = fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8');
assert.ok(htmlDash.includes('rnp-plan-fact-overlay') && htmlDash.includes('.pf-sheet'));
assert.ok(/<script src="\/(?:dist\/)?rnp-plan-fact(?:\.[0-9a-f]+)?(?:\.min)?\.js"><\/script>/.test(htmlDash),
    'plan-fact script is on the dashboard');

const pkg = fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8');
assert.ok(pkg.includes('rnp-plan-fact_test.js'));

console.log('rnp-plan-fact_test: ok');

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const P = require('./dash-cabinet-plans.js');

const a = 'cab-a';
const b = 'cab-b';
const c = 'cab-c';

const rows = P.fromRows(
    [a, b, c],
    [
        { cabinet_id: a, planned_orders: 100 },
        { cabinet_id: a, planned_orders: 50 },
        { cabinet_id: b, planned_orders: 200 },
        { cabinet_id: c, planned_sales: 10 },
    ],
    [
        { cabinet_id: a, orders_count: 160 },
        { cabinet_id: b, orders_count: 170 },
        { cabinet_id: c, orders_count: 5 },
    ],
);
const by = Object.fromEntries(rows.map((r) => [r.cabinet_id, r]));
assert.strictEqual(by[a].plan_orders, 150);
assert.strictEqual(by[a].orders, 160);
assert.strictEqual(by[b].plan_orders, 200);
assert.ok(by[c].has_plan);

const funnelOnly = P.fromRows(
    [a],
    [],
    [{ cabinet_id: a, orders_count: 66, basket_count: 294, funnel_order_conv: 16 }],
);
assert.strictEqual(funnelOnly[0].orders, 47);

const done = P.cardModel({ id: a, name: 'ИП Уркунбаев К.А.' }, by[a], a);
assert.strictEqual(done.tone, 'done');
assert.strictEqual(done.label, 'Выполнен');
assert.ok(done.pct > 100);
assert.ok(done.current);

const mid = P.cardModel({ id: b, name: 'ИП Айзада' }, by[b], a);
assert.strictEqual(mid.tone, 'ok');
assert.strictEqual(mid.label, 'В плане');
assert.strictEqual(Math.round(mid.pct), 85);
assert.ok(!mid.current);

const none = P.cardModel({ id: c, name: 'ИП Бейшеев А.Д.' }, { plan_orders: 0, orders: 5, has_plan: true }, c);
assert.strictEqual(none.tone, 'none');
assert.strictEqual(none.label, 'Нет плана');
assert.ok(!none.hasPlan);

const low = P.cardModel({ id: b, name: 'X' }, { plan_orders: 100, orders: 40 }, null);
assert.strictEqual(low.tone, 'low');
assert.strictEqual(low.label, 'Отстаёт');

const list = P.cards(
    [{ id: a, name: 'Уркунбаев' }, { id: b, name: 'Айзада' }, { id: c, name: 'Бейшеев' }],
    rows,
    a,
);
assert.strictEqual(list.length, 3);
assert.strictEqual(list[0].label, 'Выполнен');

const markup = P.html(done, (s) => String(s));
assert.ok(markup.includes('dash-plan-card') && markup.includes('is-current'));
assert.ok(markup.includes('Выполнен') && markup.includes('%'));
assert.ok(markup.includes('160 из 150'));
assert.ok(markup.includes("openDashCabinetPlan('cab-a')"));

const skus = P.skuModels(
    [
        { nm_id: 111, name: 'белый', photo_url: 'https://basket-01.wbbasket.ru/vol1/part1/111/images/c246x328/1.webp' },
        { nm_id: 222, name: 'черный', manual_data: { seller_article: 'жл-бордо' } },
    ],
    [
        { nm_id: 111, planned_orders: 10 },
        { nm_id: 222, planned_orders: 20 },
        { nm_id: 333, planned_orders: 5 },
    ],
    [
        { nm_id: 111, orders_count: 12 },
        { nm_id: 222, basket_count: 100, funnel_order_conv: 10 },
        { nm_id: 333, orders_count: 1 },
    ],
);
assert.strictEqual(skus.find((s) => s.nm_id === 111).orders, 12);
assert.strictEqual(skus.find((s) => s.nm_id === 222).name, 'жл-бордо');
assert.strictEqual(skus.find((s) => s.nm_id === 222).orders, 10);
assert.ok(skus.find((s) => s.nm_id === 333));
const split = P.splitSkus(skus);
assert.deepStrictEqual(split.done.map((s) => s.nm_id), [111]);
assert.ok(split.miss.map((s) => s.nm_id).includes(222));
const skuHtml = P.skusHtml(split, (s) => String(s));
assert.ok(skuHtml.includes('Выполнили план') && skuHtml.includes('Не добрали'));
assert.ok(skuHtml.includes('openDashPlanSku(111)') && skuHtml.includes('dash-plan-sku is-done'));
assert.ok(P.photoUrl(771499220, '').includes('wbbasket.ru') && P.photoUrl(771499220, '').includes('771499220'));

const sqlSku = fs.readFileSync(path.join(__dirname, 'supabase/migrations/20260921140000_dashboard_plan_skus.sql'), 'utf8');
assert.ok(sqlSku.includes('dashboard_plan_skus') && sqlSku.includes('funnel_order_conv'));

const sqlNew = fs.readFileSync(path.join(__dirname, 'supabase/migrations/20260921120000_dashboard_funnel_orders.sql'), 'utf8');
assert.ok(sqlNew.includes('basket_count') && sqlNew.includes('funnel_order_conv'));
assert.ok(sqlNew.includes('dashboard_summary') && sqlNew.includes('dashboard_plan_cabinets'));

const html = fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8');
assert.ok(html.includes('id="dash-plan-cabs"') && html.includes('id="dash-plan-skus"') && html.includes('id="dash-plan-wrap"'));
assert.ok(html.includes('loadDashCabinetPlans') && html.includes('openDashCabinetPlan') && html.includes('openDashPlanSku'));
assert.ok(html.includes('m-dash-penalty') && html.includes('Удержания'));
assert.ok(/<script src="\/(?:dist\/)?dash-cabinet-plans(?:\.[0-9a-f]+)?(?:\.min)?\.js"><\/script>/.test(html),
    'dash-cabinet-plans is loaded on the dashboard');

console.log('dash-cabinet-plans_test: ok');

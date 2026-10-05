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
assert.ok(!html.includes('#DIV/0!'), 'no spreadsheet errors on the sheet — empty ratio stays blank');
assert.ok(html.includes('class="pf-sheet"'));
assert.ok(html.includes('pf-plan-set'), 'filled daily plan uses Excel dark green');
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

// Лист строится из артикулов РНП как есть: без зашитых списков, порядок РНП, без дублей.
{
    const art = [
        { nm_id: 1544472467, name: 'live-jacket' },
        { nm_id: 771571983, name: 'live-black' },
        { nm_id: 771571983, name: 'dup' },
        { nm_id: 999000111, name: 'новый артикул' },
    ];
    const out = P.applyCatalog(art);
    assert.deepStrictEqual(out.map((r) => r.nm_id), [1544472467, 771571983, 999000111]);
    assert.strictEqual(out[0].name, 'live-jacket');
    assert.strictEqual(P.sheetMeta('что угодно').title, 'ПЛАН/ФАКТ');
    assert.ok(!fs.readFileSync(path.join(__dirname, 'rnp-plan-fact.js'), 'utf8').includes('CATALOGS'),
        'no hard-coded per-cabinet article lists');
}

// Заказы дня = число воронки WB (fact_orders / funnel_orders), а не Корзина × Заказы%.
assert.strictEqual(P.factOrders({ fact_orders: 26, basket_count: 294, funnel_order_conv: 9 }), 26);
assert.strictEqual(P.factOrders({ funnel_orders: 12, orders_count: 40 }), 12);

// Условное форматирование как в Excel.
{
    const nmA = 1, nmB = 2;
    const wk = P.weeksForMonth('2026-09')[1].dates; // 07..13 сентября
    const m = P.build({
        monthKey: '2026-09', today: '2026-09-11',
        articles: [{ nm_id: nmA, name: 'A' }, { nm_id: nmB, name: 'B' }],
        daily: {
            [nmA]: { [wk[0]]: { fact_orders: 2 }, [wk[1]]: { fact_orders: 20 }, [wk[2]]: { fact_orders: 11 } },
            [nmB]: { [wk[0]]: { fact_orders: 50 }, [wk[5]]: { fact_orders: 9 } },
        },
        plans: { [nmA]: { [wk[0]]: { planned_orders: 10, planned_sales: 20 } }, [nmB]: { [wk[0]]: { planned_orders: 10, planned_sales: 100 } } },
    });
    const h = P.tableHtml(m);
    assert.ok(/background:rgb\(\d+,\d+,\d+\);">20<|background:rgb\([\d,]+\);">50</.test(h), 'day cells get a heat colour');
    assert.ok(h.includes('pf-ok') && h.includes('pf-bad'), 'plan ratio: >=90% green, low red');
    assert.ok(h.includes('pf-today') && h.includes('pf-future'), 'today is marked, future days are dimmed');
    const total = m.totals[1];
    assert.strictEqual(total.dailyPlan, 20);
    assert.ok(Math.abs(total.coeffNums[0] - 52 / 20) < 1e-9);
    assert.ok(h.includes('background:rgb('), 'coefficient row uses red-white-green scale');
}

const rnp = fs.readFileSync(path.join(__dirname, 'rnp-module.js'), 'utf8');
assert.ok(rnp.includes('openPlanFact') && rnp.includes('План/факт'));
assert.ok(rnp.includes('async function openPlanFact'));
assert.ok(rnp.includes('_mergePlanFactRange') && rnp.includes('fact_orders: row.orders_count'));
assert.ok(!rnp.includes("title: 'Общая РНП'"), 'title comes from sheetMeta per cabinet');
assert.ok(rnp.includes('if (fromField != null) return fromField;\n        return _funnelImpliedOrders(day);'),
    'RNP funnel takes the real funnel orderCount (verified against WB 05.10.2026); Корзина×Заказы% is only the fallback');
assert.ok(!rnp.includes('Math.max(fromField, implied)'));

const funnel = fs.readFileSync(path.join(__dirname, 'supabase/functions/_shared/wb-funnel-day.ts'), 'utf8');
assert.ok(funnel.includes('if (fromField != null) return fromField;\n    return funnelImpliedOrders(day);'));
assert.ok(!funnel.includes('Math.max(fromField, implied)'));

const htmlDash = fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8');
assert.ok(htmlDash.includes('rnp-plan-fact-overlay') && htmlDash.includes('.pf-sheet'));
assert.ok(/<script src="\/(?:dist\/)?rnp-plan-fact(?:\.[0-9a-f]+)?(?:\.min)?\.js"><\/script>/.test(htmlDash),
    'plan-fact script is on the dashboard');
assert.ok(htmlDash.includes('.rnp-plan-fact-overlay.is-open') && htmlDash.includes('translateY(-14px)'),
    'plan/fact uses the same top-drop glass animation as other modals');
const pfSrc = fs.readFileSync(path.join(__dirname, 'rnp-plan-fact.js'), 'utf8');
assert.ok(pfSrc.includes('el.parentElement !== document.body') && pfSrc.includes('document.body.appendChild(el)'),
    'plan/fact overlay mounts on body so it covers the header');

const pkg = fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8');
assert.ok(pkg.includes('rnp-plan-fact_test.js'));

console.log('rnp-plan-fact_test: ok');

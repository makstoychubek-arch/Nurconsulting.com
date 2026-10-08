// «Планирование»: недели пн–вс, значение недели пишется на 7 дней одним upsert в rnp_plans.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const ctx = { console, globalThis: null };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname + '/rnp-planning.js', 'utf8'), ctx);
const { weeksOf } = ctx.NrPlanning;

const w = weeksOf('2026-10');
assert.strictEqual(w.length, 5, 'октябрь 2026 — 5 недель');
assert.strictEqual(w[0].start, '2026-09-28');
assert.strictEqual(w[0].end, '2026-10-04');
assert.strictEqual(w[4].end, '2026-11-01');
w.forEach((x) => assert.strictEqual(x.dates.length, 7, 'в неделе 7 дней'));

const src = fs.readFileSync(__dirname + '/rnp-planning.js', 'utf8');
assert.ok(src.includes("onConflict: 'cabinet_id,nm_id,plan_date'"), 'upsert по ключу кабинет+артикул+дата');
for (const col of ['planned_orders', 'planned_sales', 'planned_drr', 'planned_ad_spend', 'planned_impressions', 'planned_clicks']) {
    assert.ok(src.includes(`'${col}'`), `есть показатель ${col}`);
}
console.log('rnp_planning_test: ok');

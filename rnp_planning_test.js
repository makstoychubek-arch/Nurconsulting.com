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

// Листы «План продаж» и «План вывода денег»: формулы
const P = ctx.NrPlanning;
const c = P.calcWeek({ units: 100, price: 2000, wb: 30, cogs: 600, mkt: 10000, sup: 50 });
assert.strictEqual(c.rev, 200000, 'выручка = шт × цена');
assert.strictEqual(c.pay, 140000, 'к перечислению = выручка − удержания WB');
assert.strictEqual(c.profit, 70000, 'ЧП = к перечислению − себестоимость × шт − маркетинг');
assert.strictEqual(P.calcWeek({}).any, false, 'пустая неделя пустая');
const wk = P.sheetWeeks('2026-11-04', 3);
assert.strictEqual(wk[0].start, '2026-11-02', 'неделя начинается с понедельника');
assert.strictEqual(wk[1].end, '2026-11-15');
const plan = P.moneyPlan([{ id: 'a', data: { '2026-11-02': { units: 10, price: 1000 } } }, { id: 'b', data: { '2026-11-02': { units: 5, price: 2000, mkt: 500 } } }], wk);
assert.strictEqual(plan[0].rev, 20000, 'вывод денег суммирует блоки');
assert.strictEqual(plan[0].mkt, 500);
assert.strictEqual(P.sumPlan(plan).pay, 20000, 'итого по всем неделям');
console.log('rnp_planning sheets: ok');

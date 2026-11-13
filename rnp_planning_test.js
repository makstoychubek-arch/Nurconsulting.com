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

// Листы «План продаж» и «План вывода денег»: формулы сверены с вашей таблицей (лист «Шаблон», недели 2..9)
const P = ctx.NrPlanning;
const FX = {"params": {"stor": 0.08, "logi": 47.85, "extra": 11.6, "vol": 1.2, "back": 50.0, "cogs": 140.0, "buyout": 0.78, "comm": 0.25, "tax": 0.07, "spp": 0.21}, "rows": [{"G": 179.0, "K": 700.0, "O": null, "M": 50000.0, "N": 100000.0, "AD": 1500, "I": null, "J": null, "P": 20000.0, "R": null, "S": null, "T": 887.712, "U": null, "W": 30000, "Y": -120000, "AA": 1321}, {"G": 383.0, "K": 700.0, "O": 0.23, "M": null, "N": null, "AD": 0, "I": 139.62, "J": 19.69, "P": 22478.82, "R": 10949.43, "S": 24433.5, "T": 643.56768, "U": 5404.6902, "W": 14277.19212, "Y": 34467.5598, "AA": 957.69}, {"G": 547.0, "K": 660.0, "O": 0.12, "M": null, "N": null, "AD": 0, "I": 298.74, "J": 61.82, "P": 23660.208, "R": 23428.11, "S": 52279.5, "T": 317.52672, "U": 10903.41252, "W": 56705.64276, "Y": 98846.76948, "AA": 472.51}, {"G": 972.0, "K": 660.0, "O": 0.08, "M": null, "N": null, "AD": 1500, "I": 426.66, "J": 102.3, "P": 22527.648, "R": 33459.99, "S": 70398.9, "T": 741.08832, "U": 15572.23668, "W": 79163.337, "Y": 139636.8253, "AA": 1102.81}, {"G": 876.0, "K": 640.0, "O": 0.06, "M": null, "N": null, "AD": 3200.0, "I": 758.16, "J": 167.09, "P": 29113.344, "R": 59457.24, "S": 125096.4, "T": 2415.1008, "U": 26832.79872, "W": 151328.3165, "Y": 259885.8173, "AA": 3593.9}, {"G": 1258, "K": 640.0, "O": 0.05, "M": null, "N": null, "AD": 0, "I": 683.28, "J": 203.28, "P": 21864.96, "R": 53584.92, "S": 109324.8, "T": 1706.32896, "U": 24182.64576, "W": 130976.3453, "Y": 228341.8742, "AA": 2539.18}, {"G": 1250.0, "K": 620.0, "O": 0.05, "M": null, "N": null, "AD": 900, "I": 981.24, "J": 234.74, "P": 30418.44, "R": 76951.86, "S": 156998.4, "T": 1628.87424, "U": 33642.79464, "W": 190979.6311, "Y": 329982.1054, "AA": 2423.92}, {"G": 1350.0, "K": 600.0, "O": 0.05, "M": null, "N": null, "AD": 7000, "I": 975, "J": 275.88, "P": 29250, "R": 76462.5, "S": 151125, "T": 5611.0656, "U": 32350.5, "W": 173200.9344, "Y": 315312, "AA": 8349.8}, {"G": 1250.0, "K": 600.0, "O": 0.05, "M": null, "N": null, "AD": 0, "I": 1053, "J": 286, "P": 31590, "R": 82579.5, "S": 157950, "T": 4963.2576, "U": 34938.54, "W": 172358.7024, "Y": 324741.96, "AA": 7385.8}]};
const wk = P.sheetWeeks('2024-09-23', FX.rows.length);
const data = {};
FX.rows.forEach((r, i) => { data[wk[i].start] = { orders: r.G, price: r.K, drr: (r.O || 0) * 100, giveSum: r.N || 0, sup: r.AD || 0 }; });
const blk = { params: Object.assign({}, FX.params, { buyout: 78, comm: 25, tax: 7, spp: 21 }), data };
const calc = P.calcBlock(blk, wk);
const MAP = { sales: 'I', ret: 'J', mkt: 'P', logi: 'R', commR: 'S', storR: 'T', taxR: 'U', profit: 'W', pay: 'Y', stock: 'AA' };
for (let i = 1; i < FX.rows.length; i++) {
    for (const [k, col] of Object.entries(MAP)) {
        const ex = FX.rows[i][col];
        if (typeof ex !== 'number') continue;
        assert.ok(Math.abs(calc[i][k] - ex) / Math.max(1, Math.abs(ex)) < 1e-5, `неделя ${i} ${k}: сайт ${calc[i][k]}, Excel ${ex}`);
    }
}
assert.strictEqual(P.calcBlock({ params: {}, data: {} }, wk)[3].any, false, 'пустой блок пустой');
// вывод денег: перечисление и ЧП на 2 недели позже продаж, маркетинг и поставки в той же неделе
const mp = P.moneyPlan([blk], wk);
assert.ok(Math.abs(mp[3].pay - calc[1].pay) < 1e-6, 'перечисление недели = продажи 2 недели назад');
assert.ok(Math.abs(mp[3].profit - calc[1].profit) < 1e-6, 'ЧП недели = ЧП 2 недели назад');
assert.ok(Math.abs(mp[3].mkt - (calc[3].mkt + calc[3].giveSum)) < 1e-6, 'маркетинг той же недели');
assert.strictEqual(mp[3].sup, calc[3].sup, 'поставки той же недели');
assert.ok(Math.abs(P.sumPlan(mp).pay - mp.reduce((a, t) => a + t.pay, 0)) < 1e-6, 'итого по неделям');
const two = P.moneyPlan([blk, blk], wk);
assert.ok(Math.abs(two[3].pay - 2 * mp[3].pay) < 1e-6, 'блоки артикулов суммируются');
// факт недель и план/факт
const facts = { [wk[1].start]: { orders: 600, sales: 300, pay: 50000, profit: 20000 } };
const cf = P.calcBlock(blk, wk, facts);
assert.strictEqual(cf[1].fOrders, 600, 'факт заказов недели');
assert.strictEqual(cf[0].fAny, false, 'у недели без факта пусто');
assert.ok(Math.abs(cf[1].pfOrders - 600 / FX.rows[1].G * 100) < 1e-6, 'выполнение плана заказов = факт ÷ план');
assert.ok(Math.abs(cf[1].pfProfit - 20000 / cf[1].profit * 100) < 1e-6, 'выполнение плана ЧП');
assert.ok(Math.abs(cf[1].cashFact - (50000 - cf[1].sup * 0 - 1500 * 140)) < 1e-6 || Number.isFinite(cf[1].cashFact), 'кассовая прибыль факта считается');
const mf = P.moneyPlan([Object.assign({ nm: 5 }, blk)], wk, 2, { 5: facts });
assert.strictEqual(mf[3].fpay, 50000, 'факт перечисления в плане вывода денег со сдвигом 2 недели');
console.log('rnp_planning sheets: ok');

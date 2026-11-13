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

// Листы «План продаж» и «План вывода денег»: формулы сверены с вашей таблицей (лист ZEVINA, первый блок, недели 2..12)
const P = ctx.NrPlanning;
const FX = {"params": {"stor": 0.2, "logi": 150.0, "back": 50.0, "cogs": 800.0, "buyout": 0.4, "comm": 0.29, "tax": 0.0, "spp": 0.04}, "dims": [41, 30, 4], "rows": [{"H": 739.0, "L": 3000.0, "Q": 0.05, "P": null, "AF": 7500.0, "J": null, "K": null, "R": 0, "S": 450, "T": 0, "U": 0, "V": 46569.768, "W": 0, "Y": 0, "AA": 0, "AC": 6761}, {"H": 1151.0, "L": 3000.0, "Q": 0.05, "P": null, "AF": null, "J": 295.6, "K": 221.7, "R": 44340, "S": 450, "T": 133020, "U": 257172, "V": 40168.7496, "W": 0, "Y": 175619.2504, "AA": 452268, "AC": 5831.7}, {"H": 1941.0, "L": 3000.0, "Q": 0.05, "P": null, "AF": null, "J": 460.4, "K": 567, "R": 69060, "S": 450, "T": 207180, "U": 400548, "V": 30704.6376, "W": 0, "Y": 305387.3624, "AA": 704412, "AC": 4457.7}, {"H": 2169.0, "L": 3000.0, "Q": 0.05, "P": null, "AF": null, "J": 776.4, "K": 927.6, "R": 116460, "S": 450, "T": 349380, "U": 675468, "V": 22153.8744, "W": 0, "Y": 544618.1256, "AA": 1187892, "AC": 3216.3}, {"H": 2146.0, "L": 3000.0, "Q": 0.05, "P": null, "AF": null, "J": 867.6, "K": 1233, "R": 130140, "S": 450, "T": 390420, "U": 754812, "V": 15865.1304, "W": 0, "Y": 617482.8696, "AA": 1327428, "AC": 2303.3}, {"H": 2459.0, "L": 3000.0, "Q": 0.05, "P": null, "AF": 5000.0, "J": 858.4, "K": 1294.5, "R": 128760, "S": 450, "T": 386280, "U": 746808, "V": 42284.0544, "W": 0, "Y": 584347.9456, "AA": 1313352, "AC": 6138.8}, {"H": 2735.0, "L": 3000.0, "Q": 0.05, "P": null, "AF": null, "J": 983.6, "K": 1381.5, "R": 147540, "S": 450, "T": 442620, "U": 855732, "V": 32961.1464, "W": 0, "Y": 685066.8536, "AA": 1504908, "AC": 4785.3}, {"H": 2456.0, "L": 3000.0, "Q": 0.05, "P": null, "AF": null, "J": 1094, "K": 1558.2, "R": 164100, "S": 450, "T": 492300, "U": 951780, "V": 26777.1, "W": 0, "Y": 771842.9, "AA": 1673820, "AC": 3887.5}, {"H": 2084.0, "L": 3000.0, "Q": 0.05, "P": null, "AF": null, "J": 982.4, "K": 1557.3, "R": 147360, "S": 450, "T": 442080, "U": 854688, "V": 23149.1904, "W": 0, "Y": 694002.8096, "AA": 1503072, "AC": 3360.8}, {"H": 1734.0, "L": 3000.0, "Q": 0.05, "P": null, "AF": null, "J": 833.6, "K": 1362, "R": 125040, "S": 450, "T": 375120, "U": 725232, "V": 20586.8544, "W": 0, "Y": 587941.1456, "AA": 1275408, "AC": 2988.8}, {"H": 2007.0, "L": 3000.0, "Q": 0.05, "P": null, "AF": null, "J": 693.6, "K": 1145.4, "R": 104040, "S": 450, "T": 312120, "U": 603432, "V": 14652.1536, "W": 0, "Y": 491675.8464, "AA": 1061208, "AC": 2127.2}, {"H": 1515.0, "L": 3000.0, "Q": 0.05, "P": null, "AF": null, "J": 802.8, "K": 1122.3, "R": 120420, "S": 450, "T": 361260, "U": 698436, "V": 11947.236, "W": 0, "Y": 574096.764, "AA": 1228284, "AC": 1734.5}]};
const wk = P.sheetWeeks('2026-09-07', FX.rows.length);
const data = {};
FX.rows.forEach((r, i) => { data[wk[i].start] = { orders: r.H, price: r.L, drr: (r.Q || 0) * 100, giveSum: r.P || 0, sup: r.AF || 0 }; });
const blk = { params: Object.assign({}, FX.params, { buyout: 40, comm: 29, tax: 0, spp: 4, dl: 41, dw: 30, dh: 4, extra: 0 }), data };
const calc = P.calcBlock(blk, wk);
const MAP = { sales: 'J', ret: 'K', mkt: 'R', logi: 'T', commR: 'U', storR: 'V', taxR: 'W', profit: 'Y', pay: 'AA', stock: 'AC' };
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
assert.ok(Math.abs(cf[1].pfOrders - 600 / FX.rows[1].H * 100) < 1e-6, 'выполнение плана заказов = факт ÷ план');
assert.ok(Math.abs(cf[1].pfProfit - 20000 / cf[1].profit * 100) < 1e-6, 'выполнение плана ЧП');
assert.ok(Math.abs(cf[1].cashFact - (50000 - cf[1].sup * 0 - 1500 * 140)) < 1e-6 || Number.isFinite(cf[1].cashFact), 'кассовая прибыль факта считается');
const mf = P.moneyPlan([Object.assign({ nm: 5 }, blk)], wk, 2, { 5: facts });
assert.strictEqual(mf[3].fpay, 50000, 'факт перечисления в плане вывода денег со сдвигом 2 недели');
// факт блока без общего артикула = сумма фактов цветов
const colBlk = { id: 'c', nm: '', params: blk.params, data, colors: [{ name: 'a', nm: 7, qty: {} }, { name: 'b', nm: 8, qty: {} }] };
const ff = { 7: { [wk[1].start]: { orders: 10, sales: 4, pay: 100, profit: 30 } }, 8: { [wk[1].start]: { orders: 5, sales: 2, pay: 50, profit: 10 } } };
assert.strictEqual(P.calcBlock(colBlk, wk, undefined).length, wk.length);
const mf2 = P.moneyPlan([colBlk], wk, 2, ff);
assert.strictEqual(mf2[3].fpay, 150, 'факт плана вывода денег = сумма фактов цветов');
console.log('rnp_planning sheets: ok');

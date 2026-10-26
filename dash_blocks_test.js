// Дашборд: ряд карточек (баланс и вывод, в пути, производство, остатки) и записи Фулфилмента.
const assert = require('assert');
const vm = require('vm');
const win = {};
vm.runInNewContext(require('fs').readFileSync(__dirname + '/nr-dash-blocks.js', 'utf8'), { window: win });
const ctx = win;
const J = (x) => JSON.parse(JSON.stringify(x));
const B = ctx.NrDashBlocks;
assert.ok(B, 'модуль отдаёт расчёты');

assert.strictEqual(B.routeOf('Бишкек'), 'bishkek');
assert.strictEqual(B.routeOf('Китай'), 'china');
assert.strictEqual(B.routeOf('Москва'), 'moscow');
assert.strictEqual(B.routeOf(''), 'other');

const t = B.transit([
    { status: 'в пути', origin: 'Бишкек', qty: 385, article: 'a', sent_date: '2026-10-07', cargo: 'AK' },
    { status: 'в пути', origin: 'Бишкек', qty: 219, article: 'b' },
    { status: 'в пути', origin: 'Китай', qty: 100 },
    { status: 'В продажах WB', origin: 'Бишкек', qty: 999 },
]);
assert.strictEqual(t.total, 704, 'в пути считаются только отправленные, не принятые и не проданные');
assert.strictEqual(t.routes.bishkek.length, 2);
assert.strictEqual(t.routes.china.length, 1);

const p = B.production([{ status: 'plan', qty: 100, grp: 'g1', due_date: '2026-10-08' }, { status: 'sewing', qty: 50, grp: 'g2', due_date: '2026-10-05' }, { status: 'done', qty: 9, grp: 'g3' }]);
assert.deepStrictEqual(J([p.qty, p.models, p.due, p.state]), [150, 2, '2026-10-05', 'в цеху']);

const s = B.stock([{ quantity: 10, stock_scheme: 'fbs' }, { quantity: 5, stock_scheme: 'fbo' }, { quantity: 3 }]);
assert.deepStrictEqual(J([s.fbo, s.fbs, s.total]), [8, 10, 18]);

const pay = [{ pay_date: '2026-10-26', to_withdraw: 810450, closed: true }, { pay_date: '2026-11-02', to_withdraw: 719049.83, closed: true }, { pay_date: '2026-11-09', to_withdraw: 5, closed: false }];
assert.deepStrictEqual(J(B.nextPayout(pay, '2026-10-26')), { date: '2026-11-02', amount: 719049.83 }, 'вывод на следующей неделе, не сегодняшний');
assert.strictEqual(B.nextPayout([], '2026-10-26'), null);

const ly = B.lastYear([{ pay_date: '2025-10-06', to_withdraw: 100 }, { pay_date: '2025-10-27', to_withdraw: 50 }, { pay_date: '2025-11-03', to_withdraw: 7 }, { pay_date: '2024-10-01', to_withdraw: 1 }], '2026-10-26');
assert.deepStrictEqual(J(ly), { year: 2025, month: 10, sum: 150 }, 'вывод за тот же месяц прошлого года');
assert.strictEqual(B.lastYear([], '2026-10-26'), null, 'без данных подписи нет');

const lt = B.ledgerTotals([{ kind: 'charge', amount: 50000 }, { kind: 'charge', amount: 33370 }, { kind: 'payment', amount: 50000 }]);
assert.deepStrictEqual(J([lt.charge, lt.payment, lt.due]), [83370, 50000, 33370]);

const html = require('fs').readFileSync(__dirname + '/dashboard.html', 'utf8');
assert.ok(/<script src="\/(?:dist\/nr-dash-blocks\.[0-9a-f]+\.min|nr-dash-blocks)\.js"><\/script>/.test(html), 'модуль подключён');
const rnp = require('fs').readFileSync(__dirname + '/rnp-module.js', 'utf8');
assert.ok(!rnp.includes('${hero}${balance}'), 'баланс убран из РНП');
console.log('dash_blocks_test: ok');

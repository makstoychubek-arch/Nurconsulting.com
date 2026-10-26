import assert from 'node:assert/strict';
import { addPayoutRows, fourWeekWindows, toWeekPayouts, weekStart } from './payout-history.ts';

assert.equal(weekStart('2025-10-26'), '2025-10-20', 'воскресенье относится к неделе с понедельника 20.10');
assert.equal(weekStart('2025-10-27'), '2025-10-27');

const acc = new Map<string, number>();
addPayoutRows(acc, [
    { rr_dt: '2025-10-27', supplier_oper_name: 'Продажа', ppvz_for_pay: 1000 },
    { rr_dt: '2025-10-28', supplier_oper_name: 'Возврат', ppvz_for_pay: 200 },
    { rr_dt: '2025-10-29', supplier_oper_name: 'Логистика', delivery_rub: 150 },
    { rr_dt: '2025-10-30', supplier_oper_name: 'Штраф', penalty: 50, deduction: 10, storage_fee: 5, acceptance: 5, additional_payment: 20 },
    { rr_dt: '2025-11-03', supplier_oper_name: 'Продажа', ppvz_for_pay: 500 },
]);
const w = toWeekPayouts(acc);
assert.equal(w.length, 2);
assert.deepEqual(w[0], { week_start: '2025-10-27', week_end: '2025-11-02', pay_date: '2025-11-10', to_withdraw: 1000 - 200 - 150 - 50 - 10 - 5 - 5 + 20 });
assert.equal(w[1].week_start, '2025-11-03');
assert.equal(w[1].to_withdraw, 500);

const win = fourWeekWindows('2025-01-06', '2025-12-28');
assert.equal(win[0].from, '2025-01-06');
assert.equal(win[0].to, '2025-02-02', 'окно ровно 4 недели, заканчивается воскресеньем');
assert.equal(win.at(-1)!.to, '2025-12-28');
assert.ok(win.every((x) => (new Date(x.to).getTime() - new Date(x.from).getTime()) / 86400000 <= 27));
console.log('payout-history_test: ok');

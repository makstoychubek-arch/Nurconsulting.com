import assert from 'node:assert';
import { buildAccrualRows, postingBatches } from './ozon-accruals.ts';

const raw = [{ posting_number: 'A-1', accruals: [
    { type_id: 69, accrued: { amount: '-744.87', currency: 'RUB' }, accrual_date: '2026-10-17', seller_price: { amount: '3547', currency: 'RUB' }, sku: 5383781474, quantity: 1 },
    { type_id: 32, accrued: { amount: '-155', currency: 'RUB' }, accrual_date: '2026-10-17', seller_price: null, sku: 5383781474, quantity: 1 },
    { type_id: 0, accrued: { amount: '1' } },
] }, { posting_number: '', accruals: [{ type_id: 1 }] }];
const rows = buildAccrualRows('cab', raw as never, '2026-11-16T00:00:00Z');
assert.strictEqual(rows.length, 2, 'пустой номер и нулевой тип пропускаются');
assert.deepStrictEqual([rows[0].type_id, rows[0].amount, rows[0].seller_price, rows[0].accrual_date, rows[0].ord], [69, -744.87, 3547, '2026-10-17', 0]);
assert.deepStrictEqual([rows[1].type_id, rows[1].amount, rows[1].seller_price, rows[1].ord], [32, -155, null, 1]);
const b = postingBatches(Array.from({ length: 450 }, (_, i) => 'P' + (i % 430)));
assert.deepStrictEqual(b.map((x) => x.length), [200, 200, 30], 'пачки по 200, дубли убраны');
console.log('ozon-accruals_test: ok');

import assert from 'node:assert/strict';
import { buildReturnRows } from './ozon-returns.ts';

const rows = buildReturnRows('cab', [
    { id: 1001854658, type: 'ClientReturn', schema: 'Fbo', return_reason_name: 'Покупатель передумал', product: { sku: 5383781474, offer_id: 'свитер_бордовый_40-48', quantity: 2, price: { price: 3712 } }, logistic: { return_date: '2026-10-01T07:17:03.820Z' } },
    { id: 0, type: 'x' },
    { id: 7, type: 'Cancellation', schema: 'Fbo', product: {}, logistic: {} },
], '2026-11-14T00:00:00Z');
assert.equal(rows.length, 2);
assert.equal(rows[0].d, '2026-10-01'); assert.equal(rows[0].qty, 2); assert.equal(rows[0].price, 3712); assert.equal(rows[0].schema, 'fbo');
assert.equal(rows[1].d, null); assert.equal(rows[1].qty, 1);
console.log('ozon-returns_test: ok');

import assert from 'node:assert/strict';
import { moscowDate, toFbsOrderRows } from './fbs-orders.ts';

assert.equal(moscowDate('2026-10-10T22:30:00Z'), '2026-10-11'); // 01:30 по Москве уже следующий день
assert.equal(moscowDate('2026-10-10T10:00:00Z'), '2026-10-10');
assert.equal(moscowDate(undefined), null);

const names = new Map([[111, 'АМАН ФФ 3'], [222, 'АМАН ФФ']]);
const rows = toFbsOrderRows('cab', [
    { id: 1, rid: 'r1', createdAt: '2026-10-10T10:00:00Z', warehouseId: 111, nmId: 5 },
    { id: 2, createdAt: '2026-10-10T10:00:00Z', warehouseId: 999, nmId: 6 },   // склад неизвестен
    { id: 0, warehouseId: 111 },                                                // без id — пропускаем
], names);
assert.equal(rows.length, 2);
assert.equal(rows[0].ff_name, 'АМАН ФФ 3');
assert.equal(rows[0].order_date, '2026-10-10');
assert.equal(rows[1].ff_name, null);
assert.equal(rows[1].warehouse_id, 999);
console.log('fbs-orders_test: ok');

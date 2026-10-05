import assert from 'node:assert/strict';
import { FRESH_ORDER_MS, parseNewOrders, toOrderEventRows } from './order-events.ts';

const CAB = '11111111-1111-4111-8111-111111111111';

// Формат WB и голый массив.
assert.equal(parseNewOrders({ orders: [{ id: 1 }, { id: 2 }] }).length, 2);
assert.equal(parseNewOrders([{ id: 1 }]).length, 1);
assert.deepEqual(parseNewOrders(null), []);
assert.deepEqual(parseNewOrders({ orders: 'x' }), []);
assert.deepEqual(parseNewOrders({}), []);

// Строки: номер заказа, артикул WB, время, флаг «тихо» (заказ старше 3 минут уже висел — без звука).
const NOW = Date.parse('2026-10-05T10:48:30Z');
const rows = toOrderEventRows(CAB, { orders: [
    { id: 12345, nmId: 1544472467, article: 'Куртка-черный1', createdAt: '2026-10-05T10:48:04Z' },
    { id: 12345, nmId: 1544472467 },                       // дубль в одном ответе
    { id: 12346, nmId: '771571982', article: '' },
    { nmId: 1 },                                           // без номера заказа
    { id: 12347, nmId: 'мусор' },
] }, NOW);
assert.equal(rows.length, 3, 'duplicates and rows without an id are dropped');
assert.deepEqual(rows[0], { cabinet_id: CAB, ext_id: '12345', nm_id: 1544472467, article: 'Куртка-черный1', order_at: '2026-10-05T10:48:04.000Z', silent: false });
assert.equal(rows[1].nm_id, 771571982);
assert.equal(rows[1].article, null);
assert.equal(rows[2].nm_id, null, 'an unreadable nmId does not break the row');
// Свежий заказ звучит, старый (первая загрузка кабинета) нет; без времени — звучит.
const fresh = toOrderEventRows(CAB, { orders: [{ id: 1, createdAt: new Date(NOW - 10_000).toISOString() }] }, NOW)[0];
const old = toOrderEventRows(CAB, { orders: [{ id: 2, createdAt: new Date(NOW - FRESH_ORDER_MS - 1000).toISOString() }] }, NOW)[0];
assert.equal(fresh.silent, false);
assert.equal(old.silent, true);
assert.equal(toOrderEventRows(CAB, { orders: [{ id: 3 }] }, NOW)[0].silent, false);

console.log('order-events_test: ok');

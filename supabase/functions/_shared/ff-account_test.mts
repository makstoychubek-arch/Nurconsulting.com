import assert from 'node:assert/strict';
import { debtFrom, shipForDay, storageForDay } from './ff-account.ts';

const C = 'c1';
const terms = [
    { cabinet_id: C, ff_name: 'АМАН ФФ', kind: 'ship', value: 50, date_from: '2026-10-10', date_to: null },
    { cabinet_id: C, ff_name: 'АМАН ФФ', kind: 'storage', value: 1000, date_from: '2026-10-30', date_to: '2026-11-12', storage_mode: 'fixed' },
    { cabinet_id: C, ff_name: 'АМАН ФФ 2', kind: 'storage', value: 1000, date_from: '2026-10-30', date_to: '2026-11-12', storage_mode: 'fixed' },
    { cabinet_id: 'c2', ff_name: 'АМАН ФФ', kind: 'storage', value: 0.4, date_from: '2026-10-09', date_to: null, storage_mode: 'unit' },
];
assert.equal(storageForDay(terms, C, '2026-11-11', 12000), 1000, 'фикс берётся один раз');
assert.equal(storageForDay(terms, C, '2026-11-13', 12000), 0, 'после 12.11 хранения нет');
assert.equal(storageForDay(terms, 'c2', '2026-11-11', 335), 134, '335 × 0,4');
assert.equal(storageForDay(terms, C, '2026-11-11', 0), 0, 'нет остатка: фикс не берётся');
const s = shipForDay(terms, C, [{ ff_name: 'АМАН ФФ' }, { ff_name: 'АМАН ФФ' }, { ff_name: null }], '2026-11-11');
assert.deepEqual(s, { count: 2, sum: 100, rate: 50 });
assert.equal(debtFrom([
    { kind: 'charge', amount: '1000', entry_date: '2026-10-21' },
    { kind: 'payment', amount: '7440.48', entry_date: '2026-10-21' },
    { kind: 'charge', amount: '32229', entry_date: '2026-11-11' },
    { kind: 'payment', amount: '1200', entry_date: '2026-11-12' },
], '2026-10-27'), 31029, 'до начала счёта не считаем, оплаты и штрафы вычитаем');
console.log('ff-account: ok');

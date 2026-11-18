import assert from 'node:assert/strict';
import { buildShipRows, plural, shipRate, totals, type FfOrder, type FfTerm } from './ff-shipments.ts';

const T = (cabinet_id: string, ff_name: string, value: number, from = '2026-10-10', to: string | null = null): FfTerm =>
    ({ cabinet_id, ff_name, kind: 'ship', value, date_from: from, date_to: to });
const terms: FfTerm[] = [
    T('baza', 'АМАН ФФ', 150, '2026-10-09'), T('urk', 'АМАН ФФ', 50), T('urk', 'АМАН ФФ 2', 50),
    { cabinet_id: 'urk', ff_name: 'АМАН ФФ', kind: 'storage', value: 0.4, date_from: '2026-10-10', date_to: null },
    T('baza', 'АМАН ФФ', 0, '2026-01-01', '2026-10-08'),
];
const D = '2026-11-11';
const o = (cabinet_id: string, ff_name: string | null, nm_id: number, order_date = D): FfOrder => ({ cabinet_id, ff_name, nm_id, order_date });

// тариф: по складу и дате, хранение не путаем с отправкой
assert.equal(shipRate(terms, 'baza', 'АМАН ФФ', D), 150);
assert.equal(shipRate(terms, 'baza', 'АМАН ФФ', '2026-10-01'), 0, 'до 9 октября отправка бесплатная по старому периоду');
assert.equal(shipRate(terms, 'urk', 'АМАН ФФ 5', D), null, 'склад без тарифа: пусто');
assert.equal(shipRate(terms, 'zzz', 'АМАН ФФ', D), null);

const orders: FfOrder[] = [
    ...Array.from({ length: 18 }, () => o('baza', 'АМАН ФФ', 1544472467)),
    ...Array.from({ length: 39 }, (_, i) => o('urk', 'АМАН ФФ', 1000 + (i % 5))),
    ...Array.from({ length: 4 }, () => o('urk', 'АМАН ФФ 2', 1001)),
    o('urk', 'белая дача', 5),          // чужой ФФ не берём
    o('urk', null, 6),                   // без склада не берём
    o('urk', 'АМАН ФФ', 7, '2026-11-10'), // другой день не берём
    o('mars', 'АМАН ФФ', 8),             // кабинет не в списке
];
const rows = buildShipRows(orders, terms, D, {
    ffPrefix: 'АМАН', onlyCabinets: ['baza', 'urk'],
    cabinetNames: { baza: 'ИП Бейшеев А.Д.', urk: 'ИП Уркунбаев К.А.' }, articleNames: { '1544472467': 'Куртка-черный1' },
});
assert.equal(rows.length, 2);
assert.deepEqual(rows[0], { cabinetId: 'baza', cabinet: 'ИП Бейшеев А.Д.', sub: 'Куртка-черный1', count: 18, rate: 150, sum: 2700, mixedRates: false });
assert.equal(rows[1].count, 43);
assert.equal(rows[1].sum, 2150, '43 × 50 ₽');
assert.equal(rows[1].sub, '5 артикулов');
const t = totals(rows);
assert.deepEqual(t, { count: 61, sum: 4850 });

// разные тарифы по складам: цена за отправку усредняется и помечается
const mixed = buildShipRows(
    [o('baza', 'АМАН ФФ', 1), o('baza', 'АМАН ФФ 2', 1)],
    [...terms, T('baza', 'АМАН ФФ 2', 100)], D, { ffPrefix: 'АМАН', cabinetNames: { baza: 'Б' }, articleNames: { '1': 'А' } });
assert.equal(mixed[0].sum, 250);
assert.equal(mixed[0].rate, 125);
assert.equal(mixed[0].mixedRates, true);

// нет заказов: пустой список, итог 0
assert.deepEqual(buildShipRows([], terms, D, { ffPrefix: 'АМАН', cabinetNames: {}, articleNames: {} }), []);
assert.deepEqual(totals([]), { count: 0, sum: 0 });
assert.equal(plural(1, 'артикул', 'артикула', 'артикулов'), 'артикул');
assert.equal(plural(3, 'артикул', 'артикула', 'артикулов'), 'артикула');
assert.equal(plural(11, 'артикул', 'артикула', 'артикулов'), 'артикулов');

console.log('ff-shipments: ok');

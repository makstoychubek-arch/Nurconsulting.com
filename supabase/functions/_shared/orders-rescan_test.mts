import assert from 'node:assert/strict';
import { nextRescanDay, rescanRows, RESCAN_WINDOW_DAYS } from './orders-rescan.ts';

// Первый запуск: начинаем с позавчера и идём назад.
assert.deepEqual(nextRescanDay('2026-10-05', null), { day: '2026-10-03', next: '2026-10-02' });
assert.deepEqual(nextRescanDay('2026-10-05', '2026-09-20'), { day: '2026-09-20', next: '2026-09-19' });
// Дошли до края окна — возвращаемся к началу.
const oldest = '2026-09-04'; // 2 + 30 - 1 = 31 день назад
assert.equal(nextRescanDay('2026-10-05', oldest).next, '2026-10-03');
assert.equal(nextRescanDay('2026-10-05', '2026-08-01').day, '2026-10-03', 'устаревший курсор сбрасывается');
assert.equal(nextRescanDay('2026-10-05', '2026-10-05').day, '2026-10-03', 'курсор из будущего сбрасывается');
assert.equal(RESCAN_WINDOW_DAYS, 30);

// Строки: без srid не берём, дату ставим днём пересбора, ничего не удаляем (только upsert-строки).
const rows = rescanRows('cab', '2026-09-20', [
    { srid: 'a', nmId: 1, barcode: 'b', priceWithDisc: 100 },
    { nmId: 2 },
    { srid: 'c', nmId: 3, isReturn: true },
], () => 100);
assert.equal(rows.length, 2);
assert.equal(rows[0].order_date, '2026-09-20');
assert.equal(rows[1].is_return, true);
console.log('orders-rescan_test: ok');

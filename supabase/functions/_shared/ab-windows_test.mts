import assert from 'node:assert/strict';
import { buildVariantWindows, labelAt, parseWbMoscowDate } from './ab-windows.ts';

const L = (label: string, at: string, action?: string) => ({ variant_label: label, created_at: at, action });

// обычный активный тест: хвост идёт до «сейчас»
{
    const now = new Date('2026-10-08T12:00:00Z');
    const w = buildVariantWindows([L('1', '2026-10-08T10:00:00Z', 'start'), L('2', '2026-10-08T11:00:00Z', 'rotate')], now);
    assert.deepEqual(w.map((x) => [x.label, x.start.toISOString(), x.end.toISOString()]), [
        ['1', '2026-10-08T10:00:00.000Z', '2026-10-08T11:00:00.000Z'],
        ['2', '2026-10-08T11:00:00.000Z', '2026-10-08T12:00:00.000Z'],
    ]);
}
// остановка закрывает окно и окна не открывает; после стопа тест ничего не набирает
{
    const w = buildVariantWindows([L('1', '2026-10-08T15:50:00Z', 'start'), L('2', '2026-10-08T16:30:00Z', 'rotate'), L('2', '2026-10-08T18:10:00Z', 'stop')], new Date('2026-10-15T00:00:00Z'));
    assert.equal(w.length, 2);
    assert.equal(w[1].end.toISOString(), '2026-10-08T18:10:00.000Z');
    assert.equal(labelAt(w, new Date('2026-10-09T05:00:00Z')), null);
}
// завершённый тест: хвост закрывается в finished_at, записи после остановки игнорируются
{
    const cap = new Date('2026-10-08T18:10:11Z');
    const w = buildVariantWindows([L('1', '2026-10-08T18:00:00Z', 'rotate'), L('2', '2026-10-08T18:10:11.117Z', 'stop'), L('1', '2026-10-09T09:09:58Z', 'start')], cap);
    assert.equal(w.length, 1);
    assert.equal(w[0].end.toISOString(), '2026-10-08T18:10:11.000Z');
    assert.equal(labelAt(w, new Date('2026-10-12T00:00:00Z')), null);
}
// московское время заказа
assert.equal(parseWbMoscowDate('2026-10-15T00:33:54')?.toISOString(), '2026-10-14T21:33:54.000Z');
assert.equal(parseWbMoscowDate('2026-10-15T00:33:54Z')?.toISOString(), '2026-10-15T00:33:54.000Z');
assert.equal(parseWbMoscowDate('2026-10-15T00:33:54+03:00')?.toISOString(), '2026-10-14T21:33:54.000Z');
assert.equal(parseWbMoscowDate(''), null);
assert.equal(parseWbMoscowDate('мусор'), null);
console.log('ab-windows: ok');

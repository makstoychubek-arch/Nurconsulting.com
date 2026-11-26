import assert from 'node:assert/strict';
import { planStatusChanges } from './alina-status-watch.ts';
import { parseRazdachiSheet } from './alina-razdachi.ts';

const head = ['Товар', 'Вид', 'Ссылка ТГ', 'Дата заказа', 'Статус'];
const mk = (st: string) => parseRazdachiSheet([head, ['Пижама', 'б', '@anna', '28.11.2026', st], ['Пижама', 'б', '@boris', '28.11.2026', 'Ищет товар']], 2026)!;
const base = planStatusChanges(null, mk('Забрал'));
assert.equal(base.changes.length, 0, 'первый запуск только снимок');
assert.equal(planStatusChanges(base.snap, mk('ШК получен')).changes.length, 0, 'статусы Алины не события');
const c = planStatusChanges(base.snap, mk('Отзыв согласован')).changes;
assert.equal(c.length, 1);
assert.equal(c[0].tg, 'anna');
assert.match(c[0].reply || '', /согласован/);
const m = planStatusChanges(base.snap, mk('Менеджер ведёт')).changes[0];
assert.equal(m.reply, null);
assert.equal(m.silence, true);
assert.equal(planStatusChanges(base.snap, mk('Забрал')).changes.length, 0);
console.log('PASS: alina-status-watch');

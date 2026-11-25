// «Золотые чаты» Алины: каждая найденная в бою ошибка превращается в проверку (25 ноября 2026).
import assert from 'node:assert/strict';
import { weekdayDate, pickupDateFromText } from './alina-dates.ts';
import { parseAnswerKind, worthClassifying } from './alina-intent-core.ts';
import { pickAckEmoji, ACK_EMOJIS } from './alina-ack.ts';
import { ALINA_VERSION } from './alina-version.ts';

const wed = Date.parse('2026-11-25T12:00:00Z'); // среда
assert.equal(weekdayDate('вторник давайте', wed), '01.12.2026', 'дни недели в дате интеграции');
assert.equal(weekdayDate('в пятницу', wed), '27.11.2026');
assert.equal(weekdayDate('в среду', wed), '02.12.2026', 'сегодня среда: следующая через неделю');
assert.equal(weekdayDate('завтра', wed), '');
assert.equal(parseAnswerKind('yes'), 'yes');
assert.equal(parseAnswerKind('YES '), 'yes');
assert.equal(parseAnswerKind('maybe'), 'other', 'непонятный ответ модели не считаем согласием');
assert.equal(worthClassifying('Да😍'), true);
assert.equal(worthClassifying('https://t.me/x'), false);
assert.equal(worthClassifying('x'.repeat(80)), false);
for (let i = 0; i < 20; i++) assert.ok(ACK_EMOJIS.includes(pickAckEmoji(['❤️'])) && pickAckEmoji(['❤️']) !== '❤️');
assert.equal(pickupDateFromText('Можно товар будет забрать 1 числа ?', wed), '01.12.2026', 'забор 1 числа: следующий месяц, ведь сегодня 25');
assert.equal(pickupDateFromText('2 числа забрать ?', wed), '02.12.2026');
assert.equal(pickupDateFromText('заберу 30.11', wed), '30.11.2026');
assert.equal(pickupDateFromText('заберу завтра', wed), '');
assert.equal(ALINA_VERSION, '2.0');
console.log('PASS: alina-regression');

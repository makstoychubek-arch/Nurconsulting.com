// Тест передачи вопроса менеджеру и возврата ответа. Подставные Telegram и база, токены и сеть не нужны.
// Запуск: node supabase/functions/_shared/alina-manager_test.mjs (Node 22.13+).
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import assert from 'node:assert/strict';

const code = readFileSync(new URL('./alina-manager.ts', import.meta.url), 'utf8')
  .replace(/^import .*\n/m, '').replace(/^export /gm, '');
const owner = 7159099638;
const group = -4465341061;
const manager = 555000111; // менеджер со своего аккаунта, не @nurcon

function setup() {
  const messages = [];
  const rows = [];
  const database = { from(table) {
    if (table === 'telegram_bot_secrets') {
      const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: { token: 'mock' } }) };
      return q;
    }
    assert.equal(table, 'alina_manager_questions');
    return {
      insert: async (row) => { rows.push({ delivery_state: 'pending', ...row }); return {}; },
      update(patch) {
        const filters = {};
        const apply = () => {
          const row = rows.find((r) => Object.entries(filters).every(([k, v]) => r[k] === v));
          return row ? Object.assign(row, patch) : null;
        };
        const q = {
          match: (f) => { Object.assign(filters, f); return q; },
          eq: (k, v) => { filters[k] = v; return q; },
          select: () => q,
          maybeSingle: async () => ({ data: apply() }),
          then: (resolve) => resolve({ data: apply() }),
        };
        return q;
      },
    };
  } };
  // clientMode управляет только отправкой клиенту: ok | refused | timeout | http500
  const net = { clientMode: 'ok' };
  const fakeTelegram = async (_, request) => {
    const body = JSON.parse(request.body);
    messages.push(body);
    if (body.chat_id === owner && body.business_connection_id && body.text !== 'Минутку, уточню.') {
      if (net.clientMode === 'timeout') throw new DOMException('The operation timed out', 'TimeoutError');
      if (net.clientMode === 'http500') return { ok: false, status: 502, json: async () => ({ ok: false }) };
      if (net.clientMode === 'refused') return { ok: false, status: 403, json: async () => ({ ok: false, description: 'Forbidden' }) };
    }
    const id = 400 + messages.length;
    return { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: id } }) };
  };
  const run = new Function('getAdminClient', 'fetch', stripTypeScriptTypes(code) + '\nreturn processAlinaManagerTest')(() => database, fakeTelegram);
  return { run, messages, rows, net };
}

const question = {
  chat: { type: 'private', id: owner }, from: { id: owner, username: 'nurcon' },
  business_connection_id: 'test', text: 'Можно поговорить с менеджером?',
};
const reply = (extra = {}) => ({
  chat: { id: group, type: 'group' }, from: { id: manager }, message_id: 700,
  reply_to_message: { message_id: 401 }, text: 'Да, я на связи. Чем помочь?', ...extra,
});
const messages_len = (m) => m.length;
const lastToGroup = (messages) => messages.filter((m) => m.chat_id === group).at(-1).text;

// 1. Обычный путь: вопрос в группу, «Минутку», ответ клиенту ровно один раз
{
  const { run, messages, rows } = setup();
  assert.equal(await run('', { business_message: { ...question, from: { id: 123 } } }), false);
  assert.equal(await run('', { business_message: { ...question, text: 'Привет, где мой заказ?' } }), false, 'другая фраза от @nurcon идёт обычным путём');
  assert.equal(messages_len(messages), 0);
  assert.equal(await run('', { business_message: question }), true);
  assert.equal(messages[0].chat_id, group);
  const [line1, line2] = messages[0].text.split('\n');
  assert.equal(line1, '@nurcon', 'логин на первой строке');
  assert.equal(line2, 'ТЕСТ · Можно поговорить с менеджером?', 'вопрос на второй');
  assert.deepEqual(messages[0].reply_markup, { inline_keyboard: [[{ text: 'Скопировать @nurcon', copy_text: { text: '@nurcon' } }]] }, 'кнопка копирует только логин с @');
  assert.equal(messages[1].text, 'Минутку, уточню.');
  assert.equal(await run('', { message: reply({ from: { id: 999, is_bot: true } }) }), false, 'ответ от бота игнорируется');
  assert.equal(await run('', { message: reply() }), true, 'ответ менеджера со своего аккаунта принят');
  assert.deepEqual(messages[2], { chat_id: owner, business_connection_id: 'test', text: reply().text });
  assert.equal(rows[0].delivery_state, 'sent');
  await run('', { message: reply() });
  assert.equal(messages.length, 4, 'повторный реплай ничего не отправляет');
  console.log('ok   обычный путь, чужие отправители и дубль');
}

// 1б. Логин берётся у автора каждого обращения; без логина кнопки нет
{
  for (const [username, expected] of [['alina_test77', '@alina_test77'], [undefined, null], ['bad name!', null], ['abc', null]]) {
    const { run, messages } = setup();
    await run('', { business_message: { ...question, from: { id: owner, username } } });
    assert.equal(messages[0].text.split('\n')[0], expected ?? 'Без логина · чат ' + owner);
    if (expected) assert.deepEqual(messages[0].reply_markup.inline_keyboard[0][0], { text: 'Скопировать ' + expected, copy_text: { text: expected } });
    else assert.equal(messages[0].reply_markup, undefined, 'у клиента без логина кнопки нет: ' + username);
  }
  console.log('ok   логин автора подставляется, без логина кнопки нет');
}

// 2. Отказ Telegram: заявка снова pending, менеджер видит «не доставлен», повторный ответ уходит
{
  const { run, messages, rows, net } = setup();
  await run('', { business_message: question });
  net.clientMode = 'refused';
  await run('', { message: reply() });
  assert.equal(rows[0].delivery_state, 'pending', 'после отказа заявка возвращается в pending');
  assert.match(lastToGroup(messages), /не доставлен/i);
  assert.doesNotMatch(lastToGroup(messages), /отправлен клиенту/);
  net.clientMode = 'ok';
  await run('', { message: reply({ message_id: 701 }) });
  assert.equal(rows[0].delivery_state, 'sent', 'повтор после отказа доставляет ответ');
  assert.equal(messages.filter((m) => m.chat_id === owner && m.text === reply().text).length, 2, 'две попытки: отказ и успех');
  console.log('ok   отказ Telegram: pending, менеджер уведомлён, повтор доставляет');
}

// 3. Таймаут и ошибка 5xx: неизвестно, принял ли Telegram. Не pending, автоповтора нет, менеджер предупреждён
for (const mode of ['timeout', 'http500']) {
  const { run, messages, rows, net } = setup();
  await run('', { business_message: question });
  net.clientMode = mode;
  await run('', { message: reply() });
  assert.equal(rows[0].delivery_state, 'unconfirmed', mode + ': состояние «неизвестно»');
  assert.match(lastToGroup(messages), /Неизвестно, дошёл ли ответ/);
  assert.doesNotMatch(lastToGroup(messages), /не доставлен:|отправлен клиенту/);
  const toClient = () => messages.filter((m) => m.chat_id === owner && m.text === reply().text).length;
  assert.equal(toClient(), 1);
  net.clientMode = 'ok';
  await run('', { message: reply({ message_id: 701 }) });
  assert.equal(toClient(), 1, mode + ': повторный реплай не отправляет ответ клиенту второй раз');
  assert.equal(rows[0].delivery_state, 'unconfirmed');
  console.log('ok   ' + mode + ': unconfirmed, автоповтора нет, менеджер предупреждён');
}

console.log('PASS: alina-manager: обычный путь, отказ Telegram, таймаут');

// Тест передачи вопроса менеджеру и возврата ответа. Подставные Telegram и база, токены и сеть не нужны.
// Запуск: node supabase/functions/_shared/alina-manager_test.mjs (Node 22.13+).
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import assert from 'node:assert/strict';

const code = readFileSync(new URL('./alina-manager.ts', import.meta.url), 'utf8')
  .replace(/^import .*\n/gm, '').replace(/^export /gm, '');
const owner = 7159099638;
const group = -1004465341061;
const manager = 555000111; // менеджер со своего аккаунта, не @nurcon
const DEFAULTS = { read: true, typing: true, pauseMaxSec: 3, useName: true, phrases: ['Минутку, уточню.', 'Секунду, сейчас уточню.', 'Сейчас спрошу и вернусь к вам.'], remindMin: 10, reactions: true, copyButton: true };
const mgrFrom = { id: manager, first_name: 'Марлен', last_name: 'Тойчубеков' };

function setup() {
  const messages = [];   // sendMessage
  const calls = [];      // все вызовы Telegram по порядку: { method, body }
  const rows = [];
  const seen = new Set();
  const clock = { now: Date.parse('2026-11-17T12:00:00Z') };
  const net = { clientMode: 'ok', reactions: true };
  const settings = { ...DEFAULTS, phrases: [...DEFAULTS.phrases] };
  const query = (table, state) => {
    const f = []; let patch = null; let op = 'select';
    const match = (r) => f.every(([k, kind, v]) => kind === 'eq' ? r[k] === v : kind === 'is' ? (v === null ? r[k] == null : r[k] === v) : kind === 'lt' ? r[k] < v : true);
    const q = {
      select: () => q,
      eq: (k, v) => { f.push([k, 'eq', v]); return q; },
      is: (k, v) => { f.push([k, 'is', v]); return q; },
      lt: (k, v) => { f.push([k, 'lt', v]); return q; },
      match: (m) => { for (const [k, v] of Object.entries(m)) f.push([k, 'eq', v]); return q; },
      limit: () => q,
      update: (p) => { op = 'update'; patch = p; return q; },
      maybeSingle: async () => {
        const row = state.rows.find(match);
        if (op === 'update' && row) Object.assign(row, patch);
        return { data: row ? { ...row } : null };
      },
      then: (resolve) => {
        const hit = state.rows.filter(match);
        if (op === 'update') hit.forEach((r) => Object.assign(r, patch));
        resolve({ data: hit.map((r) => ({ ...r })), error: null });
      },
    };
    return q;
  };
  const database = { from(table) {
    if (table === 'telegram_bot_secrets') { const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: { token: 'mock' } }) }; return q; }
    if (table === 'alina_selfbuy_events') return { insert: async (r) => seen.has(r.payload.update_id) ? { error: { code: '23505' } } : (seen.add(r.payload.update_id), { error: null }) };
    assert.equal(table, 'alina_manager_questions');
    return {
      insert: async (row) => { rows.push({ delivery_state: 'pending', reminded_at: null, created_at: new Date(clock.now).toISOString(), ...row }); return {}; },
      select: () => query(table, { rows }).select(),
      update: (p) => query(table, { rows }).update(p),
    };
  } };
  const fakeTelegram = async (url, request) => {
    const method = String(url).split('/').pop();
    const body = JSON.parse(request.body);
    calls.push({ method, body });
    const ok = (result = true) => ({ ok: true, status: 200, json: async () => ({ ok: true, result }) });
    if (method === 'sendChatAction' || method === 'readBusinessMessage' || method === 'editMessageText') return ok();
    if (method === 'setMessageReaction') return net.reactions ? ok() : { ok: false, status: 400, json: async () => ({ ok: false, description: 'REACTION_INVALID' }) };
    messages.push(body);
    if (body.chat_id === owner && body.business_connection_id && !['Минутку', 'Секунду', 'Сейчас', 'Ещё'].some((w) => String(body.text).includes(w))) {
      if (net.clientMode === 'timeout') throw new DOMException('The operation timed out', 'TimeoutError');
      if (net.clientMode === 'http500') return { ok: false, status: 502, json: async () => ({ ok: false }) };
      if (net.clientMode === 'refused') return { ok: false, status: 403, json: async () => ({ ok: false, description: 'Forbidden' }) };
    }
    return ok({ message_id: 400 + messages.length });
  };
  const lib = new Function('getAdminClient', 'fetch', 'setTimeout', 'loadAlinaSettings',
    stripTypeScriptTypes(code) + '\nreturn { processAlinaManagerTest, remindAlinaManager, alinaHoldPhrase, alinaTypingMs }')(() => database, fakeTelegram, (f) => f(), async () => settings);
  const run = lib.processAlinaManagerTest;
  return { run, messages, calls, rows, net, clock, lib, settings };
}

const question = {
  chat: { type: 'private', id: owner }, from: { id: owner, username: 'nurcon', first_name: 'Мара' },
  business_connection_id: 'test', message_id: 90, text: 'Можно поговорить с менеджером?',
};
const reply = (extra = {}) => ({
  chat: { id: group, type: 'group' }, from: mgrFrom, message_id: 700,
  reply_to_message: { message_id: 401 }, text: 'Да, я на связи. Чем помочь?', ...extra,
});
const toClient = (m, text) => m.filter((x) => x.chat_id === owner && x.text === text);
const reactionsOf = (calls) => calls.filter((c) => c.method === 'setMessageReaction').map((c) => c.body.reaction[0].emoji);
const groupTexts = (m) => m.filter((x) => x.chat_id === group).map((x) => x.text);

// 1. Обычный путь: вопрос в группу, «живая» фраза, ответ клиенту ровно один раз, итог реакцией
{
  const { run, messages, calls, rows } = setup();
  assert.equal(await run('', { business_message: { ...question, from: { id: 123 } } }), false);
  assert.equal(await run('', { business_message: { ...question, text: 'Привет, где мой заказ?' } }), false, 'другая фраза от @nurcon идёт обычным путём');
  assert.equal(messages.length, 0);
  assert.equal(await run('', { update_id: 2, business_message: question }), true);
  const [line1, line2] = messages[0].text.split('\n');
  assert.equal(line1, '@nurcon', 'логин на первой строке');
  assert.equal(line2, 'ТЕСТ · Можно поговорить с менеджером?', 'вопрос на второй');
  assert.deepEqual(messages[0].reply_markup, { inline_keyboard: [[{ text: 'Скопировать @nurcon', copy_text: { text: '@nurcon' } }]] });
  assert.equal(messages[0].chat_id, group);
  assert.equal(messages[1].text, 'Мара, сейчас спрошу и вернусь к вам.', 'имя клиента и вариант фразы по номеру обновления');
  assert.deepEqual(calls.slice(0, 2).map((c) => c.method), ['readBusinessMessage', 'sendMessage'], 'сначала «прочитано», потом вопрос в группу');
  assert.deepEqual(calls.find((c) => c.method === 'readBusinessMessage').body, { business_connection_id: 'test', chat_id: owner, message_id: 90 });
  assert.equal(await run('', { message: reply({ from: { id: 999, is_bot: true } }) }), false, 'ответ от бота игнорируется');
  assert.equal(await run('', { message: reply() }), true, 'ответ менеджера со своего аккаунта принят');
  assert.deepEqual(messages[2], { chat_id: owner, business_connection_id: 'test', text: reply().text });
  assert.equal(rows[0].delivery_state, 'sent');
  assert.equal(rows[0].answered_by, manager);
  assert.equal(rows[0].answered_by_name, 'Марлен Тойчубеков');
  assert.deepEqual(reactionsOf(calls), ['❤'], 'доставлено: сердечко на ответ менеджера');
  assert.equal(groupTexts(messages).length, 1, 'в группе нет лишних сообщений, только обращение');
  const edit = calls.find((c) => c.method === 'editMessageText').body;
  assert.match(edit.text, /✅ Ответил: Марлен Тойчубеков$/);
  assert.doesNotMatch(edit.text, /Ответьте на это сообщение/);
  assert.equal(edit.message_id, 401);
  assert.deepEqual(edit.reply_markup.inline_keyboard[0][0].copy_text, { text: '@nurcon' }, 'кнопка копирования остаётся');
  const before = calls.length;
  await run('', { message: reply() });
  await run('', { message: reply({ message_id: 701, from: { id: 777, first_name: 'Другой' } }) });
  assert.equal(calls.length, before, 'повторный и второй реплай ничего не отправляют: берёт один менеджер');
  assert.equal(toClient(messages, reply().text).length, 1);
  console.log('ok   обычный путь: прочитано, фраза, ответ один раз, ❤ без лишних сообщений, «Ответил: …», второй менеджер блокирован');
}

// 1б. Живые фразы и имя
{
  const { lib } = setup();
  const set = new Set([0, 1, 2].map((i) => lib.alinaHoldPhrase(undefined, i)));
  assert.equal(set.size, 3, 'три разные фразы');
  assert.equal(lib.alinaHoldPhrase(undefined, 0), 'Минутку, уточню.');
  assert.equal(lib.alinaHoldPhrase('Мара', 0), 'Мара, минутку, уточню.');
  assert.equal(lib.alinaHoldPhrase('<b>Мара</b>\n', 0), 'bМараb, минутку, уточню.', 'служебные символы из имени убираются');
  assert.equal(lib.alinaHoldPhrase('', 5), 'Сейчас спрошу и вернусь к вам.');
  console.log('ok   живые фразы и имя клиента');
}

// 1в. Логин автора; без логина кнопки нет
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

// 2. Отказ Telegram: pending, 👎 без лишних сообщений, повтор доставляет; без реакций пишем текстом
{
  const { run, messages, calls, rows, net } = setup();
  await run('', { business_message: question });
  net.clientMode = 'refused';
  await run('', { message: reply() });
  assert.equal(rows[0].delivery_state, 'pending');
  assert.deepEqual(reactionsOf(calls), ['👎'], 'не доставлено: дизлайк');
  assert.equal(groupTexts(messages).length, 1, 'лишнего текста в группе нет');
  net.clientMode = 'ok';
  await run('', { message: reply({ message_id: 701 }) });
  assert.equal(rows[0].delivery_state, 'sent', 'повтор после отказа доставляет ответ');
  assert.deepEqual(reactionsOf(calls), ['👎', '❤']);
  assert.equal(toClient(messages, reply().text).length, 2, 'две попытки: отказ и успех');
  const noReact = setup();
  await noReact.run('', { business_message: question });
  noReact.net.reactions = false;
  await noReact.run('', { message: reply() });
  assert.ok(groupTexts(noReact.messages).includes('Ответ отправлен клиенту.'), 'реакции недоступны: короткий текст вместо них');
  console.log('ok   отказ: 👎 без текста, повтор доставляет, запасной текст без реакций');
}

// 3. Таймаут и 5xx: неизвестно, принял ли Telegram. Не pending, автоповтора нет, менеджер предупреждён текстом
for (const mode of ['timeout', 'http500']) {
  const { run, messages, calls, rows, net } = setup();
  await run('', { business_message: question });
  net.clientMode = mode;
  await run('', { message: reply() });
  assert.equal(rows[0].delivery_state, 'unconfirmed', mode + ': состояние «неизвестно»');
  assert.match(groupTexts(messages).at(-1), /Неизвестно, дошёл ли ответ/);
  assert.deepEqual(reactionsOf(calls), ['🤔']);
  assert.equal(toClient(messages, reply().text).length, 1);
  net.clientMode = 'ok';
  await run('', { message: reply({ message_id: 701 }) });
  assert.equal(toClient(messages, reply().text).length, 1, mode + ': повторный реплай не отправляет ответ клиенту второй раз');
  assert.equal(rows[0].delivery_state, 'unconfirmed');
  console.log('ok   ' + mode + ': unconfirmed, 🤔 и предупреждение, автоповтора нет');
}

// 4. Напоминание: через 10 минут без ответа, один раз, отвеченные не трогаем
{
  const { run, messages, calls, rows, clock, lib } = setup();
  await run('', { business_message: question });
  const created = clock.now;
  assert.equal(await lib.remindAlinaManager('', created + 9 * 60e3), 0, 'до 10 минут тихо');
  const n = messages.length;
  assert.equal(await lib.remindAlinaManager('', created + 11 * 60e3), 1);
  const added = messages.slice(n);
  assert.equal(added[0].chat_id, group);
  assert.equal(added[0].reply_parameters.message_id, 401, 'напоминание ответом на само обращение');
  assert.match(added[0].text, /ждёт ответа/);
  assert.deepEqual(added[1], { chat_id: owner, business_connection_id: 'test', text: 'Ещё уточняю, скоро вернусь к вам.' });
  assert.ok(calls.some((c) => c.method === 'sendChatAction' && c.body.chat_id === owner), 'перед фразой клиенту «печатает»');
  assert.equal(await lib.remindAlinaManager('', created + 30 * 60e3), 0, 'второго напоминания нет');
  assert.equal(messages.length, n + 2);
  // отвеченное обращение не напоминаем
  const t = setup();
  await t.run('', { business_message: question });
  await t.run('', { message: reply() });
  const m = t.messages.length;
  assert.equal(await t.lib.remindAlinaManager('', t.clock.now + 60 * 60e3), 0);
  assert.equal(t.messages.length, m);
  console.log('ok   напоминание через 10 минут один раз, отвеченные не трогаются');
}
// 5. Настройки с сайта: каждая действительно меняет поведение
{
  const t = setup(); Object.assign(t.settings, { read: false, typing: false, useName: false, phrases: ['Сейчас вернусь.'], reactions: false, copyButton: false });
  await t.run('', { update_id: 5, business_message: question });
  assert.ok(!t.calls.some((c) => c.method === 'readBusinessMessage'), 'прочитано выключено');
  assert.ok(!t.calls.some((c) => c.method === 'sendChatAction'), '«печатает» выключено');
  assert.equal(t.messages[0].reply_markup, undefined, 'кнопки копирования нет');
  assert.equal(t.messages[1].text, 'Сейчас вернусь.', 'своя фраза без имени');
  await t.run('', { message: reply() });
  assert.equal(t.calls.filter((c) => c.method === 'setMessageReaction').length, 0, 'реакции выключены');
  assert.ok(groupTexts(t.messages).includes('Ответ отправлен клиенту.'), 'итог текстом');
  assert.equal(toClient(t.messages, reply().text).length, 1);
  const edit = t.calls.find((c) => c.method === 'editMessageText').body;
  assert.equal(edit.reply_markup, undefined, 'после ответа кнопки тоже нет');
  const r = setup(); r.settings.remindMin = 2;
  await r.run('', { business_message: question });
  assert.equal(await r.lib.remindAlinaManager('', r.clock.now + 3 * 60e3), 1, 'напоминание через 2 минуты по настройке');
  assert.match(r.messages.find((m) => /ждёт ответа/.test(m.text || '')).text, /больше 2 мин/);
  const typ = setup().lib.alinaTypingMs;
  assert.equal(typ('x'.repeat(200), 1500), 1500, 'пауза ограничена максимумом из настроек');
  assert.equal(typ('Минутку, уточню.', 6000), 980);
  assert.equal(typ('', 1000), 800);
  console.log('ok   настройки: прочитано, «печатает», имя, фразы, реакции, кнопка, срок напоминания');
}

console.log('PASS: alina-manager: обычный путь, реакции, фразы, напоминание, отказ и таймаут');

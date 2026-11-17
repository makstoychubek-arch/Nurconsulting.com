// Проверка тестового вебхука вместе с настоящим alina-manager.ts на подставных Telegram и базе. Сеть и токены не нужны.
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import assert from 'node:assert/strict';

const load = (path) => stripTypeScriptTypes(readFileSync(new URL(path, import.meta.url), 'utf8')
  .replace(/^import .*\n/gm, '').replace(/^export /gm, ''));
const owner = 7159099638;
const group = -1004465341061;
const SECRET = 'test-secret-0123456789-abcdefghij';

function setup(env = {}) {
  const sent = [];
  const rows = [];
  const seen = new Set();
  const db = { from(table) {
    if (table === 'alina_selfbuy_events') return { insert: async () => ({ error: null }) };
    if (table === 'alina_test_updates') return { insert: async (r) => seen.has(r.update_id) ? { error: { code: '23505' } } : (seen.add(r.update_id), { error: null }) };
    if (table === 'telegram_bot_secrets') { const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: null }) }; return q; }
    assert.equal(table, 'alina_manager_questions');
    return {
      insert: async (row) => { rows.push({ delivery_state: 'pending', ...row }); return {}; },
      update(patch) {
        const f = {};
        const apply = () => { const r = rows.find((x) => Object.entries(f).every(([k, v]) => x[k] === v)); return r ? Object.assign(r, patch) : null; };
        const q = { match: (m) => { Object.assign(f, m); return q; }, eq: (k, v) => { f[k] = v; return q; }, select: () => q, maybeSingle: async () => ({ data: apply() }), then: (res) => res({ data: apply() }) };
        return q;
      },
    };
  } };
  const fetchMock = async (url, init) => {
    const method = String(url).split('/').pop();
    const body = JSON.parse(init.body || '{}');
    sent.push({ method, body });
    if (['sendChatAction', 'readBusinessMessage', 'editMessageText', 'setMessageReaction'].includes(method)) return { ok: true, status: 200, json: async () => ({ ok: true, result: true }) };
    if (method === 'getMe') return { ok: true, status: 200, json: async () => ({ ok: true, result: { username: 'nr_test_bot' } }) };
    if (method === 'getWebhookInfo') return { ok: true, status: 200, json: async () => ({ ok: true, result: { url: 'https://x.supabase.co/functions/v1/alina-manager-test', pending_update_count: 0 } }) };
    if (method === 'setWebhook') return { ok: true, status: 200, json: async () => ({ ok: true, result: true }) };
    return { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: 400 + sent.length } }) };
  };
  const manager = load('../functions/_shared/alina-manager.ts');
  const handler = load('./functions/alina-manager-test/handler.ts');
  const make = new Function('getAdminClient', 'fetch', 'Deno', 'setTimeout', 'loadAlinaSettings', manager + '\n' + handler + '\nreturn { processAlinaManagerTest, handleTestWebhook }');
  const lib = make(() => db, fetchMock, { env: { get: () => undefined } }, (f) => f(), async () => ({ read: true, typing: true, pauseMaxSec: 3, useName: true, phrases: ['Минутку, уточню.', 'Секунду, сейчас уточню.', 'Сейчас спрошу и вернусь к вам.'], remindMin: 10, reactions: true, copyButton: true }));
  const full = { SUPABASE_URL: 'https://testproj.supabase.co', ALINA_TEST_WEBHOOK_SECRET: SECRET, ALINA_BOT_TOKEN: 'TESTTOKEN', ...env };
  const deps = { env: (n) => full[n], db, process: lib.processAlinaManagerTest, fetch: fetchMock };
  const post = (update, headers = { 'x-telegram-bot-api-secret-token': SECRET }) =>
    lib.handleTestWebhook(new Request('https://testproj.supabase.co/functions/v1/alina-manager-test', { method: 'POST', headers, body: JSON.stringify(update) }), deps);
  const get = (action, headers = { 'x-alina-test-key': SECRET }) =>
    lib.handleTestWebhook(new Request('https://testproj.supabase.co/functions/v1/alina-manager-test?action=' + action, { method: 'POST', headers }), deps);
  return { post, get, sent, rows, lib, deps };
}

const question = { update_id: 1, business_message: { chat: { type: 'private', id: owner }, from: { id: owner, username: 'nurcon' }, business_connection_id: 'bc1', text: 'Можно поговорить с менеджером?' } };
const groupReply = (id, mid = 700) => ({ update_id: id, message: { chat: { id: group, type: 'group' }, from: { id: 555000111 }, message_id: mid, reply_to_message: { message_id: 401 }, text: 'Да, я на связи. Чем помочь?' } });
const texts = (s) => s.filter((m) => m.method === 'sendMessage').map((m) => m.body);

// защита
{
  const t = setup();
  assert.equal((await t.post(question, {})).status, 401, 'без секрета отказ');
  assert.equal((await t.post(question, { 'x-telegram-bot-api-secret-token': 'wrong' })).status, 401, 'неверный секрет отказ');
  assert.equal(t.sent.length, 0);
  assert.equal((await setup({ SUPABASE_URL: 'https://fiukyfyhotctvfdidktx.supabase.co' }).post(question)).status, 503, 'рабочий проект отвергается');
  assert.equal((await setup({ ALINA_TEST_WEBHOOK_SECRET: 'short' }).post(question)).status, 503, 'короткий секрет отвергается');
  assert.equal((await setup({ ALINA_BOT_TOKEN: '' }).post(question)).status, 503, 'без токена отказ');
  assert.equal((await t.get('info', {})).status, 401, 'служебные действия тоже под ключом');
  console.log('ok   секрет проверяется, рабочий проект и пустая настройка отвергаются');
}
// служебные действия
{
  const t = setup();
  const w = await (await t.get('set-webhook')).json();
  assert.equal(w.ok, true);
  const call = t.sent.find((m) => m.method === 'setWebhook').body;
  assert.equal(call.url, 'https://testproj.supabase.co/functions/v1/alina-manager-test');
  assert.equal(call.secret_token, SECRET);
  assert.deepEqual(call.allowed_updates, ['message', 'business_message', 'business_connection']);
  const info = await (await t.get('info')).text();
  assert.match(info, /nr_test_bot/);
  assert.ok(!info.includes('TESTTOKEN') && !info.includes(SECRET), 'ответ не раскрывает токен и секрет');
  console.log('ok   set-webhook регистрирует адрес с секретом, info без утечек');
}
// сценарий целиком
{
  const t = setup();
  assert.equal((await (await t.post(question)).json()).handled, true);
  const m = texts(t.sent);
  assert.equal(m[0].chat_id, group);
  assert.equal(m[0].text.split('\n').slice(0, 2).join('|'), '@nurcon|ТЕСТ · Можно поговорить с менеджером?');
  assert.deepEqual(m[1], { chat_id: owner, business_connection_id: 'bc1', text: 'Секунду, сейчас уточню.' }, 'update_id 1: вторая из трёх фраз');
  assert.equal((await (await t.post(question)).json()).duplicate, true, 'повтор доставки Telegram не создаёт второй вопрос');
  assert.equal(texts(t.sent).length, 2);
  assert.equal((await (await t.post(groupReply(2))).json()).handled, true);
  const toClient = () => texts(t.sent).filter((x) => x.chat_id === owner && /на связи/.test(x.text));
  assert.equal(toClient().length, 1);
  assert.equal(toClient()[0].business_connection_id, 'bc1');
  await t.post(groupReply(3, 701)); // второй реплай на тот же вопрос
  await t.post(groupReply(2));      // повторная доставка того же update
  assert.equal(toClient().length, 1, 'в личку ответ ушёл ровно один раз');
  assert.equal(t.rows[0].delivery_state, 'sent');
  console.log('ok   сценарий: вопрос, «Минутку», ответ в личку один раз, повторы без дубля');
}
// сбой после взятия update_id не вызывает повтор от Telegram
{
  const t = setup();
  t.deps.process = async () => { throw new Error('boom'); };
  const r = await t.post({ ...question, update_id: 9 });
  assert.equal(r.status, 200);
  console.log('ok   сбой обработки отвечает 200, повторной доставки не будет');
}
console.log('PASS: тестовый вебхук Алины');

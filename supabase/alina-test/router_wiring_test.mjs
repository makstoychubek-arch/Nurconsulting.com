// Проверка подключения тестового пути в telegram-router: свои стабы вместо Telegram, базы и общего кода.
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import assert from 'node:assert/strict';

const src = stripTypeScriptTypes(readFileSync(new URL('../functions/telegram-router/index.ts', import.meta.url), 'utf8').replace(/^import .*\n/gm, ''));
const owner = 7159099638, group = -1004465341061, SECRET = 'alina-secret';
function setup({ manager = async () => false } = {}) {
  const calls = { alina: 0, manager: 0 };
  let handler;
  const stubs = {
    createClient: () => ({ from: () => ({ insert: async () => ({}) }) }),
    getTelegramChatId: () => '', getTelegramToken: () => 'x',
    applyRestockTelegramReply: async () => ({ handled: false }), setTelegramReaction: async () => {},
    unwrapTelegramMessage: () => null, alinaWebhookSecret: async () => SECRET,
    processAlinaTelegramUpdate: async () => { calls.alina++; },
    managerGroupId: async () => group, processAlinaManagerTest: async (...a) => { calls.manager++; return manager(...a); },
    isTeamChatId: () => false, replyTeamChat: async () => ({}),
    Deno: { env: { get: (k) => (k === 'ALINA_BOT_TOKEN' ? 'tok' : undefined) }, serve: (h) => { handler = h; } },
  };
  new Function(...Object.keys(stubs), src)(...Object.values(stubs));
  const post = async (bot, update, secret = SECRET) => {
    const r = await handler(new Request('https://x/functions/v1/telegram-router?bot=' + bot, { method: 'POST', headers: { 'x-telegram-bot-api-secret-token': secret }, body: JSON.stringify(update) }));
    return { status: r.status, body: await r.json() };
  };
  return { post, calls };
}
const biz = (from, text = 'x') => ({ update_id: 1, business_message: { chat: { type: 'private', id: from }, from: { id: from }, business_connection_id: 'b', text } });
const grp = { update_id: 2, message: { chat: { id: group, type: 'group' }, from: { id: 555 }, message_id: 7, reply_to_message: { message_id: 401 }, text: 'Да' } };

{ // чужой клиент идёт старым путём
  const t = setup();
  assert.equal((await t.post('alina', biz(123))).status, 200);
  assert.deepEqual(t.calls, { alina: 1, manager: 1 });
}
{ // @nurcon с тестовой фразой уходит в тестовый путь и мимо обычной обработки
  const t = setup({ manager: async () => true });
  const r = await t.post('alina', biz(owner, 'Можно поговорить с менеджером?'));
  assert.equal(r.body.manager_test, true);
  assert.deepEqual(t.calls, { alina: 0, manager: 1 });
}
{ // неверный секрет: ничего не вызывается
  const t = setup({ manager: async () => true });
  assert.equal((await t.post('alina', biz(owner), 'bad')).status, 401);
  assert.equal((await t.post('alina', grp, 'bad')).status, 401);
  assert.deepEqual(t.calls, { alina: 0, manager: 0 });
}
{ // реплай менеджера в группе: бот alina и верный секрет
  const t = setup({ manager: async () => true });
  assert.equal((await t.post('alina', grp)).body.manager_test, true);
  assert.equal(t.calls.manager, 1);
  const other = setup({ manager: async () => true });
  await other.post('karina', grp);
  assert.equal(other.calls.manager, 0, 'другие боты тестовый путь не используют');
}
{ // сбой тестового пути не даёт повтор от Telegram и не задевает остальных клиентов
  const t = setup({ manager: async () => { throw new Error('boom'); } });
  assert.equal((await t.post('alina', biz(owner))).status, 200);
  assert.equal(t.calls.alina, 0);
}
console.log('PASS: telegram-router: тестовый путь Алины подключён только для alina, секрета и группы');

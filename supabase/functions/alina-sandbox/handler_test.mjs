// «Песочница» Алины: отдельный номер чата, ответы без Telegram, сброс, защита рабочей таблицы. Сеть не нужна.
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import assert from 'node:assert/strict';

const code = readFileSync(new URL('./handler.ts', import.meta.url), 'utf8').replace(/^export /gm, '');
const lib = new Function(stripTypeScriptTypes(code) + '\nreturn { handleSandbox, sandboxChatId, mskToday }')();

function setup(reply = { replies: ['Здравствуйте!'] }, opts = {}) {
  const calls = []; let lead = null, resets = 0, t = 1000;
  const deps = {
    handle: async (o) => { calls.push(o); if (opts.fail) throw new Error('boom'); lead = { status: 'ask_ad', deal_type: null, product_name: null }; return reply; },
    texts: () => [{ id: 'closed', group: 'Начало', label: 'Места закончились', vars: [], text: 'На сегодня места закончились' }],
    leadState: async () => lead, reset: async () => { resets++; lead = null; return !opts.resetFail; }, now: () => (t += 250),
  };
  return { calls, deps, resets: () => resets, run: (b, u = 'user-1') => lib.handleSandbox(b, u, deps) };
}

{ // номер чата: отрицательный, у каждого администратора свой, стабильный
  const a = lib.sandboxChatId('2f7d8960-0df4-4a17-be70-f2cb2ac0032e'), b = lib.sandboxChatId('другой');
  assert.ok(a < -1_000_000_000 && a > -2_000_000_000, 'отрицательный и вне диапазона настоящих чатов'); assert.notEqual(a, b); assert.equal(a, lib.sandboxChatId('2f7d8960-0df4-4a17-be70-f2cb2ac0032e'));
  console.log('ok   отдельный отрицательный номер чата на каждого администратора');
}
{ // отправка: сценарий вызывается как для обычного клиента, но без бота и с пометкой песочницы
  const t = setup(); const r = await t.run({ action: 'send', text: '  Здравствуйте, хочу участвовать  ', username: '@Test_User!' });
  assert.equal(r.status, 200); assert.deepEqual(r.body.replies, ['Здравствуйте!']); assert.equal(r.body.ms, 250); assert.equal(r.body.lead.status, 'ask_ad');
  const o = t.calls[0]; assert.equal(o.text, 'Здравствуйте, хочу участвовать'); assert.equal(o.username, 'Test_User'); assert.equal(o.botToken, null); assert.equal(o.sourceAccount, 'sandbox'); assert.ok(o.chatId < 0 && o.userId === o.chatId);
  assert.equal((await setup().run({ action: 'send', text: '' })).status, 400); assert.equal((await setup().run({ action: 'send', text: '   ' })).status, 400);
  const long = setup(); await long.run({ action: 'send', text: 'а'.repeat(5000) }); assert.equal(long.calls[0].text.length, 1500, 'длинный текст обрезается');
  const noLogin = setup(); await noLogin.run({ action: 'send', text: 'привет', username: '' }); assert.equal(noLogin.calls[0].username, 'sandbox_client');
  console.log('ok   отправка: как у клиента, без бота, с пометкой песочницы, пустой текст и длинный');
}
{ // фото ответов: ссылка, маленький файл как data-URL, большой с подписью
  const bytes = new Uint8Array([1, 2, 3]);
  const t = setup({ replies: ['Вот товар'], photos: [{ url: 'https://wb/img.jpg', caption: 'Фонарь' }, { bytes, mime: 'image/png', caption: 'Файл' }, { bytes: new Uint8Array(700_000), caption: 'Большой' }] });
  const r = await t.run({ action: 'send', text: 'фото' });
  assert.deepEqual(r.body.photos[0], { url: 'https://wb/img.jpg', caption: 'Фонарь' }); assert.equal(r.body.photos[1].url, 'data:image/png;base64,AQID'); assert.equal(r.body.photos[2].url, ''); assert.match(r.body.photos[2].caption, /Большой/);
  console.log('ok   фото в ответах Алины');
}
{ // сбой сценария, сброс, состояние
  const f = setup({ replies: [] }, { fail: true }); const r = await f.run({ action: 'send', text: 'привет' }); assert.equal(r.status, 500); assert.match(r.body.error, /не смогла ответить/);
  const t = setup(); await t.run({ action: 'send', text: 'привет' }); assert.equal((await t.run({ action: 'state' })).body.lead.status, 'ask_ad');
  assert.equal((await t.run({ action: 'reset' })).body.lead, null); assert.equal(t.resets(), 1); assert.equal((await t.run({ action: 'state' })).body.lead, null);
  assert.equal((await setup({ replies: [] }, { resetFail: true }).run({ action: 'reset' })).status, 500); assert.equal((await t.run({ action: 'нет' })).status, 400);
  console.log('ok   сбой сценария, начать заново, состояние диалога');
}
{ // защита рабочей таблицы: запись клиента в лист пропускается для песочницы
  const src = readFileSync(new URL('../_shared/alina-selfbuy.ts', import.meta.url), 'utf8');
  const i = src.indexOf('async function syncLeadToSheet(');
  assert.ok(i > 0 && /async function syncLeadToSheet\([^)]*\) \{\n  if \(await isSandboxLead\(db, leadId\)\) return;/.test(src.slice(i, i + 200)), 'запись в таблицу первым делом проверяет, что диалог не из песочницы');
  assert.match(src, /export async function isSandboxLead[\s\S]{0,400}source_account === 'sandbox' \|\| Number\(l\.chat_id\) < 0/, 'песочница узнаётся по source_account и отрицательному chat_id');
  console.log('ok   запись в рабочую таблицу пропускается для диалогов песочницы');
}
{ // время по Москве и вопрос менеджерам
  assert.equal(lib.mskToday('23:30', Date.parse('2026-11-18T10:00:00Z')), Date.parse('2026-11-18T20:30:00Z'), 'сегодняшний день по Москве');
  assert.equal(lib.mskToday('01:00', Date.parse('2026-11-17T22:30:00Z')), Date.parse('2026-11-17T22:00:00Z'), 'после полуночи по Москве уже следующий день');
  assert.equal(lib.mskToday('', 1), null); assert.equal(lib.mskToday('25:00', 1), null); assert.equal(lib.mskToday('мусор', 1), null);
  const t = setup({ replies: ['Минутку, уточню.'], escalate: { topic: 'manager', question: 'Клиент просит подключить менеджера.', group: -1007777 } });
  const r = await t.run({ action: 'send', text: 'Можно поговорить с менеджером?', now_msk: '23:30' });
  assert.ok(Number.isFinite(t.calls[0].nowMs), 'выбранное время передаётся в сценарий'); assert.deepEqual(r.body.escalate, { topic: 'manager', question: 'Клиент просит подключить менеджера.' }, 'песочница показывает, что ушло бы менеджерам');
  const none = setup(); await none.run({ action: 'send', text: 'привет' }); assert.equal(none.calls[0].nowMs, undefined, 'без выбранного времени действует настоящее');
  console.log('ok   время по Москве в песочнице и показ вопроса менеджерам');
}
{ // тексты для редактора
  const r = await setup().run({ action: 'texts' });
  assert.equal(r.status, 200); assert.equal(r.body.texts[0].id, 'closed'); assert.deepEqual(Object.keys(r.body.texts[0]).sort(), ['group', 'id', 'label', 'text', 'vars']);
  console.log('ok   список текстов Алины для редактора');
}
console.log('PASS: alina-sandbox');

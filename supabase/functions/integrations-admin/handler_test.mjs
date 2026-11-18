// Ключи интеграций: проверка у провайдера до сохранения, значения наружу не уходят, ошибки понятны. Сеть не нужна.
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import assert from 'node:assert/strict';

const code = readFileSync(new URL('./handler.ts', import.meta.url), 'utf8').replace(/^export /gm, '');
const lib = new Function(stripTypeScriptTypes(code) + '\nreturn { handleIntegrations, maskKey, parseServiceAccount, extractSheetId }')();

const SA = JSON.stringify({ client_email: 'alina@proj.iam.gserviceaccount.com', private_key: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n', project_id: 'proj' });
const KEY = 'sk-test-0123456789abcdefghij';
function setup({ openai = 200, token = 'tok', sheet = 200, env = [], check = { ok: true, title: 'Кэшбэки / Выкупы МАРС', tabs: ['Раздачи', 'График'], hasTab: true, header: true, rows: 8 } } = {}) {
  const store = new Map(); const calls = []; let forgot = 0; const links = [{ cabinet_id: 'cabOther', sheet_id: 'OTHERSHEET123456789012345', tab: 'Раздачи', enabled: true, last_sync_at: null, last_error: null }];
  const deps = {
    db: {
      list: async () => [...store.entries()].map(([key, v]) => ({ key, meta: v.meta, updated_at: '2026-11-17T00:00:00Z' })),
      get: async (k) => store.get(k)?.value ?? '',
      set: async (k, value, meta) => { store.set(k, { value, meta }); return true; },
      remove: async (k) => store.delete(k),
      activeSheetId: async () => 'SHEET1',
      cabinets: async () => [{ id: 'cab1', name: 'ИП МАРС' }, { id: 'cabOther', name: 'Baza' }],
      links: async () => links.map((l) => ({ ...l })),
      linkSheet: async (c, sid, tab) => { const i = links.findIndex((l) => l.cabinet_id === c); const row = { cabinet_id: c, sheet_id: sid, tab, enabled: true, last_sync_at: null, last_error: null }; if (i >= 0) links[i] = row; else links.push(row); return true; },
      unlinkSheet: async (c) => { const i = links.findIndex((l) => l.cabinet_id === c); if (i >= 0) links.splice(i, 1); return true; },
      usage: async () => ({ costUsd: 1.234, todayUsd: 0.1, calls: 40, errors: 2, lastError: 'insufficient_quota', lastErrorAt: '2026-11-18T09:00:00Z' }),
      budget: async () => 10,
    },
    checkSheetTab: async () => check,
    envHas: (n) => env.includes(n),
    fetch: async (url, init) => {
      calls.push(url);
      if (url.includes('api.openai.com')) return { ok: openai === 200, status: openai, json: async () => ({}) };
      return { ok: sheet === 200, status: sheet, json: async () => ({ properties: { title: 'Кэшбэки / Выкупы МАРС' } }) };
    },
    googleToken: async () => { if (!token) throw new Error('bad'); return token; },
    userId: 'u1', now: () => '2026-11-17T10:00:00Z', forget: () => { forgot++; },
  };
  return { deps, store, calls, links, forgot: () => forgot, run: (b) => lib.handleIntegrations(b, deps) };
}
const noLeak = (res, ...secrets) => { const s = JSON.stringify(res); for (const x of secrets) assert.ok(!s.includes(x), 'значение ключа не должно уходить наружу'); };

assert.equal(lib.maskKey(KEY), 'sk-…ghij'); assert.equal(lib.maskKey('short'), '••••');
assert.deepEqual(lib.parseServiceAccount(SA), { email: 'alina@proj.iam.gserviceaccount.com', project: 'proj' });
assert.equal(lib.parseServiceAccount('{"client_email":"x@y.com"}'), null); assert.equal(lib.parseServiceAccount('не json'), null);

{ // статус: пусто, окружение, база
  const t = setup({ env: ['OPENAI_API_KEY'] });
  let r = await t.run({ action: 'status' });
  assert.equal(r.body.openai.source, 'env'); assert.equal(r.body.google.configured, false);
  await t.run({ action: 'set_openai', api_key: KEY });
  r = await t.run({ action: 'status' }); assert.equal(r.body.openai.source, 'db'); assert.equal(r.body.openai.meta.mask, 'sk-…ghij'); noLeak(r, KEY);
  console.log('ok   статус: нет, из окружения, из базы; значение не раскрывается');
}
{ // OpenAI: проверка до сохранения
  const bad = setup({ openai: 401 }); let r = await bad.run({ action: 'set_openai', api_key: KEY });
  assert.equal(r.status, 400); assert.match(r.body.error, /не принял ключ/); assert.equal(bad.store.size, 0, 'неверный ключ не сохраняется'); noLeak(r, KEY);
  const short = setup(); r = await short.run({ action: 'set_openai', api_key: 'abc' }); assert.equal(r.status, 400); assert.equal(short.calls.length, 0, 'до обращения к OpenAI короткий ключ отвергается');
  const good = setup(); r = await good.run({ action: 'set_openai', api_key: KEY, model: 'gpt-4o' });
  assert.equal(r.body.ok, true); assert.equal(r.body.model, 'gpt-4o'); assert.equal(good.store.get('openai_api_key').value, KEY); assert.equal(good.forgot(), 1, 'кэш Алины сброшен');
  noLeak(r, KEY);
  assert.equal((await good.run({ action: 'set_openai', api_key: KEY, model: 'выдуманная' })).body.model, 'gpt-4o-mini', 'неизвестная модель заменяется');
  assert.equal((await good.run({ action: 'test', provider: 'openai' })).body.valid, true);
  console.log('ok   OpenAI: проверка у провайдера до сохранения, неверный и короткий ключ, модель, сброс кэша');
}
{ // Google: файл, токен, доступ к таблице
  const t = setup(); let r = await t.run({ action: 'set_google', json: SA });
  assert.equal(r.body.ok, true); assert.equal(r.body.email, 'alina@proj.iam.gserviceaccount.com'); assert.equal(r.body.sheet, true); assert.equal(r.body.title, 'Кэшбэки / Выкупы МАРС');
  noLeak(r, 'PRIVATE KEY', 'abc');
  const st = await t.run({ action: 'status' }); assert.equal(st.body.google.meta.email, 'alina@proj.iam.gserviceaccount.com'); noLeak(st, 'PRIVATE KEY');
  const noAccess = setup({ sheet: 403 }); r = await noAccess.run({ action: 'set_google', json: SA }); assert.equal(r.body.sheet, false, 'нет доступа к таблице: ключ сохранён, но это видно');
  assert.equal((await setup().run({ action: 'set_google', json: 'мусор' })).status, 400);
  const badTok = setup({ token: '' }); r = await badTok.run({ action: 'set_google', json: SA }); assert.equal(r.status, 400); assert.equal(badTok.store.size, 0, 'Google не принял: не сохраняем');
  assert.equal((await t.run({ action: 'test', provider: 'google' })).body.sheet, true);
  console.log('ok   Google: файл, токен, доступ к таблице, ошибки, значения не раскрываются');
}
{ // удаление и неизвестные действия
  const t = setup(); await t.run({ action: 'set_openai', api_key: KEY });
  assert.equal((await t.run({ action: 'remove', provider: 'openai' })).body.ok, true); assert.equal(t.store.size, 0);
  assert.equal((await t.run({ action: 'remove', provider: 'x' })).status, 400); assert.equal((await t.run({ action: 'нет' })).status, 400);
  assert.equal((await setup({ env: [] }).run({ action: 'test', provider: 'openai' })).status, 404, 'ключа только в окружении проверить отсюда нельзя');
  console.log('ok   удаление, неизвестные действия, ключ из окружения');
}
{ // расход ChatGPT и список кабинетов в статусе
  const r = await setup().run({ action: 'status' });
  assert.deepEqual([r.body.llm.costUsd, r.body.llm.budgetUsd, r.body.llm.lastError], [1.234, 10, 'insufficient_quota']);
  assert.deepEqual(r.body.sheets.map((x) => [x.name, !!x.link]), [['ИП МАРС', false], ['Baza', true]]);
  console.log('ok   статус: расход ChatGPT с бюджетом, кабинеты и привязки листов');
}
{ // привязка листа к кабинету
  assert.equal(lib.extractSheetId('https://docs.google.com/spreadsheets/d/1ZSdNfnflgwOQZFSm1qcvfOB94bnfipZu5fB3pDodrik/edit?gid=1'), '1ZSdNfnflgwOQZFSm1qcvfOB94bnfipZu5fB3pDodrik');
  assert.equal(lib.extractSheetId('1ZSdNfnflgwOQZFSm1qcvfOB94bnfipZu5fB3pDodrik'), '1ZSdNfnflgwOQZFSm1qcvfOB94bnfipZu5fB3pDodrik'); assert.equal(lib.extractSheetId('привет'), null);
  const SHEET = 'https://docs.google.com/spreadsheets/d/1ZSdNfnflgwOQZFSm1qcvfOB94bnfipZu5fB3pDodrik/edit';
  let t = setup(); assert.match((await t.run({ action: 'link_sheet', cabinet_id: 'cab1', sheet: SHEET })).body.error, /Сначала подключите Google/);
  await t.run({ action: 'set_google', json: SA });
  assert.match((await t.run({ action: 'link_sheet', cabinet_id: 'cab1', sheet: 'мусор' })).body.error, /ссылку на таблицу/);
  assert.equal((await t.run({ action: 'link_sheet', cabinet_id: 'нет', sheet: SHEET })).status, 404);
  assert.equal((await t.run({ action: 'link_sheet', cabinet_id: 'cab1', sheet: 'OTHERSHEET123456789012345' })).status, 409, 'таблица уже у другого кабинета');
  let r = await t.run({ action: 'link_sheet', cabinet_id: 'cab1', sheet: SHEET }); assert.equal(r.body.ok, true); assert.equal(r.body.title, 'Кэшбэки / Выкупы МАРС');
  assert.deepEqual(t.links.find((l) => l.cabinet_id === 'cab1').tab, 'Раздачи'); assert.equal(t.links.find((l) => l.cabinet_id === 'cab1').sheet_id, '1ZSdNfnflgwOQZFSm1qcvfOB94bnfipZu5fB3pDodrik');
  noLeak(r, 'PRIVATE KEY');
  assert.equal((await t.run({ action: 'unlink_sheet', cabinet_id: 'cab1' })).body.ok, true); assert.ok(!t.links.some((l) => l.cabinet_id === 'cab1'));
  const bad = [[{ ok: false }, /недоступна.*alina@proj\.iam\.gserviceaccount\.com/], [{ ok: true, tabs: ['Лист1'], hasTab: false }, /нет листа «Раздачи».*Лист1/], [{ ok: true, hasTab: true, header: false }, /не найдена шапка/]];
  for (const [check, re] of bad) { t = setup({ check }); await t.run({ action: 'set_google', json: SA }); r = await t.run({ action: 'link_sheet', cabinet_id: 'cab1', sheet: SHEET }); assert.equal(r.status, 400); assert.match(r.body.error, re); assert.ok(!t.links.some((l) => l.cabinet_id === 'cab1'), 'при отказе проверки привязки нет'); }
  console.log('ok   привязка листа: проверка доступа, листа и шапки до сохранения, чужая таблица, отвязка');
}
console.log('PASS: integrations-admin');

// Гонка за последнее место: в графике одно место, десять клиентов просят его. Всё в памяти: поддельные база и Google,
// рабочий лист и рабочая база не затрагиваются. Запуск: deno run -A supabase/alina-test/race-int.ts
type Row = Record<string, unknown>;
const T: Record<string, Row[]> = {
  alina_campaign: [{ id: 'c1', is_open: true, deal_type: 'cashback', cashback_pct: 70, slots_left: 1, sheet_id: 'SHEET123', cabinet_key: 'active', updated_at: '2026-11-18' }],
  alina_selfbuy_leads: [], alina_selfbuy_events: [], alina_settings: [], alina_manager_questions: [],
  telegram_bots: [{ id: 'alina', is_enabled: false, deleted_at: null }], llm_usage: [], alina_cabinet_sheets: [], telegram_bot_secrets: [],
};
let seq = 1;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const match = (row: Row, params: URLSearchParams) => {
  for (const [k, v] of params) {
    const m = v.match(/^(eq|neq|gt|gte|lt|lte|is|in)\.(.*)$/);
    if (!m || ['select', 'order', 'limit'].includes(k)) continue;
    const a = row[k], b = m[2];
    if (m[1] === 'eq' && String(a) !== b) return false;
    if (m[1] === 'neq' && String(a) === b) return false;
    if (m[1] === 'is' && (b === 'null' ? a != null : a == null)) return false;
    if (m[1] === 'in' && !b.replace(/[()]/g, '').split(',').includes(String(a))) return false;
    if (m[1] === 'gt' && !(String(a) > b)) return false;
    if (m[1] === 'gte' && !(String(a) >= b)) return false;
  }
  return true;
};
const server = Deno.serve({ port: 0, onListen: () => {} }, async (req) => {
  await sleep(3 + Math.random() * 12);
  const url = new URL(req.url); const table = url.pathname.split('/').pop() || '';
  const rows = T[table] ?? (T[table] = []);
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
  const single = /vnd.pgrst.object/.test(req.headers.get('accept') || ''); const ret = /return=representation/.test(req.headers.get('prefer') || '');
  const out = (arr: Row[]) => (single ? (arr.length === 1 ? json(arr[0]) : json({ code: 'PGRST116', message: 'no rows' }, 406)) : json(arr));
  if (req.method === 'GET') {
    let r = rows.filter((x) => match(x, url.searchParams));
    const ord = url.searchParams.get('order'); if (ord) { const [c, d] = ord.split('.'); r = [...r].sort((p, q) => (String(p[c]) < String(q[c]) ? -1 : 1) * (d === 'desc' ? -1 : 1)); }
    const lim = Number(url.searchParams.get('limit')); return out(lim ? r.slice(0, lim) : r);
  }
  if (req.method === 'POST') {
    const body = await req.json(); const made: Row[] = [];
    for (const b of (Array.isArray(body) ? body : [body]) as Row[]) {
      if (table === 'alina_selfbuy_leads' && rows.some((x) => x.telegram_user_id === b.telegram_user_id && x.chat_id === b.chat_id)) return json({ code: '23505', message: 'duplicate key' }, 409);
      const row = { id: 'id' + seq++, created_at: new Date().toISOString(), ...b }; rows.push(row); made.push(row);
    }
    return ret ? out(made) : new Response(null, { status: 201 });
  }
  if (req.method === 'PATCH') { const hit = rows.filter((x) => match(x, url.searchParams)); const b = await req.json(); hit.forEach((x) => Object.assign(x, b)); return ret ? out(hit) : new Response(null, { status: 204 }); }
  return json({});
});
Deno.env.set('SUPABASE_URL', `http://127.0.0.1:${(server.addr as Deno.NetAddr).port}`);
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test');

// временный ключ для подписи (настоящий Google не вызывается)
const gen = await new Deno.Command('sh', { args: ['-c', 'openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 | openssl pkcs8 -topk8 -nocrypt'] }).output();
Deno.env.set('GOOGLE_SERVICE_ACCOUNT_JSON', JSON.stringify({ client_email: 'sa@x.iam', private_key: new TextDecoder().decode(gen.stdout) }));

const now = new Date(Date.now() + 3 * 3600_000);
const D1 = `${String(now.getUTCDate()).padStart(2, '0')}.${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
const D2 = `${String(now.getUTCDate() + 1).padStart(2, '0')}.${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
const PRODUCT = 'Пижама 3в1 шоколадный';
const graph = [
  ['', PRODUCT + ' 1240245305', '', '', '1', '1'],
  ['', 'Запрос', 'Частота', 'Частота кластера', D1, D2],
  ['', 'пижама женская', '100', '100', '1', '1'],
];
const logHead = ['ВИД РАЗДАЧИ', 'Ссылка ТГ', 'Дата заказа', 'ТОВАР', 'Цена в заказе', 'Размер кэша', 'Ключ'];
const log: string[][] = [logHead];
let reads = 0, appends = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url.startsWith('http://127.0.0.1')) return realFetch(input as never, init);
  const j = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
  await sleep(40 + Math.random() * 60); // Google отвечает не мгновенно
  if (url.includes('oauth2.googleapis.com')) return j({ access_token: 't' });
  if (url.includes('fields=sheets.properties')) return j({ sheets: [{ properties: { sheetId: 100, title: 'Раздачи' } }, { properties: { sheetId: 200, title: 'График раздач' } }] });
  if (url.includes('batchGetByDataFilter')) { reads++; const gid = JSON.parse(String(init!.body)).dataFilters[0].gridRange.sheetId; return j({ valueRanges: [{ valueRange: { values: gid === 100 ? log : graph } }] }); }
  if (url.includes(':append')) { appends++; const vals = JSON.parse(String(init!.body)).values[0] as string[]; log.push(vals.map((x) => String(x ?? ''))); return j({ updates: { updatedRange: `'Раздачи'!A${log.length}:W${log.length}` } }); }
  if (url.includes('/values/')) return j({ values: [logHead] });
  throw new Error('неожиданный запрос ' + url.slice(0, 90));
}) as typeof fetch;

const { handleAlinaClientMessage } = await import('../functions/_shared/alina-selfbuy.ts');
const ask = (i: number) => handleAlinaClientMessage({ chatId: 12000 + i, userId: 12000 + i, username: 'race_' + i, fullName: 'Гонка ' + i, text: `Здравствуйте, актуально ${PRODUCT}? кэшбек`, sourceAccount: 'business' });
const gotPlace = (r: { replies: string[] }) => r.replies.join('\n').includes('Высылаю ТЗ');

// Одиночный клиент: сценарий выдаёт ТЗ при одном свободном месте.
const solo = await ask(0);
console.log('одиночный клиент получил ТЗ:', gotPlace(solo));
log.length = 1; appends = 0; reads = 0; // лист снова пуст: место свободно
for (const l of T.alina_selfbuy_leads) l.status = 'closed';
// Десять клиентов пишут ОДНОВРЕМЕННО, пока свободно одно место
const group = await Promise.all(Array.from({ length: 10 }, (_, i) => ask(100 + i)));
const withTz = group.filter(gotPlace).length;
console.log(`одновременно, одно место: ТЗ получили ${withTz} из 10; записей в лист: ${appends}, чтений листа: ${reads}`);
// Десять клиентов по очереди (каждый после ответа предыдущему)
log.length = 1; appends = 0;
let seqTz = 0;
for (let i = 0; i < 10; i++) if (gotPlace(await ask(200 + i))) seqTz++;
console.log(`по очереди, одно место: ТЗ получили ${seqTz} из 10`);
const fails: string[] = [];
if (withTz !== 1) fails.push(`одновременно при одном месте ТЗ получили ${withTz}, должен 1`);
if (seqTz !== 1) fails.push(`по очереди при одном месте ТЗ получили ${seqTz}, должен 1`);
// три места: по очереди пятеро (должны получить трое, без двойного счёта), потом десять одновременно на новом листе
graph[0][4] = '3'; graph[2][4] = '3';
const tzOf = async (ids: number[], par: boolean) => (par ? await Promise.all(ids.map((i) => ask(i))) : await (async () => { const o = []; for (const i of ids) o.push(await ask(i)); return o; })()).filter(gotPlace).length;
log.length = 1; appends = 0;
const seq3 = await tzOf([300, 301, 302, 303, 304], false);
console.log(`по очереди, три места, пятеро: ТЗ получили ${seq3}`); if (seq3 !== 3) fails.push(`по очереди при трёх местах получили ${seq3}, должно 3`);
log.length = 1; appends = 0;
const par3 = await tzOf(Array.from({ length: 10 }, (_, i) => 400 + i), true);
console.log(`одновременно, три места, десять: ТЗ получили ${par3}, записей в лист ${appends}`); if (par3 !== 3) fails.push(`одновременно при трёх местах получили ${par3}, должно 3`);
console.log(fails.length ? 'ОШИБКИ:\n  - ' + fails.join('\n  - ') : 'PASS: места выдаются не больше, чем есть');
server.shutdown();
Deno.exit(fails.length ? 1 : 0);

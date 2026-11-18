// Нагрузочная проверка Алины: 50 клиентов пишут одновременно разные сценарии в настоящий handleAlinaClientMessage.
// Работает целиком в памяти: поддельная база (PostgREST с уникальным индексом заявок), подставные Google и OpenAI.
// Ни рабочая база, ни рабочий лист Google не затрагиваются. Запуск: deno run -A supabase/alina-test/load-int.ts
type Row = Record<string, unknown>;
const T: Record<string, Row[]> = {
  alina_campaign: [{ id: 'c1', is_open: true, deal_type: 'cashback', cashback_pct: 70, slots_left: 5, product_name: 'Пижама 3в1 шоколадный' }],
  alina_selfbuy_leads: [], alina_selfbuy_events: [], alina_settings: [], alina_manager_questions: [],
  telegram_bots: [{ id: 'alina', is_enabled: false, deleted_at: null }], llm_usage: [], alina_cabinet_sheets: [], telegram_bot_secrets: [],
};
let seq = 1;
const stats = { requests: 0, conflicts: 0, maxParallel: 0, parallel: 0 };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const match = (row: Row, params: URLSearchParams) => {
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'offset', 'columns', 'on_conflict'].includes(k)) continue;
    const m = v.match(/^(eq|neq|gt|gte|lt|lte|is|in|ilike)\.(.*)$/);
    if (!m) continue;
    const a = row[k], b = m[2];
    if (m[1] === 'eq' && String(a) !== b) return false;
    if (m[1] === 'neq' && String(a) === b) return false;
    if (m[1] === 'is' && (b === 'null' ? a != null : a == null)) return false;
    if (m[1] === 'in' && !b.replace(/[()]/g, '').split(',').includes(String(a))) return false;
    if (m[1] === 'gt' && !(String(a) > b)) return false;
    if (m[1] === 'gte' && !(String(a) >= b)) return false;
    if (m[1] === 'lt' && !(String(a) < b)) return false;
    if (m[1] === 'ilike' && String(a ?? '').toLowerCase() !== b.toLowerCase().replace(/%/g, '')) return false;
  }
  return true;
};
const server = Deno.serve({ port: 0, onListen: () => {} }, async (req) => {
  stats.requests++; stats.parallel++; stats.maxParallel = Math.max(stats.maxParallel, stats.parallel);
  try {
    await sleep(5 + Math.random() * 25); // задержка сети, чтобы запросы действительно пересекались
    const url = new URL(req.url);
    const table = url.pathname.split('/').pop() || '';
    const rows = T[table] ?? (T[table] = []);
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
    const single = /vnd.pgrst.object/.test(req.headers.get('accept') || '');
    const ret = /return=representation/.test(req.headers.get('prefer') || '');
    const out = (arr: Row[]) => (single ? (arr.length === 1 ? json(arr[0]) : json({ code: 'PGRST116', message: 'no rows' }, 406)) : json(arr));
    if (req.method === 'GET') {
      let r = rows.filter((x) => match(x, url.searchParams));
      const ord = url.searchParams.get('order');
      if (ord) { const [c, d] = ord.split('.'); r = [...r].sort((p, q) => (String(p[c]) < String(q[c]) ? -1 : 1) * (d === 'desc' ? -1 : 1)); }
      const lim = Number(url.searchParams.get('limit')); if (lim) r = r.slice(0, lim);
      return out(r);
    }
    if (req.method === 'POST') {
      const body = await req.json(); const list = (Array.isArray(body) ? body : [body]) as Row[];
      const made: Row[] = [];
      for (const b of list) {
        if (table === 'alina_selfbuy_leads' && rows.some((x) => x.telegram_user_id === b.telegram_user_id && x.chat_id === b.chat_id)) {
          stats.conflicts++;
          return json({ code: '23505', message: 'duplicate key value violates unique constraint "alina_selfbuy_leads_user_chat_uidx"' }, 409);
        }
        const row = { id: 'id' + seq++, created_at: new Date().toISOString(), ...b }; rows.push(row); made.push(row);
      }
      return ret ? out(made) : new Response(null, { status: 201 });
    }
    if (req.method === 'PATCH') {
      const hit = rows.filter((x) => match(x, url.searchParams)); const body = await req.json();
      hit.forEach((x) => Object.assign(x, body));
      return ret ? out(hit) : new Response(null, { status: 204 });
    }
    if (req.method === 'DELETE') { T[table] = rows.filter((x) => !match(x, url.searchParams)); return new Response(null, { status: 204 }); }
    return json({});
  } finally { stats.parallel--; }
});
Deno.env.set('SUPABASE_URL', `http://127.0.0.1:${(server.addr as Deno.NetAddr).port}`);
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test');
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url.startsWith('http://127.0.0.1')) return realFetch(input as never, init);
  throw new Error('внешний запрос запрещён в нагрузочном тесте: ' + url.replace(/^https?:\/\/([^/]+).*/, '$1'));
}) as typeof fetch;

const { handleAlinaClientMessage } = await import('../functions/_shared/alina-selfbuy.ts');

const SCRIPTS: string[][] = [
  ['Здравствуйте, актуально?', 'кэшбек', 'нашла, да'],
  ['Привет', 'бартер', 'ок'],
  ['Можно поговорить с менеджером?'],
  ['где чек', 'когда придут деньги'],
  ['а можно фото?', 'какой цвет есть'],
  ['😊'],
  ['Заказала другую модель, что делать?', 'выплата не пришла'],
  ['https://t.me/x', 'спам спам спам'.repeat(300)],
  ['Здравствуйте', 'Здравствуйте', 'Здравствуйте'],
];
const errors: string[] = []; const latencies: number[] = []; let replies = 0, empty = 0, escalations = 0;
const client = async (i: number) => {
  const script = SCRIPTS[i % SCRIPTS.length];
  for (const text of script) {
    const t0 = performance.now();
    try {
      const r = await handleAlinaClientMessage({ chatId: 7000 + i, userId: 7000 + i, username: 'user_' + i, fullName: 'Клиент ' + i, text, sourceAccount: 'sandbox' });
      latencies.push(performance.now() - t0); replies += r.replies.length; if (!r.replies.length) empty++; if (r.escalate) escalations++;
    } catch (e) { errors.push(`клиент ${i} «${text.slice(0, 30)}»: ${(e as Error).message}`); }
    await sleep(Math.random() * 40);
  }
};
const t0 = performance.now();
// 50 клиентов одновременно; первые 10 дополнительно шлют два сообщения одновременно (быстрые пальцы, двойная отправка)
await Promise.all([
  ...Array.from({ length: 50 }, (_, i) => client(i)),
  ...Array.from({ length: 10 }, async (_, i) => {
    await Promise.all([0, 1].map(() => handleAlinaClientMessage({ chatId: 9000 + i, userId: 9000 + i, username: 'dbl_' + i, fullName: 'Двойной ' + i, text: 'Здравствуйте', sourceAccount: 'sandbox' }).catch((e) => { errors.push(`двойная отправка ${i}: ${(e as Error).message}`); })));
  }),
]);
const total = Math.round(performance.now() - t0);
latencies.sort((a, b) => a - b);
const leads = T.alina_selfbuy_leads.length;
console.log(`клиентов: 50 (+10 с двойной отправкой), заявок создано: ${leads}, ответов: ${replies}, пустых ответов: ${empty}, вопросов менеджерам: ${escalations}`);
console.log(`время: всего ${total} мс, ответ p50 ${Math.round(latencies[Math.floor(latencies.length / 2)])} мс, p95 ${Math.round(latencies[Math.floor(latencies.length * 0.95)])} мс; запросов к базе ${stats.requests}, одновременно до ${stats.maxParallel}`);
console.log(`конфликтов уникального индекса заявок: ${stats.conflicts}`);
console.log(`ошибок: ${errors.length}`); errors.slice(0, 12).forEach((e) => console.log('  - ' + e));
server.shutdown();
Deno.exit(errors.length ? 1 : 0);

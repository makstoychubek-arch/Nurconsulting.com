// ВРЕМЕННЫЙ нагрузочный тест Google Sheets для Алины. Работает только с тестовым листом, только для сервисного ключа.
// После проверки функция удаляется. Рабочие листы и рабочая база не затрагиваются.
import { googleAccessToken } from '../_shared/alina-google-auth.ts';
import { secretOrEnv } from '../_shared/integration-secrets.ts';
import { isServiceAuthorized } from '../_shared/service-auth.ts';

const TEST_SHEET = '163gdsPENBjszbbiQt_tHORyNcgs7wH4pr_V3bXL3iuU';
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
const pct = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s.length ? Math.round(s[Math.min(s.length - 1, Math.floor(s.length * p))]) : 0; };

Deno.serve(async (req) => {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!await isServiceAuthorized(req, serviceKey)) return json({ ok: false, error: 'service only' }, 401);
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  if (body.sheet_id && body.sheet_id !== TEST_SHEET) return json({ ok: false, error: 'только тестовый лист' }, 400);
  const n = Math.min(Math.max(Number(body.n) || 20, 1), 120);
  const sa = await secretOrEnv('GOOGLE_SERVICE_ACCOUNT_JSON');
  if (!sa) return json({ ok: false, error: 'нет ключа Google' }, 503);
  const token = await googleAccessToken(sa);
  const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${TEST_SHEET}`;
  const timed = async (fn: () => Promise<Response>) => {
    const t0 = performance.now();
    try { const r = await fn(); await r.arrayBuffer().catch(() => null); return { ms: performance.now() - t0, status: r.status }; }
    catch (e) { return { ms: performance.now() - t0, status: 0, err: String((e as Error).message).slice(0, 80) }; }
  };
  const summary = (rs: Array<{ ms: number; status: number }>) => {
    const by: Record<string, number> = {}; rs.forEach((r) => { by[r.status] = (by[r.status] || 0) + 1; });
    return { n: rs.length, status: by, p50: pct(rs.map((r) => r.ms), 0.5), p95: pct(rs.map((r) => r.ms), 0.95), max: pct(rs.map((r) => r.ms), 1) };
  };
  const stamp = Date.now();
  // 1. чтение: n одновременных чтений графика (как при n клиентах: Алина перечитывает лист на каждое сообщение)
  const reads = await Promise.all(Array.from({ length: n }, () => timed(() => fetch(`${base}/values/${encodeURIComponent("'График раздач'!A1:F20")}`, { headers: H }))));
  // 2. запись: n одновременных добавлений строки в «Раздачи»
  const writes = await Promise.all(Array.from({ length: n }, (_, i) => timed(() => fetch(`${base}/values/${encodeURIComponent("'Раздачи'!A:W")}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: 'POST', headers: H, body: JSON.stringify({ values: [['КЭШБЕК', `@loadtest_${stamp}_${i}`, new Date().toLocaleDateString('ru-RU'), 'ТЕСТ', '1999', '70', 'тест']] }),
  }))));
  // 3. сколько строк реально записалось
  const got = await fetch(`${base}/values/${encodeURIComponent("'Раздачи'!B:B")}`, { headers: H }).then((r) => r.json()).catch(() => ({}));
  const saved = ((got?.values || []) as string[][]).filter((r) => String(r[0] || '').startsWith(`@loadtest_${stamp}_`)).length;
  // 4. уборка тестовых строк
  const cleaned = body.keep ? null : await timed(() => fetch(`${base}/values/${encodeURIComponent("'Раздачи'!A2:W2000")}:clear`, { method: 'POST', headers: H, body: '{}' }));
  return json({ ok: true, n, reads: summary(reads), writes: summary(writes), rowsRequested: n, rowsSaved: saved, cleaned: cleaned?.status ?? null });
});

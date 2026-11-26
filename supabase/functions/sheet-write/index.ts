// Точечная запись значений в два рабочих листа таблицы МАРС («График раздач пижам», «Раздачи Пижам») по команде владельца. Другие листы и файлы не трогает.
// Доступ: только сервис. Ключ Google-аккаунта берётся как у Алины и наружу не отдаётся. По умолчанию dry_run (показывает, что было и что станет).
import { googleAccessToken } from '../_shared/alina-google-auth.ts';
import { secretOrEnv } from '../_shared/integration-secrets.ts';
import { isServiceAuthorized } from '../_shared/service-auth.ts';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const SHEET_ID = '1ZSdNfnflgwOQZFSm1qcvfOB94bnfipZu5fB3pDodrik';
const ALLOWED = new Set(['График раздач пижам', 'Раздачи Пижам']);

Deno.serve(async (req) => {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!await isServiceAuthorized(req, serviceKey)) return json({ ok: false, error: 'Unauthorized' }, 401);
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const dry = body.dry_run !== false;
    // Чтение диапазона одним запросом (только два рабочих листа): { read: { tab, range: 'A1:Q200' } }
    const rd = body.read as { tab?: string; range?: string } | undefined;
    if (rd) {
        if (!ALLOWED.has(String(rd.tab)) || !/^[A-Z]{1,2}\d{1,4}:[A-Z]{1,2}\d{1,4}$/.test(String(rd.range))) return json({ ok: false, error: 'Запрещённый диапазон' }, 400);
        const sa0 = await secretOrEnv('GOOGLE_SERVICE_ACCOUNT_JSON');
        const tok0 = sa0 ? await googleAccessToken(sa0).catch(() => '') : '';
        if (!tok0) return json({ ok: false, error: 'Нет доступа к Google' }, 503);
        const r0 = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(`'${rd.tab}'!${rd.range}`)}?valueRenderOption=FORMATTED_VALUE`, { headers: { Authorization: `Bearer ${tok0}` }, signal: AbortSignal.timeout(20000) });
        if (!r0.ok) return json({ ok: false, step: 'read', status: r0.status }, 502);
        return json({ ok: true, values: (await r0.json()).values || [] });
    }
    const writes = (Array.isArray(body.writes) ? body.writes : []) as { tab: string; cell: string; value: string | number | null }[];
    if (!writes.length || writes.length > 60) return json({ ok: false, error: 'writes: от 1 до 60 ячеек' }, 400);
    for (const w of writes) {
        if (!ALLOWED.has(String(w.tab)) || !/^[A-Z]{1,2}\d{1,4}$/.test(String(w.cell))) return json({ ok: false, error: `Запрещено: ${w.tab}!${w.cell}` }, 400);
    }
    const sa = await secretOrEnv('GOOGLE_SERVICE_ACCOUNT_JSON');
    if (!sa) return json({ ok: false, error: 'Нет ключа Google-аккаунта' }, 503);
    const token = await googleAccessToken(sa).catch(() => '');
    if (!token) return json({ ok: false, error: 'Google не принял ключ' }, 503);
    const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const rng = (w: { tab: string; cell: string }) => `'${w.tab}'!${w.cell}`;
    const before: Record<string, unknown> = {};
    for (const w of writes) {
        const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(rng(w))}?valueRenderOption=FORMULA`, { headers: H, signal: AbortSignal.timeout(20000) });
        if (!r.ok) return json({ ok: false, step: 'read', cell: rng(w), status: r.status }, 502);
        before[rng(w)] = (((await r.json()).values || [[]])[0] || [])[0] ?? '';
    }
    const plan = writes.map((w) => ({ cell: rng(w), was: before[rng(w)], will_be: w.value ?? '' }));
    if (dry) return json({ ok: true, dry_run: true, plan });
    const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values:batchUpdate`, { method: 'POST', headers: H, signal: AbortSignal.timeout(30000), body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data: writes.map((w) => ({ range: rng(w), values: [[w.value ?? '']] })) }) });
    if (!r.ok) return json({ ok: false, step: 'write', status: r.status, error: (await r.text()).slice(0, 300), plan }, 502);
    return json({ ok: true, applied: true, plan });
});

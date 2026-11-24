// Разовая служебная функция: проставляет тонкие границы на листе Google (только форматирование, данные не меняются).
// Доступ: только сервис. Ключ Google-аккаунта берётся тем же способом, что у Алины и «Раздач» (Настройки → Боты и ключи), наружу не отдаётся.
import { googleAccessToken } from '../_shared/alina-google-auth.ts';
import { secretOrEnv } from '../_shared/integration-secrets.ts';
import { isServiceAuthorized } from '../_shared/service-auth.ts';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const q = (tab: string) => `'${tab.replace(/'/g, "''")}'`;

Deno.serve(async (req) => {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!await isServiceAuthorized(req, serviceKey)) return json({ ok: false, error: 'Unauthorized' }, 401);
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const id = String(body.spreadsheet_id || '').trim(), tab = String(body.tab || '').trim();
    const columns = Math.min(60, Math.max(1, Number(body.columns) || 24));
    const dry = body.dry_run !== false;
    if (!id || !tab) return json({ ok: false, error: 'spreadsheet_id и tab обязательны' }, 400);
    const sa = await secretOrEnv('GOOGLE_SERVICE_ACCOUNT_JSON');
    if (!sa) return json({ ok: false, error: 'Нет ключа Google-аккаунта' }, 503);
    let token: string;
    try { token = await googleAccessToken(sa); } catch (e) { return json({ ok: false, error: 'Google не принял ключ: ' + String((e as Error).message).slice(0, 160) }, 503); }
    const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const meta = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=sheets.properties`, { headers: H, signal: AbortSignal.timeout(20000) });
    if (!meta.ok) return json({ ok: false, step: 'meta', status: meta.status, error: (await meta.text()).slice(0, 300) }, 502);
    const sheets = ((await meta.json()).sheets || []) as { properties: { sheetId: number; title: string; gridProperties?: { rowCount: number } } }[];
    const sh = sheets.find((s) => s.properties.title === tab);
    if (!sh) return json({ ok: false, error: 'Нет листа «' + tab + '»', tabs: sheets.map((s) => s.properties.title) }, 404);
    // последняя строка с данными: смотрим колонки A:AX целиком, лишнего не пишем
    const vr = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(q(tab) + '!A1:AX')}`, { headers: H, signal: AbortSignal.timeout(30000) });
    if (!vr.ok) return json({ ok: false, step: 'values', status: vr.status, error: (await vr.text()).slice(0, 300) }, 502);
    const vals = ((await vr.json()).values || []) as unknown[][];
    let last = 0;
    vals.forEach((r, i) => { if (r.some((c) => String(c ?? '').trim() !== '')) last = i + 1; });
    if (dry) return json({ ok: true, dry_run: true, sheetId: sh.properties.sheetId, last_row: last, columns, rows_total: sh.properties.gridProperties?.rowCount ?? null });
    const line = { style: 'SOLID', width: 1, colorStyle: { rgbColor: { red: 0.6, green: 0.6, blue: 0.6 } } };
    const range = { sheetId: sh.properties.sheetId, startRowIndex: 0, endRowIndex: last, startColumnIndex: 0, endColumnIndex: columns };
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}:batchUpdate`, { method: 'POST', headers: H, signal: AbortSignal.timeout(30000), body: JSON.stringify({ requests: [{ updateBorders: { range, top: line, bottom: line, left: line, right: line, innerHorizontal: line, innerVertical: line } }] }) });
    if (!res.ok) return json({ ok: false, step: 'batchUpdate', status: res.status, error: (await res.text()).slice(0, 300) }, 502);
    return json({ ok: true, applied: true, sheetId: sh.properties.sheetId, last_row: last, columns });
});

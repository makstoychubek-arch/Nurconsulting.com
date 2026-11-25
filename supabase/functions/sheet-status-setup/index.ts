// Разовая служебная функция: колонка «Статус» в листе «Раздачи Пижам» (заголовок + выпадающий список). Только сервис.
// body: { spreadsheet_id, tab, col (индекс, Y = 24), header: 'Статус', values: [...], last_row?, dry_run? }.
// Если в целевой колонке уже есть данные кроме заголовка, ничего не делает (защита от затирания).
import { googleAccessToken } from '../_shared/alina-google-auth.ts';
import { secretOrEnv } from '../_shared/integration-secrets.ts';
import { isServiceAuthorized } from '../_shared/service-auth.ts';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const letter = (i: number) => { let s = ''; for (let n = i; n >= 0; n = Math.floor(n / 26) - 1) s = String.fromCharCode(65 + (n % 26)) + s; return s; };

Deno.serve(async (req) => {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!await isServiceAuthorized(req, serviceKey)) return json({ ok: false, error: 'Unauthorized' }, 401);
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const id = String(body.spreadsheet_id || ''), tab = String(body.tab || ''), col = Number(body.col), header = String(body.header || 'Статус');
    const values = Array.isArray(body.values) ? (body.values as unknown[]).map(String).filter(Boolean) : [];
    const lastRow = Math.min(3000, Number(body.last_row) || 1440);
    if (!id || !tab || !Number.isInteger(col) || col < 0 || !values.length) return json({ ok: false, error: 'spreadsheet_id, tab, col, values обязательны' }, 400);
    const sa = await secretOrEnv('GOOGLE_SERVICE_ACCOUNT_JSON');
    if (!sa) return json({ ok: false, error: 'нет ключа Google' }, 503);
    const token = await googleAccessToken(sa);
    const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const meta = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=sheets.properties`, { headers: H, signal: AbortSignal.timeout(20000) });
    if (!meta.ok) return json({ ok: false, step: 'meta', status: meta.status }, 502);
    const sh = ((await meta.json()).sheets || []).find((s: { properties: { title: string } }) => s.properties.title === tab);
    if (!sh) return json({ ok: false, error: 'нет листа' }, 404);
    const L = letter(col);
    const q = `'${tab.replace(/'/g, "''")}'!${L}1:${L}${lastRow}`;
    const rd = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(q)}`, { headers: H, signal: AbortSignal.timeout(20000) });
    const cur = ((await rd.json().catch(() => ({})))?.values || []) as string[][];
    const filled = cur.slice(1).filter((r) => String(r?.[0] ?? '').trim() !== '').length;
    const head = String(cur[0]?.[0] ?? '').trim();
    if (filled > 0 || (head && head !== header)) return json({ ok: false, error: 'колонка не пустая', header: head, filled }, 409);
    if (body.dry_run !== false) return json({ ok: true, dry_run: true, column: L, header, values });
    const put = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(`'${tab.replace(/'/g, "''")}'!${L}1`)}?valueInputOption=USER_ENTERED`, { method: 'PUT', headers: H, body: JSON.stringify({ values: [[header]] }), signal: AbortSignal.timeout(20000) });
    if (!put.ok) return json({ ok: false, step: 'header', status: put.status }, 502);
    const dv = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}:batchUpdate`, {
        method: 'POST', headers: H, signal: AbortSignal.timeout(30000),
        body: JSON.stringify({ requests: [{ setDataValidation: {
            range: { sheetId: sh.properties.sheetId, startRowIndex: 1, endRowIndex: lastRow, startColumnIndex: col, endColumnIndex: col + 1 },
            rule: { condition: { type: 'ONE_OF_LIST', values: values.map((v) => ({ userEnteredValue: v })) }, showCustomUi: true, strict: false },
        } }] }),
    });
    if (!dv.ok) return json({ ok: false, step: 'validation', status: dv.status, error: (await dv.text()).slice(0, 200) }, 502);
    return json({ ok: true, applied: true, column: L, header, values });
});

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
    let vals = ((await vr.json()).values || []) as unknown[][];
    let last = 0;
    vals.forEach((r, i) => { if (r.some((c) => String(c ?? '').trim() !== '')) last = i + 1; });
    // сортировка строк данных (без шапки) по перечисленным колонкам, например [3, 0]: по дате заказа, затем по товару; строки переносятся целиком, данные не меняются
    const sortCols = Array.isArray(body.sort_cols) ? (body.sort_cols as number[]).map(Number) : [];
    if (sortCols.length && !dry) {
        const sr = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}:batchUpdate`, { method: 'POST', headers: H, signal: AbortSignal.timeout(30000), body: JSON.stringify({ requests: [{ sortRange: { range: { sheetId: sh.properties.sheetId, startRowIndex: 1, endRowIndex: last, startColumnIndex: 0, endColumnIndex: columns }, sortSpecs: sortCols.map((c) => ({ dimensionIndex: c, sortOrder: 'ASCENDING' })) } }] }) });
        if (!sr.ok) return json({ ok: false, step: 'sort', status: sr.status, error: (await sr.text()).slice(0, 300) }, 502);
        const vr2 = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(q(tab) + '!A1:AX')}`, { headers: H, signal: AbortSignal.timeout(30000) });
        if (vr2.ok) vals = ((await vr2.json()).values || []) as unknown[][];
    }
    // разделители групп: по смене даты (колонка date_col) толстая чёрная линия, по смене товара в пределах даты (колонка product_col) средняя серая; нумерация колонок с 0
    const productCol = body.product_col == null ? -1 : Number(body.product_col), dateCol = body.date_col == null ? -1 : Number(body.date_col);
    const cell = (r: number, c: number) => String((vals[r] || [])[c] ?? '').trim();
    const groups: { row: number; kind: 'product' | 'date' }[] = [];
    if (productCol >= 0 || dateCol >= 0) {
        for (let r = 2; r < last; r++) {
            if (dateCol >= 0 && cell(r, dateCol) !== cell(r - 1, dateCol)) groups.push({ row: r, kind: 'date' });
            else if (productCol >= 0 && cell(r, productCol) !== cell(r - 1, productCol)) groups.push({ row: r, kind: 'product' });
        }
    }
    if (dry) return json({ ok: true, dry_run: true, sheetId: sh.properties.sheetId, last_row: last, columns, rows_total: sh.properties.gridProperties?.rowCount ?? null, group_lines: groups.length, by_product: groups.filter((g) => g.kind === 'product').length, by_date: groups.filter((g) => g.kind === 'date').length });
    const line = { style: 'SOLID', width: 1, colorStyle: { rgbColor: { red: 0.6, green: 0.6, blue: 0.6 } } };
    const range = { sheetId: sh.properties.sheetId, startRowIndex: 0, endRowIndex: last, startColumnIndex: 0, endColumnIndex: columns };
    const reqs: Record<string, unknown>[] = [{ updateBorders: { range, top: line, bottom: line, left: line, right: line, innerHorizontal: line, innerVertical: line } }];
    if (body.reset_grid === false) reqs.length = 0;
    const heavy = { style: 'SOLID_THICK', colorStyle: { rgbColor: { red: 0, green: 0, blue: 0 } } };
    const medium = { style: 'SOLID_MEDIUM', colorStyle: { rgbColor: { red: 0.2, green: 0.2, blue: 0.2 } } };
    for (const g of groups) reqs.push({ updateBorders: { range: { sheetId: sh.properties.sheetId, startRowIndex: g.row, endRowIndex: g.row + 1, startColumnIndex: 0, endColumnIndex: columns }, top: g.kind === 'date' ? heavy : medium } });
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}:batchUpdate`, { method: 'POST', headers: H, signal: AbortSignal.timeout(30000), body: JSON.stringify({ requests: reqs }) });
    if (!res.ok) return json({ ok: false, step: 'batchUpdate', status: res.status, error: (await res.text()).slice(0, 300) }, 502);
    return json({ ok: true, applied: true, sheetId: sh.properties.sheetId, last_row: last, columns, group_lines: groups.length });
});

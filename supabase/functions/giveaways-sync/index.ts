// Обмен «Раздач» с листом Google (расписание раз в минуту и кнопка «Обновить из таблицы»).
// Доступ: сервис (cron) или сотрудник с кабинетом из giveaway_sheets. Лист главный при одновременной правке.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { googleAccessToken } from '../_shared/alina-google-auth.ts';
import { detectLayout, parseSheetFormat } from '../_shared/giveaways-sheet.ts';
import { secretOrEnv } from '../_shared/integration-secrets.ts';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import { syncCabinet, type Db, type SheetIO } from './handler.ts';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const q = (tab: string) => `'${tab.replace(/'/g, "''")}'`;
const colName = (i: number) => { let n = i + 1, s = ''; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };

async function sheetsFetch(url: string, token: string, init?: RequestInit): Promise<Response | null> {
    for (let attempt = 0; attempt < 2; attempt++) {
        const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers || {}) } }).catch(() => null);
        if (res && res.status !== 429 && res.status < 500) return res;
        if (attempt === 0) await new Promise((r) => setTimeout(r, 1500));
    }
    return null;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const admin = createClient(url, serviceKey);
    const body = await req.json().catch(() => ({} as Record<string, unknown>));

    // кто вызывает: сервис или сотрудник
    let allowedCabinets: string[] | null = null; // null = все
    if (!await isServiceAuthorized(req, serviceKey)) {
        const auth = req.headers.get('Authorization') ?? '';
        if (!auth.startsWith('Bearer ')) return json({ ok: false, error: 'Нужно войти в аккаунт' }, 401);
        const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: auth } } });
        const { data: staff } = await asUser.rpc('is_staff');
        if (staff !== true) return json({ ok: false, error: 'Доступ только для команды' }, 403);
        const { data: mine } = await asUser.rpc('current_user_cabinet_ids');
        allowedCabinets = ((mine || []) as unknown[]).map((x) => String(typeof x === 'object' && x ? Object.values(x as Record<string, unknown>)[0] : x));
    }

    const { data: maps } = await admin.from('giveaway_sheets').select('cabinet_id, sheet_id, tab, format_at').eq('enabled', true);
    let list = (maps || []) as Array<{ cabinet_id: string; sheet_id: string; tab: string; format_at?: string | null }>;
    if (body.cabinet_id) list = list.filter((m) => m.cabinet_id === String(body.cabinet_id));
    if (allowedCabinets) list = list.filter((m) => allowedCabinets!.includes(m.cabinet_id));
    if (!list.length) return json({ ok: true, synced: 0 });

    const sa = await secretOrEnv('GOOGLE_SERVICE_ACCOUNT_JSON');
    if (!sa) return json({ ok: false, error: 'Не подключён Google-аккаунт (Настройки → Боты и ключи)' }, 503);
    let token: string;
    try { token = await googleAccessToken(sa); } catch { return json({ ok: false, error: 'Google не принял ключ аккаунта' }, 503); }

    const sheets: SheetIO = {
        async readAll(id, tab) {
            const res = await sheetsFetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(`${q(tab)}!A1:AD`)}?valueRenderOption=FORMATTED_VALUE`, token);
            if (!res?.ok) return null;
            return ((await res.json().catch(() => null))?.values as string[][] | undefined) ?? [];
        },
        async writeCells(id, tab, cells) {
            const res = await sheetsFetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values:batchUpdate`, token, {
                method: 'POST',
                body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data: cells.map((c) => ({ range: `${q(tab)}!${colName(c.col)}${c.row}`, values: [[c.value]] })) }),
            });
            return Boolean(res?.ok);
        },
        async append(id, tab, rows) {
            const res = await sheetsFetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(`${q(tab)}!A:A`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, token, { method: 'POST', body: JSON.stringify({ values: rows }) });
            if (!res?.ok) return null;
            const range = String((await res.json().catch(() => null))?.updates?.updatedRange || '');
            const m = range.match(/![A-Z]+(\d+)/);
            return m ? Number(m[1]) : 0;
        },
    };

    const results: Record<string, unknown> = {};
    for (const m of list) {
        const db: Db = {
            async claim(cab) {
                // один обмен за раз: занимаем кабинет, если прошлый обмен был больше 15 секунд назад
                const since = new Date(Date.now() - 15_000).toISOString();
                const { data } = await admin.from('giveaway_sheets').update({ last_sync_at: new Date().toISOString() }).eq('cabinet_id', cab).or(`last_sync_at.is.null,last_sync_at.lt.${since}`).select('cabinet_id');
                return Boolean(data && data.length);
            },
            async loadRows(cab) {
                const all: unknown[] = [];
                for (let from = 0; ; from += 1000) {
                    const { data, error } = await admin.from('giveaways').select('*').eq('cabinet_id', cab).range(from, from + 999);
                    if (error) throw error;
                    all.push(...(data || []));
                    if (!data || data.length < 1000) break;
                }
                return all as never;
            },
            async insertRows(rows) { return !(await admin.from('giveaways').insert(rows)).error; },
            async updateRow(id, patch) { return !(await admin.from('giveaways').update(patch).eq('id', id)).error; },
            async removeRows(ids) { return !(await admin.from('giveaways').delete().in('id', ids)).error; },
            async insertConflicts(cab, items) {
                await admin.from('giveaway_conflicts').insert(items.map((c) => ({ cabinet_id: cab, row_id: c.row_id, fields: c.fields, site_values: c.site, sheet_values: c.sheet })));
            },
            async finish(cab, stats, error) {
                await admin.from('giveaway_sheets').update({ last_sync_at: new Date().toISOString(), last_error: error, last_stats: stats }).eq('cabinet_id', cab);
            },
        };
        results[m.cabinet_id] = await syncCabinet(m, sheets, db, () => new Date().toISOString(), { dryRun: body.dry_run === true });
    }
    // Оформление листа: раз в час (или по запросу), чтобы сайт совпадал с Google по шрифту и размерам
    for (const m of list) {
        const stale = !m.format_at || Date.now() - new Date(m.format_at).getTime() > 3600_000;
        if (!stale && body.format !== true) continue;
        try {
            const vals = await sheets.readAll(m.sheet_id, m.tab);
            const layout = vals ? detectLayout(vals) : null;
            if (!layout) continue;
            const rng = `${q(m.tab)}!A1:AD${layout.headerRow + 2}`;
            const res = await sheetsFetch(`https://sheets.googleapis.com/v4/spreadsheets/${m.sheet_id}?ranges=${encodeURIComponent(rng)}&includeGridData=true&fields=${encodeURIComponent('sheets(data(startRow,rowMetadata(pixelSize),columnMetadata(pixelSize),rowData(values(effectiveFormat(textFormat(fontFamily,fontSize,bold),backgroundColor)))))')}`, token);
            if (!res?.ok) continue;
            const fmt = parseSheetFormat(await res.json().catch(() => null), layout);
            if (fmt) await admin.from('giveaway_sheets').update({ format: fmt, format_at: new Date().toISOString() }).eq('cabinet_id', m.cabinet_id);
        } catch (_) { /* оформление не критично */ }
    }
    return json({ ok: true, results });
});

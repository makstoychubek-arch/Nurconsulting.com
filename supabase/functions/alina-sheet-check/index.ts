// Проверка «как Алина видит таблицу МАРС» (владелец, 24 ноября 2026): читает ту же таблицу теми же функциями, что Алина, и возвращает план по датам и товарам.
// Ничего не пишет ни в таблицу, ни в базу. Доступ: только сервис.
import { googleAccessToken } from '../_shared/alina-google-auth.ts';
import { secretOrEnv } from '../_shared/integration-secrets.ts';
import { fetchSheetPlan, SHEET_TAB_LIMITS } from '../_shared/alina-sheet-plan.ts';
import { modelStats, parseRazdachiSheet } from '../_shared/alina-razdachi.ts';
import { isServiceAuthorized } from '../_shared/service-auth.ts';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!await isServiceAuthorized(req, serviceKey)) return json({ ok: false, error: 'Unauthorized' }, 401);
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const sheetId = String(body.sheet_id || '1ZSdNfnflgwOQZFSm1qcvfOB94bnfipZu5fB3pDodrik');
    const sheet = { sheet_id: sheetId, cabinet_key: 'mars', cabinet_name: 'МАРС' };
    const compact = (o: { date: string | null; product_name: string | null; keyword: string | null; plan_slots: number; used_slots: number; slots_left: number; tab: string; is_open: boolean }) =>
        ({ date: o.date, product: o.product_name, key: (o.keyword || '').slice(0, 40), plan: o.plan_slots, used: o.used_slots, left: o.slots_left, open: o.is_open, tab: o.tab });
    const out: Record<string, unknown> = { ok: true, limits: SHEET_TAB_LIMITS[sheetId] || null };
    try {
        // 1) так, как Алина читает план сейчас (граф. + журнал по прежним правилам)
        const plan = await fetchSheetPlan(true, sheet);
        out.plan = { ok: plan.ok, error: plan.error, leads_rows: plan.leads_rows, tabs: [...new Set(plan.offers.map((o) => o.tab))], offers: plan.offers.map(compact).slice(0, 80) };
        // 2) строки листа «Раздачи Пижам» по правилам режима «Раздачи — строки»
        const sa = await secretOrEnv('GOOGLE_SERVICE_ACCOUNT_JSON');
        const token = await googleAccessToken(sa);
        const tab = SHEET_TAB_LIMITS[sheetId]?.razdachi || 'Раздачи Пижам';
        const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(`'${tab}'!A1:X2000`)}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) });
        if (!r.ok) throw new Error('values ' + r.status);
        const values = ((await r.json()).values || []) as string[][];
        const parsed = parseRazdachiSheet(values);
        if (!parsed) out.rows_mode = { parsed: false };
        else {
            const dates = [...new Set(parsed.rows.map((x) => x.date).filter(Boolean))].sort((a, b) => a.split('.').reverse().join('').localeCompare(b.split('.').reverse().join('')));
            out.rows_mode = { parsed: true, headerRow: parsed.headerRow, rows: parsed.rows.length, by_date: dates.map((d) => ({ date: d, models: modelStats(parsed, d).map((m) => ({ model: m.model, total: m.total, taken: m.started, left: m.left })) })) };
        }
    } catch (e) { out.ok = false; out.error = String((e as Error).message || e).slice(0, 300); }
    return json(out);
});

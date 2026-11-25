// Наблюдение за статусами менеджера в таблице (шаги 2–3). Раз в 10 минут читает «Раздачи Пижам», сравнивает со снимком alina_settings.statusSnap
// и пишет события status_watch (что Алина сказала бы клиенту). Клиентам НИЧЕГО не отправляет, «Менеджер ведёт» пока тоже не глушит. Только сервис.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import { googleAccessToken } from '../_shared/alina-google-auth.ts';
import { secretOrEnv } from '../_shared/integration-secrets.ts';
import { parseRazdachiSheet } from '../_shared/alina-razdachi.ts';
import { planStatusChanges } from '../_shared/alina-status-watch.ts';

const SHEET_ID = '1ZSdNfnflgwOQZFSm1qcvfOB94bnfipZu5fB3pDodrik';
const TAB = 'Раздачи Пижам';
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!await isServiceAuthorized(req, serviceKey)) return json({ ok: false, error: 'Unauthorized' }, 401);
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey);
    const sa = await secretOrEnv('GOOGLE_SERVICE_ACCOUNT_JSON');
    if (!sa) return json({ ok: false, error: 'нет ключа Google' }, 503);
    const token = await googleAccessToken(sa);
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(`'${TAB}'!A1:Z1500`)}?valueRenderOption=FORMATTED_VALUE`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) }).catch(() => null);
    if (!res?.ok) return json({ ok: false, error: 'таблица недоступна', status: res?.status });
    const values = ((await res.json().catch(() => null))?.values || []) as string[][];
    const sheet = parseRazdachiSheet(values);
    if (!sheet || sheet.col.status == null) return json({ ok: false, error: 'нет колонки «Статус»' });
    const idCol = sheet.headers.findIndex((h) => h.trim().toLowerCase() === 'id');
    const { data: snapRow } = await admin.from('alina_settings').select('value').eq('key', 'statusSnap').maybeSingle();
    const prev = (snapRow?.value ?? null) as Record<string, string> | null;
    const { snap, changes } = planStatusChanges(prev, sheet, idCol >= 0 ? idCol : undefined);
    for (const c of changes) {
        await admin.from('alina_selfbuy_events').insert({ lead_id: null, chat_id: 0, event_type: 'status_watch', payload: { ...c, mode: 'dry' } });
    }
    await admin.from('alina_settings').upsert({ key: 'statusSnap', value: snap });
    return json({ ok: true, baseline: prev == null, rows: Object.keys(snap).length, changes });
});

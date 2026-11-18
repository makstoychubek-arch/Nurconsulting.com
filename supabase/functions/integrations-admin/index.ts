// Ключ OpenAI и сервисный аккаунт Google из «Настройки → Боты и ключи». Только супер-админ, значения наружу не уходят.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { googleAccessToken } from '../_shared/alina-google-auth.ts';
import { forgetSecret } from '../_shared/integration-secrets.ts';
import { detectLayout } from '../_shared/giveaways-sheet.ts';
import { moscowDay, sumUsage } from '../_shared/llm-usage.ts';
import { handleIntegrations } from './handler.ts';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    const auth = req.headers.get('Authorization') ?? '';
    if (!auth.startsWith('Bearer ')) return json({ ok: false, error: 'Нужно войти в аккаунт' }, 401);

    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: auth } } });
    const { data: userData } = await asUser.auth.getUser(auth.replace('Bearer ', ''));
    const user = userData?.user;
    if (!user) return json({ ok: false, error: 'Нужно войти в аккаунт' }, 401);
    const { data: isSuper } = await asUser.rpc('is_super_admin');
    if (isSuper !== true) return json({ ok: false, error: 'Доступ только для администратора' }, 403);

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const result = await handleIntegrations(body, {
        db: {
            list: async () => {
                const { data } = await admin.from('integration_secrets').select('key, meta, updated_at');
                return (data || []) as never;
            },
            get: async (key) => {
                const { data } = await admin.from('integration_secrets').select('value').eq('key', key).maybeSingle();
                return String((data as { value?: string } | null)?.value ?? '');
            },
            set: async (key, value, meta, by) => {
                const { error } = await admin.from('integration_secrets').upsert({ key, value, meta, updated_by: by, updated_at: new Date().toISOString() }, { onConflict: 'key' });
                return !error;
            },
            remove: async (key) => !(await admin.from('integration_secrets').delete().eq('key', key)).error,
            cabinets: async () => {
                const { data } = await admin.from('cabinets').select('id, name').order('name');
                return (data || []) as never;
            },
            links: async () => {
                const { data } = await admin.from('giveaway_sheets').select('cabinet_id, sheet_id, tab, enabled, last_sync_at, last_error');
                return (data || []) as never;
            },
            linkSheet: async (cabinetId, sheetId, tab) => !(await admin.from('giveaway_sheets').upsert({ cabinet_id: cabinetId, sheet_id: sheetId, tab, enabled: true, last_error: null }, { onConflict: 'cabinet_id' })).error,
            unlinkSheet: async (cabinetId) => !(await admin.from('giveaway_sheets').delete().eq('cabinet_id', cabinetId)).error,
            usage: async () => {
                const day = moscowDay();
                const { data, error } = await admin.from('llm_usage').select('*').gte('day', `${day.slice(0, 7)}-01`);
                return error ? null : sumUsage((data || []) as never, day);
            },
            budget: async () => {
                const { data } = await admin.from('alina_settings').select('value').eq('key', 'llmBudgetUsd').maybeSingle();
                const n = Number((data as { value?: unknown } | null)?.value);
                return Number.isFinite(n) ? n : 0;
            },
            activeSheetId: async () => {
                const { data } = await admin.from('alina_campaign').select('sheet_id').order('updated_at', { ascending: false }).limit(1).maybeSingle();
                return (data as { sheet_id?: string } | null)?.sheet_id ?? null;
            },
        },
        checkSheetTab: async (token, sheetId, tab) => {
            const meta = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=properties.title,sheets.properties.title`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) }).catch(() => null);
            if (!meta?.ok) return { ok: false };
            const m = await meta.json().catch(() => null) as { properties?: { title?: string }; sheets?: Array<{ properties?: { title?: string } }> } | null;
            const tabs = (m?.sheets || []).map((x) => String(x.properties?.title || '')).filter(Boolean);
            if (!tabs.includes(tab)) return { ok: true, title: m?.properties?.title, tabs, hasTab: false };
            const vals = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(`'${tab.replace(/'/g, "''")}'!A1:AD8`)}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) }).catch(() => null);
            const rows = ((await vals?.json().catch(() => null))?.values as string[][] | undefined) ?? [];
            return { ok: true, title: m?.properties?.title, tabs, hasTab: true, header: Boolean(detectLayout(rows)), rows: rows.length };
        },
        envHas: (name) => Boolean((Deno.env.get(name) ?? '').trim()),
        fetch: (u, init) => fetch(u, init),
        googleToken: googleAccessToken,
        userId: user.id,
        now: () => new Date().toISOString(),
        forget: () => { forgetSecret('OPENAI_API_KEY'); forgetSecret('GOOGLE_SERVICE_ACCOUNT_JSON'); },
    });
    return json(result.body, result.status);
});

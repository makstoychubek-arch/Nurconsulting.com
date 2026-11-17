// Ключ OpenAI и сервисный аккаунт Google из «Настройки → Боты и ключи». Только супер-админ, значения наружу не уходят.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { googleAccessToken } from '../_shared/alina-google-auth.ts';
import { forgetSecret } from '../_shared/integration-secrets.ts';
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
            activeSheetId: async () => {
                const { data } = await admin.from('alina_campaign').select('sheet_id').order('updated_at', { ascending: false }).limit(1).maybeSingle();
                return (data as { sheet_id?: string } | null)?.sheet_id ?? null;
            },
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

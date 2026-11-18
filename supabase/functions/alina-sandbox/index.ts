// «Песочница» Алины: написать ей как клиент прямо на сайте. Только супер-админ, в Telegram и в рабочую таблицу ничего не уходит.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleAlinaClientMessage } from '../_shared/alina-selfbuy.ts';
import { handleSandbox } from './handler.ts';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

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
    const result = await handleSandbox(body, user.id, {
        handle: (opts) => handleAlinaClientMessage(opts) as never,
        leadState: async (chatId) => {
            const { data } = await admin.from('alina_selfbuy_leads').select('status, deal_type, product_name').eq('chat_id', chatId).maybeSingle();
            return (data as never) ?? null;
        },
        reset: async (chatId) => {
            await admin.from('alina_selfbuy_events').delete().eq('chat_id', chatId);
            return !(await admin.from('alina_selfbuy_leads').delete().eq('chat_id', chatId)).error;
        },
        now: () => Date.now(),
    });
    return json(result.body, result.status);
});

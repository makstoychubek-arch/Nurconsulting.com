// Super Admin: статус Telegram-ботов, deleteWebhook, вкл/выкл, удаление.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { TELEGRAM_CHANNEL_LABELS, getTelegramRoutingStatus, getTelegramToken } from '../_shared/telegram-routing.ts';

const SUPER_ADMIN_EMAIL = 'global.pro.1004@gmail.com';
const SUPER_ADMIN_ID = '2f7d8960-0df4-4a17-be70-f2cb2ac0032e';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    });
}

function isSuperAdmin(user: { email?: string | null; id?: string }) {
    return String(user.email || '').toLowerCase() === SUPER_ADMIN_EMAIL || user.id === SUPER_ADMIN_ID;
}

const TOKEN_ENV_FALLBACK: Record<string, string[]> = {
    karina: ['KARINA_BOT_TOKEN', 'TELEGRAM_BOT_TOKEN'],
    notify: ['TELEGRAM_BOT_TOKEN'],
};

function tokenForBot(tokenEnv: string | null, botId: string): string {
    const keys = TOKEN_ENV_FALLBACK[botId] || (tokenEnv ? [tokenEnv] : []);
    for (const key of keys) {
        const val = (Deno.env.get(key) ?? '').trim();
        if (val) return val;
    }
    return '';
}

async function tgApi(token: string, method: string, body?: Record<string, unknown>) {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: body ? 'POST' : 'GET',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: !!data?.ok, data, status: res.status };
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    try {
        const authHeader = req.headers.get('Authorization') ?? '';
        if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

        const token = authHeader.replace('Bearer ', '');
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!;
        const supabaseService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        const userClient = createClient(supabaseUrl, supabaseAnon, {
            global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: { user }, error: authErr } = await userClient.auth.getUser();
        if (authErr || !user) return json({ error: 'Invalid session' }, 401);
        if (!isSuperAdmin(user)) return json({ error: 'Super Admin access required' }, 403);

        const admin = createClient(supabaseUrl, supabaseService);
        const body = await req.json().catch(() => ({} as Record<string, unknown>));
        const action = String(body.action || 'list');

        if (action === 'list') {
            const { data: bots } = await admin.from('telegram_bots').select('*').order('kind').order('title');
            const { data: mutes } = await admin.from('telegram_channel_mutes').select('cabinet_id, channel, muted');
            const { data: cabinets } = await admin.from('cabinets').select('id, name').order('name');

            const live = await Promise.all((bots || []).map(async (bot) => {
                const tok = tokenForBot(bot.token_env, bot.id);
                let me: Record<string, unknown> | null = null;
                let webhook: Record<string, unknown> | null = null;
                if (tok && !bot.deleted_at) {
                    const meRes = await tgApi(tok, 'getMe');
                    if (meRes.ok) me = meRes.data?.result || null;
                    const whRes = await tgApi(tok, 'getWebhookInfo');
                    if (whRes.ok) webhook = whRes.data?.result || null;
                }
                return {
                    ...bot,
                    has_token: Boolean(tok),
                    live_username: me?.username || bot.username || null,
                    live_name: me?.first_name || null,
                    webhook_url: webhook?.url || null,
                    status: bot.deleted_at
                        ? 'deleted'
                        : !bot.is_enabled
                            ? 'disabled'
                            : !tok
                                ? 'no_token'
                                : me
                                    ? 'online'
                                    : 'offline',
                };
            }));

            return json({
                bots: live,
                channels: getTelegramRoutingStatus(),
                channel_labels: TELEGRAM_CHANNEL_LABELS,
                notify_configured: Boolean(getTelegramToken()),
                cabinets: cabinets || [],
                mutes: mutes || [],
            });
        }

        const botId = String(body.bot_id || '');
        if (!botId) return json({ error: 'bot_id required' }, 400);

        const { data: bot } = await admin.from('telegram_bots').select('*').eq('id', botId).maybeSingle();
        if (!bot) return json({ error: 'bot not found' }, 404);
        const tok = tokenForBot(bot.token_env, bot.id);

        if (action === 'disable' || action === 'enable') {
            const enabled = action === 'enable';
            const { error } = await admin.from('telegram_bots').update({
                is_enabled: enabled,
                deleted_at: enabled ? null : bot.deleted_at,
                updated_at: new Date().toISOString(),
            }).eq('id', botId);
            if (error) return json({ error: error.message }, 500);
            return json({ ok: true, bot_id: botId, is_enabled: enabled });
        }

        if (action === 'delete') {
            let webhook: Record<string, unknown> | null = null;
            if (tok) {
                const del = await tgApi(tok, 'deleteWebhook', { drop_pending_updates: true });
                webhook = { ok: del.ok, description: del.data?.description };
            }
            const { error } = await admin.from('telegram_bots').update({
                is_enabled: false,
                deleted_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                notes: 'Удалён из админки: webhook снят, рассылки остановлены',
            }).eq('id', botId);
            if (error) return json({ error: error.message }, 500);
            return json({ ok: true, bot_id: botId, telegram: webhook, purged: true });
        }

        if (action === 'restore') {
            const { error } = await admin.from('telegram_bots').update({
                is_enabled: true,
                deleted_at: null,
                updated_at: new Date().toISOString(),
            }).eq('id', botId);
            if (error) return json({ error: error.message }, 500);
            return json({ ok: true, bot_id: botId, restored: true });
        }

        return json({ error: 'unknown action' }, 400);
    } catch (e) {
        return json({ error: String((e as Error).message || e) }, 500);
    }
});

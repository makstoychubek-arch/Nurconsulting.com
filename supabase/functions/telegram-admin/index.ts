// Super Admin: статус Telegram-ботов, deleteWebhook, вкл/выкл, удаление.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
    TELEGRAM_CHANNEL_LABELS,
    getTelegramChannelCards,
    getTelegramChatId,
    getTelegramRoutingStatus,
    getTelegramToken,
    type TelegramChannel,
} from '../_shared/telegram-routing.ts';

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

function envTokenForBot(tokenEnv: string | null, botId: string): string {
    const keys = TOKEN_ENV_FALLBACK[botId] || (tokenEnv ? [tokenEnv] : []);
    for (const key of keys) {
        const val = (Deno.env.get(key) ?? '').trim();
        if (val) return val;
    }
    return '';
}

async function tokenForBot(
    admin: ReturnType<typeof createClient>,
    tokenEnv: string | null,
    botId: string,
): Promise<string> {
    try {
        const { data } = await admin.from('telegram_bot_secrets').select('token').eq('bot_id', botId).maybeSingle();
        const secret = String(data?.token || '').trim();
        if (secret) return secret;
    } catch (_) { /* table may not exist yet */ }
    return envTokenForBot(tokenEnv, botId);
}

function slugBotId(title: string, username: string): string {
    const raw = (username || title || 'bot').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24);
    return raw || (`bot${Date.now().toString(36)}`);
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

        const admin = createClient(supabaseUrl, supabaseService);
        const body = await req.json().catch(() => ({} as Record<string, unknown>));
        const action = String(body.action || 'list');

        if (action === 'channels') {
            return json({
                channels: getTelegramChannelCards(),
                channel_labels: TELEGRAM_CHANNEL_LABELS,
                notify_configured: Boolean(getTelegramToken()),
            });
        }

        if (action === 'send_channel') {
            const channel = String(body.channel || '').trim() as TelegramChannel;
            const text = String(body.text || '').trim();
            if (!text) return json({ error: 'нужен текст сообщения' }, 400);
            if (!TELEGRAM_CHANNEL_LABELS[channel]) return json({ error: 'неизвестный канал' }, 400);
            const tok = getTelegramToken();
            const chatId = getTelegramChatId(channel);
            if (!tok || !chatId) return json({ error: `канал «${TELEGRAM_CHANNEL_LABELS[channel]}» не подключён` }, 400);
            let cabName = '';
            const cabinetId = String(body.cabinet_id || '').trim();
            if (cabinetId) {
                const { data: cab } = await admin.from('cabinets').select('name').eq('id', cabinetId).maybeSingle();
                cabName = String(cab?.name || '').trim();
            }
            const label = TELEGRAM_CHANNEL_LABELS[channel];
            const payload = [cabName ? `NR Space · ${label} · ${cabName}` : `NR Space · ${label}`, '', text].join('\n');
            const sent = await tgApi(tok, 'sendMessage', {
                chat_id: chatId,
                text: payload,
                disable_web_page_preview: true,
            });
            if (!sent.ok) return json({ error: sent.data?.description || 'Telegram не принял сообщение' }, 400);
            return json({ ok: true, channel, message_id: sent.data?.result?.message_id || null });
        }

        if (!isSuperAdmin(user)) return json({ error: 'Super Admin access required' }, 403);

        if (action === 'list') {
            const { data: bots } = await admin.from('telegram_bots').select('*').order('kind').order('title');
            const { data: mutes } = await admin.from('telegram_channel_mutes').select('cabinet_id, channel, muted');
            const { data: cabinets } = await admin.from('cabinets').select('id, name').order('name');

            const live = await Promise.all((bots || []).map(async (bot) => {
                const tok = await tokenForBot(admin, bot.token_env, bot.id);
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

        if (action === 'create') {
            const title = String(body.title || '').trim();
            const token = String(body.token || '').trim();
            const username = String(body.username || '').trim().replace(/^@/, '');
            const kind = ['notify', 'agent', 'utility'].includes(String(body.kind || ''))
                ? String(body.kind)
                : 'agent';
            const notes = String(body.notes || '').trim();
            if (!title || !token) return json({ error: 'нужны название и токен бота' }, 400);
            const meRes = await tgApi(token, 'getMe');
            if (!meRes.ok) return json({ error: 'Telegram не принял токен' }, 400);
            const liveUser = String(meRes.data?.result?.username || username || '').trim();
            let botId = slugBotId(title, liveUser);
            const { data: exists } = await admin.from('telegram_bots').select('id').eq('id', botId).maybeSingle();
            if (exists) botId = `${botId}${Date.now().toString(36).slice(-4)}`;
            const webhookPath = kind === 'notify' ? null : `telegram-router?bot=${botId}`;
            const { error: insErr } = await admin.from('telegram_bots').insert({
                id: botId,
                kind,
                title,
                username: liveUser || null,
                token_env: 'CUSTOM_BOT_TOKEN',
                webhook_path: webhookPath,
                is_enabled: true,
                notes: notes || 'Добавлен из кабинета',
                updated_at: new Date().toISOString(),
            });
            if (insErr) return json({ error: insErr.message }, 500);
            const { error: secErr } = await admin.from('telegram_bot_secrets').upsert({
                bot_id: botId,
                token,
                updated_at: new Date().toISOString(),
            });
            if (secErr) return json({ error: 'бот создан, но токен не сохранился: ' + secErr.message }, 500);
            if (webhookPath) {
                const hookUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/${webhookPath}`;
                const secret = (Deno.env.get('TELEGRAM_WEBHOOK_SECRET') ?? '').trim();
                await tgApi(token, 'setWebhook', {
                    url: hookUrl,
                    secret_token: secret || undefined,
                    allowed_updates: ['message', 'edited_message', 'business_message', 'edited_business_message'],
                    drop_pending_updates: false,
                });
            }
            return json({ ok: true, bot_id: botId, username: liveUser });
        }

        const botId = String(body.bot_id || '');
        if (!botId) return json({ error: 'bot_id required' }, 400);

        const { data: bot } = await admin.from('telegram_bots').select('*').eq('id', botId).maybeSingle();
        if (!bot) return json({ error: 'bot not found' }, 404);
        const tok = await tokenForBot(admin, bot.token_env, bot.id);

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

        if (action === 'set_webhook') {
            if (!tok) return json({ error: 'no token' }, 400);
            const path = bot.webhook_path || `telegram-router?bot=${botId}`;
            const hookUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/${path}`;
            const secret = (Deno.env.get('TELEGRAM_WEBHOOK_SECRET') ?? '').trim();
            const set = await tgApi(tok, 'setWebhook', {
                url: hookUrl,
                secret_token: secret || undefined,
                allowed_updates: ['message', 'edited_message', 'business_message', 'edited_business_message'],
                drop_pending_updates: false,
            });
            if (set.ok && !bot.webhook_path) {
                await admin.from('telegram_bots').update({
                    webhook_path: path,
                    updated_at: new Date().toISOString(),
                }).eq('id', botId);
            }
            return json({ ok: set.ok, url: hookUrl, telegram: set.data });
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

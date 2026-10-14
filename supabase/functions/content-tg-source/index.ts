// Supabase Edge Function: content-tg-source
//
// Telegram-канал кабинета как источник постов для Instagram.
//   status   — { cabinet_id }: бот контента и канал кабинета
//   save_bot — { token }: подключить бота контента (только супер-админ), токен уходит в Vault
//   save     — { cabinet_id, channel, mode, target, ... }: привязать канал и правила
//   check    — { cabinet_id }: проверить, что бот администратор канала
//   remove   — { cabinet_id }: отвязать канал
// deno-lint-ignore-file no-explicit-any

import { adminClient, CORS, env, json, userFromRequest } from '../_shared/akylai-server.ts';
import { hasAllCabinetsAccess, isSuperAdminUser } from '../_shared/cabinet-access.ts';
import { readAdvTokenFromVault } from '../_shared/wb-adv-proxy.ts';

async function tg(token: string, method: string, body: Record<string, unknown> = {}) {
    try {
        const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        return await res.json().catch(() => ({ ok: false, description: 'bad response' })) as any;
    } catch (e) {
        return { ok: false, description: e instanceof Error ? e.message : String(e) };
    }
}

async function canUse(admin: any, user: { id: string; email: string }, cabinetId: string) {
    if (await hasAllCabinetsAccess(admin, user)) return true;
    const { data } = await admin.from('cabinets').select('id').eq('id', cabinetId).eq('user_id', user.id).maybeSingle();
    return !!data;
}

function botView(row: any) {
    return { configured: !!row?.token_secret_id, username: row?.username ?? null };
}

/** @name, t.me/name, https://t.me/name или числовой id -100… */
export function channelRef(input: string): string | number | null {
    const s = String(input || '').trim();
    if (!s) return null;
    if (/^-?\d{5,}$/.test(s)) return Number(s);
    const m = /^(?:https?:\/\/)?(?:t\.me|telegram\.me)\/([A-Za-z0-9_]{4,})\/?$/i.exec(s) || /^@?([A-Za-z0-9_]{4,})$/.exec(s);
    return m ? '@' + m[1] : null;
}

const MODES = ['manual', 'auto'], TARGETS = ['feed', 'story', 'both'];

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    const user = await userFromRequest(req);
    if (!user) return json({ error: 'Нужен вход' }, 401);
    const admin = adminClient();
    let body: any = {};
    try { body = await req.json(); } catch { /* пусто */ }
    const action = String(body.action || 'status');
    const cabinetId = String(body.cabinet_id || '');
    const { data: botRow } = await admin.from('content_tg_bot').select('*').eq('id', true).maybeSingle();

    if (action === 'save_bot') {
        if (!isSuperAdminUser(user)) return json({ error: 'Только для супер-админа' }, 403);
        const token = String(body.token || '').trim();
        if (!/^\d+:[\w-]{30,}$/.test(token)) return json({ error: 'Это не похоже на токен бота (123456:ABC…)' }, 400);
        const me = await tg(token, 'getMe');
        if (!me.ok) return json({ error: 'Telegram не принял токен: ' + (me.description || '') }, 400);
        const secret = crypto.randomUUID().replace(/-/g, '');
        let secretId: string | null = botRow?.token_secret_id ?? null;
        if (secretId) {
            const { error } = await admin.rpc('update_vault_secret', { p_id: secretId, p_secret: token });
            if (error) return json({ error: 'Vault: ' + error.message }, 500);
        } else {
            const { data, error } = await admin.rpc('store_vault_secret', { p_name: 'content-tg-bot-token', p_secret: token });
            if (error || !data) return json({ error: 'Vault: ' + (error?.message || 'нет id') }, 500);
            secretId = String(data);
        }
        const hook = await tg(token, 'setWebhook', {
            url: `${env('SUPABASE_URL').replace(/\/$/, '')}/functions/v1/content-tg-ingest`,
            secret_token: secret,
            allowed_updates: ['channel_post'],
            drop_pending_updates: true,
        });
        if (!hook.ok) return json({ error: 'Не удалось включить приём постов: ' + (hook.description || '') }, 500);
        const { error } = await admin.from('content_tg_bot').upsert({
            id: true, token_secret_id: secretId, bot_id: me.result.id, username: me.result.username ?? null,
            webhook_secret: secret, updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });
        if (error) return json({ error: error.message }, 500);
        return json({ bot: { configured: true, username: me.result.username ?? null } });
    }

    if (!cabinetId) return json({ error: 'cabinet_id required' }, 400);
    if (!(await canUse(admin, user, cabinetId))) return json({ error: 'Нет доступа к кабинету' }, 403);
    const { data: src } = await admin.from('content_tg_sources').select('*').eq('cabinet_id', cabinetId).maybeSingle();

    if (action === 'status') {
        return json({ bot: botView(botRow), source: src ?? null, can_setup_bot: isSuperAdminUser(user) });
    }
    if (action === 'remove') {
        await admin.from('content_tg_sources').delete().eq('cabinet_id', cabinetId);
        return json({ bot: botView(botRow), source: null });
    }

    if (!botRow?.token_secret_id) return json({ error: 'Бот контента ещё не подключён. Попросите супер-админа добавить токен.' }, 400);
    const token = await readAdvTokenFromVault(admin, botRow.token_secret_id);
    if (!token) return json({ error: 'Токен бота недоступен' }, 500);

    async function verify(chatId: number) {
        const m = await tg(token!, 'getChatMember', { chat_id: chatId, user_id: botRow.bot_id });
        const st = m.ok ? m.result?.status : null;
        return { ok: st === 'administrator' || st === 'creator', status: st, error: m.ok ? null : (m.description || 'нет доступа') };
    }

    if (action === 'check') {
        if (!src) return json({ error: 'Канал не привязан' }, 400);
        const v = await verify(Number(src.chat_id));
        const patch = { bot_ok: v.ok, checked_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        await admin.from('content_tg_sources').update(patch).eq('cabinet_id', cabinetId);
        return json({ bot: botView(botRow), source: { ...src, ...patch }, check: v });
    }

    if (action === 'save') {
        let chatId = src ? Number(src.chat_id) : 0, title = src?.chat_title ?? null, uname = src?.chat_username ?? null;
        const ref = body.channel != null && String(body.channel).trim() !== '' ? channelRef(String(body.channel)) : (src ? chatId : null);
        if (ref == null) return json({ error: 'Укажите канал: @имя или ссылку t.me/…' }, 400);
        if (!src || String(ref) !== String(src.chat_id) && ref !== ('@' + (src.chat_username || ''))) {
            const chat = await tg(token, 'getChat', { chat_id: ref });
            if (!chat.ok) return json({ error: 'Канал не найден. Добавьте бота администратором в канал и повторите (' + (chat.description || '') + ')' }, 400);
            chatId = Number(chat.result.id); title = chat.result.title ?? null; uname = chat.result.username ?? null;
        }
        const mode = MODES.includes(body.mode) ? body.mode : (src?.mode ?? 'manual');
        const target = TARGETS.includes(body.target) ? body.target : (src?.target ?? 'feed');
        const v = await verify(chatId);
        const row = {
            cabinet_id: cabinetId, chat_id: chatId, chat_title: title, chat_username: uname, mode, target,
            delay_minutes: Math.max(0, Math.min(10080, Math.round(Number(body.delay_minutes ?? src?.delay_minutes ?? 120)))),
            daily_time: /^\d{1,2}:\d{2}$/.test(String(body.daily_time ?? '')) ? String(body.daily_time) : (body.daily_time === '' || body.daily_time === null ? null : (src?.daily_time ?? null)),
            take_text: body.take_text ?? src?.take_text ?? true,
            take_albums: body.take_albums ?? src?.take_albums ?? true,
            strip_links: body.strip_links ?? src?.strip_links ?? true,
            add_signature: body.add_signature ?? src?.add_signature ?? true,
            signature: body.signature != null ? String(body.signature).slice(0, 600) : (src?.signature ?? null),
            enabled: true, bot_ok: v.ok, checked_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        };
        const { error } = await admin.from('content_tg_sources').upsert(row, { onConflict: 'cabinet_id' });
        if (error) return json({ error: /duplicate|unique/i.test(error.message) ? 'Этот канал уже привязан к другому кабинету' : error.message }, 400);
        return json({ bot: botView(botRow), source: row, check: v });
    }
    return json({ error: 'unknown action' }, 400);
});

// Supabase Edge Function: akylai-status
//
// Состояние мастера Акылай для сайта — считается из базы, отдельно не хранится:
// есть ли кабинет и токен, подключён ли Telegram, включён ли агент.
// Действия (только над своим кабинетом):
//   { action: 'state' }                  — текущее состояние (по умолчанию);
//   { action: 'link' }                   — новая одноразовая ссылка в Telegram (24 ч);
//   { action: 'toggle', enabled: bool }  — тумблер «Включено».
// chat_id и токен наружу не отдаются.
// deno-lint-ignore-file no-explicit-any

import { AKYLAI_LINK_TTL_MS, akylaiErrorMessage, deriveAkylaiStep, type AkylaiState } from '../_shared/akylai-core.ts';
import {
    adminClient, agentLog, background, CORS, env, json, kickReviews, ownAkylaiCabinet, userFromRequest,
} from '../_shared/akylai-server.ts';
import { randomLinkCode, sha256Hex } from '../_shared/secret-box.ts';

async function readState(admin: any, userId: string) {
    const cab = await ownAkylaiCabinet(admin, userId);
    if (!cab) {
        const s: AkylaiState = { hasCabinet: false, tokenState: 'missing', telegram: 'none', enabled: false };
        return { cab: null, state: s };
    }
    const { data: secret } = await admin
        .from('cabinet_secrets').select('token_exp, token_broken').eq('cabinet_id', cab.id).maybeSingle();
    const { data: chat } = await admin.from('akylai_chats').select('blocked').eq('cabinet_id', cab.id).maybeSingle();
    const { data: settings } = await admin
        .from('akylai_settings').select('enabled, auto_publish, published_count').eq('cabinet_id', cab.id).maybeSingle();

    const expired = secret?.token_broken === true
        || (secret?.token_exp && new Date(secret.token_exp).getTime() <= Date.now());
    const s: AkylaiState = {
        hasCabinet: true,
        tokenState: !secret ? 'missing' : expired ? 'expired' : 'ok',
        telegram: !chat ? 'none' : chat.blocked ? 'blocked' : 'connected',
        enabled: settings?.enabled === true,
    };
    return { cab, state: s, settings };
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    const admin = adminClient();
    try {
        const user = await userFromRequest(req);
        if (!user) return json({ ok: false, code: 'UNAUTHORIZED', message: akylaiErrorMessage('UNAUTHORIZED') }, 401);

        const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
        const action = String(body?.action || 'state');
        const { cab, state, settings } = await readState(admin, user.id);

        if (action === 'link') {
            if (!cab || state.tokenState !== 'ok') return json({ ok: false, code: 'NO_CABINET' });
            const bot = env('AKYLAI_BOT_USERNAME').replace(/^@/, '');
            if (!bot) {
                await agentLog(admin, cab.id, 'bot_username_missing', {});
                return json({ ok: false, code: 'SERVER_ERROR' });
            }
            // Старые неиспользованные ссылки гасим: рабочая — только последняя.
            await admin.from('akylai_links').delete().eq('cabinet_id', cab.id).is('used_at', null);
            const code = randomLinkCode();
            const { error } = await admin.from('akylai_links').insert({
                code_hash: await sha256Hex(code),
                cabinet_id: cab.id,
                user_id: user.id,
                expires_at: new Date(Date.now() + AKYLAI_LINK_TTL_MS).toISOString(),
            });
            if (error) {
                await agentLog(admin, cab.id, 'link_insert_failed', { db: error.message });
                return json({ ok: false, code: 'SERVER_ERROR' });
            }
            return json({ ok: true, url: `https://t.me/${bot}?start=${code}` });
        }

        if (action === 'toggle') {
            if (!cab || state.telegram !== 'connected') return json({ ok: false, code: 'NO_TELEGRAM' });
            const enabled = body?.enabled === true;
            await admin.from('akylai_settings')
                .update({ enabled, updated_at: new Date().toISOString() })
                .eq('cabinet_id', cab.id);
            await agentLog(admin, cab.id, enabled ? 'enabled' : 'disabled', { user_id: user.id });
            if (enabled) background(kickReviews(cab.id));
            return json({ ok: true, enabled });
        }

        return json({
            ok: true,
            step: deriveAkylaiStep(state),
            token: state.tokenState,
            telegram: state.telegram,
            enabled: state.enabled,
            auto_publish: settings?.auto_publish === true,
            published_count: Number(settings?.published_count) || 0,
            cabinet: cab ? { id: cab.id, name: cab.name } : null,
        });
    } catch (e) {
        console.error('[akylai-status]', e);
        await agentLog(admin, null, 'status_crashed', { error: String((e as Error)?.message || e).slice(0, 300) });
        return json({ ok: false, code: 'SERVER_ERROR' }, 500);
    }
});

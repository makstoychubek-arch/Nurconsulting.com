// Supabase Edge Function: tg-login — вход и регистрация через Telegram. Публичная (verify_jwt выключен).
//   POST {action:'start'}                → {token, url}   сайт открывает бота по url
//   POST {action:'verify', token, code}  → {token_hash}   сайт обменивает его на сессию: supabase.auth.verifyOtp({token_hash, type:'magiclink'})
// Код присылает бот Акылай (akylai-bot) после «/start lg_<token>». Токен и код одноразовые, живут 5 минут, 5 попыток.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
    codeHash, displayName, isExpired, randomHex, sha256, telegramEmail, TG_LOGIN_MAX_ATTEMPTS,
} from '../_shared/tg-login.ts';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return json({ error: 'method' }, 405);
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const body = await req.json().catch(() => ({}));

    try {
        if (body.action === 'start') return await start(admin);
        if (body.action === 'verify') return await verify(admin, String(body.token || ''), String(body.code || ''));
        return json({ error: 'action' }, 400);
    } catch (e) {
        console.error('[tg-login]', (e as Error).message);
        return json({ error: 'server' }, 500);
    }
});

async function start(admin: any) {
    const bot = (Deno.env.get('AKYLAI_BOT_USERNAME') ?? '').replace(/^@/, '').trim();
    if (!bot) return json({ error: 'bot_not_configured' }, 503);
    // Общий предохранитель от спама: не больше 60 новых токенов в минуту.
    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await admin.from('tg_login_tokens').select('id', { count: 'exact', head: true }).gte('created_at', since);
    if ((count || 0) >= 60) return json({ error: 'busy' }, 429);
    // Старые токены не копим.
    await admin.from('tg_login_tokens').delete().lt('created_at', new Date(Date.now() - 3600_000).toISOString());
    const token = randomHex(16);
    const { error } = await admin.from('tg_login_tokens').insert({ token_hash: await sha256(token) });
    if (error) throw new Error(error.message);
    return json({ token, bot, url: `https://t.me/${bot}?start=lg_${token}` });
}

async function verify(admin: any, token: string, code: string) {
    if (!/^[a-f0-9]{32}$/.test(token) || !/^\d{6}$/.test(code.trim())) return json({ error: 'bad_input' }, 400);
    const { data: row } = await admin.from('tg_login_tokens').select('*').eq('token_hash', await sha256(token)).maybeSingle();
    if (!row || row.status === 'used') return json({ error: 'invalid' }, 400);
    if (isExpired(row.created_at)) return json({ error: 'expired' }, 400);
    if (row.status !== 'code_sent' || !row.tg_id) return json({ error: 'no_code' }, 400);
    if (row.attempts >= TG_LOGIN_MAX_ATTEMPTS) return json({ error: 'locked' }, 429);

    if (row.code_hash !== await codeHash(token, code)) {
        await admin.from('tg_login_tokens').update({ attempts: row.attempts + 1 }).eq('id', row.id);
        return json({ error: 'wrong_code', left: Math.max(0, TG_LOGIN_MAX_ATTEMPTS - row.attempts - 1) }, 400);
    }
    // Токен гасим сразу: повторно им войти нельзя.
    const { data: claimed } = await admin.from('tg_login_tokens').update({ status: 'used' }).eq('id', row.id).eq('status', 'code_sent').select('id');
    if (!claimed?.length) return json({ error: 'invalid' }, 400);

    const tgId = Number(row.tg_id);
    const email = telegramEmail(tgId);
    const name = row.tg_name || displayName(null);
    const created = await admin.auth.admin.createUser({
        email, email_confirm: true,
        user_metadata: { full_name: name, telegram_id: tgId, telegram_username: row.tg_username || '', provider_name: 'telegram' },
    });
    if (created.error && !/already|registered|exists/i.test(created.error.message)) throw new Error(created.error.message);

    const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    const hashed = link?.data?.properties?.hashed_token;
    const userId = link?.data?.user?.id || created?.data?.user?.id;
    if (!hashed || !userId) throw new Error('no_link');

    await admin.from('tg_identities').upsert({
        tg_id: tgId, user_id: userId, username: row.tg_username || null, full_name: name, last_login: new Date().toISOString(),
    }, { onConflict: 'tg_id' });
    return json({ ok: true, token_hash: hashed });
}

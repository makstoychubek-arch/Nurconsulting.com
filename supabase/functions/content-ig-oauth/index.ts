// content-ig-oauth — OAuth Instagram Graph + ручное сохранение long-lived токена в Vault.
// App ID/Secret: FACEBOOK_APP_ID / FACEBOOK_APP_SECRET в env функции.
// Сам токен в таблицу не пишется.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import { hasAllCabinetsAccess } from '../_shared/cabinet-access.ts';
import { graphUrl, parseGraphBody } from '../_shared/content-ig-publish.ts';
import { readAdvTokenFromVault } from '../_shared/wb-adv-proxy.ts';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const SPACE_URL = 'https://nurcon.kg/content';

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    });
}

function redirect(url: string) {
    return new Response(null, { status: 302, headers: { ...CORS, Location: url } });
}

function appCreds() {
    const id = (Deno.env.get('FACEBOOK_APP_ID') || Deno.env.get('IG_APP_ID') || '').trim();
    const secret = (Deno.env.get('FACEBOOK_APP_SECRET') || Deno.env.get('IG_APP_SECRET') || '').trim();
    return { id, secret };
}

function oauthRedirectUri(req: Request): string {
    const env = (Deno.env.get('IG_OAUTH_REDIRECT') || '').trim();
    if (env) return env;
    const u = new URL(req.url);
    return `${u.origin}/functions/v1/content-ig-oauth`;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    if (!supabaseUrl || !serviceKey) return json({ error: 'missing_env' }, 500);
    const admin = createClient(supabaseUrl, serviceKey);

    if (req.method === 'GET') {
        const url = new URL(req.url);
        const code = url.searchParams.get('code') || '';
        const state = url.searchParams.get('state') || '';
        const err = url.searchParams.get('error_description') || url.searchParams.get('error') || '';
        if (err) return redirect(`${SPACE_URL}?ig=error&msg=${encodeURIComponent(err.slice(0, 120))}`);
        if (!code) return json({ ok: true, configured: !!appCreds().id && !!appCreds().secret });
        try {
            await handleOAuthCallback(admin, req, code, state);
            return redirect(`${SPACE_URL}?ig=ok`);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error('[content-ig-oauth]', msg);
            return redirect(`${SPACE_URL}?ig=error&msg=${encodeURIComponent(msg.slice(0, 120))}`);
        }
    }

    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    const bearer = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (isServiceAuthorized(req, serviceKey)) {
        return json({ error: 'use user JWT' }, 403);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${bearer}` } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ error: 'Invalid session' }, 401);

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const action = String(body.action || '');
    const cabinetId = String(body.cabinet_id || '');
    if (!cabinetId) return json({ error: 'cabinet_id required' }, 400);
    if (!(await canUseCabinet(admin, user, cabinetId))) return json({ error: 'no cabinet access' }, 403);

    const { id: appId, secret: appSecret } = appCreds();

    if (action === 'status') {
        const { data } = await admin.from('content_ig_accounts')
            .select('ig_user_id, ig_username, page_id, token_secret_id, token_expires_at, connected_at')
            .eq('cabinet_id', cabinetId)
            .maybeSingle();
        return json({
            ok: true,
            configured: !!(appId && appSecret),
            connected: !!(data?.token_secret_id && data?.ig_user_id),
            ig_username: data?.ig_username || null,
            ig_user_id: data?.ig_user_id || null,
            expires_at: data?.token_expires_at || null,
            connected_at: data?.connected_at || null,
        });
    }

    if (action === 'oauth_url') {
        if (!appId) {
            return json({
                error: 'Facebook App ID не задан. Зарегистрируйте приложение на developers.facebook.com и положите FACEBOOK_APP_ID / FACEBOOK_APP_SECRET в env функции.',
            }, 400);
        }
        const state = btoa(JSON.stringify({ cabinet_id: cabinetId, uid: user.id, t: Date.now() }));
        const u = new URL(`https://www.facebook.com/${'v21.0'}/dialog/oauth`);
        u.searchParams.set('client_id', appId);
        u.searchParams.set('redirect_uri', oauthRedirectUri(req));
        u.searchParams.set('state', state);
        u.searchParams.set('response_type', 'code');
        u.searchParams.set('scope', 'instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement,business_management');
        return json({ ok: true, url: u.toString() });
    }

    if (action === 'store_token') {
        const token = String(body.token || '').replace(/\s+/g, '').trim();
        if (token.length < 20) return json({ error: 'token too short' }, 400);
        const igUserIdHint = String(body.ig_user_id || '').trim();
        try {
            const profile = await resolveIgAccount(token, igUserIdHint);
            const secretId = await upsertVaultToken(admin, cabinetId, token);
            const expiresAt = new Date(Date.now() + 55 * 86400000).toISOString();
            await admin.from('content_ig_accounts').upsert({
                cabinet_id: cabinetId,
                ig_user_id: profile.igUserId,
                page_id: profile.pageId,
                ig_username: profile.username,
                token_secret_id: secretId,
                token_expires_at: expiresAt,
                connected_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }, { onConflict: 'cabinet_id' });
            return json({
                ok: true,
                connected: true,
                ig_username: profile.username,
                ig_user_id: profile.igUserId,
            });
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return json({ error: msg }, 400);
        }
    }

    if (action === 'disconnect') {
        const { data } = await admin.from('content_ig_accounts')
            .select('id')
            .eq('cabinet_id', cabinetId)
            .maybeSingle();
        if (data?.id) {
            await admin.from('content_ig_accounts').update({
                token_secret_id: null,
                ig_user_id: null,
                page_id: null,
                ig_username: null,
                token_expires_at: null,
                updated_at: new Date().toISOString(),
            }).eq('id', data.id);
        }
        return json({ ok: true, connected: false });
    }

    return json({ error: 'unknown action' }, 400);
});

async function canUseCabinet(
    admin: ReturnType<typeof createClient>,
    user: { id: string; email?: string | null },
    cabinetId: string,
): Promise<boolean> {
    if (await hasAllCabinetsAccess(admin, user)) return true;
    const { data } = await admin.from('cabinets').select('id').eq('id', cabinetId).eq('user_id', user.id).maybeSingle();
    return !!data;
}

async function handleOAuthCallback(
    admin: ReturnType<typeof createClient>,
    req: Request,
    code: string,
    stateRaw: string,
) {
    const { id: appId, secret: appSecret } = appCreds();
    if (!appId || !appSecret) throw new Error('Facebook App не настроен');
    let state: { cabinet_id?: string };
    try {
        state = JSON.parse(atob(stateRaw));
    } catch {
        throw new Error('bad oauth state');
    }
    const cabinetId = String(state.cabinet_id || '');
    if (!cabinetId) throw new Error('cabinet missing in state');

    const tokenUrl = new URL(graphUrl('oauth/access_token'));
    tokenUrl.searchParams.set('client_id', appId);
    tokenUrl.searchParams.set('client_secret', appSecret);
    tokenUrl.searchParams.set('redirect_uri', oauthRedirectUri(req));
    tokenUrl.searchParams.set('code', code);
    const shortRes = await fetch(tokenUrl.toString());
    const shortJson = await shortRes.json().catch(() => ({}));
    const shortTok = String(shortJson.access_token || '');
    if (!shortTok) throw new Error(shortJson.error?.message || 'oauth token failed');

    const longUrl = new URL(graphUrl('oauth/access_token'));
    longUrl.searchParams.set('grant_type', 'fb_exchange_token');
    longUrl.searchParams.set('client_id', appId);
    longUrl.searchParams.set('client_secret', appSecret);
    longUrl.searchParams.set('fb_exchange_token', shortTok);
    const longRes = await fetch(longUrl.toString());
    const longJson = await longRes.json().catch(() => ({}));
    const token = String(longJson.access_token || shortTok);
    const profile = await resolveIgAccount(token, '');
    const secretId = await upsertVaultToken(admin, cabinetId, token);
    const expiresAt = new Date(Date.now() + 55 * 86400000).toISOString();
    await admin.from('content_ig_accounts').upsert({
        cabinet_id: cabinetId,
        ig_user_id: profile.igUserId,
        page_id: profile.pageId,
        ig_username: profile.username,
        token_secret_id: secretId,
        token_expires_at: expiresAt,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }, { onConflict: 'cabinet_id' });
}

async function resolveIgAccount(token: string, hint: string): Promise<{ igUserId: string; pageId: string | null; username: string | null }> {
    if (hint) {
        const me = await fetch(graphUrl(`${hint}?fields=id,username&access_token=${encodeURIComponent(token)}`));
        const js = await me.json().catch(() => ({}));
        const parsed = parseGraphBody(me.status, js);
        if (parsed.ok || js.id) {
            return { igUserId: String(js.id || hint), pageId: null, username: js.username || null };
        }
    }
    const pagesRes = await fetch(graphUrl(`me/accounts?fields=id,name,instagram_business_account{id,username}&access_token=${encodeURIComponent(token)}`));
    const pagesJs = await pagesRes.json().catch(() => ({}));
    const data = Array.isArray(pagesJs.data) ? pagesJs.data : [];
    for (const p of data) {
        const ig = p?.instagram_business_account;
        if (ig?.id) {
            return { igUserId: String(ig.id), pageId: String(p.id || ''), username: ig.username || null };
        }
    }
    const me = await fetch(graphUrl(`me?fields=id,username&access_token=${encodeURIComponent(token)}`));
    const meJs = await me.json().catch(() => ({}));
    if (meJs.id) return { igUserId: String(meJs.id), pageId: null, username: meJs.username || null };
    throw new Error(pagesJs.error?.message || meJs.error?.message || 'Не найден Instagram Business-аккаунт');
}

async function upsertVaultToken(
    admin: ReturnType<typeof createClient>,
    cabinetId: string,
    token: string,
): Promise<string> {
    const { data: existing } = await admin.from('content_ig_accounts')
        .select('token_secret_id')
        .eq('cabinet_id', cabinetId)
        .maybeSingle();
    if (existing?.token_secret_id) {
        const prev = await readAdvTokenFromVault(admin, existing.token_secret_id);
        if (prev) {
            const { error } = await admin.rpc('update_vault_secret', {
                p_id: existing.token_secret_id,
                p_secret: token,
            });
            if (!error) return String(existing.token_secret_id);
        }
    }
    const { data, error } = await admin.rpc('store_vault_secret', {
        p_name: `ig-token-${cabinetId}`,
        p_secret: token,
    });
    if (error || !data) throw new Error(error?.message || 'vault write failed');
    return String(data);
}

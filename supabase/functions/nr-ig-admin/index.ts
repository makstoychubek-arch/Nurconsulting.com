// Supabase Edge Function: nr-ig-admin
//
// Настройки собственного Instagram NR Space. Только супер-админ. Токен хранится в Vault и наружу не отдаётся.
//   get    — статус и настройки (без токена)
//   save   — { ig_user_id, page_id, token?, settings } сохранить
//   verify — проверить токен запросом к Graph API
// deno-lint-ignore-file no-explicit-any

import { adminClient, CORS, json, userFromRequest } from '../_shared/akylai-server.ts';
import { isSuperAdminUser } from '../_shared/cabinet-access.ts';
import { GRAPH_HOST, GRAPH_VERSION } from '../_shared/content-ig-publish.ts';

async function isSuper(admin: any, user: { id: string; email: string }) {
    if (isSuperAdminUser(user)) return true;
    const { data } = await admin.from('spaces').select('is_super_admin, status').eq('user_id', user.id).maybeSingle();
    return data?.is_super_admin === true && data?.status === 'active';
}

function view(row: any) {
    return {
        ig_user_id: row?.ig_user_id ?? '', page_id: row?.page_id ?? '', ig_username: row?.ig_username ?? '',
        has_token: !!row?.token_secret_id, token_set_at: row?.token_set_at ?? null,
        settings: row?.settings ?? {}, verified_at: row?.verified_at ?? null, verify_error: row?.verify_error ?? null,
    };
}

async function readToken(admin: any, id: string): Promise<string | null> {
    const { data } = await admin.schema('vault').from('decrypted_secrets').select('decrypted_secret').eq('id', id).maybeSingle();
    return data?.decrypted_secret ?? null;
}

const BACK = 'https://nurcon.kg/goods';
const SCOPES = 'instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement,business_management';

function appCreds() {
    return {
        id: (Deno.env.get('FACEBOOK_APP_ID') || Deno.env.get('IG_APP_ID') || '').trim(),
        secret: (Deno.env.get('FACEBOOK_APP_SECRET') || Deno.env.get('IG_APP_SECRET') || '').trim(),
    };
}
function redirectUri(req: Request) {
    return `${new URL(req.url).origin}/functions/v1/nr-ig-admin`;
}
async function hmac(secret: string, msg: string) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg)));
    return Array.from(sig).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function back(q: string) {
    return new Response(null, { status: 302, headers: { Location: `${BACK}?${q}` } });
}
const gj = async (url: string) => { try { return await (await fetch(url)).json(); } catch (e) { return { error: { message: String(e) } }; } };

// Возврат из Facebook: проверяем подпись state, меняем код на долгий токен, находим страницу и Instagram.
async function callback(admin: any, req: Request, url: URL) {
    const err = url.searchParams.get('error_description') || url.searchParams.get('error');
    if (err) return back('ig=error&msg=' + encodeURIComponent(err.slice(0, 150)));
    const code = url.searchParams.get('code') || '';
    const state = url.searchParams.get('state') || '';
    const { id, secret } = appCreds();
    if (!code || !id || !secret) return back('ig=error&msg=' + encodeURIComponent('Нет App ID/Secret'));
    const [t, sig] = state.split('.');
    if (!t || !sig || sig !== await hmac(secret, t) || Date.now() - Number(t) > 15 * 60000) return back('ig=error&msg=' + encodeURIComponent('Просроченная ссылка, начните заново'));
    const g = `${GRAPH_HOST}/${GRAPH_VERSION}`;
    const short = await gj(`${g}/oauth/access_token?client_id=${id}&client_secret=${secret}&redirect_uri=${encodeURIComponent(redirectUri(req))}&code=${encodeURIComponent(code)}`);
    if (!short.access_token) return back('ig=error&msg=' + encodeURIComponent(String(short.error?.message || 'Токен не получен').slice(0, 150)));
    const long = await gj(`${g}/oauth/access_token?grant_type=fb_exchange_token&client_id=${id}&client_secret=${secret}&fb_exchange_token=${encodeURIComponent(short.access_token)}`);
    const token = String(long.access_token || short.access_token);
    const pages = await gj(`${g}/me/accounts?fields=id,name,instagram_business_account{id,username}&access_token=${encodeURIComponent(token)}`);
    const hit = (pages.data || []).find((p: any) => p?.instagram_business_account?.id);
    if (!hit) return back('ig=error&msg=' + encodeURIComponent('Не найдена страница Facebook с привязанным Instagram Business'));
    const { data: row } = await admin.from('nr_instagram').select('token_secret_id').eq('id', true).maybeSingle();
    let secretId: string | null = row?.token_secret_id ?? null;
    if (secretId && await readToken(admin, secretId) != null) {
        await admin.rpc('update_vault_secret', { p_id: secretId, p_secret: token });
    } else {
        const { data } = await admin.rpc('store_vault_secret', { p_name: 'nr-instagram-token', p_secret: token });
        secretId = data ? String(data) : null;
    }
    await admin.from('nr_instagram').upsert({
        id: true, ig_user_id: String(hit.instagram_business_account.id), page_id: String(hit.id),
        ig_username: hit.instagram_business_account.username ?? null, token_secret_id: secretId,
        token_set_at: new Date().toISOString(), verified_at: new Date().toISOString(), verify_error: null, updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
    return back('ig=ok');
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method === 'GET') return await callback(adminClient(), req, new URL(req.url));
    const user = await userFromRequest(req);
    if (!user) return json({ error: 'Нужен вход' }, 401);
    const admin = adminClient();
    if (!(await isSuper(admin, user))) return json({ error: 'Только для супер-админа' }, 403);

    let body: any = {};
    try { body = await req.json(); } catch { /* пусто */ }
    const action = body.action ?? 'get';
    const { data: row } = await admin.from('nr_instagram').select('*').eq('id', true).maybeSingle();

    if (action === 'get') return json({ ...view(row), oauth_ready: !!(appCreds().id && appCreds().secret) });

    if (action === 'oauth_url') {
        const { id, secret } = appCreds();
        if (!id || !secret) return json({ error: 'В Supabase не заданы FACEBOOK_APP_ID и FACEBOOK_APP_SECRET' }, 400);
        const t = String(Date.now());
        const u = new URL('https://www.facebook.com/' + GRAPH_VERSION + '/dialog/oauth');
        u.searchParams.set('client_id', id);
        u.searchParams.set('redirect_uri', redirectUri(req));
        u.searchParams.set('state', `${t}.${await hmac(secret, t)}`);
        u.searchParams.set('response_type', 'code');
        u.searchParams.set('scope', SCOPES);
        return json({ url: u.toString(), redirect_uri: redirectUri(req) });
    }

    if (action === 'save') {
        const patch: any = { id: true, updated_at: new Date().toISOString() };
        if (typeof body.ig_user_id === 'string') patch.ig_user_id = body.ig_user_id.trim().replace(/\D/g, '');
        if (typeof body.page_id === 'string') patch.page_id = body.page_id.trim().replace(/\D/g, '');
        if (body.settings && typeof body.settings === 'object') {
            patch.settings = {
                caption_footer: String(body.settings.caption_footer ?? '').slice(0, 1000),
                hashtags: String(body.settings.hashtags ?? '').slice(0, 1000),
                auto_publish: body.settings.auto_publish === true,
            };
        }
        const token = typeof body.token === 'string' ? body.token.trim() : '';
        if (token) {
            if (token.length < 30) return json({ error: 'Токен слишком короткий' }, 400);
            let secretId: string | null = row?.token_secret_id ?? null;
            if (secretId && await readToken(admin, secretId) != null) {
                const { error } = await admin.rpc('update_vault_secret', { p_id: secretId, p_secret: token });
                if (error) return json({ error: 'Vault: ' + error.message }, 500);
            } else {
                const { data, error } = await admin.rpc('store_vault_secret', { p_name: 'nr-instagram-token', p_secret: token });
                if (error || !data) return json({ error: 'Vault: ' + (error?.message || 'нет id') }, 500);
                secretId = String(data);
            }
            patch.token_secret_id = secretId;
            patch.token_set_at = new Date().toISOString();
            patch.verified_at = null; patch.verify_error = null;
        }
        const { error } = await admin.from('nr_instagram').upsert(patch, { onConflict: 'id' });
        if (error) return json({ error: error.message }, 500);
        const { data: fresh } = await admin.from('nr_instagram').select('*').eq('id', true).maybeSingle();
        return json(view(fresh));
    }

    if (action === 'verify') {
        if (!row?.ig_user_id) return json({ error: 'Введите ID Instagram-аккаунта и сохраните' }, 400);
        if (!row.token_secret_id) return json({ error: 'Токен не сохранён' }, 400);
        const token = await readToken(admin, row.token_secret_id);
        if (!token) return json({ error: 'Токен не найден в Vault' }, 500);
        const url = `${GRAPH_HOST}/${GRAPH_VERSION}/${row.ig_user_id}?fields=username,followers_count&access_token=${encodeURIComponent(token)}`;
        let res: any = null;
        try { res = await (await fetch(url)).json(); } catch (e) { res = { error: { message: String(e) } }; }
        const patch: any = res?.username
            ? { ig_username: res.username, verified_at: new Date().toISOString(), verify_error: null }
            : { verified_at: null, verify_error: String(res?.error?.message || 'Не удалось проверить').slice(0, 300) };
        await admin.from('nr_instagram').update(patch).eq('id', true);
        const { data: fresh } = await admin.from('nr_instagram').select('*').eq('id', true).maybeSingle();
        return json({ ...view(fresh), followers: res?.followers_count ?? null });
    }

    return json({ error: 'Неизвестное действие' }, 400);
});

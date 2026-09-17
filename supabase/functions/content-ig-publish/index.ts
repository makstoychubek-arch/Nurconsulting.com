// content-ig-publish — публикация карусели сейчас. Cron ходит в content-publish-tick.
// dry_run в теле не вызывает Graph API.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import { hasAllCabinetsAccess } from '../_shared/cabinet-access.ts';
import { readAdvTokenFromVault } from '../_shared/wb-adv-proxy.ts';
import {
    parseIgDryRun,
    postGraphForm,
    runIgPublish,
} from '../_shared/content-ig-publish.ts';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    });
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    if (!supabaseUrl || !serviceKey) return json({ error: 'missing_env' }, 500);

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    const bearer = authHeader.replace(/^Bearer\s+/i, '').trim();
    const admin = createClient(supabaseUrl, serviceKey);
    const isService = isServiceAuthorized(req, serviceKey);

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const dryRun = parseIgDryRun(Deno.env.get('CONTENT_IG_DRY_RUN'), body);
    const postId = String(body.post_id || '');
    if (!postId) return json({ error: 'post_id required' }, 400);

    let user: { id: string; email?: string | null } | null = null;
    if (!isService) {
        const userClient = createClient(supabaseUrl, anonKey, {
            global: { headers: { Authorization: `Bearer ${bearer}` } },
        });
        const { data: { user: u }, error } = await userClient.auth.getUser();
        if (error || !u) return json({ error: 'Invalid session' }, 401);
        user = u;
    }

    const { data: post, error: postErr } = await admin
        .from('content_posts')
        .select('id, cabinet_id, platform, status, slide_urls, file_url, caption')
        .eq('id', postId)
        .maybeSingle();
    if (postErr || !post) return json({ error: 'post not found' }, 404);
    if (!isService) {
        const ok = user && (
            await hasAllCabinetsAccess(admin, user)
            || !!(await admin.from('cabinets').select('id').eq('id', post.cabinet_id).eq('user_id', user.id).maybeSingle()).data
        );
        if (!ok) return json({ error: 'no cabinet access' }, 403);
    }
    if (post.platform !== 'instagram') {
        return json({ error: 'Публикация через API только для Instagram' }, 400);
    }

    const { data: acc } = await admin.from('content_ig_accounts')
        .select('ig_user_id, token_secret_id')
        .eq('cabinet_id', post.cabinet_id)
        .maybeSingle();
    const token = acc?.token_secret_id ? await readAdvTokenFromVault(admin, acc.token_secret_id) : null;
    const igUserId = String(acc?.ig_user_id || '');
    const slides = Array.isArray(post.slide_urls)
        ? post.slide_urls.map((u: unknown) => String(u || '')).filter(Boolean)
        : [];
    if (!slides.length && post.file_url) slides.push(String(post.file_url));

    const result = await runIgPublish({
        dryRun,
        igUserId,
        token: token || '',
        slideUrls: slides,
        caption: post.caption || undefined,
        postGraph: (path, body) => postGraphForm(fetch, path, body),
    });

    if (dryRun) return json({ ok: true, ...result });

    if (!result.published) {
        await admin.from('content_posts').update({
            status: 'error',
            error_text: result.error || 'Ошибка публикации Instagram',
            updated_at: new Date().toISOString(),
        }).eq('id', postId);
        return json({ ok: false, ...result }, 400);
    }

    await admin.from('content_posts').update({
        status: 'published',
        error_text: null,
        post_url: result.permalink || null,
        ig_media_id: result.mediaId || null,
        updated_at: new Date().toISOString(),
    }).eq('id', postId);

    return json({ ok: true, ...result });
});

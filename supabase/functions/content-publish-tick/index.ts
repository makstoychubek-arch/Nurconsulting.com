// content-publish-tick — каждые 5 мин. Берёт scheduled Instagram-посты, у которых
// publish_at уже наступило, и публикует карусель. dry_run — только отчёт.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import { readAdvTokenFromVault } from '../_shared/wb-adv-proxy.ts';
import { parseIgDryRun, postGraphForm } from '../_shared/content-ig-publish.ts';
import { runContentPublishTick, type ContentPostRow, type TickDeps } from '../_shared/content-publish-tick.ts';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

type Admin = SupabaseClient;

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST' && req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceKey) return json({ error: 'missing_env' }, 500);
    if (!isServiceAuthorized(req, serviceKey)) return json({ error: 'Unauthorized' }, 401);

    const body = req.method === 'GET'
        ? Object.fromEntries(new URL(req.url).searchParams)
        : await req.json().catch(() => ({} as Record<string, unknown>));
    const dryRun = parseIgDryRun(Deno.env.get('CONTENT_PUBLISH_DRY_RUN'), body);
    const now = new Date();
    const admin = createClient(supabaseUrl, serviceKey);

    try {
        const result = await runContentPublishTick(makeDeps(admin, now, dryRun));
        return json({ ok: true, ...result });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[content-publish-tick]', msg);
        return json({ error: msg }, 500);
    }
});

function makeDeps(admin: Admin, now: Date, dryRun: boolean): TickDeps {
    const iso = now.toISOString();
    return {
        now,
        dryRun,
        async listDue() {
            const { data, error } = await admin
                .from('content_posts')
                .select('id, cabinet_id, platform, status, publish_at, slide_urls, file_url, caption')
                .eq('status', 'scheduled')
                .lte('publish_at', iso)
                .order('publish_at', { ascending: true })
                .limit(20);
            if (error) throw new Error(error.message);
            return (data || []) as ContentPostRow[];
        },
        async claim(id) {
            const { data, error } = await admin
                .from('content_posts')
                .update({ status: 'scheduled', error_text: 'publishing', updated_at: iso })
                .eq('id', id)
                .eq('status', 'scheduled')
                .select('id')
                .maybeSingle();
            if (error) throw new Error(error.message);
            return !!data;
        },
        async finish(id, patch) {
            const { error } = await admin.from('content_posts').update({
                status: patch.status,
                error_text: patch.error_text ?? null,
                post_url: patch.post_url ?? undefined,
                ig_media_id: patch.ig_media_id ?? undefined,
                updated_at: iso,
            }).eq('id', id);
            if (error) throw new Error(error.message);
        },
        async loadIg(cabinetId) {
            const { data, error } = await admin
                .from('content_ig_accounts')
                .select('ig_user_id, token_secret_id')
                .eq('cabinet_id', cabinetId)
                .maybeSingle();
            if (error) throw new Error(error.message);
            if (!data?.token_secret_id || !data.ig_user_id) return null;
            const token = await readAdvTokenFromVault(admin, data.token_secret_id);
            if (!token) return null;
            return { token, igUserId: String(data.ig_user_id) };
        },
        postGraph: (path, body) => postGraphForm(fetch, path, body),
    };
}

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    });
}

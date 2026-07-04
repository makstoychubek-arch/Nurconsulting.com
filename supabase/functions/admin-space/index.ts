// Supabase Edge Function: admin-space
// Super Admin only: activate / block client spaces + revoke sessions

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPER_ADMIN_EMAIL = 'global.pro.1004@gmail.com';

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

        if (String(user.email || '').toLowerCase() !== SUPER_ADMIN_EMAIL) {
            return json({ error: 'Super Admin access required' }, 403);
        }

        const body = await req.json().catch(() => ({}));
        const action = String(body.action || '');
        const targetUserId = String(body.user_id || '');

        if (!targetUserId) return json({ error: 'user_id required' }, 400);
        if (targetUserId === user.id) {
            return json({ error: 'Cannot modify your own space via admin panel' }, 400);
        }

        const admin = createClient(supabaseUrl, supabaseService);

        const { data: space, error: spaceErr } = await admin
            .from('spaces')
            .select('id, email, status, user_id')
            .eq('user_id', targetUserId)
            .maybeSingle();

        if (spaceErr || !space) return json({ error: 'Space not found' }, 404);

        if (action === 'activate') {
            const { error: updErr } = await admin
                .from('spaces')
                .update({ status: 'active', updated_at: new Date().toISOString() })
                .eq('user_id', targetUserId);

            if (updErr) return json({ error: updErr.message }, 500);

            if (space.email) {
                const { error: allowErr } = await admin.from('allowed_users').insert({ email: space.email });
                if (allowErr && !/duplicate|unique/i.test(allowErr.message)) {
                    console.warn('[admin-space] allowed_users:', allowErr.message);
                }
            }

            return json({ ok: true, status: 'active', email: space.email });
        }

        if (action === 'block') {
            const { error: updErr } = await admin
                .from('spaces')
                .update({ status: 'blocked', updated_at: new Date().toISOString() })
                .eq('user_id', targetUserId);

            if (updErr) return json({ error: updErr.message }, 500);

            await admin.from('user_sessions').delete().eq('user_id', targetUserId);

            const { error: signOutErr } = await admin.auth.admin.signOut(targetUserId, 'global');
            if (signOutErr) {
                console.warn('[admin-space] signOut:', signOutErr.message);
            }

            return json({ ok: true, status: 'blocked', email: space.email, sessions_revoked: !signOutErr });
        }

        return json({ error: 'Unknown action. Use activate or block.' }, 400);
    } catch (e) {
        console.error('[admin-space]', e);
        return json({ error: String(e?.message || e) }, 500);
    }
});

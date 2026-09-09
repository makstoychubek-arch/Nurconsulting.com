// cleanup_snapshots — 03:00 Бишкек (21:00 UTC предыдущих суток).
// Удаляет serp_position_snapshots и auction_snapshots старше 30 дней.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceAuthorized } from '../_shared/service-auth.ts';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const RETAIN_DAYS = 30;

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST' && req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceKey) return json({ error: 'missing_env' }, 500);
    if (!isServiceAuthorized(req, serviceKey)) return json({ error: 'Unauthorized' }, 401);

    const cutoff = new Date(Date.now() - RETAIN_DAYS * 24 * 3600_000).toISOString();
    const admin = createClient(supabaseUrl, serviceKey);

    const serp = await admin
        .from('serp_position_snapshots')
        .delete()
        .lt('captured_at', cutoff)
        .select('id');
    if (serp.error) {
        console.error('[cleanup-snapshots] serp_position_snapshots', serp.error.message);
        return json({ error: serp.error.message }, 500);
    }

    const auction = await admin
        .from('auction_snapshots')
        .delete()
        .lt('captured_at', cutoff)
        .select('id');
    if (auction.error) {
        console.error('[cleanup-snapshots] auction_snapshots', auction.error.message);
        return json({ error: auction.error.message }, 500);
    }

    return json({
        ok: true,
        cutoff,
        deleted: {
            serp_position_snapshots: (serp.data || []).length,
            auction_snapshots: (auction.data || []).length,
        },
    });
});

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    });
}

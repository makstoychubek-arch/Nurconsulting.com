// Остатки по дням: 03:00 Бишкек = 00:00 МСК следующего дня.
// Сначала свежие wb_stocks, потом write-once снимок закрытого дня продаж (вчера по МСК).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceAuthorized } from '../_shared/service-auth.ts';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    const started = Date.now();
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!isServiceAuthorized(req, serviceKey)) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const stocks = await fetch(`${supabaseUrl}/functions/v1/auto-sync`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode: 'stocks' }),
    });
    const stocksBody = await stocks.json().catch(() => ({} as Record<string, unknown>));
    if (!stocks.ok) {
        return json({ error: String(stocksBody?.error || `stocks HTTP ${stocks.status}`) }, 502);
    }

    const { data: snap, error: snapErr } = await admin.rpc('snapshot_goods_daily_stocks', {
        p_date: null,
        p_cabinet_id: null,
        p_nm_ids: null,
    });
    if (snapErr) return json({ error: snapErr.message, stocks: stocksBody }, 500);

    return json({
        ok: true,
        snap,
        stocks: { cabinets: Array.isArray(stocksBody?.results) ? stocksBody.results.length : 0 },
        ms: Date.now() - started,
    });
});

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// Остатки по дням: 03:00 Бишкек = 00:00 МСК следующего дня.
// Сначала свежие wb_stocks, потом write-once снимок закрытого дня продаж (вчера по МСК).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import { snapshotWbBalances } from '../_shared/wb-balance.ts';

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

    // Баланс WB на конец закрытого дня (вчера по МСК). Тело { only: 'balance', date?, cabinet_id? } — только баланс.
    const reqBody = await req.json().catch(() => ({} as Record<string, unknown>));
    const mskYesterday = new Date(Date.now() + 3 * 3600_000 - 24 * 3600_000).toISOString().slice(0, 10);
    const balanceDate = typeof reqBody?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(reqBody.date) ? reqBody.date : mskYesterday;
    const balance = await snapshotWbBalances(admin, balanceDate, (reqBody?.cabinet_id as string) || null)
        .catch((e) => [{ cabinet: '*', status: 'error', error: String(e?.message || e) }]);
    if (reqBody?.only === 'balance') return json({ ok: true, date: balanceDate, balance });

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
        balance: { date: balanceDate, results: balance },
        stocks: { cabinets: Array.isArray(stocksBody?.results) ? stocksBody.results.length : 0 },
        ms: Date.now() - started,
    });
});

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

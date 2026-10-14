// Supabase Edge Function: perf-sample
//
// Принимает замеры скорости страницы из браузера (nr-perf.js): LCP, FCP, CLS, время загрузки. Без входа и без личных данных.
// Числа проверяются и обрезаются; старше 30 дней записи удаляются.
// deno-lint-ignore-file no-explicit-any

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ms = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n < 600000 ? Math.round(n) : null;
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return new Response('method', { status: 405, headers: CORS });
    let body: any = null;
    try { body = JSON.parse((await req.text()).slice(0, 2000)); } catch { /* не json */ }
    if (!body || typeof body.page !== 'string') return new Response('bad', { status: 400, headers: CORS });
    const cls = Number(body.cls);
    const row = {
        page: String(body.page).split('?')[0].slice(0, 80),
        lcp_ms: ms(body.lcp), fcp_ms: ms(body.fcp), load_ms: ms(body.load), ttfb_ms: ms(body.ttfb),
        cls: Number.isFinite(cls) && cls >= 0 && cls < 100 ? Math.round(cls * 10000) / 10000 : null,
        mobile: body.mobile === true,
        net: String(body.net ?? '').slice(0, 10) || null,
    };
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    await admin.from('perf_samples').insert(row);
    if (Math.random() < 0.01) {
        await admin.from('perf_samples').delete().lt('created_at', new Date(Date.now() - 30 * 86400000).toISOString());
    }
    return new Response('ok', { headers: CORS });
});

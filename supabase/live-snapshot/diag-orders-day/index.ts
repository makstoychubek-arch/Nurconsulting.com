// СНИМОК боевой функции «diag-orders-day» (версия 3), снят 2026-10-06.
// Это скомпилированный код из Supabase, не исходник для деплоя. Зашитые ключи вырезаны.
// Временная диагностика: WB Analytics sales-funnel/products за период против отчёта WB. Токен наружу не отдаёт.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
function isService(req, serviceKey) {
  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!bearer) return false;
  if (bearer === serviceKey) return true;
  try {
    const p = JSON.parse(atob(bearer.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return p.role === 'service_role' && p.ref === 'fiukyfyhotctvfdidktx';
  } catch  {
    return false;
  }
}
Deno.serve(async (req)=>{
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!isService(req, key)) return new Response('unauthorized', {
    status: 401
  });
  const body = await req.json().catch(()=>({}));
  const admin = createClient(url, key);
  const work = (async ()=>{
    const { data: cab } = await admin.from('cabinets').select('wb_token').eq('id', body.cabinet_id).single();
    const token = String(cab?.wb_token ?? '').trim();
    let result;
    try {
      const { data: arts } = await admin.from('rnp_articles').select('nm_id').eq('cabinet_id', body.cabinet_id).eq('is_active', true).limit(20);
      const nmIds = (arts || []).map((a)=>Number(a.nm_id));
      const res = await fetch('https://seller-analytics-api.wildberries.ru/api/analytics/v3/sales-funnel/products/history', {
        method: 'POST',
        headers: {
          Authorization: token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          selectedPeriod: {
            start: body.from,
            end: body.to
          },
          nmIds,
          skipDeletedNm: true,
          aggregationLevel: 'day'
        })
      });
      const text = await res.text();
      let js = null;
      try {
        js = JSON.parse(text);
      } catch  {}
      const items = Array.isArray(js) ? js : js?.data || [];
      let days = 0, oc = 0;
      const dates = new Set();
      for (const it of items)for (const d of it.history || []){
        days++;
        oc += Number(d.orderCount || 0);
        dates.add(String(d.date).slice(0, 10));
      }
      result = {
        status: res.status,
        n_items: items.length,
        history_days: days,
        distinct_dates: dates.size,
        orderCount_sum: oc,
        nm_count: nmIds.length,
        error_text: res.ok ? null : text.slice(0, 400)
      };
    } catch (e) {
      result = {
        error: String(e.message).slice(0, 200)
      };
    }
    await admin.from('diag_orders_check').insert({
      day: `hist-${body.from}-${body.to}`,
      result
    });
  })();
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(work);
  else await work;
  return new Response(JSON.stringify({
    ok: true
  }), {
    headers: {
      'Content-Type': 'application/json'
    }
  });
});

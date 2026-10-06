// СНИМОК боевой функции «warehouse-storage-fetch» (версия 26), снят 2026-10-06.
// Это скомпилированный код из Supabase, не исходник для деплоя. Зашитые ключи вырезаны.
// Prefetch paid_storage → warehouse_storage_cache (1 кабинет за вызов, ~90 сек).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { fetchPaidStorageReport, aggregatePaidStorageRows } from '../_shared/wb-analytics-api.ts';
import { CABINET_TOKEN_SELECT, isValidWbToken, pickCabinetToken } from '../_shared/wb-cabinet-tokens.ts';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-nr-setup-key'
};
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') return new Response('ok', {
    headers: CORS
  });
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const body = await req.json().catch(()=>({}));
  if (!isServiceAuthorized(req, serviceKey, Boolean(body?.force))) {
    return json({
      error: 'Unauthorized'
    }, 401);
  }
  const reportDate = typeof body?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : yesterdayBishkek();
  const periodFrom = daysBefore(reportDate, 7);
  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey);
  const { data: cabinets } = await admin.from('cabinets').select(CABINET_TOKEN_SELECT).not('wb_token', 'is', null).gt('wb_token', '').eq('nr_managed', true).order('name');
  const list = (cabinets || []).filter((c)=>isValidWbToken(pickCabinetToken(c, 'analytics')));
  const only = typeof body?.cabinet === 'string' ? body.cabinet : null;
  let target = only ? list.find((c)=>c.name === only) : null;
  if (!target) {
    target = await pickCabinetWithoutCache(admin, list, periodFrom, reportDate);
  }
  if (!target) {
    return json({
      ok: true,
      date: reportDate,
      skipped: 'all_cached',
      results: []
    });
  }
  const cabResult = {
    cabinet: target.name
  };
  try {
    const token = pickCabinetToken(target, 'analytics');
    const rows = await fetchPaidStorageReport(token, periodFrom, reportDate, {
      maxPolls: 18,
      pollMs: 5000
    });
    const total = rows.reduce((s, r)=>s + r.warehousePrice, 0);
    const compact = aggregatePaidStorageRows(rows);
    await admin.from('warehouse_storage_cache').upsert({
      cabinet_id: target.id,
      period_from: periodFrom,
      period_to: reportDate,
      rows: compact,
      total_price: total,
      fetched_at: new Date().toISOString()
    }, {
      onConflict: 'cabinet_id,period_from,period_to'
    });
    cabResult.ok = true;
    cabResult.rows = rows.length;
    cabResult.compact_rows = compact.length;
    cabResult.total = total;
  } catch (e) {
    cabResult.error = String(e).slice(0, 160);
  }
  return json({
    ok: true,
    date: reportDate,
    periodFrom,
    results: [
      cabResult
    ]
  });
});
async function pickCabinetWithoutCache(admin, list, periodFrom, periodTo) {
  for (const cab of list){
    const { data } = await admin.from('warehouse_storage_cache').select('fetched_at').eq('cabinet_id', cab.id).eq('period_from', periodFrom).eq('period_to', periodTo).maybeSingle();
    if (!data?.fetched_at) return cab;
    const ageMs = Date.now() - new Date(data.fetched_at).getTime();
    if (ageMs > 20 * 3600 * 1000) return cab;
  }
  return null;
}
function yesterdayBishkek() {
  const d = new Date(Date.now() + 6 * 3600 * 1000);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
function daysBefore(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
function json(d, s = 200) {
  return new Response(JSON.stringify(d), {
    status: s,
    headers: {
      ...CORS,
      'Content-Type': 'application/json'
    }
  });
}

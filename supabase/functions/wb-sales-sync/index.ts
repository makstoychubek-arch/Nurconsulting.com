// Supabase Edge Function: wb-sales-sync
//
// Продажи и возвраты из статистики WB (/api/v1/supplier/sales) с типом склада (WB или продавца).
// Нужны РНП, чтобы делить продажи на FBO и FBS. Вызывается pg_cron каждый час по service_role.
// Первый запуск тянет 45 дней, дальше — от последней сохранённой даты минус 3 дня (WB догружает правки).
// Тело (необязательно): { cabinet_id, days } — только один кабинет / глубина в днях.
// deno-lint-ignore-file no-explicit-any

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import { sanitizeWbToken } from '../_shared/wb-cabinet-tokens.ts';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const STATS_API = 'https://statistics-api.wildberries.ru';

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function dayStr(offsetDays: number): string {
    return new Date(Date.now() + 6 * 3600_000 - offsetDays * 86400_000).toISOString().slice(0, 10);
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!isServiceAuthorized(req, serviceKey)) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey);
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const onlyCab = typeof body?.cabinet_id === 'string' ? body.cabinet_id : null;
    const days = Number(body?.days) > 0 ? Math.min(90, Number(body.days)) : 0;

    let q = admin.from('cabinets').select('id, name, wb_token').not('wb_token', 'is', null).gt('wb_token', '');
    if (onlyCab) q = q.eq('id', onlyCab);
    const { data: cabs, error } = await q;
    if (error) return json({ error: 'DB_ERROR' }, 500);

    const results: Array<Record<string, unknown>> = [];
    for (const cab of cabs ?? []) {
        try {
            const { data: last } = await admin.from('wb_sales').select('sale_date')
                .eq('cabinet_id', cab.id).order('sale_date', { ascending: false }).limit(1).maybeSingle();
            let from = days ? dayStr(days) : (last?.sale_date ? new Date(Date.parse(last.sale_date) - 3 * 86400_000).toISOString().slice(0, 10) : dayStr(45));
            const res = await fetch(`${STATS_API}/api/v1/supplier/sales?dateFrom=${from}&flag=0`, {
                headers: { Authorization: sanitizeWbToken(cab.wb_token) },
                signal: AbortSignal.timeout(60_000),
            });
            const text = await res.text();
            if (!res.ok) { results.push({ cabinet: cab.name, status: res.status }); continue; }
            const rows: any[] = JSON.parse(text);
            if (!Array.isArray(rows)) { results.push({ cabinet: cab.name, status: 'bad_response' }); continue; }
            const mapped = new Map<string, any>();
            for (const r of rows) {
                const id = String(r.saleID ?? '');
                const date = String(r.date ?? '').slice(0, 10);
                if (!id || !date) continue;
                mapped.set(id, {
                    cabinet_id: cab.id,
                    sale_id: id,
                    srid: r.srid ? String(r.srid) : null,
                    sale_date: date,
                    nm_id: Number(r.nmId) || null,
                    warehouse_type: r.warehouseType ? String(r.warehouseType) : null,
                    is_return: id.toUpperCase().startsWith('R'),
                    price: Number(r.priceWithDisc ?? r.forPay ?? 0) || null,
                    updated_at: new Date().toISOString(),
                });
            }
            const list = Array.from(mapped.values());
            for (let i = 0; i < list.length; i += 500) {
                const { error: upErr } = await admin.from('wb_sales').upsert(list.slice(i, i + 500), { onConflict: 'cabinet_id,sale_id' });
                if (upErr) throw upErr;
            }
            results.push({ cabinet: cab.name, from, rows: rows.length, saved: list.length });
        } catch (e) {
            results.push({ cabinet: cab.name, error: String((e as Error)?.message ?? e).slice(0, 160) });
        }
    }
    return json({ ok: true, results });
});

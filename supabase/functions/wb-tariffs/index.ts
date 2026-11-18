// Supabase Edge Function: wb-tariffs
//
// Тариф WB на логистику и хранение коробов (common-api /api/v1/tariffs/box), уже в валюте кабинета (сом).
// Нужен шапке артикула в РНП: логистика за шт и хранение в день считаются от литража карточки.
// Тариф общий для всех продавцов, поэтому токен берём любой рабочий, а ответ держим в памяти 6 часов.
// Ответ: { ok, date, warehouse, coef_pct, delivery_base, delivery_liter, storage_base, storage_liter, rate, currency }.
// deno-lint-ignore-file no-explicit-any

import { adminClient, COMMON_API, CORS, json, userFromRequest } from '../_shared/akylai-server.ts';

const TTL_MS = 6 * 3600_000;
let cache: { at: number; body: Record<string, unknown> } | null = null;

/** «1 078,2» → 1078.2; «-» и пусто → null. */
function num(v: unknown): number | null {
    const s = String(v ?? '').replace(/[\s ]/g, '').replace(',', '.');
    if (!s || s === '-') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
    try {
        const user = await userFromRequest(req);
        if (!user) return json({ error: 'UNAUTHORIZED' }, 401);
        if (cache && Date.now() - cache.at < TTL_MS) return json(cache.body);

        const admin = adminClient();
        const { data: cabs } = await admin.from('cabinets').select('wb_token').not('wb_token', 'is', null).limit(8);
        const tokens = (cabs || []).map((c: any) => String(c.wb_token || '')).filter((t: string) => t.length > 50);
        if (!tokens.length) return json({ ok: false, error: 'NO_TOKEN' });

        const date = new Date().toISOString().slice(0, 10);
        let list: any[] | null = null;
        for (const t of tokens) {
            const res = await fetch(`${COMMON_API}/api/v1/tariffs/box?date=${date}`, { headers: { Authorization: t } });
            if (!res.ok) continue;
            const j = await res.json().catch(() => null);
            const wl = j?.response?.data?.warehouseList;
            if (Array.isArray(wl) && wl.length) { list = wl; break; }
        }
        if (!list) return json({ ok: false, error: 'WB_UNAVAILABLE' });

        // Базовая строка для FBO: «Склад WB РФ» (общий тариф); если её нет, первая со значением.
        const row = list.find((w: any) => String(w.warehouseName).trim() === 'Склад WB РФ' && num(w.boxDeliveryBase) != null)
            || list.find((w: any) => num(w.boxDeliveryBase) != null);
        if (!row) return json({ ok: false, error: 'NO_ROW' });

        // Курс ₽ → сом (НБКР), последний на сегодня или раньше.
        const { data: fx } = await admin.from('exchange_rates').select('rate').eq('pair', 'RUB_KGS').order('date', { ascending: false }).limit(1).maybeSingle();
        const rate = Number(fx?.rate) || 1;

        const r = (v: unknown) => { const n = num(v); return n == null ? null : Math.round(n * rate * 1000) / 1000; };
        const body = {
            ok: true, date, warehouse: row.warehouseName, coef_pct: num(row.boxDeliveryCoefExpr), currency: 'KGS', rate,
            delivery_base: r(row.boxDeliveryBase), delivery_liter: r(row.boxDeliveryLiter),
            storage_base: r(row.boxStorageBase), storage_liter: r(row.boxStorageLiter),
        };
        cache = { at: Date.now(), body };
        return json(body);
    } catch (_e) {
        return json({ ok: false, error: 'INTERNAL' }, 500);
    }
});

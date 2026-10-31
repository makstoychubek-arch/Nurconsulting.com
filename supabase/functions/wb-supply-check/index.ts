// wb_supply_check — только чтение: сверяет ТН ВЭД и страну производства товаров поставки FBW (supplies-api) с карточками (content-api).
// Только service role. Тело: { supply_id: number|string, cabinet?: 'часть названия кабинета' }.
// Ничего не пишет в WB и в базу, токены в ответ не попадают.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import { sanitizeWbToken } from '../_shared/wb-cabinet-tokens.ts';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const SUPPLIES = 'https://supplies-api.wildberries.ru/api/v1/supplies';
const CARDS = 'https://content-api.wildberries.ru/content/v2/get/cards/list';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const digits = (v: unknown) => String(v ?? '').replace(/\D+/g, '');

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!await isServiceAuthorized(req, key)) return json({ error: 'Unauthorized' }, 401);
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const supplyId = String(body.supply_id ?? '').trim();
    if (!/^\d+$/.test(supplyId)) return json({ error: 'supply_id required' }, 400);

    const admin = createClient(url, key);
    let q = admin.from('cabinets').select('id, name, wb_token').not('wb_token', 'is', null).gt('wb_token', '');
    if (body.cabinet) q = q.ilike('name', `%${String(body.cabinet)}%`);
    const { data: cabs, error } = await q;
    if (error) return json({ error: error.message }, 500);

    const tried: { cabinet: string; status: number }[] = [];
    for (const cab of cabs || []) {
        const token = sanitizeWbToken(cab.wb_token);
        if (token.length < 50) continue;
        const goodsRes = await fetch(`${SUPPLIES}/${supplyId}/goods?limit=1000&offset=0`, { headers: { Authorization: token } });
        tried.push({ cabinet: String(cab.name), status: goodsRes.status });
        if (!goodsRes.ok) { await sleep(400); continue; }
        const goods = await goodsRes.json().catch(() => []) as Record<string, unknown>[];
        if (!Array.isArray(goods) || !goods.length) continue;
        const detailRes = await fetch(`${SUPPLIES}/${supplyId}`, { headers: { Authorization: token } });
        const detail = detailRes.ok ? await detailRes.json().catch(() => null) : null;

        const byNm = new Map<number, { vendor: string; supplyTnved: Set<string>; qty: number; sizes: number }>();
        for (const g of goods) {
            const nm = Number(g.nmID ?? g.nmId ?? 0);
            if (!nm) continue;
            const e = byNm.get(nm) ?? { vendor: String(g.vendorCode ?? ''), supplyTnved: new Set<string>(), qty: 0, sizes: 0 };
            if (g.tnved) e.supplyTnved.add(digits(g.tnved));
            e.qty += Number(g.quantity ?? g.acceptedQuantity ?? 0) || 0;
            e.sizes++;
            byNm.set(nm, e);
        }

        const items: Record<string, unknown>[] = [];
        for (const [nm, e] of byNm) {
            let cardTnved = '', country = '', vendor = e.vendor;
            const docs: Record<string, string> = {}; let cardKeys: string[] = [];
            const r = await fetch(CARDS, {
                method: 'POST', headers: { Authorization: token, 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings: { cursor: { limit: 10 }, filter: { textSearch: String(nm), withPhoto: -1 } } }),
            });
            if (r.ok) {
                const d = await r.json().catch(() => ({}));
                const card = (d.cards || []).find((c: Record<string, unknown>) => Number(c.nmID) === nm);
                if (card) {
                    vendor = String(card.vendorCode ?? vendor);
                    cardKeys = Object.keys(card); docs['_documents'] = JSON.stringify(card.documents ?? null).slice(0, 160);
                    for (const ch of (card.characteristics || []) as { name?: string; value?: unknown }[]) {
                        const n = String(ch.name ?? '').toLowerCase().replace(/\s+/g, '');
                        const v = Array.isArray(ch.value) ? ch.value.join(', ') : String(ch.value ?? '');
                        if (n.includes('тнвэд') || n.includes('тн вэд') || n.includes('tnved')) cardTnved = digits(v);
                        if (n.includes('странапроизводства')) country = v;
                        if (/сертиф|деклар|документ|разрешит/.test(n)) docs[String(ch.name)] = v.slice(0, 80);
                    }
                    if (!cardTnved) for (const s of (card.sizes || []) as Record<string, unknown>[]) if (s.tnved) cardTnved = digits(s.tnved);
                }
            }
            const st = [...e.supplyTnved];
            items.push({
                nm_id: nm, vendor_code: vendor, docs: body.docs ? docs : undefined, card_keys: body.docs && items.length === 0 ? cardKeys : undefined, qty: e.qty, supply_tnved: st.join(', ') || null, card_tnved: cardTnved || null, country: country || null,
                ok: !!cardTnved && st.length > 0 && st.every((t) => t === cardTnved) && /киргиз/i.test(country),
                issues: [
                    !st.length ? 'в поставке нет ТН ВЭД' : '',
                    !cardTnved ? 'в карточке нет ТН ВЭД' : '',
                    st.length && cardTnved && !st.every((t) => t === cardTnved) ? 'ТН ВЭД в поставке и в карточке разные' : '',
                    !/киргиз/i.test(country) ? `страна: ${country || 'не указана'}` : '',
                ].filter(Boolean),
            });
            await sleep(700);
        }
        const bad = items.filter((i) => !i.ok);
        return json({ ok: true, cabinet: cab.name, supply: detail, goods_rows: goods.length, articles: items.length, bad: bad.length, items: bad.length ? bad : undefined, all_ok: !bad.length, sample: items.slice(0, 3), all: body.docs ? items.map((i) => ({ nm_id: i.nm_id, vendor_code: i.vendor_code, docs: i.docs })) : undefined });
    }
    return json({ ok: false, error: 'supply_not_found', tried });
});

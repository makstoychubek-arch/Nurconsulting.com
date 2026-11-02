// Supabase Edge Function: mcp
//
// MCP-сервер для личного ИИ клиента (Claude, ChatGPT). Адрес вида /functions/v1/mcp/<личный ключ>.
// Ключ создаётся в «Настройках → Интеграции», хранится хешем и отзывается кнопкой. Доступны только
// кабинеты этого человека, только чтение, токены WB не отдаются. Функция открыта без входа на сайт:
// проверка идёт по ключу (verify_jwt = false в config.toml).
// deno-lint-ignore-file no-explicit-any

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleRpc, type McpData, type McpGroup, type McpRange, type McpWrite } from '../_shared/mcp-core.ts';
import { planPriceChanges, summarize, WRITE_LIMITS, type PriceCard } from '../_shared/mcp-write.ts';
import { PRICES_API, wbError, wbSend } from '../_shared/wb-agent-wow.ts';
import { sanitizeWbToken } from '../_shared/wb-cabinet-tokens.ts';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type, authorization, mcp-protocol-version, mcp-session-id',
    'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function sha256Hex(s: string): Promise<string> {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function pageAll(build: (from: number, to: number) => any, max = 40000): Promise<any[]> {
    const out: any[] = [];
    for (let from = 0; from < max; from += 1000) {
        const { data, error } = await build(from, from + 999);
        if (error) throw new Error(error.message);
        out.push(...(data || []));
        if (!data || data.length < 1000) break;
    }
    return out;
}

const nextDay = (d: string) => new Date(Date.parse(d) + 86400000).toISOString().slice(0, 10);
const AD_STATUS: Record<string, string> = { '9': 'активна', '11': 'на паузе', '4': 'готова к запуску', '8': 'отклонена', '7': 'завершена (архив)', '-1': 'удалена' };
const adStatusKey = (v: unknown) => { const x = String(v ?? ''); return x === 'active' ? '9' : x === 'paused' ? '11' : x === 'ready' ? '4' : x === 'done' ? '7' : x; };
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 10000) / 100 : null);
const rub = (n: number) => Math.round(n);

function writeFor(admin: any, userId: string, canWrite: boolean): McpWrite {
    const tokenOf = async (cabId: string) => {
        const { data } = await admin.from('cabinets').select('wb_token').eq('id', cabId).maybeSingle();
        return sanitizeWbToken(data?.wb_token);
    };
    const mine = async () => ((await admin.rpc('mcp_writable_cabinets', { p_user: userId })).data || []).map((c: any) => ({ id: c.id, name: c.name }));
    return {
        allowed: async () => canWrite,
        cabinets: mine,
        propose: async (cabId, changes) => {
            if (!(await mine()).some((c: any) => c.id === cabId)) return { error: 'В этом кабинете вы не владелец.' };
            const token = await tokenOf(cabId);
            if (!token) return { error: 'К кабинету не подключён токен WB.' };
            const cards: PriceCard[] = [];
            for (let off = 0; off < 3000; off += 1000) {
                const r = await wbSend(`${PRICES_API}/api/v2/list/goods/filter?limit=1000&offset=${off}`, token);
                if (!r.ok) return { error: 'WB не отдал цены: ' + wbError(r) };
                const list = ((r.data as any)?.data?.listGoods || []) as any[];
                for (const g of list) { const sz = (g.sizes || [])[0] || {}; cards.push({ nmID: Number(g.nmID), vendorCode: String(g.vendorCode || ''), price: Number(sz.price ?? 0), discount: Number(g.discount ?? 0) }); }
                if (list.length < 1000) break;
            }
            const { items, errors } = planPriceChanges(cards, changes);
            if (!items.length) return { изменений: 0, замечания: errors };
            await admin.from('mcp_changes').update({ status: 'expired' }).eq('user_id', userId).eq('status', 'pending');
            const summary = summarize(items);
            const { data: row, error } = await admin.from('mcp_changes').insert({ user_id: userId, cabinet_id: cabId, kind: 'prices', items, summary }).select('id').single();
            if (error) return { error: 'Не удалось подготовить изменение.' };
            return { change_id: row.id, действует_минут: WRITE_LIMITS.ttlMin, будет_изменено: summary, замечания: errors, дальше: 'Покажите это человеку. Если он согласен, вызовите apply_change с этим change_id.' };
        },
        apply: async (changeId) => {
            const { data: ch } = await admin.from('mcp_changes').select('*').eq('id', changeId).eq('user_id', userId).maybeSingle();
            if (!ch) return { error: 'Изменение не найдено.' };
            if (ch.status === 'applied') return { уже_применено: true, upload_id: ch.upload_id };
            if (ch.status !== 'pending') return { error: 'Это изменение уже нельзя применить (' + ch.status + '). Подготовьте новое.' };
            if (Date.now() - new Date(ch.created_at).getTime() > WRITE_LIMITS.ttlMin * 60000) { await admin.from('mcp_changes').update({ status: 'expired' }).eq('id', ch.id); return { error: 'Прошло больше ' + WRITE_LIMITS.ttlMin + ' минут. Подготовьте изменение заново.' }; }
            if (!(await mine()).some((c: any) => c.id === ch.cabinet_id)) return { error: 'В этом кабинете вы не владелец.' };
            const since = new Date(Date.now() - 3600000).toISOString();
            const { count } = await admin.from('mcp_changes').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'applied').gte('applied_at', since);
            if ((count || 0) >= WRITE_LIMITS.maxPerHour) return { error: 'Слишком много изменений за час. Подождите немного.' };
            const token = await tokenOf(ch.cabinet_id);
            const items = (ch.items || []) as any[];
            const r = await wbSend(`${PRICES_API}/api/v2/upload/task`, token, 'POST', { data: items.map((i) => ({ nmID: i.nmID, price: i.will.price, discount: i.will.discount })) });
            if (!r.ok) { await admin.from('mcp_changes').update({ status: 'failed', error: wbError(r) }).eq('id', ch.id); return { error: 'WB не принял изменение: ' + wbError(r) }; }
            const up = ((r.data as any)?.data || {}) as any;
            await admin.from('mcp_changes').update({ status: 'applied', applied_at: new Date().toISOString(), upload_id: up.id ?? null }).eq('id', ch.id);
            try {
                await admin.from('price_changes').insert(items.map((i) => ({ cabinet_id: ch.cabinet_id, nm_id: i.nmID, user_id: userId, old_price: i.was.price, old_discount: i.was.discount, new_price: i.will.price, new_discount: i.will.discount, upload_id: up.id ?? null })));
            } catch (_) { /* журнал цен необязателен */ }
            return { применено: items.length, upload_id: up.id ?? null, примечание: 'WB применяет цены в течение нескольких минут.' };
        },
        cancel: async (changeId) => {
            await admin.from('mcp_changes').update({ status: 'cancelled' }).eq('id', changeId).eq('user_id', userId).eq('status', 'pending');
            return { отменено: true };
        },
    };
}

function dataFor(admin: any, userId: string, canWrite = false): McpData {
    return {
        write: writeFor(admin, userId, canWrite),
        cabinets: async () => {
            const { data } = await admin.rpc('mcp_user_cabinets', { p_user: userId });
            return (data || []).map((c: any) => ({ id: c.id, name: c.name }));
        },
        stocks: async (cabId, article) => {
            const rows = await pageAll((a, b) => admin.from('wb_stocks').select('nm_id, tech_size, quantity, stock_scheme').eq('cabinet_id', cabId).range(a, b));
            const { data: arts } = await admin.from('rnp_articles').select('nm_id, name').eq('cabinet_id', cabId);
            const nameOf = new Map((arts || []).map((x: any) => [Number(x.nm_id), String(x.name || '')]));
            const q = (article || '').toLowerCase();
            const by = new Map<number, any>();
            for (const r of rows) {
                const name = nameOf.get(Number(r.nm_id)) || String(r.nm_id);
                if (q && !name.toLowerCase().includes(q)) continue;
                const e = by.get(r.nm_id) || { article: name, fbo: { всего: 0 }, fbs: { всего: 0 } };
                const side = r.stock_scheme === 'fbs' ? e.fbs : e.fbo;
                side[r.tech_size] = (side[r.tech_size] || 0) + Number(r.quantity || 0);
                side['всего'] += Number(r.quantity || 0);
                by.set(r.nm_id, e);
            }
            return [...by.values()].filter((e) => e.fbo['всего'] + e.fbs['всего'] > 0).sort((a, b) => b.fbs['всего'] + b.fbo['всего'] - a.fbs['всего'] - a.fbo['всего']).slice(0, 150);
        },
        orders: async (cabId, r: McpRange, group: McpGroup) => {
            const rows = await pageAll((a, b) => admin.from('wb_orders').select('order_date, nm_id, wt:data->>warehouseType, art:data->>supplierArticle, cancel:data->>isCancel, pwd:data->>priceWithDisc').eq('cabinet_id', cabId).gte('order_date', r.from).lt('order_date', nextDay(r.to)).range(a, b), 60000);
            const by = new Map<string, any>();
            for (const x of rows) {
                const d = String(x.order_date).slice(0, 10);
                const art = String(x.art || x.nm_id || '—');
                const key = group === 'day' ? d : group === 'article' ? art : d + '|' + art;
                const e = by.get(key) || (group === 'day' ? { date: d } : group === 'article' ? { артикул: art } : { date: d, артикул: art });
                Object.assign(e, { заказов: e.заказов || 0, отменено: e.отменено || 0, сумма_без_отмен: e.сумма_без_отмен || 0, 'склад WB': e['склад WB'] || 0, 'склад продавца': e['склад продавца'] || 0 });
                e.заказов++;
                if (x.cancel === 'true') e.отменено++; else e.сумма_без_отмен += Number(x.pwd || 0);
                if (x.wt === 'Склад продавца') e['склад продавца']++; else e['склад WB']++;
                by.set(key, e);
            }
            const out = [...by.values()].map((e) => ({ ...e, сумма_без_отмен: rub(e.сумма_без_отмен) }));
            return group === 'article' ? out.sort((a: any, b: any) => b.заказов - a.заказов).slice(0, 150) : out.sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)) || b.заказов - a.заказов);
        },
        sales: async (cabId, r: McpRange, group: McpGroup) => {
            const rows = await pageAll((a, b) => admin.from('raw_finance_report').select('sale_dt, rr_dt, sa_name, nm_id, doc_type_name, supplier_oper_name, quantity, retail_price_withdisc_rub').eq('cabinet_id', cabId).gte('sale_dt', r.from).lte('sale_dt', r.to).in('doc_type_name', ['Продажа', 'Возврат']).range(a, b), 80000);
            const by = new Map<string, any>();
            for (const x of rows) {
                const isRet = String(x.doc_type_name).toLowerCase() === 'возврат';
                if (!isRet && /компенсац/i.test(String(x.supplier_oper_name || ''))) continue;
                const d = String(x.sale_dt || x.rr_dt).slice(0, 10);
                const art = String(x.sa_name || x.nm_id || '—');
                const key = group === 'day' ? d : group === 'article' ? art : d + '|' + art;
                const e = by.get(key) || (group === 'day' ? { date: d } : group === 'article' ? { артикул: art } : { date: d, артикул: art });
                Object.assign(e, { выкуплено_шт: e.выкуплено_шт || 0, возвратов_шт: e.возвратов_шт || 0, сумма_выкупов: e.сумма_выкупов || 0 });
                const q = Number(x.quantity || 0);
                if (isRet) e.возвратов_шт += q; else { e.выкуплено_шт += q; e.сумма_выкупов += Number(x.retail_price_withdisc_rub || 0) * q; }
                by.set(key, e);
            }
            const out = [...by.values()].map((e) => ({ ...e, сумма_выкупов: rub(e.сумма_выкупов) }));
            return group === 'article' ? out.sort((a: any, b: any) => b.выкуплено_шт - a.выкуплено_шт).slice(0, 150) : out.sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)) || b.выкуплено_шт - a.выкуплено_шт);
        },
        adCampaigns: async (cabId, status, r: McpRange | null) => {
            const { data: legacy } = await admin.from('advertising_campaigns').select('campaign_id, campaign_name, status, payment_type, bid_type, type').eq('cabinet_id', cabId).range(0, 4999);
            const { data: v2 } = await admin.from('adv_campaigns').select('wb_campaign_id, name, status').eq('cabinet_id', cabId).range(0, 4999);
            const v2By = new Map<number, any>((v2 || []).map((c: any) => [Number(c.wb_campaign_id), c]));
            const stats = new Map<number, any>();
            if (r) {
                const rows = await pageAll((a, b) => admin.from('advertising_daily_stats').select('campaign_id, spend, views, clicks, orders, sum_price').eq('cabinet_id', cabId).gte('stat_date', r.from).lte('stat_date', r.to).range(a, b), 60000);
                for (const x of rows) {
                    const e = stats.get(Number(x.campaign_id)) || { затраты: 0, показы: 0, клики: 0, заказы: 0, сумма_заказов: 0 };
                    e.затраты += Number(x.spend || 0); e.показы += Number(x.views || 0); e.клики += Number(x.clicks || 0); e.заказы += Number(x.orders || 0); e.сумма_заказов += Number(x.sum_price || 0);
                    stats.set(Number(x.campaign_id), e);
                }
            }
            const want = (k: string) => status === 'all' ? true : status === 'active' ? k === '9' : status === 'paused' ? (k === '11' || k === '4') : k === '7' || k === '-1' || k === '8';
            let list = (legacy || []).map((c: any) => {
                const id = Number(c.campaign_id), v = v2By.get(id);
                const k = adStatusKey(v?.status ?? c.status);
                return { id, название: String(v?.name || c.campaign_name || id), статус: AD_STATUS[k] || k, _k: k, оплата: c.payment_type === 'cpc' ? 'за клики' : c.payment_type === 'cpm' ? 'за показы' : (c.payment_type || null), ставка: c.bid_type === 'unified' ? 'единая' : c.bid_type === 'manual' ? 'ручная' : (c.bid_type || null), st: stats.get(id) };
            }).filter((c: any) => want(c._k));
            if (r) list = list.filter((c: any) => c.st && (c.st.затраты > 0 || c.st.показы > 0 || c.st.клики > 0 || c.st.заказы > 0));
            const total = list.length;
            list.sort((a: any, b: any) => (b.st?.затраты || 0) - (a.st?.затраты || 0) || b.id - a.id);
            const out = list.slice(0, 150).map((c: any) => {
                const { _k, st, ...rest } = c;
                return st ? { ...rest, затраты: rub(st.затраты), показы: st.показы, клики: st.клики, ctr_процент: pct(st.клики, st.показы), заказы: st.заказы, сумма_заказов: rub(st.сумма_заказов) } : rest;
            });
            return { период: r || 'не задан (итоги не считаются)', найдено: total, показано: out.length, кампании: out };
        },
        adStats: async (cabId, r: McpRange, campaignId, group) => {
            let q = (a: number, b: number) => admin.from('advertising_daily_stats').select('campaign_id, campaign_name, stat_date, spend, views, clicks, atbs, orders, sum_price').eq('cabinet_id', cabId).gte('stat_date', r.from).lte('stat_date', r.to).range(a, b);
            if (campaignId) q = (a: number, b: number) => admin.from('advertising_daily_stats').select('campaign_id, campaign_name, stat_date, spend, views, clicks, atbs, orders, sum_price').eq('cabinet_id', cabId).eq('campaign_id', campaignId).gte('stat_date', r.from).lte('stat_date', r.to).range(a, b);
            const rows = await pageAll(q, 60000);
            const by = new Map<string, any>();
            for (const x of rows) {
                const d = String(x.stat_date).slice(0, 10);
                const key = group === 'day' ? d : String(x.campaign_id);
                const e = by.get(key) || (group === 'day' ? { date: d } : { id: Number(x.campaign_id), название: String(x.campaign_name || x.campaign_id) });
                Object.assign(e, { затраты: e.затраты || 0, показы: e.показы || 0, клики: e.клики || 0, корзины: e.корзины || 0, заказы: e.заказы || 0, сумма_заказов: e.сумма_заказов || 0 });
                e.затраты += Number(x.spend || 0); e.показы += Number(x.views || 0); e.клики += Number(x.clicks || 0); e.корзины += Number(x.atbs || 0); e.заказы += Number(x.orders || 0); e.сумма_заказов += Number(x.sum_price || 0);
                by.set(key, e);
            }
            const out = [...by.values()].map((e) => ({ ...e, затраты: rub(e.затраты), сумма_заказов: rub(e.сумма_заказов), ctr_процент: pct(e.клики, e.показы), доля_затрат_процент: pct(e.затраты, e.сумма_заказов) }));
            const tot = out.reduce((t: any, e: any) => ({ затраты: t.затраты + e.затраты, показы: t.показы + e.показы, клики: t.клики + e.клики, заказы: t.заказы + e.заказы, сумма_заказов: t.сумма_заказов + e.сумма_заказов }), { затраты: 0, показы: 0, клики: 0, заказы: 0, сумма_заказов: 0 });
            const list = group === 'day' ? out.sort((a: any, b: any) => a.date.localeCompare(b.date)) : out.sort((a: any, b: any) => b.затраты - a.затраты).slice(0, 150);
            return { период: r, итого: tot, строки: list };
        },
        penalties: async (cabId, r: McpRange) => {
            const rows = await pageAll((a, b) => admin.from('raw_finance_report').select('rr_dt, bonus_type_name, penalty, deduction, nm_id, sa_name').eq('cabinet_id', cabId).gte('rr_dt', r.from).lte('rr_dt', r.to).or('penalty.neq.0,deduction.neq.0').range(a, b), 20000);
            return rows.map((r: any) => ({
                date: String(r.rr_dt).slice(0, 10), сумма: rub(Number(r.penalty || 0) + Number(r.deduction || 0)), тип: Number(r.penalty || 0) ? 'штраф' : 'удержание',
                причина: r.bonus_type_name || null, артикул: r.sa_name || null, nm_id: r.nm_id || null,
                поставка: (String(r.bonus_type_name || '').match(/поставка\s+(\d+)/i) || [])[1] || null,
            })).sort((a: any, b: any) => a.date.localeCompare(b.date) || b.сумма - a.сумма);
        },
        finance: async (cabId, r: McpRange) => {
            const rows = await pageAll((a, b) => admin.from('raw_finance_report').select('rr_dt, supplier_oper_name, retail_amount, ppvz_for_pay, delivery_rub, penalty, storage_fee, deduction, acceptance').eq('cabinet_id', cabId).gte('rr_dt', r.from).lte('rr_dt', r.to).range(a, b), 60000);
            const by = new Map<string, any>();
            for (const r of rows) {
                const d = String(r.rr_dt).slice(0, 10);
                const e = by.get(d) || { date: d, продажи: 0, к_перечислению: 0, логистика: 0, хранение: 0, штрафы: 0, удержания: 0, приёмка: 0 };
                const sign = r.supplier_oper_name === 'Возврат' ? -1 : r.supplier_oper_name === 'Продажа' ? 1 : 0;
                e.продажи += sign * Number(r.retail_amount || 0);
                e.к_перечислению += sign * Number(r.ppvz_for_pay || 0);
                e.логистика += Number(r.delivery_rub || 0);
                e.хранение += Number(r.storage_fee || 0);
                e.штрафы += Number(r.penalty || 0);
                e.удержания += Number(r.deduction || 0);
                e.приёмка += Number(r.acceptance || 0);
                by.set(d, e);
            }
            return [...by.values()].sort((a, b) => a.date.localeCompare(b.date)).map((e) => ({
                date: e.date, продажи: rub(e.продажи), к_перечислению: rub(e.к_перечислению), логистика: rub(e.логистика), хранение: rub(e.хранение),
                штрафы: rub(e.штрафы), удержания: rub(e.удержания), приёмка: rub(e.приёмка),
                итого_к_оплате: rub(e.к_перечислению - e.логистика - e.хранение - e.штрафы - e.удержания - e.приёмка),
            }));
        },
    };
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const key = new URL(req.url).pathname.split('/').filter(Boolean).pop() || '';
    if (!/^nrk_[0-9a-f]{64}$/.test(key)) return json({ error: 'Нужен личный ключ из «Настройки → Интеграции».' }, 401);
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const hash = await sha256Hex(key);
    let userId: string | null = null, canWrite = false;
    const full = await admin.rpc('mcp_resolve_key', { p_hash: hash });
    if (!full.error) {
        const row = Array.isArray(full.data) ? full.data[0] : full.data;
        if (row) { userId = row.user_id; canWrite = row.can_write === true; }
    } else {
        // Миграция записи ещё не применена: ключ работает только на чтение.
        userId = (await admin.rpc('mcp_resolve', { p_hash: hash })).data || null;
    }
    if (!userId) return json({ error: 'Ключ не найден или отозван.' }, 401);
    if (req.method !== 'POST') return json({ error: 'Только POST (MCP по HTTP).' }, 405);
    let body: any;
    try { body = await req.json(); } catch { return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, 400); }
    const data = dataFor(admin, String(userId), canWrite);
    if (Array.isArray(body)) {
        const out = (await Promise.all(body.map((m) => handleRpc(m, data)))).filter((x) => x !== null);
        return out.length ? json(out) : new Response(null, { status: 202, headers: CORS });
    }
    const res = await handleRpc(body, data);
    return res === null ? new Response(null, { status: 202, headers: CORS }) : json(res);
});

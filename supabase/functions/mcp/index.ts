// Supabase Edge Function: mcp
//
// MCP-сервер для личного ИИ клиента (Claude, ChatGPT). Адрес вида /functions/v1/mcp/<личный ключ>.
// Ключ создаётся в «Настройках → Интеграции», хранится хешем и отзывается кнопкой. Доступны только
// кабинеты этого человека, только чтение, токены WB не отдаются. Функция открыта без входа на сайт:
// проверка идёт по ключу (verify_jwt = false в config.toml).
// deno-lint-ignore-file no-explicit-any

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleRpc, type McpData } from '../_shared/mcp-core.ts';

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

const sinceDate = (days: number) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
const rub = (n: number) => Math.round(n);

function dataFor(admin: any, userId: string): McpData {
    return {
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
        orders: async (cabId, days) => {
            const since = sinceDate(days);
            const rows = await pageAll((a, b) => admin.from('wb_orders').select('order_date, wt:data->>warehouseType').eq('cabinet_id', cabId).gte('order_date', since).range(a, b));
            const by = new Map<string, any>();
            for (const r of rows) {
                const d = String(r.order_date).slice(0, 10);
                const e = by.get(d) || { date: d, всего: 0, 'склад WB': 0, 'склад продавца': 0 };
                e['всего']++;
                if (r.wt === 'Склад продавца') e['склад продавца']++; else e['склад WB']++;
                by.set(d, e);
            }
            return [...by.values()].sort((a, b) => a.date.localeCompare(b.date));
        },
        penalties: async (cabId, days) => {
            const since = sinceDate(days);
            const rows = await pageAll((a, b) => admin.from('raw_finance_report').select('rr_dt, bonus_type_name, penalty, deduction, nm_id, sa_name').eq('cabinet_id', cabId).gte('rr_dt', since).or('penalty.neq.0,deduction.neq.0').range(a, b), 20000);
            return rows.map((r: any) => ({
                date: String(r.rr_dt).slice(0, 10), сумма: rub(Number(r.penalty || 0) + Number(r.deduction || 0)), тип: Number(r.penalty || 0) ? 'штраф' : 'удержание',
                причина: r.bonus_type_name || null, артикул: r.sa_name || null, nm_id: r.nm_id || null,
                поставка: (String(r.bonus_type_name || '').match(/поставка\s+(\d+)/i) || [])[1] || null,
            })).sort((a: any, b: any) => a.date.localeCompare(b.date) || b.сумма - a.сумма);
        },
        finance: async (cabId, days) => {
            const since = sinceDate(days);
            const rows = await pageAll((a, b) => admin.from('raw_finance_report').select('rr_dt, supplier_oper_name, retail_amount, ppvz_for_pay, delivery_rub, penalty, storage_fee, deduction, acceptance').eq('cabinet_id', cabId).gte('rr_dt', since).range(a, b), 60000);
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
    const { data: userId } = await admin.rpc('mcp_resolve', { p_hash: await sha256Hex(key) });
    if (!userId) return json({ error: 'Ключ не найден или отозван.' }, 401);
    if (req.method !== 'POST') return json({ error: 'Только POST (MCP по HTTP).' }, 405);
    let body: any;
    try { body = await req.json(); } catch { return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, 400); }
    const data = dataFor(admin, String(userId));
    if (Array.isArray(body)) {
        const out = (await Promise.all(body.map((m) => handleRpc(m, data)))).filter((x) => x !== null);
        return out.length ? json(out) : new Response(null, { status: 202, headers: CORS });
    }
    const res = await handleRpc(body, data);
    return res === null ? new Response(null, { status: 202, headers: CORS }) : json(res);
});

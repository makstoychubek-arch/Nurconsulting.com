// wb_news_read — только чтение новостей портала продавца WB (ничего не отправляет и не записывает).
// Только service role. Тело: { from?: 'YYYY-MM-DD', fromID?: number, ids?: number[], match?: 'regex по заголовку и тексту', max_body?: 4000 }.
// GET https://common-api.wildberries.ru/api/communications/v2/news

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceAuthorized } from '../_shared/service-auth.ts';

const WB_NEWS_API = 'https://common-api.wildberries.ru/api/communications/v2/news';
const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!await isServiceAuthorized(req, serviceKey)) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: cabs, error } = await admin.from('cabinets').select('id, wb_token').not('wb_token', 'is', null).gt('wb_token', '').eq('nr_managed', true);
    if (error) return json({ error: error.message }, 500);
    const token = (cabs || []).map((c: { wb_token: string }) => clean(c.wb_token)).find((t: string) => t.length > 50 && /^[\x21-\x7E]+$/.test(t));
    if (!token) return json({ error: 'no_token' }, 400);

    const qs = body.fromID != null ? `fromID=${Number(body.fromID)}` : `from=${encodeURIComponent(String(body.from || daysAgo(7)))}`;
    const res = await fetch(`${WB_NEWS_API}?${qs}`, { headers: { Authorization: token } });
    const text = await res.text();
    if (!res.ok) return json({ error: 'wb_' + res.status, body: text.slice(0, 300) }, 502);
    let data: unknown;
    try { data = JSON.parse(text); } catch { return json({ error: 'bad_json' }, 502); }

    const list = arrayOf(data).map((r) => {
        const o = (r || {}) as Record<string, unknown>;
        return {
            id: Number(o.id ?? o.newsId ?? 0),
            date: String(o.date ?? o.createdAt ?? o.publishDate ?? ''),
            title: String(o.header ?? o.title ?? o.name ?? '').trim(),
            body: strip(String(o.content ?? o.text ?? o.body ?? '')).trim(),
        };
    }).filter((n) => n.id);

    const ids = Array.isArray(body.ids) ? (body.ids as unknown[]).map(Number) : null;
    const re = body.match ? new RegExp(String(body.match), 'i') : null;
    const maxBody = Math.min(Number(body.max_body) || 4000, 20000);
    const items = list
        .filter((n) => (ids ? ids.includes(n.id) : true) && (re ? re.test(n.title + ' ' + n.body) : true))
        .sort((a, b) => a.id - b.id)
        .map((n) => ({ ...n, body: n.body.slice(0, maxBody) }));
    return json({ ok: true, fetched: list.length, matched: items.length, items });
});

function arrayOf(d: unknown): unknown[] {
    if (Array.isArray(d)) return d;
    const o = (d || {}) as Record<string, unknown>;
    for (const k of ['data', 'news', 'items', 'result']) if (Array.isArray(o[k])) return o[k] as unknown[];
    return [];
}
function clean(t: unknown): string { return typeof t === 'string' ? t.replace(/^﻿/, '').replace(/\s+/g, '').trim() : ''; }
function strip(h: string): string { return h.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' '); }
function daysAgo(n: number): string { return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10); }
function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

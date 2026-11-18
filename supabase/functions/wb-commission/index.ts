// Supabase Edge Function: wb-commission
//
// Комиссия WB по предметам (common-api /api/v1/tariffs/commission), в процентах.
// Нужна листу «Планирование»: при выборе артикула комиссия подтягивается по предмету карточки.
// Тариф общий для всех продавцов, поэтому токен берём любой рабочий, список держим в памяти 12 часов.
// Запрос: { subjects: ["Костюмы", "Блузки"] }. Ответ: { ok, items: { "костюмы": { fbo, fbs, dbs } } }, проценты.
// deno-lint-ignore-file no-explicit-any

import { adminClient, COMMON_API, CORS, json, userFromRequest } from '../_shared/akylai-server.ts';

const TTL_MS = 12 * 3600_000;
let cache: { at: number; rows: any[] } | null = null;

const pct = (v: unknown): number | null => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
};

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
    try {
        const user = await userFromRequest(req);
        if (!user) return json({ error: 'UNAUTHORIZED' }, 401);
        const body = await req.json().catch(() => ({}));
        const want = (Array.isArray(body?.subjects) ? body.subjects : []).map((s: unknown) => String(s || '').trim().toLowerCase()).filter(Boolean).slice(0, 50);

        let rows = cache && Date.now() - cache.at < TTL_MS ? cache.rows : null;
        if (!rows) {
            const admin = adminClient();
            const { data: cabs } = await admin.from('cabinets').select('wb_token').not('wb_token', 'is', null).limit(8);
            const tokens = (cabs || []).map((c: any) => String(c.wb_token || '')).filter((t: string) => t.length > 50);
            if (!tokens.length) return json({ ok: false, error: 'NO_TOKEN' });
            for (const t of tokens) {
                const res = await fetch(`${COMMON_API}/api/v1/tariffs/commission?locale=ru`, { headers: { Authorization: t } });
                if (!res.ok) continue;
                const j = await res.json().catch(() => null);
                if (Array.isArray(j?.report) && j.report.length) { rows = j.report; break; }
            }
            if (!rows) return json({ ok: false, error: 'WB_UNAVAILABLE' });
            cache = { at: Date.now(), rows };
        }

        const items: Record<string, { fbo: number | null; fbs: number | null; dbs: number | null }> = {};
        for (const r of rows) {
            const name = String(r.subjectName || '').trim().toLowerCase();
            if (!name || (want.length && !want.includes(name))) continue;
            items[name] = { fbo: pct(r.paidStorageKgvp), fbs: pct(r.kgvpMarketplace), dbs: pct(r.kgvpSupplier) };
        }
        return json({ ok: true, items });
    } catch (_e) {
        return json({ ok: false, error: 'INTERNAL' }, 500);
    }
});

// Supabase Edge Function: advertising-sync
// Задача 6: Кэширование данных рекламы.
// Fetches WB Promotion API campaign stats and upserts them into
// advertising_daily_stats (one row per cabinet+campaign+day), so the
// dashboard's "Контроль РК" tab can read from the DB instead of hitting
// the WB API on every page open.
//
// Auth: service_role key (pg_cron, loops over ALL cabinets with a wb_token,
// no cabinet_id) OR user JWT (manual "Обновить" from the dashboard,
// requires cabinet_id + ownership check). Mirrors supabase/functions/auto-sync.
//
// WB call logic here duplicates wb-proxy's `advert_list` / `advert_campaigns` /
// `advert_stats` actions on purpose: wb-proxy requires a real user JWT and
// cannot be called by a service-role cron job.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPER_ADMIN_EMAIL = 'global.pro.1004@gmail.com';
const SUPER_ADMIN_ID = '2f7d8960-0df4-4a17-be70-f2cb2ac0032e';
const ADV_API = 'https://advert-api.wildberries.ru';
const TRAILING_DAYS = 30; // WB fullstats allows max 31 days per request

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    const started = Date.now();
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
        return json({ error: 'Unauthorized' }, 401);
    }
    const bearer = authHeader.replace('Bearer ', '');

    const admin = createClient(supabaseUrl, serviceKey);
    const isServiceRole = bearer === serviceKey;
    let userId: string | null = null;
    let isSuperAdmin = false;

    if (!isServiceRole) {
        const userClient = createClient(supabaseUrl, anonKey, {
            global: { headers: { Authorization: `Bearer ${bearer}` } },
        });
        const { data: { user }, error: authErr } = await userClient.auth.getUser();
        if (authErr || !user) return json({ error: 'Invalid session' }, 401);
        userId = user.id;
        isSuperAdmin =
            String(user.email || '').toLowerCase() === SUPER_ADMIN_EMAIL ||
            user.id === SUPER_ADMIN_ID;
    }

    let targetCabinetId: string | null = null;
    try {
        const body = await req.json().catch(() => ({}));
        targetCabinetId = body.cabinet_id || null;
    } catch { /* empty body ok for cron */ }

    if (!isServiceRole && !targetCabinetId) {
        return json({ error: 'cabinet_id required for manual sync' }, 400);
    }

    if (!isServiceRole && targetCabinetId && !isSuperAdmin) {
        const { data: owned } = await admin
            .from('cabinets')
            .select('id')
            .eq('id', targetCabinetId)
            .eq('user_id', userId!)
            .maybeSingle();
        if (!owned) return json({ error: 'Cabinet not found or access denied' }, 403);
    }

    let query = admin
        .from('cabinets')
        .select('id, name, wb_token')
        .not('wb_token', 'is', null)
        .gt('wb_token', '');

    if (targetCabinetId) query = query.eq('id', targetCabinetId);

    const { data: cabinets, error: cabErr } = await query;

    if (cabErr || !cabinets || cabinets.length === 0) {
        return json({ error: 'Нет кабинетов с токенами', detail: cabErr }, 400);
    }

    const today = new Date();
    const dateTo = today.toISOString().split('T')[0];
    const fromD = new Date(today);
    fromD.setDate(fromD.getDate() - (TRAILING_DAYS - 1));
    const dateFrom = fromD.toISOString().split('T')[0];

    const results: Array<Record<string, unknown>> = [];

    for (const cabinet of cabinets) {
        const token = sanitizeWbToken(cabinet.wb_token);
        if (!token || !isValidWbToken(token)) {
            results.push({ cabinet: cabinet.name, status: 'skipped', reason: 'invalid_token' });
            continue;
        }

        const cabStart = Date.now();
        let status = 'success';
        let errorMsg = '';
        let campaignsFound = 0;
        let rowsWritten = 0;

        let campaignsWritten = 0;

        try {
            const { ids, meta } = await fetchCampaignIdsAndMeta(token);
            campaignsFound = ids.length;
            await sleep(800);

            if (ids.length > 0) {
                const nameById = await fetchCampaignNames(token);
                await sleep(800);

                // Upsert campaign status/type/name into advertising_campaigns.
                // Cheap: reuses the promotion/count response already fetched
                // above, no extra WB request.
                const campaignRows = ids.map((id) => ({
                    cabinet_id: cabinet.id,
                    campaign_id: id,
                    campaign_name: nameById.get(id) || `Кампания ${id}`,
                    status: meta.get(id)?.status ?? null,
                    type: meta.get(id)?.type ?? null,
                    updated_at: new Date().toISOString(),
                }));
                for (let i = 0; i < campaignRows.length; i += 200) {
                    const chunk = campaignRows.slice(i, i + 200);
                    const { error: campErr } = await admin
                        .from('advertising_campaigns')
                        .upsert(chunk, { onConflict: 'cabinet_id,campaign_id' });
                    if (campErr) {
                        errorMsg += `campaigns upsert: ${campErr.message}; `;
                        status = 'partial';
                    } else {
                        campaignsWritten += chunk.length;
                    }
                }

                const rows: Record<string, unknown>[] = [];
                // WB's fullstats is capped at 3 requests/min regardless of ids-per-request
                // (up to 50 ids per call), so pace chunks well under that limit — 20s
                // between calls keeps us at 3/min even in the worst case.
                const FULLSTATS_CHUNK_DELAY_MS = 20000;
                for (let i = 0; i < ids.length; i += 50) {
                    const chunk = ids.slice(i, i + 50);
                    try {
                        const url = `${ADV_API}/adv/v3/fullstats?ids=${chunk.join(',')}&beginDate=${dateFrom}&endDate=${dateTo}`;
                        const res = await fetch(url, { headers: { Authorization: token } });
                        const text = await res.text();
                        if (res.ok) {
                            const data = JSON.parse(text);
                            if (Array.isArray(data)) {
                                for (const campaign of data as Record<string, unknown>[]) {
                                    const advertId = Number(campaign.advertId);
                                    if (!advertId) continue;
                                    const days = Array.isArray(campaign.days) ? campaign.days as Record<string, unknown>[] : [];
                                    for (const day of days) {
                                        const stat_date = String(day.date || '').split('T')[0];
                                        if (!stat_date) continue;
                                        rows.push({
                                            cabinet_id: cabinet.id,
                                            campaign_id: advertId,
                                            campaign_name: nameById.get(advertId) || `Кампания ${advertId}`,
                                            stat_date,
                                            views: Number(day.views || 0),
                                            clicks: Number(day.clicks || 0),
                                            ctr: Number(day.ctr || 0),
                                            cpc: Number(day.cpc || 0),
                                            spend: Number(day.sum || 0),
                                            atbs: Number(day.atbs || 0),
                                            orders: Number(day.orders || 0),
                                            cr: Number(day.cr || 0),
                                            shks: Number(day.shks || 0),
                                            sum_price: Number(day.sum_price || 0),
                                            data: day,
                                            updated_at: new Date().toISOString(),
                                        });
                                    }
                                }
                            }
                        } else {
                            errorMsg += `fullstats ${res.status}: ${text.slice(0, 200)}; `;
                            status = 'partial';
                        }
                    } catch (e) {
                        errorMsg += `fullstats chunk: ${(e as Error).message}; `;
                        status = 'partial';
                    }
                    // Skip the trailing sleep after the last chunk to avoid wasting
                    // time when there's nothing left to send.
                    if (i + 50 < ids.length) await sleep(FULLSTATS_CHUNK_DELAY_MS);
                }

                for (let i = 0; i < rows.length; i += 200) {
                    const chunk = rows.slice(i, i + 200);
                    const { error: upErr } = await admin
                        .from('advertising_daily_stats')
                        .upsert(chunk, { onConflict: 'cabinet_id,campaign_id,stat_date' });
                    if (upErr) {
                        errorMsg += `upsert: ${upErr.message}; `;
                        status = 'partial';
                    } else {
                        rowsWritten += chunk.length;
                    }
                }
            }
        } catch (e) {
            status = 'error';
            errorMsg = (e as Error).message;
        }

        results.push({
            cabinet: cabinet.name,
            status,
            campaigns: campaignsFound,
            campaigns_meta_written: campaignsWritten,
            rows: rowsWritten,
            error: errorMsg || undefined,
            ms: Date.now() - cabStart,
        });

        await sleep(2000);
    }

    return json({
        ok: true,
        date_from: dateFrom,
        date_to: dateTo,
        cabinets_synced: results.length,
        total_ms: Date.now() - started,
        results,
    });
});

// Mirrors wb-proxy's `advert_list` action. Extended to also capture each
// campaign's `status`/`type` from the SAME /adv/v1/promotion/count response
// (grouped by type+status, so every advert_list item inherits its group's
// type/status) — no extra WB request needed for advertising_campaigns.
// Status codes: -1 удалена, 4 готова к запуску, 7 завершена, 8 отклонена,
// 9 активна, 11 на паузе.
async function fetchCampaignIdsAndMeta(
    token: string,
): Promise<{ ids: number[]; meta: Map<number, { status: number | null; type: number | null }> }> {
    const allIds: number[] = [];
    const meta = new Map<number, { status: number | null; type: number | null }>();
    try {
        const res1 = await fetch(`${ADV_API}/adv/v1/promotion/count`, { headers: { Authorization: token } });
        const text1 = await res1.text();
        if (res1.ok) {
            const data1 = JSON.parse(text1);
            const groups = data1?.adverts;
            if (Array.isArray(groups)) {
                for (const g of groups as Record<string, unknown>[]) {
                    const inner = g?.advert_list as Record<string, unknown>[] | undefined;
                    const groupStatus = g?.status != null ? Number(g.status) : null;
                    const groupType = g?.type != null ? Number(g.type) : null;
                    if (Array.isArray(inner)) {
                        for (const a of inner) {
                            if (!a?.advertId) continue;
                            const id = Number(a.advertId);
                            allIds.push(id);
                            meta.set(id, { status: groupStatus, type: groupType });
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.warn('[advertising-sync] promotion/count error:', String(e));
    }
    if (!allIds.length) {
        try {
            const res2 = await fetch(`${ADV_API}/api/advert/v2/adverts?statuses=9%2C11`, { headers: { Authorization: token } });
            const text2 = await res2.text();
            if (res2.ok) {
                const data2 = JSON.parse(text2);
                const adverts: Record<string, unknown>[] = data2?.adverts || (Array.isArray(data2) ? data2 : []);
                for (const a of adverts) {
                    const id = Number(a.advertId ?? a.id ?? a.advert_id ?? 0);
                    if (!id) continue;
                    allIds.push(id);
                    const st = a.status != null ? Number(a.status) : null;
                    const ty = a.type != null ? Number(a.type) : null;
                    meta.set(id, { status: st, type: ty });
                }
            }
        } catch (e) {
            console.warn('[advertising-sync] advert/v2 error:', String(e));
        }
    }
    return { ids: [...new Set(allIds)], meta };
}

// Mirrors wb-proxy's `advert_campaigns` action — used only for names.
async function fetchCampaignNames(token: string): Promise<Map<number, string>> {
    const map = new Map<number, string>();
    try {
        const res = await fetch(`${ADV_API}/api/advert/v2/adverts?statuses=4%2C9%2C11`, { headers: { Authorization: token } });
        const text = await res.text();
        if (res.ok) {
            const data = JSON.parse(text);
            const adverts: Record<string, unknown>[] = data?.adverts || (Array.isArray(data) ? data : []);
            for (const a of adverts) {
                const id = Number(a.advertId ?? a.id ?? a.advert_id ?? 0);
                if (!id) continue;
                map.set(id, String(a.name ?? a.campaignName ?? ''));
            }
        }
    } catch (e) {
        console.warn('[advertising-sync] advert_campaigns names error:', String(e));
    }
    return map;
}

function sanitizeWbToken(raw: unknown): string {
    if (typeof raw !== 'string') return '';
    return raw.replace(/^\uFEFF/, '').replace(/\s+/g, '').trim();
}

function isValidWbToken(token: string): boolean {
    return token.length > 50 && /^[\x21-\x7E]+$/.test(token);
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    });
}

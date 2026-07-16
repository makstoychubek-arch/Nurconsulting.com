// Supabase Edge Function: wb-clusters
// Полностью изолированный модуль для нового раздела "Кластеры" (/wb-clusters).
// НЕ импортирует и не переиспользует wb-proxy — отдельная реализация auth +
// WB-вызовов, чтобы не создавать побочных эффектов на существующий раздел
// "РК" (кабинеты/кампании/кнопка "Фразы"). Тот раздел не трогаем вообще.
//
// Действия (action в теле POST-запроса):
//   campaigns              — список РК кабинета (adv/v1/promotion/count + api/advert/v2/adverts)
//   campaign_stats         — общая статистика РК за период (adv/v3/fullstats)
//   campaign_clusters      — кластеры запросов кампании (adv/v0/normquery/list + adv/v0/normquery/stats)
//   campaign_clusters_daily— статистика кластеров по дням (adv/v1/normquery/stats)
//
// Все ответы кэшируются на 3 минуты в таблице public.wb_cluster_cache, чтобы
// не упираться в лимиты WB Promotion API (normquery — 3–5 запросов/сек).

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CACHE_TTL_MS = 3 * 60 * 1000; // 3 минуты — частота обновления данных у WB

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    try {
        const authHeader = req.headers.get('Authorization') ?? '';
        if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
        const token = authHeader.replace('Bearer ', '');

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!;
        const supabaseService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        const userClient = createClient(supabaseUrl, supabaseAnon, {
            global: { headers: { Authorization: `Bearer ${token}` } }
        });
        const { data: { user }, error: authErr } = await userClient.auth.getUser();
        if (authErr || !user) return json({ error: 'Invalid session' }, 401);

        const body = await req.json().catch(() => ({}));
        const { action, params = {}, cabinet_id } = body;
        if (!cabinet_id) return json({ error: 'cabinet_id required' }, 400);

        const admin = createClient(supabaseUrl, supabaseService);
        const { data: cab, error: cabErr } = await admin
            .from('cabinets')
            .select('wb_token, name')
            .eq('id', cabinet_id)
            .eq('user_id', user.id)
            .maybeSingle();
        if (cabErr || !cab) return json({ error: 'Cabinet not found or access denied' }, 403);

        const WB_TOKEN = sanitizeWbToken(cab.wb_token);
        if (!WB_TOKEN) return json({ error: 'WB token not configured for this cabinet' }, 400);

        switch (action) {
            case 'campaigns': {
                const cacheKey = `campaigns:${cabinet_id}`;
                const cached = await getCached(admin, cacheKey);
                if (cached) return json({ ...cached, cached: true });

                const result = await fetchCampaigns(WB_TOKEN);
                await setCached(admin, cacheKey, cabinet_id, result);
                return json({ ...result, cached: false });
            }

            case 'campaign_stats': {
                // Принимает либо один campaignId, либо массив campaignIds —
                // WB /adv/v3/fullstats допускает до 50 id в одном запросе,
                // поэтому карточки всех кампаний кабинета грузятся одним вызовом.
                const idsRaw: unknown[] = Array.isArray(params.campaignIds)
                    ? params.campaignIds
                    : params.campaignId != null ? [params.campaignId] : [];
                const ids = [...new Set(idsRaw.map(Number).filter(Boolean))].sort((a, b) => a - b);
                const dateFrom = String(params.dateFrom || '');
                const dateTo = String(params.dateTo || '');
                if (!ids.length || !dateFrom || !dateTo) {
                    return json({ error: 'campaignId(s), dateFrom, dateTo required' }, 400);
                }
                const cacheKey = `stats:${cabinet_id}:${ids.join(',')}:${dateFrom}:${dateTo}`;
                const cached = await getCached(admin, cacheKey);
                if (cached) return json({ ...cached, cached: true });

                const stats = await fetchCampaignStats(WB_TOKEN, ids, dateFrom, dateTo);
                const result = { stats };
                await setCached(admin, cacheKey, cabinet_id, result);
                return json({ ...result, cached: false });
            }

            case 'campaign_clusters': {
                const advertId = Number(params.campaignId || 0);
                const dateFrom = String(params.dateFrom || '');
                const dateTo = String(params.dateTo || '');
                if (!advertId || !dateFrom || !dateTo) {
                    return json({ error: 'campaignId, dateFrom, dateTo required' }, 400);
                }
                const cacheKey = `clusters:${cabinet_id}:${advertId}:${dateFrom}:${dateTo}`;
                const cached = await getCached(admin, cacheKey);
                if (cached) return json({ ...cached, cached: true });

                const result = await fetchClusters(WB_TOKEN, advertId, dateFrom, dateTo);
                await setCached(admin, cacheKey, cabinet_id, result);

                // Пишем историю в фоне (best-effort) — не блокируем ответ пользователю.
                if (!result.noData && result.clusters?.length) {
                    saveClusterHistory(admin, cabinet_id, advertId, dateTo, result.clusters).catch((e) =>
                        console.warn('[wb-clusters] history save failed:', String(e)));
                }
                return json({ ...result, cached: false });
            }

            case 'campaign_clusters_daily': {
                const advertId = Number(params.campaignId || 0);
                const dateFrom = String(params.dateFrom || '');
                const dateTo = String(params.dateTo || '');
                const phrase = params.phrase ? String(params.phrase) : null;
                if (!advertId || !dateFrom || !dateTo) {
                    return json({ error: 'campaignId, dateFrom, dateTo required' }, 400);
                }
                const cacheKey = `daily:${cabinet_id}:${advertId}:${dateFrom}:${dateTo}:${phrase || ''}`;
                const cached = await getCached(admin, cacheKey);
                if (cached) return json({ ...cached, cached: true });

                const result = await fetchClustersDaily(WB_TOKEN, advertId, dateFrom, dateTo, phrase);
                await setCached(admin, cacheKey, cabinet_id, result);
                return json({ ...result, cached: false });
            }

            default:
                return json({ error: `Unknown action: ${action}` }, 400);
        }
    } catch (err) {
        console.error('[wb-clusters] error:', err);
        const status = (err as { status?: number })?.status;
        const httpStatus = status && status >= 400 && status < 500 ? status : 500;
        return json({ error: String(err) }, httpStatus);
    }
});

// ── WB API calls ────────────────────────────────────────────────────────────

async function fetchCampaigns(token: string): Promise<{ campaigns: Record<string, unknown>[] }> {
    const statusMap: Record<number, string> = {
        4: 'Готова', 7: 'Завершена', 8: 'Отклонена', 9: 'Работает', 11: 'Остановлен',
    };
    const paymentTypeMap: Record<string, string> = { cpm: 'CPM', cpc: 'CPC' };

    const campaigns: Record<string, unknown>[] = [];
    try {
        const res = await fetch('https://advert-api.wildberries.ru/api/advert/v2/adverts?statuses=4%2C9%2C11', {
            headers: { Authorization: token },
        });
        const text = await res.text();
        if (res.ok) {
            const data = JSON.parse(text);
            const adverts: Record<string, unknown>[] = data?.adverts || (Array.isArray(data) ? data : []);
            for (const a of adverts) {
                const id = Number(a.advertId ?? a.id ?? a.advert_id ?? 0);
                if (!id) continue;
                const status = Number(a.status ?? 0);
                const name = String(a.name ?? a.campaignName ?? '').trim() || `Кампания ${id}`;
                const paymentTypeRaw = a.payment_type != null ? String(a.payment_type).toLowerCase() : '';
                campaigns.push({
                    id, name, status,
                    statusLabel: statusMap[status] || 'Остановлен',
                    type: a.type != null ? Number(a.type) : null,
                    paymentType: paymentTypeMap[paymentTypeRaw] || (a.payment_type != null ? String(a.payment_type) : null),
                    bidType: a.bid_type != null ? String(a.bid_type) : null,
                });
            }
        } else {
            console.warn('[wb-clusters] campaigns fetch status:', res.status, text.slice(0, 300));
        }
    } catch (e) {
        console.warn('[wb-clusters] campaigns fetch error:', String(e));
    }
    return { campaigns };
}

async function fetchCampaignStats(token: string, ids: number[], dateFrom: string, dateTo: string): Promise<unknown[]> {
    if (!ids.length) return [];
    const out: unknown[] = [];
    for (let i = 0; i < ids.length; i += 50) {
        const chunk = ids.slice(i, i + 50);
        try {
            const url = `https://advert-api.wildberries.ru/adv/v3/fullstats?ids=${chunk.join(',')}&beginDate=${dateFrom}&endDate=${dateTo}`;
            const data = await wbGet(url, token);
            if (Array.isArray(data)) out.push(...data);
        } catch (e) {
            console.warn('[wb-clusters] campaign_stats chunk error:', String(e));
        }
    }
    return out;
}

type ClusterRow = {
    phrase: string;
    active: boolean;
    impressions: number;
    clicks: number;
    ctr: number;
    spend: number;
    orders: number;
    cpo: number | null;
};

// Сначала adv/v0/normquery/list — список кластеров (активные/неактивные),
// затем adv/v0/normquery/stats — цифры по каждому. WB не строго документирует
// формат ответов этих ручек, поэтому парсинг максимально терпимый к разным
// вариантам полей; если распарсить не получилось — отдаём noData: true.
async function fetchClusters(
    token: string, advertId: number, dateFrom: string, dateTo: string
): Promise<{ clusters: ClusterRow[]; noData: boolean }> {
    let listData: unknown = null;
    try {
        listData = await wbPost('https://advert-api.wildberries.ru/adv/v0/normquery/list', token, { advertId });
    } catch (e) {
        console.warn('[wb-clusters] normquery/list error:', String(e));
    }

    let statsData: unknown = null;
    try {
        statsData = await wbPost('https://advert-api.wildberries.ru/adv/v0/normquery/stats', token, {
            from: dateFrom, to: dateTo, items: [{ id: advertId }],
        });
    } catch (e) {
        console.warn('[wb-clusters] normquery/stats error:', String(e));
    }

    const activeSet = new Set<string>();
    const inactiveSet = new Set<string>();
    collectPhraseList(listData, activeSet, inactiveSet);

    const byPhrase = new Map<string, ClusterRow>();
    collectPhraseStats(statsData, byPhrase, activeSet, inactiveSet);

    if (byPhrase.size === 0) {
        return { clusters: [], noData: true };
    }

    const clusters = Array.from(byPhrase.values())
        .map((c) => ({ ...c, cpo: c.orders > 0 ? Math.round((c.spend / c.orders) * 100) / 100 : null }))
        .sort((a, b) => b.spend - a.spend);

    return { clusters, noData: false };
}

async function fetchClustersDaily(
    token: string, advertId: number, dateFrom: string, dateTo: string, phrase: string | null
): Promise<{ series: { date: string; impressions: number; clicks: number; spend: number; orders: number }[]; noData: boolean }> {
    let data: unknown = null;
    try {
        data = await wbPost('https://advert-api.wildberries.ru/adv/v1/normquery/stats', token, {
            from: dateFrom, to: dateTo, items: [{ id: advertId }],
        });
    } catch (e) {
        console.warn('[wb-clusters] normquery/stats(v1) error:', String(e));
    }

    const byDate = new Map<string, { date: string; impressions: number; clicks: number; spend: number; orders: number }>();
    collectDailyStats(data, phrase, byDate);

    if (byDate.size === 0) return { series: [], noData: true };
    const series = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
    return { series, noData: false };
}

// ── Терпимый разбор ответов WB (формат нормквери не строго документирован) ──

function collectPhraseList(data: unknown, activeSet: Set<string>, inactiveSet: Set<string>) {
    const arr = extractArray(data);
    for (const item of arr) {
        const o = item as Record<string, unknown>;
        const phrase = String(o.normquery ?? o.phrase ?? o.text ?? o.query ?? '').trim();
        if (!phrase) continue;
        const isActive = o.active === true || o.status === 'active' || Number(o.active) === 1;
        (isActive ? activeSet : inactiveSet).add(phrase);
    }
}

function collectPhraseStats(
    data: unknown, byPhrase: Map<string, ClusterRow>, activeSet: Set<string>, inactiveSet: Set<string>
) {
    const arr = extractArray(data);
    for (const item of arr) {
        const o = item as Record<string, unknown>;
        const phrase = String(o.normquery ?? o.phrase ?? o.text ?? o.query ?? o.keyword ?? '').trim();
        if (!phrase) continue;
        const impressions = Number(o.views ?? o.impressions ?? o.shows ?? 0);
        const clicks = Number(o.clicks ?? 0);
        const spend = Number(o.sum ?? o.spend ?? o.cost ?? 0);
        const orders = Number(o.orders ?? o.ordersCount ?? o.orders_count ?? 0);
        const ctr = impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : Number(o.ctr ?? 0);
        const active = activeSet.has(phrase) ? true : inactiveSet.has(phrase) ? false : true;
        byPhrase.set(phrase, { phrase, active, impressions, clicks, ctr, spend, orders, cpo: null });
    }
}

function collectDailyStats(
    data: unknown, phraseFilter: string | null,
    byDate: Map<string, { date: string; impressions: number; clicks: number; spend: number; orders: number }>
) {
    const arr = extractArray(data);
    for (const item of arr) {
        const o = item as Record<string, unknown>;
        const phrase = String(o.normquery ?? o.phrase ?? o.text ?? o.query ?? '').trim();
        if (phraseFilter && phrase && phrase !== phraseFilter) continue;
        const date = String(o.date ?? o.day ?? o.dt ?? '').split('T')[0];
        if (!date) continue;
        if (!byDate.has(date)) byDate.set(date, { date, impressions: 0, clicks: 0, spend: 0, orders: 0 });
        const d = byDate.get(date)!;
        d.impressions += Number(o.views ?? o.impressions ?? o.shows ?? 0);
        d.clicks += Number(o.clicks ?? 0);
        d.spend += Number(o.sum ?? o.spend ?? o.cost ?? 0);
        d.orders += Number(o.orders ?? o.ordersCount ?? o.orders_count ?? 0);
    }
}

// WB иногда возвращает { items: [...] } / { normqueries: [...] } / чистый массив.
function extractArray(data: unknown): unknown[] {
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') {
        const o = data as Record<string, unknown>;
        for (const key of ['items', 'normqueries', 'clusters', 'data', 'list']) {
            if (Array.isArray(o[key])) return o[key] as unknown[];
        }
    }
    return [];
}

async function saveClusterHistory(
    // deno-lint-ignore no-explicit-any
    admin: any, cabinetId: string, campaignId: number, date: string, clusters: ClusterRow[]
) {
    const rows = clusters.map((c) => ({
        cabinet_id: cabinetId,
        campaign_id: campaignId,
        cluster_phrase: c.phrase,
        date,
        impressions: c.impressions,
        clicks: c.clicks,
        ctr: c.ctr,
        spend: c.spend,
        orders: c.orders,
    }));
    if (!rows.length) return;
    await admin.from('wb_cluster_stats_history').upsert(rows, {
        onConflict: 'cabinet_id,campaign_id,cluster_phrase,date',
    });
}

// ── Кэш на 3 минуты ──────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function getCached(admin: any, cacheKey: string): Promise<Record<string, unknown> | null> {
    const { data } = await admin
        .from('wb_cluster_cache')
        .select('payload, fetched_at')
        .eq('cache_key', cacheKey)
        .maybeSingle();
    if (!data) return null;
    const age = Date.now() - new Date(data.fetched_at).getTime();
    if (age > CACHE_TTL_MS) return null;
    return data.payload as Record<string, unknown>;
}

// deno-lint-ignore no-explicit-any
async function setCached(admin: any, cacheKey: string, cabinetId: string, payload: unknown) {
    await admin.from('wb_cluster_cache').upsert({
        cache_key: cacheKey,
        cabinet_id: cabinetId,
        payload,
        fetched_at: new Date().toISOString(),
    }, { onConflict: 'cache_key' });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    });
}

function sanitizeWbToken(raw: unknown): string {
    if (typeof raw !== 'string') return '';
    return raw.replace(/^\uFEFF/, '').replace(/\s+/g, '').trim();
}

async function parseWbJson(res: Response): Promise<unknown> {
    const text = await res.text();
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        const err = new Error(`WB API ${res.status}: invalid JSON body: ${text.slice(0, 200)}`) as Error & { status?: number };
        err.status = res.status;
        throw err;
    }
}

async function wbGet(url: string, token: string): Promise<unknown> {
    const res = await fetch(url, { headers: { Authorization: token } });
    if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        const err = new Error(`WB API ${res.status}: ${text}`) as Error & { status?: number };
        err.status = res.status;
        throw err;
    }
    return parseWbJson(res);
}

async function wbPost(url: string, token: string, body: unknown): Promise<unknown> {
    const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        const err = new Error(`WB API ${res.status}: ${text}`) as Error & { status?: number };
        err.status = res.status;
        throw err;
    }
    return parseWbJson(res);
}

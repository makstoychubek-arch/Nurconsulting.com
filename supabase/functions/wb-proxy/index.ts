// Supabase Edge Function: wb-proxy
// Securely proxies all Wildberries API requests.
// Requires a valid user JWT in Authorization header.
// Verifies cabinet ownership before any WB API call.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    try {
        // ── Auth: verify JWT ──────────────────────────────────────────────────
        const authHeader = req.headers.get('Authorization') ?? '';
        if (!authHeader.startsWith('Bearer ')) {
            return json({ error: 'Unauthorized' }, 401);
        }
        const token = authHeader.replace('Bearer ', '');

        const supabaseUrl    = Deno.env.get('SUPABASE_URL')!;
        const supabaseAnon   = Deno.env.get('SUPABASE_ANON_KEY')!;
        const supabaseService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        // Verify the user's session token
        const userClient = createClient(supabaseUrl, supabaseAnon, {
            global: { headers: { Authorization: `Bearer ${token}` } }
        });
        const { data: { user }, error: authErr } = await userClient.auth.getUser();
        if (authErr || !user) return json({ error: 'Invalid session' }, 401);

        // ── Parse body ────────────────────────────────────────────────────────
        const body = await req.json().catch(() => ({}));
        const { action, params = {}, cabinet_id } = body;

        if (!cabinet_id) return json({ error: 'cabinet_id required' }, 400);

        // ── Verify cabinet ownership ──────────────────────────────────────────
        const admin = createClient(supabaseUrl, supabaseService);
        const { data: cab, error: cabErr } = await admin
            .from('cabinets')
            .select('wb_token, name')
            .eq('id', cabinet_id)
            .eq('user_id', user.id)
            .maybeSingle();

        if (cabErr || !cab) return json({ error: 'Cabinet not found or access denied' }, 403);

        const WB_TOKEN = cab.wb_token;
        if (!WB_TOKEN) return json({ error: 'WB token not configured for this cabinet' }, 400);

        // ── Route to WB API ───────────────────────────────────────────────────
        let result: unknown;

        switch (action) {

            // ── Statistics API ──────────────────────────────────────────────
            case 'orders': {
                const url = `https://statistics-api.wildberries.ru/api/v1/supplier/orders?dateFrom=${params.dateFrom || '2020-01-01'}&flag=0`;
                result = await wbGet(url, WB_TOKEN);
                break;
            }
            case 'stocks': {
                const url = `https://statistics-api.wildberries.ru/api/v1/supplier/stocks?dateFrom=${params.dateFrom || '2020-01-01'}`;
                result = await wbGet(url, WB_TOKEN);
                break;
            }
            case 'finance_report': {
                const rows: unknown[] = [];
                let rrdid = 0;
                const limit = 100000;
                // Paginate through the full report
                for (let attempt = 0; attempt < 50; attempt++) {
                    const url = `https://statistics-api.wildberries.ru/api/v5/supplier/reportDetailByPeriod?dateFrom=${params.dateFrom}&dateTo=${params.dateTo}&rrdid=${rrdid}&limit=${limit}`;
                    const page = await wbGet(url, WB_TOKEN) as unknown[];
                    if (!Array.isArray(page) || !page.length) break;
                    rows.push(...page);
                    if (page.length < limit) break;
                    const last = page[page.length - 1] as Record<string, unknown>;
                    rrdid = Number(last.rrd_id || 0);
                }
                result = rows;
                break;
            }
            case 'sales': {
                const url = `https://statistics-api.wildberries.ru/api/v1/supplier/sales?dateFrom=${params.dateFrom || '2020-01-01'}&flag=0`;
                result = await wbGet(url, WB_TOKEN);
                break;
            }

            // ── Marketplace API (Supplies) ──────────────────────────────────
            case 'supplies': {
                const limit  = params.limit  || 50;
                const next   = params.next   || 0;
                const url = `https://marketplace-api.wildberries.ru/api/v3/supplies?limit=${limit}&next=${next}`;
                result = await wbGet(url, WB_TOKEN);
                break;
            }
            case 'supply_orders': {
                const url = `https://marketplace-api.wildberries.ru/api/v3/supplies/${params.supplyId}/orders`;
                result = await wbGet(url, WB_TOKEN);
                break;
            }
            case 'supply_barcode': {
                const url = `https://marketplace-api.wildberries.ru/api/v3/supplies/${params.supplyId}/barcode?type=png`;
                const res = await fetch(url, { headers: { Authorization: WB_TOKEN } });
                result = await res.json();
                break;
            }
            case 'stickers': {
                const url = 'https://marketplace-api.wildberries.ru/api/v3/orders/stickers?type=png&width=58&height=40';
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { Authorization: WB_TOKEN, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orders: params.orderIds })
                });
                result = await res.json();
                break;
            }

            // ── Content API ─────────────────────────────────────────────────
            case 'content_cards': {
                const body = {
                    settings: {
                        sort: { ascending: false },
                        filter: {
                            textSearch: '',
                            withPhoto: -1,
                            ...(params.nmIds?.length ? { nmID: params.nmIds } : {})
                        },
                        cursor: { limit: params.limit || 100 }
                    }
                };
                result = await wbPost(
                    'https://content-api.wildberries.ru/content/v2/get/cards/list',
                    WB_TOKEN, body
                );
                break;
            }

            // ── Promotion (Advertising) API v2/v3 ──────────────────────────
            case 'advert_list': {
                // NEW v2 API (old /adv/v1/promotion/adverts deprecated Feb 2026)
                const url = 'https://advert-api.wildberries.ru/api/advert/v2/adverts?statuses=9,11';
                result = await wbGet(url, WB_TOKEN);
                break;
            }
            case 'advert_stats': {
                // NEW v3 fullstats (old /adv/v1/stat/interval deprecated Feb 2026)
                // params: { advertIds: number[], dateFrom: string, dateTo: string }
                const ids: number[] = params.advertIds || [];
                if (!ids.length) { result = []; break; }

                // Max 50 campaigns per request, max 31 day period
                const allStats: unknown[] = [];
                for (let i = 0; i < ids.length; i += 50) {
                    const chunk = ids.slice(i, i + 50).join(',');
                    const url = `https://advert-api.wildberries.ru/adv/v3/fullstats?ids=${chunk}&beginDate=${params.dateFrom}&endDate=${params.dateTo}`;
                    const data = await wbGet(url, WB_TOKEN);
                    if (Array.isArray(data)) allStats.push(...data);
                }
                result = allStats;
                break;
            }

            // ── Media (AB tests) ────────────────────────────────────────────
            case 'media_save': {
                const url = `https://content-api.wildberries.ru/api/v1/media/save`;
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { Authorization: WB_TOKEN, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nmId: params.nmId, photoUrl: params.photoUrl })
                });
                result = await res.json().catch(() => ({ ok: res.ok }));
                break;
            }

            default:
                return json({ error: `Unknown action: ${action}` }, 400);
        }

        return json(result);

    } catch (err) {
        console.error('[wb-proxy] error:', err);
        return json({ error: String(err) }, 500);
    }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' }
    });
}

async function wbGet(url: string, token: string): Promise<unknown> {
    const res = await fetch(url, { headers: { Authorization: token } });
    if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`WB API ${res.status}: ${text}`);
    }
    return res.json();
}

async function wbPost(url: string, token: string, body: unknown): Promise<unknown> {
    const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`WB API ${res.status}: ${text}`);
    }
    return res.json();
}

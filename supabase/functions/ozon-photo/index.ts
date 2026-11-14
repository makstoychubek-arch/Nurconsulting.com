// ozon-photo: фото карточек Ozon для А/Б-тестов. Вызывает сайт от имени пользователя.
//   card     { cabinet_id, base }                       — товары артикула без размера и их фото (чтение)
//   set_main { cabinet_id, photo_url, products:[{product_id, rest}] } — поставить фото главным (запись, только владелец и команда)
// Ключи Ozon берутся из кабинета на сервере и в браузер не попадают.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { OzonError, type FetchFn, type OzonCreds } from '../_shared/ozon-api.ts';
import { getOzonCards, setOzonMainPhoto } from '../_shared/ozon-photo.ts';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
const fetchFn: FetchFn = (url, init) => fetch(url, init);

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const auth = req.headers.get('Authorization') ?? '';
    if (!auth) return json({ error: 'Unauthorized' }, 401);
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Invalid session' }, 401);

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const action = String(body.action || '');
    const cabinetId = String(body.cabinet_id || '');
    if (!/^[0-9a-fA-F-]{36}$/.test(cabinetId)) return json({ error: 'cabinet_id required' }, 400);

    const admin = createClient(url, service);
    const { data: cab } = await admin.from('cabinets').select('user_id, ozon_client_id, ozon_api_key').eq('id', cabinetId).maybeSingle();
    // Запись: только владелец кабинета и команда. Чтение: доступ проверяет сама функция ozon_offers_of_base (для чужого кабинета пусто).
    if (action === 'set_main') {
        const { data: staff } = await admin.from('team_staff').select('email').eq('email', String(user.email || '').toLowerCase()).maybeSingle();
        if (cab?.user_id !== user.id && !staff) return json({ error: 'Нет доступа к кабинету' }, 403);
    }
    if (!cab?.ozon_client_id || !cab?.ozon_api_key) return json({ error: 'В кабинете не подключён Ozon' }, 400);
    const creds: OzonCreds = { clientId: String(cab.ozon_client_id), apiKey: String(cab.ozon_api_key) };

    try {
        if (action === 'card') {
            const base = String(body.base || '');
            const { data: offers } = await userClient.rpc('ozon_offers_of_base', { p_cabinet: cabinetId, p_base: base });
            const list = Array.isArray(offers) ? offers as { product_id: number; offer_id: string; name: string }[] : [];
            if (!list.length) return json({ error: 'Товары Ozon этого артикула не найдены' }, 404);
            const cards = await getOzonCards(creds, list.map((o) => Number(o.product_id)), fetchFn);
            const first = cards.find((c) => c.primary) || null;
            return json({ name: list[0].name, base, offers: cards, primary: first?.primary ?? null, rest: first?.rest ?? [] });
        }
        if (action === 'set_main') {
            const photo = String(body.photo_url || '');
            const products = Array.isArray(body.products) ? body.products as { product_id: number; rest?: string[] }[] : [];
            if (!photo || !products.length) return json({ error: 'photo_url и products обязательны' }, 400);
            const results: { product_id: number; ok: boolean; error?: string }[] = [];
            for (const p of products.slice(0, 40)) {
                const r = await setOzonMainPhoto(creds, Number(p.product_id), photo, Array.isArray(p.rest) ? p.rest : [], fetchFn);
                results.push({ product_id: Number(p.product_id), ...r });
            }
            const okN = results.filter((r) => r.ok).length;
            return json({ ok: okN === results.length, applied: okN, total: results.length, results });
        }
        return json({ error: 'unknown action' }, 400);
    } catch (e) {
        const status = e instanceof OzonError ? e.status : 500;
        return json({ error: String((e as Error)?.message || e).slice(0, 300) }, status >= 400 && status < 600 ? status : 500);
    }
});

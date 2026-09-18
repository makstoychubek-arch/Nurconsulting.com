// content-carousel — сборка PNG 1080×1350 из фото артикула (WB CDN / доп. загрузки).
// Не дублирует карточки: фото берёт из переданных URL (клиент тянет content_cards).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { hasAllCabinetsAccess } from '../_shared/cabinet-access.ts';
import {
    applyOverlays,
    parseGptOverlayJson,
    planCarouselSlides,
    type CarouselInput,
    type SlideKind,
    type SlideOverlay,
    type SlidePlan,
} from '../_shared/content-carousel.ts';
import { renderCarouselPngs } from '../_shared/content-carousel-render.ts';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    });
}

const GPT_TIMEOUT_MS = 8000;

async function maybeGptOverlays(input: CarouselInput, plans: SlidePlan[]): Promise<SlidePlan[]> {
    const key = Deno.env.get('OPENAI_API_KEY') || '';
    const description = String(input.description || '').trim();
    if (!key || !description) return plans;
    const kinds = plans.map((p) => p.kind) as SlideKind[];
    const fallback: SlideOverlay[] = plans.map((p) => ({ headline: p.headline || '', line: p.line || '' }));
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), GPT_TIMEOUT_MS);
    try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + key,
                'Content-Type': 'application/json',
            },
            signal: ctrl.signal,
            body: JSON.stringify({
                model: Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini',
                temperature: 0.2,
                response_format: { type: 'json_object' },
                messages: [
                    {
                        role: 'system',
                        content: 'Ты верстальщик Instagram-карусели 1080×1350. По SEO WB разложи короткие подписи без повторов одного корня (не «костюм костюм»). Верни JSON {"overlays":[{"kind":"cover","headline":"...","line":"..."}]}. headline до 32 знаков, line до 52. Короткие слова. Только факты из текста. collage, info, brand — пустые headline и line. Без эмодзи и хештегов.',
                    },
                    {
                        role: 'user',
                        content: JSON.stringify({
                            kinds,
                            title: input.title || '',
                            description: description.slice(0, 2500),
                            composition: input.composition || '',
                            brand: input.brand || '',
                        }),
                    },
                ],
            }),
        });
        if (!res.ok) return plans;
        const js = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
        const text = js.choices?.[0]?.message?.content || '';
        if (!text) return plans;
        return applyOverlays(plans, parseGptOverlayJson(text, kinds, fallback));
    } catch {
        return plans;
    } finally {
        clearTimeout(timer);
    }
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    if (!supabaseUrl || !serviceKey) return json({ error: 'missing_env' }, 500);

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    const bearer = authHeader.replace(/^Bearer\s+/i, '').trim();

    const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${bearer}` } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ error: 'Invalid session' }, 401);

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const cabinetId = String(body.cabinet_id || '');
    if (!cabinetId) return json({ error: 'cabinet_id required' }, 400);

    const admin = createClient(supabaseUrl, serviceKey);
    const all = await hasAllCabinetsAccess(admin, user);
    if (!all) {
        const { data: owned } = await admin.from('cabinets').select('id').eq('id', cabinetId).eq('user_id', user.id).maybeSingle();
        if (!owned) return json({ error: 'no cabinet access' }, 403);
    }

    const nmId = Number(body.nm_id);
    if (!nmId) return json({ error: 'нужен точный числовой nm_id, без поиска по названию' }, 400);

    const input: CarouselInput = {
        photos: Array.isArray(body.photos) ? body.photos.map(String) : [],
        extraPhotos: Array.isArray(body.extra_photos) ? body.extra_photos.map(String) : [],
        title: String(body.title || ''),
        nmId,
        composition: String(body.composition || ''),
        brand: String(body.brand || ''),
        price: body.price as number,
        vendorCode: String(body.vendor_code || ''),
        description: String(body.description || '').slice(0, 4000),
    };
    let plans = planCarouselSlides(input);
    if (body.skip_gpt !== true) {
        plans = await maybeGptOverlays(input, plans);
    }
    if (body.plan_only === true) {
        return json({ ok: true, plans });
    }

    try {
        const pngs = await renderCarouselPngs(plans);
        const stamp = Date.now();
        const urls: string[] = [];
        for (let i = 0; i < pngs.length; i++) {
            const path = `${cabinetId}/slides/${stamp}-${i}-${plans[i].kind}.png`;
            const { error: upErr } = await admin.storage.from('content-factory').upload(path, pngs[i], {
                contentType: 'image/png',
                upsert: true,
            });
            if (upErr) throw new Error(upErr.message);
            const { data } = admin.storage.from('content-factory').getPublicUrl(path);
            urls.push(data.publicUrl);
        }
        return json({ ok: true, plans, urls });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[content-carousel]', msg);
        return json({ ok: false, error: msg, plans }, 500);
    }
});

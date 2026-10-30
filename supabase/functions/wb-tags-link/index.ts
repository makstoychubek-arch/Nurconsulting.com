// wb_tags_link — ярлыки (теги) карточек в кабинете WB: создать ярлык и привязать к артикулам.
// Только service role. Тело: { cabinet_id, nm_ids: number[], tag: 'РИЧ', color?: 'D1CFD7', apply?: false }.
// Без apply:true ничего не пишет в WB: показывает, какие ярлыки уже есть и что будет сделано.
// Content API: GET /content/v2/tags, POST /content/v2/tag, POST /content/v2/tag/nomenclature/link
// (link задаёт ПОЛНЫЙ набор ярлыков карточки, поэтому существующие ярлыки сохраняем и добавляем новый).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceAuthorized } from '../_shared/service-auth.ts';

const API = 'https://content-api.wildberries.ru';
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
    const cabinetId = String(body.cabinet_id || '');
    const nmIds = (Array.isArray(body.nm_ids) ? body.nm_ids : []).map(Number).filter((n: number) => n > 0).slice(0, 100);
    const tagName = String(body.tag || '').trim();
    const color = String(body.color || 'D1CFD7');
    const apply = body.apply === true;
    if (!cabinetId || !nmIds.length || !tagName || tagName.length > 15) return json({ error: 'bad_request', hint: 'cabinet_id, nm_ids[], tag (до 15 символов)' }, 400);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: cab, error } = await admin.from('cabinets').select('id, name, wb_token').eq('id', cabinetId).maybeSingle();
    if (error || !cab) return json({ error: 'cabinet_not_found' }, 404);
    const token = String(cab.wb_token || '').replace(/^﻿/, '').replace(/\s+/g, '').trim();
    if (token.length < 50) return json({ error: 'no_token' }, 400);
    const H = { Authorization: token, 'Content-Type': 'application/json' };

    // 1. Существующие ярлыки кабинета
    const tagsRes = await fetch(API + '/content/v2/tags', { headers: H });
    const tagsText = await tagsRes.text();
    if (!tagsRes.ok) return json({ error: 'wb_tags_' + tagsRes.status, body: tagsText.slice(0, 300), hint: tagsRes.status === 401 || tagsRes.status === 403 ? 'токену не хватает права «Контент»' : '' }, 502);
    const allTags = (JSON.parse(tagsText)?.data || []) as { id: number; name: string; color?: string }[];
    const existing = allTags.find((t) => String(t.name).toLowerCase() === tagName.toLowerCase()) || null;

    // 2. Ярлыки у выбранных карточек
    const cards: Record<number, number[]> = {};
    for (const nm of nmIds) {
        const r = await fetch(API + '/content/v2/get/cards/list', {
            method: 'POST', headers: H,
            body: JSON.stringify({ settings: { cursor: { limit: 10 }, filter: { textSearch: String(nm), withPhoto: -1 } } }),
        });
        const d = r.ok ? await r.json() : null;
        const card = (d?.cards || []).find((c: { nmID: number }) => Number(c.nmID) === nm);
        cards[nm] = card ? (card.tags || []).map((t: { id: number }) => Number(t.id)) : [];
        if (!card) cards[nm] = [-1];
    }
    const plan = nmIds.map((nm) => ({ nm_id: nm, found: cards[nm][0] !== -1, current_tag_ids: cards[nm][0] === -1 ? [] : cards[nm] }));
    if (!apply) return json({ ok: true, mode: 'plan', cabinet: cab.name, tag: tagName, tag_exists: !!existing, tag_id: existing?.id ?? null, existing_tags: allTags.map((t) => t.name), plan });

    // 3. Создать ярлык, если его нет
    let tagId = existing?.id ?? 0;
    if (!tagId) {
        const c = await fetch(API + '/content/v2/tag', { method: 'POST', headers: H, body: JSON.stringify({ name: tagName, color }) });
        const ct = await c.text();
        if (!c.ok) return json({ error: 'wb_create_' + c.status, body: ct.slice(0, 300) }, 502);
        tagId = Number(JSON.parse(ct)?.data) || 0;
        if (!tagId) {
            const again = await fetch(API + '/content/v2/tags', { headers: H });
            tagId = ((await again.json())?.data || []).find((t: { name: string }) => String(t.name).toLowerCase() === tagName.toLowerCase())?.id || 0;
        }
        if (!tagId) return json({ error: 'tag_id_unknown' }, 502);
    }

    // 4. Привязать: текущие ярлыки карточки + новый
    const results: { nm_id: number; ok: boolean; status?: number; body?: string }[] = [];
    for (const p of plan) {
        if (!p.found) { results.push({ nm_id: p.nm_id, ok: false, status: 404 }); continue; }
        const next = [...new Set([...p.current_tag_ids, tagId])];
        if (p.current_tag_ids.includes(tagId)) { results.push({ nm_id: p.nm_id, ok: true, status: 0, body: 'уже привязан' }); continue; }
        const r = await fetch(API + '/content/v2/tag/nomenclature/link', { method: 'POST', headers: H, body: JSON.stringify({ nmID: p.nm_id, tagsIDs: next }) });
        results.push({ nm_id: p.nm_id, ok: r.ok, status: r.status, body: r.ok ? undefined : (await r.text()).slice(0, 300) });
        await new Promise((res) => setTimeout(res, 1200));
    }
    return json({ ok: true, mode: 'apply', cabinet: cab.name, tag: tagName, tag_id: tagId, results });
});

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

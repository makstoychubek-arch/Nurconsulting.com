// Supabase Edge Function: cabinet-token
//
// Приём WB-токена от клиента. Браузер больше не пишет токен в таблицу напрямую и никогда
// не получает его обратно: ответ содержит только признак token_set.
//   { action: 'create', name, token? }       — новый кабинет текущего пользователя;
//   { action: 'set', cabinet_id, token }     — заменить токен у своего кабинета (владелец или команда NR).
// deno-lint-ignore-file no-explicit-any

import { adminClient, CORS, isStaffUser, json, userFromRequest } from '../_shared/akylai-server.ts';

function cleanToken(raw: unknown): string {
    if (typeof raw !== 'string') return '';
    return raw.replace(/^﻿/, '').replace(/\s+/g, '').trim();
}

function looksLikeJwt(t: string): boolean {
    return t.length >= 50 && t.length <= 4000 && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(t);
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
    try {
        const user = await userFromRequest(req);
        if (!user) return json({ error: 'UNAUTHORIZED' }, 401);
        const admin = adminClient();
        let body: any = {};
        try { body = await req.json(); } catch { return json({ error: 'BAD_JSON' }, 400); }

        if (body.action === 'create') {
            const name = String(body.name ?? '').trim().slice(0, 120);
            if (!name) return json({ error: 'NAME_REQUIRED' }, 400);
            const token = cleanToken(body.token);
            if (token && !looksLikeJwt(token)) return json({ error: 'BAD_TOKEN' }, 400);
            const { data, error } = await admin.from('cabinets')
                .insert({ name, user_id: user.id, wb_token: token || null })
                .select('id, name, user_id').single();
            if (error) return json({ error: 'DB_ERROR' }, 500);
            return json({ ok: true, cabinet: data, token_set: !!token });
        }

        if (body.action === 'set') {
            const cabinetId = String(body.cabinet_id ?? '');
            const token = cleanToken(body.token);
            if (!cabinetId) return json({ error: 'CABINET_REQUIRED' }, 400);
            if (!looksLikeJwt(token)) return json({ error: 'BAD_TOKEN' }, 400);
            const { data: cab } = await admin.from('cabinets').select('id, user_id').eq('id', cabinetId).maybeSingle();
            if (!cab) return json({ error: 'NOT_FOUND' }, 404);
            if (cab.user_id !== user.id && !(await isStaffUser(admin, user))) return json({ error: 'FORBIDDEN' }, 403);
            const { error } = await admin.from('cabinets').update({ wb_token: token }).eq('id', cabinetId);
            if (error) return json({ error: 'DB_ERROR' }, 500);
            return json({ ok: true, token_set: true });
        }

        return json({ error: 'UNKNOWN_ACTION' }, 400);
    } catch (_e) {
        return json({ error: 'INTERNAL' }, 500);
    }
});

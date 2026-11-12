// Supabase Edge Function: cabinet-token
//
// Приём WB-токена от клиента. Браузер больше не пишет токен в таблицу напрямую и никогда
// не получает его обратно: ответ содержит только признак token_set.
//   { action: 'create', name, token? }       — новый кабинет текущего пользователя;
//   { action: 'set', cabinet_id, token }     — заменить токен у своего кабинета (владелец или команда NR);
//   { action: 'ozon_set', cabinet_id, client_id, api_key } — ключ Ozon: проверяем в Ozon (/v1/roles), только потом сохраняем.
//     Бизнес-отказ (ключ не принят) отдаём с кодом 200 и ok:false, чтобы клиент показал причину.
// deno-lint-ignore-file no-explicit-any

import { adminClient, CORS, isStaffUser, json, userFromRequest } from '../_shared/akylai-server.ts';

function cleanToken(raw: unknown): string {
    if (typeof raw !== 'string') return '';
    return raw.replace(/^﻿/, '').replace(/\s+/g, '').trim();
}

function looksLikeJwt(t: string): boolean {
    return t.length >= 50 && t.length <= 4000 && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(t);
}

/** Проверка ключа Ozon живым запросом: список ролей ключа. Возвращает статус и роли. */
async function checkOzonKey(clientId: string, apiKey: string): Promise<{ status: number; roles: string[] }> {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 15000);
    try {
        const res = await fetch('https://api-seller.ozon.ru/v1/roles', {
            method: 'POST',
            headers: { 'Client-Id': clientId, 'Api-Key': apiKey, 'Content-Type': 'application/json' },
            body: '{}',
            signal: ctl.signal,
        });
        let roles: string[] = [];
        if (res.ok) {
            const j = await res.json().catch(() => ({}));
            roles = (Array.isArray(j?.roles) ? j.roles : []).map((r: any) => String(r?.name || '')).filter(Boolean);
        }
        return { status: res.status, roles };
    } catch (_e) {
        return { status: 0, roles: [] };
    } finally {
        clearTimeout(timer);
    }
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

        if (body.action === 'ozon_set') {
            const cabinetId = String(body.cabinet_id ?? '');
            const clientId = String(body.client_id ?? '').replace(/\s+/g, '');
            const apiKey = String(body.api_key ?? '').replace(/\s+/g, '');
            if (!cabinetId) return json({ error: 'CABINET_REQUIRED' }, 400);
            if (!/^\d{3,12}$/.test(clientId)) return json({ ok: false, reason: 'BAD_CLIENT_ID', message: 'Client-Id это число из кабинета Ozon (Настройки → Seller API).' });
            if (apiKey.length < 20 || apiKey.length > 100) return json({ ok: false, reason: 'BAD_API_KEY', message: 'Api-Key выглядит неверно: скопируйте его целиком.' });
            const { data: cab } = await admin.from('cabinets').select('id, user_id').eq('id', cabinetId).maybeSingle();
            if (!cab) return json({ error: 'NOT_FOUND' }, 404);
            if (cab.user_id !== user.id && !(await isStaffUser(admin, user))) return json({ error: 'FORBIDDEN' }, 403);
            const chk = await checkOzonKey(clientId, apiKey);
            if (chk.status === 401 || chk.status === 403) {
                return json({ ok: false, reason: 'OZON_REJECTED', message: 'Ozon не принял ключ: проверьте Client-Id и Api-Key и что ключ не истёк.' });
            }
            // Не удалось дозвониться до Ozon или он отдал 5xx/429: ключ не проверен, но сохранить не мешаем.
            const { error } = await admin.from('cabinets').update({ ozon_client_id: clientId, ozon_api_key: apiKey }).eq('id', cabinetId);
            if (error) return json({ error: 'DB_ERROR' }, 500);
            return json({ ok: true, token_set: true, checked: chk.status === 200, roles: chk.roles.length, admin: chk.roles.includes('Admin') });
        }

        return json({ error: 'UNKNOWN_ACTION' }, 400);
    } catch (_e) {
        return json({ error: 'INTERNAL' }, 500);
    }
});

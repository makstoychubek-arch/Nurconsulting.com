// Supabase Edge Function: akylai-connect
//
// Шаг 4 мастера Акылай. Клиент вставляет токен WB — сайт сам шлёт его сюда.
//  1. Разбор полей токена (тип, категория «Вопросы и отзывы», «только чтение», срок).
//  2. Реальный запрос к WB (feedbacks-api): токен живой и отзывы доступны.
//  3. Магазин не подключён у другого клиента (по sid продавца).
//  4. Только после этого: кабинет с названием из WB + зашифрованный токен.
// Клиенту уходит только код и фраза Акылай. Тексты WB и базы — в agent_logs.
// deno-lint-ignore-file no-explicit-any

import { akylaiErrorMessage, type AkylaiErrorCode } from '../_shared/akylai-core.ts';
import { parseAkylaiToken, tokenSellerId } from '../_shared/akylai-token.ts';
import {
    adminClient, agentLog, COMMON_API, CORS, env, FEEDBACKS_API, json, notifyNr,
    ownAkylaiCabinet, userFromRequest, wbFetch,
} from '../_shared/akylai-server.ts';
import { encryptSecret, importSecretKey } from '../_shared/secret-box.ts';

function fail(code: AkylaiErrorCode, status = 200) {
    return json({ ok: false, code, message: akylaiErrorMessage(code) }, status);
}

/** Кто уже владеет магазином с этим sid (кроме самого клиента). */
async function foreignOwnerOfSid(admin: any, sid: string, userId: string): Promise<boolean> {
    const { data: bySecret } = await admin
        .from('cabinet_secrets')
        .select('cabinet_id, cabinets!inner(user_id)')
        .eq('wb_sid', sid);
    if ((bySecret || []).some((r: any) => r.cabinets?.user_id && r.cabinets.user_id !== userId)) return true;

    const { data: byCol } = await admin.from('cabinets').select('id, user_id').eq('wb_sid', sid);
    if ((byCol || []).some((r: any) => r.user_id !== userId)) return true;

    // Старые кабинеты без wb_sid: считаем sid из их токена и заодно сохраняем.
    const { data: legacy } = await admin
        .from('cabinets')
        .select('id, user_id, wb_token')
        .is('wb_sid', null)
        .not('wb_token', 'is', null)
        .limit(1000);
    let foreign = false;
    for (const c of legacy || []) {
        const s = tokenSellerId(c.wb_token);
        if (!s) continue;
        await admin.from('cabinets').update({ wb_sid: s }).eq('id', c.id);
        if (s === sid && c.user_id !== userId) foreign = true;
    }
    return foreign;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return fail('SERVER_ERROR', 405);

    const admin = adminClient();
    let userId = '';
    try {
        const user = await userFromRequest(req);
        if (!user) return fail('UNAUTHORIZED', 401);
        userId = user.id;

        const body = await req.json().catch(() => ({}));
        const parsed = parseAkylaiToken(body?.token);
        if (!parsed.ok) {
            await agentLog(admin, null, 'token_rejected', { user_id: user.id, problem: parsed.problem });
            return fail(parsed.problem);
        }
        const { token, info } = parsed;

        // Реальная проверка у WB: токен принят и отзывы читаются.
        const ping = await wbFetch(`${FEEDBACKS_API}/ping`, token);
        const probe = ping.ok ? await wbFetch(`${FEEDBACKS_API}/api/v1/feedbacks/count-unanswered`, token) : ping;
        if (!probe.ok) {
            await agentLog(admin, null, 'token_check_failed', {
                user_id: user.id, sid: info.sid, status: probe.status, wb: probe.text,
            });
            return fail(probe.status === 401 ? 'EXPIRED' : 'CHECK_FAILED');
        }

        if (await foreignOwnerOfSid(admin, info.sid, user.id)) {
            await agentLog(admin, null, 'duplicate_shop', { user_id: user.id, email: user.email, sid: info.sid });
            await notifyNr(`⚠️ Акылай: ${user.email || user.id} пытается подключить магазин, который уже подключён (sid ${info.sid}).`);
            return fail('ALREADY_CONNECTED');
        }

        const seller = await wbFetch(`${COMMON_API}/api/v1/seller-info`, token);
        const wbName = String(seller.data?.name || seller.data?.tradeMark || '').trim().slice(0, 120);
        if (!seller.ok) await agentLog(admin, null, 'seller_info_failed', { user_id: user.id, status: seller.status });

        const key = await importSecretKey(env('AKYLAI_ENC_KEY'));
        const enc = await encryptSecret(token, key);
        const tokenExp = info.exp ? new Date(info.exp * 1000).toISOString() : null;
        const now = new Date().toISOString();

        let cabinetId = '';
        let cabinetName = '';
        const own = await ownAkylaiCabinet(admin, user.id);
        if (own) {
            if (own.wb_sid && own.wb_sid !== info.sid) return fail('OTHER_SHOP');
            cabinetId = own.id;
            cabinetName = own.name;
        } else {
            // Свой старый кабинет с тем же магазином — подключаем Акылай к нему.
            const { data: mine } = await admin.from('cabinets').select('id, name').eq('user_id', user.id).eq('wb_sid', info.sid).limit(1);
            if (mine?.length) {
                cabinetId = mine[0].id;
                cabinetName = mine[0].name;
            } else {
                cabinetName = wbName || 'Мой магазин';
                const { data: created, error } = await admin
                    .from('cabinets')
                    .insert({ name: cabinetName, user_id: user.id, wb_sid: info.sid })
                    .select('id')
                    .single();
                if (error || !created) {
                    await agentLog(admin, null, 'cabinet_insert_failed', { user_id: user.id, db: error?.message });
                    return fail('SERVER_ERROR');
                }
                cabinetId = created.id;
                const { error: accErr } = await admin
                    .from('user_cabinet_access')
                    .upsert({ user_id: user.id, cabinet_id: cabinetId, role: 'owner' }, { onConflict: 'user_id,cabinet_id' });
                if (accErr) await agentLog(admin, cabinetId, 'owner_access_failed', { db: accErr.message });
            }
        }

        const { error: secErr } = await admin.from('cabinet_secrets').upsert({
            cabinet_id: cabinetId,
            wb_token_enc: enc,
            wb_sid: info.sid,
            token_exp: tokenExp,
            token_broken: false,
            updated_at: now,
        }, { onConflict: 'cabinet_id' });
        if (secErr) {
            await agentLog(admin, cabinetId, 'secret_save_failed', { db: secErr.message });
            return fail('SERVER_ERROR');
        }
        await admin.from('cabinets').update({ wb_sid: info.sid }).eq('id', cabinetId);
        await admin.from('akylai_settings').upsert({ cabinet_id: cabinetId, updated_at: now }, { onConflict: 'cabinet_id' });

        await agentLog(admin, cabinetId, 'token_connected', { user_id: user.id, sid: info.sid, token_exp: tokenExp });
        return json({ ok: true, cabinet: { id: cabinetId, name: cabinetName } });
    } catch (e) {
        console.error('[akylai-connect]', e);
        await agentLog(admin, null, 'connect_crashed', { user_id: userId, error: String((e as Error)?.message || e).slice(0, 300) });
        return fail('SERVER_ERROR', 500);
    }
});

// Supabase Edge Function: akylai-reviews
//
// Акылай готовит ответы на неотвеченные отзывы WB.
// Вызывают только service_role: pg_cron каждые 30 минут и akylai-bot сразу
// после подключения Telegram ({ cabinet_id }). JWT проверяет шлюз Supabase.
//
// Режим по умолчанию — «сначала на проверку»: ответ приходит клиенту в Telegram
// с кнопками «Опубликовать» / «Изменить». С автопубликацией — сразу на WB.
// Лимит AKYLAI_DAILY_LIMIT ответов на кабинет в сутки. Расход токенов — ai_usage.
// deno-lint-ignore-file no-explicit-any

import {
    AKYLAI_BATCH, AKYLAI_DAILY_LIMIT, buildReplyMessages, finalizeReply, formatReplyCard,
    normalizeFeedback, replyKeyboard, stopRuleViolations,
} from '../_shared/akylai-core.ts';
import {
    addUsage, adminClient, agentLog, cabinetWbToken, CORS, env, FEEDBACKS_API, json, notifyNr,
    openaiChat, tg, tgBlocked, wbFetch,
} from '../_shared/akylai-server.ts';
import { filterFeatureActive, recordFeatureRun } from '../_shared/cabinet-features.ts';
import { isServiceAuthorized } from '../_shared/service-auth.ts';

function utcDayStart(): string {
    const d = new Date();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
}

async function loggedRecently(admin: any, cabinetId: string, event: string, hours: number): Promise<boolean> {
    const since = new Date(Date.now() - hours * 3600_000).toISOString();
    const { data } = await admin.from('agent_logs').select('id')
        .eq('cabinet_id', cabinetId).eq('event', event).gte('created_at', since).limit(1);
    return !!data?.length;
}

async function generateReply(admin: any, cabinetId: string, fb: any, cabinetName: string) {
    for (const strict of [false, true]) {
        const r = await openaiChat(buildReplyMessages(fb, cabinetName, strict));
        await addUsage(admin, cabinetId, r.promptTokens, r.completionTokens);
        if (!r.ok || !r.text) return { text: '', error: r.error || 'empty' };
        const text = finalizeReply(r.text, cabinetName);
        const bad = stopRuleViolations(r.text);
        if (!bad.length) return { text, error: '' };
        await agentLog(admin, cabinetId, 'stop_rule', { feedback_id: fb.id, rules: bad, strict });
    }
    return { text: '', error: 'stop_rules' };
}

async function processCabinet(admin: any, cab: any): Promise<Record<string, unknown>> {
    const cabinetId = cab.cabinet_id as string;
    const name = String(cab.cabinets?.name || '').trim();
    const chatId = cab.chat_id;
    const autoPublish = cab.auto_publish === true;

    const { data: secret } = await admin.from('cabinet_secrets')
        .select('token_broken, token_exp').eq('cabinet_id', cabinetId).maybeSingle();
    if (!secret || secret.token_broken) return { cabinetId, skipped: 'token_broken' };
    if (secret.token_exp && new Date(secret.token_exp).getTime() <= Date.now()) {
        await admin.from('cabinet_secrets').update({ token_broken: true, updated_at: new Date().toISOString() }).eq('cabinet_id', cabinetId);
        await notifyNr(`⚠️ Акылай: у кабинета «${name}» истёк срок токена WB.`);
        await tg('sendMessage', { chat_id: chatId, text: 'Срок действия токена Wildberries закончился. Зайдите на страницу «Агенты» на сайте NR Space и вставьте новый — я продолжу отвечать.' });
        await agentLog(admin, cabinetId, 'token_expired', { token_exp: secret.token_exp });
        return { cabinetId, skipped: 'token_expired' };
    }

    let token = '';
    try { token = await cabinetWbToken(admin, cabinetId); } catch (e) {
        await agentLog(admin, cabinetId, 'token_decrypt_failed', { error: String((e as Error)?.message || e) });
        return { cabinetId, skipped: 'token' };
    }
    if (!token) return { cabinetId, skipped: 'no_token' };

    const { count: today } = await admin.from('akylai_replies').select('id', { count: 'exact', head: true })
        .eq('cabinet_id', cabinetId).gte('created_at', utcDayStart());
    let room = AKYLAI_DAILY_LIMIT - (today || 0);
    if (room <= 0) {
        const day = utcDayStart().slice(0, 10);
        if (cab.limit_notified_on !== day) {
            await admin.from('akylai_settings').update({ limit_notified_on: day }).eq('cabinet_id', cabinetId);
            await notifyNr(`ℹ️ Акылай: кабинет «${name}» достиг лимита ${AKYLAI_DAILY_LIMIT} ответов за сутки.`);
            await agentLog(admin, cabinetId, 'daily_limit', { limit: AKYLAI_DAILY_LIMIT });
        }
        return { cabinetId, skipped: 'limit' };
    }

    const list = await wbFetch(
        `${FEEDBACKS_API}/api/v1/feedbacks?isAnswered=false&take=${AKYLAI_BATCH}&skip=0&order=dateDesc`, token,
    );
    if (list.status === 401) {
        const { data: sec } = await admin.from('cabinet_secrets').select('token_broken').eq('cabinet_id', cabinetId).maybeSingle();
        if (!sec?.token_broken) {
            await admin.from('cabinet_secrets').update({ token_broken: true, updated_at: new Date().toISOString() }).eq('cabinet_id', cabinetId);
            await notifyNr(`⚠️ Акылай: токен WB кабинета «${name}» перестал работать.`);
            await tg('sendMessage', { chat_id: chatId, text: 'Токен Wildberries перестал работать. Зайдите на страницу «Агенты» на сайте NR Space и вставьте новый — я продолжу отвечать.' });
        }
        await agentLog(admin, cabinetId, 'token_broken', { status: 401, wb: list.text });
        return { cabinetId, skipped: 'token_broken' };
    }
    if (!list.ok) {
        await agentLog(admin, cabinetId, 'sync_error', { status: list.status, wb: list.text });
        if (!(await loggedRecently(admin, cabinetId, 'sync_error_notified', 6))) {
            await agentLog(admin, cabinetId, 'sync_error_notified', {});
            await notifyNr(`⚠️ Акылай: не получилось загрузить отзывы кабинета «${name}» (WB ${list.status}).`);
        }
        return { cabinetId, skipped: 'sync_error' };
    }

    const feedbacks = (list.data?.data?.feedbacks || []).map(normalizeFeedback).filter(Boolean) as any[];
    if (!feedbacks.length) return { cabinetId, done: 0 };

    const { data: known } = await admin.from('akylai_replies').select('feedback_id')
        .eq('cabinet_id', cabinetId).in('feedback_id', feedbacks.map((f) => f.id));
    const seen = new Set((known || []).map((r: any) => r.feedback_id));

    let done = 0;
    for (const fb of feedbacks) {
        if (room <= 0) break;
        if (seen.has(fb.id)) continue;

        const gen = await generateReply(admin, cabinetId, fb, name);
        const base = {
            cabinet_id: cabinetId, feedback_id: fb.id, rating: fb.rating || null,
            product_name: fb.productName || null, feedback_text: [fb.text, fb.pros, fb.cons].filter(Boolean).join('\n') || null,
        };
        if (!gen.text) {
            await admin.from('akylai_replies').insert({ ...base, status: 'skipped' });
            await agentLog(admin, cabinetId, 'reply_skipped', { feedback_id: fb.id, reason: gen.error });
            room--;
            continue;
        }

        if (autoPublish) {
            const pub = await wbFetch(`${FEEDBACKS_API}/api/v1/feedbacks/answer`, token, 'POST', { id: fb.id, text: gen.text });
            if (!pub.ok) {
                await admin.from('akylai_replies').insert({ ...base, reply_text: gen.text, status: 'failed' });
                await agentLog(admin, cabinetId, 'publish_failed', { feedback_id: fb.id, status: pub.status, wb: pub.text });
                room--;
                continue;
            }
            await admin.from('akylai_replies').insert({ ...base, reply_text: gen.text, status: 'published', published_at: new Date().toISOString() });
            await admin.rpc('akylai_bump_published', { p_cabinet_id: cabinetId });
            await tg('sendMessage', { chat_id: chatId, text: formatReplyCard(fb, gen.text, 'auto'), parse_mode: 'HTML' });
        } else {
            const { data: row, error } = await admin.from('akylai_replies')
                .insert({ ...base, reply_text: gen.text, status: 'pending' }).select('id').single();
            if (error || !row) {
                await agentLog(admin, cabinetId, 'reply_insert_failed', { db: error?.message });
                continue;
            }
            const sent = await tg('sendMessage', {
                chat_id: chatId, text: formatReplyCard(fb, gen.text, 'review'), parse_mode: 'HTML',
                reply_markup: replyKeyboard(row.id),
            });
            if (!sent.ok) {
                if (tgBlocked(sent)) {
                    await admin.from('akylai_chats').update({ blocked: true, updated_at: new Date().toISOString() }).eq('cabinet_id', cabinetId);
                    await agentLog(admin, cabinetId, 'bot_blocked', {});
                    await admin.from('akylai_replies').delete().eq('id', row.id);
                    return { cabinetId, skipped: 'bot_blocked', done };
                }
                await agentLog(admin, cabinetId, 'tg_send_failed', { status: sent.status });
            } else {
                await admin.from('akylai_replies').update({ tg_message_id: sent.data?.result?.message_id ?? null }).eq('id', row.id);
            }
        }
        done++;
        room--;
    }
    return { cabinetId, done };
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (!isServiceAuthorized(req, env('SUPABASE_SERVICE_ROLE_KEY'))) return json({ ok: false }, 401);

    const admin = adminClient();
    const body = await req.json().catch(() => ({}));
    const only = typeof body?.cabinet_id === 'string' ? body.cabinet_id : '';

    let q = admin.from('akylai_settings')
        .select('cabinet_id, auto_publish, limit_notified_on, cabinets!inner(name)')
        .eq('enabled', true);
    if (only) q = q.eq('cabinet_id', only);
    const { data: rows, error } = await q;
    if (error) {
        await agentLog(admin, null, 'reviews_query_failed', { db: error.message });
        return json({ ok: false }, 500);
    }
    // Тумблер «Ответы на отзывы»: выключенные и поставленные на паузу кабинеты пропускаем.
    const enabledRows = await filterFeatureActive(admin, rows || [], 'reviews');
    const ids = enabledRows.map((r: any) => r.cabinet_id);
    const { data: chats } = ids.length
        ? await admin.from('akylai_chats').select('cabinet_id, chat_id').in('cabinet_id', ids).eq('blocked', false)
        : { data: [] };
    const chatOf = new Map((chats || []).map((c: any) => [c.cabinet_id, c.chat_id]));

    const results = [];
    for (const r of enabledRows) {
        const chatId = chatOf.get(r.cabinet_id);
        if (!chatId) {
            // Раньше такой кабинет пропускался молча. Теперь причина видна в настройках кабинета.
            await recordFeatureRun(admin, r.cabinet_id, 'reviews', 'skipped', 'Не подключён Telegram-чат Акылай');
            continue;
        }
        try {
            results.push(await processCabinet(admin, { ...r, chat_id: chatId }));
            await recordFeatureRun(admin, r.cabinet_id, 'reviews', 'ok');
        } catch (e) {
            await recordFeatureRun(admin, r.cabinet_id, 'reviews', 'error', String((e as Error)?.message || e));
            await agentLog(admin, r.cabinet_id, 'sync_error', { error: String((e as Error)?.message || e).slice(0, 300) });
            await notifyNr(`⚠️ Акылай: ошибка обработки отзывов кабинета «${r.cabinets?.name || r.cabinet_id}».`);
        }
    }
    return json({ ok: true, cabinets: results.length, results });
});

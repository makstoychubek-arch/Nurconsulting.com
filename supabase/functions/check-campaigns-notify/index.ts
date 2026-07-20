// Supabase Edge Function: check-campaigns-notify
// Фоновая проверка статусов РК и баланса рекламного кабинета + уведомления в
// Telegram-группу. Не трогает существующие таблицы/функции раздела "РК" —
// только читает уже синхронизированный статус кампаний и сам обновляет его
// лёгким запросом (без тяжёлого fullstats), плюс собственные новые таблицы
// campaign_states / cabinet_balance_states / notification_log.
//
// Auth: service_role key only (вызывается по pg_cron, см. миграцию cron).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADV_API = 'https://advert-api.wildberries.ru';
const DEDUP_WINDOW_MIN = 60; // не слать повтор того же события за последний час
const LOW_BALANCE_THRESHOLD = Number(Deno.env.get('AD_LOW_BALANCE_THRESHOLD')) || 1000;

// Статусы WB: -1 удалена, 4 готова к запуску, 7 завершена, 8 отклонена, 9 активна, 11 на паузе.
const STATUS_LABEL: Record<number, string> = {
    [-1]: 'удалена',
    4: 'готова к запуску',
    7: 'завершена',
    8: 'отклонена',
    9: 'активна',
    11: 'на паузе',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    const started = Date.now();
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const tgToken = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
    const tgChatId = Deno.env.get('TELEGRAM_GROUP_CHAT_ID') ?? '';

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ') || authHeader.replace('Bearer ', '') !== serviceKey) {
        return json({ error: 'Unauthorized' }, 401);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const results: Array<Record<string, unknown>> = [];

    try {
        const { data: cabinets, error: cabErr } = await admin
            .from('cabinets')
            .select('id, name, wb_token')
            .not('wb_token', 'is', null)
            .gt('wb_token', '');
        if (cabErr) throw new Error(`cabinets: ${cabErr.message}`);

        for (const cabinet of cabinets || []) {
            const cabResult: Record<string, unknown> = { cabinet: cabinet.name, events: [] as string[] };
            const events = cabResult.events as string[];
            try {
                const token = sanitizeWbToken(cabinet.wb_token);
                if (!token || !isValidWbToken(token)) {
                    cabResult.skipped = 'invalid_token';
                    results.push(cabResult);
                    continue;
                }

                // ── 1) Статусы кампаний (лёгкий запрос, без fullstats) ───────
                const { ids, statusById } = await fetchCampaignStatuses(token);
                await sleep(400);

                const { data: knownNames } = await admin
                    .from('advertising_campaigns')
                    .select('campaign_id, campaign_name')
                    .eq('cabinet_id', cabinet.id);
                const nameById = new Map<number, string>(
                    (knownNames || []).map((r) => [Number(r.campaign_id), String(r.campaign_name || '')]),
                );

                const { data: prevStates } = await admin
                    .from('campaign_states')
                    .select('campaign_id, last_status')
                    .eq('cabinet_id', cabinet.id);
                const prevStatusById = new Map<number, number | null>(
                    (prevStates || []).map((r) => [Number(r.campaign_id), r.last_status]),
                );

                for (const id of ids) {
                    const newStatus = statusById.get(id) ?? null;
                    const oldStatus = prevStatusById.has(id) ? prevStatusById.get(id)! : undefined;
                    const name = nameById.get(id) || `Кампания ${id}`;

                    if (oldStatus !== undefined && oldStatus !== null && newStatus !== null && oldStatus !== newStatus) {
                        let eventType: string | null = null;
                        let text: string | null = null;
                        if (oldStatus === 9 && (newStatus === 11 || newStatus === 7)) {
                            eventType = newStatus === 7 ? 'campaign_finished' : 'campaign_paused';
                            const icon = newStatus === 7 ? '⛔' : '⏸';
                            const verb = newStatus === 7 ? 'завершена' : 'поставлена на паузу';
                            text = `${icon} Кампания ${id} «${name}» (кабинет ${cabinet.name}) ${verb}`;
                        } else if (oldStatus === 11 && newStatus === 9) {
                            eventType = 'campaign_resumed';
                            text = `▶ Кампания ${id} «${name}» (кабинет ${cabinet.name}) снова активна`;
                        }
                        if (eventType && text) {
                            const sent = await notifyOnce(admin, tgToken, tgChatId, cabinet.id, id, eventType, text);
                            events.push(`${eventType}${sent ? '' : ' (dedup/skip)'}`);
                        }
                    }

                    await admin.from('campaign_states').upsert({
                        cabinet_id: cabinet.id,
                        campaign_id: id,
                        last_status: newStatus,
                        last_checked_at: new Date().toISOString(),
                    }, { onConflict: 'cabinet_id,campaign_id' });

                    // Держим статус в advertising_campaigns свежим тоже — это
                    // тот же столбец, который уже пишет advertising-sync, просто
                    // теперь он обновляется чаще (без дорогого fullstats-запроса).
                    await admin.from('advertising_campaigns').update({ status: newStatus }).eq('cabinet_id', cabinet.id).eq('campaign_id', id);
                }

                // ── 2) Баланс кабинета (общий пул на все кампании) ───────────
                const balance = await fetchBalance(token);
                if (balance != null) {
                    const { data: prevBalRow } = await admin
                        .from('cabinet_balance_states')
                        .select('last_balance')
                        .eq('cabinet_id', cabinet.id)
                        .maybeSingle();
                    const prevBalance = prevBalRow?.last_balance != null ? Number(prevBalRow.last_balance) : null;

                    const crossedDown = prevBalance == null
                        ? balance <= LOW_BALANCE_THRESHOLD
                        : prevBalance > LOW_BALANCE_THRESHOLD && balance <= LOW_BALANCE_THRESHOLD;

                    if (crossedDown) {
                        const text = balance <= 0
                            ? `⚠ Кабинет «${cabinet.name}»: баланс на рекламу закончился (0 ₽)`
                            : `⚠ Кабинет «${cabinet.name}»: бюджет заканчивается, остаток ${Math.round(balance)} ₽`;
                        const sent = await notifyOnce(admin, tgToken, tgChatId, cabinet.id, null, 'low_balance', text);
                        events.push(`low_balance${sent ? '' : ' (dedup/skip)'}`);
                    }

                    await admin.from('cabinet_balance_states').upsert({
                        cabinet_id: cabinet.id,
                        last_balance: balance,
                        last_checked_at: new Date().toISOString(),
                    }, { onConflict: 'cabinet_id' });
                }

                cabResult.campaigns_checked = ids.length;
                cabResult.balance = balance;
            } catch (e) {
                cabResult.error = String(e);
            }
            results.push(cabResult);
            await sleep(600);
        }

        return json({ ok: true, cabinets_checked: results.length, results, ms: Date.now() - started });
    } catch (err) {
        console.error('[check-campaigns-notify] fatal:', err);
        return json({ error: String(err) }, 500);
    }
});

// Проверяет notification_log за последний DEDUP_WINDOW_MIN минут для того же
// события/кампании/кабинета — и только если дубля нет, шлёт в Telegram и
// пишет лог. Возвращает true, если сообщение реально отправлено.
async function notifyOnce(
    admin: ReturnType<typeof createClient>,
    tgToken: string,
    tgChatId: string,
    cabinetId: string,
    campaignId: number | null,
    eventType: string,
    text: string,
): Promise<boolean> {
    const since = new Date(Date.now() - DEDUP_WINDOW_MIN * 60 * 1000).toISOString();
    let q = admin
        .from('notification_log')
        .select('id')
        .eq('cabinet_id', cabinetId)
        .eq('event_type', eventType)
        .gte('sent_at', since);
    q = campaignId == null ? q.is('campaign_id', null) : q.eq('campaign_id', campaignId);
    const { data: dupes } = await q.limit(1);
    if (dupes && dupes.length) return false;

    let sendOk = true;
    if (tgToken && tgChatId) {
        sendOk = await sendTelegramMessage(tgToken, tgChatId, text);
    } else {
        sendOk = false;
        console.warn('[check-campaigns-notify] TELEGRAM_BOT_TOKEN/TELEGRAM_GROUP_CHAT_ID не заданы — сообщение не отправлено:', text);
    }

    await admin.from('notification_log').insert({
        cabinet_id: cabinetId,
        campaign_id: campaignId,
        event_type: eventType,
        message_text: text,
    });
    return sendOk;
}

async function sendTelegramMessage(token: string, chatId: string, text: string): Promise<boolean> {
    try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text }),
        });
        if (!res.ok) {
            console.warn('[check-campaigns-notify] telegram sendMessage failed:', res.status, await res.text());
            return false;
        }
        return true;
    } catch (e) {
        console.warn('[check-campaigns-notify] telegram sendMessage error:', String(e));
        return false;
    }
}

// Лёгкий эквивалент advertising-sync's fetchCampaignIdsAndMeta — только id+status,
// без деталей/названий (имена берём из уже синхронизированной advertising_campaigns).
async function fetchCampaignStatuses(token: string): Promise<{ ids: number[]; statusById: Map<number, number | null> }> {
    const ids: number[] = [];
    const statusById = new Map<number, number | null>();
    try {
        const res = await fetch(`${ADV_API}/adv/v1/promotion/count`, { headers: { Authorization: token } });
        const text = await res.text();
        if (res.ok) {
            const data = JSON.parse(text);
            const groups = data?.adverts;
            if (Array.isArray(groups)) {
                for (const g of groups as Record<string, unknown>[]) {
                    const inner = g?.advert_list as Record<string, unknown>[] | undefined;
                    const groupStatus = g?.status != null ? Number(g.status) : null;
                    if (Array.isArray(inner)) {
                        for (const a of inner) {
                            if (!a?.advertId) continue;
                            const id = Number(a.advertId);
                            ids.push(id);
                            statusById.set(id, groupStatus);
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.warn('[check-campaigns-notify] promotion/count error:', String(e));
    }
    return { ids: [...new Set(ids)], statusById };
}

async function fetchBalance(token: string): Promise<number | null> {
    try {
        const res = await fetch(`${ADV_API}/adv/v1/balance`, { headers: { Authorization: token } });
        const text = await res.text();
        if (!res.ok) return null;
        const data = JSON.parse(text) as Record<string, unknown>;
        const balance = data?.balance ?? data?.total ?? data?.money ?? null;
        return balance != null ? Number(balance) : null;
    } catch (e) {
        console.warn('[check-campaigns-notify] balance error:', String(e));
        return null;
    }
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

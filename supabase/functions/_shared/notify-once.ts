// Общий механизм "отправить в Telegram не чаще раза в N минут на одно и то
// же событие" — вынесено из check-campaigns-notify/index.ts, чтобы
// autobidder-tick не заводил свою собственную дедупликацию поверх
// notification_log (см. docs/autobidder.md §11.7).

import type { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const DEFAULT_DEDUP_WINDOW_MIN = 60;

// Обычный fetch() в Deno не имеет таймаута — если WB/Telegram не ответят
// вовсе, промис висит до идл-таймаута самой Edge Function (~150 сек).
export async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 12000): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

export async function sendTelegramMessage(token: string, chatId: string, text: string): Promise<boolean> {
    try {
        const res = await fetchWithTimeout(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text }),
        });
        if (!res.ok) {
            console.warn('[notify-once] telegram sendMessage failed:', res.status, await res.text());
            return false;
        }
        return true;
    } catch (e) {
        console.warn('[notify-once] telegram sendMessage error:', String(e));
        return false;
    }
}

/**
 * Проверяет notification_log за последние dedupWindowMin минут для того же
 * события/кампании/кабинета — и только если дубля нет, шлёт в Telegram и
 * пишет лог. Возвращает true, если сообщение реально отправлено.
 */
export async function notifyOnce(
    admin: ReturnType<typeof createClient>,
    tgToken: string,
    tgChatId: string,
    cabinetId: string,
    campaignId: number | null,
    eventType: string,
    text: string,
    dedupWindowMin: number = DEFAULT_DEDUP_WINDOW_MIN,
): Promise<boolean> {
    const since = new Date(Date.now() - dedupWindowMin * 60 * 1000).toISOString();
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
        console.warn('[notify-once] TELEGRAM_BOT_TOKEN/TELEGRAM_GROUP_CHAT_ID не заданы — сообщение не отправлено:', text);
    }

    await admin.from('notification_log').insert({
        cabinet_id: cabinetId,
        campaign_id: campaignId,
        event_type: eventType,
        message_text: text,
    });
    return sendOk;
}

import { getAdminClient } from './alina-db.ts';
import { parseAlinaBusinessUpdate } from './alina-business-update.ts';
import { handleAlinaClientMessage, logAlinaRawEvent, type AlinaReply } from './alina-selfbuy.ts';
import { askAlinaManager, managerGroupId } from './alina-manager.ts';
import { HUMAN_HANDOFF, SAFE_REPLY, applyGreeting, dedupeReplies, dropRecentSimilar, isAngry, isGreetingOnly, promisesMore, recentWindowMs, splitLong, startsWithGreeting, unsafeReply, wantsHuman, withReplyContext } from './alina-guard.ts';
import { loadAlinaSettings } from './alina-settings.ts';
import { normLogin } from './alina-gate.ts';

type BotId = 'alina' | 'alina2';
type ClientUpdate = Extract<NonNullable<ReturnType<typeof parseAlinaBusinessUpdate>>, { kind: 'client' }>;

export async function processAlinaTelegramUpdate(
    botId: BotId,
    envToken: string,
    update: Parameters<typeof parseAlinaBusinessUpdate>[0],
): Promise<void> {
    const message = parseAlinaBusinessUpdate(update);
    if (!message) return;
    const admin = getAdminClient();
    // Журнал переписки для обучения Алины (режим наблюдения): что пишет клиент и что отвечает владелец вручную, с временем. Работает и при выключенной Алине.
    try {
        const who = message.kind === 'owner' ? 'owner' : 'client';
        const text = message.kind === 'owner' ? message.ownerText : message.text;
        await admin.from('alina_selfbuy_events').insert({
            event_type: 'chat_log', chat_id: message.chatId,
            payload: { dir: who, text: String(text || '').slice(0, 1500), username: message.kind === 'client' ? message.username || null : null, update_id: message.updateId },
        });
    } catch { /* журнал не должен мешать ответу */ }
    const { data: bot, error: botError } = await admin.from('telegram_bots')
        .select('is_enabled, deleted_at').eq('id', botId).maybeSingle();
    if (botError) throw new Error('Alina bot registry is unavailable');
    if (!bot?.is_enabled || bot.deleted_at) return;
    if (message.kind === 'owner') {
        await logAlinaRawEvent(message.chatId, 'owner_message', { message_id: message.messageId });
        return;
    }

    // Список «только эти логины» (настройка onlyLogins): пока он не пуст, остальным клиентам Алина не отвечает и ничего не записывает
    const only = (await loadAlinaSettings()).onlyLogins;
    if (only.length && !only.includes(normLogin(message.username))) return;

    const { data: credentials } = await admin.from('telegram_bot_secrets')
        .select('token').eq('bot_id', botId).maybeSingle();
    const token = String(credentials?.token || envToken).trim();
    if (!token) return;

    const delivery = { bot_id: botId, update_id: message.updateId };
    const { data: claimed, error } = await admin.from('alina_selfbuy_events').insert({
        event_type: 'telegram_delivery',
        chat_id: message.chatId,
        payload: { ...delivery, text: (message.text || '').slice(0, 1500), photo: Boolean(message.photoFileId) },
    }).select('created_at').maybeSingle();
    if (error?.code === '23505') return;
    if (error) throw new Error('Alina event storage is unavailable');

    // Несколько сообщений подряд: ждём, пока человек допишет, и отвечаем один раз на всё (владелец, 24 ноября 2026).
    let text = message.text;
    if (!message.photoFileId && (message.text || '').trim() && claimed?.created_at) {
        await pacing.sleep(pacing.burstMs);
        const hasNewer = async () => {
            const { data } = await admin.from('alina_selfbuy_events').select('id')
                .eq('chat_id', message.chatId).eq('event_type', 'telegram_delivery').gt('created_at', claimed.created_at).limit(1);
            return Boolean(data && data.length);
        };
        let newer = await hasNewer();
        // «Минуту, сейчас пришлю»: клиент обещал ещё, ждём следующее сообщение дольше (до ~70 секунд), чтобы ответить один раз на всё.
        if (!newer && promisesMore(message.text || '')) {
            for (let waited = 0; waited < pacing.promiseMs && !newer; waited += 5000) {
                await pacing.sleep(5000);
                newer = await hasNewer();
            }
        }
        if (newer) return; // дописал ещё: ответит последнее сообщение, сведя всё в один ответ
        const { data: mark } = await admin.from('alina_selfbuy_events').select('created_at')
            .eq('chat_id', message.chatId).eq('event_type', 'burst_handled').order('created_at', { ascending: false }).limit(1).maybeSingle();
        const since = mark?.created_at ?? new Date(Date.now() - 120_000).toISOString();
        const { data: burst } = await admin.from('alina_selfbuy_events').select('payload, created_at')
            .eq('chat_id', message.chatId).eq('event_type', 'telegram_delivery').gt('created_at', since).order('created_at', { ascending: true }).limit(20);
        text = joinBurst((burst || []).map((r: { payload: { text?: string; photo?: boolean } }) => r.payload), message.text || '');
        await admin.from('alina_selfbuy_events').insert({ event_type: 'burst_handled', chat_id: message.chatId, payload: { update_id: message.updateId, parts: (burst || []).length } });
    }

    if (message.kind === 'client' && message.replyText) text = withReplyContext(text || '', message.replyText);
    const budget = { spent: 0 };

    // Ручной режим: если владелец сам пишет по делу в этом чате (последние 5 минут) или клиент уже позвал человека (последние 3 часа), Алина молчит.
    // Одно приветствие владельца («Здравствуйте») ручным режимом не считается: на ответ блогера Алина продолжает сама.
    const since5 = new Date(Date.now() - 5 * 60_000).toISOString();
    const since3h = new Date(Date.now() - 3 * 3600_000).toISOString();
    const [ownerLog, handoff] = await Promise.all([
        admin.from('alina_selfbuy_events').select('payload').eq('chat_id', message.chatId).eq('event_type', 'chat_log').eq('payload->>dir', 'owner').gt('created_at', since5).limit(10),
        admin.from('alina_selfbuy_events').select('id').eq('chat_id', message.chatId).eq('event_type', 'human_requested').gt('created_at', since3h).limit(1),
    ]);
    const ownerBusy = (ownerLog.data || []).some((x: { payload: { text?: string } }) => !isGreetingOnly(String(x.payload?.text || '')));
    if (ownerBusy || handoff.data?.length) {
        await logAlinaRawEvent(message.chatId, 'muted_human', { update_id: message.updateId });
        return;
    }

    // Клиент зовёт человека или раздражён: сразу передаём менеджеру, дальше пишет он (владелец подключится по уведомлению в группе).
    if ((text || '').trim() && (wantsHuman(text || '') || isAngry(text || ''))) {
        const group = await managerGroupId();
        const posted = group ? await askAlinaManager(token, group, {
            chatId: message.chatId, connectionId: message.connectionId, username: message.username,
        }, `Клиент просит человека или раздражён: «${String(text).slice(0, 300)}». Подключитесь к чату, Алина больше не отвечает.`) : false;
        await logAlinaRawEvent(message.chatId, 'human_requested', { text: String(text).slice(0, 200), posted });
        const reply = posted ? HUMAN_HANDOFF[message.updateId % HUMAN_HANDOFF.length] : 'Не получилось связаться с менеджером. Напишите мне чуть позже, пожалуйста.';
        try {
            if (await sendText(token, message, reply, true, budget)) await logAlinaRawEvent(message.chatId, 'chat_log', { dir: 'alina', text: reply });
        } catch { /* ответ не критичен */ }
        return;
    }

    // Последние сообщения чата (клиент, владелец, Алина) для контекста: так Алина отвечает по делу, а не как на первое обращение.
    let history = '';
    try {
        const { data: hist } = await admin.from('alina_selfbuy_events').select('payload').eq('chat_id', message.chatId)
            .eq('event_type', 'chat_log').order('created_at', { ascending: false }).limit(10);
        const label: Record<string, string> = { client: 'Клиент', owner: 'Менеджер', alina: 'Алина' };
        history = (hist || []).reverse().map((x: { payload: { dir?: string; text?: string } }) =>
            `${label[String(x.payload?.dir)] || '?'}: ${String(x.payload?.text || '').slice(0, 300)}`).join('\n');
    } catch { /* без контекста тоже работаем */ }
    try {
        const { replies: draft, photos, escalate, replyToKind } = await handleAlinaClientMessage({
            ...message,
            text,
            history,
            hasPhoto: Boolean(message.photoFileId),
            botToken: token,
            sourceAccount: 'business',
        });
        let replies = draft;
        if (escalate) {
          // Вопрос менеджерам. Клиент получает «уточню» только если вопрос действительно дошёл до группы.
          const posted = await askAlinaManager(token, escalate.group, {
            chatId: message.chatId, connectionId: message.connectionId, username: message.username,
          }, escalate.question);
          if (!posted) replies = ['Не получилось связаться с менеджером. Напишите мне чуть позже, пожалуйста.'];
        }
        for (const photo of photos || []) {
            const photoMid = await sendPhoto(token, message, photo);
            if (photoMid !== null) await logAlinaRawEvent(message.chatId, 'chat_log', { dir: 'alina', kind: 'photo', text: String(photo.caption || '').slice(0, 300), mid: photoMid });
            if (photoMid === null) {
                const fallback = [photo.caption, photo.url].filter(Boolean).join('\n');
                if (fallback && !await sendText(token, message, fallback)) {
                    throw new Error('photo_fallback');
                }
            }
        }
        // Защита: ответ не должен выдавать «бот» или артикул, и не повторяем слово в слово прошлые реплики этого диалога.
        if (replies.some(unsafeReply)) replies = replies.map((r) => (unsafeReply(r) ? SAFE_REPLY : r));
        const { data: prev } = await admin.from('alina_selfbuy_events').select('payload, created_at').eq('chat_id', message.chatId)
            .eq('event_type', 'chat_log').eq('payload->>dir', 'alina').order('created_at', { ascending: false }).limit(3);
        replies = dedupeReplies(replies, (prev || []).map((x: { payload: { text?: string } }) => String(x.payload?.text || '')));
        // То же по смыслу (другие слова): за последние 90 секунд почти такую реплику уже отправляли, второй раз не шлём.
        // Списки моделей не повторяем 5 минут, остальные реплики 90 секунд.
        replies = replies.filter((r) => dropRecentSimilar([r], (prev || [])
            .filter((x: { created_at: string }) => Date.now() - Date.parse(x.created_at) < recentWindowMs(r))
            .map((x: { payload: { text?: string } }) => String(x.payload?.text || ''))).length > 0);
        // Одно приветствие на диалог: уже поздоровались (владелец или Алина за 12 часов), так убираем его из ответа; никто не здоровался, так добавляем.
        const since12h = new Date(Date.now() - 12 * 3600_000).toISOString();
        const { data: hist } = await admin.from('alina_selfbuy_events').select('payload').eq('chat_id', message.chatId)
            .eq('event_type', 'chat_log').in('payload->>dir', ['owner', 'alina']).gt('created_at', since12h).limit(40);
        const greeted = (hist || []).some((x: { payload: { text?: string } }) => startsWithGreeting(String(x.payload?.text || '')));
        replies = applyGreeting(replies, greeted);
        replies = replies.flatMap((x) => splitLong(x)); // длинные тексты (ТЗ) отправляем несколькими сообщениями
        // «Отправила выше»: отвечаем реплаем на своё прежнее сообщение (условия, ключ, фото), чтобы не отправлять его второй раз.
        let replyMid = 0;
        if (replyToKind) {
            const { data: prevMsg } = await admin.from('alina_selfbuy_events').select('payload').eq('chat_id', message.chatId)
                .eq('event_type', 'chat_log').eq('payload->>dir', 'alina').eq('payload->>kind', replyToKind)
                .order('created_at', { ascending: false }).limit(1).maybeSingle();
            replyMid = Number((prevMsg as { payload?: { mid?: number } } | null)?.payload?.mid || 0);
        }
        let firstReply = true;
        for (const reply of replies) {
            const mid = await sendTextId(token, message, reply, firstReply, budget, replyMid || undefined);
            if (mid === null) throw new Error('text_delivery');
            const kind = kindOf(reply);
            await logAlinaRawEvent(message.chatId, 'chat_log', { dir: 'alina', text: reply.slice(0, 1500), ...(kind ? { kind, mid } : {}) });
            firstReply = false;
        }
        await logAlinaRawEvent(message.chatId, 'business_out', {
            ...delivery,
            messages: replies.length,
            photos: photos?.length || 0,
        });
    } catch (e) {
        // The CRM may already have advanced. Replaying the update could advance it twice.
        await logAlinaRawEvent(message.chatId, 'business_error', { ...delivery, error: String((e as Error)?.message || e).slice(0, 200) });
        console.error('[alina] Telegram update failed after being claimed');
    }
}

// Живой темп: перед ответом «читает» и «печатает». Пауза зависит от длины текста, на все ответы одного сообщения не больше 25 секунд.
export const pacing = {
    sleep: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
    burstMs: 7000, // сколько ждём, не допишет ли человек ещё
    promiseMs: 70_000, // если клиент пообещал прислать ещё
};

/** Склеивает сообщения подряд в один текст (фото-сообщения не берём: у них свой путь). Если ничего не нашли, остаётся текст этого сообщения. */
export function joinBurst(parts: { text?: string; photo?: boolean }[], own: string): string {
    const texts = parts.filter((p) => !p.photo).map((p) => String(p.text || '').trim()).filter(Boolean);
    return texts.length ? texts.join('\n') : own;
}
export function humanPauseMs(text: string, first: boolean): number {
    const base = 1200 + text.length * 40 + (first ? 1500 : 0);
    return Math.min(9000, Math.round(base * (0.85 + Math.random() * 0.3)));
}
async function humanPause(token: string, message: ClientUpdate, text: string, first: boolean, budget: { spent: number }): Promise<void> {
    const left = 25_000 - budget.spent;
    if (left <= 0) return;
    const ms = Math.min(left, humanPauseMs(text, first));
    budget.spent += ms;
    // «Печатает…» держится около 5 секунд: обновляем индикатор, пока ждём
    for (let waited = 0; waited < ms; waited += 4500) {
        await telegramSend(token, 'sendChatAction', JSON.stringify({
            chat_id: message.chatId, business_connection_id: message.connectionId, action: 'typing',
        }));
        await pacing.sleep(Math.min(4500, ms - waited));
    }
}

async function sendTextId(token: string, message: ClientUpdate, text: string, first = false, budget = { spent: 25_000 }, replyTo?: number): Promise<number | null> {
    await humanPause(token, message, text, first, budget);
    return telegramSendId(token, 'sendMessage', JSON.stringify({
        chat_id: message.chatId,
        business_connection_id: message.connectionId,
        text,
        ...(replyTo ? { reply_parameters: { message_id: replyTo } } : {}),
    }));
}
async function sendText(token: string, message: ClientUpdate, text: string, first = false, budget = { spent: 25_000 }): Promise<boolean> {
    return (await sendTextId(token, message, text, first, budget)) !== null;
}

/** Вид отправленного сообщения для «отправила выше»: условия или ключ. */
function kindOf(text: string): 'tz' | 'key' | null {
    if (/Высылаю ТЗ|ТЗ для ОЗНАКОМЛЕНИЯ/.test(text)) return 'tz';
    if (/^Ключ для поиска/.test(text)) return 'key';
    return null;
}

async function sendPhoto(
    token: string,
    message: ClientUpdate,
    photo: NonNullable<AlinaReply['photos']>[number],
): Promise<number | null> {
    const form = new FormData();
    form.set('chat_id', String(message.chatId));
    form.set('business_connection_id', message.connectionId);
    if (photo.caption) form.set('caption', photo.caption);
    if (photo.bytes) {
        form.set('photo', new Blob([new Uint8Array(photo.bytes)], { type: photo.mime }), photo.filename || 'product.jpg');
    } else if (photo.url) {
        form.set('photo', photo.url);
    } else {
        return null;
    }
    return telegramSendId(token, 'sendPhoto', form);
}

async function telegramSendId(token: string, method: string, body: string | FormData): Promise<number | null> {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        headers: typeof body === 'string' ? { 'Content-Type': 'application/json' } : undefined,
        signal: AbortSignal.timeout(10_000),
        body,
    }).catch(() => null);
    if (!response?.ok) return null;
    const data = await response.json().catch(() => null);
    return data?.ok === true ? Number(data?.result?.message_id ?? 0) || 0 : null;
}
async function telegramSend(token: string, method: string, body: string | FormData): Promise<boolean> {
    return (await telegramSendId(token, method, body)) !== null;
}

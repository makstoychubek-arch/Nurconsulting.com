// Supabase Edge Function: telegram-webhook
// Умный бот по группам:
//   Продажи  — @бот 12.07 Baza
//   Штрафы   — @бот штрафы 19.07
//   Реклама  — @бот баланс / реклама 19.07
//   А/Б      — @бот тесты
//   Любая    — @бот айди
//
// Deploy: supabase functions deploy telegram-webhook --no-verify-jwt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getTelegramChatId, getTelegramToken } from '../_shared/telegram-routing.ts';
import {
    abTestsHelpText,
    adsHelpText,
    fetchAdsDayRows,
    fetchAllBalances,
    formatAdsReply,
    formatBalanceReply,
    parseAdsQuery,
    penaltiesHelpText,
} from '../_shared/wb-ads-snapshot.ts';
import {
    fetchAllCabinetPenalties,
    formatPenaltiesReply,
    parsePenaltiesQuery,
} from '../_shared/wb-penalties-snapshot.ts';
import {
    fetchAllCabinetSales,
    formatSalesReply,
    parseSalesQuery,
    salesHelpText,
} from '../_shared/wb-sales-snapshot.ts';
import {
    applyEditedReply,
    approveAndPublish,
    approveAllPending,
    findEditingByMessage,
    footerEditing,
    footerPublished,
    footerRejected,
    loadReviewLog,
    rejectReview,
    startEditing,
    moderationKeyboard,
    footerPending,
    upsertModerationPanel,
    REVIEW_BATCH_SIZE,
    isModerationPanelMessage,
    upsertReviewCardFromLog,
} from '../_shared/review-moderation.ts';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-telegram-bot-api-secret-token',
};

const PENALTIES_ALERT = (Deno.env.get('PENALTIES_ALERT_USERNAME') ?? 'maraWuW').replace(/^@/, '');

let cachedBotUsername: string | null = null;

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const token = getTelegramToken();
    if (!token) {
        console.error('[telegram-webhook] TELEGRAM_BOT_TOKEN не задан');
        return new Response('ok');
    }

    const webhookSecret = (Deno.env.get('TELEGRAM_WEBHOOK_SECRET') ?? '').trim();
    if (webhookSecret) {
        const got = req.headers.get('X-Telegram-Bot-Api-Secret-Token') ?? '';
        if (got !== webhookSecret) return new Response('forbidden', { status: 403 });
    }

    if (req.method === 'GET') {
        const url = new URL(req.url);
        if (url.searchParams.get('setup_webhook') === '1') {
            const setupKey = (req.headers.get('X-NR-Setup-Key') ?? '').trim();
            const secret = (Deno.env.get('NR_SETUP_SECRET') ?? 'nrspace-test-fiukyfy').trim();
            if (setupKey !== secret) return json({ error: 'Unauthorized' }, 401);
            const webhookUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/telegram-webhook`;
            const body: Record<string, unknown> = {
                url: webhookUrl,
                allowed_updates: ['message', 'edited_message', 'callback_query'],
                drop_pending_updates: true,
            };
            if (webhookSecret) body.secret_token = webhookSecret;
            const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const setResult = await res.json();
            const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
            const info = await infoRes.json();
            return json({ ok: true, webhook_url: webhookUrl, setWebhook: setResult, getWebhookInfo: info });
        }
        return json({ ok: true, bot: 'telegram-webhook', groups: ['sales', 'penalties', 'ads', 'ab_tests', 'reviews'] });
    }

    try {
        const update = await req.json();
        await handleUpdate(token, update);
    } catch (e) {
        console.warn('[telegram-webhook] parse/handle error:', String(e));
    }

    return new Response('ok');
});

async function handleUpdate(token: string, update: Record<string, unknown>): Promise<void> {
    if (update.callback_query) {
        await handleReviewCallback(token, update.callback_query as Record<string, unknown>);
        return;
    }

    const message = (update.message || update.edited_message) as Record<string, unknown> | undefined;
    if (!message) return;

    const chat = message.chat as Record<string, unknown> | undefined;
    const text = String(message.text ?? message.caption ?? '').trim();
    if (!chat) return;

    const chatType = String(chat.type ?? '');
    const chatId = chat.id;
    const chatTitle = String(chat.title ?? chat.username ?? 'чат');
    const botUsername = await resolveBotUsername(token);
    const from = message.from as Record<string, unknown> | undefined;
    if (from?.is_bot) return;

    const admin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    const chatKey = resolveChatChannel(String(chatId));

    // ── Модерация отзывов: реплай с новым текстом (шаг 5) ───────────────
    if (chatKey === 'reviews' && text) {
        const replyTo = message.reply_to_message as Record<string, unknown> | undefined;
        const replyMsgId = Number(replyTo?.message_id ?? 0);
        if (replyMsgId) {
            const editing = await findEditingByMessage(admin, String(chatId), replyMsgId);
            if (editing) {
                const userId = Number(from?.id ?? 0);
                const userName = String(from?.first_name ?? from?.username ?? 'менеджер');
                const result = await applyEditedReply(admin, editing.id, text, userId);
                if (result.ok) {
                    await resendReviewCard(admin, token, String(chatId), editing.id, footerPending(''), moderationKeyboard(editing.id));
                    await sendReply(token, chatId, '✏️ Текст обновлён — нажмите ✅', message.message_id);
                } else {
                    await sendReply(token, chatId, `❌ ${escapeHtml(result.error || 'ошибка')}`, message.message_id);
                }
                return;
            }
        }
    }

    if (!text) return;

    const inGroup = chatType === 'group' || chatType === 'supergroup';
    if (inGroup && !isBotMentioned(message, text, botUsername, from)) return;

    // ── Продажи ──────────────────────────────────────────────────────────
    if (chatKey === 'sales' && wantsSalesQuery(text)) {
        const query = parseSalesQuery(text, true);
        if (!query) {
            await sendReply(token, chatId, salesHelpText(), message.message_id);
            return;
        }
        await sendReply(token, chatId, '⏳ Считаю продажи…', message.message_id);
        try {
            const snapshots = await fetchAllCabinetSales(admin, query.date, query.cabinet);
            await sendReply(token, chatId, formatSalesReply(query.date, snapshots), message.message_id);
        } catch (e) {
            await sendReply(token, chatId, `❌ ${escapeHtml(String(e).slice(0, 200))}`, message.message_id);
        }
        return;
    }

    // ── Штрафы ───────────────────────────────────────────────────────────
    if (chatKey === 'penalties' && wantsPenaltiesQuery(text)) {
        const query = parsePenaltiesQuery(text, true);
        if (!query) {
            await sendReply(token, chatId, penaltiesHelpText(), message.message_id);
            return;
        }
        await sendReply(token, chatId, '⏳ Запрашиваю штрафы WB…', message.message_id);
        try {
            const snapshots = await fetchAllCabinetPenalties(admin, query.date, query.cabinet);
            const alert = snapshots.some((s) => s.total > 0) ? PENALTIES_ALERT : undefined;
            await sendReply(token, chatId, formatPenaltiesReply(query.date, snapshots, alert), message.message_id);
        } catch (e) {
            await sendReply(token, chatId, `❌ ${escapeHtml(String(e).slice(0, 200))}`, message.message_id);
        }
        return;
    }

    // ── Реклама ──────────────────────────────────────────────────────────
    if (chatKey === 'ads' && wantsAdsQuery(text)) {
        const query = parseAdsQuery(text);
        if (!query) {
            await sendReply(token, chatId, adsHelpText(), message.message_id);
            return;
        }
        if (query.mode === 'balance') {
            await sendReply(token, chatId, '⏳ Баланс…', message.message_id);
            const balances = await fetchAllBalances(admin);
            await sendReply(token, chatId, formatBalanceReply(balances), message.message_id);
            return;
        }
        await sendReply(token, chatId, '⏳ Статистика рекламы…', message.message_id);
        try {
            const rows = await fetchAdsDayRows(admin, query.date, query.cabinet);
            await sendReply(token, chatId, formatAdsReply(query.date, rows), message.message_id);
        } catch (e) {
            await sendReply(token, chatId, `❌ ${escapeHtml(String(e).slice(0, 200))}`, message.message_id);
        }
        return;
    }

    // ── А/Б тесты ────────────────────────────────────────────────────────
    if (chatKey === 'ab_tests' && wantsAbQuery(text)) {
        const nmMatch = text.match(/\b(?:тест|арт|nm)\s*(\d{5,12})\b/i);
        if (nmMatch) {
            await sendAbTestByNm(admin, token, chatId, Number(nmMatch[1]), message.message_id);
            return;
        }
        if (/\b(тест|ab|а\/б|help|помощь)\b/i.test(text)) {
            await sendAbTestsList(admin, token, chatId, message.message_id);
            return;
        }
        await sendReply(token, chatId, abTestsHelpText(), message.message_id);
        return;
    }

    // ── Chat ID ──────────────────────────────────────────────────────────
    if (!wantsChatId(text, chatType)) return;
    await sendReply(token, chatId, formatChatIdReply(chatId, chatTitle, chatType), message.message_id);
}

function resolveChatChannel(chatId: string): string | null {
    const map: Record<string, string> = {
        [getTelegramChatId('sales') || '']: 'sales',
        [getTelegramChatId('penalties') || '']: 'penalties',
        [getTelegramChatId('ads') || '']: 'ads',
        [getTelegramChatId('ab_tests') || '']: 'ab_tests',
        [getTelegramChatId('news') || '']: 'news',
        [getTelegramChatId('reviews') || '']: 'reviews',
        [getTelegramChatId('blockings') || '']: 'blockings',
        [getTelegramChatId('warehouse') || '']: 'warehouse',
        [getTelegramChatId('triggers') || '']: 'triggers',
    };
    return map[chatId] || null;
}

async function handleReviewCallback(token: string, cq: Record<string, unknown>): Promise<void> {
    const cqId = String(cq.id ?? '');
    const data = String(cq.data ?? '');

    const dismiss = async (text: string) => {
        if (cqId) await answerCallback(token, cqId, text);
    };

    if (!data.startsWith('rv:')) {
        await dismiss('');
        return;
    }

    const message = cq.message as Record<string, unknown> | undefined;
    const msgChat = message?.chat as Record<string, unknown> | undefined;
    const chatId = msgChat?.id ?? (cq as Record<string, unknown>).from;
    const reviewsChat = getTelegramChatId('reviews');

    if (reviewsChat && String(chatId) !== String(reviewsChat)) {
        console.warn('[telegram-webhook] callback wrong chat', chatId, 'expected', reviewsChat);
        await dismiss('Не та группа');
        return;
    }

    const from = cq.from as Record<string, unknown> | undefined;
    const userId = Number(from?.id ?? 0);
    const userName = String(from?.first_name ?? from?.username ?? 'менеджер');
    const messageId = Number(message?.message_id ?? 0);

    const parts = data.split(':');
    const action = parts[1];

    const admin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    try {
        if (action === 'next') {
            await dismiss('⏳ Загружаю отзывы…');
            const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
            const baseUrl = Deno.env.get('SUPABASE_URL') ?? '';
            let processed = 0;
            try {
                const res = await fetch(`${baseUrl}/functions/v1/wb-review-auto-reply`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${serviceKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ force: true, limit: REVIEW_BATCH_SIZE }),
                });
                const data = await res.json() as { processed?: number; queued?: number };
                processed = Number(data.processed ?? 0);
            } catch (e) {
                console.error('[telegram-webhook] rv:next error:', e);
                await dismiss('❌ Ошибка загрузки');
                return;
            }
            if (processed > 0) {
                await upsertModerationPanel(admin, token, String(chatId), messageId || undefined, { force: true });
            }
            await dismiss(processed > 0 ? `✅ +${processed} отзывов` : 'Новых отзывов нет');
            return;
        }

        if (action === 'okall') {
            await dismiss('⏳ Публикую на WB…');
            const result = await approveAllPending(admin, userId);

            if (result.total === 0) {
                await upsertModerationPanel(admin, token, String(chatId), messageId || undefined);
                await dismiss('Уже все опубликованы');
                return;
            }

            for (const id of result.publishedIds) {
                const { data: row } = await admin
                    .from('review_reply_log')
                    .select('tg_message_id, model')
                    .eq('id', id)
                    .maybeSingle();
                if (!row?.tg_message_id) continue;
                await resendReviewCard(admin, token, String(chatId), id,
                    footerPublished(String(row.model ?? ''), userName),
                    { inline_keyboard: [] });
                await tgSleep(300);
            }

            await upsertModerationPanel(admin, token, String(chatId), messageId || undefined);
            const hint = result.fail ? `, ошибок: ${result.fail}` : '';
            await dismiss(`✅ Опубликовано: ${result.ok} из ${result.total}${hint}`);
            return;
        }

        const logId = Number(parts[2]);
        if (!logId) {
            await dismiss('Ошибка ID');
            return;
        }

        if (action === 'ok') {
            const result = await approveAndPublish(admin, logId, userId);
            if (result.ok) {
                const { data: logRow } = await admin.from('review_reply_log').select('model').eq('id', logId).maybeSingle();
                await resendReviewCard(admin, token, String(chatId), logId,
                    footerPublished(String(logRow?.model ?? ''), userName),
                    { inline_keyboard: [] });
                await upsertModerationPanel(admin, token, String(chatId), messageId || undefined);
                await dismiss('✅ Отправлено на WB');
            } else {
                await dismiss(`❌ ${result.error || 'ошибка WB'}`);
            }
            return;
        }

        if (action === 'rej') {
            const ok = await rejectReview(admin, logId, userId);
            if (ok) {
                await updateReviewCaption(admin, token, chatId, messageId, logId, footerRejected(userName));
                await upsertModerationPanel(admin, token, String(chatId), messageId || undefined);
                await dismiss('❌ Отклонено');
            } else {
                await dismiss('Уже обработано');
            }
            return;
        }

        if (action === 'edit') {
            const ok = await startEditing(admin, logId);
            if (ok) {
                await updateReviewCaption(admin, token, chatId, messageId, logId, footerEditing(), moderationKeyboard(logId));
                await dismiss('✏️ Ответьте реплаем');
            } else {
                await dismiss('Нельзя редактировать');
            }
            return;
        }

        await dismiss('Неизвестная команда');
    } catch (e) {
        console.error('[telegram-webhook] review callback error:', e);
        await dismiss('❌ Ошибка сервера');
    }
}

async function updateReviewCaption(
    admin: ReturnType<typeof createClient>,
    token: string,
    chatId: unknown,
    messageId: number,
    logId: number,
    footer: string,
    keyboard?: unknown,
): Promise<void> {
    await resendReviewCard(admin, token, String(chatId), logId, footer, keyboard);
}

async function resendReviewCard(
    admin: ReturnType<typeof createClient>,
    token: string,
    chatId: string,
    logId: number,
    footer: string,
    keyboard?: unknown,
): Promise<number | null> {
    const { data: row } = await admin
        .from('review_reply_log')
        .select('id, tg_message_id, model, cabinet_name, review_text, reply_text, rating, nm_id, buyer_name, product_name, review_created_at, order_status, published_at')
        .eq('id', logId)
        .maybeSingle();
    if (!row) return null;
    const footerFinal = footer.includes('⏳') && row.model ? footerPending(String(row.model)) : footer;
    const newId = await upsertReviewCardFromLog(token, chatId, row.tg_message_id, row, footerFinal, keyboard);
    if (newId && newId !== Number(row.tg_message_id || 0)) {
        await admin.from('review_reply_log').update({
            tg_message_id: newId,
            tg_chat_id: chatId,
        }).eq('id', logId);
    }
    return newId;
}

function tgSleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

async function editTelegramMessage(
    token: string,
    chatId: unknown,
    messageId: number,
    text: string,
    replyMarkup?: unknown,
): Promise<void> {
    if (!messageId) return;
    try {
        const body: Record<string, unknown> = {
            chat_id: chatId,
            message_id: messageId,
            text,
            parse_mode: 'HTML',
        };
        body.reply_markup = replyMarkup ?? { inline_keyboard: [] };
        await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
    } catch { /* ignore */ }
}

async function answerCallback(token: string, callbackQueryId: string, text: string): Promise<void> {
    if (!callbackQueryId) return;
    try {
        await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                callback_query_id: callbackQueryId,
                text: text.slice(0, 200),
                show_alert: text.startsWith('❌'),
            }),
        });
    } catch (e) {
        console.warn('[telegram-webhook] answerCallbackQuery failed:', String(e));
    }
}

async function sendAbTestsList(
    admin: ReturnType<typeof createClient>,
    token: string,
    chatId: unknown,
    replyTo: unknown,
): Promise<void> {
    const { data: tests } = await admin
        .from('ab_tests')
        .select('id, nm_id, product_name, status, rotation_count, max_rotations, started_at, cabinet_id')
        .eq('status', 'active')
        .order('started_at', { ascending: false });

    if (!tests?.length) {
        await sendReply(token, chatId, '🧪 Активных А/Б тестов нет', replyTo);
        return;
    }

    const { data: cabinets } = await admin.from('cabinets').select('id, name');
    const cabMap = new Map((cabinets || []).map((c) => [c.id, c.name]));

    const lines = ['🧪 <b>Активные А/Б тесты</b>', ''];
    for (const t of tests.slice(0, 10)) {
        const cab = cabMap.get(t.cabinet_id) || '?';
        const rot = `${t.rotation_count || 0}/${t.max_rotations || '∞'}`;
        lines.push(
            `<b>${escapeHtml(String(t.product_name || 'Товар'))}</b> · арт. ${t.nm_id}`,
            `${escapeHtml(cab)} · ротаций ${rot}`,
            '',
        );
    }
    if (tests.length > 10) lines.push(`…ещё ${tests.length - 10}`);
    await sendReply(token, chatId, lines.join('\n').trimEnd(), replyTo);
}

async function sendAbTestByNm(
    admin: ReturnType<typeof createClient>,
    token: string,
    chatId: unknown,
    nmId: number,
    replyTo: unknown,
): Promise<void> {
    const { data: test } = await admin
        .from('ab_tests')
        .select('*')
        .eq('nm_id', nmId)
        .eq('status', 'active')
        .maybeSingle();
    if (!test) {
        await sendReply(token, chatId, `🧪 Активный тест по арт. ${nmId} не найден`, replyTo);
        return;
    }
    const { data: variants } = await admin
        .from('ab_test_variants')
        .select('variant_label, impressions, clicks')
        .eq('test_id', test.id)
        .order('variant_label');

    const lines = [
        `🧪 <b>${escapeHtml(String(test.product_name || 'Товар'))}</b> · арт. ${nmId}`,
        `Ротаций: ${test.rotation_count || 0}/${test.max_rotations || '∞'}`,
        '',
    ];
    for (const v of variants || []) {
        const impr = Number(v.impressions) || 0;
        const clk = Number(v.clicks) || 0;
        const ctr = impr > 0 ? (clk / impr * 100).toFixed(2) : '0';
        lines.push(`Вариант ${v.variant_label}: ${impr} показов · CTR ${ctr}%`);
    }
    await sendReply(token, chatId, lines.join('\n'), replyTo);
}

function wantsSalesQuery(text: string): boolean {
    const lower = text.toLowerCase();
    // Не отвечаем на пересланные авто-отчёты (caption: «отчёт за 23.07.2026»).
    if (/\bотч[её]t\s+за\s+\d{1,2}[./]\d{1,2}/i.test(lower)) return false;
    if (/\b(продаж|заказ|выкуп|sales|help|помощь)\b/i.test(lower)) return true;
    if (/\b(вчера|позавчера|сегодня)\b/i.test(lower)) return true;
    if (/\b\d{1,2}[./]\d{1,2}/.test(text)) return true;
    return false;
}

function wantsPenaltiesQuery(text: string): boolean {
    const lower = text.toLowerCase();
    if (/\b(штраф|удерж|penalt|help|помощь)\b/i.test(lower)) return true;
    if (/\b(вчера|позавчера|сегодня)\b/i.test(lower)) return true;
    if (/\b\d{1,2}[./]\d{1,2}/.test(text)) return true;
    return false;
}

function wantsAdsQuery(text: string): boolean {
    const lower = text.toLowerCase();
    if (/\b(реклам|рк|ads|баланс|balance|ctr|расход|help|помощь)\b/i.test(lower)) return true;
    if (/\b(вчера|пozavчera|сегодня)\b/i.test(lower)) return true;
    if (/\b\d{1,2}[./]\d{1,2}/.test(text)) return true;
    return false;
}

function wantsAbQuery(text: string): boolean {
    const lower = text.toLowerCase();
    return /\b(тест|ab|а\/б|арт|nm|help|помощь)\b/i.test(lower);
}

function wantsChatId(text: string, chatType: string): boolean {
    const t = text.toLowerCase().trim();
    if (/^\/(id|айди|chatid)(@\w+)?$/i.test(t)) return true;
    if (chatType === 'private' && /^(айди|id|chatid|chat_id)$/i.test(t)) return true;
    return /\b(айди|id|chatid|chat_id)\b/i.test(t);
}

function isBotMentioned(
    message: Record<string, unknown>,
    text: string,
    botUsername: string,
    _from: Record<string, unknown> | undefined,
): boolean {
    const lower = text.toLowerCase();
    const mentionTag = `@${botUsername.toLowerCase()}`;
    if (botUsername && lower.includes(mentionTag)) return true;

    const entities = message.entities as Array<Record<string, unknown>> | undefined;
    if (entities?.length && botUsername) {
        for (const e of entities) {
            if (e.type !== 'mention') continue;
            const offset = Number(e.offset ?? 0);
            const length = Number(e.length ?? 0);
            if (text.slice(offset, offset + length).toLowerCase() === mentionTag) return true;
        }
    }

    const reply = message.reply_to_message as Record<string, unknown> | undefined;
    const replyFrom = reply?.from as Record<string, unknown> | undefined;
    if (replyFrom?.is_bot && replyFrom?.username && botUsername) {
        if (String(replyFrom.username).toLowerCase() === botUsername.toLowerCase()) return true;
    }
    return false;
}

function formatChatIdReply(chatId: unknown, title: string, chatType: string): string {
    const id = String(chatId);
    if (chatType === 'private') {
        return `🆔 <b>chat_id</b>\n\n<code>${escapeHtml(id)}</code>`;
    }
    return [
        '🆔 <b>ID этой группы</b>',
        `«${escapeHtml(title)}»`,
        '',
        `<code>${escapeHtml(id)}</code>`,
    ].join('\n');
}

async function resolveBotUsername(token: string): Promise<string> {
    const fromEnv = (Deno.env.get('TELEGRAM_BOT_USERNAME') ?? '').replace(/^@/, '').trim();
    if (fromEnv) return fromEnv;
    if (cachedBotUsername) return cachedBotUsername;
    try {
        const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
        const data = await res.json() as { ok?: boolean; result?: { username?: string } };
        cachedBotUsername = String(data?.result?.username ?? '').trim();
    } catch {
        cachedBotUsername = '';
    }
    return cachedBotUsername ?? '';
}

async function sendReply(token: string, chatId: unknown, text: string, replyToMessageId: unknown): Promise<void> {
    try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: 'HTML',
                reply_to_message_id: replyToMessageId,
                allow_sending_without_reply: true,
            }),
        });
        if (!res.ok) console.warn('[telegram-webhook] sendMessage failed:', res.status, await res.text());
    } catch (e) {
        console.warn('[telegram-webhook] sendMessage error:', String(e));
    }
}

function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

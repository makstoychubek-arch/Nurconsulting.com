// Опрос неотвеченных вопросов WB «когда поступит?» и карточка в Telegram (отзывы).
// Cron: */10. Auth: service_role. В тим-чат не пишем — только TELEGRAM_CHAT_REVIEWS.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import { getTelegramToken } from '../_shared/telegram-routing.ts';
import { shouldSendTelegram } from '../_shared/telegram-gates.ts';
import { FEEDBACKS_API, wbError, wbSend } from '../_shared/wb-agent-wow.ts';
import {
    formatRestockTelegramCard,
    ownerMention,
    pickRestockFeedbacks,
    pickRestockQuestions,
    type RestockQuestion,
} from '../_shared/wb-restock-reply.ts';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OWNER = (Deno.env.get('TELEGRAM_ALERT_USERNAME') || 'maraWuW').replace(/^@/, '');

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!isServiceAuthorized(req, serviceKey)) return json({ error: 'Unauthorized' }, 401);

    const body = req.method === 'GET'
        ? Object.fromEntries(new URL(req.url).searchParams)
        : await req.json().catch(() => ({} as Record<string, unknown>));

    const tgToken = getTelegramToken();
    const reviewsChat = (Deno.env.get('TELEGRAM_CHAT_REVIEWS') ?? '').trim();
    if (body.health === true || body.health === 'true') {
        return json({
            ok: true,
            health: true,
            reviews_chat: Boolean(reviewsChat),
            token: Boolean(tgToken),
            owner: OWNER,
        });
    }

    const dryRun = body.dry_run === true || body.dry_run === 'true';
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: cabinets, error: cabErr } = await admin
        .from('cabinets')
        .select('id, name, wb_token')
        .not('wb_token', 'is', null)
        .gt('wb_token', '');
    if (cabErr) return json({ error: cabErr.message }, 500);

    const results: Array<Record<string, unknown>> = [];
    for (const cabinet of cabinets || []) {
        const row: Record<string, unknown> = { cabinet: cabinet.name, found: 0, notified: 0 };
        const gate = await shouldSendTelegram(admin, { channel: 'reviews', cabinetId: cabinet.id });
        if (!gate.ok) {
            row.skipped = gate.reason;
            results.push(row);
            continue;
        }
        const token = sanitizeWbToken(cabinet.wb_token);
        if (!token || token.length < 50) {
            row.skipped = 'invalid_token';
            results.push(row);
            continue;
        }

        const listed = await wbSend(
            `${FEEDBACKS_API}/api/v1/questions?isAnswered=false&take=50&skip=0&order=dateDesc`,
            token,
        );
        if (!listed.ok) {
            row.error = wbError(listed);
            results.push(row);
            continue;
        }

        const questions = pickRestockQuestions(listed.data);
        row.found = questions.length;

        for (const question of questions) {
            const existing = await admin
                .from('wb_restock_questions')
                .select('id, status, telegram_message_id')
                .eq('cabinet_id', cabinet.id)
                .eq('question_id', question.id)
                .maybeSingle();
            const prev = existing.data as {
                id?: string;
                status?: string;
                telegram_message_id?: number | null;
            } | null;
            if (prev?.status === 'answered') continue;
            if (prev?.telegram_message_id) continue;

            if (!prev) {
                const ins = await admin.from('wb_restock_questions').insert({
                    cabinet_id: cabinet.id,
                    question_id: question.id,
                    nm_id: question.nmId || null,
                    article: question.article || null,
                    product: question.product || null,
                    question_text: question.text,
                    status: 'pending',
                });
                if (ins.error) {
                    row.insert_error = ins.error.message;
                    continue;
                }
            }

            if (dryRun || !tgToken || !reviewsChat) {
                row.skipped_send = dryRun ? 'dry_run' : 'no_reviews_chat';
                continue;
            }

            const sent = await sendTelegramCard(tgToken, reviewsChat, cabinet.name, cabinet.id, question);
            if (sent.error) {
                row.telegram_error = sent.error;
                continue;
            }
            await admin.from('wb_restock_questions').update({
                telegram_chat_id: reviewsChat,
                telegram_message_id: sent.messageId,
                updated_at: new Date().toISOString(),
            }).eq('cabinet_id', cabinet.id).eq('question_id', question.id);
            row.notified = Number(row.notified || 0) + 1;
        }

        await sleep(350);
        const listedFb = await wbSend(
            `${FEEDBACKS_API}/api/v1/feedbacks?isAnswered=false&take=50&skip=0&order=dateDesc`,
            token,
        );
        if (listedFb.ok) {
            const feedbacks = pickRestockFeedbacks(listedFb.data);
            row.feedbacks = feedbacks.length;
            for (const fb of feedbacks) {
                const existing = await admin
                    .from('wb_restock_questions')
                    .select('id, status')
                    .eq('cabinet_id', cabinet.id)
                    .eq('question_id', fb.id)
                    .maybeSingle();
                if (existing.data?.status === 'answered') continue;
                if (existing.data) continue;
                await admin.from('wb_restock_questions').insert({
                    cabinet_id: cabinet.id,
                    question_id: fb.id,
                    nm_id: fb.nmId || null,
                    article: fb.article || null,
                    product: fb.product || null,
                    question_text: fb.text,
                    status: 'pending',
                });
            }
        } else {
            row.feedback_error = wbError(listedFb);
        }

        results.push(row);
        await sleep(350);
    }

    return json({ ok: true, dry_run: dryRun, results });
});

async function sendTelegramCard(
    token: string,
    chatId: string,
    cabinetName: string,
    cabinetId: string,
    question: RestockQuestion,
): Promise<{ error: string | null; messageId: number | null }> {
    const text = formatRestockTelegramCard({
        cabinetName,
        cabinetId,
        question,
        mention: ownerMention(OWNER),
    });
    try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                disable_web_page_preview: true,
            }),
        });
        const data = await res.json().catch(() => ({} as Record<string, unknown>));
        if (!res.ok) return { error: `HTTP ${res.status}`, messageId: null };
        const messageId = Number((data as { result?: { message_id?: number } })?.result?.message_id);
        return { error: null, messageId: Number.isFinite(messageId) ? messageId : null };
    } catch (e) {
        return { error: String(e), messageId: null };
    }
}

function sanitizeWbToken(raw: unknown): string {
    if (typeof raw !== 'string') return '';
    return raw.replace(/^\uFEFF/, '').replace(/\s+/g, '').trim();
}

function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    });
}

// ВАЖНО: это снимок функции, которая работает в Supabase. Общие файлы лежат в ./live —
// это ровно те версии, что задеплоены (они отличаются от ../_shared). Не заменять на ../_shared.
// Единственная добавка к живому коду: тумблер «Ответы на отзывы» (cabinet_features).
// Supabase Edge Function: wb-review-auto-reply
// Официальный flow WB (dev.wildberries.ru → Вопросы и отзывы):
//   1. GET /api/v1/new-feedbacks-questions → hasNewFeedbacks
//   2. GET /api/v1/feedbacks?isAnswered=false
//   3. GET /api/v1/feedback?id= (доп. данные)
//   4. OpenAI → текст ответа
//   5. Автопубликация на WB (по умолчанию) или модерация в TG (REVIEW_MODERATION_ENABLED=true)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { filterFeatureActive, recordFeatureRun } from '../_shared/cabinet-features.ts';
import { generateReviewReply } from './live/ai-review-reply.ts';
import { footerPending, footerPublished, moderationKeyboard, upsertModerationPanel, countPendingReviews, REVIEW_BATCH_SIZE, sendReviewCardFromLog, upsertReviewCardFromLog } from './live/review-moderation.ts';
import { getTelegramChatId, getTelegramToken, isTelegramConfigured, telegramConfigError } from './live/telegram-routing.ts';
import { buildReviewText, fetchFeedbackById, fetchUnansweredFeedbacks, feedbackOrderStatus, postFeedbackAnswer, sanitizeWbToken, sleep, toReviewContext } from './live/wb-feedbacks.ts';
import { isServiceAuthorized } from './live/service-auth.ts';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-nr-setup-key'
};
const WB_DELAY_MS = 350;
const TG_DELAY_MS = 700;
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') return new Response('ok', {
    headers: CORS
  });
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const tgToken = getTelegramToken();
  const tgChatId = getTelegramChatId('reviews');
  const body = await req.json().catch(()=>({}));
  const isTest = Boolean(body?.test);
  const force = Boolean(body?.force);
  const autoPublish = body?.auto_publish !== false && (Deno.env.get('REVIEW_MODERATION_ENABLED') ?? 'false').toLowerCase() !== 'true';
  const limit = Math.min(Math.max(Number(body?.limit) || REVIEW_BATCH_SIZE, 1), 15);
  const refreshPending = Boolean(body?.refresh_pending);
  const refreshPanel = Boolean(body?.refresh_panel);
  if (!isServiceAuthorized(req, serviceKey, isTest || force || refreshPending || refreshPanel)) {
    return json({
      error: 'Unauthorized'
    }, 401);
  }
  const admin = createClient(supabaseUrl, serviceKey);
  const started = Date.now();
  if (isTest) {
    if (!isTelegramConfigured('reviews')) {
      return json({
        ok: false,
        error: telegramConfigError('reviews')
      }, 400);
    }
    const sent = await sendTelegramMessage(tgToken, tgChatId, '✅ NR Space · Отзывы WB\n\nFlow: новые отзывы → OpenAI → автопубликация на WB → карточка в TG.', undefined);
    return json({
      ok: sent,
      channel: 'reviews'
    });
  }
  if ((Deno.env.get('REVIEW_AUTO_REPLY_ENABLED') ?? 'true').toLowerCase() === 'false') {
    return json({
      ok: true,
      skipped: 'disabled'
    });
  }
  if (!isTelegramConfigured('reviews')) {
    return json({
      error: telegramConfigError('reviews')
    }, 400);
  }
  const results = [];
  if (refreshPanel) {
    if (!isTelegramConfigured('reviews')) {
      return json({
        error: telegramConfigError('reviews')
      }, 400);
    }
    const panelMsgId = await upsertModerationPanel(admin, tgToken, tgChatId);
    const pending = await countPendingReviews(admin);
    return json({
      ok: Boolean(panelMsgId),
      panel_message_id: panelMsgId,
      pending,
      ms: Date.now() - started
    });
  }
  if (refreshPending) {
    const refreshed = await refreshPendingTelegramCards(admin, tgToken);
    await upsertModerationPanel(admin, tgToken, tgChatId);
    return json({
      ok: true,
      refreshed,
      mode: 'pending',
      ms: Date.now() - started
    });
  }
  try {
    const { data: allCabinets } = await admin.from('cabinets').select('id, name, wb_token').not('wb_token', 'is', null).gt('wb_token', '').eq('nr_managed', true).order('name');
    // Тумблер «Ответы на отзывы»: выключенные и поставленные на паузу кабинеты пропускаем.
    const cabinets = await filterFeatureActive(admin, allCabinets || [], 'reviews');
    const queue = [];
    for (const cab of cabinets || []){
      const token = sanitizeWbToken(cab.wb_token);
      if (token.length < 50) continue;
      try {
        // Всегда тянем неотвеченные — hasNewFeedbacks сбрасывается после просмотра в ЛК WB
        const list = await fetchUnansweredFeedbacks(token, 100);
        if (!list.length && !force) {
          results.push({
            cabinet: cab.name,
            skipped: 'no_unanswered'
          });
          await sleep(WB_DELAY_MS);
          continue;
        }
        for (const fb of list){
          if (!fb?.id) continue;
          const { data: existing } = await admin.from('review_reply_log').select('id, status, tg_message_id').eq('cabinet_id', cab.id).eq('feedback_id', fb.id).limit(1);
          const row = existing?.[0];
          if (row) {
            // WB всё ещё без ответа — переоткрываем «зависшие» записи в логе
            const stale = row.status === 'published' || row.status === 'failed' || row.status === 'rejected' || row.status === 'pending' && !row.tg_message_id;
            if (!stale) continue;
            if (row.status !== 'pending' || !row.tg_message_id) {
              await admin.from('review_reply_log').update({
                status: 'pending',
                sent_to_wb: false,
                sent_to_tg: false,
                tg_message_id: null,
                tg_chat_id: null,
                cabinet_name: cab.name
              }).eq('id', row.id);
            }
            queue.push({
              cab,
              token,
              fb,
              logId: row.id
            });
            continue;
          }
          queue.push({
            cab,
            token,
            fb
          });
        }
      } catch (e) {
        results.push({
          cabinet: cab.name,
          error: String(e).slice(0, 120)
        });
        // Диагностика для настроек кабинета. Успешные ответы видны по review_reply_log.
        await recordFeatureRun(admin, cab.id, 'reviews', 'error', String(e));
      }
      await sleep(WB_DELAY_MS);
    }
    queue.sort((a, b)=>String(a.fb.createdDate || '').localeCompare(String(b.fb.createdDate || '')));
    for (const item of queue.slice(0, limit)){
      let fb = item.fb;
      const detailed = await fetchFeedbackById(item.token, fb.id);
      if (detailed) fb = {
        ...fb,
        ...detailed
      };
      await sleep(WB_DELAY_MS);
      const ctx = toReviewContext(item.cab.name, fb);
      const generated = await generateReviewReply(ctx);
      const reviewText = buildReviewText(fb);
      if (autoPublish) {
        const sentWb = await postFeedbackAnswer(item.token, fb.id, generated.reply);
        const publishedAt = sentWb ? new Date().toISOString() : null;
        const footer = sentWb ? footerPublished(generated.model) : '<i>⚠️ WB не принял ответ</i>';
        const orderStatus = feedbackOrderStatus(fb) ?? null;
        const rowForCard = {
          cabinet_name: item.cab.name,
          rating: ctx.rating,
          buyer_name: ctx.userName,
          product_name: ctx.productName,
          nm_id: ctx.nmId,
          order_status: orderStatus,
          review_text: reviewText,
          reply_text: generated.reply,
          review_created_at: fb.createdDate || null,
          published_at: publishedAt
        };
        await sendReviewCardFromLog(tgToken, tgChatId, rowForCard, footer);
        await admin.from('review_reply_log').insert({
          cabinet_id: item.cab.id,
          cabinet_name: item.cab.name,
          feedback_id: fb.id,
          nm_id: ctx.nmId || null,
          rating: ctx.rating,
          review_text: reviewText,
          reply_text: generated.reply,
          model: generated.model,
          buyer_name: ctx.userName || null,
          product_name: ctx.productName || null,
          review_created_at: fb.createdDate || null,
          order_status: orderStatus,
          status: sentWb ? 'published' : 'failed',
          sent_to_wb: sentWb,
          sent_to_tg: true,
          published_at: sentWb ? new Date().toISOString() : null
        });
        results.push({
          cabinet: item.cab.name,
          feedback_id: fb.id,
          auto_publish: true,
          sent_wb: sentWb
        });
      } else {
        const orderStatus = feedbackOrderStatus(fb) ?? null;
        const logPayload = {
          cabinet_name: item.cab.name,
          nm_id: ctx.nmId || null,
          rating: ctx.rating,
          review_text: reviewText,
          reply_text: generated.reply,
          model: generated.model,
          buyer_name: ctx.userName || null,
          product_name: ctx.productName || null,
          review_created_at: fb.createdDate || null,
          order_status: orderStatus,
          status: 'pending',
          sent_to_wb: false,
          sent_to_tg: false
        };
        let logId = item.logId;
        if (logId) {
          const { error: updErr } = await admin.from('review_reply_log').update(logPayload).eq('id', logId);
          if (updErr) {
            results.push({
              cabinet: item.cab.name,
              error: updErr.message
            });
            continue;
          }
        } else {
          const { data: logRow, error: insErr } = await admin.from('review_reply_log').insert({
            cabinet_id: item.cab.id,
            feedback_id: fb.id,
            ...logPayload
          }).select('id').single();
          if (insErr || !logRow) {
            results.push({
              cabinet: item.cab.name,
              error: insErr?.message || 'insert failed'
            });
            continue;
          }
          logId = logRow.id;
        }
        const rowForCard = {
          cabinet_name: item.cab.name,
          rating: ctx.rating,
          buyer_name: ctx.userName,
          product_name: ctx.productName,
          nm_id: ctx.nmId,
          order_status: orderStatus,
          review_text: reviewText,
          reply_text: generated.reply,
          review_created_at: fb.createdDate || null
        };
        const tgMsgId = await sendReviewCardFromLog(tgToken, tgChatId, rowForCard, footerPending(generated.model), moderationKeyboard(logId));
        if (tgMsgId) {
          await admin.from('review_reply_log').update({
            tg_message_id: tgMsgId,
            tg_chat_id: tgChatId,
            sent_to_tg: true
          }).eq('id', logId);
        }
        results.push({
          cabinet: item.cab.name,
          feedback_id: fb.id,
          log_id: logId,
          moderation: true,
          tg_message_id: tgMsgId,
          reopened: Boolean(item.logId)
        });
      }
      await sleep(TG_DELAY_MS);
    }
    const processed = results.filter((r)=>r.log_id || r.tg_message_id).length;
    if (!autoPublish && processed > 0) {
      await upsertModerationPanel(admin, tgToken, tgChatId, undefined, {
        force: true
      });
    }
    return json({
      ok: true,
      queued: queue.length,
      processed: results.filter((r)=>!r.skipped && !r.error).length,
      auto_publish: autoPublish,
      results,
      ms: Date.now() - started
    });
  } catch (err) {
    console.error('[wb-review-auto-reply]', err);
    return json({
      error: String(err)
    }, 500);
  }
});
async function refreshPendingTelegramCards(admin, tgToken) {
  const { data: rows } = await admin.from('review_reply_log').select('id, tg_message_id, tg_chat_id, model, cabinet_name, review_text, reply_text, rating, nm_id, buyer_name, product_name, review_created_at, order_status, status').eq('status', 'pending').not('tg_message_id', 'is', null);
  let n = 0;
  for (const row of rows || []){
    if (!row.tg_chat_id) continue;
    const chatId = String(row.tg_chat_id);
    const oldMsgId = Number(row.tg_message_id || 0);
    const newMsgId = await upsertReviewCardFromLog(tgToken, chatId, oldMsgId, row, footerPending(String(row.model || 'gpt-4o')), moderationKeyboard(row.id));
    if (!newMsgId) continue;
    if (newMsgId !== oldMsgId) {
      await admin.from('review_reply_log').update({
        tg_message_id: newMsgId,
        tg_chat_id: chatId
      }).eq('id', row.id);
    }
    n++;
    await sleep(350);
  }
  return n;
}
async function editTelegramMessage(token, chatId, messageId, text, replyMarkup) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup ?? undefined
      })
    });
    const data = await res.json();
    return Boolean(data.ok);
  } catch  {
    return false;
  }
}
async function sendTelegramMessage(token, chatId, text, replyMarkup) {
  try {
    const payload = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    };
    if (replyMarkup) payload.reply_markup = replyMarkup;
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    return data?.ok ? data.result?.message_id ?? null : null;
  } catch  {
    return null;
  }
}
function json(d, s = 200) {
  return new Response(JSON.stringify(d), {
    status: s,
    headers: {
      ...CORS,
      'Content-Type': 'application/json'
    }
  });
}

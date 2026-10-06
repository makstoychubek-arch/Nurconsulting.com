// Публикация / отклонение ответа на отзыв (шаг 6–7 официального flow WB).
import { ensureReplyStartsWithName } from './ai-review-reply.ts';
import { renderReviewPhotoBundle, sendTelegramReviewPhoto, upsertTelegramReviewPhoto } from './review-card-image.ts';
import { formatReviewCardFromLog, postFeedbackAnswer } from './wb-feedbacks.ts';
export async function loadReviewLog(admin, logId) {
  const { data: row } = await admin.from('review_reply_log').select('id, cabinet_id, feedback_id, reply_text, status, cabinet_name, buyer_name, product_name, review_text, rating, nm_id, model').eq('id', logId).maybeSingle();
  if (!row) return null;
  const { data: cab } = await admin.from('cabinets').select('wb_token').eq('id', row.cabinet_id).maybeSingle();
  return {
    ...row,
    wb_token: cab?.wb_token
  };
}
/** Шаг 6: отправить на WB после подтверждения в TG */ export async function approveAndPublish(admin, logId, telegramUserId, replyOverride) {
  const row = await loadReviewLog(admin, logId);
  if (!row) return {
    ok: false,
    error: 'Запись не найдена'
  };
  if (row.status === 'published') return {
    ok: false,
    error: 'Уже опубликовано'
  };
  if (row.status === 'rejected') return {
    ok: false,
    error: 'Отклонено ранее'
  };
  let text = ensureReplyStartsWithName((replyOverride || row.reply_text || '').trim(), row.buyer_name || undefined);
  if (text.length < 2 || text.length > 5000) {
    return {
      ok: false,
      error: 'Текст ответа: 2–5000 символов'
    };
  }
  const token = String(row.wb_token || '').replace(/\s+/g, '').trim();
  if (token.length < 50) return {
    ok: false,
    error: 'Нет WB-токена кабинета'
  };
  const sent = await postFeedbackAnswer(token, row.feedback_id, text);
  if (!sent) return {
    ok: false,
    error: 'WB не принял ответ'
  };
  await admin.from('review_reply_log').update({
    status: 'published',
    reply_text: text,
    approved_by: telegramUserId,
    published_at: new Date().toISOString(),
    sent_to_wb: true
  }).eq('id', logId);
  return {
    ok: true
  };
}
export async function rejectReview(admin, logId, telegramUserId) {
  const { data } = await admin.from('review_reply_log').update({
    status: 'rejected',
    approved_by: telegramUserId
  }).eq('id', logId).in('status', [
    'pending',
    'editing'
  ]).select('id');
  return Boolean(data?.length);
}
export async function startEditing(admin, logId) {
  const { data } = await admin.from('review_reply_log').update({
    status: 'editing'
  }).eq('id', logId).eq('status', 'pending').select('id');
  return Boolean(data?.length);
}
export async function applyEditedReply(admin, logId, newText, _telegramUserId) {
  const row = await loadReviewLog(admin, logId);
  const trimmed = ensureReplyStartsWithName(newText.trim(), row?.buyer_name || undefined);
  if (trimmed.length < 2 || trimmed.length > 5000) {
    return {
      ok: false,
      error: 'Текст: 2–5000 символов'
    };
  }
  const { data } = await admin.from('review_reply_log').update({
    reply_text: trimmed,
    status: 'pending'
  }).eq('id', logId).eq('status', 'editing').select('id');
  if (!data?.length) return {
    ok: false,
    error: 'Запись не в режиме правки'
  };
  return {
    ok: true
  };
}
/** Найти запись по reply_to message_id в группе отзывов */ export async function findEditingByMessage(admin, tgChatId, replyToMessageId) {
  const { data } = await admin.from('review_reply_log').select('id, cabinet_id, feedback_id, reply_text, status, cabinet_name').eq('tg_chat_id', tgChatId).eq('tg_message_id', replyToMessageId).eq('status', 'editing').maybeSingle();
  return data;
}
export function buildReviewMessageFromLog(row, footer) {
  return formatReviewCardFromLog(row, footer);
}
export async function sendReviewCardFromLog(token, chatId, row, footer, replyMarkup) {
  const { png, caption } = await renderReviewPhotoBundle(row, footer);
  return sendTelegramReviewPhoto(token, chatId, png, caption, replyMarkup);
}
export async function upsertReviewCardFromLog(token, chatId, messageId, row, footer, replyMarkup) {
  const { png, caption } = await renderReviewPhotoBundle(row, footer);
  return upsertTelegramReviewPhoto(token, chatId, messageId, png, caption, replyMarkup);
}
export async function sendTelegramReviewMessage(token, chatId, text, replyMarkup) {
  try {
    const body = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    };
    if (replyMarkup) body.reply_markup = replyMarkup;
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!data?.ok) {
      console.warn('[review-moderation] sendMessage failed:', data.description ?? data);
    }
    return data?.ok ? data.result?.message_id ?? null : null;
  } catch (e) {
    console.warn('[review-moderation] sendMessage error:', String(e));
    return null;
  }
}
export async function editTelegramReviewMessage(token, chatId, messageId, text, replyMarkup) {
  if (!messageId) return false;
  const edited = await tgApi(token, 'editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: replyMarkup ?? {
      inline_keyboard: []
    }
  });
  return Boolean(edited.ok);
}
/** Редактируем текст на месте, иначе новое сообщение + удаление старого */ export async function upsertTelegramReviewMessage(token, chatId, messageId, text, replyMarkup) {
  const mid = Number(messageId || 0);
  if (mid > 0 && await editTelegramReviewMessage(token, chatId, mid, text, replyMarkup)) {
    return mid;
  }
  const newId = await sendTelegramReviewMessage(token, chatId, text, replyMarkup);
  if (newId && mid > 0) {
    await tgApi(token, 'deleteMessage', {
      chat_id: chatId,
      message_id: mid
    });
  }
  return newId;
}
export function moderationKeyboard(logId) {
  return {
    inline_keyboard: [
      [
        {
          text: '✅',
          callback_data: `rv:ok:${logId}`
        },
        {
          text: '✏️',
          callback_data: `rv:edit:${logId}`
        },
        {
          text: '✕',
          callback_data: `rv:rej:${logId}`
        }
      ]
    ]
  };
}
export function bulkApproveKeyboard(count) {
  return moderationPanelKeyboard(count);
}
export const REVIEW_BATCH_SIZE = 8;
export function moderationPanelText(count) {
  if (count <= 0) {
    return '📋 <b>Модерация</b>\n\nОтзывов 0 · новых на всех кабинетах нет';
  }
  return `📋 <b>Модерация</b> · ${count} ${pluralReviews(count)}`;
}
export function moderationPanelKeyboard(count) {
  const rows = [];
  if (count > 0) {
    rows.push([
      {
        text: `✅ Все (${count})`,
        callback_data: 'rv:okall'
      },
      {
        text: '🔄',
        callback_data: 'rv:next'
      }
    ]);
  } else {
    rows.push([
      {
        text: '🔄',
        callback_data: 'rv:next'
      }
    ]);
  }
  return {
    inline_keyboard: rows
  };
}
async function tgApi(token, method, body) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    return await res.json();
  } catch (e) {
    console.warn(`[review-moderation] tg ${method} error`, String(e));
    return {
      ok: false
    };
  }
}
export async function getModerationPanelMessageId(admin, chatId) {
  const { data: panel } = await admin.from('review_moderation_panel').select('message_id').eq('chat_id', chatId).maybeSingle();
  return panel?.message_id ? Number(panel.message_id) : null;
}
/** Не удалять сообщение панели при пересборке карточек */ export async function isModerationPanelMessage(admin, chatId, messageId) {
  const panelMsgId = await getModerationPanelMessageId(admin, chatId);
  return panelMsgId != null && panelMsgId === messageId;
}
/** Одна панель на чат — редактируем in-place, без delete/send при каждом cron */ export async function upsertModerationPanel(admin, token, chatId, preferMessageId, opts) {
  const count = await countPendingReviews(admin);
  const text = moderationPanelText(count);
  const keyboard = moderationPanelKeyboard(count);
  const { data: panel } = await admin.from('review_moderation_panel').select('message_id, pending_count').eq('chat_id', chatId).maybeSingle();
  const panelMsgId = Number(preferMessageId || panel?.message_id || 0);
  if (!opts?.force && panelMsgId > 0 && panel?.pending_count === count) {
    return panelMsgId;
  }
  if (panelMsgId > 0) {
    const edited = await tgApi(token, 'editMessageText', {
      chat_id: chatId,
      message_id: panelMsgId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: keyboard
    });
    if (edited.ok || tgNotModified(edited)) {
      await admin.from('review_moderation_panel').upsert({
        chat_id: chatId,
        message_id: panelMsgId,
        pending_count: count,
        updated_at: new Date().toISOString()
      });
      return panelMsgId;
    }
    console.warn('[review-moderation] panel edit failed:', edited.description ?? edited);
  }
  const sent = await tgApi(token, 'sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: keyboard
  });
  const msgId = sent.ok ? sent.result?.message_id ?? null : null;
  if (!msgId) {
    console.error('[review-moderation] panel send failed', sent.description ?? sent);
    return panelMsgId > 0 ? panelMsgId : null;
  }
  await admin.from('review_moderation_panel').upsert({
    chat_id: chatId,
    message_id: msgId,
    pending_count: count,
    updated_at: new Date().toISOString()
  });
  return msgId;
}
function tgNotModified(res) {
  return String(res.description ?? '').toLowerCase().includes('message is not modified');
}
/** Опубликовать все pending-отзывы на WB */ export async function approveAllPending(admin, telegramUserId) {
  const { data: rows } = await admin.from('review_reply_log').select('id').eq('status', 'pending').order('id', {
    ascending: true
  });
  const ids = (rows || []).map((r)=>Number(r.id));
  let ok = 0;
  let fail = 0;
  const errors = [];
  const publishedIds = [];
  for (const id of ids){
    const result = await approveAndPublish(admin, id, telegramUserId);
    if (result.ok) {
      ok++;
      publishedIds.push(id);
    } else {
      fail++;
      if (errors.length < 3) errors.push(result.error || '?');
    }
    await sleep(400);
  }
  return {
    ok,
    fail,
    total: ids.length,
    errors,
    publishedIds
  };
}
export async function countPendingReviews(admin) {
  const { count } = await admin.from('review_reply_log').select('id', {
    count: 'exact',
    head: true
  }).eq('status', 'pending');
  return count ?? 0;
}
function sleep(ms) {
  return new Promise((r)=>setTimeout(r, ms));
}
export function footerPending(_model) {
  return '<i>⏳ модерация</i>';
}
export function footerPublished(_model, _approverName) {
  return '<i>✓ опубликован</i>';
}
export function footerRejected(_userName) {
  return '<i>✕ отклонён</i>';
}
export function footerEditing() {
  return '<i>✏️ реплай с текстом ответа</i>';
}
function pluralReviews(n) {
  const m = Math.abs(n) % 100;
  const k = m % 10;
  if (m > 10 && m < 20) return 'отзывов';
  if (k > 1 && k < 5) return 'отзыва';
  if (k === 1) return 'отзыв';
  return 'отзывов';
}

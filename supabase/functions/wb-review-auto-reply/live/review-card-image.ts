// PNG-карточка отзыва для Telegram (стиль как daily-penalties-report).
import { createCanvas } from 'https://deno.land/x/canvas@v1.4.2/mod.ts';
import { formatOrderStatus } from './wb-feedbacks.ts';
import { renderFeedbackPng } from '../../_shared/feedback-card-png.ts';
import { cabinetLegalName } from '../../_shared/wb-restock-reply.ts';
import { resolveWbCardPhotoUrl } from '../../_shared/wb-main-photo.ts';
let fontRegular = null;
let fontBold = null;
const HEADER_H = 72;
async function ensureFonts() {
  if (fontRegular && fontBold) return;
  const base = 'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf';
  const [reg, bold] = await Promise.all([
    fetch(`${base}/DejaVuSans.ttf`).then((r)=>r.arrayBuffer()),
    fetch(`${base}/DejaVuSans-Bold.ttf`).then((r)=>r.arrayBuffer())
  ]);
  fontRegular = new Uint8Array(reg);
  fontBold = new Uint8Array(bold);
}
function stars(n) {
  const r = Math.min(Math.max(n, 0), 5);
  return r > 0 ? '★'.repeat(r) : '—';
}
export function formatReviewDateTime(iso) {
  return formatReviewDateTimeShort(iso);
}
/** 21.07 · 14:30 */ export function formatReviewDateTimeShort(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Bishkek'
    }).replace(',', ' ·');
  } catch  {
    return '';
  }
}
/** Минималистичная подпись под фото: статус · отзыв · ответ */ export function buildReviewPhotoCaption(data, footer, publishedAt) {
  const parts = [];
  const status = data.orderStatusLabel && data.orderStatusLabel !== '—' ? data.orderStatusLabel : '';
  if (status) parts.push(status);
  const reviewWhen = formatReviewDateTimeShort(data.reviewCreatedAt);
  if (reviewWhen) parts.push(`отзыв ${reviewWhen}`);
  const pubWhen = formatReviewDateTimeShort(publishedAt ?? undefined);
  if (pubWhen) {
    parts.push(`ответ ${pubWhen}`);
  } else if (/✕|отклон/i.test(footer)) {
    parts.push('отклонён');
  } else if (/✓|опублик/i.test(footer)) {
    parts.push('опубликован');
  }
  return parts.join(' · ');
}
export function buildReviewCaptionFromLog(row, footer, publishedAt) {
  return buildReviewPhotoCaption(rowToCardData(row), footer, publishedAt);
}
export function rowToCardData(row) {
  return {
    cabinetName: String(row.cabinet_name || 'Кабинет'),
    rating: Number(row.rating) || 0,
    buyerName: row.buyer_name ? String(row.buyer_name) : undefined,
    productName: row.product_name ? String(row.product_name) : undefined,
    nmId: row.nm_id ? Number(row.nm_id) : undefined,
    reviewText: String(row.review_text || ''),
    replyText: String(row.reply_text || ''),
    reviewCreatedAt: row.review_created_at ? String(row.review_created_at) : undefined,
    imtId: row.imt_id ? Number(row.imt_id) : undefined,
    orderStatusLabel: row.order_status ? formatOrderStatus(String(row.order_status)) : undefined
  };
}
export async function renderReviewPhotoBundle(row, footer) {
  const data = rowToCardData(row);
  data.replyAt = row.published_at ? String(row.published_at) : undefined;
  const { png } = await renderReviewCardImage(data);
  // Новый шаблон: у отзыва подписи нет, вся информация на картинке (docs/feedback-card.md).
  return {
    png,
    caption: ''
  };
}
/** Новый шаблон карточки; при любом сбое — прежняя таблица. */ export async function renderReviewCardImage(data) {
  try {
    const photoUrl = data.nmId ? await resolveWbCardPhotoUrl(Number(data.nmId)) : null;
    const png = await renderFeedbackPng({
      kind: 'review',
      cabinetName: cabinetLegalName(data.cabinetName),
      title: data.productName || 'Товар',
      nmId: data.nmId ?? '',
      photoUrl: photoUrl || undefined,
      rating: data.rating,
      buyer: data.buyerName && data.buyerName !== '—' ? data.buyerName : undefined,
      createdStr: formatReviewDateTimeShort(data.reviewCreatedAt),
      tag: data.orderStatusLabel && data.orderStatusLabel !== '—' ? data.orderStatusLabel : undefined,
      text: data.reviewText || '—',
      answer: data.replyText || undefined,
      answerStr: formatReviewDateTimeShort(data.replyAt),
      mode: data.replyText ? 'auto' : 'pending'
    });
    return {
      png
    };
  } catch (e) {
    console.warn('[review-card-image] new template failed, legacy', String(e));
    return renderReviewCardImageLegacy(data);
  }
}
async function renderReviewCardImageLegacy(data) {
  await ensureFonts();
  const S = 2;
  const PAD = 14;
  const LABEL_W = 118;
  const VALUE_W = 432;
  const width = LABEL_W + VALUE_W + PAD * 2;
  const headerH = HEADER_H;
  const tableHeaderH = 40;
  const LINE_H = 18;
  const MIN_ROW_H = 36;
  const tableRows = [
    {
      label: 'Покупатель',
      value: data.buyerName?.trim() || '—'
    },
    {
      label: 'Отзыв',
      value: data.reviewText.trim() || '—',
      maxLines: 5
    },
    {
      label: 'Ответ',
      value: data.replyText.trim() || '—',
      maxLines: 6,
      accent: true
    }
  ];
  // deno-lint-ignore no-explicit-any
  const measureCanvas = createCanvas(10, 10);
  measureCanvas.loadFont(fontRegular, {
    family: 'DejaVu'
  });
  const mctx = measureCanvas.getContext('2d');
  mctx.font = '14px DejaVu';
  const rowLayouts = tableRows.map((r)=>{
    const wrapped = wrapText(mctx, r.value, VALUE_W - 16);
    let lines = wrapped;
    if (r.maxLines && lines.length > r.maxLines) {
      lines = lines.slice(0, r.maxLines);
      lines[lines.length - 1] = fitLine(mctx, `${lines[lines.length - 1]}…`, VALUE_W - 16);
    }
    const height = Math.max(MIN_ROW_H, lines.length * LINE_H + 14);
    return {
      ...r,
      lines,
      height
    };
  });
  const bodyH = rowLayouts.reduce((s, r)=>s + r.height, 0);
  const height = headerH + tableHeaderH + bodyH + PAD * 2;
  const canvas = createCanvas(width * S, height * S);
  canvas.loadFont(fontRegular, {
    family: 'DejaVu'
  });
  canvas.loadFont(fontBold, {
    family: 'DejaVu',
    weight: 'bold'
  });
  const ctx = canvas.getContext('2d');
  ctx.scale(S, S);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  const textX = PAD;
  const textMaxW = width - PAD * 2;
  const headerLine = [
    data.cabinetName,
    stars(data.rating)
  ].filter(Boolean).join(' · ');
  ctx.fillStyle = '#1a1a1a';
  ctx.font = 'bold 19px DejaVu';
  ctx.textBaseline = 'top';
  ctx.fillText(fitLine(ctx, headerLine, textMaxW), textX, PAD + 8);
  const when = formatReviewDateTimeShort(data.reviewCreatedAt);
  const metaLine = [
    when,
    data.orderStatusLabel && data.orderStatusLabel !== '—' ? data.orderStatusLabel : ''
  ].filter(Boolean).join(' · ');
  if (metaLine) {
    ctx.fillStyle = '#5a6a7a';
    ctx.font = '13px DejaVu';
    ctx.fillText(metaLine, textX, PAD + 32);
  }
  const productLine = [
    data.productName?.trim(),
    data.nmId ? String(data.nmId) : ''
  ].filter(Boolean).join(' · ');
  if (productLine) {
    ctx.fillStyle = '#1e4a7a';
    ctx.font = '12px DejaVu';
    ctx.fillText(fitLine(ctx, productLine, textMaxW), textX, PAD + 50);
  }
  ctx.strokeStyle = '#dce8f5';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, PAD + headerH - 4);
  ctx.lineTo(width - PAD, PAD + headerH - 4);
  ctx.stroke();
  const tableTop = PAD + headerH;
  const tableW = width - PAD * 2;
  const valueX = PAD + LABEL_W;
  ctx.fillStyle = '#dce8f5';
  ctx.fillRect(PAD, tableTop, tableW, tableHeaderH);
  ctx.fillStyle = '#0f2d4a';
  ctx.font = 'bold 13px DejaVu';
  ctx.textBaseline = 'middle';
  drawCell(ctx, 'Поле', PAD + 8, tableTop + tableHeaderH / 2, LABEL_W, 'left');
  drawCell(ctx, 'Значение', valueX + 8, tableTop + tableHeaderH / 2, VALUE_W, 'left');
  let y = tableTop + tableHeaderH;
  rowLayouts.forEach((row, ri)=>{
    if (ri % 2 === 1) {
      ctx.fillStyle = '#f4f8fc';
      ctx.fillRect(PAD, y, tableW, row.height);
    }
    ctx.strokeStyle = '#c5d8ea';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(PAD + tableW, y);
    ctx.stroke();
    ctx.fillStyle = '#0f2d4a';
    ctx.font = 'bold 12px DejaVu';
    ctx.textBaseline = 'top';
    ctx.fillText(row.label, PAD + 8, y + 9);
    ctx.fillStyle = row.accent ? '#1e4a7a' : '#222222';
    ctx.font = row.accent ? 'bold 12px DejaVu' : '12px DejaVu';
    row.lines.forEach((line, li)=>{
      ctx.fillText(line, valueX + 8, y + 9 + li * LINE_H);
    });
    y += row.height;
  });
  ctx.strokeStyle = '#a8c4de';
  ctx.beginPath();
  ctx.moveTo(valueX, tableTop);
  ctx.lineTo(valueX, y);
  ctx.stroke();
  ctx.strokeRect(PAD, tableTop, tableW, y - tableTop);
  return {
    png: canvas.toBuffer('image/png')
  };
}
function pngBlob(png) {
  const copy = new Uint8Array(png.byteLength);
  copy.set(png);
  return new Blob([
    copy
  ], {
    type: 'image/png'
  });
}
export async function sendTelegramReviewPhoto(token, chatId, png, caption, replyMarkup) {
  try {
    const form = new FormData();
    form.append('chat_id', chatId);
    if (caption.trim()) {
      form.append('caption', caption);
      form.append('parse_mode', 'HTML');
    }
    form.append('photo', pngBlob(png), 'review.png');
    if (replyMarkup) form.append('reply_markup', JSON.stringify(replyMarkup));
    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      body: form
    });
    const data = await res.json();
    if (!data?.ok) {
      console.warn('[review-card-image] sendPhoto failed:', data.description ?? data, 'pngBytes:', png.byteLength);
    } else {
      console.log('[review-card-image] sendPhoto ok', {
        messageId: data.result?.message_id,
        pngBytes: png.byteLength
      });
    }
    return data?.ok ? data.result?.message_id ?? null : null;
  } catch (e) {
    console.warn('[review-card-image] sendPhoto error:', String(e));
    return null;
  }
}
/** Обновить фото на месте — без нового сообщения в ленте */ export async function editTelegramReviewPhoto(token, chatId, messageId, png, caption, replyMarkup) {
  if (!messageId) return false;
  try {
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('message_id', String(messageId));
    form.append('media', JSON.stringify({
      type: 'photo',
      media: 'attach://photo'
    }));
    if (caption.trim()) {
      form.append('caption', caption);
      form.append('parse_mode', 'HTML');
    }
    form.append('photo', pngBlob(png), 'review.png');
    if (replyMarkup) form.append('reply_markup', JSON.stringify(replyMarkup));
    const res = await fetch(`https://api.telegram.org/bot${token}/editMessageMedia`, {
      method: 'POST',
      body: form
    });
    const data = await res.json();
    if (!data?.ok) {
      console.warn('[review-card-image] editMessageMedia failed:', data.description ?? data);
    }
    return Boolean(data.ok);
  } catch (e) {
    console.warn('[review-card-image] editMessageMedia error:', String(e));
    return false;
  }
}
/** Сначала editMessageMedia, иначе sendPhoto + delete старого. forceResend — всегда новое сообщение */ export async function upsertTelegramReviewPhoto(token, chatId, messageId, png, caption, replyMarkup, forceResend = false) {
  const mid = Number(messageId || 0);
  if (!forceResend && mid > 0 && await editTelegramReviewPhoto(token, chatId, mid, png, caption, replyMarkup)) {
    return mid;
  }
  const newId = await sendTelegramReviewPhoto(token, chatId, png, caption, replyMarkup);
  if (newId && mid > 0) {
    await deleteTelegramMessage(token, chatId, mid);
  }
  return newId;
}
export async function editTelegramReviewCaption(token, chatId, messageId, caption, replyMarkup) {
  if (!messageId) return false;
  try {
    const body = {
      chat_id: chatId,
      message_id: messageId
    };
    if (caption.trim()) {
      body.caption = caption;
      body.parse_mode = 'HTML';
    }
    body.reply_markup = replyMarkup ?? {
      inline_keyboard: []
    };
    const res = await fetch(`https://api.telegram.org/bot${token}/editMessageCaption`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    return Boolean(data.ok);
  } catch  {
    return false;
  }
}
export async function deleteTelegramMessage(token, chatId, messageId) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId
      })
    });
  } catch  {}
}
// deno-lint-ignore no-explicit-any
function drawCell(ctx, text, x, y, w, align) {
  ctx.textBaseline = 'middle';
  if (align === 'center') {
    const tw = ctx.measureText(text).width;
    ctx.fillText(text, x + (w - tw) / 2, y);
  } else {
    ctx.fillText(text, x, y);
  }
}
// deno-lint-ignore no-explicit-any
function fitLine(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while(s.length > 1 && ctx.measureText(`${s}…`).width > maxW)s = s.slice(0, -1);
  return `${s}…`;
}
// deno-lint-ignore no-explicit-any
function wrapText(ctx, text, maxW) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [
    '—'
  ];
  const words = normalized.split(' ');
  const lines = [];
  let line = '';
  for (const word of words){
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxW) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

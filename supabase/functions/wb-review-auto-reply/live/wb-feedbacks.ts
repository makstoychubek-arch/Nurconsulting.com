// WB Feedbacks API — общие методы (официальный flow dev.wildberries.ru).
export const FEEDBACKS_API = 'https://feedbacks-api.wildberries.ru';
/** Шаг 1: есть ли новые непросмотренные отзывы */ export async function checkHasNewFeedbacks(token) {
  const res = await wbGet(`${FEEDBACKS_API}/api/v1/new-feedbacks-questions`, token);
  if (!res.ok) return false;
  const data = await res.json();
  return Boolean(data?.data?.hasNewFeedbacks);
}
/** Шаг 2: список неотвеченных */ export async function fetchUnansweredFeedbacks(token, take = 100) {
  const url = `${FEEDBACKS_API}/api/v1/feedbacks?isAnswered=false&take=${take}&skip=0&order=dateAsc`;
  const res = await wbGet(url, token);
  const text = await res.text();
  if (res.status === 401 || res.status === 403) {
    throw new Error(`нет доступа к отзывам (${res.status}) — scope «Отзывы и вопросы»`);
  }
  if (!res.ok) throw new Error(`feedbacks ${res.status}: ${text.slice(0, 150)}`);
  const data = JSON.parse(text);
  return data?.data?.feedbacks || [];
}
/** Шаг 3: детали одного отзыва */ export async function fetchFeedbackById(token, id) {
  const url = `${FEEDBACKS_API}/api/v1/feedback?id=${encodeURIComponent(id)}`;
  const res = await wbGet(url, token);
  if (!res.ok) return null;
  const data = await res.json();
  return data?.data || null;
}
/** Шаг 6: публикация ответа (2–5000 символов) */ export async function postFeedbackAnswer(token, id, text) {
  const body = text.trim();
  if (body.length < 2 || body.length > 5000) return false;
  const res = await wbPost(`${FEEDBACKS_API}/api/v1/feedbacks/answer`, token, {
    id,
    text: body
  });
  return res.ok || res.status === 204;
}
export function buildReviewText(fb) {
  const tagLine = Array.isArray(fb.bables) && fb.bables.length ? `+ ${fb.bables.filter(Boolean).join(', ')}` : '';
  const parts = [
    fb.text?.trim(),
    fb.pros?.trim() ? `+ ${fb.pros.trim()}` : '',
    fb.cons?.trim() ? `− ${fb.cons.trim()}` : '',
    tagLine
  ].filter(Boolean);
  if (parts.length) return parts.join('\n');
  const rating = Number(fb.productValuation) || 0;
  return rating > 0 ? `— (только оценка ${rating}★)` : '—';
}
/** buyout = выкуп, returned/cancel = отказ */ export function formatOrderStatus(status) {
  if (!status?.trim()) return '—';
  const s = status.trim().toLowerCase();
  if (s === 'buyout') return 'Выкуп';
  if (s === 'returned' || s === 'cancel' || s === 'cancelled' || s === 'refusal' || s === 'reject' || s === 'rejected') {
    return 'Отказ';
  }
  return status;
}
export function feedbackOrderStatus(fb) {
  const s = fb.orderStatus?.trim();
  return s || undefined;
}
/** Компактная карточка отзыва — минимум строк, удобно на мобиле */ export function formatReviewCardHtml(input) {
  const stars = input.rating > 0 ? '★'.repeat(Math.min(input.rating, 5)) : '—';
  const cab = esc(input.cabinetName);
  const date = input.date ? ` · ${esc(input.date)}` : '';
  const status = input.orderStatus && input.orderStatus !== '—' ? ` · ${esc(input.orderStatus)}` : '';
  const lines = [
    `<b>${cab}</b> · ${stars}${status}${date}`
  ];
  const productBits = [];
  if (input.productName) productBits.push(esc(trunc(input.productName, 42)));
  if (input.nmId) productBits.push(`<code>${input.nmId}</code>`);
  if (productBits.length) lines.push(productBits.join(' · '));
  lines.push(`<b>${input.buyerName ? esc(input.buyerName) : 'Покупатель'}</b>`);
  const review = input.reviewText.trim();
  if (review) lines.push('', `<i>${esc(review)}</i>`);
  const reply = input.replyText.trim();
  if (reply) lines.push('', `<b>→</b> ${esc(reply)}`);
  if (input.footer) lines.push('', input.footer);
  return lines.join('\n');
}
export function formatReviewTelegramHtml(cabinetName, fb, reply, footer) {
  return formatReviewCardHtml({
    cabinetName,
    rating: Number(fb.productValuation) || 0,
    productName: String(fb.productDetails?.productName || '').trim() || undefined,
    nmId: fb.productDetails?.nmId ? Number(fb.productDetails.nmId) : undefined,
    buyerName: fb.userName?.trim() || undefined,
    date: formatReviewDateShort(fb.createdDate),
    reviewText: buildReviewText(fb),
    replyText: reply,
    footer
  });
}
function formatReviewDateShort(iso) {
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
    return iso.split('T')[0] || '';
  }
}
export function formatReviewCardFromLog(row, footer) {
  const orderStatus = row.order_status ? formatOrderStatus(String(row.order_status)) : undefined;
  const date = row.review_created_at ? formatReviewDateShort(String(row.review_created_at)) : undefined;
  return formatReviewCardHtml({
    cabinetName: String(row.cabinet_name || 'Кабинет'),
    rating: Number(row.rating) || 0,
    productName: row.product_name ? String(row.product_name) : undefined,
    nmId: row.nm_id ? Number(row.nm_id) : undefined,
    buyerName: row.buyer_name ? String(row.buyer_name) : undefined,
    orderStatus,
    date,
    reviewText: String(row.review_text || ''),
    replyText: String(row.reply_text || ''),
    footer
  });
}
function trunc(s, max) {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}
function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
async function wbGet(url, token) {
  const c = new AbortController();
  const t = setTimeout(()=>c.abort(), 20000);
  try {
    return await fetch(url, {
      headers: {
        Authorization: token
      },
      signal: c.signal
    });
  } finally{
    clearTimeout(t);
  }
}
async function wbPost(url, token, body) {
  const c = new AbortController();
  const t = setTimeout(()=>c.abort(), 15000);
  try {
    return await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: c.signal
    });
  } finally{
    clearTimeout(t);
  }
}
export function sleep(ms) {
  return new Promise((r)=>setTimeout(r, ms));
}
export function sanitizeWbToken(raw) {
  if (typeof raw !== 'string') return '';
  return raw.replace(/^\uFEFF/, '').replace(/\s+/g, '').trim();
}
export function feedbackImtId(fb) {
  const v = fb.imtId ?? fb.productDetails?.imtId;
  const n = Number(v);
  return n > 0 ? n : undefined;
}
export function toReviewContext(cabinetName, fb) {
  return {
    cabinetName,
    productName: String(fb.productDetails?.productName || 'Товар'),
    nmId: Number(fb.productDetails?.nmId) || 0,
    brandName: fb.productDetails?.brandName,
    rating: Number(fb.productValuation) || 5,
    text: String(fb.text || '').trim(),
    pros: String(fb.pros || '').trim() || (Array.isArray(fb.bables) && fb.bables.length ? fb.bables.join(', ') : undefined),
    cons: String(fb.cons || '').trim() || undefined,
    userName: String(fb.userName || '').trim() || undefined,
    orderStatus: feedbackOrderStatus(fb) ? formatOrderStatus(feedbackOrderStatus(fb)) : undefined
  };
}

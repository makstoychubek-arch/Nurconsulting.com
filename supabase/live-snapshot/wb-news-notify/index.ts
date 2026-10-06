// СНИМОК боевой функции «wb-news-notify» (версия 34), снят 2026-10-06.
// Это скомпилированный код из Supabase, не исходник для деплоя. Зашитые ключи вырезаны.
// Supabase Edge Function: wb-news-notify
// Новости портала продавца WB → Telegram-группа «Новости» (TELEGRAM_CHAT_NEWS).
// GET https://common-api.wildberries.ru/api/communications/v2/news
//
// Auth: service_role only (pg_cron / ручной вызов).
// Тело: { "test": true } — тест в группу новостей
//       { "bootstrap_send": true } — при первом запуске отправить последние 3 новости
//       { "backfill_from": "2026-07-17", "backfill_to": "2026-07-21", "force": true }
//         — отправить новости за период по очереди (для ручного прогона)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getTelegramChatId, getTelegramToken, isTelegramConfigured, telegramConfigError } from '../_shared/telegram-routing.ts';
import { summarizeForTelegram } from '../_shared/ai-summarize.ts';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-nr-setup-key'
};
const WB_NEWS_API = 'https://common-api.wildberries.ru/api/communications/v2/news';
const MAX_TG_TEXT = 3900;
// Краткое резюме для TG — не просто обрезка, а суть новости
const NEWS_SUMMARY_MAX = 380;
const NEWS_BULLETS_MAX = 4;
const NEWS_SENTENCES_MAX = 3;
const TG_SEND_DELAY_MS = 1500;
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') return new Response('ok', {
    headers: CORS
  });
  const started = Date.now();
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const tgToken = getTelegramToken();
  const tgChatId = getTelegramChatId('news');
  const body = await req.json().catch(()=>({}));
  const allowSetup = Boolean(body?.test || body?.backfill_from || body?.bootstrap_send);
  if (!isServiceAuthorized(req, serviceKey, allowSetup)) {
    return json({
      error: 'Unauthorized',
      hint: 'service_role (cron) или X-NR-Setup-Key для test/backfill'
    }, 401);
  }
  if (body?.test) {
    if (!isTelegramConfigured('news')) {
      return json({
        ok: false,
        error: telegramConfigError('news')
      }, 400);
    }
    const text = '✅ Тест NR Space · канал «Новости WB»\nСюда будут приходить новости портала продавца Wildberries.';
    const sent = await sendTelegramMessage(tgToken, tgChatId, text);
    return json({
      ok: sent,
      sent,
      channel: 'news',
      chatId: tgChatId
    });
  }
  if (!isTelegramConfigured('news')) {
    return json({
      error: telegramConfigError('news')
    }, 400);
  }
  const admin = createClient(supabaseUrl, serviceKey);
  try {
    const { data: cabinets, error: cabErr } = await admin.from('cabinets').select('id, name, wb_token').not('wb_token', 'is', null).gt('wb_token', '').eq('nr_managed', true).order('name');
    if (cabErr) throw new Error(`cabinets: ${cabErr.message}`);
    const token = pickWbToken(cabinets || []);
    if (!token) {
      return json({
        ok: false,
        error: 'Нет кабинета с валидным WB-токеном для запроса новостей'
      }, 400);
    }
    const backfillFrom = typeof body?.backfill_from === 'string' ? body.backfill_from : '';
    if (backfillFrom && /^\d{4}-\d{2}-\d{2}$/.test(backfillFrom)) {
      const backfillTo = typeof body?.backfill_to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.backfill_to) ? body.backfill_to : todayBishkek();
      const force = Boolean(body?.force);
      const allNews = await fetchWbNews(token, {
        from: backfillFrom
      });
      const newsItems = allNews.filter((item)=>newsInRange(item, backfillFrom, backfillTo)).sort((a, b)=>a.id - b.id);
      const result = await sendNewsBatch(admin, tgToken, tgChatId, newsItems, {
        force,
        updateState: true
      });
      return json({
        ok: true,
        mode: 'backfill',
        from: backfillFrom,
        to: backfillTo,
        fetched: allNews.length,
        matched: newsItems.length,
        ...result,
        ms: Date.now() - started
      });
    }
    const { data: stateRow } = await admin.from('wb_news_state').select('last_news_id').eq('id', 1).maybeSingle();
    let lastNewsId = Number(stateRow?.last_news_id) || 0;
    const isFirstRun = lastNewsId === 0;
    let newsItems;
    if (isFirstRun) {
      const fromDate = daysAgoIso(14);
      newsItems = await fetchWbNews(token, {
        from: fromDate
      });
      if (!newsItems.length) {
        return json({
          ok: true,
          initialized: true,
          sent: 0,
          message: 'Новостей не найдено, состояние не изменено'
        });
      }
      // Первый запуск: последние 3 новости, дальше — только новые по fromID
      newsItems = newsItems.slice(-3);
    } else {
      newsItems = await fetchWbNews(token, {
        fromID: lastNewsId + 1
      });
    }
    newsItems.sort((a, b)=>a.id - b.id);
    const result = await sendNewsBatch(admin, tgToken, tgChatId, newsItems, {
      force: false,
      updateState: true,
      initialLastId: lastNewsId
    });
    return json({
      ok: true,
      fetched: newsItems.length,
      ...result,
      ms: Date.now() - started
    });
  } catch (err) {
    console.error('[wb-news-notify] fatal:', err);
    return json({
      error: String(err)
    }, 500);
  }
});
async function sendNewsBatch(admin, tgToken, tgChatId, newsItems, opts) {
  let lastNewsId = opts.initialLastId ?? 0;
  const sentIds = [];
  const skippedIds = [];
  for(let i = 0; i < newsItems.length; i++){
    const item = newsItems[i];
    if (!opts.force) {
      const { data: dupes } = await admin.from('wb_news_sent').select('news_id').eq('news_id', item.id).limit(1);
      if (dupes?.length) {
        skippedIds.push(item.id);
        if (item.id > lastNewsId) lastNewsId = item.id;
        continue;
      }
    }
    const text = await formatNewsMessage(item);
    const sent = await sendTelegramMessage(tgToken, tgChatId, text);
    if (sent) {
      await admin.from('wb_news_sent').upsert({
        news_id: item.id,
        title: item.title.slice(0, 500),
        sent_at: new Date().toISOString()
      }, {
        onConflict: 'news_id'
      });
      sentIds.push(item.id);
    }
    if (item.id > lastNewsId) lastNewsId = item.id;
    if (opts.updateState && lastNewsId > (opts.initialLastId ?? 0)) {
      await admin.from('wb_news_state').upsert({
        id: 1,
        last_news_id: lastNewsId,
        last_checked_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      });
    }
    if (i < newsItems.length - 1) await sleep(TG_SEND_DELAY_MS);
  }
  return {
    sent: sentIds.length,
    sent_ids: sentIds,
    skipped_ids: skippedIds,
    last_news_id: lastNewsId
  };
}
function newsInRange(item, from, to) {
  const d = newsDateIso(item);
  if (!d) return true;
  return d >= from && d <= to;
}
function newsDateIso(item) {
  const raw = item.date;
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const d = new Date(raw);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-CA', {
    timeZone: 'Asia/Bishkek'
  });
}
function todayBishkek() {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: 'Asia/Bishkek'
  });
}
function sleep(ms) {
  return new Promise((r)=>setTimeout(r, ms));
}
async function fetchWbNews(token, params) {
  const qs = params.fromID != null ? `fromID=${params.fromID}` : `from=${encodeURIComponent(params.from || daysAgoIso(7))}`;
  const res = await fetchWithTimeout(`${WB_NEWS_API}?${qs}`, {
    headers: {
      Authorization: token
    }
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`WB news API ${res.status}: ${text.slice(0, 300)}`);
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch  {
    throw new Error('WB news API: invalid JSON');
  }
  return normalizeNewsList(data);
}
function normalizeNewsList(data) {
  const rawList = extractNewsArray(data);
  const out = [];
  for (const raw of rawList){
    if (!raw || typeof raw !== 'object') continue;
    const r = raw;
    const id = Number(r.id ?? r.newsId ?? r.newsID ?? 0);
    if (!id) continue;
    const title = String(r.header ?? r.title ?? r.name ?? r.subject ?? 'Новость WB').trim();
    const body = stripHtml(String(r.content ?? r.text ?? r.body ?? r.description ?? r.message ?? '')).trim();
    const dateRaw = String(r.date ?? r.createdAt ?? r.publishDate ?? r.publishedAt ?? '');
    out.push({
      id,
      title,
      body,
      date: dateRaw
    });
  }
  return out;
}
function extractNewsArray(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  const obj = data;
  for (const key of [
    'data',
    'news',
    'items',
    'result'
  ]){
    const val = obj[key];
    if (Array.isArray(val)) return val;
  }
  return [];
}
async function formatNewsMessage(item) {
  const lines = [];
  const dateLabel = item.date ? formatNewsDate(item.date) : '';
  lines.push(dateLabel ? `📰 WB · ${dateLabel}` : '📰 WB');
  lines.push('');
  lines.push(`<b>${escapeHtml(item.title)}</b>`);
  if (item.body) {
    const ai = await summarizeForTelegram({
      title: item.title,
      body: item.body,
      maxChars: NEWS_SUMMARY_MAX
    });
    let summary = ai.summary;
    let truncated = false;
    if (!summary) {
      const heuristic = summarizeNewsBody(item.body);
      summary = heuristic.summary;
      truncated = heuristic.truncated;
      if (heuristic.highlights.length) {
        lines.push('');
        for (const h of heuristic.highlights)lines.push(`📌 ${escapeHtml(h)}`);
      }
    } else {
      truncated = item.body.replace(/\s+/g, ' ').trim().length > summary.length + 40;
    }
    if (summary) {
      lines.push('');
      lines.push(escapeHtml(summary));
    }
    if (truncated) {
      lines.push('');
      lines.push('<i>Полный текст — в ЛК WB → Новости</i>');
    }
  }
  let text = lines.join('\n');
  if (text.length > MAX_TG_TEXT) text = truncateAtWord(text, MAX_TG_TEXT - 2);
  return text;
}
/** Сжимает длинную новость: даты/сроки + пункты списка или первые осмысленные фразы. */ function summarizeNewsBody(body) {
  const clean = body.replace(/\r/g, '').trim();
  if (!clean) return {
    summary: '',
    truncated: false,
    highlights: []
  };
  const flat = clean.replace(/\n{2,}/g, '\n').replace(/[ \t]+/g, ' ').trim();
  if (flat.length <= NEWS_SUMMARY_MAX) {
    return {
      summary: flat,
      truncated: false,
      highlights: extractHighlights(flat)
    };
  }
  const highlights = extractHighlights(flat);
  const bulletSummary = summarizeFromBullets(clean);
  if (bulletSummary) {
    const truncated = flat.length > bulletSummary.length || countBulletLines(clean) > NEWS_BULLETS_MAX;
    return {
      summary: bulletSummary,
      truncated,
      highlights
    };
  }
  const sentences = splitSentences(flat).filter((s)=>!isBoilerplate(s));
  const pool = sentences.length ? sentences : splitSentences(flat);
  let summary = '';
  let used = 0;
  for (const s of pool){
    if (used >= NEWS_SENTENCES_MAX) break;
    const next = summary ? `${summary} ${s}` : s;
    if (next.length > NEWS_SUMMARY_MAX && summary) break;
    summary = next;
    used++;
  }
  if (!summary) summary = truncateAtWord(flat, NEWS_SUMMARY_MAX);
  else if (summary.length > NEWS_SUMMARY_MAX) summary = truncateAtWord(summary, NEWS_SUMMARY_MAX);
  return {
    summary,
    truncated: flat.length > summary.length,
    highlights
  };
}
function summarizeFromBullets(body) {
  const lines = body.split('\n').map((l)=>l.trim()).filter(Boolean);
  const bullets = lines.filter((l)=>/^[-•*–—]\s+/.test(l) || /^\d+[.)]\s+/.test(l));
  if (bullets.length < 2) return null;
  const picked = bullets.slice(0, NEWS_BULLETS_MAX).map((b)=>{
    const t = b.replace(/^[-•*–—]\s+/, '').replace(/^\d+[.)]\s+/, '').trim();
    return `• ${t}`;
  });
  let out = picked.join('\n');
  if (out.length > NEWS_SUMMARY_MAX) {
    out = picked.map((b)=>truncateAtWord(b, Math.floor(NEWS_SUMMARY_MAX / NEWS_BULLETS_MAX) - 2)).join('\n');
  }
  return out;
}
function countBulletLines(body) {
  return body.split('\n').filter((l)=>/^[-•*–—]\s+/.test(l.trim()) || /^\d+[.)]\s+/.test(l.trim())).length;
}
function splitSentences(text) {
  return text.split(/(?<=[.!?…])\s+|\n+/).map((s)=>s.trim()).filter((s)=>s.length > 8);
}
function isBoilerplate(s) {
  const t = s.toLowerCase();
  return /^(уважаемые|добрый день|здравствуйте|коллеги|дорогие партнёры)/.test(t) || t.length < 25;
}
/** Вытаскиваем сроки и даты — самое важное в новостях WB. */ function extractHighlights(text) {
  const found = [];
  const patterns = [
    /\b(?:до|с|по)\s+\d{1,2}[.\-/]\d{1,2}(?:[.\-/]\d{2,4})?/gi,
    /\b\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}\b/g,
    /\b(?:до|с)\s+\d{1,2}\s+(?:январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр)\w*/gi
  ];
  for (const re of patterns){
    const m = text.match(re);
    if (m) {
      for (const raw of m.slice(0, 2)){
        const norm = raw.replace(/\s+/g, ' ').trim();
        if (norm.length >= 5 && norm.length <= 40 && !found.includes(norm)) found.push(norm);
      }
    }
  }
  return found.slice(0, 2);
}
function truncateAtWord(s, max) {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return base.trimEnd() + '…';
}
function formatNewsDate(raw) {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw.slice(0, 16);
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bishkek'
  });
}
function pickWbToken(cabinets) {
  for (const c of cabinets){
    const t = sanitizeWbToken(c.wb_token);
    if (t && isValidWbToken(t)) return t;
  }
  return '';
}
function sanitizeWbToken(raw) {
  if (typeof raw !== 'string') return '';
  return raw.replace(/^\uFEFF/, '').replace(/\s+/g, '').trim();
}
function isValidWbToken(token) {
  return token.length > 50 && /^[\x21-\x7E]+$/.test(token);
}
function stripHtml(s) {
  return s.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\n{3,}/g, '\n\n').trim();
}
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function daysAgoIso(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
async function sendTelegramMessage(token, chatId, text) {
  try {
    const res = await fetchWithTimeout(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });
    if (!res.ok) {
      console.warn('[wb-news-notify] telegram failed:', res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[wb-news-notify] telegram error:', String(e));
    return false;
  }
}
async function fetchWithTimeout(url, init = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } finally{
    clearTimeout(timer);
  }
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS,
      'Content-Type': 'application/json'
    }
  });
}

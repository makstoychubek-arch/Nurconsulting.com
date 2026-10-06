// СНИМОК боевой функции «warehouse-watch» (версия 29), снят 2026-10-06.
// Это скомпилированный код из Supabase, не исходник для деплоя. Зашитые ключи вырезаны.
// Склад: платное хранение (топ-10 PNG) + аномалии возвратов → Telegram «Склад».
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createCanvas } from 'https://deno.land/x/canvas@v1.4.2/mod.ts';
import { fetchGoodsReturns } from '../_shared/wb-analytics-api.ts';
import { CABINET_TOKEN_SELECT, isValidWbToken, pickCabinetToken } from '../_shared/wb-cabinet-tokens.ts';
import { getTelegramChatId, getTelegramToken, isTelegramConfigured, telegramConfigError } from '../_shared/telegram-routing.ts';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-nr-setup-key'
};
const RETURN_ANOMALY_PCT = Number(Deno.env.get('RETURN_ANOMALY_PCT')) || 50;
const RETURN_BASELINE_DAYS = Number(Deno.env.get('RETURN_BASELINE_DAYS')) || 7;
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') return new Response('ok', {
    headers: CORS
  });
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const body = await req.json().catch(()=>({}));
  const reportDate = typeof body?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : yesterdayBishkek();
  if (!isServiceAuthorized(req, serviceKey, Boolean(body?.force))) {
    return json({
      error: 'Unauthorized'
    }, 401);
  }
  if (!isTelegramConfigured('warehouse')) {
    return json({
      error: telegramConfigError('warehouse')
    }, 400);
  }
  const tgToken = getTelegramToken();
  const tgChatId = getTelegramChatId('warehouse');
  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey);
  const results = [];
  const onlyCabinets = Array.isArray(body?.cabinets) ? body.cabinets.map(String) : null;
  const { data: cabinets } = await admin.from('cabinets').select(CABINET_TOKEN_SELECT).not('wb_token', 'is', null).gt('wb_token', '').eq('nr_managed', true);
  for (const cab of cabinets || []){
    if (onlyCabinets && !onlyCabinets.includes(cab.name)) continue;
    const cabResult = {
      cabinet: cab.name
    };
    try {
      const token = pickCabinetToken(cab, 'analytics');
      if (!isValidWbToken(token)) {
        cabResult.skipped = 'invalid_token';
        results.push(cabResult);
        continue;
      }
      const eventType = `warehouse_daily_${reportDate}`;
      const { data: dupes } = await admin.from('notification_log').select('id').eq('cabinet_id', cab.id).eq('event_type', eventType).limit(1);
      if (dupes?.length && !body?.force) {
        cabResult.skipped = 'already_sent';
        results.push(cabResult);
        continue;
      }
      const baselineFrom = daysBefore(reportDate, RETURN_BASELINE_DAYS + 1);
      const baselineTo = daysBefore(reportDate, 1);
      const baselineReturns = await fetchGoodsReturns(token, baselineFrom, baselineTo);
      const todayReturns = await fetchGoodsReturns(token, reportDate, reportDate);
      const baselineAvg = baselineReturns.length / RETURN_BASELINE_DAYS;
      const returnAnomaly = baselineAvg > 0 && todayReturns.length >= baselineAvg * (1 + RETURN_ANOMALY_PCT / 100);
      const storageFrom = daysBefore(reportDate, 7);
      let storageRows = [];
      let storageTotal = null;
      let storageError;
      if (!body?.skip_storage) {
        const cached = await loadStorageCache(admin, cab.id, storageFrom, reportDate);
        if (cached) {
          storageRows = cached.rows;
          storageTotal = cached.total;
        } else {
          storageError = 'нет prefetch (warehouse-storage-fetch)';
        }
      }
      const top10 = aggregateStorageTop10(storageRows);
      const totalStorage = storageTotal ?? storageRows.reduce((s, r)=>s + r.warehousePrice, 0);
      const pretty = prettyDate(reportDate);
      const fmt = (n)=>Math.round(n).toLocaleString('ru-RU').replace(/\u00A0/g, ' ');
      let caption = [
        `📦 <b>${esc(cab.name)}</b> — склад за ${pretty}`,
        `Хранение (7 дн.): <b>${fmt(totalStorage)} ₽</b>`,
        `Возвраты сегодня: <b>${todayReturns.length}</b> (ср. ${baselineAvg.toFixed(1)}/день)`
      ].join('\n');
      if (returnAnomaly) {
        caption += `\n\n⚠️ <b>Аномалия возвратов</b>: +${Math.round((todayReturns.length / baselineAvg - 1) * 100)}% к среднему`;
      }
      if (storageError) {
        caption += `\n\n<i>Хранение: ${esc(storageError)}</i>`;
      }
      if (top10.length) {
        const png = await renderStorageImage(cab.name, reportDate, top10, totalStorage);
        const tgErr = await sendTelegramPhoto(tgToken, tgChatId, png, caption);
        if (tgErr) throw new Error(tgErr);
      } else {
        const tgErr = await sendTelegramMessage(tgToken, tgChatId, caption + '\n\n<i>Нет данных по хранению за период</i>');
        if (tgErr) throw new Error(tgErr);
      }
      await admin.from('notification_log').insert({
        cabinet_id: cab.id,
        event_type: eventType,
        message_text: JSON.stringify({
          date: reportDate,
          totalStorage,
          returnsToday: todayReturns.length,
          returnAnomaly
        })
      });
      cabResult.sent = true;
      cabResult.storage_total = totalStorage;
      cabResult.returns_today = todayReturns.length;
      cabResult.return_anomaly = returnAnomaly;
      if (storageError) cabResult.storage_error = storageError;
    } catch (e) {
      cabResult.error = String(e);
    }
    results.push(cabResult);
  }
  return json({
    ok: true,
    date: reportDate,
    results
  });
});
async function loadStorageCache(admin, cabinetId, periodFrom, periodTo) {
  const { data } = await admin.from('warehouse_storage_cache').select('rows, total_price, fetched_at').eq('cabinet_id', cabinetId).eq('period_from', periodFrom).eq('period_to', periodTo).maybeSingle();
  if (!data?.rows) return null;
  const rows = data.rows;
  if (!Array.isArray(rows) || !rows.length) return null;
  return {
    rows,
    total: Number(data.total_price) || 0
  };
}
function aggregateStorageTop10(rows) {
  const map = new Map();
  for (const r of rows){
    const key = `${r.nmId}:${r.warehouse}`;
    const cur = map.get(key) ?? {
      nmId: r.nmId,
      vendorCode: r.vendorCode,
      subject: r.subject,
      warehouse: r.warehouse,
      total: 0
    };
    cur.total += r.warehousePrice;
    map.set(key, cur);
  }
  return [
    ...map.values()
  ].sort((a, b)=>b.total - a.total).slice(0, 10);
}
let fontRegular = null;
let fontBold = null;
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
async function renderStorageImage(cabinetName, date, rows, total) {
  await ensureFonts();
  const fmt = (n)=>Math.round(n).toLocaleString('ru-RU').replace(/\u00A0/g, ' ');
  const S = 2;
  const COLS = [
    {
      title: 'nmID / артикул',
      w: 180
    },
    {
      title: 'Склад',
      w: 140
    },
    {
      title: 'Предмет',
      w: 160
    },
    {
      title: '₽',
      w: 90
    }
  ];
  const PAD = 14;
  const width = COLS.reduce((a, c)=>a + c.w, 0) + PAD * 2;
  const titleH = 56;
  const headerH = 52;
  const rowH = 40;
  const totalH = 44;
  const height = titleH + headerH + rows.length * rowH + totalH + PAD * 2;
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
  ctx.fillStyle = '#1a1a1a';
  ctx.font = 'bold 20px DejaVu';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${cabinetName} — топ хранение · ${prettyDate(date)}`, PAD, PAD + titleH / 2 - 4);
  let x = PAD;
  const colX = [];
  for (const c of COLS){
    colX.push(x);
    x += c.w;
  }
  const tableTop = PAD + titleH;
  const tableW = width - PAD * 2;
  ctx.fillStyle = '#dbeafe';
  ctx.fillRect(PAD, tableTop, tableW, headerH);
  ctx.fillStyle = '#1e3a5f';
  ctx.font = 'bold 13px DejaVu';
  COLS.forEach((c, i)=>ctx.fillText(c.title, colX[i] + 6, tableTop + headerH / 2));
  ctx.font = '12px DejaVu';
  rows.forEach((r, ri)=>{
    const y = tableTop + headerH + ri * rowH;
    if (ri % 2) {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(PAD, y, tableW, rowH);
    }
    ctx.fillStyle = '#222';
    const cy = y + rowH / 2;
    ctx.fillText(`${r.nmId}`, colX[0] + 6, cy - 8);
    ctx.fillText(fit(ctx, r.vendorCode || '—', COLS[0].w - 12), colX[0] + 6, cy + 8);
    ctx.fillText(fit(ctx, r.warehouse, COLS[1].w - 12), colX[1] + 6, cy);
    ctx.fillText(fit(ctx, r.subject, COLS[2].w - 12), colX[2] + 6, cy);
    ctx.fillStyle = '#1d4ed8';
    ctx.fillText(fmt(r.total), colX[3] + 6, cy);
  });
  const totalY = tableTop + headerH + rows.length * rowH;
  ctx.fillStyle = '#dbeafe';
  ctx.fillRect(PAD, totalY, tableW, totalH);
  ctx.fillStyle = '#1e3a5f';
  ctx.font = 'bold 14px DejaVu';
  ctx.fillText('Итого за период', colX[0] + 6, totalY + totalH / 2);
  ctx.fillText(fmt(total), colX[3] + 6, totalY + totalH / 2);
  return canvas.toBuffer('image/png');
}
// deno-lint-ignore no-explicit-any
function fit(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while(s.length > 1 && ctx.measureText(s + '…').width > maxW)s = s.slice(0, -1);
  return s + '…';
}
async function sendTelegramPhoto(token, chatId, png, caption) {
  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('caption', caption);
  form.append('parse_mode', 'HTML');
  form.append('photo', new Blob([
    png
  ], {
    type: 'image/png'
  }), 'storage.png');
  const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: 'POST',
    body: form
  });
  if (!res.ok) return `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`;
  return null;
}
async function sendTelegramMessage(token, chatId, text) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML'
    })
  });
  if (!res.ok) return `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`;
  return null;
}
function yesterdayBishkek() {
  const d = new Date(Date.now() + 6 * 3600 * 1000);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
function daysBefore(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
function prettyDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}
function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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

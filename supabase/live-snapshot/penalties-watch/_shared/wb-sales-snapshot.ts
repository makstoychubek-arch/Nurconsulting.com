// СНИМОК боевой функции «penalties-watch» (версия 25), снят 2026-10-06.
// Это скомпилированный код из Supabase, не исходник для деплоя. Зашитые ключи вырезаны.
// Снимок продаж по кабинету за один день (WB Statistics API, flag=1).
const STATS_API = 'https://statistics-api.wildberries.ru';
export async function fetchAllCabinetSales(admin, date, onlyCabinet) {
  const { data: cabinets, error } = await admin.from('cabinets').select('name, wb_token').not('wb_token', 'is', null).gt('wb_token', '').order('name');
  if (error) throw new Error(error.message);
  const out = [];
  for (const cab of cabinets || []){
    if (onlyCabinet && !cab.name.toLowerCase().includes(onlyCabinet.toLowerCase())) continue;
    const token = sanitizeWbToken(cab.wb_token);
    if (!token || token.length < 50) {
      out.push({
        name: cab.name,
        totals: emptyTotals(),
        error: 'нет токена'
      });
      continue;
    }
    try {
      const totals = await fetchSalesTotals(token, date);
      out.push({
        name: cab.name,
        totals
      });
    } catch (e) {
      out.push({
        name: cab.name,
        totals: emptyTotals(),
        error: String(e).slice(0, 120)
      });
    }
  }
  return out;
}
export async function fetchSalesTotals(token, date) {
  const [orders, sales] = await Promise.all([
    wbGetArray(`${STATS_API}/api/v1/supplier/orders?dateFrom=${date}&flag=1`, token),
    wbGetArray(`${STATS_API}/api/v1/supplier/sales?dateFrom=${date}&flag=1`, token)
  ]);
  return aggregateTotals(orders, sales);
}
// deno-lint-ignore no-explicit-any
function aggregateTotals(orders, sales) {
  let ordersCount = 0;
  let ordersSum = 0;
  let buyoutCount = 0;
  let buyoutSum = 0;
  for (const o of orders || []){
    if (o?.isCancel) continue;
    ordersCount++;
    ordersSum += Number(o?.priceWithDisc ?? o?.totalPrice ?? 0);
  }
  for (const s of sales || []){
    const saleId = String(s?.saleID || '');
    if (saleId && !saleId.startsWith('S')) continue;
    buyoutCount++;
    buyoutSum += Number(s?.priceWithDisc ?? s?.forPay ?? 0);
  }
  return {
    ordersCount,
    ordersSum,
    buyoutCount,
    buyoutSum
  };
}
async function wbGetArray(url, token) {
  const res = await fetch(url, {
    headers: {
      Authorization: token
    }
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`WB ${res.status}: ${text.slice(0, 120)}`);
  const data = JSON.parse(text);
  return Array.isArray(data) ? data : [];
}
function sanitizeWbToken(raw) {
  if (typeof raw !== 'string') return '';
  return raw.replace(/^\uFEFF/, '').replace(/\s+/g, '').trim();
}
function emptyTotals() {
  return {
    ordersCount: 0,
    ordersSum: 0,
    buyoutCount: 0,
    buyoutSum: 0
  };
}
export function fmtNum(n) {
  return Math.round(n).toLocaleString('ru-RU').replace(/\u00A0/g, ' ');
}
export function prettyDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}
export function todayBishkek() {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: 'Asia/Bishkek'
  });
}
export function yesterdayBishkek() {
  return daysAgoBishkek(1);
}
export function daysAgoBishkek(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toLocaleDateString('en-CA', {
    timeZone: 'Asia/Bishkek'
  });
}
/** Парсит запрос продаж. В группе «Продажи» достаточно даты: «12.07», «12.07 Baza». */ export function parseSalesQuery(text, relaxed = false) {
  const raw = text.replace(/@\w+/g, ' ').trim();
  const lower = raw.toLowerCase();
  const hasSalesWord = /\b(продаж|заказ|выкуп|отч[её]т|sales)\b/i.test(lower);
  const hasDateToken = /\b(\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?)\b/.test(raw) || /\b(вчера|позавчера|сегодня)\b/i.test(lower);
  /** В группе «Продажи» достаточно даты: «12.07», «12.07 Baza». */ if (!relaxed && !hasSalesWord && !hasDateToken) return null;
  // relaxed: дата без слова «продажи» — ок
  let date = '';
  if (/\bпозавчера\b/i.test(lower)) date = daysAgoBishkek(2);
  else if (/\bвчера\b/i.test(lower)) date = yesterdayBishkek();
  else if (/\bсегодня\b/i.test(lower)) date = todayBishkek();
  else {
    const m = raw.match(/\b(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\b/);
    if (m) {
      const day = m[1].padStart(2, '0');
      const month = m[2].padStart(2, '0');
      let year = m[3] ? m[3].length === 2 ? `20${m[3]}` : m[3] : String(new Date().getFullYear());
      date = `${year}-${month}-${day}`;
    }
  }
  if (!date) {
    if (hasSalesWord || relaxed && /\b(baza|zevina|saai|база|зевина)\b/i.test(lower)) {
      date = yesterdayBishkek();
    } else {
      return null;
    }
  }
  let cabinet;
  const tailCab = raw.match(/\b\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?\s+([a-zA-Zа-яА-ЯёЁ0-9._-]{2,30})\s*$/);
  if (tailCab) cabinet = tailCab[1];
  if (!cabinet) {
    const cabMatch = lower.match(/\b(?:кабинет|cabinet)\s+([a-zа-яё0-9._-]{2,40})/i) || lower.match(/\b(baza|zevina|saai|сaaи|база|зевина)\b/i);
    if (cabMatch) cabinet = cabMatch[1];
  }
  return {
    date,
    cabinet
  };
}
export function formatSalesReply(date, snapshots) {
  const pretty = prettyDate(date);
  if (!snapshots.length) {
    return `📊 <b>Продажи · ${pretty}</b>\n\nНет кабинетов с токеном WB.`;
  }
  const lines = [
    `📊 <b>Продажи · ${pretty}</b>`,
    ''
  ];
  let tOc = 0;
  let tOs = 0;
  let tBc = 0;
  let tBs = 0;
  for (const s of snapshots){
    if (s.error) {
      lines.push(`<b>${esc(s.name)}</b> — ошибка: ${esc(s.error)}`);
      continue;
    }
    const { ordersCount, ordersSum, buyoutCount, buyoutSum } = s.totals;
    if (ordersCount === 0 && buyoutCount === 0) {
      lines.push(`<b>${esc(s.name)}</b> — нет заказов/выкупов`);
      continue;
    }
    tOc += ordersCount;
    tOs += ordersSum;
    tBc += buyoutCount;
    tBs += buyoutSum;
    lines.push(`<b>${esc(s.name)}</b>`, `🛒 ${ordersCount} шт · ${fmtNum(ordersSum)} сом`, `✅ ${buyoutCount} шт · ${fmtNum(buyoutSum)} сом`, '');
  }
  if (snapshots.filter((s)=>!s.error).length > 1 && (tOc > 0 || tBc > 0)) {
    lines.push(`<b>Итого</b>`, `🛒 ${tOc} шт · ${fmtNum(tOs)} сом`, `✅ ${tBc} шт · ${fmtNum(tBs)} сом`);
  }
  return lines.join('\n').trimEnd();
}
function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
export function salesHelpText() {
  return [
    '📊 <b>Продажи по дню</b>',
    '',
    'Примеры:',
    '• <code>@бот 12.07</code>',
    '• <code>@бот 12.07 Baza</code>',
    '• <code>@бот продажи вчера</code>'
  ].join('\n');
}

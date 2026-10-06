// СНИМОК боевой функции «penalties-watch» (версия 25), снят 2026-10-06.
// Это скомпилированный код из Supabase, не исходник для деплоя. Зашитые ключи вырезаны.
// Штрафы за день: итог + строки из Finance API, разбивка по типам — Analytics API.
import { emptyReportTotals, formatReportBreakdown, PENALTY_REPORT_LABELS } from './wb-penalty-categories.ts';
import { fetchAntifraudSum, fetchDeductionsSum, fetchGoodsLabeling, fetchMeasurementPenaltiesSum, fetchWarehouseMeasurementsCount } from './wb-analytics-api.ts';
import { fetchFinancePenaltyRows } from './wb-finance-penalties.ts';
import { CABINET_TOKEN_SELECT, isValidWbToken, pickCabinetToken } from './wb-cabinet-tokens.ts';
export async function fetchAllCabinetPenalties(admin, date, onlyCabinet) {
  const { data: cabinets } = await admin.from('cabinets').select(CABINET_TOKEN_SELECT).not('wb_token', 'is', null).gt('wb_token', '').order('name');
  const out = [];
  for (const cab of cabinets || []){
    if (onlyCabinet && !cab.name.toLowerCase().includes(onlyCabinet.toLowerCase())) continue;
    if (!isValidWbToken(pickCabinetToken(cab, 'default'))) {
      out.push({
        cabinetId: cab.id,
        name: cab.name,
        rows: [],
        total: 0,
        byReport: emptyReportTotals(),
        measurementCount: 0,
        markingViolations: [],
        error: 'нет токена'
      });
      continue;
    }
    try {
      const result = await fetchPenaltyRows(cab, date);
      const total = result.rows.reduce((s, r)=>s + r.amount, 0);
      out.push({
        cabinetId: cab.id,
        name: cab.name,
        rows: result.rows,
        total,
        byReport: result.byReport,
        measurementCount: result.measurementCount,
        markingViolations: result.markingViolations,
        source: result.source,
        error: result.errors.length ? result.errors.join('; ') : undefined
      });
    } catch (e) {
      out.push({
        cabinetId: cab.id,
        name: cab.name,
        rows: [],
        total: 0,
        byReport: emptyReportTotals(),
        measurementCount: 0,
        markingViolations: [],
        error: String(e).slice(0, 100)
      });
    }
    await sleep(3000);
  }
  return out;
}
export function formatPenaltiesReply(date, snapshots, alertUser) {
  const pretty = prettyDate(date);
  const lines = [
    `⚠️ <b>Штрафы · ${pretty}</b>`,
    ''
  ];
  let grand = 0;
  const fmt = (n)=>Math.round(n).toLocaleString('ru-RU').replace(/\u00A0/g, ' ');
  for (const s of snapshots){
    if (s.error && !s.rows.length) {
      lines.push(`<b>${esc(s.name)}</b> — ${esc(s.error)}`, '');
      continue;
    }
    if (s.total <= 0) {
      lines.push(`✅ <b>${esc(s.name)}</b> — штрафов нет`, '');
      continue;
    }
    grand += s.total;
    lines.push(`<b>${esc(s.name)}</b> — <b>${fmt(s.total)} сом</b>`);
    for (const r of s.rows.slice(0, 3)){
      lines.push(`• ${esc(r.reason.slice(0, 60))} — ${fmt(r.amount)}`);
    }
    if (s.rows.length > 3) lines.push(`  …ещё ${s.rows.length - 3}`);
    lines.push('');
  }
  if (grand > 0 && alertUser) {
    lines.push(`@${esc(alertUser.replace(/^@/, ''))} — <b>нужно разобраться</b>`);
  } else if (!snapshots.some((s)=>s.total > 0)) {
    lines.push('<i>Штрафов и удержаний нет</i>');
  }
  return lines.join('\n').trimEnd();
}
export function parsePenaltiesQuery(text, relaxed = false) {
  const raw = text.replace(/@\w+/g, ' ').trim();
  const lower = raw.toLowerCase();
  const hasWord = /\b(штраф|удерж|penalt)/i.test(lower);
  const hasDate = /\b\d{1,2}[./]\d{1,2}/.test(raw) || /\b(вчера|позавчера|сегодня)\b/i.test(lower);
  if (!relaxed && !hasWord) return null;
  if (!hasWord && !hasDate && !relaxed) return null;
  let date = parseDateToken(raw) || (hasWord ? yesterdayIso() : '');
  if (!date) return null;
  let cabinet;
  const tail = raw.match(/\b\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?\s+([a-zA-Zа-яА-ЯёЁ0-9._-]{2,30})\s*$/);
  if (tail) cabinet = tail[1];
  return {
    date,
    cabinet
  };
}
function parseDateToken(raw) {
  const lower = raw.toLowerCase();
  if (/\bпозавчера\b/.test(lower)) return daysAgoIso(2);
  if (/\bвчера\b/.test(lower)) return yesterdayIso();
  if (/\bсегодня\b/.test(lower)) return todayIso();
  const m = raw.match(/\b(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\b/);
  if (!m) return '';
  const y = m[3] ? m[3].length === 2 ? `20${m[3]}` : m[3] : String(new Date().getFullYear());
  return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}
export function todayIso() {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: 'Asia/Bishkek'
  });
}
export function yesterdayIso() {
  return daysAgoIso(1);
}
function daysAgoIso(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toLocaleDateString('en-CA', {
    timeZone: 'Asia/Bishkek'
  });
}
function prettyDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}
/** Finance API — строки и итог; Analytics API — разбивка по 5 отчётам + фото маркировки */ export async function fetchPenaltyRows(cab, date) {
  const financeToken = pickCabinetToken(cab, 'default');
  const analyticsToken = pickCabinetToken(cab, 'analytics');
  const errors = [];
  let rows = [];
  let source = 'none';
  try {
    const finance = await fetchFinancePenaltyRows(financeToken, date);
    rows = finance.rows;
    source = finance.source;
  } catch (e) {
    errors.push(`Finance: ${String(e).slice(0, 80)}`);
  }
  const byReport = emptyReportTotals();
  let measurementCount = 0;
  let markingViolations = [];
  if (isValidWbToken(analyticsToken)) {
    try {
      byReport.measurement_penalties = await fetchMeasurementPenaltiesSum(analyticsToken, date);
    } catch (e) {
      errors.push(`${PENALTY_REPORT_LABELS.measurement_penalties}: ${String(e).slice(0, 80)}`);
    }
    try {
      byReport.deductions = await fetchDeductionsSum(analyticsToken, date);
    } catch (e) {
      errors.push(`${PENALTY_REPORT_LABELS.deductions}: ${String(e).slice(0, 80)}`);
    }
    if (isWednesdayReportDay(date)) {
      try {
        byReport.self_buyout = await fetchAntifraudSum(analyticsToken, date);
      } catch (e) {
        errors.push(`${PENALTY_REPORT_LABELS.self_buyout}: ${String(e).slice(0, 80)}`);
      }
    }
    try {
      markingViolations = await fetchGoodsLabeling(analyticsToken, date);
      byReport.marking = markingViolations.reduce((s, i)=>s + i.amount, 0);
    } catch (e) {
      errors.push(`${PENALTY_REPORT_LABELS.marking}: ${String(e).slice(0, 80)}`);
    }
    try {
      measurementCount = await fetchWarehouseMeasurementsCount(analyticsToken, date);
    } catch (e) {
      errors.push(`${PENALTY_REPORT_LABELS.warehouse_measurements}: ${String(e).slice(0, 80)}`);
    }
  }
  return {
    rows,
    byReport,
    measurementCount,
    markingViolations,
    source,
    errors
  };
}
/** Быстрая проверка сторожа: только Finance API (без 5 отчётов Analytics). */ export async function fetchPenaltyQuick(cab, date) {
  const token = pickCabinetToken(cab, 'default');
  const finance = await fetchFinancePenaltyRows(token, date);
  const total = finance.rows.reduce((s, r)=>s + r.amount, 0);
  return {
    total,
    rows: finance.rows,
    source: finance.source
  };
}
/** Только goods-labeling для мгновенных алертов маркировки. */ export async function fetchMarkingViolations(cab, date) {
  const token = pickCabinetToken(cab, 'analytics');
  if (!isValidWbToken(token)) return [];
  return fetchGoodsLabeling(token, date);
}
/** @deprecated используйте fetchPenaltyRows(cab, date) */ export async function fetchPenaltyRowsLegacy(token, date) {
  return fetchPenaltyRows({
    wb_token: token
  }, date);
}
function isWednesdayReportDay(date) {
  return new Date(`${date}T12:00:00Z`).getUTCDay() === 3;
}
function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function sleep(ms) {
  return new Promise((r)=>setTimeout(r, ms));
}
export { formatReportBreakdown };

// СНИМОК боевой функции «penalties-watch» (версия 25), снят 2026-10-06.
// Это скомпилированный код из Supabase, не исходник для деплоя. Зашитые ключи вырезаны.
// Штрафы/удержания за день — Finance API v1 (полная детализация, источник итога).
const FINANCE_API = 'https://finance-api.wildberries.ru';
const EXCLUDED_DEDUCTION_NAMES = [
  'ВБ.Продвижение',
  'WB Продвижение',
  'ВБ.Медиа',
  'Перевод на баланс заёмщика',
  'Погашение задолженности',
  'Погашение по займу',
  'Продвижение через блогеров',
  'ВБ.Бренд-зона',
  'Сторно платной приёмки',
  'НДС не облагается',
  'Компенсация'
];
/** Хранение — не штраф (исключаем из отчёта) */ const EXCLUDED_REASON_PATTERNS = [
  /хранен/i,
  /paidstorage/i,
  /storage/i
];
export async function fetchFinancePenaltyRows(token, date) {
  const raw = await fetchPenaltyDetailedRaw(token, date);
  const detailed = aggregatePenaltyRows(raw, date);
  if (detailed.length) {
    return {
      rows: detailed,
      source: 'detailed'
    };
  }
  const fromList = await fetchPenaltyRowsFromList(token, date);
  if (fromList.length) {
    return {
      rows: fromList,
      source: 'list'
    };
  }
  return {
    rows: [],
    source: 'none'
  };
}
async function fetchPenaltyDetailedRaw(token, date) {
  const raw = [];
  let rrdId = 0;
  for(let page = 0; page < 8; page++){
    const res = await fetchWithTimeout(`${FINANCE_API}/api/finance/v1/sales-reports/detailed`, {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        dateFrom: date,
        dateTo: date,
        limit: 100000,
        rrdId,
        period: 'daily'
      })
    }, 60000);
    if (res.status === 204) break;
    const text = await res.text();
    if (!res.ok) throw new Error(`finance ${res.status}: ${text.slice(0, 120)}`);
    if (!text.trim()) break;
    const chunk = JSON.parse(text);
    if (!Array.isArray(chunk) || !chunk.length) break;
    raw.push(...chunk);
    const last = chunk[chunk.length - 1];
    const nextRrd = Number(last?.rrdId ?? last?.rrd_id ?? 0);
    if (chunk.length < 100000 || !nextRrd || nextRrd === rrdId) break;
    rrdId = nextRrd;
    await sleep(61000);
  }
  return raw;
}
async function fetchPenaltyRowsFromList(token, date) {
  const res = await fetchWithTimeout(`${FINANCE_API}/api/finance/v1/sales-reports/list`, {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      dateFrom: date,
      dateTo: date,
      limit: 100,
      offset: 0,
      period: 'daily'
    })
  }, 60000);
  if (res.status === 204) return [];
  const text = await res.text();
  if (!res.ok) throw new Error(`finance list ${res.status}: ${text.slice(0, 120)}`);
  if (!text.trim()) return [];
  const reports = JSON.parse(text);
  if (!Array.isArray(reports)) return [];
  const byReason = new Map();
  for (const rep of reports){
    const row = rep;
    const repFrom = String(row.dateFrom || row.date_from || '').slice(0, 10);
    const repTo = String(row.dateTo || row.date_to || '').slice(0, 10);
    if (repFrom && repFrom > date) continue;
    if (repTo && repTo < date) continue;
    addAmount(byReason, 'Штрафы WB', parseMoney(row.penaltySum ?? row.penalty_sum));
    addAmount(byReason, 'Удержания', parseMoney(row.deductionSum ?? row.deduction_sum));
    addAmount(byReason, 'Платная приёмка', parseMoney(row.paidAcceptanceSum ?? row.paid_acceptance_sum));
  }
  return [
    ...byReason.entries()
  ].map(([reason, amount])=>({
      reason,
      amount
    })).filter((r)=>!isExcludedReason(r.reason)).sort((a, b)=>b.amount - a.amount);
}
function aggregatePenaltyRows(raw, targetDate) {
  const byReason = new Map();
  for (const r of raw){
    const rrDate = String(field(r, 'rrDate', 'rr_dt', 'saleDt', 'sale_dt') || '').slice(0, 10);
    if (rrDate && rrDate !== targetDate) continue;
    const penalty = parseMoney(field(r, 'penalty'));
    const deduction = parseMoney(field(r, 'deduction'));
    const paidAcceptance = parseMoney(field(r, 'paidAcceptance', 'acceptance'));
    const operName = String(field(r, 'sellerOperName', 'supplierOperName', 'supplier_oper_name') || '');
    const bonusName = String(field(r, 'bonusTypeName', 'bonus_type_name') || '');
    const docType = String(field(r, 'docTypeName', 'doc_type_name') || '');
    const excluded = EXCLUDED_DEDUCTION_NAMES.some((n)=>operName.includes(n) || bonusName.includes(n));
    if (penalty > 0) {
      const reason = (bonusName || operName || docType || 'Штраф').trim();
      if (!isExcludedReason(reason, operName)) addAmount(byReason, reason, penalty);
    }
    if (deduction > 0 && !excluded) {
      const reason = (bonusName || operName || docType || 'Удержание').trim();
      if (!isExcludedReason(reason, operName)) addAmount(byReason, reason, deduction);
    }
    if (paidAcceptance > 0) {
      addAmount(byReason, 'Платная приёмка', paidAcceptance);
    }
  }
  return [
    ...byReason.entries()
  ].map(([reason, amount])=>({
      reason,
      amount
    })).sort((a, b)=>b.amount - a.amount);
}
function isExcludedReason(reason, operName = '') {
  const s = `${reason} ${operName}`;
  return EXCLUDED_REASON_PATTERNS.some((p)=>p.test(s));
}
function addAmount(map, reason, amount) {
  if (amount <= 0) return;
  map.set(reason, (map.get(reason) || 0) + amount);
}
function field(obj, ...keys) {
  for (const k of keys){
    if (obj[k] != null && obj[k] !== '') return obj[k];
  }
  return null;
}
function parseMoney(v) {
  const n = Number(String(v ?? '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.abs(n) : 0;
}
function sleep(ms) {
  return new Promise((r)=>setTimeout(r, ms));
}
async function fetchWithTimeout(url, init, ms) {
  const c = new AbortController();
  const t = setTimeout(()=>c.abort(), ms);
  try {
    return await fetch(url, {
      ...init,
      signal: c.signal
    });
  } finally{
    clearTimeout(t);
  }
}

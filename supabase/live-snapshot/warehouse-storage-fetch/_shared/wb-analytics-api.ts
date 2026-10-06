// СНИМОК боевой функции «warehouse-storage-fetch» (версия 26), снят 2026-10-06.
// Это скомпилированный код из Supabase, не исходник для деплоя. Зашитые ключи вырезаны.
// Клиент Seller Analytics API (категория «Аналитика»).
const ANALYTICS_API = 'https://seller-analytics-api.wildberries.ru';
async function wbGet(token, path, params = {}, timeoutMs = 30000) {
  const qs = new URLSearchParams(params).toString();
  const url = `${ANALYTICS_API}${path}${qs ? `?${qs}` : ''}`;
  const c = new AbortController();
  const t = setTimeout(()=>c.abort(), timeoutMs);
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
function dayRangeIso(date) {
  return {
    from: `${date}T00:00:00Z`,
    to: `${date}T23:59:59Z`
  };
}
function isoDay(v) {
  return String(v ?? '').slice(0, 10);
}
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
async function paginateReports(token, path, baseParams, mapRow, filterDay) {
  const out = [];
  let offset = 0;
  const limit = '1000';
  for(let page = 0; page < 20; page++){
    const res = await wbGet(token, path, {
      ...baseParams,
      limit,
      offset: String(offset)
    });
    if (res.status === 204) break;
    const text = await res.text();
    if (!res.ok) throw new Error(`${path} ${res.status}: ${text.slice(0, 160)}`);
    if (!text.trim()) break;
    const json = JSON.parse(text);
    const reports = json?.data?.reports ?? [];
    if (!reports.length) break;
    for (const row of reports){
      if (filterDay) {
        const d = isoDay(row.dtBonus ?? row.dt);
        if (d && d !== filterDay) continue;
      }
      const mapped = mapRow(row);
      if (mapped) out.push(mapped);
    }
    offset += reports.length;
    const total = Number(json?.data?.total ?? 0);
    if (reports.length < Number(limit) || total && offset >= total) break;
    await sleep(65000); // 1 req/min
  }
  return out;
}
export async function fetchMeasurementPenaltiesSum(token, date) {
  const { from, to } = dayRangeIso(date);
  const rows = await paginateReports(token, '/api/analytics/v1/measurement-penalties', {
    dateFrom: from,
    dateTo: to
  }, (r)=>({
      amount: num(r.penaltyAmount),
      valid: r.isValid !== false
    }), date);
  return rows.reduce((s, r)=>s + (r.valid ? r.amount : 0), 0);
}
export async function fetchWarehouseMeasurementsCount(token, date) {
  const { from, to } = dayRangeIso(date);
  const rows = await paginateReports(token, '/api/analytics/v1/warehouse-measurements', {
    dateFrom: from,
    dateTo: to
  }, ()=>({
      n: 1
    }), date);
  return rows.length;
}
export async function fetchDeductionsSum(token, date) {
  const { from, to } = dayRangeIso(date);
  const rows = await paginateReports(token, '/api/analytics/v1/deductions', {
    dateFrom: from,
    dateTo: to,
    sort: 'dtBonus',
    order: 'desc'
  }, (r)=>({
      amount: num(r.bonusSumm)
    }), date);
  return rows.reduce((s, r)=>s + r.amount, 0);
}
export async function fetchAntifraudSum(token, date) {
  const res = await wbGet(token, '/api/v1/analytics/antifraud-details', {
    dateFrom: date,
    dateTo: date
  });
  if (res.status === 204) return 0;
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 400 || res.status === 404) return 0;
    throw new Error(`antifraud ${res.status}: ${text.slice(0, 160)}`);
  }
  if (!text.trim()) return 0;
  const json = JSON.parse(text);
  let sum = 0;
  for (const d of json.details ?? []){
    const from = isoDay(d.dateFrom);
    const to = isoDay(d.dateTo);
    if (from && date < from) continue;
    if (to && date > to) continue;
    sum += num(d.sum);
  }
  return sum;
}
export async function fetchGoodsLabeling(token, date) {
  const res = await wbGet(token, '/api/v1/analytics/goods-labeling', {
    dateFrom: date,
    dateTo: date
  });
  if (res.status === 204) return [];
  const text = await res.text();
  if (!res.ok) throw new Error(`goods-labeling ${res.status}: ${text.slice(0, 160)}`);
  if (!text.trim()) return [];
  const json = JSON.parse(text);
  const out = [];
  for (const r of json.report ?? []){
    const d = isoDay(r.date);
    if (d && d !== date) continue;
    out.push({
      nmId: num(r.nmID ?? r.nmId),
      amount: num(r.amount),
      date: d || date,
      shkId: num(r.shkID ?? r.shkId) || undefined,
      sku: String(r.sku ?? ''),
      photoUrls: Array.isArray(r.photoUrls) ? r.photoUrls.map(String).filter(Boolean) : []
    });
  }
  return out;
}
export async function fetchBlockedProducts(token) {
  const res = await wbGet(token, '/api/v1/analytics/banned-products/blocked', {
    sort: 'nmId',
    order: 'desc'
  });
  if (res.status === 204) return [];
  const text = await res.text();
  if (!res.ok) throw new Error(`blocked ${res.status}: ${text.slice(0, 160)}`);
  if (!text.trim()) return [];
  const json = JSON.parse(text);
  return (json.report ?? []).map((r)=>({
      nmId: num(r.nmId),
      brand: String(r.brand ?? ''),
      title: String(r.title ?? ''),
      vendorCode: String(r.vendorCode ?? ''),
      reason: String(r.reason ?? '')
    })).filter((r)=>r.nmId > 0);
}
export async function fetchGoodsReturns(token, dateFrom, dateTo) {
  const res = await wbGet(token, '/api/v1/analytics/goods-return', {
    dateFrom,
    dateTo
  });
  if (res.status === 204) return [];
  const text = await res.text();
  if (!res.ok) throw new Error(`goods-return ${res.status}: ${text.slice(0, 160)}`);
  if (!text.trim()) return [];
  const json = JSON.parse(text);
  return (json.report ?? []).map((r)=>({
      nmId: num(r.nmId),
      orderDt: isoDay(r.orderDt),
      completedDt: isoDay(r.completedDt) || undefined,
      reason: String(r.reason ?? ''),
      returnType: String(r.returnType ?? ''),
      subjectName: String(r.subjectName ?? ''),
      status: String(r.status ?? '')
    }));
}
export async function fetchPaidStorageReport(token, dateFrom, dateTo, opts) {
  const maxPolls = opts?.maxPolls ?? 24;
  const pollMs = opts?.pollMs ?? 5000;
  const createRes = await wbGet(token, '/api/v1/paid_storage', {
    dateFrom,
    dateTo
  });
  const createText = await createRes.text();
  if (!createRes.ok) throw new Error(`paid_storage create ${createRes.status}: ${createText.slice(0, 160)}`);
  const taskId = JSON.parse(createText)?.data?.taskId ?? JSON.parse(createText)?.taskId;
  if (!taskId) throw new Error('paid_storage: no taskId');
  for(let i = 0; i < maxPolls; i++){
    await sleep(pollMs);
    const stRes = await wbGet(token, `/api/v1/paid_storage/tasks/${taskId}/status`);
    const stText = await stRes.text();
    if (!stRes.ok) throw new Error(`paid_storage status ${stRes.status}: ${stText.slice(0, 120)}`);
    const status = JSON.parse(stText)?.data?.status ?? JSON.parse(stText)?.status;
    if (status === 'done') break;
    if (status === 'error' || status === 'failed') throw new Error(`paid_storage task failed: ${stText.slice(0, 120)}`);
  }
  const dlRes = await wbGet(token, `/api/v1/paid_storage/tasks/${taskId}/download`, {}, 120000);
  if (dlRes.status === 204) return [];
  const dlText = await dlRes.text();
  if (!dlRes.ok) throw new Error(`paid_storage download ${dlRes.status}: ${dlText.slice(0, 160)}`);
  if (!dlText.trim()) return [];
  const rows = JSON.parse(dlText);
  if (!Array.isArray(rows)) return [];
  return rows.map((r)=>({
      date: isoDay(r.date),
      nmId: num(r.nmId),
      vendorCode: String(r.vendorCode ?? ''),
      subject: String(r.subject ?? ''),
      brand: String(r.brand ?? ''),
      warehouse: String(r.warehouse ?? ''),
      warehousePrice: num(r.warehousePrice),
      volume: num(r.volume),
      barcodesCount: num(r.barcodesCount)
    }));
}
/** Сжимает сырые строки paid_storage (nmId+склад) — для кэша в БД. */ export function aggregatePaidStorageRows(rows) {
  const map = new Map();
  for (const r of rows){
    const key = `${r.nmId}:${r.warehouse}`;
    const cur = map.get(key);
    if (cur) {
      cur.warehousePrice += r.warehousePrice;
      cur.volume += r.volume;
      cur.barcodesCount += r.barcodesCount;
    } else {
      map.set(key, {
        ...r
      });
    }
  }
  return [
    ...map.values()
  ];
}
function sleep(ms) {
  return new Promise((r)=>setTimeout(r, ms));
}

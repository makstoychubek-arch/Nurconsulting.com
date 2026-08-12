/**
 * План раздач из Google Sheet → «база в голове» Алины.
 * Читает вкладку План + лог заявок, считает свободные места.
 *
 * Env:
 *   ALINA_SHEET_ID
 *   GOOGLE_SERVICE_ACCOUNT_JSON (опционально для API; иначе CSV если лист «по ссылке»)
 *   ALINA_PLAN_TAB=План
 *   ALINA_LEADS_TAB=Sheet1
 */

export type SheetPlanOffer = {
  date: string | null;
  deal_type: 'cashback' | 'barter' | 'both';
  product_name: string | null;
  keyword: string | null;
  cashback_pct: number | null;
  plan_slots: number;
  used_slots: number;
  slots_left: number;
  order_deadline: string | null;
  is_open: boolean;
  status_raw: string | null;
  row_index: number;
};

export type SheetPlanSnapshot = {
  ok: boolean;
  error?: string;
  source?: 'api' | 'csv';
  offers: SheetPlanOffer[];
  /** Лучший активный оффер на сейчас (для alina_campaign). */
  active: SheetPlanOffer | null;
  leads_rows: number;
  fetched_at: string;
};

const planCache: { at: number; snap: SheetPlanSnapshot | null } = {
  at: 0,
  snap: null,
};
const CACHE_MS = 45_000;

function norm(s: unknown): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function headerKey(h: string): string {
  const t = norm(h);
  if (!t) return '';
  if (/^(дата|день|date)/.test(t)) return 'date';
  if (/^(тип|вид|формат|deal)/.test(t)) return 'deal_type';
  if (/товар|артикул|продукт|название|position/.test(t)) return 'product';
  if (/ключ|ключев|запрос|search/.test(t)) return 'keyword';
  if (/кэш|кеш|cash|%|процент/.test(t) && !/выплат/.test(t)) return 'cashback_pct';
  if (/план|нужно|лимит|мест|слот|qty|количество/.test(t) && !/остал|свобод/.test(t)) {
    return 'plan';
  }
  if (/факт|занят|сделано|выдано|used/.test(t)) return 'used';
  if (/остал|свобод|left/.test(t)) return 'left';
  if (/срок|дедлайн|до\s*22|заказ.*до/.test(t)) return 'deadline';
  if (/статус|открыт|актуаль|закрыт/.test(t)) return 'status';
  if (/tg|телеграм|ник|username|user/.test(t)) return 'tg';
  return t.slice(0, 40);
}

function parseDeal(raw: string): 'cashback' | 'barter' | 'both' {
  const t = norm(raw);
  if (/бартер/.test(t) && /(кэш|кеш|cash|самовыкуп)/.test(t)) return 'both';
  if (/бартер|блогер|рилс/.test(t)) return 'barter';
  return 'cashback';
}

function parseNum(raw: string): number | null {
  const m = String(raw).replace(',', '.').match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

function isOpenStatus(raw: string, slotsLeft: number): boolean {
  const t = norm(raw);
  if (!t) return slotsLeft > 0;
  if (/закрыт|законч|нет\s*мест|full|stop|off|аннул/.test(t)) return false;
  if (/открыт|актуаль|идёт|идет|open|да\b/.test(t)) return true;
  return slotsLeft > 0;
}

function todayKey(): string {
  // Москва ≈ UTC+3
  const d = new Date(Date.now() + 3 * 3600_000);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function dateMatchesToday(raw: string | null): boolean {
  if (!raw) return true; // пустая дата = действует сейчас
  const t = norm(raw);
  const today = todayKey();
  if (t.includes(today)) return true;
  // ISO / sheet serial-ish
  const iso = new Date().toISOString().slice(0, 10); // UTC
  if (t.includes(iso)) return true;
  const msk = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
  if (t.includes(msk)) return true;
  // «сегодня»
  if (/сегодня|today/.test(t)) return true;
  return false;
}

async function getSaToken(): Promise<string | null> {
  const raw = (Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON') || '').trim();
  if (!raw) return null;
  let sa: { client_email?: string; private_key?: string; token_uri?: string };
  try {
    sa = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!sa.client_email || !sa.private_key) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const b64url = (data: ArrayBuffer | Uint8Array | string) => {
    const bytes = typeof data === 'string'
      ? new TextEncoder().encode(data)
      : data instanceof Uint8Array
      ? data
      : new Uint8Array(data);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  };
  const pem = sa.private_key.replace(/\\n/g, '\n');
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const rawKey = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'pkcs8',
    rawKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned),
  );
  const jwt = `${unsigned}.${b64url(sig)}`;
  const res = await fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const data = await res.json().catch(() => ({}));
  return data.access_token || null;
}

async function readViaApi(
  sheetId: string,
  range: string,
): Promise<string[][] | null> {
  const token = await getSaToken();
  if (!token) return null;
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}` +
    `/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    console.error('[alina-sheet] api', res.status, await res.text());
    return null;
  }
  const data = await res.json();
  return (data.values as string[][]) || [];
}

/** Публичный CSV (доступ «по ссылке» / anyone with link). */
async function readViaCsv(
  sheetId: string,
  gid?: string,
): Promise<string[][] | null> {
  const q = gid ? `&gid=${encodeURIComponent(gid)}` : '';
  const url =
    `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${q}`;
  const res = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
    headers: { 'User-Agent': 'NRSpace-Alina/1.0' },
  });
  if (!res.ok) {
    console.error('[alina-sheet] csv', res.status);
    return null;
  }
  const text = await res.text();
  if (/<!doctype html|<html/i.test(text.slice(0, 200))) return null;
  return parseCsv(text);
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQ = false;
      } else cell += c;
      continue;
    }
    if (c === '"') {
      inQ = true;
      continue;
    }
    if (c === ',') {
      row.push(cell);
      cell = '';
      continue;
    }
    if (c === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    if (c === '\r') continue;
    cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function mapRows(values: string[][]): {
  headers: string[];
  keys: string[];
  rows: Record<string, string>[];
} {
  if (!values.length) return { headers: [], keys: [], rows: [] };
  // найти строку заголовков: первая, где ≥2 известных ключей
  let headerIdx = 0;
  let keys: string[] = [];
  for (let i = 0; i < Math.min(8, values.length); i++) {
    const mapped = values[i].map(headerKey);
    const known = mapped.filter((k) =>
      [
        'date',
        'deal_type',
        'product',
        'keyword',
        'plan',
        'cashback_pct',
        'status',
        'tg',
      ].includes(k)
    ).length;
    if (known >= 2) {
      headerIdx = i;
      keys = mapped;
      break;
    }
  }
  if (!keys.length) {
    keys = values[0].map(headerKey);
    headerIdx = 0;
  }
  const headers = values[headerIdx] || [];
  const rows: Record<string, string>[] = [];
  for (let i = headerIdx + 1; i < values.length; i++) {
    const line = values[i];
    if (!line?.some((c) => String(c).trim())) continue;
    const obj: Record<string, string> = { __row: String(i + 1) };
    for (let c = 0; c < keys.length; c++) {
      const k = keys[c];
      if (!k) continue;
      obj[k] = String(line[c] ?? '').trim();
    }
    rows.push(obj);
  }
  return { headers: headers.map(String), keys, rows };
}

function countUsedInLeads(
  leadRows: Record<string, string>[],
  offer: { product_name: string | null; deal_type: string; date: string | null },
): number {
  let n = 0;
  for (const r of leadRows) {
    const status = norm(r.status || r['статус'] || '');
    if (/аннул|отмен|отказ|spam|закрыт/.test(status)) continue;

    const deal = parseDeal(r.deal_type || r['вид'] || r['тип'] || '');
    if (offer.deal_type !== 'both' && deal !== 'both' && deal !== offer.deal_type) {
      // если в логе пустой тип — всё равно считаем
      if (r.deal_type || r['вид'] || r['тип']) continue;
    }

    if (offer.product_name) {
      const p = norm(r.product || r['товар'] || '');
      if (p && !p.includes(norm(offer.product_name).slice(0, 12)) &&
        !norm(offer.product_name).includes(p.slice(0, 12))) {
        // мягко: если товар указан в логе и не похож — пропуск
        if (p.length > 3) continue;
      }
    }

    // дата заказа/строки ≈ сегодня, если в плане на сегодня
    if (offer.date && dateMatchesToday(offer.date)) {
      const rd = r.date || r['дата'] || r['дата заказа'] || '';
      if (rd && !dateMatchesToday(rd) && !norm(rd).includes(norm(offer.date))) {
        // старые строки не жрём слоты сегодняшнего плана
        continue;
      }
    }
    n++;
  }
  return n;
}

function pickActive(offers: SheetPlanOffer[]): SheetPlanOffer | null {
  const open = offers.filter((o) => o.is_open && o.slots_left > 0);
  const today = open.filter((o) => dateMatchesToday(o.date));
  const pool = today.length ? today : open;
  if (!pool.length) {
    // есть строки «открыто» но 0 мест
    const zero = offers.find((o) => o.is_open && o.slots_left <= 0);
    return zero || offers.find((o) => dateMatchesToday(o.date)) || offers[0] || null;
  }
  // приоритет: больше оставшихся мест
  pool.sort((a, b) => b.slots_left - a.slots_left);
  return pool[0];
}

export async function fetchSheetPlan(
  force = false,
): Promise<SheetPlanSnapshot> {
  if (!force && planCache.snap && Date.now() - planCache.at < CACHE_MS) {
    return planCache.snap;
  }

  const sheetId = (Deno.env.get('ALINA_SHEET_ID') || '').trim();
  if (!sheetId) {
    return {
      ok: false,
      error: 'ALINA_SHEET_ID missing — пришлите ссылку на Google таблицу',
      offers: [],
      active: null,
      leads_rows: 0,
      fetched_at: new Date().toISOString(),
    };
  }

  const planTab = (Deno.env.get('ALINA_PLAN_TAB') || 'План').trim();
  const leadsTab = (Deno.env.get('ALINA_LEADS_TAB') || 'Sheet1').trim();
  const planGid = (Deno.env.get('ALINA_PLAN_GID') || '').trim();
  const leadsGid = (Deno.env.get('ALINA_LEADS_GID') || '').trim();

  let source: 'api' | 'csv' = 'api';
  let planValues = await readViaApi(sheetId, `${planTab}!A1:Z80`);
  let leadValues = await readViaApi(sheetId, `${leadsTab}!A1:Z500`);

  if (!planValues) {
    source = 'csv';
    planValues = await readViaCsv(sheetId, planGid || undefined);
  }
  if (!leadValues) {
    leadValues = (await readViaCsv(sheetId, leadsGid || undefined)) || [];
  }

  // Если вкладки План нет — пробуем тот же лист как план (мало строк с «план/ключ»)
  if ((!planValues || planValues.length < 2) && leadValues?.length) {
    const mapped = mapRows(leadValues);
    if (mapped.keys.includes('plan') || mapped.keys.includes('keyword')) {
      planValues = leadValues;
    }
  }

  if (!planValues || planValues.length < 2) {
    const snap: SheetPlanSnapshot = {
      ok: false,
      error:
        'Не удалось прочитать таблицу. Дайте доступ: «Все у кого есть ссылка — читатель» ' +
        'или GOOGLE_SERVICE_ACCOUNT_JSON + шаринг на email SA. Вкладка «План» обязательна.',
      source,
      offers: [],
      active: null,
      leads_rows: leadValues?.length || 0,
      fetched_at: new Date().toISOString(),
    };
    planCache.at = Date.now();
    planCache.snap = snap;
    return snap;
  }

  const planMapped = mapRows(planValues);
  const leadsMapped = leadValues?.length ? mapRows(leadValues) : {
    headers: [],
    keys: [],
    rows: [],
  };

  const offers: SheetPlanOffer[] = [];
  for (const row of planMapped.rows) {
    const product = row.product || null;
    const keyword = row.keyword || null;
    const deal = parseDeal(row.deal_type || 'кэшбек');
    const planSlots = parseNum(row.plan) ?? 0;
    let used = parseNum(row.used);
    if (used == null) {
      used = countUsedInLeads(leadsMapped.rows, {
        product_name: product,
        deal_type: deal,
        date: row.date || null,
      });
    }
    let left = parseNum(row.left);
    if (left == null) left = Math.max(0, planSlots - used);
    const statusRaw = row.status || null;
    const open = isOpenStatus(statusRaw || '', left);

    // пустые строки без товара/ключа/плана — мусор
    if (!product && !keyword && planSlots <= 0) continue;

    offers.push({
      date: row.date || null,
      deal_type: deal,
      product_name: product,
      keyword,
      cashback_pct: parseNum(row.cashback_pct),
      plan_slots: planSlots,
      used_slots: used,
      slots_left: left,
      order_deadline: row.deadline || null,
      is_open: open,
      status_raw: statusRaw,
      row_index: Number(row.__row) || 0,
    });
  }

  const active = pickActive(offers);
  const snap: SheetPlanSnapshot = {
    ok: true,
    source,
    offers,
    active,
    leads_rows: leadsMapped.rows.length,
    fetched_at: new Date().toISOString(),
  };
  planCache.at = Date.now();
  planCache.snap = snap;
  return snap;
}

/** Обновить alina_campaign из таблицы. */
export async function syncCampaignFromSheet(
  // deno-lint-ignore no-explicit-any
  upsert: (patch: Record<string, unknown>) => Promise<any>,
): Promise<SheetPlanSnapshot & { synced?: boolean }> {
  const snap = await fetchSheetPlan(true);
  if (!snap.ok) return { ...snap, synced: false };

  const a = snap.active;
  if (!a) {
    await upsert({
      is_open: false,
      slots_left: 0,
      notes: 'sheet: нет активных строк плана',
    });
    return { ...snap, synced: true };
  }

  const open = a.is_open && a.slots_left > 0;
  await upsert({
    is_open: open,
    deal_type: a.deal_type,
    product_name: a.product_name,
    keyword: a.keyword,
    cashback_pct: a.cashback_pct ?? 70,
    slots_left: a.slots_left,
    order_deadline: a.order_deadline,
    notes:
      `sheet ${snap.source}: план ${a.plan_slots}, занято ${a.used_slots}, ` +
      `статус «${a.status_raw || (open ? 'открыто' : 'закрыто')}»`,
  });
  return { ...snap, synced: true };
}

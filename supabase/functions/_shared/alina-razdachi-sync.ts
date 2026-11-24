/**
 * Запись прогресса клиента в его размеченную строку листа «Раздачи» (режим ALINA_RAZDACHI_ROWS=1).
 * Строки не добавляются, чужие значения не перезаписываются, результат пишется в журнал событий.
 */
import { type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { secretOrEnv } from './integration-secrets.ts';
import { googleAccessToken } from './alina-google-auth.ts';
import { getLastRazdachi, resolveActiveSheet } from './alina-sheet-plan.ts';
import {
  claimFreeRow,
  findClientRows,
  freeSlots,
  nearestFree,
  normModel,
  normTg,
  parseRazdachiSheet,
  type RazSheet,
  type SheetIO,
  todayMskKey,
  writeClientRow,
} from './alina-razdachi.ts';

type Lead = {
  id: string;
  chat_id?: number | null;
  username?: string | null;
  product_name?: string | null;
  order_price?: string | null;
  cashback_pct?: number | string | null;
  pickup_at?: string | null;
  review_planned_at?: string | null;
  review_note?: string | null;
  notes?: string | null;
  bank_details?: string | null;
  status?: string | null;
  keyword?: string | null;
  reels_url?: string | null;
  sheet_row?: number | null;
  sheet_target?: string | null;
};

const TARGET_PREFIX = 'razdachi|';

async function sheetsFetch(url: string, token: string, init?: RequestInit): Promise<Response | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(8000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers || {}) },
    }).catch(() => null);
    if (res && res.status !== 429 && res.status < 500) return res;
    if (attempt === 0) await new Promise((r) => setTimeout(r, 1200)); // квота или сбой Google: одна повторная попытка
  }
  return null;
}

function sheetIO(sheetId: string, token: string): SheetIO {
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values`;
  return {
    async read(range) {
      const res = await sheetsFetch(`${base}/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`, token);
      if (!res?.ok) return null;
      return ((await res.json().catch(() => null))?.values as string[][] | undefined) ?? [];
    },
    async batchWrite(updates) {
      const res = await sheetsFetch(`${base}:batchUpdate`, token, {
        method: 'POST',
        body: JSON.stringify({
          valueInputOption: 'RAW',
          data: updates.map((u) => ({ range: u.range, values: [[u.value]] })),
        }),
      });
      return Boolean(res?.ok);
    },
  };
}

/** Поля Алины для строки блогера. Модель, вид, ТГ и дата уже в строке и не пишутся. */
const RU_MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

/** Дата получения со скрина заказа («27 ноября», «27.11») → дд.мм.гггг. Пустая строка, если даты нет. */
export function parseDeliveryDate(text: string | null | undefined, now = Date.now()): string {
  const t = String(text ?? '').toLowerCase();
  const year = new Date(now + 3 * 3600_000).getUTCFullYear();
  let m = t.match(/(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)/);
  if (m) return `${m[1].padStart(2, '0')}.${String(RU_MONTHS.indexOf(m[2]) + 1).padStart(2, '0')}.${year}`;
  m = t.match(/(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?/);
  if (m) return `${m[1].padStart(2, '0')}.${m[2].padStart(2, '0')}.${m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : m[3]) : year}`;
  return '';
}

/** Дата интеграции из сообщения: «интеграция 28.11», «выйду 28 ноября», «выложу завтра». loose: годится и просто дата («28.11», «завтра»). Пусто, если даты нет. */
export function parseIntegrationDate(text: string | null | undefined, loose = false, now = Date.now()): string {
  const t = String(text ?? '').toLowerCase().replace(/ё/g, 'е');
  const ctx = /(интеграц|выйд|выход|выложу|опубликую|опубликовать|разместлю|размещу|рилс|рилз|reels|сторис|ролик)/.test(t);
  if (!ctx && !loose) return '';
  const day = (n: number) => {
    const d = new Date(now + 3 * 3600_000 + n * 86400_000);
    return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`;
  };
  if (/послезавтра/.test(t)) return day(2);
  if (/завтра/.test(t)) return day(1);
  if (/сегодня/.test(t)) return day(0);
  return parseDeliveryDate(t, now);
}

export function leadFields(lead: Lead & { order_received_at?: string | null }): Record<string, string> {
  return {
    price: String(lead.order_price ?? ''),
    pickup_plan: parseDeliveryDate(String(lead.order_received_at ?? '').split(' · ').pop()),
    size: String(lead.notes ?? '').match(/размер:(\S+)/)?.[1]?.replace(/_/g, ' ') ?? '',
    pickup_fact: String(lead.pickup_at ?? ''),
    review_date: String(lead.notes ?? '').match(/интеграция:(\S+)/)?.[1] ?? String(lead.review_planned_at ?? ''),
    review_kind: lead.review_note ? 'Получен' : '',
    published: lead.status === 'done' ? 'Да' : '',
    requisites: String(lead.bank_details ?? '').replace(/\s+/g, ' ').trim().slice(0, 200),
    responsible: 'Алина',
    key: String(lead.keyword ?? ''),
    reels: String(lead.reels_url ?? ''),
  };
}

/** Строки клиента на сегодня по последнему разбору листа. unavailable = лист ещё не читали или он не разобран. */
export function clientRowsToday(username: string | undefined | null): { state: 'unavailable' } | { state: 'ok'; rows: ReturnType<typeof findClientRows> } {
  const cached = getLastRazdachi();
  if (!cached) return { state: 'unavailable' };
  return { state: 'ok', rows: findClientRows(cached.sheet, username, todayMskKey()) };
}

export async function syncLeadToRazdachiRow(db: SupabaseClient, leadId: string): Promise<void> {
  const { data } = await db.from('alina_selfbuy_leads').select('*').eq('id', leadId).maybeSingle();
  const lead = data as Lead | null;
  if (!lead) return;
  const event = (type: string, payload: Record<string, unknown>) =>
    db.from('alina_selfbuy_events').insert({ lead_id: lead.id, chat_id: lead.chat_id ?? null, event_type: type, payload })
      .then(() => undefined, () => undefined);

  const tg = normTg(lead.username);
  if (!tg || !lead.product_name) {
    await event('razdachi_skip', { reason: !tg ? 'no_username' : 'no_model' });
    return;
  }
  const active = await resolveActiveSheet(db);
  const saJson = await secretOrEnv('GOOGLE_SERVICE_ACCOUNT_JSON');
  const cached = getLastRazdachi();
  if (!active?.sheet_id || !saJson || !cached || cached.sheetId !== active.sheet_id) {
    await event('razdachi_skip', { reason: 'sheet_unavailable' });
    return;
  }

  // Дата строки: сохранённая при первой записи (клиент может дописывать данные в следующие дни), иначе сегодняшняя.
  const stored = lead.sheet_target?.startsWith(TARGET_PREFIX) ? lead.sheet_target.split('|') : null;
  const tab = stored?.[1] || (active.cabinet_key === 'mars' ? 'Раздачи Пижам' : (Deno.env.get('ALINA_LEADS_TAB') || 'Раздачи').trim());
  const date = stored?.[2] || todayMskKey();
  const sheet: RazSheet = cached.sheet;
  const candidates = sheet.rows.filter((r) =>
    r.tg === tg && r.date === date && normModel(r.model) === normModel(lead.product_name)
  );
  if (!candidates.length && !stored) {
    await event('razdachi_unmatched', { username: tg, model: lead.product_name, date });
    return;
  }

  try {
    const token = await googleAccessToken(saJson);
    const res = await writeClientRow(
      sheetIO(active.sheet_id, token), tab, sheet,
      { tg, model: lead.product_name, date, hintRow: lead.sheet_row ?? candidates[0]?.row },
      leadFields(lead),
    );
    if (res.row) {
      await db.from('alina_selfbuy_leads').update({
        sheet_row: res.row, sheet_target: `${TARGET_PREFIX}${tab}|${date}`,
      }).eq('id', lead.id);
    }
    await event(res.status === 'written' || res.status === 'unchanged' ? 'razdachi_write' : 'razdachi_write_problem', {
      status: res.status, row: res.row ?? null, written: res.written, conflicts: res.conflicts,
    });
  } catch {
    console.error('[alina-razdachi] write failed');
    await event('razdachi_write_problem', { status: 'error' });
  }
}

// ── Места и бронь (владелец, 24 ноября 2026) ──
export type PlaceResult =
  | { kind: 'have' | 'claimed'; row: number; date: string }
  | { kind: 'later'; date: string; model: string }
  | { kind: 'none' }
  | { kind: 'unavailable' };

async function placeCtx(db: SupabaseClient) {
  const active = await resolveActiveSheet(db);
  const saJson = await secretOrEnv('GOOGLE_SERVICE_ACCOUNT_JSON');
  const cached = getLastRazdachi();
  if (!active?.sheet_id || !saJson || !cached || cached.sheetId !== active.sheet_id) return null;
  const tab = active.cabinet_key === 'mars' ? 'Раздачи Пижам' : (Deno.env.get('ALINA_LEADS_TAB') || 'Раздачи').trim();
  return { sheet: cached.sheet, tab, sheetId: active.sheet_id, saJson };
}

async function claimOn(db: SupabaseClient, lead: Lead, model: string, date: string, today: string): Promise<'claimed' | 'taken' | 'failed' | { row: number }> {
  const ctx = await placeCtx(db);
  const tg = normTg(lead.username);
  if (!ctx || !tg) return 'failed';
  // Перечитываем лист заново перед выбором: кэш мог устареть.
  const io = sheetIO(ctx.sheetId, await googleAccessToken(ctx.saJson));
  const fresh = await io.read(`'${ctx.tab.replace(/'/g, "''")}'!A1:AZ2000`);
  const sheet = (fresh && parseRazdachiSheet(fresh)) || ctx.sheet;
  const k = normModel(model);
  const own = sheet.rows.find((r) => r.tg === tg && r.date === date && normModel(r.model) === k);
  if (own) return { row: own.row };
  const free = freeSlots(sheet, today, 14).find((x) => x.date === date && normModel(x.model) === k);
  for (const cand of (free?.rows ?? []).slice(0, 3)) {
    const res = await claimFreeRow(io, ctx.tab, sheet, { row: cand.row, model: cand.model, date }, tg);
    if (res.status === 'claimed') {
      const cachedRow = ctx.sheet.rows.find((r) => r.row === cand.row);
      if (cachedRow) cachedRow.tg = tg;
      await db.from('alina_sheet_reservations').insert({ sheet_target: `${TARGET_PREFIX}${ctx.tab}|${date}`, sheet_row: cand.row, lead_id: lead.id, order_day: date })
        .then(() => undefined, () => undefined);
      await db.from('alina_selfbuy_events').insert({ lead_id: lead.id, chat_id: lead.chat_id ?? null, event_type: 'slot_booked', payload: { model, date, row: cand.row } })
        .then(() => undefined, () => undefined);
      return 'claimed';
    }
    if (res.status === 'failed' || res.status === 'unverified') return 'failed';
  }
  return 'taken';
}

/** Берёт место на сегодня сразу; если мест нет, возвращает ближайшую дату со свободным местом. */
export async function takePlaceToday(db: SupabaseClient, lead: Lead, model: string): Promise<PlaceResult> {
  const ctx = await placeCtx(db);
  if (!ctx || !normTg(lead.username)) return { kind: 'unavailable' };
  const today = todayMskKey();
  const r = await claimOn(db, lead, model, today, today);
  if (typeof r === 'object') return { kind: 'have', row: r.row, date: today };
  if (r === 'claimed') {
    const row = getLastRazdachi()?.sheet.rows.find((x) => x.tg === normTg(lead.username) && x.date === today && normModel(x.model) === normModel(model));
    return { kind: 'claimed', row: row?.row ?? 0, date: today };
  }
  if (r === 'failed') return { kind: 'unavailable' };
  const near = nearestFree(getLastRazdachi()?.sheet ?? ctx.sheet, model, today, 14);
  return near ? { kind: 'later', date: near.date, model: near.model } : { kind: 'none' };
}

/** Бронь на выбранную дату по согласию клиента. */
export async function bookPlace(db: SupabaseClient, lead: Lead, model: string, date: string): Promise<'claimed' | 'taken' | 'failed'> {
  const r = await claimOn(db, lead, model, date, todayMskKey());
  return typeof r === 'object' ? 'claimed' : r;
}

export { parseRazdachiSheet };

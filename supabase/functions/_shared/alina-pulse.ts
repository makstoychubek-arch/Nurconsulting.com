// «Пульт Алины» (Алина 2.0): картина дня для сайта. Только чтение: план по таблице, клиенты по шагам, кто ждёт ответа, лист ожидания, лента событий, настройки стража.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { googleAccessToken } from './alina-google-auth.ts';
import { secretOrEnv } from './integration-secrets.ts';
import { isFreeRow, parseRazdachiSheet, todayMskKey } from './alina-razdachi.ts';
import { sheetStatusOf } from './alina-razdachi-sync.ts';
import { ALINA_VERSION } from './alina-version.ts';

const SHEET_ID = '1ZSdNfnflgwOQZFSm1qcvfOB94bnfipZu5fB3pDodrik';
const TAB = 'Раздачи Пижам';
const FEED_TYPES: Record<string, string> = {
  slot_booked: 'место закреплено', tz_sent: 'отправлены условия', bank_done: 'реквизиты получены', pickup: 'забрал заказ', pickup_date: 'дата забора записана',
  not_found_released: 'не нашёл товар, место освобождено', size_missing_released: 'нет размера, место освобождено', pants_muted: 'про штаны, Алина молчит',
  waitlist_offer: 'место предложено из листа ожидания', waitlist_offer_dry: 'пробно: место предложили бы', silence_alert: 'ждёт ответа, оповещение менеджерам',
  main_photo_sent: 'отправлено главное фото', intent_resolved: 'короткий ответ распознан', manager_escalated: 'вопрос передан менеджеру',
};

let sheetCache: { at: number; value: { total: number; taken: number; ordered: number; free: number; freeModels: string[] } | null } = { at: 0, value: null };

async function planToday() {
  if (sheetCache.value && Date.now() - sheetCache.at < 60_000) return sheetCache.value;
  try {
    const sa = await secretOrEnv('GOOGLE_SERVICE_ACCOUNT_JSON');
    const token = sa ? await googleAccessToken(sa) : '';
    if (!token) return null;
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(`'${TAB}'!A1:Z2000`)}?valueRenderOption=FORMATTED_VALUE`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const sheet = parseRazdachiSheet(((await res.json())?.values || []) as string[][]);
    if (!sheet) return null;
    const today = todayMskKey();
    const rows = sheet.rows.filter((r) => r.date === today);
    const priceIdx = sheet.col.price;
    const free = rows.filter(isFreeRow);
    const v = {
      total: rows.length, taken: rows.filter((r) => r.tg).length,
      ordered: priceIdx == null ? 0 : rows.filter((r) => String(r.cells[priceIdx] ?? '').trim() !== '').length,
      free: free.length, freeModels: [...new Set(free.map((r) => r.model))],
    };
    sheetCache = { at: Date.now(), value: v };
    return v;
  } catch { return null; }
}

export async function buildPulse(admin: SupabaseClient) {
  const now = Date.now();
  const dayStart = new Date(Date.UTC(...(() => { const m = new Date(now + 3 * 3600_000); return [m.getUTCFullYear(), m.getUTCMonth(), m.getUTCDate()] as [number, number, number]; })()) - 3 * 3600_000).toISOString();
  const [plan, leadsR, feedR, guardR, noSlotsR, offersR] = await Promise.all([
    planToday(),
    admin.from('alina_selfbuy_leads').select('chat_id, username, status, product_name, updated_at').gt('updated_at', new Date(now - 36 * 3600_000).toISOString()).not('username', 'is', null).order('updated_at', { ascending: false }).limit(80),
    admin.from('alina_selfbuy_events').select('created_at, chat_id, event_type, payload').in('event_type', Object.keys(FEED_TYPES)).gt('created_at', new Date(now - 6 * 3600_000).toISOString()).order('created_at', { ascending: false }).limit(25),
    admin.from('alina_settings').select('value').eq('key', 'guardian').maybeSingle(),
    admin.from('alina_selfbuy_events').select('chat_id').eq('event_type', 'closed_no_slots').gt('created_at', dayStart).limit(300),
    admin.from('alina_selfbuy_events').select('created_at, chat_id, payload').in('event_type', ['waitlist_offer', 'waitlist_offer_dry']).gt('created_at', dayStart).order('created_at', { ascending: false }).limit(5),
  ]);
  const leads = (leadsR.data || []) as Array<{ chat_id: number; username: string; status: string; product_name: string | null; updated_at: string }>;
  const chatIds = [...new Set(leads.map((l) => l.chat_id))].slice(0, 60);
  // Последнее сообщение каждого чата: кто писал последним и когда
  const { data: logs } = chatIds.length ? await admin.from('alina_selfbuy_events').select('chat_id, created_at, payload').eq('event_type', 'chat_log').in('chat_id', chatIds)
    .gt('created_at', new Date(now - 24 * 3600_000).toISOString()).order('created_at', { ascending: false }).limit(600) : { data: [] };
  const lastLog = new Map<number, { created_at: string; dir: string }>();
  for (const e of (logs || []) as Array<{ chat_id: number; created_at: string; payload: { dir?: string } }>) if (!lastLog.has(e.chat_id)) lastLog.set(e.chat_id, { created_at: e.created_at, dir: String(e.payload?.dir || '') });
  const seen = new Set<number>();
  const clients = leads.filter((l) => !seen.has(l.chat_id) && seen.add(l.chat_id)).map((l) => {
    const ll = lastLog.get(l.chat_id);
    const waitMin = ll && ll.dir === 'client' ? Math.round((now - Date.parse(ll.created_at)) / 60_000) : 0;
    return { username: l.username, model: String(l.product_name || '').replace(/^Пижама\s+/i, ''), step: sheetStatusOf(l.status) || (l.status === 'closed' ? 'закрыто' : l.status), status: l.status, waitMin, updated: l.updated_at };
  }).sort((a, b) => b.waitMin - a.waitMin || Date.parse(b.updated) - Date.parse(a.updated)).slice(0, 30);
  const noSlotChats = new Set(((noSlotsR.data || []) as Array<{ chat_id: number }>).map((x) => x.chat_id));
  const nameOf = new Map(leads.map((l) => [l.chat_id, l.username]));
  const feed = ((feedR.data || []) as Array<{ created_at: string; chat_id: number; event_type: string }>).map((e) => ({
    at: e.created_at, who: nameOf.get(e.chat_id) ? '@' + nameOf.get(e.chat_id) : `чат ${e.chat_id}`, what: FEED_TYPES[e.event_type] || e.event_type, kind: e.event_type,
  }));
  const g = ((guardR.data as { value?: Record<string, unknown> } | null)?.value) || {};
  return {
    ok: true, version: ALINA_VERSION, now: new Date(now).toISOString(), today: todayMskKey(), plan,
    waiting: clients.filter((c) => c.waitMin >= 4).length, clients, feed,
    waitlist: { size: noSlotChats.size, offers: ((offersR.data || []) as Array<{ created_at: string; chat_id: number; payload: { model?: string } }>).map((o) => ({ at: o.created_at, who: nameOf.get(o.chat_id) ? '@' + nameOf.get(o.chat_id) : `чат ${o.chat_id}`, model: o.payload?.model || '' })) },
    guardian: { watchdog: g.watchdog !== false, waitlist: String(g.waitlist || 'dry') },
  };
}

/** Настройки стража: watchdog (вкл/выкл), waitlist (off/dry/live). */
export async function setGuardian(admin: SupabaseClient, patch: { watchdog?: unknown; waitlist?: unknown }) {
  const { data } = await admin.from('alina_settings').select('value').eq('key', 'guardian').maybeSingle();
  const cur = ((data as { value?: Record<string, unknown> } | null)?.value) || {};
  const next: Record<string, unknown> = { watchdog: true, waitlist: 'dry', ...cur };
  if (typeof patch.watchdog === 'boolean') next.watchdog = patch.watchdog;
  if (patch.waitlist === 'off' || patch.waitlist === 'dry' || patch.waitlist === 'live') next.waitlist = patch.waitlist;
  const { error } = await admin.from('alina_settings').upsert({ key: 'guardian', value: next });
  return { ok: !error, guardian: next };
}

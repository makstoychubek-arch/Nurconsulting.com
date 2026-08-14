/**
 * Низкоуровневые вызовы WB Content API + User Management
 * по официальному OpenAPI: https://dev.wildberries.ru/docs/openapi/
 */

import { sanitizeWbToken } from './wb-cabinet-tokens.ts';
import { getAdminClient } from './supabase-admin.ts';

export const CONTENT_API = 'https://content-api.wildberries.ru';
export const USERS_API = 'https://user-management-api.wildberries.ru';

export type WbCard = {
  nmID: number;
  imtID?: number;
  vendorCode: string;
  brand?: string;
  title?: string;
  description?: string;
  subjectID?: number;
  subjectName?: string;
  dimensions?: Record<string, unknown>;
  characteristics?: Array<{ id: number; name?: string; value: unknown }>;
  sizes?: Array<{
    chrtID?: number;
    techSize?: string;
    wbSize?: string;
    skus?: string[];
  }>;
};

export async function cabinetTokenById(
  cabinetId: string,
): Promise<{ token: string; name: string } | null> {
  const db = getAdminClient();
  const { data } = await db
    .from('cabinets')
    .select('name, wb_token')
    .eq('id', cabinetId)
    .maybeSingle();
  const token = sanitizeWbToken(data?.wb_token);
  if (!token || !data?.name) return null;
  return { token, name: String(data.name) };
}

async function wbJson(
  url: string,
  token: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(init?.headers || {}),
      },
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data: data as Record<string, unknown> };
  } catch (e) {
    console.error('[wb-api]', url, e);
    return { ok: false, status: 0, data: { errorText: String(e) } };
  }
}

/** Поиск карточки по nmID или тексту. */
export async function fetchCardsList(
  token: string,
  opts: { textSearch?: string; limit?: number } = {},
): Promise<WbCard[]> {
  const limit = Math.min(100, Math.max(1, opts.limit || 20));
  const filter: Record<string, unknown> = { withPhoto: -1 };
  if (opts.textSearch) filter.textSearch = String(opts.textSearch).slice(0, 100);

  const { ok, data } = await wbJson(`${CONTENT_API}/content/v2/get/cards/list`, token, {
    method: 'POST',
    body: JSON.stringify({
      settings: { cursor: { limit }, filter },
    }),
  });
  if (!ok) return [];
  const cards = Array.isArray(data.cards) ? data.cards : [];
  return cards.map((c) => normalizeCard(c as Record<string, unknown>));
}

function normalizeCard(c: Record<string, unknown>): WbCard {
  return {
    nmID: Number(c.nmID || c.nmId || 0),
    imtID: c.imtID != null ? Number(c.imtID) : undefined,
    vendorCode: String(c.vendorCode || ''),
    brand: c.brand != null ? String(c.brand) : '',
    title: c.title != null ? String(c.title) : '',
    description: c.description != null ? String(c.description) : '',
    subjectID: c.subjectID != null ? Number(c.subjectID) : undefined,
    subjectName: c.subjectName != null ? String(c.subjectName) : undefined,
    dimensions: (c.dimensions as Record<string, unknown>) || undefined,
    characteristics: Array.isArray(c.characteristics)
      ? (c.characteristics as WbCard['characteristics'])
      : [],
    sizes: Array.isArray(c.sizes) ? (c.sizes as WbCard['sizes']) : [],
  };
}

export async function findCardByNm(
  token: string,
  nmId: number,
): Promise<WbCard | null> {
  const cards = await fetchCardsList(token, {
    textSearch: String(nmId),
    limit: 20,
  });
  return cards.find((c) => c.nmID === nmId) || null;
}

/** Поиск предмета (категории) по названию. */
export async function searchSubjects(
  token: string,
  name: string,
): Promise<Array<{ id: number; name: string; parentName?: string }>> {
  const q = encodeURIComponent(name.slice(0, 80));
  const { ok, data } = await wbJson(
    `${CONTENT_API}/content/v2/object/all?locale=ru&name=${q}&limit=30&offset=0`,
    token,
    { method: 'GET' },
  );
  if (!ok) return [];
  const rows = Array.isArray(data.data) ? data.data : [];
  return rows
    .map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id: Number(row.subjectID || row.id || 0),
        name: String(row.subjectName || row.name || ''),
        parentName: row.parentName ? String(row.parentName) : undefined,
      };
    })
    .filter((r) => r.id > 0 && r.name);
}

export async function subjectCharcs(
  token: string,
  subjectId: number,
): Promise<Array<{ id: number; name: string; required: boolean }>> {
  const { ok, data } = await wbJson(
    `${CONTENT_API}/content/v2/object/charcs/${subjectId}?locale=ru`,
    token,
    { method: 'GET' },
  );
  if (!ok) return [];
  const rows = Array.isArray(data.data) ? data.data : [];
  return rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: Number(row.charcID || row.id || 0),
      name: String(row.name || ''),
      required: Boolean(row.required),
    };
  }).filter((r) => r.id > 0);
}

/** Генерация баркодов. */
export async function generateBarcodes(
  token: string,
  count: number,
): Promise<string[]> {
  const n = Math.min(100, Math.max(1, count));
  const { ok, data } = await wbJson(`${CONTENT_API}/content/v2/barcodes`, token, {
    method: 'POST',
    body: JSON.stringify({ count: n }),
  });
  if (!ok) return [];
  const list = Array.isArray(data.data) ? data.data : [];
  return list.map(String).filter(Boolean);
}

/** Создание карточек (async queue). */
export async function uploadCards(
  token: string,
  payload: unknown[],
): Promise<{ ok: boolean; errorText: string }> {
  const { ok, data, status } = await wbJson(
    `${CONTENT_API}/content/v2/cards/upload`,
    token,
    { method: 'POST', body: JSON.stringify(payload) },
  );
  if (ok) return { ok: true, errorText: '' };
  const err = String(
    data.errorText || data.message || data.detail || `HTTP ${status}`,
  );
  return { ok: false, errorText: err.slice(0, 400) };
}

/**
 * Обновление карточки (полное перезаписывание — шлём всю карточку).
 * SEO = title + description; бренд = brand.
 */
export async function updateCards(
  token: string,
  cards: unknown[],
): Promise<{ ok: boolean; errorText: string }> {
  const { ok, data, status } = await wbJson(
    `${CONTENT_API}/content/v2/cards/update`,
    token,
    { method: 'POST', body: JSON.stringify(cards) },
  );
  if (ok) return { ok: true, errorText: '' };
  const err = String(
    data.errorText || data.message || data.detail || `HTTP ${status}`,
  );
  return { ok: false, errorText: err.slice(0, 400) };
}

export async function listCardErrors(
  token: string,
): Promise<string[]> {
  const { ok, data } = await wbJson(
    `${CONTENT_API}/content/v2/cards/error/list`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({ cursor: { limit: 10 }, order: { ascending: false } }),
    },
  );
  if (!ok) return [];
  const items = Array.isArray((data.data as Record<string, unknown>)?.items)
    ? ((data.data as Record<string, unknown>).items as Array<Record<string, unknown>>)
    : Array.isArray(data.data)
    ? (data.data as Array<Record<string, unknown>>)
    : [];
  const out: string[] = [];
  for (const it of items.slice(0, 5)) {
    const errors = it.errors;
    if (errors && typeof errors === 'object') {
      for (const [vc, msgs] of Object.entries(errors as Record<string, unknown>)) {
        const m = Array.isArray(msgs) ? msgs.join('; ') : String(msgs);
        out.push(`${vc}: ${m}`);
      }
    }
  }
  return out;
}

/** Приглашение пользователя в кабинет продавца. */
export async function createUserInvite(
  token: string,
  phoneNumber: string,
  position = 'Сотрудник',
): Promise<{ ok: boolean; inviteUrl?: string; inviteID?: string; errorText?: string }> {
  const phone = normalizeRuPhone(phoneNumber);
  if (!phone) {
    return { ok: false, errorText: 'Нужен телефон в формате 79XXXXXXXXX' };
  }
  const { ok, data, status } = await wbJson(`${USERS_API}/api/v1/invite`, token, {
    method: 'POST',
    body: JSON.stringify({
      invite: { phoneNumber: phone, position: position.slice(0, 150) },
      access: [],
    }),
  });
  if (!ok) {
    return {
      ok: false,
      errorText: String(
        data.errorText || data.message || data.detail || `HTTP ${status}`,
      ).slice(0, 400),
    };
  }
  return {
    ok: Boolean(data.isSuccess !== false),
    inviteUrl: data.inviteUrl ? String(data.inviteUrl) : undefined,
    inviteID: data.inviteID ? String(data.inviteID) : undefined,
    errorText: data.isSuccess === false ? 'Повтори запрос' : undefined,
  };
}

export async function listCabinetUsers(
  token: string,
  inviteOnly = false,
): Promise<Array<{ id: number; name: string; phone: string; role?: string }>> {
  const q = `limit=50&offset=0${inviteOnly ? '&isInviteOnly=true' : ''}`;
  const { ok, data } = await wbJson(`${USERS_API}/api/v1/users?${q}`, token, {
    method: 'GET',
  });
  if (!ok) return [];
  const users = Array.isArray(data.users) ? data.users : [];
  return users.map((u) => {
    const row = u as Record<string, unknown>;
    const first = String(row.firstName || '');
    const second = String(row.secondName || row.lastName || '');
    return {
      id: Number(row.id || row.userId || 0),
      name: `${first} ${second}`.trim() || 'без имени',
      phone: String(row.phone || row.phoneNumber || ''),
      role: row.position ? String(row.position) : undefined,
    };
  }).filter((u) => u.id > 0);
}

export async function deleteCabinetUser(
  token: string,
  userId: number,
): Promise<{ ok: boolean; errorText?: string }> {
  const { ok, data, status } = await wbJson(
    `${USERS_API}/api/v1/user?deletedUserID=${userId}`,
    token,
    { method: 'DELETE' },
  );
  if (ok) return { ok: true };
  return {
    ok: false,
    errorText: String(data.errorText || data.message || `HTTP ${status}`).slice(0, 300),
  };
}

/** 79XXXXXXXXX из типичных вводов. */
export function normalizeRuPhone(raw: string): string | null {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return null;
  let d = digits;
  if (d.length === 11 && d.startsWith('8')) d = '7' + d.slice(1);
  if (d.length === 10 && d.startsWith('9')) d = '7' + d;
  if (d.length === 11 && d.startsWith('7')) return d;
  return null;
}

/** Размеры «с 40 по 54» → [40,42,…,54] (шаг 2 для одежды) или подряд. */
export function parseSizeRange(text: string): string[] | null {
  const t = String(text || '').toLowerCase().replace(/ё/g, 'е');
  const m = t.match(
    /(?:размер\w*|разм\.?)?\s*(?:с|от)?\s*(\d{2,3})\s*(?:по|до|-|–|—)\s*(\d{2,3})/i,
  );
  if (!m) {
    const list = t.match(/\bразмеры?\s*((?:\d{2,3}[\s,ии]+){1,20}\d{2,3})/i);
    if (list) {
      const nums = list[1].match(/\d{2,3}/g) || [];
      return nums.length ? [...new Set(nums)] : null;
    }
    return null;
  }
  let a = Number(m[1]);
  let b = Number(m[2]);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a > b) return null;
  if (b - a > 40) return null;
  const step = (a % 2 === 0 && b % 2 === 0 && b - a >= 4) ? 2 : 1;
  const out: string[] = [];
  for (let n = a; n <= b; n += step) out.push(String(n));
  return out.length ? out : null;
}

export function extractNmId(text: string): number | null {
  const m = String(text || '').match(
    /(?:^|[^\d])(?:нм|nm|арт(?:икул)?\.?|карточки?\s*)\s*[#:]?\s*(\d{6,12})(?:[^\d]|$)/i,
  ) ||
    String(text || '').match(/(?:^|[^\d])(\d{7,12})(?:[^\d]|$)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function cardToUpdatePayload(card: WbCard, patch: {
  title?: string;
  description?: string;
  brand?: string;
}): Record<string, unknown> {
  return {
    nmID: card.nmID,
    vendorCode: card.vendorCode,
    brand: patch.brand != null ? patch.brand : (card.brand || ''),
    title: patch.title != null ? patch.title : (card.title || ''),
    description: patch.description != null
      ? patch.description
      : (card.description || ''),
    dimensions: card.dimensions || {
      length: 30,
      width: 25,
      height: 5,
      weightBrutto: 0.4,
    },
    characteristics: (card.characteristics || []).map((c) => ({
      id: c.id,
      value: c.value,
    })),
    sizes: (card.sizes || []).map((s) => ({
      chrtID: s.chrtID,
      techSize: s.techSize,
      wbSize: s.wbSize,
      skus: s.skus || [],
    })),
  };
}

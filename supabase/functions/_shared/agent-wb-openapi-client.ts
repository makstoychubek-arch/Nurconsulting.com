/**
 * Полный клиент дневных методов WB OpenAPI по доменам.
 * Офф-док: https://dev.wildberries.ru/docs/openapi/api-information
 *
 * Роли:
 *  saule  — content cards, prices, stats sales/orders, analytics funnel
 *  amina  — advert
 *  anton  — marketplace FBS/stocks/orders, supplies
 *  alina  — feedbacks/questions, returns
 *  karina — common/seller-info/tariffs/users/finance/docs
 *  muha   — content media
 */

export type WbHttpResult = {
  ok: boolean;
  status: number;
  data: unknown;
  errorText: string;
};

async function wbFetch(
  token: string,
  method: string,
  url: string,
  body?: unknown,
): Promise<WbHttpResult> {
  try {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: token,
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(35000),
    });
    const text = await res.text();
    let data: unknown = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text.slice(0, 500) };
    }
    const err = !res.ok
      ? String(
        (data as Record<string, unknown>)?.errorText ||
          (data as Record<string, unknown>)?.detail ||
          (data as Record<string, unknown>)?.title ||
          `HTTP ${res.status}`,
      ).slice(0, 400)
      : '';
    return { ok: res.ok, status: res.status, data, errorText: err };
  } catch (e) {
    return { ok: false, status: 0, data: {}, errorText: String(e).slice(0, 300) };
  }
}

export const WB_HOSTS = {
  content: 'https://content-api.wildberries.ru',
  prices: 'https://discounts-prices-api.wildberries.ru',
  marketplace: 'https://marketplace-api.wildberries.ru',
  statistics: 'https://statistics-api.wildberries.ru',
  advert: 'https://advert-api.wildberries.ru',
  feedbacks: 'https://feedbacks-api.wildberries.ru',
  analytics: 'https://seller-analytics-api.wildberries.ru',
  common: 'https://common-api.wildberries.ru',
  users: 'https://user-management-api.wildberries.ru',
  supplies: 'https://supplies-api.wildberries.ru',
  returns: 'https://returns-api.wildberries.ru',
  finance: 'https://finance-api.wildberries.ru',
  documents: 'https://documents-api.wildberries.ru',
  chat: 'https://buyer-chat-api.wildberries.ru',
  calendar: 'https://dp-calendar-api.wildberries.ru',
} as const;

/** Ping всех категорий — диагностика токена. */
export async function pingAllCategories(
  token: string,
): Promise<Array<{ host: string; ok: boolean; status: number }>> {
  const hosts = Object.values(WB_HOSTS).filter((h) => !h.includes('calendar'));
  const out: Array<{ host: string; ok: boolean; status: number }> = [];
  for (const base of hosts) {
    const r = await wbFetch(token, 'GET', `${base}/ping`);
    out.push({ host: base.replace('https://', ''), ok: r.ok, status: r.status });
  }
  return out;
}

// ─── Common / Karina ─────────────────────────────────────────────────────────
export const commonApi = {
  sellerInfo: (t: string) => wbFetch(t, 'GET', `${WB_HOSTS.common}/api/v1/seller-info`),
  rating: (t: string) => wbFetch(t, 'GET', `${WB_HOSTS.common}/api/common/v1/rating`),
  subscriptions: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.common}/api/common/v1/subscriptions`),
  news: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.common}/api/communications/v2/news?limit=5`),
  tariffsCommission: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.common}/api/v1/tariffs/commission?locale=ru`),
  tariffsBox: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.common}/api/v1/tariffs/box?date=${new Date().toISOString().slice(0, 10)}`),
  acceptanceCoeff: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.common}/api/tariffs/v1/acceptance/coefficients`),
};

export const usersApi = {
  list: (t: string, inviteOnly = false) =>
    wbFetch(
      t,
      'GET',
      `${WB_HOSTS.users}/api/v1/users?limit=50&offset=0${inviteOnly ? '&isInviteOnly=true' : ''}`,
    ),
  invite: (t: string, phone: string, position = 'Сотрудник') =>
    wbFetch(t, 'POST', `${WB_HOSTS.users}/api/v1/invite`, {
      invite: { phoneNumber: phone, position },
      access: [],
    }),
  deleteUser: (t: string, userId: number) =>
    wbFetch(t, 'DELETE', `${WB_HOSTS.users}/api/v1/user?deletedUserID=${userId}`),
  updateAccess: (t: string, usersAccesses: unknown[]) =>
    wbFetch(t, 'PUT', `${WB_HOSTS.users}/api/v1/users/access`, { usersAccesses }),
};

export const financeApi = {
  balance: (t: string) => wbFetch(t, 'GET', `${WB_HOSTS.finance}/api/v1/account/balance`),
};

export const documentsApi = {
  list: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.documents}/api/v1/documents/list?locale=ru&limit=10&offset=0`),
};

// ─── Content / Saule + Muha ──────────────────────────────────────────────────
export const contentApi = {
  cardsList: (t: string, limit = 10, textSearch?: string) =>
    wbFetch(t, 'POST', `${WB_HOSTS.content}/content/v2/get/cards/list`, {
      settings: {
        cursor: { limit },
        filter: { withPhoto: -1, ...(textSearch ? { textSearch } : {}) },
      },
    }),
  cardsLimits: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.content}/content/v2/cards/limits`),
  subjects: (t: string, name: string) =>
    wbFetch(
      t,
      'GET',
      `${WB_HOSTS.content}/content/v2/object/all?locale=ru&name=${encodeURIComponent(name)}&limit=20`,
    ),
  parentSubjects: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.content}/content/v2/object/parent/all?locale=ru`),
  charcs: (t: string, subjectId: number) =>
    wbFetch(t, 'GET', `${WB_HOSTS.content}/content/v2/object/charcs/${subjectId}?locale=ru`),
  barcodes: (t: string, count: number) =>
    wbFetch(t, 'POST', `${WB_HOSTS.content}/content/v2/barcodes`, { count }),
  cardsUpload: (t: string, body: unknown) =>
    wbFetch(t, 'POST', `${WB_HOSTS.content}/content/v2/cards/upload`, body),
  cardsUpdate: (t: string, body: unknown) =>
    wbFetch(t, 'POST', `${WB_HOSTS.content}/content/v2/cards/update`, body),
  cardsErrorList: (t: string) =>
    wbFetch(t, 'POST', `${WB_HOSTS.content}/content/v2/cards/error/list`, {
      cursor: { limit: 10 },
      order: { ascending: false },
    }),
  cardsTrash: (t: string, nmIDs: number[]) =>
    wbFetch(t, 'POST', `${WB_HOSTS.content}/content/v2/cards/delete/trash`, { nmIDs }),
  cardsRecover: (t: string, nmIDs: number[]) =>
    wbFetch(t, 'POST', `${WB_HOSTS.content}/content/v2/cards/recover`, { nmIDs }),
  tags: (t: string) => wbFetch(t, 'GET', `${WB_HOSTS.content}/content/v2/tags`),
  mediaSave: (t: string, nmId: number, data: string[]) =>
    wbFetch(t, 'POST', `${WB_HOSTS.content}/content/v3/media/save`, { nmId, data }),
};

// ─── Prices / Saule ──────────────────────────────────────────────────────────
export const pricesApi = {
  listGoods: (t: string, limit = 10) =>
    wbFetch(t, 'GET', `${WB_HOSTS.prices}/api/v2/list/goods/filter?limit=${limit}`),
  goodsByNm: (t: string, nmList: number[]) =>
    wbFetch(t, 'POST', `${WB_HOSTS.prices}/api/v2/list/goods/filter`, { nmList }),
  uploadTask: (t: string, data: unknown[]) =>
    wbFetch(t, 'POST', `${WB_HOSTS.prices}/api/v2/upload/task`, { data }),
  historyTasks: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.prices}/api/v2/history/tasks`),
  bufferTasks: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.prices}/api/v2/buffer/tasks`),
  quarantine: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.prices}/api/v2/quarantine/goods?limit=10&offset=0`),
};

export const calendarApi = {
  promotions: (t: string) =>
    wbFetch(
      t,
      'GET',
      `${WB_HOSTS.calendar}/api/v1/calendar/promotions?startDateTime=${encodeURIComponent(new Date().toISOString())}&endDateTime=${encodeURIComponent(new Date(Date.now() + 30 * 864e5).toISOString())}`,
    ),
};

// ─── Marketplace / Anton ─────────────────────────────────────────────────────
export const marketApi = {
  warehouses: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.marketplace}/api/v3/warehouses`),
  offices: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.marketplace}/api/v3/offices`),
  stocksGet: (t: string, warehouseId: number, skus: string[]) =>
    wbFetch(t, 'POST', `${WB_HOSTS.marketplace}/api/v3/stocks/${warehouseId}`, { skus }),
  stocksPut: (t: string, warehouseId: number, stocks: Array<{ sku: string; amount: number }>) =>
    wbFetch(t, 'PUT', `${WB_HOSTS.marketplace}/api/v3/stocks/${warehouseId}`, { stocks }),
  ordersNew: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.marketplace}/api/v3/orders/new`),
  orders: (t: string, limit = 50, next = 0) =>
    wbFetch(t, 'GET', `${WB_HOSTS.marketplace}/api/v3/orders?limit=${limit}&next=${next}`),
  ordersStatus: (t: string, orders: number[]) =>
    wbFetch(t, 'POST', `${WB_HOSTS.marketplace}/api/v3/orders/status`, { orders }),
  supplies: (t: string, limit = 20, next = 0) =>
    wbFetch(t, 'GET', `${WB_HOSTS.marketplace}/api/v3/supplies?limit=${limit}&next=${next}`),
  supplyCreate: (t: string, name: string) =>
    wbFetch(t, 'POST', `${WB_HOSTS.marketplace}/api/v3/supplies`, { name }),
};

export const suppliesApi = {
  warehouses: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.supplies}/api/v1/warehouses`),
};

// ─── Stats / Analytics / Saule ───────────────────────────────────────────────
export const statsApi = {
  orders: (t: string, dateFrom: string) =>
    wbFetch(
      t,
      'GET',
      `${WB_HOSTS.statistics}/api/v1/supplier/orders?dateFrom=${encodeURIComponent(dateFrom)}&flag=0`,
    ),
  sales: (t: string, dateFrom: string) =>
    wbFetch(
      t,
      'GET',
      `${WB_HOSTS.statistics}/api/v1/supplier/sales?dateFrom=${encodeURIComponent(dateFrom)}&flag=0`,
    ),
};

export const analyticsApi = {
  salesFunnel: (t: string, nmIds: number[], start: string, end: string) =>
    wbFetch(t, 'POST', `${WB_HOSTS.analytics}/api/analytics/v3/sales-funnel/products`, {
      selectedPeriod: { start, end },
      nmIds,
      skipDeletedNm: true,
    }),
};

// ─── Advert / Amina ──────────────────────────────────────────────────────────
export const advertApi = {
  count: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.advert}/adv/v1/promotion/count`),
  balance: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.advert}/adv/v1/balance`),
  start: (t: string, id: number) =>
    wbFetch(t, 'GET', `${WB_HOSTS.advert}/adv/v0/start?id=${id}`),
  pause: (t: string, id: number) =>
    wbFetch(t, 'GET', `${WB_HOSTS.advert}/adv/v0/pause?id=${id}`),
  budget: (t: string, id: number) =>
    wbFetch(t, 'GET', `${WB_HOSTS.advert}/adv/v1/budget?id=${id}`),
};

// ─── Feedbacks / Alina ───────────────────────────────────────────────────────
export const feedbacksApi = {
  unansweredCount: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.feedbacks}/api/v1/feedbacks/count-unanswered`),
  newFlags: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.feedbacks}/api/v1/new-feedbacks-questions`),
  feedbacks: (t: string, isAnswered = false) =>
    wbFetch(
      t,
      'GET',
      `${WB_HOSTS.feedbacks}/api/v1/feedbacks?isAnswered=${isAnswered}&take=10&skip=0`,
    ),
  questions: (t: string, isAnswered = false) =>
    wbFetch(
      t,
      'GET',
      `${WB_HOSTS.feedbacks}/api/v1/questions?isAnswered=${isAnswered}&take=10&skip=0`,
    ),
  answerFeedback: (t: string, id: string, text: string) =>
    wbFetch(t, 'POST', `${WB_HOSTS.feedbacks}/api/v1/feedbacks/answer`, { id, text }),
  answerQuestion: (t: string, id: string, answer: { text: string }) =>
    wbFetch(t, 'PATCH', `${WB_HOSTS.feedbacks}/api/v1/questions`, {
      id,
      answer: { text: answer.text },
      wasViewed: true,
    }),
};

export const returnsApi = {
  claims: (t: string) =>
    wbFetch(
      t,
      'GET',
      `${WB_HOSTS.returns}/api/v1/claims?is_archive=false&limit=10&offset=0`,
    ),
};

export const chatApi = {
  chats: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.chat}/api/v1/seller/chats`),
};

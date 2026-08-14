/**
 * WB OpenAPI client — typed day-to-day API + hosts.
 *
 * Полный каталог всех ~309 операций сайта: `agent-wb-openapi-registry.ts`
 * (callWbEndpoint). Здесь — удобные typed-хелперы под роли ботов + мутации диалогов.
 *
 * Роли:
 *  saule  — content, prices, stats, analytics
 *  amina  — advert + calendar promotions
 *  anton  — marketplace FBS + supplies FBW (+ DBW/DBS в registry)
 *  alina  — feedbacks/questions/returns/chat
 *  karina — common/users/finance/docs/tariffs
 *  muha   — content media/tags
 */

export type WbHttpResult = {
  ok: boolean;
  status: number;
  data: unknown;
  errorText: string;
  headers?: Record<string, string>;
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
      signal: AbortSignal.timeout(45000),
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
          (data as Record<string, unknown>)?.error ||
          `HTTP ${res.status}`,
      ).slice(0, 400)
      : '';
    const headers: Record<string, string> = {};
    for (const k of [
      'x-ratelimit-remaining',
      'x-ratelimit-retry',
      'x-ratelimit-reset',
      'x-ratelimit-limit',
    ]) {
      const v = res.headers.get(k);
      if (v) headers[k] = v;
    }
    return { ok: res.ok, status: res.status, data, errorText: err, headers };
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
  /** Медиа-РК (отдельный хост от обычного advert-api). */
  advertMedia: 'https://advert-media-api.wildberries.ru',
  /** WB Digital (цифровые товары) — отдельный продукт. */
  digital: 'https://devapi-digital.wildberries.ru',
} as const;

/** Sleep helper for probes (respect rate limits). */
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Ping всех категорий — диагностика токена. */
export async function pingAllCategories(
  token: string,
): Promise<Array<{ host: string; ok: boolean; status: number; errorText: string }>> {
  const hosts = Object.entries(WB_HOSTS).filter(([k]) => k !== 'calendar' && k !== 'digital');
  const out: Array<{ host: string; ok: boolean; status: number; errorText: string }> = [];
  for (const [, base] of hosts) {
    const r = await wbFetch(token, 'GET', `${base}/ping`);
    out.push({
      host: base.replace('https://', ''),
      ok: r.ok,
      status: r.status,
      errorText: r.errorText,
    });
    await sleep(250);
  }
  return out;
}

// ─── Common / Karina ─────────────────────────────────────────────────────────
export const commonApi = {
  sellerInfo: (t: string) => wbFetch(t, 'GET', `${WB_HOSTS.common}/api/v1/seller-info`),
  /** Рейтинг живёт на feedbacks-api (не common!). */
  rating: (t: string) => wbFetch(t, 'GET', `${WB_HOSTS.feedbacks}/api/common/v1/rating`),
  /** Jam / конструктор — часто только service-токен (personal → 403). */
  subscriptions: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.common}/api/common/v1/subscriptions`),
  tariffConstructor: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.common}/api/common/v1/tariff-constructor/options`),
  news: (t: string, fromIso = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10)) =>
    wbFetch(
      t,
      'GET',
      `${WB_HOSTS.common}/api/communications/v2/news?from=${encodeURIComponent(fromIso)}`,
    ),
  tariffsCommission: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.common}/api/v1/tariffs/commission?locale=ru`),
  tariffsBox: (t: string) =>
    wbFetch(
      t,
      'GET',
      `${WB_HOSTS.common}/api/v1/tariffs/box?date=${new Date().toISOString().slice(0, 10)}`,
    ),
  tariffsPallet: (t: string) =>
    wbFetch(
      t,
      'GET',
      `${WB_HOSTS.common}/api/v1/tariffs/pallet?date=${new Date().toISOString().slice(0, 10)}`,
    ),
  tariffsReturn: (t: string) =>
    wbFetch(
      t,
      'GET',
      `${WB_HOSTS.common}/api/v1/tariffs/return?date=${new Date().toISOString().slice(0, 10)}`,
    ),
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
  salesReportsList: (t: string, dateFrom: string, dateTo: string) =>
    wbFetch(t, 'POST', `${WB_HOSTS.finance}/api/finance/v1/sales-reports/list`, {
      dateFrom,
      dateTo,
    }),
  acquiringList: (t: string, dateFrom: string, dateTo: string) =>
    wbFetch(t, 'POST', `${WB_HOSTS.finance}/api/finance/v1/acquiring/list`, {
      dateFrom,
      dateTo,
    }),
};

export const documentsApi = {
  categories: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.documents}/api/v1/documents/categories?locale=ru`),
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
  cardsTrashList: (t: string, limit = 10) =>
    wbFetch(t, 'POST', `${WB_HOSTS.content}/content/v2/get/cards/trash`, {
      settings: { cursor: { limit } },
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
  colors: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.content}/content/v2/directory/colors?locale=ru`),
  kinds: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.content}/content/v2/directory/kinds?locale=ru`),
  countries: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.content}/content/v2/directory/countries?locale=ru`),
  seasons: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.content}/content/v2/directory/seasons?locale=ru`),
  vat: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.content}/content/v2/directory/vat?locale=ru`),
  brands: (t: string, subjectId: number, next = 0) =>
    wbFetch(
      t,
      'GET',
      `${WB_HOSTS.content}/api/content/v1/brands?subjectId=${subjectId}&next=${next}`,
    ),
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
  recommendationsList: (t: string, nmIDs: number[]) =>
    wbFetch(t, 'POST', `${WB_HOSTS.content}/api/content/v1/recommendations/list`, { nmIDs }),
};

// ─── Prices / Saule ──────────────────────────────────────────────────────────
export const pricesApi = {
  listGoods: (t: string, limit = 10) =>
    wbFetch(t, 'GET', `${WB_HOSTS.prices}/api/v2/list/goods/filter?limit=${limit}`),
  goodsByNm: (t: string, nmList: number[]) =>
    wbFetch(t, 'POST', `${WB_HOSTS.prices}/api/v2/list/goods/filter`, { nmList }),
  goodsSizesByNm: (t: string, nmID: number, limit = 100, offset = 0) =>
    wbFetch(
      t,
      'GET',
      `${WB_HOSTS.prices}/api/v2/list/goods/size/nm?limit=${limit}&offset=${offset}&nmID=${nmID}`,
    ),
  uploadTask: (t: string, data: unknown[]) =>
    wbFetch(t, 'POST', `${WB_HOSTS.prices}/api/v2/upload/task`, { data }),
  uploadTaskSize: (t: string, data: unknown[]) =>
    wbFetch(t, 'POST', `${WB_HOSTS.prices}/api/v2/upload/task/size`, { data }),
  /** Нужен uploadID конкретной загрузки цен. */
  historyTasks: (t: string, uploadID: number) =>
    wbFetch(t, 'GET', `${WB_HOSTS.prices}/api/v2/history/tasks?uploadID=${uploadID}`),
  bufferTasks: (t: string, uploadID: number) =>
    wbFetch(t, 'GET', `${WB_HOSTS.prices}/api/v2/buffer/tasks?uploadID=${uploadID}`),
  quarantine: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.prices}/api/v2/quarantine/goods?limit=10&offset=0`),
};

export const calendarApi = {
  promotions: (t: string, allPromo = false) => {
    const start = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const end = new Date(Date.now() + 30 * 864e5).toISOString().replace(/\.\d{3}Z$/, 'Z');
    return wbFetch(
      t,
      'GET',
      `${WB_HOSTS.calendar}/api/v1/calendar/promotions?startDateTime=${encodeURIComponent(start)}&endDateTime=${encodeURIComponent(end)}&allPromo=${allPromo}&limit=20&offset=0`,
    );
  },
  promotionDetails: (t: string, promotionIDs: number[]) =>
    wbFetch(
      t,
      'GET',
      `${WB_HOSTS.calendar}/api/v1/calendar/promotions/details?promotionIDs=${promotionIDs.join(',')}`,
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
  ordersArchive: (
    t: string,
    year = new Date(Date.now() - 120 * 864e5).getUTCFullYear(),
    month = new Date(Date.now() - 120 * 864e5).getUTCMonth() + 1,
    limit = 100,
    next = 0,
  ) =>
    wbFetch(
      t,
      'GET',
      `${WB_HOSTS.marketplace}/api/marketplace/v3/fbs/orders/archive?year=${year}&month=${month}&limit=${Math.max(100, Math.min(1000, limit))}&next=${next}`,
    ),
  ordersStatus: (t: string, orders: number[]) =>
    wbFetch(t, 'POST', `${WB_HOSTS.marketplace}/api/v3/orders/status`, { orders }),
  ordersStickers: (t: string, orders: number[], type = 'png', width = 58, height = 40) =>
    wbFetch(t, 'POST', `${WB_HOSTS.marketplace}/api/v3/orders/stickers?type=${type}&width=${width}&height=${height}`, {
      orders,
    }),
  supplies: (t: string, limit = 20, next = 0) =>
    wbFetch(t, 'GET', `${WB_HOSTS.marketplace}/api/v3/supplies?limit=${limit}&next=${next}`),
  supplyCreate: (t: string, name: string) =>
    wbFetch(t, 'POST', `${WB_HOSTS.marketplace}/api/v3/supplies`, { name }),
  supplyGet: (t: string, supplyId: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.marketplace}/api/v3/supplies/${supplyId}`),
  supplyBarcode: (t: string, supplyId: string, type = 'png') =>
    wbFetch(t, 'GET', `${WB_HOSTS.marketplace}/api/v3/supplies/${supplyId}/barcode?type=${type}`),
  supplyDeliver: (t: string, supplyId: string) =>
    wbFetch(t, 'PATCH', `${WB_HOSTS.marketplace}/api/v3/supplies/${supplyId}/deliver`),
  supplyOrderIds: (t: string, supplyId: string) =>
    wbFetch(
      t,
      'GET',
      `${WB_HOSTS.marketplace}/api/marketplace/v3/supplies/${supplyId}/order-ids`,
    ),
  passes: (t: string) => wbFetch(t, 'GET', `${WB_HOSTS.marketplace}/api/v3/passes`),
  passesOffices: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.marketplace}/api/v3/passes/offices`),
  autoreturns: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.marketplace}/api/marketplace/v3/fbs/settings/autoreturns`),
  reshipment: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.marketplace}/api/v3/supplies/orders/reshipment`),
};

export const suppliesApi = {
  warehouses: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.supplies}/api/v1/warehouses`),
  transitTariffs: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.supplies}/api/v1/transit-tariffs`),
  suppliesList: (t: string, body: unknown) =>
    wbFetch(t, 'POST', `${WB_HOSTS.supplies}/api/v1/supplies`, body),
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
  salesFunnelHistory: (t: string, nmIds: number[], start: string, end: string) =>
    wbFetch(t, 'POST', `${WB_HOSTS.analytics}/api/analytics/v3/sales-funnel/products/history`, {
      selectedPeriod: { start, end },
      nmIds,
      skipDeletedNm: true,
    }),
  stocksWbWarehouses: (t: string, body: unknown) =>
    wbFetch(t, 'POST', `${WB_HOSTS.analytics}/api/analytics/v1/stocks-report/wb-warehouses`, body),
  nmReportDownloads: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.analytics}/api/v2/nm-report/downloads`),
  brandShareBrands: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.analytics}/api/v1/analytics/brand-share/brands`),
  antifraud: (t: string, dateFrom: string, dateTo: string) =>
    wbFetch(
      t,
      'GET',
      `${WB_HOSTS.analytics}/api/v1/analytics/antifraud-details?dateFrom=${dateFrom}&dateTo=${dateTo}`,
    ),
  goodsReturn: (t: string, dateFrom: string, dateTo: string) =>
    wbFetch(
      t,
      'GET',
      `${WB_HOSTS.analytics}/api/v1/analytics/goods-return?dateFrom=${dateFrom}&dateTo=${dateTo}`,
    ),
  bannedBlocked: (t: string, sort = 'nmId', order = 'desc') =>
    wbFetch(
      t,
      'GET',
      `${WB_HOSTS.analytics}/api/v1/analytics/banned-products/blocked?sort=${sort}&order=${order}`,
    ),
  regionSale: (t: string, dateFrom: string, dateTo: string) =>
    wbFetch(
      t,
      'GET',
      `${WB_HOSTS.analytics}/api/v1/analytics/region-sale?dateFrom=${dateFrom}&dateTo=${dateTo}`,
    ),
  paidStorageCreate: (t: string, dateFrom: string, dateTo: string) =>
    wbFetch(
      t,
      'GET',
      `${WB_HOSTS.analytics}/api/v1/paid_storage?dateFrom=${dateFrom}&dateTo=${dateTo}`,
    ),
  warehouseRemainsCreate: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.analytics}/api/v1/warehouse_remains`),
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
  stop: (t: string, id: number) =>
    wbFetch(t, 'GET', `${WB_HOSTS.advert}/adv/v0/stop?id=${id}`),
  budget: (t: string, id: number) =>
    wbFetch(t, 'GET', `${WB_HOSTS.advert}/adv/v1/budget?id=${id}`),
  /** Инфо по кампаниям (новый путь). */
  advertsInfo: (t: string, ids: number[]) =>
    wbFetch(
      t,
      'GET',
      `${WB_HOSTS.advert}/api/advert/v2/adverts?ids=${ids.join(',')}`,
    ),
  subjects: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.advert}/adv/v1/supplier/subjects`),
  config: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.advert}/api/advert/v1/config`),
  costsHistory: (t: string, from: string, to: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.advert}/adv/v1/upd?from=${from}&to=${to}`),
  payments: (t: string, from: string, to: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.advert}/adv/v1/payments?from=${from}&to=${to}`),
  fullstats: (t: string, ids: number[], beginDate: string, endDate: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.advert}/adv/v3/fullstats?ids=${ids.join(',')}&beginDate=${beginDate}&endDate=${endDate}`),
  mediaCount: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.advertMedia}/adv/v1/count`),
  mediaAdverts: (t: string, limit = 10, offset = 0) =>
    wbFetch(
      t,
      'GET',
      `${WB_HOSTS.advertMedia}/adv/v1/adverts?limit=${limit}&offset=${offset}`,
    ),
};

// ─── Feedbacks / Alina ───────────────────────────────────────────────────────
export const feedbacksApi = {
  unansweredCount: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.feedbacks}/api/v1/feedbacks/count-unanswered`),
  feedbacksCount: (t: string, dateFrom?: string, dateTo?: string) => {
    const q = new URLSearchParams();
    if (dateFrom) q.set('dateFrom', dateFrom);
    if (dateTo) q.set('dateTo', dateTo);
    const qs = q.toString();
    return wbFetch(
      t,
      'GET',
      `${WB_HOSTS.feedbacks}/api/v1/feedbacks/count${qs ? `?${qs}` : ''}`,
    );
  },
  questionsUnanswered: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.feedbacks}/api/v1/questions/count-unanswered`),
  newFlags: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.feedbacks}/api/v1/new-feedbacks-questions`),
  feedbacks: (t: string, isAnswered = false) =>
    wbFetch(
      t,
      'GET',
      `${WB_HOSTS.feedbacks}/api/v1/feedbacks?isAnswered=${isAnswered}&take=10&skip=0`,
    ),
  feedbacksArchive: (t: string) =>
    wbFetch(
      t,
      'GET',
      `${WB_HOSTS.feedbacks}/api/v1/feedbacks/archive?take=10&skip=0`,
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
  pins: (t: string) => wbFetch(t, 'GET', `${WB_HOSTS.feedbacks}/api/feedbacks/v1/pins`),
  pinsCount: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.feedbacks}/api/feedbacks/v1/pins/count`),
  pinsLimits: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.feedbacks}/api/feedbacks/v1/pins/limits`),
};

export const returnsApi = {
  claims: (t: string) =>
    wbFetch(
      t,
      'GET',
      `${WB_HOSTS.returns}/api/v1/claims?is_archive=false&limit=10&offset=0`,
    ),
  answerClaim: (t: string, body: unknown) =>
    wbFetch(t, 'PATCH', `${WB_HOSTS.returns}/api/v1/claim`, body),
};

export const chatApi = {
  chats: (t: string) =>
    wbFetch(t, 'GET', `${WB_HOSTS.chat}/api/v1/seller/chats`),
  events: (t: string, next = 0) =>
    wbFetch(t, 'GET', `${WB_HOSTS.chat}/api/v1/seller/events?next=${next}`),
};

/**
 * Каталог READ-проб для live-теста (без мутаций).
 * Возвращает список {id, run} — вызывающий делает sleep между ними.
 */
export type ProbeCase = {
  id: string;
  role: string;
  run: (token: string, ctx: ProbeCtx) => Promise<WbHttpResult>;
};

export type ProbeCtx = {
  nmId?: number;
  subjectId?: number;
  warehouseId?: number;
  advertId?: number;
  supplyId?: string;
  uploadId?: number;
};

export function buildReadProbeCases(): ProbeCase[] {
  const d2 = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10);
  const d7 = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const d30 = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  return [
    // karina
    { id: 'common.sellerInfo', role: 'karina', run: (t) => commonApi.sellerInfo(t) },
    { id: 'common.rating', role: 'karina', run: (t) => commonApi.rating(t) },
    { id: 'common.subscriptions', role: 'karina', run: (t) => commonApi.subscriptions(t) },
    { id: 'common.tariffConstructor', role: 'karina', run: (t) => commonApi.tariffConstructor(t) },
    { id: 'common.news', role: 'karina', run: (t) => commonApi.news(t) },
    { id: 'common.tariffsCommission', role: 'karina', run: (t) => commonApi.tariffsCommission(t) },
    { id: 'common.tariffsBox', role: 'karina', run: (t) => commonApi.tariffsBox(t) },
    { id: 'common.tariffsPallet', role: 'karina', run: (t) => commonApi.tariffsPallet(t) },
    { id: 'common.tariffsReturn', role: 'karina', run: (t) => commonApi.tariffsReturn(t) },
    { id: 'common.acceptanceCoeff', role: 'karina', run: (t) => commonApi.acceptanceCoeff(t) },
    { id: 'users.list', role: 'karina', run: (t) => usersApi.list(t) },
    { id: 'finance.balance', role: 'karina', run: (t) => financeApi.balance(t) },
    {
      id: 'finance.salesReportsList',
      role: 'karina',
      run: (t) => financeApi.salesReportsList(t, d30, today),
    },
    { id: 'documents.categories', role: 'karina', run: (t) => documentsApi.categories(t) },
    { id: 'documents.list', role: 'karina', run: (t) => documentsApi.list(t) },

    // saule content/prices/stats
    { id: 'content.cardsList', role: 'saule', run: (t) => contentApi.cardsList(t, 3) },
    { id: 'content.cardsTrashList', role: 'saule', run: (t) => contentApi.cardsTrashList(t, 3) },
    { id: 'content.cardsLimits', role: 'saule', run: (t) => contentApi.cardsLimits(t) },
    { id: 'content.parentSubjects', role: 'saule', run: (t) => contentApi.parentSubjects(t) },
    { id: 'content.subjects', role: 'saule', run: (t) => contentApi.subjects(t, 'Блузки') },
    { id: 'content.colors', role: 'saule', run: (t) => contentApi.colors(t) },
    { id: 'content.kinds', role: 'saule', run: (t) => contentApi.kinds(t) },
    { id: 'content.countries', role: 'saule', run: (t) => contentApi.countries(t) },
    { id: 'content.seasons', role: 'saule', run: (t) => contentApi.seasons(t) },
    { id: 'content.vat', role: 'saule', run: (t) => contentApi.vat(t) },
    {
      id: 'content.brands',
      role: 'saule',
      run: (t, ctx) =>
        ctx.subjectId
          ? contentApi.brands(t, ctx.subjectId)
          : Promise.resolve({ ok: false, status: 0, data: {}, errorText: 'no subjectId' }),
    },
    { id: 'content.tags', role: 'saule', run: (t) => contentApi.tags(t) },
    { id: 'content.cardsErrorList', role: 'saule', run: (t) => contentApi.cardsErrorList(t) },
    { id: 'content.barcodes', role: 'saule', run: (t) => contentApi.barcodes(t, 1) },
    { id: 'prices.listGoods', role: 'saule', run: (t) => pricesApi.listGoods(t, 3) },
    {
      id: 'prices.goodsSizesByNm',
      role: 'saule',
      run: (t, ctx) =>
        ctx.nmId
          ? pricesApi.goodsSizesByNm(t, ctx.nmId)
          : Promise.resolve({ ok: false, status: 0, data: {}, errorText: 'no nmId' }),
    },
    {
      id: 'prices.historyTasks',
      role: 'saule',
      run: (t, ctx) =>
        ctx.uploadId
          ? pricesApi.historyTasks(t, ctx.uploadId)
          : Promise.resolve({
            ok: true,
            status: 204,
            data: { skipped: 'no uploadId' },
            errorText: '',
          }),
    },
    {
      id: 'prices.bufferTasks',
      role: 'saule',
      run: (t, ctx) =>
        ctx.uploadId
          ? pricesApi.bufferTasks(t, ctx.uploadId)
          : Promise.resolve({
            ok: true,
            status: 204,
            data: { skipped: 'no uploadId' },
            errorText: '',
          }),
    },
    { id: 'prices.quarantine', role: 'saule', run: (t) => pricesApi.quarantine(t) },
    { id: 'stats.orders', role: 'saule', run: (t) => statsApi.orders(t, d2) },
    { id: 'stats.sales', role: 'saule', run: (t) => statsApi.sales(t, d2) },
    {
      id: 'analytics.salesFunnel',
      role: 'saule',
      run: (t, ctx) =>
        ctx.nmId
          ? analyticsApi.salesFunnel(t, [ctx.nmId], d7, today)
          : Promise.resolve({ ok: false, status: 0, data: {}, errorText: 'no nmId' }),
    },
    { id: 'analytics.nmReportDownloads', role: 'saule', run: (t) => analyticsApi.nmReportDownloads(t) },
    { id: 'analytics.brandShareBrands', role: 'saule', run: (t) => analyticsApi.brandShareBrands(t) },
    { id: 'analytics.antifraud', role: 'saule', run: (t) => analyticsApi.antifraud(t, d7, today) },
    { id: 'analytics.goodsReturn', role: 'saule', run: (t) => analyticsApi.goodsReturn(t, d7, today) },
    { id: 'analytics.bannedBlocked', role: 'saule', run: (t) => analyticsApi.bannedBlocked(t) },
    {
      id: 'analytics.regionSale',
      role: 'saule',
      run: (t) => analyticsApi.regionSale(t, d7, today),
    },

    // anton
    { id: 'market.warehouses', role: 'anton', run: (t) => marketApi.warehouses(t) },
    { id: 'market.offices', role: 'anton', run: (t) => marketApi.offices(t) },
    { id: 'market.ordersNew', role: 'anton', run: (t) => marketApi.ordersNew(t) },
    { id: 'market.orders', role: 'anton', run: (t) => marketApi.orders(t, 20, 0) },
    { id: 'market.ordersArchive', role: 'anton', run: (t) => marketApi.ordersArchive(t) },
    { id: 'market.supplies', role: 'anton', run: (t) => marketApi.supplies(t, 10, 0) },
    { id: 'market.passes', role: 'anton', run: (t) => marketApi.passes(t) },
    { id: 'market.passesOffices', role: 'anton', run: (t) => marketApi.passesOffices(t) },
    { id: 'market.autoreturns', role: 'anton', run: (t) => marketApi.autoreturns(t) },
    { id: 'market.reshipment', role: 'anton', run: (t) => marketApi.reshipment(t) },
    {
      id: 'market.stocksGet',
      role: 'anton',
      run: (t, ctx) =>
        ctx.warehouseId
          ? marketApi.stocksGet(t, ctx.warehouseId, ['0'])
          : Promise.resolve({ ok: false, status: 0, data: {}, errorText: 'no warehouseId' }),
    },
    { id: 'supplies.warehouses', role: 'anton', run: (t) => suppliesApi.warehouses(t) },
    { id: 'supplies.transitTariffs', role: 'anton', run: (t) => suppliesApi.transitTariffs(t) },

    // amina
    { id: 'advert.count', role: 'amina', run: (t) => advertApi.count(t) },
    { id: 'advert.balance', role: 'amina', run: (t) => advertApi.balance(t) },
    { id: 'advert.subjects', role: 'amina', run: (t) => advertApi.subjects(t) },
    { id: 'advert.config', role: 'amina', run: (t) => advertApi.config(t) },
    { id: 'advert.costsHistory', role: 'amina', run: (t) => advertApi.costsHistory(t, d7, today) },
    { id: 'advert.payments', role: 'amina', run: (t) => advertApi.payments(t, d30, today) },
    { id: 'advert.mediaCount', role: 'amina', run: (t) => advertApi.mediaCount(t) },
    { id: 'advert.mediaAdverts', role: 'amina', run: (t) => advertApi.mediaAdverts(t) },
    {
      id: 'advert.budget',
      role: 'amina',
      run: (t, ctx) =>
        ctx.advertId
          ? advertApi.budget(t, ctx.advertId)
          : Promise.resolve({ ok: false, status: 0, data: {}, errorText: 'no advertId' }),
    },
    {
      id: 'advert.advertsInfo',
      role: 'amina',
      run: (t, ctx) =>
        ctx.advertId
          ? advertApi.advertsInfo(t, [ctx.advertId])
          : Promise.resolve({ ok: false, status: 0, data: {}, errorText: 'no advertId' }),
    },
    {
      id: 'advert.fullstats',
      role: 'amina',
      run: (t, ctx) =>
        ctx.advertId
          ? advertApi.fullstats(t, [ctx.advertId], d7, today)
          : Promise.resolve({ ok: false, status: 0, data: {}, errorText: 'no advertId' }),
    },
    { id: 'calendar.promotions', role: 'amina', run: (t) => calendarApi.promotions(t) },

    // alina
    { id: 'feedbacks.unansweredCount', role: 'alina', run: (t) => feedbacksApi.unansweredCount(t) },
    { id: 'feedbacks.feedbacksCount', role: 'alina', run: (t) => feedbacksApi.feedbacksCount(t) },
    { id: 'feedbacks.questionsUnanswered', role: 'alina', run: (t) => feedbacksApi.questionsUnanswered(t) },
    { id: 'feedbacks.newFlags', role: 'alina', run: (t) => feedbacksApi.newFlags(t) },
    { id: 'feedbacks.feedbacks', role: 'alina', run: (t) => feedbacksApi.feedbacks(t, false) },
    { id: 'feedbacks.feedbacksArchive', role: 'alina', run: (t) => feedbacksApi.feedbacksArchive(t) },
    { id: 'feedbacks.questions', role: 'alina', run: (t) => feedbacksApi.questions(t, false) },
    { id: 'feedbacks.pins', role: 'alina', run: (t) => feedbacksApi.pins(t) },
    { id: 'feedbacks.pinsCount', role: 'alina', run: (t) => feedbacksApi.pinsCount(t) },
    { id: 'feedbacks.pinsLimits', role: 'alina', run: (t) => feedbacksApi.pinsLimits(t) },
    { id: 'returns.claims', role: 'alina', run: (t) => returnsApi.claims(t) },
    { id: 'chat.chats', role: 'alina', run: (t) => chatApi.chats(t) },
    { id: 'chat.events', role: 'alina', run: (t) => chatApi.events(t, 0) },
  ];
}

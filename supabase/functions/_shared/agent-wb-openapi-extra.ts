/**
 * Typed wrappers for OpenAPI endpoints not yet in day-to-day helpers.
 * Autogen from gap: 185 methods. Prefer callWbEndpoint for ad-hoc.
 */
import { WB_HOSTS, type WbHttpResult } from './agent-wb-openapi-client.ts';

async function xfetch(token: string, method: string, url: string, body?: unknown): Promise<WbHttpResult> {
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
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text.slice(0, 400) }; }
    const err = !res.ok
      ? String((data as Record<string, unknown>)?.detail || (data as Record<string, unknown>)?.title || `HTTP ${res.status}`).slice(0, 400)
      : '';
    return { ok: res.ok, status: res.status, data, errorText: err };
  } catch (e) {
    return { ok: false, status: 0, data: {}, errorText: String(e).slice(0, 300) };
  }
}

function q(params: Record<string, string | number | boolean | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** Все недостающие методы сайта — тонкие обёртки. */
export const wbOpenApiExtra = {
  /** GET /content/v2/directory/tnved — ТНВЭД-код */
  get_content_v2_directory_tnved: (t: string, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.content}/content/v2/directory/tnved${q(query)}`),
  /** POST /content/v2/tag — Создание ярлыка */
  post_content_v2_tag: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.content}/content/v2/tag`, body),
  /** PATCH /content/v2/tag/{id} — Изменение ярлыка */
  patch_content_v2_tag_id: (t: string, id: string | number, body?: unknown) =>
    xfetch(t, 'PATCH', `${WB_HOSTS.content}/content/v2/tag/${id}`, body),
  /** DELETE /content/v2/tag/{id} — Удаление ярлыка */
  delete_content_v2_tag_id: (t: string, id: string | number) =>
    xfetch(t, 'DELETE', `${WB_HOSTS.content}/content/v2/tag/${id}`),
  /** POST /content/v2/tag/nomenclature/link — Управление ярлыками в карточке товара */
  post_content_v2_tag_nomenclature_link: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.content}/content/v2/tag/nomenclature/link`, body),
  /** POST /content/v2/cards/moveNm — Объединение и разъединение карточек товаров */
  post_content_v2_cards_moveNm: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.content}/content/v2/cards/moveNm`, body),
  /** POST /content/v2/cards/upload/add — Создание карточек товаров с присоединением */
  post_content_v2_cards_upload_add: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.content}/content/v2/cards/upload/add`, body),
  /** POST /content/v3/media/file — Загрузить медиафайл */
  post_content_v3_media_file: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.content}/content/v3/media/file`, body),
  /** POST /api/content/v1/recommendations/set — Установить рекомендации для товаров */
  postV1RecommendationsSet: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.content}/api/content/v1/recommendations/set`, body),
  /** POST /api/v2/upload/task/club-discount — Установить скидки WB Клуба */
  post_api_v2_upload_task_club_discount: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.prices}/api/v2/upload/task/club-discount`, body),
  /** POST /api/discounts-prices/v1/upload/task/b2b/wholesale — Установить оптовые скидки для B2B-продаж */
  postV1UploadTaskB2bWholesale: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.prices}/api/discounts-prices/v1/upload/task/b2b/wholesale`, body),
  /** GET /api/v2/history/goods/task — Детализация обработанной загрузки */
  get_api_v2_history_goods_task: (t: string, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.prices}/api/v2/history/goods/task${q(query)}`),
  /** GET /api/v2/buffer/goods/task — Детализация необработанной загрузки */
  get_api_v2_buffer_goods_task: (t: string, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.prices}/api/v2/buffer/goods/task${q(query)}`),
  /** PUT /api/v3/warehouses/{warehouseId} — Обновить склад продавца */
  put_api_v3_warehouses_warehouseId: (t: string, warehouseId: string | number, body?: unknown) =>
    xfetch(t, 'PUT', `${WB_HOSTS.marketplace}/api/v3/warehouses/${warehouseId}`, body),
  /** DELETE /api/v3/warehouses/{warehouseId} — Удалить склад продавца */
  delete_api_v3_warehouses_warehouseId: (t: string, warehouseId: string | number) =>
    xfetch(t, 'DELETE', `${WB_HOSTS.marketplace}/api/v3/warehouses/${warehouseId}`),
  /** GET /api/v3/dbw/warehouses/{warehouseId}/contacts — Список контактов */
  get_api_v3_dbw_warehouses_warehouseId_contacts: (t: string, warehouseId: string | number, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.marketplace}/api/v3/dbw/warehouses/${warehouseId}/contacts${q(query)}`),
  /** PUT /api/v3/dbw/warehouses/{warehouseId}/contacts — Обновить список контактов */
  put_api_v3_dbw_warehouses_warehouseId_contacts: (t: string, warehouseId: string | number, body?: unknown) =>
    xfetch(t, 'PUT', `${WB_HOSTS.marketplace}/api/v3/dbw/warehouses/${warehouseId}/contacts`, body),
  /** PUT /api/v3/passes/{passId} — Обновить пропуск */
  put_api_v3_passes_passId: (t: string, passId: string | number, body?: unknown) =>
    xfetch(t, 'PUT', `${WB_HOSTS.marketplace}/api/v3/passes/${passId}`, body),
  /** DELETE /api/v3/passes/{passId} — Удалить пропуск */
  delete_api_v3_passes_passId: (t: string, passId: string | number) =>
    xfetch(t, 'DELETE', `${WB_HOSTS.marketplace}/api/v3/passes/${passId}`),
  /** PATCH /api/v3/orders/{orderId}/cancel — Отменить сборочное задание */
  patch_api_v3_orders_orderId_cancel: (t: string, orderId: string | number, body?: unknown) =>
    xfetch(t, 'PATCH', `${WB_HOSTS.marketplace}/api/v3/orders/${orderId}/cancel`, body),
  /** POST /api/marketplace/v3/orders/meta — Получить идентификаторы маркировки сборочных заданий */
  post_api_marketplace_v3_orders_meta: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/marketplace/v3/orders/meta`, body),
  /** DELETE /api/v3/orders/{orderId}/meta — Удалить идентификаторы маркировки сборочного задания */
  delete_api_v3_orders_orderId_meta: (t: string, orderId: string | number) =>
    xfetch(t, 'DELETE', `${WB_HOSTS.marketplace}/api/v3/orders/${orderId}/meta`),
  /** PUT /api/v3/orders/{orderId}/meta/sgtin — Закрепить код маркировки Честного знака за сборочным заданием */
  put_api_v3_orders_orderId_meta_sgtin: (t: string, orderId: string | number, body?: unknown) =>
    xfetch(t, 'PUT', `${WB_HOSTS.marketplace}/api/v3/orders/${orderId}/meta/sgtin`, body),
  /** PUT /api/v3/orders/{orderId}/meta/uin — Закрепить УИН за сборочным заданием */
  put_api_v3_orders_orderId_meta_uin: (t: string, orderId: string | number, body?: unknown) =>
    xfetch(t, 'PUT', `${WB_HOSTS.marketplace}/api/v3/orders/${orderId}/meta/uin`, body),
  /** PUT /api/v3/orders/{orderId}/meta/imei — Закрепить IMEI за сборочным заданием */
  put_api_v3_orders_orderId_meta_imei: (t: string, orderId: string | number, body?: unknown) =>
    xfetch(t, 'PUT', `${WB_HOSTS.marketplace}/api/v3/orders/${orderId}/meta/imei`, body),
  /** PUT /api/v3/orders/{orderId}/meta/gtin — Закрепить GTIN за сборочным заданием */
  put_api_v3_orders_orderId_meta_gtin: (t: string, orderId: string | number, body?: unknown) =>
    xfetch(t, 'PUT', `${WB_HOSTS.marketplace}/api/v3/orders/${orderId}/meta/gtin`, body),
  /** PUT /api/v3/orders/{orderId}/meta/expiration — Закрепить за сборочным заданием срок годности товара */
  put_api_v3_orders_orderId_meta_expiration: (t: string, orderId: string | number, body?: unknown) =>
    xfetch(t, 'PUT', `${WB_HOSTS.marketplace}/api/v3/orders/${orderId}/meta/expiration`, body),
  /** PUT /api/marketplace/v3/orders/{orderId}/meta/customs-declaration — Закрепить номер ДТ за сборочным заданием */
  put_api_marketplace_v3_orders_orderId_meta_customs_declaration: (t: string, orderId: string | number, body?: unknown) =>
    xfetch(t, 'PUT', `${WB_HOSTS.marketplace}/api/marketplace/v3/orders/${orderId}/meta/customs-declaration`, body),
  /** POST /api/v3/orders/stickers/cross-border — Получить стикеры сборочных заданий трансграничных поставок */
  post_api_v3_orders_stickers_cross_border: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/v3/orders/stickers/cross-border`, body),
  /** POST /api/v3/orders/status/history — История статусов для сборочных заданий трансграничных поставок */
  post_api_v3_orders_status_history: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/v3/orders/status/history`, body),
  /** POST /api/v3/orders/client — Заказы с информацией по клиенту */
  post_api_v3_orders_client: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/v3/orders/client`, body),
  /** PATCH /api/marketplace/v3/supplies/{supplyId}/orders — Добавить сборочные задания к поставке */
  patch_api_marketplace_v3_supplies_supplyId_orders: (t: string, supplyId: string | number, body?: unknown) =>
    xfetch(t, 'PATCH', `${WB_HOSTS.marketplace}/api/marketplace/v3/supplies/${supplyId}/orders`, body),
  /** GET /api/v3/supplies/{supplyId}/trbx — Получить список грузомест поставки */
  get_api_v3_supplies_supplyId_trbx: (t: string, supplyId: string | number, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.marketplace}/api/v3/supplies/${supplyId}/trbx${q(query)}`),
  /** POST /api/v3/supplies/{supplyId}/trbx — Добавить грузоместа к поставке */
  post_api_v3_supplies_supplyId_trbx: (t: string, supplyId: string | number, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/v3/supplies/${supplyId}/trbx`, body),
  /** DELETE /api/v3/supplies/{supplyId}/trbx — Удалить грузоместа из поставки */
  delete_api_v3_supplies_supplyId_trbx: (t: string, supplyId: string | number) =>
    xfetch(t, 'DELETE', `${WB_HOSTS.marketplace}/api/v3/supplies/${supplyId}/trbx`),
  /** POST /api/v3/supplies/{supplyId}/trbx/stickers — Получить стикеры грузомест поставки */
  post_api_v3_supplies_supplyId_trbx_stickers: (t: string, supplyId: string | number, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/v3/supplies/${supplyId}/trbx/stickers`, body),
  /** POST /api/marketplace/v3/fbs/settings/autoreturns/items — Получить настройки автовозврата товаров */
  postMarketplaceV3FbsSettingsAutoreturnsItems: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/marketplace/v3/fbs/settings/autoreturns/items`, body),
  /** PATCH /api/marketplace/v3/fbs/settings/autoreturns/items — Обновить настройки автовозврата товаров */
  patchMarketplaceV3FbsSettingsAutoreturnsItems: (t: string, body?: unknown) =>
    xfetch(t, 'PATCH', `${WB_HOSTS.marketplace}/api/marketplace/v3/fbs/settings/autoreturns/items`, body),
  /** GET /api/marketplace/v3/fbs/settings/autoreturns/subcategories/restricted — Получить предметы, которые не хранятся на складах WB */
  getMarketplaceV3FbsSettingsAutoreturnsSubcategoriesRestricted: (t: string, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.marketplace}/api/marketplace/v3/fbs/settings/autoreturns/subcategories/restricted${q(query)}`),
  /** GET /api/v3/dbw/orders/new — Получить список новых сборочных заданий */
  getV3DbwOrdersNew: (t: string, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.marketplace}/api/v3/dbw/orders/new${q(query)}`),
  /** GET /api/v3/dbw/orders — Получить информацию о завершенных сборочных заданиях */
  getV3DbwOrders: (t: string, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.marketplace}/api/v3/dbw/orders${q(query)}`),
  /** POST /api/v3/dbw/orders/delivery-date — Получить дату и время доставки */
  postV3DbwOrdersDeliveryDate: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/v3/dbw/orders/delivery-date`, body),
  /** POST /api/marketplace/v3/dbw/orders/client — Информация о покупателе */
  postV3DbwOrdersClient: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/marketplace/v3/dbw/orders/client`, body),
  /** POST /api/v3/dbw/orders/status — Получить статусы сборочных заданий */
  postV3DbwOrdersStatus: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/v3/dbw/orders/status`, body),
  /** PATCH /api/v3/dbw/orders/{orderId}/confirm — Перевести на сборку */
  patchV3DbwOrdersOrderIdConfirm: (t: string, orderId: string | number, body?: unknown) =>
    xfetch(t, 'PATCH', `${WB_HOSTS.marketplace}/api/v3/dbw/orders/${orderId}/confirm`, body),
  /** POST /api/v3/dbw/orders/stickers — Получить стикеры сборочных заданий */
  postV3DbwOrdersStickers: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/v3/dbw/orders/stickers`, body),
  /** POST /api/marketplace/v3/dbw/orders/status/deliver — Перевести сборочные задания в доставку */
  postV3DbwOrdersStatusDeliver: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/marketplace/v3/dbw/orders/status/deliver`, body),
  /** POST /api/v3/dbw/orders/courier — Информация о курьере */
  postV3DbwOrdersCourier: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/v3/dbw/orders/courier`, body),
  /** PATCH /api/v3/dbw/orders/{orderId}/cancel — Отменить сборочное задание */
  patchV3DbwOrdersOrderIdCancel: (t: string, orderId: string | number, body?: unknown) =>
    xfetch(t, 'PATCH', `${WB_HOSTS.marketplace}/api/v3/dbw/orders/${orderId}/cancel`, body),
  /** POST /api/marketplace/v3/dbw/orders/meta/details — Получить идентификаторы маркировки сборочных заданий */
  postV3DbwOrdersMetaDetails: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/marketplace/v3/dbw/orders/meta/details`, body),
  /** POST /api/marketplace/v3/dbw/orders/meta/delete — Удалить идентификаторы маркировки сборочных заданий */
  postV3DbwOrdersMetaDelete: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/marketplace/v3/dbw/orders/meta/delete`, body),
  /** POST /api/marketplace/v3/dbw/orders/meta/sgtin — Закрепить коды маркировки Честного знака за сборочными заданиями */
  postV3DbwOrdersMetaSgtin: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/marketplace/v3/dbw/orders/meta/sgtin`, body),
  /** PUT /api/v3/dbw/orders/{orderId}/meta/uin — Закрепить УИН за сборочным заданием */
  putV3DbwOrdersOrderIdMetaUin: (t: string, orderId: string | number, body?: unknown) =>
    xfetch(t, 'PUT', `${WB_HOSTS.marketplace}/api/v3/dbw/orders/${orderId}/meta/uin`, body),
  /** PUT /api/v3/dbw/orders/{orderId}/meta/imei — Закрепить IMEI за сборочным заданием */
  putV3DbwOrdersOrderIdMetaImei: (t: string, orderId: string | number, body?: unknown) =>
    xfetch(t, 'PUT', `${WB_HOSTS.marketplace}/api/v3/dbw/orders/${orderId}/meta/imei`, body),
  /** PUT /api/v3/dbw/orders/{orderId}/meta/gtin — Закрепить GTIN за сборочным заданием */
  putV3DbwOrdersOrderIdMetaGtin: (t: string, orderId: string | number, body?: unknown) =>
    xfetch(t, 'PUT', `${WB_HOSTS.marketplace}/api/v3/dbw/orders/${orderId}/meta/gtin`, body),
  /** GET /api/v3/dbs/orders/new — Получить список новых сборочных заданий */
  getV3DbsOrdersNew: (t: string, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.marketplace}/api/v3/dbs/orders/new${q(query)}`),
  /** GET /api/v3/dbs/orders — Получить информацию о завершенных сборочных заданиях */
  getV3DbsOrders: (t: string, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.marketplace}/api/v3/dbs/orders${q(query)}`),
  /** POST /api/v3/dbs/groups/info — Получить информацию о платной доставке */
  postV3DbsGroupsInfo: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/v3/dbs/groups/info`, body),
  /** POST /api/v3/dbs/orders/client — Информация о покупателе */
  postV3DbsOrdersClient: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/v3/dbs/orders/client`, body),
  /** POST /api/marketplace/v3/dbs/orders/b2b/info — Информация о покупателе B2B */
  postV3DbsOrdersB2bInfo: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/marketplace/v3/dbs/orders/b2b/info`, body),
  /** POST /api/v3/dbs/orders/delivery-date — Получить дату и время доставки */
  postV3DbsOrdersDeliveryDate: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/v3/dbs/orders/delivery-date`, body),
  /** POST /api/marketplace/v3/dbs/orders/status/info — Получить статусы сборочных заданий */
  postV3DbsOrdersStatusInfo: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/marketplace/v3/dbs/orders/status/info`, body),
  /** POST /api/marketplace/v3/dbs/orders/status/cancel — Отменить сборочные задания */
  postV3DbsOrdersStatusCancel: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/marketplace/v3/dbs/orders/status/cancel`, body),
  /** POST /api/marketplace/v3/dbs/orders/status/confirm — Перевести сборочные задания на сборку */
  postV3DbsOrdersStatusConfirm: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/marketplace/v3/dbs/orders/status/confirm`, body),
  /** POST /api/marketplace/v3/dbs/orders/stickers — Получить стикеры для сборочных заданий с доставкой в ПВЗ */
  postV3DbsOrdersStickers: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/marketplace/v3/dbs/orders/stickers`, body),
  /** POST /api/marketplace/v3/dbs/orders/status/deliver — Перевести сборочные задания в доставку */
  postV3DbsOrdersStatusDeliver: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/marketplace/v3/dbs/orders/status/deliver`, body),
  /** POST /api/marketplace/v3/dbs/orders/status/receive — Сообщить о получении заказов */
  postV3DbsOrdersStatusReceive: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/marketplace/v3/dbs/orders/status/receive`, body),
  /** POST /api/marketplace/v3/dbs/orders/status/reject — Сообщить об отказе от заказов */
  postV3DbsOrdersStatusReject: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/marketplace/v3/dbs/orders/status/reject`, body),
  /** POST /api/marketplace/v3/dbs/orders/meta/details — Получить идентификаторы маркировки сборочных заданий */
  postV3DbsOrdersMetaDetails: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/marketplace/v3/dbs/orders/meta/details`, body),
  /** POST /api/marketplace/v3/dbs/orders/meta/delete — Удалить идентификаторы маркировки сборочных заданий */
  postV3DbsOrdersMetaDelete: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/marketplace/v3/dbs/orders/meta/delete`, body),
  /** POST /api/marketplace/v3/dbs/orders/meta/sgtin — Закрепить коды маркировки Честного знака за сборочными заданиями */
  postV3DbsOrdersMetaSgtin: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/marketplace/v3/dbs/orders/meta/sgtin`, body),
  /** POST /api/marketplace/v3/dbs/orders/meta/uin — Закрепить УИН за сборочными заданиями */
  postV3DbsOrdersMetaUin: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/marketplace/v3/dbs/orders/meta/uin`, body),
  /** POST /api/marketplace/v3/dbs/orders/meta/imei — Закрепить IMEI за сборочными заданиями */
  postV3DbsOrdersMetaImei: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/marketplace/v3/dbs/orders/meta/imei`, body),
  /** POST /api/marketplace/v3/dbs/orders/meta/gtin — Закрепить GTIN за сборочными заданиями */
  postV3DbsOrdersMetaGtin: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/marketplace/v3/dbs/orders/meta/gtin`, body),
  /** POST /api/marketplace/v3/dbs/orders/meta/customs-declaration — Закрепить номера ДТ за сборочными заданиями */
  postV3DbsOrdersMetaCustomsDeclaration: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/marketplace/v3/dbs/orders/meta/customs-declaration`, body),
  /** GET /api/v3/click-collect/orders/new — Получить список новых сборочных заданий */
  getV3ClickCollectOrdersNew: (t: string, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.marketplace}/api/v3/click-collect/orders/new${q(query)}`),
  /** GET /api/v3/click-collect/orders — Получить информацию о завершённых сборочных заданиях */
  getV3ClickCollectOrders: (t: string, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.marketplace}/api/v3/click-collect/orders${q(query)}`),
  /** POST /api/marketplace/v3/click-collect/orders/final-price — Получить цены продавца и суммы к оплате */
  postV3ClickCollectOrdersFinalPrice: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/marketplace/v3/click-collect/orders/final-price`, body),
  /** POST /api/marketplace/v3/click-collect/orders/status/confirm — Перевести сборочные задания на сборку */
  postV3ClickCollectOrdersStatusConfirm: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/marketplace/v3/click-collect/orders/status/confirm`, body),
  /** POST /api/marketplace/v3/click-collect/orders/status/prepare — Сообщить, что сборочные задания готовы к выдаче */
  postV3ClickCollectOrdersStatusPrepare: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/marketplace/v3/click-collect/orders/status/prepare`, body),
  /** POST /api/v3/click-collect/orders/client — Информация о покупателе */
  postV3ClickCollectOrdersClient: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/v3/click-collect/orders/client`, body),
  /** POST /api/v3/click-collect/orders/client/identity — Проверить, что заказ принадлежит покупателю */
  postV3ClickCollectOrdersClientIdentity: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/v3/click-collect/orders/client/identity`, body),
  /** POST /api/marketplace/v3/click-collect/orders/status/receive — Сообщить, что заказы приняты покупателями */
  postV3ClickCollectOrdersStatusReceive: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/marketplace/v3/click-collect/orders/status/receive`, body),
  /** POST /api/marketplace/v3/click-collect/orders/status/reject — Сообщить об отказе от заказов */
  postV3ClickCollectOrdersStatusReject: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/marketplace/v3/click-collect/orders/status/reject`, body),
  /** POST /api/marketplace/v3/click-collect/orders/status/info — Получить статусы сборочных заданий */
  postV3ClickCollectOrdersStatusInfo: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/marketplace/v3/click-collect/orders/status/info`, body),
  /** POST /api/marketplace/v3/click-collect/orders/status/cancel — Отменить сборочные задания */
  postV3ClickCollectOrdersStatusCancel: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/marketplace/v3/click-collect/orders/status/cancel`, body),
  /** POST /api/marketplace/v3/click-collect/orders/meta/details — Получить идентификаторы маркировки сборочных заданий */
  postV3ClickCollectOrdersMetaDetails: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/marketplace/v3/click-collect/orders/meta/details`, body),
  /** POST /api/marketplace/v3/click-collect/orders/meta/delete — Удалить идентификаторы маркировки сборочных заданий */
  postV3ClickCollectOrdersMetaDelete: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/marketplace/v3/click-collect/orders/meta/delete`, body),
  /** POST /api/marketplace/v3/click-collect/orders/meta/sgtin — Закрепить коды маркировки Честного знака за сборочными заданиями */
  postV3ClickCollectOrdersMetaSgtin: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/marketplace/v3/click-collect/orders/meta/sgtin`, body),
  /** POST /api/marketplace/v3/click-collect/orders/meta/uin — Закрепить УИН за сборочными заданиями */
  postV3ClickCollectOrdersMetaUin: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/marketplace/v3/click-collect/orders/meta/uin`, body),
  /** POST /api/marketplace/v3/click-collect/orders/meta/imei — Закрепить IMEI за сборочными заданиями */
  postV3ClickCollectOrdersMetaImei: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/marketplace/v3/click-collect/orders/meta/imei`, body),
  /** POST /api/marketplace/v3/click-collect/orders/meta/gtin — Закрепить GTIN за сборочными заданиями */
  postV3ClickCollectOrdersMetaGtin: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/marketplace/v3/click-collect/orders/meta/gtin`, body),
  /** POST /api/marketplace/v3/click-collect/orders/meta/customs-declaration — Закрепить номера ДТ за сборочными заданиями */
  postV3ClickCollectOrdersMetaCustomsDeclaration: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.marketplace}/api/marketplace/v3/click-collect/orders/meta/customs-declaration`, body),
  /** POST /api/v1/acceptance/options — Опции приёмки */
  postV1AcceptanceOptions: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.supplies}/api/v1/acceptance/options`, body),
  /** GET /api/v1/supplies/{ID} — Детали поставки */
  getV1SuppliesId: (t: string, ID: string | number, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.supplies}/api/v1/supplies/${ID}${q(query)}`),
  /** GET /api/v1/supplies/{ID}/goods — Товары поставки */
  getV1SuppliesIdGoods: (t: string, ID: string | number, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.supplies}/api/v1/supplies/${ID}/goods${q(query)}`),
  /** GET /api/v1/supplies/{ID}/package — Упаковка поставки */
  getV1SuppliesIdPackage: (t: string, ID: string | number, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.supplies}/api/v1/supplies/${ID}/package${q(query)}`),
  /** POST /api/advert/v1/bids/min — Минимальные ставки для карточек товаров */
  post_api_advert_v1_bids_min: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.advert}/api/advert/v1/bids/min`, body),
  /** POST /adv/v2/seacat/save-ad — Создать кампанию */
  post_adv_v2_seacat_save_ad: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.advert}/adv/v2/seacat/save-ad`, body),
  /** POST /adv/v2/supplier/nms — Карточки товаров для кампаний */
  post_adv_v2_supplier_nms: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.advert}/adv/v2/supplier/nms`, body),
  /** GET /adv/v0/delete — Удаление кампании */
  get_adv_v0_delete: (t: string, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.advert}/adv/v0/delete${q(query)}`),
  /** POST /adv/v0/rename — Переименование кампании */
  post_adv_v0_rename: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.advert}/adv/v0/rename`, body),
  /** PUT /adv/v0/auction/placements — Изменение мест размещения в кампаниях с ручной ставкой */
  put_adv_v0_auction_placements: (t: string, body?: unknown) =>
    xfetch(t, 'PUT', `${WB_HOSTS.advert}/adv/v0/auction/placements`, body),
  /** PATCH /api/advert/v1/bids — Изменение ставок в кампаниях */
  patch_api_advert_v1_bids: (t: string, body?: unknown) =>
    xfetch(t, 'PATCH', `${WB_HOSTS.advert}/api/advert/v1/bids`, body),
  /** POST /adv/v1/budget/deposit — Пополнение бюджета кампании */
  post_adv_v1_budget_deposit: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.advert}/adv/v1/budget/deposit`, body),
  /** PATCH /adv/v0/auction/nms — Изменение списка карточек товаров в кампаниях */
  patch_adv_v0_auction_nms: (t: string, body?: unknown) =>
    xfetch(t, 'PATCH', `${WB_HOSTS.advert}/adv/v0/auction/nms`, body),
  /** GET /api/advert/v0/bids/recommendations — Рекомендуемые ставки для карточек товаров и поисковых кластеров */
  get_api_advert_v0_bids_recommendations: (t: string, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.advert}/api/advert/v0/bids/recommendations${q(query)}`),
  /** POST /adv/v0/normquery/stats — Статистика поисковых кластеров */
  post_adv_v0_normquery_stats: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.advert}/adv/v0/normquery/stats`, body),
  /** POST /adv/v0/normquery/get-bids — Список ставок поисковых кластеров */
  post_adv_v0_normquery_get_bids: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.advert}/adv/v0/normquery/get-bids`, body),
  /** POST /api/advert/v1/normquery/bids — Установить ставки для поисковых кластеров в валюте аккаунта продавца */
  postV1NormqueryBids: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.advert}/api/advert/v1/normquery/bids`, body),
  /** POST /adv/v0/normquery/bids — Установить ставки для поисковых кластеров */
  post_adv_v0_normquery_bids: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.advert}/adv/v0/normquery/bids`, body),
  /** DELETE /adv/v0/normquery/bids — Удалить ставки поисковых кластеров */
  delete_adv_v0_normquery_bids: (t: string) =>
    xfetch(t, 'DELETE', `${WB_HOSTS.advert}/adv/v0/normquery/bids`),
  /** POST /adv/v0/normquery/get-minus — Список минус-фраз кампаний */
  post_adv_v0_normquery_get_minus: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.advert}/adv/v0/normquery/get-minus`, body),
  /** POST /adv/v0/normquery/set-minus — Установка и удаление минус-фраз */
  post_adv_v0_normquery_set_minus: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.advert}/adv/v0/normquery/set-minus`, body),
  /** GET /adv/v1/advert — Информация о медиакампании */
  get_adv_v1_advert: (t: string, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.advertMedia}/adv/v1/advert${q(query)}`),
  /** POST /adv/v1/stats — Статистика медиакампаний */
  post_adv_v1_stats: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.advertMedia}/adv/v1/stats`, body),
  /** GET /api/v1/calendar/promotions/nomenclatures — Список товаров для участия в акции */
  get_api_v1_calendar_promotions_nomenclatures: (t: string, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.calendar}/api/v1/calendar/promotions/nomenclatures${q(query)}`),
  /** POST /api/v1/calendar/promotions/upload — Добавить товар в акцию */
  post_api_v1_calendar_promotions_upload: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.calendar}/api/v1/calendar/promotions/upload`, body),
  /** POST /adv/v0/normquery/list — Списки активных и неактивных поисковых кластеров */
  post_adv_v0_normquery_list: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.advert}/adv/v0/normquery/list`, body),
  /** POST /adv/v1/normquery/stats — Статистика по поисковым кластерам с детализацией по дням */
  post_adv_v1_normquery_stats: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.advert}/adv/v1/normquery/stats`, body),
  /** GET /api/v1/questions/count — Количество вопросов */
  getV1QuestionsCount: (t: string, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.feedbacks}/api/v1/questions/count${q(query)}`),
  /** GET /api/v1/question — Получить вопрос по ID */
  getV1Question: (t: string, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.feedbacks}/api/v1/question${q(query)}`),
  /** GET /api/v1/feedbacks/count — Количество отзывов */
  getV1FeedbacksCount: (t: string, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.feedbacks}/api/v1/feedbacks/count${q(query)}`),
  /** POST /api/v1/feedbacks/order/return — Возврат товара по ID отзыва */
  postV1FeedbacksOrderReturn: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.feedbacks}/api/v1/feedbacks/order/return`, body),
  /** GET /api/v1/feedback — Получить отзыв по ID */
  getV1Feedback: (t: string, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.feedbacks}/api/v1/feedback${q(query)}`),
  /** POST /api/v1/seller/message — Отправить сообщение */
  postV1SellerMessage: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.chat}/api/v1/seller/message`, body),
  /** GET /api/v1/seller/download/{id} — Получить файл из сообщения */
  getV1SellerDownloadId: (t: string, id: string | number, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.chat}/api/v1/seller/download/${id}${q(query)}`),
  /** POST /api/analytics/v3/sales-funnel/grouped/history — Статистика групп карточек товаров по дням */
  postV3SalesFunnelGroupedHistory: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.analytics}/api/analytics/v3/sales-funnel/grouped/history`, body),
  /** POST /api/v2/nm-report/downloads/retry — Сгенерировать отчёт повторно */
  postV2NmReportDownloadsRetry: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.analytics}/api/v2/nm-report/downloads/retry`, body),
  /** GET /api/v2/nm-report/downloads/file/{downloadId} — Получить отчёт */
  getV2NmReportDownloadsFileDownloadId: (t: string, downloadId: string | number, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.analytics}/api/v2/nm-report/downloads/file/${downloadId}${q(query)}`),
  /** POST /api/v2/search-report/report — Основная страница */
  postV2SearchReportReport: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.analytics}/api/v2/search-report/report`, body),
  /** POST /api/v2/search-report/table/groups — Пагинация по группам */
  postV2SearchReportTableGroups: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.analytics}/api/v2/search-report/table/groups`, body),
  /** POST /api/v2/search-report/table/details — Пагинация по товарам в группе */
  postV2SearchReportTableDetails: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.analytics}/api/v2/search-report/table/details`, body),
  /** POST /api/v2/search-report/product/search-texts — Поисковые запросы по товару */
  postV2SearchReportProductSearchTexts: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.analytics}/api/v2/search-report/product/search-texts`, body),
  /** POST /api/v2/search-report/product/orders — Заказы и позиции по поисковым запросам товара */
  postV2SearchReportProductOrders: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.analytics}/api/v2/search-report/product/orders`, body),
  /** POST /api/v2/stocks-report/products/groups — Данные по группам */
  postV2StocksReportProductsGroups: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.analytics}/api/v2/stocks-report/products/groups`, body),
  /** POST /api/v2/stocks-report/products/products — Данные по товарам */
  postV2StocksReportProductsProducts: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.analytics}/api/v2/stocks-report/products/products`, body),
  /** POST /api/v2/stocks-report/products/sizes — Данные по размерам */
  postV2StocksReportProductsSizes: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.analytics}/api/v2/stocks-report/products/sizes`, body),
  /** POST /api/v2/stocks-report/offices — Данные по складам */
  postV2StocksReportOffices: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.analytics}/api/v2/stocks-report/offices`, body),
  /** POST /api/analytics/v2/item-rating — Получить отчёт */
  postV2ItemRating: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.analytics}/api/analytics/v2/item-rating`, body),
  /** POST /api/analytics/v1/item-rating — Получить отчёт */
  postV1ItemRating: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.analytics}/api/analytics/v1/item-rating`, body),
  /** POST /api/analytics/v1/order-feed — Получить отчёт */
  postV1OrderFeed: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.analytics}/api/analytics/v1/order-feed`, body),
  /** POST /api/v1/analytics/excise-report — Получить отчёт */
  postV1AnalyticsExciseReport: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.analytics}/api/v1/analytics/excise-report`, body),
  /** GET /api/v1/warehouse_remains/tasks/{task_id}/status — Проверить статус */
  getV1WarehouseRemainsTasksTaskIdStatus: (t: string, task_id: string | number, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.analytics}/api/v1/warehouse_remains/tasks/${task_id}/status${q(query)}`),
  /** GET /api/v1/warehouse_remains/tasks/{task_id}/download — Получить отчёт */
  getV1WarehouseRemainsTasksTaskIdDownload: (t: string, task_id: string | number, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.analytics}/api/v1/warehouse_remains/tasks/${task_id}/download${q(query)}`),
  /** GET /api/analytics/v1/measurement-penalties — Удержания за занижение габаритов упаковки */
  getV1MeasurementPenalties: (t: string, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.analytics}/api/analytics/v1/measurement-penalties${q(query)}`),
  /** GET /api/analytics/v1/warehouse-measurements — Замеры склада */
  getV1WarehouseMeasurements: (t: string, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.analytics}/api/analytics/v1/warehouse-measurements${q(query)}`),
  /** GET /api/analytics/v1/deductions — Подмены и неверные вложения */
  getV1Deductions: (t: string, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.analytics}/api/analytics/v1/deductions${q(query)}`),
  /** GET /api/v1/analytics/goods-labeling — Маркировка товара */
  getV1AnalyticsGoodsLabeling: (t: string, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.analytics}/api/v1/analytics/goods-labeling${q(query)}`),
  /** GET /api/v1/acceptance_report — Создать отчёт */
  getV1AcceptanceReport: (t: string, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.analytics}/api/v1/acceptance_report${q(query)}`),
  /** GET /api/v1/acceptance_report/tasks/{task_id}/status — Проверить статус */
  getV1AcceptanceReportTasksTaskIdStatus: (t: string, task_id: string | number, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.analytics}/api/v1/acceptance_report/tasks/${task_id}/status${q(query)}`),
  /** GET /api/v1/acceptance_report/tasks/{task_id}/download — Получить отчёт */
  getV1AcceptanceReportTasksTaskIdDownload: (t: string, task_id: string | number, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.analytics}/api/v1/acceptance_report/tasks/${task_id}/download${q(query)}`),
  /** GET /api/v1/paid_storage/tasks/{task_id}/status — Проверить статус */
  getV1PaidStorageTasksTaskIdStatus: (t: string, task_id: string | number, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.analytics}/api/v1/paid_storage/tasks/${task_id}/status${q(query)}`),
  /** GET /api/v1/paid_storage/tasks/{task_id}/download — Получить отчёт */
  getV1PaidStorageTasksTaskIdDownload: (t: string, task_id: string | number, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.analytics}/api/v1/paid_storage/tasks/${task_id}/download${q(query)}`),
  /** GET /api/v1/analytics/brand-share/parent-subjects — Родительские категории бренда */
  getV1AnalyticsBrandShareParentSubjects: (t: string, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.analytics}/api/v1/analytics/brand-share/parent-subjects${q(query)}`),
  /** GET /api/v1/analytics/brand-share — Получить отчёт */
  getV1AnalyticsBrandShare: (t: string, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.analytics}/api/v1/analytics/brand-share${q(query)}`),
  /** GET /api/v1/analytics/banned-products/shadowed — Скрытые из каталога */
  getV1AnalyticsBannedProductsShadowed: (t: string, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.analytics}/api/v1/analytics/banned-products/shadowed${q(query)}`),
  /** POST /api/finance/v1/sales-reports/detailed/{reportId} — Детализации к отчётам реализации по ID отчётов */
  postV1SalesReportsDetailedReportId: (t: string, reportId: string | number, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.finance}/api/finance/v1/sales-reports/detailed/${reportId}`, body),
  /** POST /api/finance/v1/sales-reports/detailed — Детализации к отчётам реализации за период */
  postV1SalesReportsDetailed: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.finance}/api/finance/v1/sales-reports/detailed`, body),
  /** POST /api/finance/v1/acquiring/detailed/{reportId} — Детализации к отчётам об издержках на приём платежей по ID отчётов */
  postV1AcquiringDetailedReportId: (t: string, reportId: string | number, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.finance}/api/finance/v1/acquiring/detailed/${reportId}`, body),
  /** POST /api/finance/v1/acquiring/detailed — Детализации к отчётам об издержках на приём платежей за период */
  postV1AcquiringDetailed: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.finance}/api/finance/v1/acquiring/detailed`, body),
  /** GET /api/v1/documents/download — Получить документ */
  getV1DocumentsDownload: (t: string, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.documents}/api/v1/documents/download${q(query)}`),
  /** POST /api/v1/documents/download/all — Получить документы */
  postV1DocumentsDownloadAll: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.documents}/api/v1/documents/download/all`, body),
  /** POST /api/v1/keys-api/keys — Добавить ключи активации */
  LoadKeys: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.digital}/api/v1/keys-api/keys`, body),
  /** DELETE /api/v1/keys-api/keys — Удалить ключи активации */
  DeleteKeysByIDs: (t: string) =>
    xfetch(t, 'DELETE', `${WB_HOSTS.digital}/api/v1/keys-api/keys`),
  /** GET /api/v1/keys-api/keys/redeemed — Получить купленные ключи */
  GetRedeemedKeys: (t: string, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.digital}/api/v1/keys-api/keys/redeemed${q(query)}`),
  /** GET /api/v1/offer/keys/{offer_id} — Получить количество ключей для предложения */
  offerKeysCountGet: (t: string, offer_id: string | number, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.digital}/api/v1/offer/keys/${offer_id}${q(query)}`),
  /** GET /api/v1/offer/keys/{offer_id}/list — Получить список ключей */
  offerKeysGet: (t: string, offer_id: string | number, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.digital}/api/v1/offer/keys/${offer_id}/list${q(query)}`),
  /** POST /api/v1/offers — Создать новое предложение */
  offerCreate: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.digital}/api/v1/offers`, body),
  /** POST /api/v1/offers/thumb — Добавить или обновить обложку предложения */
  offersUploadThumbnail: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.digital}/api/v1/offers/thumb`, body),
  /** POST /api/v1/offers/{offer_id} — Редактировать предложение */
  offerUpdate: (t: string, offer_id: string | number, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.digital}/api/v1/offers/${offer_id}`, body),
  /** GET /api/v1/offers/{offer_id} — Получить информацию о предложении */
  offerGet: (t: string, offer_id: string | number, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.digital}/api/v1/offers/${offer_id}${q(query)}`),
  /** GET /api/v1/offers/author — Получить список своих предложений */
  offersAuthorGet: (t: string, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.digital}/api/v1/offers/author${q(query)}`),
  /** POST /api/v1/offer/price/{offer_id} — Обновить цену */
  offerUpdatePrice: (t: string, offer_id: string | number, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.digital}/api/v1/offer/price/${offer_id}`, body),
  /** POST /api/v1/offer/{offer_id} — Обновить статус */
  offerUpdateStatus: (t: string, offer_id: string | number, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.digital}/api/v1/offer/${offer_id}`, body),
  /** GET /api/v1/catalog — Получить категории и их подкатегории */
  GetCatalog: (t: string, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.digital}/api/v1/catalog${q(query)}`),
  /** POST /api/v1/content/illustration — Загрузить обложку контента */
  contentUploadIllustration: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.digital}/api/v1/content/illustration`, body),
  /** POST /api/v1/content/upload/init — Инициализировать новый контент */
  contentUploadInit: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.digital}/api/v1/content/upload/init`, body),
  /** POST /api/v1/content/upload/chunk — Загрузить контент (файл) */
  contentUploadChunk: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.digital}/api/v1/content/upload/chunk`, body),
  /** POST /api/v1/content/author/{content_id} — Редактировать контент */
  contentUpdate: (t: string, content_id: string | number, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.digital}/api/v1/content/author/${content_id}`, body),
  /** GET /api/v1/content/author/{content_id} — Получить информацию о контенте */
  contentIdGet: (t: string, content_id: string | number, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.digital}/api/v1/content/author/${content_id}${q(query)}`),
  /** GET /api/v1/content/author — Получить список своего контента */
  contentAuthorGet: (t: string, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.digital}/api/v1/content/author${q(query)}`),
  /** GET /api/v1/content/download/{uri} — Скачать контент */
  contentDownloadGet: (t: string, uri: string | number, query: Record<string, string | number | boolean | undefined> = {}) =>
    xfetch(t, 'GET', `${WB_HOSTS.digital}/api/v1/content/download/${uri}${q(query)}`),
  /** POST /api/v1/content/delete — Удалить контент */
  contentDelete: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.digital}/api/v1/content/delete`, body),
  /** POST /api/v1/content/gallery — Загрузить медиафайлы для предложения */
  contentGallery: (t: string, body?: unknown) =>
    xfetch(t, 'POST', `${WB_HOSTS.digital}/api/v1/content/gallery`, body),
} as const;

export const WB_OPENAPI_EXTRA_COUNT = 185;

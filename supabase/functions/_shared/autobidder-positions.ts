/**
 * Позиция карточки по кластеру для автобиддера.
 *
 * Источник — официальный отчёт продавца
 * POST /api/v2/search-report/product/orders (seller-analytics-api), тот же, что
 * показывает экран кластеров. Сканировать публичную выдачу search.wb.ru для
 * этого нельзя: она обрывается на 3-й странице (дальше молча отдаёт первую),
 * не показывает наши рекламные места и упирается в 429. Проверено 16.09.2026:
 * скан давал «нет в топ-1000» там, где отчёт WB показывал 9-е и 22-е место.
 *
 * Лимиты отчёта: 30 фраз за запрос, 3 запроса в минуту на кабинет, период не
 * больше 7 дней, данные по дням с задержкой. Поэтому позиции кешируются и тик
 * (каждые 3-5 минут) почти всегда берёт их из кеша.
 */

import { type ClusterPosition } from './wb-cluster-board.ts';

/** Позиция старше этого срока для управления ставкой уже не годится. */
export const POSITION_MAX_AGE_DAYS = 3;

/** Как долго живёт кеш позиций: отчёт всё равно обновляется не чаще раза в час. */
export const POSITION_CACHE_TTL_MIN = 180;

export type PositionSignal = {
    /** Позиция за самый свежий день, где WB её вообще дал. */
    position: number | null;
    /** Дата этого дня, YYYY-MM-DD. */
    date: string | null;
    /** Частота запроса за период: 0 значит, что кластер не ищут. */
    frequency: number;
    ordersInPeriod: number;
    /** Позиция есть, но она слишком старая, чтобы по ней двигать ставку. */
    stale: boolean;
};

function dayNumber(iso: string): number {
    const t = Date.parse(iso + 'T00:00:00Z');
    return Number.isFinite(t) ? Math.floor(t / 86400000) : NaN;
}

/**
 * Берём последний день с позицией, а не среднее за период: неделю назад мы
 * могли стоять в топе с другой ставкой, и среднее уводит биддер не туда.
 */
export function positionSignal(
    report: ClusterPosition | null | undefined,
    today: string,
    maxAgeDays = POSITION_MAX_AGE_DAYS,
): PositionSignal {
    if (!report) {
        return { position: null, date: null, frequency: 0, ordersInPeriod: 0, stale: false };
    }
    const days = (report.days || [])
        .filter((d) => d.date && d.avgPosition != null && d.avgPosition > 0)
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const latest = days[0];
    const orders = (report.days || []).reduce((s, d) => s + (Number(d.orders) || 0), 0);
    if (!latest) {
        return {
            position: null,
            date: null,
            frequency: Number(report.frequency) || 0,
            ordersInPeriod: orders,
            stale: false,
        };
    }
    const ageDays = dayNumber(today) - dayNumber(latest.date);
    const stale = Number.isFinite(ageDays) && ageDays > maxAgeDays;
    return {
        position: stale ? null : Math.round(Number(latest.avgPosition)),
        date: latest.date,
        frequency: Number(report.frequency) || 0,
        ordersInPeriod: orders,
        stale,
    };
}

/**
 * Кластер, который никто не ищет, двигать ставкой бессмысленно: показов по нему
 * не будет ни на какой ставке. Такие пропускаем, чтобы не жечь лимиты и не
 * писать в историю пустые решения.
 */
export function isDeadCluster(signal: PositionSignal): boolean {
    return signal.frequency === 0 && signal.position == null && signal.ordersInPeriod === 0;
}

export type CorridorBounds = { min: number | null; max: number | null };

/**
 * Границы ставки: правило пользователя главнее, но там, где он ничего не задал,
 * подставляем коридор WB — это честнее, чем пускать ставку в бесконечность.
 */
export function boundsFromCorridor(
    ruleFloor: number,
    ruleMax: number | null,
    corridor: CorridorBounds | null,
): { minBidFloor: number; maxBid: number | null } {
    const floor = Number(ruleFloor) || 0;
    const wbMin = corridor?.min != null && corridor.min > 0 ? corridor.min : null;
    const wbMax = corridor?.max != null && corridor.max > 0 ? corridor.max : null;
    const minBidFloor = floor > 0 ? floor : (wbMin ?? 0);
    let maxBid: number | null;
    if (ruleMax != null && Number.isFinite(Number(ruleMax))) maxBid = Number(ruleMax);
    else maxBid = wbMax;
    // Потолок ниже пола — правило противоречиво, тянем потолок до пола.
    if (maxBid != null && minBidFloor > 0 && maxBid < minBidFloor) maxBid = minBidFloor;
    return { minBidFloor, maxBid };
}

export type PositionCacheRow = {
    clusterKey: string;
    position: number | null;
    date: string | null;
    frequency: number;
    fetchedAt: string;
};

export function cacheIsFresh(
    fetchedAt: string | null | undefined,
    nowMs: number,
    ttlMin = POSITION_CACHE_TTL_MIN,
): boolean {
    if (!fetchedAt) return false;
    const t = Date.parse(fetchedAt);
    if (!Number.isFinite(t)) return false;
    return nowMs - t < ttlMin * 60000;
}

/**
 * Какие кластеры надо запросить: те, которых нет в кеше или чей кеш просрочен.
 * Порядок сохраняем — по нему потом режем на порции по 30 фраз.
 */
export function clustersNeedingPositions(
    clusterKeys: string[],
    cache: Map<string, PositionCacheRow>,
    nowMs: number,
    ttlMin = POSITION_CACHE_TTL_MIN,
): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const raw of clusterKeys) {
        const key = String(raw ?? '').trim();
        if (!key) continue;
        const low = key.toLowerCase();
        if (seen.has(low)) continue;
        seen.add(low);
        const hit = cache.get(low);
        if (!hit || !cacheIsFresh(hit.fetchedAt, nowMs, ttlMin)) out.push(key);
    }
    return out;
}

/** Период для отчёта: WB отдаёт максимум 7 дней, включая сегодня. */
export function reportPeriod(today: string, days = 7): { start: string; end: string } {
    const end = today;
    const startMs = Date.parse(today + 'T00:00:00Z') - (days - 1) * 86400000;
    const start = new Date(startMs).toISOString().slice(0, 10);
    return { start, end };
}

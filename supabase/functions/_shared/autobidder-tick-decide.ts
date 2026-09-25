// Ядро тика autobidder (docs/autobidder-tick-plan.md + ответы 09.09.2026).
// Чистые функции: без Deno/WB. Способ A и живая выдача — заглушки.

export type Strategy = 'min_sufficient' | 'max_visibility' | 'fixed_position';

export type DecideInput = {
    myPos: number | null;
    myBid: number;
    targetPosFrom: number;
    targetPosTo: number;
    stepPct: number;
    hysteresis: number;
    minBidFloor: number;
    maxBid: number | null;
    /** default 'min_sufficient' — см. docs/autobidder.md разд. 8 (подписи UI ads-hq-strategy). */
    strategy?: Strategy;
    budgetCabinetExhausted?: boolean;
    budgetGroupExhausted?: boolean;
};

export type DecideResult = {
    newBid: number;
    reason: string;
    apply: boolean;
};

export const CANON = {
    targetPosFrom: 5,
    targetPosTo: 10,
    myBid: 100,
    stepPct: 0.07,
    hysteresis: 0.03,
    minBidFloor: 50,
    maxBid: 150,
} as const;

/** Способ A — заглушка до шага 7. Всегда null. */
export function fetchAuction(_clusterKey: string): null {
    return null;
}

/**
 * Формула потолка ставки из целевого ДРР (docs/autobidder.md разд. 7.1).
 * ПОДГОТОВЛЕНО, НО НЕ ПОДКЛЮЧЕНО к живому тику: autobidder-tick сегодня не
 * знает per-cluster CTR/CR — adv_daily_stats пишется только на уровне всей
 * кампании (cluster_key всегда NULL, см. sync-daily-stats/index.ts). Строка
 * с strategy='target_drr' в autobidder_rules пока сознательно не читается
 * тиком (см. фильтр в autobidder-tick/index.ts) — иначе это выглядело бы
 * рабочей фичей, которая на деле ничего не считает.
 *
 * allowed_ad_spend_per_order = price * target_drr_pct / 100
 * expected_orders_per_1000_impr = ctrCluster * crCluster * 1000
 * max_bid_effective = allowed_ad_spend_per_order * expected_orders_per_1000_impr
 */
export function maxBidFromTargetDrr(input: {
    price: number;
    targetDrrPct: number;
    ctrCluster: number; // доля, не проценты (0.03 = 3%)
    crCluster: number; // доля кликов, ставших заказом
}): number | null {
    const price = Number(input.price);
    const targetDrrPct = Number(input.targetDrrPct);
    const ctr = Number(input.ctrCluster);
    const cr = Number(input.crCluster);
    if (!Number.isFinite(price) || price <= 0) return null;
    if (!Number.isFinite(targetDrrPct) || targetDrrPct <= 0) return null;
    if (!Number.isFinite(ctr) || ctr <= 0 || !Number.isFinite(cr) || cr <= 0) return null;

    const allowedAdSpendPerOrder = (price * targetDrrPct) / 100;
    const expectedOrdersPer1000Impr = ctr * cr * 1000;
    const maxBidEffective = allowedAdSpendPerOrder * expectedOrdersPer1000Impr;
    return Number.isFinite(maxBidEffective) ? maxBidEffective : null;
}

/**
 * Позиция в рекламной выдаче.
 * TODO(step 7): search.wb.ru / DevTools JSON. Пока null, либо override для тестов/ручного запуска.
 */
export function getAdPosition(
    _nmId: number,
    _clusterKey: string,
    override?: number | null,
): number | null {
    if (override !== undefined) return override;
    return null;
}

/** Оценка расхода между синками. TODO: живые показы после Способа A. */
export function spendEstimateBetweenSyncs(): number {
    return 0;
}

export function isCapExhausted(spend: number, cap: number | null | undefined): boolean {
    if (cap == null || !Number.isFinite(Number(cap))) return false;
    return Number(spend) >= Number(cap);
}

export function ceilRub(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.ceil(value - 1e-9);
}

export function tokenInvalidResult(myBid: number): DecideResult {
    return { newBid: myBid, reason: 'token_invalid', apply: false };
}

export async function settleCabinets<T>(
    tasks: Array<() => Promise<T>>,
): Promise<PromiseSettledResult<T>[]> {
    return Promise.allSettled(tasks.map((fn) => fn()));
}

export function decideBid(input: DecideInput): DecideResult {
    const floor = Number(input.minBidFloor) || 0;
    const myBid = Number(input.myBid);
    const base = myBid > 0 ? myBid : floor;
    const step = Math.max(base * Number(input.stepPct), 1);
    const maxBid = input.maxBid == null || input.maxBid === ('' as unknown)
        ? null
        : Number(input.maxBid);
    const hasMax = maxBid != null && Number.isFinite(maxBid);

    const strategy: Strategy = input.strategy || 'min_sufficient';
    let candidate: number;
    let reason: string;

    if (input.budgetGroupExhausted) {
        candidate = floor;
        reason = 'budget_cap_group';
    } else if (input.budgetCabinetExhausted) {
        candidate = floor;
        reason = 'budget_cap_cabinet';
    } else if (strategy === 'max_visibility') {
        // «Видимость до потолка» — не держим коридор позиций, всегда идём
        // к максимально разрешённой ставке (ручной max_bid или коридор WB).
        candidate = hasMax ? (maxBid as number) : base + step;
        reason = 'max_visibility';
    } else if (input.myPos == null) {
        candidate = base + step;
        reason = 'pos_unknown';
    } else if (input.myPos > input.targetPosTo) {
        candidate = base + step;
        reason = 'pos_worse';
    } else if (input.myPos < input.targetPosFrom) {
        // «Держать коридор позиций» — в отличие от min_sufficient, не срезаем
        // ставку, если позиция и так лучше нужного: держим, не гонимся за
        // экономией, чтобы не терять место лишний раз туда-обратно.
        if (strategy === 'fixed_position') {
            candidate = base;
            reason = 'in_range';
        } else {
            candidate = base - step;
            reason = 'pos_better';
        }
    } else {
        candidate = base;
        reason = 'in_range';
    }

    const wantedRaise = candidate > (myBid > 0 ? myBid : base);
    if (!hasMax && candidate > myBid) {
        candidate = myBid;
    }

    let newBid = ceilRub(candidate);
    if (newBid < floor) newBid = floor;
    if (hasMax && newBid > (maxBid as number)) newBid = maxBid as number;
    if (!hasMax && newBid > myBid) newBid = myBid;

    if (strategy !== 'max_visibility' && input.myPos == null && hasMax && newBid === maxBid && wantedRaise) {
        reason = 'pos_unknown|max_bid_hit';
    } else if (
        strategy !== 'max_visibility' &&
        input.myPos != null &&
        hasMax &&
        newBid === maxBid &&
        wantedRaise &&
        reason !== 'budget_cap_group' &&
        reason !== 'budget_cap_cabinet'
    ) {
        reason = 'max_bid_hit';
    }

    if (reason === 'in_range') {
        return { newBid, reason, apply: false };
    }

    if (myBid > 0 && Math.abs(newBid - myBid) / myBid < Number(input.hysteresis)) {
        return { newBid: myBid, reason: 'hysteresis', apply: false };
    }

    return { newBid, reason, apply: newBid !== myBid };
}

// Ежедневные шаги по рекламе по правилам владельца: чистая логика без сети.
// Zevina 1: ставки по цене заказа и ДРР, пополнение «сливных». Baza и Elium: жёсткий дневной лимит, утро и вечер.
// Деньги в сомах/рублях как в кабинете WB, ставки в копейках.

export interface BidLine { nm_id: number; bid_kopecks: number }

export const round5 = (kop: number) => Math.round(kop / 5) * 5;

/** Новая ставка: множитель, округление до 5 копеек, пределы. */
export function scaleBid(bid: number, mult: number, minKop: number, maxKop = 5_000_000): number {
    return Math.min(maxKop, Math.max(minKop, round5(bid * mult)));
}

// ───────── Baza и Elium ─────────

export interface CapRule {
    key: string;
    label: string;
    cabinetId: string;
    advertId: number;
    cap: number;                // дневной лимит расхода
    morningTopupTo: number;     // утром довести остаток до
    eveningLow: number;         // вечером допополнить, если остаток меньше
    minBidKop: number;
    mode: 'cpo_target' | 'cpo_max';
    cpoHigh: number;            // выше этого снижаем ставку на 10%
    cpoLow?: number;            // ниже этого и заказов меньше, чем позавчера, поднимаем на 5%
}

export const CAP_RULES: CapRule[] = [
    { key: 'baza', label: 'Baza «Куртка СПС тест»', cabinetId: 'dac666b6-88e7-4eae-997e-6d8519ba779c', advertId: 40775161,
      cap: 6000, morningTopupTo: 3300, eveningLow: 1500, minBidKop: 600, mode: 'cpo_target', cpoHigh: 350, cpoLow: 250 },
    { key: 'elium', label: 'Elium «СПС Жилетки»', cabinetId: '7efa5043-1bdd-41c3-bb5a-a2807ed83f5c', advertId: 39662850,
      cap: 3600, morningTopupTo: 2000, eveningLow: 900, minBidKop: 100, mode: 'cpo_max', cpoHigh: 120 },
];

export interface DayStat { orders: number; spend: number }

export type BidVerdict = { mult: number; reason: string } | { mult: 1; hold: true; reason: string; alert?: boolean };

/** Утреннее решение по ставке: по вчерашней цене заказа. Меняем не больше чем на 10%. */
export function morningBidVerdict(rule: CapRule, yest: DayStat, prev: DayStat): BidVerdict {
    if (prev.orders > 0 && yest.orders < prev.orders * 0.7) {
        return { mult: 1, hold: true, alert: true, reason: `заказы упали ${prev.orders} → ${yest.orders}, решает владелец` };
    }
    if (yest.orders <= 0) return { mult: 1, hold: true, reason: 'вчера не было заказов, ставку не трогаю' };
    const cpo = yest.spend / yest.orders;
    if (cpo > rule.cpoHigh) return { mult: 0.9, reason: `заказ ${Math.round(cpo)} ₽ (цель ${rule.mode === 'cpo_target' ? 300 : rule.cpoHigh})` };
    if (rule.cpoLow && cpo < rule.cpoLow && yest.orders < prev.orders) return { mult: 1.05, reason: `заказ ${Math.round(cpo)} ₽, заказов меньше (${yest.orders} против ${prev.orders})` };
    return { mult: 1, hold: true, reason: `заказ ${Math.round(cpo)} ₽, в норме` };
}

/** Сколько пополнить: не больше, чем «потрачено сегодня + остаток ≤ лимит», и не больше баланса. */
export function topupAmount(rule: CapRule, budget: number, spentToday: number, target: number, balanceNet: number): number {
    const toTarget = target - budget;
    const room = rule.cap - spentToday - budget;
    const amount = Math.floor(Math.min(toTarget, room, balanceNet));
    return amount >= 100 ? amount : 0;
}

export function morningTopup(rule: CapRule, budget: number, spentToday: number, balanceNet: number): number {
    return topupAmount(rule, budget, spentToday, rule.morningTopupTo, balanceNet);
}

/** Вечером: если остатка мало, допополняем до лимита дня (потрачено + остаток = лимит). */
export function eveningTopup(rule: CapRule, budget: number, spentToday: number, balanceNet: number): number {
    if (budget >= rule.eveningLow) return 0;
    return topupAmount(rule, budget, spentToday, rule.cap, balanceNet);
}

/** Контроль темпа к 18:00: больше 70% лимита, а вечер впереди, ставку минус 10%. */
export function eveningPaceVerdict(rule: CapRule, spentToday: number): BidVerdict {
    const share = spentToday / rule.cap;
    if (share > 0.7) return { mult: 0.9, reason: `потрачено ${Math.round(spentToday)} из ${rule.cap} ₽` };
    return { mult: 1, hold: true, reason: share < 0.4 ? `потрачено только ${Math.round(spentToday)} из ${rule.cap} ₽` : `потрачено ${Math.round(spentToday)} из ${rule.cap} ₽` };
}

// ───────── Zevina 1 ─────────

export interface ZevinaCampaign { advertId: number; label: string; drain?: boolean; topup?: boolean }

export const ZEVINA_CABINET = '21cffafa-bca2-4984-b5f8-5c426e6f538b';
export const ZEVINA_CAMPAIGNS: ZevinaCampaign[] = [
    { advertId: 39497221, label: 'СРС Пиджаки оверсайз', topup: true },
    { advertId: 40732240, label: 'Свитер айвори' },                    // пополнять только по явной просьбе владельца
    { advertId: 39497232, label: 'СРС Костюм оверсайз', topup: true },
    { advertId: 39497335, label: 'СРС Свитера', topup: true },
    { advertId: 41028166, label: 'СПС Кимоно летний (слив)', drain: true, topup: true },
    { advertId: 40782373, label: 'Спорт sport_rich СПС (слив)', drain: true, topup: true },
];
export const ZEVINA_BID_CEILING_KOP = 2500;
export const ZEVINA_TOPUP_BELOW = 500;
export const ZEVINA_TOPUP_TO = 1500;
export const ZEVINA_TOPUP_DAILY_MAX = 3000;
export const ZEVINA_MIN_BID_KOP = 400;

/** Решение по ставкам кампании Zevina 1: по цене заказа кампании и ДРР кабинета. */
export function zevinaBidVerdict(c: ZevinaCampaign, yest: DayStat, cabinetDrrPct: number, threeDayNoOrders: boolean): BidVerdict {
    if (c.drain) {
        if (threeDayNoOrders) return { mult: 0.9, reason: 'слив: 3 дня тратит и без заказов', alert: true } as BidVerdict;
        return { mult: 1, hold: true, reason: yest.orders > 0 ? `слив: заказ ${Math.round(yest.spend / yest.orders)} ₽` : 'слив: ставку не трогаю' };
    }
    if (yest.orders <= 0) return { mult: 1, hold: true, reason: 'вчера не было заказов' };
    const cpo = yest.spend / yest.orders;
    if (cabinetDrrPct > 15) return { mult: 0.9, reason: `ДРР кабинета ${cabinetDrrPct.toFixed(1)}%` };
    if (cabinetDrrPct < 10 && cpo < 300) return { mult: 1.1, reason: `заказ ${Math.round(cpo)} ₽, ДРР ${cabinetDrrPct.toFixed(1)}%` };
    return { mult: 1, hold: true, reason: `заказ ${Math.round(cpo)} ₽, ДРР ${cabinetDrrPct.toFixed(1)}%` };
}

/** Пополнение Zevina 1: остаток меньше порога, довести до 1 500, не больше дневного максимума на все кампании. */
export function zevinaTopup(budget: number, spentToday: number, balanceNet: number): { amount: number; spentToday: number } {
    if (budget >= ZEVINA_TOPUP_BELOW) return { amount: 0, spentToday };
    const amount = Math.floor(Math.min(ZEVINA_TOPUP_TO - budget, ZEVINA_TOPUP_DAILY_MAX - spentToday, balanceNet));
    return amount >= 100 ? { amount, spentToday: spentToday + amount } : { amount: 0, spentToday };
}

/** Короткая строка в РНП до 100 символов. */
export function bidNote(prefix: string, from: number, to: number, tail: string): string {
    const f = (k: number) => (k / 100).toFixed(2).replace('.', ',');
    return `${prefix}: ставка ${f(from)} → ${f(to)} ₽, ${tail}`.slice(0, 100);
}

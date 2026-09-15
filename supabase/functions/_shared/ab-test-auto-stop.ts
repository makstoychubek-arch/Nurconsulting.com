/**
 * Автоостановка А/Б: цель — найти фото с CTR от N% и выше (по умолчанию 5),
 * не обязательно ждать 2000 показов на каждый вариант.
 * Победитель: stopOnWinner=true в настройках теста, уверенно лучше
 * (Beta-биномиальная вероятность) + CTR ≥ цели + достаточно показов.
 */

import { probabilityBestByCtr } from './ab-test-report-card.ts';

export const AB_DEFAULT_MIN_CTR = 5;
export const AB_DEFAULT_WINNER_PROB = 0.85;
export const AB_DEFAULT_WINNER_IMPRESSIONS = 400;
export const AB_DEFAULT_MIN_IMPRESSIONS = 2000;

export type AbAutoStopReason = 'winner_determined' | 'impressions_cap';

export type AbAutoStopHit = {
    reason: AbAutoStopReason;
    leaderLabel: string;
    leaderCtr: number;
    maxProb: number;
};

export function variantCtr(v: { impressions?: number; clicks?: number }): number {
    const imp = Number(v.impressions) || 0;
    const clk = Number(v.clicks) || 0;
    return imp > 0 ? (clk / imp) * 100 : 0;
}

export function parseMinCtr(settings: Record<string, unknown> | null | undefined): number {
    const n = Number(settings?.minCtr);
    return Number.isFinite(n) && n > 0 ? n : AB_DEFAULT_MIN_CTR;
}

export function decideAbAutoStop(
    settings: Record<string, unknown> | null | undefined,
    variants: Array<{ variant_label: string; impressions?: number; clicks?: number }>,
    probs?: Map<string, number>,
): AbAutoStopHit | null {
    if (!variants || variants.length < 2) return null;
    const s = settings || {};
    const stopOnWinner = s.stopOnWinner === true;
    const autoStop = s.autoStop !== false;
    const ctrGoal = parseMinCtr(s);
    const minProbRaw = Number(s.minWinnerProb);
    const probGoal = Number.isFinite(minProbRaw) && minProbRaw > 0 && minProbRaw <= 1
        ? minProbRaw
        : AB_DEFAULT_WINNER_PROB;
    const minWinImp = Number(s.minWinnerImpressions) > 0
        ? Number(s.minWinnerImpressions)
        : AB_DEFAULT_WINNER_IMPRESSIONS;
    const minImpressions = Number(s.minImpressions) > 0
        ? Number(s.minImpressions)
        : AB_DEFAULT_MIN_IMPRESSIONS;

    const map = probs || probabilityBestByCtr(variants);
    const ranked = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    const leaderLabel = ranked[0]?.[0] || '';
    const maxProb = ranked[0]?.[1] || 0;
    const leader = variants.find((v) => v.variant_label === leaderLabel) || variants[0];
    const leaderCtr = variantCtr(leader);
    const leaderImp = Number(leader?.impressions) || 0;

    // Сначала победитель — можно остановиться раньше 2000 показов.
    if (
        stopOnWinner
        && maxProb >= probGoal
        && leaderCtr + 1e-9 >= ctrGoal
        && leaderImp >= minWinImp
    ) {
        return { reason: 'winner_determined', leaderLabel, leaderCtr, maxProb };
    }

    if (autoStop && variants.every((v) => (Number(v.impressions) || 0) >= minImpressions)) {
        return { reason: 'impressions_cap', leaderLabel, leaderCtr, maxProb };
    }
    return null;
}

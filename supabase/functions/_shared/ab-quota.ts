// А/Б-тест: смена фото по набранным показам, а не по времени.
//
// Каждое фото крутится, пока не наберёт заданное число показов (settings.minImpressions, по умолчанию 2000),
// и сразу уступает следующему. Так варианты получают поровну показов, а не поровну минут.
// Показы считаем по замерам РК (ab_test_adv_snapshots): прирост между замерами внутри текущего окна показа.
// Если показов нет совсем (РК на паузе, нет бюджета), по истечении «потолка» меняем фото по времени,
// чтобы тест не завис на одном фото навсегда.
// deno-lint-ignore-file no-explicit-any

import { attributeSnapshots } from './ab-adv-snapshots.ts';

export const DEFAULT_QUOTA = 2000;
export const MIN_CAP_MIN = 360; // 6 часов: меньше этого «потолок» не бывает

/** Квота показов на одно окно или 0, если тест крутится по времени. */
export function quotaOf(test: any): number {
    const s = test?.settings || {};
    if (s.rotateByImpressions !== true) return 0;
    const adsOn = s.sources ? Boolean(s.sources.ads) : true;
    const camps = Array.isArray(s.campaigns) ? s.campaigns.map(Number).filter((n: number) => n > 0) : [];
    if (!adsOn || camps.length === 0) return 0; // без рекламы показы не измерить: крутим по времени
    const q = Number(s.minImpressions);
    return q > 0 ? q : DEFAULT_QUOTA;
}

export type Decision = { due: boolean; reason: 'quota' | 'cap' | 'wait' };

export function decideRotation(i: { quota: number; intervalMin: number; elapsedMs: number; windowImpressions: number; stepImpressions?: number }): Decision {
    if (i.windowImpressions >= i.quota) return { due: true, reason: 'quota' };
    // Проверка раз в 10 минут: если до следующего замера фото перелетит квоту сильнее, чем сейчас недобрало,
    // меняем сразу (940 вместо 1400 при квоте 1000).
    const step = Number(i.stepImpressions) || 0;
    if (step > 0 && i.windowImpressions + step >= i.quota && i.quota - i.windowImpressions < i.windowImpressions + step - i.quota) {
        return { due: true, reason: 'quota' };
    }
    const capMs = Math.max(MIN_CAP_MIN, Number(i.intervalMin) || 0) * 60_000;
    if (i.elapsedMs >= capMs) return { due: true, reason: 'cap' };
    return { due: false, reason: 'wait' };
}

/** Показы текущего окна (с момента последней смены фото) по замерам. */
export async function windowImpressions(admin: any, test: any, windowStart: Date, now = new Date()): Promise<number> {
    const from = new Date(windowStart.getTime() - 2 * 3600_000).toISOString(); // замер до начала окна нужен как точка отсчёта
    const { data } = await admin.from('ab_test_adv_snapshots')
        .select('campaign_id, taken_at, stat_date, views, clicks, atbs, orders, spend')
        .eq('test_id', test.id).gte('taken_at', from).order('taken_at');
    const snaps = (data || []).map((r: any) => ({
        campaign_id: Number(r.campaign_id), taken_at: r.taken_at, stat_date: String(r.stat_date),
        views: Number(r.views) || 0, clicks: Number(r.clicks) || 0, atbs: Number(r.atbs) || 0,
        orders: Number(r.orders) || 0, spend: Number(r.spend) || 0,
    }));
    const res = attributeSnapshots(snaps, [{ label: 'cur', start: windowStart, end: now }]);
    return res.get('cur')?.impressions || 0;
}

/**
 * Последнее окно: все остальные фото уже набрали квоту, и это набрало тоже. Менять дальше некуда:
 * автостоп сам завершит тест. Иначе фото успело бы вернуться к первому варианту прямо перед финишем.
 */
export function isFinalWindow(variants: any[], curIdx: number, windowImps: number, quota: number, autoStop: boolean): boolean {
    if (!autoStop || windowImps < quota) return false;
    return variants.every((v, i) => i === curIdx || Number(v.impressions || 0) >= quota);
}

// А/Б-тест: показы и клики варианта по реальным окнам, а не делением суточного итога.
//
// WB отдаёт статистику РК по дням, без часов, и с задержкой. Поэтому каждые 10 минут (на тике
// ab-test-rotate) снимаем накопленные «за сегодня» числа по товару теста и сохраняем замер.
// Прирост между двумя замерами делим по окнам показа фото, которые попали в этот интервал
// (границы окон из ab_test_rotation_log). Ротация идёт сразу после замера, поэтому почти весь
// следующий интервал целиком падает на новое фото.
// deno-lint-ignore-file no-explicit-any

import { CABINET_TOKEN_SELECT, pickCabinetToken } from './wb-cabinet-tokens.ts';
import { moscowYmd } from './wb-funnel-day.ts';

export const ADV_API = 'https://advert-api.wildberries.ru';
const MIN_GAP_MS = 2 * 60 * 1000; // не чаще раза в 2 минуты (ручные вызовы не должны давить на лимит WB)

export type Cumulative = { views: number; clicks: number; atbs: number; orders: number; spend: number };
export type Snap = Cumulative & { campaign_id: number; taken_at: string | number | Date; stat_date: string };
export type Win = { label: string; start: Date; end: Date };
export type Bucket = { impressions: number; clicks: number; atbs: number; orders: number; adSpend: number };

const ZERO: Cumulative = { views: 0, clicks: 0, atbs: 0, orders: 0, spend: 0 };

/** Накопленные за день числа по одному товару из дня `fullstats` (apps[].nms[]). */
export function extractNmCumulative(day: any, nmId: number): Cumulative {
    const out = { ...ZERO };
    const apps = Array.isArray(day?.apps) ? day.apps : [];
    for (const app of apps) {
        const nms = Array.isArray(app?.nms) ? app.nms : [];
        for (const nm of nms) {
            if (Number(nm?.nmId ?? nm?.nm_id ?? 0) !== Number(nmId)) continue;
            out.views += Number(nm.views || 0);
            out.clicks += Number(nm.clicks || 0);
            out.atbs += Number(nm.atbs || 0);
            out.orders += Number(nm.orders || 0);
            out.spend += Number(nm.sum || 0);
        }
    }
    return out;
}

const ms = (v: string | number | Date) => new Date(v).getTime();

/**
 * Делит прирост между замерами по окнам показа. Замеры одной кампании идут по возрасту.
 * Прирост = разница накопленных чисел; если счётчик «упал» (WB пересчитал), прирост 0;
 * если сменился день, берём накопленное нового дня (счётчик начался с нуля).
 */
export function attributeSnapshots(snaps: Snap[], windows: Win[]): Map<string, Bucket> {
    const result = new Map<string, Bucket>();
    const add = (label: string, k: keyof Bucket, v: number) => {
        const b = result.get(label) || { impressions: 0, clicks: 0, atbs: 0, orders: 0, adSpend: 0 };
        b[k] += v;
        result.set(label, b);
    };
    const byCampaign = new Map<number, Snap[]>();
    for (const s of snaps) byCampaign.set(s.campaign_id, [...(byCampaign.get(s.campaign_id) || []), s]);

    for (const list of byCampaign.values()) {
        list.sort((a, b) => ms(a.taken_at) - ms(b.taken_at));
        for (let i = 1; i < list.length; i++) {
            const a = list[i - 1], b = list[i];
            const t0 = ms(a.taken_at), t1 = ms(b.taken_at);
            if (!(t1 > t0)) continue;
            const sameDay = a.stat_date === b.stat_date;
            const delta = (x: number, y: number) => (sameDay ? Math.max(0, y - x) : Math.max(0, y));
            const d = {
                impressions: delta(a.views, b.views),
                clicks: delta(a.clicks, b.clicks),
                atbs: delta(a.atbs, b.atbs),
                orders: delta(a.orders, b.orders),
                adSpend: delta(a.spend, b.spend),
            };
            for (const w of windows) {
                const overlap = Math.min(t1, w.end.getTime()) - Math.max(t0, w.start.getTime());
                if (overlap <= 0) continue;
                const share = overlap / (t1 - t0);
                add(w.label, 'impressions', d.impressions * share);
                add(w.label, 'clicks', d.clicks * share);
                add(w.label, 'atbs', d.atbs * share);
                add(w.label, 'orders', d.orders * share);
                add(w.label, 'adSpend', d.adSpend * share);
            }
        }
    }
    return result;
}

export type SnapshotDeps = { fetchFn?: typeof fetch; now?: () => Date };

/**
 * Снимает замеры для активных тестов с рекламой. Ошибка WB (лимит, токен) не должна ломать ротацию:
 * возвращает отчёт, кидает только на программных ошибках, которые вызывающий ловит сам.
 */
export async function takeAdSnapshots(admin: any, tests: any[], deps: SnapshotDeps = {}) {
    const fetchFn = deps.fetchFn || fetch;
    const now = deps.now ? deps.now() : new Date();
    const today = moscowYmd(now);
    const report: { taken: number; skipped: number; errors: string[] } = { taken: 0, skipped: 0, errors: [] };

    const adsTests = (tests || []).filter((t) => {
        const settings = t?.settings || {};
        const adsOn = settings?.sources ? Boolean(settings.sources.ads) : true;
        const camps = Array.isArray(settings?.campaigns) ? settings.campaigns.map(Number).filter((n: number) => n > 0) : [];
        return t?.status === 'active' && adsOn && camps.length > 0 && t?.nm_id;
    });
    if (!adsTests.length) return report;

    // Не чаще раза в 2 минуты на тест.
    const { data: recent } = await admin
        .from('ab_test_adv_snapshots')
        .select('test_id, taken_at')
        .in('test_id', adsTests.map((t) => t.id))
        .gte('taken_at', new Date(now.getTime() - MIN_GAP_MS).toISOString());
    const recentTests = new Set((recent || []).map((r: any) => String(r.test_id)));
    const due = adsTests.filter((t) => !recentTests.has(String(t.id)));
    report.skipped += adsTests.length - due.length;
    if (!due.length) return report;

    const cabIds = [...new Set(due.map((t) => t.cabinet_id))];
    const { data: cabs } = await admin.from('cabinets').select(CABINET_TOKEN_SELECT).in('id', cabIds);
    const cabById = new Map((cabs || []).map((c: any) => [c.id, c]));

    for (const cabId of cabIds) {
        const cab: any = cabById.get(cabId);
        const token = cab ? pickCabinetToken(cab, 'promotion') : '';
        const cabTests = due.filter((t) => t.cabinet_id === cabId);
        if (!token || token.length < 50) {
            report.errors.push(`${cabId}: нет токена продвижения`);
            continue;
        }
        const campIds = [...new Set(cabTests.flatMap((t) => (t.settings.campaigns as unknown[]).map(Number).filter((n) => n > 0)))];
        for (let i = 0; i < campIds.length; i += 50) {
            const chunk = campIds.slice(i, i + 50);
            try {
                const res = await fetchFn(`${ADV_API}/adv/v3/fullstats?ids=${chunk.join(',')}&beginDate=${today}&endDate=${today}`, {
                    headers: { Authorization: token },
                });
                if (!res.ok) {
                    report.errors.push(`${cabId}: fullstats ${res.status}`);
                    continue;
                }
                const data = await res.json().catch(() => null);
                const byCampaign = new Map<number, any>();
                if (Array.isArray(data)) for (const c of data) byCampaign.set(Number(c?.advertId), c);

                const rows: any[] = [];
                for (const t of cabTests) {
                    for (const campId of (t.settings.campaigns as unknown[]).map(Number)) {
                        if (!chunk.includes(campId)) continue;
                        const camp = byCampaign.get(campId);
                        const days = Array.isArray(camp?.days) ? camp.days : [];
                        const day = days.find((d: any) => String(d?.date || '').startsWith(today));
                        // Нет строки за сегодня = показов ещё не было: пишем нули, чтобы появилась точка отсчёта.
                        const cum = day ? extractNmCumulative(day, Number(t.nm_id)) : { ...ZERO };
                        rows.push({
                            test_id: t.id,
                            cabinet_id: cabId,
                            campaign_id: campId,
                            nm_id: Number(t.nm_id),
                            taken_at: now.toISOString(),
                            stat_date: today,
                            views: Math.round(cum.views),
                            clicks: Math.round(cum.clicks),
                            atbs: Math.round(cum.atbs),
                            orders: Math.round(cum.orders),
                            spend: Math.round(cum.spend * 100) / 100,
                        });
                    }
                }
                if (rows.length) {
                    const { error } = await admin.from('ab_test_adv_snapshots').insert(rows);
                    if (error) report.errors.push(`${cabId}: insert ${error.message}`);
                    else report.taken += rows.length;
                }
            } catch (e) {
                report.errors.push(`${cabId}: ${String((e as Error)?.message || e).slice(0, 120)}`);
            }
        }
    }
    return report;
}

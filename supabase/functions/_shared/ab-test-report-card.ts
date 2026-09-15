/**
 * Карточка итога А/Б теста — те же цифры, что в модалке на сайте:
 * CTR, дельта к базовому, вероятность победы, вердикт со звёздами.
 * Модель общая для PNG в Telegram и для тестов (без canvas/Deno).
 */

export const WB_MAIN_PHOTO_SLOT = 1;

export type AbReportVariantIn = {
    id?: string;
    variant_label: string;
    photo_url?: string;
    impressions?: number;
    clicks?: number;
    atbs?: number;
    orders?: number;
    revenue?: number;
    ad_spend?: number;
    minutes_active?: number;
    is_currently_on_wb?: boolean;
};

export type AbReportVariantOut = {
    label: string;
    photoUrl: string;
    ctr: number;
    delta: number | null;
    prob: number;
    isLive: boolean;
    isLeader: boolean;
    isLoser: boolean;
    impressions: number;
    clicks: number;
    atbs: number;
    orders: number;
    revenue: number;
    adSpend: number;
    cr: number;
    cr1: number;
    cpc: number;
    cpv: number;
    minutesActive: number;
};

export type AbReportCardModel = {
    title: string;
    nmId: string | number;
    campaignLabel: string;
    finishedAtStr: string;
    reasonText: string;
    reportUrl: string;
    stars: string;
    verdictText: string;
    leaderLabel: string;
    preview?: boolean;
    variants: AbReportVariantOut[];
};

export function fmtSom(n: number): string {
    return `${Math.round(n).toLocaleString('ru-RU').replace(/\u00A0/g, ' ')} сом`;
}

export function fmtPct(n: number, digits = 2): string {
    return `${n.toFixed(digits)}%`;
}

export function reasonLabel(reason: string): string {
    if (reason === 'impressions_cap') return 'набраны показы поровну, РК на паузе';
    if (reason === 'winner_determined') return 'найден победитель по CTR, РК на паузе';
    if (reason === 'campaign_stopped') return 'РК остановилась';
    if (reason === 'max_rotations') return 'лимит ротаций';
    return 'тест завершён';
}

export function verdictFromProb(maxProb: number): { stars: string; text: string } {
    if (maxProb >= 0.85) return { stars: '★★★', text: `уверенно лучше (${Math.round(maxProb * 100)}%)` };
    if (maxProb >= 0.6) return { stars: '★★★', text: `скорее всего лучше (${Math.round(maxProb * 100)}%)` };
    if (maxProb >= 0.4) return { stars: '★★☆', text: `есть тенденция к лидеру (${Math.round(maxProb * 100)}%)` };
    return { stars: '★☆☆', text: 'пока недостаточно данных для вывода' };
}

export function buildAbReportCard(opts: {
    title: string;
    nmId: string | number;
    campaignLabel?: string;
    finishedAtStr?: string;
    reason?: string;
    reportUrl?: string;
    preview?: boolean;
    variants: AbReportVariantIn[];
    currentVariantId?: string;
    probs?: Map<string, number>;
}): AbReportCardModel {
    const sorted = opts.variants.slice().sort((a, b) =>
        String(a.variant_label).localeCompare(String(b.variant_label), 'ru', { numeric: true }),
    );
    const probs = opts.probs || probabilityBestByCtr(sorted);
    const maxProb = Math.max(...Array.from(probs.values()), 0);
    const leaderLabel = Array.from(probs.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    const verdict = verdictFromProb(maxProb);

    const live = sorted.find((v) => v.is_currently_on_wb)
        || sorted.find((v) => opts.currentVariantId && String(v.id) === String(opts.currentVariantId))
        || sorted[0];
    const baseline = sorted[0];
    const baseImp = Number(baseline?.impressions) || 0;
    const baseClk = Number(baseline?.clicks) || 0;
    const baselineCtr = baseImp > 0 ? (baseClk / baseImp) * 100 : 0;

    const variants: AbReportVariantOut[] = sorted.map((v) => {
        const impressions = Math.round(Number(v.impressions) || 0);
        const clicks = Math.round(Number(v.clicks) || 0);
        const atbs = Math.round(Number(v.atbs) || 0);
        const orders = Number(v.orders) || 0;
        const revenue = Number(v.revenue) || 0;
        const adSpend = Number(v.ad_spend) || 0;
        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
        const cr = clicks > 0 ? (atbs / clicks) * 100 : 0;
        const cr1 = atbs > 0 ? (orders / atbs) * 100 : 0;
        const cpc = clicks > 0 ? adSpend / clicks : 0;
        const cpv = impressions > 0 ? adSpend / impressions : 0;
        const prob = probs.get(v.variant_label) || 0;
        const isBaseline = v.variant_label === baseline?.variant_label;
        return {
            label: String(v.variant_label),
            photoUrl: String(v.photo_url || ''),
            ctr,
            delta: isBaseline ? null : ctr - baselineCtr,
            prob,
            isLive: Boolean(live && (v.id ? v.id === live.id : v.variant_label === live.variant_label)),
            isLeader: v.variant_label === leaderLabel && maxProb >= 0.6,
            isLoser: !isBaseline && sorted.length > 2 && prob > 0 && prob <= 0.15,
            impressions,
            clicks,
            atbs,
            orders,
            revenue,
            adSpend,
            cr,
            cr1,
            cpc,
            cpv,
            minutesActive: Math.round(Number(v.minutes_active) || 0),
        };
    });

    return {
        title: opts.title || `Товар ${opts.nmId}`,
        nmId: opts.nmId,
        campaignLabel: opts.campaignLabel || '',
        finishedAtStr: opts.finishedAtStr || '',
        reasonText: reasonLabel(String(opts.reason || '')),
        reportUrl: opts.reportUrl || '',
        stars: verdict.stars,
        verdictText: verdict.text,
        leaderLabel,
        preview: Boolean(opts.preview),
        variants,
    };
}

export function escapeHtml(s: string): string {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function formatAbReportCaption(model: AbReportCardModel): string {
    const lines: string[] = [];
    if (model.preview) lines.push('проверка канала — так будут приходить результаты А/Б');
    const title = escapeHtml(model.title);
    lines.push(`<b>${title}</b> · арт. ${escapeHtml(String(model.nmId))}`);
    if (model.campaignLabel) lines.push(`РК: ${escapeHtml(model.campaignLabel)}`);
    const lead = model.leaderLabel
        ? `${model.stars} ${escapeHtml(model.verdictText)} — вариант ${escapeHtml(model.leaderLabel)}`
        : `${model.stars} ${escapeHtml(model.verdictText)}`;
    lines.push(lead);
    if (model.finishedAtStr) {
        lines.push(`Завершён ${escapeHtml(model.finishedAtStr)} — ${escapeHtml(model.reasonText)}.`);
    }
    if (model.reportUrl) lines.push(model.reportUrl);
    return lines.join('\n').slice(0, 1000);
}

/** SVG-макет той же карточки: проверяем состав без canvas. */
export function renderAbReportCardSvg(model: AbReportCardModel): string {
    const n = Math.max(model.variants.length, 1);
    const cardW = 260;
    const gap = 16;
    const pad = 28;
    const width = pad * 2 + n * cardW + (n - 1) * gap;
    const height = 720;
    const cards = model.variants.map((v, i) => {
        const x = pad + i * (cardW + gap);
        const y = 168;
        const border = v.isLeader ? '#7C3AED' : '#E5E7EB';
        const tag = v.isLive ? '● Сейчас на ВБ' : `Вариант ${escapeHtml(v.label)}`;
        const delta = v.delta == null
            ? ''
            : `<text x="${x + 16}" y="${y + 430}" fill="${v.delta >= 0 ? '#16A34A' : '#DC2626'}" font-size="14" font-weight="700">${v.delta >= 0 ? '+' : ''}${v.delta.toFixed(2)}</text>`;
        const badge = v.isLoser
            ? `<text x="${x + 16}" y="${y + 452}" fill="#DC2626" font-size="12">явно проигрывает</text>`
            : `<text x="${x + 16}" y="${y + 452}" fill="#16A34A" font-size="12">${Math.round(v.prob * 100)}%</text>`;
        return `<g>
            <rect x="${x}" y="${y}" width="${cardW}" height="500" rx="16" fill="#fff" stroke="${border}" stroke-width="${v.isLeader ? 3 : 1}"/>
            <text x="${x + 16}" y="${y + 28}" fill="${v.isLive ? '#16A34A' : '#6B7280'}" font-size="12" font-weight="700">${tag}</text>
            <rect x="${x + 12}" y="${y + 40}" width="${cardW - 24}" height="220" rx="10" fill="#EEF2FF"/>
            <text x="${x + 16}" y="${y + 406}" fill="#111827" font-size="28" font-weight="800">${fmtPct(v.ctr)}</text>
            ${delta}
            ${badge}
            <text x="${x + 16}" y="${y + 480}" fill="#6B7280" font-size="12">Показы ${v.impressions} · Клики ${v.clicks}</text>
            <text x="${x + 16}" y="${y + 498}" fill="#6B7280" font-size="12">CR ${fmtPct(v.cr)} · Заказов ${v.orders}</text>
        </g>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#F4F2EE"/>
  <text x="${pad}" y="42" fill="#111827" font-size="22" font-weight="800">${escapeHtml(model.title)}</text>
  <text x="${pad}" y="68" fill="#6B7280" font-size="13">арт. ${escapeHtml(String(model.nmId))}${model.campaignLabel ? ' · ' + escapeHtml(model.campaignLabel) : ''}</text>
  <rect x="${pad}" y="88" width="${width - pad * 2}" height="56" rx="12" fill="#F3E8FF" stroke="#D8B4FE"/>
  <text x="${pad + 16}" y="122" fill="#6B21A8" font-size="16" font-weight="700">${model.stars}  ${escapeHtml(model.verdictText)}${model.leaderLabel ? ' — лидирует вариант ' + escapeHtml(model.leaderLabel) : ''}</text>
  ${cards}
  <text x="${pad}" y="${height - 24}" fill="#9CA3AF" font-size="12">Nurconsulting · главное фото WB = слот ${WB_MAIN_PHOTO_SLOT}${model.reportUrl ? ' · ' + escapeHtml(model.reportUrl) : ''}</text>
</svg>`;
}

export function demoAbReportCard(): AbReportCardModel {
    return buildAbReportCard({
        title: 'Демо: куртка зимняя',
        nmId: 123456789,
        campaignLabel: 'тест стр (38634350)',
        finishedAtStr: '15.09.2026, 11:24',
        reason: 'impressions_cap',
        reportUrl: 'https://nurcon.kg/ab-testing',
        preview: true,
        variants: [
            { variant_label: 'A', impressions: 2400, clicks: 72, atbs: 18, orders: 6, revenue: 18000, ad_spend: 2100, is_currently_on_wb: false },
            { variant_label: 'B', impressions: 2380, clicks: 95, atbs: 28, orders: 11, revenue: 33000, ad_spend: 1980, is_currently_on_wb: true },
            { variant_label: 'C', impressions: 2410, clicks: 41, atbs: 7, orders: 2, revenue: 6000, ad_spend: 2050, is_currently_on_wb: false },
            { variant_label: 'D', impressions: 2395, clicks: 80, atbs: 20, orders: 8, revenue: 24000, ad_spend: 2010, is_currently_on_wb: false },
        ],
        probs: new Map([['A', 0.12], ['B', 0.91], ['C', 0.02], ['D', 0.18]]),
    });
}

export function probabilityBestByCtr(
    variants: Array<{ variant_label: string; impressions?: number; clicks?: number }>,
    samples = 5000,
): Map<string, number> {
    const wins = new Map<string, number>();
    for (const v of variants) wins.set(v.variant_label, 0);
    for (let i = 0; i < samples; i++) {
        let bestLabel: string | null = null;
        let bestVal = -1;
        for (const v of variants) {
            const clicks = Math.max(0, Number(v.clicks) || 0);
            const views = Math.max(clicks, Number(v.impressions) || 0);
            const val = sampleBeta(clicks + 1, views - clicks + 1);
            if (val > bestVal) {
                bestVal = val;
                bestLabel = v.variant_label;
            }
        }
        if (bestLabel) wins.set(bestLabel, (wins.get(bestLabel) || 0) + 1);
    }
    const probs = new Map<string, number>();
    for (const [label, count] of wins) probs.set(label, count / samples);
    return probs;
}

function sampleGamma(shape: number): number {
    if (shape < 1) {
        const u = Math.random();
        return sampleGamma(shape + 1) * Math.pow(u, 1 / shape);
    }
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    for (;;) {
        let x: number, v: number;
        do {
            x = gaussian();
            v = 1 + c * x;
        } while (v <= 0);
        v = v * v * v;
        const u = Math.random();
        if (Math.log(u) < 0.5 * x * x + d - d * v + d * Math.log(v)) return d * v;
    }
}

function gaussian(): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function sampleBeta(alpha: number, beta: number): number {
    const x = sampleGamma(Math.max(alpha, 0.01));
    const y = sampleGamma(Math.max(beta, 0.01));
    return x / (x + y);
}

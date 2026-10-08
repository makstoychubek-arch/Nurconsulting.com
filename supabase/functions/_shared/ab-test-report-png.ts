/**
 * PNG-снимок карточки А/Б для Telegram — тот же макет, что SVG-модель,
 * плюс реальные фото вариантов. Шрифт DejaVu как в daily-sales-report.
 */

import { createCanvas, loadImage } from 'https://deno.land/x/canvas@v1.4.2/mod.ts';
import {
    type AbReportCardModel,
    fmtPct,
    fmtSom,
    WB_MAIN_PHOTO_SLOT,
} from './ab-test-report-card.ts';

// Логотип NR (icons/logo-nr.svg, отрисован в PNG 216×216 с прозрачными углами).
const NR_LOGO_PNG_B64 =
    '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';

let fontRegular: Uint8Array | null = null;
let fontBold: Uint8Array | null = null;

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 12000): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

async function ensureFonts(): Promise<void> {
    if (fontRegular && fontBold) return;
    const base = 'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf';
    const [reg, bold] = await Promise.all([
        fetchWithTimeout(`${base}/DejaVuSans.ttf`, {}, 20000).then((r) => {
            if (!r.ok) throw new Error(`font regular HTTP ${r.status}`);
            return r.arrayBuffer();
        }),
        fetchWithTimeout(`${base}/DejaVuSans-Bold.ttf`, {}, 20000).then((r) => {
            if (!r.ok) throw new Error(`font bold HTTP ${r.status}`);
            return r.arrayBuffer();
        }),
    ]);
    fontRegular = new Uint8Array(reg);
    fontBold = new Uint8Array(bold);
}

// deno-lint-ignore no-explicit-any
function roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
}

// measureText в этой библиотеке считает жирный шрифт как обычный (~12% уже), поэтому для bold домножаем.
// deno-lint-ignore no-explicit-any
function textW(ctx: any, text: string, bold = false): number {
    return ctx.measureText(text).width * (bold ? 1.12 : 1);
}

// deno-lint-ignore no-explicit-any
function fitText(ctx: any, text: string, maxW: number): string {
    if (ctx.measureText(text).width <= maxW) return text;
    let s = text;
    while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    return s + '…';
}

function imgSize(img: { width: number | (() => number); height: number | (() => number) }): { w: number; h: number } {
    const w = typeof img.width === 'function' ? img.width() : img.width;
    const h = typeof img.height === 'function' ? img.height() : img.height;
    return { w: Number(w) || 1, h: Number(h) || 1 };
}

async function loadPhoto(url: string): Promise<unknown | null> {
    if (!url) return null;
    try {
        const res = await fetchWithTimeout(url, {}, 12000);
        if (!res.ok) return null;
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (bytes.length < 200) return null;
        return await loadImage(bytes);
    } catch {
        return null;
    }
}

export async function renderAbReportPng(model: AbReportCardModel): Promise<Uint8Array> {
    await ensureFonts();
    const variants = model.variants.slice(0, 6);
    const n = Math.max(variants.length, 1);
    if (!variants.length) {
        throw new Error('no variants to render');
    }
    const S = 2;
    const pad = 28;
    const gap = 16;
    const width = n <= 2 ? 780 : n === 3 ? 1040 : 1280;
    const cardW = (width - pad * 2 - gap * (n - 1)) / n;
    const photoH = Math.round((cardW - 24) * 4 / 3); // фото 3:4, как карточка WB
    const metricsH = 252;
    const cardH = 40 + photoH + 78 + metricsH;
    const headerH = 124;
    const verdictH = 58;
    const height = pad + headerH + 12 + verdictH + 16 + cardH + 44 + pad;

    const canvas = createCanvas(Math.round(width * S), Math.round(height * S));
    canvas.loadFont(fontRegular!, { family: 'DejaVu' });
    canvas.loadFont(fontBold!, { family: 'DejaVu', weight: 'bold' });
    const ctx = canvas.getContext('2d');
    ctx.scale(S, S);
    ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = '#F4F2EE';
    ctx.fillRect(0, 0, width, height);

    // Слева сверху: настоящий логотип NR (icons/logo-nr.svg: белый скруглённый квадрат, чёрные буквы) и «/ АБ ТЕСТ»;
    // справа — юридическое название кабинета. Шаблон описан в docs/ab-telegram-report.md.
    const logoS = 36;
    const lx = pad, ly = pad;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.14)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 1;
    roundRect(ctx, lx, ly, logoS, logoS, logoS * 120 / 512);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.restore();
    const logoImg = await loadImage(Uint8Array.from(atob(NR_LOGO_PNG_B64), (c) => c.charCodeAt(0)));
    ctx.drawImage(logoImg as never, lx, ly, logoS, logoS);
    roundRect(ctx, lx, ly, logoS, logoS, logoS * 120 / 512);
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#111111';
    ctx.font = 'bold 16px DejaVu';
    ctx.fillText('/ АБ ТЕСТ', lx + logoS + 10, ly + logoS / 2 + 5.5);

    if (model.cabinetName) {
        ctx.fillStyle = '#374151';
        ctx.font = 'bold 15px DejaVu';
        let cab = model.cabinetName;
        while (cab.length > 1 && textW(ctx, cab, true) > width / 2 - pad) cab = cab.slice(0, -1);
        ctx.fillText(cab, width - pad - textW(ctx, cab, true), ly + logoS / 2 + 5.5);
    }

    ctx.fillStyle = '#111827';
    ctx.font = 'bold 24px DejaVu';
    ctx.fillText(fitText(ctx, model.title, width - pad * 2), pad, pad + 66);

    ctx.fillStyle = '#6B7280';
    ctx.font = '13px DejaVu';
    const sub = `арт. ${model.nmId}${model.campaignLabel ? ' · ' + model.campaignLabel : ''}`;
    ctx.fillText(fitText(ctx, sub, width - pad * 2), pad, pad + 88);

    const times = [
        model.startedAtStr ? `Запуск: ${model.startedAtStr}` : '',
        model.finishedAtStr ? `Завершён: ${model.finishedAtStr}` : '',
        model.durationStr ? `Длительность: ${model.durationStr}` : '',
        model.reasonText ? model.reasonText : '',
    ].filter(Boolean).join('  ·  ');
    ctx.fillStyle = '#4B5563';
    ctx.font = '12px DejaVu';
    ctx.fillText(fitText(ctx, times, width - pad * 2), pad, pad + 108);

    if (model.preview) {
        ctx.fillStyle = '#7C3AED';
        ctx.font = 'bold 12px DejaVu';
        const stamp = 'проверка канала';
        const tw = ctx.measureText(stamp).width;
        ctx.fillText(stamp, width - pad - tw, pad + 88);
    }

    roundRect(ctx, pad, pad + headerH, width - pad * 2, verdictH, 14);
    ctx.fillStyle = '#F3E8FF';
    ctx.fill();
    ctx.strokeStyle = '#D8B4FE';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#F59E0B';
    ctx.font = 'bold 18px DejaVu';
    ctx.fillText(model.stars, pad + 16, pad + headerH + 36);
    ctx.fillStyle = '#6B21A8';
    ctx.font = 'bold 15px DejaVu';
    const vtxt = `${model.verdictText}${model.leaderLabel ? ' — лидирует вариант ' + model.leaderLabel : ''}`;
    ctx.fillText(fitText(ctx, vtxt, width - pad * 2 - 90), pad + 86, pad + headerH + 36);

    const photos = await Promise.all(variants.map((v) => loadPhoto(v.photoUrl)));
    const cardsTop = pad + headerH + 12 + verdictH + 16;

    for (let i = 0; i < n; i++) {
        const v = variants[i];
        const x = pad + i * (cardW + gap);
        const y = cardsTop;

        roundRect(ctx, x, y, cardW, cardH, 16);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = v.isLeader ? '#7C3AED' : '#E5E7EB';
        ctx.lineWidth = v.isLeader ? 3 : 1.2;
        ctx.stroke();

        ctx.fillStyle = v.isLive ? '#16A34A' : '#6B7280';
        ctx.font = 'bold 12px DejaVu';
        ctx.fillText(v.isLive ? '● Сейчас на ВБ' : `Вариант ${v.label}`, x + 14, y + 26);

        const ix = x + 12;
        const iy = y + 38;
        const iw = cardW - 24;
        const ih = photoH;
        roundRect(ctx, ix, iy, iw, ih, 12);
        ctx.fillStyle = '#EEF2FF';
        ctx.fill();
        const img = photos[i];
        if (img) {
            ctx.save();
            roundRect(ctx, ix, iy, iw, ih, 12);
            ctx.clip();
            const { w: pw, h: ph } = imgSize(img as { width: number; height: number });
            const scale = Math.max(iw / pw, ih / ph) * 1.04; // небольшой запас, чтобы не оставалось полос по краям
            const dw = pw * scale;
            const dh = ph * scale;
            ctx.drawImage(img as never, ix + (iw - dw) / 2, iy + (ih - dh) / 2, dw, dh);
            ctx.restore();
        } else {
            ctx.fillStyle = '#A78BFA';
            ctx.font = 'bold 42px DejaVu';
            const letter = String(v.label || '?');
            const tw = ctx.measureText(letter).width;
            ctx.fillText(letter, ix + (iw - tw) / 2, iy + ih / 2 + 14);
        }

        const valX = Math.max(Math.round(cardW * 0.5), 112); // значения — ровная колонка слева
        const ty = iy + ih + 34;
        ctx.fillStyle = '#111827';
        ctx.font = 'bold 26px DejaVu';
        const ctrLabel = fmtPct(v.ctr);
        ctx.fillText(ctrLabel, x + 14, ty);
        if (v.delta != null) {
            ctx.fillStyle = v.delta >= 0 ? '#16A34A' : '#DC2626';
            ctx.font = 'bold 13px DejaVu';
            const d = `${v.delta >= 0 ? '+' : ''}${v.delta.toFixed(2)}`;
            ctx.fillText(d, x + valX, ty);
        }
        ctx.font = 'bold 12px DejaVu';
        if (v.isLoser) {
            ctx.fillStyle = '#DC2626';
            ctx.fillText('явно проигрывает', x + 14, ty + 22);
        } else {
            ctx.fillStyle = '#16A34A';
            ctx.fillText(`${Math.round(v.prob * 100)}%`, x + 14, ty + 22);
        }

        const rows: Array<[string, string]> = [
            ['CTR', fmtPct(v.ctr)],
            ['CR клик→корзина', fmtPct(v.cr)],
            ['CR1 корзина→заказ', fmtPct(v.cr1)],
            ['Показы', String(v.impressions)],
            ['Клики', String(v.clicks)],
            ['В корзину', String(v.atbs)],
            ['Заказов', String(v.orders)],
            ['На сумму', fmtSom(v.revenue)],
            ['Затраты', fmtSom(v.adSpend)],
            ['CPC', `${v.cpc.toFixed(2)} сом`],
            ['CPV (показ)', `${v.cpv.toFixed(2)} сом`],
            ['На ВБ', `${v.minutesActive} мин`],
            ['Ротаций', String(v.rotations)],
        ];
        const tableY = ty + 38;
        ctx.font = '12px DejaVu';
        rows.forEach((row, ri) => {
            const ry = tableY + ri * 20;
            ctx.fillStyle = '#6B7280';
            ctx.fillText(row[0], x + 14, ry);
            ctx.fillStyle = '#111827';
            ctx.font = 'bold 12px DejaVu';
            ctx.fillText(row[1], x + valX, ry);
            ctx.font = '12px DejaVu';
        });
    }

    ctx.fillStyle = '#9CA3AF';
    ctx.font = '12px DejaVu';
    const foot = `Nurconsulting · главное фото WB = слот ${WB_MAIN_PHOTO_SLOT}`
        + (model.finishedAtStr ? ` · ${model.finishedAtStr}` : '')
        + (model.reportUrl ? ` · ${model.reportUrl}` : '');
    ctx.fillText(fitText(ctx, foot, width - pad * 2), pad, height - 22);

    return canvas.toBuffer('image/png');
}

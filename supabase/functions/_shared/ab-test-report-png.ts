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
    const photoH = 248;
    const metricsH = 248;
    const cardH = 40 + photoH + 78 + metricsH;
    const headerH = 78;
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

    ctx.fillStyle = '#111827';
    ctx.font = 'bold 24px DejaVu';
    ctx.fillText(fitText(ctx, model.title, width - pad * 2 - 160), pad, pad + 28);

    ctx.fillStyle = '#6B7280';
    ctx.font = '13px DejaVu';
    const sub = `арт. ${model.nmId}${model.campaignLabel ? ' · ' + model.campaignLabel : ''}`;
    ctx.fillText(fitText(ctx, sub, width - pad * 2), pad, pad + 52);

    if (model.preview) {
        ctx.fillStyle = '#7C3AED';
        ctx.font = 'bold 12px DejaVu';
        const stamp = 'проверка канала';
        const tw = ctx.measureText(stamp).width;
        ctx.fillText(stamp, width - pad - tw, pad + 22);
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
            const scale = Math.max(iw / pw, ih / ph);
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

        const ty = iy + ih + 34;
        ctx.fillStyle = '#111827';
        ctx.font = 'bold 26px DejaVu';
        const ctrLabel = fmtPct(v.ctr);
        ctx.fillText(ctrLabel, x + 14, ty);
        const ctrW = ctx.measureText(ctrLabel).width;
        if (v.delta != null) {
            ctx.fillStyle = v.delta >= 0 ? '#16A34A' : '#DC2626';
            ctx.font = 'bold 13px DejaVu';
            const d = `${v.delta >= 0 ? '+' : ''}${v.delta.toFixed(2)}`;
            ctx.fillText(d, x + 14 + ctrW + 10, ty);
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
        ];
        const tableY = ty + 38;
        ctx.font = '12px DejaVu';
        rows.forEach((row, ri) => {
            const ry = tableY + ri * 20;
            ctx.fillStyle = '#6B7280';
            ctx.fillText(row[0], x + 14, ry);
            ctx.fillStyle = '#111827';
            ctx.font = 'bold 12px DejaVu';
            const valW = ctx.measureText(row[1]).width;
            ctx.fillText(row[1], x + cardW - 14 - valW, ry);
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

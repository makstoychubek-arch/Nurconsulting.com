/**
 * PNG-слайды карусели 1080×1350. Deno canvas, как карточка А/Б.
 * Node-тесты этот файл не импортируют.
 */

import { createCanvas, loadImage } from 'https://deno.land/x/canvas@v1.4.2/mod.ts';
import { collageCells, type SlidePlan, SLIDE_H, SLIDE_W } from './content-carousel.ts';

let fontRegular: Uint8Array | null = null;
let fontBold: Uint8Array | null = null;

async function fetchWithTimeout(url: string, timeoutMs = 12000): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

async function ensureFonts(): Promise<void> {
    if (fontRegular && fontBold) return;
    const base = 'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf';
    const [reg, bold] = await Promise.all([
        fetchWithTimeout(`${base}/DejaVuSans.ttf`, 20000).then(async (r) => {
            if (!r.ok) throw new Error(`font regular HTTP ${r.status}`);
            return new Uint8Array(await r.arrayBuffer());
        }),
        fetchWithTimeout(`${base}/DejaVuSans-Bold.ttf`, 20000).then(async (r) => {
            if (!r.ok) throw new Error(`font bold HTTP ${r.status}`);
            return new Uint8Array(await r.arrayBuffer());
        }),
    ]);
    fontRegular = reg;
    fontBold = bold;
}

function fitText(ctx: { measureText: (s: string) => { width: number } }, text: string, maxW: number): string {
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
        const res = await fetchWithTimeout(url, 12000);
        if (!res.ok) return null;
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (bytes.length < 200) return null;
        return await loadImage(bytes);
    } catch {
        return null;
    }
}

function coverDraw(
    ctx: { save: () => void; restore: () => void; drawImage: (...a: never[]) => void },
    img: unknown,
    x: number,
    y: number,
    w: number,
    h: number,
) {
    const { w: pw, h: ph } = imgSize(img as { width: number; height: number });
    const scale = Math.max(w / pw, h / ph);
    const dw = pw * scale;
    const dh = ph * scale;
    ctx.save();
    ctx.drawImage(img as never, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    ctx.restore();
}

function wrapLines(
    ctx: { measureText: (s: string) => { width: number } },
    text: string,
    maxW: number,
    maxLines: number,
): string[] {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let cur = '';
    for (const word of words) {
        const next = cur ? `${cur} ${word}` : word;
        if (ctx.measureText(next).width <= maxW) {
            cur = next;
        } else {
            if (cur) lines.push(cur);
            cur = word;
            if (lines.length >= maxLines - 1) break;
        }
    }
    if (cur && lines.length < maxLines) lines.push(cur);
    if (lines.length === maxLines && words.length) {
        lines[maxLines - 1] = fitText(ctx, lines[maxLines - 1], maxW);
    }
    return lines;
}

export async function renderCarouselSlidePng(plan: SlidePlan): Promise<Uint8Array> {
    await ensureFonts();
    const canvas = createCanvas(SLIDE_W, SLIDE_H);
    canvas.loadFont(fontRegular!, { family: 'DejaVu' });
    canvas.loadFont(fontBold!, { family: 'DejaVu', weight: 'bold' });
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'alphabetic';

    if (plan.kind === 'cover') {
        ctx.fillStyle = '#111111';
        ctx.fillRect(0, 0, SLIDE_W, SLIDE_H);
        const img = await loadPhoto(plan.photos[0] || '');
        if (img) coverDraw(ctx, img, 0, 0, SLIDE_W, SLIDE_H);
        else {
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 42px DejaVu';
            ctx.fillText('Нет фото', 80, SLIDE_H / 2);
        }
    } else if (plan.kind === 'collage') {
        ctx.fillStyle = '#F4F1EA';
        ctx.fillRect(0, 0, SLIDE_W, SLIDE_H);
        const cells = collageCells();
        const imgs = await Promise.all(plan.photos.map((u) => loadPhoto(u)));
        cells.forEach((cell, i) => {
            ctx.fillStyle = '#E8E2D6';
            ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
            const img = imgs[i];
            if (img) {
                ctx.save();
                ctx.beginPath();
                ctx.rect(cell.x, cell.y, cell.w, cell.h);
                ctx.clip();
                coverDraw(ctx, img, cell.x, cell.y, cell.w, cell.h);
                ctx.restore();
            }
        });
    } else if (plan.kind === 'info') {
        ctx.fillStyle = '#FAFAF7';
        ctx.fillRect(0, 0, SLIDE_W, SLIDE_H);
        ctx.fillStyle = '#111111';
        ctx.font = 'bold 28px DejaVu';
        ctx.fillText(plan.nmId ? `Артикул ${plan.nmId}` : 'Артикул', 80, 180);
        if (plan.vendorCode) {
            ctx.font = '22px DejaVu';
            ctx.fillStyle = '#6B6B6B';
            ctx.fillText(fitText(ctx, plan.vendorCode, SLIDE_W - 160), 80, 230);
        }
        ctx.fillStyle = '#111111';
        ctx.font = 'bold 44px DejaVu';
        const titleLines = wrapLines(ctx, plan.title || 'Товар', SLIDE_W - 160, 4);
        titleLines.forEach((line, i) => ctx.fillText(line, 80, 320 + i * 56));
        if (plan.price != null) {
            ctx.font = 'bold 36px DejaVu';
            ctx.fillText(`${Math.round(plan.price).toLocaleString('ru-RU')} ₽`, 80, 320 + titleLines.length * 56 + 48);
        }
        ctx.fillStyle = '#6B6B6B';
        ctx.font = '28px DejaVu';
        ctx.fillText('Состав', 80, 780);
        ctx.fillStyle = '#111111';
        ctx.font = '26px DejaVu';
        wrapLines(ctx, plan.composition || '—', SLIDE_W - 160, 8).forEach((line, i) => {
            ctx.fillText(line, 80, 840 + i * 40);
        });
    } else {
        ctx.fillStyle = '#111111';
        ctx.fillRect(0, 0, SLIDE_W, SLIDE_H);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 64px DejaVu';
        const brand = fitText(ctx, plan.brand || 'NR', SLIDE_W - 160);
        const tw = ctx.measureText(brand).width;
        ctx.fillText(brand, (SLIDE_W - tw) / 2, SLIDE_H / 2);
        ctx.font = '24px DejaVu';
        ctx.fillStyle = '#A3A3A3';
        const sub = 'контент-завод';
        const sw = ctx.measureText(sub).width;
        ctx.fillText(sub, (SLIDE_W - sw) / 2, SLIDE_H / 2 + 56);
    }

    return canvas.toBuffer('image/png');
}

export async function renderCarouselPngs(plans: SlidePlan[]): Promise<Uint8Array[]> {
    const out: Uint8Array[] = [];
    for (const plan of plans) out.push(await renderCarouselSlidePng(plan));
    return out;
}

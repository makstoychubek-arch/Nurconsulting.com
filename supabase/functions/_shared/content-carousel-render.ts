/**
 * PNG-слайды карусели 1080×1350. Макет = Satori-шаблоны (content-carousel-templates.ts).
 * Deno canvas, как карточка А/Б. Node-тесты этот файл не импортируют.
 */

import { createCanvas, loadImage } from 'https://deno.land/x/canvas@v1.4.2/mod.ts';
import { collageCells, type SlidePlan, SLIDE_H, SLIDE_W } from './content-carousel.ts';
import { formatSlidePrice, infoFactRows, SLIDE_THEME } from './content-carousel-templates.ts';

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
    let s = String(text || '');
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

function roundRect(
    ctx: { beginPath: () => void; moveTo: (x: number, y: number) => void; lineTo: (x: number, y: number) => void; quadraticCurveTo: (cpx: number, cpy: number, x: number, y: number) => void; closePath: () => void },
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
) {
    const rad = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    ctx.lineTo(x + rad, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
    ctx.lineTo(x, y + rad);
    ctx.quadraticCurveTo(x, y, x + rad, y);
    ctx.closePath();
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

type Ctx = {
    fillStyle: unknown;
    font: string;
    fillRect: (x: number, y: number, w: number, h: number) => void;
    fillText: (t: string, x: number, y: number) => void;
    measureText: (s: string) => { width: number };
    save: () => void;
    restore: () => void;
    beginPath: () => void;
    moveTo: (x: number, y: number) => void;
    lineTo: (x: number, y: number) => void;
    quadraticCurveTo: (cpx: number, cpy: number, x: number, y: number) => void;
    closePath: () => void;
    clip: () => void;
    fill: () => void;
    rect: (x: number, y: number, w: number, h: number) => void;
    drawImage: (...a: never[]) => void;
};

function fillRound(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, color: string) {
    ctx.fillStyle = color;
    roundRect(ctx, x, y, w, h, r);
    ctx.fill();
}

function drawCaptionCard(ctx: Ctx, plan: SlidePlan, y0: number) {
    ctx.fillStyle = SLIDE_THEME.card;
    ctx.fillRect(0, y0, SLIDE_W, SLIDE_H - y0);
    const pad = SLIDE_THEME.pad;
    let y = y0 + 56;
    if (plan.brand) {
        ctx.fillStyle = SLIDE_THEME.accent;
        ctx.font = 'bold 22px DejaVu';
        ctx.fillText(fitText(ctx, plan.brand, SLIDE_W - pad * 2), pad, y);
        y += 40;
    }
    const head = String(plan.headline || plan.title || '').trim();
    if (head) {
        ctx.fillStyle = SLIDE_THEME.ink;
        ctx.font = 'bold 44px DejaVu';
        wrapLines(ctx, head, SLIDE_W - pad * 2, 2).forEach((line) => {
            ctx.fillText(line, pad, y);
            y += 52;
        });
    }
    const line = String(plan.line || '').trim();
    if (line) {
        y += 4;
        ctx.fillStyle = SLIDE_THEME.muted;
        ctx.font = '26px DejaVu';
        wrapLines(ctx, line, SLIDE_W - pad * 2, 3).forEach((t) => {
            ctx.fillText(t, pad, y);
            y += 34;
        });
    }
    const price = formatSlidePrice(plan.price);
    if (price) {
        y += 22;
        ctx.font = 'bold 26px DejaVu';
        const tw = ctx.measureText(price).width;
        fillRound(ctx, pad, y - 28, tw + 44, 48, 24, SLIDE_THEME.accent);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(price, pad + 22, y + 6);
    }
}

export async function renderCarouselSlidePng(plan: SlidePlan): Promise<Uint8Array> {
    await ensureFonts();
    const canvas = createCanvas(SLIDE_W, SLIDE_H);
    canvas.loadFont(fontRegular!, { family: 'DejaVu' });
    canvas.loadFont(fontBold!, { family: 'DejaVu', weight: 'bold' });
    const ctx = canvas.getContext('2d') as unknown as Ctx;
    ctx.font = '24px DejaVu';

    if (plan.kind === 'cover' || plan.kind === 'photo') {
        ctx.fillStyle = SLIDE_THEME.dark;
        ctx.fillRect(0, 0, SLIDE_W, SLIDE_H);
        const img = await loadPhoto(plan.photos[0] || '');
        if (img) coverDraw(ctx, img, 0, 0, SLIDE_W, SLIDE_THEME.photoH);
        else {
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 42px DejaVu';
            ctx.fillText('Нет фото', 80, SLIDE_THEME.photoH / 2);
        }
        drawCaptionCard(ctx, plan, SLIDE_THEME.photoH);
    } else if (plan.kind === 'collage') {
        ctx.fillStyle = SLIDE_THEME.paper;
        ctx.fillRect(0, 0, SLIDE_W, SLIDE_H);
        const cells = collageCells();
        const imgs = await Promise.all(plan.photos.map((u) => loadPhoto(u)));
        cells.forEach((cell, i) => {
            ctx.save();
            roundRect(ctx, cell.x, cell.y, cell.w, cell.h, 20);
            ctx.clip();
            ctx.fillStyle = '#E8E2D6';
            ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
            const img = imgs[i];
            if (img) coverDraw(ctx, img, cell.x, cell.y, cell.w, cell.h);
            ctx.restore();
        });
    } else if (plan.kind === 'info') {
        ctx.fillStyle = SLIDE_THEME.card;
        ctx.fillRect(0, 0, SLIDE_W, SLIDE_H);
        ctx.fillStyle = SLIDE_THEME.accent;
        ctx.fillRect(0, 0, SLIDE_W, 280);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = 'bold 20px DejaVu';
        ctx.fillText('Карточка товара', SLIDE_THEME.pad, 90);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 42px DejaVu';
        wrapLines(ctx, plan.title || 'Товар', SLIDE_W - SLIDE_THEME.pad * 2, 3).forEach((line, i) => {
            ctx.fillText(line, SLIDE_THEME.pad, 150 + i * 52);
        });
        let y = 340;
        infoFactRows(plan).forEach((row) => {
            ctx.fillStyle = SLIDE_THEME.line;
            ctx.fillRect(SLIDE_THEME.pad, y + 36, SLIDE_W - SLIDE_THEME.pad * 2, 1);
            ctx.fillStyle = SLIDE_THEME.muted;
            ctx.font = '24px DejaVu';
            ctx.fillText(row.label, SLIDE_THEME.pad, y);
            ctx.fillStyle = SLIDE_THEME.ink;
            ctx.font = 'bold 26px DejaVu';
            wrapLines(ctx, row.value, SLIDE_W - SLIDE_THEME.pad * 2 - 220, 3).forEach((line, i) => {
                ctx.fillText(line, SLIDE_THEME.pad + 220, y + i * 34);
            });
            y += 78;
        });
    } else {
        ctx.fillStyle = SLIDE_THEME.dark;
        ctx.fillRect(0, 0, SLIDE_W, SLIDE_H);
        ctx.fillStyle = SLIDE_THEME.accent;
        ctx.font = 'bold 22px DejaVu';
        const kicker = 'NR SPACE';
        ctx.fillText(kicker, (SLIDE_W - ctx.measureText(kicker).width) / 2, SLIDE_H / 2 - 70);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 72px DejaVu';
        const brand = fitText(ctx, plan.brand || 'NR', SLIDE_W - 160);
        ctx.fillText(brand, (SLIDE_W - ctx.measureText(brand).width) / 2, SLIDE_H / 2 + 10);
        ctx.font = '24px DejaVu';
        ctx.fillStyle = '#A3A3A3';
        const sub = plan.nmId ? `nmId ${plan.nmId}` : 'контент-завод';
        ctx.fillText(sub, (SLIDE_W - ctx.measureText(sub).width) / 2, SLIDE_H / 2 + 70);
    }

    return canvas.toBuffer('image/png');
}

export async function renderCarouselPngs(plans: SlidePlan[]): Promise<Uint8Array[]> {
    const out: Uint8Array[] = [];
    for (const plan of plans) out.push(await renderCarouselSlidePng(plan));
    return out;
}

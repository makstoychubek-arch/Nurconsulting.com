/**
 * PNG-отчёт по автоответу на вопрос WB — как карточка отзыва:
 * фото товара + таблица Вопрос / Ответ.
 */

import { createCanvas, loadImage } from 'https://deno.land/x/canvas@v1.4.2/mod.ts';

let fontRegular: Uint8Array | null = null;
let fontBold: Uint8Array | null = null;

export type QuestionReportModel = {
    cabinetName: string;
    kind: 'поступление' | 'вопрос';
    when: string;
    product: string;
    article: string;
    nmId: number;
    question: string;
    answer: string;
    photoUrl?: string | null;
};

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
        fetchWithTimeout(`${base}/DejaVuSans.ttf`, 20000).then((r) => {
            if (!r.ok) throw new Error(`font regular HTTP ${r.status}`);
            return r.arrayBuffer();
        }),
        fetchWithTimeout(`${base}/DejaVuSans-Bold.ttf`, 20000).then((r) => {
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
function wrapLines(ctx: any, text: string, maxW: number, maxLines: number): string[] {
    const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    const lines: string[] = [];
    let cur = '';
    for (const word of words) {
        const next = cur ? `${cur} ${word}` : word;
        if (ctx.measureText(next).width <= maxW) {
            cur = next;
            continue;
        }
        if (cur) lines.push(cur);
        cur = word;
        if (lines.length >= maxLines - 1) break;
    }
    if (cur && lines.length < maxLines) lines.push(cur);
    if (lines.length === maxLines && words.length) {
        let last = lines[maxLines - 1];
        while (last.length > 1 && ctx.measureText(`${last}…`).width > maxW) last = last.slice(0, -1);
        lines[maxLines - 1] = `${last}…`;
    }
    return lines;
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

export async function renderQuestionAnswerReportPng(model: QuestionReportModel): Promise<Uint8Array> {
    await ensureFonts();
    const S = 2;
    const width = 720;
    const pad = 22;
    const photoW = 168;
    const photoH = 210;
    const qLinesGuess = Math.min(6, Math.max(2, Math.ceil(String(model.question || '').length / 52)));
    const aLinesGuess = Math.min(7, Math.max(2, Math.ceil(String(model.answer || '').length / 52)));
    const tableH = 44 + qLinesGuess * 22 + 44 + aLinesGuess * 22 + 28;
    const height = pad + 36 + Math.max(photoH, 120) + 18 + tableH + 36 + pad;

    const canvas = createCanvas(Math.round(width * S), Math.round(height * S));
    canvas.loadFont(fontRegular!, { family: 'DejaVu' });
    canvas.loadFont(fontBold!, { family: 'DejaVu', weight: 'bold' });
    const ctx = canvas.getContext('2d');
    ctx.scale(S, S);
    ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = '#E8EEF4';
    ctx.fillRect(0, 0, width, height);

    roundRect(ctx, 12, 12, width - 24, height - 24, 16);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    const cab = String(model.cabinetName || 'Кабинет').trim();
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 20px DejaVu';
    ctx.fillText(cab.slice(0, 42), pad + 8, pad + 28);

    ctx.fillStyle = '#6B7280';
    ctx.font = '13px DejaVu';
    ctx.fillText(`${model.when} · автоответ · ${model.kind}`, pad + 8, pad + 50);

    const img = model.photoUrl ? await loadPhoto(model.photoUrl) : null;
    const ix = pad + 8;
    const iy = pad + 64;
    roundRect(ctx, ix, iy, photoW, photoH, 12);
    ctx.fillStyle = '#F3F4F6';
    ctx.fill();
    if (img) {
        ctx.save();
        roundRect(ctx, ix, iy, photoW, photoH, 12);
        ctx.clip();
        const pw = Number((img as { width: number }).width) || 1;
        const ph = Number((img as { height: number }).height) || 1;
        const scale = Math.max(photoW / pw, photoH / ph);
        const dw = pw * scale;
        const dh = ph * scale;
        ctx.drawImage(img as never, ix + (photoW - dw) / 2, iy + (photoH - dh) / 2, dw, dh);
        ctx.restore();
    }

    const tx = ix + photoW + 18;
    const tw = width - tx - pad - 8;
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 15px DejaVu';
    const product = wrapLines(ctx, model.product || model.article || 'товар', tw, 3);
    product.forEach((line, i) => ctx.fillText(line, tx, iy + 22 + i * 20));
    ctx.fillStyle = '#6B7280';
    ctx.font = '13px DejaVu';
    const meta = [model.article, model.nmId ? String(model.nmId) : ''].filter(Boolean).join(' · ');
    ctx.fillText(meta.slice(0, 48), tx, iy + 22 + product.length * 20 + 18);

    const tableY = iy + photoH + 18;
    const tableX = pad + 8;
    const tableW = width - pad * 2 - 16;
    const colW = 120;

    const drawRow = (y: number, label: string, value: string, maxLines: number) => {
        ctx.font = '13px DejaVu';
        const lines = wrapLines(ctx, value, tableW - colW - 24, maxLines);
        const h = Math.max(40, 18 + lines.length * 20);
        ctx.strokeStyle = '#D1D5DB';
        ctx.lineWidth = 1;
        ctx.strokeRect(tableX, y, tableW, h);
        ctx.beginPath();
        ctx.moveTo(tableX + colW, y);
        ctx.lineTo(tableX + colW, y + h);
        ctx.stroke();
        ctx.fillStyle = '#6B7280';
        ctx.font = 'bold 13px DejaVu';
        ctx.fillText(label, tableX + 10, y + 24);
        ctx.fillStyle = '#111827';
        ctx.font = '13px DejaVu';
        lines.forEach((line, i) => ctx.fillText(line, tableX + colW + 10, y + 24 + i * 20));
        return h;
    };

    ctx.fillStyle = '#F9FAFB';
    ctx.fillRect(tableX, tableY, tableW, 32);
    ctx.strokeStyle = '#D1D5DB';
    ctx.strokeRect(tableX, tableY, tableW, 32);
    ctx.beginPath();
    ctx.moveTo(tableX + colW, tableY);
    ctx.lineTo(tableX + colW, tableY + 32);
    ctx.stroke();
    ctx.fillStyle = '#6B7280';
    ctx.font = 'bold 12px DejaVu';
    ctx.fillText('Поле', tableX + 10, tableY + 21);
    ctx.fillText('Значение', tableX + colW + 10, tableY + 21);

    let y = tableY + 32;
    y += drawRow(y, 'Вопрос', model.question, 6);
    y += drawRow(y, 'Ответ', model.answer, 7);

    ctx.fillStyle = '#9CA3AF';
    ctx.font = '12px DejaVu';
    ctx.fillText(`автоответ · ${model.kind} ${model.when} · ответ ${model.when}`, pad + 8, height - 22);

    return canvas.toBuffer('image/png');
}

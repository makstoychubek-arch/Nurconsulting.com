/**
 * PNG-карточка отзыва / вопроса для Telegram. Тот же стиль, что у отчёта А/Б:
 * слева сверху логотип NR и вид карточки, справа юридическое название кабинета,
 * фото товара 3:4, ниже текст покупателя и наш ответ. Шаблон: docs/feedback-card.md.
 */

import { createCanvas, loadImage } from 'https://deno.land/x/canvas@v1.4.2/mod.ts';
import {
    ensureFonts,
    fitText,
    imgSize,
    loadPhoto,
    NR_LOGO_PNG_B64,
    reportFonts,
    roundRect,
    textW,
} from './ab-test-report-png.ts';

export type FeedbackCardModel = {
    kind: 'review' | 'question';
    cabinetName: string;
    title: string;
    nmId: number | string;
    supplierArticle?: string;
    photoUrl?: string;
    /** small — маленькая миниатюра рядом с названием (по умолчанию), none — без фото. */
    photo?: 'small' | 'none';
    /** Только для отзыва: 1–5. */
    rating?: number;
    buyer?: string;
    createdStr: string;
    text: string;
    answer?: string;
    answerStr?: string;
    /** auto — ответил бот, manual — ответил человек, pending — ждёт ответа. */
    mode: 'auto' | 'manual' | 'pending';
    /** Короткая метка рядом с видом: «Отказ», «Выкуп» и т.п. */
    tag?: string;
};

const MODE_LABEL: Record<FeedbackCardModel['mode'], string> = {
    auto: 'автоответ',
    manual: 'вручную',
    pending: 'ждёт ответа',
};

// deno-lint-ignore no-explicit-any
function wrap(ctx: any, text: string, maxW: number, maxLines: number, bold = false): string[] {
    const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ');
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
        const next = cur ? `${cur} ${w}` : w;
        if (textW(ctx, next, bold) <= maxW) { cur = next; continue; }
        if (cur) lines.push(cur);
        cur = w;
    }
    if (cur) lines.push(cur);
    if (lines.length > maxLines) {
        const cut = lines.slice(0, maxLines);
        let last = cut[maxLines - 1];
        while (last.length > 1 && textW(ctx, last + '…', bold) > maxW) last = last.slice(0, -1);
        cut[maxLines - 1] = last + '…';
        return cut;
    }
    return lines;
}

export async function renderFeedbackPng(model: FeedbackCardModel): Promise<Uint8Array> {
    await ensureFonts();
    const fonts = reportFonts();
    const S = 2;
    const pad = 28;
    const width = 780;
    const showPhoto = model.photo !== 'none';
    const photoW = showPhoto ? 64 : 0;
    const photoH = Math.round(photoW * 4 / 3);
    const colX = pad + (showPhoto ? photoW + 16 : 0);
    const colW = width - pad - colX;
    const blockX = pad;
    const blockW = width - pad * 2;

    const probe = createCanvas(10, 10);
    probe.loadFont(fonts.regular, { family: 'DejaVu' });
    probe.loadFont(fonts.bold, { family: 'DejaVu', weight: 'bold' });
    const pc = probe.getContext('2d');
    pc.font = '15px DejaVu';
    const textLines = wrap(pc, model.text, blockW - 32, 7);
    const answerLines = model.answer ? wrap(pc, model.answer, blockW - 32, 7) : [];
    const lh = 21;

    const headerH = 52;
    pc.font = 'bold 20px DejaVu';
    const titleLinesN = wrap(pc, model.title, colW, 2, true).length;
    pc.font = '15px DejaVu';
    const topInfoH = Math.max(photoH, 20 + titleLinesN * 25 + 4 + 14) + 22; // миниатюра/название, артикул, звёзды/покупатель
    const textBlockH = 34 + textLines.length * lh + 18;
    const answerBlockH = model.answer || model.mode === 'pending'
        ? 34 + Math.max(answerLines.length, 1) * lh + 18
        : 0;
    const rightH = topInfoH + textBlockH + (answerBlockH ? 14 + answerBlockH : 0);
    const bodyH = rightH;
    const height = pad + headerH + 18 + bodyH + 44 + pad;

    const canvas = createCanvas(Math.round(width * S), Math.round(height * S));
    canvas.loadFont(fonts.regular, { family: 'DejaVu' });
    canvas.loadFont(fonts.bold, { family: 'DejaVu', weight: 'bold' });
    const ctx = canvas.getContext('2d');
    ctx.scale(S, S);
    ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = '#F4F2EE';
    ctx.fillRect(0, 0, width, height);

    // Шапка: логотип + вид карточки слева, кабинет справа (как в отчёте А/Б).
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
    ctx.fillText(model.kind === 'review' ? '/ ОТЗЫВ' : '/ ВОПРОС', lx + logoS + 10, ly + logoS / 2 + 5.5);

    if (model.cabinetName) {
        ctx.fillStyle = '#374151';
        ctx.font = 'bold 15px DejaVu';
        let cab = model.cabinetName;
        while (cab.length > 1 && textW(ctx, cab, true) > width / 2 - pad) cab = cab.slice(0, -1);
        ctx.fillText(cab, width - pad - textW(ctx, cab, true), ly + logoS / 2 + 5.5);
    }

    const top = pad + headerH + 18;

    // Миниатюра 3:4.
    if (showPhoto) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.10)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 2;
    roundRect(ctx, pad, top, photoW, photoH, 10);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.restore();
    const photo = await loadPhoto(model.photoUrl || '');
    if (photo) {
        const { w, h } = imgSize(photo as never);
        const k = Math.max(photoW / w, photoH / h);
        const dw = w * k, dh = h * k;
        ctx.save();
        roundRect(ctx, pad, top, photoW, photoH, 10);
        ctx.clip();
        ctx.drawImage(photo as never, pad + (photoW - dw) / 2, top + (photoH - dh) / 2, dw, dh);
        ctx.restore();
    }
    }

    // Название и артикул.
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 20px DejaVu';
    const titleLines = wrap(ctx, model.title, colW, 2, true);
    titleLines.forEach((l, i) => ctx.fillText(l, colX, top + 20 + i * 25));
    ctx.fillStyle = '#6B7280';
    ctx.font = '13px DejaVu';
    const sub = `арт. ${model.nmId}${model.supplierArticle ? ' · ' + model.supplierArticle : ''}`;
    ctx.fillText(fitText(ctx, sub, colW), colX, top + 20 + titleLines.length * 25 + 4);

    // Звёзды / покупатель / дата.
    const metaY = top + 20 + titleLines.length * 25 + 28;
    let mx = colX;
    if (model.kind === 'review' && model.rating) {
        const r = Math.max(1, Math.min(5, Math.round(model.rating)));
        ctx.font = 'bold 18px DejaVu';
        for (let i = 0; i < 5; i++) {
            ctx.fillStyle = i < r ? '#F59E0B' : '#D1D5DB';
            ctx.fillText('★', mx + i * 22, metaY);
        }
        mx += 5 * 22 + 8;
    }
    ctx.font = '13px DejaVu';
    ctx.fillStyle = '#6B7280';
    const meta = [model.buyer, model.createdStr].filter(Boolean).join(' · ');
    ctx.fillText(fitText(ctx, meta, width - pad - mx), mx, metaY);
    if (model.tag) {
        ctx.font = 'bold 12px DejaVu';
        const tw = textW(ctx, model.tag, true) + 20;
        const tx = colX + colW - tw;
        roundRect(ctx, tx, metaY - 17, tw, 24, 12);
        ctx.fillStyle = '#E5E7EB';
        ctx.fill();
        ctx.fillStyle = '#374151';
        ctx.fillText(model.tag, tx + 10, metaY);
    }

    // Блок «Покупатель».
    let by = top + topInfoH;
    roundRect(ctx, blockX, by, blockW, textBlockH, 14);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.stroke();
    ctx.fillStyle = '#9CA3AF';
    ctx.font = 'bold 11px DejaVu';
    ctx.fillText(model.kind === 'review' ? 'ОТЗЫВ ПОКУПАТЕЛЯ' : 'ВОПРОС ПОКУПАТЕЛЯ', blockX + 16, by + 22);
    ctx.fillStyle = '#111827';
    ctx.font = '15px DejaVu';
    textLines.forEach((l, i) => ctx.fillText(l, blockX + 16, by + 46 + i * lh));
    by += textBlockH + 14;

    // Блок «Ответ».
    if (answerBlockH) {
        const pending = model.mode === 'pending';
        roundRect(ctx, blockX, by, blockW, answerBlockH, 14);
        ctx.fillStyle = pending ? '#FEF3C7' : '#E8F0FE';
        ctx.fill();
        ctx.fillStyle = pending ? '#B45309' : '#1D4ED8';
        ctx.font = 'bold 11px DejaVu';
        const label = `${MODE_LABEL[model.mode].toUpperCase()}${model.answerStr ? ' · ' + model.answerStr : ''}`;
        ctx.fillText(fitText(ctx, label, blockW - 32), blockX + 16, by + 22);
        ctx.fillStyle = pending ? '#92400E' : '#1E3A8A';
        ctx.font = '15px DejaVu';
        const lines = answerLines.length ? answerLines : ['Ответа пока нет'];
        lines.forEach((l, i) => ctx.fillText(l, blockX + 16, by + 46 + i * lh));
    }

    ctx.fillStyle = '#9CA3AF';
    ctx.font = '12px DejaVu';
    ctx.fillText('Nurconsulting · nurcon.kg', pad, height - 22);

    return canvas.toBuffer('image/png');
}

/** Подпись к картинке в Telegram: у вопроса только тег владельца, у отзыва подписи нет. */
export function feedbackCaption(kind: FeedbackCardModel['kind'], ownerUsername: string): string {
    if (kind !== 'question') return '';
    const u = String(ownerUsername || '').replace(/^@/, '').trim();
    return u ? `@${u}` : '';
}

// Карточка «Штрафы» для Telegram в стиле А/Б-отчёта и карточек отзывов:
// слева логотип NR и «/ ШТРАФЫ», справа юридическое название кабинета (cabinetLegalName).
// Текст под картинкой не нужен: в подписи только отметка ответственного.

import { createCanvas, loadImage } from 'https://deno.land/x/canvas@v1.4.2/mod.ts';
import {
    ensureFonts,
    fitText,
    NR_LOGO_PNG_B64,
    reportFonts,
    roundRect,
    textW,
} from './ab-test-report-png.ts';

export interface PenaltyCardRow {
    reason: string;
    amount: number;
}

export interface PenaltyCardModel {
    legalName: string;
    dateLabel: string; // «11 октября 2026»
    rows: PenaltyCardRow[]; // строки этой страницы
    pageNum: number;
    pageCount: number;
    /** Итог и сравнение показываем на последней странице; null — на промежуточных. */
    totals: { total: number; items: number; prevTotal: number } | null;
    /** Для пустого дня */
    empty?: { prevTotal: number };
}

// Ширина по текущему шрифту; bold библиотека мерит ~на 12% уже (см. textW в ab-test-report-png.ts)
// deno-lint-ignore no-explicit-any
const mw = (ctx: any, t: string, bold = false): number => textW(ctx, t, bold);
// Ширина числа «1 240»: у DejaVu Sans Bold все цифры 0.696em, пробел 0.348em (measureText в этой библиотеке для цифр врёт)
const numWidth = (t: string, px: number): number =>
    [...t].reduce((w, ch) => w + (ch === ' ' ? 0.348 : 0.696) * px, 0);
const fmt = (n: number) => (n < 0 ? '+' : '') + Math.abs(Math.round(n)).toLocaleString('ru-RU').replace(/ /g, ' ');

function items(n: number): string {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return `${n} позиция`;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return `${n} позиции`;
    return `${n} позиций`;
}

export async function renderPenaltyCardPng(m: PenaltyCardModel): Promise<Uint8Array> {
    await ensureFonts();
    const S = 2;
    const width = 560;
    const pad = 20;
    const logoS = 36;
    const cardX = pad;
    const cardW = width - pad * 2;
    const inner = 22;
    const headerH = logoS + 14;
    const topBlockH = 88;
    const colHeadH = 30;
    const rowH = 40;
    const totalBoxH = 46;
    const isEmpty = !!m.empty;

    const cardH = isEmpty
        ? inner * 2 + 96
        : inner + topBlockH + colHeadH + m.rows.length * rowH + (m.totals ? 10 + totalBoxH : 0) + inner;
    const height = pad + headerH + cardH + pad;

    const canvas = createCanvas(width * S, height * S);
    const f = reportFonts();
    canvas.loadFont(f.regular, { family: 'DejaVu' });
    canvas.loadFont(f.bold, { family: 'DejaVu', weight: 'bold' });
    const ctx = canvas.getContext('2d');
    ctx.scale(S, S);
    ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = '#F4F2EE';
    ctx.fillRect(0, 0, width, height);

    // Шапка: логотип + «/ ШТРАФЫ» слева, юрлицо справа
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
    ctx.fillText('/ ШТРАФЫ', lx + logoS + 10, ly + logoS / 2 + 5.5);

    ctx.fillStyle = '#374151';
    ctx.font = 'bold 15px DejaVu';
    let cab = m.legalName;
    while (cab.length > 1 && mw(ctx, cab, true) > width / 2 - pad) cab = cab.slice(0, -1);
    ctx.fillText(cab, width - pad - mw(ctx, cab, true), ly + logoS / 2 + 5.5);

    // Белая карточка
    const cardY = pad + headerH;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.08)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 1;
    roundRect(ctx, cardX, cardY, cardW, cardH, 16);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.restore();

    const L = cardX + inner;
    const R = cardX + cardW - inner;
    const innerW = cardW - inner * 2;
    const pageSuffix = m.pageCount > 1 ? ` · стр. ${m.pageNum}/${m.pageCount}` : '';

    if (isEmpty) {
        ctx.fillStyle = '#9CA3AF';
        ctx.font = '11px DejaVu';
        ctx.fillText(`ЗА ${m.dateLabel.toUpperCase()}`, L, cardY + inner + 12);
        ctx.fillStyle = '#15803D';
        ctx.font = 'bold 30px DejaVu';
        ctx.fillText('Штрафов нет', L, cardY + inner + 54);
        if (m.empty!.prevTotal > 0) {
            ctx.fillStyle = '#6B7280';
            ctx.font = '13px DejaVu';
            ctx.fillText(`Вчера было удержано ${fmt(m.empty!.prevTotal)} сом`, L, cardY + inner + 80);
        }
        return canvas.toBuffer('image/png');
    }

    // Верхний блок: дата слева, сумма и сравнение справа
    const ty = cardY + inner;
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '11px DejaVu';
    ctx.fillText(m.totals && m.totals.total < 0 ? 'СТОРНИРОВАНО ЗА' : 'УДЕРЖАНО ЗА', L, ty + 12);
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 20px DejaVu';
    ctx.fillText(fitText(ctx, m.dateLabel + pageSuffix, innerW / 2), L, ty + 40);

    if (m.totals) {
        const { total, prevTotal } = m.totals;
        ctx.fillStyle = '#6B7280';
        ctx.font = '15px DejaVu';
        ctx.fillText('сом', R - 29, ty + 40);
        ctx.fillStyle = total < 0 ? '#15803D' : '#B91C1C';
        ctx.font = 'bold 34px DejaVu';
        ctx.fillText(fmt(total), R - 36 - numWidth(fmt(total), 34), ty + 40);

        const delta = total - prevTotal;
        const sto = total < 0; // сторно: WB вернул штрафы, сравнение со вчера не нужно
        const label = sto ? 'WB вернул штрафы'
            : prevTotal > 0 || delta !== 0
                ? `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${fmt(Math.abs(delta))} к вчера`
                : 'как вчера';
        ctx.font = 'bold 12px DejaVu';
        const pw = Math.round(mw(ctx, label, true)) + 20;
        const px = R - pw, py = ty + 52;
        roundRect(ctx, px, py, pw, 22, 11);
        ctx.fillStyle = sto ? '#DCFCE7' : delta > 0 ? '#FEE2E2' : delta < 0 ? '#DCFCE7' : '#F3F4F6';
        ctx.fill();
        ctx.fillStyle = sto ? '#166534' : delta > 0 ? '#991B1B' : delta < 0 ? '#166534' : '#4B5563';
        ctx.fillText(label, px + 10, py + 15);
    }

    // Разделитель и заголовок колонок
    const divY = ty + topBlockH - 12;
    ctx.fillStyle = '#E5E7EB';
    ctx.fillRect(L, divY, innerW, 1);
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '11px DejaVu';
    ctx.fillText('ПРИЧИНА', L, divY + 22);
    ctx.fillText('СУММА, СОМ', R - mw(ctx, 'СУММА, СОМ'), divY + 22);

    // Строки
    let y = divY + colHeadH - 6;
    for (const r of m.rows) {
        ctx.fillStyle = '#F3F4F6';
        ctx.fillRect(L, y, innerW, 1);
        ctx.fillStyle = '#111827';
        const amt = fmt(r.amount);
        ctx.font = '14px DejaVu';
        ctx.fillText(fitText(ctx, r.reason, innerW - 90), L, y + rowH / 2 + 5);
        ctx.fillStyle = r.amount < 0 ? '#15803D' : '#B91C1C';
        ctx.font = 'bold 14px DejaVu';
        ctx.fillText(amt, R - numWidth(amt, 14), y + rowH / 2 + 5);
        y += rowH;
    }

    // Итого
    if (m.totals) {
        const by = y + 10;
        roundRect(ctx, L, by, innerW, totalBoxH, 10);
        ctx.fillStyle = m.totals.total < 0 ? '#F0FDF4' : '#FEF2F2';
        ctx.fill();
        ctx.fillStyle = m.totals.total < 0 ? '#14532D' : '#7F1D1D';
        ctx.font = 'bold 14px DejaVu';
        ctx.fillText(`Итого, ${items(m.totals.items)}`, L + 14, by + totalBoxH / 2 + 5);
        ctx.fillStyle = m.totals.total < 0 ? '#15803D' : '#B91C1C';
        ctx.font = 'bold 17px DejaVu';
        ctx.fillText(fmt(m.totals.total), R - 14 - numWidth(fmt(m.totals.total), 17), by + totalBoxH / 2 + 6);
    }

    return canvas.toBuffer('image/png');
}

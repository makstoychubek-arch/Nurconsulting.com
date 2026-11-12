// Карточка «Отправки FBS» для Telegram в стиле «Минимализм»: слева логотип NR и «/ ОТПРАВКИ FBS», справа дата,
// белая карточка с чёрным контуром, большое число отправок, строки по кабинетам, итог в рублях.
// Без цветных заливок: цвет не нужен, это не метрика роста.

import { createCanvas, loadImage } from 'https://deno.land/x/canvas@v1.4.2/mod.ts';
import { ensureFonts, fitText, NR_LOGO_PNG_B64, reportFonts, roundRect, textW } from './ab-test-report-png.ts';
import { plural, type FfShipRow } from './ff-shipments.ts';

export interface FfShipCardModel {
    ffName: string;        // «АМАН ФФ»
    dateLabel: string;     // «11 ноября 2026»
    rows: FfShipRow[];
    total: { count: number; sum: number };
}

// deno-lint-ignore no-explicit-any
const mw = (ctx: any, t: string, bold = false): number => textW(ctx, t, bold);
const rub = (n: number) => Math.round(n).toLocaleString('ru-RU').replace(/ | /g, ' ') + ' ₽';
// Ширина числа у DejaVu Sans Bold: цифры 0.696em, пробел 0.348em (measureText в этой библиотеке для цифр занижает)
const numWidth = (t: string, px: number): number => [...t].reduce((w, ch) => w + (ch === ' ' ? 0.348 : 0.696) * px, 0);
// Ширина строки для выравнивания вправо: числа и знаки считаем по таблице DejaVu, буквы по measureText с поправкой
// (библиотека измеряет жирный шрифт примерно на 12% уже, а textAlign: 'right' в ней не работает).
// deno-lint-ignore no-explicit-any
const wd = (ctx: any, t: string, px: number, bold: boolean): number => {
    if (/^[\d \u00a0×.,₽−+-]+$/.test(t)) {
        return [...t].reduce((w, ch) => w + (/\d/.test(ch) ? (bold ? 0.696 : 0.636) : ch === ' ' || ch === '\u00a0' ? (bold ? 0.348 : 0.318) : ch === '×' ? 0.838 : ch === '₽' ? (bold ? 0.696 : 0.636) : 0.32) * px, 0);
    }
    return mw(ctx, t, bold) * (bold ? 1.15 : 1.02);
};
const num = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export async function renderFfShipmentsPng(m: FfShipCardModel): Promise<Uint8Array> {
    await ensureFonts();
    const S = 2;
    const width = 580;
    const pad = 20;
    const logoS = 36;
    const headerH = logoS + 16;
    const inner = 26;
    const cardX = pad;
    const cardW = width - pad * 2;
    const rowH = 58;
    const heroH = 118;
    const rowsH = Math.max(1, m.rows.length) * rowH;
    const totalH = 66;
    const footH = 34;
    const cardH = inner + heroH + rowsH + totalH + footH;
    const height = pad + headerH + cardH + pad;

    const canvas = createCanvas(width * S, height * S);
    const f = reportFonts();
    canvas.loadFont(f.regular, { family: 'DejaVu' });
    canvas.loadFont(f.bold, { family: 'DejaVu', weight: 'bold' });
    const ctx = canvas.getContext('2d');
    ctx.scale(S, S);
    ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = '#F2F2F2';
    ctx.fillRect(0, 0, width, height);

    // Шапка: логотип + «/ ОТПРАВКИ FBS», дата справа
    const lx = pad, ly = pad;
    roundRect(ctx, lx, ly, logoS, logoS, logoS * 120 / 512);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    const logoImg = await loadImage(Uint8Array.from(atob(NR_LOGO_PNG_B64), (c) => c.charCodeAt(0)));
    ctx.drawImage(logoImg as never, lx, ly, logoS, logoS);
    roundRect(ctx, lx, ly, logoS, logoS, logoS * 120 / 512);
    ctx.strokeStyle = '#0B0B0B';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#0B0B0B';
    ctx.font = 'bold 16px DejaVu';
    ctx.fillText('/ ОТПРАВКИ FBS', lx + logoS + 10, ly + logoS / 2 + 5.5);
    ctx.fillStyle = '#6B6B6B';
    ctx.font = 'bold 12px DejaVu';
    const dl = m.dateLabel.toUpperCase();
    ctx.fillText(dl, width - pad - wd(ctx, dl, 12, true), ly + logoS / 2 + 4.5);

    // Карточка: белая, чёрный контур 1.5 px, скругление 26
    const cardY = pad + headerH;
    roundRect(ctx, cardX, cardY, cardW, cardH, 26);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = '#0B0B0B';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const L = cardX + inner;
    const R = cardX + cardW - inner;
    const innerW = cardW - inner * 2;

    // Главное число
    let y = cardY + inner;
    ctx.fillStyle = '#6B6B6B';
    ctx.font = 'bold 11px DejaVu';
    ctx.fillText(`ЗА ДЕНЬ · ${m.ffName.toUpperCase()}`, L, y + 10);
    ctx.fillStyle = '#0B0B0B';
    ctx.font = 'bold 56px DejaVu';
    const big = num(m.total.count);
    ctx.fillText(big, L, y + 74);
    ctx.fillStyle = '#6B6B6B';
    ctx.font = 'bold 16px DejaVu';
    ctx.fillText(plural(m.total.count, 'отправка', 'отправки', 'отправок'), L + numWidth(big, 56) + 12, y + 74);

    // Разделитель и строки по кабинетам
    y = cardY + inner + heroH - 14;
    ctx.fillStyle = '#0B0B0B';
    ctx.fillRect(L, y, innerW, 1);
    if (!m.rows.length) {
        ctx.fillStyle = '#6B6B6B';
        ctx.font = '14px DejaVu';
        ctx.fillText('Сегодня отправок не было', L, y + 36);
    }
    for (const r of m.rows) {
        const top = y + 22;
        ctx.fillStyle = '#0B0B0B';
        ctx.font = 'bold 15px DejaVu';
        ctx.fillText(fitText(ctx, r.cabinet, innerW - 190), L, top);
        ctx.fillStyle = '#6B6B6B';
        ctx.font = '11px DejaVu';
        if (r.sub) ctx.fillText(fitText(ctx, r.sub, innerW - 190), L, top + 18);
        // справа: «18 × 150 ₽» и сумма
        const calc = r.rate != null ? `${r.count} × ${r.mixedRates ? 'ср. ' : ''}${Math.round(r.rate * 100) / 100} ₽` : `${r.count} шт, тариф не задан`;
        ctx.fillStyle = '#6B6B6B';
        ctx.font = '12px DejaVu';
        const amount = rub(r.sum);
        const amW = wd(ctx, amount, 16, true);
        ctx.fillText(calc, R - amW - 18 - wd(ctx, calc, 12, false), top);
        ctx.fillStyle = '#0B0B0B';
        ctx.font = 'bold 16px DejaVu';
        ctx.fillText(amount, R - amW, top);
        y += rowH;
        ctx.fillStyle = '#E4E4E4';
        ctx.fillRect(L, y, innerW, 1);
    }

    // Итог
    y = cardY + inner + heroH - 14 + rowsH + 10;
    ctx.fillStyle = '#0B0B0B';
    ctx.fillRect(L, y, innerW, 2);
    ctx.fillStyle = '#6B6B6B';
    ctx.font = 'bold 11px DejaVu';
    ctx.fillText('К ОПЛАТЕ ЗА ДЕНЬ', L, y + 40);
    ctx.fillStyle = '#0B0B0B';
    ctx.font = 'bold 30px DejaVu';
    const tot = rub(m.total.sum);
    ctx.fillText(tot, R - wd(ctx, tot, 30, true), y + 42);

    // Подпись
    ctx.fillStyle = '#9A9A9A';
    ctx.font = '11px DejaVu';
    ctx.fillText('Тариф ФФ из условий кабинета · данные WB', L, cardY + cardH - 16);

    return canvas.toBuffer('image/png');
}

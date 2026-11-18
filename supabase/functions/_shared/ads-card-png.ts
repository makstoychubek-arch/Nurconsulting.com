// Карточка «Реклама» для Telegram в стиле «Минимализм»: логотип NR и «/ РЕКЛАМА», дата, кабинет, расход крупно,
// таблетка динамики к предыдущему дню (зелёная: расход упал, красная: вырос), шесть метрик сеткой.

import { createCanvas, loadImage } from 'https://deno.land/x/canvas@v1.4.2/mod.ts';
import { ensureFonts, fitText, NR_LOGO_PNG_B64, reportFonts, roundRect, textW } from './ab-test-report-png.ts';
import type { AdCardModel } from './ads-report.ts';

export interface AdCardInput { cabinet: string; dateLabel: string; m: AdCardModel }

// deno-lint-ignore no-explicit-any
const mw = (ctx: any, t: string, bold = false): number => textW(ctx, t, bold);
const grp = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const dash = (v: number | null, unit = '') => (v == null ? '—' : grp(v) + unit);
const pct = (v: number | null) => (v == null ? '—' : v.toFixed(1).replace('.', ',') + '%');
// Ширина строки из цифр/пробелов/знаков по таблице DejaVu (measureText в библиотеке занижает жирный шрифт, textAlign не работает)
const numW = (t: string, px: number, bold = true): number =>
    [...t].reduce((w, ch) => w + (/\d/.test(ch) ? (bold ? 0.696 : 0.636) : ch === ' ' || ch === ' ' ? (bold ? 0.348 : 0.318) : ch === '%' ? 0.95 : ch === '—' ? 1 : 0.35) * px, 0);

export async function renderAdCardPng(inp: AdCardInput): Promise<Uint8Array> {
    await ensureFonts();
    const { m } = inp;
    const S = 2;
    const width = 580;
    const pad = 20;
    const logoS = 36;
    const headerH = logoS + 16;
    const inner = 26;
    const cardW = width - pad * 2;
    const heroH = 156;
    const cellH = 66;
    const gridH = cellH * 3;
    const footH = 36;
    const cardH = inner + heroH + gridH + footH;
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

    // Шапка
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
    ctx.fillText('/ РЕКЛАМА', lx + logoS + 10, ly + logoS / 2 + 5.5);
    ctx.fillStyle = '#6B6B6B';
    ctx.font = 'bold 12px DejaVu';
    const dl = inp.dateLabel.toUpperCase();
    ctx.fillText(dl, width - pad - mw(ctx, dl, true) * 1.15, ly + logoS / 2 + 4.5);

    // Карточка
    const cardX = pad, cardY = pad + headerH;
    roundRect(ctx, cardX, cardY, cardW, cardH, 26);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = '#0B0B0B';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const L = cardX + inner, R = cardX + cardW - inner, innerW = cardW - inner * 2;

    // Кабинет и расход
    let y = cardY + inner;
    ctx.fillStyle = '#6B6B6B';
    ctx.font = 'bold 11px DejaVu';
    ctx.fillText(fitText(ctx, inp.cabinet.toUpperCase(), innerW), L, y + 10);
    ctx.fillStyle = '#0B0B0B';
    ctx.font = 'bold 54px DejaVu';
    const spend = grp(m.spend);
    ctx.fillText(spend, L, y + 74);
    ctx.fillStyle = '#6B6B6B';
    ctx.font = 'bold 16px DejaVu';
    ctx.fillText('сом расход', L + numW(spend, 54) + 12, y + 74);

    // Динамика к предыдущему дню
    if (m.spendDeltaPct != null && m.spendDeltaPct !== 0) {
        const down = m.spendDeltaPct < 0;
        const label = `${down ? '▼' : '▲'} ${String(Math.abs(m.spendDeltaPct)).replace('.', ',')}% к предыдущему дню`;
        ctx.font = 'bold 12px DejaVu';
        const pw = Math.round(mw(ctx, label, true) * 1.12) + 24;
        roundRect(ctx, L, y + 88, pw, 24, 12);
        ctx.fillStyle = down ? '#E2F6E8' : '#FDE7E7';
        ctx.fill();
        ctx.fillStyle = down ? '#1B7A3A' : '#C62828';
        ctx.fillText(label, L + 12, y + 104);
    }
    ctx.fillStyle = '#6B6B6B';
    ctx.font = '12px DejaVu';
    ctx.fillText(`${grp(m.clicks)} кликов · ${grp(m.impressions)} показов · CTR ${pct(m.ctr)} · клик ${dash(m.clickCost, ' сом')}`, L, y + 132);

    // Сетка 2 × 3
    const gy = cardY + inner + heroH - 6;
    ctx.fillStyle = '#0B0B0B';
    ctx.fillRect(L, gy, innerW, 1);
    const cells: Array<[string, string, string]> = [
        ['КОРЗИНЫ С РК', grp(m.carts), ''],
        ['ЦЕНА КОРЗИНЫ', dash(m.cartCost), m.cartCost == null ? '' : ' сом'],
        ['ЗАКАЗЫ С РК', grp(m.orders), ''],
        ['ЦЕНА ЗАКАЗА', dash(m.orderCost), m.orderCost == null ? '' : ' сом'],
        ['ДРР', pct(m.drr), ''],
        ['ВЫРУЧКА РК', grp(m.revenue), ' сом'],
    ];
    const colW = innerW / 2;
    cells.forEach(([label, val, unit], i) => {
        const col = i % 2, row = Math.floor(i / 2);
        const cx = L + col * colW + (col ? 20 : 0);
        const cy = gy + row * cellH;
        if (col) { ctx.fillStyle = '#E6E6E6'; ctx.fillRect(L + colW, cy + 8, 1, cellH - 16); }
        if (row) { ctx.fillStyle = '#E6E6E6'; ctx.fillRect(L, cy, innerW, 1); }
        ctx.fillStyle = '#6B6B6B';
        ctx.font = 'bold 10px DejaVu';
        ctx.fillText(label, cx, cy + 24);
        ctx.fillStyle = '#0B0B0B';
        ctx.font = 'bold 22px DejaVu';
        ctx.fillText(val, cx, cy + 52);
        if (unit) {
            ctx.fillStyle = '#6B6B6B';
            ctx.font = '12px DejaVu';
            ctx.fillText(unit.trim(), cx + numW(val, 22) + 6, cy + 52);
        }
    });

    ctx.fillStyle = '#9A9A9A';
    ctx.font = '11px DejaVu';
    ctx.fillText('ДРР от выручки рекламы · данные WB', L, cardY + cardH - 16);
    return canvas.toBuffer('image/png');
}

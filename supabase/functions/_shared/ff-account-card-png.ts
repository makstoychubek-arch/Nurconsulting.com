// Карточка ФФ по одному кабинету для Telegram в стиле «Минимализм»: сумма за день крупно, три строки (отправки, хранение, штраф),
// внизу общий долг. Без цветных заливок, кроме таблетки штрафа (зелёная: он уменьшает долг).

import { createCanvas, loadImage } from 'https://deno.land/x/canvas@v1.4.2/mod.ts';
import { ensureFonts, fitText, NR_LOGO_PNG_B64, reportFonts, roundRect, textW } from './ab-test-report-png.ts';

export interface FfAccountCard {
    cabinet: string; dateLabel: string; dayTotal: number;
    shipLine: string; storageLine: string; penalty: number;
    debt: number; sinceLabel: string; note: string;
}

const grp = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
// textAlign right не работает, жирный measureText занижает ширину примерно на 12%
// deno-lint-ignore no-explicit-any
const rw = (ctx: any, t: string, bold = true): number => textW(ctx, t, bold) * (bold ? 1.12 : 1);
const numW = (t: string, px: number): number =>
    [...t].reduce((w, ch) => w + (/\d/.test(ch) ? 0.696 : ch === ' ' || ch === ' ' ? 0.348 : 0.35) * px, 0);

export async function renderFfAccountPng(inp: FfAccountCard): Promise<Uint8Array> {
    await ensureFonts();
    const S = 2, width = 580, pad = 20, logoS = 36, headerH = logoS + 16, inner = 26;
    const cardW = width - pad * 2, heroH = 112, rowH = 46, debtH = 78, footH = 44;
    const cardH = inner + heroH + rowH * 3 + debtH + footH;
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

    const lx = pad, ly = pad;
    roundRect(ctx, lx, ly, logoS, logoS, logoS * 120 / 512);
    ctx.fillStyle = '#FFFFFF'; ctx.fill();
    const logoImg = await loadImage(Uint8Array.from(atob(NR_LOGO_PNG_B64), (c) => c.charCodeAt(0)));
    ctx.drawImage(logoImg as never, lx, ly, logoS, logoS);
    roundRect(ctx, lx, ly, logoS, logoS, logoS * 120 / 512);
    ctx.strokeStyle = '#0B0B0B'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#0B0B0B'; ctx.font = 'bold 16px DejaVu';
    ctx.fillText('/ ФФ', lx + logoS + 10, ly + logoS / 2 + 5.5);
    ctx.fillStyle = '#6B6B6B'; ctx.font = 'bold 12px DejaVu';
    const dl = inp.dateLabel.toUpperCase();
    ctx.fillText(dl, width - pad - rw(ctx, dl), ly + logoS / 2 + 4.5);

    const cardX = pad, cardY = pad + headerH;
    roundRect(ctx, cardX, cardY, cardW, cardH, 26);
    ctx.fillStyle = '#FFFFFF'; ctx.fill();
    ctx.strokeStyle = '#0B0B0B'; ctx.lineWidth = 1.5; ctx.stroke();
    const L = cardX + inner, R = cardX + cardW - inner, innerW = cardW - inner * 2;

    let y = cardY + inner;
    ctx.fillStyle = '#6B6B6B'; ctx.font = 'bold 11px DejaVu';
    ctx.fillText(fitText(ctx, inp.cabinet.toUpperCase(), innerW), L, y + 10);
    ctx.fillStyle = '#0B0B0B'; ctx.font = 'bold 54px DejaVu';
    const day = grp(inp.dayTotal);
    ctx.fillText(day, L, y + 70);
    ctx.fillStyle = '#6B6B6B'; ctx.font = 'bold 16px DejaVu';
    ctx.fillText('₽ за день', L + numW(day, 54) + 12, y + 70);

    // Три строки
    const top = cardY + inner + heroH - 14;
    ctx.fillStyle = '#0B0B0B'; ctx.fillRect(L, top, innerW, 1);
    const pen = inp.penalty;
    const rows: Array<[string, string, boolean]> = [
        ['ОТПРАВКИ', inp.shipLine, false],
        ['ХРАНЕНИЕ', inp.storageLine, false],
        ['ШТРАФ С СЧЁТА ЗА ВЧЕРА', pen > 0 ? '−' + grp(pen) + ' ₽' : '0 ₽', pen > 0],
    ];
    rows.forEach(([label, val, pill], i) => {
        const ry = top + i * rowH;
        if (i) { ctx.fillStyle = '#E6E6E6'; ctx.fillRect(L, ry, innerW, 1); }
        ctx.fillStyle = '#6B6B6B'; ctx.font = 'bold 10px DejaVu';
        ctx.fillText(label, L, ry + 28);
        ctx.font = 'bold 15px DejaVu';
        const vw = rw(ctx, val);
        if (pill) {
            roundRect(ctx, R - vw - 24, ry + 10, vw + 24, 26, 13);
            ctx.fillStyle = '#E2F6E8'; ctx.fill();
            ctx.fillStyle = '#1B7A3A'; ctx.fillText(val, R - vw - 12, ry + 28);
        } else {
            ctx.fillStyle = '#0B0B0B'; ctx.fillText(val, R - vw * 0.94, ry + 28);
        }
    });

    // Общий долг
    const dy = top + rowH * 3;
    ctx.fillStyle = '#0B0B0B'; ctx.fillRect(L, dy, innerW, 1);
    ctx.fillStyle = '#6B6B6B'; ctx.font = 'bold 11px DejaVu';
    ctx.fillText('ОБЩИЙ ДОЛГ ' + inp.sinceLabel.toUpperCase(), L, dy + 44);
    const debt = grp(inp.debt) + ' ₽';
    ctx.fillStyle = '#0B0B0B'; ctx.font = 'bold 26px DejaVu';
    ctx.fillText(debt, R - (numW(grp(inp.debt), 26) + 26 * 0.9), dy + 48);

    ctx.fillStyle = '#9A9A9A'; ctx.font = '11px DejaVu';
    ctx.fillText(fitText(ctx, inp.note, innerW), L, cardY + cardH - 18);
    return canvas.toBuffer('image/png');
}

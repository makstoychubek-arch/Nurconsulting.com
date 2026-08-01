// Программная PNG-сводка FBS (не AI): список моделей + итог.

import { createCanvas } from 'https://deno.land/x/canvas@v1.4.2/mod.ts';

export type FbsModelLine = {
    name: string;
    qty: number;
};

const FONT_REG =
    'https://cdn.jsdelivr.net/gh/dejavu-fonts/dejavu-fonts@version_2_37/ttf/DejaVuSans.ttf';
const FONT_BOLD =
    'https://cdn.jsdelivr.net/gh/dejavu-fonts/dejavu-fonts@version_2_37/ttf/DejaVuSans-Bold.ttf';

let fontRegular: Uint8Array | null = null;
let fontBold: Uint8Array | null = null;

async function ensureFonts() {
    if (fontRegular && fontBold) return;
    const [r, b] = await Promise.all([
        fetch(FONT_REG).then((x) => x.arrayBuffer()),
        fetch(FONT_BOLD).then((x) => x.arrayBuffer()),
    ]);
    fontRegular = new Uint8Array(r);
    fontBold = new Uint8Array(b);
}

export function emojiForModel(name: string): string {
    const t = name.toLowerCase();
    if (/бордов|marsala|марсал|винн/.test(t)) return '🍷';
    if (/красн|алый|scarlet/.test(t)) return '🔴';
    if (/коричнев|капучино|шоколад|мокко/.test(t)) return '🟤';
    if (/чёрн|черн|black/.test(t)) return '⚫';
    if (/бел(ый|ая|ое)|white/.test(t)) return '⚪';
    if (/бежев|cream|крем/.test(t)) return '🟨';
    if (/син(ий|яя|ее)|голуб|navy/.test(t)) return '🔵';
    if (/зелён|зелен|хаки|olive/.test(t)) return '🟢';
    if (/роз(ов|овый)|pink/.test(t)) return '🩷';
    if (/сер(ый|ая|ое)|gray|grey/.test(t)) return '⬜';
    if (/фиолет|lilac|лаванд/.test(t)) return '🟣';
    if (/жёлт|желт|горчиц/.test(t)) return '🟡';
    return '📦';
}

export function aggregateByModel(
    rows: Array<{ productName: string; qty: number }>,
): FbsModelLine[] {
    const map = new Map<string, number>();
    for (const r of rows) {
        const name = (r.productName || 'Без названия').trim();
        map.set(name, (map.get(name) || 0) + Number(r.qty || 0));
    }
    return [...map.entries()]
        .map(([name, qty]) => ({ name, qty }))
        .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name, 'ru'));
}

export async function renderFbsSummaryImage(
    reportDatePretty: string,
    models: FbsModelLine[],
): Promise<Uint8Array> {
    await ensureFonts();
    const S = 2;
    const width = 800;
    const pad = 36;
    const titleH = 72;
    const lineH = 44;
    const footerH = 56;
    const emptyExtra = models.length ? 0 : 40;
    const height = pad * 2 + titleH + Math.max(models.length, 1) * lineH + footerH + emptyExtra;

    const canvas = createCanvas(width * S, height * S);
    canvas.loadFont(fontRegular!, { family: 'DejaVu' });
    canvas.loadFont(fontBold!, { family: 'DejaVu', weight: 'bold' });
    const ctx = canvas.getContext('2d');
    ctx.scale(S, S);

    // Фон: мягкий градиент
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#f7faf7');
    grad.addColorStop(1, '#eef3ee');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#1a2e1a';
    ctx.font = 'bold 28px DejaVu';
    ctx.textBaseline = 'top';
    ctx.fillText(`📦 Заказы FBS за ${reportDatePretty}`, pad, pad);

    ctx.fillStyle = '#5a6b5a';
    ctx.font = '16px DejaVu';
    ctx.fillText('Сводка по моделям · детали в Excel', pad, pad + 40);

    let y = pad + titleH;
    const total = models.reduce((a, m) => a + m.qty, 0);

    if (!models.length) {
        ctx.fillStyle = '#445544';
        ctx.font = '20px DejaVu';
        ctx.fillText('Заказов за сутки не было', pad, y + 8);
        y += lineH;
    } else {
        models.forEach((m, i) => {
            if (i % 2 === 0) {
                ctx.fillStyle = 'rgba(255,255,255,0.65)';
                ctx.fillRect(pad - 8, y - 4, width - pad * 2 + 16, lineH);
            }
            const emoji = emojiForModel(m.name);
            ctx.font = '22px DejaVu';
            ctx.fillStyle = '#222';
            const label = `${emoji}  ${fit(ctx, m.name, width - pad * 2 - 120)}`;
            ctx.fillText(label, pad, y + 8);
            ctx.font = 'bold 22px DejaVu';
            ctx.fillStyle = '#143d14';
            const qty = `${m.qty} шт`;
            const tw = ctx.measureText(qty).width;
            ctx.fillText(qty, width - pad - tw, y + 8);
            y += lineH;
        });
    }

    y += 8;
    ctx.fillStyle = '#c9e7c5';
    ctx.fillRect(pad - 8, y, width - pad * 2 + 16, footerH - 8);
    ctx.fillStyle = '#143d14';
    ctx.font = 'bold 24px DejaVu';
    ctx.fillText(`Итого: ${total} шт`, pad, y + 14);

    return canvas.toBuffer('image/png');
}

// deno-lint-ignore no-explicit-any
function fit(ctx: any, text: string, maxW: number): string {
    if (ctx.measureText(text).width <= maxW) return text;
    let s = text;
    while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    return s + '…';
}

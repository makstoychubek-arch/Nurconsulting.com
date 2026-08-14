// Программная PNG-сводка FBS (не AI): секции по кабинетам + модели + итог.

import { createCanvas } from 'https://deno.land/x/canvas@v1.4.2/mod.ts';
import {
    karinaFbsEmptyLine,
    karinaFbsImageSubtitle,
    karinaFbsImageTitle,
} from './karina-voice.ts';
import { fbsCabinetLabel } from './fbs-cabinet-labels.ts';

export type FbsModelLine = {
    name: string;
    qty: number;
};

export type FbsCabinetSection = {
    cabinet: string;
    models: FbsModelLine[];
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

/** Группировка строк по кабинету → модели. */
export function aggregateByCabinet(
    rows: Array<{ cabinet: string; productName: string; qty: number }>,
    cabinetOrder?: string[],
): FbsCabinetSection[] {
    const raw = new Map<string, Array<{ productName: string; qty: number }>>();
    for (const r of rows) {
        const cab = r.cabinet || '—';
        if (!raw.has(cab)) raw.set(cab, []);
        raw.get(cab)!.push({ productName: r.productName, qty: r.qty });
    }

    const names = cabinetOrder?.length
        ? [...cabinetOrder.filter((n) => raw.has(n)), ...[...raw.keys()].filter((n) => !cabinetOrder.includes(n))]
        : [...raw.keys()].sort((a, b) =>
            fbsCabinetLabel(a).localeCompare(fbsCabinetLabel(b), 'ru')
        );

    return names.map((cabinet) => {
        const models = aggregateByModel(raw.get(cabinet) || []);
        const qty = models.reduce((a, m) => a + m.qty, 0);
        return { cabinet, models, qty };
    });
}

export async function renderFbsSummaryImage(
    reportDatePretty: string,
    modelsOrSections: FbsModelLine[] | FbsCabinetSection[],
): Promise<Uint8Array> {
    await ensureFonts();

    const sections: FbsCabinetSection[] = isCabinetSections(modelsOrSections)
        ? modelsOrSections
        : [{ cabinet: '', models: modelsOrSections, qty: modelsOrSections.reduce((a, m) => a + m.qty, 0) }];

    const S = 2;
    const width = 800;
    const pad = 36;
    const titleH = 72;
    const lineH = 44;
    const sectionH = 40;
    const footerH = 56;

    let bodyLines = 0;
    for (const sec of sections) {
        if (sec.cabinet) bodyLines += 1; // заголовок кабинета
        bodyLines += Math.max(sec.models.length, 1);
    }
    const multi = sections.some((s) => s.cabinet);
    const height = pad * 2 + titleH +
        (multi ? sections.length * sectionH : 0) +
        Math.max(bodyLines - (multi ? sections.length : 0), 1) * lineH +
        (multi ? 0 : 0) +
        footerH +
        (bodyLines ? 0 : 40);

    // пересчёт высоты точнее
    let contentH = 0;
    for (const sec of sections) {
        if (sec.cabinet) contentH += sectionH;
        contentH += Math.max(sec.models.length, sec.cabinet ? 0 : 1) * lineH;
        if (sec.cabinet && !sec.models.length) contentH += lineH;
    }
    if (!sections.length) contentH = lineH + 40;
    const finalH = pad * 2 + titleH + contentH + footerH;

    const canvas = createCanvas(width * S, finalH * S);
    canvas.loadFont(fontRegular!, { family: 'DejaVu' });
    canvas.loadFont(fontBold!, { family: 'DejaVu', weight: 'bold' });
    const ctx = canvas.getContext('2d');
    ctx.scale(S, S);

    const grad = ctx.createLinearGradient(0, 0, 0, finalH);
    grad.addColorStop(0, '#f7faf7');
    grad.addColorStop(1, '#eef3ee');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, finalH);

    ctx.fillStyle = '#1a2e1a';
    ctx.font = 'bold 28px DejaVu';
    ctx.textBaseline = 'top';
    ctx.fillText(karinaFbsImageTitle(reportDatePretty), pad, pad);

    ctx.fillStyle = '#5a6b5a';
    ctx.font = '16px DejaVu';
    ctx.fillText(
        multi ? 'Сводка по кабинетам и моделям. Детали — в Excel.' : karinaFbsImageSubtitle(),
        pad,
        pad + 40,
    );

    let y = pad + titleH;
    const total = sections.reduce((a, s) => a + s.qty, 0);
    let zebra = 0;

    if (!sections.length || (sections.length === 1 && !sections[0].models.length && !sections[0].cabinet)) {
        ctx.fillStyle = '#445544';
        ctx.font = '20px DejaVu';
        ctx.fillText(karinaFbsEmptyLine(), pad, y + 8);
        y += lineH;
    } else {
        for (const sec of sections) {
            if (sec.cabinet) {
                const label = fbsCabinetLabel(sec.cabinet);
                ctx.fillStyle = '#1a2e1a';
                ctx.font = 'bold 20px DejaVu';
                ctx.fillText(label, pad, y + 8);
                ctx.font = 'bold 18px DejaVu';
                ctx.fillStyle = '#143d14';
                const q = `${sec.qty} шт`;
                const tw = ctx.measureText(q).width;
                ctx.fillText(q, width - pad - tw, y + 10);
                y += sectionH;
            }

            if (!sec.models.length) {
                ctx.fillStyle = '#667766';
                ctx.font = '18px DejaVu';
                ctx.fillText('нет заказов', pad + (sec.cabinet ? 12 : 0), y + 10);
                y += lineH;
                continue;
            }

            for (const m of sec.models) {
                if (zebra % 2 === 0) {
                    ctx.fillStyle = 'rgba(255,255,255,0.65)';
                    ctx.fillRect(pad - 8, y - 4, width - pad * 2 + 16, lineH);
                }
                zebra++;
                const emoji = emojiForModel(m.name);
                const indent = sec.cabinet ? 12 : 0;
                ctx.font = '22px DejaVu';
                ctx.fillStyle = '#222';
                const label = `${emoji}  ${fit(ctx, m.name, width - pad * 2 - 120 - indent)}`;
                ctx.fillText(label, pad + indent, y + 8);
                ctx.font = 'bold 22px DejaVu';
                ctx.fillStyle = '#143d14';
                const qty = `${m.qty} шт`;
                const tw = ctx.measureText(qty).width;
                ctx.fillText(qty, width - pad - tw, y + 8);
                y += lineH;
            }
        }
    }

    y += 8;
    ctx.fillStyle = '#c9e7c5';
    ctx.fillRect(pad - 8, y, width - pad * 2 + 16, footerH - 8);
    ctx.fillStyle = '#143d14';
    ctx.font = 'bold 24px DejaVu';
    ctx.fillText(`Итого: ${total} шт`, pad, y + 14);

    return canvas.toBuffer('image/png');
}

function isCabinetSections(
    v: FbsModelLine[] | FbsCabinetSection[],
): v is FbsCabinetSection[] {
    if (!v.length) return false;
    return 'models' in v[0] && 'cabinet' in v[0];
}

// deno-lint-ignore no-explicit-any
function fit(ctx: any, text: string, maxW: number): string {
    if (ctx.measureText(text).width <= maxW) return text;
    let s = text;
    while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    return s + '…';
}

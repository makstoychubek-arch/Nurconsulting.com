/**
 * Satori-шаблоны карусели 1080×1350 из полей карточки WB.
 * HTML — только flex + inline styles (подмножество Satori).
 * Deno-рендер рисует тот же макет на canvas (content-carousel-render.ts).
 */

import { SLIDE_H, SLIDE_W, type SlideKind, type SlidePlan } from './content-carousel.ts';

export const SLIDE_THEME = {
    paper: '#F4F6F8',
    card: '#FFFFFF',
    ink: '#1A2332',
    muted: '#667085',
    accent: '#066FD1',
    accentSoft: '#E8F1FB',
    dark: '#111318',
    line: '#E4E7EC',
    photoH: 860,
    cardOverlap: 40,
    radius: 32,
    pad: 48,
} as const;

export type SlideFact = { label: string; value: string };

export function formatSlidePrice(price: number | null | undefined): string {
    if (price == null || !Number.isFinite(Number(price))) return '';
    return `${Math.round(Number(price)).toLocaleString('ru-RU')} ₽`;
}

export function clipFact(s: unknown, max = 90): string {
    const t = String(s || '').replace(/\s+/g, ' ').trim();
    if (!t) return '';
    if (t.length <= max) return t;
    return t.slice(0, Math.max(1, max - 1)).trim() + '…';
}

export function infoFactRows(plan: SlidePlan): SlideFact[] {
    const rows: SlideFact[] = [];
    if (plan.nmId) rows.push({ label: 'Артикул', value: String(plan.nmId) });
    if (plan.vendorCode) rows.push({ label: 'Код', value: clipFact(plan.vendorCode, 42) });
    const price = formatSlidePrice(plan.price);
    if (price) rows.push({ label: 'Цена', value: price });
    if (plan.brand) rows.push({ label: 'Бренд', value: clipFact(plan.brand, 42) });
    if (plan.composition) rows.push({ label: 'Состав', value: clipFact(plan.composition, 160) });
    return rows;
}

function esc(s: unknown): string {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function frame(inner: string, bg: string): string {
    return `<div style="display:flex;flex-direction:column;width:${SLIDE_W}px;height:${SLIDE_H}px;background:${bg};overflow:hidden">${inner}</div>`;
}

function photoBlock(url: string, h: number): string {
    if (!url) {
        return `<div style="display:flex;width:${SLIDE_W}px;height:${h}px;background:#1A1A1A;align-items:center;justify-content:center"><div style="color:#FFFFFF;font-size:36px;font-weight:700">Нет фото</div></div>`;
    }
    return `<img src="${esc(url)}" width="${SLIDE_W}" height="${h}" style="width:${SLIDE_W}px;height:${h}px;object-fit:cover"/>`;
}

function captionCard(plan: SlidePlan): string {
    const brand = clipFact(plan.brand, 28);
    const head = clipFact(plan.headline || plan.title, 42);
    const line = clipFact(plan.line, 90);
    const price = formatSlidePrice(plan.price);
    return `<div style="display:flex;flex-direction:column;justify-content:center;background:${SLIDE_THEME.card};padding:36px ${SLIDE_THEME.pad}px 44px;width:${SLIDE_W}px">
        ${brand ? `<div style="display:flex;font-size:22px;font-weight:700;color:${SLIDE_THEME.accent};margin-bottom:10px">${esc(brand)}</div>` : ''}
        ${head ? `<div style="display:flex;font-size:44px;font-weight:800;color:${SLIDE_THEME.ink};line-height:1.15">${esc(head)}</div>` : ''}
        ${line ? `<div style="display:flex;font-size:26px;color:${SLIDE_THEME.muted};margin-top:12px;line-height:1.35">${esc(line)}</div>` : ''}
        ${price ? `<div style="display:flex;margin-top:22px;background:${SLIDE_THEME.accent};color:#FFFFFF;font-size:26px;font-weight:700;padding:10px 22px;border-radius:999px">${esc(price)}</div>` : ''}
    </div>`;
}

function coverHtml(plan: SlidePlan): string {
    return frame(
        `${photoBlock(plan.photos[0] || '', SLIDE_THEME.photoH)}${captionCard(plan)}`,
        SLIDE_THEME.dark,
    );
}

function collageHtml(plan: SlidePlan): string {
    const cells = [0, 1, 2, 3].map((i) => {
        const url = plan.photos[i] || '';
        const img = url
            ? `<img src="${esc(url)}" width="480" height="610" style="width:480px;height:610px;object-fit:cover;border-radius:20px"/>`
            : `<div style="display:flex;width:480px;height:610px;background:#E8E2D6;border-radius:20px"></div>`;
        return `<div style="display:flex;width:480px;height:610px;margin:0 14px 14px 0;overflow:hidden;border-radius:20px">${img}</div>`;
    });
    return frame(
        `<div style="display:flex;flex-direction:column;padding:28px">
            <div style="display:flex;flex-direction:row">${cells[0]}${cells[1]}</div>
            <div style="display:flex;flex-direction:row">${cells[2]}${cells[3]}</div>
        </div>`,
        SLIDE_THEME.paper,
    );
}

function infoHtml(plan: SlidePlan): string {
    const title = clipFact(plan.title || 'Товар', 64);
    const rows = infoFactRows(plan).map((r) =>
        `<div style="display:flex;flex-direction:row;justify-content:space-between;padding:18px 0;border-bottom:1px solid ${SLIDE_THEME.line}">
            <div style="display:flex;font-size:24px;color:${SLIDE_THEME.muted};width:220px">${esc(r.label)}</div>
            <div style="display:flex;flex:1;font-size:26px;font-weight:600;color:${SLIDE_THEME.ink}">${esc(r.value)}</div>
        </div>`
    ).join('');
    return frame(
        `<div style="display:flex;flex-direction:column;padding:0;width:${SLIDE_W}px;height:${SLIDE_H}px">
            <div style="display:flex;flex-direction:column;background:${SLIDE_THEME.accent};padding:48px ${SLIDE_THEME.pad}px 36px">
                <div style="display:flex;font-size:20px;font-weight:700;color:#FFFFFF;opacity:0.85">Карточка товара</div>
                <div style="display:flex;font-size:42px;font-weight:800;color:#FFFFFF;margin-top:10px;line-height:1.2">${esc(title)}</div>
            </div>
            <div style="display:flex;flex-direction:column;padding:28px ${SLIDE_THEME.pad}px 48px;background:${SLIDE_THEME.card};flex:1">${rows}</div>
        </div>`,
        SLIDE_THEME.card,
    );
}

function brandHtml(plan: SlidePlan): string {
    const brand = clipFact(plan.brand || 'NR', 28);
    const nm = plan.nmId ? `nmId ${plan.nmId}` : 'контент-завод';
    return frame(
        `<div style="display:flex;flex-direction:column;width:${SLIDE_W}px;height:${SLIDE_H}px;align-items:center;justify-content:center;background:${SLIDE_THEME.dark}">
            <div style="display:flex;font-size:22px;font-weight:700;color:${SLIDE_THEME.accent};letter-spacing:4px">NR SPACE</div>
            <div style="display:flex;font-size:72px;font-weight:800;color:#FFFFFF;margin-top:18px">${esc(brand)}</div>
            <div style="display:flex;font-size:24px;color:#A3A3A3;margin-top:20px">${esc(nm)}</div>
        </div>`,
        SLIDE_THEME.dark,
    );
}

export function slideSatoriHtml(plan: SlidePlan): string {
    if (plan.kind === 'cover' || plan.kind === 'photo') return coverHtml(plan);
    if (plan.kind === 'collage') return collageHtml(plan);
    if (plan.kind === 'info') return infoHtml(plan);
    return brandHtml(plan);
}

export function slidesSatoriHtml(plans: SlidePlan[]): string[] {
    return plans.map(slideSatoriHtml);
}

/** Satori не умеет CSS Grid и внешние stylesheet — шаблон должен быть чистым. */
export function isSatoriSafeHtml(html: string): boolean {
    const t = String(html || '');
    if (!t.includes('display:flex')) return false;
    if (/style\s*=\s*["'][^"']*\bgrid\b/i.test(t)) return false;
    if (/<style[\s>]/i.test(t)) return false;
    if (!t.includes(`${SLIDE_W}px`) || !t.includes(`${SLIDE_H}px`)) return false;
    return true;
}

export function templateKinds(): SlideKind[] {
    return ['cover', 'collage', 'photo', 'info', 'brand'];
}

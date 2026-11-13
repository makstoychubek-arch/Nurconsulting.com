// «Сравнение контента → Медиа»: общая логика генерации кадров карточки. Чистые функции без Deno-API, тестируются в node.
// Задание на кадры людям не показывается: его строит сайт и отдаёт генератору вместе с оригинальным фото товара.

export const SLIDE_TITLES = ['Обложка', 'Главная выгода', 'Посадка и крой', 'Размеры и замеры', 'Состав и ткань', 'Детали', 'С чем носить', 'Доверие и отзывы'];
export const PRICE_SOM = 1000;
export type JobStatus = 'awaiting_payment' | 'paid' | 'generating' | 'ready' | 'failed' | 'sent';
export interface Slide { n: number; status: 'pending' | 'ready' | 'failed'; path?: string; error?: string }

// Какие кадры чинят какой шаг воронки (индексы с нуля)
export const FOCUS: Record<string, number[]> = { ctr: [0], cart: [1, 2, 3, 4], order: [5, 6, 7], buyout: [3, 7] };

export function emptySlides(): Slide[] { return SLIDE_TITLES.map((_, i) => ({ n: i + 1, status: 'pending' as const })); }

export interface BriefInput { name: string; keep?: string; focus?: string | null; style?: string }

/** Верхние слова из «Итог для описания» СЕО: «Супер:» (запросы) и «Признаки с фото:». */
export function seoHints(keep: string | undefined): { kw: string; feats: string[] } {
    const t = String(keep || '');
    const kw = ((/Супер:\s*([^\n]+)/.exec(t) || [])[1] || '').split(',').map((x) => x.trim()).filter(Boolean)[0] || '';
    const feats = ((/Признаки с фото:\s*([^\n]+)/.exec(t) || [])[1] || '').split(',').map((x) => x.trim()).filter(Boolean).slice(0, 3);
    return { kw, feats };
}

/** Задание для одного кадра. Оригинальное фото товара передаётся генератору отдельно как картинка-вход. */
export function slidePrompt(i: number, b: BriefInput): string {
    const { kw, feats } = seoHints(b.keep);
    const hot = !!(b.focus && (FOCUS[b.focus] || []).includes(i));
    const base = [
        `Обложка карточки Wildberries. Крупный первый кадр: этот товар на модели в движении, чистый светлый фон, название «${kw || b.name}» крупно, одна главная выгода.`,
        `Кадр «Главная выгода»: одна строка выгоды и три иконки преимуществ${feats.length ? ' (' + feats.join(', ') + ')' : ''}.`,
        'Кадр «Посадка и крой»: товар спереди, сбоку и сзади, подписи длины, рукава и линии плеча.',
        'Кадр «Размеры и замеры»: таблица размеров и замеров, рост и параметры модели, подсказка «как выбрать размер».',
        'Кадр «Состав и ткань»: крупный план материала, состав в процентах, уход за вещью.',
        'Кадр «Детали»: застёжка, манжеты, швы и декор, по одной подписи на деталь.',
        'Кадр «С чем носить»: два-три образа с этим товаром.',
        'Кадр «Доверие»: рейтинг, отзывы с фото, страна производства, «как на фото».',
    ][i] || '';
    return [
        base,
        'Используй товар с приложенного оригинального фото: цвет, фасон и детали не менять.',
        'Формат вертикальный 3:4 (900×1200). Текст на русском, крупный, без ошибок, читаемый на телефоне.',
        b.style || 'Единый стиль карточки: чистый светлый фон, крупная плотная типографика, чёрный текст, минимум цветов.',
        hot ? 'Это приоритетный кадр: он должен сильнее всего убеждать покупателя.' : '',
    ].filter(Boolean).join('\n');
}

/** Достаёт картинку из ответа Gemini generateContent: {candidates:[{content:{parts:[{inlineData:{mimeType,data}}]}}]}. */
export function parseGeminiImage(resp: unknown): { mime: string; b64: string } | null {
    const parts = ((resp as any)?.candidates?.[0]?.content?.parts) || [];
    for (const p of parts) {
        const d = p?.inlineData || p?.inline_data;
        if (d?.data) return { mime: String(d.mimeType || d.mime_type || 'image/png'), b64: String(d.data) };
    }
    return null;
}

/** Итоговый статус задачи по состоянию кадров. */
export function jobStatusFromSlides(slides: Slide[]): JobStatus {
    if (!slides.length) return 'paid';
    if (slides.every((s) => s.status === 'ready')) return 'ready';
    if (slides.some((s) => s.status === 'pending')) return 'generating';
    return 'failed';   // ни одного ожидающего, но не все готовы
}

export function extFromMime(mime: string): string { return /webp/i.test(mime) ? 'webp' : /jpe?g/i.test(mime) ? 'jpg' : 'png'; }

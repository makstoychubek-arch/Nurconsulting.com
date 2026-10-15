/** Окна показа вариантов А/Б теста по журналу ротаций. Чистые функции. */

export type RotationEntry = { variant_label: string; created_at: string; action?: string | null };
export type VariantWindow = { label: string; start: Date; end: Date };

/**
 * Окно варианта идёт от его записи до следующей записи журнала. Запись «stop» закрывает окно и
 * сама окна не открывает (тест остановлен, фото больше не меняется). Хвост журнала закрывается
 * в endAt: у завершённого теста это момент остановки, у активного — «сейчас».
 */
export function buildVariantWindows(log: RotationEntry[], endAt?: Date): VariantWindow[] {
    const cap = endAt || new Date();
    const out: VariantWindow[] = [];
    log.forEach((entry, i) => {
        if (entry.action === 'stop') return;
        const start = new Date(entry.created_at);
        const nextAt = i + 1 < log.length ? new Date(log[i + 1].created_at) : cap;
        const end = nextAt.getTime() > cap.getTime() ? cap : nextAt;
        if (end.getTime() > start.getTime()) out.push({ label: entry.variant_label, start, end });
    });
    return out;
}

/** WB отдаёт даты заказов по Москве без указания пояса: «2026-10-15T00:33:54» значит 00:33 МСК (UTC+3). */
export function parseWbMoscowDate(raw: unknown): Date | null {
    const s = String(raw || '').trim();
    if (!s) return null;
    const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(s);
    const d = new Date(hasZone ? s : s + '+03:00');
    return Number.isNaN(d.getTime()) ? null : d;
}

/** Какому варианту принадлежит момент времени (по окнам). */
export function labelAt(windows: VariantWindow[], ts: Date): string | null {
    for (let i = windows.length - 1; i >= 0; i--) {
        if (ts >= windows[i].start && ts < windows[i].end) return windows[i].label;
    }
    return null;
}

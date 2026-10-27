// Кампании «Полки»: чистые расчёты (без сети), проверяются тестом.

export const SHELVES_RE = /полк/i;

export function isShelvesName(name: unknown): boolean {
    return SHELVES_RE.test(String(name ?? ''));
}

export function isDue(lastRunAt: string | null | undefined, intervalMin: number, now: number): boolean {
    if (!lastRunAt) return true;
    const t = Date.parse(lastRunAt);
    if (!Number.isFinite(t)) return true;
    // Небольшой допуск: cron приходит раз в 5 минут и может сдвигаться на секунды.
    return now - t >= Math.max(1, intervalMin) * 60_000 - 20_000;
}

export function isDryRun(dryRunUntil: string | null | undefined, now: number): boolean {
    if (!dryRunUntil) return false;
    const t = Date.parse(dryRunUntil);
    return Number.isFinite(t) && t > now;
}

/** Активные фразы кампании, которые нужно исключить: не в минусах, не в списке «не исключать». */
export function phrasesToExclude(active: string[], excluded: string[], keep: string[], alreadyMinus: string[]): string[] {
    const skip = new Set<string>();
    for (const q of [...excluded, ...keep, ...alreadyMinus]) skip.add(String(q || '').trim().toLowerCase());
    const seen = new Set<string>();
    const out: string[] = [];
    for (const q of active) {
        const raw = String(q || '').trim();
        const low = raw.toLowerCase();
        if (!raw || skip.has(low) || seen.has(low)) continue;
        seen.add(low);
        out.push(raw);
    }
    return out;
}

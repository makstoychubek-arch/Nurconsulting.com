// «Сайт жив»: решение, когда слать тревогу. Одна неудачная проверка может быть случайностью,
// поэтому тревога после двух подряд; о восстановлении пишем один раз.

export type UptimeState = { status: 'up' | 'down'; failures: number; since: string };
export type Check = { name: string; ok: boolean; detail: string };
export type Verdict = { next: UptimeState; alert: 'down' | 'recovered' | null };

export const FAILS_BEFORE_ALERT = 2;

export function decide(prev: UptimeState, checks: Check[], now: Date): Verdict {
    const ok = checks.every((c) => c.ok);
    if (ok) {
        const wasDown = prev.status === 'down';
        return { next: { status: 'up', failures: 0, since: wasDown ? now.toISOString() : prev.since }, alert: wasDown ? 'recovered' : null };
    }
    const failures = prev.failures + 1;
    if (prev.status === 'down') return { next: { status: 'down', failures, since: prev.since }, alert: null };
    if (failures >= FAILS_BEFORE_ALERT) return { next: { status: 'down', failures, since: now.toISOString() }, alert: 'down' };
    return { next: { status: 'up', failures, since: prev.since }, alert: null };
}

export function alertText(kind: 'down' | 'recovered', checks: Check[], since: string): string {
    if (kind === 'recovered') return '✅ NR Space снова работает.';
    const bad = checks.filter((c) => !c.ok).map((c) => `• ${c.name}: ${c.detail}`).join('\n');
    return `🔴 NR Space недоступен (с ${since.slice(11, 16)} UTC)\n${bad}`;
}

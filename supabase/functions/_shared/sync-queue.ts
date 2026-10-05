// Решение по задаче очереди загрузки истории: что делать после ответа rnp-finance-sync.
// Чистые функции без сети — чтобы поведение проверялось тестом (см. sync-queue_test.mts).

export type SyncPhase = 'sync' | 'storage_status';

export type JobIn = { attempts: number; phase: SyncPhase };

/** Подмножество ответа rnp-finance-sync по одному кабинету. */
export type SyncResult = {
    status?: string;
    error?: string;
    storage_pending?: boolean;
    finance?: { rows?: number; skipped?: boolean; reason?: string; cached?: boolean };
    storage?: { rows?: number; skipped?: boolean; reason?: string; pending?: boolean; cached?: boolean };
} | null | undefined;

export type JobOutcome =
    | { status: 'done'; phase: SyncPhase; rows: number }
    | { status: 'queued'; phase: SyncPhase; delaySec: number; error: string | null }
    | { status: 'error'; phase: SyncPhase; error: string };

/** После скольких запусков задача считается неудачной. Опрос хранения — отдельный лимит. */
export const MAX_FAIL_ATTEMPTS = 6;
export const MAX_WAIT_ATTEMPTS = 24;

function retryDelay(attempts: number): number {
    return Math.min(600, 60 * Math.max(1, attempts));
}

export function decideOutcome(job: JobIn, res: SyncResult, callError?: string): JobOutcome {
    const fail = (why: string): JobOutcome => job.attempts >= MAX_FAIL_ATTEMPTS
        ? { status: 'error', phase: job.phase, error: why }
        : { status: 'queued', phase: job.phase, delaySec: retryDelay(job.attempts), error: why };

    if (callError) return fail(callError);
    if (!res) return fail('empty_response');
    if (res.status === 'error') return fail(String(res.error || 'sync_error').slice(0, 200));

    // Лимит WB «1 запрос в минуту на токен» — не ошибка, просто ждём.
    if (res.finance?.skipped && res.finance.reason === 'rate_limit') {
        return job.attempts >= MAX_WAIT_ATTEMPTS
            ? { status: 'error', phase: job.phase, error: 'finance_rate_limit' }
            : { status: 'queued', phase: job.phase, delaySec: 90, error: null };
    }
    if (res.finance?.skipped) return fail(`finance_${res.finance.reason || 'skipped'}`);

    if (res.status === 'storage_pending' || res.storage_pending || res.storage?.pending) {
        return job.attempts >= MAX_WAIT_ATTEMPTS
            ? { status: 'error', phase: 'storage_status', error: 'storage_timeout' }
            : { status: 'queued', phase: 'storage_status', delaySec: 20, error: null };
    }
    if (res.storage?.skipped) {
        if (res.storage.reason === 'rate_limit') {
            return job.attempts >= MAX_WAIT_ATTEMPTS
                ? { status: 'error', phase: 'sync', error: 'storage_rate_limit' }
                : { status: 'queued', phase: 'sync', delaySec: 90, error: null };
        }
        return fail(`storage_${res.storage.reason || 'skipped'}`);
    }

    return { status: 'done', phase: job.phase, rows: Number(res.finance?.rows || 0) + Number(res.storage?.rows || 0) };
}

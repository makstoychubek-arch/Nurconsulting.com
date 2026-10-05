import assert from 'node:assert/strict';
import { decideOutcome, MAX_FAIL_ATTEMPTS, MAX_WAIT_ATTEMPTS } from './sync-queue.ts';

const job = (attempts: number, phase: 'sync' | 'storage_status' = 'sync') => ({ attempts, phase });

// Всё загрузилось: сумма строк финотчёта и хранения.
assert.deepEqual(
    decideOutcome(job(1), { status: 'done', finance: { rows: 120 }, storage: { rows: 30 } }),
    { status: 'done', phase: 'sync', rows: 150 },
);

// Хранение у WB ещё считается: ждём и спрашиваем статус, финотчёт заново не тянем.
assert.deepEqual(
    decideOutcome(job(1), { status: 'storage_pending', storage_pending: true, finance: { rows: 5 }, storage: { pending: true } }),
    { status: 'queued', phase: 'storage_status', delaySec: 20, error: null },
);
assert.equal(decideOutcome(job(MAX_WAIT_ATTEMPTS), { storage_pending: true }).status, 'error', 'waiting for storage has an upper limit');

// Лимит WB 1 запрос/мин — не ошибка, а пауза.
assert.deepEqual(
    decideOutcome(job(2), { status: 'done', finance: { skipped: true, reason: 'rate_limit' } }),
    { status: 'queued', phase: 'sync', delaySec: 90, error: null },
);
assert.deepEqual(
    decideOutcome(job(2), { status: 'done', finance: { rows: 1 }, storage: { skipped: true, reason: 'rate_limit' } }),
    { status: 'queued', phase: 'sync', delaySec: 90, error: null },
);

// Сбои: растущая пауза и потолок попыток, потом error.
const f1 = decideOutcome(job(1), undefined, 'timeout');
assert.equal(f1.status, 'queued');
if (f1.status === 'queued') assert.equal(f1.delaySec, 60);
const f3 = decideOutcome(job(3), { status: 'error', error: 'boom' });
assert.equal(f3.status === 'queued' && f3.delaySec, 180);
assert.equal(decideOutcome(job(MAX_FAIL_ATTEMPTS), undefined, 'timeout').status, 'error', 'gives up after the limit');
assert.equal(decideOutcome(job(1), null).status, 'queued', 'empty answer is retried');
const capped = decideOutcome(job(5), undefined, 'x');
assert.ok(capped.status === 'queued' && capped.delaySec <= 600, 'pause never exceeds 10 minutes');

// Прочие причины пропуска хранения считаются сбоем с повтором.
assert.equal(decideOutcome(job(1), { storage: { skipped: true, reason: 'HTTP 500' } }).status, 'queued');

console.log('sync-queue_test: ok');

/**
 * Тик отложенного запуска РК. Живой WB не дергаем: dry_run и мок startAdvert.
 */
import assert from 'node:assert/strict';
import {
    interpretStartHttp,
    isDue,
    parseScheduleDryRun,
    runAdvStartTick,
    type ScheduleRow,
    type TickDeps,
} from './adv-start-schedule.ts';

const NOW = new Date('2026-09-17T10:00:00.000Z');
const DUE: ScheduleRow = {
    id: 's1',
    cabinet_id: 'cab-a',
    campaign_id: 38634350,
    campaign_name: 'Пиджак',
    start_at: '2026-09-17T09:59:00.000Z',
    status: 'pending',
};
const FUTURE: ScheduleRow = {
    ...DUE,
    id: 's2',
    start_at: '2026-09-17T12:00:00.000Z',
};

assert.equal(isDue(DUE, NOW), true);
assert.equal(isDue(FUTURE, NOW), false);
assert.equal(isDue({ ...DUE, status: 'cancelled' }, NOW), false);

assert.equal(parseScheduleDryRun(null, {}), false, 'cron {} must actually start due campaigns');
assert.equal(parseScheduleDryRun('', {}), false);
assert.equal(parseScheduleDryRun('true', {}), true);
assert.equal(parseScheduleDryRun(null, { dry_run: true }), true);
assert.equal(parseScheduleDryRun('true', { dry_run: false }), false);

assert.deepEqual(interpretStartHttp(200, null), { ok: true });
assert.equal(interpretStartHttp(429, {}).retry, true);
assert.equal(interpretStartHttp(400, { error: 'already started' }).ok, true);
assert.equal(interpretStartHttp(400, { error: 'budget' }).ok, false);

function baseDeps(over: Partial<TickDeps> = {}): TickDeps & { starts: number[] } {
    const starts: number[] = [];
    const deps: TickDeps & { starts: number[] } = {
        now: NOW,
        dryRun: false,
        listDue: async () => [DUE, FUTURE],
        claim: async () => true,
        finish: async () => {},
        release: async () => {},
        loadToken: async () => 'wb-adv-token-test',
        startAdvert: async (_token, advertId) => {
            starts.push(advertId);
            return { ok: true };
        },
        starts,
        ...over,
    };
    return deps;
}

{
    const starts: number[] = [];
    const claimed: string[] = [];
    const result = await runAdvStartTick(baseDeps({
        dryRun: true,
        claim: async (id) => { claimed.push(id); return true; },
        startAdvert: async (_t, id) => { starts.push(id); return { ok: true }; },
    }));
    assert.equal(result.dryRun, true);
    assert.equal(result.due, 1);
    assert.equal(result.wouldStart, 1);
    assert.equal(result.started, 0);
    assert.deepEqual(starts, [], 'dry_run must not call WB start');
    assert.deepEqual(claimed, [], 'dry_run must not claim rows');
    assert.equal(result.results[0].action, 'would_start');
}

{
    const finished: Array<{ id: string; status: string }> = [];
    const live: Array<[string, number]> = [];
    const deps = baseDeps({
        finish: async (id, status) => { finished.push({ id, status }); },
        markCampaignLive: async (cabinetId, advertId) => { live.push([cabinetId, advertId]); },
    });
    const result = await runAdvStartTick(deps);
    assert.equal(result.started, 1);
    assert.equal(result.wouldStart, 0);
    assert.deepEqual(deps.starts, [38634350]);
    assert.deepEqual(finished, [{ id: 's1', status: 'done' }]);
    assert.deepEqual(live, [['cab-a', 38634350]]);
}

{
    const starts: number[] = [];
    const result = await runAdvStartTick(baseDeps({
        loadToken: async () => null,
        startAdvert: async (_t, id) => { starts.push(id); return { ok: true }; },
    }));
    assert.equal(result.failed, 1);
    assert.deepEqual(starts, [], 'missing token must not hit WB');
    assert.equal(result.results[0].error, 'нет рекламного токена');
}

{
    const released: string[] = [];
    const result = await runAdvStartTick(baseDeps({
        startAdvert: async () => ({ ok: false, retry: true, error: 'WB 429' }),
        release: async (id) => { released.push(id); },
    }));
    assert.equal(result.started, 0);
    assert.deepEqual(released, ['s1']);
    assert.equal(result.results[0].action, 'released');
}

{
    const result = await runAdvStartTick(baseDeps({
        claim: async () => false,
        startAdvert: async () => { throw new Error('must not start after lost claim'); },
    }));
    assert.equal(result.skipped, 1);
    assert.equal(result.started, 0);
}

console.log('adv-start-schedule_test: ok');

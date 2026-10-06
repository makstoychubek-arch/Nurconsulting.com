// Тумблеры функций по кабинету: пауза кончается сама, нет строки = включено,
// сбой базы никогда не выключает функцию.
import assert from 'node:assert/strict';
import { featureActive, featureOffReason, filterFeatureActive, isFeatureOn } from './cabinet-features.ts';

const now = Date.parse('2026-10-06T10:00:00Z');
const future = '2026-10-06T11:00:00Z';
const past = '2026-10-06T09:00:00Z';

assert.equal(isFeatureOn(null, now), true, 'нет строки = включено');
assert.equal(isFeatureOn({ enabled: true, paused_until: null }, now), true);
assert.equal(isFeatureOn({ enabled: false, paused_until: null }, now), false, 'до ручного включения');
assert.equal(isFeatureOn({ enabled: true, paused_until: future }, now), false, 'на паузе');
assert.equal(isFeatureOn({ enabled: true, paused_until: past }, now), true, 'пауза кончилась сама');
assert.equal(featureOffReason({ enabled: true, paused_until: past }, now), null);
assert.ok(featureOffReason({ enabled: false, paused_until: null }, now)?.includes('вручную'));

function fakeAdmin(rows: any[] | null, fail = false) {
    const q: any = {
        select: () => q, eq: () => q, in: () => q,
        maybeSingle: async () => (fail ? { data: null, error: { message: 'db' } } : { data: rows?.[0] ?? null, error: null }),
        then: (res: any) => res(fail ? { data: null, error: { message: 'db' } } : { data: rows, error: null }),
    };
    return { from: () => q };
}

assert.equal(await featureActive(fakeAdmin([{ enabled: false, paused_until: null }]), 'c1', 'reviews'), false);
assert.equal(await featureActive(fakeAdmin(null), 'c1', 'reviews'), true, 'нет строки');
assert.equal(await featureActive(fakeAdmin(null, true), 'c1', 'reviews'), true, 'сбой базы не выключает');

const cabs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
const off = [
    { cabinet_id: 'a', enabled: false, paused_until: null },
    { cabinet_id: 'b', enabled: true, paused_until: new Date(Date.now() + 3600_000).toISOString() },
    { cabinet_id: 'c', enabled: true, paused_until: new Date(Date.now() - 3600_000).toISOString() },
];
assert.deepEqual((await filterFeatureActive(fakeAdmin(off), cabs, 'ads')).map((c) => c.id), ['c']);
assert.deepEqual((await filterFeatureActive(fakeAdmin(null, true), cabs, 'ads')).map((c) => c.id), ['a', 'b', 'c'], 'сбой базы: все работают');

console.log('cabinet-features_test: ok');

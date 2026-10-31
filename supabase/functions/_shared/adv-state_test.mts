import assert from 'node:assert/strict';
import { parseAdvState } from './adv-state.ts';

const s = parseAdvState({
    settings: { name: 'x', payment_type: 'cpm', placements: { search: true, recommendations: false } },
    timestamps: { created: '2025-08-28T09:50:57.611559+03:00', started: null, updated: '2025-09-10T10:14:58.475499+03:00' },
});
assert.deepEqual(s.zones, { search: true, recommendations: false });
assert.equal(s.createdAt, '2025-08-28T06:50:57.611Z');
assert.equal(s.startedAt, null);
assert.equal(s.updatedAt, '2025-09-10T07:14:58.475Z');
// старый/неполный ответ не ломает разбор
assert.deepEqual(parseAdvState({ id: 1 }), { zones: null, createdAt: null, startedAt: null, updatedAt: null });
assert.deepEqual(parseAdvState(null).zones, null);
assert.equal(parseAdvState({ timestamps: { created: 'мусор' } }).createdAt, null);
assert.equal(parseAdvState({ settings: { placements: { search: 1 } } }).zones, null);
console.log('adv-state_test: ok');

import assert from 'node:assert/strict';
import { buildFunnelRows, funnelWindows } from './ozon-funnel.ts';

const rows = buildFunnelRows('cab', [
    { dimensions: [{ id: '2014682905' }, { id: '2026-11-13' }], metrics: [7828, 2000, 1500, 30, 4] },
    { dimensions: [{ id: 'abc' }, { id: '2026-11-13' }], metrics: [1] },
    { dimensions: [{ id: '5' }, { id: 'без даты' }], metrics: [1] },
], '2026-11-14T00:00:00Z');
assert.equal(rows.length, 1);
assert.deepEqual(rows[0], { cabinet_id: 'cab', d: '2026-11-13', sku: 2014682905, views: 7828, views_search: 2000, views_pdp: 1500, tocart: 30, ordered: 4, synced_at: '2026-11-14T00:00:00Z' });
assert.deepEqual(funnelWindows('2026-11-01', '2026-11-15'), [{ from: '2026-11-01', to: '2026-11-07' }, { from: '2026-11-08', to: '2026-11-14' }, { from: '2026-11-15', to: '2026-11-15' }]);
console.log('ozon-funnel_test: ok');

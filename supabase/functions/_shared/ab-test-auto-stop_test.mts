import assert from 'node:assert/strict';
import { decideAbAutoStop, parseMinCtr, variantCtr } from './ab-test-auto-stop.ts';

assert.equal(parseMinCtr({}), 5);
assert.equal(parseMinCtr({ minCtr: 7 }), 7);
assert.equal(variantCtr({ impressions: 800, clicks: 48 }).toFixed(1), '6.0');

const leaderProbs = new Map([['A', 0.08], ['B', 0.9], ['C', 0.02]]);

const winner = decideAbAutoStop(
    { stopOnWinner: true, minCtr: 5, autoStop: true, minImpressions: 2000 },
    [
        { variant_label: 'A', impressions: 500, clicks: 10 },
        { variant_label: 'B', impressions: 500, clicks: 32 },
        { variant_label: 'C', impressions: 480, clicks: 6 },
    ],
    leaderProbs,
);
assert.equal(winner?.reason, 'winner_determined');
assert.equal(winner?.leaderLabel, 'B');
assert.ok((winner?.leaderCtr || 0) >= 5);

const lowCtr = decideAbAutoStop(
    { stopOnWinner: true, minCtr: 5, autoStop: false },
    [
        { variant_label: 'A', impressions: 500, clicks: 10 },
        { variant_label: 'B', impressions: 500, clicks: 16 },
        { variant_label: 'C', impressions: 480, clicks: 6 },
    ],
    leaderProbs,
);
assert.equal(lowCtr, null, '3.2% CTR is below the 5% goal');

const tooFewViews = decideAbAutoStop(
    { stopOnWinner: true, minCtr: 5 },
    [
        { variant_label: 'A', impressions: 40, clicks: 1 },
        { variant_label: 'B', impressions: 50, clicks: 8 },
    ],
    new Map([['A', 0.1], ['B', 0.9]]),
);
assert.equal(tooFewViews, null, '50 impressions is not enough to call a winner');

const cap = decideAbAutoStop(
    { stopOnWinner: true, minCtr: 5, autoStop: true, minImpressions: 2000 },
    [
        { variant_label: 'A', impressions: 2100, clicks: 40 },
        { variant_label: 'B', impressions: 2050, clicks: 50 },
    ],
    new Map([['A', 0.4], ['B', 0.6]]),
);
assert.equal(cap?.reason, 'impressions_cap');

const winnerOff = decideAbAutoStop(
    { autoStop: false, minCtr: 5 },
    [
        { variant_label: 'A', impressions: 500, clicks: 10 },
        { variant_label: 'B', impressions: 500, clicks: 40 },
    ],
    leaderProbs,
);
assert.equal(winnerOff, null, 'without stopOnWinner the CTR goal does not finish the test');

console.log('ab-test-auto-stop_test ok');

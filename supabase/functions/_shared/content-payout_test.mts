import assert from 'node:assert/strict';
import { computePayout, computePayoutFromBlogger, monthStart, sumAccrued } from './content-payout.ts';

assert.equal(computePayout(5000, 1000, 10000, 2000), 5000);
assert.equal(computePayout(5000, 10000, 10000, 2000), 5000, 'views == порог — без бонуса');
assert.equal(computePayout(5000, 10001, 10000, 2000), 7000, 'views > порог — ставка+бонус');
assert.equal(computePayout('1500', '1', '0', '100'), 1600);
assert.equal(computePayoutFromBlogger({
    rate_per_video: 3000,
    bonus_views_threshold: 50_000,
    bonus_amount: 1500,
}, 50_001), 4500);
assert.equal(monthStart('2026-09-17T10:00:00.000Z'), '2026-09-01');
assert.equal(sumAccrued([{ accrued: 100 }, { accrued: '50.5' }]), 150.5);

console.log('content-payout_test: ok');

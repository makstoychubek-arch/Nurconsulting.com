/**
 * Юнит-тесты decideBid по docs/autobidder-tick-plan.md (кейсы 1–8, 10–14)
 * и кейс 9 (allSettled: 401 одного кабинета не стопит второй).
 */
import assert from 'node:assert/strict';
import {
    CANON,
    decideBid,
    fetchAuction,
    getAdPosition,
    isCapExhausted,
    settleCabinets,
    spendEstimateBetweenSyncs,
    tokenInvalidResult,
    type DecideInput,
} from './autobidder-tick-decide.ts';

function canon(over: Partial<DecideInput> = {}): DecideInput {
    return {
        myPos: 7,
        myBid: CANON.myBid,
        targetPosFrom: CANON.targetPosFrom,
        targetPosTo: CANON.targetPosTo,
        stepPct: CANON.stepPct,
        hysteresis: CANON.hysteresis,
        minBidFloor: CANON.minBidFloor,
        maxBid: CANON.maxBid,
        budgetCabinetExhausted: false,
        budgetGroupExhausted: false,
        ...over,
    };
}

function eq(id: string, got: ReturnType<typeof decideBid>, newBid: number, reason: string, apply: boolean) {
    assert.equal(got.newBid, newBid, `${id} newBid`);
    assert.equal(got.reason, reason, `${id} reason`);
    assert.equal(got.apply, apply, `${id} apply`);
}

eq('#1 pos worse', decideBid(canon({ myPos: 15 })), 107, 'pos_worse', true);
eq('#2 pos better', decideBid(canon({ myPos: 3 })), 93, 'pos_better', true);
eq('#3 in range', decideBid(canon({ myPos: 7 })), 100, 'in_range', false);
eq('#4 pos unknown', decideBid(canon({ myPos: null })), 107, 'pos_unknown', true);
eq('#5 max_bid clamp', decideBid(canon({ myPos: 20, myBid: 145 })), 150, 'max_bid_hit', true);
eq('#6 hysteresis', decideBid(canon({ myPos: 15, stepPct: 0.02 })), 100, 'hysteresis', false);
eq('#7 cabinet budget', decideBid(canon({ budgetCabinetExhausted: true })), 50, 'budget_cap_cabinet', true);
eq('#8 group budget', decideBid(canon({ budgetGroupExhausted: true })), 50, 'budget_cap_group', true);

eq('#10 pos = to', decideBid(canon({ myPos: 10 })), 100, 'in_range', false);
eq('#11 pos = from', decideBid(canon({ myPos: 5 })), 100, 'in_range', false);
eq('#12 pos = to+1', decideBid(canon({ myPos: 11 })), 107, 'pos_worse', true);
eq(
    '#13 already at floor + budget',
    decideBid(canon({ myBid: 50, budgetCabinetExhausted: true })),
    50,
    'hysteresis',
    false,
);
eq(
    '#14 both budgets',
    decideBid(canon({ budgetCabinetExhausted: true, budgetGroupExhausted: true })),
    50,
    'budget_cap_group',
    true,
);

eq(
    'NULL + потолок: pos_unknown|max_bid_hit',
    decideBid(canon({ myPos: null, myBid: 145 })),
    150,
    'pos_unknown|max_bid_hit',
    true,
);

eq(
    'max_bid NULL — не поднимаем',
    decideBid(canon({ myPos: 15, maxBid: null })),
    100,
    'hysteresis',
    false,
);

eq(
    'my_bid=0 — база floor, hysteresis skip',
    decideBid(canon({ myPos: 15, myBid: 0 })),
    54,
    'pos_worse',
    true,
);
eq(
    'my_bid=0 и max_bid NULL — не поднимаем',
    decideBid(canon({ myPos: 15, myBid: 0, maxBid: null })),
    0,
    'pos_worse',
    false,
);

assert.equal(fetchAuction('любой'), null, 'auction stub');
assert.equal(getAdPosition(1, 'q'), null, 'position stub');
assert.equal(getAdPosition(1, 'q', 15), 15, 'position override');
assert.equal(spendEstimateBetweenSyncs(), 0, 'intra-day estimate TODO');
assert.equal(isCapExhausted(100, null), false);
assert.equal(isCapExhausted(100, 80), true);
assert.equal(isCapExhausted(79, 80), false);

const invalid = tokenInvalidResult(100);
assert.equal(invalid.reason, 'token_invalid');
assert.equal(invalid.apply, false);

const settled = await settleCabinets([
    async () => {
        throw new Error('401');
    },
    async () => decideBid(canon({ myPos: 15 })),
]);
assert.equal(settled[0].status, 'rejected', '#9 A fails');
assert.equal(settled[1].status, 'fulfilled', '#9 B continues');
if (settled[1].status === 'fulfilled') {
    eq('#9 B pos_worse', settled[1].value, 107, 'pos_worse', true);
}
assert.deepEqual(tokenInvalidResult(100), { newBid: 100, reason: 'token_invalid', apply: false });

console.log('autobidder-tick-decide_test: ok');

import assert from 'node:assert/strict';
import {
    applyKeepFunnelOrders,
    funnelDayMetricFields,
    funnelDayOrders,
    funnelImpliedOrders,
    isWbFunnelWindowDate,
    keepFunnelOrdersCount,
    moscowYmd,
    wbFunnelWindow,
} from './wb-funnel-day.ts';

assert.equal(funnelDayOrders(null), null);
assert.equal(funnelDayOrders({}), null);
assert.equal(funnelDayOrders({ orderCount: 8 }), 8);
assert.equal(funnelDayOrders({ ordersCount: 10 }), 10);
assert.equal(funnelDayOrders({ orders: 3 }), 3);
assert.equal(funnelDayOrders({ orders: { count: 28 } }), 28);
assert.equal(funnelDayOrders({ orderCount: 0 }), 0);
assert.equal(funnelDayOrders({ orderCount: '12' }), 12);

assert.equal(funnelImpliedOrders({ cartCount: 157, cartToOrderConversion: 18 }), 28);
assert.equal(funnelImpliedOrders({ cartCount: 83, cartToOrderConversion: 12 }), 10);
assert.equal(funnelImpliedOrders({ cartCount: 74, cartToOrderConversion: 22 }), 16);
assert.equal(funnelDayOrders({ cartCount: 157, cartToOrderConversion: 18 }), 28);
assert.equal(funnelDayOrders({ orderCount: 17, cartCount: 157, cartToOrderConversion: 18 }), 28);

const fields = funnelDayMetricFields({
    openCount: 100,
    cartCount: 20,
    orderCount: 8,
    addToCartConversion: 20,
    cartToOrderConversion: 40,
});
assert.equal(fields.impressions, 100);
assert.equal(fields.basket_count, 20);
assert.equal(fields.orders_count, 8);
assert.equal(fields.funnel_order_conv, 40);

const fromConv = funnelDayMetricFields({
    openCount: 1033,
    cartCount: 157,
    addToCartConversion: 15,
    cartToOrderConversion: 18,
});
assert.equal(fromConv.orders_count, 28);

const noOrders = funnelDayMetricFields({ openCount: 5, cartCount: 1 });
assert.equal('orders_count' in noOrders, false);
assert.equal(noOrders.impressions, 5);

assert.match(moscowYmd(new Date('2026-09-16T00:00:00Z')), /^\d{4}-\d{2}-\d{2}$/);
assert.deepEqual(wbFunnelWindow('2026-09-16'), { from: '2026-09-10', to: '2026-09-16' });
assert.equal(isWbFunnelWindowDate('2026-09-14', '2026-09-16'), true);
assert.equal(isWbFunnelWindowDate('2026-09-09', '2026-09-16'), false);

const ivory = { basket_count: 294, funnel_order_conv: 16, orders_count: 47 };
assert.equal(keepFunnelOrdersCount(ivory, 66, '2026-09-14', '2026-09-16'), 47);
assert.equal(keepFunnelOrdersCount(ivory, 66, '2026-09-01', '2026-09-16'), 66);
assert.equal(keepFunnelOrdersCount(null, 66, '2026-09-14', '2026-09-16'), 66);
assert.equal(keepFunnelOrdersCount({ impressions: 10 }, 66, '2026-09-14', '2026-09-16'), 66);

const kept = applyKeepFunnelOrders(
    [{ nm_id: 12187825005, date: '2026-09-14', basket_count: 294, funnel_order_conv: 16 }],
    [
        { nm_id: 12187825005, date: '2026-09-14', orders_count: 66 },
        { nm_id: 12187825005, date: '2026-09-01', orders_count: 12 },
    ],
    '2026-09-16',
);
assert.equal(kept[0].orders_count, 47);
assert.equal(kept[1].orders_count, 12);

console.log('wb-funnel-day_test: ok');

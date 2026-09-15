import assert from 'node:assert/strict';
import { funnelDayMetricFields, funnelDayOrders, funnelImpliedOrders } from './wb-funnel-day.ts';

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

console.log('wb-funnel-day_test: ok');

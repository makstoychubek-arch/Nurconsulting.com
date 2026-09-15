import assert from 'node:assert/strict';
import { funnelDayMetricFields, funnelDayOrders } from './wb-funnel-day.ts';

assert.equal(funnelDayOrders(null), null);
assert.equal(funnelDayOrders({}), null);
assert.equal(funnelDayOrders({ orderCount: 8 }), 8);
assert.equal(funnelDayOrders({ ordersCount: 10 }), 10);
assert.equal(funnelDayOrders({ orders: 3 }), 3);
assert.equal(funnelDayOrders({ orderCount: 0 }), 0);
assert.equal(funnelDayOrders({ orderCount: '12' }), 12);

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

const noOrders = funnelDayMetricFields({ openCount: 5, cartCount: 1 });
assert.equal('orders_count' in noOrders, false);
assert.equal(noOrders.impressions, 5);

console.log('wb-funnel-day_test: ok');

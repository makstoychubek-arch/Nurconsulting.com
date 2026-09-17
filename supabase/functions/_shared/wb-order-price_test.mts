import assert from 'node:assert/strict';
import { orderPriceWithDisc } from './wb-order-price.ts';

// Живой заказ WB: три цены, из которых нужна средняя.
const order = {
    nmId: 247350377,
    totalPrice: 6529,
    priceWithDisc: 4831,
    finishedPrice: 4203,
    discountPercent: 26,
};
assert.equal(orderPriceWithDisc(order), 4831, 'берём цену со скидкой продавца');

// Того самого priceWithDiscount, который читали синхронизации, у WB нет —
// раньше это молча превращалось в totalPrice, то есть в завышенные заказы.
assert.equal(orderPriceWithDisc({ priceWithDiscount: 4831, totalPrice: 6529 }), 6529,
    'без priceWithDisc остаётся только totalPrice');

assert.equal(orderPriceWithDisc({ priceWithDisc: 0, totalPrice: 6529 }), 6529);
assert.equal(orderPriceWithDisc({ priceWithDisc: '4831.5', totalPrice: 6529 }), 4831.5);
assert.equal(orderPriceWithDisc({ priceWithDisc: null, totalPrice: null }), 0);
assert.equal(orderPriceWithDisc({}), 0);
assert.equal(orderPriceWithDisc(null), 0);
assert.equal(orderPriceWithDisc({ priceWithDisc: 'нет', totalPrice: 100 }), 100);

console.log('wb-order-price_test: ok');

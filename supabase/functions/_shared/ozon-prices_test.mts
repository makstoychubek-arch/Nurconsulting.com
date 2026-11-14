import assert from 'node:assert/strict';
import { buildPriceItem, checkNewPrice } from './ozon-prices.ts';

assert.equal(checkNewPrice(5000, 5300), null);
assert.match(String(checkNewPrice(5000, 90)), /от 100/);
assert.match(String(checkNewPrice(5000, 2000)), /вдвое/, 'ниже половины текущей отклоняем');
assert.match(String(checkNewPrice(5000, 12000)), /вдвое/, 'выше двукратной отклоняем');
assert.equal(checkNewPrice(null, 500), null, 'без текущей цены только нижний предел');

const base = { offer_id: 'a_42', price: 5299, old_price: 13940, min_price: 4660, currency: 'KGS' };
assert.deepEqual(buildPriceItem(base, 5000), { offer_id: 'a_42', price: '5000', currency_code: 'KGS', auto_action_enabled: 'UNKNOWN', old_price: '13940', min_price: '4660' });
assert.equal(buildPriceItem(base, 4000).min_price, '4000', 'ограничение для акций не выше новой цены');
assert.equal(buildPriceItem({ ...base, old_price: 5100 }, 5000).old_price, '0', 'зачёркнутая меньше +5%: убираем');
assert.equal(buildPriceItem({ ...base, min_price: 0 }, 5000).min_price, undefined, 'нет ограничения: не добавляем');
assert.equal(buildPriceItem({ ...base, currency: null }, 5000).currency_code, 'KGS');
console.log('ozon-prices_test: ok');

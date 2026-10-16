'use strict';
const assert = require('node:assert/strict');
const S = require('./rnp-selection.js');

assert.deepEqual(S.parseNum('1 234,5'), { v: 1234.5, unit: '' });
assert.deepEqual(S.parseNum('12,5%'), { v: 12.5, unit: '%' });
assert.deepEqual(S.parseNum('−3'), { v: -3, unit: '' });
assert.equal(S.parseNum('450 ₽').v, 450);
assert.equal(S.parseNum('1,234.5').v, 1234.5);
assert.equal(S.parseNum('Куртка'), null);
assert.equal(S.parseNum('—'), null);
assert.equal(S.parseNum(''), null);

const s = S.stats(['10', '20', '—', '', 'текст', '30']);
assert.equal(s.nums, 3); assert.equal(s.sum, 60); assert.equal(s.avg, 20); assert.equal(s.min, 10); assert.equal(s.max, 30);
assert.equal(s.count, 4); // непустые: 10, 20, текст, 30
assert.equal(S.stats(['5%', '15%']).unit, '%');
assert.equal(S.stats(['5%', '15']).unit, '');
assert.equal(S.stats(['а', 'б']).nums, 0);
assert.match(S.fmt(1234.567), /1.234,57/);
assert.equal(S.fmt(12.5, '%'), '12,5%');
console.log('rnp-selection_test: ok');

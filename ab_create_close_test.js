/**
 * А/Б-тест: окно «Новый А/Б тест» закрывается, как только тест и варианты сохранены,
 * а не после ответа WB на смену первого фото (раньше окно висело, хотя тест уже создан).
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8');
const start = html.indexOf('async function createABTest()');
const end = html.indexOf('async function rotateTestPhoto', start);
assert.ok(start > 0 && end > start, 'createABTest found');
const fn = html.slice(start, end);

const variantsInsert = fn.indexOf("from('ab_test_variants').insert");
const hide = fn.indexOf('hideNewTestForm()');
const rotate = fn.indexOf('await rotateTestPhoto(');
assert.ok(variantsInsert > 0 && hide > variantsInsert && rotate > hide,
    'the form closes after variants are saved and before the WB photo swap');
assert.ok(/released = true;\s*abCreatingTest = false;/.test(fn), 'submit lock is released together with the form');
assert.ok(/if \(!released\) \{\s*abCreatingTest = false;/.test(fn), 'finally does not reset the lock of a newer creation');
assert.ok(fn.indexOf("from('ab_tests').delete()") > rotate, 'a failed WB swap still removes the test');

console.log('ab_create_close_test: ok');

'use strict';
// Окно «Новый А/Б тест» закрывается сразу после нажатия «Создать тест», а тест, фото и смена фото на WB идут в фоне.
// Если фон не получился, пользователь видит короткую ошибку с кнопкой «Повторить», а недосозданный тест удаляется.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8');
const start = html.indexOf('async function createABTest()');
const mid = html.indexOf('async function runABCreate(snap)', start);
const end = html.indexOf('async function rotateTestPhoto', mid);
assert.ok(start > 0 && mid > start && end > mid, 'createABTest and runABCreate found');
const ui = html.slice(start, mid);
const bg = html.slice(mid, end);

assert.ok(ui.indexOf('hideNewTestForm()') > 0 && ui.indexOf('runABCreate(snap)') > ui.indexOf('hideNewTestForm()'),
    'the form closes first, then the background creation starts');
assert.ok(!/await /.test(ui.slice(ui.indexOf('hideNewTestForm()'))), 'nothing is awaited before the form is closed');
assert.ok(ui.includes("showPremiumModal('success', 'Тест создан'"), 'the user sees "Тест создан" immediately');

const variantsInsert = bg.indexOf("from('ab_test_variants').insert");
const rotate = bg.indexOf('await rotateTestPhoto(');
assert.ok(variantsInsert > 0 && rotate > variantsInsert, 'WB photo swap runs after the variants are saved');
assert.ok(bg.indexOf("from('ab_tests').delete()") > rotate, 'a failed WB swap still removes the test');
assert.ok(bg.includes("label: 'Повторить'") && bg.includes('runABCreate(snap)'), 'a failure offers a retry with the same data');

console.log('ab_create_close_test: ok');

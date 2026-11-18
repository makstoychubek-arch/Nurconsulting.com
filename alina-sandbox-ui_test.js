// Песочница Алины на сайте: строка состояния диалога.
const assert = require('assert');
const S = require('./alina-sandbox-ui.js');
assert.strictEqual(S.stateLine(null, null), '');
assert.strictEqual(S.stateLine({ status: 'ask_ad', deal_type: null, product_name: null }, 1200), 'Этап: выясняет объявление · ответила за 1,2 с');
assert.strictEqual(S.stateLine({ status: 'done', deal_type: 'barter', product_name: 'Пижама 2в1' }, 850), 'Этап: завершён · товар: Пижама 2в1 · вид: бартер · ответила за 850 мс');
assert.strictEqual(S.stateLine({ status: 'x', deal_type: 'cashback' }, null), 'Этап: x · вид: кэшбэк');
console.log('alina-sandbox-ui: ok');

// «Боты и ключи»: что показывается по статусу ключа и бота. Секреты в состоянии карточек не хранятся.
const assert = require('assert');
const K = require('./nr-keys-ui.js');

assert.deepStrictEqual(K.keyView(null), { tone: 'off', label: 'Не подключён', detail: '' });
assert.deepStrictEqual(K.keyView({ configured: false }), { tone: 'off', label: 'Не подключён', detail: '' });
assert.deepStrictEqual(K.keyView({ configured: true, source: 'db', meta: { mask: 'sk-…6789' } }), { tone: 'ok', label: 'Подключён', detail: 'sk-…6789' });
assert.strictEqual(K.keyView({ configured: true, source: 'db', meta: { email: 'a@p.iam.gserviceaccount.com' } }).detail, 'a@p.iam.gserviceaccount.com');
assert.match(K.keyView({ configured: true, source: 'env', meta: {} }).detail, /на сервере/);
assert.deepStrictEqual(K.botStatus({ status: 'online' }), ['ok', 'На связи']);
assert.deepStrictEqual(K.botStatus({ status: 'no_token' }), ['bad', 'Нет токена']);
assert.deepStrictEqual(K.botStatus({ status: 'disabled' }), ['off', 'Выключен']);
assert.strictEqual(K.scenario({ id: 'alina' }), 'Алина: самовыкупы и раздачи');
assert.strictEqual(K.scenario({ id: 'karina' }), 'Сценарий не назначен');
console.log('nr-keys-ui: ok');

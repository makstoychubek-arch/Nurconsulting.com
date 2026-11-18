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
assert.strictEqual(K.llmErrText('insufficient_quota'), 'закончились деньги на счёте OpenAI'); assert.strictEqual(K.llmErrText('http_502'), 'ошибка OpenAI (502)');
assert.deepStrictEqual(K.usageLines(null), []);
assert.deepStrictEqual(K.usageLines({ costUsd: 1.234, todayUsd: 0.1, budgetUsd: 0, errors: 0 }), ['Расход в этом месяце ≈ $1.23 (бюджет не задан) · сегодня ≈ $0.10']);
const over = K.usageLines({ costUsd: 12, todayUsd: 1, budgetUsd: 10, errors: 3, lastError: 'invalid_api_key' });
assert.strictEqual(over.length, 3); assert.match(over[0], /из \$10\.00/); assert.match(over[1], /Бюджет израсходован/); assert.match(over[2], /последняя: ключ не принят/);
console.log('nr-keys-ui: ok');

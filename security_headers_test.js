/** Заголовки безопасности должны оставаться на всех страницах сайта. */
const assert = require('assert');
const cfg = require('./vercel.json');

const all = (cfg.headers || []).find((h) => h.source === '/(.*)');
assert.ok(all, 'нужен общий блок заголовков для всех страниц');
const map = Object.fromEntries(all.headers.map((h) => [h.key, h.value]));
assert.strictEqual(map['X-Content-Type-Options'], 'nosniff');
assert.strictEqual(map['X-Frame-Options'], 'SAMEORIGIN');
assert.ok(/max-age=\d{7,}/.test(map['Strict-Transport-Security'] || ''), 'HSTS не короче нескольких месяцев');
assert.ok(map['Referrer-Policy'], 'Referrer-Policy задан');
assert.ok(/camera=\(\)/.test(map['Permissions-Policy'] || ''), 'камера по умолчанию выключена');

console.log('security_headers_test: ok');

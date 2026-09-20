/**
 * Landing + login take vibeprompts.dev component layouts.
 * Copy, phones, Telegram and numbers stay as they were.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = __dirname;
const css = fs.readFileSync(path.join(root, 'css/nr-vibe.css'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const login = fs.readFileSync(path.join(root, 'login.html'), 'utf8');
const dash = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');

assert.ok(css.includes('--paper: #f5f4f0'), 'shared palette has paper');
assert.ok(css.includes('--ink: #14140f'), 'shared palette has ink');
assert.ok(css.includes('--font-display: "Archivo"'), 'display face is Archivo');
assert.ok(css.includes('--font-body: "Inter"'), 'body face is Inter');
assert.ok(css.includes('--font-mono: "JetBrains Mono"'), 'mono face is JetBrains Mono');
assert.ok(css.includes('.vp-pill-nav'), 'pill nav layout');
assert.ok(css.includes('.pw-meter'), 'password meter layout');
assert.ok(css.includes('.vp-channel'), 'support channel cards');
assert.ok(css.includes('.vp-office'), 'office cards');
assert.ok(css.includes('.vp-foot-bar'), 'compact footer bar');
assert.ok(css.includes('.vp-tabbar'), 'bottom tab bar');

assert.ok(index.includes('/css/nr-vibe.css'), 'landing loads shared vibe CSS');
assert.ok(login.includes('/css/nr-vibe.css'), 'login loads shared vibe CSS');
assert.ok(index.includes('family=Archivo') && login.includes('family=Archivo'),
    'landing and login load Archivo');
assert.ok(index.includes('theme-color" content="#f5f4f0"') && login.includes('theme-color" content="#f5f4f0"'),
    'chrome color matches paper');
assert.ok(index.includes('class="vp-pill-nav"'), 'landing uses floating pill nav');
assert.ok(index.includes('class="hero-stats') && index.includes('<dt'), 'hero uses left-aligned stat strip');
assert.ok(index.includes('class="vp-channel group"'), 'contacts use channel grid');
assert.ok(index.includes('data-office="ru"') && index.includes('data-office="kg"'),
    'contacts use live-time office cards');
assert.ok(index.includes('class="vp-foot-bar"'), 'site bottom uses compact footer bar');
assert.ok(index.includes('vp-tabbar'), 'mobile dock uses bottom tab bar');
assert.ok(login.includes('id="pw-meter"') && login.includes('id="reg-password"'),
    'register password keeps its id and adds a strength meter');
assert.ok(login.includes('id="login-email"') && login.includes('id="login-password"'),
    'login field ids are unchanged');
assert.ok(login.includes('signInWithGoogle()') && login.includes('handleRegister()'),
    'login handlers are unchanged');

const keep = [
    '+7 966 752 03 97',
    '+996 558 200 327',
    'tel:+79667520397',
    'https://wa.me/996558200327',
    'https://t.me/maraomg',
    'Telegram: @maraomg',
    '120 430 000 ₽',
    '356 780 шт',
    '94%',
    '+48.7% за 3 мес.',
    '120+ млн',
    '20+ млн',
    '248 190 372',
    'Нурболот',
    'Марлен',
    'Инсия',
    'Ольга',
    'Муха',
    'Данияр Асанов',
    'Амир Исаев',
    'Алина Волкова',
    '© Nur Consulting &amp; NR Space. Все права защищены. 2026',
    'Получить бесплатный аудит',
    'Написать в Telegram',
    'Превращаем Wildberries',
];
keep.forEach(function (snippet) {
    assert.ok(index.includes(snippet), 'landing keeps original data: ' + snippet);
});
assert.ok(!index.includes('Москва') && !index.includes('Бишкек'),
    'office cards do not invent city names');
assert.ok(!dash.includes('/css/nr-vibe.css'),
    'dashboard is left on the app theme');

console.log('site_vibe_test: ok');

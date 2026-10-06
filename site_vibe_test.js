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
assert.ok(index.includes('class="mn-hero"') && index.includes('class="mn-h1"'), 'minimal left-aligned hero');
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
    '+996 502 446 688',
    'tel:+79667520397',
    'tel:+996502446688',
    'https://wa.me/996502446688',
    'instagram.com/___nurbolot',
    '© 2026 Nur Consulting &amp; NR Space. Все права защищены.',
];
keep.forEach(function (snippet) {
    assert.ok(index.includes(snippet), 'landing keeps original data: ' + snippet);
});
// Непроверенные цифры и демо-данные на главной убраны: остались только пометки «пример».
['120 430 000 ₽', '356 780 шт', '120+ млн', '20+ млн', '5 лет'].forEach(function (fake) {
    assert.ok(!index.includes(fake), 'landing has no unverified claim: ' + fake);
});
assert.ok(index.includes('Пример интерфейса, данные условные'), 'demo mockups are labelled as examples');
assert.ok(!index.includes('Мы не просто агентство'), 'no cliche copy');
assert.ok(!index.includes('t.me/') && !index.includes('vp-tab-plus') && !index.includes('id="team"'),
    'audit/Telegram buttons and the team section are removed on all widths');
assert.ok(!index.includes('Москва') && !index.includes('Бишкек'),
    'office cards do not invent city names');
assert.ok(!dash.includes('/css/nr-vibe.css'),
    'dashboard is left on the app theme');

assert.ok(login.includes("queryParams: { prompt: 'select_account' }"),
    'Google sign-in always asks which account — no silent re-entry after logout');
assert.ok(login.includes("const holdAutoEnter = urlParams.get('tab') === 'register' && !isOAuthReturn;") &&
    login.includes("if (holdAutoEnter && event === 'INITIAL_SESSION') return;") &&
    login.includes('showSignedInAs(session);') && login.includes('function switchAccount()'),
    '«Регистрация» with a live session asks instead of entering the current account');
console.log('site_vibe_test: ok');

// Вход и регистрация по email и паролю, сброс пароля
{
    const l = fs.readFileSync(path.join(root, 'login.html'), 'utf8');
    assert.ok(l.includes('signInWithPassword({ email, password })') && l.includes('supabase.auth.signUp('), 'email login and registration work');
    assert.ok(!l.includes('Регистрация через email недоступна'), 'registration is no longer a stub');
    assert.ok(l.includes("SUPER_ADMIN_EMAIL) {\n                showError('login-error', 'Для Super Admin"), 'super admin stays Google-only');
    assert.ok(l.includes("redirectTo: window.location.origin + '/reset-password'"), 'reset link goes to the reset page');
    const r = fs.readFileSync(path.join(root, 'reset-password.html'), 'utf8');
    assert.ok(r.includes('updateUser({ password: a })') && r.includes('PASSWORD_RECOVERY'), 'reset page sets a new password after the recovery link');
    assert.ok(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8').includes('"/reset-password"'), '/reset-password is routed');
}

// Вход и регистрация через Telegram: код из бота Акылай вводится на сайте
{
    const l = fs.readFileSync(path.join(root, 'login.html'), 'utf8');
    assert.ok(l.includes('startTelegramLogin()') && l.includes("action: 'verify'") && l.includes("type: 'magiclink'"), 'login.html: Telegram login flow');
    const fn = fs.readFileSync(path.join(root, 'supabase/functions/tg-login/index.ts'), 'utf8');
    assert.ok(fn.includes("status: 'used'") && fn.includes('TG_LOGIN_MAX_ATTEMPTS') && fn.includes('isExpired'), 'tg-login: one-time token, attempts limit, expiry');
    assert.ok(!/\.code_hash\b.*return json/.test(fn) || fn.includes('codeHash(token, code)'), 'the code is compared by hash');
    const bot = fs.readFileSync(path.join(root, 'supabase/functions/akylai-bot/index.ts'), 'utf8');
    assert.ok(bot.includes('parseLoginStart(text)') && bot.includes('handleLoginStart'), 'the bot sends the login code');
    const mig = fs.readFileSync(path.join(root, 'supabase/migrations/20261006100000_tg_login.sql'), 'utf8');
    assert.ok(mig.includes('revoke all on public.tg_login_tokens from anon, authenticated;') && mig.includes('enable row level security'), 'login tables are server-only');
}

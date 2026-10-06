// Служебные файлы сайта: robots, sitemap, 404, политика и оферта, мета-теги, мониторинг, безопасные заголовки.
const fs = require('fs');
const assert = require('assert');
const read = (f) => fs.readFileSync(f, 'utf8');

assert.ok(/Sitemap: https:\/\/nurcon\.kg\/sitemap\.xml/.test(read('robots.txt')));
assert.ok(/Disallow: \/space/.test(read('robots.txt')), 'приложение не индексируем');
const sm = read('sitemap.xml');
for (const p of ['/', '/login', '/privacy', '/terms']) assert.ok(sm.includes(`<loc>https://nurcon.kg${p}</loc>`), 'sitemap: ' + p);
for (const f of ['404.html', 'privacy.html', 'terms.html']) assert.ok(fs.existsSync(f), f);
assert.ok(/noindex/.test(read('404.html')), '404 не индексируем');
assert.ok(/ИНН/.test(read('privacy.html')) && /проверен юристом/.test(read('terms.html')), 'юридические тексты помечены как требующие проверки');

for (const f of ['index.html', 'login.html']) {
    const h = read(f);
    for (const t of ['og:title', 'og:description', 'og:image', 'twitter:card', 'rel="canonical"', 'name="description"']) assert.ok(h.includes(t), f + ': ' + t);
}
assert.ok(fs.existsSync('img/og.png'), 'картинка для ссылок');
assert.ok(read('index.html').includes('href="/privacy"') && read('index.html').includes('href="/terms"'), 'ссылки на документы в подвале');
for (const f of ['index.html', 'login.html', 'dashboard.html']) assert.ok(read(f).includes('/nr-monitor.js'), f + ': монитор ошибок');

const v = JSON.parse(read('vercel.json'));
const csp = v.headers[0].headers.find((h) => h.key === 'Content-Security-Policy');
assert.ok(csp && /frame-ancestors 'self'/.test(csp.value) && !/script-src/.test(csp.value), 'CSP без script-src: не ломает сайт');
assert.ok(v.rewrites.some((r) => r.source === '/privacy') && v.rewrites.some((r) => r.source === '/terms'));

// монитор не должен падать и ограничен по числу сообщений
const src = read('nr-monitor.js');
assert.ok(/MAX = 5/.test(src) && /sendBeacon/.test(src));
console.log('site_static_test: ok');

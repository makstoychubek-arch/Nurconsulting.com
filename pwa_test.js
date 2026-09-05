/**
 * PWA polish: manifest, icons, splash, SW offline fallback, native chrome.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

function pngSize(rel) {
    const buf = fs.readFileSync(path.join(__dirname, rel));
    assert.strictEqual(buf[1], 0x50, `${rel} is not a PNG`);
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), bytes: buf.length };
}

const html = fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
const sw = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
const offline = fs.readFileSync(path.join(__dirname, 'offline.html'), 'utf8');
const vercel = fs.readFileSync(path.join(__dirname, 'vercel.json'), 'utf8');

assert.strictEqual(manifest.name, 'NR Space');
assert.strictEqual(manifest.display, 'standalone');
assert.strictEqual(manifest.background_color, '#1C1C1E');
assert.ok(manifest.icons.some((i) => i.purpose === 'maskable' && i.src === '/icons/icon-512-maskable.png'),
    'manifest must include a maskable 512 icon');
assert.ok(manifest.icons.some((i) => i.src === '/icons/icon-192.png'));
assert.ok(manifest.icons.some((i) => i.src === '/icons/icon-512.png'));
assert.ok(manifest.shortcuts.some((s) => s.name === 'РНП' && s.url === '/rnp'));
assert.ok(manifest.shortcuts.some((s) => s.name === 'Дашборд' && s.url === '/dashboard'));

const i192 = pngSize('icons/icon-192.png');
const i512 = pngSize('icons/icon-512.png');
const iMask = pngSize('icons/icon-512-maskable.png');
const iTouch = pngSize('icons/apple-touch-icon.png');
assert.deepStrictEqual([i192.w, i192.h], [192, 192]);
assert.deepStrictEqual([i512.w, i512.h], [512, 512]);
assert.deepStrictEqual([iMask.w, iMask.h], [512, 512]);
assert.deepStrictEqual([iTouch.w, iTouch.h], [180, 180]);
assert.deepStrictEqual([pngSize('icons/shortcut-rnp.png').w, pngSize('icons/shortcut-rnp.png').h], [96, 96]);
assert.deepStrictEqual([pngSize('icons/telegram-nr-avatar.png').w, pngSize('icons/telegram-nr-avatar.png').h], [640, 640]);
assert.deepStrictEqual([pngSize('icons/favicon.png').w, pngSize('icons/favicon.png').h], [32, 32]);
assert.deepStrictEqual([pngSize('icons/shortcut-dashboard.png').w, pngSize('icons/shortcut-dashboard.png').h], [96, 96]);
assert.deepStrictEqual([pngSize('splash/splash-1170x2532.png').w, pngSize('splash/splash-1170x2532.png').h], [1170, 2532]);

assert.ok(html.includes('rel="manifest" href="/manifest.json"'));
assert.ok(html.includes('apple-mobile-web-app-status-bar-style" content="black-translucent"'));
assert.ok(html.includes('rel="apple-touch-startup-image" href="/splash/splash-1170x2532.png"'));
assert.ok(html.includes('href="/icons/apple-touch-icon.png"'));
assert.ok(html.includes('href="/favicon.ico"') && html.includes('/icons/favicon.png'),
    'dashboard tab icon must match the PWA NR mark');
assert.ok(fs.existsSync(path.join(__dirname, 'icons/logo-nr.svg')));
assert.ok(sw.includes("nr-space-pwa-v2") && sw.includes("/icons/logo-nr.svg"));
assert.ok(html.includes('overscroll-behavior: none') && html.includes('touch-action: manipulation'));
assert.ok(html.includes('-webkit-user-select: none') && html.includes('input, textarea, select'));
assert.ok(html.includes('.main-content.page-transition') && html.includes('transition: opacity 0.2s ease-in-out'));
assert.ok(html.includes("navigator.serviceWorker.register('/sw.js'"));
assert.ok(html.includes("path === '/dashboard'"));

assert.ok(sw.includes("caches.match('/offline.html')"));
assert.ok(sw.includes("req.mode === 'navigate'"), 'SW must only fall back on navigations, not API calls');
assert.ok(!/event\.respondWith\(\s*fetch\(event\.request\)\.catch\(\(\) => caches\.match\('\/offline\.html'\)\)\s*\)/.test(sw.replace(/\s+/g, '')) || sw.includes("req.mode === 'navigate'"));

assert.ok(offline.includes('Нет соединения, попробуйте позже'));
assert.ok(offline.includes('NR Space') && offline.includes('logo-nr') && offline.includes('/icons/logo-nr.svg'));

assert.ok(vercel.includes('"/dashboard"') && vercel.includes('"/sw.js"'),
    'Vercel must rewrite /dashboard and disable SW caching');

console.log('pwa_test: ok');

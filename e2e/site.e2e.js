/**
 * Браузерные проверки публичного сайта на Playwright: главная (вход спрятан за логотипом), страница входа, 404.
 * Запуск: npm run test:e2e. Нужны Playwright и Chromium; путь к браузеру можно задать через PW_CHROMIUM.
 * Сервер статики поднимается сам, сеть наружу (Supabase, шрифты) в проверках не нужна.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webp': 'image/webp', '.jpg': 'image/jpeg' };

function serve() {
    return new Promise((resolve) => {
        const srv = http.createServer((req, res) => {
            let p = decodeURIComponent(req.url.split('?')[0]);
            if (p === '/') p = '/index.html';
            if (p === '/login') p = '/login.html';
            const f = path.join(ROOT, p);
            if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                return res.end('not found');
            }
            res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
            res.end(fs.readFileSync(f));
        }).listen(0, () => resolve(srv));
    });
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// Ошибки страницы считаем только свои: внешние хосты в песочнице недоступны.
function watchErrors(page) {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message || e)));
    return errors;
}

test('главная: «Войти» спрятан, логотип показывает и снова прячет', async ({ page, base }) => {
    const errors = watchErrors(page);
    await page.goto(base + '/');
    const btn = page.locator('#hid-login');
    assert.strictEqual(await btn.isVisible(), false, 'кнопка входа скрыта сразу');
    await page.click('#logo-secret');
    await btn.waitFor({ state: 'visible' });
    assert.strictEqual(await btn.getAttribute('href'), '/login');
    await page.click('#logo-secret');
    await btn.waitFor({ state: 'hidden' });
    assert.deepStrictEqual(errors, [], 'ошибок скриптов нет: ' + errors.join('; '));
});

test('главная: после клика по логотипу кнопка ведёт на страницу входа', async ({ page, base }) => {
    await page.goto(base + '/');
    await page.click('#logo-secret');
    await page.locator('#hid-login').waitFor({ state: 'visible' });
    await page.click('#hid-login');
    await page.waitForURL('**/login');
    await page.locator('#tg-btn').waitFor({ state: 'visible' });
});

test('главная: демо-блоки скрыты, пока их не включили', async ({ page, base }) => {
    await page.goto(base + '/');
    assert.strictEqual(await page.locator('#demo-blocks').isVisible(), false);
});

test('главная на телефоне: нет горизонтальной прокрутки', async ({ browser, base }) => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(base + '/');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await ctx.close();
    assert.ok(overflow <= 1, 'горизонтальный сдвиг ' + overflow + 'px');
});

test('вход: доступны Google и Telegram, форма почты скрыта', async ({ page, base }) => {
    const errors = watchErrors(page);
    await page.goto(base + '/login');
    assert.match(await page.title(), /Вход/);
    await page.locator('#tg-btn').waitFor({ state: 'visible' });
    assert.ok(await page.locator('button[onclick="signInWithGoogle()"]').isVisible(), 'кнопка Google видна');
    assert.strictEqual(await page.locator('#email-auth').isVisible(), false, 'вход по почте скрыт');
    assert.deepStrictEqual(errors, [], 'ошибок скриптов нет: ' + errors.join('; '));
});

test('вход: ссылки на соглашение, политику и согласие на месте', async ({ page, base }) => {
    await page.goto(base + '/login');
    for (const href of ['/terms', '/privacy', '/consent']) {
        assert.ok(await page.locator('a[href="' + href + '"]').first().isVisible(), 'ссылка ' + href);
    }
});

test('404: страница ошибки открывается и ведёт на главную', async ({ page, base }) => {
    await page.goto(base + '/404.html');
    assert.ok(await page.locator('a[href="/"]').count() > 0, 'есть ссылка на главную');
});

(async () => {
    const srv = await serve();
    const base = 'http://127.0.0.1:' + srv.address().port;
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    let failed = 0;
    for (const t of tests) {
        const ctx = await browser.newContext({ viewport: { width: 1300, height: 800 } });
        const page = await ctx.newPage();
        page.setDefaultTimeout(8000);
        try {
            await t.fn({ page, browser, base });
            console.log('ok   ' + t.name);
        } catch (e) {
            failed++;
            console.log('FAIL ' + t.name + '\n     ' + String(e.message || e).split('\n')[0]);
        }
        await ctx.close();
    }
    await browser.close();
    srv.close();
    if (failed) { console.log(failed + ' из ' + tests.length + ' не прошли'); process.exit(1); }
    console.log('e2e: все ' + tests.length + ' проверок прошли');
})();

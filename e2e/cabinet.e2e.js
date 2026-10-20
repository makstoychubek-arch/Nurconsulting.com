/**
 * Браузерные проверки кабинета (РНП) на Playwright без настоящего входа и без сети:
 * вход подменяется сессией в localStorage, а ответы Supabase отдаёт заглушка с тестовыми данными
 * (2 группы по 2 артикула, 10 дней, у артикулов по 10/11 и 12/13 заказов в день).
 * Запуск: npm run test:e2e. Путь к Chromium можно задать через PW_CHROMIUM.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webp': 'image/webp' };

const USER_ID = '11111111-1111-1111-1111-111111111111';
const CAB = 'cccccccc-0000-0000-0000-000000000001';
const DAYS = 10;
const ARTS = [
    { nm: 1001, sa: 'укороч_черный', cat: 'Укороченные' }, { nm: 1002, sa: 'укороч_бордо', cat: 'Укороченные' },
    { nm: 2001, sa: 'оверсайз_серый', cat: 'Оверсайз' }, { nm: 2002, sa: 'оверсайз_красный', cat: 'Оверсайз' },
];
const ORDERS_PER_DAY = [10, 11, 12, 13];

function serve() {
    return new Promise((resolve) => {
        const srv = http.createServer((req, res) => {
            let p = decodeURIComponent(req.url.split('?')[0]);
            if (p === '/') p = '/index.html';
            if (p === '/login') p = '/login.html';
            if (p === '/space') p = '/dashboard.html';
            const f = path.join(ROOT, p);
            if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
            res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
            res.end(fs.readFileSync(f));
        }).listen(0, () => resolve(srv));
    });
}

function fixtures() {
    const msk = Date.now() + 6 * 3600e3;
    const day = (n) => new Date(msk - n * 86400e3).toISOString().slice(0, 10);
    const arts = ARTS.map((a, i) => ({ id: 'a' + i, cabinet_id: CAB, nm_id: a.nm, seller_article: a.sa, vendor_code: a.sa, name: a.sa, category: a.cat, is_active: true, cost_price: 1000, photo_url: null, sort_order: i }));
    const daily = [];
    ARTS.forEach((a, i) => {
        for (let d = 0; d < DAYS; d++) {
            daily.push({ cabinet_id: CAB, nm_id: a.nm, date: day(d), orders_count: ORDERS_PER_DAY[i], orders_sum: ORDERS_PER_DAY[i] * 5000, sales_count: 6 + i, sales_sum: (6 + i) * 5000, ad_spend: 500, impressions: 1000, clicks: 50 });
        }
    });
    return {
        spaces: [{ id: 's1', user_id: USER_ID, email: 'qa@example.test', status: 'active', tariff_plan: 'pro', is_super_admin: false, first_name: 'QA', last_name: 'Test', full_name: 'QA Test', avatar_url: null }],
        cabinets: [{ id: CAB, name: 'Тестовый кабинет', wb_token_set: true, user_id: USER_ID }],
        rnp_articles: arts,
        rnp_daily_data: daily,
    };
}

async function newCabinetPage(browser, base) {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const now = Math.floor(Date.now() / 1000);
    const user = { id: USER_ID, aud: 'authenticated', role: 'authenticated', email: 'qa@example.test', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const jwt = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: USER_ID, role: 'authenticated', exp: now + 3600, aud: 'authenticated' }) + '.sig';
    const session = { access_token: jwt, refresh_token: 'rt', token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, user };
    await ctx.addInitScript(([k, v]) => {
        try { localStorage.setItem(k, JSON.stringify(v)); localStorage.setItem('nr_welcome_v1', '1'); } catch (e) {}
    }, ['sb-fiukyfyhotctvfdidktx-auth-token', session]);

    const tables = fixtures();
    const rpcs = { is_staff: true, has_paid_access: true, is_super_admin: false };
    await ctx.route(/supabase\.co/, (r) => {
        const u = new URL(r.request().url());
        if (u.pathname === '/auth/v1/user') return r.fulfill({ json: user });
        if (u.pathname.startsWith('/rest/v1/rpc/')) {
            const n = u.pathname.split('/').pop();
            return r.fulfill({ json: n in rpcs ? rpcs[n] : (n === 'viewer_cabinets' || n.startsWith('rnp_') ? [] : null) });
        }
        if (u.pathname.startsWith('/rest/v1/')) {
            const rows = tables[u.pathname.split('/').pop()] || [];
            const single = /vnd.pgrst.object/.test(r.request().headers().accept || '');
            return r.fulfill({ json: single ? (rows[0] || null) : rows, headers: { 'content-range': '0-' + Math.max(0, rows.length - 1) + '/' + rows.length } });
        }
        return r.fulfill({ json: {} });
    });
    // Всё остальное снаружи (шрифты, WB) в песочнице недоступно, режем сразу.
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => (/supabase\.co/.test(r.request().url()) ? r.fallback() : r.abort()));

    const page = await ctx.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message || e)));
    await page.goto(base + '/space');
    await page.waitForFunction(() => typeof showTab === 'function');
    await page.evaluate(() => showTab('rnp'));
    await page.locator('.rnp-cat-name', { hasText: 'Укороченные' }).first().waitFor({ state: 'visible' });
    await page.waitForFunction(() => /заказы\s+\d+/.test(document.querySelector('.rnp-gh-sub')?.textContent || ''));
    return { ctx, page, errors };
}

const heroOrders = (page) => page.evaluate(() => {
    const m = (document.querySelector('.rnp-gh-profit .rnp-gh-sub')?.textContent || '').match(/заказы\s+([\d\s ]+)/);
    return m ? Number(m[1].replace(/\D/g, '')) : null;
});
const heroChip = (page) => page.evaluate(() => document.querySelector('.rnp-gh-profit .rnp-gh-chip')?.textContent || '');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('РНП открывается: две группы с кнопкой «Σ Общее», в «Общем» все 4 артикула', async ({ page, errors }) => {
    assert.strictEqual(await page.locator('.rnp-cat-sigma').count(), 2, 'у каждой группы есть кнопка');
    assert.strictEqual(await heroOrders(page), DAYS * ORDERS_PER_DAY.reduce((a, b) => a + b, 0));
    assert.deepStrictEqual(errors, [], 'ошибок скриптов нет: ' + errors.join('; '));
});

test('«Σ Общее» у группы: заказы только по её артикулам, в шапке название группы', async ({ page }) => {
    const sigma = (name) => page.locator('.rnp-cat-group', { has: page.locator('.rnp-cat-name', { hasText: name }) }).locator('.rnp-cat-sigma');
    await sigma('Укороченные').click();
    await page.waitForFunction(() => /Укороченные/.test(document.querySelector('.rnp-gh-profit .rnp-gh-chip')?.textContent || ''));
    assert.strictEqual(await heroOrders(page), DAYS * (ORDERS_PER_DAY[0] + ORDERS_PER_DAY[1]));
    assert.match(await heroChip(page), /2 арт\./);
    const todayOrders = await page.evaluate(() => {
        const row = [...document.querySelectorAll('tr')].find((r) => /ЗАКАЗЫ/.test(r.textContent));
        const cells = row ? [...row.querySelectorAll('td')].map((t) => t.textContent.trim()) : [];
        return cells.filter((t) => /^\d+$/.test(t)).pop();
    });
    assert.strictEqual(Number(todayOrders), ORDERS_PER_DAY[0] + ORDERS_PER_DAY[1], 'в таблице за день сумма по группе');
    await sigma('Оверсайз').click();
    await page.waitForFunction(() => /Оверсайз/.test(document.querySelector('.rnp-gh-profit .rnp-gh-chip')?.textContent || ''));
    assert.strictEqual(await heroOrders(page), DAYS * (ORDERS_PER_DAY[2] + ORDERS_PER_DAY[3]));
});

test('«Общий» возвращает все артикулы после просмотра группы', async ({ page }) => {
    await page.locator('.rnp-cat-sigma').first().click();
    await page.waitForFunction(() => /арт\./.test(document.querySelector('.rnp-gh-profit .rnp-gh-chip')?.textContent || '') && /·/.test(document.querySelector('.rnp-gh-profit .rnp-gh-chip')?.textContent || ''));
    await page.locator('.rnp-tab-general').click();
    await page.waitForFunction(() => /4 арт\./.test(document.querySelector('.rnp-gh-profit .rnp-gh-chip')?.textContent || ''));
    assert.strictEqual(await heroOrders(page), DAYS * ORDERS_PER_DAY.reduce((a, b) => a + b, 0));
});

test('клик по заголовку группы сворачивает её, а не открывает «Σ Общее»', async ({ page }) => {
    const group = page.locator('.rnp-cat-group', { has: page.locator('.rnp-cat-name', { hasText: 'Оверсайз' }) });
    await group.locator('.rnp-cat-name').click();
    await group.waitFor({ state: 'attached' });
    await page.waitForFunction(() => document.querySelector('.rnp-cat-group.collapsed'));
    assert.strictEqual(await heroOrders(page), DAYS * ORDERS_PER_DAY.reduce((a, b) => a + b, 0), 'вид остался общим');
});

test('вкладка артикула и «Заметки по дням» отвечают за 100 мс (тяжёлая отрисовка после кадра)', async ({ page }) => {
    const first = (fnSrc) => page.evaluate(async (src) => {
        const t0 = performance.now();
        let hit = 0;
        const obs = new MutationObserver(() => { if (!hit) hit = performance.now(); });
        obs.observe(document.getElementById('tab-rnp'), { childList: true, subtree: true, attributes: true });
        eval(src);
        await new Promise((r) => setTimeout(r, 600));
        obs.disconnect();
        return hit ? Math.round(hit - t0) : null;
    }, fnSrc);
    const a = await first('RNP.pick(1001)');
    assert.ok(a !== null && a < 100, 'вкладка артикула ответила за ' + a + ' мс');
    const b = await first('RNP.toggleNotes(!RNP.notesVisible())');
    assert.ok(b !== null && b < 100, '«Заметки по дням» ответили за ' + b + ' мс');
});

(async () => {
    const srv = await serve();
    const base = 'http://127.0.0.1:' + srv.address().port;
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    let failed = 0;
    for (const t of tests) {
        let env;
        try {
            env = await newCabinetPage(browser, base);
            await t.fn(env);
            console.log('ok   ' + t.name);
        } catch (e) {
            failed++;
            console.log('FAIL ' + t.name + '\n     ' + String(e.message || e).split('\n')[0]);
        }
        if (env) await env.ctx.close();
    }
    await browser.close();
    srv.close();
    if (failed) { console.log(failed + ' из ' + tests.length + ' не прошли'); process.exit(1); }
    console.log('e2e кабинета: все ' + tests.length + ' проверки прошли');
})();

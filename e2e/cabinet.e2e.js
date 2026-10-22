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
// В «Σ Общее» по группе карточка «Прибыль» (а с ней и её чип) скрыта — какая группа активна,
// теперь видно по кнопке Σ Общее в списке категорий, не по шапке.
const activeGroupName = (page) => page.evaluate(() => document.querySelector('.rnp-cat-sigma.active')?.closest('.rnp-cat-group')?.querySelector('.rnp-cat-name')?.textContent || '');
const activeGroupCount = (page) => page.evaluate(() => document.querySelector('.rnp-cat-sigma.active')?.closest('.rnp-cat-group')?.querySelector('.rnp-cat-count')?.textContent || '');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('РНП открывается: две группы с кнопкой «Σ Общее», в «Общем» все 4 артикула', async ({ page, errors }) => {
    assert.strictEqual(await page.locator('.rnp-cat-sigma').count(), 2, 'у каждой группы есть кнопка');
    assert.strictEqual(await heroOrders(page), DAYS * ORDERS_PER_DAY.reduce((a, b) => a + b, 0));
    assert.deepStrictEqual(errors, [], 'ошибок скриптов нет: ' + errors.join('; '));
});

test('«Σ Общее» у группы: заказы только по её артикулам, название группы активно в списке категорий', async ({ page }) => {
    const sigma = (name) => page.locator('.rnp-cat-group', { has: page.locator('.rnp-cat-name', { hasText: name }) }).locator('.rnp-cat-sigma');
    await sigma('Укороченные').click();
    await page.waitForFunction(() => /Укороченные/.test(document.querySelector('.rnp-cat-sigma.active')?.closest('.rnp-cat-group')?.querySelector('.rnp-cat-name')?.textContent || ''));
    assert.strictEqual(await activeGroupCount(page), '2');
    assert.strictEqual(await page.locator('.rnp-gh-profit').count(), 0, 'в «Σ Общее» по группе карточки прибыль/баланс/здоровье кабинета скрыты');
    assert.strictEqual(await page.locator('.rnp-gh-runway').count(), 1, 'вместо них — остатки с «хватит на N дней» и хранением в день');
    const todayOrders = await page.evaluate(() => {
        const row = [...document.querySelectorAll('tr')].find((r) => /ЗАКАЗЫ/.test(r.textContent));
        const cells = row ? [...row.querySelectorAll('td')].map((t) => t.textContent.trim()) : [];
        return cells.filter((t) => /^\d+$/.test(t)).pop();
    });
    assert.strictEqual(Number(todayOrders), ORDERS_PER_DAY[0] + ORDERS_PER_DAY[1], 'в таблице за день сумма по группе');
    await sigma('Оверсайз').click();
    await page.waitForFunction(() => /Оверсайз/.test(document.querySelector('.rnp-cat-sigma.active')?.closest('.rnp-cat-group')?.querySelector('.rnp-cat-name')?.textContent || ''));
    assert.strictEqual(await activeGroupCount(page), '2');
});

test('«Общий» возвращает все артикулы после просмотра группы', async ({ page }) => {
    await page.locator('.rnp-cat-sigma').first().click();
    await page.waitForFunction(() => !!document.querySelector('.rnp-cat-sigma.active'));
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

test('один клик по группе сворачивает/разворачивает её мгновенно, второй клик не нужен', async ({ page }) => {
    // Раньше toggleCategory перерисовывал всю панель вкладок (innerHTML) на каждый клик — на
    // кабинете с десятками артикулов это заметно лагало, и нетерпеливый повторный клик успевал
    // отменить первое переключение («приходится нажимать дважды»).
    const group = page.locator('.rnp-cat-group', { has: page.locator('.rnp-cat-name', { hasText: 'Укороченные' }) });
    const header = group.locator('.rnp-cat-header');
    const wasCollapsed = await group.evaluate((el) => el.classList.contains('collapsed'));
    const t0 = Date.now();
    await header.click();
    await page.waitForFunction(
        (was) => {
            const g = [...document.querySelectorAll('.rnp-cat-group')].find((el) => el.querySelector('.rnp-cat-name')?.textContent.trim() === 'Укороченные');
            return g && g.classList.contains('collapsed') !== was;
        },
        wasCollapsed,
        { timeout: 300 }
    );
    assert.ok(Date.now() - t0 < 300, 'группа переключилась за ' + (Date.now() - t0) + ' мс после одного клика');
    const nowCollapsed = await group.evaluate((el) => el.classList.contains('collapsed'));
    assert.notStrictEqual(nowCollapsed, wasCollapsed, 'состояние группы изменилось ровно на один клик');
});

test('«Настройки РНП»: тумблер артикула/группы переключается мгновенно, не ждёт запись в базу', async ({ page }) => {
    // Раньше тумблер визуально отставал от клика на время сетевого запроса (в тесте — latencyMs
    // сети нет, но раньше DOM-патч стоял ПОСЛЕ await записи в базу, и из открытой модалки ещё
    // синхронно перерисовывал всю панель вкладок и таблицу РНП за ней — вместе давало заметный лаг).
    await page.evaluate(() => RNP.openSettings());
    await page.locator('.rnp-settings-groups').waitFor({ state: 'visible' });
    await page.waitForTimeout(200);
    const t0 = Date.now();
    const r = await page.evaluate(() => {
        return new Promise((resolve) => {
            const btn = document.querySelector('#rnp-settings-articles-tbody [data-toggle-nm]');
            if (!btn) return resolve({ error: 'no toggle found' });
            const before = btn.style.background;
            const t0 = performance.now();
            const mo = new MutationObserver(() => { mo.disconnect(); resolve({ ms: Math.round(performance.now() - t0) }); });
            mo.observe(btn, { attributes: true, subtree: true, childList: true });
            RNP.toggleArt(Number(btn.getAttribute('data-toggle-nm')));
            setTimeout(() => resolve({ timeout: true }), 500);
        });
    });
    assert.ok(r.ms != null && r.ms < 100, 'тумблер отреагировал за ' + JSON.stringify(r));
    assert.ok(Date.now() - t0 < 300, 'вызов вернулся быстро, не повис на ожидании записи в базу');
});

test('«Настройки РНП»: группу можно переименовать, она видна под новым именем; артикул виден, только если включены и группа, и он сам', async ({ page }) => {
    await page.evaluate(() => RNP.openSettings());
    await page.locator('.rnp-st-group').first().waitFor({ state: 'visible' });
    const groupNames = () => page.evaluate(() => [...document.querySelectorAll('.rnp-st-name')].map((i) => i.value));
    const tabGroups = () => page.evaluate(() => [...document.querySelectorAll('.rnp-cat-name')].map((e) => e.textContent.trim()));
    const before = await groupNames();
    assert.ok(before.length >= 2, 'группы показаны в настройках: ' + before.join(', '));
    const first = before[0];
    await page.locator('.rnp-st-name').first().fill('Мои любимые');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    assert.ok((await groupNames()).includes('Мои любимые'), 'в настройках новое название');
    assert.ok(await page.locator('.rnp-st-wb').count() >= 1, 'исходное название из WB остаётся мелким текстом');
    // сброс возвращает исходное название
    await page.evaluate((name) => RNP.resetGroupName(name), 'Мои любимые');
    await page.waitForTimeout(300);
    assert.ok((await groupNames()).includes(first), 'после «сбросить» вернулось исходное название ' + first);
    // выключили артикул, он пропал из РНП, выключили группу, пропала вся; включили группу, вернулся только включённый артикул
    const nm = await page.evaluate(() => Number(document.querySelector('.rnp-st-group [data-toggle-nm]').getAttribute('data-toggle-nm')));
    await page.evaluate((n) => RNP.toggleArt(n), nm);
    const g = await page.evaluate(() => document.querySelector('.rnp-st-group').getAttribute('data-g'));
    await page.evaluate((k) => { RNP.toggleGroupVisible(decodeURIComponent(k)); RNP.toggleGroupVisible(decodeURIComponent(k)); }, g);
    await page.evaluate(() => RNP.closeSettings());
    await page.waitForTimeout(500);
    const tabs = await page.evaluate(() => [...document.querySelectorAll('.rnp-sheet-tab:not(.rnp-tab-general):not(.rnp-tab-byart)')].map((e) => e.title));
    assert.ok(!tabs.some((t) => t.includes('WB ' + nm)), 'выключенный артикул не вернулся вместе с группой: ' + tabs.join(' | '));
    void tabGroups;
});

test('«Настройки РНП»: если база отказала в записи, название группы всё равно сохраняется на устройстве и пользователь это видит', async ({ page }) => {
    await page.route(/rnp_settings/, (r) => r.request().method() === 'GET' ? r.fallback() : r.fulfill({ status: 403, contentType: 'application/json', json: { message: 'denied' } }));
    await page.evaluate(() => RNP.openSettings());
    await page.locator('.rnp-st-name').first().waitFor({ state: 'visible' });
    await page.locator('.rnp-st-name').first().fill('Мои любимые');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(600);
    const local = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.indexOf('rnp_local_opts:') === 0).map((k) => localStorage.getItem(k)).join(''));
    assert.ok(local.includes('Мои любимые'), 'название группы лежит в хранилище устройства: ' + local.slice(0, 120));
    assert.ok(await page.locator('.nru-toast').filter({ hasText: 'Не сохранилось' }).count() > 0, 'пользователь видит сообщение, что запись в базу не прошла');
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

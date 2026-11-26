/**
 * Настройки → Вид сайта: «Классический» (меню слева, по умолчанию) и «Стекло» (разделы кнопками сверху).
 * Переключение показывает экран с логотипом, применяется, запоминается и после обновления страницы остаётся.
 * В новом виде полоса меню лежит сверху и не наезжает на заголовок страницы; подразделы выпадают под своей кнопкой.
 * Запуск: node e2e/design-switch.e2e.js
 */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');
const tables = { spaces: [{ id: 's0', user_id: ADMIN_ID, email: 'makstoychubek@gmail.com', status: 'active', tariff_plan: 'vip', is_super_admin: true, first_name: 'M', last_name: 'T', full_name: 'M T' }], cabinets: [{ id: CAB, name: 'Zevina 1', wb_token_set: true, user_id: ADMIN_ID }], team_staff: [{ email: 'makstoychubek@gmail.com' }], user_sessions: [] };
(async () => {
    const srv = await serve();
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    let failed = 0;
    const run = async (name, fn) => { try { await fn(); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + String(e.message || e).split('\n')[0]); } };
    try {
        const env = await openApp(browser, 'http://127.0.0.1:' + srv.address().port, { userId: ADMIN_ID, email: 'makstoychubek@gmail.com', tables, rpcs: { is_super_admin: true }, functions: {} });
        const { page } = env;
        await page.setViewportSize({ width: 1500, height: 860 });
        await page.evaluate(() => { try { localStorage.removeItem('nr_design'); } catch (_) {} const s = document.getElementById('nr-splash'); if (s) s.remove(); });
        await page.reload(); await page.evaluate(() => { const s = document.getElementById('nr-splash'); if (s) s.remove(); }); await page.waitForTimeout(1500);
        const geo = () => page.evaluate(() => { const r = (q) => { const e = document.querySelector(q), b = e.getBoundingClientRect(); return { l: Math.round(b.left), t: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }; }; return { design: document.documentElement.getAttribute('data-design'), rail: r('.sidebar-rail'), header: r('header.app-header'), main: r('.main-rail .main-content') }; });
        await run('по умолчанию классический: меню слева', async () => { const g = await geo(); assert.ok(g.design !== 'glass'); assert.ok(g.rail.h > g.rail.w, 'меню должно быть узкой колонкой: ' + JSON.stringify(g.rail)); });
        await page.evaluate(() => showTab('settings')); await page.waitForTimeout(800);
        await page.evaluate(() => showSettingsSection('design')); await page.waitForSelector('.nr-dz-card', { timeout: 10000 });
        await run('в настройках «Вид сайта» две карточки, классический выбран', async () => {
            const r = await page.evaluate(() => ({ n: document.querySelectorAll('.nr-dz-card').length, on: document.querySelector('.nr-dz-card.on').getAttribute('data-design') }));
            assert.deepStrictEqual(r, { n: 2, on: 'classic' });
        });
        await page.click('.nr-dz-card[data-design="glass"]');
        await run('при переключении появляется экран с логотипом с размытым фоном', async () => {
            await page.waitForSelector('.nr-ds', { timeout: 3000 });
            const r = await page.evaluate(() => { const e = document.querySelector('.nr-ds'); return { img: !!e.querySelector('img'), blur: /blur/.test(getComputedStyle(e).backdropFilter || getComputedStyle(e).webkitBackdropFilter || '') }; });
            assert.deepStrictEqual(r, { img: true, blur: true });
        });
        await page.waitForFunction(() => !document.querySelector('.nr-ds'), null, { timeout: 5000 });
        await run('новый вид: разделы сверху, полоса не наезжает на заголовок страницы, окно под ней', async () => {
            const g = await geo();
            assert.strictEqual(g.design, 'glass');
            assert.ok(g.rail.w > 800 && g.rail.h <= 64 && g.rail.t <= 14, 'полоса меню: ' + JSON.stringify(g.rail));
            assert.ok(g.header.t >= g.rail.t + g.rail.h, 'шапка страницы ниже полосы: ' + JSON.stringify([g.rail, g.header]));
            assert.ok(g.main.t >= g.rail.t + g.rail.h, 'окно страницы ниже полосы: ' + JSON.stringify([g.rail, g.main]));
        });
        await run('выбор запоминается: после обновления страницы новый вид сразу, без мигания', async () => {
            await page.reload(); const first = await page.evaluate(() => document.documentElement.getAttribute('data-design'));
            assert.strictEqual(first, 'glass');
            await page.evaluate(() => { const s = document.getElementById('nr-splash'); if (s) s.remove(); }); await page.waitForTimeout(1200);
        });
        await run('подразделы выпадают под своей кнопкой', async () => {
            await page.hover('.rail-btn[data-tab="rnp"]'); await page.waitForSelector('#fly-rnp.visible', { timeout: 4000 });
            const r = await page.evaluate(() => { const f = document.getElementById('fly-rnp').getBoundingClientRect(), b = document.querySelector('.rail-btn[data-tab="rnp"]').getBoundingClientRect(); return { below: f.top >= b.bottom - 2, aligned: Math.abs(f.left - b.left) < 40 }; });
            assert.deepStrictEqual(r, { below: true, aligned: true });
        });
        await run('выпадающий список подразделов целиком поверх шапки страницы (не прячется под ней)', async () => {
            await page.evaluate(() => showTab('rnp')); await page.waitForTimeout(1500);
            await page.mouse.move(700, 600); await page.waitForTimeout(500);
            await page.hover('.rail-btn[data-tab="goods-groups"]'); await page.waitForSelector('#fly-logi.visible', { timeout: 4000 }); await page.waitForTimeout(500);
            const r = await page.evaluate(() => { const items = [...document.querySelectorAll('#fly-logi [data-nrn]')].filter((e) => e.offsetParent); return { n: items.length, top: items.map((e) => { const b = e.getBoundingClientRect(), hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !!hit && !!hit.closest('#fly-logi'); }) }; });
            assert.ok(r.n >= 2 && r.top.every(Boolean), 'пункты закрыты другим слоем: ' + JSON.stringify(r));
        });
        await run('телефон остаётся прежним (на узком экране вид «Стекло» не применяется)', async () => {
            await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(500);
            const w = await page.evaluate(() => Math.round(document.querySelector('.sidebar-rail').getBoundingClientRect().width));
            assert.ok(w < 300, 'ширина панели на телефоне: ' + w);
            await page.setViewportSize({ width: 1500, height: 860 });
        });
        await run('ошибок скриптов нет', async () => assert.deepStrictEqual(env.errors || [], []));
    } finally { await browser.close(); srv.close(); }
    if (failed) { console.log('e2e вида сайта: провалено ' + failed); process.exit(1); }
    console.log('e2e вида сайта: все проверки прошли');
})();

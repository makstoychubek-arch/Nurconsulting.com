/**
 * РНП: кнопка «Скрыть» вместо «Сравнить с октябрём» (владелец, 24 ноября 2026). Пока зажата, фото, названия и артикул размыты, цифры нет;
 * отпустили, и всё вернулось. Запуск: node e2e/rnp-blur.e2e.js
 */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');
const day = (n) => new Date(Date.now() + 6 * 3600e3 - n * 86400e3).toISOString().slice(0, 10);
const ARTS = [{ nm: 1218802103, sa: 'Свитер-бордо', cat: 'Свитера', ph: 'https://x/1.jpg' }, { nm: 1218782505, sa: 'Свитер-айвори', cat: 'Свитера', ph: 'https://x/2.jpg' }];
const tables = {
    spaces: [{ id: 's0', user_id: ADMIN_ID, email: 'makstoychubek@gmail.com', status: 'active', tariff_plan: 'vip', is_super_admin: true, first_name: 'M', last_name: 'T', full_name: 'M T' }],
    cabinets: [{ id: CAB, name: 'T', wb_token_set: true, user_id: ADMIN_ID }],
    rnp_articles: ARTS.map((a, i) => ({ id: 'a' + i, cabinet_id: CAB, nm_id: a.nm, seller_article: a.sa, name: a.sa, category: a.cat, is_active: true, cost_price: 1000, photo_url: a.ph, sort_order: i, manual_data: { seller_article: a.sa } })),
    rnp_daily_data: ARTS.flatMap((a) => Array.from({ length: 10 }, (_, d) => ({ cabinet_id: CAB, nm_id: a.nm, date: day(d + 1), orders_count: 5, orders_sum: 20000, sales_count: 3, sales_sum: 9000 }))),
};
(async () => {
    const srv = await serve(); const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    let failed = 0;
    const run = async (name, fn) => { try { await fn(); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + String(e.message || e).split('\n')[0]); } };
    try {
        const env = await openApp(browser, 'http://127.0.0.1:' + srv.address().port, { userId: ADMIN_ID, email: 'makstoychubek@gmail.com', latencyMs: 10, tables, rpcs: { is_super_admin: true }, functions: { 'wb-proxy': async () => ({}) } });
        const { page } = env; await page.setViewportSize({ width: 1500, height: 1000 });
        await page.evaluate(() => { const s = document.getElementById('nr-splash'); if (s) s.remove(); showTab('rnp'); }); await page.waitForTimeout(3500);
        await page.evaluate(() => RNP.pick(1218802103)); await page.waitForTimeout(1800);
        const f = (sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).filter : 'нет'; }, sel);
        await run('вместо «Сравнить с октябрём» стоит кнопка «Скрыть»', async () => {
            assert.ok(await page.locator('.rnp-blur-btn').count() >= 1, 'нет кнопки блюра');
            assert.strictEqual(await page.locator('.rnp-compare-month-btn').count(), 0, 'кнопка сравнения месяцев убрана');
        });
        await run('пока кнопка зажата: фото, название и артикул размыты, цифры нет; отпустили, и всё вернулось', async () => {
            const sels = ['.rnp-tab-img', '.rnp-tab-label', '.rnp-gs-photo-img', '.rnp-gs-name', '.rnp-wb-link'];
            for (const s of sels) assert.ok(/none|нет/.test(await f(s)), 'до нажатия без блюра ' + s);
            const box = await page.locator('.rnp-blur-btn:visible').first().boundingBox();
            await page.mouse.move(box.x + 8, box.y + 8); await page.mouse.down(); await page.waitForTimeout(150);
            for (const s of sels) assert.ok(/blur/.test(await f(s)), 'зажата: размыто ' + s + ' (' + await f(s) + ')');
            assert.ok(/none/.test(await f('td.rnp-day-col')), 'цифры не размыты');
            await page.mouse.up(); await page.waitForTimeout(150);
            for (const s of sels) assert.ok(/none/.test(await f(s)), 'отпустили: блюра нет ' + s);
        });
        await run('блюр отпускается и при потере фокуса окна', async () => {
            const box = await page.locator('.rnp-blur-btn:visible').first().boundingBox();
            await page.mouse.move(box.x + 8, box.y + 8); await page.mouse.down(); await page.waitForTimeout(100);
            await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await page.waitForTimeout(100);
            assert.ok(/none/.test(await f('.rnp-tab-img')), 'после blur окна блюра нет');
            await page.mouse.up();
        });
        await run('ошибок скриптов нет', async () => assert.deepStrictEqual(env.errors || [], []));
    } finally { await browser.close(); srv.close(); }
    if (failed) { console.log('e2e блюра РНП: провалено ' + failed); process.exit(1); }
    console.log('e2e блюра РНП: все проверки прошли');
})();

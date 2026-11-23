/**
 * РНП: горизонтальная прокрутка колесом и тачпадом родная (браузер двигает таблицу сам), без своего замедления и «догоняния».
 * Владелец, 23 ноября 2026: ранее прокрутка была плавнее, самодельную убрали. Вертикальный жест по-прежнему не даёт сдвига вбок.
 * Запуск: node e2e/rnp-hscroll.e2e.js
 */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');
const day = (n) => new Date(Date.now() + 6 * 3600e3 - n * 86400e3).toISOString().slice(0, 10);
const NM = 296556350;
const tables = {
    spaces: [{ id: 's0', user_id: ADMIN_ID, email: 'makstoychubek@gmail.com', status: 'active', tariff_plan: 'vip', is_super_admin: true, first_name: 'M', last_name: 'T', full_name: 'M T' }],
    cabinets: [{ id: CAB, name: 'T', wb_token_set: true, user_id: ADMIN_ID }],
    rnp_articles: [{ id: 'a0', cabinet_id: CAB, nm_id: NM, seller_article: 'x', name: 'x', category: 'К1', is_active: true, cost_price: 1300, photo_url: null, sort_order: 0 }],
    rnp_daily_data: Array.from({ length: 12 }, (_, d) => ({ cabinet_id: CAB, nm_id: NM, date: day(d), orders_count: 3 + (d % 5), orders_sum: 9000 + d * 500, sales_count: 3, sales_sum: 15000, ad_spend: 300, impressions: 500, clicks: 20 })),
    wb_stocks: [],
};
(async () => {
    const srv = await serve();
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    let failed = 0;
    const run = async (name, fn) => { try { await fn(); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + String(e.message || e).split('\n')[0]); } };
    try {
        const env = await openApp(browser, 'http://127.0.0.1:' + srv.address().port, { userId: ADMIN_ID, email: 'makstoychubek@gmail.com', latencyMs: 30, tables, rpcs: { is_super_admin: true }, functions: { 'wb-proxy': async () => ({}) } });
        const { page } = env;
        await page.setViewportSize({ width: 1000, height: 800 });
        await page.evaluate(() => { const s = document.getElementById('nr-splash'); if (s) s.remove(); });
        await page.evaluate(() => showTab('rnp'));
        await page.waitForFunction(() => window.RNP && typeof RNP.pick === 'function' && document.querySelector('#rnp-sheet-body'), null, { timeout: 20000 });
        await page.evaluate((nm) => RNP.pick(nm), NM);
        await page.waitForSelector('.rnp-sheet-table td[data-rnp-metric="orders_sum"]', { timeout: 20000 });
        await page.waitForTimeout(800);
        await page.evaluate(() => { window.__wp = []; window.addEventListener('wheel', (e) => window.__wp.push(e.defaultPrevented), { passive: true }); });
        const box = await page.evaluate(() => { const b = document.querySelector('#rnp-sheet-body'), r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, over: b.scrollWidth - b.clientWidth }; });
        await page.mouse.move(box.x, box.y);
        await run('таблица шире окна (есть что прокручивать)', async () => assert.ok(box.over > 100, 'нет горизонтальной прокрутки: ' + box.over));
        await run('горизонтальное колесо: браузер сам двигает таблицу, событие не отменяется, сдвиг сразу полный', async () => {
            await page.evaluate(() => { document.querySelector('#rnp-sheet-body').scrollLeft = 0; window.__wp = []; });
            await page.mouse.wheel(300, 0); await page.waitForTimeout(60);
            const r = await page.evaluate(() => ({ prevented: window.__wp.some(Boolean), left: document.querySelector('#rnp-sheet-body').scrollLeft }));
            assert.strictEqual(r.prevented, false, 'колесо отменено скриптом');
            assert.ok(r.left >= 250, 'сдвиг должен быть родным (≈ 300 пикс), а не замедленным: ' + r.left);
        });
        await run('вертикальный жест не даёт сдвиг вбок', async () => {
            await page.evaluate(() => { document.querySelector('#rnp-sheet-body').scrollLeft = 100; });
            await page.evaluate(() => { const b = document.querySelector('#rnp-sheet-body'); b.dispatchEvent(new WheelEvent('wheel', { deltaX: 3, deltaY: 120, bubbles: true, cancelable: true })); });
            const l = await page.evaluate(() => document.querySelector('#rnp-sheet-body').scrollLeft);
            assert.strictEqual(l, 100);
        });
        await run('ошибок скриптов нет', async () => assert.deepStrictEqual(env.errors || [], []));
    } finally { await browser.close(); srv.close(); }
    if (failed) { console.log('e2e прокрутки РНП: провалено ' + failed); process.exit(1); }
    console.log('e2e прокрутки РНП: все проверки прошли');
})();

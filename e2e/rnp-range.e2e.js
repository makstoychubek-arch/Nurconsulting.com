/** РНП: колонки таблицы совпадают с периодом в шапке (октябрь не превращается в ноябрь). Запуск: npm run test:e2e */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');
const day = (n) => new Date(Date.now() + 6 * 3600e3 - n * 86400e3).toISOString().slice(0, 10);
const tables = {
    spaces: [{ id: 's0', user_id: ADMIN_ID, email: 'makstoychubek@gmail.com', status: 'active', tariff_plan: 'vip', is_super_admin: true, first_name: 'M', last_name: 'T', full_name: 'M T' }],
    cabinets: [{ id: CAB, name: 'T', wb_token_set: true, user_id: ADMIN_ID }],
    rnp_articles: [{ id: 'a0', cabinet_id: CAB, nm_id: 1001, seller_article: 'a', name: 'a', category: 'K', is_active: true, cost_price: 100 }],
    rnp_daily_data: Array.from({ length: 60 }, (_, d) => ({ cabinet_id: CAB, nm_id: 1001, date: day(d), orders_count: 5, orders_sum: 5000, sales_count: 3 })),
};
const cols = (page) => page.evaluate(() => [...document.querySelectorAll('#tab-rnp .rnp-workspace *')].filter((e) => !e.children.length).map((e) => e.textContent.trim()).filter((t) => /^\d\d\.\d\d$/.test(t)).filter((v, i, a) => a.indexOf(v) === i));
(async () => {
    const srv = await serve(); const base = 'http://127.0.0.1:' + srv.address().port;
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    try {
        const env = await openApp(browser, base, { userId: ADMIN_ID, email: 'makstoychubek@gmail.com', tables, rpcs: { is_super_admin: true }, functions: { 'wb-proxy': async () => ({}) } });
        const { page } = env;
        await page.evaluate(() => { const s = document.getElementById('nr-splash'); if (s) s.remove(); });
        await page.evaluate(() => showTab('rnp'));
        await page.waitForFunction(() => window.RNP && document.querySelector('#tab-rnp .rnp-workspace'), null, { timeout: 20000 });
        await page.waitForTimeout(2000);
        await page.evaluate(() => showTab('dashboard')); await page.waitForTimeout(1200);
        // сохранённый для РНП период — октябрь; заходим в РНП: колонки только октябрьские
        await page.evaluate(() => { const y = new Date().getFullYear(); const m = JSON.parse(localStorage.getItem('nr_date_range_by_tab_v1') || '{}'); m.rnp = { from: y + '-10-01', to: y + '-10-31' }; localStorage.setItem('nr_date_range_by_tab_v1', JSON.stringify(m)); });
        await page.evaluate(() => showTab('rnp')); await page.waitForTimeout(3500);
        let c = await cols(page);
        assert.ok(c.length >= 28 && c.every((d) => d.endsWith('.10')), 'колонки октября: ' + c.slice(0, 5));
        // снова ноябрь через выбор дат, потом обновление страницы: снимок ноября не должен перебить выбранный октябрь
        await page.goto(base + '/space'); await page.waitForTimeout(1500);
        await page.evaluate(() => { const s = document.getElementById('nr-splash'); if (s) s.remove(); });
        await page.waitForTimeout(5500);
        c = await cols(page);
        assert.ok(c.length >= 28 && c.every((d) => d.endsWith('.10')), 'после обновления колонки октября: ' + c.slice(0, 5));
        assert.deepStrictEqual(env.errors, [], 'ошибок скриптов нет: ' + env.errors.join('; '));
        console.log('ok   РНП: колонки таблицы совпадают с периодом в шапке');
    } catch (e) { console.error('FAIL', e.message); process.exitCode = 1; }
    finally { await browser.close(); srv.close(); }
})();

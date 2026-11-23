/**
 * РНП: числа в колонках дней не наезжают друг на друга (владелец, 23 ноября 2026: «числа в РНП выходят криво»).
 * Шестизначная сумма с таблеткой подсветки должна помещаться в колонку дня при любом шрифте и размере из Настройки РНП → Шрифт;
 * «Крупнее» и «Ещё крупнее» увеличивают цифры в ячейках, ширина колонок растёт сама. Запуск: node e2e/rnp-fit.e2e.js
 */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');
const day = (n) => new Date(Date.now() + 6 * 3600e3 - n * 86400e3).toISOString().slice(0, 10);
const NM = 1001;
const tables = {
    spaces: [{ id: 's0', user_id: ADMIN_ID, email: 'makstoychubek@gmail.com', status: 'active', tariff_plan: 'vip', is_super_admin: true, first_name: 'M', last_name: 'T', full_name: 'M T' }],
    cabinets: [{ id: CAB, name: 'T', wb_token_set: true, user_id: ADMIN_ID }],
    rnp_articles: [{ id: 'a0', cabinet_id: CAB, nm_id: NM, seller_article: 'x', name: 'x', category: 'К1', is_active: true, cost_price: 1300, photo_url: null, sort_order: 0 }],
    rnp_daily_data: Array.from({ length: 12 }, (_, d) => ({ cabinet_id: CAB, nm_id: NM, date: day(d), orders_count: 3, orders_sum: 888888 - d * 1111, sales_count: 3, sales_sum: 888888, ad_spend: 300, impressions: 500, clicks: 20 })),
    wb_stocks: [],
};
(async () => {
    const srv = await serve();
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    let failed = 0;
    try {
        const env = await openApp(browser, 'http://127.0.0.1:' + srv.address().port, { userId: ADMIN_ID, email: 'makstoychubek@gmail.com', tables, rpcs: { is_super_admin: true }, functions: { 'wb-proxy': async () => ({}) } });
        const { page } = env;
        await page.setViewportSize({ width: 1500, height: 860 });
        await page.evaluate(() => { try { localStorage.removeItem('nr_rnp_heat_v1'); } catch (_) {} const s = document.getElementById('nr-splash'); if (s) s.remove(); });
        await page.evaluate(() => showTab('rnp'));
        await page.waitForFunction(() => window.RNP && RNP.pick, null, { timeout: 20000 });
        await page.evaluate((nm) => RNP.pick(nm), NM);
        await page.waitForSelector('.rnp-sheet-table td[data-rnp-metric="orders_sum"]', { timeout: 20000 });
        await page.waitForTimeout(800);
        const sizes = [];
        for (const [f, s] of [['site', 0], ['site', 2], ['sheet', 0], ['sheet', 2], ['wide', 0], ['wide', 2], ['mono', 1]]) {
            await page.evaluate(([f, s]) => { RNP.heatSet('font', f); RNP.heatSet('fs', s); }, [f, s]);
            await page.waitForTimeout(500);
            const r = await page.evaluate(() => {
                const tds = [...document.querySelectorAll('.rnp-sheet-table td[data-rnp-metric="orders_sum"]')].filter((t) => /\d{3}\s?\d{3}/.test(t.textContent));
                let over = 0;
                tds.forEach((t) => { const rg = document.createRange(); rg.selectNodeContents(t); if (rg.getBoundingClientRect().width > t.clientWidth + 0.5) over++; });
                return { n: tds.length, over, fs: parseFloat(getComputedStyle(tds[0]).fontSize), cell: tds[0].clientWidth };
            });
            sizes.push([f, s, r.fs]);
            try { assert.ok(r.n >= 5 && r.over === 0, JSON.stringify(r)); console.log('ok   шрифт ' + f + ', размер ' + s + ': шестизначные суммы помещаются (колонка ' + r.cell + 'px, цифры ' + r.fs + 'px)'); }
            catch (e) { failed++; console.log('FAIL шрифт ' + f + ', размер ' + s + ': ' + e.message); }
        }
        try { const base = sizes.find((x) => x[0] === 'site' && x[1] === 0)[2], big = sizes.find((x) => x[0] === 'site' && x[1] === 2)[2]; assert.ok(big > base, base + ' → ' + big); console.log('ok   «Ещё крупнее» увеличивает цифры в ячейках (' + base + 'px → ' + big + 'px)'); }
        catch (e) { failed++; console.log('FAIL размер цифр не меняется: ' + e.message); }
        try { assert.deepStrictEqual(env.errors || [], []); console.log('ok   ошибок скриптов нет'); } catch (e) { failed++; console.log('FAIL ошибки скриптов'); }
    } finally { await browser.close(); srv.close(); }
    if (failed) { console.log('e2e ширины чисел РНП: провалено ' + failed); process.exit(1); }
    console.log('e2e ширины чисел РНП: все проверки прошли');
})();

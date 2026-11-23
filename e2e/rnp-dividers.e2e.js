/**
 * РНП: блоки таблицы разделены серой плашкой с линией сверху (владелец, 23 ноября 2026), в светлой и тёмной темах.
 * Плашка серая (не белая и не розовая), линия сверху 3px цветом текста темы. Запуск: node e2e/rnp-dividers.e2e.js
 */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');
const day = (n) => new Date(Date.now() + 6 * 3600e3 - n * 86400e3).toISOString().slice(0, 10);
const NM = 1001;
const tables = {
    spaces: [{ id: 's0', user_id: ADMIN_ID, email: 'makstoychubek@gmail.com', status: 'active', tariff_plan: 'vip', is_super_admin: true, first_name: 'M', last_name: 'T', full_name: 'M T' }],
    cabinets: [{ id: CAB, name: 'T', wb_token_set: true, user_id: ADMIN_ID }],
    rnp_articles: [{ id: 'a0', cabinet_id: CAB, nm_id: NM, seller_article: 'x', name: 'x', category: 'К1', is_active: true, cost_price: 1300, photo_url: null, sort_order: 0 }],
    rnp_daily_data: Array.from({ length: 12 }, (_, d) => ({ cabinet_id: CAB, nm_id: NM, date: day(d), orders_count: 3 + (d % 5), orders_sum: 9000 + d * 900, sales_count: 3, sales_sum: 15000, ad_spend: 300, impressions: 500, clicks: 20 })),
    wb_stocks: [],
};
(async () => {
    const srv = await serve();
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    let failed = 0;
    try {
        const env = await openApp(browser, 'http://127.0.0.1:' + srv.address().port, { userId: ADMIN_ID, email: 'makstoychubek@gmail.com', tables, rpcs: { is_super_admin: true }, functions: { 'wb-proxy': async () => ({}) } });
        const { page } = env;
        await page.setViewportSize({ width: 1500, height: 900 });
        await page.evaluate(() => { const s = document.getElementById('nr-splash'); if (s) s.remove(); showTab('rnp'); });
        await page.waitForFunction(() => window.RNP && RNP.pick, null, { timeout: 20000 });
        await page.evaluate((nm) => RNP.pick(nm), NM);
        await page.waitForSelector('.rnp-sheet-table tr.rnp-section-hdr', { timeout: 20000 });
        for (const theme of ['ios', 'neon']) {
            await page.evaluate((t) => applyTheme(t), theme); await page.waitForTimeout(500);
            const r = await page.evaluate(() => {
                const rgbOf = (c) => { const m = c.match(/[\d.]+/g).map(Number); return /^color\(srgb/.test(c) ? m.slice(0, 3).map((v) => v * 255) : m.slice(0, 3); };
                const lum = (c) => { const m = rgbOf(c); return (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) / 255; };
                const hdrs = [...document.querySelectorAll('.rnp-sheet-table tr.rnp-section-hdr')];
                const probe = document.createElement('div'); probe.style.background = 'var(--surface-solid)'; document.body.appendChild(probe);
                const surf = lum(getComputedStyle(probe).backgroundColor); probe.remove();
                return hdrs.slice(0, 6).map((h) => [...h.children].slice(0, 3).map((c) => { const s = getComputedStyle(c); return { bg: s.backgroundColor, rgb: rgbOf(s.backgroundColor), lum: lum(s.backgroundColor), top: s.borderTopWidth, topc: s.borderTopColor, text: s.color }; })).concat([{ surf }]);
            });
            try {
                const surf = r.pop().surf; assert.ok(r.length >= 3, 'блоков мало: ' + r.length);
                r.forEach((cells) => cells.forEach((c) => {
                    assert.strictEqual(c.top, '3px', 'линия сверху 3px: ' + JSON.stringify(c));
                    assert.ok(Math.abs(c.lum - surf) > 0.03 && Math.abs(c.lum - surf) < 0.3, 'плашка серая, отличается от фона слегка: ' + JSON.stringify(c) + ' фон ' + surf);
                    const m = c.rgb; assert.ok(Math.abs(m[0] - m[1]) < 6 && Math.abs(m[1] - m[2]) < 8, 'плашка без розового оттенка: ' + c.bg);
                }));
                console.log('ok   тема ' + theme + ': ' + r.length + ' блоков, плашка серая с линией сверху');
            } catch (e) { failed++; console.log('FAIL тема ' + theme + ': ' + e.message.slice(0, 400)); }
        }
        try { assert.deepStrictEqual(env.errors || [], []); console.log('ok   ошибок скриптов нет'); } catch (e) { failed++; console.log('FAIL ошибки скриптов'); }
    } finally { await browser.close(); srv.close(); }
    if (failed) { console.log('e2e разделителей РНП: провалено ' + failed); process.exit(1); }
    console.log('e2e разделителей РНП: все проверки прошли');
})();

/**
 * Каркас страницы не прыгает при обновлении: заголовок и первый блок остаются на месте с первого кадра до готовой страницы.
 * Запуск: node e2e/layout-shift.e2e.js.
 */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');

const tables = {
    spaces: [{ id: 's0', user_id: ADMIN_ID, email: 'makstoychubek@gmail.com', status: 'active', tariff_plan: 'vip', is_super_admin: true, first_name: 'M', last_name: 'T', full_name: 'M T' }],
    cabinets: [{ id: CAB, name: 'T', wb_token_set: true, user_id: ADMIN_ID }],
};
(async () => {
    const srv = await serve();
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    try {
        const base = 'http://127.0.0.1:' + srv.address().port;
        const env = await openApp(browser, base, { userId: ADMIN_ID, email: 'makstoychubek@gmail.com', latencyMs: 120, tables, rpcs: { is_super_admin: true }, functions: { 'wb-proxy': async () => ({}) } });
        const { page } = env;
        await page.addInitScript(() => {
            window.__tops = []; window.__body = []; window.__chart = [];
            setInterval(() => { const t = document.getElementById('page-title'); if (t) window.__tops.push(Math.round(t.getBoundingClientRect().top)); const ch = document.getElementById('pnl-chart-card'); if (ch && ch.getBoundingClientRect().height > 20) window.__chart.push(Math.round(ch.getBoundingClientRect().top)); const c = document.querySelector('.main-content > .tab-content.active'); if (c && c.getBoundingClientRect().height > 20) window.__body.push(Math.round(c.getBoundingClientRect().top)); }, 40);
        });
        for (const [tab, view] of [['dashboard'], ['goods-groups'], ['advertising'], ['ab-testing'], ['rnp', 'unit'], ['rnp', 'prices'], ['rnp-planfact'], ['rnp-planning']]) {
            await page.evaluate(([t, v]) => { localStorage.setItem('nr_active_tab', t); if (v) localStorage.setItem('nr_rnp_view', v); else localStorage.removeItem('nr_rnp_view'); }, [tab, view]);
            await page.goto(base + '/space'); await page.waitForTimeout(3500);
            const tops = await page.evaluate(() => window.__tops);
            const lo = Math.min(...tops), hi = Math.max(...tops);
            assert.ok(tops.length > 5 && hi - lo <= 1, 'заголовок «' + tab + (view ? ':' + view : '') + '» не прыгает при загрузке: от ' + lo + ' до ' + hi + 'px');
            const bt = await page.evaluate(() => window.__body);
            assert.ok(bt.length > 5 && Math.max(...bt) - Math.min(...bt) <= 1, 'содержимое «' + tab + (view ? ':' + view : '') + '» не съезжает при загрузке: от ' + Math.min(...bt) + ' до ' + Math.max(...bt) + 'px');
            console.log('ok   ' + tab + (view ? ':' + view : '') + ': заголовок на месте с первого кадра (' + lo + 'px)');
        }
        await page.evaluate(() => { localStorage.setItem('nr_active_tab', 'dashboard'); localStorage.removeItem('nr_rnp_view'); });
        await page.goto(base + '/space'); await page.waitForSelector('#pnl-mini .pnl-mini', { timeout: 8000 });
        const h = await page.evaluate(() => Math.round(document.querySelector('#pnl-mini .pnl-mini').getBoundingClientRect().height));
        assert.ok(h >= 121, 'карточки «Заказы/Выкупы» в каркасе той же высоты, что готовые: ' + h);
        const ct = await page.evaluate(() => window.__chart);
        assert.ok(ct.length > 0 && Math.max(...ct) - Math.min(...ct) <= 2, 'график «Динамика» на дашборде не уезжает, когда приходят данные: от ' + Math.min(...ct) + ' до ' + Math.max(...ct) + 'px');
        console.log('ok   дашборд: полоса баланса держит место, график не уезжает (' + Math.min(...ct) + 'px)');
        console.log('ok   дашборд: ряд карточек держит высоту готовых (' + h + 'px)');
        assert.deepStrictEqual(env.errors.filter((e) => !/404|favicon/.test(e)), [], 'в консоли нет ошибок');
    } catch (e) { console.error('FAIL', e.message); process.exitCode = 1; } finally { await browser.close(); srv.close(); }
})();

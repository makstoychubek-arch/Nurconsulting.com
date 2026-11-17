/**
 * Единый каркас (ПК): меню слева и страница справа двумя блоками со скруглением 28px, от краёв 12px, между ними 12px.
 * Каркас не двигается ни при каких условиях: переключение разделов, наведение на подразделы, окна, смена темы, масштаб.
 * Выбор пункта меню ничего не затемняет. Запуск: node e2e/shell-frame.e2e.js.
 */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');

(async () => {
    const srv = await serve();
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    try {
        const tables = { spaces: [{ id: 's0', user_id: ADMIN_ID, email: 'makstoychubek@gmail.com', status: 'active', tariff_plan: 'vip', is_super_admin: true, first_name: 'M', last_name: 'T', full_name: 'M T' }], cabinets: [{ id: CAB, name: 'Zevina 1', wb_token_set: true, user_id: ADMIN_ID }] };
        const env = await openApp(browser, 'http://127.0.0.1:' + srv.address().port, { userId: ADMIN_ID, email: 'makstoychubek@gmail.com', latencyMs: 20, tables, rpcs: { is_super_admin: true }, functions: {} });
        const { page } = env;
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.evaluate(() => { const s = document.getElementById('nr-splash'); if (s) s.remove(); });
        await page.waitForTimeout(1200);
        const frame = () => page.evaluate(() => {
            const r = (q) => { const e = document.querySelector(q); const b = e.getBoundingClientRect(); return [b.left, b.top, b.width, b.height].map((n) => Math.round(n * 10) / 10); };
            const rail = document.querySelector('.sidebar-rail'), mc = document.querySelector('.main-rail .main-content'), hd = document.querySelector('header.app-header');
            return { rail: r('.sidebar-rail'), main: r('.main-rail .main-content'), header: r('header.app-header').slice(0, 3), railBr: getComputedStyle(rail).borderRadius, mainBr: getComputedStyle(mc).borderRadius, filter: getComputedStyle(hd).filter, dim: getComputedStyle(document.querySelector('.sidebar-app'), '::before').display };
        });
        const base = await frame();
        assert.deepStrictEqual(base.rail.slice(0, 2), [12, 12], 'меню: 12px от левого и верхнего края: ' + base.rail);
        assert.strictEqual(base.rail[1] + base.rail[3] + 12, 800, 'меню: 12px до нижнего края');
        assert.strictEqual(base.main[0] - (base.rail[0] + base.rail[2]), 12, 'между меню и страницей 12px: ' + base.main[0] + ' ' + (base.rail[0] + base.rail[2]));
        assert.strictEqual(base.main[1], 12, 'страница: 12px сверху');
        assert.strictEqual(1280 - (base.main[0] + base.main[2]), 12, 'страница: 12px справа');
        assert.ok(parseFloat(base.railBr) >= 28 && parseFloat(base.mainBr) >= 28, 'оба блока со скруглением 28px: ' + base.railBr + ' ' + base.mainBr);
        assert.strictEqual(base.header[1], 12, 'шапка не выступает над блоком страницы (белой полосы сверху нет)');
        assert.strictEqual(base.dim, 'none', 'выезд подраздела не затемняет страницу');
        assert.strictEqual(base.filter, 'none', 'шапка не затемняется');
        const same = async (label) => { const f = await frame(); assert.deepStrictEqual([f.rail, f.main, f.header], [base.rail, base.main, base.header], 'каркас не сдвинулся: ' + label + ' ' + JSON.stringify([f.rail, f.main, f.header])); assert.strictEqual(f.dim, 'none', label + ': без затемнения'); assert.strictEqual(f.filter, 'none', label + ': шапка не затемнена'); };
        for (const tab of ['rnp', 'advertising', 'settings', 'goods-groups', 'dashboard']) { await page.evaluate((t) => showTab(t), tab); await page.waitForTimeout(500); await same('раздел ' + tab); }
        for (const label of ['Инструменты', 'Аналитика', 'Продвижение']) { const b = await page.$('text=' + label); if (b) { await b.hover(); await page.waitForTimeout(500); await same('подраздел ' + label); } }
        await page.mouse.move(700, 400);
        await page.evaluate(() => openAddCabinetModal()); await page.waitForTimeout(600); await same('окно открыто');
        await page.keyboard.press('Escape'); await page.waitForTimeout(300);
        for (const t of ['ios', 'neon']) { await page.evaluate((x) => applyTheme(x), t); await page.waitForTimeout(500); await same('тема ' + t); }
        await page.evaluate(() => { document.documentElement.style.setProperty('--nr-zoom', '0.75'); }); await page.waitForTimeout(300); await same('масштаб страницы');
        console.log('ok   каркас: два блока 28px, зазор 12px, не двигается и не затемняется (разделы, подразделы, окно, тема, масштаб)');
        assert.deepStrictEqual(env.errors, [], 'ошибок скриптов нет: ' + env.errors.join('; '));
    } catch (e) { console.error('FAIL', e.message); process.exitCode = 1; } finally { await browser.close(); srv.close(); }
})();

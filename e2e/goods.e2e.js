/**
 * Товары → Остатки: при смене кабинета остатки прошлого кабинета не показываются, пока не придут новые.
 * Запуск: npm run test:e2e. Путь к Chromium можно задать через PW_CHROMIUM.
 */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID } = require('./harness.js');

const CAB_A = 'cccccccc-0000-0000-0000-00000000000a';
const CAB_B = 'cccccccc-0000-0000-0000-00000000000b';
const art = (cab, nm, name) => ({ id: 'a' + nm, cabinet_id: cab, nm_id: nm, name, category: 'Брюки', is_active: true, cost_price: 100, manual_data: {} });
const stock = (cab, nm) => ({ cabinet_id: cab, nm_id: nm, quantity: 5, stock_scheme: 'fbo' });

(async () => {
    const srv = await serve();
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    try {
        const tables = {
            spaces: [{ id: 's0', user_id: ADMIN_ID, email: 'makstoychubek@gmail.com', status: 'active', tariff_plan: 'vip', is_super_admin: true, first_name: 'M', last_name: 'T', full_name: 'M T' }],
            cabinets: [{ id: CAB_A, name: 'Кабинет А', wb_token_set: true, user_id: ADMIN_ID }, { id: CAB_B, name: 'Кабинет Б', wb_token_set: true, user_id: ADMIN_ID }],
            rnp_articles: [art(CAB_A, 111, 'Брюки из кабинета А')], wb_stocks: [stock(CAB_A, 111)],
        };
        const env = await openApp(browser, 'http://127.0.0.1:' + srv.address().port, { userId: ADMIN_ID, email: 'makstoychubek@gmail.com', latencyMs: 600, tables, rpcs: { is_super_admin: true }, functions: {} });
        const { page } = env;
        await page.evaluate(() => showTab('goods-groups'));
        await page.waitForFunction(() => /кабинета А/.test(document.getElementById('gg-table-body').innerText), null, { timeout: 15000 });
        // меняем «базу» на данные другого кабинета и переключаемся
        tables.rnp_articles = [art(CAB_B, 222, 'Брюки из кабинета Б')];
        tables.wb_stocks = [stock(CAB_B, 222)];
        await page.evaluate((id) => window.nrSelectCabinet(id), CAB_B);
        await page.waitForTimeout(250);
        const during = await page.evaluate(() => document.getElementById('gg-table-body').innerText);
        assert.ok(!/кабинета А/.test(during), 'после смены кабинета старые остатки не видны: ' + during.slice(0, 80));
        await page.waitForFunction(() => /кабинета Б/.test(document.getElementById('gg-table-body').innerText), null, { timeout: 15000 });
        console.log('ok   Товары: после смены кабинета остатки прошлого кабинета не показываются');
        console.log('e2e товаров: все проверки прошли');
    } catch (e) {
        console.error('FAIL', e.message);
        process.exitCode = 1;
    } finally {
        await browser.close(); srv.close();
    }
})();

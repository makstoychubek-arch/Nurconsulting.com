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
        const env = await openApp(browser, 'http://127.0.0.1:' + srv.address().port, { userId: ADMIN_ID, email: 'makstoychubek@gmail.com', latencyMs: 600, tables, rpcs: { is_super_admin: true }, functions: { 'wb-proxy': (body) => (body.action === 'fbs_stock_adjust' ? { applied: !!body.params.apply, sent: body.params.apply ? 1 : 0, warehouse: body.params.warehouse, rows: body.params.items.map((i) => ({ nm_id: i.nm_id, size: i.size, qty: i.qty, sku: 'x', was: 50, will: 50 - i.qty, ok: true, why: '' })) } : []) } });
        const { page } = env;
        await page.evaluate(() => showTab('goods-groups'));
        await page.waitForFunction(() => /кабинета А/.test((document.getElementById('ggx-cards') || {}).innerText || ''), null, { timeout: 15000 });
        // списание с FBS: проверка показывает «было → станет», отправка только по кнопке
        await page.waitForSelector('#ggx-adj-btn', { timeout: 8000 });
        await page.click('#ggx-adj-btn');
        await page.fill('#ggx-adj-t', '111: 42-3, 44-4');
        await page.click('#ggx-adj [data-chk]');
        await page.waitForSelector('#ggx-adj-r table', { timeout: 6000 });
        assert.ok(/47/.test(await page.textContent('#ggx-adj-r')) && /46/.test(await page.textContent('#ggx-adj-r')), 'видно «станет»');
        assert.strictEqual(await page.evaluate(() => document.querySelector('#ggx-adj [data-go]').disabled), false);
        await page.click('#ggx-adj [data-go]');
        await page.waitForFunction(() => /Отправлено на WB/.test(document.getElementById('ggx-adj-r').innerText), null, { timeout: 6000 });
        await page.click('#ggx-adj [data-x]');
        console.log('ok   Списание с FBS: таблица «было → станет», отправка по кнопке');
        // меняем «базу» на данные другого кабинета и переключаемся
        tables.rnp_articles = [art(CAB_B, 222, 'Брюки из кабинета Б')];
        tables.wb_stocks = [stock(CAB_B, 222)];
        await page.evaluate((id) => window.nrSelectCabinet(id), CAB_B);
        await page.waitForTimeout(250);
        const during = await page.evaluate(() => (document.getElementById('ggx-cards') || {}).innerText || '');
        assert.ok(!/кабинета А/.test(during), 'после смены кабинета старые остатки не видны: ' + during.slice(0, 80));
        await page.waitForFunction(() => /кабинета Б/.test((document.getElementById('ggx-cards') || {}).innerText || ''), null, { timeout: 15000 });
        console.log('ok   Товары: после смены кабинета остатки прошлого кабинета не показываются');
        console.log('e2e товаров: все проверки прошли');
    } catch (e) {
        console.error('FAIL', e.message);
        process.exitCode = 1;
    } finally {
        await browser.close(); srv.close();
    }
})();

/** Переключатель WB / Ozon: площадка без подключения у кабинета не нажимается. Запуск: node e2e/mp-avail.e2e.js */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');

const CAB2 = 'cccccccc-0000-0000-0000-000000000002';
const tables = {
    spaces: [{ id: 's0', user_id: ADMIN_ID, email: 'makstoychubek@gmail.com', status: 'active', tariff_plan: 'vip', is_super_admin: true, first_name: 'M', last_name: 'T', full_name: 'M T' }],
    cabinets: [
        { id: CAB, name: 'Только WB', wb_token_set: true, ozon_client_id: null, ozon_api_key_set: false, user_id: ADMIN_ID },
        { id: CAB2, name: 'Обе площадки', wb_token_set: true, ozon_client_id: '123', ozon_api_key_set: true, user_id: ADMIN_ID },
    ],
};
(async () => {
    const srv = await serve();
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    try {
        const env = await openApp(browser, 'http://127.0.0.1:' + srv.address().port, { userId: ADMIN_ID, email: 'makstoychubek@gmail.com', latencyMs: 30, tables, rpcs: { is_super_admin: true }, functions: { 'wb-proxy': async () => ({}) } });
        const { page } = env;
        await page.waitForSelector('#nr-mp button[data-mp="ozon"]', { state: 'attached', timeout: 10000 });
        await page.evaluate((id) => { const s = document.getElementById('cabinet-select-header'); s.value = id; onCabinetChange(); }, CAB);
        await page.waitForTimeout(500);
        const na = await page.evaluate(() => ({ ozon: document.querySelector('#nr-mp [data-mp="ozon"]').classList.contains('is-na'), all: document.querySelector('#nr-mp [data-mp="all"]').classList.contains('is-na'), wb: document.querySelector('#nr-mp [data-mp="wb"]').classList.contains('is-na') }));
        assert.deepStrictEqual(na, { ozon: true, all: true, wb: false }, 'у кабинета без Ozon кнопки Ozon и «Вместе» серые: ' + JSON.stringify(na));
        await page.evaluate(() => NrMp.set('ozon'));
        assert.strictEqual(await page.evaluate(() => NrMp.get()), 'wb', 'нажатие на недоступную площадку ничего не меняет');
        console.log('ok   кабинет без Ozon: Ozon и «Вместе» не нажимаются');
        await page.evaluate((id) => { const s = document.getElementById('cabinet-select-header'); s.value = id; onCabinetChange(); }, CAB2);
        await page.waitForTimeout(500);
        await page.evaluate(() => NrMp.set('ozon'));
        assert.strictEqual(await page.evaluate(() => NrMp.get()), 'ozon', 'у кабинета с обеими площадками Ozon включается');
        // возвращаемся на кабинет без Ozon: показываем WB, выбор человека (Ozon) помним
        await page.evaluate((id) => { const s = document.getElementById('cabinet-select-header'); s.value = id; onCabinetChange(); }, CAB);
        await page.waitForTimeout(600);
        assert.strictEqual(await page.evaluate(() => NrMp.get()), 'wb', 'на кабинете без Ozon показывается WB');
        await page.evaluate((id) => { const s = document.getElementById('cabinet-select-header'); s.value = id; onCabinetChange(); }, CAB2);
        await page.waitForTimeout(600);
        assert.strictEqual(await page.evaluate(() => NrMp.get()), 'ozon', 'при возврате на кабинет с Ozon выбор человека вернулся');
        console.log('ok   смена кабинета: недоступная площадка заменяется на WB, выбор человека возвращается');
        assert.deepStrictEqual(env.errors.filter((e) => !/404|favicon/.test(e)), [], 'в консоли нет ошибок');
    } catch (e) { console.error('FAIL', e.message); process.exitCode = 1; } finally { await browser.close(); srv.close(); }
})();

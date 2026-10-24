/**
 * Человек сидит на экране «подключите магазин», ему выдают кабинет: страница находит его сама, без перезагрузки.
 * Запуск: npm run test:e2e. Путь к Chromium можно задать через PW_CHROMIUM.
 */
const assert = require('assert');
const { serve, openApp, chromium } = require('./harness.js');

const UID = '11111111-1111-1111-1111-111111111111';
(async () => {
    const srv = await serve();
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    try {
        const env = await openApp(browser, 'http://127.0.0.1:' + srv.address().port, {
            userId: UID, email: 'owner@example.test', latencyMs: 50,
            tables: { spaces: [{ id: 's1', user_id: UID, email: 'owner@example.test', status: 'active', tariff_plan: 'premium', is_super_admin: false }], cabinets: [] },
            rpcs: { is_super_admin: false, is_staff: false, viewer_cabinets: [] }, functions: {},
        });
        const { page } = env;
        await page.waitForFunction(() => typeof cabinetsLoaded !== 'undefined' && cabinetsLoaded === true, null, { timeout: 15000 });
        assert.strictEqual(await page.evaluate(() => hasUserCabinets), false, 'сначала кабинетов нет');
        // кабинет выдали
        await page.route(/rest\/v1\/rpc\/viewer_cabinets/, (r) => r.fulfill({ json: [{ id: 'cccccccc-0000-0000-0000-0000000000aa', name: 'Baza', sections: ['all'] }] }));
        await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
        await page.waitForFunction(() => hasUserCabinets === true, null, { timeout: 6000 });
        console.log('ok   выданный кабинет появляется сам, без перезагрузки страницы');
        console.log('e2e выдачи кабинета: все проверки прошли');
    } catch (e) {
        console.error('FAIL', e.message);
        process.exitCode = 1;
    } finally {
        await browser.close(); srv.close();
    }
})();

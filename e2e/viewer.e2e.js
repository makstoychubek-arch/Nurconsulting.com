/**
 * Человек сидит на экране «подключите магазин», ему выдают кабинет: страница находит его сама, без перезагрузки.
 * Запуск: npm run test:e2e. Путь к Chromium можно задать через PW_CHROMIUM.
 */
const assert = require('assert');
const { serve, openApp, chromium } = require('./harness.js');

const UID = '11111111-1111-1111-1111-111111111111';
(async () => {
    const tables = { spaces: [{ id: 's1', user_id: UID, email: 'owner@example.test', status: 'active', tariff_plan: 'premium', is_super_admin: false }], cabinets: [] };
    const srv = await serve();
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    try {
        const env = await openApp(browser, 'http://127.0.0.1:' + srv.address().port, {
            userId: UID, email: 'owner@example.test', latencyMs: 50,
            tables,
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
        // владелец кабинета: без плашки, Логистика, А-Б, Telegram
        tables.cabinet_viewers = [{ user_id: UID, cabinet_id: 'cccccccc-0000-0000-0000-0000000000aa', role: 'owner', sections: ['all'] }];
        await page.evaluate(() => { window.NrViewer.enable([{ id: 'cccccccc-0000-0000-0000-0000000000aa', name: 'Baza', sections: ['all'] }]); });
        await page.waitForFunction(() => document.documentElement.hasAttribute('data-owner'), null, { timeout: 6000 });
        const own = await page.evaluate(() => ({ banner: !!document.getElementById('nr-viewer-banner'), tabs: [...window.NrViewer.tabs], tg: !!document.querySelector('.rail-btn[data-tab="tg-owner"]'), dash: getComputedStyle(document.querySelector('.rail-btn[data-tab="advertising"]')).display, rnp: getComputedStyle(document.querySelector('.rail-btn[data-tab="rnp"]')).display, dashB: getComputedStyle(document.querySelector('.rail-btn[data-tab="dashboard"]')).display }));
        assert.strictEqual(own.banner, false, 'у владельца нет плашки');
        assert.deepStrictEqual(own.tabs.sort(), ['ab-testing', 'advertising', 'dashboard', 'goods-groups', 'rnp', 'tg-owner']);
        assert.ok(own.tg, 'кнопка Telegram есть');
        assert.notStrictEqual(own.dash, 'none', 'РК виден');
        assert.notStrictEqual(own.rnp, 'none', 'РНП виден');
        assert.notStrictEqual(own.dashB, 'none', 'Дашборд виден');
        console.log('ok   владелец кабинета видит Дашборд, РНП, РК, Логистика, А/Б и Telegram, без плашки');
        // «Доступ для знакомых»: шестерёнка владельца открывает окно, добавление видно сразу
        let added = null;
        await page.route(/rest\/v1\/rpc\/cabinet_watchers/, (r) => r.fulfill({ json: { can_manage: true, limit: 5, items: [{ email: 'friend@example.test', status: 'active', since: '2026-10-24' }] } }));
        await page.route(/rest\/v1\/rpc\/cabinet_watcher_add/, (r) => { added = r.request().postDataJSON(); r.fulfill({ json: { status: 'invited' } }); });
        await page.evaluate(() => document.getElementById('rail-settings-btn').click());
        await page.waitForSelector('#nr-set-acc .nr-acc-r', { timeout: 4000 });
        assert.ok((await page.textContent('#nr-set-acc')).includes('friend@example.test'), 'в настройках виден знакомый');
        assert.strictEqual(await page.evaluate(() => document.querySelector('.tab-content.active').id), 'tab-tg-owner', 'шестерёнка открывает раздел, а не окно');
        await page.fill('#nr-set-acc input', 'new@example.test');
        await page.click('#nr-set-acc [data-add]');
        assert.ok((await page.textContent('#nr-set-acc')).includes('new@example.test'), 'добавленный виден сразу');
        await page.waitForTimeout(300);
        assert.strictEqual(added && added.p_email, 'new@example.test', 'на сервер ушла почта');
        console.log('ok   доступ для знакомых: раздел настроек открывается из шестерёнки, добавление видно сразу');
        console.log('e2e выдачи кабинета: все проверки прошли');
    } catch (e) {
        console.error('FAIL', e.message);
        process.exitCode = 1;
    } finally {
        await browser.close(); srv.close();
    }
})();

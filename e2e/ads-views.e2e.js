/**
 * Продвижение: «Раздачи» и «Контент» открываются отдельно, кампании над ними не видны.
 * Запуск: node e2e/ads-views.e2e.js. Путь к Chromium можно задать через PW_CHROMIUM.
 */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');

(async () => {
    const srv = await serve();
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    try {
        const env = await openApp(browser, 'http://127.0.0.1:' + srv.address().port, {
            userId: ADMIN_ID, email: 'admin@example.com', latencyMs: 20, rpcs: { is_super_admin: true },
            tables: { spaces: [{ id: 's0', user_id: ADMIN_ID, email: 'admin@example.com', status: 'active', tariff_plan: 'vip', is_super_admin: true, full_name: 'M' }], cabinets: [{ id: CAB, name: 'T', wb_token_set: true, user_id: ADMIN_ID }], giveaways: [] },
        });
        const { page } = env;
        await page.evaluate(() => showTab('advertising'));
        await page.waitForSelector('#nr-ads-tabs [data-av]', { state: 'attached', timeout: 10000 });
        const shown = () => page.evaluate(() => getComputedStyle(document.getElementById('adv-view-ads')).display !== 'none');
        assert.ok(await shown(), 'на «Кампании» кампании видны');
        for (const view of ['give', 'content']) {
            await page.evaluate((v) => document.querySelector('#nr-ads-tabs [data-av="' + v + '"]').click(), view);
            await page.waitForTimeout(700); // дольше, чем перерисовка рекламных модулей
            assert.ok(!(await shown()), 'открыто «' + view + '»: кампании выше не видны');
        }
        await page.evaluate(() => document.querySelector('#nr-ads-tabs [data-av="ads"]').click());
        assert.ok(await shown(), 'обратно на «Кампании»: они снова видны');
        console.log('ok   «Раздачи» и «Контент» открываются отдельно, кампании над ними не видны');
        assert.deepStrictEqual(env.errors.filter((e) => !/404|favicon/.test(e)), [], 'в консоли нет ошибок');
    } finally { await browser.close(); srv.close(); }
})().catch((e) => { console.error(e); process.exit(1); });

/**
 * Предзагрузка РНП в фоне: пока человек на дашборде, кэш устройства прогревается (артикулы, остатки, дневные данные),
 * без открытия РНП и без карточки загрузки. Запуск: node e2e/rnp-prewarm.e2e.js.
 */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');

const tables = {
    spaces: [{ id: 's0', user_id: ADMIN_ID, email: 'makstoychubek@gmail.com', status: 'active', tariff_plan: 'vip', is_super_admin: true, first_name: 'M', last_name: 'T', full_name: 'M T' }],
    cabinets: [{ id: CAB, name: 'T', wb_token_set: true, user_id: ADMIN_ID }],
    rnp_articles: [{ id: 'a0', cabinet_id: CAB, nm_id: 1001, name: 'a', category: 'К', is_active: true, cost_price: 1000, sort_order: 0 }],
};

(async () => {
    const srv = await serve();
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    try {
        const env = await openApp(browser, 'http://127.0.0.1:' + srv.address().port, { userId: ADMIN_ID, email: 'makstoychubek@gmail.com', latencyMs: 30, tables, rpcs: { is_super_admin: true } });
        const { page } = env;
        const packed = [];
        page.on('request', (r) => { const m = /\/rest\/v1\/rpc\/(nr_pack_[a-z_]+)/.exec(r.url()); if (m) { let b = ''; try { b = r.postData() || ''; } catch (e) { /* ок */ } packed.push(m[1] + ' ' + b.slice(0, 200)); } });
        await page.evaluate(() => { const s = document.getElementById('nr-splash'); if (s) s.remove(); showTab('dashboard'); });
        // прогрев стартует через ~5 секунд после загрузки, когда браузер свободен
        await page.waitForFunction(() => window.RNP_prewarm, null, { timeout: 15000 });
        await page.waitForTimeout(9000);
        const tabs = await page.evaluate(() => ({ rnpActive: document.getElementById('tab-rnp').classList.contains('active'), card: document.querySelectorAll('.nrl-card').length }));
        assert.strictEqual(tabs.rnpActive, false, 'РНП не открывали');
        assert.strictEqual(tabs.card, 0, 'карточки загрузки нет');
        const daily = packed.filter((x) => /rnp_daily_data/.test(x)), arts = packed.filter((x) => /rnp_articles/.test(x)), stocks = packed.filter((x) => /wb_stocks/.test(x));
        // остатки могут не запрашиваться: в песочнице у сервера нет функции упаковки, и кэш-слой сам отключается после первого ответа
        assert.ok(daily.length && arts.length, 'прогрев запросил дневные данные и артикулы: ' + packed.length + ' запросов (' + daily.length + '/' + arts.length + '/' + stocks.length + ')');
        assert.deepStrictEqual(env.errors, [], 'ошибок скриптов нет: ' + env.errors.join('; '));
        console.log('ok   предзагрузка РНП в фоне: кэш прогрет без открытия РНП (' + packed.length + ' запросов)');
    } catch (e) {
        console.error('FAIL', e.message);
        process.exitCode = 1;
    } finally {
        await browser.close();
        srv.close();
    }
})();

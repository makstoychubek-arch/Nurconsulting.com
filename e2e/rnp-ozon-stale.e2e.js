/**
 * РНП Ozon: цифры сразу из кэша устройства, свежие тянутся в фоне. Если фон не получился (таймаут базы), сайт повторяет и затем
 * коротко говорит, что на экране прежние цифры, а не молчит (владелец, 23 ноября 2026: Ozon показал картину двухдневной давности).
 * Запуск: node e2e/rnp-ozon-stale.e2e.js
 */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');
const day = (n) => new Date(Date.now() + 6 * 3600e3 - n * 86400e3).toISOString().slice(0, 10);
const NM = 9993927562;
const tables = { spaces: [{ id: 's0', user_id: ADMIN_ID, email: 'makstoychubek@gmail.com', status: 'active', tariff_plan: 'vip', is_super_admin: true, first_name: 'M', last_name: 'T', full_name: 'M T' }], cabinets: [{ id: CAB, name: 'Z', wb_token_set: true, ozon_client_id: '123', ozon_api_key_set: true, user_id: ADMIN_ID }] };
const art = { id: 'ozon-a', name: 'костюм_оверсайз_бежевый', nm_id: NM, category: 'К', is_active: true, cost_price: 100, sort_order: 0, manual_data: {}, other_costs_unit: 0, logistics_unit: 0 };
const fin = Array.from({ length: 5 }, (_, d) => ({ cabinet_id: CAB, nm_id: NM, date: day(d), orders_count: 10, orders_sum: 10000, sales_count: 10, sales_sum: 10000, realization: 10000, commission_pct: 20, to_transfer: 7800 }));
const RPCS = { is_super_admin: true, ozon_rnp_articles: [art], ozon_finance_daily: fin, ozon_stock_rows: [], ozon_orders_daily: [] };
(async () => {
    const srv = await serve();
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    let failed = 0;
    try {
        const env = await openApp(browser, 'http://127.0.0.1:' + srv.address().port, { userId: ADMIN_ID, email: 'makstoychubek@gmail.com', latencyMs: 20, tables, rpcs: RPCS, functions: { 'wb-proxy': async () => ({}) } });
        const { page } = env;
        await page.evaluate(() => { const s = document.getElementById('nr-splash'); if (s) s.remove(); NrMp.set('ozon'); showTab('rnp'); });
        await page.waitForFunction(() => Object.keys(localStorage).some((k) => k.startsWith('nr_oz_ozon_finance_daily_')), null, { timeout: 20000 }); // кэш заполнен
        // база перестаёт отвечать, паузы повторов сокращены
        await page.route(/rpc\/ozon_finance_daily/, (r) => r.fulfill({ status: 500, json: { message: 'canceling statement due to statement timeout' } }));
        await page.addInitScript(() => { window.__ozRetryMs = [60, 60, 60]; window.__sawStale = false; new MutationObserver(() => { if (/свежие данные не загрузились/.test(document.body.textContent)) window.__sawStale = true; }).observe(document, { childList: true, subtree: true, characterData: true }); });
        await page.goto('http://127.0.0.1:' + srv.address().port + '/space'); // адрес /rnp у тестового сервера не обслуживается
        await page.waitForFunction(() => typeof NrMp !== 'undefined' && typeof RNP !== 'undefined' && typeof showTab === 'function', null, { timeout: 20000 });
        await page.waitForTimeout(2500); // кабинет и подключённые площадки подтягиваются после загрузки
        await page.evaluate(() => { const s = document.getElementById('nr-splash'); if (s) s.remove(); NrMp.set('ozon'); showTab('rnp'); });
        try {
            await page.waitForFunction(() => window.__sawStale === true, null, { timeout: 25000, polling: 50 });
            console.log('ok   фон не получился: после повторов сайт сказал, что показаны прежние цифры');
        } catch (e) { failed++; console.log('FAIL тост о неудачном обновлении не появился'); }
        try { const shown = await page.evaluate(() => /ЗАКАЗЫ/.test(document.body.textContent)); assert.ok(shown); console.log('ok   прежние цифры остались на экране'); } catch (e) { failed++; console.log('FAIL экран пустой'); }
    } finally { await browser.close(); srv.close(); }
    if (failed) { console.log('e2e устаревших данных Ozon: провалено ' + failed); process.exit(1); }
    console.log('e2e устаревших данных Ozon: все проверки прошли');
})();

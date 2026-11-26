/**
 * РНП: переключение на Ozon без ожидания (владелец, 23 ноября 2026: «долгая загрузка фото и значений»).
 * Пока человек на WB, цифры и артикулы Ozon прогреваются в кэш устройства (ключи те же, что у _ozCall), фото артикулов предзагружаются.
 * Проверка: при медленной базе (1,5 с на запрос) первое переключение на Ozon рисует таблицу быстрее, чем база успевает ответить.
 * Запуск: node e2e/rnp-ozon-prewarm.e2e.js
 */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');
const day = (n) => new Date(Date.now() + 6 * 3600e3 - (n + 1) * 86400e3).toISOString().slice(0, 10);
const NM = 9993927562;
const tables = { spaces: [{ id: 's0', user_id: ADMIN_ID, email: 'makstoychubek@gmail.com', status: 'active', tariff_plan: 'vip', is_super_admin: true, first_name: 'M', last_name: 'T', full_name: 'M T' }], cabinets: [{ id: CAB, name: 'Z', wb_token_set: true, ozon_client_id: '123', ozon_api_key_set: true, user_id: ADMIN_ID }] };
const art = { id: 'ozon-a', name: 'костюм_оверсайз_бежевый', nm_id: NM, category: 'К', is_active: true, cost_price: 100, sort_order: 0, manual_data: {}, other_costs_unit: 0, logistics_unit: 0, photo_url: 'http://127.0.0.1:1/p.jpg' };
const fin = Array.from({ length: 12 }, (_, d) => ({ cabinet_id: CAB, nm_id: NM, date: day(d), orders_count: 10, orders_sum: 10000, sales_count: 10, sales_sum: 10000, realization: 10000, commission_pct: 20, to_transfer: 7800 }));
const RPCS = { is_super_admin: true, ozon_rnp_articles: [art], ozon_finance_daily: fin, ozon_stock_rows: [], ozon_orders_daily: [] };
const LATENCY = 1500;
(async () => {
    const srv = await serve();
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    let failed = 0;
    const run = async (name, fn) => { try { await fn(); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + String(e.message || e).split('\n')[0]); } };
    try {
        const env = await openApp(browser, 'http://127.0.0.1:' + srv.address().port, { userId: ADMIN_ID, email: 'makstoychubek@gmail.com', latencyMs: 30, tables, rpcs: RPCS, functions: { 'wb-proxy': async () => ({}) } });
        const { page } = env;
        await page.evaluate(() => { const s = document.getElementById('nr-splash'); if (s) s.remove(); showTab('dashboard'); Object.keys(localStorage).filter((k) => k.startsWith('nr_oz_')).forEach((k) => localStorage.removeItem(k)); });
        await page.waitForSelector('#nr-mp [data-mp="ozon"]:not(.is-na)', { state: 'attached', timeout: 20000 });
        // на новом устройстве запомненного периода нет: прогрев берёт календарный месяц, как РНП по умолчанию
        await page.evaluate(() => { Object.keys(localStorage).filter((k) => k.startsWith('nr_rnp_pw')).forEach((k) => localStorage.removeItem(k)); });
        await page.evaluate(() => window.RNP_prewarmOzon());
        await run('прогрев кладёт в кэш устройства артикулы и цифры Ozon', async () => {
            const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('nr_oz_')).map((k) => k.replace(/_cccccccc.*$/, '')));
            for (const need of ['nr_oz_ozon_rnp_articles', 'nr_oz_ozon_finance_daily', 'nr_oz_ozon_stock_rows']) assert.ok(keys.includes(need), 'нет ' + need + ': ' + keys);
        });
        // человек уже в РНП на WB и нажимает Ozon
        await page.evaluate(() => showTab('rnp'));
        await page.waitForFunction(() => document.querySelector('#tab-rnp .rnp-workspace'), null, { timeout: 20000 });
        await page.waitForTimeout(1500);
        // база стала медленной: каждый запрос Ozon отвечает 1,5 с
        await page.route(/rpc\/ozon_/, async (r) => { await new Promise((res) => setTimeout(res, LATENCY)); await r.fallback(); });
        const t0 = Date.now();
        await page.evaluate(() => { NrMp.set('ozon'); });
        await page.waitForFunction(() => document.querySelector('#tab-rnp .rnp-sheet-table td[data-rnp-metric="orders_count"]'), null, { timeout: 20000, polling: 50 });
        const dt = Date.now() - t0;
        await run('первое переключение на Ozon рисует таблицу быстрее, чем отвечает база (' + dt + ' мс при базе ' + LATENCY + ' мс)', async () => assert.ok(dt < LATENCY, dt + ' мс'));
        await run('ошибок скриптов нет', async () => assert.deepStrictEqual(env.errors || [], []));
    } finally { await browser.close(); srv.close(); }
    if (failed) { console.log('e2e прогрева Ozon: провалено ' + failed); process.exit(1); }
    console.log('e2e прогрева Ozon: все проверки прошли');
})();

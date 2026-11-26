/**
 * РНП Ozon: внизу таблицы блок «Баланс Ozon» из двух строк, как «Баланс WB» (владелец, 23 ноября 2026): баланс на конец дня и на начало месяца
 * по ozon_balance_daily, дни без снимка с прочерком. У WB блок остаётся «Баланс WB». Запуск: node e2e/rnp-ozon-balance.e2e.js
 */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');
const day = (n) => new Date(Date.now() + 6 * 3600e3 - n * 86400e3).toISOString().slice(0, 10);
const NM = 9993927562;
const tables = {
    spaces: [{ id: 's0', user_id: ADMIN_ID, email: 'makstoychubek@gmail.com', status: 'active', tariff_plan: 'vip', is_super_admin: true, first_name: 'M', last_name: 'T', full_name: 'M T' }],
    cabinets: [{ id: CAB, name: 'Z', wb_token_set: true, ozon_client_id: '123', ozon_api_key_set: true, user_id: ADMIN_ID }],
    ozon_balance_daily: [{ cabinet_id: CAB, d: day(1), closing: 273600.74, opening: 135549.58 }, { cabinet_id: CAB, d: day(2), closing: 168205.61, opening: 135549.58 }, { cabinet_id: CAB, d: day(4), closing: 122939.33, opening: 135549.58 }],
    rnp_articles: [{ id: 'a0', cabinet_id: CAB, nm_id: 1001, seller_article: 'wb', name: 'wb', category: 'К1', is_active: true, cost_price: 1000, photo_url: null, sort_order: 0 }],
    rnp_daily_data: Array.from({ length: 8 }, (_, d) => ({ cabinet_id: CAB, nm_id: 1001, date: day(d), orders_count: 3, orders_sum: 9000, sales_count: 3, sales_sum: 15000, ad_spend: 300, impressions: 500, clicks: 20 })),
    wb_stocks: [],
    exchange_rates: [{ pair: 'RUB_KGS', date: day(20), rate: 1.1, source: 'manual' }],
    ozon_payouts: [],
};
const art = { id: 'ozon-a', name: 'костюм_оверсайз_бежевый', nm_id: NM, category: 'К', is_active: true, cost_price: 100, sort_order: 0, manual_data: {}, other_costs_unit: 0, logistics_unit: 0, cabinet_id: CAB };
const fin = Array.from({ length: 8 }, (_, d) => ({ cabinet_id: CAB, nm_id: NM, date: day(d), orders_count: 10, orders_sum: 10000, sales_count: 10, sales_sum: 10000, realization: 10000, commission_pct: 20, to_transfer: 7800, delivery_sum: 1500, storage_sum: 10, penalty_sum: 0, deduction_sum: 300, ad_spend: 200, ad_charged: 250, transit_count: 7 }));
(async () => {
    const srv = await serve();
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    let failed = 0;
    const run = async (name, fn) => { try { await fn(); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + String(e.message || e).split('\n')[0]); } };
    try {
        const env = await openApp(browser, 'http://127.0.0.1:' + srv.address().port, { userId: ADMIN_ID, email: 'makstoychubek@gmail.com', latencyMs: 20, tables, rpcs: { is_super_admin: true, ozon_rnp_articles: [art], ozon_finance_daily: fin, ozon_stock_rows: [], ozon_orders_daily: [] }, functions: { 'wb-proxy': async () => ({}) } });
        const { page } = env;
        await page.setViewportSize({ width: 1500, height: 1500 });
        await page.evaluate(() => { const s = document.getElementById('nr-splash'); if (s) s.remove(); NrMp.set('ozon'); showTab('rnp'); });
        await page.waitForFunction(() => [...document.querySelectorAll('#tab-rnp tr')].some((r) => /^Реализация/.test((r.children[0] || {}).innerText || '')), null, { timeout: 20000 });
        await page.evaluate(() => RNP.pick('general'));
        await page.waitForFunction(() => [...document.querySelectorAll('#tab-rnp tr')].some((r) => /^Баланс Ozon, ₽/.test((r.children[0] || {}).innerText || '')), null, { timeout: 20000 });
        const read = (re) => page.evaluate((src) => { const r = [...document.querySelectorAll('#tab-rnp table tr')].find((x) => new RegExp(src).test(((x.children[0] || {}).innerText || '').replace(/\s+/g, ' ').trim())); return r ? [...r.querySelectorAll('td.rnp-day-col')].map((t) => t.textContent.replace(/\s/g, '').trim()) : null; }, re.source);
        await run('в режиме Ozon внизу блок «Баланс Ozon»: баланс и выплата', async () => {
            const labels = await page.evaluate(() => [...document.querySelectorAll('#tab-rnp table tr')].map((r) => ((r.children[0] || {}).innerText || '').replace(/\s+/g, ' ').trim()));
            const i = labels.findIndex((l) => /БАЛАНС OZON/i.test(l));
            assert.ok(i > 0, 'нет заголовка блока: ' + labels.slice(-8));
            assert.strictEqual(labels[i + 1], 'Баланс Ozon, ₽'); assert.strictEqual(labels[i + 2], 'Выплата Ozon, с'); assert.ok(!labels.some((l) => /^На начало месяца/.test(l)), 'строки «На начало месяца» больше нет');
            assert.ok(!labels.some((l) => /Баланс WB|Доступно к выводу/.test(l)), 'строки WB в Ozon не показываются');
        });
        await run('баланс Ozon показан только итогом: по дням пусто, в «Итог» последний снимок в рублях', async () => {
            const bal = await read(/^Баланс Ozon, ₽/);
            assert.ok(bal.every((x) => x === ''), 'по дням баланса быть не должно: ' + JSON.stringify(bal));
            const total = await page.evaluate(() => { const r = [...document.querySelectorAll('#tab-rnp table tr')].find((x) => /^Баланс Ozon, ₽/.test(((x.children[0] || {}).innerText || '').replace(/\s+/g, ' ').trim())); const tds = r ? [...r.querySelectorAll('td')] : []; return tds.slice(-3).map((t) => t.textContent.replace(/\s/g, '').trim()); });
            // баланс Ozon приходит в рублях и в таблице тоже в рублях (как в кабинете Ozon Seller), без пересчёта в сомы
            assert.ok(total.includes('273601'), 'в итоге последний снимок 273 601 ₽: ' + JSON.stringify(total));
        });
        await run('строка «Выплата Ozon»: сумму вносят вручную в ячейку дня, видна в таблице и в итоге', async () => {
            const labels = await page.evaluate(() => [...document.querySelectorAll('#tab-rnp table tr')].map((r) => ((r.children[0] || {}).innerText || '').replace(/\s+/g, ' ').trim()));
            assert.ok(labels.includes('Выплата Ozon, с'), 'нет строки выплаты: ' + labels.slice(-6));
            await page.evaluate(() => { const r = [...document.querySelectorAll('#tab-rnp table tr')].find((x) => /^Выплата Ozon/.test(((x.children[0] || {}).innerText || '').trim())); const el = r.querySelectorAll('input.rnp-plan-input')[4]; el.value = '137953'; el.dispatchEvent(new Event('change', { bubbles: true })); });
            await page.waitForTimeout(800);
            const vals = await page.evaluate(() => [...document.querySelectorAll('#tab-rnp table tr')].find((x) => /^Выплата Ozon/.test(((x.children[0] || {}).innerText || '').trim())).querySelectorAll('input.rnp-plan-input').length && [...[...document.querySelectorAll('#tab-rnp table tr')].find((x) => /^Выплата Ozon/.test(((x.children[0] || {}).innerText || '').trim())).querySelectorAll('input.rnp-plan-input')].map((i) => i.value));
            assert.ok(vals.includes('137953'), 'значение осталось в ячейке: ' + JSON.stringify(vals));
        });
        await page.evaluate(() => { NrMp.set('wb'); }); await page.waitForTimeout(1500);
        await run('у WB блок остаётся «Баланс WB», строк Ozon нет', async () => {
            const labels = await page.evaluate(() => [...document.querySelectorAll('#tab-rnp table tr')].map((r) => ((r.children[0] || {}).innerText || '').replace(/\s+/g, ' ').trim()));
            assert.ok(!labels.some((l) => /Баланс Ozon|На начало месяца|Выплата Ozon/.test(l)), 'строки Ozon у WB: ' + labels.slice(-8));
        });
        await run('ошибок скриптов нет', async () => assert.deepStrictEqual(env.errors || [], []));
    } finally { await browser.close(); srv.close(); }
    if (failed) { console.log('e2e баланса Ozon: провалено ' + failed); process.exit(1); }
    console.log('e2e баланса Ozon: все проверки прошли');
})();

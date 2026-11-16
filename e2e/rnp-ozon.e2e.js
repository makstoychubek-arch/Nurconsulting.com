/**
 * РНП Ozon: «Прочие удержания и доплаты» раскрываются своими видами Ozon (не WB-шными), «К выводу» = перечисление − логистика − хранение − штрафы − удержания − реклама (списания).
 * Запуск: node e2e/rnp-ozon.e2e.js.
 */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');

const day = (n) => new Date(Date.now() + 6 * 3600e3 - n * 86400e3).toISOString().slice(0, 10);
const NM = 9993927562;
const tables = {
    spaces: [{ id: 's0', user_id: ADMIN_ID, email: 'makstoychubek@gmail.com', status: 'active', tariff_plan: 'vip', is_super_admin: true, first_name: 'M', last_name: 'T', full_name: 'M T' }],
    cabinets: [{ id: CAB, name: 'Z', wb_token_set: true, ozon_api_key_set: true, user_id: ADMIN_ID }],
};
const art = { id: 'ozon-a', name: 'костюм_оверсайз_бежевый', nm_id: NM, category: 'К', is_active: true, cost_price: 100, sort_order: 0, manual_data: {}, other_costs_unit: 0, logistics_unit: 0, cabinet_id: CAB };
const fin = Array.from({ length: 5 }, (_, d) => ({ cabinet_id: CAB, nm_id: NM, date: day(d), orders_count: 10, orders_sum: 10000, sales_count: 10, sales_sum: 10000, realization: 10000, commission_pct: 20, to_transfer: 7800, delivery_sum: 1500, storage_sum: 10, penalty_sum: 0, deduction_sum: 300, ad_spend: 200, ad_charged: 250, transit_count: 7, ded_prem: 100, ded_bonus: 400, ded_move: 50, ded_rest: -250 }));
const RPCS = { is_super_admin: true, ozon_rnp_articles: [art], ozon_finance_daily: fin, ozon_stock_rows: [], ozon_orders_daily: [] };

(async () => {
    const srv = await serve();
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    try {
        const env = await openApp(browser, 'http://127.0.0.1:' + srv.address().port, { userId: ADMIN_ID, email: 'makstoychubek@gmail.com', latencyMs: 20, tables, rpcs: RPCS, functions: { 'wb-proxy': async () => ({}) } });
        const { page } = env;
        await page.evaluate(() => { const s = document.getElementById('nr-splash'); if (s) s.remove(); NrMp.set('ozon'); showTab('rnp'); });
        await page.waitForFunction(() => [...document.querySelectorAll('#tab-rnp tr')].some((r) => /^Реализация/.test((r.children[0] || {}).innerText || '')), null, { timeout: 15000 });
        await page.evaluate(() => RNP.pick('general')); await page.waitForTimeout(1200);
        const readRow = (name) => page.evaluate((n) => { const r = [...document.querySelectorAll('#tab-rnp table tr')].find((x) => ((x.children[0] || {}).innerText || '').replace(/\s+/g, ' ').trim().replace(/\s*[▸▾]$/, '') === n); if (!r) return null; return Number(String(r.querySelector('td:last-child').innerText).replace(/[^0-9,.-]/g, '').replace(',', '.')); }, name);
        const oth = await readRow('Прочие удержания и доплаты'), ad = await readRow('Реклама (РК)'), pay = await readRow('К выводу');
        assert.strictEqual(oth, 5 * 300, 'прочие удержания: ' + oth);
        assert.strictEqual(ad, 5 * 250, 'реклама в расходах = списания Ozon (250/день), а не статистика (200): ' + ad);
        assert.strictEqual(pay, 5 * (7800 - 1500 - 10 - 0 - 300 - 250), '«К выводу» Ozon: ' + pay);
        await page.evaluate(() => RNP.toggleSplit('other_net_sum')); await page.waitForTimeout(700);
        const labels = await page.evaluate(() => [...document.querySelectorAll('#tab-rnp table tr')].map((r) => ((r.children[0] || {}).innerText || '').replace(/\s+/g, ' ').trim()));
        for (const need of ['Premium Pro и отзывы', 'Бонусы продавца', 'Перемещение и вывоз', 'Прочее и возмещения']) assert.ok(labels.includes(need), 'у Ozon есть вид «' + need + '»: ' + labels.slice(0, 40).join(' | '));
        assert.ok(!labels.includes('Подписка «Джем»') && !labels.includes('Утилизация товара'), 'WB-шных видов у Ozon нет');
        const tr = await readRow('В доставке');
        assert.strictEqual(tr, 35, 'у Ozon есть строка «В доставке» (7 × 5 дней): ' + tr);
        console.log('ok   РНП Ozon: свои виды удержаний, реклама по списаниям, К выводу сходится');
        assert.deepStrictEqual(env.errors, [], 'ошибок скриптов нет: ' + env.errors.join('; '));
    } catch (e) { console.error('FAIL', e.message); process.exitCode = 1; } finally { await browser.close(); srv.close(); }
})();

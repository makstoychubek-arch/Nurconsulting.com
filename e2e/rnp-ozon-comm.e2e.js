/**
 * РНП Ozon: «Комиссия после баллов» (владелец, 23 ноября 2026). Баллы за скидки и корректировка вознаграждения сначала гасят комиссию,
 * остаток баллов отдельной строкой; «Прочие удержания» только списания; «К выводу» не меняется. Без comp_pts в ответе базы всё как раньше.
 * Запуск: node e2e/rnp-ozon-comm.e2e.js
 */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');
const day = (n) => new Date(Date.now() + 6 * 3600e3 - (n + 1) * 86400e3).toISOString().slice(0, 10);
const NM = 9993927562;
const tables = { spaces: [{ id: 's0', user_id: ADMIN_ID, email: 'makstoychubek@gmail.com', status: 'active', tariff_plan: 'vip', is_super_admin: true, first_name: 'M', last_name: 'T', full_name: 'M T' }], cabinets: [{ id: CAB, name: 'Z', wb_token_set: true, ozon_client_id: '123', ozon_api_key_set: true, user_id: ADMIN_ID }] };
const art = { id: 'ozon-a', name: 'костюм_оверсайз_бежевый', nm_id: NM, category: 'К', is_active: true, cost_price: 100, sort_order: 0, manual_data: {}, other_costs_unit: 0, logistics_unit: 0, cabinet_id: CAB };
const base = (d) => ({ cabinet_id: CAB, nm_id: NM, date: day(d), orders_count: 10, orders_sum: 10000, sales_count: 10, sales_sum: 10000, realization: 10000, commission_pct: 20, to_transfer: 7800, delivery_sum: 1500, storage_sum: 10, penalty_sum: 0, ad_spend: 200, ad_charged: 250, transit_count: 7, ded_prem: 100, ded_bonus: 0, ded_move: 0 });
// дни 0-2: баллов меньше комиссии (2200); дни 3-4: баллов больше комиссии
const withComp = Array.from({ length: 5 }, (_, d) => d < 3 ? Object.assign(base(d), { comp_pts: 1500, comp_adj: 400, deduction_sum: 300 - 1900, ded_rest: 200 - 1900 }) : Object.assign(base(d), { comp_pts: 4000, comp_adj: 1000, deduction_sum: 300 - 5000, ded_rest: 200 - 5000 }));
const noComp = Array.from({ length: 5 }, (_, d) => Object.assign(base(d), { deduction_sum: 300, ded_rest: 200 }));
async function run(rowsData, check) {
    const srv = await serve();
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    try {
        const env = await openApp(browser, 'http://127.0.0.1:' + srv.address().port, { userId: ADMIN_ID, email: 'makstoychubek@gmail.com', latencyMs: 20, tables, rpcs: { is_super_admin: true, ozon_rnp_articles: [art], ozon_finance_daily: rowsData, ozon_stock_rows: [], ozon_orders_daily: [] }, functions: { 'wb-proxy': async () => ({}) } });
        const { page } = env;
        await page.setViewportSize({ width: 1500, height: 1500 });
        await page.evaluate(() => { const s = document.getElementById('nr-splash'); if (s) s.remove(); NrMp.set('ozon'); showTab('rnp'); });
        await page.waitForFunction(() => [...document.querySelectorAll('#tab-rnp tr')].some((r) => /^Реализация/.test((r.children[0] || {}).innerText || '')), null, { timeout: 20000 });
        await page.evaluate(() => RNP.pick('general')); await page.waitForTimeout(1200);
        await page.evaluate(() => { RNP.toggleSplit('comm_after'); RNP.toggleSplit('other_net_sum'); }); await page.waitForTimeout(1200);
        const sum = (label) => page.evaluate((src) => { const r = [...document.querySelectorAll('#tab-rnp table tr')].find((x) => new RegExp(src).test(((x.children[0] || {}).innerText || '').replace(/\s+/g, ' ').trim())); if (!r) return null; return [...r.querySelectorAll('td.rnp-day-col')].map((t) => Number(t.textContent.replace(/\s/g, '').replace('−', '-').replace(',', '.'))).filter((v) => isFinite(v)).reduce((a, b) => a + b, 0); }, label.source);
        const labels = await page.evaluate(() => [...document.querySelectorAll('#tab-rnp table tr')].map((r) => ((r.children[0] || {}).innerText || '').replace(/\s+/g, ' ').trim()));
        await check({ sum, labels });
        assert.deepStrictEqual(env.errors || [], [], 'ошибки скриптов');
    } finally { await browser.close(); srv.close(); }
}
(async () => {
    let failed = 0;
    const t = async (name, fn) => { try { await fn(); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + String(e.message || e).split('\n')[0]); } };
    await t('база отдаёт баллы: комиссия после баллов, до баллов, баллы, корректировка, остаток', () => run(withComp, async ({ sum, labels }) => {
        for (const l of ['Комиссия после баллов', 'Комиссия до баллов', 'Баллы за скидки', 'Корректировка вознаграждения', 'Остаток баллов']) assert.ok(labels.some((x) => x.startsWith(l)), 'нет строки «' + l + '»: ' + labels.slice(0, 40));
        assert.ok(!labels.some((x) => /^Комиссия ▾?$|^Комиссия$/.test(x)), 'прежняя строка «Комиссия» скрыта');
        assert.strictEqual(await sum(/^Комиссия после баллов/), 3 * 300 + 2 * 0);
        assert.strictEqual(await sum(/^Комиссия до баллов/), 5 * 2200);
        assert.strictEqual(Math.round(await sum(/^Баллы за скидки/)), -(3 * 1500 + 2 * 1760));
        assert.strictEqual(Math.round(await sum(/^Корректировка вознаграждения/)), -(3 * 400 + 2 * 440));
        assert.strictEqual(Math.round(await sum(/^Остаток баллов/)), 2 * 2800);
    }));
    await t('«Прочие удержания» только списания, «К выводу» не меняется', () => run(withComp, async ({ sum, labels }) => {
        assert.strictEqual(Math.round(await sum(/^Прочие удержания/)), 5 * 300);
        assert.ok(labels.some((x) => /^Кроссдокинг и допуслуги/.test(x)), 'подстрока переименована');
        assert.strictEqual(Math.round(await sum(/^К выводу$/)), 3 * 7640 + 2 * 10740);
    }));
    await t('база без comp_pts: всё как раньше (комиссия, «Прочее и возмещения»)', () => run(noComp, async ({ labels }) => {
        assert.ok(labels.some((x) => /^Комиссия( |$)/.test(x)) && !labels.some((x) => /^Комиссия после баллов/.test(x)), 'прежняя «Комиссия»: ' + labels.slice(0, 30));
        assert.ok(labels.some((x) => /^Прочее и возмещения/.test(x)), 'прежняя подстрока');
    }));
    if (failed) { console.log('e2e комиссии после баллов: провалено ' + failed); process.exit(1); }
    console.log('e2e комиссии после баллов: все проверки прошли');
})();

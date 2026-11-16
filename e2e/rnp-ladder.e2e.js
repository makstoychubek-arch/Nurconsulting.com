/**
 * РНП: расходы лесенкой (Реализация → Комиссия → … → Реклама → Себестоимость → К выводу → Налог → Прибыль) и налог из настроек.
 * Запуск: node e2e/rnp-ladder.e2e.js.
 */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');

const day = (n) => new Date(Date.now() + 6 * 3600e3 - n * 86400e3).toISOString().slice(0, 10);
const tables = {
    spaces: [{ id: 's0', user_id: ADMIN_ID, email: 'makstoychubek@gmail.com', status: 'active', tariff_plan: 'vip', is_super_admin: true, first_name: 'M', last_name: 'T', full_name: 'M T' }],
    cabinets: [{ id: CAB, name: 'T', wb_token_set: true, user_id: ADMIN_ID }],
    rnp_articles: [{ id: 'a0', cabinet_id: CAB, nm_id: 1001, name: 'a', category: 'К', is_active: true, cost_price: 100, sort_order: 0 }],
    rnp_daily_data: Array.from({ length: 5 }, (_, d) => ({ cabinet_id: CAB, nm_id: 1001, date: day(d), orders_count: 10, orders_sum: 10000, sales_count: 10, sales_sum: 10000, realization: 10000, to_transfer: 7000, delivery_sum: 1000, storage_sum: 100, penalty_sum: 50, ad_spend: 200 })),
};
const LADDER = ['Реализация', 'Комиссия', 'Эквайринг', 'Логистика', 'Хранение', 'Приёмка и обработка', 'Штрафы', 'Прочие удержания и доплаты', 'Реклама (РК)', 'Себестоимость', 'К выводу', 'Налог', 'Прибыль'];

(async () => {
    const srv = await serve();
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    try {
        const env = await openApp(browser, 'http://127.0.0.1:' + srv.address().port, { userId: ADMIN_ID, email: 'makstoychubek@gmail.com', latencyMs: 20, tables, rpcs: { is_super_admin: true }, functions: { 'wb-proxy': async () => ({}) } });
        const { page } = env;
        await page.evaluate(() => { const s = document.getElementById('nr-splash'); if (s) s.remove(); NrMp.set('wb'); showTab('rnp'); });
        await page.waitForFunction(() => [...document.querySelectorAll('#tab-rnp tr')].some((r) => /^Реализация/.test((r.children[0] || {}).innerText || '')), null, { timeout: 15000 });
        const labels = () => page.evaluate(() => [...document.querySelectorAll('#tab-rnp table tr')].map((r) => ((r.children[0] || {}).innerText || '').replace(/\s+/g, ' ').trim().replace(/^▸\s*/, '')));
        const got = (await labels()).filter((t) => LADDER.includes(t));
        const first = []; got.forEach((t) => { if (!first.includes(t)) first.push(t); });
        // «Общий» видит все строки, в порядке лесенки
        const idx = first.map((t) => LADDER.indexOf(t));
        assert.deepStrictEqual(idx, [...idx].sort((a, b) => a - b), 'порядок строк: ' + first.join(' → '));
        for (const need of ['Реализация', 'Логистика', 'Реклама (РК)', 'Себестоимость', 'К выводу', 'Налог', 'Прибыль']) assert.ok(first.includes(need), 'есть строка «' + need + '»: ' + first.join(', '));
        console.log('ok   РНП: расходы лесенкой (' + first.length + ' строк в верном порядке)');
        // налог из настроек: 10% от реализации, прибыль уменьшается на налог
        const read = (name) => page.evaluate((n) => { const r = [...document.querySelectorAll('#tab-rnp table tr')].find((x) => ((x.children[0] || {}).innerText || '').replace(/\s+/g, ' ').trim().replace(/^▸\s*/, '') === n); if (!r) return null; const c = r.querySelector('td:last-child, th:last-child'); return Number(String(c.innerText).replace(/[^\d-]/g, '')) || 0; }, name);
        const profit0 = await read('Прибыль'), tax0 = await read('Налог');
        await page.evaluate(() => RNP.setTaxPct('10')); await page.waitForTimeout(800);
        const profit1 = await read('Прибыль'), tax1 = await read('Налог'), real = await read('Реализация');
        assert.ok(tax1 > 0 && Math.abs(tax1 - real * 0.1) <= Math.max(2, real * 0.002), 'налог 10% от реализации: ' + tax1 + ' из ' + real);
        assert.ok(profit1 < profit0 && Math.abs((profit0 - profit1) - (tax1 - tax0)) <= 3, 'прибыль уменьшилась на налог: ' + profit0 + ' → ' + profit1);
        console.log('ok   налог 10% от реализации (' + tax1 + ') вычитается из прибыли (' + profit0 + ' → ' + profit1 + ')');
        // «Общее по артикулам» и один артикул: лесенка та же, «Прибыль на единицу» только у одного артикула
        const labelsOf = async () => [...new Set(await labels())];
        assert.ok(!(await labelsOf()).includes('Прибыль на единицу'), 'в «Общем» «Прибыль на единицу» не показывается');
        await page.evaluate(() => RNP.pick('byart')); await page.waitForTimeout(1500);
        const byart = (await labelsOf()).filter((t) => LADDER.includes(t));
        assert.ok(byart.includes('Реализация') && byart.includes('Себестоимость') && byart.includes('Прибыль'), '«Общее по артикулам»: ' + byart.join(', '));
        await page.evaluate(() => RNP.pick(1001)); await page.waitForTimeout(1500);
        const one = await labelsOf();
        assert.ok(one.includes('Прибыль на единицу') && one.includes('Налог'), 'у одного артикула есть «Прибыль на единицу» и «Налог»: ' + one.slice(0, 40).join(', '));
        console.log('ok   «Общее по артикулам» и один артикул: лесенка на месте, «Прибыль на единицу» только у артикула');
        assert.deepStrictEqual(env.errors, [], 'ошибок скриптов нет: ' + env.errors.join('; '));
    } catch (e) { console.error('FAIL', e.message); process.exitCode = 1; } finally { await browser.close(); srv.close(); }
})();

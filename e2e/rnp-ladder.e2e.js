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
        const env = await openApp(browser, 'http://127.0.0.1:' + srv.address().port, { userId: ADMIN_ID, email: 'makstoychubek@gmail.com', latencyMs: 20, tables, rpcs: { is_super_admin: true, rnp_cabinet_totals: Array.from({ length: 5 }, (_, d) => ({ d: day(d), realization: 10000, to_transfer: 7000, delivery: 1000, storage: 100, penalty: 50, deduction: 0, acceptance: 0, to_withdraw: 5000, ad_spend: 200, acquiring: 0, compensation: 0, additional: 0 })), rnp_cabinet_log_split: Array.from({ length: 5 }, (_, d) => ({ d: day(d), log_sale: 300, log_cancel_to: 400, log_cancel_from: 200, log_return: 50, log_other: 50 })) }, functions: { 'wb-proxy': async () => ({}) } });
        const { page } = env;
        await page.evaluate(() => { const s = document.getElementById('nr-splash'); if (s) s.remove(); NrMp.set('wb'); showTab('rnp'); });
        await page.waitForFunction(() => [...document.querySelectorAll('#tab-rnp tr')].some((r) => /^Реализация/.test((r.children[0] || {}).innerText || '')), null, { timeout: 15000 });
        const labels = () => page.evaluate(() => [...document.querySelectorAll('#tab-rnp table tr')].map((r) => ((r.children[0] || {}).innerText || '').replace(/\s+/g, ' ').trim().replace(/^[▸▾]\s*|\s*[▸▾]$/g, '')));
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
        // раскрытие: «Комиссия» показывает процент, «Прочие удержания и доплаты» и «Штрафы» показывают виды; стрелки синие
        await page.evaluate(() => { RNP.pick('general'); }); await page.waitForTimeout(1200);
        const arrows = await page.evaluate(() => [...document.querySelectorAll('#tab-rnp .rnp-split-toggle')].map((e) => ({ t: e.innerText.replace(/\s+/g, ' ').trim(), c: getComputedStyle(e.querySelector('.rnp-split-arrow')).color })));
        for (const need of ['Комиссия', 'Штрафы', 'Прочие удержания и доплаты']) assert.ok(arrows.some((a) => a.t.replace(/ [▸▾]$/, '') === need), 'у строки «' + need + '» есть стрелка раскрытия: ' + JSON.stringify(arrows.map((a) => a.t)));
        assert.ok(arrows.every((a) => a.c === 'rgb(37, 99, 235)'), 'стрелки синие: ' + JSON.stringify(arrows.map((a) => a.c)));
        await page.evaluate(() => { for (const k of ['wb_commission', 'other_net_sum', 'penalty_sum', 'delivery_sum']) RNP.toggleSplit(k); }); await page.waitForTimeout(600);
        const open = [...new Set(await labels())];
        for (const need of ['Комиссия, % от реализации', 'WB Продвижение', 'Подписка «Джем»', 'Доплаты и компенсации (уменьшают)', 'Габариты', 'К клиенту при продаже', 'К клиенту при отмене', 'От клиента при возврате', 'Доля отмен в логистике, %', 'Логистика на 1 проданную шт, сом']) assert.ok(open.includes(need), 'после раскрытия есть «' + need + '»');
        const lg = await page.evaluate(() => [...document.querySelectorAll('#tab-rnp table tr')].map((r) => [...r.children].map((c) => c.innerText.replace(/\s+/g, ' ').trim())).filter((c) => /^(К клиенту при отмене|Доля отмен в логистике, %)/.test(c[0])));
        assert.ok(lg.length === 2 && lg.every((r) => r.slice(1).some((x) => /[1-9]/.test(x))), 'логистика по причинам показывает цифры: ' + JSON.stringify(lg));
        console.log('ok   раскрытие строк: комиссия в процентах, прочие удержания и штрафы по видам, стрелки синие');
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

/**
 * РНП: «Фулфилмент» из раздела ФФ. Ползунок «Показывать в РНП» включён: строка стоит перед себестоимостью и раскрывается на отправки, хранение и доп. услуги.
 * Запуск: node e2e/rnp-ff.e2e.js.
 */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');

const day = (n) => new Date(Date.now() + 6 * 3600e3 - n * 86400e3).toISOString().slice(0, 10);
const tables = {
    ff_settings: [{ cabinet_id: CAB, rnp_show_ff: true }],
    ff_ledger: [{ cabinet_id: CAB, kind: 'service', title: 'Упаковка', amount: 500, entry_date: day(1), ff_name: 'ФФ' }, { cabinet_id: CAB, kind: 'payment', title: 'Оплата', amount: 9999, entry_date: day(1), ff_name: 'ФФ' }],
    spaces: [{ id: 's0', user_id: ADMIN_ID, email: 'makstoychubek@gmail.com', status: 'active', tariff_plan: 'vip', is_super_admin: true, first_name: 'M', last_name: 'T', full_name: 'M T' }],
    cabinets: [{ id: CAB, name: 'T', wb_token_set: true, user_id: ADMIN_ID }],
    rnp_articles: [{ id: 'a0', cabinet_id: CAB, nm_id: 1001, name: 'a', category: 'К', is_active: true, cost_price: 100, sort_order: 0 }],
    rnp_daily_data: Array.from({ length: 5 }, (_, d) => ({ cabinet_id: CAB, nm_id: 1001, date: day(d), orders_count: 10, orders_sum: 10000, sales_count: 10, sales_sum: 10000, realization: 10000, to_transfer: 7000, delivery_sum: 1000, storage_sum: 100, penalty_sum: 50, ad_spend: 200 })),
};
const LADDER = ['Реализация', 'Комиссия', 'Эквайринг', 'Логистика', 'Хранение', 'Приёмка и обработка', 'Штрафы', 'Прочие удержания и доплаты', 'Реклама (РК)', 'Фулфилмент', 'Налог', 'Себестоимость', 'К выводу', 'Прибыль'];

const RPCS = { is_super_admin: true, rnp_cabinet_totals: Array.from({ length: 5 }, (_, d) => ({ d: day(d), realization: 10000, to_transfer: 7000, delivery: 1000, storage: 100, penalty: 50, deduction: 0, acceptance: 0, to_withdraw: 5000, ad_spend: 200, acquiring: 0, compensation: 0, additional: 0 })), rnp_cabinet_log_split: Array.from({ length: 5 }, (_, d) => ({ d: day(d), log_sale: 300, log_cancel_to: 400, log_cancel_from: 200, log_return: 50, log_other: 50 })) };

(async () => {
    const srv = await serve();
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    try {
        const env = await openApp(browser, 'http://127.0.0.1:' + srv.address().port, { userId: ADMIN_ID, email: 'makstoychubek@gmail.com', latencyMs: 20, tables, rpcs: RPCS, functions: { 'wb-proxy': async () => ({}) } });
        const { page } = env;
        await page.evaluate(() => { const s = document.getElementById('nr-splash'); if (s) s.remove(); NrMp.set('wb'); showTab('rnp'); });
        await page.waitForFunction(() => [...document.querySelectorAll('#tab-rnp tr')].some((r) => /^Фулфилмент/.test((r.children[0] || {}).innerText || '')), null, { timeout: 15000 });
        const labels = () => page.evaluate(() => [...document.querySelectorAll('#tab-rnp table tr')].map((r) => ((r.children[0] || {}).innerText || '').replace(/\s+/g, ' ').trim().replace(/\s*[▸▾]$/, '')));
        const l = await labels();
        assert.ok(l.indexOf('Реклама (РК)') < l.indexOf('Фулфилмент') && l.indexOf('Фулфилмент') < l.indexOf('Себестоимость'), 'Фулфилмент между рекламой и себестоимостью: ' + l.join(' | '));
        await page.evaluate(() => RNP.toggleSplit('ff_sum')); await page.waitForTimeout(600);
        const rows = await page.evaluate(() => [...document.querySelectorAll('#tab-rnp table tr')].map((r) => [...r.children].map((c) => c.innerText.replace(/\s+/g, ' ').trim())).filter((c) => /^(Отправки|Хранение|Доп\. услуги)$/.test(c[0])));
        const names = rows.map((r) => r[0]);
        assert.ok(names.includes('Отправки') && names.includes('Доп. услуги'), 'раскрылись отправки и доп. услуги: ' + names.join(', '));
        const extra = rows.find((r) => r[0] === 'Доп. услуги');
        assert.ok(extra.slice(1).some((x) => /500/.test(x.replace(/\s/g, ''))), 'доп. услуга 500 попала в РНП: ' + JSON.stringify(extra));
        assert.ok(!rows.some((r) => r.some((x) => /9999/.test(x.replace(/\s/g, '')))), 'оплаты ФФ в расходы не попадают');
        console.log('ok   Фулфилмент: строка перед себестоимостью, раскрывается на отправки, хранение и доп. услуги');
        assert.deepStrictEqual(env.errors, [], 'ошибок скриптов нет: ' + env.errors.join('; '));
    } catch (e) { console.error('FAIL', e.message); process.exitCode = 1; } finally { await browser.close(); srv.close(); }
})();

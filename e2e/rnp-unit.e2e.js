/**
 * РНП → Юнит-экономика: расходы и прибыль с штуки по формулам РНП, без рекламы.
 * Запуск: node e2e/rnp-unit.e2e.js. Путь к Chromium можно задать через PW_CHROMIUM.
 */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');

const day = new Date(Date.now() + 6 * 3600e3 - 86400e3).toISOString().slice(0, 10);
const tables = {
    spaces: [{ id: 's0', user_id: ADMIN_ID, email: 'makstoychubek@gmail.com', status: 'active', tariff_plan: 'vip', is_super_admin: true, full_name: 'M' }],
    cabinets: [{ id: CAB, name: 'T', wb_token_set: true, user_id: ADMIN_ID }],
    rnp_articles: [
        { id: 'a1', cabinet_id: CAB, nm_id: 1, name: 'костюм_1', imt_id: 10, card_title: 'Костюм брючный классический', subject_name: 'Костюмы', photo_url: null, is_active: true, cost_price: 1000 },
        { id: 'a2', cabinet_id: CAB, nm_id: 2, name: 'свитер_2', imt_id: 20, card_title: 'Свитер оверсайз', subject_name: 'Свитеры', photo_url: null, is_active: true, cost_price: 600 },
        { id: 'a3', cabinet_id: CAB, nm_id: 3, name: 'без_продаж_3', imt_id: 30, card_title: 'Пиджак', subject_name: 'Пиджаки', photo_url: null, is_active: true, cost_price: 500 },
    ],
    // арт. 1: 10 продаж, 1 возврат, цена 5000, к перечислению 31 000 (уже без комиссии и возвратов), логистика 5 000, хранение 500, штрафы 300
    rnp_daily_data: [
        { cabinet_id: CAB, nm_id: 1, date: day, sales_count: 10, returns_count: 1, sales_sum: 50000, to_transfer: 31000, delivery_sum: 5000, storage_sum: 500, penalty_sum: 300, deduction_sum: 0, commission_pct: 32 },
        { cabinet_id: CAB, nm_id: 2, date: day, sales_count: 20, returns_count: 0, sales_sum: 60000, to_transfer: 40000, delivery_sum: 10000, storage_sum: 0, penalty_sum: 0, deduction_sum: 0, commission_pct: 30 },
    ],
    rnp_settings: [{ cabinet_id: CAB, options: { taxRate: 0 } }],
    wb_orders: [],
};

(async () => {
    const srv = await serve();
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    try {
        const env = await openApp(browser, 'http://127.0.0.1:' + srv.address().port, { phone: !!process.env.RU_PHONE, userId: ADMIN_ID, email: 'makstoychubek@gmail.com', latencyMs: 30, tables, rpcs: { is_super_admin: true }, functions: { 'wb-proxy': async () => ({}) } });
        const { page } = env;
        await page.evaluate(() => showTab('rnp'));
        await page.waitForSelector('#rnp-views', { state: 'attached', timeout: 10000 });
        // чистая формула: 31000 − 5000 − 500 − 300 − 1000 × (10 − 1) = 16 200 → 1 620 на продажу
        const u = await page.evaluate(() => window.NrRnpPrices._unitOf({ n: 10, r: 1, ss: 50000, tt: 31000, dl: 5000, st: 500, pn: 300, cm: 32 * 50000 }, 1000, 0));
        assert.strictEqual(Math.round(u.profit), 1620, 'прибыль с штуки: ' + u.profit);
        assert.strictEqual(Math.round(u.price), 5000);
        assert.strictEqual(Math.round(u.cost), 900, 'себестоимость только на выкупленные (10−1) / 10 продаж');
        assert.strictEqual(u.comm, 32);
        console.log('ok   формула как в РНП: прибыль 1620, себестоимость на выкупленные, комиссия 32%');
        await page.evaluate(() => document.querySelector('#rnp-views [data-rv="unit"]').click());
        await page.waitForSelector('.ru-tbl tbody tr[data-nm="1"]', { timeout: 10000 });
        const row = await page.evaluate(() => [...document.querySelector('tr[data-nm="1"]').querySelectorAll('td')].map((t) => t.textContent.replace(/\s/g, '')));
        assert.ok(row.includes('1620') && row.includes('32,0%') && row.includes('5000') && row.includes('10%'), 'строка артикула: ' + row);
        assert.ok(!document_has(row, 'реклама'), 'рекламы нет');
        assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ru-tbl tbody tr[data-nm]').length), 2, 'артикул без продаж не показан');
        assert.ok(await page.evaluate(() => /ещё 1 без продаж/.test(document.querySelector('.rp-foot').textContent)), 'подпись про артикул без продаж');
        console.log('ok   страница: строка с ценой 5000, комиссией 32%, прибылью 1620; без продаж не показан');
        const kp = await page.evaluate(() => [...document.querySelectorAll('.ru-kp b')].map((b) => b.textContent.replace(/\s/g, '')));
        assert.ok(kp[0].startsWith('48') || /^\d+тыс/.test(kp[0]), 'прибыль за период: ' + kp[0]);
        console.log('ok   сводка: ' + kp.join(' | '));
        await page.click('tr[data-nm="2"]');
        await page.waitForFunction(() => !document.getElementById('tab-rnp').classList.contains('ru-on'), null, { timeout: 8000 });
        console.log('ok   нажатие на строку открывает РНП');
        await page.evaluate(() => document.querySelector('#fly-rnp [data-nrn="rnp:unit"]').click());
        await page.waitForSelector('.ru-tbl', { timeout: 8000 });
        assert.ok(await page.evaluate(() => /Юнит/.test(document.getElementById('page-title').textContent)), 'заголовок страницы «Юнит-экономика»');
        console.log('ok   пункт «Юнит-экономика» в меню РНП');
        assert.deepStrictEqual(env.errors.filter((e) => !/404|favicon/.test(e)), [], 'в консоли нет ошибок');
        console.log('e2e юнит-экономики: все проверки прошли');
    } finally { await browser.close(); srv.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
function document_has(row, w) { return row.join('|').toLowerCase().includes(w); }

/**
 * РНП → Юнит-экономика: расходы и прибыль с штуки по формулам РНП, без рекламы.
 * Запуск: node e2e/rnp-unit.e2e.js. Путь к Chromium можно задать через PW_CHROMIUM.
 */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');

const day = new Date(Date.now() + 6 * 3600e3 - 86400e3).toISOString().slice(0, 10);
const tables = {
    spaces: [{ id: 's0', user_id: ADMIN_ID, email: 'admin@example.com', status: 'active', tariff_plan: 'vip', is_super_admin: true, full_name: 'M' }],
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
        const env = await openApp(browser, 'http://127.0.0.1:' + srv.address().port, { phone: !!process.env.RU_PHONE, userId: ADMIN_ID, email: 'admin@example.com', latencyMs: 30, tables, rpcs: { is_super_admin: true }, functions: { 'wb-proxy': async () => ({}) } });
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
        await page.waitForSelector('.ru-t2', { timeout: 10000 });
        // группы сверху, под ними фото артикулов группы; артикул без продаж не показан
        await page.waitForFunction(() => window.RNP && window.RNP.groupsView && window.RNP.groupsView().length > 0, null, { timeout: 10000 });
        await page.waitForTimeout(1200);
        const grp = await page.evaluate(() => [...document.querySelectorAll('.ru-tab')].map((t) => t.textContent));
        assert.ok(grp.length >= 1, 'сверху группы как в РНП: ' + grp);
        assert.ok(await page.evaluate(() => document.querySelectorAll('.ru-pt').length >= 2), 'под ними фото артикулов группы');
        assert.ok(await page.evaluate(() => document.querySelector('.ru-pt[data-un="3"]').classList.contains('off')), 'артикул без продаж приглушён');
        console.log('ok   сверху группы из РНП: ' + grp.join(', ') + ', под ними фото артикулов');
        // выбираем фото артикула 1 (цена 5000, комиссия 32%): ниже таблица с его значениями
        const clickGroup = async (nm) => { await page.evaluate((n) => { const b = document.querySelector('.ru-pt[data-un="' + n + '"]'); if (b) b.click(); }, nm); };
        await clickGroup(1);
        const val = () => page.evaluate(() => { const m = {}; document.querySelectorAll('.ru-t2 tbody tr').forEach((r) => { const k = r.querySelector('input.ru-ed'); const nm = r.children[0].textContent; if (k) m[k.getAttribute('data-k')] = k.value; if (/Остаётся/.test(nm)) m.profit = r.children[2].textContent.replace(/\s/g, ''); if (/Прибыль в день/.test(nm)) m.pday = r.children[2].textContent.replace(/\s/g, ''); }); return m; });
        let v = await val();
        assert.strictEqual(v.price.replace(/\s/g, ''), '5000', 'цена продажи: ' + JSON.stringify(v));
        assert.strictEqual(v.comm, '32', 'комиссия 32%: ' + JSON.stringify(v));
        assert.strictEqual(v.profit, '1620', 'остаётся с единицы по формуле РНП: ' + JSON.stringify(v));
        console.log('ok   выбрано фото артикула: цена 5000, комиссия 32%, остаётся 1620');
        // правка значения пересчитывает итог, снимок остаётся прежним, разница показана
        await page.fill('.ru-t2 input[data-k="price"]', '4900'); await page.waitForTimeout(100);
        v = await val();
        const snapProfit = await page.evaluate(() => [...document.querySelectorAll('.ru-t2 tbody tr')].find((r) => /Остаётся/.test(r.children[0].textContent)).children[1].textContent.replace(/\s/g, ''));
        const diff = await page.evaluate(() => [...document.querySelectorAll('.ru-t2 tbody tr')].find((r) => /Остаётся/.test(r.children[0].textContent)).children[3].textContent.replace(/\s/g, ''));
        assert.strictEqual(snapProfit, '1620', 'снимок не меняется: ' + snapProfit);
        assert.strictEqual(v.profit, '1552', 'при цене 4900 остаётся 4900 − 32% − расходы: ' + v.profit);
        assert.ok(/68/.test(diff), 'разница со снимком: ' + diff);
        console.log('ok   цена 4900: остаётся 1552, снимок 1620, разница −68');
        await page.click('[data-ua="reset"]'); await page.waitForTimeout(100);
        assert.strictEqual((await val()).profit, '1620', 'сброс возвращает значения снимка');
        console.log('ok   «Сбросить значения» возвращает снимок');
        if (process.env.RU_SHOT) { await page.setViewportSize({ width: 1440, height: 900 }); await page.waitForTimeout(500); await page.screenshot({ path: process.env.RU_SHOT + '.png' }); }
        // юнит-экономика внутри раздела «Товары»: вкладки наверху страницы, в меню отдельного пункта нет
        assert.ok(await page.evaluate(() => !document.querySelector('#fly-rnp [data-nrn="rnp:unit"]') || document.querySelector('#fly-rnp [data-nrn="rnp:unit"]').offsetParent === null), 'отдельного пункта «Юнит-экономика» в меню РНП нет');
        assert.ok(await page.evaluate(() => /Товары/.test(document.querySelector('.rp-subtabs button[data-vw="prices"]').textContent) && /Юнит/.test(document.querySelector('.rp-subtabs button[data-vw="unit"]').textContent)), 'наверху вкладки «Товары» и «Юнит-экономика»');
        await page.click('.rp-subtabs button[data-vw="prices"]');
        await page.waitForSelector('.rp-row', { timeout: 8000 });
        assert.ok(await page.evaluate(() => document.querySelector('#fly-rnp [data-nrn="rnp:prices"]').classList.contains('active') || /Товары/.test(document.getElementById('page-title').textContent)), 'мы на странице «Товары»');
        await page.click('.rp-subtabs button[data-vw="unit"]');
        await page.waitForSelector('.ru-t2', { timeout: 8000 });
        assert.ok(await page.evaluate(() => /Юнит/.test(document.getElementById('page-title').textContent)), 'заголовок страницы «Юнит-экономика»');
        assert.ok(await page.evaluate(() => /Товары/.test(document.querySelector('.nr-crumbs').textContent)), 'в цепочке сверху «Товары › Юнит-экономика»');
        console.log('ok   юнит-экономика внутри «Товаров»: вкладки наверху, переключение туда и обратно');
        assert.deepStrictEqual(env.errors.filter((e) => !/404|favicon/.test(e)), [], 'в консоли нет ошибок');
        console.log('e2e юнит-экономики: все проверки прошли');
    } finally { await browser.close(); srv.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
function document_has(row, w) { return row.join('|').toLowerCase().includes(w); }

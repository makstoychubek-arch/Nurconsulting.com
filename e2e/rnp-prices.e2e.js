/**
 * РНП → Цены: склейки на полках, группы, корона у локомотива, четыре строки, переход в РНП.
 * Запуск: node e2e/rnp-prices.e2e.js. Путь к Chromium можно задать через PW_CHROMIUM.
 */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');

const ARTS = [
    { nm: 1, imt: 100, title: 'Свитер оверсайз вязаный', subj: 'Свитеры' },
    { nm: 2, imt: 100, title: 'Свитер оверсайз вязаный', subj: 'Свитеры' },
    { nm: 3, imt: 200, title: 'Костюм брючный классический деловой', subj: 'Костюмы' },
    { nm: 4, imt: 200, title: 'Костюм брючный классический деловой', subj: 'Костюмы' },
    { nm: 5, imt: 300, title: 'Костюм летний с кимоно и брюками', subj: 'Костюмы' },
    { nm: 6, imt: 400, title: 'Пиджак оверсайз удлиненный', subj: 'Пиджаки' },
    { nm: 7, imt: 500, title: 'Велюровый костюм спортивный', subj: 'Костюмы спортивные' },
];
const ORD = { 1: 5, 2: 40, 3: 7, 4: 2, 5: 12, 6: 0, 7: 9 };
const tables = {
    spaces: [{ id: 's0', user_id: ADMIN_ID, email: 'makstoychubek@gmail.com', status: 'active', tariff_plan: 'vip', is_super_admin: true, full_name: 'M' }],
    cabinets: [{ id: CAB, name: 'T', wb_token_set: true, user_id: ADMIN_ID }],
    rnp_articles: ARTS.map((a, i) => ({ id: 'a' + i, cabinet_id: CAB, nm_id: a.nm, name: 'арт_' + a.nm, imt_id: a.imt, card_title: a.title, subject_name: a.subj, photo_url: null, is_active: true, sort_order: i })),
    rnp_daily_data: ARTS.map((a) => ({ cabinet_id: CAB, nm_id: a.nm, date: new Date(Date.now() + 6 * 3600e3 - 86400e3).toISOString().slice(0, 10), funnel_orders: ORD[a.nm], sales_count: Math.floor(ORD[a.nm] / 2) })),
    wb_stocks: ARTS.map((a) => ({ cabinet_id: CAB, nm_id: a.nm, quantity: a.nm === 4 ? 20 : 300 })),
    wb_orders: [],
};

(async () => {
    const srv = await serve();
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    try {
        const calls = [];
        const env = await openApp(browser, 'http://127.0.0.1:' + srv.address().port, {
            phone: !!process.env.RP_PHONE, userId: ADMIN_ID, email: 'makstoychubek@gmail.com', latencyMs: 30, tables, rpcs: { is_super_admin: true },
            functions: { 'wb-proxy': async (b) => { calls.push(b); return b.action === 'prices_get' ? { currency: 'сом', items: ARTS.map((a) => ({ nmID: a.nm, price: 5000, discount: 30, discounted: 3000 + a.nm * 10 })) } : {}; } },
        });
        const { page } = env;
        await page.evaluate(() => showTab('rnp'));
        await page.waitForSelector('#rnp-views', { state: 'attached', timeout: 10000 });
        await page.evaluate(() => document.querySelector('#rnp-views [data-rv="prices"]').click());
        await page.waitForSelector('.rp-it[data-nm="2"]', { timeout: 10000 });
        assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.rp-it[data-nm]').length), 7, 'на странице все 7 артикулов');
        console.log('ok   страница «Цены» показывает все артикулы');
        const cats = await page.evaluate(() => [...document.querySelectorAll('.rp-cat')].map((e) => e.textContent.split(' · ')[0]));
        assert.deepStrictEqual(cats, ['Костюмы классические', 'Свитера', 'Пиджаки', 'Спортивные костюмы', 'Летние костюмы'], 'группы по порядку: ' + cats);
        console.log('ok   группы: ' + cats.join(', '));
        const rows = await page.evaluate(() => document.querySelectorAll('.rp-row').length);
        assert.strictEqual(rows, 5, 'пять склеек: ' + rows);
        const crown = await page.evaluate(() => [...document.querySelectorAll('.rp-it.l')].map((e) => e.getAttribute('data-nm')));
        assert.ok(crown.includes('2') && crown.includes('3') && !crown.includes('6'), 'корона у локомотивов, у склейки без заказов её нет: ' + crown);
        console.log('ok   корона у локомотива склейки');
        await page.waitForFunction(() => !document.querySelector('.rp-it[data-nm="2"] .rp-ld'));
        const t = await page.evaluate(() => [...document.querySelector('.rp-it[data-nm="2"]').querySelectorAll('i,s,u,em')].map((e) => e.textContent.replace(/\s/g, '')));
        assert.deepStrictEqual(t, ['3020', '300', '40', '20'], 'четыре строки: цена, остаток, заказы, продажи: ' + t);
        assert.ok(await page.evaluate(() => document.querySelector('.rp-it[data-nm="4"]').classList.contains('rp-low')), 'остаток меньше 60 красным');
        console.log('ok   цена, остаток, заказы и продажи');
        assert.ok(await page.evaluate(() => !document.querySelector('.rnp-workspace').offsetParent), 'сам РНП скрыт, пока открыты цены');
        await page.click('.rp-it[data-nm="3"]');
        await page.waitForFunction(() => !!document.querySelector('.rnp-workspace') && document.querySelector('.rnp-workspace').offsetParent !== null, null, { timeout: 8000 });
        assert.ok(await page.evaluate(() => !document.querySelector('#tab-rnp').classList.contains('rp-on')), 'после нажатия открылся РНП');
        console.log('ok   нажатие на артикул открывает РНП');
        // пункт «Цены» в меню РНП
        await page.evaluate(() => document.querySelector('#fly-rnp [data-nrn="rnp:prices"]').click());
        await page.waitForSelector('.rp-it[data-nm="2"]', { timeout: 8000 });
        assert.ok(await page.evaluate(() => /Цены/.test(document.getElementById('page-title').textContent)), 'заголовок страницы «Цены»');
        console.log('ok   пункт «Цены» в меню РНП');
        if (process.env.RP_SHOT) { await page.waitForTimeout(3500); await page.screenshot({ path: process.env.RP_SHOT + '.png' }); }
        await page.evaluate(() => document.querySelector('#fly-rnp [data-nrn="rnp:rnp"]').click());
        await page.waitForFunction(() => !document.querySelector('#tab-rnp').classList.contains('rp-on'));
        assert.deepStrictEqual(env.errors.filter((e) => !/404|favicon/.test(e)), [], 'в консоли нет ошибок');
        console.log('e2e цен РНП: все проверки прошли');
    } finally { await browser.close(); srv.close(); }
})().catch((e) => { console.error(e); process.exit(1); });

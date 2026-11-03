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
    wb_orders: ARTS.map((a) => ({ cabinet_id: CAB, nm_id: a.nm, order_date: new Date().toISOString(), pw: String(3000 + a.nm * 10), fp: String(Math.round((3000 + a.nm * 10) * 0.86)) })),
};

const until = async (fn, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (fn()) return true; await new Promise((r) => setTimeout(r, 100)); } return false; };
(async () => {
    const srv = await serve();
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    try {
        const calls = [];
        const env = await openApp(browser, 'http://127.0.0.1:' + srv.address().port, {
            phone: !!process.env.RP_PHONE, userId: ADMIN_ID, email: 'makstoychubek@gmail.com', latencyMs: 30, tables, rpcs: { is_super_admin: true },
            functions: { 'wb-proxy': async (b) => { calls.push(b); if (b.action === 'prices_get') return { currency: 'сом', items: ARTS.map((a) => ({ nmID: a.nm, price: 5000, discount: 30, discounted: 3000 + a.nm * 10 })) }; if (b.action === 'prices_set') return { uploadId: 77, count: b.params.items.length }; if (b.action === 'prices_status') return { status: 3, errors: [] }; if (b.action === 'cards_move') return { ok: true, moved: b.params.nmIDs.length }; return {}; } },
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
        const t = await page.evaluate(() => [...document.querySelector('.rp-it[data-nm="2"]').querySelectorAll('i,s')].map((e) => e.textContent.replace(/\s/g, '')));
        assert.deepStrictEqual(t, ['3020', '300'], 'две строки: цена и остаток: ' + t);
        assert.ok(await page.evaluate(() => document.querySelector('.rp-it[data-nm="4"]').classList.contains('rp-low')), 'остаток меньше 60 красным');
        await page.waitForFunction(() => !!document.querySelector('.rp-it[data-nm="2"] .rp-by'));
        assert.strictEqual(await page.evaluate(() => document.querySelector('.rp-it[data-nm="2"] .rp-by').textContent.replace(/\s/g, '')), '2597', 'серым цена для покупателя после скидки WB (3020 × 0,86)');
        console.log('ok   цена и остаток, серым цена для покупателя');
        assert.ok(await page.evaluate(() => !document.querySelector('.rp-leg')), 'подписи-ключа нет');
        assert.ok(await page.evaluate(() => !document.querySelector('.rnp-workspace').offsetParent), 'сам РНП скрыт, пока открыты цены');
        await page.click('.rp-it[data-nm="3"]');
        await page.waitForFunction(() => !!document.querySelector('.rnp-workspace') && document.querySelector('.rnp-workspace').offsetParent !== null, null, { timeout: 8000 });
        assert.ok(await page.evaluate(() => !document.querySelector('#tab-rnp').classList.contains('rp-on')), 'после нажатия открылся РНП');
        console.log('ok   нажатие на артикул открывает РНП');
        await page.evaluate(() => document.querySelector('#rnp-views [data-rv="prices"]').click());
        await page.waitForSelector('.rp-it[data-nm="2"]');
        // кружки итогов
        const rg = await page.evaluate(() => [...document.querySelectorAll('.rp-row')[0].querySelectorAll('.rp-ring')].map((e) => e.textContent.replace(/\s/g, '')));
        assert.strictEqual(rg.length, 3, 'у склейки три кружка: ' + rg);
        console.log('ok   три кружка итогов: ' + rg.join(' | '));
        // выбор артикулов и смена цены
        await page.evaluate(() => document.querySelector('.rp-ck[data-ck="3"]').click());
        await page.evaluate(() => document.querySelector('.rp-ck[data-ck="4"]').click());
        assert.ok(await page.evaluate(() => /Выбрано 2/.test(document.querySelector('.rp-bar').textContent)), 'панель действий: выбрано 2');
        await page.evaluate(() => document.querySelector('.rp-bar [data-act="price"]').click());
        await page.waitForSelector('#rp-modal #rp-val');
        await page.fill('#rp-val', '3300');
        assert.ok(await page.evaluate(() => /3\s?300/.test(document.querySelector('#rp-modal .rp-tbl').textContent) && /Покупатель/.test(document.querySelector('#rp-modal .rp-tbl').textContent)), 'в окне видно «станет 3300» и колонку «Покупатель»');
        await page.evaluate(() => document.querySelector('#rp-modal [data-mc="apply"]').click());
        await page.waitForFunction(() => !document.getElementById('rp-modal'));
        await until(() => calls.some((c) => c.action === 'prices_set'));
        const ps = calls.filter((c) => c.action === 'prices_set').pop();
        assert.ok(ps && ps.params.items.length === 2 && ps.params.items[0].price === 4714 && ps.params.items[0].discount === 30, 'в WB ушла цена до скидки 4714 при скидке 30%: ' + JSON.stringify(ps && ps.params.items));
        assert.ok(await page.evaluate(() => document.querySelector('.rp-it[data-nm="3"] i').textContent.replace(/\s/g, '') === '3300'), 'на экране цена сразу 3300');
        console.log('ok   цена: выбор, окно, WB получил расчёт, экран обновился сразу');
        // перенос в другую склейку
        await page.evaluate(() => document.querySelector('.rp-ck[data-ck="4"]').click());
        await page.evaluate(() => document.querySelector('.rp-bar [data-act="move"]').click());
        await page.waitForSelector('#rp-modal .rp-opt');
        await page.evaluate(() => document.querySelector('#rp-modal .rp-opt[data-tg="100"]').click());
        await page.evaluate(() => document.querySelector('#rp-modal [data-mc="apply"]').click());
        await page.waitForFunction(() => !document.getElementById('rp-modal'));
        await until(() => calls.some((c) => c.action === 'cards_move'));
        const mv = calls.filter((c) => c.action === 'cards_move').pop();
        assert.ok(mv && mv.params.targetIMT === 100 && mv.params.nmIDs.join() === '4', 'перенос ушёл в WB: ' + JSON.stringify(mv && mv.params));
        console.log('ok   перенос артикула в другую склейку');
        // пункт «Цены» в меню РНП
        await page.evaluate(() => document.querySelector('#fly-rnp [data-nrn="rnp:prices"]').click());
        await page.waitForSelector('.rp-it[data-nm="2"]', { timeout: 8000 });
        assert.ok(await page.evaluate(() => /Цены/.test(document.getElementById('page-title').textContent)), 'заголовок страницы «Цены»');
        console.log('ok   пункт «Цены» в меню РНП');
        if (process.env.RP_SHOT) { await page.waitForTimeout(3500); await page.screenshot({ path: process.env.RP_SHOT + '.png' }); }
        assert.strictEqual(await page.evaluate(() => localStorage.getItem('nr_rnp_view')), 'prices', 'выбранная страница «Цены» запомнена');
        // обновление страницы: остаёмся на «Ценах»
        const p2 = await page.context().newPage();
        await p2.goto(new URL('/space', page.url()).href);
        await p2.waitForFunction(() => typeof showTab === 'function');
        await p2.evaluate(() => showTab('rnp'));
        await p2.waitForSelector('.rp-it[data-nm="2"]', { timeout: 10000 });
        assert.ok(await p2.evaluate(() => document.getElementById('tab-rnp').classList.contains('rp-on')), 'после обновления открыты «Цены»');
        await p2.close();
        console.log('ok   после обновления страницы остаёмся на «Ценах»');
        await page.evaluate(() => document.querySelector('#fly-rnp [data-nrn="rnp:rnp"]').click());
        await page.waitForFunction(() => !document.querySelector('#tab-rnp').classList.contains('rp-on'));
        assert.deepStrictEqual(env.errors.filter((e) => !/404|favicon/.test(e)), [], 'в консоли нет ошибок');
        console.log('e2e цен РНП: все проверки прошли');
    } finally { await browser.close(); srv.close(); }
})().catch((e) => { console.error(e); process.exit(1); });

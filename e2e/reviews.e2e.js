/**
 * Аналитика → Отзывы: оценки как фильтр, подозрительные, смена артикула и периода.
 * Запуск: node e2e/reviews.e2e.js. Путь к Chromium можно задать через PW_CHROMIUM.
 */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');

const day = (n) => new Date(Date.now() - n * 86400e3).toISOString();
const FB = {
    1001: [
        { id: 'a1', nmId: 1001, stars: 5, text: 'Очень довольна, сидит идеально', pros: '', cons: '', at: day(2), size: '44', color: 'коричневый', photos: [], video: false, answered: true, answerText: 'Спасибо' },
        { id: 'a2', nmId: 1001, stars: 1, text: 'Ужасный товар, не покупайте', pros: '', cons: '', at: day(3), size: '46', color: '', photos: [], video: false, answered: false, answerText: '' },
        { id: 'a3', nmId: 1001, stars: 1, text: 'Ужасный товар, не покупайте', pros: '', cons: '', at: day(3), size: '48', color: '', photos: [], video: false, answered: false, answerText: '' },
        { id: 'a4', nmId: 1001, stars: 2, text: '', pros: '', cons: '', at: day(4), size: '', color: '', photos: [], video: false, answered: false, answerText: '' },
        { id: 'a5', nmId: 1001, stars: 4, text: 'Хороший костюм, рукав длинноват', pros: '', cons: '', at: day(5), size: '50', color: '', photos: [], video: false, answered: true, answerText: '' },
    ],
    1002: [{ id: 'b1', nmId: 1002, stars: 3, text: 'Нормально', pros: '', cons: '', at: day(1), size: '', color: '', photos: [], video: false, answered: false, answerText: '' }],
};
const tables = {
    spaces: [{ id: 's0', user_id: ADMIN_ID, email: 'makstoychubek@gmail.com', status: 'active', tariff_plan: 'vip', is_super_admin: true, full_name: 'M' }],
    cabinets: [{ id: CAB, name: 'T', wb_token_set: true, user_id: ADMIN_ID }],
    rnp_articles: [1001, 1002].map((nm, i) => ({ id: 'a' + i, cabinet_id: CAB, nm_id: nm, name: 'артикул_' + nm, is_active: true, sort_order: i })),
    rnp_daily_data: [1001, 1002].flatMap((nm) => Array.from({ length: 10 }, (_, d) => ({ cabinet_id: CAB, nm_id: nm, date: new Date(Date.now() + 6 * 3600e3 - d * 86400e3).toISOString().slice(0, 10), funnel_orders: 10, sales_count: 4, returns_count: 1 }))),
    wb_orders: [],
};

(async () => {
    const srv = await serve();
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    try {
        const calls = [];
        const env = await openApp(browser, 'http://127.0.0.1:' + srv.address().port, {
            phone: !!process.env.RV_PHONE, userId: ADMIN_ID, email: 'makstoychubek@gmail.com', latencyMs: 30, tables, rpcs: { is_super_admin: true },
            functions: { 'wb-proxy': async (b) => { calls.push(b); return b.action === 'feedbacks_by_nm' ? { feedbacks: b.params.all ? [].concat(...Object.values(FB)) : (FB[b.params.nmId] || []) } : {}; } },
        });
        const { page } = env;
        await page.evaluate(() => { document.documentElement.setAttribute('data-staff', '1'); showTab('analytics'); });
        await page.waitForSelector('#an-tabs [data-an="reviews"]', { state: 'attached', timeout: 10000 });
        await page.evaluate(() => document.querySelector('#an-tabs [data-an="reviews"]').click());
        await page.waitForSelector('.rv-item', { timeout: 10000 });
        const n = () => page.evaluate(() => document.querySelectorAll('.rv-item').length);
        assert.strictEqual(await n(), 5, 'показаны все пять отзывов');
        console.log('ok   отзывы артикула загрузились');
        if (process.env.RV_SHOT) { await page.waitForTimeout(3500); await page.screenshot({ path: process.env.RV_SHOT + '.png', fullPage: true }); }
        assert.ok(calls.some((c) => c.action === 'feedbacks_by_nm' && c.params.nmId === 1001), 'отзывы запрошены по первому артикулу');
        const rating = await page.evaluate(() => document.querySelector('.rv-rate b').textContent);
        assert.strictEqual(rating, '2,6', 'рейтинг = среднее по загруженным отзывам: ' + rating);
        console.log('ok   рейтинг посчитан');
        await page.click('.rv-drow[data-star="1"]');
        assert.strictEqual(await n(), 2, 'столбик «1 звезда» оставляет два отзыва');
        await page.click('.rv-drow[data-star="1"]');
        assert.strictEqual(await n(), 5, 'повторное нажатие снимает фильтр');
        console.log('ok   столбики оценок работают как фильтр');
        await page.click('.rv-tab[data-tab="sus"]');
        assert.strictEqual(await n(), 3, 'подозрительных три: два одинаковых текста и оценка без текста: ' + await n());
        assert.ok(await page.evaluate(() => /Одинаковый текст/.test(document.querySelector('.rv-list').textContent)), 'причина подозрения видна');
        console.log('ok   подозрительные отзывы помечены причиной');
        await page.click('.rv-tab[data-tab="all"]');
        await page.selectOption('#rv-art', '1002');
        await page.waitForFunction(() => document.querySelectorAll('.rv-item').length === 1);
        console.log('ok   смена артикула перегружает отзывы');
        await page.selectOption('#rv-days', '90');
        await page.waitForTimeout(300);
        const last = calls.filter((c) => c.action === 'feedbacks_by_nm').pop();
        assert.ok(last.params.dateTo - last.params.dateFrom > 80 * 86400, 'за 90 дней период расширен');
        console.log('ok   период 90 дней');
        // новые вкладки аналитики
        await page.selectOption('#rv-art', '1001');
        await page.waitForFunction(() => document.querySelectorAll('.rv-item').length === 5);
        assert.ok(await page.evaluate(() => !!document.querySelector('.rv-viewbody svg')), 'обзор: график по неделям нарисован');
        assert.ok(await page.evaluate(() => /Отвечено/.test(document.querySelector('.rv-viewbody').textContent)), 'обзор: блок ответов');
        await page.fill('#rv-goal', '4.7'); await page.dispatchEvent('#rv-goal', 'change');
        assert.ok(await page.evaluate(() => /\+\d+/.test(document.querySelector('.rv-big').textContent)), 'калькулятор цели считает');
        console.log('ok   вкладка «Обзор»');
        await page.click('.rv-tab[data-view="colors"]');
        assert.ok(await page.evaluate(() => /коричневый/i.test(document.querySelector('.rv-tbl').textContent) && /не указан/.test(document.querySelector('.rv-tbl').textContent)), 'цвета в таблице');
        assert.ok(await page.evaluate(() => document.querySelector('.rv-main').hidden), 'список скрыт на вкладке цветов');
        await page.click('.rv-tab[data-by="size"]');
        assert.ok(await page.evaluate(() => /46/.test(document.querySelector('.rv-tbl').textContent)), 'размеры в таблице');
        console.log('ok   вкладка «Цвета и размеры»');
        await page.click('.rv-tab[data-view="topics"]');
        assert.ok(await page.evaluate(() => document.querySelectorAll('.rv-brow').length === 9), 'темы показаны');
        await page.click('.rv-brow[data-topic="1"]');
        assert.ok(await page.evaluate(() => /Тема:/.test(document.querySelector('.rv-chip').textContent)), 'тема включила фильтр');
        await page.click('.rv-chip');
        assert.strictEqual(await n(), 5, 'фильтр по теме снят');
        console.log('ok   вкладка «О чём пишут»');
        await page.click('.rv-tab[data-view="all"]');
        await page.click('[data-all]');
        await page.waitForFunction(() => document.querySelectorAll('.rv-tbl tr').length >= 3, null, { timeout: 15000 });
        assert.ok(calls.some((c) => c.params && c.params.all === true && !c.params.nmId), 'все отзывы кабинета запрошены одним запросом');
        console.log('ok   вкладка «Все артикулы»');
        if (process.env.RV_SHOT2) { await page.click('.rv-tab[data-view="overview"]'); await page.waitForTimeout(800); await page.screenshot({ path: process.env.RV_SHOT2 + '-o.png', fullPage: true }); await page.click('.rv-tab[data-view="topics"]'); await page.waitForTimeout(500); await page.screenshot({ path: process.env.RV_SHOT2 + '-t.png', fullPage: true }); }
        await page.click('.rv-tab[data-view="overview"]');
        assert.deepStrictEqual(env.errors.filter((e) => !/404|favicon/.test(e)), [], 'в консоли нет ошибок');
        console.log('e2e отзывов: все проверки прошли');
    } finally { await browser.close(); srv.close(); }
})().catch((e) => { console.error(e); process.exit(1); });

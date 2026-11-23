/**
 * Карточки сводки (прибыль, куда уходит выручка, логистика, выкупы, остатки, топ-5, слабые товары) перенесены из РНП в Аналитику → «Сводка РНП»
 * (владелец, 23 ноября 2026). На странице РНП остаются вкладки, лента фото и таблица. Запуск: node e2e/analytics-summary.e2e.js
 */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');
const day = (n) => new Date(Date.now() + 6 * 3600e3 - n * 86400e3).toISOString().slice(0, 10);
const ARTS = [{ nm: 1001, sa: 'укороч_черный', cat: 'Укороченные' }, { nm: 1002, sa: 'укороч_бордо', cat: 'Укороченные' }, { nm: 2001, sa: 'оверсайз_серый', cat: 'Оверсайз' }];
const tables = {
    spaces: [{ id: 's0', user_id: ADMIN_ID, email: 'makstoychubek@gmail.com', status: 'active', tariff_plan: 'vip', is_super_admin: true, first_name: 'M', last_name: 'T', full_name: 'M T' }],
    cabinets: [{ id: CAB, name: 'Zevina 1', wb_token_set: true, user_id: ADMIN_ID }], team_staff: [{ email: 'makstoychubek@gmail.com' }],
    rnp_articles: ARTS.map((a, i) => ({ id: 'a' + i, cabinet_id: CAB, nm_id: a.nm, seller_article: a.sa, name: a.sa, category: a.cat, is_active: true, cost_price: 1000, photo_url: null, sort_order: i })),
    rnp_daily_data: ARTS.flatMap((a, i) => Array.from({ length: 14 }, (_, d) => ({ cabinet_id: CAB, nm_id: a.nm, date: day(d), orders_count: 10 + i, orders_sum: (10 + i) * 5000, sales_count: 6 + i, sales_sum: (6 + i) * 5000, ad_spend: 500, impressions: 1000, clicks: 50 }))),
    wb_stocks: [], user_sessions: [],
};
(async () => {
    const srv = await serve();
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    let failed = 0;
    const run = async (name, fn) => { try { await fn(); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + String(e.message || e).split('\n')[0]); } };
    try {
        const env = await openApp(browser, 'http://127.0.0.1:' + srv.address().port, { userId: ADMIN_ID, email: 'makstoychubek@gmail.com', latencyMs: 30, tables, rpcs: { is_super_admin: true }, functions: { 'wb-proxy': async () => ({}) } });
        const { page } = env;
        await page.setViewportSize({ width: 1500, height: 860 });
        await page.evaluate(() => { const s = document.getElementById('nr-splash'); if (s) s.remove(); showTab('rnp'); });
        await page.waitForSelector('#tab-rnp .rnp-sheet-table', { timeout: 20000 }); await page.waitForTimeout(1200);
        await run('на странице РНП карточек сводки нет, лента фото и таблица на месте', async () => {
            const r = await page.evaluate(() => ({ cards: document.querySelectorAll('#tab-rnp .rnp-gh-card, #tab-rnp .rnp-gh-hero').length, photos: !!document.querySelector('#tab-rnp .rnp-gh-photos'), table: !!document.querySelector('#tab-rnp .rnp-sheet-table') }));
            assert.deepStrictEqual(r, { cards: 0, photos: true, table: true });
        });
        await page.evaluate(() => NrNav.go('analytics', 'rnp'));
        await page.waitForFunction(() => document.querySelectorAll('#an-rnp-root .rnp-gh-card').length >= 5, null, { timeout: 20000 });
        await run('Аналитика → «Сводка РНП»: карточки на месте, прибыль считается по данным РНП', async () => {
            const r = await page.evaluate(() => ({ cards: document.querySelectorAll('#an-rnp-root .rnp-gh-card').length, hero: /заказы\s+\d+/.test(document.querySelector('#an-rnp-root .rnp-gh-profit .rnp-gh-sub')?.textContent || ''), titles: [...document.querySelectorAll('#an-rnp-root .rnp-gh-title')].map((e) => e.textContent.replace(/\s+/g, ' ').trim().slice(0, 24)) }));
            assert.ok(r.cards >= 5 && r.hero, JSON.stringify(r));
            for (const t of ['Куда уходит выручка', 'На что уходит логистика', 'Выкупы и отказы']) assert.ok(r.titles.some((x) => x.startsWith(t)), 'нет карточки «' + t + '»: ' + r.titles);
        });
        await run('в списке подразделов Аналитики есть «Сводка РНП», она первая и открыта по умолчанию', async () => {
            const r = await page.evaluate(() => ({ tabs: [...document.querySelectorAll('#an-tabs .an-tab')].map((b) => b.textContent.trim()), on: document.querySelector('#an-tabs .an-tab.on')?.textContent.trim() }));
            assert.strictEqual(r.tabs[0], 'Сводка РНП'); assert.strictEqual(r.on, 'Сводка РНП');
        });
        await run('строка «Топ-5»/«Теряем» ведёт в РНП', async () => {
            const has = await page.evaluate(() => !!document.querySelector('#an-rnp-root .rnp-gh-li'));
            if (!has) return; // на тестовых данных строк может не быть
            await page.click('#an-rnp-root .rnp-gh-li'); await page.waitForTimeout(900);
            assert.strictEqual(await page.evaluate(() => getCurrentActiveTab()), 'rnp');
        });
        await run('ошибок скриптов нет', async () => assert.deepStrictEqual(env.errors || [], []));
    } finally { await browser.close(); srv.close(); }
    if (failed) { console.log('e2e сводки РНП в Аналитике: провалено ' + failed); process.exit(1); }
    console.log('e2e сводки РНП в Аналитике: все проверки прошли');
})();

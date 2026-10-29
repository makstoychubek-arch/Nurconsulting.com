/**
 * РНП: первая отрисовка таблицы не ждёт тяжёлую выборку по дням (финансы/реклама/FBS).
 * Запуск: npm run test:e2e. Путь к Chromium можно задать через PW_CHROMIUM.
 */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');

const day = (n) => new Date(Date.now() + 6 * 3600e3 - n * 86400e3).toISOString().slice(0, 10);
const ARTS = [{ nm: 1001, sa: 'a', cat: 'К1' }, { nm: 1002, sa: 'b', cat: 'К1' }, { nm: 2001, sa: 'c', cat: 'К2' }];
const tables = {
    spaces: [{ id: 's0', user_id: ADMIN_ID, email: 'makstoychubek@gmail.com', status: 'active', tariff_plan: 'vip', is_super_admin: true, first_name: 'M', last_name: 'T', full_name: 'M T' }],
    cabinets: [{ id: CAB, name: 'T', wb_token_set: true, user_id: ADMIN_ID }],
    rnp_articles: ARTS.map((a, i) => ({ id: 'a' + i, cabinet_id: CAB, nm_id: a.nm, seller_article: a.sa, name: a.sa, category: a.cat, is_active: true, cost_price: 1000, photo_url: null, sort_order: i })),
    rnp_daily_data: ARTS.flatMap((a, i) => Array.from({ length: 14 }, (_, d) => ({ cabinet_id: CAB, nm_id: a.nm, date: day(d), orders_count: 10 + i, orders_sum: 50000, sales_count: 6, sales_sum: 30000, ad_spend: 500, impressions: 1000, clicks: 50 }))),
};

(async () => {
    const srv = await serve();
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    try {
        const env = await openApp(browser, 'http://127.0.0.1:' + srv.address().port, {
            userId: ADMIN_ID, email: 'makstoychubek@gmail.com', latencyMs: 150, tables, rpcs: { is_super_admin: true },
            functions: { 'wb-proxy': async () => ({}) },
        });
        const { page } = env;
        const SLOW = 4000;
        await page.route(/rnp_daily_data/, async (r) => { await new Promise((x) => setTimeout(x, SLOW)); r.fallback(); });
        const t0 = Date.now();
        await page.evaluate(() => showTab('rnp'));
        await page.waitForFunction(() => [...document.querySelectorAll('tr')].some((r) => /ЗАКАЗЫ/.test(r.textContent) && /\d/.test(r.textContent.replace('ЗАКАЗЫ', ''))), null, { timeout: 20000 });
        const ms = Date.now() - t0;
        assert.ok(ms < SLOW, 'таблица с цифрами появилась за ' + ms + ' мс, хотя тяжёлая выборка идёт ' + SLOW + ' мс — отрисовка не должна её ждать');
        console.log('ok   РНП: таблица появляется, не дожидаясь тяжёлой выборки (' + ms + ' мс при задержке ' + SLOW + ' мс)');
        // смена периода: плашки вместо значений появляются сразу и уходят, когда пришли данные
        {
            const r = await page.evaluate(async () => {
                const t = performance.now();
                onDateRangeApplied();
                const ms = performance.now() - t;
                return { ms, on: document.documentElement.classList.contains('nr-period-busy') };
            });
            assert.ok(r.on && r.ms < 100, 'после смены дат плашки видны сразу (' + Math.round(r.ms) + ' мс)');
            await page.waitForFunction(() => !document.documentElement.classList.contains('nr-period-busy'), null, { timeout: 15000 });
            console.log('ok   смена периода: плашки загрузки сразу и снимаются после данных');
        }
        // обычные долгие запросы не показывают уведомление о загрузке: оно нужно только при первой загрузке нового кабинета
        await page.waitForTimeout(2200);
        assert.strictEqual(await page.locator('.nru-toast').count(), 0, 'при долгой загрузке РНП уведомления о первой синхронизации нет');
        console.log('ok   РНП: при долгой загрузке уведомления нет');
        await page.route(/functions\/v1\/auto-sync/, async (r) => { await new Promise((x) => setTimeout(x, 3500)); r.fulfill({ json: { ok: true } }); });
        page.evaluate(() => fetch('https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/auto-sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'full', cabinet_id: 'x' }) }).catch(() => {})).catch(() => {});
        await page.waitForSelector('.nru-toast.on', { timeout: 4000 });
        console.log('ok   первая загрузка нового кабинета показывает уведомление');
        assert.deepStrictEqual(env.errors, [], 'ошибок скриптов нет: ' + env.errors.join('; '));
        console.log('e2e загрузки РНП: все проверки прошли');
    } catch (e) {
        console.error('FAIL', e.message);
        process.exitCode = 1;
    } finally {
        await browser.close();
        srv.close();
    }
})();

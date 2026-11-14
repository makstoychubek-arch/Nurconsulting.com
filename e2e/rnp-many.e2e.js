/**
 * РНП с большим кабинетом (45 артикулов, как у настоящих): ни один запрос к WB не несёт больше 20 артикулов
 * (WB отвечает 400 «too many nmIds»), в консоли нет красных ошибок и ошибок WB API.
 * Запуск: node e2e/rnp-many.e2e.js. Путь к Chromium: PW_CHROMIUM.
 */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');

const day = (n) => new Date(Date.now() + 6 * 3600e3 - n * 86400e3).toISOString().slice(0, 10);
const ARTS = Array.from({ length: 45 }, (_, i) => ({ nm: 5000 + i, sa: 'art' + i, cat: 'К' + (i % 3) }));
const tables = {
    spaces: [{ id: 's0', user_id: ADMIN_ID, email: 'makstoychubek@gmail.com', status: 'active', tariff_plan: 'vip', is_super_admin: true, first_name: 'M', last_name: 'T', full_name: 'M T' }],
    cabinets: [{ id: CAB, name: 'T', wb_token_set: true, user_id: ADMIN_ID }],
    rnp_articles: ARTS.map((a, i) => ({ id: 'a' + i, cabinet_id: CAB, nm_id: a.nm, seller_article: a.sa, name: a.sa, category: a.cat, is_active: true, cost_price: 1000, photo_url: null, sort_order: i })),
    rnp_daily_data: ARTS.flatMap((a, i) => Array.from({ length: 10 }, (_, d) => ({ cabinet_id: CAB, nm_id: a.nm, date: day(d), orders_count: 5 + (i % 4), orders_sum: 20000, sales_count: 3, sales_sum: 12000 }))),
};

(async () => {
    const srv = await serve();
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    try {
        const env = await openApp(browser, 'http://127.0.0.1:' + srv.address().port, {
            userId: ADMIN_ID, email: 'makstoychubek@gmail.com', latencyMs: 20, tables, rpcs: { is_super_admin: true },
            functions: { 'wb-proxy': async (b) => { const ids = (b && (b.params || b).nmIds) || []; return ids.length > 20 ? { __status: 400, body: { error: 'too many nmIds is expected - max 20' } } : {}; } },
        });
        const { page, calls, errors } = env;
        const warns = [];
        page.on('console', (m) => { if (m.type() === 'warning' && /WB API 4\d\d|too many/i.test(m.text())) warns.push(m.text().slice(0, 160)); });
        await page.evaluate(() => { const s = document.getElementById('nr-splash'); if (s) s.remove(); showTab('rnp'); });
        await page.waitForTimeout(6000);
        const big = calls.filter((c) => c.kind === 'fn' && ((c.body && (c.body.params || c.body).nmIds) || []).length > 20);
        assert.equal(big.length, 0, 'запросов к WB с более чем 20 артикулами: ' + big.length);
        assert.equal(warns.length, 0, 'ошибки WB API в консоли: ' + warns.join(' | '));
        assert.equal((errors || []).length, 0, 'ошибки на странице: ' + (errors || []).join(' | ').slice(0, 300));
        const nFn = calls.filter((c) => c.kind === 'fn' && c.name === 'wb-proxy').length; const nFun = calls.filter((c) => c.kind === 'fn' && JSON.stringify(c.body).includes('sales_funnel_history')).length; console.log('воронка: запросов', nFun);
        console.log('ok   РНП на 45 артикулах: запросов к WB-прокси ' + nFn + ', больше 20 артикулов в запросе нет, ошибок нет');
    } finally { await browser.close(); srv.close(); }
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });

/**
 * РК на заглушке: открытие одной волной запросов, мгновенные кнопки «Пауза/Запуск», кэш прошлой модели при повторном открытии.
 * Запуск: npm run test:e2e. Путь к Chromium можно задать через PW_CHROMIUM.
 */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');

const day = (n) => new Date(Date.now() + 6 * 3600e3 - n * 86400e3).toISOString().slice(0, 10);
const CAMPS = [[39497221, 'СРС Пиджаки оверсайз', 9], [39497232, 'СРС Костюм оверсайз', 9], [39497335, 'СРС Свитера', 9], [40489986, 'Поиск оверсайз черный', 11]];
const tables = {
    spaces: [{ id: 's0', user_id: ADMIN_ID, email: 'makstoychubek@gmail.com', status: 'active', tariff_plan: 'vip', is_super_admin: true, first_name: 'M', last_name: 'T', full_name: 'M T' }],
    cabinets: [{ id: CAB, name: 'Zevina 1', wb_token_set: true, user_id: ADMIN_ID, adv_token_valid: true, adv_daily_budget_cap: 60000 }],
    advertising_campaigns: CAMPS.map(([id, n, st]) => ({ cabinet_id: CAB, campaign_id: id, campaign_name: n, status: st, type: 9, created_at: '2026-09-01T00:00:00Z' })),
    advertising_daily_stats: CAMPS.flatMap(([id], i) => Array.from({ length: 14 }, (_, d) => ({ cabinet_id: CAB, campaign_id: id, stat_date: day(d), spend: 800 + i * 120 + d * 7, sum_price: 6000 + i * 900, clicks: 90 + d, atbs: 20, orders: 8 + (i % 3), views: 4000, shks: 6, data: {} }))),
    adv_campaigns: [], rnp_articles: [], wb_stocks: [],
};
const SERVER_DELAY = 700;

async function open(browser, base) {
    const env = await openApp(browser, base, {
        userId: ADMIN_ID, email: 'makstoychubek@gmail.com', latencyMs: 150, tables, rpcs: { is_super_admin: true },
        functions: { 'wb-proxy': async () => { await new Promise((r) => setTimeout(r, SERVER_DELAY)); return { confirmedStatus: 11 }; } },
    });
    env.t0 = Date.now();
    await env.page.evaluate(() => showTab('advertising'));
    await env.page.waitForFunction(() => window.AdsHQ && window.AdsHQ.getModelReady && window.AdsHQ.getModelReady(), null, { timeout: 15000 });
    await env.page.locator('.ads-hq-toggle').first().waitFor({ state: 'attached' });
    return env;
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('РК открывается одной волной запросов, а не четырьмя подряд', async ({ calls }) => {
    const at = (t) => calls.filter((c) => c.kind === 'read' && c.table === t).map((c) => c.at);
    const times = ['adv_campaigns', 'wb_stocks', 'adv_start_schedule'].map((t) => Math.min(...at(t)));
    const spread = Math.max(...times) - Math.min(...times);
    assert.ok(spread < 120, 'таблицы РК запрошены с разницей ' + spread + ' мс (раньше около 330)');
});

test('«Пауза» по кампании: статус на экране меняется сразу, WB догоняет в фоне', async ({ page, calls }) => {
    const sel = '.ads-hq-toggle[data-act="pause"]';
    const wb = await page.locator(sel).first().getAttribute('data-wb');
    const t0 = Date.now();
    await page.evaluate((s) => document.querySelector(s).click(), sel);
    await page.waitForFunction((w) => !document.querySelector('.ads-hq-toggle[data-act="pause"][data-wb="' + w + '"]'), wb, { timeout: 300 });
    assert.ok(Date.now() - t0 < 300, 'экран обновился за ' + (Date.now() - t0) + ' мс, а WB отвечает ' + SERVER_DELAY + ' мс');
    await page.waitForTimeout(SERVER_DELAY + 500);
    assert.ok(calls.some((c) => c.kind === 'fn' && c.name === 'wb-proxy'), 'команда ушла в WB');
});

test('повторное открытие вкладки показывает прошлые цифры сразу', async ({ page }) => {
    await page.evaluate(() => showTab('dashboard'));
    await page.waitForTimeout(300);
    const t0 = Date.now();
    await page.evaluate(() => showTab('advertising'));
    await page.waitForFunction(() => document.querySelectorAll('.ads-hq-toggle').length > 0, null, { timeout: 200 });
    assert.ok(Date.now() - t0 < 200, 'список виден через ' + (Date.now() - t0) + ' мс');
});

(async () => {
    const srv = await serve();
    const base = 'http://127.0.0.1:' + srv.address().port;
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    let failed = 0;
    for (const t of tests) {
        let env;
        try { env = await open(browser, base); await t.fn(env); console.log('ok   ' + t.name); }
        catch (e) { failed++; console.log('FAIL ' + t.name + '\n     ' + String(e.message || e).split('\n')[0]); }
        if (env) await env.ctx.close();
    }
    await browser.close();
    srv.close();
    if (failed) { console.log(failed + ' из ' + tests.length + ' не прошли'); process.exit(1); }
    console.log('e2e РК: все ' + tests.length + ' проверок прошли');
})();

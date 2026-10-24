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
    advertising_campaigns: CAMPS.map(([id, n, st], i) => ({ cabinet_id: CAB, campaign_id: id, campaign_name: n, status: st, type: 9, budget_total: i === 0 ? 120 : 4500, created_at: '2026-09-01T00:00:00Z' })),
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
    await env.page.locator('.ads-sl').first().waitFor({ state: 'attached' });
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
    const sel = '.ads-sl:not(.p0) .ads-sl-b[data-pos="0"]';
    const wb = await page.locator(sel).first().evaluate((el) => el.closest('.ads-sl').dataset.wb);
    const t0 = Date.now();
    await page.evaluate((s) => document.querySelector(s).click(), sel);
    await page.waitForFunction((w) => document.querySelector('.ads-sl.p0[data-wb="' + w + '"]'), wb, { timeout: 300 });
    assert.ok(Date.now() - t0 < 300, 'экран обновился за ' + (Date.now() - t0) + ' мс, а WB отвечает ' + SERVER_DELAY + ' мс');
    await page.waitForTimeout(SERVER_DELAY + 500);
    assert.ok(calls.some((c) => c.kind === 'fn' && c.name === 'wb-proxy'), 'команда ушла в WB');
});

test('ползунок 0 / 1 / A: «A» помечает кампанию автопилотом сразу, «1» снимает', async ({ page, calls }) => {
    const sel = '.ads-sl.p1 .ads-sl-b[data-pos="2"]';
    const wb = await page.locator(sel).first().evaluate((el) => el.closest('.ads-sl').dataset.wb);
    const t0 = Date.now();
    await page.evaluate((s) => document.querySelector(s).click(), sel);
    await page.waitForFunction((w) => document.querySelector('.ads-sl.p2[data-wb="' + w + '"]'), wb, { timeout: 300 });
    assert.ok(Date.now() - t0 < 300, 'ползунок переехал за ' + (Date.now() - t0) + ' мс');
    await page.waitForTimeout(600);
    assert.ok(calls.some((c) => c.table === 'ad_autopilot_campaigns'), 'пометка ушла в базу');
});

test('Пульт: ползунок «A» меняется сразу и ставит пометку автопилота', async ({ page, calls }) => {
    const sel = '.adp2-sl.p1 button[data-pos="2"]';
    const key = await page.locator(sel).first().getAttribute('data-key');
    const t0 = Date.now();
    await page.evaluate((s) => document.querySelector(s).click(), sel);
    await page.waitForFunction((k) => document.querySelector('.adp2-sl.p2 button[data-key="' + k + '"]'), key, { timeout: 300 });
    assert.ok(Date.now() - t0 < 300, 'ползунок переехал за ' + (Date.now() - t0) + ' мс');
    await page.waitForTimeout(600);
    assert.ok(calls.some((c) => c.table === 'ad_autopilot_campaigns'), 'пометка ушла в базу');
});

test('Пульт: обновление и фоновая подгрузка ставок не пересоздают строки (без «трясёт»)', async ({ page }) => {
    // Раньше render() целиком стирал #adv-pulse через innerHTML при каждой перерисовке AdsHQ,
    // а patchRow() подменял строку через replaceWith — ползунки теряли фокус и мигали на каждое обновление.
    await page.waitForFunction(() => document.querySelectorAll('#adv-pulse .adp2-row').length >= 4, null, { timeout: 5000 });
    await page.evaluate(() => {
        window.__tagged = [];
        document.querySelectorAll('#adv-pulse .adp2-row, #adv-pulse .adp2-sl button').forEach((el, i) => {
            el.__identityTag = 'keep-' + i;
            window.__tagged.push(el);
        });
    });
    await page.evaluate(() => document.getElementById('ads-hq-reload')?.click());
    await page.waitForTimeout(SERVER_DELAY + 700);
    const survived = await page.evaluate(() =>
        window.__tagged.every((el) => el.isConnected && el.__identityTag));
    assert.ok(survived, 'строки/ползунки Пульта пережили «Обновить» без пересоздания DOM-узлов');
});

test('Дашборд на телефоне: новый компактный вид берёт цифры из блоков дашборда', async ({ page }) => {
    await page.setViewportSize({ width: 424, height: 900 });
    await page.evaluate(() => showTab('dashboard'));
    await page.waitForFunction(() => document.getElementById('tab-dashboard').classList.contains('nmd-on'), null, { timeout: 3000 });
    await page.evaluate(() => {
        const set = (s, t) => { const e = document.querySelector(s); if (e) { e.textContent = t; e.classList.remove('nr-skel'); } };
        set('#m-orders-sum', '6 275 018 ₽'); set('#m-orders-count', '1 229 шт'); set('#pnl-profit', '317 975 ₽');
    });
    await page.waitForFunction(() => /6 275 018/.test(document.getElementById('nr-md').innerText) && /317 975/.test(document.getElementById('nr-md').innerText), null, { timeout: 2000 });
    const hiddenOld = await page.evaluate(() => getComputedStyle(document.getElementById('dash-pnl')).display);
    assert.strictEqual(hiddenOld, 'none', 'старые блоки скрыты на телефоне');
});

test('Пульт: у каждой РК виден баланс, по нажатию открывается пополнение и сумма уходит в WB', async ({ page, calls }) => {
    await page.waitForFunction(() => document.querySelectorAll('#adv-pulse .adp2-bal').length >= 4, null, { timeout: 5000 });
    const bals = await page.evaluate(() => [...document.querySelectorAll('#adv-pulse .adp2-bal b')].map((b) => b.textContent.trim()));
    assert.ok(bals.every((t) => /₽|—/.test(t)), 'в каждой строке есть баланс: ' + bals.join(', '));
    assert.ok(await page.locator('#adv-pulse .adp2-bal b.bad').count() >= 1, 'маленький баланс (меньше 300 ₽) подсвечен');
    const t0 = Date.now();
    await page.locator('#adv-pulse .adp2-bal').first().click();
    await page.locator('.adp2-md #adp2-dep').waitFor({ state: 'visible' });
    assert.ok(Date.now() - t0 < 300, 'окно пополнения открылось за ' + (Date.now() - t0) + ' мс');
    await page.locator('.adp2-pre button[data-sum="2000"]').click();
    const before = await page.locator('#adv-pulse .adp2-bal b').first().textContent();
    await page.locator('#adp2-dep').click();
    await page.waitForFunction((b) => document.querySelector('#adv-pulse .adp2-bal b').textContent.trim() !== b.trim(), before, { timeout: 300 });
    await page.waitForTimeout(SERVER_DELAY + 400);
    const dep = calls.filter((c) => c.kind === 'fn' && c.name === 'wb-proxy' && c.body && c.body.action === 'advert_deposit');
    assert.strictEqual(dep.length, 1, 'пополнение ушло в WB один раз');
    assert.strictEqual(dep[0].body.params.sum, 2000, 'сумма 2000 ₽');
});

test('Дашборд на телефоне: число с барабанами цифр (NrWow) читается как число, а не скелет', async ({ page }) => {
    // Раньше textContent барабана — «0123456789…» на каждый разряд; компактный вид считал это мусором
    // и вечно держал серый скелет («мутно»), потом писал «Нет данных».
    await page.setViewportSize({ width: 424, height: 900 });
    await page.evaluate(() => showTab('dashboard'));
    await page.waitForFunction(() => document.getElementById('tab-dashboard').classList.contains('nmd-on'), null, { timeout: 3000 });
    await page.evaluate(() => {
        const host = document.getElementById('m-orders-sum');
        host.classList.remove('nr-skel');
        window.NrWow.tickHost(host, '0', '1 200 000');
        const c = document.getElementById('m-orders-count'); if (c) c.textContent = '220 шт';
        const p = document.getElementById('pnl-profit'); if (p) p.textContent = '50 000';
    });
    await page.waitForTimeout(800);
    const dbg = await page.evaluate(() => ({ md: document.getElementById('nr-md').innerText.slice(0, 120), host: document.getElementById('m-orders-sum').outerHTML.slice(0, 200) }));
    assert.ok(/1 200 000/.test(dbg.md) && !/NaN/.test(dbg.md), JSON.stringify(dbg));
});

test('повторное открытие вкладки показывает прошлые цифры сразу', async ({ page }) => {
    await page.evaluate(() => showTab('dashboard'));
    await page.waitForTimeout(300);
    const t0 = Date.now();
    await page.evaluate(() => showTab('advertising'));
    await page.waitForFunction(() => document.querySelectorAll('.ads-sl').length > 0, null, { timeout: 200 });
    assert.ok(Date.now() - t0 < 200, 'список виден через ' + (Date.now() - t0) + ' мс');
});

test('после жёсткого обновления РК сразу показывает прошлые цифры из памяти браузера', async ({ page }) => {
    await page.evaluate(() => showTab('advertising'));
    await page.waitForFunction(() => document.querySelectorAll('.ads-sl').length > 0, null, { timeout: 8000 });
    await page.waitForTimeout(400);
    assert.ok(await page.evaluate(() => !!localStorage.getItem('nr_ads_hq_v1')), 'снимок РК сохранён');
    await page.goto(new URL('/space', page.url()).href);
    await page.waitForFunction(() => typeof showTab === 'function' && typeof cabinetsLoaded !== 'undefined' && cabinetsLoaded, null, { timeout: 15000 });
    const t0 = Date.now();
    await page.evaluate(() => showTab('advertising'));
    await page.waitForFunction(() => document.querySelectorAll('.ads-sl').length > 0, null, { timeout: 400 });
    assert.ok(Date.now() - t0 < 400, 'список виден через ' + (Date.now() - t0) + ' мс');
});

(async () => {
    const srv = await serve();
    const base = 'http://127.0.0.1:' + srv.address().port;
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    let failed = 0;
    for (const t of tests) {
        let env;
        try { env = await open(browser, base); await t.fn(env); console.log('ok   ' + t.name); }
        catch (e) { failed++; console.log('FAIL ' + t.name + '\n     ' + String(e.message || e).split('\n').slice(0,14).join('\n     ')); }
        if (env) await env.ctx.close();
    }
    await browser.close();
    srv.close();
    if (failed) { console.log(failed + ' из ' + tests.length + ' не прошли'); process.exit(1); }
    console.log('e2e РК: все ' + tests.length + ' проверок прошли');
})();

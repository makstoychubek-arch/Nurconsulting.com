/**
 * А/Б тесты на заглушке: список карточек не перерисовывается целиком на каждое обновление,
 * кнопки «Удалить»/«Завершить» реагируют сразу, не дожидаясь ответа сервера.
 * Запуск: npm run test:e2e. Путь к Chromium можно задать через PW_CHROMIUM.
 */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');

const TESTS = [
    { id: 'ab1', cabinet_id: CAB, product_name: 'Свитер-айвори', nm_id: 1218782505, status: 'active', created_at: '2026-09-01T00:00:00Z', started_at: '2026-09-01T00:00:00Z', rotation_interval_min: 30, settings: {} },
    { id: 'ab2', cabinet_id: CAB, product_name: 'Куртка-найк', nm_id: 492027936, status: 'active', created_at: '2026-09-02T00:00:00Z', started_at: '2026-09-02T00:00:00Z', rotation_interval_min: 60, settings: {} },
];
const VARIANTS = [
    { id: 'v1a', test_id: 'ab1', variant_label: 'A', photo_url: 'https://example.test/a.jpg', impressions: 3000, clicks: 120, orders: 10, is_currently_on_wb: true, minutes_active: 600 },
    { id: 'v1b', test_id: 'ab1', variant_label: 'B', photo_url: 'https://example.test/b.jpg', impressions: 2800, clicks: 90, orders: 6, is_currently_on_wb: false, minutes_active: 500 },
    { id: 'v2a', test_id: 'ab2', variant_label: 'A', photo_url: 'https://example.test/c.jpg', impressions: 1500, clicks: 60, orders: 4, is_currently_on_wb: true, minutes_active: 300 },
    { id: 'v2b', test_id: 'ab2', variant_label: 'B', photo_url: 'https://example.test/d.jpg', impressions: 1400, clicks: 50, orders: 3, is_currently_on_wb: false, minutes_active: 280 },
];
const tables = {
    spaces: [{ id: 's0', user_id: ADMIN_ID, email: 'makstoychubek@gmail.com', status: 'active', tariff_plan: 'vip', is_super_admin: true, first_name: 'M', last_name: 'T', full_name: 'M T' }],
    cabinets: [{ id: CAB, name: 'Zevina 1', wb_token_set: true, user_id: ADMIN_ID }],
    ab_tests: TESTS,
    ab_test_variants: VARIANTS,
    ab_test_rotation_log: [],
};

async function open(browser, base, latencyMs) {
    const env = await openApp(browser, base, {
        userId: ADMIN_ID, email: 'makstoychubek@gmail.com', latencyMs: latencyMs || 150, tables, rpcs: { is_super_admin: true },
    });
    await env.page.evaluate(() => showTab('ab-testing'));
    await env.page.locator('.abtest-card').first().waitFor({ state: 'attached' });
    // Подменяем модалку подтверждения, чтобы не ждать реального клика по ней в тесте.
    await env.page.evaluate(() => { if (window.NrUi) window.NrUi.confirm = async () => true; });
    return env;
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('список тестов обновляется патчем, а не пересборкой всех карточек', async ({ page }) => {
    const before = await page.evaluate(() => {
        const el = document.getElementById('abtest-card-ab1');
        el.__marked = true;
        return true;
    });
    assert.ok(before);
    await page.evaluate(() => renderABTests());
    const survived = await page.evaluate(() => !!document.getElementById('abtest-card-ab1')?.__marked);
    assert.ok(survived, 'узел карточки должен быть тем же самым DOM-элементом после повторной отрисовки (без мигания)');
});

test('«Удалить» убирает карточку сразу, не дожидаясь ответа сервера', async ({ page }) => {
    const t0 = Date.now();
    // Не ждём завершения всей цепочки запросов — только запускаем её, как реальный клик по кнопке.
    page.evaluate(() => { void deleteABTest('ab2'); });
    await page.waitForFunction(() => !document.getElementById('abtest-card-ab2'), null, { timeout: 300 });
    const dt = Date.now() - t0;
    assert.ok(dt < 300, 'карточка пропала за ' + dt + ' мс, а сервер отвечает не раньше 150 мс + 3 запроса');
});

test('«Завершить» мгновенно меняет статус карточки на «Завершён»', async ({ page }) => {
    // По умолчанию показаны только активные тесты — переключаемся на «Все», чтобы увидеть
    // завершённую карточку на месте, а не её исчезновение из списка (оно тоже верно, но проверяем бейдж).
    await page.evaluate(() => filterTests('all'));
    const t0 = Date.now();
    page.evaluate(() => { void finishABTest('ab1', 'manual'); });
    await page.waitForFunction(() => document.getElementById('abtest-card-ab1')?.textContent.includes('Завершён'), null, { timeout: 300 });
    const dt = Date.now() - t0;
    assert.ok(dt < 300, 'статус «Завершён» появился за ' + dt + ' мс');
});

test('«Завершить» при активном фильтре сразу убирает карточку из списка', async ({ page }) => {
    const t0 = Date.now();
    page.evaluate(() => { void finishABTest('ab1', 'manual'); });
    await page.waitForFunction(() => !document.getElementById('abtest-card-ab1'), null, { timeout: 300 });
    const dt = Date.now() - t0;
    assert.ok(dt < 300, 'карточка пропала из «Активных» за ' + dt + ' мс');
});

(async () => {
    const srv = await serve();
    const base = 'http://127.0.0.1:' + srv.address().port;
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    let failed = 0;
    for (const t of tests) {
        const env = await open(browser, base, 400);
        try {
            await t.fn({ page: env.page, calls: env.calls });
            console.log('ok   ' + t.name);
        } catch (e) {
            failed++;
            console.log('FAIL ' + t.name);
            console.log('     ' + (e.message || e));
        }
        await env.ctx.close();
    }
    await browser.close();
    srv.close();
    if (failed) { console.log(`\n${failed} из ${tests.length} не прошли`); process.exit(1); }
    console.log(`e2e А/Б тестов: все ${tests.length} проверки прошли`);
})();

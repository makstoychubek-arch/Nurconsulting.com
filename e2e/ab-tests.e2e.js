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
TESTS.push({ id: 'ab3', cabinet_id: CAB, product_name: 'Костюм-деловой', nm_id: 296556347, status: 'finished', created_at: '2026-10-22T00:00:00Z', started_at: '2026-10-22T09:00:00Z', finished_at: '2026-10-22T20:00:00Z', rotation_interval_min: 30, current_variant_index: 0, settings: { campaigns: [39497232], campaignNames: { '39497232': 'СРС Костюм оверсайз' }, sources: { ads: true, funnel: true }, rotateByImpressions: true, minImpressions: 1000, metric: 'ctr' } });
const VARIANTS = [
    { id: 'v3a', test_id: 'ab3', variant_label: '1', photo_url: 'https://example.test/k1.jpg', impressions: 900, clicks: 30, orders: 2, is_currently_on_wb: false, minutes_active: 60 },
    { id: 'v3b', test_id: 'ab3', variant_label: '2', photo_url: 'https://example.test/k2.jpg', impressions: 900, clicks: 36, orders: 3, is_currently_on_wb: false, minutes_active: 60 },
    { id: 'v3c', test_id: 'ab3', variant_label: '3', photo_url: 'https://example.test/k3.jpg', impressions: 900, clicks: 28, orders: 1, is_currently_on_wb: false, minutes_active: 60 },
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
        userId: ADMIN_ID, email: 'makstoychubek@gmail.com', latencyMs: latencyMs || 150, tables, rpcs: { is_super_admin: true }, functions: { 'wb-proxy': async () => ({}) },
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

test('сразу после создания теста каркас фото на месте: превью и кольцо, пока фото грузятся', async ({ page }) => {
    const r = await page.evaluate(() => {
        const t = { id: 'tmp-1', cabinet_id: currentCabinetId, nm_id: '1', product_name: 'Новый', status: 'active', rotation_interval_min: 15, started_at: new Date().toISOString(), settings: {}, variants: [] };
        abPending['tmp-1'] = { previews: ['https://example.test/p1.jpg', '', 'https://example.test/p3.jpg'] };
        allABTests.unshift(t); renderABTests();
        const c = document.getElementById('abtest-card-tmp-1');
        const out = { tiles: c ? c.querySelectorAll('.abtest-variant.is-pending').length : -1, rings: c ? c.querySelectorAll('.abtest-pend-ring').length : -1, imgs: c ? c.querySelectorAll('.abtest-variant img').length : -1 };
        delete abPending['tmp-1']; allABTests = allABTests.filter((x) => x !== t); renderABTests();
        out.gone = !document.getElementById('abtest-card-tmp-1');
        return out;
    });
    assert.deepStrictEqual(r, { tiles: 3, rings: 3, imgs: 2, gone: true }, JSON.stringify(r));
});

test('карточка: лента на 4 фото листается, кольцо с минутами, без подписей «проигрывает» и «лидирует»', async ({ page }) => {
    const r = await page.evaluate(() => {
        const c = document.getElementById('abtest-card-ab1');
        const strip = c.querySelector('.abtest-strip'), rail = c.querySelector('.abtest-variants');
        return { w: Math.round(strip.getBoundingClientRect().width), wrap: getComputedStyle(rail).flexWrap, ox: getComputedStyle(rail).overflowX,
            lose: document.querySelectorAll('.abtest-lose-lbl, .abtest-conf').length, ring: !!c.querySelector('.ab-ring'), bar: !!c.querySelector('[id^="progress-"]') };
    });
    assert.strictEqual(r.w, 382, 'лента ровно на 4 плитки');
    assert.strictEqual(r.wrap, 'nowrap'); assert.strictEqual(r.ox, 'auto');
    assert.strictEqual(r.lose, 0, 'подписей нет'); assert.ok(r.ring, 'кольцо есть'); assert.ok(!r.bar, 'полосы со временем нет');
});

test('отчёт: без вердикта «явный победитель», все варианты на одном экране без прокрутки (ПК и телефон)', async ({ page }) => {
    for (const [w, h] of [[1280, 860], [390, 844]]) {
        await page.setViewportSize({ width: w, height: h });
        await page.evaluate(() => { document.querySelectorAll('.rnp-settings-overlay.is-open').forEach((e) => e.classList.remove('is-open')); openABReportModal('ab1'); });
        await page.waitForTimeout(700);
        const r = await page.evaluate(() => {
            const grid = document.getElementById('ab-report-variants'); const cards = [...grid.querySelectorAll('.ab-report-card')];
            const sc = [...document.querySelectorAll('#ab-report-modal .nr-win-scroll, #ab-report-modal .nr-win')].find((e) => e.scrollHeight > e.clientHeight + 2 && getComputedStyle(e).overflowY !== 'visible');
            return { n: cards.length, verdict: document.getElementById('ab-report-verdict').textContent.trim(), prob: document.querySelectorAll('.ab-report-prob').length, scroll: sc ? sc.scrollHeight - sc.clientHeight : 0, last: cards.length ? Math.round(cards[cards.length - 1].getBoundingClientRect().bottom) : 0, vh: innerHeight };
        });
        assert.ok(r.n >= 2, 'варианты есть');
        assert.strictEqual(r.verdict, '', 'вердикта нет'); assert.strictEqual(r.prob, 0, 'подписей «проигрывает» нет');
        assert.strictEqual(r.scroll, 0, w + ': прокрутки внутри окна нет'); assert.ok(r.last <= r.vh, w + ': последний вариант виден целиком');
    }
});

test('фото тестов: лёгкая копия сохраняется и подставляется вместо оригинала', async ({ page }) => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    await page.route('https://img.test/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: png, headers: { 'access-control-allow-origin': '*' } }));
    const r = await page.evaluate(async () => {
        const url = 'https://img.test/a.png';
        const before = NrAbImg.u(url);
        NrAbImg.warm([url]);
        for (let i = 0; i < 40 && NrAbImg.u(url) === url; i++) await new Promise((x) => setTimeout(x, 100));
        return { before, after: NrAbImg.u(url) };
    });
    assert.strictEqual(r.before, 'https://img.test/a.png');
    assert.ok(/^blob:/.test(r.after), 'после прогрева ссылка на лёгкую копию: ' + r.after);
});

test('телефон: окна «Новый А/Б тест» и отчёт начинаются ниже строки состояния и целиком на экране', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const open of ["showNewTestForm()", "document.getElementById('ab-report-modal').classList.add('is-open')"]) {
        await page.evaluate(open);
        await page.waitForTimeout(300);
        const r = await page.evaluate(() => {
            const d = [...document.querySelectorAll('.rnp-settings-overlay.is-open > .nr-win')][0];
            if (!d) return null; const b = d.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: innerHeight };
        });
        assert.ok(r, 'окно открылось');
        assert.ok(r.top >= 24, 'верх окна ниже зоны размытия: ' + r.top);
        assert.ok(r.bottom <= r.h - 12 + 1, 'низ окна на экране: ' + r.bottom + ' из ' + r.h);
        await page.evaluate(() => document.querySelectorAll('.rnp-settings-overlay.is-open').forEach((e) => e.classList.remove('is-open')));
    }
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

test('завершённый тест перезапускается: окно сразу, те же фото и РК, новый активный тест', async ({ page }) => {
    await page.evaluate(() => filterTests('all'));
    await page.waitForSelector('#abtest-card-ab3 button:has-text("Перезапустить")', { timeout: 3000 });
    assert.strictEqual(await page.locator('#abtest-card-ab1 button:has-text("Перезапустить")').count(), 0, 'у активного теста кнопки перезапуска нет');
    const sent = { tests: [], variants: [], settings: null };
    await page.route(/rest\/v1\/ab_tests/, async (r) => {
        const rq = r.request();
        if (rq.method() === 'POST') { const b = JSON.parse(rq.postData()); sent.tests.push(b); return r.fulfill({ status: 201, json: { id: 'new1', created_at: new Date().toISOString(), ...b } }); }
        if (rq.method() === 'PATCH') { const b = JSON.parse(rq.postData()); if (b.settings) sent.settings = b.settings; return r.fulfill({ status: 204, body: '' }); }
        return r.fallback();
    });
    await page.route(/rest\/v1\/ab_test_variants/, async (r) => {
        const rq = r.request();
        if (rq.method() === 'POST') { const b = JSON.parse(rq.postData()); (Array.isArray(b) ? b : [b]).forEach((v) => sent.variants.push(v)); return r.fulfill({ status: 201, json: b }); }
        return r.fallback();
    });
    const t0 = Date.now();
    await page.click('#abtest-card-ab3 button:has-text("Перезапустить")');
    await page.waitForSelector('.nru-win input[data-id="39497232"]:checked', { timeout: 300 });
    assert.ok(Date.now() - t0 < 300, 'окно с прежней РК открылось сразу');
    await page.click('.nru-win .nru-b.p');
    await page.waitForFunction(() => allABTests.some((t) => t.nm_id == 296556347 && t.status === 'active'), null, { timeout: 2000 });
    await page.waitForTimeout(1500);
    assert.strictEqual(sent.tests.length, 1, 'создан один новый тест');
    assert.strictEqual(sent.tests[0].status, 'active');
    assert.strictEqual(String(sent.tests[0].nm_id), '296556347');
    assert.deepStrictEqual(sent.variants.map((v) => v.photo_url), ['https://example.test/k1.jpg', 'https://example.test/k2.jpg', 'https://example.test/k3.jpg'], 'фото те же и в том же порядке');
    assert.deepStrictEqual(sent.settings.campaigns, [39497232], 'РК та же');
});

test('перезапуск без выбранной РК не стартует', async ({ page }) => {
    await page.evaluate(() => filterTests('all'));
    await page.click('#abtest-card-ab3 button:has-text("Перезапустить")');
    await page.waitForSelector('.nru-win input[data-id="39497232"]');
    await page.uncheck('.nru-win input[data-id="39497232"]');
    await page.click('.nru-win .nru-b.p');
    await page.waitForTimeout(500);
    assert.ok(!(await page.evaluate(() => allABTests.some((t) => t.nm_id == 296556347 && t.status === 'active'))), 'без РК тест не создан');
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

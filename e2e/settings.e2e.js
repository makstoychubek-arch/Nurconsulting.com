/**
 * Настройки → Безопасность на заглушке: быстрые кнопки «Доступ к NR Space» и «Активные сеансы».
 * Проверяем главное правило проекта: нажал — экран ответил сразу, сервер догоняет в фоне, страница не прыгает.
 * Запуск: npm run test:e2e. Путь к Chromium можно задать через PW_CHROMIUM.
 */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');

const mk = (i, status, extra = {}) => ({
    id: 's' + i, user_id: '00000000-0000-0000-0000-' + String(i).padStart(12, '0'), email: `user${i}@example.test`, status,
    tariff_plan: 'start', plan_until: null, created_at: '2026-10-0' + (i % 9 + 1) + 'T10:00:00Z', last_sign_in_at: '2026-10-1' + (i % 9) + 'T10:00:00Z',
    is_super_admin: false, first_name: 'U' + i, last_name: 'T', full_name: 'U' + i + ' T', avatar_url: null, sign_in_attempts: 2, ...extra,
});
const spacesFixture = () => [
    { ...mk(0, 'active'), user_id: ADMIN_ID, email: 'makstoychubek@gmail.com', is_super_admin: true },
    mk(1, 'pending'), mk(2, 'pending'),
    ...[3, 4, 5].map((i) => mk(i, 'active')),
    ...[6, 7, 8].map((i) => mk(i, 'blocked')),
];
const uid = (i) => '00000000-0000-0000-0000-' + String(i).padStart(12, '0');
const SERVER_DELAY = 700;

async function open(browser, base, opts = {}) {
    const spaces = spacesFixture();
    const viewers = [];
    const sessions = [
        { id: 'sess-cur', user_id: ADMIN_ID, current_session_token: 'tok-current', device_name: 'Компьютер', browser: 'Chrome', os_name: 'Linux', device_type: 'desktop', last_active: new Date().toISOString() },
        { id: 'sess-old', user_id: ADMIN_ID, current_session_token: 'tok-old', device_name: 'Компьютер', browser: 'Chrome', os_name: 'macOS', device_type: 'desktop', last_active: new Date(Date.now() - 86400e3).toISOString() },
    ];
    const adminCalls = [];
    const env = await openApp(browser, base, {
        userId: ADMIN_ID, email: 'makstoychubek@gmail.com', latencyMs: 150,
        tables: { spaces, cabinets: [{ id: CAB, name: 'Тестовый кабинет', wb_token_set: true, user_id: ADMIN_ID }], team_staff: [{ email: 'makstoychubek@gmail.com' }], cabinet_viewers: viewers, user_sessions: sessions },
        rpcs: { is_super_admin: true },
        functions: {
            'admin-space': async (body) => {
                adminCalls.push(body);
                await new Promise((r) => setTimeout(r, SERVER_DELAY));
                if (opts.failAction && body.action === opts.failAction) return { __status: 500, body: { error: 'Сервер отказал' } };
                const row = spaces.find((s) => s.user_id === body.user_id);
                if (body.action === 'activate' && row) { row.status = 'active'; if (body.trial_days) { row.tariff_plan = 'premium'; row.plan_until = new Date(Date.now() + 864e5).toISOString(); } if (body.as_staff) row.tariff_plan = 'premium'; }
                if (body.action === 'block' && row) row.status = 'blocked';
                if (body.action === 'set_viewer') { viewers.length = 0; (body.cabinet_ids || []).forEach((id) => viewers.push({ user_id: body.user_id, cabinet_id: id, sections: body.sections })); }
                return { ok: true };
            },
        },
    });
    const { page } = env;
    await page.evaluate(() => localStorage.setItem('nr_session_key', 'tok-current'));
    await page.evaluate(() => showTab('settings'));
    await page.locator('#admin-spaces-table-wrap tbody tr').first().waitFor({ state: 'attached' });
    await page.waitForTimeout(800);
    return { ...env, spaces, viewers, adminCalls };
}

// Меряет в самой странице: сколько мс прошло от клика до изменения таблицы и показывался ли «Загрузка…».
async function armProbe(page) {
    await page.evaluate(() => {
        const w = document.getElementById('admin-spaces-table-wrap');
        window.__probe = { wipes: 0, click: 0, change: 0 };
        new MutationObserver(() => {
            if (/Загрузка/.test(w.textContent)) window.__probe.wipes++;
            if (window.__probe.click && !window.__probe.change) window.__probe.change = performance.now();
        }).observe(w, { childList: true, subtree: true });
    });
}
const clickInPage = (page, selector) => page.evaluate((sel) => { window.__probe.click = performance.now(); document.querySelector(sel).click(); }, selector);
const probe = (page) => page.evaluate(() => ({ ms: Math.round(window.__probe.change - window.__probe.click), wipes: window.__probe.wipes }));
const counts = (page) => page.evaluate(() => ['requests', 'allowed', 'blocked'].map((k) => document.getElementById('admin-spaces-count-' + k).textContent.trim()));

const tests = [];
const test = (name, fn, opts) => tests.push({ name, fn, opts });

test('«Разрешить»: строка уходит из запросов сразу, без «Загрузка…», сервер вызван один раз', async ({ page, adminCalls }) => {
    await armProbe(page);
    const before = await counts(page);
    await clickInPage(page, '#admin-spaces-table-wrap button[onclick^="adminGrantSpaceAccess"]');
    await page.waitForTimeout(100);
    const p = await probe(page);
    assert.ok(p.ms < 150, 'таблица обновилась за ' + p.ms + ' мс');
    assert.strictEqual(p.wipes, 0, 'таблица не заменялась на «Загрузка…»');
    const after = await counts(page);
    assert.strictEqual(Number(after[0]), Number(before[0]) - 1, 'в запросах стало на одну меньше');
    assert.strictEqual(Number(after[1]), Number(before[1]) + 1, 'в разрешённых на одну больше');
    await page.waitForTimeout(SERVER_DELAY + 2500);
    assert.strictEqual(adminCalls.filter((c) => c.action === 'activate').length, 1, 'сервер получил одно действие');
    assert.deepStrictEqual(await counts(page), after, 'после фонового обновления цифры те же');
});

test('«Как сотрудник» и «Тест: Фулл на 1 день» тоже отвечают сразу и шлют нужные параметры', async ({ page, adminCalls }) => {
    await armProbe(page);
    await clickInPage(page, '#admin-spaces-table-wrap button.ax-staff');
    await page.waitForTimeout(60);
    assert.ok((await probe(page)).ms < 150, 'ответ за ' + (await probe(page)).ms + ' мс');
    await page.waitForTimeout(SERVER_DELAY + 300);
    assert.ok(adminCalls.some((c) => c.action === 'activate' && c.as_staff === true), 'activate as_staff');
    await page.evaluate(() => { window.__probe.click = performance.now(); window.__probe.change = 0; document.querySelector('#admin-spaces-table-wrap button.ax-test').click(); });
    await page.waitForTimeout(SERVER_DELAY + 300);
    assert.ok(adminCalls.some((c) => c.action === 'activate' && c.trial_days === 1), 'activate trial_days=1');
});

test('если сервер отказал, строка возвращается и показывается ошибка', async ({ page, spaces }) => {
    await page.evaluate(() => { window.nrAsk = () => Promise.resolve(true); });
    const before = await counts(page);
    await page.evaluate(() => { document.querySelector('#admin-spaces-table-wrap button[onclick^="adminBlockSpace"]').click(); });
    await page.waitForTimeout(200);
    assert.strictEqual(Number((await counts(page))[0]), Number(before[0]) - 1, 'сразу ушла из запросов');
    await page.waitForTimeout(SERVER_DELAY + 600);
    assert.deepStrictEqual(await counts(page), before, 'после отказа вернулась на место');
    assert.ok(await page.locator('.nru-toast').filter({ hasText: /Не получилось|отказ/i }).count() > 0, 'есть сообщение об ошибке');
    assert.strictEqual(spaces.filter((s) => s.status === 'pending').length, 2, 'на сервере ничего не изменилось');
}, { failAction: 'block' });

test('доступ на просмотр: окно открывается сразу, по умолчанию только РНП, последний раздел не снимается', async ({ page, adminCalls }) => {
    await page.evaluate(() => switchSpacesAdminTab('allowed'));
    await page.locator('#admin-spaces-table-wrap button.ax-manage').first().waitFor({ state: 'attached' });
    const t0 = Date.now();
    await page.evaluate(() => document.querySelector('#admin-spaces-table-wrap button.ax-manage').click());
    await page.locator('#nr-access-modal [data-view]').waitFor({ state: 'visible' });
    assert.ok(Date.now() - t0 < 400, 'окно «Управлять» открылось за ' + (Date.now() - t0) + ' мс');
    await page.locator('#nr-access-modal [data-view]').click();
    await page.locator('#nr-viewer-modal .nrv-pill').first().waitFor({ state: 'visible' });
    const on = () => page.evaluate(() => [...document.querySelectorAll('#nr-viewer-modal .nrv-pill.on')].map((b) => b.dataset.sec));
    assert.deepStrictEqual(await on(), ['rnp'], 'по умолчанию выбран только РНП');
    await page.locator('#nr-viewer-modal .nrv-pill[data-sec="rnp"]').click();
    assert.deepStrictEqual(await on(), ['rnp'], 'единственный раздел снять нельзя (иначе он стал бы «все разделы»)');
    await page.locator('#nr-viewer-modal .nrv-cab input').first().check();
    await page.locator('#nr-viewer-modal .nrv-save').click();
    await page.waitForFunction(() => !document.getElementById('nr-viewer-modal'), null, { timeout: 500 });
    await page.waitForTimeout(SERVER_DELAY + 300);
    const call = adminCalls.find((c) => c.action === 'set_viewer');
    assert.deepStrictEqual(call.sections, ['rnp'], 'на сервер ушёл только РНП');
});

test('«Активные сеансы»: список виден сразу, «Завершить сеанс» убирает строку мгновенно', async ({ page, calls }) => {
    await page.waitForSelector('.security-session-row');
    assert.strictEqual(await page.locator('.security-session-row').count(), 2);
    const t0 = Date.now();
    await page.evaluate(() => document.querySelector('.security-session-row .security-end-btn').click());
    assert.strictEqual(await page.locator('.security-session-row').count(), 1, 'строка исчезла сразу');
    assert.ok(Date.now() - t0 < 300);
    await page.waitForTimeout(600);
    assert.ok(calls.some((c) => c.kind === 'write' && c.table === 'user_sessions' && c.method === 'DELETE'), 'удаление ушло в базу');
});

(async () => {
    const srv = await serve();
    const base = 'http://127.0.0.1:' + srv.address().port;
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    let failed = 0;
    for (const t of tests) {
        let env;
        try {
            env = await open(browser, base, t.opts || {});
            await t.fn(env);
            console.log('ok   ' + t.name);
        } catch (e) {
            failed++;
            console.log('FAIL ' + t.name + '\n     ' + String(e.message || e).split('\n')[0]);
        }
        if (env) await env.ctx.close();
    }
    await browser.close();
    srv.close();
    if (failed) { console.log(failed + ' из ' + tests.length + ' не прошли'); process.exit(1); }
    console.log('e2e настроек: все ' + tests.length + ' проверок прошли');
})();

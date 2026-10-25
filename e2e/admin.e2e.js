/**
 * Страница супер-админа: открывается сразу плашкой «Space», показывает «Требует внимания»,
 * кабинеты, сотрудников и ботов; «Переподключить» вызывает telegram-admin.
 * Запуск: npm run test:e2e. Путь к Chromium можно задать через PW_CHROMIUM.
 */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');

const OVERVIEW = {
    db_bytes: 412 * 1024 * 1024,
    cabinets: [
        { id: CAB, name: 'Zevina 1', user_id: ADMIN_ID, owner_email: 'makstoychubek@gmail.com', nr_managed: true, has_wb: true, adv_ok: true, articles: 212, daily_rows: 9000, daily_bytes: 184 * 1024 * 1024, last_sync: new Date().toISOString(), sync_error: null, features: [] },
        { id: 'cab-2', name: 'ИП Марс', user_id: ADMIN_ID, owner_email: 'makstoychubek@gmail.com', nr_managed: true, has_wb: true, adv_ok: false, articles: 340, daily_rows: 12000, daily_bytes: 132 * 1024 * 1024, last_sync: new Date().toISOString(), sync_error: null, features: [] },
        { id: 'cab-3', name: 'Айлин Стиль', user_id: ADMIN_ID, owner_email: 'makstoychubek@gmail.com', nr_managed: true, has_wb: true, adv_ok: true, articles: 92, daily_rows: 3000, daily_bytes: 74 * 1024 * 1024, last_sync: null, sync_error: 'WB 429: слишком много запросов', features: [] },
        { id: 'cab-4', name: 'Style KG', user_id: 'u-timur', owner_email: 'timur@example.test', nr_managed: false, has_wb: true, adv_ok: false, articles: 34, daily_rows: 800, daily_bytes: 12 * 1024 * 1024, last_sync: new Date().toISOString(), sync_error: null, features: [] },
    ],
    viewers: [{ cabinet_id: CAB, user_id: 'u-aizada', email: 'aizada@example.test', sections: ['all'], created_at: new Date().toISOString() }],
    staff: [{ email: 'makstoychubek@gmail.com', note: 'владелец', created_at: '2026-01-01T00:00:00Z', last_sign_in: new Date().toISOString() }],
};
const BOTS = [
    { id: 'notify', title: 'NR уведомления', status: 'online', live_username: 'nr_notify_bot' },
    { id: 'amina', title: 'Амина', status: 'offline', live_username: 'aminaakd_bot' },
];

const FEATS = ['reviews', 'order_alerts', 'ads', 'ab_rotation', 'sync', 'rnp_morning'].map((feature) => ({ feature, enabled: true, active: true, paused_until: null, blockers: [] }));

async function open(browser, base) {
    const env = await openApp(browser, base, {
        userId: ADMIN_ID, email: 'makstoychubek@gmail.com', latencyMs: 200,
        tables: { spaces: [{ id: 's0', user_id: ADMIN_ID, email: 'makstoychubek@gmail.com', status: 'active', tariff_plan: 'vip', is_super_admin: true, first_name: 'M', last_name: 'T', full_name: 'M T', created_at: '2026-09-17T00:00:00Z', last_sign_in_at: new Date().toISOString() }, { id: 's1', user_id: 'u-aizada', email: 'aizada@example.test', status: 'pending', tariff_plan: 'start', is_super_admin: false, full_name: 'Айзада', created_at: '2026-10-23T00:00:00Z', last_sign_in_at: null }, { id: 's2', user_id: 'u-timur', email: 'timur@example.test', status: 'active', tariff_plan: 'start', is_super_admin: false, full_name: 'Темир', created_at: '2026-10-22T00:00:00Z', last_sign_in_at: new Date().toISOString() }], cabinets: [{ id: CAB, name: 'Zevina 1', wb_token_set: true, user_id: ADMIN_ID }], admin_map_nodes: [{ title: 'Штрафы за день', subtitle: 'каждый час', status: 'bad', meta: { lastStatus: 'error' } }],
            admin_alert_settings: [{ key: 'ai_balance', enabled: true, threshold: 5, value: 12, value_at: new Date().toISOString() }, { key: 'tokens', enabled: true }, { key: 'bots', enabled: false }],
            admin_audit: [{ at: new Date().toISOString(), actor_email: 'makstoychubek@gmail.com', action: 'access_granted', target: 'Zevina 1', detail: 'aizada@example.test' }],
            site_uptime: [{ id: 1, status: 'up', last_checked: new Date().toISOString() }], client_errors: [{ count: 3, last_seen: new Date().toISOString() }] },
        rpcs: { is_super_admin: true, admin_overview: OVERVIEW, admin_assign_owner: { status: 'invited' }, admin_unassign_owner: null, admin_set_super_admin: { status: 'granted' }, admin_move_to_consulting: { status: 'moved' } },
        functions: { 'telegram-admin': async (b) => (b.action === 'list' ? { bots: BOTS } : { ok: true }), 'cabinet-features': async (b) => ({ ok: true, features: FEATS.map((f) => (b.feature === f.feature && b.action === 'set' ? { ...f, enabled: false, active: false } : f)) }) },
    });
    await env.page.waitForFunction(() => window.NrAdmin && document.querySelector('.rail-logo-name.nra-entry'), null, { timeout: 20000 });
    return env;
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('плашка «Space» открывает страницу сразу, «Требует внимания» собирается из данных', async ({ page }) => {
    const t0 = Date.now();
    await page.locator('.rail-logo-name').click();
    await page.locator('#nr-admin.open .nra-h').waitFor({ state: 'visible' });
    assert.ok(Date.now() - t0 < 1000, 'страница открылась за ' + (Date.now() - t0) + ' мс');
    await page.waitForFunction(() => /Амина/.test(document.querySelector('.nra-main').innerText) && /Штрафы за день/.test(document.querySelector('.nra-main').innerText), null, { timeout: 5000 });
    const text = await page.locator('.nra-card').first().innerText();
    assert.ok(/ИП Марс: токен рекламы не принят/.test(text), 'токен рекламы: ' + text);
    assert.ok(/Айлин Стиль: синхронизация с ошибкой/.test(text), 'ошибка синхронизации');
    assert.ok(/Бот «Амина»: не на связи/.test(text), 'бот не на связи');
    assert.ok(/Задача «Штрафы за день» упала/.test(text), 'упавшая задача');
});

test('кабинеты: раскрытие по нажатию показывает данные и доступ', async ({ page }) => {
    await page.locator('.nra-side button[data-sec="acc"]').click();
    await page.locator('.nra-t tr.r').first().waitFor({ state: 'visible' });
    const rows = await page.locator('.nra-t tr.r').count();
    assert.strictEqual(rows, 3, 'три кабинета команды (клиентский не входит): ' + rows);
    await page.locator('.nra-t tr.r').first().click();
    const det = await page.locator('.nra-det').first().innerText();
    assert.ok(/aizada@example\.test/.test(det) && /212/.test(det), 'доступ и артикулы: ' + det.slice(0, 120));
});

test('поиск по кабинету фильтрует список; сотрудники и боты показываются', async ({ page }) => {
    await page.locator('#nra-q').fill('марс');
    await page.waitForFunction(() => document.querySelectorAll('.nra-t tr.r').length === 1);
    await page.locator('#nra-q').fill('');
    await page.locator('.nra-side button[data-sec="staff"]').click();
    assert.ok(/makstoychubek@gmail\.com/.test(await page.locator('.nra-main').innerText()), 'сотрудник виден');
    await page.locator('.nra-side button[data-sec="tg"]').click();
    await page.locator('.nra-row').first().waitFor({ state: 'visible' });
    assert.ok(/Амина/.test(await page.locator('.nra-main').innerText()), 'бот виден');
});

test('«Переподключить» бота: кнопка отвечает сразу, команда уходит в telegram-admin', async ({ page, calls }) => {
    const btn = page.locator('.nra-row', { hasText: 'Амина' }).locator('button[data-hook]');
    const t0 = Date.now();
    await btn.click();
    await page.waitForFunction(() => /Подключаю/.test(document.querySelector('.nra-main').innerText), null, { timeout: 300 });
    assert.ok(Date.now() - t0 < 300, 'кнопка ответила за ' + (Date.now() - t0) + ' мс');
    await page.waitForTimeout(900);
    assert.ok(calls.some((c) => c.kind === 'fn' && c.name === 'telegram-admin' && c.body.action === 'set_webhook' && c.body.bot_id === 'amina'), 'set_webhook ушёл');
});

test('оповещения: переключатель и порог сохраняются, остаток ИИ вводится вручную', async ({ page, calls }) => {
    await page.locator('.nra-side button[data-sec="alr"]').click();
    await page.locator('.nra-sw').first().waitFor({ state: 'visible' });
    assert.ok(/Баланс ИИ ниже порога/.test(await page.locator('.nra-main').innerText()), 'настройки показаны');
    const before = calls.filter((c) => c.kind === 'write' && c.table === 'admin_alert_settings').length;
    const t0 = Date.now();
    await page.locator('button[data-alr="bots"]').click();
    await page.waitForFunction(() => document.querySelector('button[data-alr="bots"]').classList.contains('on'), null, { timeout: 300 });
    assert.ok(Date.now() - t0 < 300, 'переключатель ответил за ' + (Date.now() - t0) + ' мс');
    await page.locator('input[data-val="ai_balance"]').fill('30');
    await page.locator('input[data-val="ai_balance"]').blur();
    await page.waitForTimeout(700);
    const after = calls.filter((c) => c.kind === 'write' && c.table === 'admin_alert_settings').length;
    assert.ok(after >= before + 2, 'настройки ушли в базу: ' + (after - before));
});

test('журнал показывает записи, а раздел «Система» показывает сайт и ошибки браузеров', async ({ page }) => {
    await page.locator('.nra-side button[data-sec="log"]').click();
    await page.locator('.nra-row').first().waitFor({ state: 'visible' });
    const log = await page.locator('.nra-main').innerText();
    assert.ok(/Выдан доступ: Zevina 1/.test(log) && /aizada@example\.test/.test(log), 'запись журнала: ' + log.slice(0, 120));
    await page.locator('.nra-side button[data-sec="sys"]').click();
    await page.locator('.nra-kv').first().waitFor({ state: 'visible' });
    assert.ok(/работает/.test(await page.locator('.nra-main').innerText()), 'сайт работает');
});

test('боты кабинета: тумблер выключает ответы на отзывы сразу, пауза на час уходит в функцию', async ({ page, calls }) => {
    await page.locator('.nra-side button[data-sec="acc"]').click();
    if (!(await page.locator('.nra-det').count())) await page.locator('.nra-t tr.r').first().click();
    await page.locator('.nra-bot').first().waitFor({ state: 'visible', timeout: 5000 });
    assert.strictEqual(await page.locator('.nra-bot').count(), 4, 'четыре бота у кабинета');
    assert.ok(/Акылай/.test(await page.locator('.nra-bot').first().innerText()), 'первым Акылай (отзывы и вопросы)');
    const t0 = Date.now();
    await page.locator('.nra-bot').first().locator('button[data-ft]').click();
    await page.waitForFunction(() => /выключен/.test(document.querySelector('.nra-bot').innerText), null, { timeout: 300 });
    assert.ok(Date.now() - t0 < 300, 'тумблер ответил за ' + (Date.now() - t0) + ' мс');
    await page.waitForTimeout(800);
    assert.ok(calls.some((c) => c.kind === 'fn' && c.name === 'cabinet-features' && c.body.action === 'set' && c.body.feature === 'reviews' && c.body.enabled === false), 'выключение ушло в cabinet-features');
    await page.locator('.nra-bot').nth(2).locator('select.nra-sel').selectOption('60');
    await page.waitForTimeout(800);
    assert.ok(calls.some((c) => c.kind === 'fn' && c.name === 'cabinet-features' && c.body.action === 'pause' && c.body.feature === 'ads' && c.body.minutes === 60), 'пауза на час ушла');
});

test('владелец кабинета: по почте, приглашение видно сразу, плохая почта не принимается', async ({ page }) => {
    await page.locator('.nra-side button[data-sec="acc"]').click();
    if (!(await page.locator('.nra-det').count())) await page.locator('.nra-t tr.r').first().click();
    const input = page.locator('input[id^="nra-own-"]').first();
    await input.waitFor({ state: 'visible' });
    await input.fill('нет-собаки');
    await page.locator('button[data-own]').first().click();
    assert.ok(/Введи почту целиком/.test(await page.locator('.nra-toast').innerText()), 'плохая почта не принята');
    await page.locator('input[id^="nra-own-"]').first().fill('Owner@Example.test');
    const t0 = Date.now();
    await page.locator('button[data-own]').first().click();
    await page.waitForFunction(() => /owner@example\.test/.test(document.querySelector('.nra-det').innerText) && /ждёт первого входа/.test(document.querySelector('.nra-det').innerText), null, { timeout: 300 });
    assert.ok(Date.now() - t0 < 300, 'приглашение появилось за ' + (Date.now() - t0) + ' мс');
});

test('суперадмин назначает другого суперадмина: видно сразу, плохая почта не принимается, владельца снять нельзя', async ({ page }) => {
    await page.locator('.nra-side button[data-sec="staff"]').click();
    await page.locator('#nra-super').waitFor({ state: 'visible' });
    assert.ok(/global\.pro\.1004@gmail\.com/.test(await page.locator('.nra-main').innerText()), 'владелец в списке');
    assert.strictEqual(await page.locator('[data-unsuper="global.pro.1004@gmail.com"]').count(), 0, 'у владельца нет кнопки «снять»');
    await page.locator('#nra-super').fill('нет-собаки');
    await page.locator('button[data-super]').click();
    assert.ok(/Введи почту целиком/.test(await page.locator('.nra-toast').innerText()), 'плохая почта не принята');
    await page.locator('#nra-super').fill('Second@Example.test');
    const t0 = Date.now();
    await page.locator('button[data-super]').click();
    assert.ok(/second@example\.test/.test(await page.locator('.nra-main').innerText()), 'суперадмин не появился сразу');
    assert.ok(Date.now() - t0 < 300, 'суперадмин появился за ' + (Date.now() - t0) + ' мс');
});

test('«В консалтинг»: кабинет клиента переходит к команде сразу, после подтверждения', async ({ page }) => {
    await page.locator('.nra-side button[data-sec="acc"]').click();
    assert.ok(!/Style KG/.test(await page.locator('.nra-main').innerText()), 'клиентского кабинета нет в консалтинге');
    await page.locator('.nra-side button[data-sec="users"]').click();
    await page.locator('.nra-t tr.r', { hasText: 'Темир' }).click();
    await page.locator('button[data-tocons]').click();
    assert.ok(/Подтвердить/.test(await page.locator('button[data-tocons]').innerText()), 'нужно подтверждение');
    const t0 = Date.now();
    await page.locator('button[data-tocons]').click();
    await page.waitForFunction(() => /в консалтинге/.test(document.querySelector('.nra-main').innerText), null, { timeout: 300 });
    assert.ok(Date.now() - t0 < 300, 'кабинет перешёл за ' + (Date.now() - t0) + ' мс');
    await page.locator('.nra-side button[data-sec="acc"]').click();
    assert.ok(/Style KG/.test(await page.locator('.nra-main').innerText()), 'кабинет теперь в консалтинге');
});

test('пользователи сайта: отдельный раздел, по нажатию видны кабинеты, размер и синхронизация', async ({ page }) => {
    await page.locator('.nra-side button[data-sec="users"]').click();
    await page.locator('.nra-t tr.r').first().waitFor({ state: 'visible' });
    assert.strictEqual(await page.locator('.nra-t tr.r').count(), 3, 'три пользователя');
    const row = page.locator('.nra-t tr.r', { hasText: 'Айзада' });
    assert.ok(/ждёт одобрения/.test(await row.innerText()), 'статус ожидания');
    assert.ok(/Zevina 1/.test(await row.innerText()), 'кабинет в строке');
    await row.click();
    const det = await page.locator('.nra-ucab').first().innerText();
    assert.ok(/Zevina 1/.test(det) && /просмотр/.test(det) && /184/.test(det) && /212/.test(det), 'детали кабинета: ' + det.slice(0, 160));
    await page.locator('.nra-side button[data-sec="home"]').click();
    assert.ok(/Ждут одобрения: 1/.test(await page.locator('.nra-main').innerText()), 'в «Требует внимания» есть ожидающие');
});

(async () => {
    const srv = await serve();
    const base = 'http://127.0.0.1:' + srv.address().port;
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    let failed = 0;
    const env = await open(browser, base);
    for (const t of tests) {
        try { await t.fn(env); console.log('ok   ' + t.name); }
        catch (e) { failed++; console.log('FAIL ' + t.name + '\n     ' + String(e.message || e).split('\n').slice(0, 6).join('\n     ')); }
    }
    await browser.close(); srv.close();
    if (failed) { console.log(failed + ' из ' + tests.length + ' не прошли'); process.exit(1); }
    console.log('e2e админки: все ' + tests.length + ' проверки прошли');
})();

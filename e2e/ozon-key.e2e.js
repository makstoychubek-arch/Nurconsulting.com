/**
 * Настройки → API: ключи Ozon. Ключ уходит в серверную функцию cabinet-token (action ozon_set),
 * кнопка отвечает сразу, отказ Ozon показан причиной, из браузера в таблицу кабинетов ничего не пишется.
 */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');

async function open(browser, base, ozon) {
    const sent = [];
    const env = await openApp(browser, base, {
        userId: ADMIN_ID, email: 'makstoychubek@gmail.com', latencyMs: 60,
        tables: { cabinets: [{ id: CAB, name: 'Zevina 1', wb_token_set: true, ozon_client_id: null, ozon_api_key_set: false, user_id: ADMIN_ID }], team_staff: [{ email: 'makstoychubek@gmail.com' }] },
        rpcs: { is_super_admin: true },
        functions: {
            'cabinet-token': async (body) => {
                sent.push(body);
                await new Promise((r) => setTimeout(r, 600));
                return ozon(body);
            },
        },
    });
    await env.page.evaluate(() => showTab('settings'));
    await env.page.evaluate(() => showSettingsSection('api'));
    await env.page.locator('#ozon-token-list .ui-list-row').first().waitFor({ state: 'attached' });
    return { ...env, sent };
}

const tests = [];
const test = (name, fn, ozon) => tests.push({ name, fn, ozon });
const fill = async (page) => {
    await page.evaluate((id) => document.getElementById('edit-ozon-' + id).classList.remove('hidden'), CAB);
    await page.fill('#ozon-client-' + CAB, '2549130');
    await page.fill('#ozon-key-' + CAB, '103aaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
};

test('в настройках API есть карточка «Ключи Ozon» с кабинетом, поля скрыты до нажатия', async ({ page }) => {
    const r = await page.evaluate(() => ({
        card: /Ключи Ozon/.test(document.getElementById('settings-api').textContent),
        row: document.querySelectorAll('#ozon-token-list .ui-list-row').length,
        sub: document.querySelector('#ozon-token-list .ui-list-row-sub').textContent,
        hidden: document.querySelector('#ozon-token-list [id^="edit-ozon-"]').classList.contains('hidden'),
        one: document.querySelectorAll('#ozon-token-list').length,
    }));
    assert.ok(r.card && r.row === 1 && r.one === 1);
    assert.match(r.sub, /не задан/);
    assert.ok(r.hidden);
}, () => ({ ok: true }));

test('Сохранить: кнопка отвечает сразу, ключ идёт в функцию, прямой записи в таблицу нет', async ({ page, sent, calls }) => {
    await fill(page);
    // Меряем внутри страницы: от клика до смены надписи на кнопке (без накладных расходов теста).
    const ms = await page.evaluate((id) => new Promise((resolve) => {
        const b = document.querySelector('#edit-ozon-' + id + ' .ui-btn-primary');
        const t0 = performance.now();
        new MutationObserver((_, o) => { if (/Проверяем ключ/.test(b.textContent)) { o.disconnect(); resolve(performance.now() - t0); } }).observe(b, { childList: true, characterData: true, subtree: true });
        b.click();
    }), CAB);
    assert.ok(ms < 100, 'отклик кнопки ' + Math.round(ms) + ' мс');
    assert.ok(await page.evaluate((id) => document.querySelector('#edit-ozon-' + id + ' .ui-btn-primary').disabled, CAB), 'кнопка заблокирована от двойного нажатия');
    await page.waitForSelector('.nru-toast');
    assert.strictEqual(sent.length, 1);
    assert.deepStrictEqual(sent[0], { action: 'ozon_set', cabinet_id: CAB, client_id: '2549130', api_key: '103aaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' });
    assert.match(await page.locator('.nru-toast').first().textContent(), /Токен Ozon сохранён[\s\S]*полный доступ/);
    assert.ok(!calls.some((c) => c.kind === 'write' && c.table === 'cabinets'), 'в таблицу кабинетов из браузера не пишем');
    assert.strictEqual(await page.inputValue('#ozon-key-' + CAB).catch(() => ''), '', 'поле ключа очищено');
}, () => ({ ok: true, token_set: true, checked: true, roles: 42, admin: true }));

test('Ozon не принял ключ: показана причина, кнопка снова рабочая, ничего не «сохранено»', async ({ page }) => {
    await fill(page);
    await page.click('#edit-ozon-' + CAB + ' .ui-btn-primary');
    await page.waitForSelector('.nru-toast');
    const t = await page.locator('.nru-toast').first().textContent();
    assert.match(t, /Ключ не сохранён/);
    assert.match(t, /Ozon не принял ключ/);
    assert.ok(!/Токен Ozon сохранён/.test(t));
    const b = await page.evaluate((id) => { const x = document.querySelector('#edit-ozon-' + id + ' .ui-btn-primary'); return { dis: x.disabled, txt: x.textContent }; }, CAB);
    assert.strictEqual(b.dis, false);
    assert.strictEqual(b.txt, 'Сохранить');
}, () => ({ ok: false, reason: 'OZON_REJECTED', message: 'Ozon не принял ключ: проверьте Client-Id и Api-Key и что ключ не истёк.' }));

test('связь прервалась: честное «не получилось», а не «сохранено»', async ({ page }) => {
    await fill(page);
    await page.click('#edit-ozon-' + CAB + ' .ui-btn-primary');
    await page.waitForSelector('.nru-toast');
    const t = await page.locator('.nru-toast').first().textContent();
    assert.match(t, /Не получилось сохранить/);
    assert.ok(!/Токен Ozon сохранён/.test(t));
}, () => ({ __status: 500, body: { error: 'INTERNAL' } }));

(async () => {
    const srv = await serve();
    const base = 'http://127.0.0.1:' + srv.address().port;
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    let failed = 0;
    for (const t of tests) {
        let env;
        try {
            env = await open(browser, base, t.ozon);
            await t.fn(env);
            assert.deepStrictEqual(env.errors, [], 'ошибки в консоли: ' + env.errors.join('; '));
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
    console.log('e2e ключей Ozon: все ' + tests.length + ' проверок прошли');
})();

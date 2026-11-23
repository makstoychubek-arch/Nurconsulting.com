/**
 * Настройки → «Боты и ключи»: Telegram-боты, ключ ChatGPT, Google-аккаунт. Запуск: node e2e/keys.e2e.js.
 * Путь к Chromium можно задать через PW_CHROMIUM.
 */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, USER_ID, CAB } = require('./harness.js');

const SECRET_TOKEN = '999999:SECRET-TOKEN-VALUE-abcdef';
const SECRET_KEY = 'sk-test-SECRETKEYVALUE0123456789';
const base = (id, email) => ({
    spaces: [{ id: 's0', user_id: id, email, status: 'active', tariff_plan: 'vip', is_super_admin: true, full_name: 'M' }],
    cabinets: [{ id: CAB, name: 'T', wb_token_set: true, user_id: id }],
});
const until = async (fn, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 100)); } return false; };

(async () => {
    const srv = await serve();
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    try {
        const url = 'http://127.0.0.1:' + srv.address().port;
        const calls = { tg: [], keys: [] };
        let openai = { configured: false, source: 'none', meta: {} };
        let bots = [{ id: 'alina', title: 'Алина', live_username: 'alinaaaxx_bot', status: 'online', is_enabled: true }];
        let failOpenai = true, linked = false, failLink = true;
        const google = { configured: true, source: 'db', meta: { email: 'alina@proj.iam.gserviceaccount.com', project: 'proj' } };
        const env = await openApp(browser, url, {
            userId: ADMIN_ID, email: 'admin@example.com', latencyMs: 20, tables: base(ADMIN_ID, 'admin@example.com'), rpcs: { is_super_admin: true },
            functions: {
                'wb-proxy': async () => ({}),
                'telegram-admin': async (b) => {
                    calls.tg.push(b);
                    if (b.action === 'list') return { bots };
                    if (b.action === 'create') { bots = bots.concat([{ id: 'elium', title: b.title, live_username: 'elium_bot', status: 'online', is_enabled: true }]); return { ok: true, bot_id: 'elium', username: 'elium_bot' }; }
                    if (b.action === 'disable' || b.action === 'enable') { bots = bots.map((x) => x.id === b.bot_id ? Object.assign({}, x, { is_enabled: b.action === 'enable' }) : x); return { ok: true }; }
                    return { ok: true };
                },
                'integrations-admin': async (b) => {
                    calls.keys.push(b);
                    if (b.action === 'status') return { ok: true, openai, google, models: ['gpt-4o-mini', 'gpt-4o'], llm: { costUsd: 1.5, todayUsd: 0.2, budgetUsd: 10, errors: 1, lastError: 'insufficient_quota' }, sheets: [{ id: 'cabM', name: 'ИП МАРС', link: linked ? { tab: 'Раздачи', last_sync_at: new Date().toISOString(), last_error: null } : null }, { id: 'cabZ', name: 'Zevina 1', link: null }] };
                    if (b.action === 'link_sheet') { if (failLink) return { ok: false, error: 'Таблица недоступна. Откройте доступ для адреса alina@proj.iam.gserviceaccount.com и повторите.' }; linked = true; return { ok: true, title: 'Кэшбэки / Выкупы МАРС', rows: 8 }; }
                    if (b.action === 'unlink_sheet') { linked = false; return { ok: true }; }
                    if (b.action === 'set_openai') {
                        if (failOpenai) return { ok: false, error: 'OpenAI не принял ключ. Проверьте, что скопировали его целиком.' };
                        openai = { configured: true, source: 'db', meta: { mask: 'sk-…6789', model: b.model } }; return { ok: true, mask: 'sk-…6789' };
                    }
                    if (b.action === 'test') return { ok: true, valid: true, sheet: true, title: 'Кэшбэки / Выкупы МАРС' };
                    return { ok: true };
                },
            },
        });
        const { page } = env;
        await page.evaluate(() => showTab('settings'));
        await page.waitForSelector('#settings-tab-btn-keys', { state: 'attached' });
        assert.ok(await until(() => page.evaluate(() => !document.getElementById('settings-tab-btn-keys').classList.contains('hidden-tab'))), 'администратору вкладка «Боты и ключи» видна');
        await page.evaluate(() => showSettingsSection('keys'));
        await page.waitForSelector('#settings-keys .nk-card', { timeout: 3000 });
        assert.strictEqual(await page.evaluate(() => document.querySelectorAll('#settings-keys .nk-card').length), 3, 'три карточки: боты, ChatGPT, Google');
        assert.ok(await until(() => page.evaluate(() => /alinaaaxx_bot/.test(document.querySelector('[data-card="tg"]').textContent) && /Алина: самовыкупы и раздачи/.test(document.querySelector('[data-card="tg"]').textContent))), 'бот Алина со сценарием');
        assert.ok(await page.evaluate(() => /На связи/.test(document.querySelector('[data-card="tg"]').textContent)), 'статус бота');
        assert.ok(await until(() => page.evaluate(() => /Не подключён/.test(document.querySelector('[data-card="openai"]').textContent))), 'ChatGPT не подключён');
        assert.ok(await until(() => page.evaluate(() => /alina@proj\.iam\.gserviceaccount\.com/.test(document.querySelector('[data-card="google"]').textContent))), 'Google-аккаунт показан по адресу');
        console.log('ok   вкладка видна администратору, три карточки: боты, ChatGPT, Google');

        // ключ ChatGPT: сначала отказ, введённое остаётся; потом успех
        await page.click('[data-card="openai"] [data-act="replace"]');
        await page.fill('[data-form="openai"] input[name="key"]', SECRET_KEY);
        await page.click('[data-form="openai"] button[type="submit"]');
        assert.ok(await until(() => page.evaluate(() => /не принял ключ/.test(document.querySelector('[data-v="toast"]').textContent))), 'ошибка проверки показана понятно');
        assert.strictEqual(await page.evaluate(() => document.querySelector('[data-form="openai"] input[name="key"]').value), SECRET_KEY, 'введённый ключ не пропал после ошибки');
        failOpenai = false;
        await page.click('[data-form="openai"] button[type="submit"]');
        assert.ok(await until(() => page.evaluate(() => /sk-…6789/.test(document.querySelector('[data-card="openai"]').textContent) && !document.querySelector('[data-form="openai"]'))), 'после успеха ключ показан только маской');
        const sent = calls.keys.filter((c) => c.action === 'set_openai').pop();
        assert.strictEqual(sent.api_key, SECRET_KEY); assert.strictEqual(sent.model, 'gpt-4o-mini');
        console.log('ok   ключ ChatGPT: ошибка с сохранением введённого, успех, показ маской');

        // новый бот
        await page.click('[data-card="tg"] [data-act="addbot"]');
        await page.fill('[data-form="bot"] input[name="title"]', 'Алина Элиум');
        await page.fill('[data-form="bot"] input[name="token"]', SECRET_TOKEN);
        assert.strictEqual(await page.evaluate(() => document.querySelector('[data-form="bot"] input[name="token"]').type), 'password', 'токен вводится скрыто');
        await page.click('[data-form="bot"] button[type="submit"]');
        assert.ok(await until(() => page.evaluate(() => /elium_bot/.test(document.querySelector('[data-card="tg"]').textContent))), 'новый бот появился в списке');
        const created = calls.tg.find((c) => c.action === 'create');
        assert.deepStrictEqual([created.title, created.token, created.kind], ['Алина Элиум', SECRET_TOKEN, 'agent']);
        // выключатель
        await page.click('[data-bot="elium"] input[data-act="toggle"]');
        assert.ok(await until(() => calls.tg.some((c) => c.action === 'disable' && c.bot_id === 'elium')), 'выключатель отправляет «disable»');
        console.log('ok   добавление бота: токен скрыт при вводе, бот в списке, выключатель');

        // расход ChatGPT и привязка листов к кабинетам
        assert.ok(await until(() => page.evaluate(() => /Расход в этом месяце ≈ \$1\.50 из \$10\.00/.test(document.querySelector('[data-card="openai"]').textContent) && /последняя: закончились деньги на счёте OpenAI/.test(document.querySelector('[data-card="openai"]').textContent))), 'расход, бюджет и последняя ошибка человеческим текстом');
        assert.ok(await until(() => page.evaluate(() => /ИП МАРС/.test(document.querySelector('[data-card="google"]').textContent) && /Не привязана/.test(document.querySelector('[data-cab="cabM"]').textContent))), 'кабинеты и статус привязки листа');
        await page.click('[data-act="linkform"][data-cab="cabM"]');
        await page.fill('[data-form="link"] input[name="sheet"]', 'https://docs.google.com/spreadsheets/d/1ZSdNfnflgwOQZFSm1qcvfOB94bnfipZu5fB3pDodrik/edit');
        await page.click('[data-form="link"] button[type="submit"]');
        assert.ok(await until(() => page.evaluate(() => /Таблица недоступна\. Откройте доступ/.test(document.querySelector('[data-v="toast"]').textContent))), 'нет доступа: понятно, что делать');
        assert.strictEqual(await page.evaluate(() => document.querySelector('[data-form="link"] input[name="sheet"]').value.length > 20), true, 'введённая ссылка не пропала');
        failLink = false; await page.click('[data-form="link"] button[type="submit"]');
        assert.ok(await until(() => page.evaluate(() => /Синхронизируется/.test(document.querySelector('[data-cab="cabM"]').textContent) && !document.querySelector('[data-form="link"]'))), 'после привязки статус «Синхронизируется»');
        const linkCall = calls.keys.filter((c) => c.action === 'link_sheet').pop(); assert.strictEqual(linkCall.cabinet_id, 'cabM'); assert.strictEqual(linkCall.tab, 'Раздачи');
        console.log('ok   расход ChatGPT с бюджетом и ошибкой, привязка листа к кабинету (отказ и успех)');

        // секреты нигде на странице не видны
        const text = await page.evaluate(() => document.body.innerHTML + JSON.stringify(Object.assign({}, localStorage)));
        assert.ok(!text.includes(SECRET_TOKEN) && !text.includes(SECRET_KEY), 'токен и ключ не остаются ни на странице, ни в кэше устройства');
        // проверка Google
        await page.click('[data-card="google"] [data-act="test"]');
        assert.ok(await until(() => page.evaluate(() => /Таблица «Кэшбэки \/ Выкупы МАРС» доступна/.test(document.querySelector('[data-card="google"]').textContent))), 'проверка доступа к таблице показывает название');
        console.log('ok   секретов на странице и в кэше нет, проверка доступа к таблице');
        assert.deepStrictEqual(env.errors.filter((e) => !/404|favicon/.test(e)), [], 'в консоли нет ошибок');

        // обычному пользователю вкладки нет
        const env2 = await openApp(browser, url, {
            userId: USER_ID, email: 'user@example.com', latencyMs: 20, tables: base(USER_ID, 'user@example.com').spaces ? Object.assign(base(USER_ID, 'user@example.com'), { spaces: [{ id: 's1', user_id: USER_ID, email: 'user@example.com', status: 'active', tariff_plan: 'vip', is_super_admin: false, full_name: 'U' }] }) : {}, rpcs: { is_super_admin: false },
            functions: { 'wb-proxy': async () => ({}) },
        });
        await env2.page.evaluate(() => showTab('settings'));
        await env2.page.waitForSelector('#settings-tab-btn-keys', { state: 'attached' });
        await env2.page.waitForTimeout(600);
        assert.ok(await env2.page.evaluate(() => document.getElementById('settings-tab-btn-keys').classList.contains('hidden-tab')), 'обычному пользователю вкладка скрыта');
        console.log('ok   обычному пользователю вкладки нет');
        console.log('e2e «Боты и ключи»: все проверки прошли');
    } finally { await browser.close(); srv.close(); }
})().catch((e) => { console.error(e); process.exit(1); });

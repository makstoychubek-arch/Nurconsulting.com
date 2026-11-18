/**
 * Продвижение → Алина: настройки Алины на сайте. Запуск: node e2e/alina-settings.e2e.js.
 * Путь к Chromium можно задать через PW_CHROMIUM.
 */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');

const base = {
    spaces: [{ id: 's0', user_id: ADMIN_ID, email: 'admin@example.com', status: 'active', tariff_plan: 'vip', is_super_admin: true, full_name: 'M' }],
    cabinets: [{ id: CAB, name: 'T', wb_token_set: true, user_id: ADMIN_ID }],
};
const until = async (fn, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 100)); } return false; };

(async () => {
    const srv = await serve();
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    try {
        const url = 'http://127.0.0.1:' + srv.address().port;
        // 1. Настройки по умолчанию, изменения, сохранение
        const tg = []; let alinaOn = false; const sbx = []; let sbxFail = false; let sbxLead = null;
        const env = await openApp(browser, url, {
            userId: ADMIN_ID, email: 'admin@example.com', latencyMs: 30, tables: Object.assign({}, base, { alina_settings: [], alina_settings_log: [] }), rpcs: { is_super_admin: true },
            functions: {
                'wb-proxy': async () => ({}),
                'alina-sandbox': async (b) => {
                    sbx.push(b);
                    if (b.action === 'reset') { sbxLead = null; return { ok: true, lead: null }; }
                    if (b.action === 'state') return { ok: true, lead: sbxLead };
                    if (sbxFail) return { ok: false, error: 'Алина не смогла ответить. Это сбой сценария, диалог не потерян.' };
                    await new Promise((r) => setTimeout(r, 400));
                    sbxLead = { status: 'ask_ad', deal_type: null, product_name: null };
                    return { ok: true, replies: ['Здравствуйте! По какому объявлению вы пишете?'], photos: [], ms: 1200, lead: sbxLead };
                },
                'telegram-admin': async (b) => { tg.push(b); if (b.action === 'enable') alinaOn = true; if (b.action === 'disable') alinaOn = false; return b.action === 'list' ? { bots: [{ id: 'alina', title: 'Алина', is_enabled: alinaOn }] } : { ok: true }; },
            },
        });
        const { page } = env;
        await page.evaluate(() => showTab('advertising'));
        await page.waitForSelector('#nr-ads-tabs [data-av="alina"]', { state: 'attached', timeout: 10000 });
        assert.ok(await page.evaluate(() => /Алина/.test(document.querySelector('#nr-ads-tabs [data-av="alina"]').textContent)), 'во вкладках «Продвижения» есть «Алина»');
        await page.evaluate(() => document.querySelector('#nr-ads-tabs [data-av="alina"]').click());
        // каркас виден сразу, без ожидания базы
        await page.waitForSelector('#nr-ads-alina .as-wrap', { timeout: 3000 });
        assert.ok(await page.evaluate(() => !document.getElementById('nr-ads-alina').hidden), 'страница «Алина» открыта');
        assert.ok(await page.evaluate(() => getComputedStyle(document.getElementById('adv-view-ads')).display === 'none'), 'кампании скрыты на самом деле (правило оформления их не возвращает)');
        assert.ok(await page.evaluate(() => !!document.querySelector('.as-typing') && /прочитано/.test(document.querySelector('.as-phone').textContent)), 'предпросмотр: «прочитано» и «печатает»');
        assert.ok(await page.evaluate(() => /Мара, минутку, уточню\./.test(document.querySelector('.as-phone').textContent)), 'предпросмотр: фраза с именем');
        assert.ok(await page.evaluate(() => document.querySelector('[data-v="bar"]').hidden), 'панели «Сохранить» нет, пока ничего не менялось');
        console.log('ok   вкладка «Алина» в «Продвижении»: каркас сразу, значения по умолчанию, предпросмотр');
        await page.evaluate(() => document.querySelector('#nr-ads-tabs [data-av="ads"]').click());
        assert.ok(await page.evaluate(() => getComputedStyle(document.getElementById('adv-view-ads')).display !== 'none' && document.getElementById('nr-ads-alina').hidden), 'обратно на «Кампании»: они видны, «Алина» скрыта');
        await page.evaluate(() => document.querySelector('#nr-ads-tabs [data-av="alina"]').click());

        await page.click('input[data-k="typing"]');
        assert.ok(await page.evaluate(() => !document.querySelector('.as-typing')), '«Печатает» выключено: индикатора в предпросмотре нет');
        await page.click('input[data-k="useName"]');
        assert.ok(await page.evaluate(() => /^Минутку, уточню\./.test(document.querySelector('.as-phone .as-bot').textContent)), 'без имени фраза без обращения');
        await page.click('[data-step="5"][data-for="remindMin"]');
        assert.strictEqual(await page.evaluate(() => document.querySelector('input[data-k="remindMin"]').value), '15');
        assert.ok(await page.evaluate(() => /Без ответа 15 мин/.test(document.querySelector('[data-v="grp"]').textContent)), 'предпросмотр для менеджеров: 15 мин');
        assert.ok(await page.evaluate(() => !document.querySelector('[data-v="bar"]').hidden && /Изменено: 3/.test(document.querySelector('[data-v="cnt"]').textContent)), 'панель: изменено 3');
        // границы: 0 минут невозможно
        for (let i = 0; i < 6; i++) await page.click('[data-step="-5"][data-for="remindMin"]');
        assert.strictEqual(await page.evaluate(() => document.querySelector('input[data-k="remindMin"]').value), '1', 'меньше минуты нельзя');
        await page.click('[data-step="5"][data-for="remindMin"]'); await page.click('[data-step="5"][data-for="remindMin"]');
        assert.strictEqual(await page.evaluate(() => document.querySelector('input[data-k="remindMin"]').value), '11');
        // фразы
        await page.click('[data-act="addPhrase"]');
        assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.as-chip').length), 4, 'фраза добавлена');
        await page.click('[data-del="3"]');
        assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.as-chip').length), 3);
        console.log('ok   выключатели, число с границей, фразы, предпросмотр и счётчик изменений');

        // клиенты и расход: числа с границами
        assert.strictEqual(await page.evaluate(() => document.querySelector('input[data-k="admitLimit"]').value), '30', 'лимит по умолчанию 30');
        for (let i = 0; i < 8; i++) await page.click('[data-step="-5"][data-for="admitLimit"]');
        assert.strictEqual(await page.evaluate(() => document.querySelector('input[data-k="admitLimit"]').value), '0', 'лимит до 0 («без лимита»), ниже нельзя');
        await page.click('[data-step="5"][data-for="llmBudgetUsd"]'); await page.click('[data-step="5"][data-for="llmBudgetUsd"]');
        assert.strictEqual(await page.evaluate(() => document.querySelector('input[data-k="llmBudgetUsd"]').value), '10', 'бюджет ChatGPT 10 $');
        console.log('ok   лимит клиентов (0 = без лимита) и бюджет ChatGPT');

        const t0 = Date.now();
        await page.click('[data-v="bar"] [data-act="save"]');
        assert.ok(await page.evaluate(() => !document.querySelector('[data-v="toast"]').hidden && /Сохранено/.test(document.querySelector('[data-v="toast"]').textContent)), 'тост сразу');
        assert.ok(Date.now() - t0 < 600, 'отклик быстрее 600 мс: ' + (Date.now() - t0));
        assert.ok(await page.evaluate(() => document.querySelector('[data-v="bar"]').hidden), 'панель убрана сразу, запись идёт в фоне');
        assert.ok(await until(() => env.calls.some((c) => c.kind === 'write' && c.table === 'alina_settings')), 'настройки записаны в alina_settings');
        assert.ok(await until(() => env.calls.some((c) => c.kind === 'write' && c.table === 'alina_settings_log')), 'в журнал изменений запись попала');
        console.log('ok   сохранение: тост и панель сразу, запись в базу и журнал в фоне');
        assert.deepStrictEqual(env.errors.filter((e) => !/404|favicon/.test(e)), [], 'в консоли нет ошибок');

        // включатель Алины для клиентов (только администратор): подтверждение словом
        assert.ok(await until(() => page.evaluate(() => !document.querySelector('[data-v="powercard"]').hidden && /Выключено/.test(document.querySelector('[data-v="powersub"]').textContent))), 'администратору виден включатель, Алина выключена');
        await page.click('input[data-power]');
        assert.ok(await page.evaluate(() => !document.querySelector('[data-v="confirm"]').hidden && !document.querySelector('input[data-power]').checked), 'включение просит подтверждение, переключатель пока выключен');
        await page.fill('[data-v="word"]', 'ну да'); await page.click('[data-act="powerok"]');
        assert.ok(await page.evaluate(() => /слово «включить»/.test(document.querySelector('[data-v="powererr"]').textContent)), 'неверное слово отклоняется');
        assert.ok(!tg.some((c) => c.action === 'enable'), 'без верного слова бот не включается');
        await page.fill('[data-v="word"]', 'Включить'); await page.click('[data-act="powerok"]');
        assert.ok(await until(() => tg.some((c) => c.action === 'enable' && c.bot_id === 'alina')), 'верное слово включает бота alina');
        assert.ok(await until(() => page.evaluate(() => /Включено: отвечает всем/.test(document.querySelector('[data-v="powersub"]').textContent) && document.querySelector('input[data-power]').checked && document.querySelector('[data-v="confirm"]').hidden)), 'состояние «включено»');
        await page.click('input[data-power]');
        assert.ok(await until(() => tg.some((c) => c.action === 'disable' && c.bot_id === 'alina')), 'выключение без подтверждения');
        console.log('ok   включатель Алины: подтверждение словом, включение и выключение');

        // песочница: клиент пишет Алине, ответ приходит из настоящего сценария
        assert.ok(await page.evaluate(() => !document.querySelector('[data-v="sandbox"]').hidden && /Диалог пуст/.test(document.querySelector('[data-sb="chat"]').textContent)), 'администратору виден пустой чат песочницы');
        await page.click('[data-sb-chip="Здравствуйте, хочу участвовать"]');
        assert.ok(await page.evaluate(() => /Здравствуйте, хочу участвовать/.test(document.querySelector('[data-sb="chat"]').textContent) && !!document.querySelector('.asb-typing')), 'сообщение клиента и «печатает» появляются сразу, не дожидаясь ответа');
        assert.ok(await until(() => page.evaluate(() => /По какому объявлению/.test(document.querySelector('[data-sb="chat"]').textContent) && !document.querySelector('.asb-typing'))), 'ответ Алины подставился');
        assert.ok(await page.evaluate(() => /Этап: выясняет объявление · ответила за 1,2 с/.test(document.querySelector('[data-sb="state"]').textContent)), 'этап диалога и время ответа');
        assert.strictEqual(sbx.find((c) => c.action === 'send').username, 'sandbox_client', 'логин по умолчанию');
        await page.fill('[data-sb="login"]', 'my_blogger'); await page.fill('[data-sb="text"]', 'Привет'); await page.click('[data-sb="send"]');
        assert.ok(await until(() => sbx.filter((c) => c.action === 'send').length === 2 && sbx.filter((c) => c.action === 'send')[1].username === 'my_blogger'), 'свой логин клиента уходит в сценарий');
        await until(() => page.evaluate(() => !document.querySelector('.asb-typing')));
        sbxFail = true; await page.fill('[data-sb="text"]', 'ещё'); await page.click('[data-sb="send"]');
        assert.ok(await until(() => page.evaluate(() => /не смогла ответить/.test(document.querySelector('[data-sb="chat"]').textContent) && !!document.querySelector('.asb-retry'))), 'сбой показан с «Повторить»');
        sbxFail = false; await page.click('.asb-retry');
        assert.ok(await until(() => sbx.filter((c) => c.action === 'send').length === 4), 'повтор отправляет то же сообщение ещё раз');
        await until(() => page.evaluate(() => !document.querySelector('.asb-typing') && !document.querySelector('.asb-retry')));
        await page.click('[data-sb-act="reset"]');
        assert.ok(await page.evaluate(() => /Диалог пуст/.test(document.querySelector('[data-sb="chat"]').textContent)), 'начать заново очищает чат сразу');
        assert.ok(await until(() => sbx.some((c) => c.action === 'reset')), 'сброс отправлен на сервер');
        console.log('ok   песочница: сообщение и «печатает» сразу, ответ, этап, свой логин, сбой и повтор, начать заново');
        assert.deepStrictEqual(env.errors.filter((e) => !/404|favicon/.test(e)), [], 'в консоли нет ошибок');

        // 2. Значения из базы применяются; кэш показывается сразу
        const env2 = await openApp(browser, url, { userId: ADMIN_ID, email: 'admin@example.com', latencyMs: 30, tables: Object.assign({}, base, { alina_settings: [{ key: 'typing', value: false }, { key: 'admitLimit', value: 50 }, { key: 'remindMin', value: 25 }, { key: 'phrases', value: ['Свяжусь с менеджером.'] }], alina_settings_log: [{ key: 'typing', changed_at: new Date().toISOString() }] }), rpcs: { is_super_admin: true } });
        await env2.page.evaluate(() => showTab('advertising'));
        await env2.page.waitForSelector('#nr-ads-tabs [data-av="alina"]', { state: 'attached', timeout: 10000 });
        await env2.page.evaluate(() => document.querySelector('#nr-ads-tabs [data-av="alina"]').click());
        assert.ok(await until(() => env2.page.evaluate(() => document.querySelector('input[data-k="remindMin"]') && document.querySelector('input[data-k="remindMin"]').value === '25')), 'значение из базы: напоминание 25 минут');
        assert.ok(await env2.page.evaluate(() => !document.querySelector('input[data-k="typing"]').checked), 'из базы: «печатает» выключено');
        assert.strictEqual(await env2.page.evaluate(() => document.querySelector('input[data-k="admitLimit"]').value), '50', 'из базы: лимит 50');
        assert.ok(await env2.page.evaluate(() => /Мара, свяжусь с менеджером\./.test(document.querySelector('.as-phone').textContent)), 'своя фраза из базы в предпросмотре');
        assert.ok(await until(() => env2.page.evaluate(() => /Последние изменения/.test(document.querySelector('[data-v="hist"]').textContent))), 'история изменений показана');
        console.log('ok   настройки из базы применяются, своя фраза, история');
        assert.deepStrictEqual(env2.errors.filter((e) => !/404|favicon/.test(e)), [], 'в консоли нет ошибок');
        console.log('e2e настроек Алины: все проверки прошли');
    } finally { await browser.close(); srv.close(); }
})().catch((e) => { console.error(e); process.exit(1); });

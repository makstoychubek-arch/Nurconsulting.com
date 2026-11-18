/**
 * Продвижение → Раздачи для кабинета с листом Google: колонки как в таблице, полоса обмена, «Обновить из таблицы».
 * Запуск: node e2e/giveaways-sheet.e2e.js. Путь к Chromium можно задать через PW_CHROMIUM.
 */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');

const SHEET_HEAD = ['ТОВАР', 'ВИД РАЗДАЧИ', 'Ссылка ТГ', 'Дата заказа', 'Цена в заказе', 'Размер кэша', 'Кэш выплачен', 'Примерная дата забора', 'Фактическая дата забора', 'Разрезанный ШК', 'Дата публикации отзыва', 'Вид отзыва', 'Реквизиты', 'Реквизиты', 'Фактическая дата выплаты', 'Отзыв опубликован', 'Ответственный', 'Ключ', 'Планируемая дата выплаты', 'Фильтры', 'Чёрный список / комментарии', 'Просмотры рилс', 'Ссылка на Reels'];
const until = async (fn, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 100)); } return false; };
const tables = (sheet) => ({
    spaces: [{ id: 's0', user_id: ADMIN_ID, email: 'admin@example.com', status: 'active', tariff_plan: 'vip', is_super_admin: true, full_name: 'M' }],
    cabinets: [{ id: CAB, name: 'ИП МАРС', wb_token_set: true, user_id: ADMIN_ID }],
    rnp_articles: [],
    giveaway_sheets: sheet ? [{ cabinet_id: CAB, enabled: true, last_sync_at: new Date(Date.now() - 12000).toISOString(), last_error: null }] : [],
    giveaways: [
        { id: 'g1', cabinet_id: CAB, pos: 0, model: 'Пижама 3в1 шоколадный', kind: 'БЛОГЕР', tg_link: '@user_a01', order_date: '2026-11-14', kind_x: null },
        { id: 'g2', cabinet_id: CAB, pos: 1, model: 'Пижама 3в1 молочный', kind: 'БЛОГЕР', tg_link: '@user_a02', order_date: '2026-11-14', order_price: 1999, requisites2: 'карта 2' },
    ],
});

(async () => {
    const srv = await serve();
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    try {
        const url = 'http://127.0.0.1:' + srv.address().port;
        const synced = [];
        let fail = false;
        const env = await openApp(browser, url, {
            userId: ADMIN_ID, email: 'admin@example.com', latencyMs: 20, rpcs: { is_super_admin: true }, tables: tables(true),
            functions: { 'wb-proxy': async () => ({}), 'giveaways-sync': async (b) => { synced.push(b); return fail ? { ok: true, results: { [CAB]: { ok: false, error: 'Лист не прочитался' } } } : { ok: true, results: { [CAB]: { ok: true, stats: {} } } }; } },
        });
        const { page } = env;
        await page.evaluate(() => showTab('advertising'));
        await page.waitForSelector('#nr-ads-tabs [data-av="give"]', { state: 'attached', timeout: 10000 });
        await page.evaluate(() => document.querySelector('#nr-ads-tabs [data-av="give"]').click());
        await page.waitForSelector('#nr-ads-give .gv-table th.gv-th', { timeout: 6000 });
        assert.ok(await until(() => page.evaluate(() => document.querySelectorAll('#nr-ads-give .gv-table thead th.gv-th:not(.gv-rn-h)').length === 23)), '23 колонки как на листе');
        const heads = await page.evaluate(() => [...document.querySelectorAll('#nr-ads-give .gv-table thead th.gv-th:not(.gv-rn-h)')].map((t) => t.textContent));
        assert.deepStrictEqual(heads, SHEET_HEAD, 'порядок и названия колонок те же, что на листе');
        console.log('ok   «Раздачи» для кабинета с листом: 23 колонки в порядке Google');
        const first = await page.evaluate(() => [...document.querySelectorAll('#nr-ads-give .gv-table tbody tr:first-child td')].slice(0, 4).map((t) => t.textContent.trim()));
        assert.strictEqual(first[0], 'Пижама 3в1 шоколадный'); assert.strictEqual(first[2], '@user_a01');
        const second = await page.evaluate(() => [...document.querySelectorAll('#nr-ads-give .gv-table tbody tr:nth-child(2) td')].map((t) => t.textContent.trim()));
        assert.ok(second.includes('карта 2'), 'второй «Реквизиты» показан');
        assert.ok(await until(() => page.evaluate(() => /Синхронизировано с Google · \d+ с назад/.test(document.querySelector('.gv-sync').textContent))), 'полоса «Синхронизировано с Google»');
        console.log('ok   данные листа в ячейках, второй «Реквизиты», полоса синхронизации');
        await page.click('[data-act="sync"]');
        assert.ok(await until(() => synced.length === 1 && synced[0].cabinet_id === CAB), 'кнопка вызывает обмен для этого кабинета');
        assert.ok(await until(() => page.evaluate(() => /Синхронизировано с Google · [0-4] с назад/.test(document.querySelector('.gv-sync').textContent))), 'после обмена «только что»');
        fail = true; await page.click('[data-act="sync"]');
        assert.ok(await until(() => page.evaluate(() => /Нет связи с таблицей: Лист не прочитался/.test(document.querySelector('.gv-sync').textContent) && document.querySelector('.gv-sync').classList.contains('is-bad'))), 'ошибка обмена показана');
        console.log('ok   «Обновить из таблицы»: вызов, успех, понятная ошибка');
        assert.deepStrictEqual(env.errors.filter((e) => !/404|favicon/.test(e)), [], 'в консоли нет ошибок');

        // кабинет без листа: прежняя таблица
        const env2 = await openApp(browser, url, { userId: ADMIN_ID, email: 'admin@example.com', latencyMs: 20, rpcs: { is_super_admin: true }, tables: tables(false), functions: { 'wb-proxy': async () => ({}) } });
        await env2.page.evaluate(() => showTab('advertising'));
        await env2.page.waitForSelector('#nr-ads-tabs [data-av="give"]', { state: 'attached', timeout: 10000 });
        await env2.page.evaluate(() => document.querySelector('#nr-ads-tabs [data-av="give"]').click());
        await env2.page.waitForSelector('#nr-ads-give .gv-table th.gv-th', { timeout: 6000 });
        await env2.page.waitForTimeout(500);
        const legacy = await env2.page.evaluate(() => [...document.querySelectorAll('#nr-ads-give .gv-table thead th.gv-th:not(.gv-rn-h)')].map((t) => t.textContent));
        assert.strictEqual(legacy[0], 'Вид'); assert.ok(!(await env2.page.evaluate(() => document.querySelector('.gv-sync'))), 'без листа полосы обмена нет');
        console.log('ok   кабинет без листа: прежняя таблица без изменений');
        console.log('e2e «Раздачи» с листом: все проверки прошли');
    } finally { await browser.close(); srv.close(); }
})().catch((e) => { console.error(e); process.exit(1); });

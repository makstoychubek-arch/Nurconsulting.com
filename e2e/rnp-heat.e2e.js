/**
 * РНП: подсветка «хорошо / плохо» (Настройки РНП → Подсветка таблицы).
 * По умолчанию «Чёрная таблетка»; смена стиля и шрифта применяется сразу (CSS, без перерисовки таблицы);
 * режим порогов пересчитывает тона; раздел настроек показывает 9 стилей, предпросмотр и правила.
 * Запуск: npm run test:e2e. Путь к Chromium можно задать через PW_CHROMIUM. SHOT=путь.png сохраняет скриншот таблицы,
 * SHOT_SET=путь.png скриншот раздела настроек.
 */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');

const day = (n) => new Date(Date.now() + 6 * 3600e3 - n * 86400e3).toISOString().slice(0, 10);
const NM = 296556350;
const tables = {
    spaces: [{ id: 's0', user_id: ADMIN_ID, email: 'makstoychubek@gmail.com', status: 'active', tariff_plan: 'vip', is_super_admin: true, first_name: 'M', last_name: 'T', full_name: 'M T' }],
    cabinets: [{ id: CAB, name: 'T', wb_token_set: true, user_id: ADMIN_ID }],
    rnp_articles: [{ id: 'a0', cabinet_id: CAB, nm_id: NM, seller_article: 'костюм_оверсайз_бежевый', name: 'костюм_оверсайз_бежевый', category: 'К1', is_active: true, cost_price: 1300, photo_url: null, sort_order: 0 }],
    // суммы заказов разные по дням, чтобы у строки были лучшее и худшее значения
    rnp_daily_data: Array.from({ length: 12 }, (_, d) => ({ cabinet_id: CAB, nm_id: NM, date: day(d), orders_count: 3 + (d % 5), orders_sum: 9000 + ((d * 7) % 11) * 2500, sales_count: 3, sales_sum: 15000, ad_spend: 300, impressions: 500, clicks: 20 })),
    wb_stocks: [],
};

(async () => {
    const srv = await serve();
    const base = 'http://127.0.0.1:' + srv.address().port;
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    let failed = 0;
    const run = async (name, fn) => {
        try { await fn(); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + String(e.message || e).split('\n')[0]); }
    };
    try {
        const env = await openApp(browser, base, { userId: ADMIN_ID, email: 'makstoychubek@gmail.com', latencyMs: 40, tables, rpcs: { is_super_admin: true }, functions: { 'wb-proxy': async () => ({}) } });
        const { page } = env;
        await page.setViewportSize({ width: 1553, height: 884 });
        await page.evaluate(() => { try { localStorage.removeItem('nr_rnp_heat_v1'); } catch (_) {} const s = document.getElementById('nr-splash'); if (s) s.remove(); });
        await page.evaluate(() => showTab('rnp'));
        await page.waitForFunction(() => /ЗАКАЗЫ/.test(document.body.textContent) && window.RNP && typeof RNP.pick === 'function', null, { timeout: 20000 });
        await page.waitForTimeout(1500);
        await page.evaluate((nm) => RNP.pick(nm), NM);
        await page.waitForSelector('.rnp-sheet-table td[data-rnp-metric="orders_sum"]', { timeout: 20000 });
        await page.waitForTimeout(600);

        await run('по умолчанию стиль «Чёрная таблетка», шрифт жирный', async () => {
            const r = await page.evaluate(() => ({ s: document.documentElement.getAttribute('data-rnp-heat'), bn: document.documentElement.classList.contains('rnp-heat-bn'), bv: document.documentElement.classList.contains('rnp-heat-bv') }));
            assert.deepStrictEqual(r, { s: 'P', bn: true, bv: true });
        });
        await run('у строки с разными значениями есть лучшее и худшее, лучшее чёрная таблетка', async () => {
            const r = await page.evaluate(() => {
                const row = [...document.querySelectorAll('.rnp-sheet-table tr')].find((tr) => tr.querySelector('td[data-rnp-metric="orders_sum"]'));
                const pos = row.querySelectorAll('td[data-hr="pos"] .rnp-hvs'), neg = row.querySelectorAll('td[data-hr="neg"] .rnp-hvs');
                const cs = pos[0] ? getComputedStyle(pos[0]) : null;
                return { pos: pos.length, neg: neg.length, bg: cs && cs.backgroundColor, radius: cs && cs.borderTopLeftRadius };
            });
            assert.ok(r.pos >= 1 && r.neg >= 1, 'нет лучшего или худшего: ' + JSON.stringify(r));
            assert.ok(r.bg && r.bg !== 'rgba(0, 0, 0, 0)' && parseFloat(r.radius) > 8, 'таблетка не нарисована: ' + JSON.stringify(r));
        });
        if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
        await run('смена стиля применяется сразу, таблица не перерисовывается', async () => {
            await page.evaluate(() => { window.__tbl = document.querySelector('.rnp-sheet-table'); RNP.heatSet('style', 'V'); });
            const r = await page.evaluate(() => {
                const el = document.querySelector('.rnp-sheet-table td[data-hr="pos"] .rnp-hvs');
                return { same: window.__tbl === document.querySelector('.rnp-sheet-table'), attr: document.documentElement.getAttribute('data-rnp-heat'), bw: getComputedStyle(el).borderTopWidth, bg: getComputedStyle(el).backgroundColor };
            });
            assert.ok(r.same, 'таблица была пересоздана');
            assert.strictEqual(r.attr, 'V');
            assert.ok(parseFloat(r.bw) >= 1 && r.bg === 'rgba(0, 0, 0, 0)', 'контур не применился: ' + JSON.stringify(r));
        });
        await run('все 9 стилей переключаются без ошибок', async () => {
            const ids = await page.evaluate(() => ['font', 'A', 'B', 'V', 'T', 'S', 'F', 'Z', 'P'].map((id) => { RNP.heatSet('style', id); return document.documentElement.getAttribute('data-rnp-heat'); }));
            assert.deepStrictEqual(ids, ['font', 'A', 'B', 'V', 'T', 'S', 'F', 'Z', 'P']);
        });
        await run('жирные названия и цифры переключаются, выбор запоминается', async () => {
            const r = await page.evaluate(() => {
                RNP.heatSet('bn', false); RNP.heatSet('cap', true);
                const h = document.documentElement;
                const saved = JSON.parse(localStorage.getItem('nr_rnp_heat_v1'));
                return { bn: h.classList.contains('rnp-heat-bn'), cap: h.classList.contains('rnp-heat-cap'), saved: saved.bn === false && saved.cap === true && saved.style === 'P' };
            });
            assert.deepStrictEqual(r, { bn: false, cap: true, saved: true });
            await page.evaluate(() => { RNP.heatSet('bn', true); RNP.heatSet('cap', false); });
        });

        await page.evaluate(() => RNP.openSettings());
        await page.locator('.nr-gt-g[data-g="view"]').click(); // подсветка на вкладке «Вид таблицы»
        await page.waitForSelector('#rnp-heat-sec', { timeout: 15000 });
        await run('в настройках РНП есть раздел «Подсветка таблицы»: 9 стилей, предпросмотр, правила', async () => {
            const r = await page.evaluate(() => ({ tiles: document.querySelectorAll('#rnp-heat-sec .rnp-ht-tile').length, on: document.querySelector('#rnp-heat-sec .rnp-ht-tile.is-on')?.getAttribute('data-heat-style'), prevRows: document.querySelectorAll('#rnp-heat-sec .rnp-ht-prev:not(.rnp-ht-mini) tbody tr').length, rules: document.querySelectorAll('#rnp-heat-sec .rnp-ht-rules tbody tr').length }));
            assert.strictEqual(r.tiles, 9); assert.strictEqual(r.on, 'P'); assert.strictEqual(r.prevRows >= 4, true); assert.strictEqual(r.rules >= 6, true);
        });
        if (process.env.SHOT_SET) { await page.evaluate(() => document.getElementById('rnp-heat-sec').scrollIntoView()); await page.waitForTimeout(300); await page.screenshot({ path: process.env.SHOT_SET }); }
        await run('клик по плитке меняет стиль и предпросмотр сразу', async () => {
            await page.click('#rnp-heat-sec .rnp-ht-tile[data-heat-style="B"]');
            const r = await page.evaluate(() => ({ a: document.documentElement.getAttribute('data-rnp-heat'), on: document.querySelector('#rnp-heat-sec .rnp-ht-tile.is-on').getAttribute('data-heat-style'), dot: getComputedStyle(document.querySelector('#rnp-heat-sec .rnp-ht-prev:not(.rnp-ht-mini) td[data-hs] .rnp-hvs'), '::before').content }));
            assert.strictEqual(r.a, 'B'); assert.strictEqual(r.on, 'B'); assert.ok(r.dot && r.dot !== 'none', 'точка не нарисована');
            await page.click('#rnp-heat-sec .rnp-ht-tile[data-heat-style="P"]');
        });
        await run('режим «По порогам» пересчитывает предпросмотр: по порогам хороших ДРР больше, чем одно лучшее', async () => {
            const before = await page.evaluate(() => document.querySelectorAll('#rnp-heat-sec .rnp-ht-prev:not(.rnp-ht-mini) td[data-hr="pos"]').length);
            await page.evaluate(() => RNP.heatSet('mode', 'thr'));
            const after = await page.evaluate(() => document.querySelectorAll('#rnp-heat-sec .rnp-ht-prev:not(.rnp-ht-mini) td[data-hr="pos"]').length);
            assert.ok(after > before, 'после перехода на пороги хороших ячеек ' + after + ', было ' + before);
        });
        await run('изменение порога сразу меняет предпросмотр', async () => {
            const n1 = await page.evaluate(() => document.querySelectorAll('#rnp-heat-sec .rnp-ht-prev:not(.rnp-ht-mini) td[data-hr="pos"]').length);
            await page.evaluate(() => RNP.heatRule('drr_pct', 'good', 1));
            const n2 = await page.evaluate(() => document.querySelectorAll('#rnp-heat-sec .rnp-ht-prev:not(.rnp-ht-mini) td[data-hr="pos"]').length);
            assert.ok(n2 < n1, 'порог ДРР до 1 должен оставить меньше хороших: ' + n1 + ' → ' + n2);
        });
        await run('«Сбросить к стандартным» возвращает чёрную таблетку и авто-режим', async () => {
            await page.evaluate(() => RNP.heatReset());
            const r = await page.evaluate(() => ({ s: document.documentElement.getAttribute('data-rnp-heat'), seg: document.querySelector('#rnp-heat-sec .rnp-ht-seg .is-on').textContent.trim().slice(0, 4) }));
            assert.deepStrictEqual(r, { s: 'P', seg: 'Авто' });
        });
        await run('ошибок скриптов нет', async () => { assert.deepStrictEqual(env.errors || [], []); });
    } finally {
        await browser.close();
        srv.close();
    }
    if (failed) { console.log('e2e подсветки РНП: провалено ' + failed); process.exit(1); }
    console.log('e2e подсветки РНП: все проверки прошли');
})();

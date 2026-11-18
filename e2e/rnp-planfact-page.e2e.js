/**
 * План/факт (страница РНП): общая дата сверху справа видна и меняет неделю в таблице, таблица тянется до низа страницы.
 * Запуск: npm run test:e2e. Путь к Chromium можно задать через PW_CHROMIUM. SHOT=путь.png сохраняет скриншот.
 */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');

const day = (n) => new Date(Date.now() + 6 * 3600e3 - n * 86400e3).toISOString().slice(0, 10);
const NMS = Array.from({ length: 40 }, (_, i) => 296556000 + i);
const tables = {
    spaces: [{ id: 's0', user_id: ADMIN_ID, email: 'makstoychubek@gmail.com', status: 'active', tariff_plan: 'vip', is_super_admin: true, first_name: 'M', last_name: 'T', full_name: 'M T' }],
    cabinets: [{ id: CAB, name: 'T', wb_token_set: true, user_id: ADMIN_ID }],
    rnp_articles: NMS.map((nm, i) => ({ id: 'a' + i, cabinet_id: CAB, nm_id: nm, seller_article: 'артикул_' + i, name: 'артикул_' + i, category: 'К1', is_active: true, cost_price: 1000, photo_url: null, sort_order: i })),
    rnp_daily_data: NMS.flatMap((nm) => Array.from({ length: 10 }, (_, d) => ({ cabinet_id: CAB, nm_id: nm, date: day(d), orders_count: 5, orders_sum: 25000, sales_count: 3, sales_sum: 15000 }))),
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
        await page.evaluate(() => { const s = document.getElementById('nr-splash'); if (s) s.remove(); });
        await page.evaluate(() => showTab('rnp'));
        await page.waitForFunction(() => window.RNP && typeof RNP.openPlanFact === 'function', null, { timeout: 20000 });
        await page.waitForTimeout(1500);
        await page.evaluate(() => RNP.openPlanFact());
        await page.waitForSelector('#tab-rnp-planfact.active .pf-scroll .pf-sheet', { timeout: 20000 });
        await page.waitForTimeout(800);
        if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });

        await run('на странице План/факт видна общая дата в шапке', async () => {
            const vis = await page.evaluate(() => { const w = document.getElementById('header-date-chip-wrap'); if (!w) return false; const r = w.getBoundingClientRect(); return r.width > 20 && r.height > 10 && getComputedStyle(w).display !== 'none'; });
            assert.ok(vis, 'кнопка даты скрыта');
        });
        // Нижняя линия таблицы видна (её не режет край страницы) при разной высоте окна.
        for (const h of [760, 884, 960]) {
            await run('таблица до низа страницы, нижняя линия видна, окно ' + h + ' px', async () => {
                await page.setViewportSize({ width: 1553, height: h });
                await page.waitForTimeout(400);
                const r = await page.evaluate(() => {
                    const el = document.querySelector('#tab-rnp-planfact .pf-scroll'), b = el.getBoundingClientRect();
                    const hit = document.elementFromPoint(b.left + b.width / 2, b.bottom - 2);
                    return { gap: window.innerHeight - b.bottom, visible: !!hit && el.contains(hit), hit: hit ? hit.tagName + '.' + String(hit.className).slice(0, 40) + '#' + hit.id : null, top: b.top, bottom: b.bottom, vh: window.innerHeight };
                });
                assert.ok(r.visible, 'нижний край таблицы обрезан: ' + JSON.stringify(r));
                assert.ok(r.gap >= 8 && r.gap < 90, 'расстояние до низа окна ' + Math.round(r.gap) + ' px');
            });
        }
        await run('горизонтальной прокрутки нет: одна неделя на экране, всё помещается по ширине', async () => {
            const r = await page.evaluate(() => { const el = document.querySelector('#tab-rnp-planfact .pf-scroll'); return { sw: el.scrollWidth, cw: el.clientWidth, pager: document.querySelectorAll('#tab-rnp-planfact .pf-pg').length, vis: [...document.querySelectorAll('#tab-rnp-planfact .pf-sheet thead .pf-r2 .pf-date')].filter((e) => e.getBoundingClientRect().width > 0).length }; });
            assert.ok(r.sw <= r.cw + 1, 'прокрутка по горизонтали есть: ' + r.sw + ' > ' + r.cw);
            assert.ok(r.pager >= 4, 'переключатель недель не показан');
            assert.strictEqual(r.vis, 7, 'в таблице должна быть одна неделя (7 дней), а видно ' + r.vis);
        });
        await run('дубля заголовка «ПЛАН/ФАКТ» внутри таблицы нет', async () => {
            const fs = await page.evaluate(() => getComputedStyle(document.querySelector('#tab-rnp-planfact .pf-sheet .pf-title')).fontSize);
            assert.strictEqual(fs, '0px');
        });
        await run('каркас виден сразу: до прихода артикулов те же строки и колонки, цифры размыты', async () => {
            const r = await page.evaluate(() => {
                const host = document.getElementById('rnp-pfp-host');
                RnpPlanFact.open({ articles: [], daily: {}, plans: {}, monthKey: new Date().toISOString().slice(0, 7), host, loading: true });
                const t = host.querySelector('.pf-sheet');
                const cell = t.querySelector('tbody .pf-day');
                return { rows: t.querySelectorAll('tbody tr').length, head: t.querySelectorAll('thead tr').length, blur: getComputedStyle(cell).filter, skel: t.classList.contains('is-skel') };
            });
            assert.ok(r.rows >= 20 && r.head === 5 && r.skel, 'каркас не нарисован: ' + JSON.stringify(r));
            assert.match(r.blur, /blur/, 'цифры не размыты');
            await page.evaluate(() => RNP.openPlanFact());
            await page.waitForSelector('#tab-rnp-planfact .pf-sheet:not(.is-loading)', { timeout: 20000 });
            const blurAfter = await page.evaluate(() => getComputedStyle(document.querySelector('#tab-rnp-planfact .pf-sheet tbody .pf-day')).filter);
            assert.ok(!/blur/.test(blurAfter), 'после загрузки цифры всё ещё размыты');
        });
        await run('смена даты в шапке перерисовывает План/факт на выбранный месяц', async () => {
            const dates = () => page.evaluate(() => [...document.querySelectorAll('#tab-rnp-planfact .pf-sheet .pf-date')].map((e) => e.textContent.trim()).join(','));
            const before = await dates();
            const prev = await page.evaluate(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); const y = d.getFullYear(), m = d.getMonth(); const f = (x) => x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); return { from: f(new Date(y, m, 1)), to: f(new Date(y, m + 1, 0)) }; });
            await page.evaluate((r) => { pickerState.fromDate = new Date(r.from + 'T00:00:00'); pickerState.toDate = new Date(r.to + 'T00:00:00'); applyPicker(); }, prev);
            await page.waitForTimeout(1500);
            const after = await dates();
            assert.ok(await page.evaluate(() => document.querySelector('#tab-rnp-planfact.active') !== null), 'страница потерялась');
            assert.ok(before && after && before !== after, 'даты в таблице не сменились: ' + before.slice(0, 30) + ' → ' + after.slice(0, 30));
        });
        await run('ошибок скриптов нет', async () => {
            assert.deepStrictEqual(env.errors || [], []);
        });
    } finally {
        await browser.close();
        srv.close();
    }
    if (failed) { console.log('e2e План/факт: провалено ' + failed); process.exit(1); }
    console.log('e2e План/факт: все проверки прошли');
})();

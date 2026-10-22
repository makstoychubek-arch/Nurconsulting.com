/**
 * РНП на телефоне: смена артикула не оставляет экран приглушённым (в том числе в сохранённом снимке).
 * Запуск: npm run test:e2e. Путь к Chromium можно задать через PW_CHROMIUM.
 */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');

const day = (n) => new Date(Date.now() + 6 * 3600e3 - n * 86400e3).toISOString().slice(0, 10);
const ARTS = [{ nm: 1001, sa: 'костюм_оверсайз_бежевый', cat: 'К1' }, { nm: 1002, sa: 'b', cat: 'К1' }, { nm: 2001, sa: 'c', cat: 'К2' }];
const tables = {
    spaces: [{ id: 's0', user_id: ADMIN_ID, email: 'makstoychubek@gmail.com', status: 'active', tariff_plan: 'vip', is_super_admin: true, first_name: 'M', last_name: 'T', full_name: 'M T' }],
    cabinets: [{ id: CAB, name: 'T', wb_token_set: true, user_id: ADMIN_ID }],
    rnp_articles: ARTS.map((a, i) => ({ id: 'a' + i, cabinet_id: CAB, nm_id: a.nm, seller_article: a.sa, name: a.sa, category: a.cat, is_active: true, cost_price: 1000, photo_url: null, sort_order: i })),
    rnp_daily_data: ARTS.flatMap((a, i) => Array.from({ length: 14 }, (_, d) => ({ cabinet_id: CAB, nm_id: a.nm, date: day(d), orders_count: 10 + i, orders_sum: 50000, sales_count: 6, sales_sum: 30000, ad_spend: 500, impressions: 1000, clicks: 50 }))),
};

(async () => {
    const srv = await serve();
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    try {
        const env = await openApp(browser, 'http://127.0.0.1:' + srv.address().port, {
            phone: true, userId: ADMIN_ID, email: 'makstoychubek@gmail.com', latencyMs: 100, tables, rpcs: { is_super_admin: true },
            functions: { 'wb-proxy': async () => ({}) },
        });
        const { page } = env;
        await page.evaluate(() => showTab('rnp'));
        await page.waitForFunction(() => [...document.querySelectorAll('tr')].some((r) => /ЗАКАЗЫ/.test(r.textContent) && /\d/.test(r.textContent.replace('ЗАКАЗЫ', ''))), null, { timeout: 20000 });
        // два быстрых нажатия на артикулы подряд
        await page.evaluate(() => { RNP.pick(1002); RNP.pick(2001); });
        await page.waitForTimeout(2500);
        const swapped = await page.evaluate(() => document.querySelectorAll('.rnp-sheet-body--swap').length);
        assert.strictEqual(swapped, 0, 'после смены артикула экран не должен оставаться приглушённым');
        console.log('ok   телефон: после быстрой смены артикулов экран не приглушён');
        // приглушение не попадает в сохранённый снимок экрана
        await page.evaluate(() => { document.getElementById('rnp-sheet-body').classList.add('rnp-sheet-body--swap', 'nr-stale'); });
        await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
        const saved = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.indexOf('rnp_shell_') === 0 && k !== 'rnp_shell_cab').map((k) => localStorage.getItem(k)).join(''));
        assert.ok(saved.length > 1000, 'снимок экрана сохранён');
        assert.ok(!/rnp-sheet-body--swap|nr-stale/.test(saved), 'в сохранённом снимке нет классов приглушения');
        console.log('ok   телефон: снимок экрана не хранит приглушение');
        // жест почти по диагонали, но больше вправо: едет только вправо, вертикаль не плывёт
        const cdp = await page.context().newCDPSession(page);
        const pos = () => page.evaluate(() => { const b = document.getElementById('rnp-sheet-body'); return { l: b.scrollLeft, t: b.scrollTop, sw: b.scrollWidth - b.clientWidth, sh: b.scrollHeight - b.clientHeight }; });
        const before = await pos();
        assert.ok(before.sw > 50 && before.sh > 50, 'таблица прокручивается по обеим осям: ' + JSON.stringify(before));
        const box = await page.evaluate(() => { const r = document.getElementById('rnp-sheet-body').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
        const pt = (x, y) => [{ x, y }];
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(box.x + 100, box.y + 50) });
        for (let i = 1; i <= 12; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(box.x + 100 - i * 12, box.y + 50 - i * 5) });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForTimeout(600);
        const after = await pos();
        assert.ok(after.l > before.l + 20, 'по горизонтали проехало: ' + JSON.stringify(after));
        assert.ok(Math.abs(after.t - before.t) < 4, 'по вертикали не поехало при горизонтальном жесте: ' + JSON.stringify([before, after]));
        const restored = await page.evaluate(() => document.getElementById('rnp-sheet-body').style.overflowY);
        assert.strictEqual(restored, '', 'после жеста вертикальная прокрутка возвращена');
        console.log('ok   телефон: горизонтальный жест едет вбок и не трогает вертикаль (замок оси не ломает прокрутку)');
        const ov = await page.evaluate(() => getComputedStyle(document.getElementById('rnp-sheet-body')).overscrollBehaviorX);
        assert.strictEqual(ov, 'none', 'таблица не тянется за край (нет пустого угла): ' + ov);
        console.log('ok   телефон: таблицу нельзя оттянуть за край');
        const topRows = await page.evaluate(() => { const t = document.querySelector('.rnp-cal-month-row .rnp-th-month'); const tr = document.querySelector('.rnp-phone-trim'); return { mh: t ? t.getBoundingClientRect().height : 0, trim: tr ? getComputedStyle(tr).display : 'none' }; });
        assert.ok(topRows.mh < 2 && topRows.trim === 'none', 'на телефоне нет названия месяца и строки «Показаны последние 14 дн.»: ' + JSON.stringify(topRows));
        console.log('ok   телефон: названия месяца и строки «Показаны последние дни» нет, место свободно');
        // План/факт на телефоне: на весь экран, «Назад» слева сверху, столбец артикулов узкий даже с длинными названиями
        await page.evaluate(() => RNP.openPlanFact());
        await page.locator('.pf-sheet .pf-b').first().waitFor({ state: 'visible', timeout: 5000 });
        await page.waitForTimeout(600);
        const pf = await page.evaluate(() => {
            const d = document.querySelector('.rnp-plan-fact-dialog').getBoundingClientRect();
            const b = document.querySelector('.pf-sheet tbody td.pf-b').getBoundingClientRect();
            const back = document.querySelector('.pf-back').getBoundingClientRect();
            return { dl: d.left, dw: d.width, vw: innerWidth, bw: b.width, bl: back.left, bt: back.top, bv: back.width > 0, ov: getComputedStyle(document.querySelector('.pf-scroll')).overscrollBehaviorX };
        });
        assert.ok(Math.abs(pf.dl) < 1 && Math.abs(pf.dw - pf.vw) < 1, 'план/факт на весь экран: ' + JSON.stringify(pf));
        assert.ok(pf.bw <= 96, 'столбец артикулов узкий: ' + pf.bw);
        assert.ok(pf.bv && pf.bl < 16 && pf.bt < 24, '«Назад» на краю сверху: ' + JSON.stringify(pf));
        assert.strictEqual(pf.ov, 'none', 'таблицу плана нельзя оттянуть за край');
        await page.locator('.pf-back').click();
        assert.strictEqual(await page.evaluate(() => document.getElementById('rnp-plan-fact-overlay').classList.contains('is-open')), false, '«Назад» закрывает план/факт');
        console.log('ok   телефон: план/факт на весь экран, «Назад» на краю, узкий столбец артикулов');
        // Общий замок оси: любой прокручиваемый блок (например в РК) на телефоне едет по одной оси за жест
        await page.evaluate(() => {
            const d = document.createElement('div');
            d.id = 'axis-probe';
            d.style.cssText = 'position:fixed;left:10px;top:120px;width:300px;height:300px;overflow:auto;background:#eee;z-index:99999';
            d.innerHTML = '<div style="width:900px;height:900px"></div>';
            document.body.appendChild(d);
        });
        await page.waitForTimeout(100);
        const cdp2 = await page.context().newCDPSession(page);
        await cdp2.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 300 }] });
        for (let i = 1; i <= 12; i++) await cdp2.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200 - i * 12, y: 300 - i * 5 }] });
        await cdp2.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForTimeout(600);
        const pr = await page.evaluate(() => { const d = document.getElementById('axis-probe'); const r = { l: d.scrollLeft, t: d.scrollTop, oy: d.style.overflowY }; d.remove(); return r; });
        assert.ok(pr.l > 20 && pr.t < 4 && pr.oy === 'auto', 'любой блок едет по одной оси: ' + JSON.stringify(pr));
        console.log('ok   телефон: общий замок оси работает для любого прокручиваемого блока (РК и другие)');
        // Экран целиком не уезжает вбок: горизонтальный жест вне прокручиваемых блоков гасится (во всех разделах)
        await page.evaluate(() => {
            window.__tmPrevented = 0;
            window.addEventListener('touchmove', (e) => { if (e.defaultPrevented) window.__tmPrevented++; }, { passive: true });
            const f = document.createElement('div');
            f.id = 'free-probe'; f.style.cssText = 'position:fixed;left:0;top:200px;width:300px;height:200px;background:#ddd;z-index:99999';
            document.body.appendChild(f);
        });
        const cdp3 = await page.context().newCDPSession(page);
        await cdp3.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 300 }] });
        for (let i = 1; i <= 10; i++) await cdp3.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200 - i * 14, y: 300 - i }] });
        await cdp3.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        const prevented = await page.evaluate(() => { document.getElementById('free-probe').remove(); return window.__tmPrevented; });
        assert.ok(prevented > 0, 'горизонтальный жест вне прокручиваемых блоков гасится: ' + prevented);
        console.log('ok   телефон: экран целиком не уезжает вбок во всех разделах');
        // свёрнутая шапка: стрелка раскрывает панель с ответственным, статусом, ценой и заметками
        const vis = () => page.evaluate(() => { const e = document.querySelector('.rnp-ph2-panel .rnp-ph2-meta'); return !!e && e.getBoundingClientRect().height > 10; });
        assert.strictEqual(await vis(), false, 'панель закрыта');
        const tableMetaHidden = await page.evaluate(() => getComputedStyle(document.querySelector('.rnp-sheet-table .rnp-th-metric .rnp-head-meta')).display === 'none');
        assert.ok(tableMetaHidden, 'левый блок в таблице скрыт, он живёт в панели');
        await page.click('.rnp-ph2-bar');
        await page.waitForTimeout(200);
        assert.strictEqual(await vis(), true, 'панель открылась по нажатию');
        await page.click('.rnp-ph2-bar');
        await page.waitForTimeout(200);
        assert.strictEqual(await vis(), false, 'панель закрылась повторным нажатием');
        console.log('ok   телефон: свёрнутая шапка открывает панель с ответственным, статусом и ценой');
        assert.deepStrictEqual(env.errors, [], 'ошибок скриптов нет: ' + env.errors.join('; '));
        console.log('e2e РНП на телефоне: все проверки прошли');
    } catch (e) {
        console.error('FAIL', e.message);
        process.exitCode = 1;
    } finally {
        await browser.close();
        srv.close();
    }
})();

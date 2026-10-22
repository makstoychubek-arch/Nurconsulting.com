/**
 * РНП на телефоне: смена артикула не оставляет экран приглушённым (в том числе в сохранённом снимке).
 * Запуск: npm run test:e2e. Путь к Chromium можно задать через PW_CHROMIUM.
 */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');

const day = (n) => new Date(Date.now() + 6 * 3600e3 - n * 86400e3).toISOString().slice(0, 10);
const ARTS = [{ nm: 1001, sa: 'a', cat: 'К1' }, { nm: 1002, sa: 'b', cat: 'К1' }, { nm: 2001, sa: 'c', cat: 'К2' }];
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
        // свёрнутая шапка: стрелка раскрывает панель с ответственным, статусом, ценой и заметками
        const vis = () => page.evaluate(() => { const e = document.querySelector('.rnp-ph2-panel .rnp-head-meta'); return !!e && e.getBoundingClientRect().height > 10; });
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

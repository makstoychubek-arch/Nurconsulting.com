/**
 * Продвижение для Ozon: переключатель WB | Ozon | Вместе виден на странице, у Ozon свои кампании рекламного кабинета с итогами и ДРР,
 * у WB прежний экран. Запуск: node e2e/ads-ozon.e2e.js.
 */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');

const day = (n) => new Date(Date.now() + 6 * 3600e3 - n * 86400e3).toISOString().slice(0, 10);
const tables = {
    spaces: [{ id: 's0', user_id: ADMIN_ID, email: 'makstoychubek@gmail.com', status: 'active', tariff_plan: 'vip', is_super_admin: true, first_name: 'M', last_name: 'T', full_name: 'M T' }],
    cabinets: [{ id: CAB, name: 'Zevina 1', wb_token_set: true, user_id: ADMIN_ID }],
    ozon_ads_daily: [
        ...Array.from({ length: 3 }, (_, d) => ({ cabinet_id: CAB, d: day(d), campaign_id: '111', title: 'Продвижение в поиске — свитера', impressions: 1000, clicks: 50, spend: 300, orders: 2, orders_sum: 6000 })),
        ...Array.from({ length: 3 }, (_, d) => ({ cabinet_id: CAB, d: day(d), campaign_id: '222', title: 'Полки', impressions: 400, clicks: 10, spend: 100, orders: 0, orders_sum: 0 })),
    ],
    ozon_sync_state: [{ cabinet_id: CAB, part: 'ads', last_ok_at: new Date().toISOString() }],
};

(async () => {
    const srv = await serve();
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    try {
        const env = await openApp(browser, 'http://127.0.0.1:' + srv.address().port, { userId: ADMIN_ID, email: 'makstoychubek@gmail.com', latencyMs: 20, tables, rpcs: { is_super_admin: true }, functions: {} });
        const { page } = env;
        await page.evaluate(() => { const s = document.getElementById('nr-splash'); if (s) s.remove(); try { localStorage.setItem('nr_mp', 'wb'); } catch (e) {} showTab('advertising'); });
        await page.waitForTimeout(800);
        const sw = await page.evaluate(() => { const b = document.getElementById('nr-mp'); return b ? getComputedStyle(b).display : null; });
        assert.ok(sw && sw !== 'none', 'переключатель WB | Ozon | Вместе виден на странице Продвижения: ' + sw);
        assert.ok(await page.evaluate(() => getComputedStyle(document.getElementById('adv-view-ads')).display !== 'none'), 'у WB прежний экран кампаний');
        await page.evaluate(() => NrMp.set('ozon'));
        await page.waitForFunction(() => document.querySelectorAll('#adv-view-ozon tbody tr').length >= 2, null, { timeout: 8000 });
        const r = await page.evaluate(() => ({
            wbHidden: getComputedStyle(document.getElementById('adv-view-ads')).display === 'none',
            rows: [...document.querySelectorAll('#adv-view-ozon tbody tr')].map((tr) => tr.children[0].innerText.replace(/\s+/g, ' ').trim().split(' ')[0] + '|' + tr.children[1].innerText.replace(/\s/g, '')),
            kpi: [...document.querySelectorAll('#adv-view-ozon .aoz-k .aoz-card')].map((c) => c.innerText.replace(/\s+/g, ' ').trim()),
            title: document.querySelector('#adv-view-ozon .aoz-h b').textContent,
        }));
        assert.ok(r.wbHidden, 'у Ozon экран WB скрыт');
        assert.deepStrictEqual(r.rows, ['Продвижение|900', 'Полки|300'], 'кампании по убыванию расхода: ' + JSON.stringify(r.rows));
        assert.ok(r.kpi.some((x) => /^РАСХОД 1.?200 ₽/i.test(x) || /Расход.*1.?200/.test(x)), 'итог расхода 1 200: ' + JSON.stringify(r.kpi));
        assert.ok(r.kpi.some((x) => /ДРР 6,7%/i.test(x)), 'ДРР = 1 200 / 18 000 = 6,7%: ' + JSON.stringify(r.kpi));
        console.log('ok   Продвижение Ozon: кампании, итоги и ДРР из рекламного кабинета Ozon');
        await page.evaluate(() => NrMp.set('wb')); await page.waitForTimeout(500);
        assert.ok(await page.evaluate(() => getComputedStyle(document.getElementById('adv-view-ozon')).display === 'none' && getComputedStyle(document.getElementById('adv-view-ads')).display !== 'none'), 'WB возвращает прежний экран');
        console.log('ok   Продвижение: переключение WB и Ozon туда и обратно');
        await page.setViewportSize({ width: 390, height: 844 });
        await page.evaluate(() => NrMp.set('ozon')); await page.waitForTimeout(700);
        const ph = await page.evaluate(() => ({ scrollX: document.documentElement.scrollWidth > innerWidth + 1, sw: getComputedStyle(document.getElementById('nr-mp')).display }));
        assert.ok(!ph.scrollX && ph.sw !== 'none', 'на телефоне нет горизонтальной прокрутки страницы, переключатель на месте: ' + JSON.stringify(ph));
        console.log('ok   Продвижение Ozon на телефоне помещается в экран');
        assert.deepStrictEqual(env.errors, [], 'ошибок скриптов нет: ' + env.errors.join('; '));
    } catch (e) { console.error('FAIL', e.message); process.exitCode = 1; } finally { await browser.close(); srv.close(); }
})();

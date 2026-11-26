/**
 * РНП (Ozon и WB): закреплённые слева ячейки (название и график) непрозрачные в любых строках, в том числе в подстроках «Штрафы», «Прочие удержания»
 * (владелец, 23 ноября 2026: цифры, уехавшие под название при прокрутке вбок, просвечивали поверх подписей). Запуск: node e2e/rnp-sticky-opaque.e2e.js
 */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');
const day = (n) => new Date(Date.now() + 6 * 3600e3 - n * 86400e3).toISOString().slice(0, 10);
const NM = 9993927562;
const tables = { spaces: [{ id: 's0', user_id: ADMIN_ID, email: 'makstoychubek@gmail.com', status: 'active', tariff_plan: 'vip', is_super_admin: true, first_name: 'M', last_name: 'T', full_name: 'M T' }], cabinets: [{ id: CAB, name: 'Z', wb_token_set: true, ozon_client_id: '123', ozon_api_key_set: true, user_id: ADMIN_ID }] };
const art = { id: 'ozon-a', name: 'костюм_оверсайз_бежевый', nm_id: NM, category: 'К', is_active: true, cost_price: 100, sort_order: 0, manual_data: {}, other_costs_unit: 0, logistics_unit: 0, cabinet_id: CAB };
const fin = Array.from({ length: 16 }, (_, d) => ({ cabinet_id: CAB, nm_id: NM, date: day(d), orders_count: 10 + d, orders_sum: 10000 + d * 900, sales_count: 10, sales_sum: 10000, realization: 10000 + d * 500, commission_pct: 20, to_transfer: 7800, delivery_sum: 1500, storage_sum: 10, penalty_sum: 50 + d * 3, deduction_sum: 300, ad_spend: 200, ad_charged: 250, transit_count: 7, ded_prem: 100 + d * 10, ded_bonus: 400, ded_move: 50, ded_rest: -250, pen_dim: 20, pen_acc: 10, pen_other: 9 }));
(async () => {
    const srv = await serve();
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    let failed = 0;
    try {
        const env = await openApp(browser, 'http://127.0.0.1:' + srv.address().port, { userId: ADMIN_ID, email: 'makstoychubek@gmail.com', latencyMs: 20, tables, rpcs: { is_super_admin: true, ozon_rnp_articles: [art], ozon_finance_daily: fin, ozon_stock_rows: [], ozon_orders_daily: [] }, functions: { 'wb-proxy': async () => ({}) } });
        const { page } = env;
        await page.setViewportSize({ width: 1500, height: 1500 });
        await page.evaluate(() => { const s = document.getElementById('nr-splash'); if (s) s.remove(); NrMp.set('ozon'); showTab('rnp'); });
        await page.waitForFunction(() => [...document.querySelectorAll('#tab-rnp tr')].some((r) => /^Реализация/.test((r.children[0] || {}).innerText || '')), null, { timeout: 20000 });
        await page.evaluate(() => RNP.pick('general')); await page.waitForTimeout(1200);
        await page.evaluate(() => { RNP.toggleSplit('penalty_sum'); RNP.toggleSplit('other_net_sum'); }); await page.waitForTimeout(1000);
        for (const theme of ['ios', 'neon']) {
            await page.evaluate((t) => applyTheme(t), theme); await page.waitForTimeout(400);
            const r = await page.evaluate(() => {
                const a = (c) => { const m = c.match(/[\d.]+/g).map(Number); return m.length > 3 ? m[3] : (/^color\(/.test(c) && m.length > 3 ? m[3] : 1); };
                const bad = [];
                const rows = [...document.querySelectorAll('#tab-rnp table tr.rnp-row-split-sub')];
                rows.forEach((tr) => [...tr.querySelectorAll('td.rnp-metric-col, td.rnp-spark-col')].forEach((td) => { const s = getComputedStyle(td); let o = 1, e = td; while (e && e !== document.body) { o *= parseFloat(getComputedStyle(e).opacity); e = e.parentElement; } if (o < 0.99 || a(s.backgroundColor) < 0.99) bad.push((tr.children[0].innerText || '').trim().slice(0, 20) + ' ' + td.className.split(' ')[0] + ' opacity ' + o.toFixed(2) + ' bg ' + s.backgroundColor); }));
                return { rows: rows.length, bad };
            });
            try { assert.ok(r.rows >= 6 && r.bad.length === 0, JSON.stringify(r)); console.log('ok   тема ' + theme + ': ' + r.rows + ' подстрок, закреплённые ячейки непрозрачные'); }
            catch (e) { failed++; console.log('FAIL тема ' + theme + ': ' + e.message.slice(0, 300)); }
        }
        try {
            const f = await page.evaluate(() => { const g = (re) => { const tr = [...document.querySelectorAll('#tab-rnp table tr')].find((r) => re.test((r.children[0] || {}).innerText || '')); const td = tr && tr.querySelector('td.rnp-day-col'); const s = getComputedStyle(td); return { fs: s.fontSize, fw: s.fontWeight, ff: s.fontFamily }; }; return { sub: g(/Premium/), norm: g(/^Себестоимость/) }; });
            assert.deepStrictEqual(f.sub, f.norm, 'цифры подстрок как в остальных строках: ' + JSON.stringify(f));
            console.log('ok   шрифт цифр в подстроках как в остальной таблице РНП (' + f.norm.fs + ', вес ' + f.norm.fw + ')');
        } catch (e) { failed++; console.log('FAIL шрифт подстрок: ' + e.message.slice(0, 250)); }
        try { assert.deepStrictEqual(env.errors || [], []); console.log('ok   ошибок скриптов нет'); } catch (e) { failed++; console.log('FAIL ошибки скриптов'); }
    } finally { await browser.close(); srv.close(); }
    if (failed) { console.log('e2e закреплённых ячеек РНП: провалено ' + failed); process.exit(1); }
    console.log('e2e закреплённых ячеек РНП: все проверки прошли');
})();

/** РНП: «Заметки по дням» при смене кабинета показывают заметки нового кабинета, а не прежнего. */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');

const CAB2 = 'cccccccc-0000-0000-0000-000000000002';
const day = (n) => new Date(Date.now() + 6 * 3600e3 - n * 86400e3).toISOString().slice(0, 10);
const art = (cab, nm, i) => ({ id: cab.slice(-2) + i, cabinet_id: cab, nm_id: nm, seller_article: 'a' + nm, name: 'a' + nm, category: 'К1', is_active: true, cost_price: 1000, photo_url: null, sort_order: i });
const daily = (cab, nm) => Array.from({ length: 14 }, (_, d) => ({ cabinet_id: cab, nm_id: nm, date: day(d), orders_count: 10, orders_sum: 50000, sales_count: 6, sales_sum: 30000, ad_spend: 500, impressions: 1000, clicks: 50 }));
const tables = {
    spaces: [{ id: 's0', user_id: ADMIN_ID, email: 'makstoychubek@gmail.com', status: 'active', tariff_plan: 'vip', is_super_admin: true, first_name: 'M', last_name: 'T', full_name: 'M T' }],
    cabinets: [{ id: CAB, name: 'A', wb_token_set: true, user_id: ADMIN_ID }, { id: CAB2, name: 'B', wb_token_set: true, user_id: ADMIN_ID }],
    rnp_articles: [art(CAB, 1001, 0), art(CAB2, 1001, 0)],
    rnp_daily_data: [...daily(CAB, 1001), ...daily(CAB2, 1001)],
    rnp_date_notes: [
        { id: 1, cabinet_id: CAB, nm_id: 1001, note_date: day(1), note: 'ЗАМЕТКА-А', author: 'x', created_at: new Date().toISOString() },
        { id: 2, cabinet_id: CAB2, nm_id: 1001, note_date: day(2), note: 'ЗАМЕТКА-Б', author: 'x', created_at: new Date().toISOString() },
    ],
};

(async () => {
    const srv = await serve();
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    try {
        const env = await openApp(browser, 'http://127.0.0.1:' + srv.address().port, {
            userId: ADMIN_ID, email: 'makstoychubek@gmail.com', latencyMs: 200, tables, rpcs: { is_super_admin: true }, functions: { 'wb-proxy': async () => ({}) },
        });
        const { page } = env;
        // сервер-заглушка не фильтрует по кабинету, поэтому фильтруем здесь, как это делает база
        for (const t of ['rnp_date_notes', 'rnp_articles', 'rnp_daily_data']) {
            await page.route(new RegExp('/rest/v1/' + t), async (r) => {
                const u = new URL(r.request().url());
                const m = /^eq\.(.+)$/.exec(u.searchParams.get('cabinet_id') || '');
                const rows = (tables[t] || []).filter((x) => !m || x.cabinet_id === m[1]);
                await new Promise((x) => setTimeout(x, t === 'rnp_date_notes' ? 1200 : 100)); await r.fulfill({ json: rows, headers: { 'content-range': '0-' + Math.max(0, rows.length - 1) + '/' + rows.length } });
            });
        }
        await page.evaluate(() => { try { localStorage.setItem('rnp_notes_visible', '1'); } catch (e) {} });
        await page.evaluate(() => showTab('rnp'));
        await page.waitForFunction(() => window.RNP && document.querySelector('.rnp-sheet-tab'), null, { timeout: 15000 });
        const notes = () => page.evaluate(() => [...document.querySelectorAll('.rnp-note-input.has-note')].map((b) => b.dataset.date + ':' + (b.closest('th').getAttribute('title') || b.title || '')));
        await page.evaluate(() => RNP.pick(1001));
        await page.waitForTimeout(1500);
        const a = await notes();
        console.log('кабинет A:', JSON.stringify(a));
        await page.evaluate((id) => { const s = document.getElementById('cabinet-select-header'); s.value = id; onCabinetChange(); }, CAB2);
        await page.waitForTimeout(3000);
        const b = await notes();
        console.log('кабинет B:', JSON.stringify(b));
        await page.evaluate((id) => { const s = document.getElementById('cabinet-select-header'); s.value = id; onCabinetChange(); }, CAB);
        await page.waitForTimeout(3000);
        console.log('снова A:', JSON.stringify(await notes()));
        assert.notDeepStrictEqual(b, a, 'после смены кабинета заметки те же');
        assert.ok(b.length >= 1, 'у кабинета Б есть заметка');
        console.log('ok   смена кабинета меняет заметки по дням');
    } catch (e) { console.error('FAIL', e.message); process.exitCode = 1; }
    finally { await browser.close(); srv.close(); }
})();

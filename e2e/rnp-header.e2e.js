/**
 * РНП: шапка артикула (вариант C): метрики литраж, остаток, хранение, логистика; без цены и долларов;
 * остатки «В стоке / В пути / Общий» чёрно-белые. Тариф WB приходит в фоне и подставляется без перерисовки шапки.
 * Запуск: npm run test:e2e. Путь к Chromium можно задать через PW_CHROMIUM. SHOT=путь.png сохраняет скриншот.
 */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');

const day = (n) => new Date(Date.now() + 6 * 3600e3 - n * 86400e3).toISOString().slice(0, 10);
const NM = 296556350;
const tables = {
    spaces: [{ id: 's0', user_id: ADMIN_ID, email: 'makstoychubek@gmail.com', status: 'active', tariff_plan: 'vip', is_super_admin: true, first_name: 'M', last_name: 'T', full_name: 'M T' }],
    cabinets: [{ id: CAB, name: 'T', wb_token_set: true, user_id: ADMIN_ID }],
    rnp_articles: [
        { id: 'a0', cabinet_id: CAB, nm_id: NM, seller_article: 'костюм_оверсайз_бежевый', name: 'костюм_оверсайз_бежевый', category: 'К1', is_active: true, cost_price: 1300, photo_url: null, sort_order: 0, dim_l_cm: '45', dim_w_cm: '35', dim_h_cm: '4' },
        { id: 'a1', cabinet_id: CAB, nm_id: 1002, seller_article: 'без_габаритов', name: 'без_габаритов', category: 'К1', is_active: true, cost_price: 1000, photo_url: null, sort_order: 1 },
    ],
    rnp_daily_data: [NM, 1002].flatMap((nm) => Array.from({ length: 10 }, (_, d) => ({ cabinet_id: CAB, nm_id: nm, date: day(d), orders_count: 5, orders_sum: 25000, sales_count: 3, sales_sum: 15000, ad_spend: 300, impressions: 500, clicks: 20 }))),
    wb_stocks: [
        ...['40', '42', '44', '46', '48'].map((sz, i) => ({ cabinet_id: CAB, nm_id: NM, tech_size: sz, barcode: 'b' + sz, quantity: [17, 17, 9, 10, 8][i], in_way_to_client: [1, 0, 3, 4, 2][i], in_way_from_client: 0, warehouse_name: 'Склад WB РФ', stock_scheme: 'fbo', synced_at: day(0) })),
        { cabinet_id: CAB, nm_id: 1002, tech_size: '42', barcode: 'c42', quantity: 5, in_way_to_client: 0, in_way_from_client: 0, warehouse_name: 'Склад WB РФ', stock_scheme: 'fbo', synced_at: day(0) },
    ],
};
// тариф WB в сомах: 78,2 ₽ и 23,8 ₽ за литр, курс 1,0535
const TARIFF = { ok: true, date: day(0), warehouse: 'Склад WB РФ', coef_pct: 170, currency: 'KGS', rate: 1.0535, delivery_base: 82.389, delivery_liter: 25.073, storage_base: 0.126, storage_liter: 0.126 };

async function open(browser, base, tariff, phone) {
    const env = await openApp(browser, base, {
        userId: ADMIN_ID, email: 'makstoychubek@gmail.com', latencyMs: 40, tables, rpcs: { is_super_admin: true },
        functions: { 'wb-proxy': async () => ({}), 'wb-tariffs': async () => { await new Promise((r) => setTimeout(r, 900)); return tariff; } },
    });
    const { page } = env;
    if (phone) await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { try { localStorage.removeItem('nr_wb_tariff_v1'); } catch (_) {} });
    await page.evaluate(() => { const s = document.getElementById('nr-splash'); if (s) s.remove(); });
    await page.evaluate(() => showTab('rnp'));
    await page.waitForFunction(() => /ЗАКАЗЫ/.test(document.body.textContent) && window.RNP && typeof RNP.pick === 'function', null, { timeout: 20000 });
    await page.waitForTimeout(1500);
    await page.evaluate((nm) => RNP.pick(nm), NM);
    await page.waitForSelector('.rnp-mx[data-nm="' + NM + '"]', { timeout: 20000 });
    return env;
}

const cell = (page, key) => page.evaluate((k) => { const b = document.querySelector('.rnp-mx[data-nm] [data-mx="' + k + '"]'); return b ? b.textContent.trim() : null; }, key);

(async () => {
    const srv = await serve();
    const base = 'http://127.0.0.1:' + srv.address().port;
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    let failed = 0;
    const run = async (name, fn) => {
        try { await fn(); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + String(e.message || e).split('\n')[0]); }
    };
    try {
        const env = await open(browser, base, TARIFF, false);
        const { page } = env;
        await run('литраж и остаток считаются по габаритам карточки (35×45×4 = 6,3 л; 61 шт = 384 л)', async () => {
            assert.match(await cell(page, 'lit'), /^6,3/);
            assert.match(await cell(page, 'stk'), /^384/);
        });
        await run('тариф приходит в фоне: хранение и логистика подставляются без перерисовки шапки', async () => {
            await page.evaluate(() => { window.__mxNode = document.querySelector('.rnp-mx[data-nm]'); });
            await page.waitForFunction(() => /^215/.test((document.querySelector('.rnp-mx[data-nm] [data-mx="log"]') || {}).textContent || ''), null, { timeout: 8000 });
            assert.match(await cell(page, 'day'), /^48/);
            assert.ok(await page.evaluate(() => window.__mxNode === document.querySelector('.rnp-mx[data-nm]')), 'блок метрик не пересоздан');
        });
        await run('цены и доллары в шапке убраны', async () => {
            const n = await page.evaluate(() => document.querySelectorAll('.rnp-gs-money-val, .rnp-gs-usd-val, .rnp-gs-money-lbl, .rnp-gs-usd-lbl').length);
            assert.strictEqual(n, 0);
        });
        await run('в таблице остатков «В стоке» одной строкой, «На складе» нет', async () => {
            const r = await page.evaluate(() => {
                const t = document.querySelector('.rnp-stock-table');
                const lbl = [...t.querySelectorAll('.rnp-stock-label')].map((x) => x.textContent.trim());
                const el = [...t.querySelectorAll('.rnp-stock-label')].find((x) => /В стоке/.test(x.textContent));
                return { lbl, oneLine: el ? el.getBoundingClientRect().height < 24 : false };
            });
            assert.ok(r.lbl.includes('В стоке') && !r.lbl.includes('На складе'), r.lbl.join('|'));
            assert.ok(r.oneLine, 'подпись не переносится');
        });
        await run('остатки чёрно-белые: фон ячеек прозрачный, цвет текста не красный и не жёлтый', async () => {
            const bad = await page.evaluate(() => {
                const out = [];
                document.querySelectorAll('.rnp-stock-table td').forEach((td) => {
                    const cs = getComputedStyle(td);
                    const bg = cs.backgroundColor.replace(/\s/g, '');
                    if (bg !== 'rgba(0,0,0,0)' && bg !== 'transparent') out.push('bg ' + bg);
                    const m = cs.color.match(/\d+/g).map(Number);
                    if (Math.max(m[0], m[1], m[2]) - Math.min(m[0], m[1], m[2]) > 40) out.push('color ' + cs.color);
                });
                return [...new Set(out)];
            });
            assert.deepStrictEqual(bad, []);
        });
        await run('фото слева по высоте равно блоку и держит пропорцию 3:4', async () => {
            const r = await page.evaluate(() => {
                const info = document.querySelector('.rnp-head-wide-info .rnp-layout-info');
                const ph = info && info.querySelector('.rnp-gs-photo');
                const meta = info && info.querySelector('.rnp-layout-info-meta');
                if (!ph || !meta) return null;
                const a = ph.getBoundingClientRect(), b = meta.getBoundingClientRect();
                return { ph: a.height, meta: b.height, ratio: a.width / a.height };
            });
            assert.ok(r, 'нет блока фото');
            assert.ok(r.ph >= r.meta - 1, 'фото ' + Math.round(r.ph) + ' px, блок ' + Math.round(r.meta) + ' px');
            assert.ok(Math.abs(r.ratio - 0.75) < 0.04, 'пропорция ' + r.ratio.toFixed(2));
        });
        if (process.env.SHOT) { await page.waitForTimeout(300); await page.screenshot({ path: process.env.SHOT, clip: { x: 0, y: 0, width: 1440, height: 420 } }); }
        await run('ошибок скриптов нет', async () => assert.deepStrictEqual(env.errors, [], env.errors.join('; ')));
        await env.ctx.close();

        // без тарифа и без габаритов: пустые метрики, не нули и не NaN
        const env2 = await open(browser, base, { ok: false, error: 'WB_UNAVAILABLE' }, false);
        await run('нет тарифа WB: литраж есть, хранение и логистика показывают прочерк', async () => {
            assert.match(await env2.page.evaluate(() => document.querySelector('.rnp-mx [data-mx="lit"]').textContent), /^6,3/);
            await env2.page.waitForTimeout(1500);
            assert.match(await cell(env2.page, 'day'), /^—/);
            assert.match(await cell(env2.page, 'log'), /^—/);
            assert.ok(!/NaN|undefined/.test(await env2.page.evaluate(() => document.querySelector('.rnp-mx').textContent)));
        });
        await env2.ctx.close();
    } finally {
        await browser.close();
        srv.close();
    }
    if (failed) { console.log(failed + ' проверок не прошли'); process.exit(1); }
    console.log('e2e шапки артикула РНП: все проверки прошли');
})();

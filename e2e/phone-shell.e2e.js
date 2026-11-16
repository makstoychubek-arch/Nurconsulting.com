/**
 * Телефон (390): круглая аватарка кабинета, название страницы и круглый календарь с датой в одном ряду под строкой состояния,
 * внизу меню разделов с подписями. Запуск: node e2e/phone-shell.e2e.js.
 */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');

(async () => {
    const srv = await serve();
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    try {
        const tables = { spaces: [{ id: 's0', user_id: ADMIN_ID, email: 'makstoychubek@gmail.com', status: 'active', tariff_plan: 'vip', is_super_admin: true, first_name: 'M', last_name: 'T', full_name: 'M T' }], cabinets: [{ id: CAB, name: 'Zevina 1', wb_token_set: true, user_id: ADMIN_ID }] };
        const env = await openApp(browser, 'http://127.0.0.1:' + srv.address().port, { userId: ADMIN_ID, email: 'makstoychubek@gmail.com', latencyMs: 20, tables, rpcs: { is_super_admin: true }, functions: {} });
        const { page } = env;
        await page.setViewportSize({ width: 390, height: 844 });
        await page.evaluate(() => { const s = document.getElementById('nr-splash'); if (s) s.remove(); });
        await page.waitForTimeout(1500);
        const m = await page.evaluate(() => {
            const r = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, w: b.width, h: b.height, b: b.bottom }; };
            const av = document.getElementById('cabinet-picker-btn'), ttl = document.getElementById('page-title'), dt = document.getElementById('header-date-chip-wrap'), nav = document.getElementById('nr-bottom-nav');
            const labels = [...nav.querySelectorAll('.bn-lbl')].map((e) => e.textContent.trim());
            return { av: r(av), avRound: getComputedStyle(av).borderRadius, ttl: r(ttl), dt: r(dt), nav: r(nav), navShown: getComputedStyle(nav).display !== 'none', labels, scrollX: document.documentElement.scrollWidth > innerWidth + 1, vw: innerWidth, hdr: r(document.querySelector('header.app-header')) };
        });
        assert.ok(m.navShown && m.nav.h > 40 && m.nav.b <= 845, 'нижнее меню видно: ' + JSON.stringify(m.nav));
        assert.deepStrictEqual(m.labels, ['Дашборд', 'РНП', 'Продвижение', 'Логистика', 'Ещё'], 'подписи разделов: ' + m.labels.join(', '));
        assert.ok(m.av.w <= 40 && Math.abs(m.av.w - m.av.h) < 1 && /50%|18px|9999|[0-9]+px/.test(m.avRound), 'аватарка круглая: ' + JSON.stringify(m.av));
        assert.ok(Math.abs(m.av.t + m.av.h / 2 - (m.ttl.t + m.ttl.h / 2)) < 10 && Math.abs(m.av.t + m.av.h / 2 - (m.dt.t + m.dt.h / 2)) < 12, 'аватарка, название и календарь в одном ряду: ' + JSON.stringify([m.av, m.ttl, m.dt]));
        assert.ok(m.av.l < m.ttl.l && m.ttl.l < m.dt.l && m.dt.l + m.dt.w <= m.vw + 1, 'порядок слева направо: аватарка, название, календарь, ничего не вылезает за экран');
        assert.ok(m.dt.w < 110, 'дата маленькая: ' + m.dt.w);
        assert.ok(!m.scrollX, 'нет горизонтальной прокрутки страницы');
        const cut = await page.evaluate(() => [...document.querySelectorAll('#nr-bottom-nav .bn-lbl')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent));
        assert.deepStrictEqual(cut, [], 'подписи нижнего меню не обрезаются: ' + cut.join(', '));
        await page.evaluate(() => showTab('rnp')); await page.waitForTimeout(800);
        const mp = await page.evaluate(() => { const b = document.getElementById('nr-mp'), h = document.querySelector('header.app-header'), r = b.getBoundingClientRect(), a = document.getElementById('cabinet-picker-btn').getBoundingClientRect(); return { inHeader: h.contains(b), disp: getComputedStyle(b).display, h: r.height, w: r.width, sameRow: Math.abs((r.top + r.height / 2) - (a.top + a.height / 2)) < 14, vw: innerWidth, right: r.right }; });
        assert.ok(mp.inHeader && mp.disp !== 'none' && mp.disp !== 'contents' && mp.h <= 30 && mp.w < 120 && mp.sameRow && mp.right <= mp.vw, 'WB | Ozon маленьким тумблером в верхнем ряду шапки: ' + JSON.stringify(mp));
        await page.evaluate(() => showTab('dashboard')); await page.waitForTimeout(400);
        await page.click('#cabinet-picker-btn'); await page.waitForTimeout(500);
        const dd = await page.evaluate(() => { const d = document.querySelector('#cabinet-dropdown-menu .cabinet-dropdown-item'); return d ? { shown: d.getBoundingClientRect().width > 100, text: d.textContent.trim() } : null; });
        assert.ok(dd && dd.shown, 'по нажатию на аватарку выходит список кабинетов: ' + JSON.stringify(dd));
        await page.keyboard.press('Escape');
        console.log('ok   телефон: аватарка кабинета, название, круглый календарь, нижнее меню с подписями');
        assert.deepStrictEqual(env.errors, [], 'ошибок скриптов нет: ' + env.errors.join('; '));
    } catch (e) { console.error('FAIL', e.message); process.exitCode = 1; } finally { await browser.close(); srv.close(); }
})();

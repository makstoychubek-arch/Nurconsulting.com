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
        const cdp = await page.context().newCDPSession(page);
        try { await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 59, bottom: 34, left: 0, right: 0 } }); } catch (e) { /* без эмуляции проверка отступа пропускается ниже */ }
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
        const clear = await page.evaluate(() => { const h = document.querySelector('header.app-header').getBoundingClientRect(), av = document.getElementById('cabinet-picker-btn').getBoundingClientRect(), mc = document.querySelector('.main-content'); const first = [...mc.children].find((e) => getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0); return { avTop: av.top, hdrBottom: h.bottom, contentTop: first ? first.getBoundingClientRect().top : 0 }; });
        assert.ok(clear.avTop >= 95, 'содержимое шапки начинается ниже зоны, которую iOS затушёвывает сверху (>= 95px при безопасной зоне 59): ' + JSON.stringify(clear));
        assert.ok(clear.contentTop >= clear.hdrBottom - 1, 'страница начинается под шапкой, не заезжает под неё: ' + JSON.stringify(clear));
        const cut = await page.evaluate(() => [...document.querySelectorAll('#nr-bottom-nav .bn-lbl')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent));
        assert.deepStrictEqual(cut, [], 'подписи нижнего меню не обрезаются: ' + cut.join(', '));
        for (const tab of ['dashboard', 'rnp', 'advertising', 'goods-groups', 'settings']) {
            await page.evaluate((n) => showTab(n), tab); await page.waitForTimeout(500);
            const pb = await page.evaluate(() => ({ pad: Math.max(parseFloat(getComputedStyle(document.querySelector('.main-content')).paddingBottom), (document.querySelector('#tab-rnp.active .rnp-sheet-body') ? parseFloat(getComputedStyle(document.querySelector('#tab-rnp.active .rnp-sheet-body')).paddingBottom) : 0)), nav: document.getElementById('nr-bottom-nav').getBoundingClientRect().height }));
            assert.ok(pb.pad >= pb.nav - 2, 'внизу страницы «' + tab + '» оставлено место под нижнее меню, последние строки не прячутся: ' + JSON.stringify(pb));
        }
        await page.evaluate(() => showTab('rnp')); await page.waitForTimeout(800);
        const mp = await page.evaluate(() => { const b = document.getElementById('nr-mp'), h = document.querySelector('header.app-header'), r = b.getBoundingClientRect(), a = document.getElementById('cabinet-picker-btn').getBoundingClientRect(); return { inHeader: h.contains(b), disp: getComputedStyle(b).display, h: r.height, w: r.width, sameRow: Math.abs((r.top + r.height / 2) - (a.top + a.height / 2)) < 14, vw: innerWidth, right: r.right }; });
        assert.ok(mp.inHeader && mp.disp !== 'none' && mp.disp !== 'contents' && mp.h === 34 && mp.w === 34 && mp.sameRow && mp.right <= mp.vw, 'площадка круглой кнопкой 34px в верхнем ряду: ' + JSON.stringify(mp));
        const cal = await page.evaluate(() => { const c = document.getElementById('header-date-chip-wrap').getBoundingClientRect(), m = document.getElementById('nr-mp').getBoundingClientRect(); return { w: c.width, h: c.height, sameSize: Math.abs(c.width - m.width) < 1 && Math.abs(c.height - m.height) < 1, sub: (document.getElementById('nr-subdate') || {}).textContent }; });
        assert.ok(cal.sameSize && cal.w === 34 && cal.sub && cal.sub.length > 3, 'календарь той же круглой формы без текста даты, дата под названием: ' + JSON.stringify(cal));
        await page.click('#nr-mp'); await page.waitForTimeout(300);
        const pop = await page.evaluate(() => { const d = document.querySelector('.nr-mp-dim'), b = [...document.querySelectorAll('#nr-mp button')].map((x) => x.getBoundingClientRect().height > 20); return { dim: d.classList.contains('on'), blur: getComputedStyle(d).backdropFilter, shown: b }; });
        assert.ok(pop.dim && /blur/.test(pop.blur) && pop.shown.length === 3 && pop.shown.every(Boolean), 'по нажатию на площадку страница темнеет и размыта, выходит список из трёх: ' + JSON.stringify(pop));
        await page.click('#nr-mp button[data-mp="ozon"]'); await page.waitForTimeout(300);
        assert.strictEqual(await page.evaluate(() => NrMp.get() + document.querySelector('.nr-mp-dim').classList.contains('on')), 'ozonfalse', 'выбрали Ozon, список закрылся');
        // список площадки открывается в границах экрана на любой странице, в том числе на «Продвижении» (там у кнопки свои правила)
        for (const tab of ['advertising', 'dashboard', 'goods-groups', 'rnp']) {
            await page.evaluate((t) => showTab(t), tab); await page.waitForTimeout(500);
            const has = await page.evaluate(() => { const b = document.getElementById('nr-mp'); return !!b && getComputedStyle(b).display !== 'none'; });
            if (!has) continue;
            await page.click('#nr-mp'); await page.waitForTimeout(250);
            const r = await page.evaluate(() => { const b = document.getElementById('nr-mp').getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, h: b.height, vw: innerWidth, pos: getComputedStyle(document.getElementById('nr-mp')).position }; });
            assert.ok(r.r <= r.vw + 1 && r.l >= 0 && r.pos === 'absolute' && r.h > 100, 'список площадки на «' + tab + '» в границах экрана: ' + JSON.stringify(r));
            await page.click('.nr-mp-dim', { position: { x: 20, y: 600 } }); await page.waitForTimeout(150);
        }
        await page.evaluate(() => showTab('rnp')); await page.waitForTimeout(400);
        console.log('ok   список площадки открывается в границах экрана на всех страницах');
        const ttl = await page.evaluate(() => { const e = document.getElementById('page-title'); return { clipped: e.scrollWidth > e.clientWidth + 1, text: e.textContent.trim(), w: e.clientWidth }; });
        assert.ok(!ttl.clipped, 'название страницы в шапке не обрезается (даже при активном Ozon): ' + JSON.stringify(ttl));
        await page.evaluate(() => NrMp.set('wb'));
        await page.evaluate(() => showTab('dashboard')); await page.waitForTimeout(400);
        await page.click('#cabinet-picker-btn'); await page.waitForTimeout(500);
        const dd = await page.evaluate(() => { const d = document.querySelector('#cabinet-dropdown-menu .cabinet-dropdown-item'); return d ? { shown: d.getBoundingClientRect().width > 100, text: d.textContent.trim() } : null; });
        assert.ok(dd && dd.shown, 'по нажатию на аватарку выходит список кабинетов: ' + JSON.stringify(dd));
        await page.keyboard.press('Escape');
        console.log('ok   телефон: аватарка кабинета, название, круглый календарь, нижнее меню с подписями');
        assert.deepStrictEqual(env.errors, [], 'ошибок скриптов нет: ' + env.errors.join('; '));
    } catch (e) { console.error('FAIL', e.message); process.exitCode = 1; } finally { await browser.close(); srv.close(); }
})();

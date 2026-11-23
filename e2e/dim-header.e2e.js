/**
 * Открыт календарь или список кабинетов: страница затемняется, и полоса шапки затемняется ровно так же (не выделяется светлым пятном).
 * Владелец, 23 ноября 2026: «шапка снова выделяется». Причина: в светлой теме затемнение страницы 0,4, а шапки 0,28.
 * Проверка: прозрачность затемнения html::after равна прозрачности затемнения подложки шапки, во всех темах, видах и обоих состояниях.
 * Запуск: node e2e/dim-header.e2e.js
 */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');
const tables = { spaces: [{ id: 's0', user_id: ADMIN_ID, email: 'makstoychubek@gmail.com', status: 'active', tariff_plan: 'vip', is_super_admin: true, first_name: 'M', last_name: 'T', full_name: 'M T' }], cabinets: [{ id: CAB, name: 'Zevina 1', wb_token_set: true, user_id: ADMIN_ID }, { id: 'c2', name: 'ИП МАРС', wb_token_set: true, user_id: ADMIN_ID }], team_staff: [{ email: 'makstoychubek@gmail.com' }], user_sessions: [] };
(async () => {
    const srv = await serve();
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    let failed = 0;
    try {
        const env = await openApp(browser, 'http://127.0.0.1:' + srv.address().port, { userId: ADMIN_ID, email: 'makstoychubek@gmail.com', tables, rpcs: { is_super_admin: true }, functions: { 'wb-proxy': async () => ({}) } });
        const { page } = env;
        await page.setViewportSize({ width: 1500, height: 860 });
        await page.evaluate(() => { const s = document.getElementById('nr-splash'); if (s) s.remove(); });
        const alpha = () => page.evaluate(() => {
            const a = (c) => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return 0; const p = m[1].split(',').map(Number); return p.length > 3 ? p[3] : 1; };
            const over = a(getComputedStyle(document.documentElement, '::after').backgroundColor);
            const hb = getComputedStyle(document.querySelector('header.glass.app-header'), '::before').backgroundImage;
            const m = hb.match(/rgba\(0, 0, 0, ([\d.]+)\)/);
            return { over, header: m ? Number(m[1]) : null };
        });
        for (const theme of ['ios', 'neon']) for (const design of ['classic', 'glass']) for (const what of ['cab', 'dp']) {
            await page.evaluate(([t, d]) => { applyTheme(t); document.documentElement.setAttribute('data-design', d); showTab('rnp'); }, [theme, design]);
            await page.waitForTimeout(1200);
            await page.click(what === 'cab' ? '.cabinet-picker-btn' : '#header-date-chip-wrap'); await page.waitForTimeout(500);
            const r = await alpha();
            try { assert.ok(r.header !== null && Math.abs(r.over - r.header) < 0.005, JSON.stringify(r)); console.log('ok   ' + theme + ' ' + design + ' ' + what + ' затемнение страницы ' + r.over + ' = шапки ' + r.header); }
            catch (e) { failed++; console.log('FAIL ' + theme + ' ' + design + ' ' + what + ': ' + e.message); }
            await page.keyboard.press('Escape'); await page.mouse.click(700, 500); await page.waitForTimeout(400);
        }
    } finally { await browser.close(); srv.close(); }
    if (failed) { console.log('e2e затемнения шапки: провалено ' + failed); process.exit(1); }
    console.log('e2e затемнения шапки: все проверки прошли');
})();

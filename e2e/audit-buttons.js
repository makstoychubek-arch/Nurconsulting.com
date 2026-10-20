/**
 * Аудит скорости кнопок (инструмент разработчика, не входит в npm test): на заглушке кликает по кнопкам раздела
 * и показывает, через сколько мс экран хоть как-то отреагировал, сколько запросов ушло, мигало ли «Загрузка…»
 * и прыгнула ли прокрутка. Запуск: node e2e/audit-buttons.js settings|rnp  [PW_CHROMIUM=...]
 * Правило проекта (CLAUDE.md): через 100 мс после нажатия пользователь должен что-то увидеть.
 */
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');

const section = process.argv[2] || 'settings';
const DAYS = 14;
const day = (n) => new Date(Date.now() + 6 * 3600e3 - n * 86400e3).toISOString().slice(0, 10);
const ARTS = [
    { nm: 1001, sa: 'укороч_черный', cat: 'Укороченные' }, { nm: 1002, sa: 'укороч_бордо', cat: 'Укороченные' },
    { nm: 2001, sa: 'оверсайз_серый', cat: 'Оверсайз' }, { nm: 2002, sa: 'оверсайз_красный', cat: 'Оверсайз' },
];
const tables = {
    spaces: [{ id: 's0', user_id: ADMIN_ID, email: 'makstoychubek@gmail.com', status: 'active', tariff_plan: 'vip', is_super_admin: true, first_name: 'M', last_name: 'T', full_name: 'M T', avatar_url: null },
        { id: 's1', user_id: '00000000-0000-0000-0000-000000000001', email: 'a@example.test', status: 'pending', tariff_plan: 'start', created_at: '2026-10-10T10:00:00Z', last_sign_in_at: '2026-10-19T10:00:00Z', first_name: 'A', last_name: 'B', full_name: 'A B', sign_in_attempts: 2 }],
    cabinets: [{ id: CAB, name: 'Тестовый кабинет', wb_token_set: true, user_id: ADMIN_ID }],
    team_staff: [{ email: 'makstoychubek@gmail.com' }], cabinet_viewers: [],
    rnp_articles: ARTS.map((a, i) => ({ id: 'a' + i, cabinet_id: CAB, nm_id: a.nm, seller_article: a.sa, name: a.sa, category: a.cat, is_active: true, cost_price: 1000, photo_url: null, sort_order: i })),
    rnp_daily_data: ARTS.flatMap((a, i) => Array.from({ length: DAYS }, (_, d) => ({ cabinet_id: CAB, nm_id: a.nm, date: day(d), orders_count: 10 + i, orders_sum: (10 + i) * 5000, sales_count: 6 + i, sales_sum: (6 + i) * 5000, ad_spend: 500, impressions: 1000, clicks: 50 }))),
    user_sessions: [],
};

const SKIP = /handleLogout|logout|signOut|adminDeleteUser|delete|remove|terminate|Удалить|Выйти|reload|location/i;

async function candidates(page, rootSel, sel) {
    return page.evaluate(([root, sel]) => {
        window.__auSel = sel || '';
        const rootEl = document.querySelector(root) || document.body;
        const seen = new Set();
        const out = [];
        rootEl.querySelectorAll(window.__auSel || 'button, [onclick], [role="button"], .rnp-sheet-tab, .settings-tab, summary, label.nros-main').forEach((el) => {
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            if (r.width < 4 || r.height < 4 || cs.visibility === 'hidden' || cs.display === 'none' || el.disabled) return;
            const label = (el.getAttribute('title') || el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
            const key = (el.getAttribute('onclick') || '') + '|' + label;
            if (seen.has(key)) return;
            seen.add(key);
            el.setAttribute('data-audit', String(out.length));
            out.push({ idx: out.length, label, onclick: (el.getAttribute('onclick') || '').slice(0, 70), cls: String(el.className || '').slice(0, 40) });
        });
        return out;
    }, [rootSel, sel]);
}

const SCROLLERS = () => {
    const out = [];
    document.querySelectorAll('#tab-rnp *, #tab-settings *, .tab-content.active, body, html').forEach((el) => {
        const cs = getComputedStyle(el);
        if ((el.scrollHeight > el.clientHeight + 40 && /(auto|scroll)/.test(cs.overflowY)) || (el.scrollWidth > el.clientWidth + 40 && /(auto|scroll)/.test(cs.overflowX))) out.push(el);
    });
    const se = document.scrollingElement;
    if (se && (se.scrollHeight > se.clientHeight + 40) && !out.includes(se)) out.push(se);
    return out;
};

async function clickOne(page, calls, c, how) {
    // Сначала «отлистываем» все прокручиваемые блоки, иначе прыжок к началу не заметить.
    await page.evaluate((src) => {
        const sc = eval('(' + src + ')')();
        window.__auScr = sc.map((el) => { el.scrollTop = Math.round((el.scrollHeight - el.clientHeight) * 0.4); el.scrollLeft = Math.round((el.scrollWidth - el.clientWidth) * 0.4); return [el, el.scrollTop, el.scrollLeft]; });
        window.__au = { t: 0, first: 0, wipes: 0 };
        if (window.__auObs) window.__auObs.disconnect();
        window.__auObs = new MutationObserver((list) => {
            if (!window.__au.t) return;
            const real = list.some((m) => !(m.type === 'attributes' && m.attributeName === 'data-audit'));
            if (real && !window.__au.first) window.__au.first = performance.now();
            list.forEach((m) => m.addedNodes && m.addedNodes.forEach((n) => { if (n.nodeType === 1 && /^\s*(Загрузка|Загружаем|Считаем)/.test(n.textContent || '') && (n.textContent || '').length < 80) window.__au.wipes++; }));
        });
        window.__auObs.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
    }, SCROLLERS.toString());
    await page.waitForTimeout(80);
    const n0 = calls.length;
    const clicked = await page.evaluate(([i, how]) => {
        const el = document.querySelector('[data-audit="' + i + '"]');
        if (!el) return false;
        window.__au.t = performance.now();
        if (how === 'input') {
            if (el.tagName === 'SELECT') { el.selectedIndex = Math.min(1, el.options.length - 1); } else if (el.type === 'checkbox') { el.checked = !el.checked; } else { el.value = (el.type === 'number' ? '123' : 'тест'); }
            el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); el.dispatchEvent(new Event('blur', { bubbles: true }));
        } else if (typeof el.click === 'function') el.click(); else el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return true;
    }, [c.idx, how || 'click']);
    if (!clicked) return null;
    await page.waitForTimeout(1500);
    const m = await page.evaluate(() => {
        let jump = 0;
        (window.__auScr || []).forEach(([el, t, l]) => { if (!el.isConnected) { jump = Math.max(jump, 999); return; } jump = Math.max(jump, Math.abs(el.scrollTop - t), Math.abs(el.scrollLeft - l)); });
        return { first: window.__au.first ? Math.round(window.__au.first - window.__au.t) : null, wipes: window.__au.wipes, jump };
    });
    const reqs = calls.slice(n0);
    await page.keyboard.press('Escape').catch(() => {});
    await page.evaluate(() => { document.querySelectorAll('.rnp-plan-overlay .rnp-plan-close, .nru-dlg-close, #modal-btn, .rnp-settings-overlay.is-open .rnp-settings-close').forEach((b) => { try { b.click(); } catch (e) {} }); }).catch(() => {});
    return { first: m.first, wipes: m.wipes, reqs: reqs.length, fn: reqs.filter((r) => r.kind === 'fn').length, jump: m.jump };
}

(async () => {
    const srv = await serve();
    const base = 'http://127.0.0.1:' + srv.address().port;
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    const env = await openApp(browser, base, {
        userId: ADMIN_ID, email: 'makstoychubek@gmail.com', latencyMs: 150, tables, rpcs: { is_super_admin: true },
        functions: { 'admin-space': async () => { await new Promise((r) => setTimeout(r, 700)); return { ok: true }; }, 'wb-proxy': async () => { await new Promise((r) => setTimeout(r, 700)); return {}; } },
    });
    const { page, calls } = env;
    const rows = [];
    const run = async (group, rootSel) => {
        for (const mode of ['click', 'input']) {
            const list = await candidates(page, rootSel, mode === 'input' ? 'input:not([type=hidden]):not([type=range]), select, textarea' : '');
            for (const c of list) {
                if (SKIP.test(c.onclick) || SKIP.test(c.label)) { rows.push({ group, ...c, skipped: true }); continue; }
                let r = null;
                try { r = await clickOne(page, calls, c, mode); } catch (e) { r = { error: String(e.message || e).split('\n')[0] }; }
                rows.push({ group, ...c, label: (mode === 'input' ? '[поле] ' : '') + c.label, ...(r || { gone: true }) });
            }
        }
    };
    if (section === 'settings') {
        await page.evaluate(() => showTab('settings'));
        await page.waitForTimeout(2500);
        const tabs = await page.evaluate(() => [...document.querySelectorAll('[id^="settings-tab-btn-"]')].map((b) => b.id));
        for (const id of tabs) {
            await page.evaluate((i) => document.getElementById(i)?.click(), id);
            await page.waitForTimeout(1200);
            await run(id.replace('settings-tab-btn-', 'settings/'), '#tab-settings');
        }
    } else if (section.startsWith('tab:')) {
        const tab = section.slice(4);
        await page.evaluate((t) => showTab(t), tab);
        await page.waitForTimeout(3500);
        console.log('таблицы, которые читает вкладка:', [...new Set(calls.filter((c) => c.kind === 'read').map((c) => c.table))].join(', '));
        await run('tab/' + tab, '#tab-' + tab);
    } else {
        await page.evaluate(() => showTab('rnp'));
        await page.waitForFunction(() => /заказы\s+\d+/.test(document.querySelector('.rnp-gh-sub')?.textContent || ''), null, { timeout: 15000 });
        await page.waitForTimeout(1500);
        await run('rnp/общий', '#tab-rnp');
        await page.evaluate(() => RNP.pick(1001));
        await page.waitForTimeout(2500);
        await run('rnp/артикул', '#tab-rnp');
    }
    const slow = rows.filter((r) => !r.skipped && !r.gone && !r.error);
    const bad = (r) => r.first == null ? r.reqs > 0 : r.first > 100;
    console.log(`\nВсего кнопок: ${rows.length}, проверено: ${slow.length}, пропущено (опасные): ${rows.filter((r) => r.skipped).length}`);
    console.log('\nМедленные или без отклика за 100 мс (первый отклик в мс, запросов, мигало «Загрузка», прыжок прокрутки):');
    slow.filter(bad).sort((a, b) => (b.first ?? 9999) - (a.first ?? 9999)).forEach((r) => console.log(`  [${r.group}] «${r.label}» ${r.onclick} → отклик ${r.first == null ? 'нет' : r.first + ' мс'}, запросов ${r.reqs}${r.fn ? ' (функций ' + r.fn + ')' : ''}${r.wipes ? ', «Загрузка» ×' + r.wipes : ''}${r.jump > 8 ? ', прыжок ' + r.jump + ' px' : ''}`));
    console.log('\nС прыжком прокрутки или «Загрузка…», но быстрые:');
    slow.filter((r) => !bad(r) && (r.jump > 8 || r.wipes)).forEach((r) => console.log(`  [${r.group}] «${r.label}» ${r.onclick} → ${r.first} мс${r.wipes ? ', «Загрузка» ×' + r.wipes : ''}${r.jump > 8 ? ', прыжок ' + r.jump + ' px' : ''}`));
    console.log('\nОшибки:', rows.filter((r) => r.error).map((r) => `[${r.group}] «${r.label}» ${r.error}`));
    console.log('Ошибки страницы:', env.errors.slice(0, 8));
    require('fs').writeFileSync('/tmp/audit-' + section.replace(/\W/g, '_') + '.json', JSON.stringify(rows, null, 1));
    await browser.close();
    srv.close();
})();

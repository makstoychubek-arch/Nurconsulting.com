// Режим «только просмотр»: пользователю выданы кабинеты и разделы (таблица cabinet_viewers).
// Показываем только разрешённые разделы, прячем всё, что меняет данные, и не даём клиенту
// отправлять записи в базу. Сама база тоже не пустит: у наблюдателя только SELECT-политики.
(function () {
    'use strict';
    const TABS = {
        dashboard: ['dashboard'],
        rnp: ['rnp'],
        goods: ['goods-groups'],
        ads: ['advertising'],
        ab: ['ab-testing'],
        logistics: ['logistics'],
        reports: ['summary'],
    };
    const ORDER = ['dashboard', 'rnp', 'goods-groups', 'advertising', 'ab-testing', 'logistics', 'summary'];
    const NAMES = { dashboard: 'Дашборд', rnp: 'РНП', goods: 'Логистика', ads: 'Реклама', ab: 'А/Б тесты', logistics: 'Логистика', reports: 'Отчёты' };

    const V = {
        on: false,
        rows: [],
        tabs: new Set(),
        enable(rows) {
            if (!Array.isArray(rows) || !rows.length) return;
            V.on = true;
            V.rows = rows;
            setOwner();
            document.documentElement.setAttribute('data-viewer', '1');
            injectCss();
            guardWrites();
            markNav();
            banner();
            let guardT = null;
            new MutationObserver(() => {
                markNav(); banner();
                // Любой модуль мог снова показать невыданный раздел (например, РНП после загрузки данных): возвращаем на разрешённый.
                if (!guardT) guardT = setTimeout(() => { guardT = null; V.ensureAllowed(); }, 150);
            }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
            document.addEventListener('cabinet-changed', () => setTimeout(() => V.ensureAllowed(), 50));
            setTimeout(() => V.ensureAllowed(), 600);
            // Открытая при загрузке вкладка (например, РНП из прошлого визита) может оказаться не из выданных —
            // тогда сразу переводим на первую разрешённую.
            try {
                const act = document.querySelector('.tab-content.active');
                const cur = act && act.id ? act.id.replace(/^tab-/, '') : '';
                const early = document.getElementById('nr-early-tab-style');
                if (cur && !V.allows(cur) && typeof window.showTab === 'function') window.showTab(V.firstTab(), null);
                else if (early && !cur && typeof window.showTab === 'function') window.showTab(V.firstTab(), null);
            } catch (_) {}
        },
        ensureAllowed() {
            try {
                if (!V.on || typeof window.showTab !== 'function') return;
                const act = document.querySelector('.tab-content.active');
                const cur = act && act.id ? act.id.replace(/^tab-/, '') : '';
                if (cur && !V.allows(cur) && !V.fixing) {
                    V.fixing = true;
                    document.getElementById('nr-early-tab-style')?.remove();
                    document.documentElement.removeAttribute('data-nr-early');
                    act.classList.remove('active');
                    window.showTab(V.firstTab(), null);
                    setTimeout(() => { V.fixing = false; }, 300);
                }
            } catch (_) { V.fixing = false; }
        },
        allows(tab) { return !V.on || V.tabs.has(tab); },
        firstTab() { return ORDER.find(t => V.tabs.has(t)) || 'dashboard'; },
    };

    function calcTabs() {
        const secs = new Set();
        V.rows.forEach(r => (r.sections || ['all']).forEach(s => secs.add(String(s))));
        const all = secs.has('all');
        V.tabs = new Set();
        Object.entries(TABS).forEach(([k, t]) => { if (all || secs.has(k)) t.forEach(x => V.tabs.add(x)); });
        // Владелец и гость — одна роль: меню владельца, только просмотр, без плашки; Telegram только при полном доступе.
        if (all) V.tabs.add('tg-owner');
        ['logistics', 'reports'].forEach(k => TABS[k].forEach(x => V.tabs.delete(x)));
        V.secLabel = all ? 'все разделы' : [...secs].map(s => NAMES[s]).filter(Boolean).join(', ');
    }

    function setOwner() {
        V.owner = true;
        document.documentElement.setAttribute('data-owner', '');
        calcTabs();
        if (V.tabs.has('tg-owner')) tgTab();
        document.getElementById('nr-viewer-banner')?.remove();
        document.querySelector('[data-ab-filter="finished"]')?.click();
    }

    const TG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.5 4.3 2.9 11.5c-1.3.5-1.3 1.2-.2 1.5l4.7 1.5 1.8 5.6c.2.6.1.8.7.8.5 0 .7-.2 1-.5l2.3-2.3 4.8 3.6c.9.5 1.5.2 1.7-.8l3.1-14.9c.3-1.2-.5-1.8-1.3-1.4zM8.5 13.6l9.2-5.8c.4-.3.8-.1.5.2l-7.6 6.9-.3 3.2-1.8-4.5z"/></svg>';
    const BOTS = [['Амина', 'Продажи и заказы'], ['Манас', 'Реклама (РК)'], ['Акылай', 'Отзывы и вопросы'], ['Карина', 'А/Б тесты']];
    function tgTab() {
        if (!document.getElementById('tab-tg-owner')) {
            const host = document.getElementById('tab-ab-testing');
            if (host) {
                const d = document.createElement('div');
                d.id = 'tab-tg-owner';
                d.className = 'tab-content space-y-4';
                d.innerHTML = '<div class="nr-tgo"><div data-sec="tg" class="nr-tgo-s"><h3 class="nr-tgo-h" id="nr-set-tg">Telegram</h3>' + BOTS.map(b => '<div class="nr-tgo-card"><span class="nr-tgo-ico">' + TG + '</span><div><b>' + b[0] + '</b><small>' + b[1] + '</small></div><em>Скоро</em></div>').join('') +
                    '</div><div data-sec="set" class="nr-tgo-s"><h3 class="nr-tgo-h">Пользователи</h3><div id="nr-set-acc" class="nr-tgo-card nr-tgo-col"></div>' +
                    '<h3 class="nr-tgo-h">Интеграции</h3><div id="nr-set-mcp" class="nr-tgo-card nr-tgo-col"></div><h3 class="nr-tgo-h">Профиль</h3><div class="nr-tgo-card"><div><b id="nr-set-mail">—</b><small>' + esc(V.rows.map(r => r.name).join(', ')) + '</small></div><button type="button" class="nr-tgo-out" onclick="handleLogout()">Выйти</button></div></div></div>';
                host.after(d);
            }
        }
        const goods = document.querySelector('.rail-btn[data-tab="goods-groups"]');
        if (goods && !document.querySelector('.rail-btn[data-tab="tg-owner"]')) {
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'rail-btn'; b.dataset.tab = 'tg-owner'; b.title = 'Telegram и настройки';
            b.innerHTML = '<span class="rail-btn-ico">' + TG + '</span><span class="rail-btn-lbl">Telegram</span>';
            b.addEventListener('click', () => { window.showTab('tg-owner', b); window.NrAccess && window.NrAccess.mode('tg'); });
            goods.after(b);
        }
    }

    function tabOf(el) {
        if (el.dataset && el.dataset.tab) return el.dataset.tab;
        const m = String(el.getAttribute('onclick') || '').match(/showTab\('([a-z-]+)'/);
        return m ? m[1] : null;
    }

    function markNav() {
        document.querySelectorAll('.nav-item, .nav-item-standalone, .rail-btn, .rail-settings-btn, .bottom-nav-item').forEach(el => {
            const t = tabOf(el);
            if (!t) return;
            const hide = !V.tabs.has(t);
            if (hide && !el.hasAttribute('data-viewer-hide')) el.setAttribute('data-viewer-hide', '1');
            else if (!hide && el.hasAttribute('data-viewer-hide')) el.removeAttribute('data-viewer-hide');
        });
    }

    let bannerBusy = false;
    function banner() {
        if (bannerBusy) return;
        const host = document.querySelector('.main-content, main, #main-content');
        if (V.owner || !host || document.getElementById('nr-viewer-banner')) return;
        bannerBusy = true;
        const b = document.createElement('div');
        b.id = 'nr-viewer-banner';
        const cabs = V.rows.map(r => r.name).join(', ');
        b.innerHTML = `<span>Режим просмотра · ${esc(cabs)} · доступно: ${esc(V.secLabel)}</span><em>Изменять данные нельзя</em>`;
        host.prepend(b);
        bannerBusy = false;
    }

    function esc(t) { return String(t || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

    function injectCss() {
        if (document.getElementById('nr-viewer-css')) return;
        const s = document.createElement('style');
        s.id = 'nr-viewer-css';
        s.textContent = `
html[data-viewer="1"] [data-viewer-hide]:not(#rail-settings-btn),
html[data-viewer="1"] [data-staff-only],
html[data-viewer="1"] .rnp-edit-mode-btn,
html[data-viewer="1"] .rnp-settings-gear,
html[data-viewer="1"] [onclick*="RNP.openSettings"],
html[data-viewer="1"] [onclick*="RNP.openPlanning"],
html[data-viewer="1"] .rnp-price-btn,
html[data-viewer="1"] .gs-edit,
html[data-viewer="1"] [onclick*="RNP.refresh"],
html[data-viewer="1"] [onclick*="RNP.sync"],
html[data-viewer="1"] [onclick*="RNP.saveNote"],
html[data-viewer="1"] [onclick*="RNP.openNote"],
html[data-viewer="1"] [onclick*="openNoteEditor"],
html[data-viewer="1"] [onclick*="syncNow"],
html[data-viewer="1"] [onclick*="manualSync"],
html[data-viewer="1"] [onclick*="openAddCabinet"],
html[data-viewer="1"] #cabinet-add-btn,
html[data-viewer="1"] .adp2-pos, html[data-viewer="1"] .adp2-prs .adp2-addp, html[data-viewer="1"] .adp2-tg,
html[data-viewer="1"] [data-pact="addp"],
html[data-viewer="1"] [data-pact="drop"],
html[data-viewer="1"] [data-pact="kbulk"],
html[data-viewer="1"] [data-pact="kdrop"],
html[data-viewer="1"] [data-pact="kmark"],
html[data-viewer="1"] [data-pact="kminus"],
html[data-viewer="1"] [data-pact="kstep"],
html[data-viewer="1"] [data-pact="ksel"],
html[data-viewer="1"] [data-pact="kwaste"],
html[data-viewer="1"] [data-pact="new"],
html[data-viewer="1"] [data-pact="pos"],
html[data-viewer="1"] [data-pact="rm"],
html[data-viewer="1"] [data-pact="step"],
html[data-viewer="1"] [data-pact="toggle"],
html[data-viewer="1"] [data-pact="topup"],
html[data-viewer="1"] [data-pact="vdrop"],
html[data-viewer="1"] [data-pact="vretry"] { display: none !important; }
html[data-viewer="1"] .gs-in,
html[data-viewer="1"] .rnp-plan-input,
html[data-viewer="1"] .rnp-sheet-table input,
html[data-viewer="1"] .rnp-sheet-table textarea,
html[data-viewer="1"] #tab-goods-groups input:not([type="search"]),
html[data-viewer="1"] #tab-goods-groups select,
html[data-viewer="1"] #tab-goods-groups textarea { pointer-events: none !important; background: transparent !important; }
html[data-owner] #ab-new-btn, html[data-owner] [onclick*="showNewTestForm"], html[data-owner] .abtest-card button, html[data-owner] [data-ab-filter="active"], html[data-owner] [data-ab-filter="all"] { display: none !important; }
.nr-tgo { display: grid; gap: 10px; max-width: 560px; padding: 6px 2px 24px; }
.nr-tgo-card { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); }
.nr-tgo-h { margin: 14px 0 0; font-size: 13px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: .04em; } .nr-tgo-h:first-child { margin-top: 0; }
.nr-tgo-s { display: grid; gap: 10px; } #tab-tg-owner[data-mode="tg"] [data-sec="set"], #tab-tg-owner[data-mode="set"] [data-sec="tg"] { display: none; }
.nr-mcp-new { border: 1px dashed var(--border); border-radius: 12px; padding: 10px; margin-bottom: 8px; } .nr-mcp-c, #nr-set-mcp { font-size: 13px; }
.nr-tgo-col { display: block; } .nr-tgo-out { margin-left: auto; border: 1px solid var(--border); background: var(--surface); border-radius: 10px; padding: 6px 12px; font-size: 12.5px; cursor: pointer; color: var(--text-primary); }
.nr-tgo-card b { display: block; font-size: 14px; } .nr-tgo-card small { color: var(--text-muted); font-size: 12px; }
.nr-tgo-card em { margin-left: auto; font-style: normal; font-size: 12px; color: var(--text-muted); }
.nr-tgo-ico { width: 34px; height: 34px; border-radius: 50%; background: #229ed9; color: #fff; display: grid; place-items: center; } .nr-tgo-ico svg { width: 18px; height: 18px; }
#nr-viewer-banner { display: flex; align-items: center; gap: 10px; background: #efeafe; color: #4c34c9; border-radius: 12px; padding: 8px 14px; margin: 0 0 10px; font-size: 12.5px; font-weight: 700; }
#nr-viewer-banner em { margin-left: auto; font-style: normal; font-weight: 500; color: #6d4fe8; }
:root[data-theme="dark"] #nr-viewer-banner { background: rgba(109,79,232,.18); color: #cfc6ff; }
@media (max-width: 768px) { #nr-viewer-banner em { display: none; } }`;
        document.head.appendChild(s);
    }

    // Клиент не отправляет записи: любые insert/update/upsert/delete возвращают ошибку «Режим просмотра».
    function guardWrites() {
        // eslint-disable-next-line no-undef
        const sb = (typeof supabase !== 'undefined' && supabase && typeof supabase.from === 'function') ? supabase : null;
        if (!sb || sb.__nrViewerGuard) return;
        sb.__nrViewerGuard = true;
        const denied = { data: null, error: { message: 'Режим просмотра: изменять данные нельзя', code: 'viewer' } };
        const fake = () => {
            const p = new Proxy(function () {}, {
                get(_t, k) {
                    if (k === 'then') return (res, rej) => Promise.resolve(denied).then(res, rej);
                    return () => p;
                },
                apply() { return p; },
            });
            return p;
        };
        const origFrom = sb.from.bind(sb);
        sb.from = function (table) {
            const q = origFrom(table);
            ['insert', 'update', 'upsert', 'delete'].forEach(m => { if (typeof q[m] === 'function') q[m] = () => fake(); });
            return q;
        };
    }

    // Кабинет выдали, пока человек сидел на экране «подключите магазин»: проверяем сами раз в полминуты и при возврате на вкладку.
    // Перезагружать страницу не нужно.
    function recheck() {
        try {
            if (document.hidden || typeof hasUserCabinets === 'undefined' || hasUserCabinets || !cabinetsLoaded || isStaff) return;
            supabase.rpc('viewer_cabinets').then(r => { if (Array.isArray(r.data) && r.data.length && typeof loadCabinets === 'function') loadCabinets(); });
        } catch (e) { /* без проверки всё работает как раньше */ }
    }
    setInterval(recheck, 30000);
    // Сразу после входа первый запрос может уйти раньше сессии и вернуть пусто: первые 20 с проверяем каждые 2 с.
    let fastN = 0;
    const fast = setInterval(() => { recheck(); if (++fastN > 10) clearInterval(fast); }, 2000);
    document.addEventListener('visibilitychange', recheck);

    window.NrViewer = V;
})();

// «Пользователи»: до 5 человек смотрят кабинет (роль viewer). Добавляет супер-админ, владелец кабинета или хозяин кабинета.
(function () {
    'use strict';
    const MSG = { forbidden: 'Нет прав управлять доступом', bad_email: 'Проверьте почту', limit: 'Уже 5 человек — уберите кого-то', already_owner: 'Эта почта уже у владельца кабинета' };
    const esc = (t) => String(t || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    let box = null, cabId = '', cabName = '', state = { items: [], can: true }, busy = false;

    function css() {
        if (document.getElementById('nr-acc-css')) return;
        const s = document.createElement('style');
        s.id = 'nr-acc-css';
        s.textContent = `#nr-acc { position: fixed; inset: 0; z-index: 9000; background: rgba(15,15,25,.45); display: grid; place-items: center; padding: 16px; }
:is(#nr-acc, #nr-set-acc, #nr-set-mcp, .nr-mcp-c) .nr-acc-b { width: min(440px, 100%); max-height: 90vh; overflow: auto; background: var(--surface-solid, #fff); color: var(--text-primary); border-radius: 18px; padding: 18px; box-shadow: 0 20px 60px rgba(0,0,0,.25); }
:is(#nr-acc, #nr-set-acc, #nr-set-mcp, .nr-mcp-c) h3 { margin: 0; font-size: 16px; } :is(#nr-acc, #nr-set-acc, #nr-set-mcp, .nr-mcp-c) p { margin: 4px 0 12px; font-size: 12.5px; color: var(--text-muted); }
:is(#nr-acc, #nr-set-acc, #nr-set-mcp, .nr-mcp-c) .nr-acc-r { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid var(--border); border-radius: 12px; margin-bottom: 6px; font-size: 13px; }
:is(#nr-acc, #nr-set-acc, #nr-set-mcp, .nr-mcp-c) .nr-acc-r span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; } :is(#nr-acc, #nr-set-acc, #nr-set-mcp, .nr-mcp-c) .nr-acc-r em { font-style: normal; font-size: 11px; color: var(--text-muted); }
:is(#nr-acc, #nr-set-acc, #nr-set-mcp, .nr-mcp-c) button { border: 1px solid var(--border); background: var(--surface); color: var(--text-primary); border-radius: 10px; padding: 6px 12px; font-size: 12.5px; cursor: pointer; }
:is(#nr-acc, #nr-set-acc, #nr-set-mcp, .nr-mcp-c) .nr-acc-add { display: flex; gap: 8px; margin-top: 10px; } :is(#nr-acc, #nr-set-acc, #nr-set-mcp, .nr-mcp-c) input { flex: 1; min-width: 0; border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; font-size: 13px; background: var(--surface); color: var(--text-primary); }
:is(#nr-acc, #nr-set-acc, #nr-set-mcp, .nr-mcp-c) .nr-acc-ok { background: var(--accent); color: #fff; border-color: transparent; } :is(#nr-acc, #nr-set-acc, #nr-set-mcp, .nr-mcp-c) .nr-acc-err { color: #dc2626; font-size: 12px; min-height: 16px; margin-top: 6px; }
:is(#nr-acc, #nr-set-acc, #nr-set-mcp, .nr-mcp-c) .nr-acc-h { display: flex; justify-content: space-between; align-items: start; gap: 10px; }`;
        document.head.appendChild(s);
    }

    let inl = null;
    function paint(err) {
        const tgt = inl || (box && box.querySelector('.nr-acc-b'));
        if (!tgt) return;
        const n = state.items.length;
        const rows = state.items.map((x) => '<div class="nr-acc-r"><span>' + esc(x.email) + '</span><em>' + (x.status === 'invited' ? 'ждёт входа' : 'смотрит') + '</em>' +
            (state.can ? '<button type="button" data-rm="' + esc(x.email) + '">Убрать</button>' : '') + '</div>').join('');
        const note = 'До 5 человек смотрят кабинет, менять данные они не могут. Занято: ' + n + ' из 5.';
        tgt.innerHTML = (inl ? '<p>' + esc(note) + '</p>' : '<div class="nr-acc-h"><div><h3>Пользователи</h3><p>' + esc(cabName) + ' · ' + esc(note) + '</p></div><button type="button" data-x="1" aria-label="Закрыть">×</button></div>') +
            (rows || '<p>Пока никого.</p>') +
            (state.can ? '<div class="nr-acc-add"><input type="email" placeholder="Почта Google" autocomplete="off"' + (n >= 5 ? ' disabled' : '') + '><button type="button" class="nr-acc-ok" data-add="1"' + (n >= 5 ? ' disabled' : '') + '>Добавить</button></div>' : '<p>Управлять пользователями может владелец кабинета.</p>') +
            '<div class="nr-acc-err">' + esc(err || '') + '</div>';
    }

    async function load() {
        try {
            const r = await supabase.rpc('cabinet_watchers', { p_cabinet: cabId });
            if (r.data) state = { items: r.data.items || [], can: r.data.can_manage !== false };
        } catch (_) {}
        paint();
    }

    // Список показывается сразу, правки применяются на экране до ответа сервера; при ошибке откатываем и пишем причину.
    async function act(fn, optimistic) {
        if (busy) return;
        busy = true;
        const was = state.items.slice();
        optimistic && optimistic();
        paint();
        try {
            const r = await fn();
            if (r && r.error) throw r.error;
            busy = false;
            load();
        } catch (e) {
            busy = false;
            state.items = was;
            const m = String((e && e.message) || e);
            paint(MSG[Object.keys(MSG).find((k) => m.includes(k))] || 'Не получилось, повторите');
        }
    }

    function open(id, name) {
        if (!id) return;
        css();
        inl = null;
        cabId = id; cabName = name || '';
        state = { items: [], can: true };
        box && box.remove();
        box = document.createElement('div');
        box.id = 'nr-acc';
        box.innerHTML = '<div class="nr-acc-b"></div>';
        document.body.appendChild(box);
        paint();
        wire(box);
        load();
    }

    function wire(el) {
        el.addEventListener('click', (e) => {
            const t = e.target;
            if (t === box || t.closest('[data-x]')) { box && box.remove(); box = null; return; }
            const rm = t.closest('[data-rm]');
            if (rm) { const m = rm.getAttribute('data-rm'); act(() => supabase.rpc('cabinet_watcher_remove', { p_cabinet: cabId, p_email: m }), () => { state.items = state.items.filter((x) => x.email !== m); }); return; }
            if (t.closest('[data-add]')) add();
        });
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('input')) add(); });
    }

    // Один раздел, два вида: Telegram (кнопка в меню) и настройки (шестерёнка).
    function mode(m) {
        const t = document.getElementById('tab-tg-owner');
        if (t) t.dataset.mode = m;
        const h = document.getElementById('page-title');
        if (h) h.textContent = m === 'tg' ? 'Telegram' : 'Настройки';
    }

    // Страница настроек владельца: тот же список прямо в разделе, без окна.
    function mount() {
        const host = document.getElementById('nr-set-acc');
        if (!host) return;
        css();
        const rows = (window.NrViewer && window.NrViewer.rows) || [];
        let id = ''; try { id = currentCabinetId; } catch (_) {}
        const row = rows.find((r) => r.id === id) || rows[0] || {};
        cabId = row.id || id; cabName = row.name || '';
        if (!inl) { inl = host; wire(host); } else inl = host;
        box && box.remove(); box = null;
        paint();
        load();
        mcpLoad(document.getElementById('nr-set-mcp'));
        supabase.auth.getSession().then((r) => { const m = document.getElementById('nr-set-mail'); const u = r.data && r.data.session && r.data.session.user; if (m && u) m.textContent = u.email; });
    }

    function add() {
        const inp = (inl || box) && (inl || box).querySelector('input');
        const m = inp ? inp.value.trim().toLowerCase() : '';
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m)) { paint(MSG.bad_email); return; }
        act(() => supabase.rpc('cabinet_watcher_add', { p_cabinet: cabId, p_email: m }), () => { state.items.push({ email: m, status: 'invited' }); });
    }

    // Владельцу в режиме просмотра шестерёнка «Настройки» открывает это окно, остальным — обычные настройки.
    document.addEventListener('click', (e) => {
        const g = e.target.closest && e.target.closest('#rail-settings-btn');
        if (!g || !window.NrViewer || !window.NrViewer.on) return;
        e.preventDefault(); e.stopImmediatePropagation();
        const btn = document.querySelector('.rail-btn[data-tab="tg-owner"]');
        if (btn) { window.showTab('tg-owner', document.getElementById('rail-settings-btn')); mode('set'); mount(); return; }
        let id = ''; try { id = currentCabinetId; } catch (_) {}
        const rr = (window.NrViewer.rows || []);
        open(id || (rr[0] || {}).id, ((rr.find((r) => r.id === id) || rr[0]) || {}).name);
    }, true);

    // Интеграции: личный ключ для подключения своего ИИ (Claude, ChatGPT) к данным своих кабинетов, только чтение.
    const mc = { keys: [], fresh: null, busy: false, err: '' };
    function mcpUrl(k) {
        let base = '';
        try { base = String(supabase.supabaseUrl || '').replace(/\/$/, ''); } catch (_) {}
        if (!base) { try { base = String(WB_PROXY_URL).replace(/\/functions\/v1\/.*$/, ''); } catch (_) {} }
        return base + '/functions/v1/mcp/' + k;
    }
    function mcpPaint(host) {
        if (!host) return;
        const fresh = mc.fresh ? '<div class="nr-mcp-new"><p><b>Ключ создан. Скопируйте адрес сейчас: позже он не покажется.</b></p><div class="nr-acc-add"><input readonly value="' + esc(mcpUrl(mc.fresh)) + '" onfocus="this.select()"><button type="button" class="nr-acc-ok" data-mcopy="1">Скопировать</button></div>' +
            '<p><b>Claude:</b> Настройки → Коннекторы → Добавить свой коннектор → вставить адрес.<br><b>ChatGPT:</b> Настройки → Приложения → режим разработчика → создать коннектор → вставить адрес, вход «без авторизации».</p></div>' : '';
        const rows = mc.keys.map((k) => '<div class="nr-acc-r"><span>' + esc(k.label || 'Ключ') + '</span><em>' + (k.last_used_at ? 'использован ' + new Date(k.last_used_at).toLocaleDateString('ru-RU') : 'ещё не использован') + '</em><button type="button" data-mrev="' + esc(k.id) + '">Отозвать</button></div>').join('');
        host.innerHTML = '<p>Подключите свой ИИ, чтобы он отвечал по данным ваших кабинетов: остатки, заказы, финансы. Только чтение, токены WB ИИ не видит.</p>' + fresh + rows +
            '<div class="nr-acc-add"><input type="text" maxlength="40" placeholder="Название, например «Мой Claude»" id="nr-mcp-label"><button type="button" class="nr-acc-ok" data-mnew="1"' + (mc.busy ? ' disabled' : '') + '>' + (mc.busy ? 'Создаём…' : 'Создать ключ') + '</button></div><div class="nr-acc-err">' + esc(mc.err) + '</div>';
    }
    function mcpLoad(host) {
        css(); mcpPaint(host);
        supabase.from('mcp_keys').select('id,label,created_at,last_used_at').is('revoked_at', null).order('created_at').then((r) => { if (r && !r.error) { mc.keys = r.data || []; mcpPaint(host); } });
        if (host.__mcp) return;
        host.__mcp = true;
        host.addEventListener('click', (e) => {
            const t = e.target;
            if (t.closest('[data-mcopy]')) {
                const v = host.querySelector('.nr-mcp-new input');
                try { navigator.clipboard.writeText(v.value).then(() => { t.textContent = 'Скопировано'; }, () => v.select()); } catch (_) { v.select(); }
            } else if (t.closest('[data-mnew]') && !mc.busy) {
                mc.busy = true; mc.err = ''; const lab = (host.querySelector('#nr-mcp-label') || {}).value || ''; mcpPaint(host);
                supabase.rpc('mcp_key_create', { p_label: lab }).then((r) => {
                    mc.busy = false;
                    if (r.error) mc.err = String(r.error.message || '').includes('limit') ? 'Уже 5 ключей: отзовите ненужный.' : 'Не получилось создать ключ. Повторите.';
                    else { mc.fresh = r.data; mcpLoad(host); return; }
                    mcpPaint(host);
                });
            } else if (t.closest('[data-mrev]')) {
                const id = t.closest('[data-mrev]').getAttribute('data-mrev');
                mc.keys = mc.keys.filter((k) => k.id !== id); mcpPaint(host);
                supabase.rpc('mcp_key_revoke', { p_id: id });
            }
        });
    }

    // У хозяина кабинета (обычные настройки) карточка с кнопкой в «Безопасности».
    function card() {
        const host = document.getElementById('settings-security');
        if (!host || document.getElementById('nr-acc-card') || (window.NrViewer && window.NrViewer.on)) return;
        let id = ''; try { id = typeof hasUserCabinets !== 'undefined' && hasUserCabinets ? currentCabinetId : ''; } catch (_) {}
        if (!id) return;
        const c = document.createElement('div');
        c.id = 'nr-acc-card'; c.className = 'widget-card p-6';
        c.innerHTML = '<h3 class="font-semibold mb-1" style="color:var(--text-primary)">Пользователи</h3><p class="text-xs mb-3" style="color:var(--text-muted)">До 5 человек смогут смотреть кабинет, менять данные они не смогут.</p><button type="button" class="ui-btn ui-btn-secondary">Управлять пользователями</button>';
        c.querySelector('button').onclick = () => { let n = ''; try { n = (nrCabinetList().find((x) => x.id === currentCabinetId) || {}).name || ''; } catch (_) {} open(currentCabinetId, n); };
        host.prepend(c);
        if (!document.getElementById('nr-mcp-card')) {
            const m = document.createElement('div');
            m.id = 'nr-mcp-card'; m.className = 'widget-card p-6';
            m.innerHTML = '<h3 class="font-semibold mb-1" style="color:var(--text-primary)">Интеграции</h3><div id="nr-set-mcp-c" class="nr-mcp-c"></div>';
            c.after(m);
            mcpLoad(m.querySelector('#nr-set-mcp-c'));
        }
    }
    document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('#rail-settings-btn')) setTimeout(card, 150); });

    window.NrAccess = { open, mount, mode };
})();

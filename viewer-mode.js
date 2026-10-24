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
            calcTabs();
            document.documentElement.setAttribute('data-viewer', '1');
            injectCss();
            guardWrites();
            markNav();
            banner();
            ownerCheck();
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
        if (V.owner) { V.tabs = new Set(['dashboard', 'rnp', 'advertising', 'goods-groups', 'ab-testing', 'tg-owner']); V.secLabel = ''; return; }
        const secs = new Set();
        V.rows.forEach(r => (r.sections || ['all']).forEach(s => secs.add(String(s))));
        const all = secs.has('all');
        V.tabs = new Set();
        Object.entries(TABS).forEach(([k, t]) => { if (all || secs.has(k)) t.forEach(x => V.tabs.add(x)); });
        V.secLabel = all ? 'все разделы' : [...secs].map(s => NAMES[s]).filter(Boolean).join(', ');
    }

    // Владелец кабинета (роль owner): Дашборд, РНП, РК, Логистика, архив А/Б и Telegram, без плашки «Режим просмотра».
    function setOwner(on) {
        if (V.owner === on) return;
        V.owner = on;
        document.documentElement.toggleAttribute('data-owner', on);
        calcTabs();
        if (on) { tgTab(); document.querySelector('[data-ab-filter="finished"]')?.click(); }
        document.getElementById('nr-viewer-banner')?.remove();
        markNav();
        V.ensureAllowed();
    }
    function ownerCheck() {
        try { if (localStorage.getItem('nr-owner') === '1') setOwner(true); } catch (_) {}
        try {
            supabase.auth.getSession().then(s => {
                const uid = s.data && s.data.session && s.data.session.user.id;
                return uid ? supabase.from('cabinet_viewers').select('role').eq('user_id', uid) : null;
            }).then(r => {
                if (!r || !Array.isArray(r.data)) return;
                const own = r.data.some(x => x.role === 'owner');
                try { localStorage.setItem('nr-owner', own ? '1' : '0'); } catch (_) {}
                setOwner(own);
            });
        } catch (_) {}
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
                d.innerHTML = '<div class="nr-tgo">' + BOTS.map(b => '<div class="nr-tgo-card"><span class="nr-tgo-ico">' + TG + '</span><div><b>' + b[0] + '</b><small>' + b[1] + '</small></div><em>Скоро</em></div>').join('') + '</div>';
                host.after(d);
            }
        }
        const goods = document.querySelector('.rail-btn[data-tab="goods-groups"]');
        if (goods && !document.querySelector('.rail-btn[data-tab="tg-owner"]')) {
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'rail-btn'; b.dataset.tab = 'tg-owner'; b.title = 'Telegram';
            b.innerHTML = '<span class="rail-btn-ico">' + TG + '</span><span class="rail-btn-lbl">Telegram</span>';
            b.addEventListener('click', () => window.showTab('tg-owner', b));
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
html[data-viewer="1"] [data-viewer-hide],
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
.nr-tgo { display: grid; gap: 10px; max-width: 560px; padding: 6px 2px; }
.nr-tgo-card { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); }
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

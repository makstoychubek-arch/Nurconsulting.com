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
    const NAMES = { dashboard: 'Дашборд', rnp: 'РНП', goods: 'Товары', ads: 'Реклама', ab: 'А/Б тесты', logistics: 'Логистика', reports: 'Отчёты' };

    const V = {
        on: false,
        rows: [],
        tabs: new Set(),
        enable(rows) {
            if (!Array.isArray(rows) || !rows.length) return;
            V.on = true;
            V.rows = rows;
            const secs = new Set();
            rows.forEach(r => (r.sections || ['all']).forEach(s => secs.add(String(s))));
            const all = secs.has('all');
            V.tabs = new Set();
            Object.entries(TABS).forEach(([k, t]) => { if (all || secs.has(k)) t.forEach(x => V.tabs.add(x)); });
            V.secLabel = all ? 'все разделы' : [...secs].map(s => NAMES[s]).filter(Boolean).join(', ');
            document.documentElement.setAttribute('data-viewer', '1');
            injectCss();
            guardWrites();
            markNav();
            banner();
            new MutationObserver(() => { markNav(); banner(); }).observe(document.body, { childList: true, subtree: true });
        },
        allows(tab) { return !V.on || V.tabs.has(tab); },
        firstTab() { return ORDER.find(t => V.tabs.has(t)) || 'dashboard'; },
    };

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
        if (!host || document.getElementById('nr-viewer-banner')) return;
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
html[data-viewer="1"] [onclick*="RNP.refresh"],
html[data-viewer="1"] [onclick*="RNP.sync"],
html[data-viewer="1"] [onclick*="RNP.saveNote"],
html[data-viewer="1"] [onclick*="RNP.openNote"],
html[data-viewer="1"] [onclick*="openNoteEditor"],
html[data-viewer="1"] [onclick*="syncNow"],
html[data-viewer="1"] [onclick*="manualSync"],
html[data-viewer="1"] [onclick*="openAddCabinet"],
html[data-viewer="1"] #cabinet-add-btn { display: none !important; }
html[data-viewer="1"] .rnp-plan-input,
html[data-viewer="1"] .rnp-sheet-table input,
html[data-viewer="1"] .rnp-sheet-table textarea,
html[data-viewer="1"] #tab-goods-groups input:not([type="search"]),
html[data-viewer="1"] #tab-goods-groups select,
html[data-viewer="1"] #tab-goods-groups textarea { pointer-events: none !important; background: transparent !important; }
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

    window.NrViewer = V;
})();

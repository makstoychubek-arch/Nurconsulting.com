/* Меню с подразделами: у «Продвижения», «Логистики» и «Аналитики» выезжает панель подразделов (как у «Инструментов»),
 * а над заголовком страницы появляется цепочка «Раздел › Подраздел» с возвратом. Подпись под логотипом.
 * Панели строятся здесь до инициализации боковых панелей в dashboard.html, чтобы работали их наведение, булавка и закрытие. */
(function (root) {
    'use strict';
    var doc = root.document;
    if (!doc) return;

    var SVG = '<svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">';
    var ICO = {
        camp: '<path d="M4 10v4a1 1 0 0 0 1 1h2.5l7 4.5V5.5L7.5 10H5a1 1 0 0 0-1 0z"/><path d="M18.5 9.5a4 4 0 0 1 0 5"/>',
        give: '<rect x="3.5" y="9" width="17" height="11" rx="2"/><path d="M12 9v11M3.5 13h17M12 9c-2-4-6-3-5 0M12 9c2-4 6-3 5 0"/>',
        cont: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.7"/><path d="M4 17l5-4.5 3.5 3 3-2.5L20 17"/>',
        box: '<path d="M12 3l8 4.2v9.6L12 21l-8-4.2V7.2L12 3z"/><path d="M4.3 7.4L12 11.5l7.7-4.1M12 11.5V21"/>',
        fbs: '<rect x="3.5" y="7" width="17" height="12" rx="2"/><path d="M8 7V5h8v2"/>',
        ship: '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.5"/><circle cx="17" cy="17.5" r="1.5"/>',
        srch: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>',
        cmp: '<path d="M12 4v16M6 8h12M5 8l-2 5h4zM19 8l-2 5h4z"/>',
        rev: '<path d="M4 5h16v11H9l-5 4z"/>'
    };
    // tab: вкладка сайта; el: кнопка/вкладка подраздела, на которую нажимаем; on: как узнать, что подраздел сейчас открыт
    var SECTIONS = {
        advertising: {
            fly: 'fly-promo', title: 'Продвижение', staffOnly: false,
            items: [
                { id: 'ads', label: 'Кампании', ico: 'camp', sel: '#nr-ads-tabs [data-av="ads"]', on: '#nr-ads-tabs [data-av="ads"].is-on', dflt: true },
                { id: 'give', label: 'Раздачи', ico: 'give', sel: '#nr-ads-tabs [data-av="give"]', on: '#nr-ads-tabs [data-av="give"].is-on', staff: true },
                { id: 'content', label: 'Контент', ico: 'cont', badge: 'BETA', sel: '#nr-ads-tabs [data-av="content"]', on: '#nr-ads-tabs [data-av="content"].is-on', staff: true }
            ]
        },
        'goods-groups': {
            fly: 'fly-logi', title: 'Логистика',
            items: [
                { id: 'now', label: 'Остатки', ico: 'box', sel: '#gg-view-now-btn', on: '#gg-view-now-btn.is-on', dflt: true },
                { id: 'fbs', label: 'FBS', ico: 'fbs', sel: '#gg-view-fbs-btn', on: '#gg-view-fbs-btn.is-on' },
                { id: 'ship', label: 'Логистика', ico: 'ship', sel: '#gg-view-ship-btn', on: '#gg-view-ship-btn.is-on' }
            ]
        },
        analytics: {
            fly: 'fly-analytics', title: 'Аналитика', staffOnly: true,
            items: [
                { id: 'niches', label: 'Подбор ниш', ico: 'srch', sel: '#an-tabs [data-an="niches"]', on: '#an-tabs [data-an="niches"].on', dflt: true },
                { id: 'content', label: 'Сравнение контента', ico: 'cont', sel: '#an-tabs [data-an="content"]', on: '#an-tabs [data-an="content"].on' },
                { id: 'card', label: 'Сравнение карточки', ico: 'cmp', sel: '#an-tabs [data-an="card"]', on: '#an-tabs [data-an="card"].on' },
                { id: 'reviews', label: 'Анализ отзывов', ico: 'rev', sel: '#an-tabs [data-an="reviews"]', on: '#an-tabs [data-an="reviews"].on' }
            ]
        }
    };

    function isStaffUser() { try { return typeof isStaff !== 'undefined' && !!isStaff; } catch (e) { return false; } }
    function curTab() { try { return typeof getCurrentActiveTab === 'function' ? getCurrentActiveTab() : ''; } catch (e) { return ''; } }
    function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

    function buildFlyouts() {
        var app = doc.getElementById('sidebar-app');
        if (!app) return;
        Object.keys(SECTIONS).forEach(function (tab) {
            var s = SECTIONS[tab];
            if (doc.getElementById(s.fly)) return;
            var f = doc.createElement('div');
            f.className = 'sidebar-flyout'; f.id = s.fly; f.setAttribute('data-group', tab);
            f.innerHTML = '<div class="flyout-header"><span class="flyout-title">' + esc(s.title) + '</span></div><div class="flyout-body">' +
                s.items.map(function (it) {
                    return '<div class="nav-item" role="button" tabindex="0" data-nrn="' + tab + ':' + it.id + '"' + (it.staff ? ' data-nrn-staff="1"' : '') + '>' +
                        SVG + ICO[it.ico] + '</svg><span class="nav-item-label">' + esc(it.label) + '</span>' + (it.badge ? '<span class="nav-beta-badge">' + it.badge + '</span>' : '') + '</div>';
                }).join('') + '</div>';
            var after = doc.getElementById('fly-tools') || doc.getElementById('fly-beta');
            if (after && after.parentNode === app) app.insertBefore(f, after); else app.appendChild(f);
            var btn = doc.querySelector('.rail-btn[data-tab="' + tab + '"]');
            if (btn) btn.setAttribute('data-flyout', s.fly);
        });
        // «Агенты» живут в «Инструментах» (только команда)
        var tools = doc.querySelector('#fly-tools .flyout-body');
        if (tools && !tools.querySelector('[data-nr-agents]')) {
            var ag = doc.createElement('div');
            ag.className = 'nav-item'; ag.setAttribute('data-nr-agents', '1'); ag.setAttribute('data-staff-only', '1');
            ag.setAttribute('onclick', "showTab('agents', this)");
            ag.innerHTML = SVG + '<circle cx="9" cy="8.5" r="3.3"/><path d="M3.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5"/><path d="M16 5.4a3 3 0 0 1 0 6M17.5 14.6c2 .6 3.2 2.4 3.2 5.4"/></svg><span class="nav-item-label">Агенты</span>';
            tools.appendChild(ag);
        }
    }

    // Какой подраздел открыт сейчас в разделе tab (его id) или '' если не определить.
    function currentItem(tab) {
        var s = SECTIONS[tab]; if (!s) return '';
        for (var i = 0; i < s.items.length; i++) if (doc.querySelector(s.items[i].on)) return s.items[i].id;
        return '';
    }
    // Короткая карточка стоит на высоте своей кнопки (на телефоне панель устроена иначе и не двигается).
    function placeFly(btn) {
        try {
            if (!root.matchMedia || !root.matchMedia('(min-width: 769px)').matches) return;
            var fly = doc.getElementById(btn.getAttribute('data-flyout'));
            if (!fly || !fly.offsetParent) return;
            fly.style.top = Math.max(0, Math.round(btn.getBoundingClientRect().top - fly.offsetParent.getBoundingClientRect().top - 6)) + 'px';
        } catch (_) {}
    }
    function go(tab, id) {
        var s = SECTIONS[tab]; if (!s) return;
        var it = s.items.filter(function (x) { return x.id === id; })[0]; if (!it) return;
        try { if (tab === 'advertising' && root._advView === 'detail' && typeof headerGoBack === 'function') headerGoBack(); } catch (e) {}
        var already = curTab() === tab;
        if (!already && typeof root.showTab === 'function') root.showTab(tab, null);
        var press = function () {
            if (tab === 'advertising' && root.NrGoodsUi && root.NrGoodsUi.openAdsView) { try { root.NrGoodsUi.openAdsView(id); } catch (e) {} }
            else { var el = doc.querySelector(it.sel); if (el) el.click(); }
            refresh();
        };
        if (already) press(); else setTimeout(press, 60);
        if (root.closeSidebarMenus) root.closeSidebarMenus(false);
    }

    var crumbs = null;
    function ensureCrumbs() {
        if (crumbs && crumbs.isConnected) return crumbs;
        var host = doc.querySelector('.header-page-title'); if (!host) return null;
        crumbs = doc.createElement('div'); crumbs.className = 'nr-crumbs'; crumbs.setAttribute('aria-label', 'Где вы');
        host.insertBefore(crumbs, host.firstChild);
        return crumbs;
    }

    function refresh() {
        var tab = curTab(), staff = isStaffUser();
        // подсветка пунктов в панелях и скрытие лишних
        Object.keys(SECTIONS).forEach(function (t) {
            var s = SECTIONS[t], f = doc.getElementById(s.fly); if (!f) return;
            var cur = currentItem(t), shown = 0;
            Array.prototype.forEach.call(f.querySelectorAll('[data-nrn]'), function (n) {
                var id = n.getAttribute('data-nrn').split(':')[1];
                var it = s.items.filter(function (x) { return x.id === id; })[0];
                var show = (!it.staff || staff) && (it.dflt || !!doc.querySelector(it.sel.split(' ')[0]));
                n.style.display = show ? '' : 'none'; if (show) shown++;
                n.classList.toggle('active', tab === t && cur === id);
            });
            f.classList.toggle('nr-one', shown < 2);
        });
        // цепочка и заголовок
        var el = ensureCrumbs(); if (!el) return;
        var title = doc.getElementById('page-title');
        var s = SECTIONS[tab], label = '', secTitle = '', go1 = '';
        if (s && !(tab === 'advertising' && root._advView === 'detail')) {
            var cur = currentItem(tab) || (s.items.filter(function (x) { return x.dflt; })[0] || {}).id;
            var it = s.items.filter(function (x) { return x.id === cur; })[0];
            if (it) { label = it.label; secTitle = s.title; go1 = (s.items.filter(function (x) { return x.dflt; })[0] || it).id; }
        } else if (tab === 'ab-testing') { secTitle = 'Инструменты'; label = 'А/Б тесты'; }
        else if (tab === 'agents' || tab === 'akylai') { secTitle = 'Инструменты'; label = 'Агенты'; }
        else if (tab === 'tariffs') { secTitle = 'Настройки'; label = 'Тарифы'; go1 = '*settings'; }
        if (!label) { el.innerHTML = ''; el.classList.remove('on'); return; }
        el.classList.add('on');
        el.innerHTML = '<button type="button" class="nr-crumb" data-nrc="' + (go1 ? (go1.charAt(0) === '*' ? go1 : tab + ':' + go1) : '') + '">' + esc(secTitle) + '</button><span class="nr-crumb-sep">›</span><span class="nr-crumb-cur">' + esc(label) + '</span>';
        desired = (s && label !== secTitle) ? label : '';
        if (title && desired && title.textContent !== desired) title.textContent = desired;
        watchTitle(title);
    }
    // Другие части сайта тоже пишут заголовок страницы: возвращаем подраздел сразу, без мигания.
    var desired = '', mo = null, watched = null;
    function watchTitle(title) {
        if (!title || watched === title || !root.MutationObserver) return;
        watched = title;
        mo = new MutationObserver(function () {
            if (desired && title.textContent !== desired && SECTIONS[curTab()]) { mo.disconnect(); title.textContent = desired; mo.observe(title, { childList: true, characterData: true, subtree: true }); }
        });
        mo.observe(title, { childList: true, characterData: true, subtree: true });
    }

    function boot() {
        buildFlyouts();
        doc.addEventListener('click', function (e) {
            var n = e.target.closest && e.target.closest('[data-nrn]');
            if (n) { var p = n.getAttribute('data-nrn').split(':'); go(p[0], p[1]); return; }
            var c = e.target.closest && e.target.closest('[data-nrc]');
            if (c && c.getAttribute('data-nrc')) {
                var v = c.getAttribute('data-nrc');
                if (v.charAt(0) === '*') { if (root.showTab) root.showTab(v.slice(1), null); return; }
                var q = v.split(':'); go(q[0], q[1]); return;
            }
            setTimeout(refresh, 80);
        });
        // Нажатие на затемнение вокруг меню или Esc закрывает панель; выбор пункта в любой панели тоже закрывает её.
        doc.addEventListener('click', function (e) {
            var rb = e.target.closest && e.target.closest('#sidebar-app .rail-btn[data-flyout]');
            if (rb) placeFly(rb);
            if ((e.target === doc.documentElement || (e.target.id === 'sidebar-app')) && doc.body.classList.contains('flyout-expanded') && root.closeSidebarMenus) root.closeSidebarMenus(true);
            else if (e.target.closest && e.target.closest('.sidebar-flyout .nav-item')) setTimeout(function () { if (root.closeSidebarMenus) root.closeSidebarMenus(true); }, 0);
        });
        // На компьютере панель выезжает при наведении на кнопку раздела (с короткой паузой, чтобы не мигала от случайного проезда),
        // а уходит через секунду после того, как курсор оказался на затемнённой странице (закрытие плавное). Закреплённая и телефонная панели не трогаются.
        if (root.matchMedia && root.matchMedia('(min-width: 769px) and (hover: hover)').matches) {
            var inTimer = null, outTimer = null;
            doc.addEventListener('mouseover', function (e) {
                var t = e.target, btn = t.closest && t.closest('#sidebar-app .rail-btn[data-flyout]');
                if (btn) {
                    clearTimeout(outTimer); clearTimeout(inTimer);
                    var id = btn.getAttribute('data-flyout');
                    placeFly(btn);
                    var cur = doc.querySelector('.sidebar-flyout.visible');
                    if (cur && cur.id === id) return;
                    inTimer = setTimeout(function () { if (root.openSidebarFlyout) root.openSidebarFlyout(id); }, cur ? 40 : 90);
                    return;
                }
                if (t.closest && t.closest('#sidebar-app .sidebar-flyout, #sidebar-app .sidebar-rail')) { clearTimeout(outTimer); clearTimeout(inTimer); return; }
                clearTimeout(inTimer);
                if ((t.id === 'sidebar-app' || !(t.closest && t.closest('#sidebar-app'))) && doc.body.classList.contains('flyout-expanded')) {
                    clearTimeout(outTimer);
                    outTimer = setTimeout(function () { if (root.closeSidebarMenus) root.closeSidebarMenus(false); }, 1000);
                }
            });
        }
        doc.documentElement.addEventListener('mouseleave', function () {
            if (doc.body.classList.contains('flyout-expanded')) { clearTimeout(outTimer); outTimer = setTimeout(function () { if (root.closeSidebarMenus) root.closeSidebarMenus(false); }, 1000); }
        });
        doc.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && doc.body.classList.contains('flyout-expanded') && root.closeSidebarMenus) root.closeSidebarMenus(true);
        });
        doc.addEventListener('keydown', function (e) {
            if ((e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('[data-nrn]')) { e.preventDefault(); e.target.click(); }
        });
        // каждая смена вкладки сайта обновляет цепочку
        var orig = root.showTab;
        if (typeof orig === 'function' && !orig.__nrNav) {
            var wrapped = function () { var r = orig.apply(this, arguments); refresh(); setTimeout(refresh, 120); return r; };
            wrapped.__nrNav = true; root.showTab = wrapped;
        }
        setTimeout(refresh, 600);
        setInterval(refresh, 2500);
    }
    // Панели строим сразу (до инициализации боковых панелей), остальное когда страница готова.
    buildFlyouts();
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
    root.NrNav = { go: go, refresh: refresh };
})(typeof window !== 'undefined' ? window : globalThis);

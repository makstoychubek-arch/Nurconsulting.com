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
        rev: '<path d="M4 5h16v11H9l-5 4z"/>',
        tbl: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M9.5 10v9.5"/>',
        calc: '<rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M8.5 8h7M8.5 12h2M13.5 12h2M8.5 16h2M13.5 16h2"/>',
        price: '<path d="M4 12.5V5h7.5l8.5 8.5-7.5 7.5L4 12.5z"/><circle cx="8.5" cy="9" r="1.3"/>'
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
        rnp: {
            fly: 'fly-rnp', title: 'РНП',
            items: [
                { id: 'unit', label: 'Юнит-экономика', ico: 'calc', sel: '#rnp-views [data-rv="unit"]', on: '#rnp-views [data-rv="unit"].is-on' },
                { id: 'prices', label: 'Цены', ico: 'price', sel: '#rnp-views [data-rv="prices"]', on: '#rnp-views [data-rv="prices"].is-on' },
                { id: 'planning', label: 'Планирование', ico: 'calc', act: 'openPlanning', always: true },
                { id: 'rnp', label: 'РНП', ico: 'tbl', sel: '#rnp-views [data-rv="rnp"]', on: '#rnp-views [data-rv="rnp"].is-on', dflt: true },
                { id: 'planfact', label: 'План/факт', ico: 'tbl', act: 'openPlanFact', always: true }
            ]
        },
        analytics: {
            fly: 'fly-analytics', title: 'Аналитика', staffOnly: true,
            items: [
                { id: 'niches', label: 'Подбор ниш', ico: 'srch', sel: '#an-tabs [data-an="niches"]', on: '#an-tabs [data-an="niches"].on', dflt: true },
                { id: 'content', label: 'Сравнение контента', ico: 'cont', hidden: true, crumb: 'Инструменты', sel: '#an-tabs [data-an="content"]', on: '#an-tabs [data-an="content"].on' },
                { id: 'card', label: 'Сравнение карточки', ico: 'cmp', sel: '#an-tabs [data-an="card"]', on: '#an-tabs [data-an="card"].on' },
                { id: 'reviews', label: 'Отзывы', ico: 'rev', sel: '#an-tabs [data-an="reviews"]', on: '#an-tabs [data-an="reviews"].on' }
            ]
        }
    };

    function isStaffUser() { try { return typeof isStaff !== 'undefined' && !!isStaff; } catch (e) { return false; } }
    function curTab() { try { return typeof getCurrentActiveTab === 'function' ? getCurrentActiveTab() : ''; } catch (e) { return ''; } }
    function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

    // шторка телефона: пункты РНП открывают страницы План/факт и Планирование
    root.nrOpenRnp = function (id) {
        try { if (typeof root.closeBetaSheet === 'function') root.closeBetaSheet(); else if (typeof root.closeMobileMenu === 'function') root.closeMobileMenu(); } catch (e) { /* шторка уже закрыта */ }
        var go = function () { if (root.NrNav) root.NrNav.go('rnp', id); };
        if (curTab() !== 'rnp') root.showTab('rnp');
        go(); setTimeout(go, 700);
    };

    function buildFlyouts() {
        var app = doc.getElementById('sidebar-app');
        if (!app) return;
        Object.keys(SECTIONS).forEach(function (tab) {
            var s = SECTIONS[tab];
            if (doc.getElementById(s.fly)) return;
            var f = doc.createElement('div');
            f.className = 'sidebar-flyout'; f.id = s.fly; f.setAttribute('data-group', tab);
            f.innerHTML = '<div class="flyout-header"><span class="flyout-title">' + esc(s.title) + '</span></div><div class="flyout-body">' +
                s.items.filter(function (it) { return !it.hidden; }).map(function (it) {
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
        if (tools && !tools.querySelector('[data-nr-cmp]')) {
            var cm = doc.createElement('div');
            cm.className = 'nav-item'; cm.setAttribute('data-nr-cmp', '1'); cm.setAttribute('data-staff-only', '1'); cm.setAttribute('role', 'button'); cm.setAttribute('tabindex', '0');
            cm.setAttribute('onclick', "NrNav.go('analytics','content')");
            cm.innerHTML = SVG + ICO.cont + '</svg><span class="nav-item-label">Сравнение контента</span>';
            tools.appendChild(cm);
        }
    }

    // Какой подраздел открыт сейчас в разделе tab (его id) или '' если не определить.
    function currentItem(tab) {
        var s = SECTIONS[tab]; if (!s) return '';
        for (var i = 0; i < s.items.length; i++) if (s.items[i].on && doc.querySelector(s.items[i].on)) return s.items[i].id;
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
    // Телефон: список подразделов под кнопкой раздела (копия пунктов панели, панель на телефоне скрыта).
    function accFor(btn) {
        var fly = doc.getElementById(btn.getAttribute('data-flyout'));
        if (!fly) return null;
        var id = 'nr-acc-' + fly.id, a = doc.getElementById(id);
        if (!a) {
            a = doc.createElement('div'); a.className = 'nr-acc'; a.id = id;
            var inner = doc.createElement('div');
            Array.prototype.forEach.call(fly.querySelectorAll('.flyout-body > .nav-item'), function (n) {
                var c = n.cloneNode(true);
                Array.prototype.forEach.call(c.querySelectorAll('svg'), function (v) { v.remove(); });
                inner.appendChild(c);
            });
            a.appendChild(inner);
            btn.insertAdjacentElement('afterend', a);
            void a.offsetHeight; // без этого при первом раскрытии браузер не видит исходного состояния и анимации нет
        }
        var src = fly.querySelectorAll('.flyout-body > .nav-item'), dst = a.querySelectorAll('.nav-item');
        Array.prototype.forEach.call(dst, function (d, i) {
            d.classList.toggle('active', !!(src[i] && src[i].classList.contains('active')));
            // «Раздачи» и «Контент» только для команды; полоска на странице создаётся позже, поэтому смотрим на статус, а не на неё
            d.style.display = d.hasAttribute('data-nrn-staff') && !isStaffUser() ? 'none' : '';
        });
        return a;
    }
    function go(tab, id) {
        var s = SECTIONS[tab]; if (!s) return;
        var it = s.items.filter(function (x) { return x.id === id; })[0]; if (!it) return;
        if (!it.act) { try { localStorage.setItem('nr_sub_' + tab, id); } catch (_) { /* без памяти */ } }
        try { if (tab === 'advertising' && root._advView === 'detail' && typeof headerGoBack === 'function') headerGoBack(); } catch (e) {}
        var already = curTab() === tab;
        if (!already && typeof root.showTab === 'function') root.showTab(tab, null);
        var press = function () {
            if (it.act) { try { if (root.RNP && typeof root.RNP[it.act] === 'function') root.RNP[it.act](); } catch (e) { /* окно не открылось */ } refresh(); return; }
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

    // Подраздел помним: после обновления страницы человек остаётся там, где был (например, Аналитика → Сравнение контента), а не в первом подразделе.
    var restored = {};
    function memKey(tab) { return 'nr_sub_' + tab; }
    function remember(e) {
        if (!e.isTrusted || !e.target || !e.target.closest) return;
        Object.keys(SECTIONS).forEach(function (t) {
            SECTIONS[t].items.forEach(function (it) {
                var sel = it.sel ? it.sel.split(',')[0] : '';
                try { if (sel && e.target.closest(sel)) localStorage.setItem(memKey(t), it.id); } catch (_) { /* без памяти */ }
            });
        });
    }
    doc.addEventListener('click', remember, true);
    function restore(tab) {
        var s = SECTIONS[tab]; if (!s || restored[tab]) return;
        var present = s.items.some(function (it) { return it.sel && doc.querySelector(it.sel); });
        if (!present) return;           // подразделы ещё не нарисованы: попробуем на следующем проходе
        restored[tab] = true;
        var id = ''; try { id = localStorage.getItem(memKey(tab)) || ''; } catch (_) { /* без памяти */ }
        var it = s.items.filter(function (x) { return x.id === id; })[0];
        if (!it || !it.sel || doc.querySelector(it.on)) return;
        var el = doc.querySelector(it.sel);
        if (el && typeof el.click === 'function') el.click();
    }
    function refresh() {
        var tab = curTab(), staff = isStaffUser();
        restore(tab);
        // подсветка пунктов в панелях и скрытие лишних
        Object.keys(SECTIONS).forEach(function (t) {
            var s = SECTIONS[t], f = doc.getElementById(s.fly); if (!f) return;
            var cur = currentItem(t), shown = 0;
            Array.prototype.forEach.call(f.querySelectorAll('[data-nrn]'), function (n) {
                var id = n.getAttribute('data-nrn').split(':')[1];
                var it = s.items.filter(function (x) { return x.id === id; })[0];
                var show = (!it.staff || staff) && (it.dflt || it.always || !!doc.querySelector(it.sel.split(' ')[0]));
                n.style.display = show ? '' : 'none'; if (show) shown++;
                n.classList.toggle('active', tab === t && cur === id);
            });
            f.classList.toggle('nr-one', shown < 2);
        });
        var cmpItem = doc.querySelector('[data-nr-cmp]'); if (cmpItem) cmpItem.classList.toggle('active', tab === 'analytics' && currentItem('analytics') === 'content');
        // цепочка и заголовок
        var el = ensureCrumbs(); if (!el) return;
        var title = doc.getElementById('page-title');
        var s = SECTIONS[tab], label = '', secTitle = '', go1 = '';
        if (s && !(tab === 'advertising' && root._advView === 'detail')) {
            var cur = currentItem(tab) || (s.items.filter(function (x) { return x.dflt; })[0] || {}).id;
            var it = s.items.filter(function (x) { return x.id === cur; })[0];
            if (it) { label = (tab === 'rnp' && it.id === 'rnp') ? '' : it.label; secTitle = it.crumb || s.title; go1 = (s.items.filter(function (x) { return x.dflt; })[0] || it).id; }
        } else if (tab === 'ab-testing') { secTitle = 'Инструменты'; label = 'А/Б тесты'; }
        else if (tab === 'agents' || tab === 'akylai') { secTitle = 'Инструменты'; label = 'Агенты'; }
        else if (tab === 'tariffs') { secTitle = 'Настройки'; label = 'Тарифы'; go1 = '*settings'; }
        // Подраздела нет (например, основной РНП): забываем подраздел прошлой вкладки, иначе наблюдатель вернёт его в заголовок
        if (!label) { desired = ''; el.innerHTML = ''; el.classList.remove('on'); return; }
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

    // Состояния страницы (календарь, список кабинетов, окна, раздел) выставляются классами на <html>.
    // Раньше стили ждали их через html:has(...): браузер перепроверял весь документ на каждое изменение страницы
    // (до 0,5 с пересчёта стилей при открытии «Продвижения» на слабом телефоне).
    function initFlags() {
        var h = doc.documentElement; if (!h.id) h.id = 'nr-root';
        // живые коллекции по классу: браузер ведёт их сам, обращение почти бесплатно (querySelector по всему дереву на каждом кадре был заметен)
        var cOpen = doc.getElementsByClassName('open'), rowOpen = doc.getElementsByClassName('adp2-row open'), isOpen = doc.getElementsByClassName('is-open');
        var OPEN_IS = ['rnp-settings-overlay', 'rnp-plan-fact-overlay', 'rnp-photo-lightbox'], MODALS = ['add-cabinet-modal', 'autobidder-modal', 'supply-detail-modal'];
        function put(c, on) { if (h.classList.contains(c) !== on) h.classList.toggle(c, on); }
        function has(id, cls) { var e = doc.getElementById(id); return !!e && e.classList.contains(cls); }
        function anyCab() { for (var i = 0; i < cOpen.length; i++) if (cOpen[i].classList.contains('cabinet-picker')) return true; return false; }
        function anyOverlay() {
            for (var i = 0; i < isOpen.length; i++) { var e = isOpen[i]; if (e.id === 'premium-modal') return true; for (var j = 0; j < OPEN_IS.length; j++) if (e.classList.contains(OPEN_IS[j])) return true; }
            for (var k = 0; k < MODALS.length; k++) { var m = doc.getElementById(MODALS[k]); if (m && !m.classList.contains('hidden')) return true; }
            return false;
        }
        function sync() {
            var dp = doc.getElementById('date-picker'), pu = doc.getElementById('adv-pulse');
            put('nr-f-dp', !!dp && !dp.classList.contains('hidden'));
            put('nr-f-cab', anyCab());
            put('nr-f-adv', has('tab-advertising', 'active'));
            put('nr-f-gear', has('adv-view-ads', 'ads-gear-open'));
            put('nr-f-row', rowOpen.length > 0);
            put('nr-f-dash', has('tab-dashboard', 'active'));
            put('nr-f-pulse', !!pu && pu.childElementCount > 0);
            put('nr-f-drawer', has('sidebar-app', 'mobile-open'));
            put('nr-f-ov', anyOverlay());
        }
        var raf = 0;
        function later() { if (raf) return; raf = (root.requestAnimationFrame || root.setTimeout)(function () { raf = 0; sync(); }); }
        sync();
        if (!root.MutationObserver) return;
        new MutationObserver(later).observe(doc.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
        function watchPulse() { var pu = doc.getElementById('adv-pulse'); if (pu) { new MutationObserver(later).observe(pu, { childList: true }); return true; } return false; }
        if (!watchPulse()) setTimeout(watchPulse, 1500);
        root.NrFlags = { sync: sync };
    }
    function boot() {
        buildFlyouts();
        initFlags();
        // Страница не должна уезжать вбок (фокус, выделение мышью, прокрутка к элементу): возвращаем на место.
        doc.addEventListener('scroll', function (e) {
            var t = e.target;
            if (t && t !== doc && t.scrollLeft && t.matches && t.matches('.dashboard-app-shell, .main-rail, .main-content, .tab-content, .rnp-workspace')) t.scrollLeft = 0;
            else if ((t === doc || t === doc.documentElement) && root.scrollX) root.scrollTo(0, root.scrollY);
        }, true);
        // Подпись у кнопок меню уже видна, всплывающий ярлык браузера дублирует её.
        doc.querySelectorAll('#sidebar-app .rail-btn[title]').forEach(function (b) { b.removeAttribute('title'); });
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
        // Телефон: подразделы раскрываются прямо под кнопкой раздела (по одному за раз), пункты ниже плавно сдвигаются.
        doc.addEventListener('click', function (e) {
            if (!root.matchMedia || !root.matchMedia('(max-width: 768px)').matches) return;
            var sub = e.target.closest && e.target.closest('.nr-acc .nav-item');
            if (sub) { setTimeout(function () { if (root.closeMobileMenu) root.closeMobileMenu(); }, 0); return; }
            var rb = e.target.closest && e.target.closest('#sidebar-app .rail-btn[data-flyout]');
            Array.prototype.forEach.call(doc.querySelectorAll('.nr-acc.open'), function (o) { if (!rb || o.previousElementSibling !== rb) o.classList.remove('open'); });
            if (!rb) return;
            // Нажатие на раздел с подразделами только раскрывает список (страница и меню остаются на месте)
            e.stopPropagation();
            var a = accFor(rb); if (!a) return;
            a.classList.toggle('open');
            rb.classList.toggle('nr-acc-on', a.classList.contains('open'));
        }, true);
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
                    inTimer = setTimeout(function () { if (root.openSidebarFlyout) root.openSidebarFlyout(id); }, cur ? 0 : 40);
                    return;
                }
                if (t.closest && t.closest('#sidebar-app .sidebar-flyout, #sidebar-app .sidebar-rail')) { clearTimeout(outTimer); clearTimeout(inTimer); return; }
                clearTimeout(inTimer);
                if ((t.id === 'sidebar-app' || !(t.closest && t.closest('#sidebar-app'))) && doc.body.classList.contains('flyout-expanded')) {
                    clearTimeout(outTimer);
                    outTimer = setTimeout(function () { if (root.closeSidebarMenus) root.closeSidebarMenus(false); }, 80);
                }
            });
        }
        doc.documentElement.addEventListener('mouseleave', function () {
            if (doc.body.classList.contains('flyout-expanded')) { clearTimeout(outTimer); outTimer = setTimeout(function () { if (root.closeSidebarMenus) root.closeSidebarMenus(false); }, 80); }
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
        setInterval(function () { if (!doc.hidden) refresh(); }, 2500);
    }
    // Панели строим сразу (до инициализации боковых панелей), остальное когда страница готова.
    buildFlyouts();
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
    root.NrNav = { go: go, refresh: refresh };

    // Телефон: полоска подразделов (Аналитика, Продвижение, Товары) показывает только выбранный, остальные раскрываются по нажатию на него.
    (function () {
        var SEL = '#an-tabs, #nr-ads-tabs, .gg-views, #rnp-views';
        function mark() { Array.prototype.forEach.call(doc.querySelectorAll(SEL), function (b) { b.classList.add('nr-subbar'); }); }
        mark();
        doc.addEventListener('click', function (e) {
            if (!root.matchMedia || !root.matchMedia('(max-width: 768px)').matches) return;
            var bar = e.target.closest && e.target.closest('.nr-subbar'); 
            Array.prototype.forEach.call(doc.querySelectorAll('.nr-subbar.nr-open'), function (x) { if (x !== bar || !e.target.closest('.on, .is-on')) x.classList.remove('nr-open'); });
            if (!bar) return;
            var btn = e.target.closest('button'); if (!btn || btn.parentNode !== bar) return;
            if (btn.classList.contains('on') || btn.classList.contains('is-on')) { e.stopPropagation(); e.preventDefault(); bar.classList.toggle('nr-open'); }
        }, true);
        var mt = 0; new MutationObserver(function () { if (mt) return; mt = setTimeout(function () { mt = 0; mark(); }, 300); }).observe(doc.body || doc.documentElement, { childList: true, subtree: true });
    })();

    // ── Переключатель площадки «WB | Ozon | Вместе» (РНП и Дашборд). По умолчанию WB; выбор помнится на устройстве.
    (function () {
        var KEY = 'nr_mp', MODES = ['wb', 'ozon', 'all'], LBL = { wb: 'WB', ozon: 'Ozon', all: 'Вместе' };
        var cur = 'wb', subs = [];
        try { var v = localStorage.getItem(KEY); if (MODES.indexOf(v) >= 0) cur = v; } catch (_) { /* без памяти */ }
        function paint() {
            var bar = doc.getElementById('nr-mp'); if (!bar) return;
            Array.prototype.forEach.call(bar.querySelectorAll('button'), function (b) {
                var on = b.getAttribute('data-mp') === cur; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
            });
            doc.documentElement.setAttribute('data-mp', cur);
        }
        function set(m) {
            if (MODES.indexOf(m) < 0 || m === cur) return;
            cur = m; try { localStorage.setItem(KEY, m); } catch (_) { /* без памяти */ }
            paint();
            subs.slice().forEach(function (f) { try { f(m); } catch (e) { if (root.console) console.error('[NrMp]', e); } });
            try { doc.dispatchEvent(new CustomEvent('nr-mp-change', { detail: { mp: m } })); } catch (_) { /* старый браузер */ }
        }
        root.NrMp = { get: function () { return cur; }, set: set, onChange: function (f) { subs.push(f); }, label: function (m) { return LBL[m || cur]; } };
        // ПК: в шапке сразу справа от даты. Телефон: шапка тесная, поэтому отдельной строкой над содержимым.
        function place(bar) {
            var phone = root.matchMedia && root.matchMedia('(max-width: 768px)').matches;
            var date = doc.getElementById('header-date-chip-wrap'), host = doc.querySelector('.main-content');
            if (phone && host) { if (bar.parentNode !== host || host.firstChild !== bar) host.insertBefore(bar, host.firstChild); }
            else if (date && date.parentNode) { if (date.nextSibling !== bar) date.parentNode.insertBefore(bar, date.nextSibling); }
        }
        if (root.addEventListener) root.addEventListener('resize', function () { var b = doc.getElementById('nr-mp'); if (b) place(b); });
        function mount() {
            var anchor = doc.getElementById('header-date-chip-wrap') || doc.getElementById('nr-zoom'); if (!anchor || doc.getElementById('nr-mp')) { paint(); return; }
            var bar = doc.createElement('div'); bar.id = 'nr-mp'; bar.className = 'nr-mp'; bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'Площадка');
            bar.innerHTML = MODES.map(function (m) { return '<button type="button" data-mp="' + m + '">' + LBL[m] + '</button>'; }).join('');
            bar.addEventListener('click', function (e) { var b = e.target.closest('button[data-mp]'); if (b) set(b.getAttribute('data-mp')); });
            place(bar); paint();
        }
        if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', mount); else mount();
        var mt = 0; new MutationObserver(function () { if (mt || doc.getElementById('nr-mp')) return; mt = setTimeout(function () { mt = 0; mount(); }, 200); }).observe(doc.body || doc.documentElement, { childList: true, subtree: true });
    })();
})(typeof window !== 'undefined' ? window : globalThis);

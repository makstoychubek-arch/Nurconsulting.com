/**
 * Темы с «живым» фоном: Живая светлая (светлая + медленно плывущие пятна) и Flow тёмная (сдержанная).
 * Основа остаётся прежней: data-theme = ios | neon | tabler. Живой фон — отдельный атрибут data-bg на <html>
 * (live | flow), слой #nr-bg и стили в rnp-extra.css. Выбор темы — выпадающий список вместо переключения по кругу.
 */
(function (root) {
    'use strict';
    var doc = root.document;
    if (!doc) return;
    var html = doc.documentElement;
    var OPTS = [
        { id: 'light', label: 'Светлая', theme: 'ios', bg: '', sw: '#f4f5f8' },
        { id: 'dark', label: 'Тёмная', theme: 'neon', bg: '', sw: '#1c1c1e' },
        { id: 'live', label: 'Живая светлая', theme: 'ios', bg: 'live', sw: 'linear-gradient(135deg,#bcd9ff,#e4d7ff,#ffe3c7)' },
        { id: 'flow', label: 'Flow тёмная', theme: 'neon', bg: 'flow', sw: 'linear-gradient(135deg,#050506,#3a2a1a 60%,#12263f)' },
        { id: 'tabler', label: 'Tabler', theme: 'tabler', bg: '', sw: '#066fd1' },
    ];
    function lsGet(k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { root.localStorage.setItem(k, v); } catch (e) {} }
    function savedBg() { var b = lsGet('nr_bg'); return b === 'live' || b === 'flow' ? b : ''; }
    function current() {
        var t = html.getAttribute('data-theme') || 'ios', b = html.getAttribute('data-bg') || '';
        for (var i = 0; i < OPTS.length; i++) if (OPTS[i].theme === t && OPTS[i].bg === b) return OPTS[i];
        return OPTS[0];
    }

    function ensureLayer() {
        if (doc.getElementById('nr-bg') || !doc.body) return;
        var d = doc.createElement('div');
        d.id = 'nr-bg'; d.setAttribute('aria-hidden', 'true');
        d.innerHTML = '<i></i><i></i><i></i>';
        doc.body.insertBefore(d, doc.body.firstChild);
    }

    // Живой фон допустим только на своей базе: live — на светлой, flow — на тёмной.
    function syncBg() {
        var theme = html.getAttribute('data-theme') || 'ios', want = savedBg();
        var ok = (want === 'live' && theme === 'ios') || (want === 'flow' && theme === 'neon');
        if (ok) { ensureLayer(); html.setAttribute('data-bg', want); } else html.removeAttribute('data-bg');
        var label = current().label;
        Array.prototype.forEach.call(doc.querySelectorAll('.beta-theme-label'), function (el) { el.textContent = label; });
        var meta = doc.querySelector('meta[name="theme-color"]');
        if (meta && ok) meta.setAttribute('content', want === 'flow' ? '#050506' : '#F4F5F8');
    }

    function choose(opt) {
        lsSet('nr_bg', opt.bg);
        var run = function () { (root.applyTheme || function () {})(opt.theme); syncBg(); };
        var reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!reduce && doc.startViewTransition) doc.startViewTransition(run); else run();
    }

    var pop = null, closedAt = 0;
    function closeMenu() { if (pop) { pop.remove(); pop = null; closedAt = Date.now(); } doc.removeEventListener('click', onDoc, true); doc.removeEventListener('keydown', onKey, true); }
    function onDoc(e) { if (pop && !pop.contains(e.target)) closeMenu(); }
    function onKey(e) { if (e.key === 'Escape') closeMenu(); }

    function openMenu(anchor) {
        if (pop) { closeMenu(); return; }
        if (Date.now() - closedAt < 250) return; // клик по той же кнопке закрывает, а не открывает заново
        var cur = current().id;
        pop = doc.createElement('div');
        pop.className = 'nrt-pop'; pop.setAttribute('role', 'menu');
        pop.innerHTML = '<div class="nrt-h">ТЕМА</div>' + OPTS.map(function (o) {
            return '<button type="button" class="nrt-opt' + (o.id === cur ? ' on' : '') + '" data-id="' + o.id + '" role="menuitemradio" aria-checked="' + (o.id === cur) + '">' +
                '<span class="nrt-sw" style="background:' + o.sw + '"></span><span>' + o.label + '</span><b>✓</b></button>';
        }).join('');
        doc.body.appendChild(pop);
        var r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : null;
        var pw = pop.offsetWidth, ph = pop.offsetHeight, vw = root.innerWidth, vh = root.innerHeight;
        var left, top;
        if (r && vw > 760) {
            left = r.right + 10; top = r.bottom - ph;
            if (left + pw > vw - 8) left = Math.max(8, r.left - pw - 10);
        } else { left = Math.max(8, (vw - pw) / 2); top = vh - ph - 84; }
        pop.style.left = Math.round(left) + 'px';
        pop.style.top = Math.round(Math.max(8, Math.min(top, vh - ph - 8))) + 'px';
        pop.addEventListener('click', function (e) {
            var b = e.target.closest('.nrt-opt'); if (!b) return;
            var o = OPTS.filter(function (x) { return x.id === b.getAttribute('data-id'); })[0];
            closeMenu(); if (o) choose(o);
        });
        setTimeout(function () { doc.addEventListener('click', onDoc, true); doc.addEventListener('keydown', onKey, true); }, 0);
    }

    // Страница уже выполнила свой скрипт (applyTheme, toggleTheme): подменяем после DOMContentLoaded.
    function install() {
        var base = root.applyTheme;
        if (typeof base === 'function' && !base._nrt) {
            root.applyTheme = function (theme) { base.apply(this, arguments); syncBg(); };
            root.applyTheme._nrt = true;
        }
        root.toggleTheme = function () {
            var ev = root.event, a = ev && (ev.currentTarget || ev.target);
            if (a && a.closest) a = a.closest('button,.beta-theme-row,[role="button"]') || a;
            openMenu(a);
        };
        syncBg();
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', install); else install();
    root.NrThemes = { choose: choose, options: OPTS, current: current };
})(typeof window !== 'undefined' ? window : globalThis);

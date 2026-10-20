/* NR Motion JS: счётчик чисел, плашка вкладок, удержание, копирование, свайп, конфетти. */
(function (root) {
    'use strict';
    var doc = root.document;
    var reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function easeOut(t) { return 1 - Math.pow(1 - t, 4); }
    /* Число плавно меняется; рост подсвечивается зелёным, падение красным */
    function count(el, to, o) {
        o = o || {};
        var from = parseFloat(el.getAttribute('data-v')); if (isNaN(from)) from = o.from != null ? o.from : 0;
        var fmt = o.format || function (v) { return Math.round(v).toLocaleString('ru-RU'); };
        el.setAttribute('data-v', to);
        if (reduce || from === to) { el.textContent = fmt(to); return; }
        var t0 = null, dur = o.duration || 900;
        el.classList.remove('nrm-up', 'nrm-down'); void el.offsetWidth;
        if (o.flash !== false && from !== to && el.__nrmSeen) el.classList.add(to > from ? 'nrm-up' : 'nrm-down');
        el.__nrmSeen = true;
        function step(ts) { if (t0 == null) t0 = ts; var p = Math.min(1, (ts - t0) / dur); el.textContent = fmt(from + (to - from) * easeOut(p)); if (p < 1) root.requestAnimationFrame(step); }
        root.requestAnimationFrame(step);
    }
    /* Слот-машина: цифры крутятся барабанами и останавливаются по очереди справа налево */
    function slot(el, text, o) {
        o = o || {};
        text = String(text);
        var old = el.getAttribute('data-slot'); if (old == null) old = el.textContent || '';
        el.setAttribute('data-slot', text);
        if (reduce || old === text || !el.offsetParent) { el.textContent = text; return; }
        var a = old.split(''), b = text.split(''), n = b.length, dur = o.duration || 900, gap = 70;
        el.textContent = '';
        el.classList.remove('nrm-up', 'nrm-down'); void el.offsetWidth;
        if (o.flash) el.classList.add(o.flash === 'down' ? 'nrm-down' : 'nrm-up');
        var strips = [];
        b.forEach(function (ch, i) {
            if (!/\d/.test(ch)) { el.appendChild(doc.createTextNode(ch)); return; }
            var oc = a[a.length - n + i], from = /\d/.test(oc || '') ? +oc : Math.floor(Math.random() * 10), to = +ch;
            var steps = ((to - from + 10) % 10) + 10, reel = doc.createElement('span'), strip = doc.createElement('span');
            reel.className = 'nrm-reel'; strip.className = 'nrm-strip';
            for (var k = 0; k <= steps; k++) { var d = doc.createElement('span'); d.textContent = String((from + k) % 10); strip.appendChild(d); }
            reel.appendChild(strip); el.appendChild(reel); strips.push([strip, steps, n - 1 - i]);
        });
        void el.offsetWidth;
        strips.forEach(function (x) {
            x[0].style.transition = 'transform ' + (dur + x[2] * gap) + 'ms cubic-bezier(.2,.8,.2,1)';
            x[0].style.transform = 'translateY(-' + x[1] + 'em)';
        });
        clearTimeout(el.__nrmSlotT);
        el.__nrmSlotT = setTimeout(function () { el.textContent = text; }, dur + n * gap + 80);
    }
    /* Плашка скользит под активной вкладкой */
    function pill(box, onChange) {
        var p = box.querySelector('.pill') || box.appendChild(Object.assign(doc.createElement('span'), { className: 'pill' }));
        function place(btn) { p.style.width = btn.offsetWidth + 'px'; p.style.transform = 'translateX(' + (btn.offsetLeft) + 'px)'; }
        box.querySelectorAll('button').forEach(function (b) { b.addEventListener('click', function () { box.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); }); place(b); onChange && onChange(b); }); });
        var on = box.querySelector('button.on') || box.querySelector('button'); on.classList.add('on'); place(on);
    }
    /* Удержать кнопку, чтобы подтвердить опасное действие */
    function hold(btn, onDone, ms) {
        ms = ms || 900; var t = null;
        if (!btn.querySelector('i')) btn.appendChild(doc.createElement('i'));
        function start(e) { e.preventDefault(); btn.classList.add('holding'); t = setTimeout(function () { btn.classList.remove('holding'); onDone && onDone(); }, ms); }
        function stop() { clearTimeout(t); btn.classList.remove('holding'); }
        btn.addEventListener('pointerdown', start); ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { btn.addEventListener(ev, stop); });
    }
    function copy(btn, text) {
        btn.addEventListener('click', function () { try { root.navigator.clipboard && root.navigator.clipboard.writeText(text); } catch (e) {} btn.classList.add('done'); setTimeout(function () { btn.classList.remove('done'); }, 1600); });
    }
    /* Смахнуть карточку вбок, чтобы убрать */
    function drag(el, onGone) {
        var x0 = null, dx = 0;
        el.classList.add('nrm-drag');
        el.addEventListener('pointerdown', function (e) { x0 = e.clientX; dx = 0; el.classList.add('dragging'); el.setPointerCapture(e.pointerId); });
        el.addEventListener('pointermove', function (e) { if (x0 == null) return; dx = e.clientX - x0; el.style.transform = 'translateX(' + dx + 'px)'; el.style.opacity = String(1 - Math.min(.7, Math.abs(dx) / 300)); });
        function end() { if (x0 == null) return; x0 = null; el.classList.remove('dragging'); if (Math.abs(dx) > 110) { el.classList.add('gone'); el.style.transform = 'translateX(' + (dx > 0 ? 400 : -400) + 'px)'; setTimeout(function () { onGone && onGone(); }, 260); } else { el.style.transition = 'transform .3s cubic-bezier(.34,1.56,.64,1),opacity .3s'; el.style.transform = ''; el.style.opacity = ''; setTimeout(function () { el.style.transition = ''; }, 320); } }
        el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    }
    /* Конфетти (лёгкое, на canvas) */
    function confetti(x, y, n) {
        if (reduce) return;
        var c = doc.createElement('canvas'); c.width = root.innerWidth; c.height = root.innerHeight; c.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:100005';
        doc.body.appendChild(c); var g = c.getContext('2d'), P = [], cols = ['#f97316', '#3b82f6', '#16a34a', '#eab308', '#ec4899'];
        for (var i = 0; i < (n || 60); i++) { var a = Math.random() * Math.PI * 2, s = 4 + Math.random() * 7; P.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 4, r: 3 + Math.random() * 4, c: cols[i % 5], rot: Math.random() * 6, life: 1 }); }
        (function tick() { g.clearRect(0, 0, c.width, c.height); var alive = false; P.forEach(function (p) { p.vy += .28; p.x += p.vx; p.y += p.vy; p.vx *= .99; p.life -= .014; if (p.life > 0) { alive = true; g.globalAlpha = Math.max(0, p.life); g.fillStyle = p.c; g.save(); g.translate(p.x, p.y); g.rotate(p.rot += .1); g.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); g.restore(); } }); if (alive) root.requestAnimationFrame(tick); else c.remove(); })();
    }
    /* Тряска поля или кнопки */
    function shake(el) { if (!el || reduce) return; el.classList.remove('nrm-shake'); void el.offsetWidth; el.classList.add('nrm-shake'); setTimeout(function () { el.classList.remove('nrm-shake'); }, 500); }
    /* Невалидное поле встряхивается само */
    doc.addEventListener('invalid', function (e) { var t = e.target; if (t && t.classList) { shake(t); t.classList.add('nrm-bad'); t.addEventListener('input', function f() { t.classList.remove('nrm-bad'); t.removeEventListener('input', f); }); } }, true);
    /* Числа в карточках показателей плавно меняются на месте, рост зелёным, падение красным */
    var NUM = /^([^\d\-−]*)([−\-]?\d(?:[\d\s\u00a0.,]*\d)?)(.*)$/;
    function parseNum(s) { var m = NUM.exec(s); if (!m) return null; var raw = m[2].replace(/[\s\u00a0]/g, ''); var dec = /[.,](\d+)$/.exec(raw); var v = parseFloat(raw.replace(/^−/, '-').replace(',', '.')); if (isNaN(v)) return null; return { pre: m[1], suf: m[3], v: v, dec: dec ? dec[1].length : 0, sep: /\u00a0/.test(m[2]) ? '\u00a0' : (/ /.test(m[2]) ? ' ' : ''), comma: /,\d+$/.test(raw) }; }
    function fmtNum(p, v) { var neg = v < 0, a = Math.abs(v).toFixed(p.dec), parts = a.split('.'); if (p.sep) parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, p.sep); return p.pre + (neg ? '-' : '') + parts.join(p.comma ? ',' : '.') + p.suf; }
    var VAL = '.metric-card-value,.kpi-hero-value,.adv-kpi-tile-value,.ads-hq-kpi-value', busy = false;
    function watchValues() {
        if (reduce || !root.MutationObserver) return;
        var prev = new WeakMap();
        new MutationObserver(function (list) {
            if (busy) return;
            list.forEach(function (m) {
                var el = (m.target.nodeType === 3 ? m.target.parentNode : m.target); if (!el || !el.closest) return; el = el.closest(VAL); if (!el || el.children.length) return;
                var now = el.textContent, was = prev.get(el); prev.set(el, now);
                if (was == null || was === now) return;
                var a = parseNum(was), b = parseNum(now);
                if (!a || !b || a.pre !== b.pre || a.suf !== b.suf || a.v === b.v || el.offsetParent === null) return;
                busy = true; var t0 = null, dur = 700;
                el.classList.remove('nrm-up', 'nrm-down'); void el.offsetWidth; el.classList.add(b.v > a.v ? 'nrm-up' : 'nrm-down');
                (function step(ts) { if (t0 == null) t0 = ts; var p = Math.min(1, (ts - t0) / dur); busy = true; el.textContent = fmtNum(b, a.v + (b.v - a.v) * easeOut(p)); setTimeout(function () { busy = false; }, 0); if (p < 1) root.requestAnimationFrame(step); else { el.textContent = now; prev.set(el, now); } })(performance.now());
            });
        }).observe(doc.body, { childList: true, characterData: true, subtree: true });
        doc.querySelectorAll(VAL).forEach(function (e) { prev.set(e, e.textContent); });
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', watchValues); else watchValues();
    /* Прокрутка после F5: запоминаем место у каждого прокручиваемого блока и возвращаем, когда контент дорисован.
     * Только для «Обновить страницу»: переход по ссылке всегда открывает страницу сверху. */
    (function keepScroll() {
        var KEY = 'nr_scroll_v1:' + location.pathname, st = {}, isReload = false;
        try { var nv = performance.getEntriesByType('navigation')[0]; isReload = !!nv && nv.type === 'reload'; } catch (e) { /* нет API */ }
        try { if (isReload) st = JSON.parse(sessionStorage.getItem(KEY) || '{}') || {}; else sessionStorage.removeItem(KEY); } catch (e) { st = {}; }
        var saved = {}; Object.keys(st).forEach(function (k) { saved[k] = st[k]; });
        function idOf(el) {
            if (!el || el === doc || el === doc.documentElement || el === doc.body || el === doc.scrollingElement) return '#win';
            if (el.id) return '#' + el.id;
            var cl = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(function (x) { return /^[A-Za-z0-9_-]+$/.test(x); }) : [];
            return cl.length ? el.tagName.toLowerCase() + '.' + cl.join('.') : null;
        }
        var timer = 0;
        doc.addEventListener('scroll', function (ev) {
            var id = idOf(ev.target); if (!id) return;
            st[id] = Math.round(id === '#win' ? (root.pageYOffset || 0) : ev.target.scrollTop);
            clearTimeout(timer);
            timer = setTimeout(function () { try { sessionStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* без хранилища не запомним */ } }, 250);
        }, true);
        if (!isReload) return;
        var stop = false, tries = 0;
        ['wheel', 'touchstart', 'mousedown', 'keydown'].forEach(function (t) { doc.addEventListener(t, function () { stop = true; }, { passive: true, capture: true, once: true }); });
        function find(id) {
            if (id === '#win') return doc.scrollingElement || doc.documentElement;
            var list = doc.querySelectorAll(id), i;
            for (i = 0; i < list.length; i++) if (list[i].offsetParent !== null) return list[i];
            return null;
        }
        (function tick() {
            if (stop || ++tries > 30) return;
            Object.keys(saved).forEach(function (id) {
                var top = saved[id]; if (!(top > 0)) { delete saved[id]; return; }
                var el = find(id);
                if (el && el.scrollHeight - el.clientHeight >= top - 2) { el.scrollTop = top; delete saved[id]; }
            });
            if (Object.keys(saved).length) setTimeout(tick, 200);
        })();
    })();
    /* Телефон: кнопка меню слева в шапке открывает ту же боковую панель, что и на сайте */
    (function () {
        document.addEventListener('click', function (e) {
            var t = e.target; if (!t || !t.closest || !root.innerWidth || root.innerWidth > 768) return;
            var sb = document.getElementById('sidebar-app'), ov = document.getElementById('mobile-overlay');
            if (!sb) return;
            if (t.closest('#mobile-menu-btn')) {
                e.stopPropagation(); e.preventDefault();
                var open = sb.classList.toggle('mobile-open');
                if (ov) ov.classList.toggle('active', open);
                return;
            }
            if (sb.classList.contains('mobile-open') && t.closest('#sidebar-app .rail-btn[data-flyout="fly-beta"]')) {
                e.stopPropagation(); e.preventDefault();
                if (root.closeMobileMenu) root.closeMobileMenu();
                if (root.toggleBetaSheet) root.toggleBetaSheet();
                return;
            }
            if (sb.classList.contains('mobile-open') && t.closest('#sidebar-app .rail-btn')) setTimeout(function () { if (root.closeMobileMenu) root.closeMobileMenu(); }, 60);
        }, true);
    })();
    /* Телефон в портрете: страница на 8% мельче (шире окно вёрстки); в ландшафте обычный масштаб */
    (function () {
        function fit() {
            var m = document.getElementById('nr-vp'); if (!m || !root.screen) return;
            var phone = Math.min(root.screen.width, root.screen.height) < 500;
            var portrait = root.innerHeight > root.innerWidth;
            m.setAttribute('content', 'width=' + (phone && portrait ? Math.round(Math.min(root.screen.width, root.screen.height) / 0.92) : 'device-width') + ',viewport-fit=cover');
        }
        root.addEventListener('orientationchange', function () { setTimeout(fit, 250); });
    })();
    root.NrMotion = { shake: shake, count: count, slot: slot, pill: pill, hold: hold, copy: copy, drag: drag, confetti: confetti };
})(typeof window !== 'undefined' ? window : globalThis);

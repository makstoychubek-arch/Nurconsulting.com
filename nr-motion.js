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
    /* Дашборд на телефоне: компактный вид (как в WB). Числа берём из уже посчитанных блоков дашборда,
       баланс и «к выводу» читаем из базы в фоне; на экране всё остаётся, пока подтягивается новое. */
    (function () {
        var doc = document, mq = root.matchMedia ? root.matchMedia('(max-width: 768px)') : null;
        if (!mq) return;
        var S = { tab: 'orders', money: {}, last: '' };
        var ICON = {
            chart: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2v10h10A10 10 0 0 0 12 2z"/><path d="M10 4a9 9 0 1 0 10 10H10z"/></svg>',
            ad: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 3c4 0 7 3 7 7-3 0-5 1-7 3l-3-3c2-2 3-4 3-7zM5 14l5 5c-2 1-5 1-7 0 0-2 0-4 2-5z"/></svg>',
            box: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l5 3-5 3-5-3zM7 7l5 3v6l-5-3zM17 7v6l-5 3v-6zM2 13l5 3v5l-5-3zM12 17l5-3 5 3-5 3z"/></svg>',
            warn: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l10 18H2zM11 10v5h2v-5zm0 6.5v2h2v-2z" fill-rule="evenodd"/></svg>'
        };
        function $(s) { return doc.querySelector(s); }
        function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
        function txt(sel) { var e = $(sel); var t = e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : ''; return t; }
        function num(s) { var m = String(s || '').replace(/[\s ]/g, '').replace(/[−–]/g, '-').replace(',', '.').match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : NaN; }
        function fmt(n) { return isFinite(n) ? Math.round(n).toLocaleString('ru-RU').replace(/ /g, ' ') : '—'; }
        function ok(s) { return s && s !== '—' && !/^н\/д$/i.test(s); }
        function cabId() { try { return localStorage.getItem('selected_cabinet_id') || (typeof currentCabinetId !== 'undefined' ? currentCabinetId : '') || ''; } catch (e) { return ''; } }
        function viewer() { return root.NrViewer && root.NrViewer.on ? root.NrViewer : null; }
        function allowed(tab) { var v = viewer(); return !v || (v.tabs && v.tabs.has(tab)); }
        function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
        function range() { try { return [activeDateFrom, activeDateTo]; } catch (e) { return ['', '']; } }
        function chipNow() {
            var r = range(), t = new Date(), y = new Date(t.getTime() - 864e5), w = new Date(t.getTime() - 7 * 864e5), m1 = new Date(t.getFullYear(), t.getMonth(), 1);
            if (r[0] === iso(t) && r[1] === iso(t)) return 'today';
            if (r[0] === iso(y) && r[1] === iso(y)) return 'yday';
            if (r[0] === iso(w) && r[1] === iso(t)) return 'week';
            if (r[0] === iso(m1) && r[1] === iso(t)) return 'month';
            return 'own';
        }
        function days() { var r = range(); if (!r[0] || !r[1]) return 0; return Math.max(1, Math.round((new Date(r[1]) - new Date(r[0])) / 864e5) + 1); }
        function series(id) {
            try { var c = root.Chart && root.Chart.getChart && root.Chart.getChart(id); var d = c && c.data && c.data.datasets && c.data.datasets[0]; return d ? { v: d.data.map(Number), l: c.data.labels || [] } : null; } catch (e) { return null; }
        }
        function bars(sr) {
            if (!sr || !sr.v.length) return '<div class="nmd-chart nmd-empty"></div>';
            var mx = Math.max.apply(null, sr.v.map(Math.abs)) || 1, n = sr.v.length;
            return '<div class="nmd-chart">' + sr.v.map(function (v, i) { return '<i class="' + (i >= n - 3 ? 'hl' : '') + '" style="height:' + Math.max(4, Math.round(Math.abs(v) / mx * 100)) + '%"></i>'; }).join('') + '</div>' +
                '<div class="nmd-xl"><span>' + esc(sr.l[0] || '') + '</span><span>' + esc(sr.l[Math.floor(n / 2)] || '') + '</span><span>' + esc(sr.l[n - 1] || '') + '</span></div>';
        }
        function tag(c, t) { return '<span class="nmd-tag nmd-' + c + '">' + esc(t) + '</span>'; }
        function trendTag(sel) {
            var t = txt(sel); if (!ok(t)) return '';
            var n = num(t); return tag(isFinite(n) && n < 0 ? 'r' : 'g', t);
        }
        function loadMoney() {
            var cab = cabId(), sb = root.supabase; if (!cab || !sb || viewer()) return;
            var m = S.money[cab] || (S.money[cab] = { at: 0 });
            if (Date.now() - m.at < 120000) return;
            m.at = Date.now();
            Promise.resolve(sb.from('wb_balance_daily').select('date,current,for_withdraw').eq('cabinet_id', cab).order('date', { ascending: false }).limit(1)).then(function (r) { m.bal = r && r.data && r.data[0] || m.bal; paint(); }).catch(function () {});
            Promise.resolve(sb.rpc('rnp_cabinet_payouts', { p_cabinet: cab, p_weeks: 8 })).then(function (r) {
                var today = iso(new Date()), list = (r && r.data || []).filter(function (p) { return p.closed && String(p.pay_date) >= today; }).sort(function (a, b) { return String(a.pay_date).localeCompare(String(b.pay_date)); });
                m.next = list[0] || null; paint();
            }).catch(function () {});
        }
        function loadAdBalance() {
            var cab = cabId(); if (!cab || !allowed('advertising') || typeof callWbProxy !== 'function') return;
            var m = S.money[cab] || (S.money[cab] = { at: 0 });
            if (Date.now() - (m.advAt || 0) < 300000) return;
            m.advAt = Date.now();
            Promise.resolve(callWbProxy('advert_balance', {}, cab)).then(function (res) {
                var b = res && (res.balance != null ? res.balance : res.net); if (b != null) { m.adv = Number(b); paint(); }
            }).catch(function () {});
        }
        function build() {
            var cab = cabId(), M = S.money[cab] || {};
            var t = { orders: ['#m-orders-sum', '#m-orders-count', '#trend-m-orders-sum', 'spark-orders'], sales: ['#m-sales-sum', '#m-sales-count', '#trend-m-sales-sum', 'spark-sales'], profit: ['#m-profit', '#m-margin', '#trend-m-profit', 'spark-profit'] }[S.tab];
            var big = txt(t[0]), sub = txt(t[1]);
            if (!ok(big)) return null;
            var chip = chipNow(), cl = function (k, l) { return '<i data-nmd="chip:' + k + '" class="' + (chip === k ? 'on' : '') + '">' + l + '</i>'; };
            var h = '<div class="nmd-per">' + cl('today', 'Сегодня') + cl('yday', 'Вчера') + cl('week', 'Неделя') + cl('month', 'Месяц') + cl('own', 'Свой') + '</div>';
            var tb = function (k, l) { return '<span data-nmd="tab:' + k + '" class="nmd-pill ' + (S.tab === k ? 'on' : '') + '">' + l + '</span>'; };
            h += '<div class="nmd-card nmd-hero"><div class="nmd-tabs">' + tb('orders', 'Заказы') + tb('sales', 'Выкупы') + tb('profit', 'Прибыль') + '</div>' +
                '<div class="nmd-big">' + esc(big) + '</div><div class="nmd-sm">' + esc(ok(sub) ? sub : '') + ' ' + trendTag(t[2]) + '</div>' + bars(series(t[3])) + '</div>';
            var tiles = [['rnp', 'РНП', 'chart'], ['advertising', 'РК', 'ad'], ['goods-groups', 'Остатки', 'box'], ['deductions', 'Штрафы', 'warn']].filter(function (x) { return allowed(x[0] === 'deductions' ? 'dashboard' : x[0]); });
            var pen = num(txt('#m-dash-penalty'));
            h += '<div class="nmd-sheet"><div class="nmd-tiles">' + tiles.map(function (x) { return '<div data-nmd="go:' + x[0] + '" class="nmd-tile">' + (x[0] === 'deductions' && pen > 0 ? '<em>!</em>' : '') + '<div class="nmd-sq">' + ICON[x[2]] + '</div><span>' + x[1] + '</span></div>'; }).join('') + '</div>';
            var prof = txt('#pnl-profit'), marg = txt('#pnl-margin'), roi = txt('#m-roi');
            h += '<div class="nmd-two"><div class="nmd-card nmd-green"><div class="nmd-lbl">Операц. прибыль</div><div class="nmd-big">' + esc(ok(prof) ? prof : '—') + '</div><div class="nmd-sm">' + (ok(marg) ? 'маржа ' + esc(marg) : '') + (ok(roi) ? ' · ROI ' + esc(roi) : '') + '</div></div>';
            if (!viewer()) {
                var bal = M.bal ? fmt(M.bal.current) : '—', nx = M.next ? fmt(M.next.to_withdraw) : (M.bal && M.bal.for_withdraw != null ? fmt(M.bal.for_withdraw) : '—');
                var nl = M.next ? 'К выводу ' + String(M.next.pay_date).slice(8, 10) + '.' + String(M.next.pay_date).slice(5, 7) : 'Доступно к выводу';
                h += '<div class="nmd-card nmd-bal"><div class="nmd-lbl">Баланс WB</div><div class="nmd-big">' + bal + ' <small>сом</small></div><div class="nmd-dash"><div class="nmd-lbl">' + nl + '</div><div class="nmd-mid">' + nx + ' <small>сом</small></div></div></div>';
            }
            h += '</div>';
            var ordSum = num(txt('#m-orders-sum')), adsTxt = txt('#m-ads'), ads = num(adsTxt), drr = ordSum > 0 && isFinite(ads) ? ads / ordSum * 100 : NaN, d = days();
            if (M.adv != null) {
                var perDay = isFinite(ads) && d ? ads / d : 0, left = perDay > 0 ? M.adv / perDay : null;
                h += '<div class="nmd-card nmd-adbal"><div><div class="nmd-lbl">Баланс рекламы</div><div class="nmd-mid">' + fmt(M.adv) + ' <small>сом</small></div>' +
                    (left != null ? '<div class="nmd-sm">расход ≈ ' + fmt(perDay) + ' в день · хватит на <b class="' + (left < 3 ? 'nmd-neg' : '') + '">' + (left < 10 ? left.toFixed(1).replace('.', ',') : Math.round(left)) + ' дн.</b></div>' : '') + '</div>' +
                    '<div data-nmd="go:advertising" class="nmd-btn">+ Пополнить</div></div>';
            }
            var k4 = [['Выкуп', txt('#m-conversion'), ''], ['ДРР', isFinite(drr) ? drr.toFixed(1).replace('.', ',') + '%' : '—', isFinite(drr) ? (drr > 12 ? tag('o', 'выше цели') : tag('g', 'норма')) : ''], ['ROI', roi, ''], ['Возвраты', txt('#m-returns'), '']];
            h += '<div class="nmd-card nmd-k4">' + k4.map(function (x) { return '<div><div class="nmd-lbl">' + x[0] + '</div><b>' + esc(ok(x[1]) ? x[1] : '—') + '</b>' + x[2] + '</div>'; }).join('') + '</div>';
            var real = num(txt('#pnl-real')), comm = Math.abs(num(txt('#tab-dashboard [data-metric="commission"]'))), lg = Math.abs(num(txt('#m-logistics'))), cs = Math.abs(num(txt('#tab-dashboard [data-metric="cost-of-sales"]'))), pr = num(prof);
            var parts = [['Комиссия WB', comm, '#f59e0b'], ['Логистика', lg, '#7dd3fc'], ['Реклама', ads, '#a855f7'], ['Себестоимость', cs, '#fb7185'], ['Остаётся', pr, '#22c55e']].filter(function (x) { return isFinite(x[1]) && x[1] > 0; });
            if (real > 0 && parts.length) {
                h += '<div class="nmd-card"><div class="nmd-row"><b>Куда уходит выручка</b>' + tag('b', fmt(real)) + '</div><div class="nmd-seg">' + parts.map(function (x) { return '<i style="width:' + (x[1] / real * 100).toFixed(1) + '%;background:' + x[2] + '"></i>'; }).join('') + '</div>' +
                    parts.map(function (x) { return '<div class="nmd-leg"><u style="background:' + x[2] + '"></u>' + x[0] + '<b>' + fmt(x[1]) + '</b><em>' + Math.round(x[1] / real * 100) + '%</em></div>'; }).join('') + '</div>';
            }
            var at = [];
            if (pen > 0) at.push(['⚠️', 'Штрафы ' + fmt(pen) + ' сом', 'удержания ' + txt('#m-dash-deduction'), tag('r', 'срочно')]);
            if (isFinite(drr) && drr > 12) at.push(['📈', 'ДРР ' + drr.toFixed(1).replace('.', ',') + '%', 'выше цели 12%', tag('o', 'проверить')]);
            if (M.adv != null && isFinite(ads) && d && ads / d > 0 && M.adv / (ads / d) < 3) at.push(['💸', 'Баланс рекламы заканчивается', 'пополните, чтобы РК не встали', tag('r', 'пополнить')]);
            h += '<div class="nmd-card"><div class="nmd-row"><b>Требует внимания</b>' + (at.length ? tag('r', String(at.length)) : tag('g', 'всё хорошо')) + '</div>' +
                at.map(function (x) { return '<div class="nmd-att"><span>' + x[0] + '</span><div><b>' + esc(x[1]) + '</b><div class="nmd-lbl">' + esc(x[2]) + '</div></div>' + x[3] + '</div>'; }).join('') + '</div>';
            return h;
        }
        function paint() {
            var tab = $('#tab-dashboard'); if (!tab) return;
            if (!mq.matches) { tab.classList.remove('nmd-on'); return; }
            var host = $('#nr-md');
            if (!host) { host = doc.createElement('div'); host.id = 'nr-md'; host.className = 'nmd'; tab.insertBefore(host, tab.firstChild); }
            var h = build();
            if (h == null) { if (!host.innerHTML) host.innerHTML = '<div class="nmd-card nmd-skel"></div><div class="nmd-card nmd-skel"></div>'; tab.classList.add('nmd-on'); return; }
            if (h !== S.last) { S.last = h; host.innerHTML = h; }
            tab.classList.add('nmd-on');
        }
        var tmr = null;
        function later() { clearTimeout(tmr); tmr = setTimeout(function () { paint(); loadMoney(); loadAdBalance(); }, 160); }
        doc.addEventListener('click', function (e) {
            var a = e.target.closest && e.target.closest('#nr-md [data-nmd]'); if (!a) return;
            var p = a.getAttribute('data-nmd').split(':');
            if (p[0] === 'go') { if (root.showTab) root.showTab(p[1]); }
            else if (p[0] === 'tab') { S.tab = p[1]; paint(); }
            else if (p[0] === 'chip') {
                var k = p[1];
                try {
                    if (k === 'today') root.setQuickPicker(0, 'today'); else if (k === 'week') root.setQuickPicker(7); else if (k === 'month') root.setQuickPicker(0, 'month');
                    else if (k === 'yday') { var y = new Date(Date.now() - 864e5); pickerState.fromDate = y; pickerState.toDate = y; applyPicker(); }
                    else if (root.toggleDatePicker) root.toggleDatePicker(e);
                } catch (err) { /* период не переключился, остаётся прежний */ }
                paint();
            }
        });
        var ready = function () {
            var tab = $('#tab-dashboard'); if (!tab) { setTimeout(ready, 400); return; }
            new MutationObserver(later).observe(tab, { childList: true, subtree: true, characterData: true });
            if (mq.addEventListener) mq.addEventListener('change', later);
            later();
        };
        if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', ready); else ready();
    })();
    root.NrMotion = { shake: shake, count: count, slot: slot, pill: pill, hold: hold, copy: copy, drag: drag, confetti: confetti };
})(typeof window !== 'undefined' ? window : globalThis);

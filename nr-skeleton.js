/* Пока данные не пришли, прочерк в показателях выглядит как готовое значение.
 * Подсвечиваем такие ячейки спокойной полоской и снимаем её, когда текст изменился (или через 10 с). */
(function () {
    'use strict';
    // Стили .nr-skel лежат в dashboard.html, чтобы полоски были видны с первого кадра.
    var SEL = '[class*="kpi-value"],[class*="tile-value"],[class*="metric-card-value"],[class*="money-val"],.pnl-big,[id^="pnl-"],[id^="m-"],[id^="sum-"],[id^="wh-"],[id^="adv-kpi-"],[id^="ads-hq-kpi-"]';
    function mark(el) {
        if (el.__nrSkel || el.children.length) return;
        var t = (el.textContent || '').trim();
        if (t !== '—' && t !== '-') return;
        el.__nrSkel = true;
        el.classList.add('nr-skel');
        var done = function () { el.classList.remove('nr-skel'); mo.disconnect(); clearTimeout(tm); };
        var mo = new MutationObserver(function () { var n = (el.textContent || '').trim(); if (n !== '—' && n !== '-') done(); });
        mo.observe(el, { childList: true, characterData: true, subtree: true });
        var tm = setTimeout(done, 10000);
    }
    function scan() { document.querySelectorAll(SEL).forEach(mark); }
    function init() {
        scan();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();


/* ───── Загрузка: полоса прогресса сверху (по запросам к данным) и карточка с шагами (NrLoader) ─────
 * Полоса: появляется, если запросы идут дольше ~0,35 с, растёт к 90% и заканчивается, когда все ответы пришли.
 * Карточка: NrLoader.begin(key, title, steps) / step(key, i) / end(key) — проценты и «осталось около N с» считаются
 * по шагам и по времени прошлых загрузок (хранится в localStorage), а не выдумываются. Без движения при reduced-motion. */
(function (root) {
    'use strict';
    var doc = root.document;
    if (!doc) return;
    function ls(k, v) { try { if (v === undefined) return root.localStorage.getItem(k); root.localStorage.setItem(k, v); } catch (e) { return null; } }

    // ── полоса сверху ──
    var bar = null, fill = null, pending = 0, pct = 0, tShow = null, tTrickle = null, tHide = null, visible = false;
    function ensureBar() {
        if (bar || !doc.body) return;
        bar = doc.createElement('div'); bar.id = 'nr-topbar'; bar.setAttribute('aria-hidden', 'true');
        fill = doc.createElement('b'); bar.appendChild(fill); doc.body.appendChild(bar);
    }
    function paint() { if (fill) fill.style.width = pct + '%'; }
    function barShow() {
        ensureBar(); if (!bar) return;
        clearTimeout(tHide); visible = true; bar.classList.add('on'); bar.classList.remove('end');
        if (pct < 8) pct = 8; paint();
        clearInterval(tTrickle);
        tTrickle = setInterval(function () { pct += (92 - pct) * 0.08; paint(); }, 280);
    }
    function barDone() {
        clearTimeout(tShow); clearInterval(tTrickle);
        if (!visible) { pct = 0; return; }
        pct = 100; paint(); bar.classList.add('end');
        tHide = setTimeout(function () { bar.classList.remove('on'); visible = false; pct = 0; paint(); }, 380);
    }
    function inc() { pending++; if (pending === 1) { clearTimeout(tShow); tShow = setTimeout(barShow, 350); } }
    function dec() { pending = Math.max(0, pending - 1); if (pending === 0) { setTimeout(function () { if (pending === 0) barDone(); }, 150); } }
    var nf = root.fetch;
    if (typeof nf === 'function' && !nf._nrl) {
        var wrapped = function (input) {
            var url = '';
            try { url = typeof input === 'string' ? input : (input && input.url) || ''; } catch (e) {}
            var track = /\.supabase\.co\/(rest|functions)\//.test(url) && !/heartbeat|presence|touch/i.test(url);
            if (track) inc();
            var p = nf.apply(this, arguments);
            if (track) p.then(dec, dec);
            return p;
        };
        wrapped._nrl = true;
        root.fetch = wrapped;
    }

    // ── карточка с шагами ──
    var cards = {};
    function fmtSec(s) { return s < 1.5 ? 'почти готово' : 'осталось около ' + Math.round(s) + ' с'; }
    function median(a) { if (!a.length) return 0; a = a.slice().sort(function (x, y) { return x - y; }); return a[Math.floor(a.length / 2)]; }
    function hist(key) { try { return JSON.parse(ls('nr_load_ms_' + key) || '[]'); } catch (e) { return []; } }
    function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

    function render(c) {
        if (!c.el) return;
        var n = c.steps.length, now = Date.now(), el = now - c.t0;
        var est = c.est || 8000;
        var frac = 1 - Math.exp(-(now - c.stepT) / Math.max(800, est / n));
        var progress = Math.min(0.97, (c.cur + frac * 0.9) / n);
        c.el.querySelector('.nrl-ring').style.setProperty('--p', Math.round(progress * 100) + '%');
        c.el.querySelector('.nrl-pc').textContent = Math.round(progress * 100) + '%';
        c.el.querySelector('.nrl-steps').innerHTML = c.steps.map(function (t, i) {
            var cls = i < c.cur ? 'done' : (i === c.cur ? 'now' : 'wait');
            var tail = i < c.cur ? 'готово' : (i === c.cur ? 'считаем…' : 'ждёт');
            return '<div class="nrl-st ' + cls + '"><span class="nrl-dot">' + (i < c.cur ? '✓' : '') + '</span>' + esc(t) + '<em>' + tail + '</em></div>';
        }).join('');
        var left = Math.max(0, est - el) / 1000;
        c.el.querySelector('.nrl-foot').innerHTML = '<span>Шаг ' + Math.min(n, c.cur + 1) + ' из ' + n + '</span><span>' +
            (el > est * 1.6 ? 'дольше обычного, ждём ответ' : fmtSec(left)) + '</span>';
    }
    function mount(c) {
        if (c.el || !c.active || !doc.body) return;
        var d = doc.createElement('div'); d.className = 'nrl-card'; d.setAttribute('role', 'status');
        d.innerHTML = '<div class="nrl-hd"><div class="nrl-ring"><span class="nrl-pc">0%</span></div><img src="/img/leopard-mini.svg" width="44" height="44" alt="" aria-hidden="true" style="flex:none"><div><h3>' + esc(c.title) + '</h3><p>' +
            (c.est ? 'Обычно это занимает ' + Math.max(2, Math.round(c.est / 1000)) + ' с' : 'Это может занять несколько секунд') + '</p></div></div>' +
            '<div class="nrl-steps"></div><div class="nrl-foot"></div>';
        doc.body.appendChild(d); c.el = d;
        requestAnimationFrame(function () { d.classList.add('on'); });
        render(c); c.tick = setInterval(function () { render(c); }, 250);
    }
    var L = root.NrLoader = {
        begin: function (key, title, steps) {
            if (cards[key] && cards[key].active) return;
            var h = hist(key), c = cards[key] = { key: key, title: title, steps: steps || ['Загрузка'], cur: 0, t0: Date.now(), stepT: Date.now(), active: true, est: median(h) };
            c.show = setTimeout(function () { mount(c); }, 500);   // быстрые загрузки карточку не показывают
            c.kill = setTimeout(function () { L.end(key, true); }, 90000);
        },
        step: function (key, i) {
            var c = cards[key]; if (!c || !c.active) return;
            c.cur = Math.max(c.cur, Math.min(i, c.steps.length - 1)); c.stepT = Date.now(); render(c);
        },
        end: function (key, aborted) {
            var c = cards[key]; if (!c || !c.active) return;
            c.active = false; clearTimeout(c.show); clearTimeout(c.kill); clearInterval(c.tick);
            if (!aborted) { var h = hist(key); h.push(Date.now() - c.t0); ls('nr_load_ms_' + key, JSON.stringify(h.slice(-7))); }
            if (c.el) {
                c.cur = c.steps.length; render(c);
                var el = c.el; el.querySelector('.nrl-ring').style.setProperty('--p', '100%'); el.querySelector('.nrl-pc').textContent = '100%';
                el.classList.add('fin'); setTimeout(function () { el.classList.remove('on'); setTimeout(function () { el.remove(); }, 260); }, 260);
                c.el = null;
            }
        },
    };
})(typeof window !== 'undefined' ? window : globalThis);

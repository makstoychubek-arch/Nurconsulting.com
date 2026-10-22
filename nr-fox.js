/*! Лисёнок: порт page-mascot (github.com/nilbuild/page-mascot) на чистый JS.
MIT License. Copyright (c) Kamran Ahmed.
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE. */
/* Лисёнок на экранах ожидания: смотрит за курсором и по клику показывает эмоцию.
 * Порт библиотеки page-mascot (MIT, Copyright (c) Kamran Ahmed, github.com/nilbuild/page-mascot) на чистый JS.
 * Два листа 3x3: /img/fox-directions.webp (повороты головы) и /img/fox-reactions.webp (эмоции). */
(function (root) {
    'use strict';
    var DIRECTIONS = ['up-left', 'up', 'up-right', 'left', 'center', 'right', 'down-left', 'down', 'down-right'];
    var REACTIONS = ['blink', 'heart', 'sparkle', 'surprised', 'wink', 'bashful', 'sleepy', 'dizzy', 'delighted'];
    var CLOCKWISE = ['right', 'down-right', 'down', 'down-left', 'left', 'up-left', 'up', 'up-right'];
    var SECTOR = (Math.PI * 2) / CLOCKWISE.length, HYST = 0.12, DEAD = 70;
    var PAYOFFS = ['heart', 'sparkle', 'delighted'], BOOP_PAYOFF = 120, BOOP_END = 560, SQUASH_MS = 420, DIZZY_AFTER = 4, DIZZY_WINDOW = 1600, DIZZY_END = 1100;
    var SQUASH = [
        { transform: 'scale(1, 1)', easing: 'ease-in' },
        { transform: 'scale(1.10, 0.86)', offset: 0.18, easing: 'ease-out' },
        { transform: 'scale(0.95, 1.08)', offset: 0.45, easing: 'ease-in-out' },
        { transform: 'scale(1.03, 0.97)', offset: 0.72, easing: 'ease-in-out' },
        { transform: 'scale(1, 1)' },
    ];
    var DIR_URL = '/img/fox-directions.webp', REA_URL = '/img/fox-reactions.webp';
    var instances = [], listening = false, pointer = null;

    function wrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
    function cellPos(i) { return (i % 3) * 50 + '% ' + Math.floor(i / 3) * 50 + '%'; }
    function layer(url) {
        var s = document.createElement('span');
        s.style.cssText = 'position:absolute;inset:0;background-size:300% 300%;background-repeat:no-repeat' + (url ? ';background-image:url(' + url + ')' : '');
        return s;
    }
    function loadReactions(m) { if (!m.reaLoaded) { m.reaLoaded = true; m.b.style.backgroundImage = 'url(' + (m.reaUrl) + ')'; } }

    function aim(m) {
        if (!pointer || m.rest) return;
        var box = m.el.getBoundingClientRect();
        if (!box.width) return;
        var dx = pointer.x - (box.left + box.width / 2), dy = pointer.y - (box.top + box.height / 2);
        if (Math.hypot(dx, dy) < DEAD * (m.size / 140)) { m.sector = -1; setDir(m, 'center'); return; }
        var angle = Math.atan2(dy, dx);
        if (m.sector !== -1 && Math.abs(wrap(angle - m.sector * SECTOR)) < SECTOR / 2 + HYST) return;
        m.sector = (Math.round(angle / SECTOR) + CLOCKWISE.length) % CLOCKWISE.length;
        setDir(m, CLOCKWISE[m.sector]);
    }
    function setDir(m, d) { if (m.dir === d) return; m.dir = d; m.a.style.backgroundPosition = cellPos(DIRECTIONS.indexOf(d)); }
    function setReaction(m, r) {
        m.reaction = r;
        var show = r || m.rest;
        m.a.style.opacity = show ? 0 : 1; m.b.style.opacity = show ? 1 : 0;
        if (show) m.b.style.backgroundPosition = cellPos(REACTIONS.indexOf(show));
    }
    function boop(m) {
        m.timers.forEach(clearTimeout); m.timers = [];
        function later(ms, next) { m.timers.push(setTimeout(function () { setReaction(m, next); }, ms)); }
        var now = Date.now();
        m.boops.count = now - m.boops.at < DIZZY_WINDOW ? m.boops.count + 1 : 1; m.boops.at = now;
        if (m.boops.count >= DIZZY_AFTER) { m.boops.count = 0; setReaction(m, 'dizzy'); later(DIZZY_END, null); }
        else { setReaction(m, 'blink'); later(BOOP_PAYOFF, PAYOFFS[(m.boops.count - 1) % PAYOFFS.length]); later(BOOP_END, null); }
        if (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        if (m.sq.animate) m.sq.animate(SQUASH, { duration: SQUASH_MS, easing: 'linear' });
    }
    function listen() {
        if (listening) return; listening = true;
        if (!root.matchMedia || !root.matchMedia('(hover: hover) and (pointer: fine)').matches) return; // на телефоне взгляд за пальцем не нужен
        function all() { instances = instances.filter(function (m) { return document.body.contains(m.el); }); instances.forEach(aim); }
        root.addEventListener('pointermove', function (e) { pointer = { x: e.clientX, y: e.clientY }; all(); }, { passive: true });
        root.addEventListener('scroll', all, { passive: true });
    }

    /* NrFox.mount(container, { size: 140, label: 'Лисёнок' }) -> элемент-кнопка */
    function mount(container, opts) {
        opts = opts || {};
        var size = opts.size || 140;
        var el = document.createElement('button');
        el.type = 'button'; el.className = 'nr-fox'; el.setAttribute('aria-label', opts.label || 'Лисёнок: нажми, чтобы погладить');
        el.style.cssText = 'position:relative;display:block;flex-shrink:0;width:' + size + 'px;height:' + size + 'px;padding:0;border:0;background:transparent;appearance:none;cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent';
        var sq = document.createElement('span');
        sq.style.cssText = 'position:relative;display:block;width:100%;height:100%;transform-origin:50% 78%';
        var a = layer(opts.directions || DIR_URL), b = layer(opts.rest ? (opts.reactions || REA_URL) : null);
        a.style.backgroundPosition = cellPos(4); b.style.backgroundPosition = cellPos(0); b.style.opacity = 0;
        sq.appendChild(a); sq.appendChild(b); el.appendChild(sq);
        var m = { el: el, sq: sq, a: a, b: b, reaUrl: opts.reactions || REA_URL, reaLoaded: !!opts.rest, rest: opts.rest || null, size: size, sector: -1, dir: 'center', reaction: null, timers: [], boops: { count: 0, at: 0 } };
        el.addEventListener('click', function () { loadReactions(m); boop(m); });
        ['pointerenter', 'touchstart', 'focus'].forEach(function (ev) { el.addEventListener(ev, function () { loadReactions(m); }, { passive: true, once: true }); });
        if (m.rest) setReaction(m, null);
        instances.push(m); listen();
        if (container) container.appendChild(el);
        return el;
    }
    root.NrFox = { mount: mount };
})(typeof window !== 'undefined' ? window : globalThis);

/* ───── Лисёнок на экранах ожидания: места подключения ─────
 * Слот <span class="nr-fox-slot" data-size="44" data-rest="sleepy"> превращается в лисёнка.
 * Автоматом: надписи «Загрузка…», крутилки, пустые экраны, всплывашки «успех», «долгий режим» (запрос к данным > 1,5 с). */
(function (root) {
    'use strict';
    var doc = root.document;
    if (!doc || !root.NrFox) return;
    var DIR = '/img/fox-directions.webp';
    var path = root.location.pathname || '';
    var isApp = !!doc.querySelector('.tab-content') || /^\/(space|goods|rnp|advertising|ab-testing|content|agents|reports|cabinets)/.test(path);

    var st = doc.createElement('style');
    st.textContent =
        '.nr-fox-slot{display:inline-block;flex:none;line-height:0;vertical-align:middle}' +
        '.nr-fox-slot:not([data-m]){background:url(' + DIR + ') 50% 50%/300% 300% no-repeat}' +
        '.nr-fox-in{margin-right:8px}' +
        '.nr-loader-ring,.wbc-spinner{border:0!important;animation:nr-fox-bob 1.1s ease-in-out infinite!important;background:url(' + DIR + ') 50% 50%/300% 300% no-repeat!important}' +
        '.nr-loader-ring{width:48px!important;height:48px!important}.wbc-spinner{width:24px!important;height:24px!important;vertical-align:middle}' +
        '@keyframes nr-fox-bob{0%,100%{transform:translateY(0) rotate(-4deg)}50%{transform:translateY(-3px) rotate(4deg)}}' +
        '#nr-fox-long{position:fixed;right:16px;bottom:16px;z-index:99990;display:flex;align-items:center;gap:8px;padding:8px 16px 8px 8px;border-radius:18px;' +
        'background:var(--surface-solid,#fff);color:var(--text-primary,#111);border:1px solid var(--border,rgba(0,0,0,.12));box-shadow:0 10px 28px rgba(0,0,0,.16);font:13px/1.3 Inter,system-ui,sans-serif;' +
        'opacity:0;transform:translateY(10px);transition:opacity .25s ease,transform .25s ease;max-width:min(320px,calc(100vw - 32px))}' +
        '#nr-fox-long.on{opacity:1;transform:none}#nr-fox-long small{display:block;color:var(--text-muted,#6b7280);font-size:12px;margin-top:1px}' +
        '@media (max-width:640px){#nr-fox-long{bottom:84px}}' +
        '@media (prefers-reduced-motion:reduce){#nr-fox-long{transition:none}.nr-loader-ring,.wbc-spinner{animation:none!important}}';
    doc.head.appendChild(st);

    function mountSlot(el) {
        if (el.__nrFox || el.hasAttribute('data-m')) return;
        el.__nrFox = true; el.setAttribute('data-m', '1');
        var size = parseInt(el.getAttribute('data-size'), 10) || 44;
        el.style.width = size + 'px'; el.style.height = size + 'px'; el.style.background = 'none';
        root.NrFox.mount(el, { size: size, rest: el.getAttribute('data-rest') || null, label: 'Лисёнок: нажми, чтобы погладить' });
    }
    function slot(size, rest, cls) {
        var s = doc.createElement('span');
        s.className = 'nr-fox-slot' + (cls ? ' ' + cls : ''); s.setAttribute('data-size', size); if (rest) s.setAttribute('data-rest', rest);
        s.setAttribute('aria-hidden', 'true'); mountSlot(s);
        return s;
    }

    /* «Загрузка…» и пустые экраны */
    var RE_LOAD = /^\s*(Загрузк|Загружаем|Инициализаци)/i;
    var RE_EMPTY = /^\s*(Нет данных|Данных пока нет|Ничего не найден|Пока пусто|Список пуст)/i;
    var SKIP = /^(BUTTON|A|INPUT|OPTION|LABEL|SCRIPT|STYLE|TEXTAREA|SELECT|TITLE|TH|CODE|B|I|EM|STRONG|SMALL|H1|H2|H3|H4|H5|H6)$/;
    function paint(el) {
        if (!el || el.nodeType !== 1 || el.__nrFoxP) return;
        if (el.children.length || SKIP.test(el.tagName)) return;
        var t = el.textContent || '';
        if (t.length > 140) return;
        var load = t.length <= 60 && RE_LOAD.test(t), empty = !load && RE_EMPTY.test(t);
        if (!load && !empty) return;
        if (el.closest('button,a,select,[data-no-fox],#toast-wrap,#nr-fox-long,.nrl-card,.nr-sync,#nr-init-stall-banner,.nw-ov')) return;
        if (el.parentElement && el.parentElement.querySelector(':scope > .nr-fox-slot')) return;
        el.__nrFoxP = true;
        if (load) { el.insertBefore(slot(28, null, 'nr-fox-in'), el.firstChild); return; }
        var s = slot(56, 'sleepy'); s.style.display = 'block'; s.style.margin = '0 auto 6px';
        el.insertBefore(s, el.firstChild);
    }
    function scan(node) {
        if (!node || node.nodeType !== 1) return;
        if (node.classList && node.classList.contains('nr-fox-slot')) { mountSlot(node); return; }
        paint(node);
        if (node.children.length && (node.textContent || '').length < 600) {
            node.querySelectorAll('.nr-fox-slot').forEach(mountSlot);
            node.querySelectorAll('*').forEach(paint);
        }
    }

    var mo = new MutationObserver(function (list) {
        for (var i = 0; i < list.length; i++) {
            var add = list[i].addedNodes;
            for (var j = 0; j < add.length; j++) {
                var n = add[j];
                if (n.nodeType !== 1) continue;
                scan(n);
            }
        }
    });

    /* Лисёнок в углу показываем только при первой загрузке данных нового кабинета (auto-sync, mode: full).
       Обычные долгие запросы больше не показывают плашку: она мешала и не относилась к делу. */
    var firstSync = 0, pend = 0, tShow = null, tHide = null, tPhrase = null, tCap = null, corner = null, shownAt = 0, gaveUp = false;
    function relevant(u) { return firstSync > 0 && /supabase\.co\/(rest|functions)\//.test(u) && !/perf-sample|client-error/.test(u); }
    function showLong() {
        if (corner || gaveUp) return;
        corner = doc.createElement('div'); corner.id = 'nr-fox-long'; corner.setAttribute('role', 'status');
        corner.appendChild(slot(52, null));
        var tx = doc.createElement('div'); tx.innerHTML = '<b>Загружаем данные кабинета…</b><small>Первая синхронизация с Wildberries</small>';
        corner.appendChild(tx);
        doc.body.appendChild(corner);
        requestAnimationFrame(function () { corner && corner.classList.add('on'); });
        shownAt = Date.now();
        tPhrase = setTimeout(function () {
            if (!corner) return;
            var f = corner.querySelector('.nr-fox-slot'); if (f) f.remove();
            corner.insertBefore(slot(52, 'surprised'), corner.firstChild);
            tx.innerHTML = '<b>Большой кабинет, ещё чуть-чуть</b><small>Мы сохраняем ваши данные, это занимает несколько минут</small>';
        }, 5000);
        tCap = setTimeout(function () { gaveUp = true; hideLong(true); }, 30000);
    }
    function hideLong(now) {
        clearTimeout(tPhrase); clearTimeout(tCap);
        if (!corner) return;
        var c = corner, wait = now ? 0 : Math.max(0, 900 - (Date.now() - shownAt));
        corner = null;
        setTimeout(function () { c.classList.remove('on'); setTimeout(function () { c.remove(); }, 300); }, wait);
    }
    function begin(u) {
        if (!relevant(u)) return false;
        pend++; clearTimeout(tHide);
        if (pend === 1 && !corner) { clearTimeout(tShow); tShow = setTimeout(function () { if (pend > 0) showLong(); }, 1500); }
        return true;
    }
    function end() {
        pend = Math.max(0, pend - 1);
        if (pend === 0) { clearTimeout(tShow); gaveUp = false; tHide = setTimeout(function () { if (pend === 0) hideLong(false); }, 250); }
    }
    if (isApp && root.fetch) {
        var f0 = root.fetch;
        root.fetch = function (input, init) {
            var url = typeof input === 'string' ? input : (input && input.url) || '';
            var counted = false, first = false;
            try {
                first = /functions\/v1\/auto-sync/.test(url) && init && typeof init.body === 'string' && /"mode"\s*:\s*"full"/.test(init.body);
                if (first) firstSync++;
                counted = begin(url);
            } catch (e) { /* не мешаем запросу */ }
            var p = f0.apply(this, arguments);
            var done = function () { if (first) firstSync = Math.max(0, firstSync - 1); if (counted) end(); };
            if (counted || first) p.then(done, done);
            return p;
        };
    }

    function init() {
        doc.querySelectorAll('.nr-fox-slot').forEach(mountSlot);
        doc.querySelectorAll('div,td,p,span').forEach(paint);
        mo.observe(doc.body, { childList: true, subtree: true });
    }
    // Ждём конца загрузки страницы: картинки лисёнка не должны мешать самой странице.
    function later() { try { (root.requestIdleCallback || function (f) { setTimeout(f, 200); })(init); } catch (e) { setTimeout(init, 200); } }
    try { if (doc.readyState === 'complete') later(); else root.addEventListener('load', later); } catch (e) { /* украшение не должно ломать сайт */ }
})(typeof window !== 'undefined' ? window : globalThis);

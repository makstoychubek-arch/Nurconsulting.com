/**
 * Все модалки — окна как на Mac: светофор, ресайз, один общий размер.
 * Размер пишется в localStorage (nr_win_size) и применяется ко всем окнам.
 */
(function (root) {
    var KEY = 'nr_win_size';
    var DEFAULT_W = 480;
    var DEFAULT_H = 520;
    var MIN_W = 320;
    var MIN_H = 280;
    var PAD = 24;
    var DIRS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
    var BOX_SEL = [
        '.rnp-settings-dialog',
        '.rnp-plan-fact-dialog',
        '.nr-glass-dialog',
        '.add-cabinet-modal-box',
        '#modal-box',
        '.nr-win-photo',
    ].join(',');
    var CLOSE_SEL = [
        '.rnp-settings-close',
        '.pf-close',
        '.rnp-photo-lightbox-close',
        '#modal-btn',
        '#modal-cancel-btn',
    ].join(',');

    function viewport() {
        var w = (typeof window !== 'undefined' && window.innerWidth) || 1200;
        var h = (typeof window !== 'undefined' && window.innerHeight) || 800;
        return { w: w, h: h };
    }

    function clamp(size, vw, vh) {
        var view = (vw && vh) ? { w: vw, h: vh } : viewport();
        var maxW = Math.max(MIN_W, view.w - PAD);
        var maxH = Math.max(MIN_H, view.h - PAD);
        var w = Math.round(Number(size && size.w) || DEFAULT_W);
        var h = Math.round(Number(size && size.h) || DEFAULT_H);
        return {
            w: Math.max(MIN_W, Math.min(w, maxW)),
            h: Math.max(MIN_H, Math.min(h, maxH)),
        };
    }

    function parseSize(raw) {
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) return clamp(raw);
        try {
            var s = JSON.parse(String(raw || ''));
            if (s && Number(s.w) > 0 && Number(s.h) > 0) return clamp(s);
        } catch (e) {}
        return clamp({ w: DEFAULT_W, h: DEFAULT_H });
    }

    function readStore() {
        try {
            if (typeof localStorage === 'undefined') return '';
            return localStorage.getItem(KEY) || '';
        } catch (e) { return ''; }
    }

    function writeStore(size) {
        try {
            if (typeof localStorage === 'undefined') return;
            localStorage.setItem(KEY, JSON.stringify({ w: size.w, h: size.h }));
        } catch (e) {}
    }

    function applyCssVars(size) {
        if (typeof document === 'undefined' || !document.documentElement) return;
        var st = document.documentElement.style;
        st.setProperty('--nr-win-w', size.w + 'px');
        st.setProperty('--nr-win-h', size.h + 'px');
    }

    function getSize() {
        return parseSize(readStore());
    }

    function paintBox(box, size) {
        if (!box || !box.style) return;
        if (box.classList.contains('nr-win-max') || box.classList.contains('nr-win-min')) return;
        box.style.setProperty('width', size.w + 'px', 'important');
        box.style.setProperty('height', size.h + 'px', 'important');
    }

    function applyAll(size) {
        var next = clamp(size || getSize());
        applyCssVars(next);
        if (typeof document === 'undefined') return next;
        var list = document.querySelectorAll('.nr-win');
        var i;
        for (i = 0; i < list.length; i++) paintBox(list[i], next);
        return next;
    }

    function setSize(size, persist) {
        var next = clamp(size);
        if (persist !== false) writeStore(next);
        return applyAll(next);
    }

    function titleOf(box) {
        if (!box || !box.getAttribute) return '';
        var id = box.getAttribute('aria-labelledby');
        var el = id && typeof document !== 'undefined' ? document.getElementById(id) : null;
        if (el && el.textContent) return String(el.textContent).trim();
        var h = box.querySelector('h3, .pf-bar-title, .ab-new-head h3');
        if (h && h.textContent) return String(h.textContent).trim();
        var label = box.getAttribute('aria-label');
        return label ? String(label).trim() : '';
    }

    function closeBox(box) {
        if (!box) return;
        var btn = box.querySelector(CLOSE_SEL);
        if (btn) { btn.click(); return; }
        var overlay = box.parentElement;
        var id = overlay && overlay.id;
        var map = {
            'rnp-settings-overlay': function () { root.RNP && root.RNP.closeSettings && root.RNP.closeSettings(); },
            'cluster-overlay': function () { typeof root.closeClusterModal === 'function' && root.closeClusterModal(); },
            'gg-settings-overlay': function () { typeof root.closeGoodsSettings === 'function' && root.closeGoodsSettings(); },
            'new-test-form': function () { typeof root.hideNewTestForm === 'function' && root.hideNewTestForm(); },
            'ab-edit-modal': function () { typeof root.closeABEditModal === 'function' && root.closeABEditModal(); },
            'ab-report-modal': function () { typeof root.closeABReportModal === 'function' && root.closeABReportModal(); },
            'rnp-plan-fact-overlay': function () { root.RNP && root.RNP.closePlanFact && root.RNP.closePlanFact(); },
            'rnp-photo-lightbox': function () { root.RNP && root.RNP.closePhoto && root.RNP.closePhoto(); },
            'premium-modal': function () { typeof root.closePremiumModal === 'function' && root.closePremiumModal(); },
            'add-cabinet-modal': function () { typeof root.closeAddCabinetModal === 'function' && root.closeAddCabinetModal(); },
            'autobidder-modal': function () { typeof root.closeAutobidderModal === 'function' && root.closeAutobidderModal(); },
            'supply-detail-modal': function () { typeof root.closeSupplyDetail === 'function' && root.closeSupplyDetail(); },
        };
        if (id && map[id]) { map[id](); return; }
        if (!overlay) return;
        overlay.classList.remove('is-open');
        overlay.classList.add('hidden');
    }

    function ensureBar(box) {
        var bar = box.querySelector(':scope > .nr-win-bar');
        if (bar) return bar;
        bar = document.createElement('div');
        bar.className = 'nr-win-bar';
        bar.innerHTML = ''
            + '<div class="nr-win-lights">'
            + '<button type="button" class="nr-win-dot nr-win-close" aria-label="Закрыть"></button>'
            + '<button type="button" class="nr-win-dot nr-win-min" aria-label="Свернуть"></button>'
            + '<button type="button" class="nr-win-dot nr-win-max" aria-label="На весь экран"></button>'
            + '</div>'
            + '<div class="nr-win-title"></div>';
        box.insertBefore(bar, box.firstChild);
        return bar;
    }

    function ensureScroll(box) {
        if (box.querySelector(':scope > .nr-win-scroll')) return;
        var scroll = document.createElement('div');
        scroll.className = 'nr-win-scroll';
        var move = [];
        var i;
        var n;
        for (i = 0; i < box.childNodes.length; i++) {
            n = box.childNodes[i];
            if (n.nodeType === 1 && n.classList && (n.classList.contains('nr-win-bar') || n.classList.contains('nr-win-resize'))) continue;
            move.push(n);
        }
        for (i = 0; i < move.length; i++) scroll.appendChild(move[i]);
        var bar = box.querySelector(':scope > .nr-win-bar');
        if (bar && bar.nextSibling) box.insertBefore(scroll, bar.nextSibling);
        else box.appendChild(scroll);
    }

    function ensureHandles(box) {
        var i;
        var h;
        for (i = 0; i < DIRS.length; i++) {
            if (box.querySelector(':scope > .nr-win-resize-' + DIRS[i])) continue;
            h = document.createElement('div');
            h.className = 'nr-win-resize nr-win-resize-' + DIRS[i];
            h.setAttribute('data-dir', DIRS[i]);
            box.appendChild(h);
        }
    }

    function clearModes(box) {
        box.classList.remove('nr-win-max', 'nr-win-min');
        box.style.top = '';
        box.style.left = '';
        box.style.right = '';
        box.style.bottom = '';
        box.style.position = '';
        box.style.transform = '';
        box.style.margin = '';
    }

    function toggleMax(box) {
        if (box.classList.contains('nr-win-min')) {
            box.classList.remove('nr-win-min');
            paintBox(box, getSize());
            return;
        }
        if (box.classList.contains('nr-win-max')) {
            box.classList.remove('nr-win-max');
            paintBox(box, getSize());
            return;
        }
        box.classList.add('nr-win-max');
        box.style.removeProperty('width');
        box.style.removeProperty('height');
    }

    function toggleMin(box) {
        if (box.classList.contains('nr-win-min')) {
            box.classList.remove('nr-win-min');
            if (box.classList.contains('nr-win-max')) {
                box.style.removeProperty('width');
                box.style.removeProperty('height');
            } else {
                paintBox(box, getSize());
            }
            return;
        }
        box.classList.add('nr-win-min');
    }

    function bindChrome(box) {
        if (box.dataset.nrWinChrome) return;
        box.dataset.nrWinChrome = '1';
        box.addEventListener('pointerdown', function (e) {
            var t = e.target;
            if (!t || !t.closest) return;
            if (t.closest('.nr-win-close')) { e.preventDefault(); e.stopPropagation(); closeBox(box); return; }
            if (t.closest('.nr-win-min')) { e.preventDefault(); e.stopPropagation(); toggleMin(box); return; }
            if (t.closest('.nr-win-max')) { e.preventDefault(); e.stopPropagation(); toggleMax(box); return; }
            // На тач-экране перетаскивание/ресайз окна руками не нужно и только
            // перехватывает скролл контента (палец у верхней кромки окна начинает
            // скроллить список, а попадает на title bar и двигает всё окно).
            if (e.pointerType === 'touch') return;
            var handle = t.closest('.nr-win-resize');
            if (handle) { startResize(box, e, handle.getAttribute('data-dir')); return; }
            if (t.closest('.nr-win-bar') && !t.closest('button, a, input, select, textarea')) {
                startDrag(box, e);
            }
        });
        box.addEventListener('dblclick', function (e) {
            var t = e.target;
            if (t && t.closest && t.closest('.nr-win-bar') && !t.closest('.nr-win-dot')) toggleMax(box);
        });
    }

    function overlayRect(box) {
        var ov = box.parentElement;
        if (!ov) return { left: 0, top: 0, width: viewport().w, height: viewport().h };
        return ov.getBoundingClientRect();
    }

    function startResize(box, e, dir) {
        if (e.button != null && e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        clearModes(box);
        box.classList.add('nr-win-resizing');
        var startX = e.clientX;
        var startY = e.clientY;
        var rect = box.getBoundingClientRect();
        var ov = overlayRect(box);
        var left = rect.left - ov.left;
        var top = rect.top - ov.top;
        var w = rect.width;
        var h = rect.height;
        box.style.position = 'absolute';
        box.style.left = left + 'px';
        box.style.top = top + 'px';
        box.style.margin = '0';
        try { box.setPointerCapture(e.pointerId); } catch (err) {}

        function move(ev) {
            var dx = ev.clientX - startX;
            var dy = ev.clientY - startY;
            var nw = w;
            var nh = h;
            var nl = left;
            var nt = top;
            if (dir.indexOf('e') >= 0) nw = w + dx;
            if (dir.indexOf('s') >= 0) nh = h + dy;
            if (dir.indexOf('w') >= 0) { nw = w - dx; nl = left + dx; }
            if (dir.indexOf('n') >= 0) { nh = h - dy; nt = top + dy; }
            var next = clamp({ w: nw, h: nh }, ov.width, ov.height);
            if (dir.indexOf('w') >= 0) nl = left + (w - next.w);
            if (dir.indexOf('n') >= 0) nt = top + (h - next.h);
            nl = Math.max(0, Math.min(nl, ov.width - next.w));
            nt = Math.max(0, Math.min(nt, ov.height - next.h));
            box.style.setProperty('width', next.w + 'px', 'important');
            box.style.setProperty('height', next.h + 'px', 'important');
            box.style.left = nl + 'px';
            box.style.top = nt + 'px';
            box._nrLive = next;
            applyCssVars(next);
        }
        function up() {
            box.classList.remove('nr-win-resizing');
            box.releasePointerCapture && box.releasePointerCapture(e.pointerId);
            box.removeEventListener('pointermove', move);
            box.removeEventListener('pointerup', up);
            box.removeEventListener('pointercancel', up);
            var live = box._nrLive || { w: box.getBoundingClientRect().width, h: box.getBoundingClientRect().height };
            delete box._nrLive;
            box.style.position = '';
            box.style.left = '';
            box.style.top = '';
            box.style.margin = '';
            box.style.removeProperty('width');
            box.style.removeProperty('height');
            setSize(live, true);
        }
        box.addEventListener('pointermove', move);
        box.addEventListener('pointerup', up);
        box.addEventListener('pointercancel', up);
    }

    function startDrag(box, e) {
        if (e.button != null && e.button !== 0) return;
        if (box.classList.contains('nr-win-max') || box.classList.contains('nr-win-min')) return;
        e.preventDefault();
        var startX = e.clientX;
        var startY = e.clientY;
        var rect = box.getBoundingClientRect();
        var ov = overlayRect(box);
        var left = rect.left - ov.left;
        var top = rect.top - ov.top;
        box.style.position = 'absolute';
        box.style.left = left + 'px';
        box.style.top = top + 'px';
        box.style.margin = '0';
        box.classList.add('nr-win-dragging');
        try { box.setPointerCapture(e.pointerId); } catch (err) {}
        function move(ev) {
            var nl = left + (ev.clientX - startX);
            var nt = top + (ev.clientY - startY);
            var bw = box.offsetWidth;
            var bh = box.offsetHeight;
            nl = Math.max(0, Math.min(nl, ov.width - bw));
            nt = Math.max(0, Math.min(nt, ov.height - bh));
            box.style.left = nl + 'px';
            box.style.top = nt + 'px';
        }
        function up() {
            box.classList.remove('nr-win-dragging');
            try { box.releasePointerCapture(e.pointerId); } catch (err) {}
            box.removeEventListener('pointermove', move);
            box.removeEventListener('pointerup', up);
            box.removeEventListener('pointercancel', up);
        }
        box.addEventListener('pointermove', move);
        box.addEventListener('pointerup', up);
        box.addEventListener('pointercancel', up);
    }

    function decorate(box) {
        if (!box || box.nodeType !== 1) return box;
        box.classList.add('nr-win');
        ensureBar(box);
        ensureScroll(box);
        ensureHandles(box);
        var title = box.querySelector(':scope > .nr-win-bar .nr-win-title');
        if (title) title.textContent = titleOf(box);
        bindChrome(box);
        if (!box.classList.contains('nr-win-max') && !box.classList.contains('nr-win-min')) {
            paintBox(box, getSize());
        }
        box.dataset.nrWin = '1';
        return box;
    }

    function bind(el) {
        if (!el || el.nodeType !== 1) return el;
        if (el.matches && el.matches(BOX_SEL)) return decorate(el);
        if (el.id === 'modal-box') return decorate(el);
        var boxes = el.querySelectorAll(BOX_SEL);
        var i;
        for (i = 0; i < boxes.length; i++) decorate(boxes[i]);
        if (el.classList && el.classList.contains('nr-win')) decorate(el);
        return el;
    }

    function bindAll() {
        if (typeof document === 'undefined') return;
        var list = document.querySelectorAll(BOX_SEL);
        var i;
        for (i = 0; i < list.length; i++) decorate(list[i]);
    }

    var _obsTimer = 0;
    function scheduleBindAll() {
        if (_obsTimer) return;
        _obsTimer = setTimeout(function () {
            _obsTimer = 0;
            bindAll();
        }, 30);
    }

    function boot() {
        if (typeof document === 'undefined') return;
        applyAll(getSize());
        bindAll();
        if (document.body && !document.body.dataset.nrWinObs) {
            document.body.dataset.nrWinObs = '1';
            var obs = new MutationObserver(scheduleBindAll);
            obs.observe(document.body, { childList: true, subtree: true });
        }
        if (typeof window !== 'undefined' && !window.__nrWinResize) {
            window.__nrWinResize = true;
            window.addEventListener('resize', function () { applyAll(getSize()); });
        }
    }

    var api = {
        KEY: KEY,
        DEFAULT_W: DEFAULT_W,
        DEFAULT_H: DEFAULT_H,
        MIN_W: MIN_W,
        MIN_H: MIN_H,
        clamp: clamp,
        parseSize: parseSize,
        getSize: getSize,
        setSize: setSize,
        applyAll: applyAll,
        decorate: decorate,
        bind: bind,
        bindAll: bindAll,
        boot: boot,
    };
    root.NrWin = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
        else boot();
    }
})(typeof window !== 'undefined' ? window : globalThis);

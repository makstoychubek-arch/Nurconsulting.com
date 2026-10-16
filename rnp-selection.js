/* Выделение ячеек в РНП как в Excel: тянешь мышью (или долгий тап и тянешь на телефоне) и справа внизу
 * видно среднее, количество, сумму, минимум и максимум выделенного. Работает во всех таблицах РНП. */
(function (root) {
    'use strict';
    var doc = root.document;
    var SCOPE = '#tab-rnp, .rnp-stats-scope';

    /* ───────── чистые функции (проверяются тестами) ───────── */
    /** Число из текста ячейки: «1 234,5», «12,5%», «−3», «450 ₽». Иначе null. */
    function parseNum(text) {
        var s = String(text == null ? '' : text).replace(/[   \s]+/g, '').replace(/−/g, '-');
        if (!s) return null;
        var unit = '';
        var m = s.match(/^([+-]?\d[\d.,]*)(%|₽|сом|с|шт\.?|руб\.?|к|тыс\.?)?$/i);
        if (!m) return null;
        var num = m[1]; unit = (m[2] || '').toLowerCase();
        var lc = num.lastIndexOf(','), ld = num.lastIndexOf('.');
        if (lc >= 0 && ld >= 0) num = lc > ld ? num.replace(/\./g, '').replace(',', '.') : num.replace(/,/g, '');
        else if (lc >= 0) num = num.replace(',', '.');
        var v = parseFloat(num);
        if (!isFinite(v)) return null;
        return { v: v, unit: unit === 'с' || unit === 'сом' ? 'сом' : unit.replace(/\.$/, '') };
    }
    /** Сводка по списку текстов ячеек. */
    function stats(texts) {
        var nums = [], filled = 0, units = {};
        texts.forEach(function (t) {
            var s = String(t == null ? '' : t).replace(/[\s ]+/g, '');
            if (s && s !== '—' && s !== '-') filled++;
            var p = parseNum(t); if (p) { nums.push(p.v); units[p.unit] = 1; }
        });
        if (!nums.length) return { count: filled, nums: 0, unit: '' };
        var sum = nums.reduce(function (a, b) { return a + b; }, 0);
        var uk = Object.keys(units);
        return { count: filled, nums: nums.length, sum: sum, avg: sum / nums.length, min: Math.min.apply(null, nums), max: Math.max.apply(null, nums), unit: uk.length === 1 ? uk[0] : '' };
    }
    function fmt(n, unit) {
        if (n == null || !isFinite(n)) return '—';
        var s = Math.abs(n) >= 1000 ? Math.round(n * 100) / 100 : Math.round(n * 100) / 100;
        var out = s.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
        return out + (unit ? (unit === '%' ? '%' : ' ' + unit) : '');
    }

    /* ───────── состояние и выделение ───────── */
    var A = null, B = null, table = null, dragging = false, started = false, cells = [], touchTimer = 0, touchOn = false, bar = null, downXY = null;

    function cellOf(el) { return el && el.closest ? el.closest('td,th') : null; }
    function tableOf(td) { return td ? td.closest('table') : null; }
    function inScope(td) { return !!(td && td.closest(SCOPE)); }
    function rc(td) { var tr = td.parentElement; return { r: tr.rowIndex, c: td.cellIndex }; }

    function clear() {
        cells.forEach(function (c) { c.classList.remove('rnp-xsel'); });
        cells = []; A = B = table = null; started = false;
        hideBar();
    }
    function apply() {
        cells.forEach(function (c) { c.classList.remove('rnp-xsel'); });
        cells = [];
        if (!table || !A || !B) return;
        var a = rc(A), b = rc(B);
        var r0 = Math.min(a.r, b.r), r1 = Math.max(a.r, b.r), c0 = Math.min(a.c, b.c), c1 = Math.max(a.c, b.c);
        var rows = table.rows;
        for (var r = r0; r <= r1; r++) {
            var row = rows[r]; if (!row) continue;
            for (var c = c0; c <= c1; c++) { var cell = row.cells[c]; if (cell && cell.tagName === 'TD') cells.push(cell); }
        }
        cells.forEach(function (c) { c.classList.add('rnp-xsel'); });
        showBar();
    }

    function ensureBar() {
        if (bar && bar.isConnected) return bar;
        bar = doc.createElement('div'); bar.id = 'rnp-xstats'; bar.className = 'rnp-xstats'; bar.setAttribute('role', 'status'); bar.setAttribute('aria-live', 'polite');
        doc.body.appendChild(bar); return bar;
    }
    function showBar() {
        if (cells.length < 2) { hideBar(); return; }
        var s = stats(cells.map(function (c) { return c.dataset && c.dataset.rnpValue != null && c.dataset.rnpValue !== '' ? c.dataset.rnpValue : c.textContent; }));
        var b = ensureBar();
        if (!s.nums) { b.innerHTML = '<span>Количество: <b>' + s.count + '</b></span>'; b.classList.add('on'); return; }
        b.innerHTML = '<span>Среднее: <b>' + fmt(s.avg, s.unit) + '</b></span><span>Количество: <b>' + s.count + '</b></span><span>Сумма: <b>' + fmt(s.sum, s.unit) + '</b></span><span>Мин: <b>' + fmt(s.min, s.unit) + '</b></span><span>Макс: <b>' + fmt(s.max, s.unit) + '</b></span>';
        b.classList.add('on');
    }
    function hideBar() { if (bar) bar.classList.remove('on'); }

    /* ───────── мышь ───────── */
    function skip(e) { return e.target.closest && e.target.closest('input,textarea,select,button,a,[contenteditable="true"],.rnp-note-pop'); }
    function onDown(e) {
        if (e.button !== 0 || skip(e)) return;
        var td = cellOf(e.target);
        if (!inScope(td) || td.tagName !== 'TD') { if (!(e.target.closest && e.target.closest('#rnp-xstats'))) clear(); return; }
        if (e.shiftKey && A && tableOf(td) === table) { B = td; started = true; apply(); e.preventDefault(); return; }
        clear();
        A = B = td; table = tableOf(td); dragging = true; downXY = [e.clientX, e.clientY];
    }
    function onMove(e) {
        if (!dragging) return;
        var td = cellOf(doc.elementFromPoint(e.clientX, e.clientY));
        if (!td || td.tagName !== 'TD' || tableOf(td) !== table) return;
        if (td === B && started) return;
        if (!started && td === A) return;
        B = td;
        if (!started) { started = true; doc.documentElement.classList.add('rnp-xdrag'); }
        apply();
    }
    function onUp() {
        dragging = false; doc.documentElement.classList.remove('rnp-xdrag');
    }
    function onKey(e) { if (e.key === 'Escape' && cells.length) clear(); }
    function onSelectStart(e) { if (dragging && started) e.preventDefault(); }

    /* ───────── телефон: долгое нажатие и тянуть ───────── */
    function pointTd(t) { return cellOf(doc.elementFromPoint(t.clientX, t.clientY)); }
    function onTouchStart(e) {
        if (e.touches.length !== 1 || skip(e)) return;
        var td = cellOf(e.target);
        if (!inScope(td) || td.tagName !== 'TD') return;
        var t0 = e.touches[0], x0 = t0.clientX, y0 = t0.clientY;
        clearTimeout(touchTimer);
        touchTimer = setTimeout(function () {
            clear(); A = B = td; table = tableOf(td); touchOn = true; started = true;
            try { if (root.navigator.vibrate) root.navigator.vibrate(15); } catch (_) {}
            apply();
        }, 380);
        td.__x0 = x0; td.__y0 = y0;
    }
    function onTouchMove(e) {
        var t = e.touches[0];
        if (!touchOn) {
            // палец сдвинулся до срабатывания долгого нажатия — это обычная прокрутка
            var td = cellOf(e.target);
            if (td && (Math.abs(t.clientX - (td.__x0 || 0)) > 8 || Math.abs(t.clientY - (td.__y0 || 0)) > 8)) clearTimeout(touchTimer);
            return;
        }
        e.preventDefault();
        var td2 = pointTd(t);
        if (td2 && td2.tagName === 'TD' && tableOf(td2) === table && td2 !== B) { B = td2; apply(); }
    }
    function onTouchEnd() { clearTimeout(touchTimer); touchOn = false; }

    function init() {
        if (init.done) return; init.done = true;
        doc.addEventListener('mousedown', onDown, true);
        doc.addEventListener('mousemove', onMove, true);
        doc.addEventListener('mouseup', onUp, true);
        doc.addEventListener('keydown', onKey);
        doc.addEventListener('selectstart', onSelectStart, true);
        doc.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
        doc.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
        doc.addEventListener('touchend', onTouchEnd, true);
        doc.addEventListener('touchcancel', onTouchEnd, true);
        // таблица перерисовалась (смена периода, кабинета): выделенные ячейки пропали, сводку убираем
        new MutationObserver(function () { if (cells.length && !cells[0].isConnected) clear(); }).observe(doc.body, { childList: true, subtree: true });
    }
    if (doc) { if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init(); }

    var api = { parseNum: parseNum, stats: stats, fmt: fmt, clear: clear };
    root.RnpSelection = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

/* Окно «Новый А/Б тест»: по умолчанию смена фото «по кругу по времени».
 * Кнопки интервала 15 / 20 / 30 / 60 / 120 минут, подсказка про длину круга и автозавершение,
 * когда лидер выигрывает с вероятностью 95%. Работает поверх существующих полей формы,
 * поэтому серверная часть и расчёт не меняются. Существующие тесты не затрагиваются. */
(function (root) {
    'use strict';
    var doc = root.document;
    if (!doc) return;
    var PRESETS = [15, 20, 30, 60, 120];

    function $(id) { return doc.getElementById(id); }
    function fmtDur(min) {
        var h = Math.floor(min / 60), m = Math.round(min % 60);
        return (h ? h + ' ч' : '') + (h && m ? ' ' : '') + (m ? m + ' мин' : (h ? '' : '0 мин'));
    }
    function variantCount() {
        var box = $('variant-inputs');
        return box ? box.querySelectorAll('.ab-var-tile.has-img, .ab-var-tile.is-current').length : 0;
    }
    function paintChips() {
        var input = $('abt-interval');
        var v = input ? parseInt(input.value, 10) : 0;
        doc.querySelectorAll('#ab-rot-chips .ab-pill').forEach(function (p) {
            p.classList.toggle('active', Number(p.getAttribute('data-min')) === v);
        });
        var note = $('ab-rot-note');
        if (!note) return;
        var n = variantCount();
        note.textContent = n >= 2 && v > 0
            ? n + ' фото × ' + v + ' мин = круг за ' + fmtDur(n * v) + '. Потом снова первое фото.'
            : 'Фото идут по кругу и возвращаются, каждое побывает и утром, и вечером.';
    }
    function setup() {
        var sel = $('ab-rot-mode'), wrap = $('abWInt'), input = $('abt-interval');
        if (!sel || !wrap || !input) return;
        if (!sel.__nrRot) {
            sel.__nrRot = true;
            var opts = sel.options;
            for (var i = 0; i < opts.length; i++) {
                if (opts[i].value === 'time') opts[i].textContent = 'по кругу по времени (рекомендуем)';
                if (opts[i].value === 'imp') opts[i].textContent = 'по показам (запасной режим)';
            }
            var time = null; for (var j = 0; j < opts.length; j++) if (opts[j].value === 'time') time = opts[j];
            if (time) sel.insertBefore(time, sel.firstChild);
            var lbl = wrap.querySelector('.text-xs'); if (lbl) lbl.textContent = 'Держать каждое фото, мин';
            var chips = doc.createElement('div');
            chips.id = 'ab-rot-chips'; chips.className = 'ab-pill-toggle'; chips.style.cssText = 'margin-top:8px';
            chips.innerHTML = PRESETS.map(function (m) { return '<div class="ab-pill" data-min="' + m + '">' + (m >= 60 ? (m / 60) + ' ч' : m + ' мин') + '</div>'; }).join('');
            chips.addEventListener('click', function (e) {
                var p = e.target.closest && e.target.closest('.ab-pill'); if (!p) return;
                input.value = p.getAttribute('data-min'); paintChips();
            });
            wrap.appendChild(chips);
            var note = doc.createElement('div');
            note.id = 'ab-rot-note'; note.className = 'ab-wizard-hint'; wrap.appendChild(note);
            input.addEventListener('input', paintChips);
            input.min = '15'; input.step = '1';
            var vi = $('variant-inputs'); if (vi) new MutationObserver(paintChips).observe(vi, { childList: true, subtree: true });
            var stop = doc.querySelector('#ab-stop-on-winner'), stopLbl = stop && stop.closest('label');
            if (stopLbl && !$('ab-stop-conf')) {
                var l = doc.createElement('label'); l.className = 'ab-check';
                l.innerHTML = '<input type="checkbox" id="ab-stop-conf" checked> Завершить, когда лидер выигрывает с вероятностью 95% (от 1000 показов у лидера)';
                stopLbl.parentNode.insertBefore(l, stopLbl);
            }
        }
        var conf = $('ab-stop-conf'); if (conf) conf.checked = true;
        sel.value = 'time';
        if (!input.value || Number(input.value) < 15) input.value = '30';
        wrap.hidden = false;
        var imp = $('abWImp'); if (imp) imp.hidden = true;
        paintChips();
    }
    // Дополнительные настройки теста для createABTest: автозавершение по вероятности лидера.
    function extra() {
        var c = $('ab-stop-conf');
        return c && c.checked ? { stopOnWinner: true, minWinnerProb: 0.95, minCtr: 0.01, minWinnerImpressions: 1000 } : {};
    }
    function boot() {
        var orig = root.showNewTestForm;
        if (typeof orig === 'function' && !orig.__nrRot) {
            var w = function () { var r = orig.apply(this, arguments); try { setup(); } catch (e) { /* форма работает и без дополнения */ } return r; };
            w.__nrRot = true; root.showNewTestForm = w;
        }
    }
    root.NrAbRot = { extra: extra, setup: setup };
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
})(typeof window !== 'undefined' ? window : globalThis);

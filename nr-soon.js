/* Экран «Скоро открытие» для гостей и новых регистраций: всё остальное скрыто.
 * Команда (is_staff) и клиенты с платным доступом видят сайт как обычно.
 * Для проверки командой: добавить ?soon=1 к адресу (выключить: ?soon=0). */
(function (root) {
    'use strict';
    var doc = root.document, de = doc.documentElement;
    function ls(k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } }
    // ?soon=1 включает предпросмотр для команды на время вкладки, ?soon=0 выключает
    function forced() {
        try {
            var q = root.location.search;
            if (/[?&]soon=1\b/.test(q)) root.sessionStorage.setItem('nr_soon_preview', '1');
            if (/[?&]soon=0\b/.test(q)) root.sessionStorage.removeItem('nr_soon_preview');
            return root.sessionStorage.getItem('nr_soon_preview') === '1';
        } catch (e) { return false; }
    }
    function isSoon() { return forced() || (ls('nr_is_staff') !== '1' && ls('nr_paid') !== '1'); }
    function overlay() {
        if (doc.getElementById('nr-soon')) return;
        var host = doc.querySelector('.main-content'); if (!host) return;
        var d = doc.createElement('div'); d.id = 'nr-soon';
        d.innerHTML = '<div class="nr-soon-card"><span class="nr-fox-slot" data-size="104"></span><h2>Скоро открытие</h2><p>Мы готовим NR Space к запуску. Как только всё будет готово, вы сможете подключить свой магазин и пользоваться сервисом.</p></div>';
        host.insertBefore(d, host.firstChild);
        try { var s = d.querySelector('.nr-fox-slot'); if (s && root.NrFox) { s.style.width = s.style.height = '104px'; s.setAttribute('data-m', '1'); root.NrFox.mount(s, { size: 104, label: 'Лисёнок' }); } } catch (e) { /* украшение */ }
    }
    function apply() {
        var on = isSoon();
        if (on) de.setAttribute('data-soon', '1'); else de.removeAttribute('data-soon');
        if (on) { if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', overlay); else overlay(); }
    }
    apply();
    // Права приходят позже (is_staff, has_paid_access) и записываются в localStorage: следим за этим.
    try {
        var orig = root.Storage && root.Storage.prototype.setItem;
        if (orig) root.Storage.prototype.setItem = function (k, v) { var r = orig.apply(this, arguments); if (k === 'nr_is_staff' || k === 'nr_paid') apply(); return r; };
    } catch (e) { /* без перехвата права применятся при следующей загрузке */ }
    root.NrSoon = { isSoon: isSoon, apply: apply };
})(typeof window !== 'undefined' ? window : globalThis);

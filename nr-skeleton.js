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

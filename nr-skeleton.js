/* Пока данные не пришли, прочерк в показателях выглядит как готовое значение.
 * Подсвечиваем такие ячейки спокойной полоской и снимаем её, когда текст изменился (или через 10 с). */
(function () {
    'use strict';
    var CSS = '.nr-skel{color:transparent!important;background:linear-gradient(90deg,var(--sel,#eee) 25%,var(--border,rgba(0,0,0,.08)) 50%,var(--sel,#eee) 75%);background-size:200% 100%;animation:nrSkel 1.4s linear infinite;border-radius:6px;min-width:3.2em;display:inline-block;user-select:none}' +
        '@keyframes nrSkel{to{background-position:-200% 0}}@media (prefers-reduced-motion:reduce){.nr-skel{animation:none}}';
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
        var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
        scan();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

/* Снежный барс на экранах ожидания: вместо крутилки и голого «Загрузка…» показываем маленького барса.
 * Картинки: /img/leopard-mini.svg (анимированная), /img/leopard-loader.svg (большой, на экране входа).
 * Скрипт ничего не ломает при ошибке и не трогает кнопки и поля ввода. */
(function () {
    'use strict';
    try {
        var MINI = '/img/leopard-mini.svg';
        var st = document.createElement('style');
        st.textContent =
            '.nr-leo{display:inline-block;vertical-align:middle;width:28px;height:28px;margin-right:8px;pointer-events:none}' +
            '.nr-loader-ring{width:46px!important;height:46px!important;border:0!important;animation:none!important;background:url(' + MINI + ') center/contain no-repeat!important}' +
            '.wbc-spinner{width:22px!important;height:22px!important;border:0!important;animation:none!important;background:url(' + MINI + ') center/contain no-repeat!important;vertical-align:middle}';
        document.head.appendChild(st);

        var RE = /^\s*(Загрузк|Загружаем|Инициализаци)/i;
        function paint(el) {
            if (!el || el.nodeType !== 1 || el.__nrLeo) return;
            if (el.children.length || /^(BUTTON|A|INPUT|OPTION|LABEL|SCRIPT|STYLE|TEXTAREA|SELECT|TITLE)$/.test(el.tagName)) return;
            var t = el.textContent || '';
            if (t.length > 60 || !RE.test(t) || el.closest('button,a,select,[data-no-leo]')) return;
            el.__nrLeo = true;
            var img = document.createElement('img');
            img.className = 'nr-leo'; img.src = MINI; img.alt = ''; img.setAttribute('aria-hidden', 'true'); img.width = 28; img.height = 28;
            el.insertBefore(img, el.firstChild);
        }
        function scan(root) {
            if (!root || root.nodeType !== 1) return;
            paint(root);
            if (root.children.length && (root.textContent || '').length < 400) root.querySelectorAll('*').forEach(paint);
        }
        var mo = new MutationObserver(function (list) {
            for (var i = 0; i < list.length; i++) {
                var added = list[i].addedNodes;
                for (var j = 0; j < added.length; j++) scan(added[j]);
            }
        });
        function init() {
            document.querySelectorAll('div,td,p,span').forEach(paint);
            mo.observe(document.body, { childList: true, subtree: true });
        }
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
    } catch (e) { /* украшение не должно ломать сайт */ }
})();

/* Товары: у каждой вкладки маленькая кнопка «?» с пояснением (вместо длинных серых подписей под заголовком). */
(function (root) {
    'use strict';
    var HINTS = {
        now: ['Остатки', 'Сколько товара на складах: ФБО (склад WB) и ФБС (ваш склад или ФФ), что в пути и в плане, и на сколько дней хватит запаса. Цвет строки показывает, как срочно нужен дозаказ.'],
        daily: ['Остатки по дням', 'Остаток каждого товара на конец каждого дня. Видно, когда товар заканчивался и как менялся запас.'],
        cost: ['Себестоимость', 'Закупочная цена каждого товара. По ней считается прибыль на дашборде и в РНП: впишите цену, и она применится ко всем размерам.'],
        fbs: ['FBS', 'Товар на складе продавца (ФФ). Здесь вносятся тарифы ФФ: отправка за штуку и хранение по периодам (после ввода сайт спросит, с какой даты), а также хранение по остатку с суточным лимитом. Из них считается блок «Фулфилмент» на дашборде. Две галочки решают, учитывать ли отправку и хранение в РНП по отдельности (на дашборде они учитываются всегда). Две галочки внизу решают, учитывать ли отправку и хранение в РНП — по отдельности.'],
        ship: ['Логистика', 'Партии товара, которые едут в WB: блоками по партиям, размеры колонками. В РНП суммы по размерам идут в строку «В пути» (статусы: в пути, на карго, Принято ФФ, ЕДЕТ В МСК, Маркировка).'],
        prod: ['Заказ на производство', 'План пошива: артикул, расцветка, общее количество и процентовка по размерам. Количество по размерам считается само, остаток от округления уходит в крупные размеры. В РНП идёт в строку «В пошиве».'],
        give: ['Раздачи', 'Учёт раздач товара: кэшбек, блогеры, бартер. Таблица как в Google Sheets: выделяйте мышью, копируйте Ctrl+C и вставляйте Ctrl+V группами, Delete очищает, квадратик у выделения протягивается вниз и вправо.'],
    };
    var pop = null;
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function close() { if (pop) { pop.remove(); pop = null; } }
    function open(key, anchor) {
        close();
        var h = HINTS[key]; if (!h) return;
        pop = document.createElement('div');
        pop.className = 'nh-pop'; pop.setAttribute('role', 'dialog');
        pop.innerHTML = '<b>' + esc(h[0]) + '</b><p>' + esc(h[1]) + '</p>';
        document.body.appendChild(pop);
        var r = anchor.getBoundingClientRect(), w = Math.min(340, window.innerWidth - 24);
        pop.style.width = w + 'px';
        pop.style.left = Math.max(12, Math.min(r.left, window.innerWidth - w - 12)) + 'px';
        pop.style.top = (r.bottom + 8) + 'px';
    }
    function mk(key) {
        var s = document.createElement('span');
        s.className = 'nh-i'; s.setAttribute('role', 'button'); s.setAttribute('tabindex', '0');
        s.setAttribute('aria-label', 'Что это за раздел'); s.setAttribute('data-nh', key); s.textContent = '?';
        return s;
    }
    function inject() {
        Object.keys(HINTS).forEach(function (k) {
            var btn = document.getElementById('gg-view-' + k + '-btn');
            if (btn && !btn.querySelector('.nh-i')) btn.appendChild(mk(k));
        });
        [['ship', 'gg-view-ship'], ['prod', 'gg-view-prod']].forEach(function (p) {
            var t = document.querySelector('#' + p[1] + ' .gs-title');
            if (t && !t.querySelector('.nh-i')) t.appendChild(mk(p[0]));
        });
    }
    document.addEventListener('click', function (e) {
        var i = e.target.closest && e.target.closest('.nh-i');
        if (i) { e.preventDefault(); e.stopPropagation(); if (pop && pop.getAttribute('data-k') === i.getAttribute('data-nh')) { close(); return; } open(i.getAttribute('data-nh'), i); if (pop) pop.setAttribute('data-k', i.getAttribute('data-nh')); return; }
        if (pop && !e.target.closest('.nh-pop')) close();
    }, true);
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') close();
        else if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('nh-i')) { e.preventDefault(); e.target.click(); }
    });
    var timer = null;
    function later() { clearTimeout(timer); timer = setTimeout(inject, 150); }
    function start() {
        inject();
        var host = document.getElementById('tab-goods-groups') || document.body;
        new MutationObserver(later).observe(host, { childList: true, subtree: true });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
    root.NrHints = { open: open, close: close, HINTS: HINTS };
})(window);

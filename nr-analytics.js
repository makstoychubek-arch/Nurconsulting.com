/* Аналитика (только команда, BETA): верх с вкладками-подразделами и четыре подраздела.
 * Данные пока не подключены: структура готова, значения «—». Рисуем один раз при открытии вкладки. */
(function (root) {
    'use strict';
    var doc = root.document;
    if (!doc) return;

    var TABS = [
        { id: 'niches', title: 'Подбор ниш' },
        { id: 'content', title: 'Сравнение контента' },
        { id: 'card', title: 'Сравнение карточки' },
        { id: 'reviews', title: 'Анализ отзывов' }
    ];

    function tile(label, value, dark) { return '<div class="an-tile' + (dark ? ' an-dark' : '') + '"><div class="an-cap">' + label + '</div><b>' + value + '</b></div>'; }
    function col(title, rows) {
        return '<div class="an-col"><h3>' + title + '</h3>' + rows.map(function (r) { return '<div class="an-kv"><span>' + r[0] + '</span><span>' + r[1] + '</span></div>'; }).join('') + '</div>';
    }
    function tools(inputs, chips) {
        return '<div class="an-tools">' + inputs.map(function (t) { return '<input class="an-inp" disabled placeholder="' + t + '">'; }).join('') +
            chips.map(function (c, i) { return '<span class="an-chip' + (i === 0 ? ' on' : '') + '">' + c + '</span>'; }).join('') + '</div>';
    }
    var NOTE = '<p class="an-note">Раздел готовится. Данные подключим следующим шагом.</p>';

    var PANES = {
        niches: tools(['Категория или ключевое слово'], ['За 3 месяца', 'Выручка от 5 млн', 'Продавцов до 300']) +
            '<div class="an-tiles">' + tile('Лучшая ниша сейчас', '—', true) + tile('Выручка ниши', '—') + tile('Продавцов', '—') + tile('Доля топ 10', '—') + '</div>' +
            '<div class="an-two">' + col('Топ 5 товаров ниши', [['1.', '—'], ['2.', '—'], ['3.', '—']]) + col('Что показывает ниша', [['Сезонность', '—'], ['Средний чек', '—'], ['Выкуп', '—']]) + '</div>' + NOTE,
        content: tools(['Ваш артикул WB', 'Артикул конкурента'], []) +
            '<div class="an-tw"><table class="an-table"><thead><tr><th>Показатель</th><th>Ваш</th><th>Конкурент</th><th>Разница</th></tr></thead><tbody>' +
            ['Количество фото', 'Видео', 'Инфографика', 'Фото с моделью'].map(function (r) { return '<tr><td>' + r + '</td><td>—</td><td>—</td><td>—</td></tr>'; }).join('') + '</tbody></table></div>' + NOTE,
        card: tools(['Ваш артикул WB', 'Артикул конкурента'], []) +
            '<div class="an-tiles">' + tile('Главное отличие', '—', true) + tile('Цена', '—') + tile('Описание', '—') + tile('Характеристики', '—') + '</div>' +
            '<div class="an-two">' + col('Ключевые слова конкурента, которых нет у вас', [['—', '']]) + col('Что поправить в первую очередь', [['1.', '—'], ['2.', '—'], ['3.', '—']]) + '</div>' + NOTE,
        reviews: tools(['Артикул или весь кабинет'], ['30 дней', 'Только негатив', 'Без ответа']) +
            '<div class="an-col"><h3>О чём пишут покупатели</h3><div class="an-themes"><span class="an-theme">темы появятся здесь</span></div></div>' +
            '<div class="an-tiles">' + tile('Главная жалоба', '—', true) + tile('Рейтинг', '—') + tile('Без ответа', '—') + tile('Выкуп', '—') + '</div>' + NOTE
    };

    function mount() {
        var host = doc.getElementById('tab-analytics');
        if (!host || host.getAttribute('data-ready')) return;
        host.setAttribute('data-ready', '1');
        host.innerHTML = '<div class="an-nav" id="an-tabs" role="tablist">' +
            TABS.map(function (t, i) { return '<button type="button" class="an-tab' + (i === 0 ? ' on' : '') + '" role="tab" aria-selected="' + (i === 0) + '" data-an="' + t.id + '">' + t.title + '</button>'; }).join('') +
            '</div>' + TABS.map(function (t, i) { return '<div class="an-pane" id="an-' + t.id + '"' + (i ? ' hidden' : '') + '>' + PANES[t.id] + '</div>'; }).join('');
        host.querySelector('#an-tabs').addEventListener('click', function (e) {
            var b = e.target.closest('[data-an]'); if (!b) return;
            Array.prototype.forEach.call(host.querySelectorAll('.an-tab'), function (x) {
                var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-selected', on ? 'true' : 'false');
                var pane = doc.getElementById('an-' + x.getAttribute('data-an')); if (pane) pane.hidden = !on;
            });
        });
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', mount); else mount();
    root.NrAnalytics = { mount: mount };
})(typeof window !== 'undefined' ? window : globalThis);

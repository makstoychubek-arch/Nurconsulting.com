/* Сравнение контента (Аналитика → «Сравнение контента»): четыре мини-раздела по образцу таблицы владельца
 * «сравнение контента»: Конкуренты (15 похожих + 10 топов по выручке), СЕО (факт и новый вариант, слова, запросы),
 * Утечка (воронка товара и где теряем покупателя), Медиа (фото под утечку, оплата за карточку, отправка на WB).
 * Сейчас это каркас: свои данные (товар, выручка, воронка) настоящие, данные конкурентов, СЕО и генерация подключаются следующим шагом.
 * Каркас рисуется сразу, цифры подставляются без перерисовки. */
(function (root) {
    'use strict';
    var doc = root.document;
    if (!doc) return;

    var SECS = [['rivals', 'Конкуренты'], ['seo', 'СЕО'], ['leak', 'Утечка'], ['media', 'Медиа']];
    var PRICE_SOM = 1000, DAYS = 30;
    // Поля карточки из листа «СЕО» (строки «ФАКТ ВАРИАНТ / НОВЫЙ ВАРИАНТ»)
    var FIELDS = ['Артикул продавца', 'Артикул WB', 'Наименование', 'Категория продавца', 'Бренд', 'Описание', 'Материал верха', 'Пол', 'Состав', 'Цвет', 'Баркод', 'Размер', 'Рос. размер', 'Вид застежки', 'Возрастные ограничения', 'Вырез горловины', 'Декоративные элементы', 'ИКПУ', 'Код ТРУ 1', 'Код ТРУ 2', 'Код упаковки', 'Количество штук в товаре по ЭС', 'Коллекция', 'Комплектация', 'Любимые герои', 'Назначение', 'ОКПД 2', 'Особенности модели', 'Параметры модели на фото (ОГ-ОТ-ОБ)', 'Покрой', 'Размер на модели', 'Рисунок', 'Рост модели на фото', 'Сезон', 'Стиль', 'Страна производства', 'ТНВЭД', 'Тип ростовки', 'Тип рукава', 'Уход за вещами', 'Фактура материала', 'Форма рукава'];
    var QUALITY = ['Супер релевантно', 'Релевантно', 'Нерелевантно но пусть будет', 'Исключить из карточки'];
    var SLIDES = ['Обложка', 'Главная выгода', 'Посадка и крой', 'Размеры и замеры', 'Состав и ткань', 'Детали', 'С чем носить', 'Доверие и отзывы'];
    var S = { cab: '', arts: [], nm: 0, sec: 'rivals', fun: null, cmp: null, all: null, allFun: null, jobs: {}, token: 0, bound: false, poll: 0 };

    function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function fmt(n) { return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
    function pct(v) { return v == null || !isFinite(v) ? '—' : (Math.round(v * 10) / 10).toString().replace('.', ',') + '%'; }
    function sb() { return root.supabase; }
    function cabId() { var c = root.currentCabinetId; if (c) return c; try { return root.localStorage.getItem('selected_cabinet_id') || ''; } catch (_) { return ''; } }
    function ymd(d) { return d.toISOString().slice(0, 10); }
    function period() { var to = new Date(Date.now() + 6 * 3600e3), from = new Date(to.getTime() - (DAYS - 1) * 86400e3); return { from: ymd(from), to: ymd(to) }; }
    function dm(iso) { return iso.slice(8, 10) + '.' + iso.slice(5, 7); }
    function art() { for (var i = 0; i < S.arts.length; i++) if (Number(S.arts[i].nm_id) === S.nm) return S.arts[i]; return null; }
    function say(title, text) { if (root.NrUi) root.NrUi.toast('info', title, text); }
    function lsGet(k) { try { return JSON.parse(root.localStorage.getItem(k) || 'null'); } catch (_) { return null; } }
    function lsSet(k, v) { try { root.localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* без кэша */ } }

    // ───── расчёт воронки (чистая функция, проверяется тестом) ─────
    function funnel(rows) {
        var t = { imp: 0, clk: 0, cart: 0, ord: 0, buy: 0, rev: 0, cCtr: [], cCart: [], cOrd: [] };
        (rows || []).forEach(function (r) {
            t.imp += Number(r.impressions) || 0; t.clk += Number(r.clicks) || 0; t.cart += Number(r.basket_count) || 0;
            t.ord += Number(r.funnel_orders) || Number(r.orders_count) || 0; t.buy += Number(r.sales_count) || 0; t.rev += Number(r.orders_sum) || 0;
            if (Number(r.competitor_ctr) > 0) t.cCtr.push(Number(r.competitor_ctr));
            if (Number(r.competitor_basket) > 0) t.cCart.push(Number(r.competitor_basket));
            if (Number(r.competitor_cro) > 0) t.cOrd.push(Number(r.competitor_cro));
        });
        var avg = function (a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; };
        var div = function (a, b) { return b > 0 ? a / b * 100 : null; };
        // В базе «показы» равны переходам в карточку, поэтому настоящий шаг «показы → клики» есть только когда показов больше кликов.
        var realImp = t.imp > t.clk * 1.02;
        var steps = [];
        if (realImp) steps.push({ id: 'ctr', from: 'Показы', to: 'Переходы', a: t.imp, b: t.clk, ours: div(t.clk, t.imp), rival: avg(t.cCtr), fix: 'Обложка: первый кадр, ракурс, цвет фона, цена на фото' });
        steps.push(
            { id: 'cart', from: 'Переходы', to: 'Корзина', a: t.clk, b: t.cart, ours: div(t.cart, t.clk), rival: avg(t.cCart), fix: 'Слайды 2–5: выгоды, посадка, размеры и замеры, состав' },
            { id: 'order', from: 'Корзина', to: 'Заказ', a: t.cart, b: t.ord, ours: div(t.ord, t.cart), rival: avg(t.cOrd), fix: 'Цена и скидка, срок доставки, отзывы с фото' },
            { id: 'buyout', from: 'Заказ', to: 'Выкуп', a: t.ord, b: t.buy, ours: div(t.buy, t.ord), rival: null, fix: 'Размерная сетка и реальные фото: меньше возвратов «не подошло»' }
        );
        var worst = null;
        steps.forEach(function (s) { if (s.ours != null && s.rival != null) { s.gap = s.ours - s.rival; if (s.gap < 0 && (!worst || s.gap / s.rival < worst.gap / worst.rival)) worst = s; } });
        return { total: t, steps: steps, worst: worst, realImp: realImp };
    }

    // ───── части каркаса ─────
    function ghostRows(n, cols) {
        var o = '';
        for (var i = 1; i <= n; i++) { o += '<tr><td>' + i + '</td>'; for (var c = 1; c < cols; c++) o += '<td><span class="cc-g"></span></td>'; o += '</tr>'; }
        return o;
    }
    function photo(a, cls) {
        return a && a.photo_url ? '<img class="' + cls + '" src="' + esc(a.photo_url) + '" alt="" loading="lazy">' : '<div class="' + cls + ' cc-nophoto">нет фото</div>';
    }
    // ───── фото товара WB по артикулу: адрес корзины зависит от номера, подбираем перебором и запоминаем ─────
    // Таблица «номер vol → корзина WB» та же, что в РНП (rnp-module.js): снята запросами к CDN. Если корзина всё же не та, картинка перебирает соседние.
    var BASK = [[0, 1], [144, 2], [288, 3], [432, 4], [720, 5], [1008, 6], [1062, 7], [1116, 8], [1170, 9], [1314, 10], [1602, 11], [1656, 12], [1920, 13], [2046, 14], [2190, 15],
        [2406, 16], [2626, 17], [2876, 18], [3074, 19], [3345, 20], [3911, 22], [3996, 23], [4143, 24], [4357, 25], [4950, 27], [5394, 28], [5978, 30], [6296, 31], [6641, 32],
        [7053, 33], [7408, 35], [7714, 36], [8493, 38], [8897, 39], [9719, 41], [11503, 43], [12187, 44], [15444, 48]];
    function wbHost(vol) {
        var h = 1;
        for (var i = 0; i < BASK.length; i++) { if (vol < BASK[i][0]) break; h = BASK[i][1]; }
        if (vol >= 15444) h = 48 + Math.round((vol - 15444) / 760);
        return h;
    }
    function wbUrl(nm, host, idx, size) { var h = host < 10 ? '0' + host : String(host); return 'https://basket-' + h + '.wbbasket.ru/vol' + Math.floor(nm / 1e5) + '/part' + Math.floor(nm / 1e3) + '/' + nm + '/images/' + (size || 'c246x328') + '/' + (idx || 1) + '.webp'; }
    var HOSTS = lsGet('nr_cc_wbhost_v2') || {};
    function wbImg(nm, idx, size) {
        nm = Number(nm); if (!nm) return '<div class="cc-th cc-nophoto"></div>';
        var vol = Math.floor(nm / 1e5), h = HOSTS[vol] || wbHost(vol);
        return '<img class="cc-th" data-wb="' + nm + '" data-h="' + h + '" data-i="' + (idx || 1) + '" data-sz="' + (size || '') + '" data-try="0" src="' + wbUrl(nm, h, idx, size) + '" alt="" loading="lazy">';
    }
    // не загрузилось: пробуем соседние корзины (+1, −1, +2, −2 …), после 16 попыток показываем заглушку
    doc.addEventListener('error', function (e) {
        var im = e.target; if (!im || !im.getAttribute || !im.getAttribute('data-wb')) return;
        var nm = Number(im.getAttribute('data-wb')), base = Number(im.getAttribute('data-h')), n = Number(im.getAttribute('data-try')) + 1;
        if (n > 16) { im.removeAttribute('data-wb'); im.classList.add('cc-nophoto'); im.removeAttribute('src'); return; }
        var h = base + (n % 2 ? 1 : -1) * Math.ceil(n / 2);
        im.setAttribute('data-try', String(n));
        if (h < 1) { im.dispatchEvent(new root.Event('error')); return; }
        im.src = wbUrl(nm, h, Number(im.getAttribute('data-i')) || 1, im.getAttribute('data-sz') || '');
    }, true);
    doc.addEventListener('load', function (e) {
        var im = e.target; if (!im || !im.getAttribute || !im.getAttribute('data-wb') || !Number(im.getAttribute('data-try'))) return;
        var m = /basket-(\d+)\./.exec(im.src); if (!m) return;
        HOSTS[Math.floor(Number(im.getAttribute('data-wb')) / 1e5)] = Number(m[1]); lsSet('nr_cc_wbhost_v2', HOSTS);
    }, true);

    // ───── сводка по конкурентам (чистая функция, проверяется тестом) ─────
    function rivalStats(d) {
        var sim = (d && d.similar) || [], top = (d && d.top) || [], our = Number(d && d.rev) || 0;
        var revs = sim.map(function (x) { return Number(x.rev) || 0; }).sort(function (x, y) { return x - y; });
        var med = revs.length ? (revs.length % 2 ? revs[(revs.length - 1) / 2] : (revs[revs.length / 2 - 1] + revs[revs.length / 2]) / 2) : null;
        var all = {}; sim.concat(top).forEach(function (x) { all[x.nm] = Number(x.rev) || 0; });
        var list = Object.keys(all).map(function (k) { return all[k]; });
        var lead = list.length ? Math.max.apply(null, list) : null;
        var place = list.length ? list.filter(function (v) { return v > our; }).length + 1 : null;
        return { our: our, median: med, leader: lead, place: place, of: list.length + 1 };
    }
    // Склейки карточек WB (imt_id): колонки одной склейки стоят рядом, между склейками ограждение с названием
    function grpKey(a) { return a && Number(a.imt_id) ? Number(a.imt_id) : 0; }
    function grpName(arr) { var a = arr.filter(Boolean)[0]; return a ? String(a.card_title || a.subject_name || '').trim() || 'Склейка' : 'Без склейки'; }
    // list: элементы с полем nm; возвращает группы [{key, name, items}], порядок склеек как у первого появившегося артикула
    function groups(list, byArt) {
        var order = [], by = {};
        list.forEach(function (x) {
            var a = byArt[Number(x.nm)], k = grpKey(a);
            if (!by[k]) { by[k] = { key: k, arts: [], items: [] }; order.push(k); }
            by[k].items.push(x); by[k].arts.push(a);
        });
        var res = order.map(function (k) { var g = by[k]; g.name = k ? grpName(g.arts) : 'Без склейки'; return g; });
        // у разных склеек бывает одинаковое название карточки: к повторам добавляем последние цифры номера склейки
        var cnt = {}; res.forEach(function (g) { cnt[g.name] = (cnt[g.name] || 0) + 1; });
        res.forEach(function (g) { if (cnt[g.name] > 1 && g.key) g.name += ' №' + String(g.key).slice(-4); });
        return res;
    }
    function gapHtml(g) { return '<div class="cs-gap" aria-hidden="true"><span>' + esc(g.name) + ' · ' + g.items.length + '</span></div>'; }
    function ratio(rev, our) {
        if (!(our > 0) || rev == null) return '<span class="cc-mut">—</span>';
        var k = rev / our, t = k >= 10 ? Math.round(k) : Math.round(k * 10) / 10;
        return '<span class="cc-pill ' + (k > 1 ? 'dn' : 'up') + '">×' + String(t).replace('.', ',') + '</span>';
    }
    // «Конкуренты» как в таблице владельца: блоки по артикулам стоят в ряд (название, наше фото, артикул, НАША ВЫРУЧКА),
    // под ними АРТИКУЛ / ФОТО / ВЫРУЧКА: 15 похожих и 10 топов. Лист листается вбок, слева закреплены номера строк.
    function blockHtml(d, a, sel) {
        var st = rivalStats(d), nm = d ? d.nm : (a && a.nm_id);
        var row = function (x) {
            return x ? '<div class="cs-r"><a class="cc-a" href="https://www.wildberries.ru/catalog/' + x.nm + '/detail.aspx" target="_blank" rel="noopener">' + x.nm + '</a>' + wbImg(x.nm).replace('cc-th', 'cc-th cs-im') + '<b>' + (x.rev == null ? '—' : fmt(x.rev)) + '</b></div>'
                : '<div class="cs-r"><span class="cc-g"></span><div class="cc-th cs-im cc-nophoto"></div><span class="cc-g"></span></div>';
        };
        var list = function (arr, n) { var o = ''; for (var i = 0; i < n; i++) o += row(arr && arr[i]); return o; };
        var ph = a && a.photo_url ? '<img class="cs-ph" src="' + esc(a.photo_url) + '" alt="" loading="lazy">' : (nm ? wbImg(nm).replace('cc-th', 'cs-ph') : '<div class="cs-ph cc-nophoto"></div>');
        return '<section class="cs-b' + (sel ? ' on' : '') + '" data-nm="' + esc(nm || '') + '">' +
            '<div class="cs-name" title="' + esc((d && d.name) || (a && a.name) || '') + '">' + esc((d && d.name) || (a && (a.seller_article || a.name)) || '—') + '</div>' + ph +
            '<div class="cs-art">' + esc(nm || '—') + '</div>' +
            '<div class="cs-rev"><span>Наша выручка</span><b>' + (d && d.rev != null ? fmt(d.rev) : '—') + '</b></div>' +
            '<div class="cs-h"><span>Артикул</span><span>Фото</span><span>Выручка</span></div>' +
            list(d && d.similar, 15) + '<div class="cs-sep">Топ по выручке</div>' + list(d && d.top, 10) + '</section>';
    }
    function rivalsHtml() {
        var all = S.all, byArt = {};
        S.arts.forEach(function (x) { byArt[Number(x.nm_id)] = x; });
                var nums = function (from, n) { var o = ''; for (var i = 0; i < n; i++) o += '<div class="cs-n">' + (from + i) + '</div>'; return o; };
        all = all && all.filter(function (d) { return (d.similar && d.similar.length) || (d.top && d.top.length); });
        var blocks = all && all.length ? groups(all, byArt).map(function (g) { return gapHtml(g) + g.items.map(function (d) { return blockHtml(d, byArt[Number(d.nm)], Number(d.nm) === S.nm); }).join(''); }).join('')
            : (S.arts.length ? S.arts.slice(0, 6) : [null, null, null, null]).map(function (a) { return blockHtml(null, a, a && Number(a.nm_id) === S.nm); }).join('');
        return '<div class="cs-wrap"><div class="cs-sheet"><div class="cs-side"><div class="cs-side-top"><span>Название</span><span>Наше фото</span><span>Артикул</span></div><div class="cs-h"><span>№</span></div>' + nums(1, 15) + '<div class="cs-sep">&nbsp;</div>' + nums(1, 10) + '</div>' + blocks + '</div></div>';
    }
    function nl(t) { return esc(t).replace(/\n/g, '<br>'); }
    function longCell(t) {
        t = String(t || ''); if (!t) return '<span class="cc-mut">—</span>';
        return t.length > 220 ? '<details class="cc-more"><summary>' + esc(t.slice(0, 200)) + '…</summary><div>' + nl(t) + '</div></details>' : nl(t);
    }
    var VERD = { 'наш': 'up', 'НЕТ': 'dn' };
    function seoOne() {
        var a = art(), d = S.cmp, seo = d && d.seo, labels = (d && d.labels) || FIELDS, by = {};
        ((seo && seo.fields) || []).forEach(function (x) { by[x.k] = x; });
        var fact = { 'Артикул продавца': a && a.seller_article, 'Артикул WB': a && a.nm_id, 'Наименование': a && a.name };
        var rows = labels.map(function (k) {
            var x = by[k], fv = x ? x.fact : (fact[k] || ''), nv = x ? x.new : (k === 'Артикул WB' && seo ? (a && a.nm_id) : '');
            if (k === 'Артикул WB' && !fv) fv = a && a.nm_id;
            var empty = seo ? '<span class="cc-mut">—</span>' : '<span class="cc-g"></span>';
            return '<tr' + (x && x.ch ? ' class="cc-ch"' : '') + '><td>' + esc(k) + '</td><td>' + (fv ? longCell(fv) : empty) + '</td><td>' + (nv ? longCell(nv) + (x && x.ch ? ' <span class="cc-new">новое</span>' : '') : empty) + '</td></tr>';
        }).join('');
        var q = QUALITY.map(function (x, i) { return '<span class="cc-q cc-q' + i + '">' + x + '</span>'; }).join('');
        var words = seo && seo.words && seo.words.length ? seo.words.map(function (w, i) {
            return '<tr><td>' + (i + 1) + '</td><td>' + esc(w.w) + '</td><td>' + esc(w.freq) + '</td><td><span class="cc-pill ' + (VERD[w.verdict] || '') + '">' + esc(w.verdict) + '</span></td><td class="cc-fix">' + esc(w.note) + '</td></tr>';
        }).join('') : ghostRows(8, 5);
        var it = (seo && seo.itog) || {};
        var itog = [['Итог для описания', it.keep], ['Убрать из текущего описания', it.remove], ['Под вопросом', it.doubt]].map(function (x) {
            return '<div class="cc-it"><div class="cc-cap">' + x[0] + '</div><div>' + (x[1] ? nl(x[1]) : (seo ? '<span class="cc-mut">—</span>' : '<span class="cc-g cc-gw"></span>')) + '</div></div>';
        }).join('');
        var qs = seo && seo.queries && seo.queries.length ? seo.queries.map(function (x, i) {
            return '<tr><td>' + (i + 1) + '</td><td>' + esc(x.q) + '</td><td>' + (x.freq == null ? '—' : fmt(x.freq)) + '</td><td><span class="cc-q cc-q' + x.quality + '">' + QUALITY[x.quality] + '</span></td><td>' + (x.price == null ? '—' : fmt(x.price)) + '</td></tr>';
        }).join('') : ghostRows(8, 5);
        var cnt = seo && seo.queries ? seo.queries.length : 0;
        return '<div class="cc-acts"><button type="button" class="cc-btn cc-btn-b" data-cc-act="seo">' + (seo ? 'Обновить СЕО' : 'Собрать СЕО') + '</button><span class="cc-note">' + (seo ? 'Перенесено из вашей таблицы. Строки с пометкой «новое» отличаются от текущей карточки.' : 'Идёт бонусом к карточке. Запросы размечаются строго одной из четырёх оценок.') + '</span></div>' +
            '<div class="cc-card"><div class="cc-h"><h3>СЕО оптимизация</h3><span>' + labels.length + ' полей карточки</span></div><div class="cc-tw"><table class="cc-t cc-t3"><thead><tr><th>Поле</th><th>Факт вариант</th><th>Новый вариант</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>' +
            '<div class="cc-two"><div class="cc-card"><div class="cc-h"><h3>СЕО уникальные слова</h3><span>слово · частотность · вердикт</span></div><div class="cc-tw cc-scroll"><table class="cc-t"><thead><tr><th>№</th><th>Слово</th><th>Частотность</th><th>Вердикт</th><th>Пример запроса</th></tr></thead><tbody>' + words + '</tbody></table></div></div>' +
            '<div class="cc-card"><div class="cc-h"><h3>СЕО описания</h3><span>слова для нового описания</span></div>' + itog + '</div></div>' +
            '<div class="cc-card"><div class="cc-h"><h3>Ключевые запросы' + (cnt ? ' · ' + cnt : '') + '</h3><span>' + q + '</span></div><div class="cc-tw cc-scroll"><table class="cc-t"><thead><tr><th>№</th><th>Запрос</th><th>Частотность</th><th>Качество запроса</th><th>Средняя цена первых 25 после СПП</th></tr></thead><tbody>' + qs + '</tbody></table></div></div>';
    }
    // «СЕО» как в таблице владельца: блоки артикулов в ряд, в каждом «ФАКТ ВАРИАНТ | НОВЫЙ ВАРИАНТ» по всем полям карточки,
    // ниже «СЕО Уникальные слова | Все уникальные слова для создания СЕО ОПИСАНИЯ» и «Ключевые запросы». Названия полей закреплены слева.
    function seoHtml() {
        var list = (S.all || []).filter(function (d) { return d.seo; });
        if (!list.length) return seoOne();
        var byArt = {}; S.arts.forEach(function (x) { byArt[Number(x.nm_id)] = x; });
        var gs = groups(list, byArt); list = [].concat.apply([], gs.map(function (g) { return g.items; }));
        // разделитель-колонка стоит перед первым артикулом каждой склейки; в ячейке шапки пишем название склейки
        var gstart = {}; gs.forEach(function (g) { gstart[g.items[0].nm] = g; });
        var sp = function (d, tag, inner) { var g = gstart[d.nm]; return g ? '<' + tag + ' class="sq-gap">' + (inner ? '<span>' + esc(g.name) + ' · ' + g.items.length + '</span>' : '') + '</' + tag + '>' : ''; };
        var labels = list[0].labels && list[0].labels.length ? list[0].labels : FIELDS;
        var cls = function (d) { return Number(d.nm) === S.nm ? ' class="on"' : ''; };
        var maps = list.map(function (d) { var m = {}; (d.seo.fields || []).forEach(function (x) { m[x.k] = x; }); return m; });
        var cell = function (t, strong) { t = String(t == null ? '' : t); return t ? '<div class="sq-c' + (t.length > 160 ? ' sq-long' : '') + (strong ? ' sq-new' : '') + '">' + nl(t) + '</div>' : '<span class="cc-mut">—</span>'; };
        var head = '<tr class="sq-names"><th class="sq-l">Артикул продавца</th>' + list.map(function (d) { var a = byArt[Number(d.nm)]; return sp(d, 'th', 1) + '<th colspan="2"' + cls(d) + ' data-nm="' + d.nm + '">' + esc(d.name || (a && a.seller_article) || '') + '</th>'; }).join('') + '</tr>' +
            '<tr class="sq-photos"><th class="sq-l">Фото</th>' + list.map(function (d) { var a = byArt[Number(d.nm)]; return sp(d, 'th') + '<th colspan="2"' + cls(d) + ' data-nm="' + d.nm + '">' + (a && a.photo_url ? '<img class="cs-ph" src="' + esc(a.photo_url) + '" alt="" loading="lazy">' : wbImg(d.nm).replace('cc-th', 'cs-ph')) + '</th>'; }).join('') + '</tr>' +
            '<tr class="sq-arts"><th class="sq-l">Артикул ВБ</th>' + list.map(function (d) { return sp(d, 'th') + '<th colspan="2"' + cls(d) + ' data-nm="' + d.nm + '">' + d.nm + '</th>'; }).join('') + '</tr>' +
            '<tr class="sq-band"><th class="sq-l"></th>' + list.map(function (d) { return sp(d, 'th') + '<th colspan="2">СЕО оптимизация</th>'; }).join('') + '</tr>' +
            '<tr class="sq-fn"><th class="sq-l">Поле</th>' + list.map(function (d) { return sp(d, 'th') + '<th>Факт вариант</th><th>Новый вариант</th>'; }).join('') + '</tr>';
        var rows = labels.map(function (k) {
            return '<tr><td class="sq-l">' + esc(k) + '</td>' + list.map(function (d, i) {
                var x = maps[i][k], fv = x ? x.fact : '', nv = x ? x.new : '';
                if (k === 'Артикул WB') { fv = fv || d.nm; nv = nv || d.nm; }
                return sp(d, 'td') + '<td class="sq-f">' + cell(fv) + '</td><td>' + cell(nv, x && x.ch) + '</td>';
            }).join('') + '</tr>';
        }).join('');
        var words = '<tr class="sq-band"><td class="sq-l"></td>' + list.map(function (d) { return sp(d, 'td') + '<td>СЕО Уникальные слова</td><td>Все уникальные слова для создания СЕО описания</td>'; }).join('') + '</tr>' +
            '<tr class="sq-words"><td class="sq-l">Слова</td>' + list.map(function (d) {
                var w = (d.seo.words || []).map(function (x) { return '<div class="sq-w"><b>' + esc(x.w) + '</b> — ' + esc(x.freq) + ' — <span class="' + (VERD[x.verdict] ? 'sq-' + VERD[x.verdict] : '') + '">' + esc(x.verdict) + '</span> — ' + esc(x.note) + '</div>'; }).join('');
                var it = d.seo.itog || {};
                var itog = (it.keep ? '<p><b>ИТОГ ДЛЯ ОПИСАНИЯ:</b><br>' + nl(it.keep) + '</p>' : '') + (it.remove ? '<p><b>УБРАТЬ ИЗ ТЕКУЩЕГО ОПИСАНИЯ:</b> ' + nl(it.remove) + '</p>' : '') + (it.doubt ? '<p><b>ПОД ВОПРОСОМ:</b> ' + nl(it.doubt) + '</p>' : '');
                return sp(d, 'td') + '<td><div class="sq-box">' + (w || '<span class="cc-mut">—</span>') + '</div></td><td><div class="sq-box">' + (itog || '<span class="cc-mut">—</span>') + '</div></td>';
            }).join('') + '</tr>';
        var maxQ = list.reduce(function (m, d) { return Math.max(m, (d.seo.queries || []).length); }, 0);
        var qhead = '<tr class="sq-band"><td class="sq-l"></td>' + list.map(function (d) { return sp(d, 'td') + '<td colspan="2">Ключевые запросы</td>'; }).join('') + '</tr>' +
            '<tr class="sq-fn"><td class="sq-l">№</td>' + list.map(function (d) { return sp(d, 'td') + '<td colspan="2"><div class="sq-q sq-qh"><span>Запрос</span><span>Частотность</span><span>Качество запроса</span><span>Ср. цена первых 25 после СПП</span></div></td>'; }).join('') + '</tr>';
        var qrows = '';
        for (var r = 0; r < maxQ; r++) {
            qrows += '<tr class="sq-qr"><td class="sq-l">' + (r + 1) + '</td>' + list.map(function (d) {
                var x = (d.seo.queries || [])[r];
                return sp(d, 'td') + '<td colspan="2">' + (x ? '<div class="sq-q"><span>' + esc(x.q) + '</span><span>' + (x.freq == null ? '—' : fmt(x.freq)) + '</span><span class="sq-k sq-k' + x.quality + '">' + QUALITY[x.quality] + '</span><span>' + (x.price == null ? '—' : fmt(x.price)) + '</span></div>' : '') + '</td>';
            }).join('') + '</tr>';
        }
        return '<div class="cs-wrap sq-wrap"><table class="sq"><thead>' + head + '</thead><tbody>' + rows + words + qhead + qrows + '</tbody></table></div>';
    }
    // Эталон для шага воронки: данные конкурентов, а если их нет, медиана соседних расцветок той же склейки (или всего кабинета)
    function medianOf(a) { a = a.filter(function (x) { return x != null && isFinite(x); }).sort(function (x, y) { return x - y; }); if (!a.length) return null; var m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }
    function withBench(f, peers, label) {
        var steps = f.steps.map(function (st) {
            var o = Object.assign({}, st);
            if (o.rival == null && peers && peers.length) {
                var v = medianOf(peers.map(function (pf) { var q = pf.steps.filter(function (x) { return x.id === st.id; })[0]; return q ? q.ours : null; }));
                if (v != null) { o.rival = v; o.bench = label; }
            }
            if (o.ours != null && o.rival != null) o.gap = o.ours - o.rival;
            return o;
        });
        var worst = null;
        steps.forEach(function (st) { if (st.gap != null && st.rival > 0 && st.gap < 0 && (!worst || st.gap / st.rival < worst.gap / worst.rival)) worst = st; });
        return Object.assign({}, f, { steps: steps, worst: worst });
    }
    function peersFor(nm) {
        if (!S.allFun) return { list: [], label: '' };
        var byArt = {}; S.arts.forEach(function (x) { byArt[Number(x.nm_id)] = x; });
        var me = byArt[Number(nm)], key = grpKey(me), same = [], all = [];
        Object.keys(S.allFun).forEach(function (k) {
            if (Number(k) === Number(nm)) return;
            var pf = S.allFun[k]; if (!(pf.total.clk > 0)) return;
            all.push(pf); if (key && grpKey(byArt[Number(k)]) === key) same.push(pf);
        });
        return same.length >= 2 ? { list: same, label: 'медиана склейки' } : { list: all, label: 'медиана кабинета' };
    }
    function worstOf() { if (!S.fun) return null; var pr = peersFor(S.nm); return withBench(S.fun, pr.list, pr.label).worst; }
    // Задание на слайды: какой кадр чинит какой шаг воронки и что на нём показать. Признаки берутся из СЕО (строка «Признаки с фото»).
    var FOCUS = { ctr: [0], cart: [1, 2, 3, 4], order: [5, 6, 7], buyout: [3, 7] };
    function slideBriefs(worst, seo, name) {
        var feats = '', keep = seo && seo.itog && seo.itog.keep || '';
        var m = /Признаки с фото:\s*([^\n]+)/.exec(keep); if (m) feats = m[1].trim();
        var kw = (/Супер:\s*([^\n]+)/.exec(keep) || [])[1] || '';
        kw = kw.split(',').slice(0, 3).map(function (x) { return x.trim(); }).filter(Boolean).join(', ');
        var base = [
            'Крупный первый кадр, модель в движении, чистый светлый фон, название товара крупно' + (kw ? ' («' + kw.split(',')[0] + '»)' : '') + ', одна главная выгода.',
            'Главная выгода одной строкой и три иконки преимуществ' + (feats ? ': ' + feats.split(',').slice(0, 3).map(function (x) { return x.trim(); }).join(', ') : '') + '.',
            'Посадка и крой: фото спереди, сбоку и сзади, подписи длины, рукава и линии плеча.',
            'Таблица размеров и замеров, рост и параметры модели, подсказка «как выбрать размер».',
            'Состав и ткань: крупный план материала, состав в процентах, уход за вещью.',
            'Детали: застёжка, манжеты, швы, декор, по одному кадру на деталь.',
            'С чем носить: два-три образа с этим товаром (брюки, юбка, верхняя одежда).',
            'Доверие: отзывы с фото, рейтинг, страна производства, «как на фото».'
        ];
        var hot = worst ? (FOCUS[worst.id] || []) : [];
        return SLIDES.map(function (t, i) { return { n: i + 1, title: t, text: base[i], hot: hot.indexOf(i) >= 0, kw: i === 0 ? kw : '' }; });
    }
    function briefText(name, worst, briefs) {
        return 'Переделать все фото карточки «' + name + '».' + (worst ? ' Главная утечка воронки: ' + worst.from + ' → ' + worst.to + ' (' + worst.fix + ').' : '') + '\n' +
            briefs.map(function (b) { return b.n + '. ' + b.title + (b.hot ? ' [приоритет]' : '') + ': ' + b.text; }).join('\n') + '\nСтиль: «Минимализм», чёрно-белая подача, без цветных заливок, крупный читаемый текст.';
    }
    // «Утечка»: наши текущие кадры карточки рядом с референсом (кадры лучшего конкурента склейки). Без цифр и конверсий: сразу видно, чего не хватает нам.
    function leakHtml() { return mediaHtml('leak'); }
    var ROWS = 8;
    // Задания (промты) на кадры людям не показываем: картинки делает сайт сам. Здесь только референс и сами кадры.
    function mediaHtml(mode) {
        var leak = mode === 'leak';
        var byArt = {}; S.arts.forEach(function (x) { byArt[Number(x.nm_id)] = x; });
        var list = (S.all && S.all.length ? S.all : S.arts.map(function (x) { return { nm: Number(x.nm_id), name: x.seller_article || x.name }; })).slice();
        var rows = []; for (var i = 0; i < ROWS; i++) rows.push(i);
        var out = groups(list, byArt).map(function (g) {
            // референс общий на склейку: кадры самого выручающего конкурента среди всех артикулов склейки
            var ref = 0, best = -1;
            g.items.forEach(function (d) { (d.similar || []).concat(d.top || []).forEach(function (x) { if ((Number(x.rev) || 0) > best) { best = Number(x.rev) || 0; ref = x.nm; } }); });
            // Референс общий на склейку (как делают конкуренты), а генерация и отправка на WB у каждой расцветки (артикула) свои: 1 000 сом за расцветку
            var side = '<div class="ms-side"><div class="ms-sh"><b title="' + esc(g.name) + '">' + esc(g.name) + '</b><span>' + g.items.length + ' арт.</span><i>Референс</i></div>' +
                rows.map(function (i) { return '<div class="ms-row">' + (ref ? wbImg(ref, i + 1, 'c516x688').replace('cc-th', 'cc-th ms-im') : '<div class="ms-im cc-nophoto"></div>') + '<em>' + (i + 1) + '</em></div>'; }).join('') + '</div>';
            var cols = g.items.map(function (x) {
                var ar = byArt[Number(x.nm)], on = Number(x.nm) === S.nm;
                var ph = ar && ar.photo_url ? '<img class="cs-ph" src="' + esc(ar.photo_url) + '" alt="" loading="lazy">' : wbImg(x.nm).replace('cc-th', 'cs-ph');
                return '<section class="ms-col' + (on ? ' on' : '') + '" data-nm="' + x.nm + '"><div class="ms-name" title="' + esc(x.name || '') + '">' + esc(x.name || (ar && (ar.seller_article || ar.name)) || x.nm) + '</div>' + ph + '<div class="cs-art">' + x.nm + '</div>' +
                    (leak ? '' : actHtml(x.nm, x.name || (ar && (ar.seller_article || ar.name)) || String(x.nm))) +
                    rows.map(function (i) {
                        var js = leak ? null : jobSlides(S.jobs[x.nm])[i], url = js && js.status === 'ready' && js.path ? jobUrl(js.path) : '';
                        return '<div class="ms-cell">' + (url ? '<img class="ms-im" src="' + esc(url) + '" alt="" loading="lazy">' : wbImg(x.nm, i + 1, 'c516x688').replace('cc-th', 'cc-th ms-im')) + '</div>';
                    }).join('') + '</section>';
            }).join('');
            return '<div class="ms-grp">' + side + cols + '</div>';
        }).join('');
        return '<div class="cs-wrap ms-wrap' + (leak ? ' ms-leak' : '') + '"><div class="ms-sheet">' + out + '</div></div>';
    }
    // Листы крутятся только по одной оси: по диагонали (тачпад) берём главное направление
    function lockAxis(e) {
        var w = e.target.closest && e.target.closest('.cs-wrap'); if (!w || e.ctrlKey) return;
        var dx = e.deltaX, dy = e.deltaY;
        if (e.deltaMode === 1) { dx *= 16; dy *= 16; }
        if (!dx || !dy) return;
        e.preventDefault();
        if (Math.abs(dx) > Math.abs(dy)) w.scrollLeft += dx; else w.scrollTop += dy;
    }
    if (!doc.__ccAxis) { doc.__ccAxis = 1; doc.addEventListener('wheel', lockAxis, { passive: false }); }
    var VIEW = { rivals: rivalsHtml, seo: seoHtml, leak: leakHtml, media: mediaHtml };

    function shell() {
        var host = doc.getElementById('cc-root');
        if (!host) return null;
        if (!host.getAttribute('data-ready')) {
            host.setAttribute('data-ready', '1');
            host.innerHTML = '<div class="cc-top"><select id="cc-art" class="cc-sel" aria-label="Товар"></select><div class="cc-nav" role="tablist">' +
                SECS.map(function (s) { return '<button type="button" class="cc-chip" role="tab" data-cc="' + s[0] + '">' + s[1] + '</button>'; }).join('') + '</div></div><div id="cc-body" class="cc-body"></div>';
        }
        return host;
    }
    function paint() {
        var host = shell(); if (!host) return;
        var sel = host.querySelector('#cc-art');
        var optOf = function (a) { return '<option value="' + esc(a.nm_id) + '"' + (Number(a.nm_id) === S.nm ? ' selected' : '') + '>' + esc(a.seller_article || a.name || a.nm_id) + '</option>'; };
        var byArt0 = {}; S.arts.forEach(function (a) { byArt0[Number(a.nm_id)] = a; });
        var opts = S.arts.length ? groups(S.arts.map(function (a) { return { nm: a.nm_id }; }), byArt0).map(function (g) { return '<optgroup label="' + esc(g.name + ' · ' + g.items.length) + '">' + g.items.map(function (x) { return optOf(byArt0[Number(x.nm)]); }).join('') + '</optgroup>'; }).join('') : '<option>Товары загружаются</option>';
        if (sel.__h !== opts) { sel.innerHTML = opts; sel.__h = opts; }
        Array.prototype.forEach.call(host.querySelectorAll('.cc-chip'), function (b) { var on = b.getAttribute('data-cc') === S.sec; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
        var body = host.querySelector('#cc-body'), sec = S.sec, heavy = (sec === 'rivals' || sec === 'seo' || sec === 'media') && S.all && S.all.length > 10;
        // Тяжёлые листы (десятки артикулов в ряд) собираются сразу после нажатия, но не в самом нажатии:
        // вкладка переключается мгновенно, а лист появляется в следующем кадре, без «зависания» кнопки
        if (heavy && body.__sec !== sec) {
            body.__sec = sec; body.__h = null;
            body.innerHTML = '<div class="cc-card"><div class="cc-note">Собираем лист…</div></div>';
            root.setTimeout(function () { if (S.sec === sec) { var h = VIEW[sec](); body.innerHTML = h; body.__h = h; scrollToSel(); } }, 0);
            return;
        }
        body.__sec = sec;
        var h = VIEW[sec]();
        if (body.__h !== h) { body.innerHTML = h; body.__h = h; }
    }

    // ───── данные ─────
    function loadArts(cab) {
        if (!sb()) return Promise.resolve([]);
        return Promise.resolve(sb().from('rnp_articles').select('nm_id,name,photo_url,imt_id,card_title,subject_name').eq('cabinet_id', cab).eq('is_active', true).order('name').range(0, 999))
            .then(function (r) {
                // в базе артикул продавца лежит в поле name; seller_article там нет
                return ((r && r.data) || []).map(function (a) { return Object.assign({ seller_article: a.name }, a); });
            }).catch(function () { return []; });
    }
    function loadFunnel() {
        var cab = S.cab, nm = S.nm, my = ++S.token, p = period(), key = 'nr_cc_fun_' + cab + '_' + nm, ckey = 'nr_cc_cmp_' + cab + '_' + nm;
        var cached = lsGet(key);
        S.fun = cached && cached.to === p.to ? funnel(cached.rows) : null;
        S.cmp = lsGet(ckey);
        paint();
        if (!sb() || !nm) return;
        Promise.resolve(sb().from('rnp_daily_data').select('impressions,clicks,basket_count,funnel_orders,orders_count,orders_sum,sales_count,competitor_ctr,competitor_basket,competitor_cro').eq('cabinet_id', cab).eq('nm_id', nm).gte('date', p.from).lte('date', p.to).range(0, 199))
            .then(function (r) {
                if (my !== S.token || !r || r.error) return;
                lsSet(key, { to: p.to, rows: r.data || [] });
                S.fun = funnel(r.data || []); paint();
            }).catch(function () { /* остаётся каркас */ });
        // Конкуренты и СЕО, перенесённые из таблицы владельца (content_compare)
        Promise.resolve(sb().from('content_compare').select('data,period_from,period_to').eq('cabinet_id', cab).eq('nm_id', nm).limit(1))
            .then(function (r) {
                if (my !== S.token || !r || r.error) return;
                var row = r.data && r.data[0], d = row ? Object.assign({}, row.data, { period_from: row.period_from, period_to: row.period_to }) : null;
                S.cmp = d; lsSet(ckey, d); paint();
            }).catch(function () { /* остаётся каркас */ });
    }

    function loadAll(cab) {
        var key = 'nr_cc_all_' + cab;
        S.all = lsGet(key);
        if (!sb()) return;
        Promise.resolve(sb().from('content_compare').select('nm_id,period_from,period_to,data').eq('cabinet_id', cab).order('updated_at').range(0, 299))
            .then(function (r) {
                if (cab !== S.cab || !r || r.error) return;
                S.all = (r.data || []).map(function (x) { return Object.assign({}, x.data, { nm: Number(x.nm_id), period_from: x.period_from, period_to: x.period_to }); })
                    .filter(function (d) { return (d.similar && d.similar.length) || (d.top && d.top.length) || d.seo; });
                // в кэш кладём только лист конкурентов (СЕО большой, он остаётся в памяти)
                lsSet(key, S.all.map(function (d) { return { nm: d.nm, name: d.name, rev: d.rev, similar: d.similar, top: d.top, period_from: d.period_from, period_to: d.period_to }; }));
                paint(); scrollToSel();
            }).catch(function () { /* остаётся каркас */ });
    }
    function loadAllFun(cab) {
        var p = period(), key = 'nr_cc_allfun_' + cab, c = lsGet(key);
        S.allFun = c && c.to === p.to ? c.map : null;
        if (S.allFun) Object.keys(S.allFun).forEach(function (k) { S.allFun[k] = funnel(S.allFun[k]); });
        if (!sb()) return;
        Promise.resolve(sb().from('rnp_daily_data').select('nm_id,impressions,clicks,basket_count,funnel_orders,orders_count,orders_sum,sales_count,competitor_ctr,competitor_basket,competitor_cro').eq('cabinet_id', cab).gte('date', p.from).lte('date', p.to).range(0, 4999))
            .then(function (r) {
                if (cab !== S.cab || !r || r.error) return;
                var g = {}; (r.data || []).forEach(function (x) { (g[x.nm_id] = g[x.nm_id] || []).push(x); });
                lsSet(key, { to: p.to, map: g });
                S.allFun = {}; Object.keys(g).forEach(function (k) { S.allFun[k] = funnel(g[k]); });
                if (S.sec === 'leak') paint();
            }).catch(function () { /* без общей таблицы */ });
    }
    function scrollToSel() {
        var host = doc.getElementById('cc-root'), b = host && host.querySelector('.cs-b.on, .ms-col.on, .sq-names th.on'), w = host && host.querySelector('.cs-wrap');
        if (!b || !w) return;
        // выбранный блок ставим сразу за закреплёнными колонками слева, чтобы он не уехал под них
        var side = w.querySelector('.cs-side, .ms-side, .sq-l'), sw = side ? side.getBoundingClientRect().width : 0;
        w.scrollLeft = Math.max(0, w.scrollLeft + b.getBoundingClientRect().left - w.getBoundingClientRect().left - sw);
    }

    // ───── задачи генерации (content_media_jobs): одна на расцветку ─────
    function isStaff() { return doc.documentElement.getAttribute('data-staff') === '1'; }
    function jobUrl(path) { try { return sb().storage.from('content-media').getPublicUrl(path).data.publicUrl; } catch (_) { return ''; } }
    function jobSlides(j) { return j && Array.isArray(j.slides) ? j.slides : []; }
    function readyN(j) { return jobSlides(j).filter(function (x) { return x.status === 'ready'; }).length; }
    // Кнопки расцветки по состоянию задачи. «Отправить на WB» открывается только когда готовы все кадры.
    function actHtml(nm, label) {
        var j = S.jobs[nm], st = j ? j.status : '', lock = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
        var main, send;
        var gen = function (t, dis, act) { return '<button type="button" class="cc-btn cc-btn-b"' + (dis ? ' disabled aria-disabled="true"' : '') + (act ? ' ' + act : '') + '>' + t + '</button>'; };
        if (st === 'awaiting_payment') main = gen('Оплатить · ' + fmt(PRICE_SOM) + ' сом', false, 'data-cc-gen="' + nm + '" data-cc-gname="' + esc(label) + '"');
        else if (st === 'paid' || st === 'generating') main = gen('Генерация ' + readyN(j) + '/' + (jobSlides(j).length || 8), true);
        else if (st === 'ready') main = gen('Готово ✓', true);
        else if (st === 'sent') main = gen('Отправлено ✓', true);
        else if (st === 'failed') main = gen('Повторить', false, 'data-cc-retry="' + nm + '"');
        else main = gen('Сгенерировать · ' + fmt(PRICE_SOM) + ' сом', false, 'data-cc-gen="' + nm + '" data-cc-gname="' + esc(label) + '"');
        if (st === 'ready') send = '<button type="button" class="cc-btn ms-send ms-ok" data-cc-send="' + nm + '">Отправить на WB</button>';
        else send = '<button type="button" class="cc-btn ms-send" disabled aria-disabled="true" title="' + (st === 'sent' ? 'Фото уже отправлены' : 'Откроется, когда для этой расцветки будут готовы новые фото') + '">' + lock + 'Отправить на WB</button>';
        return '<div class="ms-act">' + main + send + '</div>';
    }
    function call(body) {
        if (!sb() || !sb().functions) return Promise.resolve({ ok: false, error: 'Нет связи с сервером' });
        return Promise.resolve(sb().functions.invoke('content-media', { body: body })).then(function (r) {
            if (r && r.error) return { ok: false, error: 'Сервер не ответил. Попробуйте ещё раз.' };
            return (r && r.data) || { ok: false, error: 'Пустой ответ' };
        }).catch(function () { return { ok: false, error: 'Сервер не ответил. Попробуйте ещё раз.' }; });
    }
    function setJob(j) { if (j && j.nm_id) { S.jobs[Number(j.nm_id)] = j; if (S.sec === 'media') paint(); keepPolling(); } }
    function loadJobs(cab) {
        if (!sb()) return;
        Promise.resolve(sb().from('content_media_jobs').select('*').eq('cabinet_id', cab).order('updated_at', { ascending: true }).range(0, 499)).then(function (r) {
            if (cab !== S.cab || !r || r.error) return;
            var m = {}; (r.data || []).forEach(function (j) { m[Number(j.nm_id)] = j; });   // последняя по времени задача расцветки
            S.jobs = m; if (S.sec === 'media') paint(); keepPolling();
        }).catch(function () { /* без задач остаётся прежний вид */ });
    }
    // Пока идёт генерация: раз в 6 секунд просим сервер продолжить и обновляем статусы
    function keepPolling() {
        var active = Object.keys(S.jobs).filter(function (k) { var st = S.jobs[k].status; return st === 'paid' || st === 'generating'; });
        if (!active.length) { if (S.poll) { root.clearTimeout(S.poll); S.poll = 0; } return; }
        if (S.poll) return;
        S.poll = root.setTimeout(function () {
            S.poll = 0;
            if (doc.hidden || !doc.getElementById('cc-root')) { keepPolling(); return; }
            Promise.all(active.map(function (k) { return call({ action: 'run', job_id: S.jobs[k].id }); })).then(function (rs) {
                rs.forEach(function (r) { if (r && r.job) S.jobs[Number(r.job.nm_id)] = r.job; });
                var blocked = rs.some(function (r) { return r && r.run && r.run.reason === 'NO_PROVIDER'; });
                if (S.sec === 'media') paint();
                if (!blocked) keepPolling();
            });
        }, 6000);
    }
    // ───── окно оплаты ─────
    function closePay() { var m = doc.getElementById('cc-ov'); if (m) m.remove(); }
    function openPay(nm, gname) {
        closePay();
        var a = nm ? S.arts.filter(function (x) { return Number(x.nm_id) === Number(nm); })[0] || art() : art(), m = doc.createElement('div');
        m.id = 'cc-ov'; m.className = 'cc-ov'; m.setAttribute('data-nr-blur', ''); m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
        m.innerHTML = '<div class="cc-m"><div class="cc-mh"><div class="cc-cap">Генерация фото</div><button type="button" class="cc-x" data-cc-close aria-label="Закрыть">×</button></div>' +
            '<div class="cc-tile cc-dark"><div class="cc-cap">К оплате</div><b>' + fmt(PRICE_SOM) + ' сом</b><span>' + esc(a ? (a.name || a.nm_id) : '') + '</span></div>' +
            '<div class="cc-qr"><div class="cc-qrbox" aria-hidden="true">QR</div><div><b>Оплата по QR через Finik</b><p>Оплата подключается. Сейчас оплатить и запустить генерацию нельзя.</p></div></div>' +
            '<div class="cc-kv"><span>Что входит</span><span>' + SLIDES.length + ' фото под утечку воронки</span></div><div class="cc-kv"><span>В подарок</span><span>1 А/Б тест обложки и СЕО</span></div>' +
            '<button type="button" class="cc-btn cc-btn-b" disabled>Оплатить ' + fmt(PRICE_SOM) + ' сом</button>' +
            (isStaff() ? '<button type="button" class="cc-btn" data-cc-test="' + (a ? a.nm_id : 0) + '">Тест для команды: без оплаты</button><p class="cc-note" id="cc-test-note"></p>' : '') + '</div>';
        m.addEventListener('click', function (e) {
            if (e.target === m || e.target.closest('[data-cc-close]')) { closePay(); return; }
            var t = e.target.closest('[data-cc-test]'); if (!t) return;
            var nm = Number(t.getAttribute('data-cc-test')), note = m.querySelector('#cc-test-note');
            t.disabled = true; if (note) note.textContent = 'Запускаем…';
            var w = worstOf();
            // сразу показываем «идёт генерация», остальное сервер делает в фоне
            S.jobs[nm] = Object.assign({}, S.jobs[nm] || { nm_id: nm, slides: [] }, { status: 'generating' });
            closePay(); if (S.sec === 'media') paint();
            call({ action: 'create', cabinet_id: S.cab, nm_id: nm, focus: w ? w.id : null }).then(function (r) {
                if (!r || !r.job) { delete S.jobs[nm]; paint(); say('Не получилось создать задачу', (r && r.error) || 'Попробуйте ещё раз'); return; }
                setJob(r.job);
                return call({ action: 'mark_paid', job_id: r.job.id }).then(function (r2) {
                    if (r2 && r2.job) setJob(r2.job);
                    if (r2 && r2.run && r2.run.reason === 'NO_PROVIDER') say('Генератор не подключён', 'Задача создана и ждёт ключ генератора. Статус «Генерация» сменится, когда ключ появится.');
                    else if (!r2 || !r2.ok) say('Не получилось запустить', (r2 && r2.error) || 'Попробуйте ещё раз');
                });
            });
        });
        doc.body.appendChild(m);
    }
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePay(); });

    function bind(host) {
        if (S.bound) return; S.bound = true;
        host.addEventListener('click', function (e) {
            var b;
            if ((b = e.target.closest('.cs-b, .ms-col, .sq thead th[data-nm]')) && !e.target.closest('a, button') && Number(b.getAttribute('data-nm')) && Number(b.getAttribute('data-nm')) !== S.nm) { S.nm = Number(b.getAttribute('data-nm')); try { root.localStorage.setItem('nr_cc_nm_' + S.cab, String(S.nm)); } catch (_) {} var w = host.querySelector('.cs-wrap'), x = w ? w.scrollLeft : 0; loadFunnel(); w = host.querySelector('.cs-wrap'); if (w) w.scrollLeft = x; return; }
            if ((b = e.target.closest('[data-cc-gen]'))) { var gn = Number(b.getAttribute('data-cc-gen')); if (gn && gn !== S.nm) { S.nm = gn; try { root.localStorage.setItem('nr_cc_nm_' + S.cab, String(S.nm)); } catch (_) {} } openPay(gn, b.getAttribute('data-cc-gname')); return; }
            if ((b = e.target.closest('[data-cc-retry]'))) {
                var rn = Number(b.getAttribute('data-cc-retry')), rj = S.jobs[rn]; if (!rj) return;
                S.jobs[rn] = Object.assign({}, rj, { status: 'generating' }); paint();
                call({ action: 'run', job_id: rj.id }).then(function (r) { if (r && r.job) setJob(r.job); });
                return;
            }
            if ((b = e.target.closest('[data-cc-send]'))) {
                var sn = Number(b.getAttribute('data-cc-send')), sj = S.jobs[sn]; if (!sj || sj.status !== 'ready') return;
                var ar = S.arts.filter(function (x) { return Number(x.nm_id) === sn; })[0], nm0 = (ar && (ar.seller_article || ar.name)) || String(sn);
                var go = function () {
                    S.jobs[sn] = Object.assign({}, sj, { status: 'sent' }); paint();   // сразу видно: отправлено; если не получится, вернём
                    call({ action: 'send', job_id: sj.id }).then(function (r) {
                        if (r && r.ok && r.job) { setJob(r.job); say('Фото отправлены на WB', 'Карточка «' + nm0 + '»: кадры 1–8 заменены'); }
                        else { S.jobs[sn] = sj; paint(); say('WB не принял фото', (r && r.error) || 'Попробуйте ещё раз'); }
                    });
                };
                if (root.NrUi && root.NrUi.confirm) root.NrUi.confirm({ title: 'Отправить фото на WB?', text: 'Кадры 1–8 карточки «' + nm0 + '» будут заменены новыми. Вернуть прежние фото нельзя.', confirmLabel: 'Отправить', danger: true }).then(function (ok) { if (ok) go(); });
                else go();
                return;
            }
            if ((b = e.target.closest('[data-cc-nm]'))) { S.nm = Number(b.getAttribute('data-cc-nm')); try { root.localStorage.setItem('nr_cc_nm_' + S.cab, String(S.nm)); } catch (_) {} loadFunnel(); return; }
            if ((b = e.target.closest('[data-cc-sec]'))) { S.sec = b.getAttribute('data-cc-sec'); try { root.localStorage.setItem('nr_cc_sec', S.sec); } catch (_) {} paint(); return; }
            if ((b = e.target.closest('[data-cc]'))) { S.sec = b.getAttribute('data-cc'); try { root.localStorage.setItem('nr_cc_sec', S.sec); } catch (_) {} paint(); scrollToSel(); return; }
            if ((b = e.target.closest('[data-cc-act]'))) {
                var act = b.getAttribute('data-cc-act');
                if (act === 'gen') openPay();
                else if (act === 'find') say('Автоподбор подключается', 'Сейчас данные берутся из вашей таблицы. Сбор с WB и MPStats прямо с сайта появится следующим шагом');
                else if (act === 'seo') say('Автосбор СЕО подключается', 'Сейчас данные берутся из вашей таблицы. Сбор запросов прямо с сайта появится следующим шагом');
                else if (act === 'send') say('Отправлять пока нечего', 'Сначала нужна генерация новых фото');
            }
        });
        host.addEventListener('change', function (e) {
            if (e.target.id !== 'cc-art') return;
            S.nm = Number(e.target.value) || 0;
            try { root.localStorage.setItem('nr_cc_nm_' + S.cab, String(S.nm)); } catch (_) {}
            loadFunnel(); scrollToSel();
        });
    }
    function pickNm() {
        var saved = 0; try { saved = Number(root.localStorage.getItem('nr_cc_nm_' + S.cab)) || 0; } catch (_) {}
        S.nm = S.arts.some(function (a) { return Number(a.nm_id) === saved; }) ? saved : (S.arts[0] ? Number(S.arts[0].nm_id) : 0);
    }
    function open() {
        var host = shell(); if (!host) return;
        bind(host);
        try { var s = root.localStorage.getItem('nr_cc_sec'); if (s && VIEW[s]) S.sec = s; } catch (_) {}
        var cab = cabId();
        if (cab && cab === S.cab && S.arts.length) { paint(); return; }
        S.cab = cab; S.arts = lsGet('nr_cc_arts2_' + cab) || []; S.fun = null; S.cmp = null; S.all = null; S.allFun = null; if (cab) { loadAll(cab); loadAllFun(cab); loadJobs(cab); }
        pickNm(); paint();
        if (S.nm) loadFunnel();
        // Кабинет ещё не выбран (страница только открылась): каркас уже на экране, данные подтянем, как только кабинет появится
        if (!cab) { if ((S.wait = (S.wait || 0) + 1) < 40) root.setTimeout(function () { var pane = doc.getElementById('an-content'); if (pane && !pane.hidden && !S.cab) open(); }, 500); return; }
        S.wait = 0;
        loadArts(cab).then(function (arts) {
            if (cab !== S.cab) return;
            var had = S.nm;
            S.arts = arts; lsSet('nr_cc_arts2_' + cab, arts); pickNm(); paint();
            if (S.nm && S.nm !== had) loadFunnel();
        });
    }
    doc.addEventListener('cabinet-changed', function () {
        S.token++; S.cab = ''; S.arts = []; S.fun = null; S.cmp = null; S.all = null; S.allFun = null; S.jobs = {}; S.nm = 0; closePay();
        var host = doc.getElementById('cc-root'), pane = doc.getElementById('an-content');
        if (host && pane && !pane.hidden) open();
    });

    root.NrCompare = { open: open, _funnel: funnel, _withBench: withBench, _briefs: slideBriefs, _rivalStats: rivalStats, _wbHost: wbHost };
})(typeof window !== 'undefined' ? window : globalThis);

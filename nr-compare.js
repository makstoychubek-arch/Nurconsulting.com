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
    var FIELDS = ['Артикул продавца', 'Артикул WB', 'Наименование', 'Категория продавца', 'Бренд', 'Описание', 'Материал верха', 'Пол', 'Состав', 'Цвет', 'Баркод', 'Размер', 'Рос. размер', 'Вид застежки', 'Вырез горловины', 'Декоративные элементы', 'ИКПУ', 'Код ТРУ 1', 'Код ТРУ 2', 'Код упаковки', 'Коллекция', 'Комплектация', 'Форма рукава'];
    var QUALITY = ['Супер релевантно', 'Релевантно', 'Нерелевантно но пусть будет', 'Исключить из карточки'];
    var SLIDES = ['Обложка', 'Главная выгода', 'Посадка и крой', 'Размеры и замеры', 'Состав и ткань', 'Детали', 'С чем носить', 'Доверие и отзывы'];
    var S = { cab: '', arts: [], nm: 0, sec: 'rivals', fun: null, token: 0, bound: false };

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
        var steps = [
            { id: 'ctr', from: 'Показы', to: 'Клики', a: t.imp, b: t.clk, ours: div(t.clk, t.imp), rival: avg(t.cCtr), fix: 'Обложка: первый кадр, ракурс, цвет фона, цена на фото' },
            { id: 'cart', from: 'Клики', to: 'Корзина', a: t.clk, b: t.cart, ours: div(t.cart, t.clk), rival: avg(t.cCart), fix: 'Слайды 2–5: выгоды, посадка, размеры и замеры, состав' },
            { id: 'order', from: 'Корзина', to: 'Заказ', a: t.cart, b: t.ord, ours: div(t.ord, t.cart), rival: avg(t.cOrd), fix: 'Цена и скидка, срок доставки, отзывы с фото' },
            { id: 'buyout', from: 'Заказ', to: 'Выкуп', a: t.ord, b: t.buy, ours: div(t.buy, t.ord), rival: null, fix: 'Размерная сетка и реальные фото: меньше возвратов «не подошло»' }
        ];
        var worst = null;
        steps.forEach(function (s) { if (s.ours != null && s.rival != null) { s.gap = s.ours - s.rival; if (s.gap < 0 && (!worst || s.gap / s.rival < worst.gap / worst.rival)) worst = s; } });
        return { total: t, steps: steps, worst: worst };
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
    function rivalsHtml() {
        var a = art(), p = period(), f = S.fun;
        var tbl = function (title, sub, n) {
            return '<div class="cc-card"><div class="cc-h"><h3>' + title + '</h3><span>' + sub + '</span></div><div class="cc-tw"><table class="cc-t"><thead><tr><th>№</th><th>Фото</th><th>Артикул</th><th>Выручка</th><th>К нам</th></tr></thead><tbody>' + ghostRows(n, 5) + '</tbody></table></div></div>';
        };
        return '<div class="cc-hero">' + photo(a, 'cc-ph') +
            '<div class="cc-me"><div class="cc-cap">Наш товар</div><b>' + esc(a ? (a.name || a.seller_article || '') : '—') + '</b><span>Артикул ' + esc(a ? a.nm_id : '—') + ' · период ' + dm(p.from) + '–' + dm(p.to) + '</span></div>' +
            '<div class="cc-tiles"><div class="cc-tile cc-dark"><div class="cc-cap">Наша выручка</div><b id="cc-rev"' + (f ? '' : ' class="cc-blur"') + '>' + (f ? fmt(f.total.rev) : '0') + '</b></div>' +
            '<div class="cc-tile"><div class="cc-cap">Медиана похожих</div><b>—</b></div><div class="cc-tile"><div class="cc-cap">Лидер предмета</div><b>—</b></div><div class="cc-tile"><div class="cc-cap">Наше место из 25</div><b>—</b></div></div></div>' +
            '<div class="cc-acts"><button type="button" class="cc-btn cc-btn-b" data-cc-act="find">Подобрать конкурентов</button><span class="cc-note">15 похожих по фото (фасон 1 в 1, сначала нашего цвета) и 10 топов по выручке в нашем предмете, с фото и выручкой за период.</span></div>' +
            '<div class="cc-two">' + tbl('Похожие', '15 · фасон 1 в 1, наш цвет', 15) + tbl('Топы по выручке', '10 · наш предмет', 10) + '</div>';
    }
    function seoHtml() {
        var a = art(), fact = { 'Артикул продавца': a && a.seller_article, 'Артикул WB': a && a.nm_id, 'Наименование': a && a.name };
        var rows = FIELDS.map(function (f) { return '<tr><td>' + f + '</td><td>' + (fact[f] ? esc(fact[f]) : '<span class="cc-g"></span>') + '</td><td><span class="cc-g"></span></td></tr>'; }).join('');
        var q = QUALITY.map(function (x, i) { return '<span class="cc-q cc-q' + i + '">' + x + '</span>'; }).join('');
        return '<div class="cc-acts"><button type="button" class="cc-btn cc-btn-b" data-cc-act="seo">Собрать СЕО</button><span class="cc-note">Идёт бонусом к карточке. Запросы размечаются строго одной из четырёх оценок.</span></div>' +
            '<div class="cc-card"><div class="cc-h"><h3>СЕО оптимизация</h3><span>поля карточки</span></div><div class="cc-tw"><table class="cc-t cc-t3"><thead><tr><th>Поле</th><th>Факт вариант</th><th>Новый вариант</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>' +
            '<div class="cc-two"><div class="cc-card"><div class="cc-h"><h3>СЕО уникальные слова</h3><span>слово · частотность · вердикт</span></div><div class="cc-tw"><table class="cc-t"><thead><tr><th>№</th><th>Слово</th><th>Частотность</th><th>Вердикт</th></tr></thead><tbody>' + ghostRows(8, 4) + '</tbody></table></div></div>' +
            '<div class="cc-card"><div class="cc-h"><h3>СЕО описания</h3><span>слова для нового описания</span></div>' +
            ['Итог для описания', 'Убрать из текущего описания', 'Под вопросом'].map(function (k) { return '<div class="cc-kv"><span>' + k + '</span><span class="cc-g cc-gw"></span></div>'; }).join('') + '</div></div>' +
            '<div class="cc-card"><div class="cc-h"><h3>Ключевые запросы</h3><span>' + q + '</span></div><div class="cc-tw"><table class="cc-t"><thead><tr><th>№</th><th>Запрос</th><th>Частотность</th><th>Качество запроса</th><th>Средняя цена первых 25 после СПП</th></tr></thead><tbody>' + ghostRows(8, 5) + '</tbody></table></div></div>';
    }
    function leakHtml() {
        var f = S.fun || funnel([]), has = !!S.fun, t = f.total;
        var vals = [['Показы', t.imp], ['Клики', t.clk], ['Корзина', t.cart], ['Заказ', t.ord], ['Выкуп', t.buy]];
        var w = f.worst;
        var chain = vals.map(function (v, i) {
            var st = f.steps[i - 1];
            var conv = i && st ? '<em>' + pct(st.ours) + '</em>' : '';
            return (i ? '<div class="cc-arr">' + conv + '</div>' : '') + '<div class="cc-step' + (w && st && st === w ? ' cc-bad' : '') + '"><div class="cc-cap">' + v[0] + '</div><b class="' + (has ? '' : 'cc-blur') + '">' + (has ? fmt(v[1]) : '0') + '</b></div>';
        }).join('');
        var rows = f.steps.map(function (s) {
            var gap = s.gap == null ? '<span class="cc-mut">нет данных конкурентов</span>' : '<span class="cc-pill ' + (s.gap < 0 ? 'dn' : 'up') + '">' + (s.gap < 0 ? '−' : '+') + pct(Math.abs(s.gap)).replace('%', ' п.п.') + '</span>';
            return '<tr><td>' + s.from + ' → ' + s.to + '</td><td>' + (has ? pct(s.ours) : '<span class="cc-g"></span>') + '</td><td>' + (has ? pct(s.rival) : '<span class="cc-g"></span>') + '</td><td>' + (has ? gap : '<span class="cc-g"></span>') + '</td><td class="cc-fix">' + s.fix + '</td></tr>';
        }).join('');
        return '<div class="cc-leak"><div class="cc-tile cc-dark"><div class="cc-cap">Главная утечка</div><b>' + (w ? w.from + ' → ' + w.to : '—') + '</b><span>' + (w ? 'наша конверсия ' + pct(w.ours) + ', у конкурентов ' + pct(w.rival) : (has ? 'по данным конкурентов отставания нет или их пока нет' : 'считаем воронку за 30 дней')) + '</span></div><div class="cc-chain">' + chain + '</div></div>' +
            '<div class="cc-card"><div class="cc-h"><h3>Где теряем покупателя</h3><span>наша воронка за 30 дней против конкурентов</span></div><div class="cc-tw"><table class="cc-t cc-t5"><thead><tr><th>Шаг</th><th>У нас</th><th>У конкурентов</th><th>Разница</th><th>Что переделать в фото</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }
    function mediaHtml() {
        var a = art(), w = S.fun && S.fun.worst;
        var frames = function (label, withPhoto) {
            return '<div class="cc-card"><div class="cc-h"><h3>' + label + '</h3><span>' + SLIDES.length + ' слайдов</span></div><div class="cc-slides">' + SLIDES.map(function (s, i) {
                return '<figure>' + (withPhoto && i === 0 ? photo(a, 'cc-sl') : '<div class="cc-sl cc-nophoto">' + (i + 1) + '</div>') + '<figcaption>' + (i + 1) + '. ' + s + '</figcaption></figure>';
            }).join('') + '</div></div>';
        };
        return '<div class="cc-pay"><div><div class="cc-cap">Все фото карточки под утечку воронки</div><b>' + fmt(PRICE_SOM) + ' сом <small>за карточку</small></b><span>' + (w ? 'Упор на шаг «' + w.from + ' → ' + w.to + '». ' : '') + 'В подарок 1 А/Б тест обложки и СЕО.</span></div>' +
            '<div class="cc-pay-b"><button type="button" class="cc-btn cc-btn-b" data-cc-act="gen">Сгенерировать</button><button type="button" class="cc-btn" data-cc-act="send">Отправить на WB</button></div></div>' +
            frames('Сейчас', true) + frames('Новый вариант', false);
    }
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
        var opts = S.arts.length ? S.arts.map(function (a) { return '<option value="' + esc(a.nm_id) + '"' + (Number(a.nm_id) === S.nm ? ' selected' : '') + '>' + esc(a.name || a.seller_article || a.nm_id) + '</option>'; }).join('') : '<option>Товары загружаются</option>';
        if (sel.__h !== opts) { sel.innerHTML = opts; sel.__h = opts; }
        Array.prototype.forEach.call(host.querySelectorAll('.cc-chip'), function (b) { var on = b.getAttribute('data-cc') === S.sec; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
        var body = host.querySelector('#cc-body'), h = VIEW[S.sec]();
        if (body.__h !== h) { body.innerHTML = h; body.__h = h; }
    }

    // ───── данные ─────
    function loadArts(cab) {
        if (!sb()) return Promise.resolve([]);
        return Promise.resolve(sb().from('rnp_articles').select('nm_id,name,seller_article,photo_url').eq('cabinet_id', cab).eq('is_active', true).order('name').range(0, 999))
            .then(function (r) { return (r && r.data) || []; }).catch(function () { return []; });
    }
    function loadFunnel() {
        var cab = S.cab, nm = S.nm, my = ++S.token, p = period(), key = 'nr_cc_fun_' + cab + '_' + nm;
        var cached = lsGet(key);
        S.fun = cached && cached.to === p.to ? funnel(cached.rows) : null;
        paint();
        if (!sb() || !nm) return;
        Promise.resolve(sb().from('rnp_daily_data').select('impressions,clicks,basket_count,funnel_orders,orders_count,orders_sum,sales_count,competitor_ctr,competitor_basket,competitor_cro').eq('cabinet_id', cab).eq('nm_id', nm).gte('date', p.from).lte('date', p.to).range(0, 199))
            .then(function (r) {
                if (my !== S.token || !r || r.error) return;
                lsSet(key, { to: p.to, rows: r.data || [] });
                S.fun = funnel(r.data || []); paint();
            }).catch(function () { /* остаётся каркас */ });
    }

    // ───── окно оплаты ─────
    function closePay() { var m = doc.getElementById('cc-ov'); if (m) m.remove(); }
    function openPay() {
        closePay();
        var a = art(), m = doc.createElement('div');
        m.id = 'cc-ov'; m.className = 'cc-ov'; m.setAttribute('data-nr-blur', ''); m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
        m.innerHTML = '<div class="cc-m"><div class="cc-mh"><div class="cc-cap">Генерация фото</div><button type="button" class="cc-x" data-cc-close aria-label="Закрыть">×</button></div>' +
            '<div class="cc-tile cc-dark"><div class="cc-cap">К оплате</div><b>' + fmt(PRICE_SOM) + ' сом</b><span>' + esc(a ? (a.name || a.nm_id) : '') + '</span></div>' +
            '<div class="cc-qr"><div class="cc-qrbox" aria-hidden="true">QR</div><div><b>Оплата по QR через Finik</b><p>Оплата подключается. Сейчас оплатить и запустить генерацию нельзя.</p></div></div>' +
            '<div class="cc-kv"><span>Что входит</span><span>' + SLIDES.length + ' фото под утечку воронки</span></div><div class="cc-kv"><span>В подарок</span><span>1 А/Б тест обложки и СЕО</span></div>' +
            '<button type="button" class="cc-btn cc-btn-b" disabled>Оплатить ' + fmt(PRICE_SOM) + ' сом</button></div>';
        m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('[data-cc-close]')) closePay(); });
        doc.body.appendChild(m);
    }
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePay(); });

    function bind(host) {
        if (S.bound) return; S.bound = true;
        host.addEventListener('click', function (e) {
            var b;
            if ((b = e.target.closest('[data-cc]'))) { S.sec = b.getAttribute('data-cc'); try { root.localStorage.setItem('nr_cc_sec', S.sec); } catch (_) {} paint(); return; }
            if ((b = e.target.closest('[data-cc-act]'))) {
                var act = b.getAttribute('data-cc-act');
                if (act === 'gen') openPay();
                else if (act === 'find') say('Подбор конкурентов подключается', 'Похожие по фото WB и выручка MPStats появятся следующим шагом');
                else if (act === 'seo') say('Сбор СЕО подключается', 'Запросы, слова и новый вариант карточки появятся следующим шагом');
                else if (act === 'send') say('Отправлять пока нечего', 'Сначала нужна генерация новых фото');
            }
        });
        host.addEventListener('change', function (e) {
            if (e.target.id !== 'cc-art') return;
            S.nm = Number(e.target.value) || 0;
            try { root.localStorage.setItem('nr_cc_nm_' + S.cab, String(S.nm)); } catch (_) {}
            loadFunnel();
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
        S.cab = cab; S.arts = lsGet('nr_cc_arts_' + cab) || []; S.fun = null;
        pickNm(); paint();
        if (S.nm) loadFunnel();
        // Кабинет ещё не выбран (страница только открылась): каркас уже на экране, данные подтянем, как только кабинет появится
        if (!cab) { if ((S.wait = (S.wait || 0) + 1) < 40) root.setTimeout(function () { var pane = doc.getElementById('an-content'); if (pane && !pane.hidden && !S.cab) open(); }, 500); return; }
        S.wait = 0;
        loadArts(cab).then(function (arts) {
            if (cab !== S.cab) return;
            var had = S.nm;
            S.arts = arts; lsSet('nr_cc_arts_' + cab, arts); pickNm(); paint();
            if (S.nm && S.nm !== had) loadFunnel();
        });
    }
    doc.addEventListener('cabinet-changed', function () {
        S.token++; S.cab = ''; S.arts = []; S.fun = null; S.nm = 0; closePay();
        var host = doc.getElementById('cc-root'), pane = doc.getElementById('an-content');
        if (host && pane && !pane.hidden) open();
    });

    root.NrCompare = { open: open, _funnel: funnel };
})(typeof window !== 'undefined' ? window : globalThis);

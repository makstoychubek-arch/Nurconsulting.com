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
        { id: 'reviews', title: 'Отзывы' }
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
        reviews: '<div id="rv-root" class="rv-root"></div>'
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
            if (b.getAttribute('data-an') === 'reviews' && root.NrReviews) root.NrReviews.open();
        });
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', mount); else mount();

    /* ───────── Отзывы по артикулу (только чтение): оценки, воронка заказов, подозрительные отзывы ───────── */
    var RV = { cab: '', arts: [], nm: 0, days: 30, items: [], funnel: null, prev: null, loading: false, err: '', star: 0, tab: 'all', shown: 40, token: 0, cache: {}, view: 'overview', theme: -1, by: 'color', goal: 4.7, all: {}, allBusy: false, sizeOrd: null };
    function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function fmt(n) { return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
    function sb() { return root.supabase; }
    function cabId() { var c = root.currentCabinetId; if (c) return c; try { return root.localStorage.getItem('selected_cabinet_id') || ''; } catch (_) { return ''; } }
    function ymd(d) { return d.toISOString().slice(0, 10); }
    function periodOf(days, shift) {
        var to = new Date(Date.now() + 6 * 3600e3 - (shift || 0) * days * 86400e3), from = new Date(to.getTime() - (days - 1) * 86400e3);
        return { from: ymd(from), to: ymd(to) };
    }
    function norm(t) { return String(t || '').toLowerCase().replace(/[^a-zа-яё0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
    function bodyOf(f) { return [f.text, f.pros, f.cons].filter(Boolean).join(' ').trim(); }
    /* Подозрительные: оценка 1–2 без текста; одинаковый текст у нескольких отзывов; три и более негативных за час. Решение о жалобе остаётся за человеком. */
    function suspicion(items) {
        var out = {}, seen = {}, neg = [];
        items.forEach(function (f) {
            var b = norm(bodyOf(f));
            if (f.stars <= 2 && !b) out[f.id] = 'Оценка без текста';
            if (b.length >= 8 && f.stars <= 3) (seen[b] = seen[b] || []).push(f);
            if (f.stars <= 2) neg.push(f);
        });
        Object.keys(seen).forEach(function (k) { if (seen[k].length >= 2) seen[k].forEach(function (f) { out[f.id] = 'Одинаковый текст у ' + seen[k].length + ' отзывов'; }); });
        neg.sort(function (a, b) { return new Date(a.at) - new Date(b.at); });
        for (var i = 0; i + 2 < neg.length; i++) {
            if (new Date(neg[i + 2].at) - new Date(neg[i].at) <= 3600e3) { [neg[i], neg[i + 1], neg[i + 2]].forEach(function (f) { if (!out[f.id]) out[f.id] = 'Три негативных отзыва за час'; }); }
        }
        return out;
    }
    function ratingStats(items) {
        var n = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, sum = 0;
        items.forEach(function (f) { if (n[f.stars] != null) { n[f.stars]++; sum += f.stars; } });
        return { n: n, total: items.length, avg: items.length ? sum / items.length : 0 };
    }
    function stars(n) { var o = ''; for (var i = 1; i <= 5; i++) o += i <= n ? '★' : '<i>★</i>'; return '<span class="rv-st">' + o + '</span>'; }
    function delta(cur, prev, goodUp, suffix) {
        if (!(prev > 0)) return '';
        var d = (cur - prev) / prev * 100; if (Math.abs(d) < 0.5) return '';
        var up = d > 0, good = up === goodUp;
        return '<em class="' + (good ? 'up' : 'dn') + '">' + (up ? '▲ ' : '▼ ') + Math.round(Math.abs(d)) + '%' + (suffix || '') + '</em>';
    }

    function loadArticles() {
        var cab = cabId();
        if (!cab || !sb()) return Promise.resolve([]);
        return Promise.resolve(sb().from('rnp_articles').select('nm_id,name,photo_url').eq('cabinet_id', cab).eq('is_active', true).order('name').range(0, 999)).then(function (r) {
            return (r && r.data) || [];
        }).catch(function () { return []; });
    }
    function sumRows(rows) {
        var t = { orders: 0, buyouts: 0, returns: 0 };
        (rows || []).forEach(function (r) { t.orders += Number(r.funnel_orders) || Number(r.orders_count) || 0; t.buyouts += Number(r.sales_count) || 0; t.returns += Number(r.returns_count) || 0; });
        return t;
    }
    function loadFunnel(cab, nm, per) {
        var q1 = sb().from('rnp_daily_data').select('funnel_orders,orders_count,sales_count,returns_count').eq('cabinet_id', cab).eq('nm_id', nm).gte('date', per.from).lte('date', per.to).range(0, 999);
        var base = function () { return sb().from('wb_orders').select('id', { count: 'exact', head: true }).eq('cabinet_id', cab).eq('nm_id', nm).gte('order_date', per.from).lt('order_date', ymd(new Date(Date.parse(per.to) + 86400e3))); };
        return Promise.all([q1, base().eq('data->>isCancel', 'true')]).then(function (a) {
            var t = sumRows(a[0] && a[0].data); t.cancels = (a[1] && a[1].count) || 0; return t;
        }).catch(function () { return null; });
    }
    function loadReviews(cab, nm, per) {
        if (typeof root.callWbProxy !== 'function') return Promise.reject(new Error('Нет связи с WB'));
        var from = Math.floor(Date.parse(per.from + 'T00:00:00Z') / 1000), to = Math.floor(Date.parse(per.to + 'T23:59:59Z') / 1000);
        return Promise.resolve(root.callWbProxy('feedbacks_by_nm', { nmId: nm, dateFrom: from, dateTo: to }, cab)).then(function (res) {
            if (!res || res.error) throw new Error((res && res.error) || 'WB не отдал отзывы');
            return res.feedbacks || [];
        });
    }

    /* ───── Расширенная аналитика отзывов: считаем только из загруженных отзывов WB и заказов ───── */
    var NEG_TOPICS = [
        ['Размер: маломерит или велико', ['маломер', 'мал был', 'мала ', 'мало ', 'велик', 'большемер', 'не по размер', 'размер не', 'села', 'сел ', 'тесн', 'узк', 'широк', 'коротк']],
        ['Ткань и качество', ['ткан', 'качеств', 'тонк', 'прозрачн', 'колюч', 'скатыв', 'синтет', 'пошив']],
        ['Цвет не как на фото', ['цвет', 'оттенок', 'не как на фото', 'не соответств']],
        ['Брак, шов, пятно', ['брак', 'шов', 'нитк', 'дыр', 'пятн', 'порв', 'торчат', 'молни', 'пуговиц']],
        ['Доставка и упаковка', ['достав', 'упаковк', 'пакет', 'мят', 'курьер']]
    ];
    var POS_TOPICS = [
        ['Посадка и фигура', ['сидит', 'посадк', 'фигур', 'идеальн', 'по размеру']],
        ['Приятная ткань', ['приятн', 'мягк', 'плотн', 'качествен']],
        ['Цена', ['цен', 'недорог', 'за свои деньги', 'дешев', 'дёшев']],
        ['Цвет', ['цвет', 'оттенок']]
    ];
    function hasAny(text, words) { for (var i = 0; i < words.length; i++) if (text.indexOf(words[i]) >= 0) return true; return false; }
    function topicCounts(items, topics, test) {
        return topics.map(function (t, i) {
            var n = items.filter(function (f) { return test(f) && hasAny(norm(bodyOf(f)) + ' ', t[1]); }).length;
            return { i: i, name: t[0], n: n };
        });
    }
    function mondayKey(iso) {
        var d = new Date(iso); if (isNaN(d)) return ''; d = new Date(d.getTime() + 6 * 3600e3);
        var dow = (d.getUTCDay() + 6) % 7; d = new Date(d.getTime() - dow * 86400e3); return ymd(d);
    }
    function weekly(items, days) {
        var map = {}, from = periodOf(days, 0).from, w = mondayKey(from + 'T00:00:00Z'), end = periodOf(days, 0).to, out = [];
        items.forEach(function (f) { var k = mondayKey(f.at); if (!k) return; var o = map[k] = map[k] || { n: 0, sum: 0 }; o.n++; o.sum += f.stars; });
        for (var guard = 0; w <= end && guard < 30; guard++) {
            var o = map[w]; out.push({ week: w, n: o ? o.n : 0, avg: o ? o.sum / o.n : 0 });
            w = ymd(new Date(Date.parse(w) + 7 * 86400e3));
        }
        return out;
    }
    function replyStats(items) {
        var ans = items.filter(function (f) { return f.answered; }).length, no = items.filter(function (f) { return !f.answered; });
        var ph = items.filter(function (f) { return f.photos && f.photos.length; }), nph = items.filter(function (f) { return !(f.photos && f.photos.length); });
        function avg(a) { return a.length ? a.reduce(function (s, f) { return s + f.stars; }, 0) / a.length : 0; }
        return { total: items.length, pct: items.length ? Math.round(ans / items.length * 100) : 0, noans: no.length, noansNeg: no.filter(function (f) { return f.stars <= 2; }).length,
            phPct: items.length ? Math.round(ph.length / items.length * 100) : 0, phAvg: avg(ph), nphAvg: avg(nph), nPh: ph.length };
    }
    // сколько отзывов на 5★ нужно, чтобы средняя дошла до цели
    function needFive(avg, total, goal) { if (!(goal > avg) || goal >= 5) return 0; return Math.ceil(total * (goal - avg) / (5 - goal)); }
    function groupBy(items, key) {
        var map = {};
        items.forEach(function (f) { var k = String(f[key] || '').trim() || 'не указан'; var o = map[k] = map[k] || { name: k, n: 0, sum: 0, neg: 0 }; o.n++; o.sum += f.stars; if (f.stars <= 2) o.neg++; });
        return Object.keys(map).map(function (k) { var o = map[k]; return { name: o.name, n: o.n, avg: o.sum / o.n, negPct: Math.round(o.neg / o.n * 100) }; }).sort(function (a, b) { return b.n - a.n; });
    }
    function artRow(name, nm, items) {
        var st = ratingStats(items), neg = (st.n[1] || 0) + (st.n[2] || 0);
        return { nm: nm, name: name, n: st.total, avg: st.avg, negPct: st.total ? Math.round(neg / st.total * 100) : 0, noans: items.filter(function (f) { return !f.answered; }).length, sus: Object.keys(suspicion(items)).length };
    }
    // заказы по размерам (techSize в заказах WB): сколько заказали и сколько отказались
    function loadSizeOrders(cab, nm, per) {
        var out = {}, page = 0;
        function next() {
            return Promise.resolve(sb().from('wb_orders').select('size:data->>techSize,cancel:data->>isCancel').eq('cabinet_id', cab).eq('nm_id', nm)
                .gte('order_date', per.from).lt('order_date', ymd(new Date(Date.parse(per.to) + 86400e3))).range(page * 1000, page * 1000 + 999)).then(function (r) {
                var rows = (r && r.data) || [];
                rows.forEach(function (x) { var k = String(x.size || '').trim(); if (!k) return; var o = out[k] = out[k] || { n: 0, c: 0 }; o.n++; if (String(x.cancel) === 'true') o.c++; });
                if (rows.length === 1000 && ++page < 5) return next();
                return out;
            });
        }
        return next().catch(function () { return null; });
    }
    function lineSvg(weeks) {
        var W = 360, H = 150, x0 = 30, x1 = 350, n = weeks.length || 1, mx = Math.max(1, Math.max.apply(null, weeks.map(function (w) { return w.n; })));
        var step = (x1 - x0) / n, bw = Math.min(34, step * 0.6), bars = '', pts = [], labs = '', dots = '';
        weeks.forEach(function (w, i) {
            var cx = x0 + step * i + step / 2, h = w.n ? Math.max(4, w.n / mx * 75) : 0;
            bars += '<rect x="' + (cx - bw / 2).toFixed(1) + '" y="' + (125 - h).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="5" fill="var(--mono-3, #b9b9b9)"/>';
            if (w.n) pts.push((cx).toFixed(1) + ',' + (105 - (w.avg - 1) / 4 * 85).toFixed(1));
            if (n <= 8 || i % 2 === 0) labs += '<text x="' + cx.toFixed(1) + '" y="142" text-anchor="middle">' + w.week.slice(8, 10) + '.' + w.week.slice(5, 7) + '</text>';
        });
        if (pts.length) { var lp = pts[pts.length - 1].split(','); dots = '<circle cx="' + lp[0] + '" cy="' + lp[1] + '" r="4.5" fill="var(--text-primary)"/>'; }
        return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Отзывы и рейтинг по неделям"><g stroke="var(--mono-4, #d9d9d9)"><line x1="30" y1="20" x2="350" y2="20"/><line x1="30" y1="62" x2="350" y2="62"/><line x1="30" y1="105" x2="350" y2="105"/></g>' + bars +
            (pts.length > 1 ? '<polyline points="' + pts.join(' ') + '" fill="none" stroke="var(--text-primary)" stroke-width="2.5"/>' : '') + dots + labs + '<text x="2" y="24">5,0</text><text x="2" y="66">3,0</text><text x="2" y="109">1,0</text></svg>';
    }
    function topicBars(list, cls) {
        var mx = Math.max(1, Math.max.apply(null, list.map(function (t) { return t.n; })));
        return list.map(function (t) {
            return '<button type="button" class="rv-brow' + (RV.theme === t.i && cls === 'neg' ? ' on' : '') + '" ' + (cls === 'neg' ? 'data-topic="' + t.i + '"' : 'disabled') + '><span>' + esc(t.name) + '</span><span class="t"><i style="width:' + (t.n ? Math.max(4, t.n / mx * 100) : 0) + '%"></i></span><b>' + t.n + '</b></button>';
        }).join('');
    }
    function viewHtml(st) {
        var v = RV.view, rp = replyStats(RV.items);
        if (v === 'overview') {
            var need = needFive(st.avg, st.total, RV.goal);
            return '<div class="rv-grid3"><div class="rv-panel"><div class="rv-cap">Рейтинг по неделям</div>' + (st.total ? lineSvg(weekly(RV.items, RV.days)) : '<div class="rv-hint">Отзывов за период нет.</div>') +
                '<div class="rv-hint">Серые столбики: отзывов за неделю. Чёрная линия: средний рейтинг недели.</div></div>' +
                '<div class="rv-panel"><div class="rv-cap">Ответы и фото</div><div class="rv-kp"><div><span class="rv-hint">Отвечено</span><b>' + rp.pct + '%</b></div><div><span class="rv-hint">Без ответа</span><b>' + rp.noans + '</b><span class="rv-hint">негативных: ' + rp.noansNeg + '</span></div>' +
                '<div><span class="rv-hint">С фото</span><b>' + rp.phPct + '%</b><span class="rv-hint">оценка ' + (rp.nPh ? rp.phAvg.toFixed(1).replace('.', ',') : '—') + '</span></div><div><span class="rv-hint">Без фото</span><b>' + (st.total ? 100 - rp.phPct : 0) + '%</b><span class="rv-hint">оценка ' + (st.total - rp.nPh ? rp.nphAvg.toFixed(1).replace('.', ',') : '—') + '</span></div></div></div>' +
                '<div class="rv-panel"><div class="rv-cap">Сколько 5★ нужно до цели</div><div class="rv-calc"><span class="rv-hint">Сейчас ' + (st.total ? st.avg.toFixed(1).replace('.', ',') : '—') + '</span><label class="rv-hint" for="rv-goal">Цель</label><input id="rv-goal" type="number" min="1" max="4.9" step="0.1" value="' + String(RV.goal).replace(',', '.') + '"></div>' +
                '<b class="rv-big">' + (st.total ? (RV.goal <= st.avg ? 'Цель достигнута' : '+' + need) : '—') + '</b><div class="rv-hint">' + (st.total && RV.goal > st.avg ? 'отзывов на 5★ подряд. Считаем по отзывам за выбранный период.' : 'Поставьте цель выше текущего рейтинга.') + '</div></div></div>';
        }
        if (v === 'colors') {
            var by = RV.by, rows = groupBy(RV.items, by === 'color' ? 'color' : 'size'), ord = by === 'size' && RV.sizeOrd ? RV.sizeOrd : null;
            var tr = rows.map(function (r) {
                var o = ord && ord[r.name], can = o && o.n ? Math.round(o.c / o.n * 100) : null;
                return '<tr><td>' + esc(r.name) + '</td><td class="n">' + r.n + '</td><td class="n">' + r.avg.toFixed(1).replace('.', ',') + '</td><td class="n' + (r.negPct >= 25 ? ' dn' : (r.negPct <= 8 ? ' up' : '')) + '">' + r.negPct + '%</td>' +
                    (by === 'size' ? '<td class="n">' + (o ? o.n : '—') + '</td><td class="n' + (can != null && can >= 25 ? ' dn' : '') + '">' + (can == null ? '—' : can + '%') + '</td>' : '') + '</tr>';
            }).join('');
            return '<div class="rv-panel rv-wide"><div class="rv-cap">Где копится негатив</div><div class="rv-tabs"><button type="button" class="rv-tab' + (by === 'color' ? ' on' : '') + '" data-by="color">По цветам</button><button type="button" class="rv-tab' + (by === 'size' ? ' on' : '') + '" data-by="size">По размерам</button></div>' +
                (rows.length ? '<div class="rv-tw"><table class="rv-tbl"><tr><th>' + (by === 'color' ? 'Цвет' : 'Размер') + '</th><th class="n">Отзывов</th><th class="n">Рейтинг</th><th class="n">1–2★</th>' + (by === 'size' ? '<th class="n">Заказов</th><th class="n">Отказов</th>' : '') + '</tr>' + tr + '</table></div>' : '<div class="rv-hint">Отзывов за период нет.</div>') +
                '<div class="rv-hint">Красным отмечена доля 1–2★ от 25%' + (by === 'size' ? ' и отказы от 25% (по заказам WB за период)' : '') + '. WB отдаёт цвет и размер только у части отзывов, остальные в строке «не указан».</div></div>';
        }
        if (v === 'topics') {
            var neg = topicCounts(RV.items, NEG_TOPICS, function (f) { return f.stars <= 3; }), pos = topicCounts(RV.items, POS_TOPICS, function (f) { return f.stars >= 4; });
            return '<div class="rv-grid3 rv-g2"><div class="rv-panel"><div class="rv-cap">Темы в отзывах до 3★</div>' + topicBars(neg, 'neg') + '<div class="rv-hint">Ищем по словам в тексте. Нажмите на тему, и список ниже покажет только такие отзывы.</div></div>' +
                '<div class="rv-panel"><div class="rv-cap">Что хвалят (4–5★)</div>' + topicBars(pos, 'pos') + '<div class="rv-hint">Эти слова можно взять в описание карточки и в главное фото.</div></div></div>';
        }
        // all
        var key = RV.cab + ':' + RV.days, rows2 = RV.all[key] || [];
        var body = rows2.map(function (r) {
            return '<tr><td>' + esc(r.name || r.nm) + ' · ' + r.nm + '</td><td class="n">' + r.n + '</td><td class="n">' + (r.n ? r.avg.toFixed(1).replace('.', ',') : '—') + '</td><td class="n' + (r.negPct >= 25 ? ' dn' : '') + '">' + r.negPct + '%</td><td class="n' + (r.noans >= 5 ? ' dn' : '') + '">' + r.noans + '</td><td class="n' + (r.sus ? ' dn' : '') + '">' + r.sus + '</td></tr>';
        }).join('');
        return '<div class="rv-panel rv-wide"><div class="rv-cap">Сравнение артикулов за период</div><div><button type="button" class="rv-more" data-all="1"' + (RV.allBusy ? ' disabled' : '') + '>' + (RV.allBusy ? 'Собираем… ' + rows2.length + ' из ' + RV.arts.length : (rows2.length ? 'Обновить' : 'Собрать по всем артикулам')) + '</button></div>' +
            (rows2.length ? '<div class="rv-tw"><table class="rv-tbl"><tr><th>Артикул</th><th class="n">Отзывов</th><th class="n">Рейтинг</th><th class="n">1–2★</th><th class="n">Без ответа</th><th class="n">Подозрит.</th></tr>' + body + '</table></div>' : '<div class="rv-hint">Нажмите кнопку: WB отдаёт отзывы по одному артикулу за запрос, готовые строки появляются по мере сбора.</div>') + '</div>';
    }
    function collectAll() {
        var cab = RV.cab, key = cab + ':' + RV.days, per = periodOf(RV.days, 0), arts = RV.arts.slice(), my = ++RV.token, out = RV.all[key] = [];
        RV.allBusy = true; paintRoot();
        function step(i) {
            if (i >= arts.length || RV.cab !== cab) { RV.allBusy = false; paintRoot(); return Promise.resolve(); }
            var a = arts[i];
            return loadReviews(cab, Number(a.nm_id), per).then(function (items) { out.push(artRow(a.name, a.nm_id, items)); }, function () { out.push({ nm: a.nm_id, name: a.name, n: 0, avg: 0, negPct: 0, noans: 0, sus: 0 }); })
                .then(function () { paintRoot(); return new Promise(function (r) { setTimeout(r, 350); }); }).then(function () { return step(i + 1); });
        }
        return step(0);
    }

    function paintRoot() {
        var host = doc.getElementById('rv-root'); if (!host) return;
        if (RV.empty && !RV.loading) { host.innerHTML = '<div class="rv-panel rv-empty"><div class="rv-cap">Отзывы</div><b>В этом кабинете пока нет артикулов в РНП</b><p class="rv-hint">Добавьте артикулы в РНП: отзывы, оценки и воронка по ним появятся здесь сами.</p></div>'; return; }
        var st = ratingStats(RV.items), sus = suspicion(RV.items), nSus = Object.keys(sus).length;
        var f = RV.funnel, pv = RV.prev, ld = RV.loading ? ' rv-load' : '';
        var opts = RV.arts.map(function (a) { return '<option value="' + a.nm_id + '"' + (Number(a.nm_id) === RV.nm ? ' selected' : '') + '>' + esc(a.name || a.nm_id) + ' · ' + a.nm_id + '</option>'; }).join('');
        var dist = [5, 4, 3, 2, 1].map(function (k) {
            var mx = Math.max(1, st.n[5], st.n[4], st.n[3], st.n[2], st.n[1]);
            return '<button type="button" class="rv-drow' + (RV.star === k ? ' on' : '') + '" data-star="' + k + '"><span>★ ' + k + '</span><span class="t"><i style="width:' + Math.max(3, st.n[k] / mx * 100) + '%"></i></span><span>' + st.n[k] + '</span></button>';
        }).join('');
        var buy = f && f.orders ? Math.round(f.buyouts / f.orders * 100) : 0, can = f && f.orders ? Math.round(f.cancels / f.orders * 100) : 0;
        var funnel = f ? '<div class="rv-seg" aria-hidden="true"><i style="width:' + Math.min(100, buy) + '%;background:var(--text-primary)"></i><i style="width:' + Math.max(0, Math.min(100 - buy, can)) + '%;background:var(--mono-3, #b9b9b9)"></i></div>' +
            '<div class="rv-nums"><div><span class="l">Заказали</span><b>' + fmt(f.orders) + '</b>' + (pv ? delta(f.orders, pv.orders, true) : '') + '</div><div><span class="l">Выкупили</span><b>' + fmt(f.buyouts) + '</b><em class="' + (buy >= 30 ? 'up' : 'dn') + '">' + buy + '%</em></div>' +
            '<div><span class="l">Отказались</span><b>' + fmt(f.cancels) + '</b><em class="dn">' + can + '%</em></div><div><span class="l">Вернули</span><b>' + fmt(f.returns) + '</b>' + (pv ? delta(f.returns, pv.returns, false) : '') + '</div></div>'
            : '<div class="rv-hint">Данные по заказам за период не нашлись.</div>';
        var list = RV.items.filter(function (r) {
            if (RV.star && r.stars !== RV.star) return false;
            if (RV.tab === 'noans' && r.answered) return false;
            if (RV.tab === 'sus' && !sus[r.id]) return false;
            if (RV.theme >= 0 && !(r.stars <= 3 && hasAny(norm(bodyOf(r)) + ' ', NEG_TOPICS[RV.theme][1]))) return false;
            return true;
        });
        var rows = list.slice(0, RV.shown).map(function (r) {
            var body = bodyOf(r), d = new Date(r.at), ds = isNaN(d) ? '' : ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2);
            return '<div class="rv-item"><div class="rv-h">' + stars(r.stars) + '<span class="rv-meta">' + ds + (r.size ? ' · размер ' + esc(r.size) : '') + (r.color ? ' · ' + esc(r.color) : '') + '</span></div>' +
                (body ? '<div class="rv-txt">' + esc(r.text) + (r.pros ? '<br><span class="rv-meta">Достоинства:</span> ' + esc(r.pros) : '') + (r.cons ? '<br><span class="rv-meta">Недостатки:</span> ' + esc(r.cons) : '') + '</div>' : '<div class="rv-meta">Оценка без текста</div>') +
                (r.photos && r.photos.length ? '<div class="rv-ph">' + r.photos.slice(0, 6).map(function (u) { return '<img src="' + esc(u) + '" alt="" loading="lazy">'; }).join('') + '</div>' : '') +
                (sus[r.id] ? '<div class="rv-flag">' + esc(sus[r.id]) + '</div>' : '') +
                '<div class="rv-meta">' + (r.answered ? 'Ответ опубликован' : 'Без ответа') + (r.stars <= 3 || sus[r.id] ? ' <button type="button" class="rv-cmp" data-cmp="' + esc(r.id) + '">Пожаловаться</button>' : '') + '</div></div>';
        }).join('');
        host.innerHTML =
            '<div class="rv-top"><div class="rv-pick"><select id="rv-art" aria-label="Артикул">' + (opts || '<option>Нет артикулов в РНП</option>') + '</select>' +
            '<select id="rv-days" aria-label="Период"><option value="30"' + (RV.days === 30 ? ' selected' : '') + '>30 дней</option><option value="90"' + (RV.days === 90 ? ' selected' : '') + '>90 дней</option></select></div></div>' +
            '<div class="rv-tabs rv-views">' + [['overview', 'Обзор'], ['colors', 'Цвета и размеры'], ['topics', 'О чём пишут'], ['all', 'Все артикулы']].map(function (v) { return '<button type="button" class="rv-tab' + (RV.view === v[0] ? ' on' : '') + '" data-view="' + v[0] + '">' + v[1] + '</button>'; }).join('') + '</div>' +
            (RV.err ? '<div class="rv-err">' + esc(RV.err) + '</div>' : '') +
            (RV.view === 'overview' ? ('<div class="rv-hero' + ld + '"><div class="rv-rate"><div class="rv-cap">Рейтинг за период</div><b>' + (st.total ? st.avg.toFixed(1).replace('.', ',') : '—') + '</b><div class="rv-s">' + (st.total ? '★★★★★' : '') + '</div><small>' + st.total + ' отзывов</small></div>' +
            '<div class="rv-panel"><div class="rv-cap">Оценки: нажмите, чтобы читать</div><div class="rv-dist">' + dist + '</div><div class="rv-hint">' + (RV.star ? 'Показаны отзывы с оценкой ' + RV.star + '. Нажмите ещё раз, чтобы снять' : 'Показаны все отзывы') + '</div></div>' +
            '<div class="rv-panel"><div class="rv-cap">Куда уходят заказы</div>' + funnel + '</div></div>') : '') +
            '<div class="rv-viewbody">' + viewHtml(st) + '</div>' +
            '<div class="rv-main"' + (RV.view === 'colors' || RV.view === 'all' ? ' hidden' : '') + '><div class="rv-left">' + (RV.theme >= 0 ? '<button type="button" class="rv-chip" data-topic="-1">Тема: ' + esc(NEG_TOPICS[RV.theme][0]) + ' ×</button>' : '') + '<div class="rv-tabs"><button type="button" class="rv-tab' + (RV.tab === 'all' ? ' on' : '') + '" data-tab="all">Все</button><button type="button" class="rv-tab' + (RV.tab === 'noans' ? ' on' : '') + '" data-tab="noans">Без ответа</button><button type="button" class="rv-tab' + (RV.tab === 'sus' ? ' on' : '') + '" data-tab="sus">Подозрительные · ' + nSus + '</button></div>' +
            '<div class="rv-list' + ld + '">' + (rows || '<div class="rv-hint">' + (RV.loading ? 'Загружаем отзывы…' : 'Таких отзывов нет') + '</div>') + '</div>' +
            (list.length > RV.shown ? '<button type="button" class="rv-more" data-more="1">Показать ещё</button>' : '') + '</div>' +
            '<div class="rv-side"><div class="rv-panel"><div class="rv-cap">Жалобы на отзывы</div><p class="rv-hint">WB не принимает жалобы через API, поэтому у отзыва до 3★ и у подозрительных есть кнопка «Пожаловаться»: она копирует готовый текст и открывает отзывы в кабинете WB, остаётся вставить и отправить. Что подавать, решаете вы.</p>' +
            '<a class="rv-link" href="https://seller.wildberries.ru/feedbacks-and-questions" target="_blank" rel="noopener">Открыть отзывы в кабинете WB</a>' +
            '<div class="rv-auto"><span class="rv-sw" aria-hidden="true"></span><div><b>Автожалобы</b><span class="rv-pill">пока недоступно</span><p>Включим, когда подтвердим официальный способ подачи жалоб через WB.</p></div></div></div></div></div>';
    }

    function refresh() {
        var cab = RV.cab, nm = RV.nm; if (!cab || !nm) { paintRoot(); return; }
        var per = periodOf(RV.days, 0), prevPer = periodOf(RV.days, 1), key = cab + ':' + nm + ':' + RV.days, my = ++RV.token;
        var hit = RV.cache[key];
        if (hit) { RV.items = hit.items; RV.funnel = hit.funnel; RV.prev = hit.prev; RV.err = ''; RV.loading = false; paintRoot(); if (Date.now() - hit.at < 120000) return; }
        else { RV.items = []; RV.funnel = null; RV.prev = null; RV.err = ''; RV.loading = true; }
        paintRoot();
        Promise.all([
            loadReviews(cab, nm, per).then(function (v) { return { ok: v }; }, function (e) { return { err: e }; }),
            loadFunnel(cab, nm, per), loadFunnel(cab, nm, prevPer)
        ]).then(function (a) {
            if (my !== RV.token) return;   // человек уже выбрал другой артикул или период
            RV.loading = false;
            if (a[0].err) { RV.err = 'Отзывы не загрузились: ' + String((a[0].err && a[0].err.message) || a[0].err) + '. Проверьте, что у токена WB есть доступ к отзывам.'; }
            else { RV.items = a[0].ok; RV.cache[key] = { items: RV.items, funnel: a[1], prev: a[2], at: Date.now() }; }
            RV.funnel = a[1]; RV.prev = a[2]; paintRoot();
        });
    }

    var bound = false;
    // Жалобу WB через API не принимает: готовим текст и открываем отзывы в кабинете, остаётся вставить и отправить.
    function complain(id) {
        var r = RV.items.filter(function (x) { return String(x.id) === String(id); })[0]; if (!r) return;
        var why = suspicion(RV.items)[r.id] || (r.stars <= 3 ? 'Отзыв не отражает реальные свойства товара' : 'Отзыв нарушает правила площадки');
        var d = new Date(r.at), ds = isNaN(d) ? '' : ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + d.getFullYear();
        var txt = 'Прошу проверить отзыв на артикул ' + RV.nm + (ds ? ' от ' + ds : '') + ' (оценка ' + r.stars + ', id ' + r.id + '). Причина: ' + why + '. Прошу удалить отзыв, если он нарушает правила размещения отзывов.';
        function done() { if (root.NrUi) root.NrUi.toast('success', 'Текст жалобы скопирован', 'Вставьте его в кабинете WB'); }
        try { root.navigator.clipboard.writeText(txt).then(done, done); } catch (_) { done(); }
        root.open('https://seller.wildberries.ru/feedbacks-and-questions', '_blank', 'noopener');
    }
    function loadSizes() {
        if (RV.sizeOrd && RV.sizeOrd.key === RV.cab + ':' + RV.nm + ':' + RV.days) return;
        var key = RV.cab + ':' + RV.nm + ':' + RV.days, my = RV.token;
        loadSizeOrders(RV.cab, RV.nm, periodOf(RV.days, 0)).then(function (o) { if (o && key === RV.cab + ':' + RV.nm + ':' + RV.days) { o.key = key; RV.sizeOrd = o; if (RV.view === 'colors') paintRoot(); } });
    }
    function bind() {
        var host = doc.getElementById('rv-root'); if (!host || bound) return; bound = true;
        host.addEventListener('click', function (e) {
            var t = e.target, b;
            if ((b = t.closest('[data-star]'))) { var k = Number(b.getAttribute('data-star')); RV.star = RV.star === k ? 0 : k; RV.shown = 40; paintRoot(); return; }
            if ((b = t.closest('[data-tab]'))) { RV.tab = b.getAttribute('data-tab'); RV.shown = 40; paintRoot(); return; }
            if (t.closest('[data-more]')) { RV.shown += 40; paintRoot(); return; }
            if ((b = t.closest('[data-cmp]'))) { complain(b.getAttribute('data-cmp')); return; }
            if ((b = t.closest('[data-view]'))) { RV.view = b.getAttribute('data-view'); paintRoot(); if (RV.view === 'colors' && RV.by === 'size') loadSizes(); return; }
            if ((b = t.closest('[data-by]'))) { RV.by = b.getAttribute('data-by'); paintRoot(); if (RV.by === 'size') loadSizes(); return; }
            if ((b = t.closest('[data-topic]'))) { var k = Number(b.getAttribute('data-topic')); RV.theme = RV.theme === k ? -1 : k; RV.shown = 40; paintRoot(); return; }
            if (t.closest('[data-all]') && !RV.allBusy) collectAll();
        });
        host.addEventListener('change', function (e) {
            if (e.target.id === 'rv-art') { RV.nm = Number(e.target.value); try { root.localStorage.setItem('nr_rv_nm', String(RV.nm)); } catch (_) {} RV.star = 0; RV.theme = -1; RV.shown = 40; refresh(); }
            if (e.target.id === 'rv-goal') { var g = Number(String(e.target.value).replace(',', '.')); if (g >= 1 && g < 5) { RV.goal = g; paintRoot(); } }
            if (e.target.id === 'rv-days') { RV.days = Number(e.target.value) || 30; refresh(); }
        });
    }
    function open() {
        var cab = cabId();
        if (!doc.getElementById('rv-root')) return;
        bind();
        if (cab && cab === RV.cab && RV.arts.length) { refresh(); return; }
        RV.cab = cab; RV.loading = true; RV.empty = false; paintRoot();
        loadArticles().then(function (arts) {
            RV.arts = arts;
            if (!arts.length) { RV.loading = false; RV.empty = true; paintRoot(); return; }
            var saved = 0; try { saved = Number(root.localStorage.getItem('nr_rv_nm')) || 0; } catch (_) {}
            RV.nm = arts.some(function (a) { return Number(a.nm_id) === saved; }) ? saved : (arts[0] ? Number(arts[0].nm_id) : 0);
            refresh();
        });
    }
    root.addEventListener && root.addEventListener('nr-cabinet-changed', function () { RV.arts = []; RV.empty = false; RV.cache = {}; RV.cab = ''; if (doc.getElementById('rv-root') && !doc.getElementById('an-reviews').hidden) open(); });
    root.NrReviews = { open: open, _suspicion: suspicion, _stats: ratingStats };

    root.NrAnalytics = { mount: mount };
})(typeof window !== 'undefined' ? window : globalThis);

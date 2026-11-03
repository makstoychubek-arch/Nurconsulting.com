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
            var tabs = host.querySelector('#an-tabs'), phone = root.matchMedia && root.matchMedia('(max-width: 768px)').matches;
            if (phone && b.classList.contains('on')) { tabs.classList.toggle('open'); return; }
            tabs.classList.remove('open');
            Array.prototype.forEach.call(host.querySelectorAll('.an-tab'), function (x) {
                var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-selected', on ? 'true' : 'false');
                var pane = doc.getElementById('an-' + x.getAttribute('data-an')); if (pane) pane.hidden = !on;
            });
            if (b.getAttribute('data-an') === 'reviews' && root.NrReviews) root.NrReviews.open();
        });
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', mount); else mount();

    /* ───────── Отзывы по артикулу (только чтение): оценки, воронка заказов, подозрительные отзывы ───────── */
    var RV = { cab: '', arts: [], nm: 0, days: 30, items: [], funnel: null, prev: null, loading: false, err: '', star: 0, tab: 'all', shown: 40, token: 0, cache: {} };
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
            return true;
        });
        var rows = list.slice(0, RV.shown).map(function (r) {
            var body = bodyOf(r), d = new Date(r.at), ds = isNaN(d) ? '' : ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2);
            return '<div class="rv-item"><div class="rv-h">' + stars(r.stars) + '<span class="rv-meta">' + ds + (r.size ? ' · размер ' + esc(r.size) : '') + (r.color ? ' · ' + esc(r.color) : '') + '</span></div>' +
                (body ? '<div class="rv-txt">' + esc(r.text) + (r.pros ? '<br><span class="rv-meta">Достоинства:</span> ' + esc(r.pros) : '') + (r.cons ? '<br><span class="rv-meta">Недостатки:</span> ' + esc(r.cons) : '') + '</div>' : '<div class="rv-meta">Оценка без текста</div>') +
                (r.photos && r.photos.length ? '<div class="rv-ph">' + r.photos.slice(0, 6).map(function (u) { return '<img src="' + esc(u) + '" alt="" loading="lazy">'; }).join('') + '</div>' : '') +
                (sus[r.id] ? '<div class="rv-flag">' + esc(sus[r.id]) + '</div>' : '') +
                '<div class="rv-meta">' + (r.answered ? 'Ответ опубликован' : 'Без ответа') + '</div></div>';
        }).join('');
        host.innerHTML =
            '<div class="rv-top"><div class="rv-pick"><select id="rv-art" aria-label="Артикул">' + (opts || '<option>Нет артикулов в РНП</option>') + '</select>' +
            '<select id="rv-days" aria-label="Период"><option value="30"' + (RV.days === 30 ? ' selected' : '') + '>30 дней</option><option value="90"' + (RV.days === 90 ? ' selected' : '') + '>90 дней</option></select></div></div>' +
            (RV.err ? '<div class="rv-err">' + esc(RV.err) + '</div>' : '') +
            '<div class="rv-hero' + ld + '"><div class="rv-rate"><div class="rv-cap">Рейтинг за период</div><b>' + (st.total ? st.avg.toFixed(1).replace('.', ',') : '—') + '</b><div class="rv-s">' + (st.total ? '★★★★★' : '') + '</div><small>' + st.total + ' отзывов</small></div>' +
            '<div class="rv-panel"><div class="rv-cap">Оценки: нажмите, чтобы читать</div><div class="rv-dist">' + dist + '</div><div class="rv-hint">' + (RV.star ? 'Показаны отзывы с оценкой ' + RV.star + '. Нажмите ещё раз, чтобы снять' : 'Показаны все отзывы') + '</div></div>' +
            '<div class="rv-panel"><div class="rv-cap">Куда уходят заказы</div>' + funnel + '</div></div>' +
            '<div class="rv-main"><div class="rv-left"><div class="rv-tabs"><button type="button" class="rv-tab' + (RV.tab === 'all' ? ' on' : '') + '" data-tab="all">Все</button><button type="button" class="rv-tab' + (RV.tab === 'noans' ? ' on' : '') + '" data-tab="noans">Без ответа</button><button type="button" class="rv-tab' + (RV.tab === 'sus' ? ' on' : '') + '" data-tab="sus">Подозрительные · ' + nSus + '</button></div>' +
            '<div class="rv-list' + ld + '">' + (rows || '<div class="rv-hint">' + (RV.loading ? 'Загружаем отзывы…' : 'Таких отзывов нет') + '</div>') + '</div>' +
            (list.length > RV.shown ? '<button type="button" class="rv-more" data-more="1">Показать ещё</button>' : '') + '</div>' +
            '<div class="rv-side"><div class="rv-panel"><div class="rv-cap">Жалобы на отзывы</div><p class="rv-hint">Жалобы на отзывы подаются в кабинете WB. Подозрительные отзывы отмечены точкой с причиной, что подавать, решаете вы.</p>' +
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
    function bind() {
        var host = doc.getElementById('rv-root'); if (!host || bound) return; bound = true;
        host.addEventListener('click', function (e) {
            var t = e.target, b;
            if ((b = t.closest('[data-star]'))) { var k = Number(b.getAttribute('data-star')); RV.star = RV.star === k ? 0 : k; RV.shown = 40; paintRoot(); return; }
            if ((b = t.closest('[data-tab]'))) { RV.tab = b.getAttribute('data-tab'); RV.shown = 40; paintRoot(); return; }
            if (t.closest('[data-more]')) { RV.shown += 40; paintRoot(); }
        });
        host.addEventListener('change', function (e) {
            if (e.target.id === 'rv-art') { RV.nm = Number(e.target.value); try { root.localStorage.setItem('nr_rv_nm', String(RV.nm)); } catch (_) {} RV.star = 0; RV.shown = 40; refresh(); }
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

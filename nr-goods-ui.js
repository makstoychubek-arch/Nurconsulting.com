/* Товары → «Остатки»: карточки по группам вместо серой таблицы.
   Источник данных — готовая таблица (скрыта, но продолжает работать: поиск, настройки, сохранение «В пути» и «В плане»).
   Карточки: итоги сверху, фильтр-чипы, группы в пастельных цветах с фото, полоска ФБО/ФБС,
   метка «Хватит на N дней» = остаток ФБО+ФБС ÷ заказы в день за последние 14 дней. */
(function (root) {
    'use strict';
    var doc = root.document;
    if (!doc) return;
    var DAYS = 14, PAL = ['#f3ecff', '#e8f2ff', '#e9f9ef', '#fff1e3', '#ffe9f1'];
    var S = { sales: null, cab: '', loading: false, filter: 'all', busy: false, mo: null, q: '', limit: 60 };

    function num(t) {
        var v = parseFloat(String(t == null ? '' : t).replace(/[\s  ]/g, '').replace(',', '.'));
        return isFinite(v) ? v : 0;
    }
    function fmt(n) { return Math.round(n).toLocaleString('ru-RU').replace(/[  ]/g, ' '); }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function cls(days, stock) { return stock <= 0 ? 'r' : days == null ? '' : days < 7 ? 'r' : days < 21 ? 'o' : days > 90 ? 'b' : 'g'; }
    function cab() { try { return (typeof currentCabinetId !== 'undefined' ? currentCabinetId : '') || ''; } catch (e) { return ''; } }
    function db() { try { return typeof supabase !== 'undefined' ? supabase : null; } catch (e) { return null; } }

    async function loadSales() {
        var c = cab(), d = db();
        if (!c || !d || S.loading || (S.sales && S.cab === c)) return;
        S.loading = true;
        try {
            var from = new Date(Date.now() - DAYS * 86400000).toISOString().slice(0, 10), acc = {}, off = 0;
            for (var page = 0; page < 15; page++) {
                var r = await d.from('rnp_daily_data').select('nm_id, orders_count').eq('cabinet_id', c).gte('date', from).range(off, off + 999);
                var rows = r && r.data || [];
                rows.forEach(function (x) { acc[x.nm_id] = (acc[x.nm_id] || 0) + (Number(x.orders_count) || 0); });
                if (rows.length < 1000) break;
                off += 1000;
            }
            S.sales = {}; Object.keys(acc).forEach(function (k) { S.sales[k] = acc[k] / DAYS; });
            S.cab = c;
        } catch (e) { S.sales = S.sales || {}; }
        S.loading = false;
        schedule();
    }

    // Разбор скрытой таблицы в группы и артикулы
    function readTable() {
        var heads = doc.querySelectorAll('#gg-table-head th'), ix = {};
        Array.prototype.forEach.call(heads, function (th, i) {
            var t = th.textContent.trim();
            if (t === 'Артикул') ix.art = i; else if (t === 'ФБО') ix.fbo = i; else if (t === 'ФБС') ix.fbs = i;
            else if (t === 'В пути') ix.transit = i; else if (t === 'В плане') ix.plan = i; else if (t === 'Итого') ix.total = i;
        });
        var groups = [], cur = null;
        Array.prototype.forEach.call(doc.querySelectorAll('#gg-table-body tr'), function (tr) {
            if (tr.classList.contains('gg-sec-row')) {
                cur = { name: (tr.textContent.split(' · ')[0] || '').trim(), items: [] };
                groups.push(cur);
                return;
            }
            var key = tr.getAttribute('data-key') || '';
            if (key.indexOf('nm:') !== 0 || !cur) return;
            var td = tr.children, cell = function (k) { return ix[k] != null ? td[ix[k]] : null; };
            var inp = function (k) { var c = cell(k), i = c && c.querySelector('input'); return i; };
            var tIn = inp('transit'), pIn = inp('plan');
            cur.items.push({
                nm: key.slice(3),
                name: ((cell('art') || {}).textContent || '').trim(),
                fbo: num((cell('fbo') || {}).textContent), fbs: num((cell('fbs') || {}).textContent),
                transit: tIn ? num(tIn.value) : 0, plan: pIn ? num(pIn.value) : 0,
                cab: (tIn || pIn) ? (tIn || pIn).getAttribute('data-cab') || '' : '',
                total: num((cell('total') || {}).textContent),
            });
        });
        return groups.filter(function (g) { return g.items.length; });
    }

    function render() {
        if (S.busy) return;
        var tab = doc.getElementById('tab-goods-groups'), host = doc.getElementById('gg-view-now');
        if (!tab || !host || host.hidden || tab.offsetParent === null) { doc.body.classList.remove('ggx-on'); return; }
        S.busy = true;
        if (S.mo) S.mo.disconnect();
        try {
            var groups = readTable(), ph = root.RNP && root.RNP.wbPhotoUrl, ex = root.nrGoodsExtra ? root.nrGoodsExtra() : null;
            if (S.dailyCab !== cab() && root.nrGoodsEnsureDaily && cab()) { S.dailyCab = cab(); root.nrGoodsEnsureDaily(); }
            var all = [], t = { stock: 0, r: 0, o: 0, g: 0, b: 0, n: 0 };
            groups.forEach(function (g) {
                g.items.forEach(function (a) {
                    a.stock = a.fbo + a.fbs;
                    var perDay = S.sales ? (S.sales[a.nm] || 0) : null;
                    a.days = perDay ? a.stock / perDay : (perDay === 0 && a.stock > 0 ? 9999 : null);
                    a.c = S.sales ? cls(a.days, a.stock) : '';
                    a.perDay = perDay;
                    t.stock += a.stock; t.n++; if (a.c) t[a.c]++;
                    all.push(a);
                });
            });
            var f = S.filter, ready = S.sales != null;
            var sel = function (k) { return f === k ? ' on' : ''; };
            var html = '<div class="ggx-kp"><div class="ggx-k k1"><small>Всего на складах</small><b>' + fmt(t.stock) + ' шт</b></div>' +
                '<div class="ggx-k k2"><small>Артикулов</small><b>' + t.n + '</b></div>' +
                '<div class="ggx-k k3"><small>Заканчиваются (до 21 дн.)</small><b>' + (ready ? t.r + t.o : '…') + ' арт.</b></div>' +
                '<div class="ggx-k k4"><small>Срочно пополнить (до 7 дн.)</small><b>' + (ready ? t.r : '…') + ' арт.</b></div></div>' +
                '<div class="ggx-chips"><button type="button" class="ggx-chip' + sel('all') + '" data-f="all">Все<b>' + t.n + '</b></button>' +
                '<button type="button" class="ggx-chip r' + sel('r') + '" data-f="r">Мало<b>' + t.r + '</b></button>' +
                '<button type="button" class="ggx-chip o' + sel('o') + '" data-f="o">Заканчиваются<b>' + t.o + '</b></button>' +
                '<button type="button" class="ggx-chip g' + sel('g') + '" data-f="g">В норме<b>' + t.g + '</b></button>' +
                '<button type="button" class="ggx-chip b' + sel('b') + '" data-f="b">Много<b>' + t.b + '</b></button>' +
                '<span class="ggx-note">«Хватит на» — остаток ФБО+ФБС ÷ заказы в день за 14 дней</span></div>';
            html += '<div class="ggx-groups">';
            // Рисуем по 60 артикулов: сто с лишним карточек сразу тормозят телефон
            var shown = 0, hidden = 0;
            groups.forEach(function (g, gi) {
                var items = g.items.filter(function (a) { return f === 'all' || a.c === f; });
                if (!items.length) return;
                var room = Math.max(0, S.limit - shown);
                if (items.length > room) { hidden += items.length - room; items = items.slice(0, room); }
                shown += items.length;
                if (!items.length) return;
                var gs = g.items.reduce(function (s, a) { return s + a.stock; }, 0);
                html += '<div class="ggx-grp" style="background:' + PAL[gi % PAL.length] + '"><div class="ggx-gh"><div class="ggx-strip">' +
                    g.items.slice(0, 3).map(function (a) { return photo(a, ph, 34); }).join('') + '</div><div><h3>' + esc(g.name) + '</h3><small>' + g.items.length + ' арт. · ' + fmt(gs) + ' шт</small></div></div>' +
                    '<div class="ggx-row ggx-rh"><span></span><span>АРТИКУЛ</span><span>ФБО / ФБС</span><span class="n">В ПУТИ</span><span class="n">В ПЛАНЕ</span><span class="n">ИТОГО</span><span>ЗАПАС</span></div>' +
                    items.map(function (a) { return row(a, ph, ex); }).join('') + '</div>';
            });
            html += '</div>';
            if (hidden) html += '<button type="button" class="ggx-more" data-more="1">Показать ещё ' + Math.min(60, hidden) + ' · осталось ' + hidden + '</button>';
            var box = doc.getElementById('ggx-cards');
            if (!box) {
                box = doc.createElement('div'); box.id = 'ggx-cards';
                host.parentNode.insertBefore(box, host);
                box.addEventListener('click', onClick);
                box.addEventListener('change', onChange);
            }
            // не перерисовываем под руками у пользователя, пока он вводит число
            var act = doc.activeElement;
            if (!(act && box.contains(act) && act.tagName === 'INPUT')) box.innerHTML = html;
            doc.body.classList.add('ggx-on');
        } catch (e) { doc.body.classList.remove('ggx-on'); }
        S.busy = false;
        observe();
    }

    function photo(a, ph, size) {
        var u = ph && a.nm ? ph(a.nm, 'c246x328') : '';
        var ini = esc((a.name || '?').trim().charAt(0).toUpperCase());
        return '<span class="ggx-ph" style="width:' + size + 'px;height:' + Math.round(size * 1.25) + 'px"><i>' + ini + '</i>' + (u ? '<img src="' + esc(u) + '" alt="" loading="lazy" onerror="this.remove()">' : '') + '</span>';
    }

    function covText(a, short) {
        if (!a.c) return '';
        if (a.stock <= 0) return short ? 'Нет' : 'Нет в наличии';
        var d = a.days > 365 ? '>1 года' : Math.round(a.days) + ' дн.';
        if (short) return d;
        return a.c === 'r' ? 'Мало · ' + d : a.c === 'b' ? 'Много · ' + d : 'Хватит на ' + d;
    }

    function edit(a, field, val, label) {
        return '<label class="ggx-ed" data-l="' + label + '"><input class="gg-edit-input' + (val ? '' : ' gg-zero') + '" type="text" inputmode="numeric" placeholder="0" data-nm="' + esc(a.nm) + '" data-cab="' + esc(a.cab) + '" data-field="' + field + '" value="' + (val ? String(val) : '') + '" onfocus="ggEditFocus(this)" oninput="ggEditInput(this)" onchange="ggEditCommit(this)" onkeydown="ggEditKey(event, this)"></label>';
    }

    // Себестоимость и остаток по дням на каждом артикуле (вместо отдельных вкладок)
    function sub(a, ex) {
        if (!ex) return '';
        var vals = ex.vals(a.nm), C = root.GoodsCatalog, svg = C && C.sparklineSvg ? C.sparklineSvg(vals, 150, 26) : '', last = [];
        for (var i = vals.length - 1; i >= 0 && last.length < 7; i--) if (vals[i] != null) last.unshift([ex.days[i], vals[i]]);
        var chips = last.map(function (x) { return '<span class="ggx-dc"><i>' + esc(C.dayLabel(x[0]).slice(0, 5)) + '</i>' + fmt(x[1]) + '</span>'; }).join('');
        return '<div class="ggx-sub"><label class="ggx-ed ggx-cost" data-l="Себестоимость, ₽"><input class="gg-edit-input' + (ex.cost(a.nm) ? '' : ' gg-zero') + '" type="text" inputmode="numeric" placeholder="0" data-nm="' + esc(a.nm) + '" data-cab="' + esc(a.cab || cab()) + '" data-field="cost" value="' + (ex.cost(a.nm) || '') + '" onfocus="ggEditFocus(this)" oninput="ggEditInput(this)" onchange="ggEditCommit(this)" onkeydown="ggEditKey(event, this)"></label>' +
            (last.length ? '<div class="ggx-dd" title="Остаток по дням"><span class="ggx-sp">' + svg + '</span><span class="ggx-dcs">' + chips + '</span></div>' : '<span class="ggx-dd ggx-mut">Остатки по дням: данные копятся</span>') + '</div>';
    }

    function row(a, ph, ex) {
        var tot = a.fbo + a.fbs || 1;
        return '<div class="ggx-row ggx-' + (a.c || 'n') + '" data-nm="' + esc(a.nm) + '">' + photo(a, ph, 38) +
            '<div class="ggx-nm"><b title="' + esc(a.name) + '">' + esc(a.name || '—') + '</b><small>WB ' + esc(a.nm) + '</small></div>' +
            '<div class="ggx-bar"><div class="ggx-bb"><i class="fbo" style="width:' + a.fbo / tot * 100 + '%"></i><i class="fbs" style="width:' + a.fbs / tot * 100 + '%"></i></div><small>ФБО ' + fmt(a.fbo) + ' · ФБС ' + fmt(a.fbs) + '</small></div>' +
            edit(a, 'transit', a.transit, 'В пути') + edit(a, 'plan', a.plan, 'В плане') +
            '<b class="ggx-tot">' + fmt(a.total || a.stock + a.transit + a.plan) + '</b>' +
            (a.c ? '<span class="ggx-cv ' + a.c + '" title="' + (a.perDay ? 'Продажи: ' + a.perDay.toFixed(1).replace('.', ',') + ' заказов в день' : 'Продаж за 14 дней нет') + '"><span class="l">' + esc(covText(a, false)) + '</span><span class="s">' + esc(covText(a, true)) + '</span></span>' : '<span></span>') + sub(a, ex) + '</div>';
    }

    function onClick(e) {
        var more = e.target.closest('[data-more]');
        if (more) { S.limit += 60; render(); return; }
        var b = e.target.closest('[data-f]'); if (!b) return;
        S.filter = b.getAttribute('data-f'); S.limit = 60; render();
    }
    function onChange(e) {
        var i = e.target.closest('input[data-field]'); if (!i) return;
        var r = i.closest('.ggx-row'), tot = r && r.querySelector('.ggx-tot');
        if (!tot) return;
        var vals = {}; Array.prototype.forEach.call(r.querySelectorAll('input[data-field]'), function (x) { if (x.getAttribute('data-field') !== 'cost') vals[x.getAttribute('data-field')] = num(x.value); });
        var sub = r.querySelector('.ggx-bar small'), m = sub && sub.textContent.match(/ФБО\s*([\d\s]+)\s*·\s*ФБС\s*([\d\s]+)/);
        var stock = m ? num(m[1]) + num(m[2]) : 0;
        tot.textContent = fmt(stock + (vals.transit || 0) + (vals.plan || 0));
    }

    var timer = 0;
    function schedule() { clearTimeout(timer); timer = setTimeout(function () { loadSales(); render(); }, 150); }
    function observe() {
        var body = doc.getElementById('gg-table-body');
        if (!body) return;
        if (!S.mo) S.mo = new MutationObserver(schedule);
        S.mo.observe(body, { childList: true, subtree: true, characterData: true });
        var head = doc.getElementById('gg-table-head'); if (head) S.mo.observe(head, { childList: true, subtree: true });
    }
    function boot() {
        if (!doc.getElementById('gg-table-body')) { setTimeout(boot, 800); return; }
        observe(); schedule();
        // переключение вкладок внутри «Товаров» и разделов сайта
        doc.addEventListener('click', function () { setTimeout(schedule, 250); }, true);
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
    root.NrGoodsUi = { refresh: schedule };
})(typeof window !== 'undefined' ? window : globalThis);

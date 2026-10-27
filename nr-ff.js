/* Дашборд → блок «Фулфилмент»: сколько мы должны каждому ФФ за период.
   Выплатить = хранение + отправка (тарифы КАЖДОГО ФФ по периодам, «Логистика → FBS») − подмены МП − отмены.
   ФФ — это склады продавца (FBS) из WB, например «АМАН ФФ 3»: список берётся автоматически из остатков FBS.
   Если товар лежит на нескольких ФФ, его хранение и отправки делятся по доле остатка на каждом.
   Подмены (МП, не FBW) и отмены — штрафы WB по вине ФФ, которые ФФ нам возмещает (таблица ff_adjustments, вручную).
   Рядом — «Динамика заказов»: все заказы по дням и FBS-заказы выбранного ФФ. */
(function (root) {
    'use strict';
    // Единые окна вместо системных alert/confirm (nr-ui.js); без него работает как раньше.
    function ask(msg) { return root.NrUi ? root.NrUi.ask(msg) : Promise.resolve(root.confirm(msg)); }
    function say(msg) { if (root.NrUi) root.NrUi.alert(msg); else root.alert(msg); }
    var S = { db: null, cab: null, from: null, to: null, items: [], providers: [], shares: {}, byFf: {}, total: null, orders: [], daily: [], sel: 'all', readonly: false, changed: false };
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function fmt(n) { return Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/ /g, ' '); }
    function today() { return new Date(Date.now() + 6 * 3600 * 1000).toISOString().slice(0, 10); }
    function R() { return root.FbsRates; }
    function $(id) { return document.getElementById(id); }
    function selKey() { return 'ff_sel_' + S.cab; }

    function blank() { return { storage: 0, ship: 0, box: 0, boxMissing: 0, swap: 0, cancel: 0, missing: 0, payable: 0, shipRub: 0, storageRub: 0, boxRub: 0, shipCnt: 0, storageDays: 0, payableRub: 0, paidCnt: 0, paidTo: '' }; }
    // Чистый расчёт (для тестов). shares: { nm: [{k: 'АМАН ФФ 3', w: 0.7}] } — доли остатка FBS по ФФ; terms — строки ff_terms.
    // stock: { daily: {дата: {nm: шт}}, snapshot: {nm: шт} }.
    function compute(orders, adjustments, from, to, todayStr, shares, stock, terms, oidx, rates, boxes) {
        var T = root.FfTerms, idx = T.index(terms), end = to > todayStr ? todayStr : to;
        var by = {};
        function slot(k) { return by[k] || (by[k] = blank()); }
        // отправка: заказы FBS × цена отправки ФФ. Дни, по которым есть точные заказы WB с номером склада (fbs_orders),
        // считаем прямо по ним: ФФ выставляет счёт именно за эти заказы. Остальные дни — заказы товара × доли остатка по ФФ.
        var exact = oidx && oidx.days ? oidx.days : {};
        function addShip(ff, d, cnt) {
            var t = T.at(idx, ff, 'ship', d), sl = slot(ff);
            if (!t) { sl.missing += cnt; return; }
            sl.ship += cnt * Number(t.value) * T.fxFor(t, rates, d);
            sl.shipRub += cnt * Number(t.value);
            if (Number(t.value) > 0) sl.shipCnt += cnt;   // отправки считаем только там, где есть цена (с даты начала работы)
            else { sl.paidCnt += cnt; if (t.date_to && t.date_to > sl.paidTo) sl.paidTo = t.date_to; }   // цена 0 = уже оплачено ранее
        }
        (orders || []).forEach(function (o) {
            if (o.d > end || exact[o.d]) return;
            var nm = Number(o.nm_id), n = Number(o.orders_fbs) || 0;
            var sh = shares && shares[nm];
            if (!sh || !sh.length) { slot('none').missing += n; return; }
            sh.forEach(function (x) { if (x.k === 'none') slot('none').missing += n * x.w; else addShip(x.k, o.d, n * x.w); });
        });
        if (oidx && oidx.by) Object.keys(oidx.by).forEach(function (key) {
            var d = key.split('|')[1];
            if (d < from || d > end) return;
            var m = oidx.by[key];
            Object.keys(m).forEach(function (ff) { if (ff === 'none') slot('none').missing += m[ff]; else addShip(ff, d, m[ff]); });
        });
        // хранение: на каждый день остаток ФФ × ставка этого ФФ, не больше его суточного лимита
        var daysAll = {};
        for (var d = from; d <= end; d = T.addDays(d, 1)) {
            var day = (stock && stock.daily && stock.daily[d]) || (d === end && stock ? stock.snapshot : null) || {};
            var qty = {};
            Object.keys(day).forEach(function (nm) {
                var q = Number(day[nm]) || 0, sh = shares && shares[nm];
                if (q <= 0 || !sh) return;
                sh.forEach(function (x) { qty[x.k] = (qty[x.k] || 0) + q * x.w; });
            });
            Object.keys(qty).forEach(function (k) {
                var t = T.at(idx, k, 'storage', d);
                if (!t) return;
                // fixed: фиксированная сумма в сутки за склад (пока там есть остаток); unit: за штуку, не больше лимита в сутки
                var fixed = t.storage_mode === 'fixed', charge = fixed ? (qty[k] > 0 ? Number(t.value) : 0) : qty[k] * Number(t.value);
                if (!fixed && t.daily_cap != null && charge > Number(t.daily_cap)) charge = Number(t.daily_cap);
                slot(k).storage += charge * T.fxFor(t, rates, d);
                slot(k).storageRub += charge;
                if (charge > 0) { slot(k).storageDays++; daysAll[d] = 1; }
            });
        }
        // поставки: коробов × цена за короб ФФ на дату отправки
        (boxes || []).forEach(function (b) {
            var t = T.at(idx, b.ff, 'box', b.d), sl = slot(b.ff || 'none');
            if (t) { sl.box += b.boxes * Number(t.value) * T.fxFor(t, rates, b.d); sl.boxRub += b.boxes * Number(t.value); } else sl.boxMissing += b.boxes;
        });
        // До даты, по которую ФФ уже оплачен (цена отправки 0), штрафы и подмены тоже закрыты расчётом и в сумму не входят.
        var settledTo = {};
        (terms || []).forEach(function (x) { if (x.kind === 'ship' && Number(x.value) === 0 && x.date_to && (!settledTo[x.ff_name] || x.date_to > settledTo[x.ff_name])) settledTo[x.ff_name] = x.date_to; });
        (adjustments || []).forEach(function (a) {
            var ad = String(a.d || a.adj_date || '').slice(0, 10), fk = a.ff_name || 'none';
            if (ad && settledTo[fk] && ad <= settledTo[fk]) return;
            var t = slot(fk), v = Number(a.amount) || 0;
            if (a.kind === 'swap') t.swap += v; else t.cancel += v;
        });
        var total = blank();
        Object.keys(by).forEach(function (k) {
            var t = by[k]; t.payable = t.storage + t.ship + t.box - t.swap - t.cancel; t.payableRub = t.storageRub + t.shipRub + t.boxRub - t.swap - t.cancel;
            Object.keys(total).forEach(function (f) { if (f === 'paidTo') { if (t.paidTo > total.paidTo) total.paidTo = t.paidTo; } else total[f] += t[f]; });
        });
        total.storageDays = Object.keys(daysAll).length;   // дни, когда хранение шло хоть на одном ФФ
        total.byFf = by;
        return total;
    }

    // Депозит у ФФ: сумма на дату, минус отправки, хранение и короба после неё (₽); штрафы WB (подмены, отмены) по вине ФФ возвращаются на депозит.
    function depositLeft(amount, k) {
        k = k || {};
        var used = (k.shipRub || 0) + (k.storageRub || 0) + (k.boxRub || 0) - (k.swap || 0) - (k.cancel || 0);
        return { used: used, left: (Number(amount) || 0) - used };
    }
    // Списания с депозита за окно [as_of + 1 день; сегодня] по одному ФФ — тем же расчётом, что и карточка.
    async function depositCalc(db, cab, dep, shares, snapshot) {
        var T = T0(), from = T.addDays(dep.as_of, 1), end = today();
        if (from > end) return depositLeft(dep.amount, null);
        var res = await Promise.all([
            db.rpc('rnp_fbs_split', { p_cabinet: cab, p_from: from, p_to: end }),
            db.from('ff_adjustments').select('*').eq('cabinet_id', cab).gte('adj_date', from).lte('adj_date', end).range(0, 999),
            termsData(db, cab, from, end).catch(function () { return { terms: [], daily: {} }; }),
            fbsOrders(db, cab, T.addDays(from, -1), end),
            rubRates(db, from, end),
            db.rpc('dashboard_ff_penalties', { p_cabinet_id: cab, p_from: from, p_to: end }).then(function (r) { return r.error ? [] : (r.data || []); }, function () { return []; }),
        ]);
        if (res[0].error) throw res[0].error;
        var oidx = T.ordersIndex(res[3]), adj = (res[1].data || []).map(function (a) { return Object.assign({}, a, { ff_name: cn(a.ff_name) }); });
        (res[5] || []).forEach(function (p) {
            var amt = Number(p.amount) || 0, nm = Number(p.nm_id);
            var sh = T.distFor(oidx, nm, String(p.d || '').slice(0, 10)) || shares[nm];
            if (sh && sh.length) sh.forEach(function (x) { adj.push({ kind: p.kind, amount: amt * x.w, ff_name: x.k === 'none' ? null : x.k, d: String(p.d || '').slice(0, 10) }); });
        });
        var t = compute(res[0].data || [], adj, from, end, end, shares, { daily: res[2].daily, snapshot: snapshot }, res[2].terms, oidx, res[4], []);
        var k = (t.byFf || {})[dep.ff_name] || blank();
        var r = depositLeft(dep.amount, k);
        r.ship = k.shipRub; r.storage = k.storageRub; r.pen = k.swap + k.cancel;
        return r;
    }
    async function loadDeposits(db, cab, shares, snapshot) {
        S.deposits = [];
        try {
            var r = await db.from('ff_deposits').select('ff_name,amount,as_of,note').eq('cabinet_id', cab).order('as_of', { ascending: false }).range(0, 99);
            var seen = {};   // по каждому ФФ берём последний замер
            var list = ((r.data || [])).map(function (d) { return Object.assign({}, d, { ff_name: cn(d.ff_name) }); }).filter(function (d) { if (seen[d.ff_name]) return false; seen[d.ff_name] = 1; return true; });
            for (var i = 0; i < list.length; i++) {
                var d = list[i], c = await depositCalc(db, cab, d, shares, snapshot);
                S.deposits.push({ ff: d.ff_name, amount: Number(d.amount) || 0, as_of: d.as_of, used: c.used, left: c.left, ship: c.ship || 0, storage: c.storage || 0, pen: c.pen || 0 });
            }
        } catch (e) { S.deposits = []; }
        renderSummary();
    }
    async function rubRates(db, from, to) {
        var out = {};
        try {
            var r = await db.from('exchange_rates').select('date,rate').eq('pair', 'RUB_KGS').lte('date', to).order('date', { ascending: false }).range(0, 120);
            (r.data || []).forEach(function (x) { out[x.date] = Number(x.rate); });
        } catch (e) { /* курсов нет — 1 */ }
        return out;
    }
    // Поставки периода с ФФ и коробами: одна запись на партию (короба берём один раз).
    async function shipmentBoxes(db, cab, from, to) {
        var by = {};
        try {
            var r = await db.from('goods_shipments').select('batch,ff_name,boxes,sent_date').eq('cabinet_id', cab).gte('sent_date', from).lte('sent_date', to).gt('boxes', 0).range(0, 4999);
            (r.data || []).forEach(function (x) {
                var k = (x.batch || '') + '|' + (cn(x.ff_name) || '');
                var cur = by[k];
                if (!cur) by[k] = { ff: cn(x.ff_name) || 'none', boxes: Number(x.boxes) || 0, d: x.sent_date, batch: x.batch || '' };
                else { cur.boxes = Math.max(cur.boxes, Number(x.boxes) || 0); if (x.sent_date < cur.d) cur.d = x.sent_date; }
            });
        } catch (e) { /* нет колонок — без поставок */ }
        return Object.keys(by).map(function (k) { return by[k]; });
    }
    function T0() { return root.FfTerms; }
    // Объединённые ФФ (ff_groups): склад → общее имя ФФ. Всё считается под общим именем.
    var CANON = {};
    function cn(name) { return name ? (CANON[name] || name) : name; }
    async function loadGroups(db, cab) {
        CANON = {};
        try {
            var r = await db.from('ff_groups').select('ff_name,group_name').eq('cabinet_id', cab).range(0, 199);
            (r.data || []).forEach(function (g) { if (g.ff_name && g.group_name) CANON[g.ff_name] = g.group_name; });
        } catch (e) { CANON = {}; }
    }
    async function fbsOrders(db, cab, from, to) {
        var out = [];
        try {
            for (var f = 0; ; f += 1000) {
                var r = await db.from('fbs_orders').select('nm_id,order_date,ff_name').eq('cabinet_id', cab).gte('order_date', from).lte('order_date', to).range(f, f + 999);
                if (r.error) break;
                out = out.concat((r.data || []).map(function (x) { return Object.assign({}, x, { ff_name: cn(x.ff_name) }); }));
                if (!r.data || r.data.length < 1000) break;
            }
        } catch (e) { /* таблицы нет — работаем по остаткам */ }
        return out;
    }

    function cur() { return S.sel === 'all' ? S.total : (S.byFf[S.sel] || blank()); }
    function ffName(id) { return id && id !== 'none' ? id : 'Без ФФ'; }

    function renderSummary() {
        var el = $('ff-sum');
        if (!el) return;
        var t = S.total || blank();
        var sum = hasDepAll() ? Math.abs(t.payableRub) : t.payableRub;
        el.setAttribute('data-ff', 'open'); el.setAttribute('role', 'button'); el.setAttribute('tabindex', '0');
        el.innerHTML =
            '<div class="pnl-title">Фулфилмент</div>' +
            '<div class="pnl-big ff-pay">' + fmt(sum) + ' ₽</div>' +
            (S.rate > 0 ? '<div class="ff-som" title="По актуальному курсу НБКР: 1 ₽ = ' + S.rate.toFixed(4).replace(/0+$/, '').replace('.', ',') + ' сом">К выплате · ≈ ' + fmt(sum * S.rate) + ' сом</div>' : '') +
            ((t.missing || t.boxMissing) ? '<div class="ff-warn">Нет цены у ' + fmt((t.missing || 0) + (t.boxMissing || 0)) + ' заказов или коробов: укажите в «Логистика → FBS»</div>' : '');
        if ($('ffm-ov')) paintFfModal();
    }
    function hasDepAll() { return (S.deposits || []).length > 0 && S.sel !== 'all' ? hasDep() : false; }

    // ─── окно «Фулфилмент»: сумма, склады, график заказов ───
    function smoothPath(pts) {
        var d = 'M' + pts[0][0].toFixed(1) + ',' + pts[0][1].toFixed(1);
        for (var i = 1; i < pts.length; i++) {
            var x0 = pts[i - 1][0], y0 = pts[i - 1][1], x1 = pts[i][0], y1 = pts[i][1], cx = (x0 + x1) / 2;
            d += ' C' + cx.toFixed(1) + ',' + y0.toFixed(1) + ' ' + cx.toFixed(1) + ',' + y1.toFixed(1) + ' ' + x1.toFixed(1) + ',' + y1.toFixed(1);
        }
        return d;
    }
    function ordersChartHtml() {
        var fbs = {};
        (S.orders || []).forEach(function (o) { fbs[o.d] = (fbs[o.d] || 0) + (Number(o.orders_fbs) || 0); });
        var days = (S.daily || []).map(function (d) { return { d: String(d.date).slice(0, 10), all: Number(d.count) || 0 }; });
        if (days.length < 2) return '<div class="ffm-empty">Нет заказов за период</div>';
        var max = Math.max.apply(null, days.map(function (x) { return Math.max(x.all, fbs[x.d] || 0); }).concat([1]));
        var W = 440, H = 140, n = days.length;
        var X = function (i) { return i / (n - 1) * W; }, Y = function (v) { return H - 6 - v / max * (H - 18); };
        var A = days.map(function (x, i) { return [X(i), Y(x.all)]; }), B = days.map(function (x, i) { return [X(i), Y(Math.min(fbs[x.d] || 0, x.all))]; });
        var mark = A.reduce(function (m, p, i) { return p[1] < A[m][1] ? i : m; }, 0), sel = A[mark];
        var lab = function (i) { return R().fmtD(days[i].d).slice(0, 5); };
        var totAll = days.reduce(function (s, x) { return s + x.all; }, 0), totF = Object.keys(fbs).reduce(function (s, k) { return s + fbs[k]; }, 0);
        return '<svg class="ffm-ch" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">' +
            '<defs><linearGradient id="ffmg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".13"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>' +
            '<path d="' + smoothPath(A) + ' L' + W + ',' + H + ' L0,' + H + 'Z" fill="url(#ffmg)"/>' +
            '<path d="' + smoothPath(A) + '" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" vector-effect="non-scaling-stroke"/>' +
            '<path d="' + smoothPath(B) + '" fill="none" class="ffm-fbs" stroke-width="2.4" stroke-dasharray="5 5" stroke-linecap="round" vector-effect="non-scaling-stroke"/>' +
            '<line x1="' + sel[0].toFixed(1) + '" y1="' + sel[1].toFixed(1) + '" x2="' + sel[0].toFixed(1) + '" y2="' + H + '" stroke="currentColor" stroke-width="1.2" vector-effect="non-scaling-stroke"/>' +
            '<circle cx="' + sel[0].toFixed(1) + '" cy="' + sel[1].toFixed(1) + '" r="4.5" class="ffm-dot" stroke="currentColor" stroke-width="2.4" vector-effect="non-scaling-stroke"/></svg>' +
            '<div class="ffm-ax"><span>' + lab(0) + '</span><span class="on">' + lab(mark) + '</span><span>' + lab(n - 1) + '</span></div>' +
            '<div class="ffm-leg"><span>Все заказы ' + fmt(totAll) + '</span><span class="f">Заказы с FBS-склада ' + fmt(totF) + '</span></div>';
    }
    function ffModalHtml() {
        var t = S.total || blank(), rate = S.rate > 0 ? S.rate : 0;
        var ids = (S.providers || []).map(function (p) { return p.id; }); if (S.byFf.none) ids.push('none');
        var rows = ids.map(function (id) {
            var x = S.byFf[id]; if (!x) return '';
            return '<tr><td>' + esc(ffName(id)) + '</td><td>' + fmt(x.shipCnt) + '</td><td>' + fmt(x.storageRub) + ' ₽</td><td>' + fmt(x.payableRub) + ' ₽</td></tr>';
        }).join('');
        var pen = (t.swap || 0) + (t.cancel || 0);
        return '<div class="ffm-h"><div><div class="ffm-k">Фулфилмент</div><h2>К выплате ' + fmt(t.payableRub) + ' ₽' + (rate ? ' <small>≈ ' + fmt(t.payableRub * rate) + ' сом</small>' : '') + '</h2></div>' +
            '<button type="button" class="ffm-x" data-ff="ffclose" aria-label="Закрыть">✕</button></div>' +
            '<div class="ffm-top"><div><div class="ffm-k">Отправки</div><b>' + fmt(t.shipCnt) + ' шт</b></div><div><div class="ffm-k">Хранение</div><b>' + fmt(t.storageDays) + ' дн</b></div>' +
            '<div class="ffm-tile" data-ff="adj" data-kind="swap" role="button" tabindex="0"><div class="ffm-k">Подмены и отмены</div><b>' + fmt(pen) + ' ₽</b></div></div>' +
            '<div class="ffm-row"><div><div class="ffm-k">По складам</div><table class="ffm-tbl"><thead><tr><th>Склад</th><th>Отправки</th><th>Хранение</th><th>Выплатить</th></tr></thead><tbody>' + rows +
            '<tr class="t"><td>Итого</td><td>' + fmt(t.shipCnt) + '</td><td>' + fmt(t.storageRub) + ' ₽</td><td>' + fmt(t.payableRub) + ' ₽</td></tr></tbody></table>' + depositHtml() +
            (t.missing ? '<div class="ff-warn">Нет цены отправки у ' + fmt(t.missing) + ' заказов: укажите цену ФФ в «Логистика → FBS»</div>' : '') + '</div>' +
            '<div><div class="ffm-k">Заказы по дням</div>' + ordersChartHtml() + '</div></div>';
    }
    function paintFfModal() { var m = document.querySelector('#ffm-ov .ffm'); if (m) m.innerHTML = ffModalHtml(); }
    function openFf() {
        if ($('ffm-ov')) return;
        var ov = document.createElement('div'); ov.className = 'ffm-ov'; ov.id = 'ffm-ov';
        ov.innerHTML = '<div class="ffm" role="dialog" aria-modal="true">' + ffModalHtml() + '</div>';
        document.body.appendChild(ov);
        ov.addEventListener('click', function (e) { if (e.target === ov) closeFf(); });
        document.addEventListener('keydown', onFfKey);
    }
    function closeFf() { var ov = $('ffm-ov'); if (ov) ov.remove(); document.removeEventListener('keydown', onFfKey); }
    function onFfKey(e) { if (e.key === 'Escape') closeFf(); }

    function hasDep() { return S.sel !== 'all' && (S.deposits || []).some(function (d) { return d.ff === S.sel; }); }
    // Депозит у ФФ: сколько лежало на дату и сколько осталось после списаний.
    function depositHtml() {
        var list = (S.deposits || []).filter(function (d) { return S.sel === 'all' || d.ff === S.sel; });
        function dm(x) { return x.slice(8) + '.' + x.slice(5, 7); }
        return list.map(function (d) {
            var cls = d.left < 0 ? ' neg' : (d.left < d.amount * 0.2 ? ' low' : '');
            var som = S.rate > 0 ? ' <span class="ff-dep-som">≈ ' + fmt(d.left * S.rate) + ' сом</span>' : '';
            return '<div class="ff-dep' + cls + '" title="Списано с ' + dm(T0().addDays(d.as_of, 1)) + ': отправки ' + fmt(d.ship) + ' ₽, хранение ' + fmt(d.storage) + ' ₽; штрафы ФФ вернулись на депозит: ' + fmt(d.pen) + ' ₽">' +
                '<div class="ff-dep-l">Депозит ' + esc(d.ff) + ' · на ' + dm(d.as_of) + ' — ' + fmt(d.amount) + ' ₽</div>' +
                '<div class="ff-dep-v">Остаток ' + fmt(d.left) + ' ₽' + som + '</div></div>';
        }).join('');
    }

    // «Динамика заказов»: столбик — все заказы дня, синяя часть — FBS-заказы выбранного ФФ.
    function renderChart() {
        var el = $('ff-chart');
        if (!el) return;
        var fbs = {};
        S.orders.forEach(function (o) {
            var w = 1;
            if (S.sel !== 'all') {
                var sh = S.shares[Number(o.nm_id)];
                w = sh ? (sh.filter(function (x) { return x.k === S.sel; })[0] || { w: 0 }).w : (S.sel === 'none' ? 1 : 0);
            }
            fbs[o.d] = (fbs[o.d] || 0) + (Number(o.orders_fbs) || 0) * w;
        });
        var days = (S.daily || []).map(function (d) { return { d: String(d.date).slice(0, 10), all: Number(d.count) || 0 }; });
        var max = Math.max.apply(null, days.map(function (x) { return Math.max(x.all, fbs[x.d] || 0); }).concat([1]));
        var W = 100, H = 100, n = days.length || 1, bw = W / n;
        var bars = days.map(function (x, i) {
            var f = fbs[x.d] || 0, ha = x.all / max * H, hf = Math.min(f, x.all) / max * H, xx = i * bw + bw * 0.14, w = bw * 0.72;
            return '<g><title>' + esc(R().fmtD(x.d)) + ': заказов ' + fmt(x.all) + ', из них FBS ' + fmt(f) + '</title>' +
                '<rect x="' + xx.toFixed(2) + '" y="' + (H - ha).toFixed(2) + '" width="' + w.toFixed(2) + '" height="' + ha.toFixed(2) + '" rx="0.6" fill="#fdba74"/>' +
                '<rect x="' + xx.toFixed(2) + '" y="' + (H - hf).toFixed(2) + '" width="' + w.toFixed(2) + '" height="' + hf.toFixed(2) + '" rx="0.6" fill="#3b82f6"/></g>';
        }).join('');
        var first = days[0] ? R().fmtD(days[0].d).slice(0, 5) : '', last = days.length ? R().fmtD(days[days.length - 1].d).slice(0, 5) : '';
        var totAll = days.reduce(function (s, x) { return s + x.all; }, 0), totF = Object.keys(fbs).reduce(function (s, k) { return s + fbs[k]; }, 0);
        el.innerHTML = '<div class="pnl-title">Динамика заказов <span class="ff-hint">' + (S.sel === 'all' ? 'все ФФ' : esc(ffName(S.sel))) + '</span></div>' +
            '<div class="ff-leg"><i style="background:#fdba74"></i>Все заказы ' + fmt(totAll) + '<i style="background:#3b82f6"></i>FBS ' + fmt(totF) + '</div>' +
            '<svg class="ff-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' + bars + '</svg>' +
            '<div class="ff-ax"><span>' + first + '</span><span>' + last + '</span></div>';
    }

    // ─── окно подмен/отмен выбранного ФФ ───
    function modalHtml(kind) {
        var provs = S.providers;
        var defFf = S.sel !== 'all' && S.sel !== 'none' ? S.sel : (provs[0] && provs[0].id) || '';
        var rows = S.items.filter(function (a) { return S.sel === 'all' || (a.ff_name || 'none') === S.sel; }).map(function (a) {
            return '<div class="ff-it"><span class="ff-d">' + esc(R().fmtD(a.adj_date)) + '</span><span class="ff-k ' + a.kind + '">' + (a.kind === 'swap' ? 'Подмена' : 'Отмена') + '</span>' +
                '<b>' + fmt(a.amount) + '</b><span class="ff-n">' + (S.sel === 'all' ? '<em>' + esc(ffName(a.ff_name)) + '</em> ' : '') + esc(a.note) + '</span>' +
                (S.readonly ? '' : '<button type="button" class="ff-x" data-ff="del" data-id="' + esc(a.id) + '" title="Удалить">×</button>') + '</div>';
        }).join('');
        var form = S.readonly ? '' :
            '<div class="ff-form"><select id="ff-kind"><option value="swap"' + (kind === 'swap' ? ' selected' : '') + '>Подмена</option><option value="cancel"' + (kind === 'cancel' ? ' selected' : '') + '>Отмена</option></select>' +
            '<select id="ff-who">' + provs.map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === defFf ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('') + '<option value="">Без ФФ</option></select>' +
            '<input type="date" id="ff-date" value="' + today() + '"><input type="text" inputmode="decimal" id="ff-amt" placeholder="Сумма штрафа, ₽">' +
            '<input type="text" id="ff-note" placeholder="Артикул / заказ"><button type="button" class="nx-go ff-add" data-ff="add">Добавить</button></div>';
        var au = S.auto || { swap: 0, cancel: 0, swapN: 0, cancelN: 0 };
        var autoBox = '<div class="ff-auto"><b>Из отчёта WB подтягивается само</b><span>Подмены МП: ' + fmt(au.swap) + ' ₽ (' + au.swapN + ' шт)</span><span>Отмены продавцом: ' + fmt(au.cancel) + ' ₽ (' + au.cancelN + ' шт)</span><small>Вручную добавляйте только то, чего нет в отчёте. «Подмена товара (с фото)» — FBW — сюда не входит.</small></div>';
        return '<h3>Подмены и отмены</h3><p class="nx-sm">Штрафы WB по вине ФФ (подмены МП, отмены) — ФФ их возмещает. ' + esc(R().fmtD(S.from)) + ' — ' + esc(R().fmtD(S.to)) + '</p>' + autoBox + form +
            '<div class="ff-list">' + (rows || '<div class="ff-empty">За выбранный период записей нет.</div>') + '</div>' +
            '<div class="fbr-btns"><button type="button" class="nx-b" data-ff="close">Закрыть</button></div>';
    }
    function openAdj(kind) {
        var ov = document.createElement('div');
        ov.className = 'nx-ov'; ov.id = 'ff-ov';
        ov.innerHTML = '<div class="nx-modal fbr-modal ff-modal">' + modalHtml(kind) + '</div>';
        document.body.appendChild(ov);
        ov.addEventListener('click', function (e) { if (e.target === ov) closeAdj(); });
    }
    function closeAdj() {
        var ov = $('ff-ov'); if (ov) ov.remove();
        if (S.changed) { S.changed = false; if (typeof root.loadFromDB === 'function') root.loadFromDB(); }
    }
    async function refresh() { await update(S.db, S.cab, S.from, S.to, S.daily); var ov = $('ff-ov'); if (ov) { var kind = ($('ff-kind') || {}).value; ov.firstChild.innerHTML = modalHtml(kind); } }

    async function fbsStocks(db, cab) {
        var out = [];
        for (var from = 0; ; from += 1000) {
            var r = await db.from('wb_stocks').select('nm_id,quantity,warehouse_name').eq('cabinet_id', cab).eq('stock_scheme', 'fbs').range(from, from + 999);
            if (r.error) throw r.error;
            out = out.concat((r.data || []).map(function (x) { return Object.assign({}, x, { warehouse_name: cn(x.warehouse_name) }); }));
            if (!r.data || r.data.length < 1000) break;
        }
        return out;
    }

    // Тарифы ФФ (ff_terms) и остатки FBS по дням (goods_daily_stocks) — остатки только если у кого-то есть хранение в периоде.
    async function termsData(db, cab, from, end) {
        var tr = await db.from('ff_terms').select('ff_name,kind,value,daily_cap,fx_rate,storage_mode,date_from,date_to').eq('cabinet_id', cab).order('date_from', { ascending: true }).range(0, 999);
        var terms = tr.error ? [] : T0().dedupe((tr.data || []).map(function (t) { return Object.assign({}, t, { ff_name: cn(t.ff_name) }); }));
        var needDaily = terms.some(function (t) { return t.kind === 'storage' && t.date_from <= end && (!t.date_to || t.date_to >= from); });
        var daily = {};
        if (needDaily) for (var f = 0; ; f += 1000) {
            var r = await db.from('goods_daily_stocks').select('nm_id,date,fbs').eq('cabinet_id', cab).gte('date', from).lte('date', end).range(f, f + 999);
            if (r.error) break;
            (r.data || []).forEach(function (x) { (daily[x.date] = daily[x.date] || {})[Number(x.nm_id)] = Number(x.fbs) || 0; });
            if (!r.data || r.data.length < 1000) break;
        }
        return { terms: terms, daily: daily };
    }

    async function update(db, cab, from, to, dailyOrders) {
        S.db = db; S.cab = cab; S.from = from; S.to = to; S.daily = dailyOrders || S.daily || [];
        S.readonly = !!document.getElementById('nr-viewer-banner');
        S.sel = 'all';
        var end = to > today() ? today() : to;
        await loadGroups(db, cab);
        var res = await Promise.all([
            end >= from ? db.rpc('rnp_fbs_split', { p_cabinet: cab, p_from: from, p_to: end }) : Promise.resolve({ data: [] }),
            db.from('ff_adjustments').select('*').eq('cabinet_id', cab).gte('adj_date', from).lte('adj_date', to).order('adj_date', { ascending: false }).range(0, 999),
            fbsStocks(db, cab),
            termsData(db, cab, from, end).catch(function () { return { terms: [], daily: {} }; }),
            fbsOrders(db, cab, T0().addDays(from, -1), end),
            rubRates(db, from, end),
            shipmentBoxes(db, cab, from, to),
            db.rpc('dashboard_ff_penalties', { p_cabinet_id: cab, p_from: from, p_to: to }).then(function (r) { return r.error ? [] : (r.data || []); }, function () { return []; }),
        ]);
        if (res[0].error) throw res[0].error;
        S.orders = res[0].data || [];
        S.items = (res[1].data || []).map(function (a) { return Object.assign({}, a, { ff_name: cn(a.ff_name) }); });
        // ФФ = склады FBS; доля товара на каждом — по остатку
        var per = {}, wh = {}, snapshot = {};
        res[2].forEach(function (r) {
            var nm = Number(r.nm_id), q = Number(r.quantity) || 0;
            if (!nm || q <= 0 || !r.warehouse_name) return;
            (per[nm] = per[nm] || {})[r.warehouse_name] = ((per[nm] || {})[r.warehouse_name] || 0) + q;
            wh[r.warehouse_name] = (wh[r.warehouse_name] || 0) + q;
            snapshot[nm] = (snapshot[nm] || 0) + q;
        });
        S.shares = {};
        Object.keys(per).forEach(function (nm) {
            var tot = Object.keys(per[nm]).reduce(function (a, k) { return a + per[nm][k]; }, 0);
            S.shares[nm] = Object.keys(per[nm]).map(function (k) { return { k: k, w: per[nm][k] / tot }; });
        });
        S.items.forEach(function (a) { if (a.ff_name && !(a.ff_name in wh)) wh[a.ff_name] = 0; });
        res[4].forEach(function (o) { if (o.ff_name && !(o.ff_name in wh)) wh[o.ff_name] = 0; });
        res[6].forEach(function (b) { if (b.ff && b.ff !== 'none' && !(b.ff in wh)) wh[b.ff] = 0; });
        S.providers = Object.keys(wh).sort(function (a, b) { return wh[b] - wh[a] || (a < b ? -1 : 1); }).map(function (k) { return { id: k, name: k }; });
        // Штрафы WB «подмена МП» и «отмена продавцом» берём из финотчёта автоматически и делим по ФФ товара; ручные записи — сверху.
        S.auto = { swap: 0, cancel: 0, swapN: 0, cancelN: 0 };
        var oidx = T0().ordersIndex(res[4]), autoAdj = [];
        (res[7] || []).forEach(function (p) {
            var amt = Number(p.amount) || 0, n = Number(p.cnt) || 0, nm = Number(p.nm_id);
            S.auto[p.kind] += amt; S.auto[p.kind + 'N'] += n;
            // ФФ штрафа — по заказам этого товара в день (WB), иначе по остатку, иначе «Без ФФ»
            var sh = T0().distFor(oidx, nm, String(p.d || '').slice(0, 10)) || S.shares[nm];
            if (sh && sh.length) sh.forEach(function (x) { autoAdj.push({ kind: p.kind, amount: amt * x.w, ff_name: x.k === 'none' ? null : x.k, d: String(p.d || '').slice(0, 10) }); });
            else autoAdj.push({ kind: p.kind, amount: amt, ff_name: null, d: String(p.d || '').slice(0, 10) });
        });
        var t = compute(S.orders, autoAdj.concat(S.items), from, to, today(), S.shares, { daily: res[3].daily, snapshot: snapshot }, res[3].terms, oidx, res[5], res[6]);
        S.total = t; S.byFf = t.byFf || {};
        S.rate = (function (rs) { var best = null; Object.keys(rs || {}).forEach(function (k) { if (k <= today() && (best === null || k > best)) best = k; }); return best ? Number(rs[best]) : 0; })(res[5]);
        if (S.sel !== 'all' && S.sel !== 'none' && !(S.sel in wh)) S.sel = 'all';
        renderSummary(); renderChart();
        loadDeposits(db, cab, S.shares, snapshot);
        return t;
    }

    function bind() {
        document.addEventListener('click', async function (e) {
            var b = e.target.closest('[data-ff]');
            if (!b || !S.db) return;
            var a = b.dataset.ff;
            if (a === 'sel') { S.sel = b.dataset.id; try { localStorage.setItem(selKey(), S.sel); } catch (x) {} renderSummary(); renderChart(); return; }
            if (a === 'open') { openFf(); return; }
            if (a === 'ffclose') { closeFf(); return; }
            if (a === 'adj') { openAdj(b.dataset.kind); return; }
            if (a === 'close') { closeAdj(); return; }
            try {
                if (a === 'add') {
                    var amt = parseFloat(String($('ff-amt').value).replace(/\s/g, '').replace(',', '.'));
                    if (!(amt > 0)) { $('ff-amt').style.outline = '2px solid #ef4444'; return; }
                    var r = await S.db.from('ff_adjustments').insert({ cabinet_id: S.cab, ff_name: $('ff-who').value || null, kind: $('ff-kind').value, amount: amt, adj_date: $('ff-date').value || today(), note: String($('ff-note').value || '').trim() });
                    if (r.error) throw r.error;
                    S.changed = true; await refresh();
                } else if (a === 'del') {
                    if (!(await ask('Удалить запись?'))) return;
                    var d = await S.db.from('ff_adjustments').delete().eq('id', b.dataset.id);
                    if (d.error) throw d.error;
                    S.changed = true; await refresh();
                }
            } catch (err) { say('Не удалось сохранить: ' + String((err && err.message) || err)); }
        });
    }
    if (typeof document !== 'undefined') bind();
    root.NrFF = { update: update, compute: compute, _S: S, render: renderSummary, openModal: openFf };
    if (typeof module !== 'undefined' && module.exports) module.exports = { compute: compute, depositLeft: depositLeft };
})(typeof window !== 'undefined' ? window : globalThis);

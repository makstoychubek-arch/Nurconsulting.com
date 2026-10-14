/* Дашборд → блок «Фулфилмент»: сколько мы должны каждому ФФ за период.
   Выплатить = хранение + отправка (тарифы КАЖДОГО ФФ по периодам, «Товары → FBS») − подмены МП − отмены.
   ФФ — это склады продавца (FBS) из WB, например «АМАН ФФ 3»: список берётся автоматически из остатков FBS.
   Если товар лежит на нескольких ФФ, его хранение и отправки делятся по доле остатка на каждом.
   Подмены (МП, не FBW) и отмены — штрафы WB по вине ФФ, которые ФФ нам возмещает (таблица ff_adjustments, вручную).
   Рядом — «Динамика заказов»: все заказы по дням и FBS-заказы выбранного ФФ. */
(function (root) {
    'use strict';
    var S = { db: null, cab: null, from: null, to: null, items: [], providers: [], shares: {}, byFf: {}, total: null, orders: [], daily: [], sel: 'all', readonly: false, changed: false };
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function fmt(n) { return Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/ /g, ' '); }
    function today() { return new Date(Date.now() + 6 * 3600 * 1000).toISOString().slice(0, 10); }
    function R() { return root.FbsRates; }
    function $(id) { return document.getElementById(id); }
    function selKey() { return 'ff_sel_' + S.cab; }

    function blank() { return { storage: 0, ship: 0, box: 0, boxMissing: 0, swap: 0, cancel: 0, missing: 0, payable: 0 }; }
    // Чистый расчёт (для тестов). shares: { nm: [{k: 'АМАН ФФ 3', w: 0.7}] } — доли остатка FBS по ФФ; terms — строки ff_terms.
    // stock: { daily: {дата: {nm: шт}}, snapshot: {nm: шт} }.
    function compute(orders, adjustments, from, to, todayStr, shares, stock, terms, oidx, rates, boxes) {
        var T = root.FfTerms, idx = T.index(terms), end = to > todayStr ? todayStr : to;
        var by = {};
        function slot(k) { return by[k] || (by[k] = blank()); }
        // отправка: заказы FBS товара × цена отправки его ФФ (по долям остатка)
        (orders || []).forEach(function (o) {
            if (o.d > end) return;
            var nm = Number(o.nm_id), n = Number(o.orders_fbs) || 0;
            // точный ФФ — из заказов WB (fbs_orders); если за день данных нет — по доле остатка
            var sh = (oidx && oidx.days[o.d] && T.distFor(oidx, nm, o.d)) || (shares && shares[nm]);
            if (!sh || !sh.length) { slot('none').missing += n; return; }
            sh.forEach(function (x) {
                var t = x.k === 'none' ? null : T.at(idx, x.k, 'ship', o.d);
                if (t) slot(x.k).ship += n * x.w * Number(t.value) * T.fxFor(t, rates, o.d); else slot(x.k).missing += n * x.w;
            });
        });
        // хранение: на каждый день остаток ФФ × ставка этого ФФ, не больше его суточного лимита
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
                var charge = qty[k] * Number(t.value);
                if (t.daily_cap != null && charge > Number(t.daily_cap)) charge = Number(t.daily_cap);
                slot(k).storage += charge * T.fxFor(t, rates, d);
            });
        }
        // поставки: коробов × цена за короб ФФ на дату отправки
        (boxes || []).forEach(function (b) {
            var t = T.at(idx, b.ff, 'box', b.d), sl = slot(b.ff || 'none');
            if (t) sl.box += b.boxes * Number(t.value) * T.fxFor(t, rates, b.d); else sl.boxMissing += b.boxes;
        });
        (adjustments || []).forEach(function (a) {
            var t = slot(a.ff_name || 'none'), v = Number(a.amount) || 0;
            if (a.kind === 'swap') t.swap += v; else t.cancel += v;
        });
        var total = blank();
        Object.keys(by).forEach(function (k) {
            var t = by[k]; t.payable = t.storage + t.ship + t.box - t.swap - t.cancel;
            Object.keys(total).forEach(function (f) { total[f] += t[f]; });
        });
        total.byFf = by;
        return total;
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
                var k = (x.batch || '') + '|' + (x.ff_name || '');
                var cur = by[k];
                if (!cur) by[k] = { ff: x.ff_name || 'none', boxes: Number(x.boxes) || 0, d: x.sent_date, batch: x.batch || '' };
                else { cur.boxes = Math.max(cur.boxes, Number(x.boxes) || 0); if (x.sent_date < cur.d) cur.d = x.sent_date; }
            });
        } catch (e) { /* нет колонок — без поставок */ }
        return Object.keys(by).map(function (k) { return by[k]; });
    }
    function T0() { return root.FfTerms; }
    async function fbsOrders(db, cab, from, to) {
        var out = [];
        try {
            for (var f = 0; ; f += 1000) {
                var r = await db.from('fbs_orders').select('nm_id,order_date,ff_name').eq('cabinet_id', cab).gte('order_date', from).lte('order_date', to).range(f, f + 999);
                if (r.error) break;
                out = out.concat(r.data || []);
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
        var t = cur() || blank();
        var chips = '<button type="button" class="ff-chip' + (S.sel === 'all' ? ' on' : '') + '" data-ff="sel" data-id="all">Все</button>' +
            S.providers.map(function (p) { return '<button type="button" class="ff-chip' + (S.sel === p.id ? ' on' : '') + '" data-ff="sel" data-id="' + esc(p.id) + '">' + esc(p.name) + '</button>'; }).join('') +
            (S.byFf.none ? '<button type="button" class="ff-chip' + (S.sel === 'none' ? ' on' : '') + '" data-ff="sel" data-id="none">Без ФФ</button>' : '');
        el.innerHTML =
            '<div class="pnl-title">Фулфилмент</div><div class="ff-chips">' + chips + '</div>' +
            '<div class="pnl-rows">' +
            '<div class="pnl-row ff-edit" data-ff="adj" data-kind="swap" title="Открыть список и добавить"><span class="pnl-lbl">Подмены</span><b>' + fmt(t.swap) + '</b></div>' +
            '<div class="pnl-row ff-edit" data-ff="adj" data-kind="cancel" title="Открыть список и добавить"><span class="pnl-lbl">Отмены</span><b>' + fmt(t.cancel) + '</b></div></div>' +
            '<div class="ff-pay-l">Выплатить</div><div class="pnl-big ff-pay">' + fmt(t.payable) + '</div>' +
            '<div class="ff-sub" title="Выплатить = хранение + отправка − подмены − отмены">хранение ' + fmt(t.storage) + ' + отправка ' + fmt(t.ship) + '</div>' +
            (t.missing ? '<div class="ff-warn">Нет цены отправки у ' + fmt(t.missing) + ' заказов — укажите цену ФФ в «Товары → FBS»</div>' : '') +
            (t.boxMissing ? '<div class="ff-warn">Нет цены за короб: ' + fmt(t.boxMissing) + ' коробов — укажите в «Товары → FBS»</div>' : '');
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
            out = out.concat(r.data || []);
            if (!r.data || r.data.length < 1000) break;
        }
        return out;
    }

    // Тарифы ФФ (ff_terms) и остатки FBS по дням (goods_daily_stocks) — остатки только если у кого-то есть хранение в периоде.
    async function termsData(db, cab, from, end) {
        var tr = await db.from('ff_terms').select('ff_name,kind,value,daily_cap,fx_rate,date_from,date_to').eq('cabinet_id', cab).order('date_from', { ascending: true }).range(0, 999);
        var terms = tr.error ? [] : (tr.data || []);
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
        try { var saved = localStorage.getItem(selKey()); if (saved && S.sel === 'all') S.sel = saved; } catch (e) {}
        var end = to > today() ? today() : to;
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
        S.items = res[1].data || [];
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
            if (sh && sh.length) sh.forEach(function (x) { autoAdj.push({ kind: p.kind, amount: amt * x.w, ff_name: x.k === 'none' ? null : x.k }); });
            else autoAdj.push({ kind: p.kind, amount: amt, ff_name: null });
        });
        var t = compute(S.orders, autoAdj.concat(S.items), from, to, today(), S.shares, { daily: res[3].daily, snapshot: snapshot }, res[3].terms, oidx, res[5], res[6]);
        S.total = t; S.byFf = t.byFf || {};
        if (S.sel !== 'all' && S.sel !== 'none' && !(S.sel in wh)) S.sel = 'all';
        renderSummary(); renderChart();
        return t;
    }

    function bind() {
        document.addEventListener('click', async function (e) {
            var b = e.target.closest('[data-ff]');
            if (!b || !S.db) return;
            var a = b.dataset.ff;
            if (a === 'sel') { S.sel = b.dataset.id; try { localStorage.setItem(selKey(), S.sel); } catch (x) {} renderSummary(); renderChart(); return; }
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
                    if (!root.confirm('Удалить запись?')) return;
                    var d = await S.db.from('ff_adjustments').delete().eq('id', b.dataset.id);
                    if (d.error) throw d.error;
                    S.changed = true; await refresh();
                }
            } catch (err) { root.alert('Не удалось сохранить: ' + String((err && err.message) || err)); }
        });
    }
    if (typeof document !== 'undefined') bind();
    root.NrFF = { update: update, compute: compute };
    if (typeof module !== 'undefined' && module.exports) module.exports = { compute: compute };
})(typeof window !== 'undefined' ? window : globalThis);

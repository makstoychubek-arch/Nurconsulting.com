/* Дашборд → блок «Фулфилмент»: сколько мы должны каждому ФФ за период.
   Выплатить = хранение + отправка (тарифы по периодам из «Товары → FBS») − подмены МП − отмены.
   ФФ в кабинете может быть несколько (до 10): товар привязан к ФФ в «Товары → FBS», блок переключается по ФФ.
   Подмены (МП, не FBW) и отмены — штрафы WB по вине ФФ, которые ФФ нам возмещает (таблица ff_adjustments, вручную).
   Рядом — «Динамика заказов»: все заказы по дням и FBS-заказы выбранного ФФ. */
(function (root) {
    'use strict';
    var S = { db: null, cab: null, from: null, to: null, items: [], providers: [], byFf: {}, total: null, orders: [], daily: [], sel: 'all', readonly: false, changed: false };
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function fmt(n) { return Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/ /g, ' '); }
    function today() { return new Date(Date.now() + 6 * 3600 * 1000).toISOString().slice(0, 10); }
    function R() { return root.FbsRates; }
    function $(id) { return document.getElementById(id); }
    function selKey() { return 'ff_sel_' + S.cab; }

    async function allArticles(db, cab) {
        var out = [];
        for (var from = 0; ; from += 1000) {
            var r = await db.from('rnp_articles').select('nm_id,manual_data').eq('cabinet_id', cab).range(from, from + 999);
            if (r.error) throw r.error;
            out = out.concat(r.data || []);
            if (!r.data || r.data.length < 1000) break;
        }
        return out;
    }

    function blank() { return { storage: 0, ship: 0, swap: 0, cancel: 0, missing: 0, payable: 0 }; }
    // Чистый расчёт (для тестов). Ключ ФФ: id из manual_data.ff_id (если такой ФФ есть в providerIds) или 'none'.
    function compute(articles, orders, adjustments, from, to, todayStr, providerIds) {
        var end = to > todayStr ? todayStr : to;
        var md = {}, key = {};
        function keyOf(id) { return id && (!providerIds || providerIds.indexOf(id) >= 0) ? id : 'none'; }
        (articles || []).forEach(function (a) { var m = a.manual_data || {}; md[Number(a.nm_id)] = m; key[Number(a.nm_id)] = keyOf(m.ff_id); });
        var by = {};
        function slot(k) { return by[k] || (by[k] = blank()); }
        if (end >= from) Object.keys(md).forEach(function (nm) { var v = R().sumDaily(md[nm], 'storage', from, end); if (v) slot(key[nm]).storage += v; });
        (orders || []).forEach(function (o) {
            if (o.d > end) return;
            var nm = Number(o.nm_id), rate = R().rateOn(md[nm] || {}, 'ship', o.d), n = Number(o.orders_fbs) || 0, t = slot(key[nm] || 'none');
            if (rate) t.ship += n * rate; else t.missing += n;
        });
        (adjustments || []).forEach(function (a) {
            var t = slot(keyOf(a.ff_id)), v = Number(a.amount) || 0;
            if (a.kind === 'swap') t.swap += v; else t.cancel += v;
        });
        var total = blank();
        Object.keys(by).forEach(function (k) {
            var t = by[k]; t.payable = t.storage + t.ship - t.swap - t.cancel;
            Object.keys(total).forEach(function (f) { total[f] += t[f]; });
        });
        total.byFf = by;
        return total;
    }

    function cur() { return S.sel === 'all' ? S.total : (S.byFf[S.sel] || blank()); }
    function ffName(id) { var p = S.providers.filter(function (x) { return x.id === id; })[0]; return p ? p.name : 'Без ФФ'; }

    function renderSummary() {
        var el = $('ff-sum');
        if (!el) return;
        var t = cur() || blank();
        var chips = '<button type="button" class="ff-chip' + (S.sel === 'all' ? ' on' : '') + '" data-ff="sel" data-id="all">Все</button>' +
            S.providers.map(function (p) { return '<button type="button" class="ff-chip' + (S.sel === p.id ? ' on' : '') + '" data-ff="sel" data-id="' + esc(p.id) + '">' + esc(p.name) + '</button>'; }).join('') +
            (S.byFf.none ? '<button type="button" class="ff-chip' + (S.sel === 'none' ? ' on' : '') + '" data-ff="sel" data-id="none">Без ФФ</button>' : '') +
            (S.readonly ? '' : '<button type="button" class="ff-chip ff-chip-add" data-ff="manage" title="Добавить или переименовать ФФ">＋</button>');
        el.innerHTML =
            '<div class="pnl-title">Фулфилмент</div><div class="ff-chips">' + chips + '</div>' +
            '<div class="pnl-rows">' +
            '<div class="pnl-row ff-edit" data-ff="adj" data-kind="swap" title="Открыть список и добавить"><span class="pnl-lbl">Подмены</span><b>' + fmt(t.swap) + '</b></div>' +
            '<div class="pnl-row ff-edit" data-ff="adj" data-kind="cancel" title="Открыть список и добавить"><span class="pnl-lbl">Отмены</span><b>' + fmt(t.cancel) + '</b></div></div>' +
            '<div class="ff-pay-l">Выплатить</div><div class="pnl-big ff-pay">' + fmt(t.payable) + '</div>' +
            '<div class="ff-sub" title="Выплатить = хранение + отправка − подмены − отмены">хранение ' + fmt(t.storage) + ' + отправка ' + fmt(t.ship) + '</div>' +
            (t.missing ? '<div class="ff-warn">Нет цены отправки у ' + fmt(t.missing) + ' заказов — укажите в «Товары → FBS»</div>' : '');
    }

    // «Динамика заказов»: столбик — все заказы дня, синяя часть — FBS-заказы выбранного ФФ.
    function renderChart() {
        var el = $('ff-chart');
        if (!el) return;
        var fbs = {}, nmKey = S.nmKey || {};
        S.orders.forEach(function (o) {
            if (S.sel !== 'all' && nmKey[Number(o.nm_id)] !== S.sel) return;
            fbs[o.d] = (fbs[o.d] || 0) + (Number(o.orders_fbs) || 0);
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
        var rows = S.items.filter(function (a) { return S.sel === 'all' || (a.ff_id || 'none') === S.sel; }).map(function (a) {
            return '<div class="ff-it"><span class="ff-d">' + esc(R().fmtD(a.adj_date)) + '</span><span class="ff-k ' + a.kind + '">' + (a.kind === 'swap' ? 'Подмена' : 'Отмена') + '</span>' +
                '<b>' + fmt(a.amount) + '</b><span class="ff-n">' + (S.sel === 'all' ? '<em>' + esc(ffName(a.ff_id)) + '</em> ' : '') + esc(a.note) + '</span>' +
                (S.readonly ? '' : '<button type="button" class="ff-x" data-ff="del" data-id="' + esc(a.id) + '" title="Удалить">×</button>') + '</div>';
        }).join('');
        var form = S.readonly ? '' :
            '<div class="ff-form"><select id="ff-kind"><option value="swap"' + (kind === 'swap' ? ' selected' : '') + '>Подмена</option><option value="cancel"' + (kind === 'cancel' ? ' selected' : '') + '>Отмена</option></select>' +
            '<select id="ff-who">' + provs.map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === defFf ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('') + '<option value="">Без ФФ</option></select>' +
            '<input type="date" id="ff-date" value="' + today() + '"><input type="text" inputmode="decimal" id="ff-amt" placeholder="Сумма штрафа, ₽">' +
            '<input type="text" id="ff-note" placeholder="Артикул / заказ"><button type="button" class="nx-go ff-add" data-ff="add">Добавить</button></div>';
        return '<h3>Подмены и отмены</h3><p class="nx-sm">Штрафы WB по вине ФФ (подмены МП, отмены) — ФФ их возмещает. ' + esc(R().fmtD(S.from)) + ' — ' + esc(R().fmtD(S.to)) + '</p>' + form +
            '<div class="ff-list">' + (rows || '<div class="ff-empty">За выбранный период записей нет.</div>') + '</div>' +
            '<div class="fbr-btns"><button type="button" class="nx-b" data-ff="close">Закрыть</button></div>';
    }
    function openAdj(kind) {
        if (!S.readonly && !S.providers.length) { manage(); return; }
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

    // Управление списком ФФ: добавить, переименовать, удалить.
    async function manage() {
        var P = root.FfProviders;
        var ov = document.createElement('div');
        ov.className = 'nx-ov'; ov.id = 'ff-mng';
        function draw() {
            ov.innerHTML = '<div class="nx-modal fbr-modal"><h3>Фулфилменты кабинета</h3><p class="nx-sm">До 10 ФФ. К каждому привязываются товары в «Товары → FBS».</p>' +
                '<div class="ff-list">' + (S.providers.map(function (p) {
                    return '<div class="ff-it"><span class="ff-n"><b>' + esc(p.name) + '</b></span><button type="button" class="nx-b" data-ff="ren" data-id="' + esc(p.id) + '">Переименовать</button><button type="button" class="ff-x" data-ff="rm" data-id="' + esc(p.id) + '" title="Удалить">×</button></div>';
                }).join('') || '<div class="ff-empty">Пока нет ни одного ФФ.</div>') + '</div>' +
                '<div class="fbr-btns"><button type="button" class="nx-go" data-ff="new"' + (S.providers.length >= 10 ? ' disabled' : '') + '>＋ Добавить ФФ</button><button type="button" class="nx-b" data-ff="mclose">Готово</button></div></div>';
        }
        draw();
        document.body.appendChild(ov);
        ov.addEventListener('click', async function (e) {
            var b = e.target.closest('[data-ff]');
            if (e.target === ov) { ov.remove(); return; }
            if (!b) return;
            try {
                if (b.dataset.ff === 'mclose') { ov.remove(); return; }
                if (b.dataset.ff === 'new') { var nm = await P.ask('Новый фулфилмент', ''); if (nm) { S.providers.push(await P.create(S.db, S.cab, nm)); } }
                if (b.dataset.ff === 'ren') { var p = S.providers.filter(function (x) { return x.id === b.dataset.id; })[0]; var v = await P.ask('Переименовать ФФ', p && p.name); if (v && p) { await P.rename(S.db, p.id, v); p.name = v; } }
                if (b.dataset.ff === 'rm') {
                    if (!root.confirm('Удалить этот ФФ? Товары останутся без ФФ, записи подмен/отмен — тоже.')) return;
                    await P.remove(S.db, b.dataset.id); S.providers = S.providers.filter(function (x) { return x.id !== b.dataset.id; }); if (S.sel === b.dataset.id) S.sel = 'all';
                }
                draw();
                S.changed = true;
                await update(S.db, S.cab, S.from, S.to, S.daily);
            } catch (err) { root.alert('Не удалось сохранить: ' + String((err && err.message) || err)); }
        });
    }

    async function update(db, cab, from, to, dailyOrders) {
        S.db = db; S.cab = cab; S.from = from; S.to = to; S.daily = dailyOrders || S.daily || [];
        S.readonly = !!document.getElementById('nr-viewer-banner');
        try { var saved = localStorage.getItem(selKey()); if (saved && S.sel === 'all') S.sel = saved; } catch (e) {}
        var end = to > today() ? today() : to;
        var res = await Promise.all([
            allArticles(db, cab),
            end >= from ? db.rpc('rnp_fbs_split', { p_cabinet: cab, p_from: from, p_to: end }) : Promise.resolve({ data: [] }),
            db.from('ff_adjustments').select('*').eq('cabinet_id', cab).gte('adj_date', from).lte('adj_date', to).order('adj_date', { ascending: false }).range(0, 999),
            root.FfProviders ? root.FfProviders.load(db, cab).catch(function () { return []; }) : Promise.resolve([]),
        ]);
        if (res[1].error) throw res[1].error;
        S.items = res[2].data || [];
        S.providers = res[3];
        S.orders = res[1].data || [];
        var ids = S.providers.map(function (p) { return p.id; });
        S.nmKey = {};
        res[0].forEach(function (a) { var id = (a.manual_data || {}).ff_id; S.nmKey[Number(a.nm_id)] = id && ids.indexOf(id) >= 0 ? id : 'none'; });
        var t = compute(res[0], S.orders, S.items, from, to, today(), ids);
        S.total = t; S.byFf = t.byFf || {};
        if (S.sel !== 'all' && S.sel !== 'none' && ids.indexOf(S.sel) < 0) S.sel = 'all';
        renderSummary(); renderChart();
        return t;
    }

    function bind() {
        document.addEventListener('click', async function (e) {
            var b = e.target.closest('[data-ff]');
            if (!b || !S.db) return;
            var a = b.dataset.ff;
            if (a === 'sel') { S.sel = b.dataset.id; try { localStorage.setItem(selKey(), S.sel); } catch (x) {} renderSummary(); renderChart(); return; }
            if (a === 'manage') { manage(); return; }
            if (a === 'adj') { openAdj(b.dataset.kind); return; }
            if (a === 'close') { closeAdj(); return; }
            try {
                if (a === 'add') {
                    var amt = parseFloat(String($('ff-amt').value).replace(/\s/g, '').replace(',', '.'));
                    if (!(amt > 0)) { $('ff-amt').style.outline = '2px solid #ef4444'; return; }
                    var r = await S.db.from('ff_adjustments').insert({ cabinet_id: S.cab, ff_id: $('ff-who').value || null, kind: $('ff-kind').value, amount: amt, adj_date: $('ff-date').value || today(), note: String($('ff-note').value || '').trim() });
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

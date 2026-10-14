/* Дашборд → блок «Фулфилмент»: сколько мы должны ФФ за период.
   Выплатить = хранение + отправка (тарифы по периодам из «Товары → FBS») − подмены МП − отмены.
   Подмены (МП, не FBW) и отмены — штрафы WB по вине ФФ, которые ФФ нам возмещает; вносятся вручную
   (таблица ff_adjustments) и считаются по выбранному на дашборде периоду. */
(function (root) {
    'use strict';
    var S = { db: null, cab: null, from: null, to: null, items: [], readonly: false };
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function fmt(n) { return Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/ /g, ' '); }
    function today() { return new Date(Date.now() + 6 * 3600 * 1000).toISOString().slice(0, 10); }
    function R() { return root.FbsRates; }
    function $(id) { return document.getElementById(id); }

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

    // Чистый расчёт (вынесен для тестов): articles — [{nm_id, manual_data}], orders — [{nm_id, d, orders_fbs}].
    function compute(articles, orders, adjustments, from, to, todayStr) {
        var end = to > todayStr ? todayStr : to;
        var md = {};
        (articles || []).forEach(function (a) { md[Number(a.nm_id)] = a.manual_data || {}; });
        var storage = 0, ship = 0, missing = 0;
        if (end >= from) Object.keys(md).forEach(function (nm) { storage += R().sumDaily(md[nm], 'storage', from, end); });
        (orders || []).forEach(function (o) {
            if (o.d > end) return;
            var rate = R().rateOn(md[Number(o.nm_id)] || {}, 'ship', o.d), n = Number(o.orders_fbs) || 0;
            if (rate) ship += n * rate; else missing += n;
        });
        var swap = 0, cancel = 0;
        (adjustments || []).forEach(function (a) { if (a.kind === 'swap') swap += Number(a.amount) || 0; else cancel += Number(a.amount) || 0; });
        return { storage: storage, ship: ship, swap: swap, cancel: cancel, missing: missing, payable: storage + ship - swap - cancel };
    }

    function renderSummary(t) {
        var el = $('ff-sum');
        if (!el) return;
        el.innerHTML =
            '<div class="pnl-title">Фулфилмент</div>' +
            '<div class="pnl-rows">' +
            '<div class="pnl-row"><span class="pnl-lbl">Подмены</span><b>' + fmt(t.swap) + '</b></div>' +
            '<div class="pnl-row"><span class="pnl-lbl">Отмены</span><b>' + fmt(t.cancel) + '</b></div></div>' +
            '<div class="ff-pay-l">Выплатить</div><div class="pnl-big ff-pay">' + fmt(t.payable) + '</div>' +
            '<div class="ff-sub" title="Выплатить = хранение + отправка − подмены − отмены">хранение ' + fmt(t.storage) + ' + отправка ' + fmt(t.ship) + '</div>' +
            (t.missing ? '<div class="ff-warn">Нет цены отправки у ' + fmt(t.missing) + ' заказов — укажите в «Товары → FBS»</div>' : '');
    }

    function renderLog() {
        var el = $('ff-log');
        if (!el) return;
        var form = S.readonly ? '' :
            '<div class="ff-form"><select id="ff-kind"><option value="swap">Подмена</option><option value="cancel">Отмена</option></select>' +
            '<input type="date" id="ff-date" value="' + today() + '"><input type="text" inputmode="decimal" id="ff-amt" placeholder="Сумма штрафа, ₽">' +
            '<input type="text" id="ff-note" placeholder="Артикул / заказ (по желанию)"><button type="button" class="nx-go ff-add" data-ff="add">Добавить</button></div>';
        var rows = S.items.map(function (a) {
            return '<div class="ff-it"><span class="ff-d">' + esc(R().fmtD(a.adj_date)) + '</span><span class="ff-k ' + a.kind + '">' + (a.kind === 'swap' ? 'Подмена' : 'Отмена') + '</span>' +
                '<b>' + fmt(a.amount) + '</b><span class="ff-n">' + esc(a.note) + '</span>' + (S.readonly ? '' : '<button type="button" class="ff-x" data-ff="del" data-id="' + esc(a.id) + '" title="Удалить">×</button>') + '</div>';
        }).join('');
        el.innerHTML = '<div class="pnl-title">Подмены и отмены за период <span class="ff-hint">штрафы WB по вине ФФ — они возмещают</span></div>' + form +
            '<div class="ff-list">' + (rows || '<div class="ff-empty">За выбранный период записей нет.</div>') + '</div>';
    }

    async function update(db, cab, from, to) {
        S.db = db; S.cab = cab; S.from = from; S.to = to;
        S.readonly = !!document.getElementById('nr-viewer-banner');
        var end = to > today() ? today() : to;
        var res = await Promise.all([
            allArticles(db, cab),
            end >= from ? db.rpc('rnp_fbs_split', { p_cabinet: cab, p_from: from, p_to: end }) : Promise.resolve({ data: [] }),
            db.from('ff_adjustments').select('*').eq('cabinet_id', cab).gte('adj_date', from).lte('adj_date', to).order('adj_date', { ascending: false }).range(0, 999),
        ]);
        if (res[1].error) throw res[1].error;
        S.items = res[2].data || [];
        var t = compute(res[0], res[1].data, S.items, from, to, today());
        if (cab === S.cab) { renderSummary(t); renderLog(); }
        return t;
    }

    function bind() {
        document.addEventListener('click', async function (e) {
            var b = e.target.closest('[data-ff]');
            if (!b || !S.db) return;
            try {
                if (b.dataset.ff === 'add') {
                    var amt = parseFloat(String($('ff-amt').value).replace(/\s/g, '').replace(',', '.'));
                    if (!(amt > 0)) { $('ff-amt').style.outline = '2px solid #ef4444'; return; }
                    var r = await S.db.from('ff_adjustments').insert({ cabinet_id: S.cab, kind: $('ff-kind').value, amount: amt, adj_date: $('ff-date').value || today(), note: String($('ff-note').value || '').trim() });
                    if (r.error) throw r.error;
                } else if (b.dataset.ff === 'del') {
                    if (!root.confirm('Удалить запись?')) return;
                    var d = await S.db.from('ff_adjustments').delete().eq('id', b.dataset.id);
                    if (d.error) throw d.error;
                }
                if (typeof root.loadFromDB === 'function') root.loadFromDB(); else update(S.db, S.cab, S.from, S.to);
            } catch (err) { root.alert('Не удалось сохранить: ' + String((err && err.message) || err)); }
        });
    }
    if (typeof document !== 'undefined') bind();
    root.NrFF = { update: update, compute: compute };
    if (typeof module !== 'undefined' && module.exports) module.exports = { compute: compute };
})(typeof window !== 'undefined' ? window : globalThis);

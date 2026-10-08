/**
 * Раздел «Товары → FBS»: товары, у которых есть остаток на складе продавца.
 * Цена за 1 отправку и хранение в день вносятся вручную (rnp_articles.manual_data:
 * fbs_ship_price, fbs_storage_day); автоматически ничего не считается.
 */
(function (root) {
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
    }
    function num(v) {
        var n = parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.'));
        return isNaN(n) ? 0 : n;
    }
    function fmt(n) {
        return Number(n || 0).toLocaleString('ru', { maximumFractionDigits: 2 });
    }

    var state = { supabase: null, cabinetId: null, rows: [], host: null };

    async function fetchAll(table, cabinetId, cols, extra) {
        var out = [];
        for (var from = 0; ; from += 1000) {
            var q = state.supabase.from(table).select(cols).eq('cabinet_id', cabinetId);
            if (extra) q = extra(q);
            var res = await q.range(from, from + 999);
            if (res.error) throw res.error;
            out = out.concat(res.data || []);
            if (!res.data || res.data.length < 1000) break;
        }
        return out;
    }

    async function load() {
        var cab = state.cabinetId;
        var res = await Promise.all([
            fetchAll('wb_stocks', cab, 'nm_id, quantity, stock_scheme', function (q) { return q.eq('stock_scheme', 'fbs'); }),
            fetchAll('rnp_articles', cab, 'nm_id, name, manual_data'),
        ]);
        var qty = {};
        res[0].forEach(function (s) {
            var id = Number(s.nm_id);
            if (id) qty[id] = (qty[id] || 0) + Number(s.quantity || 0);
        });
        var arts = {};
        res[1].forEach(function (a) { arts[Number(a.nm_id)] = a; });
        state.rows = Object.keys(qty).filter(function (id) { return qty[id] > 0; }).map(function (id) {
            var a = arts[id] || {};
            var md = a.manual_data || {};
            return {
                nmId: Number(id),
                article: String(md.seller_article || md.sa_name || a.name || '').trim(),
                qty: qty[id],
                ship: md.fbs_ship_price,
                storage: md.fbs_storage_day,
            };
        }).sort(function (a, b) { return a.article.localeCompare(b.article, 'ru') || a.nmId - b.nmId; });
    }

    function inputCell(r, field, value) {
        var shown = value === undefined || value === null || value === '' ? '' : String(value);
        return '<td class="gg-num gg-edit"><input class="gg-edit-input" type="text" inputmode="decimal" data-nm="' + r.nmId +
            '" data-field="' + field + '" value="' + esc(shown) + '" placeholder="—"></td>';
    }

    function render() {
        var host = state.host;
        if (!host) return;
        if (!state.rows.length) {
            host.innerHTML = '<div class="gg-fbs-empty" style="padding:24px;color:var(--text-secondary)">Нет товаров с остатком на складе продавца (FBS).</div>';
            return;
        }
        var q = (document.getElementById('gg-search') || {}).value || '';
        var needle = q.trim().toLowerCase();
        var rows = needle ? state.rows.filter(function (r) {
            return String(r.nmId).indexOf(needle) >= 0 || r.article.toLowerCase().indexOf(needle) >= 0;
        }) : state.rows;
        var totQty = 0, totSto = 0;
        var body = rows.map(function (r) {
            totQty += r.qty; totSto += num(r.storage);
            return '<tr><td class="gg-art" title="' + esc(r.article) + '">' + esc(r.article || '—') + '</td>' +
                '<td class="gg-col-nm gg-nm">' + r.nmId + '</td>' +
                '<td class="gg-num">' + fmt(r.qty) + '</td>' +
                inputCell(r, 'ship', r.ship) + inputCell(r, 'storage', r.storage) + '</tr>';
        }).join('');
        host.innerHTML = '<div class="gg-table-scroll"><table class="gg-table"><thead><tr>' +
            '<th class="gg-art">Артикул</th><th class="gg-col-nm gg-nm">WB</th><th class="gg-num">Остаток FBS</th>' +
            '<th class="gg-num">Цена за 1 отправку</th><th class="gg-num">Хранение в день</th></tr></thead><tbody>' + body +
            '</tbody><tfoot><tr class="gg-foot"><td class="gg-art">Итого</td><td class="gg-col-nm"></td><td class="gg-num">' + fmt(totQty) +
            '</td><td class="gg-num">—</td><td class="gg-num" id="gg-fbs-sto-total">' + fmt(totSto) + '</td></tr></tfoot></table></div>';
        host.querySelectorAll('.gg-edit-input').forEach(function (el) {
            el.addEventListener('change', function () { save(el); });
            el.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } });
        });
    }

    async function save(el) {
        var nmId = Number(el.dataset.nm);
        var field = el.dataset.field === 'ship' ? 'fbs_ship_price' : 'fbs_storage_day';
        var raw = String(el.value || '').trim();
        var val = raw === '' ? null : num(raw);
        var row = state.rows.filter(function (r) { return r.nmId === nmId; })[0];
        try {
            var cab = state.cabinetId, sb = state.supabase;
            var ex = await sb.from('rnp_articles').select('manual_data').eq('cabinet_id', cab).eq('nm_id', nmId).maybeSingle();
            if (ex.error) throw ex.error;
            var md = Object.assign({}, (ex.data && ex.data.manual_data) || {});
            if (val === null) delete md[field]; else md[field] = val;
            var r;
            if (ex.data) r = await sb.from('rnp_articles').update({ manual_data: md }).eq('cabinet_id', cab).eq('nm_id', nmId);
            else r = await sb.from('rnp_articles').upsert({ cabinet_id: cab, nm_id: nmId, name: row ? row.article : '', is_active: false, manual_data: md, cost_price: 0 });
            if (r.error) throw r.error;
            if (row) { if (field === 'fbs_ship_price') row.ship = val; else row.storage = val; }
            var t = document.getElementById('gg-fbs-sto-total');
            if (t) t.textContent = fmt(state.rows.reduce(function (s, x) { return s + num(x.storage); }, 0));
            el.style.outline = '';
        } catch (e) {
            el.style.outline = '2px solid #ef4444';
            if (root.console) console.warn('[goods-fbs] save failed', e && e.message);
        }
    }

    async function show(opts) {
        state.supabase = opts.supabase;
        state.cabinetId = opts.cabinetId;
        state.host = opts.host;
        if (state.host) state.host.innerHTML = '<div style="padding:24px;color:var(--text-secondary)">Загрузка…</div>';
        try { await load(); render(); }
        catch (e) { if (state.host) state.host.innerHTML = '<div style="padding:24px;color:#ef4444">Не удалось загрузить: ' + esc(e && e.message) + '</div>'; }
    }

    root.NrGoodsFbs = { show: show, render: render };
})(typeof window !== 'undefined' ? window : globalThis);

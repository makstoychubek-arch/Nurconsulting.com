/**
 * Раздел «Товары → FBS»: товары, у которых есть остаток на складе продавца.
 * Цена за 1 отправку и хранение в день вносятся вручную и действуют по периодам
 * (rnp_articles.manual_data.fbs_rates, см. fbs-rates.js); автоматически ничего не считается.
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

    function R() { return root.FbsRates; }
    function today() {
        var d = new Date(Date.now() + 6 * 3600 * 1000); // Бишкек, UTC+6
        return d.toISOString().slice(0, 10);
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
            fetchAll('wb_stocks', cab, 'nm_id, quantity, stock_scheme, warehouse_name', function (q) { return q.eq('stock_scheme', 'fbs'); }),
            fetchAll('rnp_articles', cab, 'nm_id, name, manual_data'),
        ]);
        var qty = {}, whs = {};
        res[0].forEach(function (s) {
            var id = Number(s.nm_id);
            if (!id) return;
            qty[id] = (qty[id] || 0) + Number(s.quantity || 0);
            if (Number(s.quantity) > 0 && s.warehouse_name) (whs[id] = whs[id] || {})[s.warehouse_name] = ((whs[id] || {})[s.warehouse_name] || 0) + Number(s.quantity);
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
                md: md,
                ffs: Object.keys(whs[id] || {}).sort(function (a, b) { return whs[id][b] - whs[id][a]; }),
                ship: R().rateOn(md, 'ship', today()) || null,
                storage: R().rateOn(md, 'storage', today()) || null,
            };
        }).sort(function (a, b) { return a.article.localeCompare(b.article, 'ru') || a.nmId - b.nmId; });
    }

    function inputCell(r, field, value) {
        var shown = value === undefined || value === null || value === '' ? '' : String(value);
        var hist = R().describe(r.md, field);
        return '<td class="gg-num gg-edit"><input class="gg-edit-input" type="text" inputmode="decimal" data-nm="' + r.nmId +
            '" data-field="' + field + '" value="' + esc(shown) + '" placeholder="—" title="' + esc(hist || 'Не задано') + '"></td>';
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
                '<td class="gg-ff" title="' + esc(r.ffs.join(', ')) + '">' + esc(r.ffs.join(', ') || '—') + '</td>' +
                inputCell(r, 'ship', r.ship) + inputCell(r, 'storage', r.storage) + '</tr>';
        }).join('');
        host.innerHTML = '<div class="gg-fbs-note">Значения действуют по периодам: после ввода сайт спросит, с какой даты. Показан тариф на сегодня, история — во всплывающей подсказке.</div>' +
            '<div class="gg-table-scroll"><table class="gg-table"><thead><tr>' +
            '<th class="gg-art">Артикул</th><th class="gg-col-nm gg-nm">WB</th><th class="gg-num">Остаток FBS</th><th class="gg-ff">ФФ</th>' +
            '<th class="gg-num">Цена за 1 отправку</th><th class="gg-num">Хранение в день</th></tr>' +
            '<tr class="gg-bulk"><th colspan="3" class="gg-bulk-h">Для всех товаров сразу: впишите значение — применится ко всем</th>' +
            '<th class="gg-ff"></th>' +
            '<th class="gg-num"><input class="gg-edit-input gg-bulk-in" type="text" inputmode="decimal" data-bulk="ship" placeholder="для всех"></th>' +
            '<th class="gg-num"><input class="gg-edit-input gg-bulk-in" type="text" inputmode="decimal" data-bulk="storage" placeholder="для всех"></th></tr></thead><tbody>' + body +
            '</tbody><tfoot><tr class="gg-foot"><td class="gg-art">Итого</td><td class="gg-col-nm"></td><td class="gg-num">' + fmt(totQty) +
            '</td><td></td><td class="gg-num">—</td><td class="gg-num" id="gg-fbs-sto-total">' + fmt(totSto) + '</td></tr></tfoot></table></div>';
        host.querySelectorAll('.gg-bulk-in').forEach(function (el) {
            el.addEventListener('change', function () { saveAll(el); });
            el.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } });
        });
        host.querySelectorAll('.gg-edit-input:not(.gg-bulk-in)').forEach(function (el) {
            el.addEventListener('change', function () { save(el); });
            el.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } });
        });
    }

    // ─── Окно «С какой даты действует значение» ─────────────────────────────────────
    function dialog(html, wire) {
        return new Promise(function (resolve) {
            var ov = document.createElement('div');
            ov.className = 'nx-ov';
            ov.innerHTML = '<div class="nx-modal fbr-modal">' + html + '</div>';
            function done(v) { ov.remove(); resolve(v); }
            ov.addEventListener('click', function (e) {
                if (e.target === ov || e.target.closest('[data-x]')) return done(null);
                if (e.target.closest('[data-ok]')) { var v = wire(ov); if (v) done(v); }
            });
            document.body.appendChild(ov);
            var f = ov.querySelector('input'); if (f) f.focus();
        });
    }
    var KIND_NAME = { ship: 'цена за 1 отправку', storage: 'хранение в день' };
    function askPeriod(kind, value, count) {
        var t = today();
        var html = '<h3>' + fmt(value) + ' ₽: с какой даты?</h3>' +
            '<p class="nx-sm">' + KIND_NAME[kind][0].toUpperCase() + KIND_NAME[kind].slice(1) + (count > 1 ? ' — для ' + count + ' товаров' : '') + '. Старые значения на эти даты заменятся, остальные периоды не тронутся.</p>' +
            '<label class="fbr-l">С даты<input type="date" id="fbr-from" value="' + t + '"></label>' +
            '<label class="fbr-r"><input type="radio" name="fbr-m" value="open" checked> и дальше (пока не поменяю)</label>' +
            '<label class="fbr-r"><input type="radio" name="fbr-m" value="to"> только по дату <input type="date" id="fbr-to" value="' + t + '"></label>' +
            '<div class="fbr-btns"><button type="button" class="nx-go" data-ok="1">Применить</button><button type="button" class="nx-b" data-x="1">Отмена</button></div>';
        return dialog(html, function (ov) {
            var from = ov.querySelector('#fbr-from').value;
            var mode = ov.querySelector('input[name=fbr-m]:checked').value;
            var to = mode === 'to' ? ov.querySelector('#fbr-to').value : null;
            if (!from || (mode === 'to' && (!to || to < from))) { ov.querySelector('#fbr-from').style.outline = '2px solid #ef4444'; return null; }
            return { from: from, to: to };
        });
    }
    function askGap(kind, from, to) {
        var html = '<h3>А дальше?</h3><p class="nx-sm">С ' + R().fmtD(from) + (to ? ' по ' + R().fmtD(to) : '') + ' значение («' + KIND_NAME[kind] + '») не задано. Укажите, сколько было с этой даты (можно пропустить).</p>' +
            '<label class="fbr-l">' + KIND_NAME[kind] + ', ₽<input type="text" inputmode="decimal" id="fbr-v" placeholder="0"></label>' +
            '<div class="fbr-btns"><button type="button" class="nx-go" data-ok="1">Применить</button><button type="button" class="nx-b" data-x="1">Пропустить</button></div>';
        return dialog(html, function (ov) {
            var raw = ov.querySelector('#fbr-v').value.trim();
            if (!raw) { ov.querySelector('#fbr-v').style.outline = '2px solid #ef4444'; return null; }
            return { value: num(raw) };
        });
    }

    // Записать значение для списка артикулов на период; закрытый период → спросить про оставшиеся дни до сегодня.
    async function writeMd(rows, mutate) {
        var cab = state.cabinetId, sb = state.supabase;
        var ids = rows.map(function (r) { return r.nmId; });
        var existing = {};
        for (var i = 0; i < ids.length; i += 200) {
            var ex = await sb.from('rnp_articles').select('nm_id, manual_data').eq('cabinet_id', cab).in('nm_id', ids.slice(i, i + 200));
            if (ex.error) throw ex.error;
            (ex.data || []).forEach(function (a) { existing[Number(a.nm_id)] = a.manual_data || {}; });
        }
        for (var j = 0; j < rows.length; j++) {
            var r = rows[j];
            var md = mutate(existing[r.nmId] !== undefined ? existing[r.nmId] : r.md);
            var res = (r.nmId in existing)
                ? await sb.from('rnp_articles').update({ manual_data: md }).eq('cabinet_id', cab).eq('nm_id', r.nmId)
                : await sb.from('rnp_articles').upsert({ cabinet_id: cab, nm_id: r.nmId, name: r.article, is_active: false, manual_data: md, cost_price: 0 });
            if (res.error) throw res.error;
            r.md = md; r.ship = R().rateOn(md, 'ship', today()) || null; r.storage = R().rateOn(md, 'storage', today()) || null;
        }
    }
    async function applyRate(rows, kind, value, from, to) {
        await writeMd(rows, function (md) { return R().setRange(md, kind, value, from, to); });
    }
    async function setWithPeriod(rows, kind, value) {
        var p = await askPeriod(kind, value, rows.length);
        if (!p) return false;
        await applyRate(rows, kind, value, p.from, p.to);
        // закрытый период закончился раньше сегодняшнего дня — спрашиваем про оставшиеся дни
        var t = today();
        if (p.to && p.to < t) {
            var next = R().addDays(p.to, 1), g = await askGap(kind, next, t);
            if (g) await applyRate(rows, kind, g.value, next, null);
        }
        return true;
    }

    async function save(el) {
        var nmId = Number(el.dataset.nm), kind = el.dataset.field;
        var row = state.rows.filter(function (r) { return r.nmId === nmId; })[0];
        if (!row) return;
        var raw = String(el.value || '').trim();
        var prev = row[kind];
        if (raw === '') { if (!prev) return; el.value = prev; return; }   // стереть значение нельзя: тариф закрывается новым периодом
        var val = num(raw);
        if (val === Number(prev)) return;
        try {
            var ok = await setWithPeriod([row], kind, val);
            if (!ok) { el.value = prev == null ? '' : prev; return; }
            el.style.outline = '';
            render();
        } catch (e) {
            el.style.outline = '2px solid #ef4444';
            if (root.console) console.warn('[goods-fbs] save failed', e && e.message);
        }
    }

    // Одно значение — всем видимым (с учётом поиска) товарам сразу.
    var bulkBusy = false;
    async function saveAll(el) {
        if (bulkBusy) return;
        var kind = el.dataset.bulk;
        var raw = String(el.value || '').trim();
        if (raw === '') return;
        var val = num(raw);
        var needle = (((document.getElementById('gg-search') || {}).value) || '').trim().toLowerCase();
        var rows = needle ? state.rows.filter(function (r) { return String(r.nmId).indexOf(needle) >= 0 || r.article.toLowerCase().indexOf(needle) >= 0; }) : state.rows;
        if (!rows.length) return;
        bulkBusy = true; el.disabled = true;
        try {
            var ok = await setWithPeriod(rows, kind, val);
            bulkBusy = false;
            if (!ok) { el.disabled = false; el.value = ''; return; }
            render();
        } catch (e) {
            bulkBusy = false; el.disabled = false; el.style.outline = '2px solid #ef4444';
            if (root.console) console.warn('[goods-fbs] bulk failed', e && e.message);
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

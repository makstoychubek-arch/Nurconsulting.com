/**
 * Раздел «Товары → FBS»: товары на складах продавца (ФФ) и тарифы КАЖДОГО ФФ.
 * У каждого ФФ своя цена отправки (₽ за 1 заказ) и своё хранение (₽ за 1 шт в сутки, лимит ₽ в сутки), по периодам:
 * таблица ff_terms (см. ff-terms.js). Из них считается блок «Фулфилмент» на дашборде и РНП.
 */
(function (root) {
    // Единые окна вместо системных alert/confirm (nr-ui.js); без него работает как раньше.
    function ask(msg) { return root.NrUi ? root.NrUi.ask(msg) : Promise.resolve(root.confirm(msg)); }
    function say(msg) { if (root.NrUi) root.NrUi.alert(msg); else root.alert(msg); }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
    }
    function num(v) {
        var n = parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.'));
        return isNaN(n) ? 0 : n;
    }
    function fmt(n) { return Number(n || 0).toLocaleString('ru', { maximumFractionDigits: 2 }); }
    function T() { return root.FfTerms; }
    function today() { return new Date(Date.now() + 6 * 3600 * 1000).toISOString().slice(0, 10); }

    var state = { supabase: null, cabinetId: null, rows: [], ffs: [], terms: [], rawTerms: [], canon: {}, rawNames: [], host: null, rnpShip: true, rnpStorage: true, rub: 1, sel: '' };

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

    async function loadTerms() {
        var r = await state.supabase.from('ff_terms').select('id,ff_name,kind,value,daily_cap,fx_rate,storage_mode,date_from,date_to').eq('cabinet_id', state.cabinetId).order('date_from', { ascending: true }).range(0, 999);
        state.rawTerms = r.error ? [] : (r.data || []);
        // Объединённые ФФ (ff_groups) считаются под общим именем; одинаковые строки тарифов схлопываем
        state.terms = T().dedupe(state.rawTerms.map(function (t) { return Object.assign({}, t, { ff_name: cn(t.ff_name) }); }));
    }
    function cn(name) { return name ? (state.canon[name] || name) : name; }
    async function loadGroups() {
        state.canon = {};
        try {
            var r = await state.supabase.from('ff_groups').select('ff_name,group_name').eq('cabinet_id', state.cabinetId).range(0, 199);
            (r.data || []).forEach(function (g) { if (g.ff_name && g.group_name) state.canon[g.ff_name] = g.group_name; });
        } catch (e) { state.canon = {}; }
    }

    async function load() {
        var cab = state.cabinetId;
        var res = await Promise.all([
            fetchAll('wb_stocks', cab, 'nm_id, quantity, stock_scheme, warehouse_name', function (q) { return q.eq('stock_scheme', 'fbs'); }),
            fetchAll('rnp_articles', cab, 'nm_id, name, manual_data, photo_url'),
        ]);
        await loadGroups();
        var qty = {}, whs = {}, perFf = {}, raw = {};
        res[0].forEach(function (s) {
            var id = Number(s.nm_id), q = Number(s.quantity || 0);
            if (q > 0 && s.warehouse_name) raw[s.warehouse_name] = true;
            s = Object.assign({}, s, { warehouse_name: cn(s.warehouse_name) });
            if (!id) return;
            qty[id] = (qty[id] || 0) + q;
            if (q > 0 && s.warehouse_name) {
                (whs[id] = whs[id] || {})[s.warehouse_name] = ((whs[id] || {})[s.warehouse_name] || 0) + q;
                var f = perFf[s.warehouse_name] = perFf[s.warehouse_name] || { name: s.warehouse_name, qty: 0, arts: {} };
                f.qty += q; f.arts[id] = true;
            }
        });
        state.rawNames = Object.keys(raw).sort();
        var arts = {};
        res[1].forEach(function (a) { arts[Number(a.nm_id)] = a; });
        try { await loadTerms(); } catch (e) { state.terms = []; }
        try {
            var rr = await state.supabase.from('exchange_rates').select('date,rate').eq('pair', 'RUB_KGS').order('date', { ascending: false }).range(0, 0);
            state.rub = rr.data && rr.data[0] ? Number(rr.data[0].rate) || 1 : 1;
        } catch (e) { state.rub = 1; }
        try {
            var st = await state.supabase.from('ff_settings').select('rnp_ship_costs,rnp_storage_costs').eq('cabinet_id', cab).maybeSingle();
            state.rnpShip = st && st.data ? st.data.rnp_ship_costs !== false : true;
            state.rnpStorage = st && st.data ? st.data.rnp_storage_costs !== false : true;
        } catch (e) { state.rnpShip = true; state.rnpStorage = true; }
        state.ffs = Object.keys(perFf).map(function (k) { return { name: k, qty: perFf[k].qty, arts: Object.keys(perFf[k].arts).length }; }).sort(function (a, b) { return b.qty - a.qty; });
        state.rows = Object.keys(qty).filter(function (id) { return qty[id] > 0; }).map(function (id) {
            var a = arts[id] || {}, md = a.manual_data || {};
            return {
                nmId: Number(id),
                article: String(md.seller_article || md.sa_name || a.name || '').trim(),
                qty: qty[id],
                photo: a.photo_url || '',
                ffs: Object.keys(whs[id] || {}).sort(function (x, y) { return whs[id][y] - whs[id][x]; }).map(function (k) { return { k: k, q: whs[id][k] }; }),
            };
        }).sort(function (a, b) { return a.article.localeCompare(b.article, 'ru') || a.nmId - b.nmId; });
    }

    function photoOf(r) {
        var u = r.photo;
        if (!u && root.RNP && root.RNP.wbPhotoUrl) { try { u = root.RNP.wbPhotoUrl(r.nmId) || ''; } catch (e) {} }
        return '<span class="ggx-ph" style="width:40px;height:40px"><i>' + esc((r.article || '?').charAt(0).toUpperCase()) + '</i>' + (u ? '<img src="' + esc(u) + '" alt="" loading="lazy" onerror="this.remove()">' : '') + '</span>';
    }

    // Один блок тарифа ФФ: вид (ship | storage), текущее значение, форма «с даты», история и дыры.
    function termBlock(ff, kind, idx) {
        var t = today(), cur = T().at(idx, ff.name, kind, t), isSto = kind === 'storage', isBox = kind === 'box';
        var list = (idx[ff.name + '|' + kind] || []).slice().reverse();
        var first = list.length ? list[list.length - 1].date_from : null;
        var gaps = first ? T().gaps(idx, ff.name, kind, first, t) : [];
        var now = cur
            ? 'Сейчас: <b>' + fmt(cur.value) + ' ₽</b>' + (isSto ? (cur.storage_mode === 'fixed' ? ' в сутки, фиксированно' : ' за шт/сутки' + (cur.daily_cap != null ? ', лимит ' + fmt(cur.daily_cap) + ' ₽/сутки' : '')) : (isBox ? ' за короб' : ' за заказ')) + ' · курс ' + (cur.fx_rate ? fmt(cur.fx_rate) + ' (ФФ)' : fmt(state.rub) + ' (НБКР)') + ' → ' + fmt(Number(cur.value) * (Number(cur.fx_rate) || state.rub)) + ' сом'
            : '<span class="fbf-none">Цена не задана</span>';
        var hist = list.map(function (x) {
            return '<div class="fbf-h"><span>с ' + esc(T().fmtD(x.date_from)) + (x.date_to ? ' по ' + esc(T().fmtD(x.date_to)) : ' и дальше') + '</span><b>' + fmt(x.value) + ' ₽' + (x.storage_mode === 'fixed' ? ' / сутки' : (x.daily_cap != null ? ' · лимит ' + fmt(x.daily_cap) : '')) + '</b>' +
                '<button type="button" class="fbx-tx" data-term-del="' + esc(x.id) + '" title="Удалить период">×</button></div>';
        }).join('');
        var warn = gaps.length ? '<div class="fbf-warn">Нет цены: ' + gaps.map(function (g) { return esc(T().fmtD(g.from)) + (g.to !== g.from ? '–' + esc(T().fmtD(g.to)) : ''); }).join(', ') + '</div>' : '';
        return '<div class="fbf-blk" data-ff="' + esc(ff.name) + '" data-kind="' + kind + '"><div class="fbf-bt">' + (isSto ? 'Хранение' : (isBox ? 'Отправка поставок' : 'Отправка')) + '</div><div class="fbf-now">' + now + '</div>' + warn +
            '<div class="fbf-f">' + (isSto ? '<label title="Как ФФ берёт за хранение: с каждой штуки в сутки (с лимитом) или одной суммой в сутки за весь склад">Вид<select class="fbf-m"><option value="unit">За штуку в сутки</option><option value="fixed"' + (cur && cur.storage_mode === 'fixed' ? ' selected' : '') + '>Фиксированно в сутки</option></select></label>' : '') + '<label><span class="fbf-vl">' + (isSto ? '₽ за шт в сутки' : (isBox ? '₽ за короб' : '₽ за 1 заказ')) + '</span><input type="text" inputmode="decimal" class="fbf-v" placeholder="0"></label>' +
            (isSto ? '<label class="fbf-cl">Лимит ₽/сутки<input type="text" inputmode="decimal" class="fbf-c" placeholder="без лимита"></label>' : '') +
            '<label title="Курс, по которому ФФ переводит рубли в сомы. Пусто — курс НБКР на день">Курс ФФ ₽→сом<input type="text" inputmode="decimal" class="fbf-x" placeholder="НБКР"></label>' +
            '<label>С даты<input type="date" class="fbf-d" value="' + t + '"></label>' +
            '<label>По дату<input type="date" class="fbf-t" title="Пусто — «и дальше»"></label>' +
            '<button type="button" class="nx-go" data-term-save="1">Сохранить</button></div>' +
            (hist ? '<details class="fbf-hd"><summary>История · ' + list.length + '</summary><div class="fbf-hl">' + hist + '</div></details>' : '') + '</div>';
    }

    // Короткая строка текущих тарифов выбранного ФФ (сами тарифы редактируются в окне «Тарифы»).
    function tariffChips(ff, idx) {
        var t = today();
        function chip(kind, label) {
            var c = T().at(idx, ff.name, kind, t), txt;
            if (!c) txt = '<span class="fbf-none">не задана</span>';
            else if (kind === 'storage') txt = c.storage_mode === 'fixed' ? fmt(c.value) + ' ₽ / сутки' : fmt(c.value) + ' ₽ за шт' + (c.daily_cap != null ? ' · лимит ' + fmt(c.daily_cap) : '');
            else txt = fmt(c.value) + ' ₽' + (kind === 'box' ? ' за короб' : ' за заказ');
            return '<span class="fbs-chip"><small>' + label + '</small><b>' + txt + '</b></span>';
        }
        return '<div class="fbs-chips">' + chip('ship', 'Отправка') + chip('storage', 'Хранение') + chip('box', 'Поставки') + '</div>';
    }

    // Окно «Тарифы ФФ»: те же формы, но компактно и вне страницы (открывается кнопкой «⚙ Тарифы» или шестерёнкой раздела).
    function modalHtml() {
        var idx = T().index(state.terms), ff = state.ffs.filter(function (f) { return f.name === state.sel; })[0];
        var opts = state.ffs.map(function (f) { return '<option value="' + esc(f.name) + '"' + (f.name === state.sel ? ' selected' : '') + '>' + esc(f.name) + '</option>'; }).join('');
        return '<div class="rnp-settings-dialog fbs-modal nr-win" role="dialog" aria-modal="true"><button type="button" class="rnp-settings-close" data-fbs-x aria-label="Закрыть">×</button>' +
            '<h3 class="fbs-mt">Тарифы ФФ</h3><div class="fbs-mf"><select id="fbs-ff-m" class="fbs-sel" title="ФФ (склад)">' + opts + '</select></div>' +
            (ff ? termBlock(ff, 'ship', idx) + termBlock(ff, 'storage', idx) + termBlock(ff, 'box', idx) + mergeHtml(ff) : '<div class="fbf-none">Нет ФФ</div>') + '</div>';
    }
    // «Объединить ФФ»: отметьте склады, которые на самом деле один ФФ (АМАН ФФ, АМАН ФФ 2…5): они считаются вместе.
    function mergeHtml(ff) {
        var heads = {}; Object.keys(state.canon).forEach(function (m) { heads[state.canon[m]] = true; });
        var cands = state.rawNames.filter(function (n) { return n !== ff.name && (state.canon[n] === ff.name || (state.canon[n] == null && !heads[n])); });
        if (!cands.length) return '';
        return '<div class="fbs-merge"><b>Объединить ФФ</b><small>Отметьте склады, которые на самом деле один и тот же ФФ: отправки, хранение, штрафы и депозит считаются вместе под именем «' + esc(ff.name) + '».</small><div class="fbs-mg">' +
            cands.map(function (n) { return '<label class="fbs-mc"><input type="checkbox" data-merge="' + esc(n) + '"' + (state.canon[n] === ff.name ? ' checked' : '') + '>' + esc(n) + '</label>'; }).join('') + '</div></div>';
    }
    async function mergeFf(member, group, on) {
        var sb = state.supabase, cab = state.cabinetId;
        try {
            if (on) {
                var a = await sb.from('ff_groups').upsert({ cabinet_id: cab, ff_name: member, group_name: group }, { onConflict: 'cabinet_id,ff_name' });
                if (a.error) throw a.error;
                // тарифы участника: если у группы такой вид уже есть — убираем дубль, иначе переносим группе
                var raw = state.rawTerms, has = {};
                raw.filter(function (t) { return cn(t.ff_name) === group && t.ff_name === group; }).forEach(function (t) { has[t.kind] = true; });
                var kinds = {}; raw.filter(function (t) { return t.ff_name === member; }).forEach(function (t) { kinds[t.kind] = true; });
                for (var k in kinds) {
                    var q = has[k] ? sb.from('ff_terms').delete().eq('cabinet_id', cab).eq('ff_name', member).eq('kind', k)
                                   : sb.from('ff_terms').update({ ff_name: group }).eq('cabinet_id', cab).eq('ff_name', member).eq('kind', k);
                    var rr = await q; if (rr.error) throw rr.error;
                }
            } else {
                var d = await sb.from('ff_groups').delete().eq('cabinet_id', cab).eq('ff_name', member);
                if (d.error) throw d.error;
            }
            await load(); render();
        } catch (e) { say('Не удалось объединить: ' + String((e && e.message) || e)); }
    }
    function renderModal() {
        var ov = document.getElementById('fbs-tariff-ov');
        if (!ov || !ov.classList.contains('is-open')) return;
        ov.innerHTML = modalHtml();
        var sel = ov.querySelector('#fbs-ff-m');
        if (sel) sel.addEventListener('change', function () { state.sel = sel.value; try { localStorage.setItem('nr_fbs_ff_' + state.cabinetId, state.sel); } catch (e) {} render(); });
        ov.querySelectorAll('[data-fbs-x]').forEach(function (b) { b.addEventListener('click', closeSettings); });
        bindTerms(ov);
        ov.querySelectorAll('[data-merge]').forEach(function (c) { c.addEventListener('change', function () { mergeFf(c.getAttribute('data-merge'), state.sel, c.checked); }); });
    }
    function openSettings() {
        if (!state.ffs.length) return;
        var ov = document.getElementById('fbs-tariff-ov');
        if (!ov) {
            ov = document.createElement('div');
            ov.id = 'fbs-tariff-ov';
            ov.className = 'rnp-settings-overlay';
            ov.addEventListener('click', function (e) { if (e.target === ov) closeSettings(); });
            document.body.appendChild(ov);
            document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSettings(); });
        }
        ov.classList.add('is-open');
        renderModal();
    }
    function closeSettings() { var ov = document.getElementById('fbs-tariff-ov'); if (ov) ov.classList.remove('is-open'); }

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
        var idx = T().index(state.terms), t = today(), totQty = 0, stoDay = 0;
        state.rows.forEach(function (r) { totQty += r.qty; });
        state.ffs.forEach(function (f) {
            var st = T().at(idx, f.name, 'storage', t);
            if (st) { var c = st.storage_mode === 'fixed' ? (f.qty > 0 ? Number(st.value) : 0) : f.qty * Number(st.value); if (st.storage_mode !== 'fixed' && st.daily_cap != null && c > Number(st.daily_cap)) c = Number(st.daily_cap); stoDay += c * (Number(st.fx_rate) || state.rub); }
        });
        // Один блок: выбираем ФФ (склад) из списка, ниже его тарифы; мелкие тумблеры — учитывать отправку / хранение в РНП.
        var selName = state.sel;
        try { if (!selName) selName = localStorage.getItem('nr_fbs_ff_' + state.cabinetId) || ''; } catch (e) {}
        if (!state.ffs.some(function (f) { return f.name === selName; })) selName = (state.ffs[0] || {}).name || '';
        state.sel = selName;
        var ff = state.ffs.filter(function (f) { return f.name === selName; })[0];
        var opts = state.ffs.map(function (f) { return '<option value="' + esc(f.name) + '"' + (f.name === selName ? ' selected' : '') + '>' + esc(f.name) + '</option>'; }).join('');
        var head = '<div class="fbs-head"><select id="fbs-ff" class="fbs-sel" title="Выберите ФФ (склад)">' + opts + '</select>' +
            (ff ? '<span class="fbs-meta">' + fmt(ff.qty) + ' шт · ' + fmt(ff.arts) + ' арт.</span>' : '') +
            '<button type="button" class="fbs-setbtn" data-fbs-set title="Тарифы ФФ: отправка, хранение, поставки">⚙ Тарифы</button>' +
            '<span class="fbs-sws"><label class="fbx-sw" title="Учитывать отправку ФФ в РНП. Выключите, если отправка уже в себестоимости (как у Zevina). На дашборде учитывается всегда"><input type="checkbox" data-inc="rnp_ship_costs"' + (state.rnpShip ? ' checked' : '') + '><i></i>В РНП: отправка</label>' +
            '<label class="fbx-sw" title="Учитывать хранение ФФ в РНП. На дашборде учитывается всегда"><input type="checkbox" data-inc="rnp_storage_costs"' + (state.rnpStorage ? ' checked' : '') + '><i></i>В РНП: хранение</label></span></div>';
        var cols = ff ? tariffChips(ff, idx) : '';
        var shown = rows.filter(function (r) { return r.ffs.some(function (x) { return x.k === selName; }); });
        var body = shown.map(function (r) {
            return '<div class="fbx-row">' + photoOf(r) +
                '<div class="fbx-nm"><b title="' + esc(r.article) + '">' + esc(r.article || '—') + '</b><small>WB ' + r.nmId + '</small></div>' +
                '<div class="fbx-ff">' + r.ffs.map(function (f) { return '<span class="' + (f.k === selName ? 'is-sel' : '') + '" title="' + esc(f.k) + '">' + esc(f.k) + ' · ' + fmt(f.q) + '</span>'; }).join('') + '</div>' +
                '<div class="fbx-q">' + fmt(r.qty) + '</div></div>';
        }).join('');
        host.innerHTML = '<div class="fbx">' +
            '<div class="ggx-kp fbx-kp"><div class="ggx-k k1"><small>Товаров на FBS</small><b>' + fmt(state.rows.length) + '</b></div><div class="ggx-k k2"><small>Остаток FBS, шт</small><b>' + fmt(totQty) + '</b></div>' +
            '<div class="ggx-k k3"><small>Хранение в день, сом (по тарифам ФФ)</small><b id="gg-fbs-sto-total">' + fmt(stoDay) + '</b></div></div>' +
            '<div class="fbs-card">' + head + cols + '</div>' +
            '<div class="fbx-row fbx-h"><span></span><span>ТОВАРЫ НА ' + esc(selName) + '</span><span>ГДЕ ЛЕЖАТ (ФФ · шт)</span><span class="n">ОСТАТОК</span></div>' + body + '</div>';
        bind(host);
        renderModal();
    }

    function bind(host) {
        var ffSel = host.querySelector('#fbs-ff');
        if (ffSel) ffSel.addEventListener('change', function () { state.sel = ffSel.value; try { localStorage.setItem('nr_fbs_ff_' + state.cabinetId, state.sel); } catch (e) {} render(); });
        host.querySelectorAll('[data-inc]').forEach(function (inc) {
            inc.addEventListener('change', async function () {
                var col = inc.getAttribute('data-inc'), key = col === 'rnp_ship_costs' ? 'rnpShip' : 'rnpStorage';
                try {
                    var row = { cabinet_id: state.cabinetId, updated_at: new Date().toISOString() };
                    row[col] = inc.checked;
                    var r = await state.supabase.from('ff_settings').upsert(row);
                    if (r.error) throw r.error;
                    state[key] = inc.checked;
                } catch (e) { inc.checked = state[key]; say('Не удалось сохранить: ' + String((e && e.message) || e)); }
            });
        });
        host.querySelectorAll('[data-fbs-set]').forEach(function (b) { b.addEventListener('click', openSettings); });
    }

    function bindTerms(host) {
        host.querySelectorAll('.fbf-m').forEach(function (m) {
            function sync() {
                var blk = m.closest('.fbf-blk'), fixed = m.value === 'fixed';
                var vl = blk.querySelector('.fbf-vl'), cl = blk.querySelector('.fbf-cl');
                if (vl) vl.textContent = fixed ? '₽ в сутки (фиксированно)' : '₽ за шт в сутки';
                if (cl) cl.style.display = fixed ? 'none' : '';
            }
            m.addEventListener('change', sync); sync();
        });
        host.querySelectorAll('[data-term-save]').forEach(function (b) { b.addEventListener('click', function () { saveTerm(b.closest('.fbf-blk')); }); });
        host.querySelectorAll('[data-term-del]').forEach(function (b) { b.addEventListener('click', function () { delTerm(b.getAttribute('data-term-del')); }); });
    }

    async function saveTerm(blk) {
        var ff = blk.getAttribute('data-ff'), kind = blk.getAttribute('data-kind'), vEl = blk.querySelector('.fbf-v');
        var raw = String(vEl.value || '').trim(), from = blk.querySelector('.fbf-d').value, to = blk.querySelector('.fbf-t').value || null;
        var capEl = blk.querySelector('.fbf-c'), cap = capEl && String(capEl.value).trim() !== '' ? num(capEl.value) : null;
        if (raw === '' || !from || (to && to < from)) { vEl.style.outline = '2px solid #ef4444'; return; }
        var sb = state.supabase, cab = state.cabinetId;
        try {
            var fxEl = blk.querySelector('.fbf-x'), fx = fxEl && String(fxEl.value).trim() !== '' ? num(fxEl.value) : null;
            var mEl = blk.querySelector('.fbf-m'), p = T().plan(state.terms, ff, kind, num(raw), cap, from, to, fx, mEl ? mEl.value : 'unit');
            if (p.remove.length) { var d = await sb.from('ff_terms').delete().in('id', p.remove); if (d.error) throw d.error; }
            for (var i = 0; i < p.update.length; i++) { var u = await sb.from('ff_terms').update({ date_to: p.update[i].date_to }).eq('id', p.update[i].id); if (u.error) throw u.error; }
            var ins = p.add.concat([p.insert]).map(function (r) { return Object.assign({ cabinet_id: cab }, r); });
            var r = await sb.from('ff_terms').insert(ins);
            if (r.error) throw r.error;
            await loadTerms();
            render();
        } catch (e) { say('Не удалось сохранить: ' + String((e && e.message) || e)); }
    }

    async function delTerm(id) {
        if (!(await ask('Удалить этот период тарифа?'))) return;
        try {
            var r = await state.supabase.from('ff_terms').delete().eq('id', id);
            if (r.error) throw r.error;
            await loadTerms();
            render();
        } catch (e) { say('Не удалось удалить: ' + String((e && e.message) || e)); }
    }

    async function show(opts) {
        state.supabase = opts.supabase;
        state.cabinetId = opts.cabinetId;
        state.host = opts.host;
        if (state.host) state.host.innerHTML = '<div style="padding:24px;color:var(--text-secondary)">Загрузка…</div>';
        try { await load(); render(); }
        catch (e) { if (state.host) state.host.innerHTML = '<div style="padding:24px;color:#ef4444">Не удалось загрузить: ' + esc(e && e.message) + '</div>'; }
    }

    root.NrGoodsFbs = { show: show, render: render, openSettings: openSettings };
})(typeof window !== 'undefined' ? window : globalThis);

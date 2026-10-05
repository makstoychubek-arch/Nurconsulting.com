/**
 * Калькулятор раздач («ПЛАН РАЗДАЧ (Калькулятор)» из рабочей таблицы) — кнопка с ИИ-значком справа вверху в «Раздачах».
 * Логика построчно, как в таблице:
 *   Цена с СПП          = Цена без СПП − Цена без СПП × СПП
 *   Комиссия, руб       = Цена без СПП × Комиссия
 *   Кэшбэк, руб         = Цена с СПП × % кэшбэка
 *   Получаем с ВБ за шт = Цена без СПП − (Комиссия, руб + Логистика + Налог)
 *   Расход на кэшбэк    = Получаем с ВБ за шт − Кэшбэк, руб (− Себес, если включено)
 *   Получаем с ВБ общ   = Получаем с ВБ за шт × Кол-во
 *   Общий расход        = Расход на кэшбэк × Кол-во
 *   К переводу          = Кэшбэк, руб × Кол-во
 * Налог здесь — процент от цены без СПП (в таблице 0,02 вычитается как 0,02 руб., то есть налог выпадает).
 */
(function (root) {
    var STORE_KEY = 'nr_give_calc_v1';

    function num(v) {
        var n = Number(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.'));
        return isFinite(n) ? n : 0;
    }

    /** Все проценты на входе в процентах (8.8 = 8,8%), как их вводит человек. */
    function calcRow(r, opts) {
        var withCost = !(opts && opts.withCost === false);
        var price = num(r.price), qty = num(r.qty);
        var spp = num(r.spp) / 100, comm = num(r.commission) / 100, tax = num(r.tax) / 100, cb = num(r.cashback) / 100;
        var priceSpp = price - price * spp;
        var commRub = price * comm;
        var taxRub = price * tax;
        var cashbackRub = priceSpp * cb;
        var perUnit = price - (commRub + num(r.logistics) + taxRub);
        var net = perUnit - cashbackRub - (withCost ? num(r.cost) : 0);
        return {
            priceSpp: priceSpp, commissionRub: commRub, taxRub: taxRub, cashbackRub: cashbackRub,
            perUnit: perUnit, netPerUnit: net,
            totalFromWb: perUnit * qty, totalNet: net * qty, toTransfer: cashbackRub * qty,
        };
    }

    function calcTotals(rows, opts) {
        var t = { toTransfer: 0, fromWb: 0, net: 0 };
        rows.forEach(function (r) {
            var c = calcRow(r, opts);
            t.toTransfer += c.toTransfer; t.fromWb += c.totalFromWb; t.net += c.totalNet;
        });
        return t;
    }

    /** Подсказка из данных кабинета: средние за 30 дней по артикулу (цена до СПП, СПП, комиссия, логистика) и себестоимость карточки. */
    function suggestFromDaily(rows, article) {
        var sum = 0, cnt = 0, sppS = 0, sppN = 0, commS = 0, commN = 0, logS = 0, logN = 0;
        (rows || []).forEach(function (d) {
            var oc = num(d.orders_count), os = num(d.orders_sum);
            if (oc > 0 && os > 0) { sum += os; cnt += oc; }
            if (num(d.spp_pct) > 0) { sppS += num(d.spp_pct); sppN++; }
            if (num(d.commission_pct) > 0) { commS += num(d.commission_pct); commN++; }
            if (num(d.logistics_per_unit) > 0) { logS += num(d.logistics_per_unit); logN++; }
        });
        var out = {};
        if (cnt > 0) out.price = Math.round(sum / cnt);
        if (sppN) out.spp = Math.round(sppS / sppN * 10) / 10;
        if (commN) out.commission = Math.round(commS / commN * 10) / 10;
        if (logN) out.logistics = Math.round(logS / logN);
        if (article && num(article.cost_price) > 0) out.cost = num(article.cost_price);
        return out;
    }

    var DEFAULT_ROW = { article: '', qty: 100, cost: '', price: '', spp: 9, commission: 24.5, logistics: '', tax: 2, cashback: 100 };
    var state = { sb: null, cab: '', articles: [], rows: [], withCost: true, el: null };

    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function money(v) { return Math.round(v).toLocaleString('ru-RU').replace(/ /g, ' '); }
    function money1(v) { return (Math.round(v * 10) / 10).toLocaleString('ru-RU', { maximumFractionDigits: 1 }).replace(/ /g, ' '); }

    var FIELDS = [
        { k: 'article', l: 'Артикул', list: true, w: 170 },
        { k: 'qty', l: 'Кол-во', w: 64 },
        { k: 'cost', l: 'Себес', w: 72 },
        { k: 'price', l: 'Цена без СПП', w: 84 },
        { k: 'spp', l: 'СПП, %', w: 62 },
        { k: 'commission', l: 'Комиссия, %', w: 72 },
        { k: 'logistics', l: 'Логистика, ₽', w: 76 },
        { k: 'tax', l: 'Налог, %', w: 62 },
        { k: 'cashback', l: '% кэшбэка', w: 68 },
    ];

    function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify({ rows: state.rows, withCost: state.withCost })); } catch (e) { /* без хранилища работает так же */ } }
    function restore() {
        try {
            var s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
            if (s && Array.isArray(s.rows) && s.rows.length) { state.rows = s.rows; state.withCost = s.withCost !== false; }
        } catch (e) { /* пустое состояние */ }
        if (!state.rows.length) state.rows = [Object.assign({}, DEFAULT_ROW)];
    }

    function rowHtml(r, i) {
        var c = calcRow(r, { withCost: state.withCost });
        var inputs = FIELDS.map(function (f) {
            return '<td><input class="gc-in" data-i="' + i + '" data-k="' + f.k + '" value="' + esc(r[f.k]) + '"' + (f.list ? ' list="gc-articles"' : ' inputmode="decimal"') + '></td>';
        }).join('');
        var neg = c.netPerUnit < 0 ? ' is-neg' : '';
        return '<tr data-row="' + i + '">' + inputs
            + '<td class="gc-o">' + money1(c.priceSpp) + '</td><td class="gc-o">' + money1(c.commissionRub) + '</td><td class="gc-o">' + money1(c.cashbackRub) + '</td>'
            + '<td class="gc-o">' + money1(c.perUnit) + '</td><td class="gc-o' + neg + '">' + money1(c.netPerUnit) + '</td>'
            + '<td class="gc-o">' + money(c.totalFromWb) + '</td><td class="gc-o' + neg + '">' + money(c.totalNet) + '</td><td class="gc-o"><b>' + money(c.toTransfer) + '</b></td>'
            + '<td><button type="button" class="gc-x" data-del="' + i + '" aria-label="Удалить строку">×</button></td></tr>';
    }

    function totalsHtml() {
        var t = calcTotals(state.rows, { withCost: state.withCost });
        return '<div class="gc-tot"><div class="gc-card"><span>К переводу (кэшбэк покупателям)</span><b>' + money(t.toTransfer) + '</b></div>'
            + '<div class="gc-card"><span>Получаем с ВБ общ</span><b>' + money(t.fromWb) + '</b></div>'
            + '<div class="gc-card' + (t.net < 0 ? ' is-neg' : '') + '"><span>Чистый расход' + (state.withCost ? ' (с себестоимостью)' : '') + '</span><b>' + money(t.net) + '</b></div></div>';
    }

    function render() {
        if (!state.el) return;
        var head = FIELDS.map(function (f) { return '<th>' + esc(f.l) + '</th>'; }).join('')
            + '<th>Цена с СПП</th><th>Комиссия, ₽</th><th>Кэшбэк, ₽</th><th>Получаем с ВБ за шт</th><th>Расход на кэшбэк</th><th>Получаем с ВБ общ</th><th>Общий расход</th><th>К переводу</th><th></th>';
        var cols = FIELDS.map(function (f) { return '<col style="width:' + f.w + 'px">'; }).join('') + '<col style="width:76px"><col style="width:76px"><col style="width:72px"><col style="width:92px"><col style="width:92px"><col style="width:96px"><col style="width:92px"><col style="width:92px"><col style="width:28px">';
        state.el.querySelector('.gc-body').innerHTML = '<div class="gc-scroll"><table class="gc-table"><colgroup>' + cols + '</colgroup><thead><tr>' + head + '</tr></thead><tbody>'
            + state.rows.map(rowHtml).join('') + '</tbody></table></div>' + totalsHtml()
            + '<datalist id="gc-articles">' + state.articles.map(function (a) { return '<option value="' + esc(a.name) + '">'; }).join('') + '</datalist>';
    }

    /** Пересчёт без перерисовки ввода: обновляем только вычисляемые ячейки и итоги. */
    function recalc() {
        var trs = state.el.querySelectorAll('tbody tr');
        trs.forEach(function (tr, i) {
            var fresh = document.createElement('tbody');
            fresh.innerHTML = rowHtml(state.rows[i], i);
            var os = tr.querySelectorAll('.gc-o'), ns = fresh.querySelectorAll('.gc-o');
            os.forEach(function (o, k) { o.innerHTML = ns[k].innerHTML; o.className = ns[k].className; });
        });
        var tot = state.el.querySelector('.gc-tot');
        var f = document.createElement('div'); f.innerHTML = totalsHtml();
        if (tot) tot.replaceWith(f.firstChild);
        save();
    }

    async function autofill(i) {
        var r = state.rows[i];
        var art = state.articles.filter(function (a) { return a.name === r.article; })[0];
        if (!art || !state.sb) return;
        var since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
        var res = await state.sb.from('rnp_daily_data').select('orders_count, orders_sum, spp_pct, commission_pct, logistics_per_unit').eq('cabinet_id', state.cab).eq('nm_id', art.nm_id).gte('date', since);
        var s = suggestFromDaily(res && res.data, art);
        ['cost', 'price', 'spp', 'commission', 'logistics'].forEach(function (k) { if (s[k] != null) r[k] = s[k]; });
        render();
        save();
    }

    function close() { if (state.el) { state.el.remove(); state.el = null; document.removeEventListener('keydown', onKey); } }
    function onKey(e) { if (e.key === 'Escape') close(); }

    async function open(opts) {
        close();
        state.sb = opts && opts.supabase; state.cab = opts && opts.cabinetId;
        restore();
        var el = document.createElement('div');
        el.className = 'gc-overlay';
        el.innerHTML = '<div class="gc-dialog" role="dialog" aria-modal="true" aria-label="Калькулятор раздач">'
            + '<div class="gc-head"><span class="gc-ai">✦</span><div><div class="gc-title">Калькулятор раздач</div><div class="gc-sub">План раздач: сколько вернуть покупателям, сколько получим с ВБ и чистый расход</div></div>'
            + '<span class="gc-sp"></span><label class="gc-opt"><input type="checkbox" id="gc-cost"' + (state.withCost ? ' checked' : '') + '> минус себестоимость</label>'
            + '<button type="button" class="gc-add" data-act="add">+ Строка</button><button type="button" class="gc-close" data-act="close" aria-label="Закрыть">×</button></div>'
            + '<div class="gc-body"></div>'
            + '<div class="gc-note">Артикул из списка подставит себестоимость и средние цену, СПП, комиссию и логистику за 30 дней из данных кабинета — всё можно поправить. Налог считается от цены без СПП.</div></div>';
        document.body.appendChild(el);
        state.el = el;
        document.addEventListener('keydown', onKey);
        el.addEventListener('click', function (e) {
            if (e.target === el) return close();
            var b = e.target.closest && e.target.closest('[data-act],[data-del]');
            if (!b) return;
            if (b.dataset.del != null) { state.rows.splice(Number(b.dataset.del), 1); if (!state.rows.length) state.rows.push(Object.assign({}, DEFAULT_ROW)); render(); save(); return; }
            if (b.dataset.act === 'close') return close();
            if (b.dataset.act === 'add') { var last = state.rows[state.rows.length - 1] || DEFAULT_ROW; state.rows.push(Object.assign({}, last, { article: '' })); render(); save(); }
        });
        el.addEventListener('input', function (e) {
            var t = e.target;
            if (t.dataset && t.dataset.k) { state.rows[Number(t.dataset.i)][t.dataset.k] = t.value; if (t.dataset.k !== 'article') recalc(); }
        });
        el.addEventListener('change', function (e) {
            var t = e.target;
            if (t.id === 'gc-cost') { state.withCost = t.checked; recalc(); return; }
            if (t.dataset && t.dataset.k === 'article') autofill(Number(t.dataset.i));
        });
        render();
        if (state.sb && state.cab) {
            var arts = await state.sb.from('rnp_articles').select('nm_id, name, cost_price').eq('cabinet_id', state.cab).order('name');
            state.articles = (arts && arts.data || []).filter(function (a) { return a.name; });
            if (state.el) render();
        }
    }

    var api = { calcRow: calcRow, calcTotals: calcTotals, suggestFromDaily: suggestFromDaily, open: open, close: close };
    root.NrGiveCalc = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

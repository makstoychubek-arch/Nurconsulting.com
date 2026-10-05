/**
 * Раздел «Товары → Раздачи»: учёт раздач (кэшбек / блогеры / бартер) по шаблону рабочей таблицы «Список БЛУЗКИ».
 * Только для команды (таблица giveaways под RLS is_staff). Правка прямо в ячейках, сохранение сразу.
 */
(function (root) {
    var KINDS = ['КЭШБЕК', 'БЛОГЕР', 'БАРТЕРЩИК', 'ОТКАЗ'];
    var CASH_STATUSES = ['', 'Готов к выплате', 'Да', 'Нет', 'Отмена'];
    var REVIEW_STATUSES = ['', 'Да', 'Нет', 'Отмена'];
    var REVIEW_KINDS = ['', '-', 'ЗАПАС'];
    var PAYOUT_DELAY_DAYS = 15; // как в таблице: планируемая дата выплаты = фактическая дата забора + 15

    // Колонки ровно как в шаблоне. key — поле таблицы giveaways.
    var COLS = [
        { key: 'kind', label: 'Вид', type: 'select', options: KINDS, w: 104 },
        { key: 'tg_link', label: 'Ссылка ТГ', type: 'text', w: 130 },
        { key: 'order_date', label: 'Дата заказа', type: 'date', w: 112 },
        { key: 'order_price', label: 'Цена в заказе', type: 'number', w: 84 },
        { key: 'cash_amount', label: 'Размер кэша', type: 'number', w: 84 },
        { key: 'pickup_planned', label: 'Примерная дата забора', type: 'date', w: 112 },
        { key: 'pickup_date', label: 'Фактическая дата забора', type: 'date', w: 112 },
        { key: 'ad_date', label: 'Дата рекламы', type: 'date', w: 112 },
        { key: 'barcode_cut', label: 'Разрезанный ШК', type: 'bool', w: 76 },
        { key: 'review_date', label: 'Дата публикации отзыва', type: 'date', w: 112 },
        { key: 'review_kind', label: 'Вид отзыва', type: 'select', options: REVIEW_KINDS, w: 84 },
        { key: 'requisites', label: 'Реквизиты', type: 'text', w: 170 },
        { key: 'cash_status', label: 'Кэш выплачен', type: 'select', options: CASH_STATUSES, w: 118 },
        { key: '_payout', label: 'Планируемая дата выплаты', type: 'computed', w: 104 },
        { key: 'review_status', label: 'Отзыв опубликован', type: 'select', options: REVIEW_STATUSES, w: 96 },
        { key: 'responsible', label: 'Ответственный', type: 'text', list: 'responsible', w: 104 },
        { key: 'keyword', label: 'Ключ', type: 'text', w: 150 },
        { key: 'article', label: 'Артикул', type: 'text', list: 'article', w: 170 },
        { key: 'filters', label: 'Фильтры', type: 'text', w: 100 },
        { key: 'comment', label: 'Чёрный список / комментарии', type: 'text', w: 170 },
        { key: 'reels_views', label: 'Просмотры рилс', type: 'number', w: 84 },
        { key: 'reels_link', label: 'Ссылка на Reels', type: 'text', w: 130 },
    ];

    var state = { sb: null, cab: '', rows: [], articles: [], host: null, filters: { kind: '', cash: '', who: '', q: '' }, loaded: false };

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function todayYmd() {
        var d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function addDays(ymd, n) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ymd || ''))) return '';
        var p = ymd.split('-').map(Number);
        return new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)).toISOString().slice(0, 10);
    }

    function fmtDate(ymd) {
        if (!ymd) return '';
        var p = String(ymd).slice(0, 10).split('-');
        return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : String(ymd);
    }

    /** Планируемая дата выплаты: фактическая дата забора + 15 дней (как формула G+15 в таблице). */
    function payoutDate(row) {
        return row && row.pickup_date ? addDays(String(row.pickup_date).slice(0, 10), PAYOUT_DELAY_DAYS) : '';
    }

    /** Кэш не выплачен и срок выплаты уже прошёл. */
    function isOverdue(row, today) {
        var pay = payoutDate(row);
        if (!pay) return false;
        var st = String(row.cash_status || '');
        return st !== 'Да' && st !== 'Отмена' && Number(row.cash_amount || 0) > 0 && pay < (today || todayYmd());
    }

    function summary(rows, today) {
        var s = { total: rows.length, due: 0, dueSum: 0, overdue: 0, paidSum: 0 };
        rows.forEach(function (r) {
            var st = String(r.cash_status || '');
            var cash = Number(r.cash_amount || 0);
            if (st === 'Да') s.paidSum += cash;
            else if (st !== 'Отмена' && cash > 0) { s.due++; s.dueSum += cash; }
            if (isOverdue(r, today)) s.overdue++;
        });
        return s;
    }

    function applyFilters(rows, f) {
        var q = String(f.q || '').trim().toLowerCase();
        return rows.filter(function (r) {
            if (f.kind && r.kind !== f.kind) return false;
            if (f.cash && String(r.cash_status || '') !== f.cash) return false;
            if (f.who && String(r.responsible || '') !== f.who) return false;
            if (q) {
                var hay = [r.tg_link, r.keyword, r.article, r.comment, r.requisites].join(' ').toLowerCase();
                if (hay.indexOf(q) === -1) return false;
            }
            return true;
        });
    }

    function cell(col, row) {
        var v = row[col.key];
        if (col.type === 'computed') {
            var pay = payoutDate(row);
            return '<td class="gv-c gv-pay' + (isOverdue(row) ? ' is-late' : '') + '">' + esc(fmtDate(pay)) + '</td>';
        }
        var attr = ' data-id="' + esc(row.id) + '" data-k="' + col.key + '"';
        if (col.type === 'select') {
            var cur = v == null ? '' : String(v);
            var opts = col.options.slice();
            if (cur && opts.indexOf(cur) === -1) opts.push(cur);
            var tone = col.key === 'cash_status' ? ' gv-st-' + (cur === 'Да' ? 'ok' : cur === 'Готов к выплате' ? 'ready' : cur === 'Отмена' ? 'off' : cur === 'Нет' ? 'no' : 'none') : '';
            return '<td class="gv-c"><select class="gv-in gv-sel' + tone + '"' + attr + '>' + opts.map(function (o) {
                return '<option value="' + esc(o) + '"' + (o === cur ? ' selected' : '') + '>' + esc(o || '—') + '</option>';
            }).join('') + '</select></td>';
        }
        if (col.type === 'bool') {
            return '<td class="gv-c gv-center"><input type="checkbox" class="gv-in gv-chk"' + attr + (v ? ' checked' : '') + '></td>';
        }
        var type = col.type === 'date' ? 'date' : col.type === 'number' ? 'number' : 'text';
        var val = col.type === 'date' ? String(v || '').slice(0, 10) : (v == null ? '' : v);
        var list = col.list ? ' list="gv-dl-' + col.list + '"' : '';
        return '<td class="gv-c"><input class="gv-in gv-txt gv-' + col.type + '" type="' + type + '"' + list + attr + ' value="' + esc(val) + '"></td>';
    }

    function tableHtml(rows) {
        var head = COLS.map(function (c) { return '<th class="gv-th" style="min-width:' + c.w + 'px">' + esc(c.label) + '</th>'; }).join('');
        var body = rows.map(function (r) {
            return '<tr data-row="' + esc(r.id) + '">' + COLS.map(function (c) { return cell(c, r); }).join('')
                + '<td class="gv-c gv-del"><button type="button" class="gv-x" data-del="' + esc(r.id) + '" title="Удалить строку" aria-label="Удалить строку">×</button></td></tr>';
        }).join('');
        if (!rows.length) body = '<tr><td class="gv-empty" colspan="' + (COLS.length + 1) + '">Раздач пока нет. Нажмите «Добавить раздачу» — строка создастся по шаблону.</td></tr>';
        var total = COLS.reduce(function (n, c) { return n + c.w; }, 0) + 26;
        var cols = COLS.map(function (c) { return '<col style="width:' + c.w + 'px">'; }).join('') + '<col style="width:26px">';
        return '<div class="gv-scroll"><table class="gv-table" style="width:' + total + 'px"><colgroup>' + cols + '</colgroup><thead><tr>' + head + '<th class="gv-th gv-del-h"></th></tr></thead><tbody>' + body + '</tbody></table></div>';
    }

    function distinct(rows, key) {
        var seen = {};
        rows.forEach(function (r) { if (r[key]) seen[r[key]] = 1; });
        return Object.keys(seen).sort();
    }

    function chrome(rows) {
        var s = summary(rows);
        var whoList = distinct(rows, 'responsible');
        var opt = function (list, cur, all) {
            return '<option value="">' + all + '</option>' + list.map(function (o) { return '<option value="' + esc(o) + '"' + (o === cur ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('');
        };
        var f = state.filters;
        var nf = function (n) { return Number(n).toLocaleString('ru-RU'); };
        return '<div class="gv-bar">'
            + '<button type="button" class="gv-add" data-act="add">+ Добавить раздачу</button>'
            + '<select class="gv-filter" data-f="kind">' + opt(KINDS, f.kind, 'Все виды') + '</select>'
            + '<select class="gv-filter" data-f="cash">' + opt(CASH_STATUSES.filter(Boolean), f.cash, 'Любая выплата') + '</select>'
            + '<select class="gv-filter" data-f="who">' + opt(whoList, f.who, 'Все ответственные') + '</select>'
            + '<input class="gv-filter gv-q" data-f="q" type="search" placeholder="Поиск: ТГ, ключ, артикул" value="' + esc(f.q) + '">'
            + '<span class="gv-sp"></span>'
            + '<button type="button" class="gv-ghost" data-act="template" title="Пустой шаблон с заголовками">Шаблон</button>'
            + '<button type="button" class="gv-ghost" data-act="export" title="Скачать таблицу">Excel</button>'
            + '</div>'
            + '<div class="gv-sum">'
            + '<span class="gv-chip">Раздач: <b>' + nf(s.total) + '</b></span>'
            + '<span class="gv-chip">К выплате: <b>' + nf(s.due) + '</b> · ' + nf(s.dueSum) + '</span>'
            + '<span class="gv-chip' + (s.overdue ? ' is-late' : '') + '">Просрочено: <b>' + nf(s.overdue) + '</b></span>'
            + '<span class="gv-chip">Выплачено: ' + nf(s.paidSum) + '</span>'
            + '</div>';
    }

    function datalists() {
        var who = distinct(state.rows, 'responsible');
        ['Светлана', 'МАРЛЕН'].forEach(function (n) { if (who.indexOf(n) === -1) who.push(n); });
        return '<datalist id="gv-dl-responsible">' + who.map(function (w) { return '<option value="' + esc(w) + '">'; }).join('') + '</datalist>'
            + '<datalist id="gv-dl-article">' + state.articles.map(function (a) { return '<option value="' + esc(a.name) + '">'; }).join('') + '</datalist>';
    }

    function paint() {
        if (!state.host) return;
        var rows = applyFilters(state.rows, state.filters);
        var keep = state.host.querySelector('.gv-scroll');
        var sx = keep ? keep.scrollLeft : 0, sy = keep ? keep.scrollTop : 0;
        state.host.innerHTML = '<div class="gv-wrap">' + chrome(state.rows) + tableHtml(rows) + datalists() + '</div>';
        var sc = state.host.querySelector('.gv-scroll');
        if (sc) { sc.scrollLeft = sx; sc.scrollTop = sy; }
    }

    function coerce(col, raw) {
        if (col.type === 'bool') return !!raw;
        if (col.type === 'number') { var n = raw === '' ? null : Number(raw); return n == null || !isFinite(n) ? null : n; }
        if (col.type === 'date') return raw ? String(raw).slice(0, 10) : null;
        var t = String(raw == null ? '' : raw).trim();
        return t === '' ? null : t;
    }

    function colByKey(k) { for (var i = 0; i < COLS.length; i++) if (COLS[i].key === k) return COLS[i]; return null; }

    async function save(id, key, value) {
        var row = state.rows.find(function (r) { return r.id === id; });
        if (!row) return;
        var patch = {}; patch[key] = value;
        // Артикул из списка товаров — заодно запоминаем nm_id.
        if (key === 'article') {
            var hit = state.articles.find(function (a) { return a.name === value; });
            patch.nm_id = hit ? hit.nm_id : null;
        }
        Object.assign(row, patch);
        var res = await state.sb.from('giveaways').update(patch).eq('id', id);
        if (res.error) { console.warn('[giveaways] save', res.error.message); if (root.NrNotify && root.NrNotify.show) root.NrNotify.show('Не сохранилось: ' + res.error.message); }
        if (key === 'pickup_date' || key === 'cash_status' || key === 'cash_amount') paint();
    }

    async function addRow() {
        var last = state.rows[0] || {};
        var row = { cabinet_id: state.cab, kind: state.filters.kind || 'КЭШБЕК', order_date: todayYmd(), responsible: last.responsible || null };
        var res = await state.sb.from('giveaways').insert(row).select().single();
        if (res.error) { console.warn('[giveaways] add', res.error.message); return; }
        state.rows.unshift(res.data);
        paint();
        var first = state.host.querySelector('tr[data-row="' + res.data.id + '"] input.gv-txt');
        if (first) first.focus();
    }

    async function delRow(id) {
        if (!root.confirm('Удалить эту строку раздачи?')) return;
        var res = await state.sb.from('giveaways').delete().eq('id', id);
        if (res.error) { console.warn('[giveaways] delete', res.error.message); return; }
        state.rows = state.rows.filter(function (r) { return r.id !== id; });
        paint();
    }

    function csvCell(v) {
        var s = String(v == null ? '' : v);
        return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }

    function download(name, csv) {
        var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = name;
        document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    }

    function templateCsv() {
        var head = COLS.map(function (c) { return csvCell(c.label); }).join(';');
        var ex = ['КЭШБЕК', '@username', todayYmd(), 1300, 600, addDays(todayYmd(), 3), '', '', 'Да', '', '', 'Номер карты / банк / имя', '', '', '', 'МАРЛЕН', 'блузка женская', 'Блузка-лапша-черный', '', '', '', ''];
        return head + '\n' + ex.map(csvCell).join(';');
    }

    function exportCsv() {
        var rows = applyFilters(state.rows, state.filters);
        var lines = [COLS.map(function (c) { return csvCell(c.label); }).join(';')];
        rows.forEach(function (r) {
            lines.push(COLS.map(function (c) {
                if (c.type === 'computed') return csvCell(fmtDate(payoutDate(r)));
                var v = r[c.key];
                if (c.type === 'bool') return v ? 'Да' : '';
                if (c.type === 'date') return csvCell(fmtDate(v));
                return csvCell(v);
            }).join(';'));
        });
        return lines.join('\n');
    }

    function bind() {
        var h = state.host;
        if (!h || h.dataset.gvBound) return;
        h.dataset.gvBound = '1';
        h.addEventListener('change', function (e) {
            var t = e.target;
            if (t.dataset && t.dataset.f) { state.filters[t.dataset.f] = t.value; paint(); return; }
            if (t.dataset && t.dataset.id) {
                var col = colByKey(t.dataset.k);
                if (col) save(t.dataset.id, t.dataset.k, coerce(col, col.type === 'bool' ? t.checked : t.value));
            }
        });
        h.addEventListener('input', function (e) {
            var t = e.target;
            if (t.dataset && t.dataset.f === 'q') {
                state.filters.q = t.value;
                clearTimeout(bind._t);
                bind._t = setTimeout(function () { paint(); var q = h.querySelector('.gv-q'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }, 250);
            }
        });
        h.addEventListener('click', function (e) {
            var b = e.target.closest && e.target.closest('[data-act],[data-del]');
            if (!b) return;
            if (b.dataset.del) return delRow(b.dataset.del);
            if (b.dataset.act === 'add') return addRow();
            if (b.dataset.act === 'template') return download('razdachi-shablon.csv', templateCsv());
            if (b.dataset.act === 'export') return download('razdachi-' + todayYmd() + '.csv', exportCsv());
        });
    }

    async function load() {
        var all = [];
        for (var from = 0; ; from += 1000) {
            var res = await state.sb.from('giveaways').select('*').eq('cabinet_id', state.cab)
                .order('order_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).range(from, from + 999);
            if (res.error) throw res.error;
            all = all.concat(res.data || []);
            if (!res.data || res.data.length < 1000) break;
        }
        state.rows = all;
        var arts = await state.sb.from('rnp_articles').select('nm_id, name').eq('cabinet_id', state.cab).order('name');
        state.articles = (arts.data || []).filter(function (a) { return a.name; });
    }

    /** Показать раздел для кабинета. */
    async function show(opts) {
        if (!opts || !opts.host || !opts.supabase || !opts.cabinetId) return;
        var changed = state.cab !== opts.cabinetId;
        state.sb = opts.supabase; state.host = opts.host; state.cab = opts.cabinetId;
        bind();
        if (changed || !state.loaded) {
            state.host.innerHTML = '<div class="gv-wrap"><div class="gv-empty">Загрузка…</div></div>';
            try { await load(); state.loaded = true; } catch (e) {
                state.host.innerHTML = '<div class="gv-wrap"><div class="gv-empty">Не удалось загрузить раздачи: ' + esc(e && e.message) + '</div></div>';
                return;
            }
        }
        paint();
    }

    var api = { COLS: COLS, show: show, payoutDate: payoutDate, isOverdue: isOverdue, summary: summary, applyFilters: applyFilters, templateCsv: templateCsv, coerce: coerce };
    root.NrGiveaways = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

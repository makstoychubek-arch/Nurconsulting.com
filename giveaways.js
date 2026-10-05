/**
 * Раздел «Товары → Раздачи»: таблица как в Google Sheets по шаблону рабочей таблицы «Список БЛУЗКИ».
 * 1000 готовых строк (в базе хранятся только заполненные), выделение диапазона мышью/Shift/стрелками,
 * копирование и вставка группами (Ctrl+C / Ctrl+V, совместимо с Google Sheets и Excel), Delete очищает,
 * квадратик-«плюс» у выделения протягивается вниз/вправо и копирует значения.
 * Только для команды (таблица giveaways под RLS is_staff).
 */
(function (root) {
    var KINDS = ['КЭШБЕК', 'БЛОГЕР', 'БАРТЕРЩИК', 'ОТКАЗ'];
    var CASH_STATUSES = ['', 'Готов к выплате', 'Да', 'Нет', 'Отмена'];
    var REVIEW_STATUSES = ['', 'Да', 'Нет', 'Отмена'];
    var REVIEW_KINDS = ['', '-', 'ЗАПАС'];
    var PAYOUT_DELAY_DAYS = 15; // планируемая дата выплаты = фактическая дата забора + 15 (как формула G+15)
    var MIN_ROWS = 1000;
    var EXTRA_ROWS = 100;

    // Колонки ровно как в шаблоне. key — поле таблицы giveaways.
    var COLS = [
        { key: 'kind', label: 'Вид', type: 'select', options: KINDS, w: 104 },
        { key: 'tg_link', label: 'Ссылка ТГ', type: 'text', w: 130 },
        { key: 'order_date', label: 'Дата заказа', type: 'date', w: 96 },
        { key: 'order_price', label: 'Цена в заказе', type: 'number', w: 80 },
        { key: 'cash_amount', label: 'Размер кэша', type: 'number', w: 80 },
        { key: 'pickup_planned', label: 'Примерная дата забора', type: 'date', w: 96 },
        { key: 'pickup_date', label: 'Фактическая дата забора', type: 'date', w: 96 },
        { key: 'ad_date', label: 'Дата рекламы', type: 'date', w: 96 },
        { key: 'barcode_cut', label: 'Разрезанный ШК', type: 'bool', w: 76 },
        { key: 'review_date', label: 'Дата публикации отзыва', type: 'date', w: 96 },
        { key: 'review_kind', label: 'Вид отзыва', type: 'select', options: REVIEW_KINDS, w: 80 },
        { key: 'requisites', label: 'Реквизиты', type: 'text', w: 170 },
        { key: 'cash_status', label: 'Кэш выплачен', type: 'select', options: CASH_STATUSES, w: 112 },
        { key: '_payout', label: 'Планируемая дата выплаты', type: 'computed', w: 96 },
        { key: 'review_status', label: 'Отзыв опубликован', type: 'select', options: REVIEW_STATUSES, w: 92 },
        { key: 'responsible', label: 'Ответственный', type: 'text', w: 104 },
        { key: 'keyword', label: 'Ключ', type: 'text', w: 150 },
        { key: 'article', label: 'Артикул', type: 'text', w: 170 },
        { key: 'filters', label: 'Фильтры', type: 'text', w: 100 },
        { key: 'comment', label: 'Чёрный список / комментарии', type: 'text', w: 170 },
        { key: 'reels_views', label: 'Просмотры рилс', type: 'number', w: 84 },
        { key: 'reels_link', label: 'Ссылка на Reels', type: 'text', w: 130 },
    ];

    var state = {
        sb: null, cab: '', host: null, loaded: false, active: false,
        slots: [], articles: [], size: MIN_ROWS,
        anchor: null, sel: null, drag: false, fill: null, edit: null, q: '', queue: Promise.resolve(),
    };

    // ───────── чистые функции (тестируются отдельно) ─────────

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

    /** dd.mm.yyyy, dd/mm/yyyy, dd.mm.yy и yyyy-mm-dd → yyyy-mm-dd, иначе null. */
    function parseDate(raw) {
        var t = String(raw == null ? '' : raw).trim();
        if (!t) return null;
        var m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        var d, mo, y;
        if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; } else {
            m = t.match(/^(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})$/);
            if (!m) return null;
            d = +m[1]; mo = +m[2]; y = +m[3]; if (y < 100) y += 2000;
        }
        if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
        return y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    }

    function payoutDate(row) {
        return row && row.pickup_date ? addDays(String(row.pickup_date).slice(0, 10), PAYOUT_DELAY_DAYS) : '';
    }

    function isOverdue(row, today) {
        var pay = payoutDate(row);
        if (!pay) return false;
        var st = String(row.cash_status || '');
        return st !== 'Да' && st !== 'Отмена' && Number(row.cash_amount || 0) > 0 && pay < (today || todayYmd());
    }

    function summary(rows, today) {
        var s = { total: 0, due: 0, dueSum: 0, overdue: 0, paidSum: 0 };
        rows.forEach(function (r) {
            if (!r) return;
            s.total++;
            var st = String(r.cash_status || '');
            var cash = Number(r.cash_amount || 0);
            if (st === 'Да') s.paidSum += cash;
            else if (st !== 'Отмена' && cash > 0) { s.due++; s.dueSum += cash; }
            if (isOverdue(r, today)) s.overdue++;
        });
        return s;
    }

    function colByKey(k) { for (var i = 0; i < COLS.length; i++) if (COLS[i].key === k) return COLS[i]; return null; }

    /** Текст → значение поля по типу колонки (вставка, протягивание, ввод). undefined — значение не подошло. */
    function coerce(col, raw) {
        var t = String(raw == null ? '' : raw).trim();
        if (col.type === 'computed') return undefined;
        if (col.type === 'bool') return /^(да|true|1|\+|yes|y|x|✓)$/i.test(t);
        if (col.type === 'number') {
            if (t === '') return null;
            var n = Number(t.replace(/\s/g, '').replace(',', '.'));
            return isFinite(n) ? n : undefined;
        }
        if (col.type === 'date') return t === '' ? null : (parseDate(t) || undefined);
        if (col.type === 'select') {
            if (t === '') return null;
            var hit = col.options.filter(function (o) { return o && o.toLowerCase() === t.toLowerCase(); })[0];
            return hit || t;
        }
        return t === '' ? null : t;
    }

    function cellText(col, row) {
        if (!row) return '';
        if (col.type === 'computed') return fmtDate(payoutDate(row));
        var v = row[col.key];
        if (col.type === 'bool') return v ? 'Да' : '';
        if (col.type === 'date') return fmtDate(v);
        return v == null ? '' : String(v);
    }

    /** TSV из диапазона для буфера обмена (поля с табом/переводом строки — в кавычках). */
    function toTsv(rows, c1, c2, r1, r2) {
        var lines = [];
        for (var r = r1; r <= r2; r++) {
            var cells = [];
            for (var c = c1; c <= c2; c++) {
                var s = cellText(COLS[c], rows[r]);
                cells.push(/[\t\n"]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s);
            }
            lines.push(cells.join('\t'));
        }
        return lines.join('\n');
    }

    /** TSV из буфера → матрица строк (учитывает кавычки Google Sheets/Excel). */
    function parseTsv(text) {
        var rows = [], row = [], cur = '', inQ = false, i = 0;
        text = String(text == null ? '' : text).replace(/\r\n?/g, '\n');
        for (; i < text.length; i++) {
            var ch = text[i];
            if (inQ) {
                if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; } else cur += ch;
            } else if (ch === '"' && cur === '') inQ = true;
            else if (ch === '\t') { row.push(cur); cur = ''; } else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; } else cur += ch;
        }
        if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
        return rows;
    }

    /**
     * Протягивание: исходный блок размножается вниз/вправо циклом (копирование значений).
     * Возвращает список {r, c, text} для записи.
     */
    function fillPlan(rows, sel, toRow, toCol) {
        var out = [];
        var h = sel.r2 - sel.r1 + 1, w = sel.c2 - sel.c1 + 1;
        if (toRow > sel.r2) {
            for (var r = sel.r2 + 1; r <= toRow; r++) {
                for (var c = sel.c1; c <= sel.c2; c++) out.push({ r: r, c: c, text: cellText(COLS[c], rows[sel.r1 + ((r - sel.r2 - 1) % h)]) });
            }
        } else if (toCol > sel.c2) {
            for (var cc = sel.c2 + 1; cc <= toCol; cc++) {
                for (var rr = sel.r1; rr <= sel.r2; rr++) out.push({ r: rr, c: cc, text: cellText(COLS[sel.c1 + ((cc - sel.c2 - 1) % w)], rows[rr]) });
            }
        }
        return out;
    }

    function norm(sel) {
        return { r1: Math.min(sel.r1, sel.r2), r2: Math.max(sel.r1, sel.r2), c1: Math.min(sel.c1, sel.c2), c2: Math.max(sel.c1, sel.c2) };
    }

    // ───────── отрисовка ─────────

    function statusTone(key, v) {
        if (key !== 'cash_status' || !v) return '';
        return v === 'Да' ? ' gv-st-ok' : v === 'Готов к выплате' ? ' gv-st-ready' : v === 'Отмена' ? ' gv-st-off' : v === 'Нет' ? ' gv-st-no' : '';
    }

    function tdHtml(r, c, row) {
        var col = COLS[c];
        var txt = cellText(col, row);
        var cls = 'gv-c' + (col.type === 'number' ? ' gv-num' : '') + (col.type === 'bool' ? ' gv-center' : '')
            + (col.type === 'computed' ? ' gv-pay' + (row && isOverdue(row) ? ' is-late' : '') : '')
            + (col.type === 'date' ? ' gv-date' : '') + statusTone(col.key, row && row.cash_status);
        return '<td class="' + cls + '" data-r="' + r + '" data-c="' + c + '">' + esc(txt) + '</td>';
    }

    function rowHtml(r) {
        var row = state.slots[r];
        var h = '<tr data-r="' + r + '"><th class="gv-rn" data-rn="' + r + '">' + (r + 1) + '</th>';
        for (var c = 0; c < COLS.length; c++) h += tdHtml(r, c, row);
        return h + '</tr>';
    }

    function chromeHtml() {
        var s = summary(state.slots);
        var nf = function (n) { return Number(n).toLocaleString('ru-RU'); };
        return '<div class="gv-bar">'
            + '<button type="button" class="gv-add" data-act="add">+ Добавить раздачу</button>'
            + '<button type="button" class="gv-ghost" data-act="more" title="Добавить ещё 100 пустых строк">+100 строк</button>'
            + '<span class="gv-hint">Выделяйте мышью, копируйте Ctrl+C / вставляйте Ctrl+V группами, тяните квадратик у выделения — значения копируются</span>'
            + '<span class="gv-sp"></span>'
            + '<button type="button" class="gv-ghost" data-act="template" title="Пустой шаблон с заголовками">Шаблон</button>'
            + '<button type="button" class="gv-ghost" data-act="export" title="Скачать таблицу">Excel</button>'
            + '<button type="button" class="gv-ai" data-act="calc" title="Калькулятор раздач" aria-label="Калькулятор раздач">✦</button>'
            + '</div>'
            + '<div class="gv-sum">'
            + '<span class="gv-chip">Раздач: <b>' + nf(s.total) + '</b></span>'
            + '<span class="gv-chip">К выплате: <b>' + nf(s.due) + '</b> · ' + nf(s.dueSum) + '</span>'
            + '<span class="gv-chip' + (s.overdue ? ' is-late' : '') + '">Просрочено: <b>' + nf(s.overdue) + '</b></span>'
            + '<span class="gv-chip">Выплачено: ' + nf(s.paidSum) + '</span>'
            + '</div>';
    }

    function datalist() {
        return '<datalist id="gv-dl-article">' + state.articles.map(function (a) { return '<option value="' + esc(a.name) + '">'; }).join('') + '</datalist>';
    }

    function paint() {
        if (!state.host) return;
        var sc = state.host.querySelector('.gv-scroll');
        var sx = sc ? sc.scrollLeft : 0, sy = sc ? sc.scrollTop : 0;
        var total = 44 + COLS.reduce(function (n, c) { return n + c.w; }, 0);
        var cols = '<col style="width:44px">' + COLS.map(function (c) { return '<col style="width:' + c.w + 'px">'; }).join('');
        var head = '<th class="gv-th gv-rn-h"></th>' + COLS.map(function (c) { return '<th class="gv-th">' + esc(c.label) + '</th>'; }).join('');
        var body = '';
        for (var r = 0; r < state.size; r++) body += rowHtml(r);
        state.host.innerHTML = '<div class="gv-wrap">' + chromeHtml()
            + '<div class="gv-scroll"><table class="gv-table" style="width:' + total + 'px"><colgroup>' + cols + '</colgroup><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>'
            + datalist() + '<textarea class="gv-cb" tabindex="-1" aria-hidden="true" spellcheck="false"></textarea></div>';
        var sc2 = state.host.querySelector('.gv-scroll');
        if (sc2) { sc2.scrollLeft = sx; sc2.scrollTop = sy; }
        markSelection();
    }

    /** Скрытое поле держит фокус и содержит TSV выделения — так Ctrl+C/Ctrl+V работают как в Google Sheets. */
    function focusCb() {
        var cb = state.host && state.host.querySelector('.gv-cb');
        if (!cb) return;
        cb.focus({ preventScroll: true });
    }

    function syncCb() {
        var cb = state.host && state.host.querySelector('.gv-cb');
        if (!cb || !state.sel || state.edit) return;
        var s = norm(state.sel);
        cb.value = toTsv(state.slots, s.c1, s.c2, s.r1, s.r2);
        focusCb();
        cb.select();
    }

    function cellEl(r, c) { return state.host && state.host.querySelector('td[data-r="' + r + '"][data-c="' + c + '"]'); }

    function repaintCell(r, c) {
        var el = cellEl(r, c);
        if (!el) return;
        var t = document.createElement('tbody');
        t.innerHTML = '<tr>' + tdHtml(r, c, state.slots[r]) + '</tr>';
        el.replaceWith(t.firstChild.firstChild);
    }

    function repaintRow(r) {
        for (var c = 0; c < COLS.length; c++) repaintCell(r, c);
    }

    function refreshSummary() {
        var old = state.host && state.host.querySelector('.gv-sum');
        if (!old) return;
        var t = document.createElement('div');
        t.innerHTML = chromeHtml();
        var fresh = t.querySelector('.gv-sum');
        if (fresh) old.replaceWith(fresh);
    }

    /** Подсветка выделения и квадратик-«плюс» в правом нижнем углу. */
    function markSelection() {
        if (!state.host) return;
        state.host.querySelectorAll('.gv-in-sel, .gv-fill').forEach(function (e) {
            if (e.classList.contains('gv-fill')) e.remove(); else e.classList.remove('gv-in-sel', 'gv-anchor', 'gv-edge-t', 'gv-edge-b', 'gv-edge-l', 'gv-edge-r');
        });
        state.host.querySelectorAll('.gv-rn.is-on').forEach(function (e) { e.classList.remove('is-on'); });
        if (!state.sel) return;
        var s = norm(state.sel);
        for (var r = s.r1; r <= s.r2; r++) {
            var rn = state.host.querySelector('th[data-rn="' + r + '"]');
            if (rn) rn.classList.add('is-on');
            for (var c = s.c1; c <= s.c2; c++) {
                var el = cellEl(r, c);
                if (!el) continue;
                el.classList.add('gv-in-sel');
                if (r === s.r1) el.classList.add('gv-edge-t');
                if (r === s.r2) el.classList.add('gv-edge-b');
                if (c === s.c1) el.classList.add('gv-edge-l');
                if (c === s.c2) el.classList.add('gv-edge-r');
            }
        }
        var a = state.anchor && cellEl(state.anchor.r, state.anchor.c);
        if (a) a.classList.add('gv-anchor');
        var last = cellEl(s.r2, s.c2);
        if (last && !state.edit) {
            var h = document.createElement('i');
            h.className = 'gv-fill';
            h.title = 'Потяните вниз или вправо, чтобы скопировать';
            last.appendChild(h);
        }
    }

    // ───────── запись в базу ─────────

    function notifyError(msg) {
        console.warn('[giveaways]', msg);
        if (root.NrNotify && root.NrNotify.show) root.NrNotify.show('Раздачи: ' + msg);
    }

    function ensureSize(r) {
        if (r >= state.size) state.size = r + EXTRA_ROWS;
    }

    /**
     * Применить изменения [{r, c, value}] к сетке и базе: новые строки вставляются пачкой (pos = номер строки),
     * существующие обновляются; пустая строка после очистки удаляется.
     */
    async function apply(changes) {
        var byRow = {};
        changes.forEach(function (ch) {
            var col = COLS[ch.c];
            if (!col || col.type === 'computed' || ch.value === undefined) return;
            (byRow[ch.r] = byRow[ch.r] || {})[col.key] = ch.value;
        });
        var inserts = [], updates = [];
        Object.keys(byRow).forEach(function (rk) {
            var r = Number(rk), patch = byRow[rk];
            ensureSize(r);
            if (patch.article !== undefined) {
                var hit = patch.article && state.articles.filter(function (a) { return a.name === patch.article; })[0];
                patch.nm_id = hit ? hit.nm_id : null;
            }
            var row = state.slots[r];
            if (row) { Object.assign(row, patch); updates.push({ patch: patch, r: r }); } else {
                var empty = Object.keys(patch).every(function (k) { return patch[k] == null || patch[k] === false; });
                if (empty) return;
                var fresh = Object.assign({ cabinet_id: state.cab, pos: r }, patch);
                state.slots[r] = fresh;
                inserts.push(fresh);
            }
        });
        // сразу показываем результат, сохранение идёт следом по очереди (порядок правок сохраняется)
        Object.keys(byRow).forEach(function (rk) { repaintRow(Number(rk)); });
        markSelection();
        refreshSummary();
        var job = state.queue.then(function () { return persist(inserts, updates); });
        state.queue = job.catch(function () {});
        return job;
    }

    async function persist(inserts, updates) {
        for (var i = 0; i < inserts.length; i += 200) {
            var chunk = inserts.slice(i, i + 200);
            var res = await state.sb.from('giveaways').insert(chunk.map(function (x) { var y = Object.assign({}, x); delete y.id; return y; })).select();
            if (res.error) {
                notifyError('не сохранилось: ' + res.error.message);
                chunk.forEach(function (x) { if (state.slots[x.pos] === x) { state.slots[x.pos] = null; repaintRow(x.pos); } });
                continue;
            }
            (res.data || []).forEach(function (saved) {
                var cur = state.slots[saved.pos];
                if (cur) Object.assign(cur, { id: saved.id, created_at: saved.created_at }); else state.slots[saved.pos] = saved;
            });
        }
        await Promise.all(updates.map(function (u) {
            var row = state.slots[u.r];
            if (!row || !row.id) return null;
            return state.sb.from('giveaways').update(u.patch).eq('id', row.id).then(function (res) {
                if (res && res.error) notifyError('не сохранилось: ' + res.error.message);
            });
        }));
    }

    async function clearSelection() {
        if (!state.sel) return;
        var s = norm(state.sel), ch = [];
        for (var r = s.r1; r <= s.r2; r++) for (var c = s.c1; c <= s.c2; c++) {
            var col = COLS[c];
            if (col.type !== 'computed') ch.push({ r: r, c: c, value: col.type === 'bool' ? false : null });
        }
        await apply(ch);
        await dropEmptyRows(s.r1, s.r2);
        syncCb();
    }

    /** Строка без единого значения удаляется из базы, чтобы пустые строки не копились. */
    async function dropEmptyRows(r1, r2) {
        var ids = [];
        for (var r = r1; r <= r2; r++) {
            var row = state.slots[r];
            if (!row) continue;
            var filled = COLS.some(function (c) {
                if (c.type === 'computed') return false;
                var v = row[c.key];
                return v != null && v !== '' && v !== false;
            });
            if (!filled) { ids.push(row.id); state.slots[r] = null; }
        }
        if (ids.length) {
            var job = state.queue.then(function () { return state.sb.from('giveaways').delete().in('id', ids); });
            state.queue = job.catch(function () {});
            await job;
        }
        refreshSummary();
    }

    // ───────── выделение и редактирование ─────────

    function setSel(a, b) {
        state.sel = { r1: a.r, c1: a.c, r2: b.r, c2: b.c };
        markSelection();
    }

    function cellFromEvent(e) {
        var td = e.target.closest && e.target.closest('td.gv-c');
        if (!td) return null;
        return { r: Number(td.dataset.r), c: Number(td.dataset.c), td: td };
    }

    function startEdit(r, c, seed) {
        var col = COLS[c];
        if (col.type === 'computed') return;
        if (col.type === 'bool') { // чекбокс-ячейка: переключаем
            var cur = state.slots[r] ? !!state.slots[r].barcode_cut : false;
            apply([{ r: r, c: c, value: !cur }]);
            return;
        }
        var td = cellEl(r, c);
        if (!td) return;
        var row = state.slots[r];
        var el;
        if (col.type === 'select') {
            el = document.createElement('select');
            var curv = row && row[col.key] != null ? String(row[col.key]) : '';
            var opts = col.options.slice();
            if (curv && opts.indexOf(curv) === -1) opts.push(curv);
            el.innerHTML = opts.map(function (o) { return '<option value="' + esc(o) + '"' + (o === curv ? ' selected' : '') + '>' + esc(o || '—') + '</option>'; }).join('');
        } else {
            el = document.createElement('input');
            el.type = 'text';
            el.value = seed != null ? seed : cellText(col, row);
            if (col.key === 'article') el.setAttribute('list', 'gv-dl-article');
            if (col.type === 'date') el.placeholder = 'дд.мм.гггг';
        }
        el.className = 'gv-editor';
        td.classList.add('is-editing');
        td.textContent = '';
        td.appendChild(el);
        state.edit = { r: r, c: c, el: el, done: false };
        el.focus();
        if (el.select && seed == null) try { el.select(); } catch (e) { /* select у select-списка не нужен */ }
        el.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); endEdit(true, 1, 0); } else if (e.key === 'Tab') { e.preventDefault(); endEdit(true, 0, e.shiftKey ? -1 : 1); } else if (e.key === 'Escape') { e.preventDefault(); endEdit(false); }
            e.stopPropagation();
        });
        el.addEventListener('blur', function () { endEdit(true); });
        if (col.type === 'select') el.addEventListener('change', function () { endEdit(true); });
    }

    function endEdit(save, dr, dc) {
        var ed = state.edit;
        if (!ed || ed.done) return;
        ed.done = true;
        state.edit = null;
        var raw = ed.el.value;
        var col = COLS[ed.c];
        var td = ed.el.parentNode;
        if (td) td.classList.remove('is-editing');
        var val = save ? coerce(col, raw) : undefined;
        if (save && val === undefined && String(raw).trim() !== '') notifyError('«' + raw + '» не подходит для «' + col.label + '»');
        // вернуть ячейку в обычный вид
        repaintCell(ed.r, ed.c);
        if (save && val !== undefined) {
            var prev = state.slots[ed.r] ? state.slots[ed.r][col.key] : undefined;
            if (!(prev == null && val == null) && prev !== val) apply([{ r: ed.r, c: ed.c, value: val }]);
        }
        if (dr || dc) moveSel(dr || 0, dc || 0, false);
        else markSelection();
        syncCb();
    }

    function moveSel(dr, dc, extend) {
        var base = extend && state.sel ? { r: state.sel.r2, c: state.sel.c2 } : (state.anchor || { r: 0, c: 0 });
        var r = Math.max(0, Math.min(state.size - 1, base.r + dr));
        var c = Math.max(0, Math.min(COLS.length - 1, base.c + dc));
        if (extend && state.anchor) setSel(state.anchor, { r: r, c: c }); else { state.anchor = { r: r, c: c }; setSel(state.anchor, state.anchor); }
        var el = cellEl(r, c);
        if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        syncCb();
    }

    // ───────── буфер обмена ─────────

    function copySelection(e, cut) {
        if (!state.sel) return false;
        var s = norm(state.sel);
        var tsv = toTsv(state.slots, s.c1, s.c2, s.r1, s.r2);
        if (e && e.clipboardData) { e.clipboardData.setData('text/plain', tsv); e.preventDefault(); } else if (navigator.clipboard) navigator.clipboard.writeText(tsv).catch(function () {});
        if (cut) clearSelection();
        flash();
        return true;
    }

    function flash() {
        if (!state.host) return;
        state.host.querySelectorAll('.gv-in-sel').forEach(function (e) { e.classList.add('gv-flash'); });
        setTimeout(function () { state.host && state.host.querySelectorAll('.gv-flash').forEach(function (e) { e.classList.remove('gv-flash'); }); }, 350);
    }

    async function pasteText(text) {
        if (!state.sel && !state.anchor) return;
        var start = state.sel ? norm(state.sel) : { r1: state.anchor.r, c1: state.anchor.c, r2: state.anchor.r, c2: state.anchor.c };
        var grid = parseTsv(text);
        if (grid.length && grid[grid.length - 1].length === 1 && grid[grid.length - 1][0] === '') grid.pop();
        if (!grid.length) return;
        var ch = [];
        var single = grid.length === 1 && grid[0].length === 1;
        var h = single ? start.r2 - start.r1 + 1 : grid.length;
        var w = single ? start.c2 - start.c1 + 1 : Math.max.apply(null, grid.map(function (g) { return g.length; }));
        for (var i = 0; i < h; i++) {
            for (var j = 0; j < w; j++) {
                var r = start.r1 + i, c = start.c1 + j;
                if (c >= COLS.length) continue;
                var raw = single ? grid[0][0] : grid[i][j];
                if (raw === undefined) continue;
                ensureSize(r);
                var col = COLS[c];
                if (col.type === 'computed') continue;
                var v = coerce(col, raw);
                if (v === undefined) { notifyError('«' + String(raw).slice(0, 30) + '» не подходит для «' + col.label + '»'); continue; }
                ch.push({ r: r, c: c, value: v });
            }
        }
        var rowsAdded = state.size;
        await apply(ch);
        if (state.size !== rowsAdded) paint();
        var endR = start.r1 + h - 1, endC = Math.min(COLS.length - 1, start.c1 + w - 1);
        state.anchor = { r: start.r1, c: start.c1 };
        setSel(state.anchor, { r: endR, c: endC });
    }

    // ───────── протягивание (плюс) ─────────

    async function finishFill(toRow, toCol) {
        var s = norm(state.sel);
        var plan = fillPlan(state.slots, s, toRow, toCol);
        if (!plan.length) return;
        var ch = [];
        plan.forEach(function (p) {
            ensureSize(p.r);
            var v = coerce(COLS[p.c], p.text);
            if (v !== undefined) ch.push({ r: p.r, c: p.c, value: v });
        });
        var before = state.size;
        await apply(ch);
        if (state.size !== before) paint();
        var endR = Math.max(s.r2, toRow), endC = Math.max(s.c2, toCol);
        setSel({ r: s.r1, c: s.c1 }, { r: endR, c: endC });
    }

    // ───────── события ─────────

    function bindOnce() {
        var h = state.host;
        if (!h || h.dataset.gvBound) return;
        h.dataset.gvBound = '1';

        h.addEventListener('mousedown', function (e) {
            if (e.button !== 0) return;
            if (e.target.closest('.gv-editor')) return;
            if (e.target.classList && e.target.classList.contains('gv-fill')) {
                e.preventDefault();
                state.fill = { toRow: norm(state.sel).r2, toCol: norm(state.sel).c2 };
                return;
            }
            var rn = e.target.closest && e.target.closest('th.gv-rn');
            if (rn) { // клик по номеру строки — выделить всю строку
                var rr = Number(rn.dataset.rn);
                state.anchor = { r: rr, c: 0 };
                setSel({ r: rr, c: 0 }, { r: rr, c: COLS.length - 1 });
                e.preventDefault();
                return;
            }
            var hit = cellFromEvent(e);
            if (!hit) return;
            if (state.edit) endEdit(true);
            e.preventDefault();
            if (e.shiftKey && state.anchor) setSel(state.anchor, hit); else { state.anchor = { r: hit.r, c: hit.c }; setSel(state.anchor, state.anchor); }
            state.drag = true;
            focusCb();
        });

        h.addEventListener('mouseover', function (e) {
            if (!state.drag && !state.fill) return;
            var hit = cellFromEvent(e);
            if (!hit) return;
            if (state.fill) {
                var s = norm(state.sel);
                state.fill.toRow = Math.max(s.r2, hit.r);
                state.fill.toCol = hit.r > s.r2 ? s.c2 : Math.max(s.c2, hit.c);
                // подсветка протягиваемой области
                h.querySelectorAll('.gv-fill-prev').forEach(function (x) { x.classList.remove('gv-fill-prev'); });
                for (var r = s.r2 + 1; r <= state.fill.toRow; r++) for (var c = s.c1; c <= s.c2; c++) { var el = cellEl(r, c); if (el) el.classList.add('gv-fill-prev'); }
                return;
            }
            setSel(state.anchor, hit);
        });

        document.addEventListener('mouseup', function () {
            if (state.fill) {
                var f = state.fill;
                state.fill = null;
                if (state.host) state.host.querySelectorAll('.gv-fill-prev').forEach(function (x) { x.classList.remove('gv-fill-prev'); });
                finishFill(f.toRow, f.toCol);
            }
            if (state.drag) { state.drag = false; syncCb(); }
            state.drag = false;
        });

        h.addEventListener('dblclick', function (e) {
            var hit = cellFromEvent(e);
            if (hit) startEdit(hit.r, hit.c);
        });

        h.addEventListener('click', function (e) {
            var b = e.target.closest && e.target.closest('[data-act]');
            if (!b) return;
            if (b.dataset.act === 'add') return addRow();
            if (b.dataset.act === 'more') { state.size += 100; paint(); return; }
            if (b.dataset.act === 'template') return download('razdachi-shablon.csv', templateCsv());
            if (b.dataset.act === 'export') return download('razdachi-' + todayYmd() + '.csv', exportCsv());
            if (b.dataset.act === 'calc') { if (root.NrGiveCalc) root.NrGiveCalc.open({ supabase: state.sb, cabinetId: state.cab }); }
        });

        h.addEventListener('keydown', function (e) {
            if (state.edit || !state.sel) return;
            var mod = e.ctrlKey || e.metaKey;
            var k = e.key;
            if (mod && (k === 'c' || k === 'C' || k === 'с' || k === 'С')) return; // обработает событие copy
            if (mod && (k === 'v' || k === 'V' || k === 'м' || k === 'М')) return; // событие paste
            if (mod && (k === 'x' || k === 'X' || k === 'ч' || k === 'Ч')) return; // событие cut
            if (mod && (k === 'd' || k === 'D' || k === 'в' || k === 'В')) { e.preventDefault(); var s = norm(state.sel); if (s.r2 > s.r1) { var top = { r1: s.r1, r2: s.r1, c1: s.c1, c2: s.c2 }; var plan = fillPlan(state.slots, top, s.r2, s.c2); var ch = []; plan.forEach(function (p) { var v = coerce(COLS[p.c], p.text); if (v !== undefined) ch.push({ r: p.r, c: p.c, value: v }); }); apply(ch); } return; }
            if (mod && (k === 'a' || k === 'A' || k === 'ф' || k === 'Ф')) { e.preventDefault(); setSel({ r: 0, c: 0 }, { r: state.size - 1, c: COLS.length - 1 }); return; }
            if (k === 'ArrowDown') { e.preventDefault(); moveSel(1, 0, e.shiftKey); } else if (k === 'ArrowUp') { e.preventDefault(); moveSel(-1, 0, e.shiftKey); } else if (k === 'ArrowLeft') { e.preventDefault(); moveSel(0, -1, e.shiftKey); } else if (k === 'ArrowRight') { e.preventDefault(); moveSel(0, 1, e.shiftKey); } else if (k === 'Tab') { e.preventDefault(); moveSel(0, e.shiftKey ? -1 : 1, false); } else if (k === 'Enter' || k === 'F2') { e.preventDefault(); startEdit(state.anchor.r, state.anchor.c); } else if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); clearSelection(); } else if (k === 'Escape') { state.sel = null; markSelection(); } else if (!mod && k.length === 1 && state.anchor) { e.preventDefault(); startEdit(state.anchor.r, state.anchor.c, k); }
        });

        // буфер обмена: события на документе, но только когда раздел открыт и редактор не активен
        document.addEventListener('copy', function (e) { if (state.active && state.sel && !state.edit && inHost(e)) copySelection(e, false); });
        document.addEventListener('cut', function (e) { if (state.active && state.sel && !state.edit && inHost(e)) copySelection(e, true); });
        document.addEventListener('paste', function (e) {
            if (!state.active || state.edit || !inHost(e)) return;
            var text = (e.clipboardData && e.clipboardData.getData('text/plain')) || '';
            if (!text) return;
            e.preventDefault();
            pasteText(text);
        });
    }

    function inHost(e) {
        var a = document.activeElement;
        return !!(state.host && a && state.host.contains(a));
    }

    async function addRow() {
        var r = 0;
        while (state.slots[r]) r++;
        ensureSize(r);
        if (r >= state.size) { state.size = r + 1; paint(); }
        state.anchor = { r: r, c: 0 };
        setSel(state.anchor, state.anchor);
        var el = cellEl(r, 0);
        if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' });
        startEdit(r, 0);
    }

    // ───────── шаблон и выгрузка ─────────

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
        var ex = ['КЭШБЕК', '@username', fmtDate(todayYmd()), 1300, 600, fmtDate(addDays(todayYmd(), 3)), '', '', 'Да', '', '', 'Номер карты / банк / имя', '', '', '', 'МАРЛЕН', 'блузка женская', 'Блузка-лапша-черный', '', '', '', ''];
        return head + '\n' + ex.map(csvCell).join(';');
    }

    function exportCsv() {
        var lines = [COLS.map(function (c) { return csvCell(c.label); }).join(';')];
        state.slots.forEach(function (row) {
            if (!row) return;
            lines.push(COLS.map(function (c) { return csvCell(cellText(c, row)); }).join(';'));
        });
        return lines.join('\n');
    }

    // ───────── загрузка ─────────

    async function load() {
        var all = [];
        for (var from = 0; ; from += 1000) {
            var res = await state.sb.from('giveaways').select('*').eq('cabinet_id', state.cab).order('pos', { ascending: true, nullsFirst: false }).range(from, from + 999);
            if (res.error) throw res.error;
            all = all.concat(res.data || []);
            if (!res.data || res.data.length < 1000) break;
        }
        state.slots = [];
        var next = 0;
        all.forEach(function (row) { // строки без pos (старые) занимают первые свободные места
            var p = row.pos == null ? -1 : Number(row.pos);
            if (p < 0) { while (state.slots[next]) next++; p = next; row.pos = p; }
            state.slots[p] = row;
        });
        state.size = Math.max(MIN_ROWS, state.slots.length + EXTRA_ROWS);
        var arts = await state.sb.from('rnp_articles').select('nm_id, name').eq('cabinet_id', state.cab).order('name');
        state.articles = (arts.data || []).filter(function (a) { return a.name; });
    }

    /** Показать раздел для кабинета. */
    async function show(opts) {
        if (!opts || !opts.host || !opts.supabase || !opts.cabinetId) return;
        var changed = state.cab !== opts.cabinetId;
        state.sb = opts.supabase; state.host = opts.host; state.cab = opts.cabinetId; state.active = true;
        bindOnce();
        if (changed || !state.loaded) {
            state.host.innerHTML = '<div class="gv-wrap"><div class="gv-empty">Загрузка…</div></div>';
            state.anchor = null; state.sel = null;
            try { await load(); state.loaded = true; } catch (e) {
                state.host.innerHTML = '<div class="gv-wrap"><div class="gv-empty">Не удалось загрузить раздачи: ' + esc(e && e.message) + '</div></div>';
                return;
            }
        }
        paint();
    }

    function hide() { state.active = false; }

    var api = {
        COLS: COLS, show: show, hide: hide, payoutDate: payoutDate, isOverdue: isOverdue, summary: summary,
        templateCsv: templateCsv, coerce: coerce, parseDate: parseDate, parseTsv: parseTsv, toTsv: toTsv, fillPlan: fillPlan,
        cellText: cellText, MIN_ROWS: MIN_ROWS,
    };
    root.NrGiveaways = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

/**
 * РНП «Планирование»: все планы в одном окне, по неделям.
 * Строка — артикул, колонка — неделя месяца (пн–вс), вкладки — показатель (заказы, продажи, ДРР, расход РК…).
 * Число в ячейке записывается на все 7 дней недели в rnp_plans, и РНП показывает его в строках плана этих дней.
 */
(function (root) {
    var METRICS = [
        { id: 'planned_orders', label: 'Заказы', unit: 'шт / день', sum: true },
        { id: 'planned_sales', label: 'Продажи', unit: 'шт / день', sum: true },
        { id: 'planned_drr', label: 'ДРР %', unit: '% на каждый день', sum: false },
        { id: 'planned_ad_spend', label: 'Расход РК', unit: 'сом / день', sum: true },
        { id: 'planned_impressions', label: 'Переходы', unit: 'в карточку / день', sum: true },
        { id: 'planned_clicks', label: 'Клики РК', unit: 'шт / день', sum: true },
    ];
    var MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

    var st = null;

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
        });
    }
    function addDays(ymd, n) {
        var p = String(ymd).split('-').map(Number);
        return new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)).toISOString().slice(0, 10);
    }
    function mondayOnOrBefore(ymd) {
        var p = String(ymd).split('-').map(Number);
        var dow = new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay();
        return addDays(ymd, dow === 0 ? -6 : 1 - dow);
    }
    function ddmm(ymd) { var p = ymd.split('-'); return p[2] + '.' + p[1]; }

    function weeksOf(monthKey) {
        var p = monthKey.split('-').map(Number);
        var last = new Date(Date.UTC(p[0], p[1], 0)).toISOString().slice(0, 10);
        var cur = mondayOnOrBefore(monthKey + '-01');
        var weeks = [];
        while (cur <= last && weeks.length < 6) {
            var dates = [];
            for (var i = 0; i < 7; i++) dates.push(addDays(cur, i));
            weeks.push({ n: weeks.length + 1, start: dates[0], end: dates[6], dates: dates });
            cur = addDays(cur, 7);
        }
        return weeks;
    }
    function shiftMonth(key, d) {
        var p = key.split('-').map(Number);
        var dt = new Date(Date.UTC(p[0], p[1] - 1 + d, 1));
        return dt.getUTCFullYear() + '-' + String(dt.getUTCMonth() + 1).padStart(2, '0');
    }
    function metric() { return METRICS.filter(function (m) { return m.id === st.metric; })[0]; }

    async function loadPlans() {
        var weeks = st.weeks;
        var from = weeks[0].start, to = weeks[weeks.length - 1].end;
        var out = {};
        for (var off = 0; ; off += 1000) {
            var res = await st.db.from('rnp_plans').select('*').eq('cabinet_id', st.cab)
                .gte('plan_date', from).lte('plan_date', to).range(off, off + 999);
            if (res.error) throw res.error;
            (res.data || []).forEach(function (r) {
                (out[r.nm_id] = out[r.nm_id] || {})[r.plan_date] = r;
            });
            if (!res.data || res.data.length < 1000) break;
        }
        st.plans = out;
    }

    // Значение недели: если на все 7 дней одинаково — оно; пусто — ''; если дни разные — null (покажем «разн.»).
    function weekValue(nm, week) {
        var col = st.metric;
        var vals = week.dates.map(function (d) {
            var r = st.plans[nm] && st.plans[nm][d];
            return r && r[col] != null ? Number(r[col]) : null;
        });
        if (vals.every(function (v) { return v == null; })) return '';
        var first = vals[0];
        return vals.every(function (v) { return v === first; }) && first != null ? first : null;
    }

    function cellHtml(a, w) {
        var v = weekValue(a.nm_id, w);
        var m = metric();
        var shown = v === '' ? '' : (v === null ? '' : String(v));
        var ph = v === null ? 'разн.' : '—';
        var tot = m.sum && typeof v === 'number' && v > 0 ? '<span class="rnp-plan-sum" title="Итого за неделю">Σ ' + Math.round(v * 7).toLocaleString('ru') + '</span>' : '';
        return '<td class="rnp-plan-cell' + (v === null ? ' is-mixed' : '') + '"><div class="rnp-plan-cellbox">' +
            '<input type="text" inputmode="decimal" data-nm="' + a.nm_id + '" data-w="' + w.n + '" value="' + esc(shown) + '" placeholder="' + ph + '">' +
            '<button type="button" class="rnp-plan-fill" data-fill data-nm="' + a.nm_id + '" data-w="' + w.n + '" title="Поставить это значение на все недели месяца">⇉</button></div>' + tot + '</td>';
    }

    function render() {
        var host = st.host;
        var m = metric();
        var q = (st.query || '').toLowerCase();
        var list = st.articles.filter(function (a) { return !q || String(a.name).toLowerCase().indexOf(q) >= 0 || String(a.nm_id).indexOf(q) >= 0; });
        var p = st.monthKey.split('-').map(Number);
        var tabs = METRICS.map(function (x) {
            return '<button type="button" class="rnp-plan-tab' + (x.id === st.metric ? ' is-on' : '') + '" data-metric="' + x.id + '">' + x.label + '</button>';
        }).join('');
        var head = st.weeks.map(function (w) {
            return '<th><b>' + w.n + ' нед</b><span>' + ddmm(w.start) + '–' + ddmm(w.end) + '</span></th>';
        }).join('');
        var body = list.map(function (a) {
            return '<tr><th class="rnp-plan-art" title="' + esc(a.name) + '">' + esc(a.name) + '</th>' + st.weeks.map(function (w) { return cellHtml(a, w); }).join('') + '</tr>';
        }).join('');
        host.innerHTML =
            '<div class="rnp-plan-head"><div class="rnp-plan-title">Планирование</div>' +
            '<div class="rnp-plan-month"><button type="button" data-month="-1" aria-label="Предыдущий месяц">‹</button><b>' + MONTHS[p[1] - 1] + ' ' + p[0] + '</b><button type="button" data-month="1" aria-label="Следующий месяц">›</button></div>' +
            '<input class="rnp-plan-search" type="search" placeholder="Поиск артикула" value="' + esc(st.query || '') + '">' +
            '<button type="button" class="rnp-plan-close" data-close aria-label="Закрыть">×</button></div>' +
            '<div class="rnp-plan-tabs">' + tabs + '<span class="rnp-plan-unit">' + m.unit + '</span></div>' +
            '<div class="rnp-plan-hint">Впиши число в неделю: оно встанет на все 7 дней этой недели в РНП (строка плана). Пусто — план не задан.</div>' +
            '<div class="rnp-plan-scroll"><table class="rnp-plan-table"><thead><tr><th>Артикул</th>' + head + '</tr></thead><tbody>' +
            (body || '<tr><td colspan="' + (st.weeks.length + 1) + '" class="rnp-plan-empty">Нет артикулов</td></tr>') + '</tbody></table></div>';
    }

    async function saveWeek(nm, week, raw, silent) {
        var col = st.metric;
        var t = String(raw == null ? '' : raw).trim().replace(',', '.');
        var val = t === '' ? null : Number(t);
        if (t !== '' && !Number.isFinite(val)) return false;
        var now = new Date().toISOString();
        var rows = week.dates.map(function (d) {
            var o = { cabinet_id: st.cab, nm_id: Number(nm), plan_date: d, updated_at: now };
            o[col] = val;
            return o;
        });
        var res = await st.db.from('rnp_plans').upsert(rows, { onConflict: 'cabinet_id,nm_id,plan_date' });
        if (res.error) { if (root.console) console.warn('[planning] save', res.error.message); return false; }
        week.dates.forEach(function (d) {
            var r = ((st.plans[nm] = st.plans[nm] || {})[d] = st.plans[nm][d] || { nm_id: Number(nm), plan_date: d });
            r[col] = val;
        });
        if (!silent && st.onSaved) st.onSaved();
        return true;
    }

    function onEvent(e) {
        var t = e.target;
        if (e.type === 'change' && t.matches('.rnp-plan-cell input')) {
            var w = st.weeks[Number(t.dataset.w) - 1];
            saveWeek(t.dataset.nm, w, t.value).then(function (ok) {
                t.classList.toggle('is-err', !ok);
                if (ok) { var keep = st.host.querySelector('.rnp-plan-scroll').scrollTop; render(); st.host.querySelector('.rnp-plan-scroll').scrollTop = keep; }
            });
            return;
        }
        if (e.type === 'input' && t.matches('.rnp-plan-search')) { st.query = t.value; var pos = t.selectionStart; render(); var s = st.host.querySelector('.rnp-plan-search'); s.focus(); s.setSelectionRange(pos, pos); return; }
        if (e.type !== 'click') return;
        var b = t.closest('button');
        if (!b) return;
        if (b.hasAttribute('data-close')) { close(); return; }
        if (b.dataset.metric) { st.metric = b.dataset.metric; render(); return; }
        if (b.dataset.month) {
            st.monthKey = shiftMonth(st.monthKey, Number(b.dataset.month));
            st.weeks = weeksOf(st.monthKey);
            loadPlans().then(render).catch(function () { render(); });
            return;
        }
        if (b.hasAttribute('data-fill')) {
            var inp = b.parentNode.querySelector('input');
            var val = inp.value;
            var nm = b.dataset.nm;
            Promise.all(st.weeks.map(function (wk) { return saveWeek(nm, wk, val, true); })).then(function () {
                if (st.onSaved) st.onSaved();
                render();
            });
        }
    }

    function close() {
        var el = document.getElementById('rnp-planning-overlay');
        if (el) el.remove();
        document.removeEventListener('keydown', onKey, true);
        st = null;
    }
    function onKey(e) { if (e.key === 'Escape') close(); }

    async function open(opts) {
        close();
        var overlay = document.createElement('div');
        overlay.id = 'rnp-planning-overlay';
        overlay.className = 'rnp-plan-overlay';
        overlay.innerHTML = '<div class="rnp-plan-panel" role="dialog" aria-label="Планирование"></div>';
        document.body.appendChild(overlay);
        var key = String(opts.monthKey || '').slice(0, 7);
        if (!/^\d{4}-\d{2}$/.test(key)) key = new Date().toISOString().slice(0, 7);
        st = { db: opts.db, cab: opts.cabinetId, articles: opts.articles || [], monthKey: key, weeks: weeksOf(key), metric: 'planned_orders', plans: {}, query: '', host: overlay.firstChild, onSaved: opts.onSaved };
        overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });
        overlay.addEventListener('click', onEvent);
        overlay.addEventListener('change', onEvent);
        overlay.addEventListener('input', onEvent);
        document.addEventListener('keydown', onKey, true);
        st.host.innerHTML = '<div class="rnp-plan-loading">Загрузка…</div>';
        try { await loadPlans(); } catch (e) { st.host.innerHTML = '<div class="rnp-plan-loading">Не удалось загрузить планы: ' + esc(e && e.message) + '</div>'; return; }
        render();
    }

    root.NrPlanning = { open: open, close: close, weeksOf: weeksOf };
})(typeof window !== 'undefined' ? window : globalThis);

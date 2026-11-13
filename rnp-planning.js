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

    // Дни недели с разными значениями (план вносили по дням в РНП): считаем сумму и среднее по заполненным дням.
    function weekStats(nm, week) {
        var col = st.metric, sum = 0, n = 0, per = [];
        week.dates.forEach(function (d) {
            var r = st.plans[nm] && st.plans[nm][d];
            var v = r && r[col] != null ? Number(r[col]) : null;
            if (v != null) { sum += v; n++; }
            per.push(d.slice(8) + '.' + d.slice(5, 7) + ': ' + (v == null ? '—' : v));
        });
        return { sum: sum, n: n, avg: n ? sum / n : 0, per: per.join('; ') };
    }

    function cellHtml(a, w) {
        var v = weekValue(a.nm_id, w);
        var m = metric();
        var shown = v === '' ? '' : (v === null ? '' : String(v));
        var mixed = v === null ? weekStats(a.nm_id, w) : null;
        var ph = v === null ? 'ср. ' + (Math.round(mixed.avg * 10) / 10) : '—';
        var tot = m.sum && typeof v === 'number' && v > 0
            ? '<span class="rnp-plan-sum" title="Итого за неделю">Σ ' + Math.round(v * 7).toLocaleString('ru') + '</span>'
            : (m.sum && mixed ? '<span class="rnp-plan-sum" title="По дням: ' + esc(mixed.per) + '">Σ ' + Math.round(mixed.sum).toLocaleString('ru') + ' · по дням</span>' : '');
        return '<td class="rnp-plan-cell' + (v === null ? ' is-mixed' : '') + '"><div class="rnp-plan-cellbox">' +
            '<input type="text" inputmode="decimal" data-nm="' + a.nm_id + '" data-w="' + w.n + '" value="' + esc(shown) + '" placeholder="' + ph + '">' +
            '<button type="button" class="rnp-plan-fill" data-fill data-nm="' + a.nm_id + '" data-w="' + w.n + '" title="Поставить это значение на все недели месяца">⇉</button></div>' + tot + '</td>';
    }

    function renderRnp() {
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
            '<button type="button" class="rnp-plan-close" data-close aria-label="Закрыть">' + (st.pageHost ? '‹ РНП' : '×') + '</button></div>' +
            '<div class="rnp-plan-tabs">' + tabs + '<span class="rnp-plan-unit">' + m.unit + '</span></div>' +
            '<div class="rnp-plan-hint">Впиши число в неделю: оно встанет на все 7 дней этой недели в РНП (строка плана). Пусто — план не задан.</div>' +
            '<div class="rnp-plan-scroll"><table class="rnp-plan-table"><thead><tr><th>Артикул</th>' + head + '</tr></thead><tbody>' +
            (body || '<tr><td colspan="' + (st.weeks.length + 1) + '" class="rnp-plan-empty">Нет артикулов</td></tr>') + '</tbody></table></div>';
    }


    // ===== Листы как в Excel: «План продаж» (по артикулам и неделям) и «План вывода денег» (считается формулами) =====
    var MSHORT = ['янв.', 'фев.', 'мар.', 'апр.', 'май', 'июн.', 'июл.', 'авг.', 'сен.', 'окт.', 'ноя.', 'дек.'];
    var SROWS = [
        { k: 'units', label: 'План продаж, шт', input: 1 },
        { k: 'price', label: 'Цена продажи, ₽', input: 1 },
        { k: 'rev', label: 'Выручка, ₽' },
        { k: 'wb', label: 'Удержания WB, %', input: 1 },
        { k: 'pay', label: 'План к перечислению, ₽', bold: 1 },
        { k: 'cogs', label: 'Себестоимость ед., ₽', input: 1 },
        { k: 'mkt', label: 'Затраты на маркетинг, ₽', input: 1 },
        { k: 'sup', label: 'Поставки, шт', input: 1 },
        { k: 'profit', label: 'План ЧП, ₽', bold: 1 },
    ];
    function num(v) { var n = Number(v); return Number.isFinite(n) ? n : 0; }
    function has(v) { return v !== undefined && v !== null && v !== ''; }
    // формулы одной недели одного артикула: выручка = шт × цена; к перечислению = выручка − удержания WB;
    // ЧП = к перечислению − себестоимость × шт − маркетинг
    function calcWeek(d) {
        d = d || {};
        var rev = num(d.units) * num(d.price);
        var pay = rev * (1 - num(d.wb) / 100);
        var cogs = num(d.units) * num(d.cogs);
        var any = has(d.units) || has(d.price) || has(d.mkt) || has(d.sup);
        return { rev: rev, pay: pay, cogs: cogs, profit: pay - cogs - num(d.mkt), mkt: num(d.mkt), sup: num(d.sup), any: any };
    }
    function sheetWeeks(startYmd, count) {
        var out = [], cur = mondayOnOrBefore(startYmd);
        for (var i = 0; i < count; i++) { out.push({ start: cur, end: addDays(cur, 6), month: Number(cur.slice(5, 7)) - 1, year: Number(cur.slice(0, 4)) }); cur = addDays(cur, 7); }
        return out;
    }
    // итог недели по всем блокам: это и есть вторая страница
    function moneyPlan(blocks, weeks) {
        return weeks.map(function (w) {
            var t = { pay: 0, profit: 0, mkt: 0, sup: 0, rev: 0, any: false };
            blocks.forEach(function (b) {
                var c = calcWeek((b.data || {})[w.start]);
                t.pay += c.pay; t.profit += c.profit; t.mkt += c.mkt; t.sup += c.sup; t.rev += c.rev; if (c.any) t.any = true;
            });
            return t;
        });
    }
    function sumPlan(rows) {
        return rows.reduce(function (a, r) { a.pay += r.pay; a.profit += r.profit; a.mkt += r.mkt; a.sup += r.sup; a.rev += r.rev; return a; }, { pay: 0, profit: 0, mkt: 0, sup: 0, rev: 0 });
    }
    function sheetKey() { return 'nr_plansheet_' + (st && st.cab); }
    function loadSheet() {
        var sh = null;
        try { sh = JSON.parse(localStorage.getItem(sheetKey()) || 'null'); } catch (e) { sh = null; }
        if (!sh || !Array.isArray(sh.blocks) || !sh.blocks.length) sh = { blocks: [{ id: 'b1', nm: '', data: {} }] };
        if (!sh.start) sh.start = mondayOnOrBefore(new Date().toISOString().slice(0, 8) + '01');
        sh.count = 52;
        return sh;
    }
    var saveTimer = null, saveState = 'saved';
    function setSaveState(v) {
        saveState = v;
        var el = st && st.host && st.host.querySelector('.ps-save');
        if (el) { el.textContent = v === 'saved' ? 'Сохранено' : v === 'saving' ? 'Сохраняю…' : 'Не сохранилось, повторю'; el.setAttribute('data-s', v); }
    }
    // сразу в память браузера (экран не ждёт), в базу уходит через долю секунды одним запросом
    function saveSheet() {
        try { localStorage.setItem(sheetKey(), JSON.stringify({ blocks: st.sheet.blocks, start: st.sheet.start })); } catch (e) { /* без памяти */ }
        setSaveState('saving');
        clearTimeout(saveTimer);
        saveTimer = setTimeout(flushSheet, 700);
    }
    async function flushSheet() {
        clearTimeout(saveTimer); saveTimer = null;
        var cur = st; if (!cur || !cur.sheet || !cur.db) return;
        var res = await cur.db.from('rnp_plan_sheet').upsert({ cabinet_id: cur.cab, data: { blocks: cur.sheet.blocks }, start_week: cur.sheet.start, updated_at: new Date().toISOString() }, { onConflict: 'cabinet_id' });
        if (res && res.error) { if (root.console) console.warn('[planning] sheet save', res.error.message); if (st === cur) { setSaveState('error'); saveTimer = setTimeout(flushSheet, 5000); } return; }
        if (st === cur && !saveTimer) setSaveState('saved');
    }
    // с сервера: показываем то, что в памяти браузера, и тихо подменяем свежим из базы (если не печатают)
    async function pullSheet() {
        var cur = st; if (!cur || !cur.db) return;
        var res = await cur.db.from('rnp_plan_sheet').select('data,start_week').eq('cabinet_id', cur.cab).maybeSingle();
        if (st !== cur || (res && res.error)) return;
        var row = res && res.data;
        if (row && row.data && Array.isArray(row.data.blocks) && row.data.blocks.length) {
            if (saveTimer) return; // свои правки ещё не ушли, они главнее
            cur.sheet.blocks = row.data.blocks; if (row.start_week) cur.sheet.start = row.start_week;
            try { localStorage.setItem(sheetKey(), JSON.stringify({ blocks: cur.sheet.blocks, start: cur.sheet.start })); } catch (e) { /* без памяти */ }
            var typing = document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('ps-in');
            if (!typing && cur.view !== 'rnp') keepScroll(render);
        } else if (cur.sheet.blocks.some(function (b) { return b.nm || Object.keys(b.data || {}).length; })) {
            flushSheet(); // в базе пусто, а в этом браузере уже есть планы: переносим
        }
    }
    function fnum(v, any) { return any ? Math.round(v).toLocaleString('ru') : ''; }

    function viewTabs() {
        var V = [['sales', 'План продаж'], ['money', 'План вывода денег'], ['rnp', 'План для РНП']];
        return '<div class="ps-tabs">' + V.map(function (x) { return '<button type="button" class="ps-tab' + (st.view === x[0] ? ' is-on' : '') + '" data-view="' + x[0] + '">' + x[1] + '</button>'; }).join('') +
            (st.view === 'rnp' ? '' : '<span class="ps-save" data-s="' + saveState + '">' + (saveState === 'saved' ? 'Сохранено' : saveState === 'saving' ? 'Сохраняю…' : 'Не сохранилось, повторю') + '</span><button type="button" class="rnp-plan-close ps-back" data-close>‹ РНП</button>') + '</div>';
    }
    function monthSpans(weeks) {
        var out = [], last = null;
        weeks.forEach(function (w) {
            var key = w.year + '-' + w.month;
            if (last && last.key === key) last.n++; else { last = { key: key, n: 1, label: MSHORT[w.month] }; out.push(last); }
        });
        return out;
    }
    function inCell(b, w, r) {
        var v = ((b.data || {})[w.start] || {})[r.k];
        return '<td class="ps-c' + (w.first ? ' ps-m' : '') + '"><input class="ps-in" type="text" inputmode="decimal" data-b="' + b.id + '" data-w="' + w.start + '" data-k="' + r.k + '" value="' + esc(has(v) ? v : '') + '"></td>';
    }
    function calcCell(b, w, r) {
        var c = calcWeek((b.data || {})[w.start]);
        return '<td class="ps-c ps-calc' + (w.first ? ' ps-m' : '') + (r.bold ? ' ps-bold' : '') + '" data-calc="' + b.id + '|' + w.start + '|' + r.k + '">' + fnum(c[r.k], c.any) + '</td>';
    }
    function renderSales() {
        var sh = st.sheet, weeks = sheetWeeks(sh.start, sh.count), spans = monthSpans(weeks);
        var seen = {}; weeks.forEach(function (w) { var k = w.year + '-' + w.month; w.first = !seen[k]; seen[k] = 1; });
        var head = '<tr class="ps-h1"><th class="ps-l"></th>' + spans.map(function (m) { return '<th colspan="' + m.n + '" class="ps-m">' + m.label + '</th>'; }).join('') + '</tr>' +
            '<tr class="ps-h2"><th class="ps-l">Неделя с</th>' + weeks.map(function (w) { return '<th class="' + (w.first ? 'ps-m' : '') + '">' + ddmm(w.start) + '</th>'; }).join('') + '</tr>' +
            '<tr class="ps-h3"><th class="ps-l">по</th>' + weeks.map(function (w) { return '<th class="' + (w.first ? 'ps-m' : '') + '">' + ddmm(w.end) + '</th>'; }).join('') + '</tr>';
        var total = moneyPlan(sh.blocks, weeks);
        var top = '<tr class="ps-all"><th class="ps-l">Все артикулы · Выручка, ₽</th>' + total.map(function (t, i) { return '<td class="ps-c ps-calc' + (weeks[i].first ? ' ps-m' : '') + '" data-all="' + weeks[i].start + '">' + fnum(t.rev, t.any) + '</td>'; }).join('') + '</tr>';
        var opts = function (b) {
            return '<option value="">Выберите артикул</option>' + st.articles.map(function (a) { return '<option value="' + a.nm_id + '"' + (String(a.nm_id) === String(b.nm) ? ' selected' : '') + '>' + esc(a.name) + ' · ' + a.nm_id + '</option>'; }).join('');
        };
        var body = sh.blocks.map(function (b) {
            return '<tr class="ps-bh"><th class="ps-l" colspan="' + (weeks.length + 1) + '"><select class="ps-art" data-ps-art="' + b.id + '">' + opts(b) + '</select>' +
                (sh.blocks.length > 1 ? '<button type="button" class="ps-del" data-ps-del="' + b.id + '" aria-label="Убрать блок">×</button>' : '') + '</th></tr>' +
                SROWS.map(function (r) {
                    return '<tr class="ps-r' + (r.bold ? ' ps-rb' : '') + '"><th class="ps-l">' + r.label + '</th>' + weeks.map(function (w) { return r.input ? inCell(b, w, r) : calcCell(b, w, r); }).join('') + '</tr>';
                }).join('');
        }).join('');
        st.host.innerHTML = viewTabs() +
            '<div class="ps-note">Заполняйте перед запуском: продажи, цену, удержания WB, себестоимость, маркетинг и поставки по неделям. Выручка, к перечислению и ЧП считаются сами, лист «План вывода денег» собирается из этих блоков. План продаж (шт в неделю) сам попадает в строку «План продаж» РНП по выбранному артикулу: неделя ÷ 7 на каждый день.</div>' +
            '<div class="ps-scroll"><table class="ps-table"><thead>' + head + '</thead><tbody>' + top + body + '</tbody></table></div>' +
            '<div class="ps-foot"><button type="button" class="ps-add" data-ps-add>+ Добавить артикул</button></div>';
    }
    function renderMoney() {
        var sh = st.sheet, weeks = sheetWeeks(sh.start, sh.count), plan = moneyPlan(sh.blocks, weeks), tot = sumPlan(plan);
        var rows = weeks.map(function (w, i) {
            var t = plan[i], first = i === 0 || weeks[i - 1].month !== w.month;
            return '<tr class="' + (first ? 'ps-mrow' : '') + '"><td class="ps-mo">' + MSHORT[w.month] + '</td><td>' + ddmm(w.start) + '</td><td>' + fnum(t.pay, t.any) + '</td><td>' + fnum(t.profit, t.any) + '</td><td>' + fnum(t.mkt, t.any) + '</td><td>' + fnum(t.sup, t.any) + '</td></tr>';
        }).join('');
        var any = plan.some(function (t) { return t.any; });
        st.host.innerHTML = viewTabs() +
            '<div class="ps-note">Считается само из листа «План продаж»: ничего вводить не нужно.</div>' +
            '<div class="ps-scroll ps-money"><table class="ps-table ps-mt"><thead><tr><th colspan="6" class="ps-title">Приблизительный план вывода денег</th></tr>' +
            '<tr class="ps-mh"><th>Месяц</th><th>Неделя</th><th>План к перечислению, ₽</th><th>План ЧП, ₽</th><th>Затраты на маркетинг, ₽</th><th>Поставки, шт</th></tr></thead><tbody>' + rows +
            '<tr class="ps-tot"><td colspan="2">Итого</td><td>' + fnum(tot.pay, any) + '</td><td>' + fnum(tot.profit, any) + '</td><td>' + fnum(tot.mkt, any) + '</td><td>' + fnum(tot.sup, any) + '</td></tr></tbody></table></div>';
    }
    // пересчёт на месте после ввода: фокус и прокрутка не сбиваются
    function refreshCalc() {
        var weeks = sheetWeeks(st.sheet.start, st.sheet.count);
        st.host.querySelectorAll('[data-calc]').forEach(function (el) {
            var p = el.getAttribute('data-calc').split('|'), b = st.sheet.blocks.filter(function (x) { return x.id === p[0]; })[0];
            var c = calcWeek(b && (b.data || {})[p[1]]); el.textContent = fnum(c[p[2]], c.any);
        });
        var total = moneyPlan(st.sheet.blocks, weeks);
        st.host.querySelectorAll('[data-all]').forEach(function (el, i) { el.textContent = fnum(total[i].rev, total[i].any); });
    }

    // План продаж из листа ложится в РНП: неделя шт ÷ 7 на каждый день в rnp_plans.planned_sales (строка «План продаж» РНП)
    var unitQueue = {}, unitTimer = null;
    function weekDays(ymd) { var o = []; for (var i = 0; i < 7; i++) o.push(addDays(ymd, i)); return o; }
    function dayValue(units) { return has(units) ? Math.round(num(units) / 7 * 1e6) / 1e6 : null; }
    function queueUnits(nm, weekStart, units) {
        if (!nm) return;
        unitQueue[nm + '|' + weekStart] = { nm: Number(nm), week: weekStart, val: dayValue(units) };
        clearTimeout(unitTimer);
        unitTimer = setTimeout(flushUnits, 600);
    }
    async function flushUnits() {
        clearTimeout(unitTimer); unitTimer = null;
        var cur = st, q = unitQueue; unitQueue = {};
        var items = Object.keys(q).map(function (k) { return q[k]; });
        if (!cur || !cur.db || !items.length) return;
        var now = new Date().toISOString(), rows = [];
        items.forEach(function (it) { weekDays(it.week).forEach(function (d) { rows.push({ cabinet_id: cur.cab, nm_id: it.nm, plan_date: d, planned_sales: it.val, updated_at: now }); }); });
        var res = await cur.db.from('rnp_plans').upsert(rows, { onConflict: 'cabinet_id,nm_id,plan_date' });
        if (res && res.error) { if (root.console) console.warn('[planning] sync to RNP', res.error.message); items.forEach(function (it) { unitQueue[it.nm + '|' + it.week] = it; }); unitTimer = setTimeout(flushUnits, 5000); return; }
        if (cur.onSaved) cur.onSaved();
    }
    // выбрали другой артикул в блоке: у старого убираем план, новому ставим
    function resyncBlock(b, oldNm, newNm) {
        Object.keys(b.data || {}).forEach(function (w) {
            var u = (b.data[w] || {}).units; if (!has(u)) return;
            if (oldNm) queueUnits(oldNm, w, '');
            if (newNm) queueUnits(newNm, w, u);
        });
    }

    function onSheetEvent(e) {
        var t = e.target;
        if (e.type === 'change' && t.classList && t.classList.contains('ps-in')) {
            var b = st.sheet.blocks.filter(function (x) { return x.id === t.dataset.b; })[0]; if (!b) return true;
            var raw = String(t.value).trim().replace(/\s/g, '').replace(',', '.'), v = raw === '' ? '' : Number(raw);
            if (raw !== '' && !Number.isFinite(v)) { t.classList.add('is-err'); return true; }
            t.classList.remove('is-err');
            b.data = b.data || {}; var wk = (b.data[t.dataset.w] = b.data[t.dataset.w] || {});
            if (v === '') delete wk[t.dataset.k]; else wk[t.dataset.k] = v;
            if (t.dataset.k === 'units') queueUnits(b.nm, t.dataset.w, v);
            saveSheet(); refreshCalc(); return true;
        }
        if (e.type === 'change' && t.matches && t.matches('.ps-art')) {
            var bb = st.sheet.blocks.filter(function (x) { return x.id === t.dataset.psArt; })[0]; if (bb) { var oldNm = bb.nm; bb.nm = t.value; resyncBlock(bb, oldNm, bb.nm); saveSheet(); } return true;
        }
        if (e.type !== 'click') return false;
        var btn = t.closest && t.closest('button'); if (!btn) return false;
        if (btn.dataset.view) { st.view = btn.dataset.view; render(); if (st.view === 'rnp') loadPlans().then(function () { if (st && st.view === 'rnp') render(); }).catch(function () { /* без планов */ }); return true; }
        if (btn.hasAttribute('data-ps-add')) { st.sheet.blocks.push({ id: 'b' + Date.now().toString(36), nm: '', data: {} }); saveSheet(); keepScroll(renderSales); return true; }
        if (btn.dataset.psDel) { st.sheet.blocks = st.sheet.blocks.filter(function (x) { return x.id !== btn.dataset.psDel; }); saveSheet(); keepScroll(renderSales); return true; }
        return false;
    }
    function keepScroll(fn) {
        var sc = st.host.querySelector('.ps-scroll'), x = sc ? sc.scrollLeft : 0, y = sc ? sc.scrollTop : 0;
        fn(); sc = st.host.querySelector('.ps-scroll'); if (sc) { sc.scrollLeft = x; sc.scrollTop = y; }
    }
    function render() {
        if (st.pageHost && st.view !== 'rnp') { if (!st.sheet) st.sheet = loadSheet(); if (st.view === 'money') renderMoney(); else renderSales(); return; }
        renderRnp();
        if (st.pageHost) st.host.insertAdjacentHTML('afterbegin', viewTabs());
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
        if (st && st.pageHost && onSheetEvent(e)) return;
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

    var pageMode = false;
    function close() {
        var el = document.getElementById('rnp-planning-overlay');
        if (el) el.remove();
        document.removeEventListener('keydown', onKey, true);
        if (st && st.pageHost && st._h) { ['click', 'change', 'input'].forEach(function (t) { st.pageHost.removeEventListener(t, st._h); }); }
        var wasPage = pageMode; pageMode = false;
        if (saveTimer && st && st.sheet) flushSheet();
        st = null;
        if (wasPage && typeof root.showTab === 'function') root.showTab('rnp');
    }
    function onKey(e) { if (e.key === 'Escape') close(); }

    async function open(opts) {
        var ph = opts.host || null;
        if (pageMode && st && st.pageHost) { pageMode = false; ['click', 'change', 'input'].forEach(function (t) { st.pageHost.removeEventListener(t, st._h); }); st = null; } else { pageMode = false; close(); }
        var overlay = null;
        if (ph) {
            pageMode = true;
            ph.innerHTML = '<div class="rnp-plan-panel rnp-plan-page" aria-label="Планирование"></div>';
        } else {
            overlay = document.createElement('div');
            overlay.id = 'rnp-planning-overlay';
            overlay.className = 'rnp-plan-overlay';
            overlay.innerHTML = '<div class="rnp-plan-panel" role="dialog" aria-label="Планирование"></div>';
            document.body.appendChild(overlay);
        }
        var key = String(opts.monthKey || '').slice(0, 7);
        if (!/^\d{4}-\d{2}$/.test(key)) key = new Date().toISOString().slice(0, 7);
        st = { db: opts.db, cab: opts.cabinetId, articles: opts.articles || [], monthKey: key, weeks: weeksOf(key), metric: 'planned_orders', plans: {}, query: '', host: (overlay || ph).firstChild, pageHost: ph, view: ph ? 'sales' : 'rnp', onSaved: opts.onSaved };
        var evHost = overlay || ph;
        st._h = onEvent;
        if (overlay) overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });
        evHost.addEventListener('click', onEvent);
        evHost.addEventListener('change', onEvent);
        evHost.addEventListener('input', onEvent);
        document.addEventListener('keydown', onKey, true);
        if (ph) { render(); pullSheet().catch(function () { /* останется память браузера */ }); loadPlans().then(function () { if (st && st.view === 'rnp') render(); }).catch(function () { /* планы РНП подгрузятся при открытии вкладки */ }); return; }
        st.host.innerHTML = '<div class="rnp-plan-loading">Загрузка…</div>';
        try { await loadPlans(); } catch (e) { st.host.innerHTML = '<div class="rnp-plan-loading">Не удалось загрузить планы: ' + esc(e && e.message) + '</div>'; return; }
        render();
    }

    root.NrPlanning = { open: open, close: close, weeksOf: weeksOf, calcWeek: calcWeek, sheetWeeks: sheetWeeks, moneyPlan: moneyPlan, sumPlan: sumPlan };
})(typeof window !== 'undefined' ? window : globalThis);

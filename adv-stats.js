/* Окно кампании: «Статистика РК по дням и зонам показов» и «Ключевые фразы».
   Контракт: window.AdvStats.mount(el, ctx), ctx = { key, cabId, campaign: { wbId, ... }, currency? }.
   mount вызывается при каждой перерисовке окна для слотов <div class="adp2-slot" data-slot="stats|keys" data-key="…">
   и идемпотентен: вкладки, даты, столбцы и загруженные данные лежат в памяти по ключу кампании.
   Скорость (CLAUDE.md): каркас и прошлые цифры показываются сразу из памяти или localStorage, свежие подтягиваются
   в фоне и подставляются в таблицу без перерисовки каркаса; пока идёт загрузка, готовая таблица остаётся на месте (приглушена).
   Данные: advertising_daily_stats (по дням, из WB fullstats), rnp_daily_data.clicks (переходы в карточку по товару),
   wb-proxy adv_cluster_board (ключи) и adv_cluster_positions (частота и позиции). Разбивки по зонам показов
   (поиск/полки/каталог) WB API не отдаёт: эти строки и вкладки показывают «—», пока не появится источник. */
(function (root) {
    'use strict';
    var doc = root.document;
    var NB = ' ';
    var ST = {};
    var ZONES = [['search', 'поиск', 'p'], ['shelf', 'полки', 's'], ['catalog', 'каталог', 'c']];
    var DASH = '—';
    var CUR_NAMES = { KGS: 'сом', RUB: '₽', KZT: '₸', BYN: 'Br', UZS: 'сўм' };
    var CURRENCY = {}; // cabId -> символ

    /* ───────── форматы ───────── */
    function grp(n) { var s = String(Math.abs(Math.round(n))); return (n < 0 && Math.round(n) !== 0 ? '−' : '') + s.replace(/\B(?=(\d{3})+(?!\d))/g, NB); }
    function dec(n, d) {
        var neg = n < 0, s = Math.abs(n).toFixed(d), p = s.split('.');
        return (neg ? '−' : '') + p[0].replace(/\B(?=(\d{3})+(?!\d))/g, NB) + (p[1] ? ',' + p[1] : '');
    }
    function curSign(cabId) { return CURRENCY[cabId] || '₽'; }
    function curName(code) { code = String(code || '').toUpperCase(); return CUR_NAMES[code] || code || '₽'; }
    function fmt(kind, v, cur) {
        if (v == null || !isFinite(v)) return '';
        var c = NB + (cur || '₽');
        if (kind === 'int') return grp(v);
        if (kind === 'rub0') return grp(v) + c;
        if (kind === 'rub1') return dec(v, 1) + c;
        if (kind === 'rub2') return dec(v, 2) + c;
        if (kind === 'pct') return Math.abs(v) >= 100 ? grp(v) + '%' : dec(v, 2) + '%';
        return String(v);
    }
    function pad(n) { return n < 10 ? '0' + n : String(n); }
    function ruDate(ymd) { var p = String(ymd || '').split('-'); return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : ''; }
    function ymdOf(d) { return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
    function parseYmd(s) { var p = String(s || '').slice(0, 10).split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
    function addDays(ymd, n) { var d = parseYmd(ymd); d.setUTCDate(d.getUTCDate() + n); return ymdOf(d); }
    function todayYmd() { return ymdOf(new Date(Date.now() + 3 * 3600e3)); }
    var WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
    function dayLabel(ymd) { return ruDate(ymd) + ' / ' + WD[parseYmd(ymd).getUTCDay()]; }
    function validYmd(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !isNaN(parseYmd(s).getTime()); }
    function stamp(ms) { var d = new Date(ms); return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
    function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }

    /* ───────── колонки статистики ───────── */
    function ratio(a, b, k) { return b > 0 ? a / b * (k || 1) : null; }
    var COLS = [
        { id: 'views', g: 0, t: 'Показы', x: 'Показы', f: 'int', v: function (a) { return a.views; } },
        { id: 'cpm', g: 0, t: 'CPM', x: 'CPM', f: 'rub0', v: function (a) { return ratio(a.spend, a.views, 1000); } },
        { id: 'clicks', g: 0, t: 'Переходы', x: 'Переходы', f: 'int', v: function (a) { return a.clicks; } },
        { id: 'ctr', g: 0, t: 'CTR', x: 'CTR, %', f: 'pct', v: function (a) { return ratio(a.clicks, a.views, 100); } },
        { id: 'cpc', g: 0, t: 'CPC', x: 'CPC', f: 'rub1', v: function (a) { return ratio(a.spend, a.clicks); } },
        { id: 'spend', g: 0, t: 'Затраты', x: 'Затраты', f: 'rub0', v: function (a) { return a.spend; } },
        { id: 'atbs', g: 1, t: 'Корзин', x: 'Корзин', f: 'int', v: function (a) { return a.atbs; }, sm: function (a) { return ratio(a.atbs, a.clicks, 100); }, smx: 'Корзин, % от переходов' },
        { id: 'cpl', g: 1, t: 'CPL', x: 'CPL', f: 'rub0', v: function (a) { return ratio(a.spend, a.atbs); } },
        { id: 'orders', g: 1, t: 'Заказы', x: 'Заказы', f: 'int', v: function (a) { return a.orders; }, sm: function (a) { return ratio(a.orders, a.atbs, 100); }, smx: 'Заказы, % от корзин' },
        { id: 'cpo', g: 1, t: 'CPO', x: 'CPO', f: 'rub0', v: function (a) { return ratio(a.spend, a.orders); } },
        { id: 'sum', g: 1, t: 'Заказы ₽', x: 'Заказы, сумма', f: 'rub0', v: function (a) { return a.sum; } },
        { id: 'cro', g: 1, t: 'CRO', x: 'CRO, %', f: 'pct', v: function (a) { return ratio(a.orders, a.clicks, 100); } },
        { id: 'drr', g: 1, t: 'ДРР РК', x: 'ДРР РК, %', f: 'pct', v: function (a) { return ratio(a.spend, a.sum, 100); } },
        // «Всего по товару (реклама + органика)»: просмотры карточек WB API не отдаёт, переходы берём из воронки (rnp_daily_data)
        { id: 'pviews', g: 2, t: 'Просмотры', x: 'Просмотры (товар)', f: 'int', nodata: true, v: function () { return null; } },
        { id: 'pclicks', g: 2, t: 'Переходы', x: 'Переходы (товар)', f: 'int', v: function (a) { return a.pclicks; } },
        { id: 'pctr', g: 2, t: 'CTR общий', x: 'CTR общий, %', f: 'pct', nodata: true, v: function () { return null; } },
    ];
    var GROUPS = ['Статистика РК', 'Эффективность РК (товар + ассоц. конверсии)', 'Всего по товару (реклама + органика)'];
    var GROUP_LABEL = ['Статистика РК', 'Эффективность РК', 'Всего по товару'];

    function emptyAgg() { return { views: 0, clicks: 0, spend: 0, atbs: 0, orders: 0, sum: 0, pclicks: null }; }
    function addAgg(t, a) {
        t.views += a.views; t.clicks += a.clicks; t.spend += a.spend; t.atbs += a.atbs; t.orders += a.orders; t.sum += a.sum;
        if (a.pclicks != null) t.pclicks = (t.pclicks || 0) + a.pclicks;
        return t;
    }
    function aggOfRow(r, prodByDate) {
        var a = { views: num(r.views), clicks: num(r.clicks), spend: num(r.spend), atbs: num(r.atbs), orders: num(r.orders), sum: num(r.sum_price != null ? r.sum_price : r.sum), pclicks: null };
        if (prodByDate) a.pclicks = prodByDate[r.stat_date || r.date] || 0;
        return a;
    }

    /** Номера товаров кампании из сырого дня WB (days[].apps[].nms[].nmId). */
    function nmsOfDay(day) {
        var out = {};
        try {
            var apps = (day && day.apps) || [];
            for (var i = 0; i < apps.length; i++) { var nms = apps[i].nms || []; for (var j = 0; j < nms.length; j++) { var n = Number(nms[j].nmId || nms[j].nm_id); if (n > 0) out[n] = 1; } }
        } catch (e) { /* без товаров просто нет колонки «по товару» */ }
        return Object.keys(out).map(Number);
    }

    /** Строки дней в диапазоне: свежие первыми; дни без данных помечены none. */
    function daysOf(rows, from, to) {
        var by = {}; (rows || []).forEach(function (r) { by[r.date] = r; });
        var out = [], d = to, guard = 0;
        while (d >= from && guard++ < 800) { out.push(by[d] || { date: d, none: true }); d = addDays(d, -1); }
        return out;
    }

    /**
     * Модель таблицы для вкладки: список строк с готовыми ячейками. HTML и экспорт строятся из одной модели.
     * tab: z (по зонам), d (по дням), s/p/c (одна зона). zones: { 'YYYY-MM-DD': { search: agg, shelf: agg, catalog: agg } } или null.
     */
    function buildModel(data, tab, hidden, cur) {
        var cols = COLS.filter(function (c) { return !(hidden && hidden[c.id]); });
        var days = daysOf(data.rows, data.from, data.to);
        var haveProd = !!data.prodOk;
        var rowsByDate = {};
        days.forEach(function (r) { rowsByDate[r.date] = r; });
        function aggDay(r) { var a = aggOfRow(r, haveProd ? data.prod : null); if (!haveProd) a.pclicks = null; return a; }
        var zone = tab === 'z' || tab === 'd' ? null : ZONES.filter(function (z) { return z[2] === tab; })[0];
        function zoneAgg(date, zi) { var zz = data.zones && data.zones[date]; return zz && zz[ZONES[zi][0]] ? zz[ZONES[zi][0]] : null; }
        function cell(col, a, mode) {
            // mode: num | none (нет данных за день) | nodata (нет источника) | blank
            if (mode === 'blank') return { v: null, txt: '', g2: col.g === 2 };
            if (mode === 'nodata' || (col.nodata && mode !== 'blank')) return { v: null, txt: DASH, dash: true, g2: col.g === 2 };
            if (!a) return { v: null, txt: DASH, dash: true, g2: col.g === 2 };
            var v = col.v(a);
            if (col.id === 'pclicks' && a.pclicks == null) return { v: null, txt: DASH, dash: true, g2: true };
            var o = { v: v, txt: fmt(col.f, v, cur), g2: col.g === 2 };
            if (col.sm) { var s = col.sm(a); o.sm = s != null ? Math.round(s) + '%' : ''; o.smv = s; }
            return o;
        }
        function cellsFor(a, mode, sub) {
            return cols.map(function (c) { return cell(c, a, sub && c.g === 2 ? 'blank' : mode); });
        }
        var total = emptyAgg(), anyRow = false;
        days.forEach(function (r) { if (!r.none) { anyRow = true; addAgg(total, aggDay(r)); } });
        if (!haveProd) total.pclicks = null;
        var rows = [];
        var sumRow = { kind: 'sum', label: 'За период', cells: cellsFor(anyRow ? total : null, anyRow ? 'num' : 'none', false) };
        var band = { kind: 'band', label: 'По дням', cells: cols.map(function (c) { return { txt: c.t, g2: c.g === 2 }; }) };
        function zoneSubs(date, totalViews) {
            return ZONES.map(function (z, zi) {
                var za = date ? zoneAgg(date, zi) : data.zoneTotal && data.zoneTotal[zi];
                var share = za && totalViews > 0 ? Math.round(za.views / totalViews * 100) + '%' : DASH;
                return { kind: 'sub', label: z[1], share: share, date: date || null, zone: z[1], cells: cellsFor(za, za ? 'num' : 'nodata', true) };
            });
        }
        if (tab === 'z') {
            rows.push(sumRow); Array.prototype.push.apply(rows, zoneSubs(null, total.views)); rows.push(band);
        } else if (tab === 'd') {
            rows.push(sumRow); rows.push(band);
        } else {
            var zi0 = ZONES.indexOf(zone);
            var zt = data.zoneTotal && data.zoneTotal[zi0];
            rows.push(band);
            rows.push({ kind: 'sum', label: 'За период', cells: cellsFor(zt, zt ? 'num' : 'nodata', true) });
        }
        days.forEach(function (r) {
            if (tab === 'z' || tab === 'd') {
                var a = r.none ? null : aggDay(r);
                rows.push({ kind: 'day', none: !!r.none, date: r.date, label: dayLabel(r.date), cells: cellsFor(a, r.none ? 'none' : 'num', false) });
                if (tab === 'z') Array.prototype.push.apply(rows, zoneSubs(r.date, a ? a.views : 0));
            } else {
                var zi = ZONES.indexOf(zone), za = zoneAgg(r.date, zi);
                rows.push({ kind: 'day', none: !za, date: r.date, label: dayLabel(r.date), cells: cellsFor(za, za ? 'num' : 'nodata', true) });
            }
        });
        // ряды мини-графиков: по дням от старых к новым
        var chrono = days.slice().reverse().filter(function (r) { return !r.none; });
        var spark = cols.map(function (c) {
            return chrono.map(function (r) { var a = aggDay(r), v = c.v(a); return v == null || !isFinite(v) ? 0 : Math.max(0, v); });
        });
        return { cols: cols, rows: rows, spark: spark, days: days.length };
    }

    function sparkSvg(series) {
        var n = series.length, W = 54, H = 16;
        if (!n) return '';
        var b = series;
        if (n > 18) {
            b = []; for (var i = 0; i < 18; i++) { var s = Math.floor(i * n / 18), e = Math.floor((i + 1) * n / 18), t = 0, k = 0; for (var j = s; j < Math.max(e, s + 1); j++) { t += series[j]; k++; } b.push(t / k); }
        }
        var max = 0; b.forEach(function (v) { if (v > max) max = v; });
        if (!(max > 0)) return '<svg width="' + W + '" height="' + H + '" aria-hidden="true"></svg>';
        var out = '<svg width="' + W + '" height="' + H + '" fill="currentColor" opacity=".45" aria-hidden="true">';
        b.forEach(function (v, i) { var h = v > 0 ? Math.max(2, Math.round(v / max * 14)) : 1; out += '<rect x="' + i * 3 + '" y="' + (H - h) + '" width="2" height="' + h + '"/>'; });
        return out + '</svg>';
    }

    function cellHtml(c, sk, cls) {
        var cl = (c.g2 ? 'g2c' : '') + (c.dash ? ' dim' : '') + (cls ? ' ' + cls : '');
        var inner = esc(c.txt) + (c.sm ? '<small>' + esc(c.sm) + '</small>' : '');
        if (sk && c.txt) inner = '<span class="sk">' + inner + '</span>';
        return '<td' + (cl.trim() ? ' class="' + cl.trim() + '"' : '') + '>' + inner + '</td>';
    }
    function tableHtml(model, sk) {
        var cols = model.cols, i, h = '<table class="t"><thead><tr><th class="d" rowspan="2">Дата</th>';
        for (var g = 0; g < 3; g++) {
            var n = cols.filter(function (c) { return c.g === g; }).length;
            if (n) h += '<th colspan="' + n + '"' + (g === 2 ? ' class="g2"' : '') + '>' + esc(GROUPS[g]) + '</th>';
        }
        h += '</tr><tr>' + cols.map(function (c) { return '<th' + (c.g === 2 ? ' class="g2"' : '') + '>' + esc(c.t) + '</th>'; }).join('') + '</tr>';
        h += '<tr class="spk"><th class="d">Графики</th>' + cols.map(function (c, k) { return '<th' + (c.g === 2 ? ' class="g2"' : '') + '>' + sparkSvg(model.spark[k]) + '</th>'; }).join('') + '</tr></thead><tbody>';
        for (i = 0; i < model.rows.length; i++) {
            var r = model.rows[i];
            if (r.kind === 'band') {
                h += '<tr class="band"><td class="d">' + esc(r.label) + '</td>' + r.cells.map(function (c) { return '<td>' + esc(c.txt) + '</td>'; }).join('') + '</tr>';
            } else if (r.kind === 'sub') {
                h += '<tr class="sub"><td class="d">' + esc(r.label) + ' <b>' + esc(r.share) + '</b></td>' + r.cells.map(function (c) { return cellHtml(c, sk); }).join('') + '</tr>';
            } else {
                h += '<tr class="' + r.kind + (r.none ? ' none' : '') + '"><td class="d">' + (sk ? '<span class="sk">' : '') + esc(r.label) + (sk ? '</span>' : '') + '</td>' + r.cells.map(function (c) { return cellHtml(c, sk); }).join('') + '</tr>';
            }
        }
        return h + '</tbody></table>';
    }

    /** Заглушка-каркас, пока нет ни кэша, ни данных: строки есть, цифры размыты. */
    function skeletonData(from, to) {
        var rows = [], d = to, k = 0;
        while (d >= from && k < 9) { rows.push({ date: d, stat_date: d, views: 7000 + k * 913 % 5000, clicks: 230 + k * 37, spend: 1534 - k * 60, atbs: 26 + k, orders: 5 + k % 3, sum_price: 29546 - k * 900 }); d = addDays(d, -1); k++; }
        return { rows: rows, from: rows.length ? rows[rows.length - 1].date : from, to: to, prod: {}, prodOk: true, zones: null, zoneTotal: null };
    }

    /* ───────── экспорт ───────── */
    function exportRows(model) {
        var head = ['Дата'].concat(model.cols.map(function (c) { return c.x; }));
        var out = [head];
        model.rows.forEach(function (r) {
            if (r.kind === 'band') return;
            var label = r.kind === 'sub' ? ((r.date ? ruDate(r.date) + ' ' : 'За период ') + r.zone) : (r.kind === 'day' ? ruDate(r.date) : r.label);
            out.push([label].concat(r.cells.map(function (c) { return c.v == null || !isFinite(c.v) ? '' : Math.round(c.v * 100) / 100; })));
        });
        return out;
    }
    function toCsv(rows) {
        return '﻿' + rows.map(function (r) {
            return r.map(function (v) {
                var s = typeof v === 'number' ? String(v).replace('.', ',') : String(v == null ? '' : v);
                return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
            }).join(';');
        }).join('\r\n');
    }
    function saveFile(rows, name) {
        if (root.NrXlsx && typeof root.NrXlsx.download === 'function') { root.NrXlsx.download(rows, name + '.xlsx'); return 'xlsx'; }
        var blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
        var a = doc.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name + '.csv';
        doc.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
        return 'csv';
    }

    /* ───────── состояние ───────── */
    function deps() { try { return (root.AdsHQ && root.AdsHQ.getDeps && root.AdsHQ.getDeps()) || {}; } catch (e) { return {}; } }
    function lsGet(k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { root.localStorage.setItem(k, v); } catch (e) { /* без хранилища работаем из памяти */ } }
    function savedCols() { try { return JSON.parse(lsGet('nr_advs_cols_v1') || '{}') || {}; } catch (e) { return {}; } }

    function defaultRange() {
        var to = todayYmd(), from = addDays(to, -29);
        try {
            var r = deps().getDateRange && deps().getDateRange();
            if (r && validYmd(String(r.from).slice(0, 10)) && validYmd(String(r.to).slice(0, 10))) { from = String(r.from).slice(0, 10); to = String(r.to).slice(0, 10); }
        } catch (e) { /* диапазон по умолчанию */ }
        if (to > todayYmd()) to = todayYmd();
        if (from > to) from = to;
        return { from: from, to: to };
    }

    function stateOf(ctx) {
        var key = String(ctx.key || (ctx.cabId + ':' + (ctx.campaign && ctx.campaign.wbId)));
        var st = ST[key];
        if (!st) {
            var rg = defaultRange();
            st = ST[key] = {
                key: key, cabId: ctx.cabId, wbId: Number(ctx.campaign && ctx.campaign.wbId) || 0,
                from: rg.from, to: rg.to, tab: 'z', live: true, hidden: false, colsOpen: false, hiddenCols: savedCols(),
                rows: null, prod: {}, prodOk: false, nms: [], upd: 0, syncedAt: 0, loading: false, seq: 0, error: '', msg: '', scroll: {},
                zones: null, zoneTotal: null, lastLive: 0, els: {}, kw: null, ctxCurrency: ctx.currency || '',
            };
            restoreCache(st);
            st.applied = { from: st.from, to: st.to };
        }
        if (ctx.cabId) st.cabId = ctx.cabId;
        if (ctx.campaign && ctx.campaign.wbId) st.wbId = Number(ctx.campaign.wbId) || st.wbId;
        if (ctx.currency) { st.ctxCurrency = ctx.currency; CURRENCY[st.cabId] = curName(ctx.currency); }
        return st;
    }

    function cacheKey(st) { return 'nr_advs_d1:' + st.key; }
    function persistCache(st) {
        if (!st.rows) return;
        var o = { t: Date.now(), from: st.applied.from, to: st.applied.to, upd: st.upd, nms: st.nms, prodOk: st.prodOk, prod: st.prod,
            rows: st.rows.map(function (r) { return [r.date, r.views, r.clicks, r.spend, r.atbs, r.orders, r.sum_price]; }) };
        lsSet(cacheKey(st), JSON.stringify(o));
    }
    function restoreCache(st) {
        var raw = lsGet(cacheKey(st)); if (!raw) return;
        try {
            var o = JSON.parse(raw);
            if (!o || !Array.isArray(o.rows)) return;
            st.from = o.from; st.to = o.to; st.upd = o.upd || 0; st.nms = o.nms || []; st.prod = o.prod || {}; st.prodOk = !!o.prodOk;
            st.rows = o.rows.map(function (r) { return { date: r[0], stat_date: r[0], views: r[1], clicks: r[2], spend: r[3], atbs: r[4], orders: r[5], sum_price: r[6] }; });
            st.fromCache = true;
        } catch (e) { /* битый кэш не мешает */ }
    }

    /* ───────── загрузка ───────── */
    function race(p, ms) {
        return new Promise(function (res, rej) {
            var t = setTimeout(function () { rej(new Error('Долго нет ответа')); }, ms || 12000);
            Promise.resolve(p).then(function (v) { clearTimeout(t); res(v); }, function (e) { clearTimeout(t); rej(e); });
        });
    }
    function readDaily(st, from, to) {
        var d = deps();
        if (!d.fetchAllRows) return Promise.resolve(null);
        return race(d.fetchAllRows('advertising_daily_stats', [
            { op: 'eq', column: 'cabinet_id', value: st.cabId },
            { op: 'eq', column: 'campaign_id', value: st.wbId },
            { op: 'gte', column: 'stat_date', value: from },
            { op: 'lte', column: 'stat_date', value: to },
        ], 'stat_date,views,clicks,spend,atbs,orders,sum_price,updated_at,data'));
    }
    function readProd(st, nms, from, to) {
        var d = deps();
        if (!d.fetchAllRows || !nms.length) return Promise.resolve(null);
        return race(d.fetchAllRows('rnp_daily_data', [
            { op: 'eq', column: 'cabinet_id', value: String(st.cabId) },
            { op: 'in', column: 'nm_id', value: nms },
            { op: 'gte', column: 'date', value: from },
            { op: 'lte', column: 'date', value: to },
        ], 'nm_id,date,clicks'));
    }
    function normalizeDaily(rows) {
        var nms = {}, upd = 0, out = (rows || []).map(function (r) {
            nmsOfDay(r.data).forEach(function (n) { nms[n] = 1; });
            var u = r.updated_at ? Date.parse(r.updated_at) : 0; if (u > upd) upd = u;
            return { date: String(r.stat_date).slice(0, 10), stat_date: String(r.stat_date).slice(0, 10), views: num(r.views), clicks: num(r.clicks), spend: num(r.spend), atbs: num(r.atbs), orders: num(r.orders), sum_price: num(r.sum_price) };
        });
        return { rows: out, nms: Object.keys(nms).map(Number), upd: upd };
    }
    function prodMap(rows) { var m = {}; (rows || []).forEach(function (r) { var d = String(r.date).slice(0, 10); m[d] = (m[d] || 0) + num(r.clicks); }); return m; }

    /** Читаем из базы (кэш сайта). Не стираем готовую таблицу: старые цифры остаются, пока не придут новые. */
    function loadStats(st) {
        var seq = ++st.seq, from = st.from, to = st.to;
        st.loading = true; st.error = ''; paintStats(st);
        return readDaily(st, from, to).then(function (rows) {
            if (seq !== st.seq) return;
            if (rows == null) throw new Error('нет доступа к данным');
            var nd = normalizeDaily(rows);
            var nms = nd.nms.length ? nd.nms : st.nms;
            return readProd(st, nms, from, to).catch(function () { return null; }).then(function (prod) {
                if (seq !== st.seq) return;
                st.rows = nd.rows; st.nms = nms; st.upd = nd.upd || st.upd; st.applied = { from: from, to: to };
                st.prodOk = prod != null; st.prod = prodMap(prod || []); st.fromCache = false;
                st.loading = false; st.dim = false; persistCache(st); paintStats(st);
                maybeLiveRefresh(st);
            });
        }).catch(function (e) {
            if (seq !== st.seq) return;
            st.loading = false; st.dim = false; st.error = 'Не получилось загрузить: ' + String((e && e.message) || e || 'ошибка'); paintStats(st);
        });
    }

    function liveItemRows(res, wbId) {
        var item = null;
        (Array.isArray(res) ? res : []).forEach(function (it) { if (Number(it.advertId) === Number(wbId)) item = it; });
        if (!item) return null;
        var days = item.days || [], nms = {};
        var rows = days.map(function (d) {
            nmsOfDay(d).forEach(function (n) { nms[n] = 1; });
            var date = String(d.date).slice(0, 10);
            return { date: date, stat_date: date, views: num(d.views), clicks: num(d.clicks), spend: num(d.sum), atbs: num(d.atbs), orders: num(d.orders), sum_price: num(d.sum_price) };
        });
        return { rows: rows, nms: Object.keys(nms).map(Number), currency: item.currency || '' };
    }
    /** «Обновить»: живой запрос WB API по одной кампании; идёт в фоне, таблица остаётся на месте. */
    function refreshLive(st, manual) {
        var d = deps();
        if (!d.callWbProxy) { if (manual) { st.msg = 'Обновление недоступно'; paintStats(st); } return Promise.resolve(); }
        if (st.refreshing) return st.refreshing;
        st.refreshing = true; st.msg = ''; st.dim = !!manual; paintStats(st);
        var from = st.applied.from, to = st.applied.to;
        var span = Math.min(30, Math.round((parseYmd(to) - parseYmd(from)) / 86400000)); // лимит WB: до 31 дня
        var lf = addDays(to, -span);
        st.refreshing = Promise.resolve(d.callWbProxy('advert_stats', { advertIds: [st.wbId], dateFrom: lf, dateTo: to }, st.cabId)).then(function (res) {
            st.refreshing = false; st.dim = false; st.lastLive = Date.now();
            var lr = liveItemRows(res, st.wbId);
            if (!lr) { st.msg = res == null ? 'Нет ответа от WB' : 'WB не вернул статистику'; paintStats(st); return; }
            if (lr.currency) { CURRENCY[st.cabId] = curName(lr.currency); }
            var by = {}; (st.rows || []).forEach(function (r) { by[r.date] = r; });
            lr.rows.forEach(function (r) { if (r.date >= from && r.date <= to) by[r.date] = r; });
            st.rows = Object.keys(by).sort().map(function (k) { return by[k]; }).filter(function (r) { return r.date >= from && r.date <= to; });
            if (lr.nms.length) st.nms = lr.nms;
            st.syncedAt = Date.now(); st.upd = st.syncedAt; st.fromCache = false; st.error = '';
            persistCache(st); paintStats(st);
        }).catch(function (e) {
            st.refreshing = false; st.dim = false; st.msg = 'Не получилось обновить: ' + String((e && e.message) || e || 'ошибка'); paintStats(st);
        });
        return st.refreshing;
    }
    /** Фоновое обновление после показа кэша: только если данные старше 30 минут и не чаще раза в 5 минут. */
    function maybeLiveRefresh(st) {
        if (!st.live || st.refreshing) return;
        if (Date.now() - st.lastLive < 300000) return;
        if (st.upd && Date.now() - st.upd < 1800000) return;
        if (st.applied.to < addDays(todayYmd(), -1)) return; // прошлый период не меняется
        refreshLive(st, false);
    }

    /* ───────── разметка: статистика ───────── */
    var ICO_CAL = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>';
    var TABS = [['z', 'По зонам показов'], ['d', 'По дням (без разбивки)'], ['s', 'Полки'], ['p', 'Поиск'], ['c', 'Каталог']];

    function statsFrame(st) {
        return '<div class="advs" data-advs-root="stats"><div class="card"><div class="stt">' +
            '<div class="hrow"><h3>Статистика РК по дням и зонам показов</h3><button type="button" class="lnk" data-advs="hide" data-r="hide">скрыть блок ↑</button></div>' +
            '<div class="bar"><label class="dt" data-r="from"><span></span>' + ICO_CAL + '<input type="date" data-advs="from" aria-label="Дата начала"></label>' +
            '<label class="dt" data-r="to"><span></span>' + ICO_CAL + '<input type="date" data-advs="to" aria-label="Дата окончания"></label>' +
            '<button type="button" class="btn k" data-advs="show">Показать статистику</button><button type="button" class="btn" data-advs="export">Экспорт в Excel</button><span class="sp"></span>' +
            '<span class="sw">Источник данных: с сайта WB <button type="button" class="tg on" data-advs="src" role="switch" aria-checked="true" aria-label="Источник данных: WB API"></button> WB API</span></div>' +
            '<div class="bar"><span class="sync" data-r="sync"></span><button type="button" class="btn" data-advs="refresh" data-r="refresh">⟳ Обновить</button><span class="sp"></span>' +
            '<span class="seg" role="tablist">' + TABS.map(function (t) { return '<span role="tab" tabindex="0" data-advs="tab" data-t="' + t[0] + '">' + t[1] + '</span>'; }).join('') + '</span></div>' +
            '<div class="pw"><div class="prog" data-r="prog"></div><div class="pane" data-r="pane"></div><button type="button" class="side" data-advs="cols" aria-expanded="false">Столбцы</button><div class="colpop" data-r="colpop" hidden></div></div>' +
            '<div class="sub" data-r="note" hidden></div>' +
            '</div></div></div>';
    }
    function q(root_, r) { return root_.querySelector('[data-r="' + r + '"]'); }
    function setText(el, t) { if (el && el.textContent !== t) el.textContent = t; }

    function statsData(st) {
        if (st.rows) return { rows: st.rows, from: st.applied.from, to: st.applied.to, prod: st.prod, prodOk: st.prodOk, zones: st.zones, zoneTotal: st.zoneTotal };
        return null;
    }
    function curOf(st) { return curSign(st.cabId); }
    function colPopHtml(st) {
        var h = '';
        for (var g = 0; g < 3; g++) {
            h += '<div class="gt">' + esc(GROUP_LABEL[g]) + '</div>';
            COLS.forEach(function (c) { if (c.g === g) h += '<label><input type="checkbox" data-advs="col" data-c="' + c.id + '"' + (st.hiddenCols[c.id] ? '' : ' checked') + '>' + esc(c.t) + '</label>'; });
        }
        return h;
    }

    function paintStats(st) {
        var el = st.els.stats;
        if (!el || !el.isConnected) return;
        var r0 = el.querySelector('[data-advs-root="stats"]'); if (!r0) return;
        r0.classList.toggle('collapsed', !!st.hidden);
        setText(q(r0, 'hide'), st.hidden ? 'показать блок ↓' : 'скрыть блок ↑');
        setText(q(r0, 'from').firstChild, ruDate(st.from)); setText(q(r0, 'to').firstChild, ruDate(st.to));
        var inF = r0.querySelector('input[data-advs="from"]'), inT = r0.querySelector('input[data-advs="to"]');
        if (inF.value !== st.from) inF.value = st.from; if (inT.value !== st.to) inT.value = st.to;
        inF.max = inT.max = todayYmd();
        var syncTxt = st.refreshing ? 'Обновляем из WB…' : (st.msg || (st.error || (st.syncedAt || st.upd ? 'Данные на ' + stamp(st.syncedAt || st.upd) : 'Данных ещё нет')));
        var se = q(r0, 'sync'); setText(se, syncTxt); se.classList.toggle('err', !!(st.error || /^Не получилось/.test(st.msg || '')));
        var rb = q(r0, 'refresh'); rb.classList.toggle('busy', !!st.refreshing); rb.disabled = false;
        r0.querySelector('[data-advs="show"]').classList.toggle('busy', !!st.loading);
        r0.querySelectorAll('[data-advs="tab"]').forEach(function (t) { var a = t.getAttribute('data-t') === st.tab; t.classList.toggle('a', a); t.setAttribute('aria-selected', a ? 'true' : 'false'); });
        var pane = q(r0, 'pane'), scr0 = pane.querySelector('.scr');
        if (scr0) st.scroll[st.shownTab || st.tab] = [scr0.scrollLeft, scr0.scrollTop];
        var data = statsData(st), sk = false;
        if (!data && st.error) data = { rows: [], from: st.from, to: st.to, prod: {}, prodOk: false, zones: null, zoneTotal: null };
        if (!data) { data = skeletonData(st.from, st.to); sk = true; }
        var cur = curOf(st);
        var model = buildModel(data, st.tab, st.hiddenCols, cur);
        st.lastModel = sk ? null : model; st.shownTab = st.tab;
        var sig = st.tab + '|' + (sk ? 'sk' : 'd') + '|' + (st.rows ? st.rows.length : 0) + '|' + Object.keys(st.hiddenCols).filter(function (k) { return st.hiddenCols[k]; }).join(',') + '|' + st.upd + '|' + st.applied.from + st.applied.to + '|' + cur + '|' + (st.prodOk ? 1 : 0) + '|' + JSON.stringify(st.prod).length + '|' + (st.rows ? st.rows.map(function (r) { return r.views + r.spend + r.orders; }).join(',').length : 0);
        if (pane.getAttribute('data-sig') !== sig) {
            pane.innerHTML = '<div class="scr">' + tableHtml(model, sk) + '</div>';
            pane.setAttribute('data-sig', sig);
            var scr = pane.querySelector('.scr'), sc = st.scroll[st.tab];
            if (sc) { scr.scrollLeft = sc[0]; scr.scrollTop = sc[1]; }
            scr.addEventListener('scroll', function () { st.scroll[st.shownTab] = [scr.scrollLeft, scr.scrollTop]; }, { passive: true });
            measureHead(scr);
        }
        pane.classList.toggle('stale', !!st.dim && !!(st.loading || st.refreshing) && !sk);
        if (!st.hidden) { var scr1 = pane.querySelector('.scr'); if (scr1) measureHead(scr1); }
        q(r0, 'prog').classList.toggle('on', !!(st.loading || st.refreshing));
        pane.setAttribute('aria-busy', st.loading ? 'true' : 'false');
        var tg = r0.querySelector('[data-advs="src"]'); tg.classList.toggle('on', !!st.live); tg.setAttribute('aria-checked', st.live ? 'true' : 'false');
        var note = q(r0, 'note'), nt = '';
        if (st.srcNote) nt = 'Выгрузка с сайта WB пока не подключена: цифры берём из WB API.';
        else if (!sk && (st.tab === 'z' || st.tab === 's' || st.tab === 'p' || st.tab === 'c') && !st.zones) nt = 'WB API не отдаёт разбивку по зонам показов (поиск, полки, каталог), поэтому эти строки пока без цифр.';
        else if (st.rows && st.rows.length === 0) nt = 'За выбранные даты по этой кампании нет данных. Нажмите «Обновить», чтобы запросить их у WB.';
        note.hidden = !nt; setText(note, nt);
        var cp = q(r0, 'colpop'); cp.hidden = !st.colsOpen; r0.querySelector('[data-advs="cols"]').setAttribute('aria-expanded', st.colsOpen ? 'true' : 'false');
        if (st.colsOpen && !cp.firstChild) cp.innerHTML = colPopHtml(st);
        if (!st.colsOpen) cp.innerHTML = '';
    }
    /** Высоты строк шапки меряем по факту: закреплённые строки встают вплотную при любом шрифте. */
    function measureHead(scr) {
        var rows = scr.querySelectorAll('thead tr');
        if (rows.length < 3) return;
        var h1 = rows[0].getBoundingClientRect().height, h2 = rows[1].getBoundingClientRect().height;
        if (!h1) return;
        scr.style.setProperty('--advs-h1', h1 + 'px'); scr.style.setProperty('--advs-h12', (h1 + h2) + 'px');
    }

    /* ───────── ключи ───────── */
    function kwStateOf(st) {
        return st.kw || (st.kw = { rows: null, loading: false, error: '', tab: 'kw', filter: 'all', nm: '', sel: {}, sort: 'spend', dir: -1, limit: 300, pos: {}, run: null, perCall: 30, currency: '', msg: '' });
    }
    function kwKeyOf(r) { return r.nmId + '|' + r.normQuery; }
    function kwNms(kw) { var s = {}; (kw.rows || []).forEach(function (r) { s[r.nmId] = (s[r.nmId] || 0) + num(r.spend); }); return Object.keys(s).map(Number).sort(function (a, b) { return s[b] - s[a]; }); }
    function kwSelNm(kw) { var nms = kwNms(kw); if (kw.nm && kw.nm !== 'all' && nms.indexOf(Number(kw.nm)) >= 0) return String(kw.nm); return nms.length === 1 ? String(nms[0]) : 'all'; }
    /** Строки ключей выбранного артикула; при «Все» одинаковые фразы разных артикулов склеиваются. */
    function kwScope(kw) {
        var nm = kwSelNm(kw), rows = (kw.rows || []).filter(function (r) { return r.state !== 'archived'; });
        var src = nm === 'all' ? rows : rows.filter(function (r) { return String(r.nmId) === nm; });
        var by = {}, out = [];
        src.forEach(function (r) {
            var k = nm === 'all' ? r.normQuery : kwKeyOf(r), p = kw.pos[kwKeyOf(r)], a = by[k];
            if (!a) { a = by[k] = { q: r.normQuery, nmId: r.nmId, keys: [], clicks: 0, spend: 0, views: 0, orders: 0, managed: false, active: false, freq: null, pos: null, checked: false }; out.push(a); }
            a.keys.push(kwKeyOf(r));
            a.clicks += num(r.clicks); a.spend += num(r.spend); a.views += num(r.views); a.orders += num(r.orders);
            if (num(r.bid) > 0) a.managed = true;
            if (r.state === 'active' && !r.minus) a.active = true;
            var f = p ? p.f : (r.frequency != null ? r.frequency : null); if (f != null && (a.freq == null || f > a.freq)) a.freq = f;
            var ps = p ? p.p : (r.searchPosition != null ? r.searchPosition : null); if (ps != null && (a.pos == null || ps < a.pos)) a.pos = ps;
            if (p || r.searchPosition != null || r.frequency != null) a.checked = true;
        });
        return out;
    }
    function kwFiltered(kw, scope) {
        var f = kw.filter;
        var list = scope.filter(function (a) { return f === 'managed' ? a.managed : f === 'active' ? a.active : true; });
        var by = kw.sort, dir = kw.dir;
        list.sort(function (x, y) {
            var a, b;
            if (by === 'freq') { a = x.freq == null ? -1 : x.freq; b = y.freq == null ? -1 : y.freq; }
            else if (by === 'pos') { a = x.pos == null ? 1e9 : x.pos; b = y.pos == null ? 1e9 : y.pos; }
            else if (by === 'clicks') { a = x.clicks; b = y.clicks; }
            else if (by === 'cpc') { a = x.clicks ? x.spend / x.clicks : -1; b = y.clicks ? y.spend / y.clicks : -1; }
            else { a = x.spend; b = y.spend; }
            if (a !== b) return (a - b) * dir;
            return x.q < y.q ? -1 : 1;
        });
        return list;
    }
    function kwWords(scope) {
        var by = {}, out = [];
        scope.forEach(function (a) {
            String(a.q).split(/\s+/).filter(function (w) { return w.length > 1; }).forEach(function (w) {
                var o = by[w]; if (!o) { o = by[w] = { q: w, n: 0, freq: null, clicks: 0, spend: 0 }; out.push(o); }
                o.n++; o.clicks += a.clicks; o.spend += a.spend; if (a.freq != null) o.freq = (o.freq || 0) + a.freq;
            });
        });
        return out.sort(function (x, y) { return y.spend - x.spend || y.n - x.n; });
    }
    function searchUrl(q_) { return 'https://www.wildberries.ru/catalog/0/search.aspx?search=' + encodeURIComponent(q_); }

    var ARROW = '<span aria-hidden="true">↗</span>';
    function keysFrame() {
        var chev = ' ⌄';
        return '<div class="advs" data-advs-root="keys"><div class="card"><div class="stt">' +
            '<div class="seg" style="align-self:flex-start" role="tablist"><span class="a" role="tab" tabindex="0" data-advs="ktab" data-t="kw">Ключевые фразы</span><span role="tab" tabindex="0" data-advs="ktab" data-t="words">Слова в запросах</span></div>' +
            '<div class="bar" data-r="kbar"><button type="button" class="btn k" data-advs="kcheck" data-r="kcheck">Проверить позиции</button>' +
            '<span class="sub" style="margin:0">Проверяем ключей</span><label class="dt"><span data-r="kper"></span>' + chev + '<select data-advs="kper" aria-label="Сколько ключей проверять за раз"><option>5</option><option>10</option><option>30</option><option>60</option></select></label>' +
            '<span class="sub" style="margin:0">Регион</span><span class="dt off" title="Позиции считает WB по региону по умолчанию">г Москва' + chev + '</span>' +
            '<span class="sub" style="margin:0">Артикул</span><label class="dt"><span data-r="knm"></span>' + chev + '<select data-advs="knm" aria-label="Артикул"></select></label></div>' +
            '<div class="bar" data-r="kflt"><span class="seg" role="tablist" data-r="kchips"></span>' +
            '<span class="sw off" title="Скоро: нужен отчёт WB по новым кластерам">Новые <span class="tg" aria-disabled="true"></span></span>' +
            '<span class="sw off" title="Скоро: нужен отчёт WB по актуальным кластерам"><span class="tg" aria-disabled="true"></span>Актуальные</span><span class="sp"></span>' +
            '<span class="sw off" title="Скоро: склейки карточек в API нет"><span class="tg" aria-disabled="true"></span>Учитывать корзины и заказы склейки</span></div>' +
            '<div class="pw"><div class="prog" data-r="kprog"></div><div class="pane" data-r="kpane"></div></div>' +
            '<div class="sub" data-r="knote" hidden></div>' +
            '</div></div></div>';
    }

    function keysSkeleton() {
        var rows = '';
        for (var i = 0; i < 8; i++) rows += '<tr><td class="c"><span class="cb"></span></td><td class="k"><span class="sk">черный костюм женский</span></td><td><span class="sk">3/4</span></td><td><span class="sk">1 841</span></td><td><span class="sk">2 / 4</span></td><td><span class="sk">12</span></td><td><span class="sk">6,80</span></td><td><span class="sk">75</span></td></tr>';
        return rows;
    }
    function kwTableHtml(st, kw, list, scope) {
        var cur = curOf(st), h = '<table class="t kt"><thead><tr><th style="width:30px"></th>';
        var ths = [['q', 'Кластеры', 'l'], ['con', 'Конт.', ''], ['freq', 'Частота', 'sort'], ['pos', 'Позиция', 'sort'], ['clicks', 'Клики', 'sort'], ['cpc', 'CPC', 'sort'], ['spend', 'Затраты', 'sort']];
        ths.forEach(function (t) {
            var srt = t[2] === 'sort', on = srt && kw.sort === t[0] && kw.touched;
            h += '<th class="' + (t[2] === 'l' ? 'l' : '') + (on ? ' sorted' + (kw.dir > 0 ? ' asc' : '') : '') + '"' + (srt ? ' data-advs="ksort" data-s="' + t[0] + '"' : '') + '>' + t[1] + '</th>';
        });
        h += '</tr></thead><tbody>';
        var shown = list.slice(0, kw.limit);
        shown.forEach(function (a) {
            var k = a.keys[0], on = !!kw.sel[k];
            var posCell = a.checked ? (a.pos != null ? String(Math.round(a.pos)) : DASH) : '<button type="button" class="pos' + (kw.run && kw.run.cur === k ? ' run' : '') + '" data-advs="kpos1" data-k="' + esc(k) + '">проверить</button>';
            h += '<tr><td class="c"><span class="cb' + (on ? ' on' : '') + '" role="checkbox" tabindex="0" aria-checked="' + on + '" data-advs="ksel" data-k="' + esc(k) + '"></span></td>' +
                '<td class="k"><a href="' + searchUrl(a.q) + '" target="_blank" rel="noopener" title="Открыть поиск WB">' + esc(a.q) + ' <span>↗</span></a></td>' +
                '<td class="dim">' + DASH + '</td><td>' + (a.freq != null ? grp(a.freq) : '') + '</td><td>' + posCell + '</td>' +
                '<td>' + (a.clicks ? grp(a.clicks) : '') + '</td><td>' + (a.clicks ? dec(a.spend / a.clicks, 2) + NB + cur : '') + '</td><td>' + (a.spend ? fmt(a.spend < 10 ? 'rub1' : 'rub0', a.spend, cur) : '') + '</td></tr>';
        });
        var tc = 0, ts = 0, tf = 0, anyF = false; list.forEach(function (a) { tc += a.clicks; ts += a.spend; if (a.freq != null) { tf += a.freq; anyF = true; } });
        h += '<tr class="sum"><td></td><td class="k">Итого ' + grp(list.length) + ' ' + plural(list.length, 'ключ', 'ключа', 'ключей') + '</td><td></td><td>' + (anyF ? grp(tf) : '') + '</td><td></td><td>' + (tc ? grp(tc) : '') + '</td><td>' + (tc ? dec(ts / tc, 2) + NB + cur : '') + '</td><td>' + (ts ? fmt('rub0', ts, cur) : '') + '</td></tr>';
        h += '</tbody></table>';
        if (list.length > shown.length) h += '<button type="button" class="btn more" data-advs="kmore" style="margin:8px">Показать ещё ' + Math.min(300, list.length - shown.length) + '</button>';
        return h;
    }
    function kwWordsHtml(st, words) {
        var cur = curOf(st), h = '<table class="t kt"><thead><tr><th class="l">Слова</th><th>Фраз</th><th>Частота</th><th>Клики</th><th>CPC</th><th>Затраты</th></tr></thead><tbody>';
        words.slice(0, 300).forEach(function (w) {
            h += '<tr><td class="k"><a href="' + searchUrl(w.q) + '" target="_blank" rel="noopener">' + esc(w.q) + ' <span>↗</span></a></td><td>' + w.n + '</td><td>' + (w.freq != null ? grp(w.freq) : '') + '</td><td>' + (w.clicks ? grp(w.clicks) : '') + '</td><td>' + (w.clicks ? dec(w.spend / w.clicks, 2) + NB + cur : '') + '</td><td>' + (w.spend ? fmt('rub0', w.spend, cur) : '') + '</td></tr>';
        });
        return h + '</tbody></table>';
    }
    function plural(n, a, b, c) { var m = n % 100, d = n % 10; return m > 10 && m < 15 ? c : d === 1 ? a : d >= 2 && d <= 4 ? b : c; }

    function paintKeys(st) {
        var el = st.els.keys; if (!el || !el.isConnected) return;
        var r0 = el.querySelector('[data-advs-root="keys"]'); if (!r0) return;
        var kw = kwStateOf(st);
        r0.querySelectorAll('[data-advs="ktab"]').forEach(function (t) { var a = t.getAttribute('data-t') === kw.tab; t.classList.toggle('a', a); t.setAttribute('aria-selected', a ? 'true' : 'false'); });
        var words = kw.tab === 'words';
        q(r0, 'kbar').hidden = words;
        var pane = q(r0, 'kpane');
        if (!kw.rows) {
            if (!pane.getAttribute('data-sk')) { pane.innerHTML = '<div class="scr k"><table class="t kt"><thead><tr><th style="width:30px"></th><th class="l">Кластеры</th><th>Конт.</th><th>Частота</th><th>Позиция</th><th>Клики</th><th>CPC</th><th>Затраты</th></tr></thead><tbody>' + keysSkeleton() + '</tbody></table></div>'; pane.setAttribute('data-sk', '1'); }
            q(r0, 'kprog').classList.toggle('on', !!kw.loading);
            q(r0, 'kchips').innerHTML = '<span class="a">Все<b>—</b></span><span>Управляемые<b>—</b></span><span>Активные<b>—</b></span>';
            setKeysNote(r0, kw.error ? kw.error : '', true, st);
            return;
        }
        pane.removeAttribute('data-sk');
        var scope = kwScope(kw), list = kwFiltered(kw, scope);
        var cnt = { all: scope.length, managed: scope.filter(function (a) { return a.managed; }).length, active: scope.filter(function (a) { return a.active; }).length };
        var chips = [['all', 'Все'], ['managed', 'Управляемые'], ['active', 'Активные']].map(function (c) { return '<span role="tab" tabindex="0" data-advs="kflt" data-f="' + c[0] + '"' + (kw.filter === c[0] ? ' class="a"' : '') + '>' + c[1] + '<b>' + cnt[c[0]] + '</b></span>'; }).join('');
        var kc = q(r0, 'kchips'); if (kc.getAttribute('data-sig') !== chips) { kc.innerHTML = chips; kc.setAttribute('data-sig', chips); }
        q(r0, 'kflt').hidden = false;
        var sel = r0.querySelector('select[data-advs="knm"]'), nms = kwNms(kw), cur = kwSelNm(kw);
        var opts = (nms.length > 1 ? '<option value="all">Все</option>' : '') + nms.map(function (n) { return '<option value="' + n + '">' + n + '</option>'; }).join('');
        if (sel.getAttribute('data-sig') !== opts) { sel.innerHTML = opts; sel.setAttribute('data-sig', opts); }
        sel.value = cur; setText(q(r0, 'knm'), cur === 'all' ? 'Все' : cur);
        var per = r0.querySelector('select[data-advs="kper"]'); per.value = String(kw.perCall); setText(q(r0, 'kper'), String(kw.perCall));
        // кнопка проверки: пока идёт — «Остановить / Осталось: N»
        var kb = q(r0, 'kcheck'), left = 0; scope.forEach(function (a) { if (!a.checked) left++; });
        if (kw.run) { setText(kb, 'Остановить / Осталось: ' + kw.run.left); kb.classList.remove('off'); }
        else { setText(kb, left ? 'Проверить позиции · ' + left : 'Позиции проверены'); kb.classList.toggle('off', !left); }
        var scr0 = pane.querySelector('.scr'); if (scr0) st.scroll['k' + kw.tab] = [scr0.scrollLeft, scr0.scrollTop];
        var sig = [kw.tab, kw.filter, kw.sort, kw.dir, kw.limit, cur, scope.length, list.length, JSON.stringify(kw.sel).length, Object.keys(kw.pos).length, kw.run ? kw.run.cur || '' : '', curOf(st), kw.touched ? 1 : 0, scope.reduce(function (s, a) { return s + a.spend + a.clicks; }, 0)].join('|');
        if (pane.getAttribute('data-sig') !== sig) {
            pane.innerHTML = '<div class="scr k">' + (words ? kwWordsHtml(st, kwWords(scope)) : kwTableHtml(st, kw, list, scope)) + '</div>';
            pane.setAttribute('data-sig', sig);
            var scr = pane.querySelector('.scr'), sc = st.scroll['k' + kw.tab];
            if (sc) { scr.scrollLeft = sc[0]; scr.scrollTop = sc[1]; }
            scr.addEventListener('scroll', function () { st.scroll['k' + kw.tab] = [scr.scrollLeft, scr.scrollTop]; }, { passive: true });
            var thead = scr.querySelector('thead tr'); if (thead) { /* шапка ключей закреплена сверху */ }
        }
        pane.classList.toggle('stale', !!kw.loading);
        q(r0, 'kprog').classList.toggle('on', !!kw.loading || !!(kw.run && kw.run.busy));
        setKeysNote(r0, kw.error || kw.msg || '', false, st);
    }
    function setKeysNote(r0, text, skel, st) {
        var n = q(r0, 'knote'); if (!n) return;
        n.hidden = !text; n.classList.toggle('err', !!(st.kw && st.kw.error));
        n.innerHTML = text ? esc(text) + (st.kw && st.kw.error ? ' <button type="button" class="lnk" data-advs="kretry">Повторить</button>' : '') : '';
    }

    function loadKeys(st, force, rng) {
        var kw = kwStateOf(st), d = deps(); rng = rng || st.applied;
        if (kw.loading || (kw.rows && !force)) return;
        if (!d.callWbProxy) { kw.error = 'Ключи сейчас недоступны'; paintKeys(st); return; }
        kw.loading = true; kw.error = ''; paintKeys(st);
        Promise.resolve(d.callWbProxy('adv_cluster_board', { advertId: st.wbId, dateFrom: rng.from, dateTo: rng.to }, st.cabId)).then(function (res) {
            kw.loading = false;
            if (!res || res.error) { kw.error = String((res && res.error) || 'WB не отдал ключи этой кампании'); paintKeys(st); return; }
            kw.rows = res.rows || []; kw.currency = res.currency || '';
            if (res.currency) { CURRENCY[st.cabId] = curName(res.currency); paintStats(st); }
            paintKeys(st);
        }).catch(function (e) { kw.loading = false; kw.error = 'Не получилось загрузить ключи: ' + String((e && e.message) || e || 'ошибка'); paintKeys(st); });
    }

    /** Позиции и частоту WB отдаёт порциями (по 30 фраз, 3 запроса в минуту на кабинет): идём по очереди, не блокируя экран. */
    function checkPositions(st, only) {
        var kw = kwStateOf(st);
        if (kw.run) { kw.run.stop = true; kw.run = null; paintKeys(st); return; }
        var scope = kwScope(kw), todo = [];
        scope.forEach(function (a) {
            if (a.checked) return;
            a.keys.forEach(function (k) { var p = k.indexOf('|'); todo.push({ k: k, nm: Number(k.slice(0, p)), q: k.slice(p + 1) }); });
        });
        if (only) todo = todo.filter(function (t) { return only.indexOf(t.k) >= 0; });
        if (!todo.length) return;
        var run = kw.run = { left: todo.length, stop: false, cur: only && only.length === 1 ? only[0] : '', busy: true };
        kw.msg = '';
        paintKeys(st);
        function step() {
            if (run.stop) return;
            if (!todo.length) { kw.run = null; paintKeys(st); return; }
            var nm = todo[0].nm, batch = todo.filter(function (t) { return t.nm === nm; }).slice(0, only ? 60 : kw.perCall);
            run.busy = true; paintKeys(st);
            Promise.resolve(deps().callWbProxy('adv_cluster_positions', { nmId: nm, queries: batch.map(function (t) { return t.q; }), dateFrom: st.applied.from, dateTo: st.applied.to }, st.cabId)).then(function (res) {
                if (run.stop) return;
                run.busy = false;
                if (!res || res.error) { kw.msg = 'Позиции: ' + String((res && res.error) || 'нет ответа от WB') + '. Попробуйте ещё раз через минуту.'; kw.run = null; paintKeys(st); return; }
                var got = {}; (res.positions || []).forEach(function (p) { got[String(p.query).toLowerCase()] = p; });
                batch.forEach(function (t) {
                    var p = got[t.q.toLowerCase()];
                    kw.pos[t.k] = { f: p ? num(p.frequency) : null, p: p && p.avgPosition != null ? Number(p.avgPosition) : null, o: p ? num(p.orders) : 0 };
                });
                var done = {}; batch.forEach(function (t) { done[t.k] = 1; });
                todo = todo.filter(function (t) { return !done[t.k]; });
                run.left = todo.length; run.cur = '';
                if (res.errors && res.errors.length && !(res.positions || []).length) kw.msg = 'WB не вернул позиции: ' + String(res.errors[0]).slice(0, 120);
                paintKeys(st);
                if (todo.length) setTimeout(step, only ? 0 : 21000); else { kw.run = null; paintKeys(st); }
            }).catch(function (e) { run.busy = false; kw.msg = 'Позиции: ' + String((e && e.message) || e || 'ошибка'); kw.run = null; paintKeys(st); });
        }
        step();
    }

    /* ───────── события ───────── */
    function toast(st, text) { st.msg = text; paintStats(st); clearTimeout(st.msgT); st.msgT = setTimeout(function () { if (st.msg === text) { st.msg = ''; paintStats(st); } }, 3500); }
    function onClick(st, e) {
        if (st.colsOpen && !(e.target.closest && e.target.closest('.colpop,[data-advs="cols"]'))) { st.colsOpen = false; paintStats(st); }
        var t = e.target.closest('[data-advs]'); if (!t) return;
        var a = t.getAttribute('data-advs');
        if (a === 'from' || a === 'to') { try { if (t.showPicker) t.showPicker(); } catch (x) { /* откроется штатно */ } return; }
        if (a === 'kper' || a === 'knm') return;
        if (a === 'tab') { st.tab = t.getAttribute('data-t'); st.colsOpen = false; paintStats(st); return; }
        if (a === 'show') {
            if (st.from > st.to) { var s = st.from; st.from = st.to; st.to = s; }
            st.dim = true; loadStats(st);
            if (st.kw && st.kw.rows) loadKeys(st, true, { from: st.from, to: st.to });
            return;
        }
        if (a === 'refresh') { refreshLive(st, true); return; }
        if (a === 'export') { doExport(st); return; }
        if (a === 'hide') { st.hidden = !st.hidden; paintStats(st); return; }
        if (a === 'cols') { st.colsOpen = !st.colsOpen; paintStats(st); return; }
        if (a === 'src') { if (st.live) { st.srcNote = true; paintStats(st); clearTimeout(st.srcT); st.srcT = setTimeout(function () { st.srcNote = false; paintStats(st); }, 4000); } return; }
        // ключи
        var kw = kwStateOf(st);
        if (a === 'ktab') { kw.tab = t.getAttribute('data-t'); paintKeys(st); return; }
        if (a === 'kflt') { kw.filter = t.getAttribute('data-f'); kw.limit = 300; paintKeys(st); return; }
        if (a === 'ksort') { var s2 = t.getAttribute('data-s'); if (s2 === 'q') return; kw.dir = kw.sort === s2 ? -kw.dir : (s2 === 'pos' ? 1 : -1); kw.sort = s2; kw.touched = true; paintKeys(st); return; }
        if (a === 'ksel') { var k = t.getAttribute('data-k'); if (kw.sel[k]) delete kw.sel[k]; else kw.sel[k] = 1; paintKeys(st); return; }
        if (a === 'kmore') { kw.limit += 300; paintKeys(st); return; }
        if (a === 'kretry') { loadKeys(st, true); return; }
        if (a === 'kcheck') { checkPositions(st); return; }
        if (a === 'kpos1') { if (!kw.run) checkPositions(st, [t.getAttribute('data-k')]); return; }
    }
    function onChange(st, e) {
        var t = e.target, a = t.getAttribute && t.getAttribute('data-advs'); if (!a) return;
        if (a === 'from' || a === 'to') { if (validYmd(t.value)) { st[a] = t.value; if (st.to > todayYmd()) st.to = todayYmd(); paintStats(st); } return; }
        if (a === 'col') { var id = t.getAttribute('data-c'), left = COLS.filter(function (c) { return !st.hiddenCols[c.id] && c.id !== id; }).length; if (!t.checked && !left) { t.checked = true; return; } if (t.checked) delete st.hiddenCols[id]; else st.hiddenCols[id] = true; lsSet('nr_advs_cols_v1', JSON.stringify(st.hiddenCols)); paintStats(st); return; }
        var kw = kwStateOf(st);
        if (a === 'knm') { kw.nm = t.value; kw.limit = 300; paintKeys(st); return; }
        if (a === 'kper') { kw.perCall = Number(t.value) || 30; paintKeys(st); return; }
    }
    function onKey(st, e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        var t = e.target.closest && e.target.closest('[role="tab"],[role="checkbox"]'); if (!t) return;
        e.preventDefault(); onClick(st, { target: t });
    }
    function doExport(st) {
        var model = st.lastModel;
        if (!model || !st.rows) { toast(st, 'Таблица ещё грузится, подождите секунду'); return; }
        var rows = exportRows(model), tab = { z: 'по зонам', d: 'по дням', s: 'полки', p: 'поиск', c: 'каталог' }[st.tab];
        var name = 'Статистика РК ' + st.wbId + ' ' + tab + ' ' + st.applied.from + ' — ' + st.applied.to;
        var kind = saveFile(rows, name);
        toast(st, 'Файл сохранён: ' + (kind === 'xlsx' ? 'Excel' : 'CSV'));
    }

    /* ───────── mount ───────── */
    function mount(el, ctx) {
        if (!el || !ctx) return;
        var slot = el.getAttribute('data-slot') || ctx.slot || 'stats';
        if (!ctx.key && el.getAttribute('data-key')) ctx = Object.assign({}, ctx, { key: el.getAttribute('data-key') });
        var st = stateOf(ctx);
        var first = !el.__advs || el.__advs !== st.key + ':' + slot || !el.querySelector('.advs');
        st.els[slot] = el;
        if (first) {
            el.__advs = st.key + ':' + slot;
            el.innerHTML = slot === 'keys' ? keysFrame() : statsFrame(st);
            if (!el.__advsBound) {
                el.__advsBound = true;
                el.addEventListener('click', function (e) { onClick(ST[el.__advs.slice(0, el.__advs.lastIndexOf(':'))], e); });
                el.addEventListener('change', function (e) { onChange(ST[el.__advs.slice(0, el.__advs.lastIndexOf(':'))], e); });
                el.addEventListener('keydown', function (e) { onKey(ST[el.__advs.slice(0, el.__advs.lastIndexOf(':'))], e); });
            }
        }
        if (slot === 'keys') {
            paintKeys(st);
            if (!kwStateOf(st).rows && !kwStateOf(st).loading && !kwStateOf(st).error) setTimeout(function () { loadKeys(st); }, 0);
        } else {
            paintStats(st);
            if (!st.loading && (st.rows == null || st.fromCache)) setTimeout(function () { loadStats(st); }, 0);
            else maybeLiveRefresh(st);
        }
    }

    var api = {
        mount: mount, refresh: function (key) { var st = ST[key]; if (st) loadStats(st); },
        // чистые функции для тестов
        fmt: fmt, grp: grp, dec: dec, ruDate: ruDate, dayLabel: dayLabel, addDays: addDays, daysOf: daysOf, buildModel: buildModel, tableHtml: tableHtml, sparkSvg: sparkSvg,
        exportRows: exportRows, toCsv: toCsv, nmsOfDay: nmsOfDay, normalizeDaily: normalizeDaily, prodMap: prodMap, liveItemRows: liveItemRows,
        kwScope: kwScope, kwFiltered: kwFiltered, kwWords: kwWords, searchUrl: searchUrl, COLS: COLS, _state: ST,
    };
    root.AdvStats = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

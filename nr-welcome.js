/* Приветствие нового клиента: 6 слайдов с примером сайта и в конце подключение токена.
   Все цифры примера считаются из одной таблицы ARTS по тем же формулам, что в РНП
   (выручка, комиссия, логистика, реклама, налог, себестоимость, прибыль), поэтому итоги сходятся. */
(function (root) {
    'use strict';
    var doc = root.document;
    if (!doc) return;

    // Выдуманные артикулы за 14 дней (1–14 окт). o — заказы, b — доля выкупа, p — цена со скидкой, c — себестоимость,
    // k — комиссия WB, l — логистика на заказ, ad — реклама, stor — хранение, ret — возвраты, st — остаток, fbo — из них на складе WB.
    var ARTS = [
        { n: 'Платье летнее', sh: 'dress', ci: 0, cat: 'Платья', o: 168, b: 0.46, p: 3596, c: 1480, k: 0.19, l: 150, ad: 9400, stor: 600, ret: 4, st: 420, fbo: 130 },
        { n: 'Куртка осенняя', sh: 'jacket', ci: 1, cat: 'Верхняя одежда', o: 124, b: 0.42, p: 6190, c: 3050, k: 0.2, l: 210, ad: 14800, stor: 900, ret: 3, st: 210, fbo: 40 },
        { n: 'Худи базовый', sh: 'hood', ci: 2, cat: 'Футболки и худи', o: 96, b: 0.5, p: 2890, c: 1200, k: 0.18, l: 140, ad: 4300, stor: 400, ret: 2, st: 380, fbo: 120 },
        { n: 'Жилет стёганый', sh: 'vest', ci: 4, cat: 'Верхняя одежда', o: 74, b: 0.44, p: 3290, c: 1750, k: 0.19, l: 150, ad: 6100, stor: 300, ret: 2, st: 120, fbo: 20 },
        { n: 'Юбка миди', sh: 'skirt', ci: 5, cat: 'Юбки', o: 52, b: 0.48, p: 2190, c: 980, k: 0.19, l: 130, ad: 2500, stor: 250, ret: 1, st: 260, fbo: 90 },
        { n: 'Футболка оверсайз', sh: 'tee', ci: 3, cat: 'Футболки и худи', o: 36, b: 0.4, p: 1490, c: 640, k: 0.17, l: 120, ad: 7800, stor: 200, ret: 1, st: 90, fbo: 30 },
    ];
    var TAX = 0.06, DAYS = 14;
    var PREV_ORDERS = 478; // заказы за прошлые 14 дней

    function calc(a) {
        var r = {};
        r.s = Math.round(a.o * a.b);
        r.rev = r.s * a.p;
        r.com = Math.round(r.rev * a.k);
        r.log = a.o * a.l;
        r.tax = Math.round(r.rev * TAX);
        r.cogs = r.s * a.c;
        r.ad = a.ad;
        r.stor = a.stor;
        r.profit = r.rev - r.com - r.log - r.ad - r.stor - r.tax - r.cogs;
        r.margin = r.rev ? r.profit / r.rev * 100 : 0;
        r.drr = r.rev ? r.ad / r.rev * 100 : 0;
        r.ordAmt = a.o * a.p;
        r.retAmt = a.ret * a.p;
        r.cancel = a.o - r.s - a.ret;
        return r;
    }
    var ROWS = ARTS.map(function (a) { return { a: a, m: calc(a) }; });
    var KEYS = ['s', 'rev', 'com', 'log', 'tax', 'cogs', 'ad', 'stor', 'profit', 'ordAmt', 'retAmt', 'cancel'];
    var T = { o: 0, ret: 0, st: 0, fbo: 0 };
    KEYS.forEach(function (k) { T[k] = 0; });
    ROWS.forEach(function (x) {
        T.o += x.a.o; T.ret += x.a.ret; T.st += x.a.st; T.fbo += x.a.fbo;
        KEYS.forEach(function (k) { T[k] += x.m[k]; });
    });
    T.margin = T.profit / T.rev * 100; T.drr = T.ad / T.rev * 100; T.buyout = T.s / T.o * 100;
    T.services = T.com + T.log + T.ad + T.stor;

    var nf = new Intl.NumberFormat('ru-RU');
    function fmt(n) { return nf.format(Math.round(n)).replace(/ | /g, ' '); }
    function pct(n, d) { return n.toFixed(d == null ? 1 : d).replace('.', ',') + '%'; }
    function sgn(n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n)); }
    function clamp(v) { return Math.max(0, Math.min(100, Math.round(v))); }

    // Доли с поправкой наибольшего остатка: сумма ровно 100.
    function shares(vals) {
        var sum = vals.reduce(function (s, v) { return s + v; }, 0), raw = vals.map(function (v) { return v / sum * 100; });
        var fl = raw.map(Math.floor), left = 100 - fl.reduce(function (s, v) { return s + v; }, 0);
        raw.map(function (v, i) { return [v - fl[i], i]; }).sort(function (x, y) { return y[0] - x[0]; }).slice(0, left).forEach(function (x) { fl[x[1]]++; });
        return fl;
    }
    // Раскладка целой суммы по весам так, что сумма частей равна итогу.
    function distribute(total, w) {
        var sum = w.reduce(function (s, v) { return s + v; }, 0), raw = w.map(function (v) { return total * v / sum; });
        var fl = raw.map(Math.floor), left = total - fl.reduce(function (s, v) { return s + v; }, 0);
        raw.map(function (v, i) { return [v - fl[i], i]; }).sort(function (x, y) { return y[0] - x[0]; }).slice(0, left).forEach(function (x) { fl[x[1]]++; });
        return fl;
    }
    var DW = [.8, .9, .85, 1.1, 1.0, 1.2, 1.15, 1.3, 1.1, 1.0, 1.25, 1.2, 1.0, .9]; // вес дня 1–14 окт

    // ---- картинки-силуэты вместо реальных фото
    var SH = {
        dress: 'M38 14l-10 6 6 14-8 44h40l-8-44 6-14-10-6c-4 5-12 5-16 0z',
        tee: 'M30 18l-18 12 8 14 8-5v38h40V39l8 5 8-14-18-12c-4 6-12 8-16 8s-12-2-16-8z',
        jacket: 'M32 16l-16 12 4 52h20V34h20v46h20l4-52-16-12-12 8h-12z',
        vest: 'M34 14l-4 24 4 44h32l4-44-4-24-16 10z',
        skirt: 'M32 22h36l12 58H20z',
        hood: 'M32 18l-18 14 6 14 8-3v38h48V43l8 3 6-14-18-14c-4 8-10 10-18 10s-14-2-18-10z',
    };
    var COL = [['#fbc2eb', '#a6c1ee', '#7c5cd6'], ['#a1c4fd', '#c2e9fb', '#2f6ad0'], ['#fddb92', '#fff3d1', '#c98a1b'], ['#d4fc79', '#96e6a1', '#2e9c55'], ['#ffecd2', '#fcb69f', '#d86a4a'], ['#e0c3fc', '#8ec5fc', '#5b45c2'], ['#c3cfe2', '#f5f7fa', '#55627a'], ['#f6d365', '#fda085', '#d0562a']];
    var gid = 0;
    function img(sh, ci, size) {
        var c = COL[ci % COL.length], id = 'nw' + (gid++);
        return '<svg class="nw-img" viewBox="0 0 100 100" width="' + size + '" height="' + size + '"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + c[0] + '"/><stop offset="1" stop-color="' + c[1] + '"/></linearGradient></defs><rect width="100" height="100" fill="url(#' + id + ')"/><path d="' + SH[sh] + '" fill="' + c[2] + '" opacity=".92"/></svg>';
    }
    function donut(parts, big, sub, size) {
        var R = 60, C = 2 * Math.PI * R, a = 0, sum = parts.reduce(function (s, p) { return s + p.v; }, 0), o = '';
        parts.forEach(function (p) { var l = p.v / sum * C; o += '<circle r="' + R + '" cx="85" cy="85" fill="none" stroke="' + p.c + '" stroke-width="26" stroke-dasharray="' + l + ' ' + (C - l) + '" stroke-dashoffset="' + (-a) + '" transform="rotate(-90 85 85)"/>'; a += l; });
        return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 170 170">' + o + '<text x="85" y="86" text-anchor="middle" font-weight="800" font-size="21" fill="currentColor">' + big + '</text><text x="85" y="104" text-anchor="middle" font-size="11" fill="#9aa3b2">' + sub + '</text></svg>';
    }
    function legend(names, parts, sh) {
        return '<div class="nw-leg">' + names.map(function (n, i) { return '<div><span><i style="background:' + parts[i].c + '"></i>' + n + '</span><b>' + (sh[i] === 0 ? '<1' : sh[i]) + '%</b></div>'; }).join('') + '</div>';
    }
    function spark(vals, color, w, h) {
        var mx = Math.max.apply(null, vals), mn = Math.min.apply(null, vals), n = vals.length;
        var pts = vals.map(function (v, i) { return (i * (w / (n - 1))).toFixed(1) + ',' + (h - 3 - (v - mn) / ((mx - mn) || 1) * (h - 8)).toFixed(1); }).join(' ');
        return '<svg class="nw-sp" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none"><polygon points="0,' + h + ' ' + pts + ' ' + w + ',' + h + '" fill="' + color + '" opacity=".14"/><polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="2.2" stroke-linejoin="round"/></svg>';
    }
    function heat(v, good, bad) { return v >= good ? 'nw-hg' : v <= bad ? 'nw-hr' : ''; }
    function fit(w, html) { return '<div class="nw-fitbox"><div class="nw-fit" data-w="' + w + '" style="width:' + w + 'px">' + html + '</div></div>'; }

    var COLS = ['#7a5cf0', '#3b82f6', '#f59e0b', '#ef4444', '#94a3b8', '#10b981'];

    // ---- 0. обзор
    function s0() {
        var sh = shares([T.com, T.log, T.ad, T.stor, T.tax + T.cogs, T.profit]);
        var parts = [{ v: T.com, c: COLS[0] }, { v: T.log, c: COLS[1] }, { v: T.ad, c: COLS[2] }, { v: T.stor, c: COLS[3] }, { v: T.tax + T.cogs, c: COLS[4] }, { v: T.profit, c: COLS[5] }];
        var names = ['Комиссия WB', 'Логистика', 'Реклама', 'Хранение', 'Себестоимость и налог', 'Остаётся вам'];
        var delta = (T.o / PREV_ORDERS - 1) * 100;
        var sp = distribute(Math.round(T.profit), DW);
        return '<div class="nw-stage nw-s0">' +
            '<div class="nw-card nw-dark"><div class="nw-k">Прибыль за 14 дней</div><div class="nw-big nw-gt">' + fmt(T.profit) + '</div><div class="nw-k">маржа ' + pct(T.margin) + ' · ДРР ' + pct(T.drr) + '</div>' + spark(sp, '#34d399', 210, 46) + '</div>' +
            '<div class="nw-card"><div class="nw-k">Заказы</div><div class="nw-big">' + fmt(T.o) + ' <span class="nw-up">' + (delta >= 0 ? '+' : '−') + Math.abs(delta).toFixed(0) + '%</span></div><div class="nw-k">выкуп ' + pct(T.buyout, 0) + ' · выручка ' + fmt(T.rev) + '</div><div class="nw-thumbs">' + ARTS.slice(0, 4).map(function (a) { return img(a.sh, a.ci, 44); }).join('') + '</div></div>' +
            '<div class="nw-card nw-wide"><div class="nw-k" style="margin-bottom:8px">Куда уходит выручка ' + fmt(T.rev) + ' сом</div><div class="nw-donutrow">' + donut(parts, sh[5] + '%', 'остаётся', 128) + legend(names, parts, sh) + '</div></div></div>';
    }

    // ---- 1. РНП «Общий»: всё, что есть на настоящем экране
    function s1() {
        var payout = T.rev - T.com - T.log - T.ad - T.stor, mon = Math.round(payout * 0.62), nxt = payout - mon;
        var cover = ROWS.map(function (x) { return x.a.st / (x.a.o / DAYS); });
        var score = [
            ['Деньги', clamp(T.margin / 20 * 100)],
            ['Карточки', clamp(ROWS.filter(function (x) { return x.a.b * 100 >= 41; }).length / ROWS.length * 100)],
            ['Реклама', clamp(ROWS.filter(function (x) { return x.m.drr < 10; }).length / ROWS.length * 100)],
            ['Выкуп и логистика', clamp(T.buyout / 50 * 100)],
            ['Запасы', clamp(cover.filter(function (d) { return d >= 14; }).length / cover.length * 100)],
        ];
        var total = Math.round(score.reduce(function (s, x) { return s + x[1]; }, 0) / score.length);
        var d1 = [{ v: T.com, c: COLS[0] }, { v: T.log, c: COLS[1] }, { v: T.ad, c: COLS[2] }, { v: T.stor, c: COLS[3] }, { v: T.tax + T.cogs, c: COLS[4] }, { v: T.profit, c: COLS[5] }], n1 = ['Комиссия WB', 'Логистика', 'Реклама', 'Хранение', 'Себест. и налог', 'Остаётся'], s1v = shares(d1.map(function (p) { return p.v; }));
        var soldLog = ROWS.reduce(function (s, x) { return s + x.m.s * x.a.l; }, 0), canLog = ROWS.reduce(function (s, x) { return s + x.m.cancel * x.a.l; }, 0), retLog = ROWS.reduce(function (s, x) { return s + x.a.ret * x.a.l; }, 0);
        var d2 = [{ v: soldLog, c: COLS[1] }, { v: canLog, c: COLS[3] }, { v: retLog, c: COLS[2] }], n2 = ['Доставка продаж', 'Доставка отмен', 'Возвраты'], s2v = shares(d2.map(function (p) { return p.v; }));
        var d3 = [{ v: T.s, c: COLS[5] }, { v: T.cancel, c: COLS[4] }, { v: T.ret, c: COLS[3] }], n3 = ['Выкуплено', 'Отказы', 'Возвраты'], s3v = shares(d3.map(function (p) { return p.v; }));
        var cats = {}; ARTS.forEach(function (a) { cats[a.cat] = (cats[a.cat] || 0) + a.st; });
        var cn = Object.keys(cats).sort(function (x, y) { return cats[y] - cats[x]; }), d4 = cn.map(function (n, i) { return { v: cats[n], c: [COLS[0], COLS[1], COLS[5], COLS[2]][i] }; }), s4v = shares(d4.map(function (p) { return p.v; }));
        var d5 = [{ v: T.fbo, c: COLS[0] }, { v: T.st - T.fbo, c: COLS[1] }], s5v = shares(d5.map(function (p) { return p.v; }));
        var top = ROWS.filter(function (x) { return x.m.profit > 0; }).sort(function (x, y) { return y.m.margin - x.m.margin; }).slice(0, 5);
        var loss = ROWS.filter(function (x) { return x.m.profit < 0; }), lossSum = loss.reduce(function (s, x) { return s + x.m.profit; }, 0);
        var worst = loss.slice().sort(function (x, y) { return x.m.profit - y.m.profit; })[0];
        function dc(title, d, big, sub, names, sh) { return '<div class="nw-mini"><h4>' + title + '</h4><div class="nw-miniin">' + donut(d, big, sub, 104) + legend(names, d, sh) + '</div></div>'; }
        var html = '<div class="nw-full">' +
            '<div class="nw-colL">' +
            '<div class="nw-card nw-dark"><div class="nw-k">Прибыль</div><div class="nw-big nw-gt">' + fmt(T.profit) + '</div><div class="nw-k">заказы ' + fmt(T.o) + ' · продажи ' + fmt(T.s) + ' · маржа ' + pct(T.margin) + ' · ДРР ' + pct(T.drr) + '</div></div>' +
            '<div class="nw-card nw-blue"><div class="nw-k">Баланс WB</div><div class="nw-big">' + fmt(payout) + '</div><div class="nw-brow"><span>К выводу пн 19.10</span><b>' + fmt(mon) + '</b></div><div class="nw-brow"><span>Выплата 26.10</span><b>' + fmt(nxt) + '</b></div></div>' +
            '<div class="nw-card nw-green"><div class="nw-k">Состояние кабинета</div><div class="nw-big">' + total + ' <small>/ 100</small></div>' +
            score.map(function (x) { return '<div class="nw-bar"><span>' + x[0] + '</span><i><b style="width:' + x[1] + '%"></b></i><em>' + x[1] + '</em></div>'; }).join('') + '</div></div>' +
            '<div class="nw-colM">' +
            dc('Куда уходит выручка', d1, '15%', 'остаётся', n1, s1v).replace('15%', s1v[5] + '%') +
            dc('На что уходит логистика', d2, fmt(T.log / 1000) + ' т', 'сом', n2, s2v) +
            dc('Выкупы и отказы', d3, Math.round(T.buyout) + '%', 'выкуп', n3, s3v) +
            dc('Остатки по категориям', d4, String(cn.length), 'кат.', cn, s4v) +
            '<div class="nw-mini nw-wide2"><h4>Остатки: FBO и FBS</h4><div class="nw-miniin">' + donut(d5, fmt(T.st), 'шт', 80) + legend(['FBO · склад WB', 'FBS · свой склад'], d5, s5v) + '</div></div></div>' +
            '<div class="nw-colR"><h4>Топ-5 маржинальных <small>маржа · прибыль, сом</small></h4>' +
            top.map(function (x, i) { return '<div class="nw-rank"><em>' + (i + 1) + '</em><span>' + x.a.n + '</span><u><b style="width:' + Math.min(100, x.m.margin * 3) + '%"></b></u><strong class="nw-gt2">' + pct(x.m.margin) + '</strong><small>' + sgn(x.m.profit) + '</small></div>'; }).join('') +
            '<div class="nw-lossh">ТЕРЯЕМ НА СЛАБЫХ ТОВАРАХ</div><div class="nw-lossv">−' + fmt(Math.abs(lossSum)) + ' <small>сом</small></div><div class="nw-k">' + loss.length + ' из ' + ROWS.length + ' артикулов в минусе</div>' +
            '<div class="nw-lossh dark">Хуже всех</div><div class="nw-rank"><em class="bad">1</em><span>' + worst.a.n + '</span><strong class="nw-rt">' + sgn(worst.m.profit) + '</strong><small>' + worst.m.s + ' прод.</small></div></div></div>';
        return '<div class="nw-stage nw-stage-wide">' + fit(860, html) + '</div>';
    }

    // ---- 2. РНП по артикулам
    function s2() {
        var rows = ROWS.slice().sort(function (x, y) { return y.a.o - x.a.o; });
        function line(label, cell, tot, big) {
            return '<tr' + (big ? ' class="nw-ord"' : '') + '><td>' + label + '</td>' + rows.map(function (x) { var c = cell(x); return '<td class="' + (c[1] || '') + '">' + c[0] + '</td>'; }).join('') + '<td class="nw-tt">' + tot + '</td></tr>';
        }
        var h = '<div class="nw-card nw-table nw-rnp"><table><thead><tr><th></th>' + rows.map(function (x) { return '<th title="' + x.a.n + '">' + img(x.a.sh, x.a.ci, 34) + '</th>'; }).join('') + '<th class="nw-tt">ИТОГ<br><small>за период</small></th></tr></thead><tbody>' +
            line('ЗАКАЗЫ', function (x) { return [x.a.o]; }, T.o, true) +
            line('Продажи, шт', function (x) { return [x.m.s]; }, T.s) +
            line('Выкуп %', function (x) { return [pct(x.a.b * 100, 0), heat(x.a.b * 100, 48, 41)]; }, pct(T.buyout, 0)) +
            line('Выручка', function (x) { return [fmt(x.m.rev)]; }, fmt(T.rev)) +
            line('Комиссия WB', function (x) { return [fmt(x.m.com)]; }, fmt(T.com)) +
            line('Логистика', function (x) { return [fmt(x.m.log)]; }, fmt(T.log)) +
            line('Реклама', function (x) { return [fmt(x.m.ad)]; }, fmt(T.ad)) +
            line('ДРР %', function (x) { return [pct(x.m.drr), x.m.drr > 10 ? 'nw-hr' : x.m.drr < 5 ? 'nw-hg' : '']; }, pct(T.drr)) +
            line('Хранение', function (x) { return [fmt(x.m.stor)]; }, fmt(T.stor)) +
            line('Налог 6%', function (x) { return [fmt(x.m.tax)]; }, fmt(T.tax)) +
            line('Себестоимость', function (x) { return [fmt(x.m.cogs)]; }, fmt(T.cogs)) +
            line('Прибыль', function (x) { return [sgn(x.m.profit), x.m.profit < 0 ? 'nw-hr' : '']; }, sgn(T.profit)) +
            line('Маржа %', function (x) { return [pct(x.m.margin), heat(x.m.margin, 20, 8)]; }, pct(T.margin)) +
            '</tbody></table><div class="nw-legend"><i class="nw-hg"></i>хорошо <i class="nw-hr"></i>внимание</div></div>';
        return '<div class="nw-stage nw-stage-wide">' + fit(760, h) + '</div>';
    }

    // ---- 3. РНП по дням одного артикула (план/факт)
    function s3d() {
        var x = ROWS[0], a = x.a, m = x.m;
        var ord = [21, 24, 19, 28, 26, 22, 28], sal = [9, 11, 8, 13, 12, 10, 14], ad = [1200, 1400, 1100, 1500, 1450, 1350, 1400], PLAN = 24;
        // ord, sal, ad суммируются в итоги модели (168, 77, 9400): проверяется ниже
        var rev = sal.map(function (v) { return v * a.p; });
        var com = distribute(m.com, rev), tax = distribute(m.tax, rev), stor = distribute(m.stor, ord);
        var log = ord.map(function (v) { return v * a.l; }), cogs = sal.map(function (v) { return v * a.c; });
        var prof = rev.map(function (r, i) { return r - com[i] - log[i] - ad[i] - stor[i] - tax[i] - cogs[i]; });
        var sum = function (arr) { return arr.reduce(function (s, v) { return s + v; }, 0); };
        var days = ['01.10', '02.10', '03.10', '04.10', '05.10', '06.10', '07.10'], wd = ['чт', 'пт', 'сб', 'вс', 'пн', 'вт', 'ср'];
        function row(label, vals, f, tot, cls) { return '<tr class="' + (cls || '') + '"><td>' + label + '</td>' + vals.map(function (v, i) { var c = f(v, i); return '<td class="' + (c[1] || '') + '">' + c[0] + '</td>'; }).join('') + '<td class="nw-tt">' + tot + '</td></tr>'; }
        var h = '<div class="nw-card nw-table nw-rnp nw-daily"><div class="nw-dhead">' + img(a.sh, a.ci, 44) + '<div><b>' + a.n + '</b><div class="nw-k">артикул wb 1544472467 · остаток ' + a.st + ' шт (FBO ' + a.fbo + ' · FBS ' + (a.st - a.fbo) + ')</div></div><span class="nw-chip">План: ' + PLAN + ' заказов в день</span></div>' +
            '<table><thead><tr><th>ОКТЯБРЬ 2026</th>' + days.map(function (d, i) { return '<th>' + d + '<br><small>' + wd[i] + '</small></th>'; }).join('') + '<th class="nw-tt">ИТОГ</th></tr></thead><tbody>' +
            row('ЗАКАЗЫ', ord, function (v) { return [v, v >= PLAN ? 'nw-hg' : v < PLAN * 0.85 ? 'nw-hr' : '']; }, sum(ord), 'nw-ord') +
            row('План заказов', ord, function () { return [PLAN]; }, PLAN * ord.length) +
            row('Выполнение плана', ord, function (v) { var p = v / PLAN * 100; return [pct(p, 0), p >= 100 ? 'nw-hg' : p < 85 ? 'nw-hr' : '']; }, pct(sum(ord) / (PLAN * ord.length) * 100, 0)) +
            row('Продажи, шт', sal, function (v) { return [v]; }, sum(sal)) +
            row('Цена со скидкой', sal, function () { return [fmt(a.p)]; }, fmt(a.p)) +
            row('Выручка', rev, function (v) { return [fmt(v)]; }, fmt(sum(rev))) +
            row('Реклама', ad, function (v) { return [fmt(v)]; }, fmt(sum(ad))) +
            row('ДРР %', ad, function (v, i) { var d = v / rev[i] * 100; return [pct(d), d > 10 ? 'nw-hr' : d < 5 ? 'nw-hg' : '']; }, pct(sum(ad) / sum(rev) * 100)) +
            row('Прибыль', prof, function (v) { return [sgn(v), v < 0 ? 'nw-hr' : '']; }, sgn(sum(prof))) +
            '</tbody></table><div class="nw-legend"><i class="nw-hg"></i>план выполнен <i class="nw-hr"></i>отстаёт от плана</div></div>';
        return '<div class="nw-stage nw-stage-wide">' + fit(760, h) + '</div>';
    }

    // ---- 4. Дашборд
    function s4() {
        var real = T.rev, gross = T.rev + T.retAmt;
        var shS = shares([T.com, T.log, T.ad, T.stor]);
        var shT = shares([T.tax, T.cogs, 1]); // налог, себестоимость, затраты (условно 0 → минимальный вес)
        var tc = T.tax + T.cogs;
        function sp(total) { return spark(distribute(Math.round(total), DW), '', 150, 34); }
        function card(t, v, c) { return '<div class="nw-kc"><b>' + t + '</b><span class="nw-k">1 окт – 14 окт</span><div class="nw-kv">' + fmt(v) + '</div>' + spark(distribute(Math.round(v), DW), c, 150, 34) + '</div>'; }
        var wk = distribute(Math.round(T.ordAmt), DW), ws = distribute(Math.round(T.rev), DW), wp = distribute(Math.round(T.profit), DW);
        var mx = Math.max.apply(null, wk), bars = '';
        wk.forEach(function (v, i) {
            var x = 52 + i * 56;
            [[v, '#fb923c'], [ws[i], '#60a5fa'], [wp[i], '#4ade80']].forEach(function (q, j) { var hgt = Math.max(1, q[0] / mx * 150); bars += '<rect x="' + (x + j * 15) + '" y="' + (176 - hgt) + '" width="13" height="' + hgt + '" rx="2" fill="' + q[1] + '"/>'; });
            bars += '<text x="' + (x + 22) + '" y="194" text-anchor="middle" font-size="9" fill="#9aa3b2">' + (i + 1) + '</text>';
        });
        var html = '<div class="nw-dash"><div class="nw-note">Прибыль, маржа и комиссия считаются по отчёту Wildberries, заказы и остатки — за весь выбранный период.</div>' +
            '<div class="nw-d4"><div class="nw-kc big"><b>Реализация</b><div class="nw-kv">' + fmt(real) + '</div><div class="nw-pbar"><i style="width:' + Math.round(real / gross * 100) + '%"></i></div><div class="nw-lr"><span><i class="g"></i>Продажи</span><b>' + fmt(gross) + '</b></div><div class="nw-lr"><span><i class="r"></i>Возвраты</span><b>−' + fmt(T.retAmt) + '</b></div></div>' +
            '<div class="nw-kc big"><b>Услуги <em>' + Math.round(T.services / real * 100) + '%</em></b><div class="nw-kv">' + fmt(T.services) + '</div><div class="nw-lr"><span><i style="background:#f59e0b"></i>Комиссия</span><b>' + fmt(T.com) + ' <em>' + shS[0] + '%</em></b></div><div class="nw-lr"><span><i style="background:#38bdf8"></i>Логистика</span><b>' + fmt(T.log) + ' <em>' + shS[1] + '%</em></b></div><div class="nw-lr"><span><i style="background:#a855f7"></i>Реклама</span><b>' + fmt(T.ad) + ' <em>' + shS[2] + '%</em></b></div><div class="nw-lr"><span><i style="background:#6366f1"></i>Хранение</span><b>' + fmt(T.stor) + ' <em>' + shS[3] + '%</em></b></div></div>' +
            '<div class="nw-kc big"><b>Налоги и затраты <em>' + Math.round(tc / real * 100) + '%</em></b><div class="nw-kv">' + fmt(tc) + '</div><div class="nw-lr"><span><i style="background:#fca5a5"></i>Налог 6%</span><b>' + fmt(T.tax) + '</b></div><div class="nw-lr"><span><i style="background:#fb923c"></i>Себестоимость продаж</span><b>' + fmt(T.cogs) + '</b></div><div class="nw-lr"><span><i style="background:#84cc16"></i>Затраты</span><b>0</b></div></div>' +
            '<div class="nw-kc big"><b>Операционная прибыль</b><div class="nw-kv nw-gt2">' + fmt(T.profit) + '</div><div class="nw-lr"><span>Маржинальность</span><b>' + pct(T.margin, 0) + '</b></div><div class="nw-lr"><span>Рентабельность</span><b>' + pct(T.profit / T.cogs * 100, 0) + '</b></div><div class="nw-k">% — доля от реализации (продажи минус возвраты)</div></div></div>' +
            '<div class="nw-d5">' + card('Заказы', T.ordAmt, '#fb923c') + card('Продажи', T.rev, '#22c55e') + card('Логистика', T.log, '#38bdf8') + card('Реклама', T.ad, '#a855f7') + card('Все услуги', T.services, '#3b82f6') + '</div>' +
            '<div class="nw-kc nw-chart"><b>Динамика показателей</b><svg width="820" height="204" viewBox="0 0 820 204"><line x1="40" y1="176" x2="810" y2="176" stroke="#e5e7eb"/>' + bars + '</svg><div class="nw-lgd"><i style="background:#fb923c"></i>Заказы <i style="background:#60a5fa"></i>Продажи <i style="background:#4ade80"></i>Прибыль</div></div></div>';
        return '<div class="nw-stage nw-stage-wide">' + fit(860, html) + '</div>';
    }

    var cardState = { photo: 0, step: 0 };
    var STEPS = [-5, -1, 1, 5];
    function unitMargin(a, price) { var q = {}; for (var k in a) q[k] = a[k]; q.p = price; return calc(q).margin; }
    function sCard() {
        var a = ARTS[0], np = Math.round(a.p * (1 + cardState.step / 100));
        var m0 = unitMargin(a, a.p), m1 = unitMargin(a, np);
        var thumbs = [0, 1, 2, 3, 4, 5].map(function (i) { return '<button type="button" class="nw-th' + (i === cardState.photo ? ' on' : '') + '" data-photo="' + i + '">' + img(a.sh, a.ci + i, 46) + '</button>'; }).join('');
        var btns = STEPS.map(function (s) { return '<button type="button" class="nw-pill' + (cardState.step === s ? ' on' : '') + (s > 0 ? ' up' : '') + '" data-step="' + s + '">' + (s > 0 ? '+' : '−') + Math.abs(s) + '%</button>'; }).join('');
        return '<div class="nw-stage"><div class="nw-card nw-card3"><div class="nw-gal">' +
            '<div class="nw-main">' + img(a.sh, a.ci + cardState.photo, 210) + '<span class="nw-cnt">' + (cardState.photo + 1) + ' / 7</span><button type="button" class="nw-arr l" data-dir="-1">‹</button><button type="button" class="nw-arr r" data-dir="1">›</button></div>' +
            '<div class="nw-ths">' + thumbs + '</div></div>' +
            '<div class="nw-info"><div class="nw-name">' + a.n + '</div><div class="nw-k">артикул 1544472467</div>' +
            '<div class="nw-k" style="margin-top:14px">Цена со скидкой</div><div class="nw-big">' + fmt(a.p) + ' <small>сом</small></div>' +
            '<div class="nw-pills">' + btns + '</div>' +
            '<div class="nw-chg">' + (cardState.step ? fmt(a.p) + ' → <b>' + fmt(np) + '</b> <span class="' + (cardState.step > 0 ? 'nw-up' : 'nw-dn') + '">' + (cardState.step > 0 ? '+' : '−') + Math.abs(cardState.step) + '%</span><br><span class="nw-k">маржа за единицу ' + pct(m0) + ' → <b>' + pct(m1) + '</b> при тех же продажах</span>' : '<span class="nw-k">Нажмите −5% … +5%, чтобы увидеть новую цену и маржу</span>') + '</div>' +
            '<span class="nw-btn sm">Применить на WB</span></div></div></div>';
    }

    var AB = [
        { n: 'A', t: 'было', ci: 0, imp: 5000, cl: 195, o: 15 },
        { n: 'B', t: '', ci: 3, imp: 5000, cl: 270, o: 21 },
        { n: 'C', t: '', ci: 5, imp: 5000, cl: 225, o: 17 },
    ];
    function sAB() {
        var best = 0; AB.forEach(function (v, i) { if (v.o / v.imp > AB[best].o / AB[best].imp) best = i; });
        var up = (AB[best].o / AB[best].imp) / (AB[0].o / AB[0].imp) * 100 - 100;
        return '<div class="nw-stage nw-ab">' + AB.map(function (v, i) {
            return '<div class="nw-card nw-var' + (i === best ? ' win' : '') + '">' + img('dress', v.ci, 132) +
                '<div class="nw-vn">Фото ' + v.n + (v.t ? ' (' + v.t + ')' : '') + '</div>' +
                '<div class="nw-k">CTR <b>' + pct(v.cl / v.imp * 100) + '</b></div><div class="nw-k">' + v.o + ' заказов · CR <b>' + pct(v.o / v.cl * 100) + '</b></div>' +
                (i === best ? '<div class="nw-up nw-lg">+' + up.toFixed(0) + '% заказов</div>' : '') + '</div>';
        }).join('') + '<div class="nw-abn">По ' + fmt(AB[0].imp) + ' показов на вариант, одинаковое время и позиция</div></div>';
    }

    function sChat() {
        var pen = [['Габариты', 1240], ['Подмена товара', 860], ['Невыполненный заказ', 400]];
        var tot = pen.reduce(function (s, r) { return s + r[1]; }, 0), prev = 1900, d = tot - prev;
        return '<div class="nw-stage nw-chat"><div class="nw-bub"><b>Штрафы за 11 октября</b>' +
            pen.map(function (r) { return '<div class="nw-pr"><span>' + r[0] + '</span><b>' + fmt(r[1]) + '</b></div>'; }).join('') +
            '<div class="nw-pr nw-prt"><span>Итого, ' + pen.length + ' позиции</span><b class="nw-rt">' + fmt(tot) + ' сом</b></div><div class="nw-k">' + (d >= 0 ? '+' : '−') + fmt(Math.abs(d)) + ' к вчера</div></div>' +
            '<div class="nw-bub nw-rev"><div class="nw-k">Отзыв · 5 ★ · Платье летнее</div>«Очень красивое, села идеально!»</div>' +
            '<div class="nw-bub nw-ans"><b>Ответ Акылай</b><br>Спасибо за тёплые слова! Рады, что платье село идеально.<div><span class="nw-btn sm">Опубликовать</span></div></div></div>';
    }

    var ST = { pending: false, i: 0, el: null };
    function sForm() {
        if (ST.pending) return '<div class="nw-stage nw-form"><div class="nw-card"><div class="nw-name">Почти готово</div><p class="nw-p">Команда NR активирует ваш доступ вручную. После этого здесь появится подключение магазина. Пока можно посмотреть инструкцию, как создать токен.</p><a href="#" class="nw-lnk" data-act="guide">Как создать токен</a></div></div>';
        return '<div class="nw-stage nw-form"><div class="nw-card"><input id="nw-name" class="nw-in" placeholder="Название магазина" autocomplete="off"><input id="nw-token" class="nw-in" type="password" placeholder="Вставьте токен WB" autocomplete="off" spellcheck="false">' +
            '<div class="nw-req">Тип токена: <b>Персональный</b><br>Доступ: <b>Чтение и запись</b><br>Категории: <b>все</b></div><a href="#" class="nw-lnk" data-act="guide">Посмотреть инструкцию со скриншотами</a></div></div>';
    }

    var TXT = [
        ['Весь магазин в одном месте', 'Заказы, прибыль, реклама и остатки Wildberries. Каждое утро всё уже посчитано. Это пример на выдуманных данных.'],
        ['РНП: общий экран', 'Прибыль, баланс WB с ближайшими выплатами, состояние кабинета, куда уходит выручка и логистика, выкупы, остатки, топ товаров и убытки.'],
        ['РНП: по артикулам', 'Заказы, выкуп, комиссия, логистика, реклама, налог, себестоимость и прибыль по каждому артикулу. Зелёное хорошо, красное требует внимания.'],
        ['РНП: день за днём', 'План и факт заказов по дням, выручка, реклама, ДРР и прибыль по одному артикулу.'],
        ['Дашборд: деньги за период', 'Реализация, услуги WB, налоги и затраты, операционная прибыль и динамика по дням. Всё считается по отчёту Wildberries.'],
        ['Карточка: фото и цена', 'Листайте фото и меняйте цену вверх или вниз. Сайт сразу покажет, как изменится маржа.'],
        ['А/Б тесты фото', 'Сайт сам меняет главное фото и показывает, какое продаёт лучше.'],
        ['Telegram и отзывы', 'Штрафы и итоги тестов приходят картинкой. Акылай пишет ответы на отзывы, вы только нажимаете «Опубликовать».'],
        ['Подключим магазин', 'Нужен один токен из кабинета WB. Мы проверим его и начнём собирать данные.'],
    ];
    var VIEWS = [s0, s1, s2, s3d, s4, sCard, sAB, sChat, sForm];

    function applyFit() {
        if (!ST.el) return;
        var pane = ST.el.querySelector('.nw-r'), box = ST.el.querySelector('.nw-fitbox'), inner = ST.el.querySelector('.nw-fit');
        if (!box || !inner) return;
        var w = +inner.getAttribute('data-w'), avail = pane.clientWidth - 40, availH = pane.clientHeight - 40;
        inner.style.transform = 'none';
        var h = inner.offsetHeight, k = Math.min(1, avail / w, availH / h);
        inner.style.transform = 'scale(' + k + ')';
        box.style.width = Math.round(w * k) + 'px'; box.style.height = Math.round(h * k) + 'px';
    }

    function draw() {
        var i = ST.i, last = i === VIEWS.length - 1;
        var keep = ST.el.querySelector('#nw-name') ? [ST.el.querySelector('#nw-name').value, ST.el.querySelector('#nw-token').value] : null;
        var rp = ST.el.querySelector('.nw-r'); rp.className = 'nw-r nw-p' + i;
        rp.innerHTML = '<span class="nw-tag">ПРИМЕР</span>' + VIEWS[i]();
        applyFit();
        ST.el.querySelector('.nw-h').textContent = TXT[i][0];
        ST.el.querySelector('.nw-pp').textContent = TXT[i][1];
        ST.el.querySelector('.nw-dots').innerHTML = TXT.map(function (_, k) { return '<i' + (k === i ? ' class="on"' : '') + '></i>'; }).join('');
        ST.el.querySelector('.nw-back').style.visibility = i ? 'visible' : 'hidden';
        var nx = ST.el.querySelector('.nw-next');
        nx.textContent = last ? (ST.pending ? 'Понятно' : 'Подключить') : 'Далее';
        ST.el.querySelector('.nw-skip').style.visibility = last ? 'hidden' : 'visible';
        if (keep && ST.el.querySelector('#nw-name')) { ST.el.querySelector('#nw-name').value = keep[0]; ST.el.querySelector('#nw-token').value = keep[1]; }
    }

    function done() { try { root.localStorage.setItem('nr_welcome_v1', '1'); } catch (e) {} }
    function close() { root.removeEventListener('resize', applyFit); if (ST.el) { ST.el.remove(); ST.el = null; } doc.removeEventListener('keydown', onKey, true); }
    function onKey(e) { if (e.key === 'Escape') { done(); close(); } else if (e.key === 'ArrowRight') next(); else if (e.key === 'ArrowLeft' && ST.i) { ST.i--; draw(); } }
    function next() {
        if (ST.i < VIEWS.length - 1) { ST.i++; draw(); return; }
        if (ST.pending) { done(); close(); return; }
        var n = (ST.el.querySelector('#nw-name') || {}).value || '', t = (ST.el.querySelector('#nw-token') || {}).value || '';
        var tn = doc.getElementById('onb-name'), tt = doc.getElementById('onb-token');
        if (!t.trim()) { ST.el.querySelector('#nw-token').focus(); return; }
        if (tn) tn.value = n; if (tt) tt.value = t;
        done(); close();
        if (typeof root.submitOnboarding === 'function') root.submitOnboarding();
    }

    function open(pending) {
        if (ST.el) return;
        ST.pending = !!pending; ST.i = 0; cardState.photo = 0; cardState.step = 0;
        var el = doc.createElement('div');
        el.className = 'nw-ov';
        el.innerHTML = '<div class="nw-modal nr-win" role="dialog" aria-modal="true"><div class="nw-l"><div class="nw-logo"><img src="/icons/logo-nr.svg" alt="NR" width="34" height="34"><span>Space</span></div>' +
            '<h2 class="nw-h"></h2><p class="nw-pp"></p><div class="nw-nav"><div class="nw-dots"></div><button type="button" class="nw-back">Назад</button><button type="button" class="nw-next nw-btn">Далее</button></div>' +
            '<button type="button" class="nw-skip">Пропустить</button></div><div class="nw-r"></div></div>';
        doc.body.appendChild(el);
        ST.el = el;
        el.addEventListener('click', function (e) {
            var t = e.target;
            if (t.closest('.nw-next')) return next();
            if (t.closest('.nw-back')) { if (ST.i) { ST.i--; draw(); } return; }
            if (t.closest('.nw-skip')) { done(); close(); return; }
            var ph = t.closest('[data-photo]'); if (ph) { cardState.photo = +ph.getAttribute('data-photo'); draw(); return; }
            var ar = t.closest('[data-dir]'); if (ar) { cardState.photo = (cardState.photo + (+ar.getAttribute('data-dir')) + 6) % 6; draw(); return; }
            var st = t.closest('[data-step]'); if (st) { var v = +st.getAttribute('data-step'); cardState.step = cardState.step === v ? 0 : v; draw(); return; }
            if (t.closest('[data-act="guide"]')) { e.preventDefault(); if (root.openTokenGuide) root.openTokenGuide(); }
        });
        doc.addEventListener('keydown', onKey, true);
        root.addEventListener('resize', applyFit);
        draw();
    }

    // Вызывается со страницы: показать один раз, пока магазин не подключён.
    function maybe(pending, hasCabinets) {
        if (hasCabinets || ST.el) return;
        try { if (root.localStorage.getItem('nr_welcome_v1')) return; } catch (e) {}
        open(pending);
    }
    root.NrWelcome = { open: open, maybe: maybe, model: { ARTS: ARTS, ROWS: ROWS, T: T } };
})(typeof window !== 'undefined' ? window : globalThis);

/* Приветствие нового клиента: 6 слайдов с примером сайта и в конце подключение токена.
   Все цифры примера считаются из одной таблицы ARTS по тем же формулам, что в РНП
   (выручка, комиссия, логистика, реклама, налог, себестоимость, прибыль), поэтому итоги сходятся. */
(function (root) {
    'use strict';
    var doc = root.document;
    if (!doc) return;

    // Выдуманные артикулы. o — заказы, b — доля выкупа, p — цена со скидкой, c — себестоимость,
    // k — комиссия WB, l — логистика на один заказ, ad — расход на рекламу за период.
    var ARTS = [
        { n: 'Платье летнее', sh: 'dress', ci: 0, o: 168, b: 0.46, p: 3596, c: 1480, k: 0.19, l: 150, ad: 9400 },
        { n: 'Куртка осенняя', sh: 'jacket', ci: 1, o: 124, b: 0.42, p: 6190, c: 3050, k: 0.2, l: 210, ad: 14800 },
        { n: 'Худи базовый', sh: 'hood', ci: 2, o: 96, b: 0.5, p: 2890, c: 1200, k: 0.18, l: 140, ad: 4300 },
        { n: 'Жилет стёганый', sh: 'vest', ci: 4, o: 74, b: 0.44, p: 3290, c: 1750, k: 0.19, l: 150, ad: 6100 },
        { n: 'Юбка миди', sh: 'skirt', ci: 5, o: 52, b: 0.48, p: 2190, c: 980, k: 0.19, l: 130, ad: 2500 },
        { n: 'Футболка оверсайз', sh: 'tee', ci: 3, o: 36, b: 0.4, p: 1490, c: 640, k: 0.17, l: 120, ad: 7800 },
    ];
    var TAX = 0.06;
    var PREV_ORDERS = 478; // заказы за прошлый такой же период

    function calc(a) {
        var r = {};
        r.s = Math.round(a.o * a.b);
        r.rev = r.s * a.p;
        r.com = Math.round(r.rev * a.k);
        r.log = a.o * a.l;
        r.tax = Math.round(r.rev * TAX);
        r.cogs = r.s * a.c;
        r.ad = a.ad;
        r.profit = r.rev - r.com - r.log - r.ad - r.tax - r.cogs;
        r.margin = r.rev ? r.profit / r.rev * 100 : 0;
        r.drr = r.rev ? r.ad / r.rev * 100 : 0;
        return r;
    }
    var ROWS = ARTS.map(function (a) { return { a: a, m: calc(a) }; });
    var T = ROWS.reduce(function (t, x) {
        ['o', 's', 'rev', 'com', 'log', 'tax', 'cogs', 'ad', 'profit'].forEach(function (k) { t[k] = (t[k] || 0) + (k === 'o' ? x.a.o : x.m[k]); });
        return t;
    }, {});
    T.margin = T.profit / T.rev * 100; T.drr = T.ad / T.rev * 100; T.buyout = T.s / T.o * 100;

    var nf = new Intl.NumberFormat('ru-RU');
    function fmt(n) { return nf.format(Math.round(n)).replace(/ | /g, ' '); }
    function pct(n, d) { return n.toFixed(d == null ? 1 : d).replace('.', ',') + '%'; }
    function sgn(n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n)); }

    // Доли с поправкой наибольшего остатка: сумма ровно 100.
    function shares(vals) {
        var sum = vals.reduce(function (s, v) { return s + v; }, 0), raw = vals.map(function (v) { return v / sum * 100; });
        var fl = raw.map(Math.floor), left = 100 - fl.reduce(function (s, v) { return s + v; }, 0);
        raw.map(function (v, i) { return [v - fl[i], i]; }).sort(function (x, y) { return y[0] - x[0]; }).slice(0, left).forEach(function (x) { fl[x[1]]++; });
        return fl;
    }

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
        return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 170 170">' + o + '<text x="85" y="86" text-anchor="middle" font-weight="800" font-size="19" fill="currentColor">' + big + '</text><text x="85" y="103" text-anchor="middle" font-size="10" fill="#9aa3b2">' + sub + '</text></svg>';
    }

    // ---- условное форматирование: зелёный хорошо, красный плохо
    function heat(v, good, bad) { // good/bad — пороги; чем ближе к good, тем зеленее
        if (v >= good) return 'nw-hg';
        if (v <= bad) return 'nw-hr';
        return '';
    }

    // ---- слайды
    var COLS = ['#7a5cf0', '#3b82f6', '#f59e0b', '#ef4444', '#94a3b8', '#10b981'];

    function s0() {
        var sh = shares([T.com, T.log, T.ad, T.tax + T.cogs, T.profit]);
        var parts = [{ v: T.com, c: COLS[0] }, { v: T.log, c: COLS[1] }, { v: T.ad, c: COLS[2] }, { v: T.tax + T.cogs, c: COLS[4] }, { v: T.profit, c: COLS[5] }];
        var names = ['Комиссия WB', 'Логистика', 'Реклама', 'Себестоимость и налог', 'Остаётся вам'];
        var spark = [.7, .8, .74, 1, .92, 1.15, 1.05, 1.2, 1.1, 1.3], sm = spark.reduce(function (s, v) { return s + v; }, 0);
        var pts = spark.map(function (v, i) { return (i * 22) + ',' + (44 - v / 1.3 * 38); }).join(' ');
        var delta = (T.o / PREV_ORDERS - 1) * 100;
        return '<div class="nw-stage nw-s0">' +
            '<div class="nw-card nw-dark"><div class="nw-k">Прибыль за период</div><div class="nw-big nw-gt">' + fmt(T.profit) + '</div><div class="nw-k">маржа ' + pct(T.margin) + ' · ДРР ' + pct(T.drr) + '</div><svg width="210" height="48"><polyline points="' + pts + '" fill="none" stroke="#34d399" stroke-width="3" stroke-linejoin="round"/></svg></div>' +
            '<div class="nw-card"><div class="nw-k">Заказы</div><div class="nw-big">' + fmt(T.o) + ' <span class="nw-up">' + (delta >= 0 ? '+' : '−') + Math.abs(delta).toFixed(0) + '%</span></div><div class="nw-k">выкуп ' + pct(T.buyout, 0) + ' · выручка ' + fmt(T.rev) + '</div><div class="nw-thumbs">' + ARTS.slice(0, 4).map(function (a) { return img(a.sh, a.ci, 44); }).join('') + '</div></div>' +
            '<div class="nw-card nw-wide"><div class="nw-k" style="margin-bottom:8px">Куда уходит выручка ' + fmt(T.rev) + ' сом</div><div class="nw-donutrow">' + donut(parts, sh[4] + '%', 'остаётся', 128) +
            '<div class="nw-leg">' + names.map(function (n, i) { return '<div><span><i style="background:' + parts[i].c + '"></i>' + n + '</span><b>' + sh[i] + '%</b></div>'; }).join('') + '</div></div></div></div>';
    }

    function s1() {
        var rows = ROWS.slice().sort(function (x, y) { return y.a.o - x.a.o; });
        function line(label, cls, cell, tot, big) {
            return '<tr' + (big ? ' class="nw-ord"' : '') + '><td>' + label + '</td>' + rows.map(function (x) { var c = cell(x); return '<td class="' + (c[1] || '') + '">' + c[0] + '</td>'; }).join('') + '<td class="nw-tt">' + tot + '</td></tr>';
        }
        var h = '<div class="nw-card nw-table nw-rnp"><table><thead><tr><th></th>' + rows.map(function (x) { return '<th title="' + x.a.n + '">' + img(x.a.sh, x.a.ci, 34) + '</th>'; }).join('') + '<th class="nw-tt">ИТОГ<br><small>за период</small></th></tr></thead><tbody>' +
            line('ЗАКАЗЫ', '', function (x) { return [x.a.o]; }, T.o, true) +
            line('Продажи, шт', '', function (x) { return [x.m.s]; }, T.s) +
            line('Выкуп %', '', function (x) { return [pct(x.a.b * 100, 0), heat(x.a.b * 100, 48, 41)]; }, pct(T.buyout, 0)) +
            line('Выручка', '', function (x) { return [fmt(x.m.rev)]; }, fmt(T.rev)) +
            line('Реклама', '', function (x) { return [fmt(x.m.ad)]; }, fmt(T.ad)) +
            line('ДРР %', '', function (x) { return [pct(x.m.drr), x.m.drr > 10 ? 'nw-hr' : x.m.drr < 5 ? 'nw-hg' : '']; }, pct(T.drr)) +
            line('Прибыль', '', function (x) { return [sgn(x.m.profit), x.m.profit < 0 ? 'nw-hr' : '']; }, sgn(T.profit)) +
            line('Маржа %', '', function (x) { return [pct(x.m.margin), heat(x.m.margin, 20, 8)]; }, pct(T.margin)) +
            '</tbody></table><div class="nw-legend"><i class="nw-hg"></i>хорошо <i class="nw-hr"></i>внимание</div></div>';
        return '<div class="nw-stage nw-wide-stage">' + h + '</div>';
    }

    var cardState = { photo: 0, step: 0 };
    var STEPS = [-5, -1, 1, 5];
    function unitMargin(a, price) { return calc({ n: a.n, o: a.o, b: a.b, p: price, c: a.c, k: a.k, l: a.l, ad: a.ad }).margin; }
    function s2() {
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
    function s3() {
        var best = 0; AB.forEach(function (v, i) { if (v.o / v.imp > AB[best].o / AB[best].imp) best = i; });
        var up = (AB[best].o / AB[best].imp) / (AB[0].o / AB[0].imp) * 100 - 100;
        return '<div class="nw-stage nw-ab">' + AB.map(function (v, i) {
            return '<div class="nw-card nw-var' + (i === best ? ' win' : '') + '">' + img('dress', v.ci, 132) +
                '<div class="nw-vn">Фото ' + v.n + (v.t ? ' (' + v.t + ')' : '') + '</div>' +
                '<div class="nw-k">CTR <b>' + pct(v.cl / v.imp * 100) + '</b></div><div class="nw-k">' + v.o + ' заказов · CR <b>' + pct(v.o / v.cl * 100) + '</b></div>' +
                (i === best ? '<div class="nw-up nw-lg">+' + up.toFixed(0) + '% заказов</div>' : '') + '</div>';
        }).join('') + '<div class="nw-abn">По ' + fmt(AB[0].imp) + ' показов на вариант, одинаковое время и позиция</div></div>';
    }

    function s4() {
        var pen = [['Габариты', 1240], ['Подмена товара', 860], ['Невыполненный заказ', 400]];
        var tot = pen.reduce(function (s, r) { return s + r[1]; }, 0), prev = 1900, d = tot - prev;
        return '<div class="nw-stage nw-chat"><div class="nw-bub"><b>Штрафы за 11 октября</b>' +
            pen.map(function (r) { return '<div class="nw-pr"><span>' + r[0] + '</span><b>' + fmt(r[1]) + '</b></div>'; }).join('') +
            '<div class="nw-pr nw-prt"><span>Итого, ' + pen.length + ' позиции</span><b class="nw-rt">' + fmt(tot) + ' сом</b></div><div class="nw-k">' + (d >= 0 ? '+' : '−') + fmt(Math.abs(d)) + ' к вчера</div></div>' +
            '<div class="nw-bub nw-rev"><div class="nw-k">Отзыв · 5 ★ · Платье летнее</div>«Очень красивое, села идеально!»</div>' +
            '<div class="nw-bub nw-ans"><b>Ответ Акылай</b><br>Спасибо за тёплые слова! Рады, что платье село идеально.<div><span class="nw-btn sm">Опубликовать</span></div></div></div>';
    }

    var ST = { pending: false, i: 0, el: null };
    function s5() {
        if (ST.pending) return '<div class="nw-stage nw-form"><div class="nw-card"><div class="nw-name">Почти готово</div><p class="nw-p">Команда NR активирует ваш доступ вручную. После этого здесь появится подключение магазина. Пока можно посмотреть инструкцию, как создать токен.</p><a href="#" class="nw-lnk" data-act="guide">Как создать токен</a></div></div>';
        return '<div class="nw-stage nw-form"><div class="nw-card"><input id="nw-name" class="nw-in" placeholder="Название магазина" autocomplete="off"><input id="nw-token" class="nw-in" type="password" placeholder="Вставьте токен WB" autocomplete="off" spellcheck="false">' +
            '<div class="nw-req">Тип токена: <b>Персональный</b><br>Доступ: <b>Чтение и запись</b><br>Категории: <b>все</b></div><a href="#" class="nw-lnk" data-act="guide">Посмотреть инструкцию со скриншотами</a></div></div>';
    }

    var TXT = [
        ['Весь магазин в одном месте', 'Заказы, прибыль, реклама и остатки Wildberries. Каждое утро всё уже посчитано. Это пример на выдуманных данных.'],
        ['РНП: что продаётся', 'По каждому артикулу видно заказы, рекламу и сколько осталось прибыли. Зелёное хорошо, красное требует внимания.'],
        ['Карточка: фото и цена', 'Листайте фото и меняйте цену вверх или вниз. Сайт сразу покажет, как изменится маржа.'],
        ['А/Б тесты фото', 'Сайт сам меняет главное фото и показывает, какое продаёт лучше.'],
        ['Telegram и отзывы', 'Штрафы и итоги тестов приходят картинкой. Акылай пишет ответы на отзывы, вы только нажимаете «Опубликовать».'],
        ['Подключим магазин', 'Нужен один токен из кабинета WB. Мы проверим его и начнём собирать данные.'],
    ];
    var VIEWS = [s0, s1, s2, s3, s4, s5];

    function draw() {
        var i = ST.i, last = i === VIEWS.length - 1;
        var keep = ST.el.querySelector('#nw-name') ? [ST.el.querySelector('#nw-name').value, ST.el.querySelector('#nw-token').value] : null;
        var rp = ST.el.querySelector('.nw-r'); rp.className = 'nw-r nw-p' + i;
        rp.innerHTML = '<span class="nw-tag">ПРИМЕР</span>' + VIEWS[i]();
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
    function close() { if (ST.el) { ST.el.remove(); ST.el = null; } doc.removeEventListener('keydown', onKey, true); }
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

/**
 * РНП «План/факт» — лист как в Excel: Зевина «Общая РНП», База/Элиум «ПЛАНФАКТ».
 * Факт заказов = воронка WB (Корзина × Заказы%), не строки statistics-api.
 */
(function (root) {
    var DOW = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
    var FILL_PLAN = '#93C47D';
    var FILL_FACT = '#B6D7A8';
    var FILL_DARK = '#274E13';
    var FILL_TOTAL = '#D9EAD3';

    var CATALOGS = {
        baza: [
            { nm_id: 771499220, name: 'Блузка-лапша-белый' },
            { nm_id: 771571983, name: 'Блузка-лапша-черный' },
            { nm_id: 771571982, name: 'Блузка-лапша-коричневый' },
            { nm_id: 771571985, name: 'Блузка-лапша-бежевый' },
            { nm_id: 771571984, name: 'Блузка-лапша-графит' },
            { nm_id: 1240253079, name: 'Блузка_вырез_белый' },
            { nm_id: 1240242858, name: 'Блузка_вырез_черный' },
            { nm_id: 1240245305, name: 'Блузка_фонарь_белый' },
            { nm_id: 1240248213, name: 'Блузка_фонарь_черный' },
            { nm_id: 1544472467, name: 'Куртка-черный1' },
        ],
        elium: [
            { nm_id: 851707556, name: 'Костюм-мужс-лето-черн' },
            { nm_id: 851705871, name: 'Костюм-мужс-лето-граф' },
            { nm_id: 851335094, name: 'Костюм-мужс-лето-беж' },
            { nm_id: 1171792658, name: 'жл-темносиний' },
            { nm_id: 1171758874, name: 'жл-бордо' },
            { nm_id: 1171720253, name: 'жл-шоколад' },
            { nm_id: 1150315613, name: 'жл-черный' },
        ],
        zevina: [
            { nm_id: 296556350, name: "костюм_оверсайз_бежевый" },
            { nm_id: 435743074, name: "костюм_оверсайз_белый" },
            { nm_id: 296556346, name: "костюм_оверсайз_бордовый" },
            { nm_id: 391116477, name: "костюм_оверсайз_красный" },
            { nm_id: 391116472, name: "костюм_оверсайз_серый" },
            { nm_id: 399607068, name: "костюм_оверсайз_темносин" },
            { nm_id: 295201148, name: "костюм_оверсайз_черный" },
            { nm_id: 296556347, name: "костюм_оверсайз_шоколад" },
            { nm_id: 296556348, name: "костюм_оверсайз_электрик" },
            { nm_id: 247347214, name: "пиджак серый" },
            { nm_id: 247347924, name: "пиджак черный" },
            { nm_id: 429715568, name: "пиджак_Беж_неоаал" },
            { nm_id: 287679856, name: "пиджак_белый2" },
            { nm_id: 287679332, name: "пиджак_бургунди2" },
            { nm_id: 287679331, name: "пиджак_шоко2" },
            { nm_id: 287679857, name: "пиджак_электрик2" },
            { nm_id: 409845462, name: "пиджак_NEW_красный" },
            { nm_id: 409845463, name: "пиджак_NEW_темносин" },
            { nm_id: 1218782505, name: "Свитер-айвори" },
            { nm_id: 1218802103, name: "Свитер-бордо" },
            { nm_id: 1218799336, name: "Свитер-серый" },
            { nm_id: 1218796940, name: "Свитер-шоко" },
            { nm_id: 262714507, name: "укороч_костюм_брючный_бардо" },
            { nm_id: 262760469, name: "укороч_костюм_брючный_бежевый" },
            { nm_id: 435735287, name: "укороч_костюм_брючный_белый" },
            { nm_id: 296564448, name: "укороч_костюм_брючный_коричневый" },
            { nm_id: 247350276, name: "укороч_костюм_брючный_черный" },
            { nm_id: 262697143, name: "укороч_костюм_брючный_красный" },
            { nm_id: 247350377, name: "укороч_костюм_брючный_серый" },
            { nm_id: 296564447, name: "укороч_костюм_брючный_электрик" },
            { nm_id: 892565628, name: "укороч_костюм_брючный_темносиний" },
            { nm_id: 539401905, name: "Спорт_костюм_sport_rich_серый" },
            { nm_id: 539908484, name: "Спорт_костюм_sport_rich_шоко" },
            { nm_id: 539908473, name: "Спорт_костюм_sport_rich_айвори" },
            { nm_id: 539908479, name: "Спорт_костюм_sport_rich_синий" },
            { nm_id: 539908481, name: "Спорт_костюм_sport_rich_бордо" },
            { nm_id: 603633471, name: "Спорт_костюм_sport_rich_новый_бежевый" },
            { nm_id: 539908477, name: "Спорт_костюм_sport_rich_черный" },
            { nm_id: 705387379, name: "двойка_костюм_велюр_черный" },
            { nm_id: 705387385, name: "двойка_костюм_велюр_темно-синий" },
            { nm_id: 705387381, name: "двойка_костюм_велюр_розовый" },
            { nm_id: 705387382, name: "двойка_костюм_велюр_серый" },
            { nm_id: 705387380, name: "двойка_костюм_велюр_изумруд" },
            { nm_id: 705387383, name: "двойка_костюм_велюр_хакки" },
            { nm_id: 705381484, name: "двойка_костюм_велюр_капучино" },
            { nm_id: 705387384, name: "двойка_костюм_велюр_ коралловый" },
            { nm_id: 705387388, name: "двойка_костюм_велюр_марсала" },
            { nm_id: 705387387, name: "двойка_костюм_велюр_красный" },
            { nm_id: 705387386, name: "двойка_костюм_велюр_молочный" },
            { nm_id: 597838497, name: "Спорт_костюм_велюр_черный" },
            { nm_id: 604201351, name: "Спорт_костюм_велюр_капучино" },
            { nm_id: 604201359, name: "Спорт_костюм_велюр_розовый" },
            { nm_id: 604201358, name: "Спорт_костюм_велюр_сирень" },
            { nm_id: 604201350, name: "Спорт_костюм_велюр_серый" },
            { nm_id: 604201361, name: "Спорт_костюм_велюр_изумруд" },
            { nm_id: 664192264, name: "Спорт_костюм_велюр_КОРАЛ" },
            { nm_id: 604201352, name: "Спорт_костюм_велюр_хаки" },
            { nm_id: 604201353, name: "Спорт_костюм_велюр_бордовый" },
            { nm_id: 604201356, name: "Спорт_костюм_велюр_темносин" },
            { nm_id: 247348946, name: "Пиджак овал серый1" },
            { nm_id: 391102728, name: "Пиджак овал серый 2" },
            { nm_id: 499378334, name: "Пиджак овал красный" },
            { nm_id: 247348479, name: "Пиджак овал черный" },
            { nm_id: 280128269, name: "Пиджак овал бардовый" },
            { nm_id: 391102730, name: "Пиджак овал синий" },
            { nm_id: 280129304, name: "Пиджак овал шоколад" },
            { nm_id: 499380531, name: "Пиджак овал серый 3" },
            { nm_id: 391102732, name: "Пиджак овал бежевый" },
            { nm_id: 391102729, name: "Пиджак овал ментол" },
            { nm_id: 307425700, name: "пиджак_КОРОТ_шоко" },
            { nm_id: 307425705, name: "пиджак_КОРОТ_изумруд" },
            { nm_id: 307425697, name: "пиджак_КОРОТ_черный" },
            { nm_id: 307425699, name: "пиджак_КОРОТ_электрик" },
            { nm_id: 307425707, name: "пиджак_КОРОТ_голубой" },
            { nm_id: 307425704, name: "пиджак_КОРОТ_серый" },
            { nm_id: 307425701, name: "пиджак_КОРОТ_бордо" },
            { nm_id: 307425706, name: "пиджак_КОРОТ_темносин" },
            { nm_id: 307425698, name: "пиджак_КОРОТ_бежевый" },
            { nm_id: 435746744, name: "пиджак_КОРОТ_белый" },
            { nm_id: 633661202, name: "костюм_велюр серый" },
            { nm_id: 633661207, name: "костюм_велюр изумруд" },
            { nm_id: 633639148, name: "костюм_велюр черный" },
            { nm_id: 766251143, name: "костюм_велюр розовый" },
            { nm_id: 766251142, name: "костюм_велюр синий" },
            { nm_id: 633661203, name: "костюм_велюр капучинно" },
            { nm_id: 633661205, name: "костюм_велюр сиреневый" },
            { nm_id: 633661208, name: "костюм_велюр корал" },
            { nm_id: 495053631, name: "костНОВ_жакет_светло-серый" },
            { nm_id: 495053632, name: "костНОВ_жакет_бежевый" },
            { nm_id: 495053634, name: "костНОВ_жакет_бордо" },
            { nm_id: 495053627, name: "костНОВ_жакет_черный" },
            { nm_id: 495053638, name: "костНОВ_жакет_темно-синий" },
            { nm_id: 495053633, name: "костНОВ_жакет_темно-серый" },
            { nm_id: 495053630, name: "костНОВ_жакет_красный" },
            { nm_id: 495053629, name: "костНОВ_жакет_шоко" },
            { nm_id: 539916083, name: "Спорт_костюм_originals 1987_черный" },
            { nm_id: 539916085, name: "Спорт_костюм_originals 1987_бордо" },
            { nm_id: 539916078, name: "Спорт_костюм_originals 1987_айвори" },
            { nm_id: 611441510, name: "Спорт_костюм_originals 1987_новый_бежевый" },
            { nm_id: 539916080, name: "Спорт_костюм_originals 1987_синий" },
            { nm_id: 539401904, name: "Спорт_костюм_originals 1987_серый" },
            { nm_id: 262651910, name: "бомбер черный" },
            { nm_id: 249656298, name: "бомбер бежевый" },
            { nm_id: 249650166, name: "бомбер корич" },
            { nm_id: 262659615, name: "бомбер бордо" },
            { nm_id: 605813197, name: "бомбер графит" },
            { nm_id: 249656107, name: "бомбер серый" },
            { nm_id: 629645154, name: "Двойка_юбка_синий полоска" },
            { nm_id: 629645155, name: "Двойка_юбка_черный полоска" },
            { nm_id: 629645153, name: "Двойка_юбка_шоколад полоска" },
            { nm_id: 629645151, name: "Двойка_юбка_коричневый елечка" },
            { nm_id: 629645152, name: "Двойка_юбка_серый полоска" },
            { nm_id: 629645150, name: "Двойка_юбка_серый елечка" },
            { nm_id: 547613172, name: "Куртка_фуфайка_белый" },
            { nm_id: 547613173, name: "Куртка_фуфайка_кофе" },
            { nm_id: 271001367, name: "полупальто_горч" },
            { nm_id: 271001364, name: "полупальто_темнобеж" },
            { nm_id: 271001369, name: "полупальто_светлобеж" },
            { nm_id: 271001368, name: "полупальто_темносин" },
            { nm_id: 495055922, name: "Платье_Пиджак_красный" },
            { nm_id: 495055925, name: "Платье_Пиджак_черный" },
            { nm_id: 495055921, name: "Платье_Пиджак_СветлоСер" },
            { nm_id: 495055924, name: "Платье_Пиджак_бордо" },
            { nm_id: 629846440, name: "Платье_Пиджак_мятный" },
            { nm_id: 495055919, name: "Платье_Пиджак_ТемноСин" },
            { nm_id: 495055918, name: "Платье_Пиджак_шоко" },
        ],
    };
    CATALOGS.ailin = CATALOGS.elium;

    function cabinetKind(name) {
        var n = String(name || '');
        if (/zevina\s*2|зевин[аa]?\s*2/i.test(n)) return 'ailin';
        if (/elium|элиум|айзада/i.test(n)) return 'elium';
        if (/^baza$/i.test(n.trim()) || /бейшеев|\bbaza\b/i.test(n)) return 'baza';
        if (/айлин|ailin/i.test(n) && !/уркунбаев/i.test(n)) return 'ailin';
        if (/zevina|зевин|уркунбаев/i.test(n)) return 'zevina';
        return 'other';
    }

    function sheetMeta(name) {
        var kind = cabinetKind(name);
        if (kind === 'zevina') return { kind: kind, title: 'Общая РНП', skuHeader: '' };
        if (kind === 'elium') return { kind: kind, title: 'ПЛАНФАКТ', skuHeader: 'SKU' };
        return { kind: kind, title: 'ПЛАНФАКТ', skuHeader: '' };
    }

    function catalogOverlap(articles, cat) {
        if (!cat || !articles) return 0;
        var ids = {};
        articles.forEach(function (a) { ids[Number(a.nm_id)] = true; });
        return cat.filter(function (row) { return ids[row.nm_id]; }).length;
    }

    function pickCatalog(articles) {
        var bestKey = null, bestN = 0, key, n;
        for (key in CATALOGS) {
            if (!Object.prototype.hasOwnProperty.call(CATALOGS, key)) continue;
            n = catalogOverlap(articles, CATALOGS[key]);
            if (n > bestN) { bestN = n; bestKey = key; }
        }
        return bestN ? CATALOGS[bestKey] : null;
    }

    function applyCatalog(articles, kind) {
        var list = articles || [];
        var cat = (kind && CATALOGS[kind]) || pickCatalog(list);
        if (!cat) return list.slice();
        var byId = {};
        list.forEach(function (a) { byId[Number(a.nm_id)] = a; });
        var out = [];
        var seen = {};
        cat.forEach(function (row) {
            var live = byId[row.nm_id];
            if (!live) return;
            seen[row.nm_id] = true;
            out.push({ nm_id: row.nm_id, name: row.name || live.name });
        });
        list.forEach(function (a) {
            var id = Number(a.nm_id);
            if (seen[id]) return;
            if (kind === 'zevina') return;
            out.push({ nm_id: id, name: a.name });
        });
        return out;
    }

    function num(v) {
        var n = Number(v);
        return Number.isFinite(n) ? n : 0;
    }

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
        });
    }

    function ymdParts(ymd) {
        var p = String(ymd || '').split('-');
        return { y: Number(p[0]), m: Number(p[1]), d: Number(p[2]) };
    }

    function addDays(ymd, n) {
        var p = ymdParts(ymd);
        var dt = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
        return dt.toISOString().slice(0, 10);
    }

    function mondayOnOrBefore(ymd) {
        var p = ymdParts(ymd);
        var dt = new Date(Date.UTC(p.y, p.m - 1, p.d));
        var dow = dt.getUTCDay();
        var off = dow === 0 ? 6 : dow - 1;
        return addDays(ymd, -off);
    }

    function lastDayOfMonth(monthKey) {
        var p = String(monthKey || '').split('-').map(Number);
        var dt = new Date(Date.UTC(p[0], p[1], 0));
        return dt.toISOString().slice(0, 10);
    }

    function weeksForMonth(monthKey) {
        var key = String(monthKey || '').slice(0, 7);
        if (!/^\d{4}-\d{2}$/.test(key)) return [];
        var first = key + '-01';
        var last = lastDayOfMonth(key);
        var start = mondayOnOrBefore(first);
        var weeks = [];
        var cur = start;
        while (cur <= last) {
            var dates = [];
            var i;
            for (i = 0; i < 7; i++) dates.push(addDays(cur, i));
            weeks.push({ start: dates[0], end: dates[6], dates: dates });
            cur = addDays(cur, 7);
            if (weeks.length >= 6) break;
        }
        return weeks;
    }

    function ddmm(ymd) {
        var p = String(ymd || '').split('-');
        if (p.length < 3) return '';
        return p[2] + '.' + p[1];
    }

    /** Карточка WB «Заказы»: Корзина × Заказы%. Не max со statistics-api. */
    function factOrders(row) {
        if (!row || typeof row !== 'object') return 0;
        var cart = num(row.basket_count != null ? row.basket_count : row.cartCount);
        var conv = num(row.funnel_order_conv != null ? row.funnel_order_conv : row.cartToOrderConversion);
        if (cart > 0 && conv > 0) return Math.round(cart * conv / 100);
        var n = num(row.orders_count);
        return n > 0 ? n : 0;
    }

    function planDay(plansByDate, dates) {
        if (!plansByDate || !dates) return null;
        var i, v;
        for (i = 0; i < dates.length; i++) {
            v = plansByDate[dates[i]] && plansByDate[dates[i]].planned_orders;
            if (v != null && v !== '') return num(v);
        }
        return null;
    }

    function planSalesWeek(plansByDate, dates) {
        if (!plansByDate || !dates) return null;
        var sum = 0, any = false, i, v;
        for (i = 0; i < dates.length; i++) {
            v = plansByDate[dates[i]] && plansByDate[dates[i]].planned_sales;
            if (v != null && v !== '') { sum += num(v); any = true; }
        }
        return any ? sum : null;
    }

    function blankInt(n) {
        if (n == null || n === '' || !Number(n)) return '';
        return String(Math.round(Number(n)));
    }

    function showInt(n, zeroOk) {
        if (n == null || n === '') return '';
        var x = Number(n);
        if (!Number.isFinite(x)) return '';
        if (!zeroOk && x === 0) return '';
        return String(Math.round(x));
    }

    function ratioSku(fact, planSales) {
        if (planSales == null || Number(planSales) === 0) return '#DIV/0!';
        return (Number(fact || 0) / Number(planSales)).toFixed(2);
    }

    function ratioTotal(fact, planSales) {
        if (!planSales) return '0%';
        return Math.round(Number(fact || 0) / Number(planSales) * 100) + '%';
    }

    function coeffPct(part, whole) {
        if (!whole) return '0%';
        return Math.round(Number(part || 0) / Number(whole) * 100) + '%';
    }

    function build(opts) {
        var monthKey = (opts && opts.monthKey) || '';
        var weeks = weeksForMonth(monthKey);
        var meta = sheetMeta((opts && opts.cabinetName) || '');
        var articles = applyCatalog((opts && opts.articles) || [], meta.kind);
        var daily = (opts && opts.daily) || {};
        var plans = (opts && opts.plans) || {};
        var title = (opts && opts.title) || meta.title;
        var skuHeader = (opts && opts.skuHeader != null) ? opts.skuHeader : meta.skuHeader;
        var rows = articles.map(function (art) {
            var nm = Number(art.nm_id);
            var dayMap = daily[nm] || daily[String(nm)] || {};
            var planMap = plans[nm] || plans[String(nm)] || {};
            var weekBlocks = weeks.map(function (w) {
                var facts = w.dates.map(function (d) { return factOrders(dayMap[d]); });
                var factSum = facts.reduce(function (s, n) { return s + n; }, 0);
                var dPlan = planDay(planMap, w.dates);
                var pSales = planSalesWeek(planMap, w.dates);
                return {
                    dates: w.dates,
                    facts: facts,
                    factSum: factSum,
                    dailyPlan: dPlan,
                    planSales: pSales,
                    ratio: ratioSku(factSum, pSales),
                };
            });
            return {
                nm_id: nm,
                name: art.name || String(nm),
                weeks: weekBlocks,
            };
        });
        var totals = weeks.map(function (w, wi) {
            var daySums = [0, 0, 0, 0, 0, 0, 0];
            var dailyPlan = 0, factSum = 0, planSales = 0;
            rows.forEach(function (r) {
                var b = r.weeks[wi];
                var i;
                for (i = 0; i < 7; i++) daySums[i] += b.facts[i] || 0;
                dailyPlan += num(b.dailyPlan);
                factSum += b.factSum;
                planSales += num(b.planSales);
            });
            var coeffs = daySums.map(function (n) { return coeffPct(n, dailyPlan); });
            return {
                daySums: daySums,
                dailyPlan: dailyPlan,
                factSum: factSum,
                planSales: planSales,
                ratio: ratioTotal(factSum, planSales),
                coeffs: coeffs,
                planCoeff: ratioTotal(factSum, planSales),
            };
        });
        return {
            monthKey: monthKey,
            title: title,
            skuHeader: skuHeader || '',
            kind: meta.kind,
            weeks: weeks,
            rows: rows,
            totals: totals,
        };
    }

    function th(cls, style, text) {
        return '<th class="' + cls + '"' + (style ? ' style="' + style + '"' : '') + '>' + text + '</th>';
    }

    function td(cls, style, text) {
        return '<td class="' + cls + '"' + (style ? ' style="' + style + '"' : '') + '>' + text + '</td>';
    }

    function headerHtml(model) {
        var w, i, h1 = '', h2 = '', h3 = '', h4 = '', h5 = '';
        h1 += th('pf-a pf-title', '', 'ПЛАН/ФАКТ');
        h1 += th('pf-b', '', '');
        h1 += th('pf-c', '', '');
        h1 += th('pf-d', '', '');
        h2 += th('pf-a', '', '');
        h2 += th('pf-b', '', '');
        h2 += th('pf-c', '', '');
        h2 += th('pf-d', '', '');
        h3 += th('pf-a', '', '');
        h3 += th('pf-b', '', '');
        h3 += th('pf-c', '', '');
        h3 += th('pf-d', '', '');
        h4 += th('pf-a', '', '');
        h4 += th('pf-b', '', '');
        h4 += th('pf-c', '', '');
        h4 += th('pf-d', '', '');
        h5 += th('pf-a pf-total', '', '');
        h5 += th('pf-b pf-total', '', 'Артикул');
        h5 += th('pf-c pf-total', '', esc(model.skuHeader || ''));
        h5 += th('pf-d pf-total', '', '');
        for (w = 0; w < model.weeks.length; w++) {
            var week = model.weeks[w];
            var tot = model.totals[w] || {};
            for (i = 0; i < 7; i++) {
                h1 += th('pf-day', '', '');
                h2 += th('pf-day pf-date', '', ddmm(week.dates[i]));
                h3 += th('pf-day pf-dow', '', DOW[i]);
                h4 += th('pf-day pf-coeff', '', tot.coeffs ? tot.coeffs[i] : '');
                h5 += th('pf-day pf-total', '', showInt(tot.daySums && tot.daySums[i], true));
            }
            h1 += th('pf-plan', '', 'ПЛАН Заказов, по дням');
            h1 += th('pf-fact-h', '', 'ФАКТ Заказов за неделю');
            h1 += th('pf-fact-h', '', '');
            h1 += th('pf-fact-h', '', '');
            h1 += th('pf-plan', '', 'ПЛАН ПРОДАЖ, за неделю');
            h2 += th('pf-plan', '', ddmm(week.start));
            h2 += th('pf-plan', '', '');
            h2 += th('pf-plan', '', '');
            h2 += th('pf-plan', '', '');
            h2 += th('pf-plan', '', '');
            h3 += th('pf-plan', '', ddmm(week.end));
            h3 += th('pf-fact-h', '', '');
            h3 += th('pf-fact-h', '', '');
            h3 += th('pf-fact-h', '', '');
            h3 += th('pf-plan', '', '');
            h4 += th('pf-plan pf-coeff', '', tot.planCoeff || '0%');
            h4 += th('pf-dark', '', '');
            h4 += th('pf-dark', '', '');
            h4 += th('pf-dark', '', '');
            h4 += th('pf-plan', '', '');
            h5 += th('pf-dark', '', showInt(tot.dailyPlan, true));
            h5 += th('pf-dark', '', '');
            h5 += th('pf-dark pf-ratio', '', tot.ratio || '0%');
            h5 += th('pf-dark', '', showInt(tot.factSum, true));
            h5 += th('pf-dark', '', showInt(tot.planSales, true));
        }
        return '<tr class="pf-r1">' + h1 + '</tr>'
            + '<tr class="pf-r2">' + h2 + '</tr>'
            + '<tr class="pf-r3">' + h3 + '</tr>'
            + '<tr class="pf-r4">' + h4 + '</tr>'
            + '<tr class="pf-r5">' + h5 + '</tr>';
    }

    function bodyHtml(model) {
        return model.rows.map(function (row) {
            var html = td('pf-a', '', '')
                + td('pf-b', '', esc(row.name))
                + td('pf-c', '', esc(row.nm_id))
                + td('pf-d', '', '');
            row.weeks.forEach(function (b) {
                var i;
                for (i = 0; i < 7; i++) html += td('pf-day', '', blankInt(b.facts[i]));
                html += td(b.dailyPlan ? 'pf-plan pf-plan-set' : 'pf-plan', '', blankInt(b.dailyPlan));
                html += td('pf-fact', '', '');
                html += td('pf-fact pf-ratio', '', b.ratio);
                html += td('pf-fact pf-sum', '', blankInt(b.factSum));
                html += td(b.planSales ? 'pf-plan pf-plan-set' : 'pf-plan', '', blankInt(b.planSales));
            });
            return '<tr>' + html + '</tr>';
        }).join('');
    }

    function tableHtml(model) {
        return '<div class="pf-scroll"><table class="pf-sheet">'
            + '<thead>' + headerHtml(model) + '</thead>'
            + '<tbody>' + bodyHtml(model) + '</tbody>'
            + '</table></div>';
    }

    function shellHtml(model) {
        return '<div class="pf-bar">'
            + '<div class="pf-bar-title" id="rnp-plan-fact-title">' + esc(model.title) + '</div>'
            + '<button type="button" class="pf-close" onclick="RnpPlanFact.close()" aria-label="Закрыть">×</button>'
            + '</div>'
            + tableHtml(model);
    }

    function ensureOverlay() {
        var el = document.getElementById('rnp-plan-fact-overlay');
        if (!el) {
            el = document.createElement('div');
            el.id = 'rnp-plan-fact-overlay';
            el.className = 'rnp-plan-fact-overlay';
            el.setAttribute('onclick', 'if(event.target===this) RnpPlanFact.close()');
            el.innerHTML = '<div class="rnp-plan-fact-dialog" role="dialog" aria-modal="true" aria-labelledby="rnp-plan-fact-title">'
                + '<div id="rnp-plan-fact-body"></div></div>';
        }
        if (el.parentElement !== document.body) document.body.appendChild(el);
        return el;
    }

    function onKey(e) {
        if (e.key === 'Escape') close();
    }

    function open(opts) {
        if (typeof document === 'undefined') return build(opts);
        var model = build(opts);
        var overlay = ensureOverlay();
        var body = document.getElementById('rnp-plan-fact-body');
        if (body) body.innerHTML = shellHtml(model);
        overlay.classList.add('is-open');
        document.body.classList.add('rnp-plan-fact-open');
        document.removeEventListener('keydown', onKey);
        document.addEventListener('keydown', onKey);
        return model;
    }

    function close() {
        var overlay = document.getElementById('rnp-plan-fact-overlay');
        if (overlay) overlay.classList.remove('is-open');
        if (typeof document !== 'undefined') {
            document.body.classList.remove('rnp-plan-fact-open');
            document.removeEventListener('keydown', onKey);
        }
    }

    var api = {
        num: num, factOrders: factOrders, weeksForMonth: weeksForMonth,
        mondayOnOrBefore: mondayOnOrBefore, addDays: addDays, ddmm: ddmm,
        planDay: planDay, planSalesWeek: planSalesWeek, ratioSku: ratioSku,
        cabinetKind: cabinetKind, sheetMeta: sheetMeta, applyCatalog: applyCatalog,
        build: build, tableHtml: tableHtml, shellHtml: shellHtml,
        open: open, close: close,
        FILL_PLAN: FILL_PLAN, FILL_FACT: FILL_FACT, FILL_DARK: FILL_DARK, FILL_TOTAL: FILL_TOTAL,
    };
    root.RnpPlanFact = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

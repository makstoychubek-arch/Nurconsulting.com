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

    /** Лист строится ровно из артикулов РНП (видимых, в порядке РНП) — без зашитых списков. */
    function sheetMeta() {
        return { kind: 'rnp', title: 'ПЛАН/ФАКТ', skuHeader: 'WB' };
    }

    function applyCatalog(articles) {
        var seen = {};
        return (articles || []).filter(function (a) {
            var id = Number(a && a.nm_id);
            if (!id || seen[id]) return false;
            seen[id] = true;
            return true;
        }).map(function (a) { return { nm_id: Number(a.nm_id), name: a.name }; });
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
        // Готовое число дня из воронки WB (как «Динамика продаж») — главнее любых расчётов.
        if (row.fact_orders != null && row.fact_orders !== '') return Math.max(0, Math.round(num(row.fact_orders)));
        if (row.funnel_orders != null && row.funnel_orders !== '') return Math.max(0, Math.round(num(row.funnel_orders)));
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

    /* ── Условное форматирование (как в Excel «ПЛАНФАКТ») ── */
    function mix(c1, c2, t) {
        t = Math.max(0, Math.min(1, t));
        var o = [], i;
        for (i = 0; i < 3; i++) o.push(Math.round(c1[i] + (c2[i] - c1[i]) * t));
        return 'rgb(' + o.join(',') + ')';
    }
    var C_RED = [230, 124, 115], C_WHITE = [255, 255, 255], C_GREEN = [87, 187, 138], C_HEAT = [196, 168, 255];

    /** Тепловая карта дня: белый → фиолетовый по min..max недели (F7:L1002 в Excel). */
    function heatStyle(v, min, max) {
        if (!v || max <= min) return v ? 'background:' + mix(C_WHITE, C_HEAT, 0.45) : '';
        return 'background:' + mix(C_WHITE, C_HEAT, (v - min) / (max - min)) + ';';
    }

    /** Красный → белый → зелёный: 50% и ниже красный, 75% белый, 100% и выше зелёный. */
    function rgwStyle(pct) {
        if (pct == null || !isFinite(pct)) return '';
        var bg = pct <= 0.75 ? mix(C_RED, C_WHITE, (pct - 0.5) / 0.25) : mix(C_WHITE, C_GREEN, (pct - 0.75) / 0.25);
        return 'background:' + bg + ';color:#000;';
    }

    /** ≥90% зелёный, 60–89% жёлтый, ниже — красный (правило cellIs из Excel). */
    function ratioClass(pct) {
        if (pct == null || !isFinite(pct)) return '';
        if (pct >= 0.9) return ' pf-ok';
        if (pct >= 0.6) return ' pf-mid';
        return ' pf-bad';
    }

    function pctText(pct) {
        return pct == null || !isFinite(pct) ? '' : Math.round(pct * 100) + '%';
    }

    function todayYmd() {
        var d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function build(opts) {
        var monthKey = (opts && opts.monthKey) || '';
        var weeks = weeksForMonth(monthKey);
        var meta = sheetMeta();
        var articles = applyCatalog((opts && opts.articles) || []);
        var daily = (opts && opts.daily) || {};
        var plans = (opts && opts.plans) || {};
        var title = (opts && opts.title) || meta.title;
        var today = (opts && opts.today) || todayYmd();
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
                    ratioPct: pSales ? factSum / pSales : null,
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
            var coeffNums = daySums.map(function (n) { return dailyPlan ? n / dailyPlan : null; });
            return {
                daySums: daySums,
                dailyPlan: dailyPlan,
                factSum: factSum,
                planSales: planSales,
                ratio: ratioTotal(factSum, planSales),
                coeffs: coeffs,
                coeffNums: coeffNums,
                planPct: planSales ? factSum / planSales : null,
                planCoeff: ratioTotal(factSum, planSales),
            };
        });
        return {
            monthKey: monthKey,
            title: title,
            skuHeader: skuHeader || '',
            kind: meta.kind,
            today: today,
            today: today,
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
        h1 += th('pf-a', '', '');
        h1 += th('pf-b pf-title', '', 'ПЛАН/ФАКТ');
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
                var isToday = week.dates[i] === model.today;
                var future = week.dates[i] > model.today;
                var dcls = (i > 4 ? ' pf-wknd' : '') + (isToday ? ' pf-today' : '') + (future ? ' pf-future' : '');
                h2 += th('pf-day pf-date' + dcls, '', ddmm(week.dates[i]));
                h3 += th('pf-day pf-dow' + dcls, '', DOW[i]);
                h4 += th('pf-day pf-coeff' + dcls, future ? '' : rgwStyle(tot.coeffNums && tot.coeffNums[i]), future ? '' : (tot.coeffs ? tot.coeffs[i] : ''));
                h5 += th('pf-day pf-total' + dcls, '', future ? '' : showInt(tot.daySums && tot.daySums[i], true));
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
            h4 += th('pf-plan pf-coeff', rgwStyle(tot.planPct), tot.planPct == null ? '' : tot.planCoeff);
            h4 += th('pf-dark', '', '');
            h4 += th('pf-dark', '', '');
            h4 += th('pf-dark', '', '');
            h4 += th('pf-plan', '', '');
            h5 += th('pf-dark', '', showInt(tot.dailyPlan, false));
            h5 += th('pf-dark', '', '');
            h5 += th('pf-dark pf-ratio' + ratioClass(tot.planPct), '', tot.planPct == null ? '' : tot.ratio);
            h5 += th('pf-dark', '', showInt(tot.factSum, false));
            h5 += th('pf-dark', '', showInt(tot.planSales, false));
        }
        return '<tr class="pf-r1">' + h1 + '</tr>'
            + '<tr class="pf-r2">' + h2 + '</tr>'
            + '<tr class="pf-r3">' + h3 + '</tr>'
            + '<tr class="pf-r4">' + h4 + '</tr>'
            + '<tr class="pf-r5">' + h5 + '</tr>';
    }

    function bodyHtml(model) {
        // Диапазон тепловой карты — по каждой неделе (как диапазон F7:L1002 в Excel).
        var ranges = model.weeks.map(function (w, wi) {
            var min = Infinity, max = 0;
            model.rows.forEach(function (r) {
                r.weeks[wi].facts.forEach(function (n, i) {
                    if (n > 0 && w.dates[i] <= model.today) { if (n < min) min = n; if (n > max) max = n; }
                });
            });
            return { min: min === Infinity ? 0 : min, max: max };
        });
        return model.rows.map(function (row) {
            var html = td('pf-a', '', '')
                + td('pf-b', '', esc(row.name))
                + td('pf-c', '', esc(row.nm_id))
                + td('pf-d', '', '');
            row.weeks.forEach(function (b, wi) {
                var i;
                for (i = 0; i < 7; i++) {
                    var d = b.dates[i];
                    var future = d > model.today;
                    var cls = 'pf-day' + (i > 4 ? ' pf-wknd' : '') + (d === model.today ? ' pf-today' : '') + (future ? ' pf-future' : '');
                    html += td(cls, future ? '' : heatStyle(b.facts[i], ranges[wi].min, ranges[wi].max), blankInt(b.facts[i]));
                }
                html += td(b.dailyPlan ? 'pf-plan pf-plan-set' : 'pf-plan', '', blankInt(b.dailyPlan));
                html += td('pf-fact', '', '');
                html += td('pf-fact pf-ratio' + ratioClass(b.ratioPct), '', pctText(b.ratioPct));
                html += td('pf-fact pf-sum', '', blankInt(b.factSum));
                html += td(b.planSales ? 'pf-plan pf-plan-set' : 'pf-plan', '', blankInt(b.planSales));
            });
            return '<tr>' + html + '</tr>';
        }).join('');
    }

    function tableHtml(model) {
        var cols = '<col style="width:34px"><col style="width:200px"><col style="width:84px"><col style="width:12px">';
        model.weeks.forEach(function () {
            cols += '<col style="width:40px">'.repeat(7) + '<col style="width:56px"><col style="width:20px"><col style="width:52px"><col style="width:52px"><col style="width:60px">';
        });
        return '<div class="pf-scroll"><table class="pf-sheet"><colgroup>' + cols + '</colgroup>'
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
            el.innerHTML = '<div class="rnp-plan-fact-dialog nr-win" role="dialog" aria-modal="true" aria-labelledby="rnp-plan-fact-title">'
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
        // Перерисовка после догрузки данных не должна сбрасывать прокрутку.
        var prev = body && body.querySelector('.pf-scroll');
        var sx = prev ? prev.scrollLeft : 0, sy = prev ? prev.scrollTop : 0;
        if (body) body.innerHTML = shellHtml(model);
        var cur = body && body.querySelector('.pf-scroll');
        if (cur && (sx || sy)) { cur.scrollLeft = sx; cur.scrollTop = sy; }
        overlay.classList.add('is-open');
        document.body.classList.add('rnp-plan-fact-open');
        if (root.NrWin && !overlay.classList.contains('is-bound')) { root.NrWin.bind(overlay); overlay.classList.add('is-bound'); }
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
        sheetMeta: sheetMeta, applyCatalog: applyCatalog,
        build: build, tableHtml: tableHtml, shellHtml: shellHtml,
        open: open, close: close,
        FILL_PLAN: FILL_PLAN, FILL_FACT: FILL_FACT, FILL_DARK: FILL_DARK, FILL_TOTAL: FILL_TOTAL,
    };
    root.RnpPlanFact = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

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


    // ===== Листы как в Excel (по вашей таблице: лист «Шаблон» и «Приблизительный план вывода денег») =====
    var MSHORT = ['янв.', 'фев.', 'мар.', 'апр.', 'май', 'июн.', 'июл.', 'авг.', 'сен.', 'окт.', 'ноя.', 'дек.'];
    var PAYOUT_LAG = 2; // деньги за продажи недели приходят через 2 недели
    var PARAMS = [
        { k: 'stor', label: 'Тариф хранения, сом/л' }, { k: 'logi', label: 'Тариф логистики, сом' }, { k: 'extra', label: 'Каждый доп. литр, сом' },
        { k: 'dl', label: 'Длина, см' }, { k: 'dw', label: 'Ширина, см' }, { k: 'dh', label: 'Высота, см' },
        { k: 'vol', label: 'Объём, л' }, { k: 'back', label: 'Логистика от клиента, сом' }, { k: 'cogs', label: 'Себестоимость, сом' },
        { k: 'buyout', label: '% выкупа' }, { k: 'comm', label: 'Комиссия, %' }, { k: 'tax', label: 'Налог, %' }, { k: 'spp', label: 'СПП, %' },
    ];
    var WROWS = [
        { k: 'orders', label: 'План заказов, шт', input: 1 },
        { k: 'sales', label: 'План продаж, шт' },
        { k: 'ret', label: 'Возвраты, шт' },
        { k: 'price', label: 'Цена до СПП, сом', input: 1 },
        { k: 'priceSpp', label: 'Цена после СПП, сом' },
        { k: 'drr', label: 'План ДРР, %', input: 1 },
        { k: 'giveSum', label: 'Раздачи (сумм), сом', input: 1 },
        { k: 'mkt', label: 'Внутренний маркетинг, сом' },
        { k: 'logi', label: 'Логистика, сом' },
        { k: 'commR', label: 'Комиссия, сом' },
        { k: 'storR', label: 'Хранение, сом' },
        { k: 'taxR', label: 'Налог, сом' },
        { k: 'pay', label: 'План к перечислению, сом', bold: 1 },
        { k: 'profit', label: 'План ЧП, сом', bold: 1 },
        { k: 'stock', label: 'Остаток на МП, шт' },
        { k: 'sup', label: 'Поставки (итого по цветам), шт' },
        { sec: 'Факт и план/факт' },
        { k: 'fOrders', label: 'Факт заказов, шт' },
        { k: 'fSales', label: 'Факт продаж, шт' },
        { k: 'fPay', label: 'Факт к перечислению, сом' },
        { k: 'fProfit', label: 'Факт ЧП, сом', bold: 1 },
        { k: 'pfOrders', label: 'Заказы: факт к плану, %' },
        { k: 'pfProfit', label: 'ЧП: факт к плану, %' },
        { k: 'cashPlan', label: 'План кассовая прибыль, сом' },
        { k: 'cashFact', label: 'Факт кассовая прибыль, сом' },
    ];
    var PCT_KEYS = ['drr', 'pfOrders', 'pfProfit'], FACT_KEYS = ['fOrders', 'fSales', 'fPay', 'fProfit', 'cashFact'];
    function num(v) { var n = Number(v); return Number.isFinite(n) ? n : 0; }
    function has(v) { return v !== undefined && v !== null && v !== ''; }
    // константы артикула: логистика до клиента = тариф + (объём − 1) × доп. литр;
    // юнит-логистика = от клиента ÷ выкуп − от клиента + до клиента ÷ выкуп; юнит-хранение = тариф × объём
    // объём: длина × ширина × высота ÷ 1000, если габариты заданы; иначе введённый вручную
    function volOf(p) {
        p = p || {};
        var byDims = num(p.dl) * num(p.dw) * num(p.dh) / 1000;
        return byDims > 0 ? Math.round(byDims * 1000) / 1000 : (has(p.vol) ? num(p.vol) : 1);
    }
    // поставки недели = сумма по цветам (таблица «цвет × неделя»); у старых блоков без цветов берётся число недели
    function supOf(b, wk) {
        var tot = 0, any = false;
        (b.colors || []).forEach(function (c) { var v = (c.qty || {})[wk]; if (has(v)) { any = true; tot += num(v); } });
        return any ? tot : num(((b.data || {})[wk] || {}).sup);
    }
    function calcParams(p) {
        p = p || {};
        var buyout = num(p.buyout) / 100, vol = volOf(p), back = num(p.back);
        var toClient = num(p.logi) + (vol - 1) * num(p.extra);
        return { buyout: buyout, comm: num(p.comm) / 100, tax: num(p.tax) / 100, spp: num(p.spp) / 100, cogs: num(p.cogs),
            unitLogi: buyout ? back / buyout - back + toClient / buyout : 0, unitStor: num(p.stor) * vol };
    }
    // весь блок артикула по неделям, как в таблице: заказы недели дают продажи следующей недели (× % выкупа),
    // цена комиссии и перечисления берётся за прошлую неделю, остаток на МП = прошлый − заказы + возвраты + поставки
    function calcBlock(b, weeks, facts) {
        var P = calcParams(b.params), d = b.data || {}, G = [], K = [], I = [], AA = [], out = [], cumPay = 0, cumSup = 0, cumFact = 0;
        facts = facts || {};
        weeks.forEach(function (w, i) {
            var x = d[w.start] || {};
            var g = num(x.orders), k = num(x.price), o = num(x.drr) / 100, sup = supOf(b, w.start), give = num(x.giveSum);
            var gp = i > 0 ? G[i - 1] : 0, gpp = i > 1 ? G[i - 2] : 0, ip = i > 0 ? I[i - 1] : 0, kp = i > 0 ? K[i - 1] : k;
            var sales = gp * P.buyout;
            var ret = 0.5 * (gpp - ip) + 0.5 * (gp - sales);
            var priceSpp = k * (1 - P.spp);
            var mkt = k * sales * o, logi = sales * P.unitLogi, commR = sales * kp * P.comm;
            var stock = (i > 0 ? AA[i - 1] : 0) - g + ret + sup;
            var storR = stock * 7 * P.unitStor, taxR = sales * priceSpp * P.tax;
            var pay = kp * sales - logi - commR - taxR - mkt - give;
            var profit = kp * sales - logi - commR - P.cogs * sales - taxR - mkt - storR;
            G.push(g); K.push(k); I.push(sales); AA.push(stock);
            cumPay += pay; cumSup += sup;
            var f = facts[w.start], fAny = !!f;
            if (fAny) cumFact += num(f.pay);
            var base = {
                fAny: fAny, fOrders: fAny ? f.orders : null, fSales: fAny ? f.sales : null, fPay: fAny ? f.pay : null, fProfit: fAny ? f.profit : null,
                pfOrders: fAny && g > 0 ? f.orders / g * 100 : null, pfProfit: fAny && profit > 0 ? f.profit / profit * 100 : null,
                cashPlan: cumPay - cumSup * P.cogs, cashFact: fAny ? cumFact - cumSup * P.cogs : null,
            };
            out.push(Object.assign(base, { orders: g, sales: sales, ret: ret, price: k, priceSpp: priceSpp, drr: o * 100, giveSum: give, mkt: mkt, logi: logi, commR: commR, storR: storR, taxR: taxR,
                pay: pay, profit: profit, stock: stock, sup: sup, any: has(x.orders) || has(x.price) || sup > 0 || has(x.giveSum) }));
        });
        return out;
    }
    function sheetWeeks(startYmd, count) {
        var out = [], cur = mondayOnOrBefore(startYmd);
        for (var i = 0; i < count; i++) { out.push({ start: cur, end: addDays(cur, 6), month: Number(cur.slice(5, 7)) - 1, year: Number(cur.slice(0, 4)) }); cur = addDays(cur, 7); }
        return out;
    }
    // «Приблизительный план вывода денег»: перечисление и ЧП недели = продажи недели на 2 недели раньше,
    // маркетинг (внутренний + раздачи) и поставки берутся за ту же неделю
    function moneyPlan(blocks, weeks, lag, factsByNm) {
        lag = lag === undefined ? PAYOUT_LAG : lag; factsByNm = factsByNm || {};
        var calcs = blocks.map(function (b) { return calcBlock(b, weeks, factsByNm[b.nm]); });
        return weeks.map(function (w, i) {
            var t = { pay: 0, profit: 0, mkt: 0, sup: 0, any: false, fpay: 0, fprofit: 0, fany: false };
            calcs.forEach(function (c) {
                var cur = c[i], src = i - lag >= 0 ? c[i - lag] : null;
                if (src) { t.pay += src.pay; t.profit += src.profit; if (src.any) t.any = true; if (src.fAny) { t.fany = true; t.fpay += src.fPay; t.fprofit += src.fProfit; } }
                t.mkt += cur.mkt + cur.giveSum; t.sup += cur.sup; if (cur.any) t.any = true;
            });
            return t;
        });
    }
    function sumPlan(rows) {
        return rows.reduce(function (a, r) { a.pay += r.pay; a.profit += r.profit; a.mkt += r.mkt; a.sup += r.sup; a.fpay += r.fpay || 0; a.fprofit += r.fprofit || 0; return a; }, { pay: 0, profit: 0, mkt: 0, sup: 0, fpay: 0, fprofit: 0 });
    }

    function newBlock(id) { return { id: id, nm: '', params: {}, data: {}, synced: {}, colors: [{ name: '', qty: {} }] }; }
    function normBlock(b) { b.params = b.params || {}; b.data = b.data || {}; b.synced = b.synced || {}; if (!Array.isArray(b.colors) || !b.colors.length) b.colors = [{ name: '', qty: {} }]; return b; }
    function sheetKey() { return 'nr_plansheet_' + (st && st.cab); }
    function loadSheet() {
        var sh = null;
        try { sh = JSON.parse(localStorage.getItem(sheetKey()) || 'null'); } catch (e) { sh = null; }
        if (!sh || !Array.isArray(sh.blocks) || !sh.blocks.length) sh = { blocks: [newBlock('b1')] };
        if (!sh.start) sh.start = mondayOnOrBefore(new Date().toISOString().slice(0, 8) + '01');
        sh.blocks.forEach(normBlock);
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
            cur.sheet.blocks = row.data.blocks.map(normBlock); if (row.start_week) cur.sheet.start = row.start_week;
            try { localStorage.setItem(sheetKey(), JSON.stringify({ blocks: cur.sheet.blocks, start: cur.sheet.start })); } catch (e) { /* без памяти */ }
            var typing = document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('ps-in');
            if (!typing && cur.view !== 'rnp') keepScroll(render);
        } else if (cur.sheet.blocks.some(function (b) { return b.nm || Object.keys(b.data || {}).length; })) {
            flushSheet(); // в базе пусто, а в этом браузере уже есть планы: переносим
        }
    }
    function fnum(v, any) { return any ? Math.round(v).toLocaleString('ru') : ''; }
    function fval(v, any, k) { if (!any || v === null || v === undefined || !Number.isFinite(v)) return ''; return PCT_KEYS.indexOf(k) >= 0 ? (Math.round(v * 10) / 10).toLocaleString('ru') : Math.round(v).toLocaleString('ru'); }
    function cellAny(c, k) { return FACT_KEYS.indexOf(k) >= 0 || k.indexOf('pf') === 0 ? c.fAny : (k === 'cashPlan' ? true : c.any); }

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
    function blockHtml(b, weeks, spans) {
        var calc = calcBlock(b, weeks, st.facts && st.facts[b.nm]);
        var head = '<tr class="ps-h1"><th class="ps-l"></th>' + spans.map(function (m) { return '<th colspan="' + m.n + '" class="ps-m">' + m.label + '</th>'; }).join('') + '</tr>' +
            '<tr class="ps-h2"><th class="ps-l">Неделя с</th>' + weeks.map(function (w) { return '<th class="' + (w.first ? 'ps-m' : '') + '">' + ddmm(w.start) + '</th>'; }).join('') + '</tr>' +
            '<tr class="ps-h3"><th class="ps-l">по</th>' + weeks.map(function (w) { return '<th class="' + (w.first ? 'ps-m' : '') + '">' + ddmm(w.end) + '</th>'; }).join('') + '</tr>';
        var colTot = (b.colors || []).map(function (c) { var t = 0; weeks.forEach(function (w) { t += num((c.qty || {})[w.start]); }); return t; });
        var grand = colTot.reduce(function (a, x) { return a + x; }, 0);
        var colRows = '<tr class="ps-sec"><th class="ps-l" colspan="' + (weeks.length + 1) + '">Поставки по цветам</th></tr>' + (b.colors || []).map(function (c, ci) {
            return '<tr class="ps-r ps-cr"><th class="ps-l"><input class="ps-cn" type="text" data-b="' + b.id + '" data-ci="' + ci + '" placeholder="Цвет / артикул" value="' + esc(c.name || '') + '"><span class="ps-pct" data-ctot="' + b.id + '|' + ci + '">' + (colTot[ci] ? Math.round(colTot[ci]).toLocaleString('ru') + ' шт · ' + (grand ? Math.round(colTot[ci] / grand * 100) : 0) + '%' : '') + '</span></th>' + weeks.map(function (w) {
                var v = (c.qty || {})[w.start];
                return '<td class="ps-c' + (w.first ? ' ps-m' : '') + '"><input class="ps-in" type="text" inputmode="decimal" data-b="' + b.id + '" data-ci="' + ci + '" data-w="' + w.start + '" data-k="qty" value="' + esc(has(v) ? v : '') + '"></td>';
            }).join('') + '</tr>';
        }).join('') + ((b.colors || []).length < 12 ? '<tr class="ps-r"><th class="ps-l"><button type="button" class="ps-addc" data-ps-color="' + b.id + '">+ цвет</button></th><td colspan="' + weeks.length + '"></td></tr>' : '');
        var rows = colRows + '<tr class="ps-sec"><th class="ps-l" colspan="' + (weeks.length + 1) + '">Недели</th></tr>' + WROWS.map(function (r) {
            if (r.sec) return '<tr class="ps-sec"><th class="ps-l" colspan="' + (weeks.length + 1) + '">' + r.sec + '</th></tr>';
            return '<tr class="ps-r' + (r.bold ? ' ps-rb' : '') + '"><th class="ps-l">' + r.label + '</th>' + weeks.map(function (w, i) {
                var cls = (w.first ? ' ps-m' : '');
                if (r.input) {
                    var v = ((b.data || {})[w.start] || {})[r.k];
                    return '<td class="ps-c' + cls + '"><input class="ps-in" type="text" inputmode="decimal" data-b="' + b.id + '" data-w="' + w.start + '" data-k="' + r.k + '" value="' + esc(has(v) ? v : '') + '"></td>';
                }
                return '<td class="ps-c ps-calc' + cls + (r.bold ? ' ps-bold' : '') + '" data-calc="' + b.id + '|' + i + '|' + r.k + '">' + fval(calc[i][r.k], cellAny(calc[i], r.k), r.k) + '</td>';
            }).join('') + '</tr>';
        }).join('');
        var opts = '<option value="">Выберите артикул</option>' + st.articles.map(function (a) { return '<option value="' + a.nm_id + '"' + (String(a.nm_id) === String(b.nm) ? ' selected' : '') + '>' + esc(a.name) + ' · ' + a.nm_id + '</option>'; }).join('');
        var par = PARAMS.map(function (p) {
            var v = (b.params || {})[p.k];
            var ph = p.k === 'vol' && num((b.params || {}).dl) * num((b.params || {}).dw) * num((b.params || {}).dh) > 0 ? volOf(b.params) + ' (по габаритам)' : '';
            return '<label class="ps-par"><span>' + p.label + '</span><input class="ps-pin" type="text" inputmode="decimal" data-b="' + b.id + '" data-p="' + p.k + '" value="' + esc(has(v) ? v : '') + '" placeholder="' + esc(ph) + '"></label>';
        }).join('');
        return '<section class="ps-block" data-blk="' + b.id + '"><div class="ps-bh2"><select class="ps-art" data-ps-art="' + b.id + '">' + opts + '</select>' +
            '<button type="button" class="ps-wb" data-ps-wb="' + b.id + '"' + (b.nm ? '' : ' disabled') + '>Подтянуть с WB</button><span class="ps-wbn" data-wbn="' + b.id + '"></span>' + (st.sheet.blocks.length > 1 ? '<button type="button" class="ps-del" data-ps-del="' + b.id + '" aria-label="Убрать блок">×</button>' : '') + '</div>' +
            '<div class="ps-pars">' + par + '</div>' +
            '<div class="ps-scroll"><table class="ps-table"><thead>' + head + '</thead><tbody>' + rows + '</tbody></table></div></section>';
    }
    function renderSales() {
        var sh = st.sheet, weeks = sheetWeeks(sh.start, sh.count), spans = monthSpans(weeks);
        var seen = {}; weeks.forEach(function (w) { var k = w.year + '-' + w.month; w.first = !seen[k]; seen[k] = 1; });
        st.host.innerHTML = viewTabs() +
            '<div class="ps-note">Один блок на артикул. Вверху константы артикула, ниже недели. Вводите план заказов, цену, ДРР, раздачи и поставки: продажи, возвраты, расходы, перечисление и ЧП считаются сами по формулам вашей таблицы. План заказов и продаж сам попадает в строки «План заказов» и «План продаж» РНП (неделя ÷ 7 на день). Внизу блока факт недель подтягивается из РНП (заказы, продажи, к перечислению, ЧП по финотчёту WB) и сравнивается с планом.</div>' +
            sh.blocks.map(function (b) { return blockHtml(b, weeks, spans); }).join('') +
            '<div class="ps-foot"><button type="button" class="ps-add" data-ps-add>+ Добавить артикул</button></div>';
    }
    // Факт недель из РНП (заказы, продажи, к перечислению, ЧП по финотчёту): подтягивается сам, в фоне
    var factsTimer = null;
    function loadFacts() {
        clearTimeout(factsTimer);
        factsTimer = setTimeout(async function () {
            var cur = st; if (!cur || !cur.factsFn || !cur.sheet) return;
            var nms = cur.sheet.blocks.map(function (b) { return b.nm; }).filter(Boolean);
            if (!nms.length) { cur.facts = {}; return; }
            var weeks = sheetWeeks(cur.sheet.start, cur.sheet.count), today = new Date().toISOString().slice(0, 10);
            var to = weeks[weeks.length - 1].end < today ? weeks[weeks.length - 1].end : today;
            if (weeks[0].start > to) { cur.facts = {}; return; }
            try { cur.facts = await cur.factsFn(nms, weeks[0].start, to); } catch (e) { if (root.console) console.warn('[planning] facts', e && e.message); return; }
            if (st !== cur) return;
            if (cur.view === 'money') keepScroll(renderMoney);
            else if (cur.view === 'sales') cur.sheet.blocks.forEach(function (b) { refreshCalc(b); });
        }, 200);
    }
    // график по неделям: перечисление, ЧП и маркетинг (линии в серой шкале, без цвета)
    function moneyChart(plan, weeks) {
        var last = -1; plan.forEach(function (t, i) { if (t.any) last = i; });
        if (last < 0) return '';
        plan = plan.slice(0, Math.max(last + 2, 6)); weeks = weeks.slice(0, plan.length);
        var W = 880, H = 230, L = 64, R = 12, T = 14, B = 34, iw = W - L - R, ih = H - T - B;
        var max = 0; plan.forEach(function (t) { max = Math.max(max, t.pay, t.profit, t.mkt); });
        var step = Math.pow(10, Math.floor(Math.log10(max || 1))); var top = Math.ceil(max / step) * step || 1;
        var x = function (i) { return L + (plan.length > 1 ? iw * i / (plan.length - 1) : iw / 2); }, y = function (v) { return T + ih - ih * Math.max(0, v) / top; };
        var line = function (k, cls) { return '<polyline class="' + cls + '" fill="none" points="' + plan.map(function (t, i) { return x(i).toFixed(1) + ',' + y(t[k]).toFixed(1); }).join(' ') + '"/>'; };
        var grid = ''; for (var g = 0; g <= 4; g++) { var v = top * g / 4; grid += '<line class="psc-g" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '"/><text class="psc-t" x="' + (L - 8) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + (v >= 1e6 ? (v / 1e6).toFixed(1).replace('.0', '') + ' млн' : Math.round(v / 1e3) + ' тыс') + '</text>'; }
        var months = ''; weeks.forEach(function (w, i) { if (i === 0 || weeks[i - 1].month !== w.month) months += '<text class="psc-t" x="' + x(i).toFixed(1) + '" y="' + (H - 12) + '">' + MSHORT[w.month] + '</text>'; });
        return '<div class="ps-chart"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="План вывода денег по неделям">' + grid + months + line('mkt', 'psc-l3') + line('profit', 'psc-l2') + line('pay', 'psc-l1') + '</svg>' +
            '<div class="ps-leg"><span><i class="psc-k1"></i>К перечислению</span><span><i class="psc-k2"></i>ЧП</span><span><i class="psc-k3"></i>Маркетинг</span></div></div>';
    }
    function renderMoney() {
        var sh = st.sheet, weeks = sheetWeeks(sh.start, sh.count), plan = moneyPlan(sh.blocks, weeks, undefined, st.facts), tot = sumPlan(plan);
        var rows = weeks.map(function (w, i) {
            var t = plan[i], first = i === 0 || weeks[i - 1].month !== w.month;
            return '<tr class="' + (first ? 'ps-mrow' : '') + '"><td class="ps-mo">' + MSHORT[w.month] + '</td><td>' + ddmm(w.start) + '</td><td>' + fnum(t.pay, t.any) + '</td><td>' + fnum(t.profit, t.any) + '</td><td>' + fnum(t.mkt, t.any) + '</td><td>' + fnum(t.sup, t.any) + '</td><td class="ps-fc">' + fnum(t.fpay, t.fany) + '</td><td class="ps-fc">' + fnum(t.fprofit, t.fany) + '</td></tr>';
        }).join('');
        var any = plan.some(function (t) { return t.any; }), anyF = plan.some(function (t) { return t.fany; });
        st.host.innerHTML = viewTabs() +
            '<div class="ps-note">Считается само из листа «План продаж»: перечисление и ЧП приходят через ' + PAYOUT_LAG + ' недели после продаж, маркетинг (внутренний и раздачи) и поставки стоят в той же неделе. Факт к перечислению и ЧП берутся из РНП (финотчёт WB) с тем же сдвигом. Вводить ничего не нужно.</div>' + moneyChart(plan, weeks) +
            '<div class="ps-scroll ps-money"><table class="ps-table ps-mt"><thead><tr><th colspan="8" class="ps-title">Приблизительный план вывода денег</th></tr>' +
            '<tr class="ps-mh"><th>Месяц</th><th>Неделя</th><th>План к перечислению, сом</th><th>План ЧП, сом</th><th>Затраты на маркетинг, сом</th><th>Поставки, шт</th><th class="ps-fh">Факт к перечислению, сом</th><th class="ps-fh">Факт ЧП, сом</th></tr></thead><tbody>' + rows +
            '<tr class="ps-tot"><td colspan="2">Итого</td><td>' + fnum(tot.pay, any) + '</td><td>' + fnum(tot.profit, any) + '</td><td>' + fnum(tot.mkt, any) + '</td><td>' + fnum(tot.sup, any) + '</td><td>' + fnum(tot.fpay, anyF) + '</td><td>' + fnum(tot.fprofit, anyF) + '</td></tr></tbody></table></div>';
    }
    // пересчёт блока на месте после ввода: фокус и прокрутка не сбиваются
    function refreshCalc(b) {
        var weeks = sheetWeeks(st.sheet.start, st.sheet.count), calc = calcBlock(b, weeks, st.facts && st.facts[b.nm]);
        var tots = (b.colors || []).map(function (c) { var t = 0; weeks.forEach(function (w) { t += num((c.qty || {})[w.start]); }); return t; }), grand = tots.reduce(function (a, x) { return a + x; }, 0);
        st.host.querySelectorAll('[data-ctot^="' + b.id + '|"]').forEach(function (el) {
            var i = Number(el.getAttribute('data-ctot').split('|')[1]);
            el.textContent = tots[i] ? Math.round(tots[i]).toLocaleString('ru') + ' шт · ' + (grand ? Math.round(tots[i] / grand * 100) : 0) + '%' : '';
        });
        st.host.querySelectorAll('[data-calc^="' + b.id + '|"]').forEach(function (el) {
            var p = el.getAttribute('data-calc').split('|'), c = calc[Number(p[1])];
            el.textContent = fval(c[p[2]], cellAny(c, p[2]), p[2]);
        });
    }
    // План заказов и продаж из листа ложится в РНП: неделя ÷ 7 на каждый день (rnp_plans.planned_orders / planned_sales).
    // Недели, которые были из листа и опустели, обнуляются; ручные планы «Плана для РНП» не трогаем.
    var syncQueue = {}, syncTimer = null;
    function queueSync(b, oldNm) {
        syncQueue[b.id] = { b: b, oldNm: oldNm || null };
        clearTimeout(syncTimer);
        syncTimer = setTimeout(flushSync, 700);
    }
    function dayVal(v) { return Math.round(v / 7 * 1e6) / 1e6; }
    async function flushSync() {
        clearTimeout(syncTimer); syncTimer = null;
        var cur = st, q = syncQueue; syncQueue = {};
        if (!cur || !cur.db || !cur.sheet) return;
        var weeks = sheetWeeks(cur.sheet.start, cur.sheet.count), now = new Date().toISOString(), rows = [], changed = false;
        Object.keys(q).forEach(function (id) {
            var b = q[id].b, oldNm = q[id].oldNm, calc = calcBlock(b, weeks);
            b.synced = b.synced || {};
            var push = function (nm, wk, o, s) { weekDaysOf(wk).forEach(function (d) { rows.push({ cabinet_id: cur.cab, nm_id: Number(nm), plan_date: d, planned_orders: o, planned_sales: s, updated_at: now }); }); };
            if (oldNm) { Object.keys(b.synced).forEach(function (wk) { push(oldNm, wk, null, null); }); b.synced = {}; changed = true; }
            if (!b.nm) return;
            weeks.forEach(function (w, i) {
                var c = calc[i];
                if (c.any && (has(((b.data || {})[w.start] || {}).orders))) { push(b.nm, w.start, dayVal(c.orders), dayVal(c.sales)); if (!b.synced[w.start]) { b.synced[w.start] = 1; changed = true; } }
                else if (b.synced[w.start]) { push(b.nm, w.start, null, null); delete b.synced[w.start]; changed = true; }
            });
        });
        if (!rows.length) return;
        var res = await cur.db.from('rnp_plans').upsert(rows, { onConflict: 'cabinet_id,nm_id,plan_date' });
        if (res && res.error) { if (root.console) console.warn('[planning] sync to RNP', res.error.message); Object.keys(q).forEach(function (id) { syncQueue[id] = q[id]; }); syncTimer = setTimeout(flushSync, 5000); return; }
        if (changed) saveSheet();
        if (cur.onSaved) cur.onSaved();
    }
    function weekDaysOf(ymd) { var o = []; for (var i = 0; i < 7; i++) o.push(addDays(ymd, i)); return o; }
    function findBlock(id) { return st.sheet.blocks.filter(function (x) { return x.id === id; })[0]; }
    function parseVal(t) {
        var raw = String(t.value).trim().replace(/\s/g, '').replace(',', '.'), v = raw === '' ? '' : Number(raw);
        if (raw !== '' && !Number.isFinite(v)) { t.classList.add('is-err'); return null; }
        t.classList.remove('is-err'); return v;
    }
    // «Подтянуть с WB»: габариты и предмет из карточки, тарифы логистики и хранения WB, комиссия предмета,
    // % выкупа и СПП по факту за 30 дней. Обычный выбор артикула заполняет только пустые поля, кнопка обновляет все эти поля.
    var WB_PARAMS = ['dl', 'dw', 'dh', 'logi', 'extra', 'stor', 'comm', 'buyout', 'spp'];
    async function wbFn(name, body) {
        try { var r = await st.db.functions.invoke(name, { body: body || {} }); return r && r.data && r.data.ok ? r.data : null; } catch (e) { return null; }
    }
    async function autofill(b, force) {
        var cur = st; if (!cur || !cur.db || !b.nm) return;
        var note = function (t) { var el = cur.host && cur.host.querySelector('[data-wbn="' + b.id + '"]'); if (el) el.textContent = t; };
        note('Тянем данные WB…');
        var nm = Number(b.nm), got = [], from = new Date(Date.now() - 30 * 86400e3).toISOString().slice(0, 10);
        var fill = function (k, v) {
            var n = Number(v); if (!Number.isFinite(n) || n <= 0) return;
            if (force || !has(b.params[k])) { b.params[k] = Math.round(n * 100) / 100; got.push(k); }
        };
        try {
            var a = ((await cur.db.from('rnp_articles').select('dim_l_cm,dim_w_cm,dim_h_cm,subject_name').eq('cabinet_id', cur.cab).eq('nm_id', nm).limit(1)).data || [])[0];
            if (a) { fill('dl', a.dim_l_cm); fill('dw', a.dim_w_cm); fill('dh', a.dim_h_cm); }
            var tr = await wbFn('wb-tariffs');
            if (tr) { fill('logi', tr.delivery_base); fill('extra', tr.delivery_liter); fill('stor', tr.storage_liter); }
            if (a && a.subject_name) {
                var cm = await wbFn('wb-commission', { subjects: [a.subject_name] });
                var it = cm && cm.items && cm.items[String(a.subject_name).trim().toLowerCase()];
                if (it) fill('comm', it.fbo || it.fbs);
            }
            var rows = (await cur.db.from('rnp_daily_data').select('buyout_pct,spp_pct,orders_count').eq('cabinet_id', cur.cab).eq('nm_id', nm).gte('date', from)).data || [];
            var bo = rows.filter(function (r) { return num(r.orders_count) >= 3 && num(r.buyout_pct) > 0; }), sp = rows.filter(function (r) { return num(r.spp_pct) > 0; });
            if (bo.length) fill('buyout', bo.reduce(function (x, r) { return x + num(r.buyout_pct); }, 0) / bo.length);
            if (sp.length) fill('spp', sp.reduce(function (x, r) { return x + num(r.spp_pct); }, 0) / sp.length);
        } catch (e) { if (root.console) console.warn('[planning] autofill', e && e.message); }
        if (st !== cur) return;
        if (got.length) {
            saveSheet();
            got.forEach(function (k) { var i = cur.host.querySelector('.ps-pin[data-b="' + b.id + '"][data-p="' + k + '"]'); if (i) i.value = b.params[k]; });
            var vi = cur.host.querySelector('.ps-pin[data-b="' + b.id + '"][data-p="vol"]');
            if (vi) vi.placeholder = num(b.params.dl) * num(b.params.dw) * num(b.params.dh) > 0 ? volOf(b.params) + ' (по габаритам)' : '';
            refreshCalc(b); queueSync(b);
        }
        note(got.length ? 'Подтянуто с WB: ' + got.length + ' из ' + WB_PARAMS.length + ' полей' : 'С WB ничего нового');
    }

    function onSheetEvent(e) {
        var t = e.target;
        if (e.type === 'change' && t.classList && t.classList.contains('ps-in')) {
            var b = findBlock(t.dataset.b); if (!b) return true;
            var v = parseVal(t); if (v === null) return true;
            if (t.dataset.k === 'qty') {
                var col = (b.colors || [])[Number(t.dataset.ci)]; if (!col) return true;
                col.qty = col.qty || {};
                if (v === '') delete col.qty[t.dataset.w]; else col.qty[t.dataset.w] = v;
            } else {
                b.data = b.data || {}; var wk = (b.data[t.dataset.w] = b.data[t.dataset.w] || {});
                if (v === '') delete wk[t.dataset.k]; else wk[t.dataset.k] = v;
            }
            saveSheet(); refreshCalc(b); queueSync(b); return true;
        }
        if (e.type === 'change' && t.classList && t.classList.contains('ps-cn')) {
            var cb = findBlock(t.dataset.b), cc = cb && (cb.colors || [])[Number(t.dataset.ci)]; if (cc) { cc.name = t.value.trim(); saveSheet(); } return true;
        }
        if (e.type === 'change' && t.classList && t.classList.contains('ps-pin')) {
            var pb = findBlock(t.dataset.b); if (!pb) return true;
            var pv = parseVal(t); if (pv === null) return true;
            pb.params = pb.params || {};
            if (pv === '') delete pb.params[t.dataset.p]; else pb.params[t.dataset.p] = pv;
            saveSheet(); refreshCalc(pb); queueSync(pb);
            if (['dl', 'dw', 'dh'].indexOf(t.dataset.p) >= 0) { var vi = st.host.querySelector('.ps-pin[data-b="' + pb.id + '"][data-p="vol"]'); if (vi) vi.placeholder = num(pb.params.dl) * num(pb.params.dw) * num(pb.params.dh) > 0 ? volOf(pb.params) + ' (по габаритам)' : ''; }
            return true;
        }
        if (e.type === 'change' && t.matches && t.matches('.ps-art')) {
            var bb = findBlock(t.dataset.psArt); if (bb) { var oldNm = bb.nm; bb.nm = t.value; saveSheet(); queueSync(bb, oldNm); var wbb = st.host.querySelector('[data-ps-wb="' + bb.id + '"]'); if (wbb) wbb.disabled = !bb.nm; loadFacts(); if (bb.nm) autofill(bb, false); } return true;
        }
        if (e.type !== 'click') return false;
        var btn = t.closest && t.closest('button'); if (!btn) return false;
        if (btn.dataset.view) { st.view = btn.dataset.view; render(); if (st.view !== 'rnp') loadFacts(); if (st.view === 'rnp') loadPlans().then(function () { if (st && st.view === 'rnp') render(); }).catch(function () { /* без планов */ }); return true; }
        if (btn.dataset.psColor) { var ab = findBlock(btn.dataset.psColor); if (ab && ab.colors.length < 12) { ab.colors.push({ name: '', qty: {} }); saveSheet(); keepScroll(renderSales); } return true; }
        if (btn.dataset.psWb) { var wb = findBlock(btn.dataset.psWb); if (wb && wb.nm) autofill(wb, true); return true; }
        if (btn.hasAttribute('data-ps-add')) { st.sheet.blocks.push(newBlock('b' + Date.now().toString(36))); saveSheet(); keepScroll(renderSales); return true; }
        if (btn.dataset.psDel) {
            var del = findBlock(btn.dataset.psDel);
            if (del && del.nm) queueSync({ id: del.id, nm: '', params: {}, data: {}, synced: del.synced || {} }, del.nm);
            st.sheet.blocks = st.sheet.blocks.filter(function (x) { return x.id !== btn.dataset.psDel; }); saveSheet(); keepScroll(renderSales); return true;
        }
        return false;
    }
    function keepScroll(fn) {
        var sc = st.host.querySelector('.ps-scroll'), x = sc ? sc.scrollLeft : 0, y = sc ? sc.scrollTop : 0, py = window.scrollY;
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
        st = { factsFn: opts.facts || null, facts: {}, db: opts.db, cab: opts.cabinetId, articles: opts.articles || [], monthKey: key, weeks: weeksOf(key), metric: 'planned_orders', plans: {}, query: '', host: (overlay || ph).firstChild, pageHost: ph, view: ph ? 'sales' : 'rnp', onSaved: opts.onSaved };
        var evHost = overlay || ph;
        st._h = onEvent;
        if (overlay) overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });
        evHost.addEventListener('click', onEvent);
        evHost.addEventListener('change', onEvent);
        evHost.addEventListener('input', onEvent);
        document.addEventListener('keydown', onKey, true);
        if (ph) { render(); pullSheet().then(loadFacts).catch(function () { /* останется память браузера */ }); loadFacts(); loadPlans().then(function () { if (st && st.view === 'rnp') render(); }).catch(function () { /* планы РНП подгрузятся при открытии вкладки */ }); return; }
        st.host.innerHTML = '<div class="rnp-plan-loading">Загрузка…</div>';
        try { await loadPlans(); } catch (e) { st.host.innerHTML = '<div class="rnp-plan-loading">Не удалось загрузить планы: ' + esc(e && e.message) + '</div>'; return; }
        render();
    }

    root.NrPlanning = { open: open, close: close, weeksOf: weeksOf, calcBlock: calcBlock, calcParams: calcParams, sheetWeeks: sheetWeeks, moneyPlan: moneyPlan, sumPlan: sumPlan };
})(typeof window !== 'undefined' ? window : globalThis);

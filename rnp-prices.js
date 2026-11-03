/* РНП → Цены: все артикулы кабинета на одной странице «Полки».
 * Склейки WB (imt_id) стоят на полках внутри групп. У каждого артикула две строки: цена со скидкой и остаток.
 * Над локомотивом строки (больше всего заказов за 30 дней, сами заказы не показываем) корона. Нажали на артикул, и открывается РНП на нём.
 * Страница живёт внутри вкладки РНП: показ и скрытие переключает полоска #rnp-views (меню слева нажимает её кнопки). */
(function (root) {
    'use strict';
    var doc = root.document;
    var DAYS = 30;
    var PAYOUT = 0.70;      // примерная доля цены, которую WB перечисляет продавцу (по финотчётам 70–72%)
    var LOW_PROFIT = 300;   // ниже этой прибыли на штуку (до логистики) строка красная и кнопка переспрашивает
    var CATS = ['Костюмы классические', 'Свитера', 'Пиджаки', 'Спортивные костюмы', 'Летние костюмы', 'Платья и верхняя одежда', 'Другое'];
    var S = { cab: '', view: 'rnp', arts: [], prices: {}, stock: {}, fbo: {}, fbs: {}, pd: {}, ratio: {}, ord: {}, sal: {}, sel: {}, gmap: {}, modal: null, load: { arts: false, prices: false, stock: false, sales: false }, token: 0, raf: 0 };

    function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function fmt(n) { return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
    function sb() { return root.supabase; }
    function cabId() { var c = root.currentCabinetId; if (c) return c; try { return root.localStorage.getItem('selected_cabinet_id') || ''; } catch (_) { return ''; } }
    function ymd(d) { return d.toISOString().slice(0, 10); }
    function period() { var to = new Date(Date.now() + 6 * 3600e3), from = new Date(to.getTime() - (DAYS - 1) * 86400e3); return { from: ymd(from), to: ymd(to) }; }
    function norm(t) { return String(t || '').toLowerCase(); }

    /* ───── чистые функции (проверяются тестом) ───── */
    function catOf(a) {
        var subj = norm(a.subject_name), t = norm(a.card_title) + ' ' + subj;
        if (/свитер/.test(subj)) return 'Свитера';
        if (/пиджак/.test(subj)) return 'Пиджаки';
        if (/платье|куртк|бомбер|полупальто|фуфайк/.test(subj)) return 'Платья и верхняя одежда';
        if (/спортив|велюр|худи/.test(t)) return 'Спортивные костюмы';
        if (/летн|кимоно/.test(t)) return 'Летние костюмы';
        if (/костюм/.test(subj) || /костюм/.test(t)) return 'Костюмы классические';
        return 'Другое';
    }
    function toNum(v) { return Number(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')) || 0; }
    // Новая цена со скидкой: одна цена, минус %, плюс %, плюс или минус сом
    function nextPrice(cur, mode, v) {
        var x = toNum(v), t = mode === 'one' ? x : mode === 'down' ? cur * (1 - x / 100) : mode === 'up' ? cur * (1 + x / 100) : cur + x;
        return Math.max(0, Math.round(t));
    }
    // Цена до скидки так, чтобы со скидкой d % вышло ровно target
    function beforeDiscount(target, d) { return d >= 99 ? 0 : Math.round(target / (1 - (d || 0) / 100)); }
    function ratioPct(fbo, fbs) { var t = (fbo || 0) + (fbs || 0); return t > 0 ? Math.round((fbo || 0) / t * 100) : -1; }
    // Склейки WB: артикулы с одним imt_id. Локомотив строки: артикул с наибольшим числом заказов; короны нет, если в строке один артикул или заказов нет.
    function build(arts, ord, stock, prices, sal, fb) {
        var byImt = {}, order = [];
        arts.forEach(function (a) {
            var k = a.imt_id || ('nm' + a.nm_id);
            if (!byImt[k]) { byImt[k] = { key: k, title: a.card_title || a.name || String(a.nm_id), items: [], cat: catOf(a) }; order.push(k); }
            byImt[k].items.push(a);
        });
        // Одиночные склейки с одним названием (например, шесть полупальто по одному цвету) собираем в одну строку, чтобы страница не пестрила повторами
        var singles = {}, merged = [];
        order.forEach(function (k) {
            var g = byImt[k];
            if (g.items.length === 1) { var sk = g.cat + '|' + norm(g.title); if (singles[sk]) { singles[sk].items.push(g.items[0]); return; } singles[sk] = g; }
            merged.push(k);
        });
        order = merged;
        var cats = {};
        order.forEach(function (k) {
            var g = byImt[k], st = 0, od = 0, mn = Infinity, mx = 0;
            g.items.forEach(function (a) {
                a._o = ord[a.nm_id] || 0; a._s = sal[a.nm_id] || 0; a._k = stock[a.nm_id] || 0; a._p = prices[a.nm_id] || 0;
            });
            g.items.sort(function (x, y) { return (y._o - x._o) || String(x.name || '').localeCompare(String(y.name || ''), 'ru'); });
            g.items.forEach(function (a) { st += a._k; od += a._o; if (a._p) { mn = Math.min(mn, a._p); mx = Math.max(mx, a._p); } });
            g.stock = st; g.orders = od; g.min = mn === Infinity ? 0 : mn; g.max = mx;
            var fo = 0, fs = 0, ps = 0, pn = 0;
            g.items.forEach(function (a) { fo += (fb && fb.fbo[a.nm_id]) || 0; fs += (fb && fb.fbs[a.nm_id]) || 0; if (a._p) { ps += a._p; pn++; } });
            g.avg = pn ? Math.round(ps / pn) : 0; g.fboPct = ratioPct(fo, fs);
            g.loco = g.items.length >= 2 && g.items[0]._o > 0 ? g.items[0].nm_id : 0;
            (cats[g.cat] = cats[g.cat] || { name: g.cat, groups: [], count: 0, stock: 0 });
            cats[g.cat].groups.push(g); cats[g.cat].count += g.items.length; cats[g.cat].stock += st;
        });
        // Группы выше, у которых общий остаток больше; внутри группы выше склейки с большим остатком
        return CATS.filter(function (c) { return cats[c]; }).map(function (c) {
            cats[c].groups.sort(function (a, b) { return (b.stock - a.stock) || (b.orders - a.orders); });
            return cats[c];
        }).sort(function (a, b) { return (b.stock - a.stock) || (CATS.indexOf(a.name) - CATS.indexOf(b.name)); });
    }

    /* ───── загрузка ───── */
    function pageAll(make) {
        var out = [], page = 0;
        function next() {
            return Promise.resolve(make().range(page * 1000, page * 1000 + 999)).then(function (r) {
                var rows = (r && r.data) || []; out = out.concat(rows);
                if (rows.length === 1000 && ++page < 12) return next();
                return out;
            });
        }
        return next();
    }
    function cacheKey(cab) { return 'nr_rp_' + cab; }
    function readCache(cab) { try { return JSON.parse(root.localStorage.getItem(cacheKey(cab)) || 'null'); } catch (_) { return null; } }
    function writeCache() { try { root.localStorage.setItem(cacheKey(S.cab), JSON.stringify({ arts: S.arts, prices: S.prices, stock: S.stock, fbo: S.fbo, fbs: S.fbs, pd: S.pd, ratio: S.ratio, ord: S.ord, sal: S.sal, at: Date.now() })); } catch (_) {} }

    function open() {
        var cab = cabId(); if (!cab || !sb()) { paint(); return; }
        var my = ++S.token, same = cab === S.cab && S.arts.length;
        if (!same) {
            S.cab = cab; var c = readCache(cab);
            S.arts = (c && c.arts) || []; S.prices = (c && c.prices) || {}; S.stock = (c && c.stock) || {}; S.fbo = (c && c.fbo) || {}; S.fbs = (c && c.fbs) || {}; S.pd = (c && c.pd) || {}; S.ratio = (c && c.ratio) || {}; S.ord = (c && c.ord) || {}; S.sal = (c && c.sal) || {};
        }
        S.load = { arts: true, prices: true, stock: true, sales: true };
        paint();
        var per = period();
        loadRatio(cab, my);
        function done(k) { if (my === S.token) { S.load[k] = false; schedule(); } }
        pageAll(function () { return sb().from('rnp_articles').select('nm_id,name,photo_url,imt_id,card_title,subject_name,cost_price').eq('cabinet_id', cab).eq('is_active', true); }).then(function (rows) {
            if (my !== S.token) return; S.arts = rows;
            done('arts'); loadPrices(cab, rows, my);
        }, function () { done('arts'); done('prices'); });
        pageAll(function () { return sb().from('wb_stocks').select('nm_id,quantity,stock_scheme').eq('cabinet_id', cab); }).then(function (rows) {
            if (my !== S.token) return; var st = {}, fo = {}, fs = {};
            rows.forEach(function (x) { var q = Number(x.quantity) || 0; st[x.nm_id] = (st[x.nm_id] || 0) + q; if (String(x.stock_scheme || '').toLowerCase() === 'fbs') fs[x.nm_id] = (fs[x.nm_id] || 0) + q; else fo[x.nm_id] = (fo[x.nm_id] || 0) + q; });
            S.stock = st; S.fbo = fo; S.fbs = fs; done('stock');
        }, function () { done('stock'); });
        pageAll(function () { return sb().from('rnp_daily_data').select('nm_id,funnel_orders,orders_count,sales_count').eq('cabinet_id', cab).gte('date', per.from).lte('date', per.to); }).then(function (rows) {
            if (my !== S.token) return; var o = {}, s = {};
            rows.forEach(function (r) { o[r.nm_id] = (o[r.nm_id] || 0) + (Number(r.funnel_orders) || Number(r.orders_count) || 0); s[r.nm_id] = (s[r.nm_id] || 0) + (Number(r.sales_count) || 0); });
            S.ord = o; S.sal = s; done('sales');
        }, function () { done('sales'); });
    }
    // Цена для покупателя после скидки WB: отношение «итоговая цена / цена со скидкой продавца» по самому свежему заказу артикула
    function loadRatio(cab, my) {
        var from = ymd(new Date(Date.now() + 6 * 3600e3 - 5 * 86400e3));
        pageAll(function () { return sb().from('wb_orders').select('nm_id,order_date,pw:data->>priceWithDisc,fp:data->>finishedPrice').eq('cabinet_id', cab).gte('order_date', from); }).then(function (rows) {
            if (my !== S.token) return; var best = {}, all = [];
            rows.forEach(function (x) {
                var pw = Number(x.pw), fp = Number(x.fp); if (!(pw > 0) || !(fp > 0) || fp > pw) return;
                var r = fp / pw; all.push(r); var b = best[x.nm_id]; if (!b || String(x.order_date) > b.d) best[x.nm_id] = { d: String(x.order_date), r: r };
            });
            var out = {}; Object.keys(best).forEach(function (k) { out[k] = Math.round(best[k].r * 1000) / 1000; });
            all.sort(function (a, b) { return a - b; }); out._med = all.length ? Math.round(all[Math.floor(all.length / 2)] * 1000) / 1000 : 0;
            S.ratio = out; schedule(); writeCache();
        }, function () {});
    }
    function buyerOf(nm, price) { var r = S.ratio[nm] || S.ratio._med || 0; return r && price ? Math.round(price * r) : 0; }
    function loadPrices(cab, arts, my) {
        if (typeof root.callWbProxy !== 'function') { S.load.prices = false; schedule(); return; }
        var nms = arts.map(function (a) { return Number(a.nm_id); }), chunks = [];
        for (var i = 0; i < nms.length; i += 200) chunks.push(nms.slice(i, i + 200));
        Promise.all(chunks.map(function (c) { return Promise.resolve(root.callWbProxy('prices_get', { nmIds: c }, cab)).catch(function () { return null; }); })).then(function (res) {
            if (my !== S.token) return;
            var p = {}, pd = {}, got = false;
            res.forEach(function (r) { ((r && r.items) || []).forEach(function (it) { if (it.discounted > 0) { p[it.nmID] = Math.round(it.discounted); pd[it.nmID] = { price: Math.round(it.price || 0), discount: Math.round(it.discount || 0) }; got = true; } }); });
            if (got) { S.prices = p; S.pd = pd; }
            S.load.prices = false; schedule(); writeCache();
        });
    }

    /* ───── отрисовка ───── */
    var CROWN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
    function schedule() { if (S.raf) return; S.raf = root.requestAnimationFrame ? root.requestAnimationFrame(function () { S.raf = 0; paint(); }) : (paint(), 0); }
    // Плитка 44×56: берём превью 246×328 (около 22 КБ) вместо «big» (около 170 КБ), иначе страница тормозит при прокрутке
    function thumb(u) { return String(u || '').replace('/images/big/', '/images/c246x328/'); }
    function tile(a, loco) {
        var low = a._k < 60 && !S.load.stock ? ' rp-low' : '', sel = S.sel[a.nm_id] ? ' sel' : '';
        return '<div class="rp-it' + (loco ? ' l' : '') + low + sel + '" role="button" tabindex="0" data-nm="' + a.nm_id + '" aria-label="' + esc((a.name || '') + ' · WB ' + a.nm_id) + '">' +
            (loco ? '<span class="rp-cw">' + CROWN + '</span>' : '') +
            '<span class="rp-ph">' + (a.photo_url ? '<img src="' + esc(thumb(a.photo_url)) + '" alt="" loading="lazy" decoding="async">' : '') + '</span>' +
            '<span class="rp-ck" role="checkbox" aria-checked="' + (sel ? 'true' : 'false') + '" aria-label="Выбрать" data-ck="' + a.nm_id + '">' + (sel ? '✓' : '') + '</span>' +
            '<i' + (S.load.prices && !a._p ? ' class="rp-ld"' : '') + '>' + (a._p ? fmt(a._p) : '—') + '</i>' +
            '<s' + (S.load.stock && !S.stock[a.nm_id] ? ' class="rp-ld"' : '') + '>' + fmt(a._k) + '</s></div>';
    }
    function rings(g) {
        var ld = function (k) { return S.load[k] ? ' rp-ld' : ''; };
        var fx = g.fboPct < 0 ? '<div class="rp-ring"><b>—</b><span>ФБО / ФБС</span></div>' : '<div class="rp-ring fx' + ld('stock') + '" style="--fbo:' + g.fboPct + '"><b>' + g.fboPct + ' / ' + (100 - g.fboPct) + '</b><span>ФБО / ФБС</span></div>';
        return '<div class="rp-rings"><div class="rp-ring b' + ld('stock') + '"><b>' + fmt(g.stock) + '</b><span>остаток</span></div>' +
            '<div class="rp-ring' + ld('prices') + '"><b>' + (g.avg ? fmt(g.avg) : '—') + '</b><span>ср. цена</span></div>' + fx + '</div>';
    }
    function skeleton() {
        var row = function () { var t = ''; for (var i = 0; i < 12; i++) t += '<span class="rp-it rp-sk"><span class="rp-ph"></span><i class="rp-ld">0000</i><s class="rp-ld">000</s></span>'; return t; };
        return '<div class="rp-cat rp-ld">Загружаем артикулы</div>' + '<div class="rp-row"><div class="rp-nm rp-ld"><b>Склейка</b><span>ост 0000</span></div><div class="rp-shelf">' + row() + '</div></div><div class="rp-row"><div class="rp-nm rp-ld"><b>Склейка</b><span>ост 0000</span></div><div class="rp-shelf">' + row() + '</div></div>';
    }
    function paint() {
        var pane = doc.getElementById('rnp-prices-pane'); if (!pane || S.view !== 'prices') return;
        var legend = '';
        if (!S.arts.length) {
            pane.innerHTML = legend + '<div class="rp-stage">' + (S.load.arts ? skeleton() : '<div class="rp-empty"><b>В этом кабинете пока нет артикулов в РНП</b><p>Добавьте артикулы в РНП, и они появятся здесь по склейкам.</p></div>') + '</div>';
            return;
        }
        var cats = build(S.arts, S.ord, S.stock, S.prices, S.sal, { fbo: S.fbo, fbs: S.fbs }), total = S.arts.length, gi = 0;
        S.gmap = {};
        var html = cats.map(function (c) {
            return '<div class="rp-cat">' + esc(c.name) + ' · ' + c.count + ' арт. · остаток ' + fmt(c.stock) + '</div>' + c.groups.map(function (g) {
                var key = 'g' + (gi++); S.gmap[key] = { title: g.title, nms: g.items.map(function (a) { return a.nm_id; }), imt: g.items[0].imt_id || 0, avg: g.avg };
                return '<div class="rp-row"><div class="rp-nm" data-nm="' + (g.loco || g.items[0].nm_id) + '"><b>' + esc(g.title) + '</b><span>' + g.items.length + ' арт.' + (g.min ? ' · ' + fmt(g.min) + (g.max > g.min ? '–' + fmt(g.max) : '') : '') + '</span></div>' +
                    '<div class="rp-shelf">' + g.items.map(function (a) { return tile(a, a.nm_id === g.loco); }).join('') + '</div>' +
                    '<div class="rp-side">' + rings(g) + '<div class="rp-acts"><button type="button" class="rp-btn" data-act="price" data-g="' + key + '">Цена</button><button type="button" class="rp-btn" data-act="move" data-g="' + key + '">Перенести</button></div></div></div>';
            }).join('');
        }).join('');
        var nsel = Object.keys(S.sel).length, bar = '';
        if (nsel) {
            var names = Object.keys(S.sel).slice(0, 3).map(function (nm) { var a = artOf(nm); return a ? (a.name || nm) : nm; }).join(', ');
            bar = '<div class="rp-bar"><b>Выбрано ' + nsel + '</b><span class="rp-barn">' + esc(names) + (nsel > 3 ? ' и ещё ' + (nsel - 3) : '') + '</span><span class="rp-sp"></span>' +
                '<button type="button" class="rp-btn w" data-act="price" data-g="sel">Изменить цену</button><button type="button" class="rp-btn" data-act="move" data-g="sel">Перенести в склейку</button><button type="button" class="rp-btn" data-act="clear">Снять выбор</button></div>';
        }
        var sc = pane.scrollTop;
        pane.innerHTML = legend + '<div class="rp-stage">' + html + '</div><div class="rp-foot">' + total + ' артикулов</div>' + bar;
        pane.scrollTop = sc;
    }
    function artOf(nm) { for (var i = 0; i < S.arts.length; i++) if (String(S.arts[i].nm_id) === String(nm)) return S.arts[i]; return null; }
    function toast(type, title, text) { try { if (root.NrUi && root.NrUi.toast) root.NrUi.toast(type, title, text || ''); } catch (_) {} }

    /* ───── окна: цена и перенос ───── */
    function nmsOf(g) { return g === 'sel' ? Object.keys(S.sel).map(Number) : ((S.gmap[g] && S.gmap[g].nms) || []).map(Number); }
    function closeModal() { S.modal = null; var m = doc.getElementById('rp-modal'); if (m) m.remove(); }
    function openModal(kind, g) {
        var nms = nmsOf(g); if (!nms.length) return;
        S.modal = { kind: kind, nms: nms, mode: 'one', val: '', target: '', confirm: false, busy: false };
        var m = doc.getElementById('rp-modal');
        if (!m) { m = doc.createElement('div'); m.id = 'rp-modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); doc.body.appendChild(m); bindModal(m); }
        paintModal();
        var inp = doc.getElementById('rp-val'); if (inp) setTimeout(function () { try { inp.focus(); } catch (_) {} }, 30);
    }
    function priceRows(M) {
        return M.nms.map(function (nm) {
            var a = artOf(nm) || {}, cur = S.prices[nm] || 0, t = M.val === '' ? cur : nextPrice(cur, M.mode, M.val), cost = Number(a.cost_price) || 0;
            var pf = cost ? Math.round(t * PAYOUT - cost) : null, pf0 = cost ? Math.round(cur * PAYOUT - cost) : null;
            return { nm: nm, name: a.name || nm, cur: cur, t: t, pf: pf, pf0: pf0, bad: pf != null && pf < LOW_PROFIT, wrong: !(cur > 0) || t < 100 || t > 1000000 };
        });
    }
    function paintModal() {
        var m = doc.getElementById('rp-modal'), M = S.modal; if (!m || !M) return;
        var head, body, foot;
        if (M.kind === 'price') {
            var rows = priceRows(M), anyBad = rows.some(function (r) { return r.bad && M.val !== ''; }), anyWrong = rows.some(function (r) { return r.wrong && M.val !== ''; });
            var seg = [['one', 'Одна цена'], ['down', '−%'], ['up', '+%'], ['abs', '−/+ сом']].map(function (x) { return '<button type="button" class="rp-sg' + (M.mode === x[0] ? ' on' : '') + '" data-pm="' + x[0] + '">' + x[1] + '</button>'; }).join('');
            var lab = { one: 'Новая цена со скидкой, сом', down: 'Снизить на, %', up: 'Поднять на, %', abs: 'Изменить на, сом (минус снижает)' }[M.mode];
            head = 'Цена: ' + M.nms.length + ' арт.';
            body = '<div class="rp-seg">' + seg + '</div><label class="rp-lab" for="rp-val">' + lab + '</label><input id="rp-val" class="rp-inp" inputmode="decimal" autocomplete="off" value="' + esc(M.val) + '">' +
                '<div class="rp-tw"><table class="rp-tbl"><tr><th>Артикул</th><th class="n">Было</th><th class="n">Станет</th><th class="n">Покупатель</th><th class="n">≈ прибыль/шт</th></tr>' + rows.map(function (r) {
                    return '<tr><td>' + esc(r.name) + '</td><td class="n">' + (r.cur ? fmt(r.cur) : '—') + '</td><td class="n' + (M.val !== '' && !r.wrong ? (r.t < r.cur ? ' dn' : (r.t > r.cur ? ' up' : '')) : '') + '">' + (M.val === '' ? '—' : fmt(r.t)) + '</td><td class="n">' + (buyerOf(r.nm, M.val === '' ? r.cur : r.t) ? fmt(buyerOf(r.nm, M.val === '' ? r.cur : r.t)) : '—') + '</td><td class="n' + (r.bad && M.val !== '' ? ' dn' : '') + '">' + (r.pf == null ? '—' : (r.pf0 != null && M.val !== '' ? fmt(r.pf0) + ' → ' : '') + fmt(r.pf)) + '</td></tr>';
                }).join('') + '</table></div>' +
                '<p class="rp-hint">Покупатель: цена для покупателя после скидки WB (по свежим заказам). Прибыль примерная: цена × 70% (доля, которую WB перечисляет) − себестоимость, без логистики и налога. Скидку артикула не трогаем, цена до скидки пересчитывается сама. Прошлые цены сохраняются в журнале цен.</p>' +
                (anyWrong ? '<p class="rp-warn">Цена должна быть от 100 сом, у артикула должна быть текущая цена из WB.</p>' : '') +
                (anyBad ? '<p class="rp-warn">У части артикулов примерная прибыль ниже ' + LOW_PROFIT + ' сом на штуку.</p>' : '');
            foot = '<button type="button" class="rp-btn q" data-mc="close">Отмена</button><button type="button" class="rp-btn go" data-mc="apply"' + (M.val === '' || anyWrong || M.busy ? ' disabled' : '') + '>' + (anyBad && !M.confirm ? 'Применить к ' + M.nms.length + ' (проверьте прибыль)' : 'Применить к ' + M.nms.length) + '</button>';
        } else {
            var curImt = {}; M.nms.forEach(function (nm) { var a = artOf(nm); if (a) curImt[a.imt_id || ('nm' + nm)] = 1; });
            var opts = Object.keys(S.gmap).map(function (k) { return { k: k, g: S.gmap[k] }; }).filter(function (o) { return o.g.imt && !curImt[o.g.imt]; });
            head = 'Перенести ' + M.nms.length + ' арт.';
            body = '<div class="rp-lab">Куда</div><div class="rp-opts">' + opts.map(function (o) {
                return '<button type="button" class="rp-opt' + (M.target === String(o.g.imt) ? ' on' : '') + '" data-tg="' + o.g.imt + '"><b>' + esc(o.g.title) + '</b><span>' + o.g.nms.length + ' арт.' + (o.g.avg ? ' · цена ' + fmt(o.g.avg) : '') + '</span></button>';
            }).join('') + '<button type="button" class="rp-opt' + (M.target === '0' ? ' on' : '') + '" data-tg="0"><b>Отделить в отдельные карточки</b><span>убрать из склейки</span></button></div>' +
                '<p class="rp-hint">WB объединяет карточки: у артикулов станет общий рейтинг и общие отзывы. В склейке не больше 30 артикулов. Отменить можно только обратным переносом. Перенос идёт в WB и занимает до минуты.</p>';
            foot = '<button type="button" class="rp-btn q" data-mc="close">Отмена</button><button type="button" class="rp-btn go" data-mc="apply"' + (M.target === '' || M.busy ? ' disabled' : '') + '>Перенести</button>';
        }
        var inpVal = doc.getElementById('rp-val'), keep = inpVal && doc.activeElement === inpVal;
        m.innerHTML = '<div class="rp-dlg"><div class="rp-dh"><b>' + esc(head) + '</b><button type="button" class="rp-x" data-mc="close" aria-label="Закрыть">✕</button></div><div class="rp-db">' + body + '</div><div class="rp-df">' + foot + '</div></div>';
        if (keep) { var n = doc.getElementById('rp-val'); if (n) { n.focus(); try { n.setSelectionRange(n.value.length, n.value.length); } catch (_) {} } }
    }
    function bindModal(m) {
        m.addEventListener('click', function (e) {
            var M = S.modal; if (!M) return;
            if (e.target === m || e.target.closest('[data-mc="close"]')) { closeModal(); return; }
            var b;
            if ((b = e.target.closest('[data-pm]'))) { M.mode = b.getAttribute('data-pm'); M.confirm = false; paintModal(); return; }
            if ((b = e.target.closest('[data-tg]'))) { M.target = b.getAttribute('data-tg'); paintModal(); return; }
            if (e.target.closest('[data-mc="apply"]')) { M.kind === 'price' ? applyPrice() : applyMove(); }
        });
        m.addEventListener('input', function (e) { if (S.modal && e.target.id === 'rp-val') { S.modal.val = e.target.value; S.modal.confirm = false; paintModal(); } });
        doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && S.modal) closeModal(); });
    }
    function applyPrice() {
        var M = S.modal; if (!M || M.busy) return;
        var rows = priceRows(M); if (rows.some(function (r) { return r.wrong; })) return;
        if (rows.some(function (r) { return r.bad; }) && !M.confirm) { M.confirm = true; paintModal(); var d = doc.querySelector('#rp-modal [data-mc="apply"]'); if (d) d.textContent = 'Всё равно применить к ' + M.nms.length; return; }
        var cab = S.cab, items = [], old = {}, prevP = {}, prevD = {};
        rows.forEach(function (r) {
            var pd = S.pd[r.nm] || { price: 0, discount: 0 };
            items.push({ nmID: r.nm, price: beforeDiscount(r.t, pd.discount), discount: pd.discount });
            old[r.nm] = { price: pd.price, discount: pd.discount };
            prevP[r.nm] = S.prices[r.nm]; prevD[r.nm] = { price: pd.price, discount: pd.discount };
        });
        // экран меняется сразу, WB подтверждает в фоне; если не принял, возвращаем как было и говорим об этом
        rows.forEach(function (r) { S.prices[r.nm] = r.t; if (S.pd[r.nm]) S.pd[r.nm] = { price: beforeDiscount(r.t, S.pd[r.nm].discount), discount: S.pd[r.nm].discount }; });
        closeModal(); S.sel = {}; paint(); writeCache();
        toast('info', 'Цены отправлены в WB', rows.length + ' арт.');
        function revert(why) { rows.forEach(function (r) { S.prices[r.nm] = prevP[r.nm]; S.pd[r.nm] = prevD[r.nm]; }); paint(); toast('error', 'Цены не поменялись', why || 'WB не принял. Попробуйте ещё раз.'); }
        Promise.resolve(root.callWbProxy('prices_set', { items: items, old: old }, cab)).then(function (res) {
            if (!res || res.error) { revert(res && res.error); return; }
            var up = res.uploadId, tries = 0;
            if (!up) { toast('success', 'Цены применены в WB', ''); return; }
            (function poll() {
                Promise.resolve(root.callWbProxy('prices_status', { uploadId: up }, cab)).then(function (st) {
                    if (st && st.status === 3) { toast('success', 'Цены применены в WB', ''); return; }
                    if (st && (st.status === 5 || st.status === 6)) { revert((st.errors && st.errors[0] && st.errors[0].text) || 'WB вернул ошибку по части артикулов'); return; }
                    if (++tries < 8) setTimeout(poll, 4000);
                });
            })();
        }).catch(function () { revert(); });
    }
    function applyMove() {
        var M = S.modal; if (!M || M.busy || M.target === '') return;
        var target = Number(M.target) || 0, cab = S.cab, prev = {};
        M.nms.forEach(function (nm) { var a = artOf(nm); if (a) { prev[nm] = a.imt_id; a.imt_id = target || null; } });
        closeModal(); S.sel = {}; paint();
        toast('info', 'Переносим в WB', 'Это занимает до минуты');
        Promise.resolve(root.callWbProxy('cards_move', target ? { targetIMT: target, nmIDs: M.nms } : { nmIDs: M.nms }, cab)).then(function (res) {
            if (!res || res.error) { M.nms.forEach(function (nm) { var a = artOf(nm); if (a) a.imt_id = prev[nm]; }); paint(); toast('error', 'Перенос не удался', (res && res.error) || 'WB не принял. Попробуйте ещё раз.'); return; }
            toast('success', 'Перенесено в WB', ''); writeCache();
            setTimeout(function () { if (S.view === 'prices' && S.cab === cab) open(); }, 1500);   // подтягиваем настоящие номера склеек
        }).catch(function () { M.nms.forEach(function (nm) { var a = artOf(nm); if (a) a.imt_id = prev[nm]; }); paint(); toast('error', 'Перенос не удался', 'Нет связи с WB'); });
    }


    /* ───── Юнит-экономика (по формулам РНП): расходы и прибыль с одной штуки по каждому артикулу, без рекламы ───── */
    var U = { cab: '', arts: [], agg: {}, tax: 0, load: false, token: 0, raf: 0 };
    var UDAYS = 30;
    function num(v) { return Number(v) || 0; }
    // Те же расчёты, что в РНП (wb-formulas.js): к перечислению уже без комиссии, эквайринга и возвратов; себестоимость только на выкупленные (продажи минус возвраты)
    function unitOf(a, cost, taxRate) {
        var n = num(a && a.n); if (!(n > 0)) return null;
        var r = num(a.r), net = Math.max(0, n - r), ss = num(a.ss), price = ss / n, tt = num(a.tt) / n;
        var comm = ss > 0 ? num(a.cm) / ss : 0;                       // комиссия WB, % от цены (как в РНП)
        var log = num(a.dl) / n, sto = num(a.st) / n, pen = num(a.pn) / n, cst = (num(cost) * net) / n;
        var tax = (Number(taxRate) > 0 ? (ss * (net / n)) * Number(taxRate) / 100 : 0) / n;
        var profit = tt - log - sto - pen - cst - tax;
        var commU = Math.min(price * comm / 100, Math.max(0, price - tt));
        return { n: n, r: r, price: price, comm: comm, retPct: r / n * 100, log: log, stoPen: sto + pen, cost: cst, tax: tax,
            resid: Math.max(0, price - tt - commU), commU: commU, profit: profit, margin: price > 0 ? profit / price * 100 : 0, total: profit * n, sales: ss };
    }
    function uCacheKey(cab) { return 'nr_ru_' + cab; }
    function uSchedule() { if (U.raf) return; U.raf = root.requestAnimationFrame ? root.requestAnimationFrame(function () { U.raf = 0; paintUnit(); }) : (paintUnit(), 0); }
    function openUnit() {
        var cab = cabId(); if (!cab || !sb()) { paintUnit(); return; }
        var my = ++U.token;
        if (cab !== U.cab || !U.arts.length) {
            U.cab = cab; U.arts = []; U.agg = {}; U.tax = 0;
            try { var c = JSON.parse(root.localStorage.getItem(uCacheKey(cab)) || 'null'); if (c) { U.arts = c.arts || []; U.agg = c.agg || {}; U.tax = c.tax || 0; } } catch (_) {}
        }
        U.load = true; paintUnit();
        var per = period();
        Promise.all([
            pageAll(function () { return sb().from('rnp_articles').select('nm_id,name,photo_url,imt_id,card_title,subject_name,cost_price').eq('cabinet_id', cab).eq('is_active', true); }),
            pageAll(function () { return sb().from('rnp_daily_data').select('nm_id,sales_count,sales_sum,returns_count,to_transfer,delivery_sum,storage_sum,penalty_sum,deduction_sum,commission_pct').eq('cabinet_id', cab).gte('date', per.from).lte('date', per.to); }),
            Promise.resolve(sb().from('rnp_settings').select('options').eq('cabinet_id', cab).limit(1)).then(function (r) { return (r && r.data && r.data[0] && r.data[0].options) || {}; }, function () { return {}; })
        ]).then(function (a) {
            if (my !== U.token) return;
            var agg = {};
            a[1].forEach(function (x) {
                var g = agg[x.nm_id] = agg[x.nm_id] || { n: 0, r: 0, ss: 0, tt: 0, dl: 0, st: 0, pn: 0, cm: 0 };
                g.n += num(x.sales_count); g.r += num(x.returns_count); g.ss += num(x.sales_sum); g.tt += num(x.to_transfer); g.dl += num(x.delivery_sum);
                g.st += num(x.storage_sum); g.pn += num(x.penalty_sum) + num(x.deduction_sum); g.cm += num(x.commission_pct) * num(x.sales_sum);
            });
            U.arts = a[0]; U.agg = agg; U.tax = num(a[2] && a[2].taxRate); U.load = false; uSchedule();
            try { root.localStorage.setItem(uCacheKey(cab), JSON.stringify({ arts: U.arts, agg: U.agg, tax: U.tax, at: Date.now() })); } catch (_) {}
        }, function () { if (my === U.token) { U.load = false; uSchedule(); } });
    }
    function ruRow(a, u, ld) {
        var cell = function (t, cls) { return '<td class="n' + (cls ? ' ' + cls : '') + (ld ? ' rp-ld' : '') + '">' + t + '</td>'; };
        if (!u) return '';
        var parts = [[u.commU, '#b9b9b9'], [u.resid, '#8a8a8a'], [u.log, '#5a5a5a'], [u.stoPen, '#3a3a3a'], [u.cost, '#d0d0d0'], [u.tax, '#7a7a7a']].map(function (p) { return '<i style="width:' + Math.max(0, p[0] / u.price * 100).toFixed(1) + '%;background:' + p[1] + '"></i>'; }).join('') +
            '<i style="width:' + Math.max(0, u.profit / u.price * 100).toFixed(1) + '%;background:var(--text-primary)"></i>';
        return '<tr data-nm="' + a.nm_id + '"><td class="ru-nm"><span class="ru-im">' + (a.photo_url ? '<img src="' + esc(thumb(a.photo_url)) + '" alt="" loading="lazy" decoding="async">' : '') + '</span><div><b>' + esc(a.name || a.nm_id) + '</b><small>WB ' + a.nm_id + '</small></div></td>' +
            cell(fmt(u.n)) + cell('<b>' + fmt(u.price) + '</b>') + cell(u.comm.toFixed(1).replace('.', ',') + '%') + cell(u.retPct.toFixed(0) + '%') + cell(fmt(u.log)) + cell(u.stoPen ? fmt(u.stoPen) : '—') + cell(fmt(u.cost)) +
            cell('<b class="' + (u.profit <= 0 ? 'dn' : (u.margin >= 15 ? 'up' : '')) + '">' + fmt(u.profit) + '</b>') + cell('<span class="' + (u.margin < 10 ? 'dn' : '') + '">' + u.margin.toFixed(0) + '%</span>') + '<td class="ru-bar"><div class="ru-bw">' + parts + '</div></td></tr>';
    }
    function paintUnit() {
        var pane = doc.getElementById('rnp-unit-pane'); if (!pane || S.view !== 'unit') return;
        var legend = '<div class="ru-leg"><span><i style="background:#b9b9b9"></i>Комиссия WB</span><span><i style="background:#8a8a8a"></i>Возвраты и эквайринг</span><span><i style="background:#5a5a5a"></i>Логистика</span><span><i style="background:#3a3a3a"></i>Хранение и штрафы</span><span><i style="background:#d0d0d0"></i>Себестоимость</span><span><i style="background:var(--text-primary)"></i>Прибыль</span></div>';
        if (!U.arts.length) {
            pane.innerHTML = '<div class="ru-kp rp-ld"><div class="k"><b>0 000 тыс.</b><span>прибыль</span></div><div><b>00%</b><span>маржа</span></div></div>' + (U.load ? '<div class="rp-cat rp-ld">Загружаем артикулы</div>' : '<div class="rp-empty"><b>В этом кабинете пока нет артикулов в РНП</b></div>');
            return;
        }
        var cats = {}, rows = [], tot = { profit: 0, sales: 0, low: 0, best: 0, n: 0 }, none = 0;
        U.arts.forEach(function (a) {
            var u = unitOf(U.agg[a.nm_id], a.cost_price, U.tax); if (!u) { none++; return; }
            u.noCost = !(Number(a.cost_price) > 0);
            tot.profit += u.total; tot.sales += u.sales; tot.n++; if (u.n >= 5 && u.margin < 10) tot.low++; if (u.n >= 10 && u.profit > tot.best) tot.best = u.profit;
            var c = catOf(a); (cats[c] = cats[c] || []).push({ a: a, u: u });
        });
        var order = CATS.filter(function (c) { return cats[c]; }).sort(function (x, y) {
            var tx = cats[x].reduce(function (s, r) { return s + r.u.total; }, 0), ty = cats[y].reduce(function (s, r) { return s + r.u.total; }, 0); return ty - tx;
        });
        var head = '<thead><tr><th class="l">Артикул</th><th>Продаж</th><th>Цена</th><th>Комиссия WB</th><th>Возвраты</th><th>Логистика</th><th>Хран.+штрафы</th><th>Себест.</th><th>Прибыль/шт</th><th>Маржа</th><th class="l">Куда уходит цена</th></tr></thead>';
        var html = order.map(function (c) {
            var list = cats[c].sort(function (x, y) { return y.u.total - x.u.total; }), cp = 0, cs = 0, cn = 0;
            list.forEach(function (r) { cp += r.u.total; cs += r.u.sales; cn += r.u.n; });
            return '<div class="rp-cat">' + esc(c) + ' · ' + list.length + ' арт. · прибыль ' + fmt(cp) + '</div><div class="ru-stage"><table class="ru-tbl">' + head + '<tbody>' +
                list.map(function (r) { return ruRow(r.a, r.u, U.load && !U.agg[r.a.nm_id]); }).join('') +
                '<tr class="tot"><td class="l">Итого по группе</td><td class="n">' + fmt(cn) + '</td><td></td><td></td><td></td><td></td><td></td><td></td><td class="n"><b>' + fmt(cn ? cp / cn : 0) + '</b></td><td class="n">' + (cs ? (cp / cs * 100).toFixed(0) : 0) + '%</td><td class="l">' + fmt(cp) + ' сом</td></tr></tbody></table></div>';
        }).join('');
        var kp = '<div class="ru-kp' + (U.load ? ' ru-stale' : '') + '"><div class="k"><b>' + fmt(tot.profit / 1000) + ' тыс.</b><span>прибыль за ' + UDAYS + ' дней, сом</span></div><div><b>' + (tot.sales ? (tot.profit / tot.sales * 100).toFixed(0) : 0) + '%</b><span>средняя маржа</span></div><div><b>' + tot.low + '</b><span>артикулов с маржой ниже 10%</span></div><div><b>' + fmt(tot.best) + '</b><span>лучшая прибыль с штуки</span></div></div>';
        var sc = pane.scrollTop;
        pane.innerHTML = kp + legend + html + '<div class="rp-foot">' + tot.n + ' артикулов с продажами' + (none ? ', ещё ' + none + ' без продаж за период' : '') + '. Расчёт как в РНП за ' + UDAYS + ' дней, без рекламы' + (U.tax > 0 ? ', налог ' + U.tax + '%' : '') + '.</div>';
        pane.scrollTop = sc;
    }

    /* ───── страница внутри вкладки РНП ───── */
    function setView(v) {
        S.view = v; S.opened = (v === 'prices' || v === 'unit') && !!doc.getElementById('tab-rnp') && doc.getElementById('tab-rnp').classList.contains('active'); try { root.localStorage.setItem('nr_rnp_view', v); } catch (_) {}
        var tab = doc.getElementById('tab-rnp'); if (!tab) return;
        tab.classList.toggle('rp-on', v === 'prices'); tab.classList.toggle('ru-on', v === 'unit');
        Array.prototype.forEach.call(doc.querySelectorAll('#rnp-views [data-rv]'), function (b) { b.classList.toggle('is-on', b.getAttribute('data-rv') === v); b.setAttribute('aria-selected', b.getAttribute('data-rv') === v ? 'true' : 'false'); });
        if (v === 'prices') open();
        else if (v === 'unit') openUnit();
        else if (root.RNP && typeof root.RNP.refreshLayout === 'function') { try { root.RNP.refreshLayout(); } catch (_) {} }
    }
    function goRnp(nm) {
        setView('rnp');
        setTimeout(function () { try { if (root.RNP && root.RNP.pick) root.RNP.pick(Number(nm)); } catch (_) {} }, 60);
    }
    var watching = false;
    function mount() {
        var tab = doc.getElementById('tab-rnp'); if (!tab) return;
        if (!watching && root.MutationObserver) {
            // модуль РНП иногда перерисовывает всю вкладку (смена кабинета): возвращаем полоску и страницу на место
            watching = true; var t = 0;
            new MutationObserver(function () { if (t || doc.getElementById('rnp-views')) return; t = setTimeout(function () { t = 0; mount(); if (S.view === 'prices') paint(); else if (S.view === 'unit') paintUnit(); }, 0); }).observe(tab, { childList: true });
        }
        if (doc.getElementById('rnp-views')) return;
        var bar = doc.createElement('div'); bar.id = 'rnp-views'; bar.setAttribute('role', 'tablist');
        bar.innerHTML = '<button type="button" class="gg-view-btn is-on" role="tab" aria-selected="true" data-rv="rnp">РНП</button><button type="button" class="gg-view-btn" role="tab" aria-selected="false" data-rv="prices">Цены</button><button type="button" class="gg-view-btn" role="tab" aria-selected="false" data-rv="unit">Юнит-экономика</button>';
        var pane = doc.createElement('div'); pane.id = 'rnp-prices-pane'; pane.className = 'rp-pane';
        var upane = doc.createElement('div'); upane.id = 'rnp-unit-pane'; upane.className = 'rp-pane';
        tab.insertBefore(bar, tab.firstChild); tab.appendChild(pane); tab.appendChild(upane);
        upane.addEventListener('click', function (e) { var r = e.target.closest('tr[data-nm]'); if (r) goRnp(r.getAttribute('data-nm')); });
        // после обновления страницы остаёмся на «Ценах», если были на них (открываем, когда вкладка РНП действительно показана)
        try { var sv = root.localStorage.getItem('nr_rnp_view'); if (sv === 'prices') { S.view = 'prices'; tab.classList.add('rp-on'); } else if (sv === 'unit') { S.view = 'unit'; tab.classList.add('ru-on'); } } catch (_) {}
        function kick() { if ((S.view === 'prices' || S.view === 'unit') && tab.classList.contains('active') && !S.opened) { S.opened = true; setView(S.view); } }
        if (root.MutationObserver) new MutationObserver(function () { if (!tab.classList.contains('active')) S.opened = false; kick(); }).observe(tab, { attributes: true, attributeFilter: ['class'] });
        setTimeout(kick, 0);
        bar.addEventListener('click', function (e) { var b = e.target.closest('[data-rv]'); if (b) setView(b.getAttribute('data-rv')); });
        pane.addEventListener('click', function (e) {
            var b;
            if ((b = e.target.closest('[data-ck]'))) { var nm = b.getAttribute('data-ck'); if (S.sel[nm]) delete S.sel[nm]; else S.sel[nm] = true; paint(); return; }
            if ((b = e.target.closest('[data-act]'))) {
                var act = b.getAttribute('data-act');
                if (act === 'clear') { S.sel = {}; paint(); return; }
                openModal(act, b.getAttribute('data-g')); return;
            }
            if ((b = e.target.closest('[data-nm]'))) goRnp(b.getAttribute('data-nm'));
        });
        pane.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('rp-it')) { e.preventDefault(); goRnp(e.target.getAttribute('data-nm')); } });
        // с кнопки РНП на левой панели всегда открывается сам РНП
        doc.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('.rail-btn[data-tab="rnp"]') && S.view !== 'rnp') setView('rnp'); }, true);
    }
    // Сайт сообщает о смене кабинета событием document «cabinet-changed» (кабинет к этому моменту уже выбран): сбрасываем чужие данные и грузим новые
    function onCabinetChanged() { S.cab = ''; S.arts = []; S.prices = {}; S.stock = {}; S.fbo = {}; S.fbs = {}; S.pd = {}; S.ratio = {}; S.ord = {}; S.sal = {}; S.sel = {}; S.token++; U.cab = ''; U.arts = []; U.agg = {}; U.token++; closeModal(); if (S.view === 'prices') open(); else if (S.view === 'unit') openUnit(); }
    doc.addEventListener('cabinet-changed', onCabinetChanged);
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', mount); else mount();

    root.NrRnpPrices = { open: open, setView: setView, _catOf: catOf, _build: build, _nextPrice: nextPrice, _beforeDiscount: beforeDiscount, _ratioPct: ratioPct, _unitOf: unitOf };
})(typeof window !== 'undefined' ? window : globalThis);

/* РНП → Цены: все артикулы кабинета на одной странице «Полки».
 * Склейки WB (imt_id) стоят на полках внутри групп. У каждого артикула четыре строки: цена со скидкой, остаток, заказы и продажи за 30 дней.
 * Над локомотивом склейки (больше всего заказов) корона. Нажали на артикул, и открывается РНП на нём.
 * Страница живёт внутри вкладки РНП: показ и скрытие переключает полоска #rnp-views (меню слева нажимает её кнопки). */
(function (root) {
    'use strict';
    var doc = root.document;
    var DAYS = 30;
    var CATS = ['Костюмы классические', 'Свитера', 'Пиджаки', 'Спортивные костюмы', 'Летние костюмы', 'Платья и верхняя одежда', 'Другое'];
    var S = { cab: '', view: 'rnp', arts: [], prices: {}, stock: {}, ord: {}, sal: {}, load: { arts: false, prices: false, stock: false, sales: false }, token: 0, raf: 0 };

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
    // Склейки WB: артикулы с одним imt_id. Локомотив строки: артикул с наибольшим числом заказов; короны нет, если в строке один артикул или заказов нет.
    function build(arts, ord, stock, prices, sal) {
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
            g.loco = g.items.length >= 2 && g.items[0]._o > 0 ? g.items[0].nm_id : 0;
            (cats[g.cat] = cats[g.cat] || { name: g.cat, groups: [], count: 0, stock: 0 });
            cats[g.cat].groups.push(g); cats[g.cat].count += g.items.length; cats[g.cat].stock += st;
        });
        return CATS.filter(function (c) { return cats[c]; }).map(function (c) {
            cats[c].groups.sort(function (a, b) { return b.orders - a.orders; });
            return cats[c];
        });
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
    function writeCache() { try { root.localStorage.setItem(cacheKey(S.cab), JSON.stringify({ arts: S.arts, prices: S.prices, stock: S.stock, ord: S.ord, sal: S.sal, at: Date.now() })); } catch (_) {} }

    function open() {
        var cab = cabId(); if (!cab || !sb()) { paint(); return; }
        var my = ++S.token, same = cab === S.cab && S.arts.length;
        if (!same) {
            S.cab = cab; var c = readCache(cab);
            S.arts = (c && c.arts) || []; S.prices = (c && c.prices) || {}; S.stock = (c && c.stock) || {}; S.ord = (c && c.ord) || {}; S.sal = (c && c.sal) || {};
        }
        S.load = { arts: true, prices: true, stock: true, sales: true };
        paint();
        var per = period();
        function done(k) { if (my === S.token) { S.load[k] = false; schedule(); } }
        pageAll(function () { return sb().from('rnp_articles').select('nm_id,name,photo_url,imt_id,card_title,subject_name').eq('cabinet_id', cab).eq('is_active', true); }).then(function (rows) {
            if (my !== S.token) return; S.arts = rows;
            done('arts'); loadPrices(cab, rows, my);
        }, function () { done('arts'); done('prices'); });
        pageAll(function () { return sb().from('wb_stocks').select('nm_id,quantity').eq('cabinet_id', cab); }).then(function (rows) {
            if (my !== S.token) return; var st = {}; rows.forEach(function (x) { st[x.nm_id] = (st[x.nm_id] || 0) + (Number(x.quantity) || 0); }); S.stock = st; done('stock');
        }, function () { done('stock'); });
        pageAll(function () { return sb().from('rnp_daily_data').select('nm_id,funnel_orders,orders_count,sales_count').eq('cabinet_id', cab).gte('date', per.from).lte('date', per.to); }).then(function (rows) {
            if (my !== S.token) return; var o = {}, s = {};
            rows.forEach(function (r) { o[r.nm_id] = (o[r.nm_id] || 0) + (Number(r.funnel_orders) || Number(r.orders_count) || 0); s[r.nm_id] = (s[r.nm_id] || 0) + (Number(r.sales_count) || 0); });
            S.ord = o; S.sal = s; done('sales');
        }, function () { done('sales'); });
    }
    function loadPrices(cab, arts, my) {
        if (typeof root.callWbProxy !== 'function') { S.load.prices = false; schedule(); return; }
        var nms = arts.map(function (a) { return Number(a.nm_id); }), chunks = [];
        for (var i = 0; i < nms.length; i += 200) chunks.push(nms.slice(i, i + 200));
        Promise.all(chunks.map(function (c) { return Promise.resolve(root.callWbProxy('prices_get', { nmIds: c }, cab)).catch(function () { return null; }); })).then(function (res) {
            if (my !== S.token) return;
            var p = {}, got = false;
            res.forEach(function (r) { ((r && r.items) || []).forEach(function (it) { if (it.discounted > 0) { p[it.nmID] = Math.round(it.discounted); got = true; } }); });
            if (got) S.prices = p;
            S.load.prices = false; schedule(); writeCache();
        });
    }

    /* ───── отрисовка ───── */
    var CROWN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
    function schedule() { if (S.raf) return; S.raf = root.requestAnimationFrame ? root.requestAnimationFrame(function () { S.raf = 0; paint(); }) : (paint(), 0); }
    function tile(a, loco, ld) {
        var b = function (k, v, extra) { return '<' + k + (S.load[extra] ? ' class="rp-ld"' : '') + '>' + v + '</' + k + '>'; };
        var low = a._k < 60 && !S.load.stock ? ' rp-low' : '';
        return '<button type="button" class="rp-it' + (loco ? ' l' : '') + low + '" data-nm="' + a.nm_id + '" aria-label="' + esc((a.name || '') + ' · WB ' + a.nm_id) + '">' +
            (loco ? '<span class="rp-cw">' + CROWN + '</span>' : '') +
            '<span class="rp-ph">' + (a.photo_url ? '<img src="' + esc(a.photo_url) + '" alt="" loading="lazy" decoding="async">' : '') + '</span>' +
            '<i' + (S.load.prices && !a._p ? ' class="rp-ld"' : '') + '>' + (a._p ? fmt(a._p) : '—') + '</i>' +
            '<s' + (S.load.stock && !S.stock[a.nm_id] ? ' class="rp-ld"' : '') + '>' + fmt(a._k) + '</s>' +
            '<u' + (S.load.sales && !a._o ? ' class="rp-ld"' : '') + '>' + fmt(a._o) + '</u>' +
            '<em' + (S.load.sales && !a._s ? ' class="rp-ld"' : '') + '>' + fmt(a._s) + '</em></button>';
    }
    function skeleton() {
        var row = function () { var t = ''; for (var i = 0; i < 12; i++) t += '<span class="rp-it rp-sk"><span class="rp-ph"></span><i class="rp-ld">0000</i><s class="rp-ld">000</s><u class="rp-ld">00</u><em class="rp-ld">00</em></span>'; return t; };
        return '<div class="rp-cat rp-ld">Загружаем артикулы</div>' + '<div class="rp-row"><div class="rp-nm rp-ld"><b>Склейка</b><span>ост 0000</span></div><div class="rp-shelf">' + row() + '</div></div><div class="rp-row"><div class="rp-nm rp-ld"><b>Склейка</b><span>ост 0000</span></div><div class="rp-shelf">' + row() + '</div></div>';
    }
    function paint() {
        var pane = doc.getElementById('rnp-prices-pane'); if (!pane || S.view !== 'prices') return;
        var legend = '<div class="rp-leg"><span><b>1</b> цена со скидкой</span><span><b>2</b> остаток, меньше 60 красным</span><span><b>3</b> заказы за ' + DAYS + ' дней</span><span><b>4</b> продажи за ' + DAYS + ' дней</span></div>';
        if (!S.arts.length) {
            pane.innerHTML = legend + '<div class="rp-stage">' + (S.load.arts ? skeleton() : '<div class="rp-empty"><b>В этом кабинете пока нет артикулов в РНП</b><p>Добавьте артикулы в РНП, и они появятся здесь по склейкам.</p></div>') + '</div>';
            return;
        }
        var cats = build(S.arts, S.ord, S.stock, S.prices, S.sal), total = S.arts.length;
        var html = cats.map(function (c) {
            return '<div class="rp-cat">' + esc(c.name) + ' · ' + c.count + ' арт. · остаток ' + fmt(c.stock) + '</div>' + c.groups.map(function (g) {
                return '<div class="rp-row"><div class="rp-nm" data-nm="' + (g.loco || g.items[0].nm_id) + '"><b>' + esc(g.title) + '</b><span>ост ' + fmt(g.stock) + (g.min ? ' · ' + fmt(g.min) + (g.max > g.min ? '–' + fmt(g.max) : '') : '') + '</span></div>' +
                    '<div class="rp-shelf">' + g.items.map(function (a) { return tile(a, a.nm_id === g.loco); }).join('') + '</div></div>';
            }).join('');
        }).join('');
        var sc = pane.scrollTop;
        pane.innerHTML = legend + '<div class="rp-stage">' + html + '</div><div class="rp-foot">' + total + ' артикулов</div>';
        pane.scrollTop = sc;
    }

    /* ───── страница внутри вкладки РНП ───── */
    function setView(v) {
        S.view = v;
        var tab = doc.getElementById('tab-rnp'); if (!tab) return;
        tab.classList.toggle('rp-on', v === 'prices');
        Array.prototype.forEach.call(doc.querySelectorAll('#rnp-views [data-rv]'), function (b) { b.classList.toggle('is-on', b.getAttribute('data-rv') === v); b.setAttribute('aria-selected', b.getAttribute('data-rv') === v ? 'true' : 'false'); });
        if (v === 'prices') open();
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
            new MutationObserver(function () { if (t || doc.getElementById('rnp-views')) return; t = setTimeout(function () { t = 0; mount(); if (S.view === 'prices') paint(); }, 0); }).observe(tab, { childList: true });
        }
        if (doc.getElementById('rnp-views')) return;
        var bar = doc.createElement('div'); bar.id = 'rnp-views'; bar.setAttribute('role', 'tablist');
        bar.innerHTML = '<button type="button" class="gg-view-btn is-on" role="tab" aria-selected="true" data-rv="rnp">РНП</button><button type="button" class="gg-view-btn" role="tab" aria-selected="false" data-rv="prices">Цены</button>';
        var pane = doc.createElement('div'); pane.id = 'rnp-prices-pane'; pane.className = 'rp-pane';
        tab.insertBefore(bar, tab.firstChild); tab.appendChild(pane);
        tab.classList.toggle('rp-on', S.view === 'prices');
        if (S.view === 'prices') setTimeout(function () { setView('prices'); }, 0);
        bar.addEventListener('click', function (e) { var b = e.target.closest('[data-rv]'); if (b) setView(b.getAttribute('data-rv')); });
        pane.addEventListener('click', function (e) { var b = e.target.closest('[data-nm]'); if (b) goRnp(b.getAttribute('data-nm')); });
        // с кнопки РНП на левой панели всегда открывается сам РНП
        doc.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('.rail-btn[data-tab="rnp"]') && S.view !== 'rnp') setView('rnp'); }, true);
    }
    root.addEventListener && root.addEventListener('nr-cabinet-changed', function () { S.cab = ''; S.arts = []; if (S.view === 'prices') open(); });
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', mount); else mount();

    root.NrRnpPrices = { open: open, setView: setView, _catOf: catOf, _build: build };
})(typeof window !== 'undefined' ? window : globalThis);

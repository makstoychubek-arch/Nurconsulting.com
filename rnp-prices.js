/* РНП → Товары (бывшие «Цены»): все артикулы кабинета на одной странице «Полки».
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

    /* ───── настройки страницы «Товары»: свои названия блоков и порядок (храним в браузере по кабинету) ───── */
    function prefKey() { return 'nr_rp_prefs_' + (S.cab || cabId()); }
    function prefs() {
        try { var p = JSON.parse(root.localStorage.getItem(prefKey()) || 'null') || {}; return { names: p.names || {}, order: p.order || [], corder: p.corder || [] }; } catch (_) { return { names: {}, order: [], corder: [] }; }
    }
    function savePrefs(p) { try { root.localStorage.setItem(prefKey(), JSON.stringify(p)); } catch (_) {} }
    function nameOf(key, def) { var n = prefs().names[key]; return n ? String(n) : def; }
    function sortBy(arr, order, keyOf) {
        if (!order || !order.length) return arr;
        var idx = function (x) { var i = order.indexOf(keyOf(x)); return i < 0 ? 1e6 : i; };
        return arr.map(function (x, i) { return { x: x, i: i }; }).sort(function (a, b) { return (idx(a.x) - idx(b.x)) || (a.i - b.i); }).map(function (o) { return o.x; });
    }

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
        var tries = 0; (function wait() { if (rnpGroups().length || ++tries > 12 || mpMode() === 'ozon') { if (rnpGroups().length && S.view === 'prices') schedule(); return; } setTimeout(wait, 700); })();
        if (mpMode() !== 'wb') loadOz();
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
    // Подразделы страницы «Товары»: сами товары и юнит-экономика (одна страница, две вкладки наверху)
    function subTabs(on) { return '<div class="rp-subtabs"><button type="button" class="' + (on === 'prices' ? 'on' : '') + '" data-vw="prices">Товары</button><button type="button" class="' + (on === 'unit' ? 'on' : '') + '" data-vw="unit">Юнит-экономика</button></div>'; }
    var GEAR_BTN = '<button type="button" class="rp-gear" data-act="settings" title="Настройки" aria-label="Настройки товаров"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg></button>';
    function schedule() { if (S.raf) return; S.raf = root.requestAnimationFrame ? root.requestAnimationFrame(function () { S.raf = 0; paint(); }) : (paint(), 0); }
    // Плитка 44×56: берём превью 246×328 (около 22 КБ) вместо «big» (около 170 КБ), иначе страница тормозит при прокрутке
    // Фото артикула: из карточки, а если там пусто (после сбоя синка) то по номеру WB, как в РНП и «Остатках»
    function pic(a) {
        if (a.photo_url) return thumb(a.photo_url);
        try { return (root.RNP && root.RNP.wbPhotoUrl && a.nm_id) ? (root.RNP.wbPhotoUrl(a.nm_id, 'c246x328') || '') : ''; } catch (_) { return ''; }
    }
    function thumb(u) { return String(u || '').replace('/images/big/', '/images/c246x328/'); }
    function tile(a, loco) {
        var low = '', sel = S.sel[a.nm_id] ? ' sel' : '';
        return '<div class="rp-it' + (loco ? ' l' : '') + low + sel + '" role="button" tabindex="0" data-nm="' + a.nm_id + '" aria-label="' + esc((a.name || '') + ' · WB ' + a.nm_id) + '">' +
            (loco ? '<span class="rp-cw">' + CROWN + '</span>' : '') +
            '<span class="rp-ph">' + (pic(a) ? '<img src="' + esc(pic(a)) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()">' : '') + '</span>' +
            '<span class="rp-ck" role="checkbox" aria-checked="' + (sel ? 'true' : 'false') + '" aria-label="Выбрать" data-ck="' + a.nm_id + '">' + (sel ? '✓' : '') + '</span>' +
            '<i' + (S.load.prices && !a._p ? ' class="rp-ld"' : '') + '>' + (a._p ? fmt(a._p) : '—') + '</i></div>';
    }
    // Кружок себестоимости: нажал на цифру и правишь (одно значение на склейку)
    function costRing(key, g) {
        var c = gcost(g);
        return '<label class="rp-ring cs"><input class="rp-cost-in" data-gc="' + key + '" inputmode="decimal" autocomplete="off" aria-label="Себестоимость" placeholder="' + (c < 0 ? '…' : '0') + '" value="' + (c > 0 ? c : '') + '"><span>себест.</span></label>';
    }
    function rings(g, key) {
        var ld = function (k) { return S.load[k] ? ' rp-ld' : ''; };
        return '<div class="rp-rings"><div class="rp-ring' + ld('prices') + '"><b>' + (g.avg ? fmt(g.avg) : '—') + '</b><span>ср. цена</span></div>' + costRing(key, g) + '</div>';
    }
    function skeleton() {
        var row = function () { var t = ''; for (var i = 0; i < 12; i++) t += '<span class="rp-it rp-sk"><span class="rp-ph"></span><i class="rp-ld">0000</i><s class="rp-ld">000</s></span>'; return t; };
        return '<div class="rp-cat rp-ld">Загружаем артикулы</div>' + '<div class="rp-row"><div class="rp-nm rp-ld"><b>Склейка</b><span>ост 0000</span></div><div class="rp-shelf">' + row() + '</div></div><div class="rp-row"><div class="rp-nm rp-ld"><b>Склейка</b><span>ост 0000</span></div><div class="rp-shelf">' + row() + '</div></div>';
    }
    /* ───── Ozon: товары по склейкам (линейка товара), цены по склейке ─────
       Склейка Ozon = линейка товара (укороченные, оверсайз, свитера и т.д.), плитка = артикул без размера (цвет), цена меняется у всех
       размеров сразу. Каталог и остатки Ozon берутся из ozon_products и ozon_stocks; цены уходят в Ozon функцией ozon-prices. */
    function mpMode() { return (root.NrMp && root.NrMp.get()) || 'wb'; }
    var OZ = { cab: '', rows: [], stock: {}, load: false, sel: {}, map: {}, token: 0 };
    function ozBase(o) {
        var t = String(o || '').toLowerCase().replace(/[_ ]*(\d{2}(-\d{2})?|xxl|xl|xs|l|m|s)$/i, '').replace(/[_ ]*\d{2}$/, '');
        return t.replace(/^[_ ]+|[_ ]+$/g, '');
    }
    function ozLine(b) { return /^свитер/.test(b) ? 'Свитера' : /^костюм_укороч/.test(b) ? 'Костюмы укороченные' : /^костюм_оверсайз/.test(b) ? 'Костюмы оверсайз' : /^пиджак/.test(b) ? 'Пиджаки' : /^спорт/.test(b) ? 'Спортивные костюмы' : 'Другое'; }
    function ozKey() { return 'nr_rp_oz_' + OZ.cab; }
    function loadOz() {
        var cab = cabId(); if (!cab || !sb()) return;
        var my = ++OZ.token;
        if (OZ.cab !== cab) { OZ.cab = cab; OZ.rows = []; OZ.stock = {}; OZ.sel = {}; try { var c = JSON.parse(root.localStorage.getItem(ozKey()) || 'null'); if (c) { OZ.rows = c.rows || []; OZ.stock = c.stock || {}; } } catch (_) {} }
        OZ.load = true; paint();
        Promise.all([
            pageAll(function () { return sb().from('ozon_products').select('offer_id,name,price,old_price,min_price,image_url,archived').eq('cabinet_id', cab).eq('archived', false); }),
            pageAll(function () { return sb().from('ozon_stocks').select('offer_id,present').eq('cabinet_id', cab); })
        ]).then(function (a) {
            if (my !== OZ.token) return;
            var st = {}; a[1].forEach(function (x) { st[x.offer_id] = (st[x.offer_id] || 0) + (Number(x.present) || 0); });
            OZ.rows = a[0]; OZ.stock = st; OZ.load = false; paint();
            try { root.localStorage.setItem(ozKey(), JSON.stringify({ rows: OZ.rows, stock: OZ.stock })); } catch (_) {}
        }, function () { if (my === OZ.token) { OZ.load = false; paint(); } });
    }
    function ozGroups() {
        var bases = {};
        OZ.rows.forEach(function (r) {
            var b = ozBase(r.offer_id), x = bases[b] = bases[b] || { base: b, offers: [], stock: 0, img: '' };
            x.offers.push(r); x.stock += OZ.stock[r.offer_id] || 0; if (!x.img && r.image_url) x.img = r.image_url;
        });
        var lines = {};
        Object.keys(bases).forEach(function (b) { var l = ozLine(b); (lines[l] = lines[l] || []).push(bases[b]); });
        return sortBy(Object.keys(lines).sort(), prefs().corder.concat(prefs().order), function (l) { return 'oz:' + l; }).map(function (l) {
            var arr = lines[l].sort(function (x, y) { return y.stock - x.stock; }), n = 0, sum = 0, stock = 0, offers = 0;
            arr.forEach(function (x) { x.avg = x.offers.reduce(function (s, r) { return s + (Number(r.price) || 0); }, 0) / (x.offers.length || 1); sum += x.avg; n++; stock += x.stock; offers += x.offers.length; });
            return { line: l, bases: arr, avg: n ? sum / n : 0, stock: stock, offers: offers };
        });
    }
    function ozHtml() {
        var gs = ozGroups(); OZ.map = {};
        if (!gs.length) return '<div class="rp-stage">' + (OZ.load ? skeleton() : '<div class="rp-empty"><b>У этого кабинета нет товаров Ozon</b><p>Подключите ключ Ozon в Настройки → API, товары подтянутся сами.</p></div>') + '</div>';
        var html = gs.map(function (g, i) {
            var key = 'o' + i; OZ.map[key] = g;
            var ocat = (g.bases[0] && g.bases[0].offers[0] && g.bases[0].offers[0].name) || g.line;
            return '<div class="rp-row"><div class="rp-nm"><em class="rp-catg">Категория · ' + esc(ocat) + '</em><b>' + esc(nameOf('oz:' + g.line, g.line)) + '</b><span>' + g.bases.length + ' арт. · ' + g.offers + ' размеров</span></div>' +
                '<div class="rp-shelf">' + g.bases.map(function (x) {
                    var sel = OZ.sel[x.base] ? ' sel' : '';
                    return '<div class="rp-it' + sel + '' + '" role="button" tabindex="0" data-ock="' + esc(x.base) + '" aria-label="' + esc(x.base) + '"><span class="rp-ph">' + (x.img ? '<img src="' + esc(x.img) + '" alt="" loading="lazy" decoding="async">' : '') + '</span>' +
                        '<span class="rp-ck" role="checkbox" aria-checked="' + (sel ? 'true' : 'false') + '">' + (sel ? '✓' : '') + '</span><i>' + (x.avg ? fmt(x.avg) : '—') + '</i></div>';
                }).join('') + '</div>' +
                '<div class="rp-side"><div class="rp-rings"><div class="rp-ring"><b>' + (g.avg ? fmt(g.avg) : '—') + '</b><span>ср. цена</span></div></div>' +
                '<div class="rp-acts"><button type="button" class="rp-btn" data-oact="price" data-og="' + key + '">Цена</button></div></div></div>';
        }).join('');
        var ns = Object.keys(OZ.sel).length, bar = '';
        if (ns) bar = '<div class="rp-bar"><b>Выбрано ' + ns + '</b><span class="rp-barn">' + esc(Object.keys(OZ.sel).slice(0, 3).join(', ') + (ns > 3 ? ' и ещё ' + (ns - 3) : '')) + '</span><span class="rp-sp"></span><button type="button" class="rp-btn w" data-oact="price" data-og="sel">Изменить цену</button><button type="button" class="rp-btn q" data-oact="clear">Снять выбор</button></div>';
        return '<div class="rp-stage">' + html + '</div><div class="rp-foot">' + OZ.rows.length + ' товаров Ozon' + (OZ.load ? ' · обновляем' : '') + '</div>' + bar;
    }
    function ozOffersOf(og) {
        if (og === 'sel') { var out = []; ozGroups().forEach(function (g) { g.bases.forEach(function (x) { if (OZ.sel[x.base]) out = out.concat(x.offers); }); }); return out; }
        var g = OZ.map[og]; return g ? g.bases.reduce(function (a, x) { return a.concat(x.offers); }, []) : [];
    }
    function ozNew(price, mode, v) {
        var p = Number(price) || 0, n = mode === 'one' ? v : mode === 'down' ? p * (1 - v / 100) : mode === 'up' ? p * (1 + v / 100) : p + v;
        return Math.round(n);
    }
    function ozBad(cur, next) { return !(next >= 100) || (cur > 0 && (next < cur * 0.5 || next > cur * 2)); }
    function openOzPrice(og) {
        var offers = ozOffersOf(og); if (!offers.length || !root.NrUi || !root.NrUi.dialog) return;
        var M = { mode: 'down', val: '' };
        var d = root.NrUi.dialog({ title: 'Цена на Ozon: ' + offers.length + ' размеров', size: 'm', body: '<div id="rp-oz"></div>', actions: [{ label: 'Отмена' }, { label: 'Применить', primary: true, keepOpen: true, onClick: function () { return apply(); } }] });
        var box = d.el.querySelector('#rp-oz');
        function calc() { var v = Number(String(M.val).replace(',', '.')) || 0; return offers.map(function (r) { var cur = Number(r.price) || 0, nx = M.val === '' ? cur : ozNew(cur, M.mode, v); return { r: r, cur: cur, nx: nx, bad: M.val !== '' && ozBad(cur, nx) }; }); }
        function paintM() {
            var rows = calc(), bad = rows.filter(function (x) { return x.bad; }).length, seg = [['down', '−%'], ['up', '+%'], ['one', 'Одна цена'], ['abs', '−/+ сом']].map(function (x) { return '<button type="button" class="rp-sg' + (M.mode === x[0] ? ' on' : '') + '" data-pm="' + x[0] + '">' + x[1] + '</button>'; }).join('');
            var lab = { one: 'Новая цена, сом (для всех размеров)', down: 'Снизить на, %', up: 'Поднять на, %', abs: 'Изменить на, сом (минус снижает)' }[M.mode];
            var byBase = {}; rows.forEach(function (x) { var b = ozBase(x.r.offer_id); (byBase[b] = byBase[b] || []).push(x); });
            var tbl = Object.keys(byBase).slice(0, 12).map(function (b) { var a = byBase[b], c = a.reduce(function (s, x) { return s + x.cur; }, 0) / a.length, n = a.reduce(function (s, x) { return s + x.nx; }, 0) / a.length; return '<tr><td>' + esc(b) + '</td><td class="n">' + fmt(c) + '</td><td class="n' + (M.val !== '' ? (n < c ? ' dn' : n > c ? ' up' : '') : '') + '">' + (M.val === '' ? '—' : fmt(n)) + '</td></tr>'; }).join('');
            box.innerHTML = '<div class="rp-seg">' + seg + '</div><label class="rp-lab" for="rp-ozv">' + lab + '</label><input id="rp-ozv" class="rp-inp" inputmode="decimal" autocomplete="off" value="' + esc(M.val) + '">' +
                '<div class="rp-tw"><table class="rp-tbl"><tr><th>Артикул</th><th class="n">Ср. цена сейчас</th><th class="n">Станет</th></tr>' + tbl + '</table></div>' + (Object.keys(byBase).length > 12 ? '<p class="rp-hint">Показаны первые 12 артикулов из ' + Object.keys(byBase).length + '.</p>' : '') +
                '<p class="rp-hint">Цена меняется у каждого размера от его текущей цены. Зачёркнутая цена и ограничение для акций подстраиваются сами. Ozon примет изменение за несколько минут.</p>' +
                (bad ? '<p class="rp-warn">У ' + bad + ' размеров новая цена меньше 100 или отличается от текущей больше чем вдвое: так менять нельзя.</p>' : '');
            var inp = box.querySelector('#rp-ozv'); if (inp) { inp.focus(); try { inp.setSelectionRange(inp.value.length, inp.value.length); } catch (_) {} }
            return rows;
        }
        box.addEventListener('click', function (e) { var b = e.target.closest('[data-pm]'); if (b) { M.mode = b.getAttribute('data-pm'); paintM(); } });
        box.addEventListener('input', function (e) { if (e.target.id === 'rp-ozv') { M.val = e.target.value; paintM(); } });
        paintM();
        function apply() {
            var rows = calc(); if (M.val === '' || !(Number(String(M.val).replace(',', '.')) > 0)) { toast('error', 'Укажите значение', ''); return false; }
            if (rows.some(function (x) { return x.bad; })) { toast('error', 'Так менять нельзя', 'У части размеров цена выходит за допустимое'); return false; }
            ozSend(rows.filter(function (x) { return x.nx !== x.cur; })); OZ.sel = {};
        }
    }
    function ozSend(list) {
        var cab = OZ.cab; if (!list.length) { toast('info', 'Цены не изменились', 'Новые цены равны текущим'); return; }
        var prev = {}; list.forEach(function (x) { prev[x.r.offer_id] = { price: x.r.price, old: x.r.old_price, min: x.r.min_price }; x.r.price = x.nx; });
        paint();
        var h = root.NrUi && root.NrUi.toast ? root.NrUi.toast('info', 'Цены уходят в Ozon…', list.length + ' размеров', { loading: true, key: 'rp-oz' }) : null;
        var items = list.map(function (x) { return { offer_id: x.r.offer_id, price: x.nx }; }), chunks = [];
        for (var i = 0; i < items.length; i += 200) chunks.push(items.slice(i, i + 200));
        var failed = [];
        chunks.reduce(function (p, ch) {
            return p.then(function () { return sb().functions.invoke('ozon-prices', { body: { cabinet_id: cab, items: ch } }); }).then(function (r) {
                var d = r && r.data;
                if (r && r.error || !d || d.error) throw new Error((d && d.error) || (r.error && r.error.message) || 'нет ответа');
                (d.results || []).forEach(function (x) { if (!x.ok) failed.push(x); });
            });
        }, Promise.resolve()).then(function () {
            failed.forEach(function (f) { var r = OZ.rows.filter(function (y) { return y.offer_id === f.offer_id; })[0]; if (r && prev[f.offer_id]) r.price = prev[f.offer_id].price; });
            paint(); try { root.localStorage.setItem(ozKey(), JSON.stringify({ rows: OZ.rows, stock: OZ.stock })); } catch (_) {}
            if (failed.length) toast('error', 'Не всё применилось: ' + failed.length + ' из ' + list.length, String(failed[0].error || '').slice(0, 120));
            else if (h && h.update) h.update('success', 'Цены отправлены в Ozon', list.length + ' размеров, применятся за несколько минут'); else toast('success', 'Цены отправлены в Ozon', list.length + ' размеров');
        }).catch(function (e) {
            list.forEach(function (x) { if (prev[x.r.offer_id]) x.r.price = prev[x.r.offer_id].price; }); paint();
            toast('error', 'Цены не изменились', String(e && e.message || e).slice(0, 140));
        });
        if (h && h.close && false) h.close();
    }
    function ozAct(b) {
        var a = b.getAttribute('data-oact');
        if (a === 'clear') { OZ.sel = {}; paint(); return; }
        if (a === 'price') openOzPrice(b.getAttribute('data-og'));
    }

    function paint() {
        var pane = doc.getElementById('rnp-prices-pane'); if (!pane || S.view !== 'prices') return;
        var m = mpMode();
        if (m === 'wb') { paintWb(); return; }
        if (m === 'all') paintWb(); else pane.innerHTML = '<div class="rp-tools">' + subTabs('prices') + GEAR_BTN + '</div>';
        var sc = pane.scrollTop;
        pane.insertAdjacentHTML('beforeend', (m === 'all' ? '<div class="rp-cat">Ozon</div>' : '') + ozHtml());
        pane.scrollTop = sc;
    }
    // Группы из РНП (общие названия и порядок). Пока РНП не загрузился, пусто и страница строится по склейкам WB
    function rnpGroups() { try { var r = root.RNP && root.RNP.groupsView ? root.RNP.groupsView() : []; return (r || []).filter(function (g) { return g.nms && g.nms.length; }); } catch (_) { return []; } }
    function rgBuild(rg, ord, stock, prices, sal, fb) {
        var byNm = {}; S.arts.forEach(function (a) { byNm[a.nm_id] = a; });
        var out = [];
        rg.forEach(function (g) {
            var items = g.nms.map(function (nm) { return byNm[nm]; }).filter(Boolean);
            if (!items.length) return;
            var st = 0, od = 0, mn = Infinity, mx = 0, ps = 0, pn = 0, fo = 0, fs = 0;
            items.forEach(function (a) {
                a._o = ord[a.nm_id] || 0; a._s = sal[a.nm_id] || 0; a._k = stock[a.nm_id] || 0; a._p = prices[a.nm_id] || 0;
                st += a._k; od += a._o; fo += (fb && fb.fbo[a.nm_id]) || 0; fs += (fb && fb.fbs[a.nm_id]) || 0;
                if (a._p) { mn = Math.min(mn, a._p); mx = Math.max(mx, a._p); ps += a._p; pn++; }
            });
            var top = items.slice().sort(function (x, y) { return y._o - x._o; })[0];
            out.push({ key: g.name, title: g.name, orig: g.orig, items: items, stock: st, orders: od, min: mn === Infinity ? 0 : mn, max: mx, avg: pn ? Math.round(ps / pn) : 0, fboPct: ratioPct(fo, fs), loco: items.length >= 2 && top._o > 0 ? top.nm_id : 0 });
        });
        return out;
    }
    function paintWb() {
        var pane = doc.getElementById('rnp-prices-pane'); if (!pane || S.view !== 'prices') return;
        var legend = '<div class="rp-tools">' + subTabs('prices') + GEAR_BTN + '</div>';
        if (!S.arts.length) {
            pane.innerHTML = legend + '<div class="rp-stage">' + (S.load.arts ? skeleton() : '<div class="rp-empty"><b>В этом кабинете пока нет артикулов в РНП</b><p>Добавьте артикулы в РНП, и они появятся здесь по склейкам.</p></div>') + '</div>';
            return;
        }
        S.gmap = {};
        var gi = 0, total = S.arts.length, rg = rnpGroups(), html;
        function rowHtml(g, key, catLine) {
            return '<div class="rp-row"><div class="rp-nm" data-nm="' + (g.loco || g.items[0].nm_id) + '"><em class="rp-catg">Категория · ' + esc(catLine) + '</em><b>' + esc(g.title) + '</b><span>' + g.items.length + ' арт.' + (g.min ? ' · ' + fmt(g.min) + (g.max > g.min ? '–' + fmt(g.max) : '') : '') + '</span></div>' +
                '<div class="rp-shelf">' + g.items.map(function (a) { return tile(a, a.nm_id === g.loco); }).join('') + '</div>' +
                '<div class="rp-side">' + rings(g, key) + '<div class="rp-acts"><button type="button" class="rp-btn" data-act="price" data-g="' + key + '">Цена</button></div></div></div>';
        }
        if (rg.length) {
            // Группы, названия и порядок общие с РНП (rnp_settings: groupNames, groupOrder, artOrder), одна группа = один блок
            html = rgBuild(rg, S.ord, S.stock, S.prices, S.sal, { fbo: S.fbo, fbs: S.fbs }).map(function (g) {
                var key = 'g' + (gi++); S.gmap[key] = { k: String(g.key), title: g.title, orig: g.orig, cat: '', nms: g.items.map(function (a) { return a.nm_id; }), imt: g.items[0].imt_id || 0, avg: g.avg };
                return rowHtml(g, key, g.orig && g.orig !== g.title ? g.orig : (g.items[0].subject_name || g.title));
            }).join('');
        } else {
            var pf = prefs(), cats = sortBy(build(S.arts, S.ord, S.stock, S.prices, S.sal, { fbo: S.fbo, fbs: S.fbs }), pf.corder, function (c) { return c.name; });
            cats.forEach(function (c) { c.groups = sortBy(c.groups, pf.order, function (g) { return 'wb:' + g.key; }); });
            html = cats.map(function (c) {
                return '<div class="rp-cat">' + esc(c.name) + ' · ' + c.count + ' арт.</div>' + c.groups.map(function (g) {
                    var key = 'g' + (gi++); S.gmap[key] = { k: String(g.key), title: nameOf('wb:' + g.key, g.title), cat: c.name, nms: g.items.map(function (a) { return a.nm_id; }), imt: g.items[0].imt_id || 0, avg: g.avg };
                    return rowHtml({ title: nameOf('wb:' + g.key, g.title), items: g.items, loco: g.loco, min: g.min, max: g.max, avg: g.avg }, key, g.items[0].subject_name || c.name);
                }).join('');
            }).join('');
        }
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
    /* ───── Загрузка себестоимости таблицей (артикул WB и цена за штуку) ─────
       Вставляем строки «название  артикул  себестоимость» (из Excel). Находим артикулы кабинета и пишем себестоимость; ничего не удаляем,
       строки без совпадения в этом кабинете пропускаем и считаем. Нужна, чтобы быстро вернуть себестоимость по всем артикулам сразу. */
    var COST_TABLE_1114 = '334548155:850,334548150:850,334548154:850,334548152:850,334548151:850,334548153:850,247337216:850,247336833:850,971990843:850,971990844:850,414332159:850,247347214:950,429715568:950,287679331:950,287679857:950,409845462:950,247347924:950,287679332:950,409845463:950,280128269:1050,391102732:1050,499378334:1050,391102729:1050,391102728:1050,499380531:1050,247348946:1050,391102730:1050,247348479:1050,280129304:1050,262714507:1150,262760469:1150,435735287:1150,296564448:1150,262697143:1150,247350377:1150,892565628:1150,247350276:1150,296564447:1150,249656298:1450,262659615:1450,624699327:1450,605813197:1450,249650166:1450,249656107:1450,262656530:1450,738066896:1450,262651910:1450,271001364:1650,271001367:1650,271001368:1650,271001369:1650,287679856:950,296556350:1300,435743074:1300,296556346:1300,391116477:1300,391116472:1300,399607068:1300,295201148:1300,296556347:1300,296556348:1300,307425698:800,435746744:800,307425701:800,307425707:800,307425705:800,307425704:800,307425703:800,307425706:800,307425697:800,307425700:800,307425699:800,348098830:830,348096452:830,894289054:830,348098833:830,894289055:830,348098831:830,414333601:830,348098832:830,348098834:830,495053632:1300,495053634:1300,495053630:1300,495053631:1300,495053633:1300,495053638:1300,495053627:1300,495053629:1300,495055924:1150,495055922:1150,629846440:1150,495055921:1150,495055925:1150,495055918:1150,495055919:1150,495055920:1150,495055923:1150,539916078:1550,539916085:1550,611441510:1550,539401904:1550,539916080:1550,539916083:1550,539916086:1550,539908473:1650,539908481:1650,603633471:1650,539401905:1650,539908479:1650,539908477:1650,539908484:1650,547613172:950,547613173:950,547613174:950,547613175:950,949531903:950,604201353:950,604201351:950,664192264:950,949531904:950,604201350:1350,604201358:1350,604201356:1350,597838497:1350,604201352:1350,604201359:1350,604201361:1350,629645156:1400,629645151:1400,629645150:1400,629645152:1400,629645154:1400,629645155:1400,629645153:1400,633661207:1250,633661203:1250,633661208:1250,766251143:1250,633661202:1250,633661205:1250,633639148:1250,705387384:1350,705387380:1350,705381484:1350,705387387:1350,705387388:1350,705387386:1350,705387381:1350,705387382:1350,705387385:1350,705387383:1350,705387379:1350,766251142:1250,849430238:800,849430239:800,1013975274:800,849397339:800,1013975275:800,849397338:800,1013975276:800,889759782:800,849444018:1080,889864456:940,889864459:940,889864458:940,889864457:940,889864460:940,889864461:940,889864462:940,1218799336:678,1218782505:678,1218796940:678,1218802103:678';   // таблица себестоимости владельца от 14 ноября 2026: артикул WB:сом
    function parseCostText(text) {
        var out = {};
        String(text || '').split(/\r?\n/).forEach(function (line) {
            var m = line.match(/(\d{6,})\D+(\d{2,6}(?:[.,]\d+)?)\s*$/); if (!m) return;
            out[m[1]] = Number(m[2].replace(',', '.'));
        });
        return out;
    }
    function applyCostMap(map) {
        var cab = S.cab; if (!cab) return;
        var byCost = {}, total = 0;
        Object.keys(map).forEach(function (nm) { var c = map[nm]; if (!(c >= 0)) return; (byCost[c] = byCost[c] || []).push(Number(nm)); total++; });
        var costs = Object.keys(byCost), matched = 0, failed = false;
        toast('info', 'Загружаем себестоимость', total + ' артикулов из таблицы, это займёт несколько секунд');
        // сразу на экране
        costs.forEach(function (c) { byCost[c].forEach(function (nm) { var a = artOf(nm); if (a) a.cost_price = Number(c); }); });
        paint(); writeCache();
        costs.reduce(function (p, c) {
            return p.then(function () {
                var ids = byCost[c], chunks = []; for (var i = 0; i < ids.length; i += 150) chunks.push(ids.slice(i, i + 150));
                return chunks.reduce(function (pp, ch) {
                    return pp.then(function () { return Promise.resolve(sb().from('rnp_articles').update({ cost_price: Number(c) }).eq('cabinet_id', cab).in('nm_id', ch).select('nm_id')); })
                        .then(function (r) { if (r && r.error) { failed = r.error.message; } else matched += ((r && r.data) || []).length; });
                }, Promise.resolve());
            });
        }, Promise.resolve()).then(function () {
            if (failed) { toast('error', 'Себестоимость загрузилась не вся', String(failed).slice(0, 140)); return; }
            toast('success', 'Себестоимость загружена', 'Обновлено артикулов в этом кабинете: ' + matched + ' из ' + total + (matched < total ? ' (остальных в этом кабинете нет)' : ''));
            try { doc.dispatchEvent(new root.Event('nr-articles-changed')); } catch (_) {}
            open();
        }).catch(function (e) { toast('error', 'Себестоимость не загрузилась', String(e && e.message || e).slice(0, 140)); open(); });
    }
    function openCostImport() {
        if (!root.NrUi || !root.NrUi.dialog) return;
        var d = root.NrUi.dialog({ title: 'Загрузить себестоимость таблицей', size: 'm',
            body: '<p style="margin:0 0 8px;font-size:13px;color:var(--text-muted)">Вставьте строки из таблицы: название, артикул WB и себестоимость за штуку (через табуляцию или пробелы). Артикулы этого кабинета получат эту себестоимость, остальное не меняется.</p>' +
                '<textarea id="rp-ci" style="width:100%;height:200px;border:1px solid var(--text-primary);border-radius:14px;background:transparent;color:inherit;padding:10px;font:12px monospace;box-sizing:border-box" placeholder="кимоно бежевый длинный&#9;334548155&#9;850"></textarea>' +
                '<button type="button" id="rp-ci-fill" class="rp-btn" style="margin-top:8px">Подставить таблицу от 14 ноября</button>',
            actions: [{ label: 'Отмена' }, { label: 'Применить', primary: true, onClick: function () {
                var map = parseCostText((d.el.querySelector('#rp-ci') || {}).value);
                if (!Object.keys(map).length) { toast('error', 'Не нашли строк', 'Нужны строки с артикулом WB и себестоимостью'); return false; }
                applyCostMap(map);
            } }] });
        var fill = d.el.querySelector('#rp-ci-fill');
        if (fill) fill.addEventListener('click', function () { var t = d.el.querySelector('#rp-ci'); if (t) t.value = COST_TABLE_1114.split(',').map(function (p) { var q = p.split(':'); return q[0] + '\t' + q[1]; }).join('\n'); });
    }

    /* Себестоимость одна на склейку: у всех артикулов склейки одно значение (вводится здесь, раньше было в «Остатках»). */
    function gcost(g) {
        var v = g.items.map(function (a) { return Number(a.cost_price) || 0; }), first = v[0];
        return v.every(function (x) { return x === first; }) ? first : -1;
    }
    function saveGroupCost(key, raw) {
        var g = S.gmap[key], cab = S.cab; if (!g || !cab) return;
        var val = Math.max(0, Math.round((Number(String(raw).replace(',', '.').replace(/\s/g, '')) || 0) * 100) / 100);
        var prev = {}; g.nms.forEach(function (nm) { var a = artOf(nm); if (a) { prev[nm] = a.cost_price; a.cost_price = val; } });
        writeCache(); paint();
        Promise.resolve(sb().from('rnp_articles').update({ cost_price: val }).eq('cabinet_id', cab).in('nm_id', g.nms)).then(function (r) {
            if (r && r.error) throw new Error(r.error.message);
            toast('success', 'Себестоимость сохранена', g.title + ': ' + (val ? fmt(val) + ' сом на все артикулы склейки' : 'сброшена'));
            try { doc.dispatchEvent(new root.Event('nr-articles-changed')); } catch (_) {}
        }).catch(function (e) {
            g.nms.forEach(function (nm) { var a = artOf(nm); if (a) a.cost_price = prev[nm]; }); writeCache(); paint();
            toast('error', 'Себестоимость не сохранилась', String(e && e.message || e).slice(0, 120));
        });
    }
    function artOf(nm) { for (var i = 0; i < S.arts.length; i++) if (String(S.arts[i].nm_id) === String(nm)) return S.arts[i]; return null; }
    function toast(type, title, text) { try { if (root.NrUi && root.NrUi.toast) root.NrUi.toast(type, title, text || ''); } catch (_) {} }


    /* ───── окно «Настройки товаров» (шестерёнка): себестоимость из Excel, названия, перенос, порядок блоков ─────
       Группы WB общие с РНП (rnp_settings: groupNames, groupOrder; категория артикула), поэтому названия и порядок меняются сразу
       в РНП, «Остатках» и здесь. Группы Ozon пока хранятся в браузере. */
    function openSettings() {
        if (!root.NrUi || !root.NrUi.dialog) return;
        var mode = mpMode(), P = prefs(), items = [], cats = [], seenCat = {}, R = root.RNP, rg = mode !== 'ozon' ? rnpGroups() : [];
        if (rg.length) rg.forEach(function (g) { items.push({ k: 'rg:' + g.name, gk: '', rg: g, label: g.name, def: g.orig || g.name, cur: g.name, cat: 'Категория · ' + (g.orig || g.name) }); });
        else if (mode !== 'ozon') Object.keys(S.gmap).forEach(function (k) { var g = S.gmap[k]; items.push({ k: 'wb:' + g.k, gk: k, label: g.title, def: g.title, cur: g.title, cat: 'Категория · ' + (g.cat || ''), cname: g.cat }); if (g.cat && !seenCat[g.cat]) { seenCat[g.cat] = 1; cats.push(g.cat); } });
        if (mode !== 'wb') ozGroups().forEach(function (g) { items.push({ k: 'oz:' + g.line, label: g.line, def: g.line, cur: nameOf('oz:' + g.line, g.line), cat: 'Ozon' }); });
        var ord = sortBy(items.map(function (x) { return x.k; }), rg.length ? [] : P.order, function (k) { return k; });
        var corder = sortBy(cats.slice(), P.corder, function (c) { return c; });
        var lab = {}; items.forEach(function (x) { lab[x.k] = x.cur; });
        var itemOf = function (k) { return items.filter(function (y) { return y.k === k; })[0]; };
        function nameRows() { return items.map(function (x) { return '<div class="rps-r"><small>' + esc(x.cat) + '</small><input class="rps-in" data-n="' + esc(x.k) + '" value="' + esc(lab[x.k]) + '" placeholder="' + esc(x.def) + '" autocomplete="off"></div>'; }).join(''); }
        function ordRows() {
            var c = corder.map(function (n, i) { return '<div class="rps-o"><i>' + (i + 1) + '</i><b>' + esc(n) + '</b><span><button type="button" data-oc="' + i + '" data-d="-1" aria-label="Выше">▲</button><button type="button" data-oc="' + i + '" data-d="1" aria-label="Ниже">▼</button></span></div>'; }).join('');
            var g = ord.map(function (k, i) { var x = itemOf(k); return '<div class="rps-o"><i>' + (i + 1) + '</i><b>' + esc(lab[k] || (x && x.def) || k) + '</b><span><button type="button" data-og="' + i + '" data-d="-1" aria-label="Выше">▲</button><button type="button" data-og="' + i + '" data-d="1" aria-label="Ниже">▼</button></span></div>'; }).join('');
            return (c ? '<small class="rps-h">Группы</small>' + c : '') + '<small class="rps-h">Блоки на странице (одна склейка или группа = один блок)</small>' + g;
        }
        function moveBlock() {
            if (mode === 'ozon' || !items.length) return '';
            if (rg.length && !rg[0].wb) {
                var arts = [].concat.apply([], rg.map(function (g) { return g.nms.map(function (nm) { var a = artOf(nm); return { nm: nm, name: (a && (a.name || a.card_title)) || String(nm), g: g.name }; }); }));
                return '<div class="rps-s"><b>Перенести товар в другую группу</b><div class="rps-mv"><select id="rps-art" class="rps-in">' + arts.map(function (a) { return '<option value="' + a.nm + '">' + esc(a.name + ' · ' + a.g) + '</option>'; }).join('') + '</select><span>→</span><select id="rps-to" class="rps-in">' + rg.map(function (g, i) { return '<option value="' + i + '">' + esc(g.name) + '</option>'; }).join('') + '</select><button type="button" class="rp-btn" data-s="mvart">Перенести</button></div></div>';
            }
            var src = items.filter(function (x) { return x.gk; });
            return src.length ? '<div class="rps-s"><b>Перенести товар в другую склейку</b><div class="rps-mv"><select id="rps-src" class="rps-in">' + src.map(function (x) { return '<option value="' + x.gk + '">' + esc(x.def) + '</option>'; }).join('') + '</select><button type="button" class="rp-btn" data-s="move">Выбрать, куда</button></div></div>' : '';
        }
        var body = '<div class="rps">' +
            '<div class="rps-s"><b>Себестоимость из Excel</b><p>Вставьте таблицу: артикул и себестоимость за штуку. Цены применятся ко всем артикулам из таблицы сразу.</p><button type="button" class="rp-btn" data-s="cost">Загрузить таблицу</button></div>' +
            '<div class="rps-s"><b>Названия</b><div id="rps-names">' + nameRows() + '</div></div>' + moveBlock() +
            '<div class="rps-s"><b>Порядок блоков</b><div id="rps-ord">' + ordRows() + '</div></div></div>';
        var d = root.NrUi.dialog({ title: 'Настройки товаров', size: 'm', body: body, actions: [{ label: 'Отмена' }, { label: 'Сохранить', primary: true, onClick: function () {
            var np = prefs(), changed = false;
            items.forEach(function (x) {
                var v = String(lab[x.k] == null ? '' : lab[x.k]).trim();
                if (x.rg) {
                    if (v !== x.cur && R && R.renameGroup) { R.renameGroup(x.cur, v === x.def ? '' : v); changed = true; }
                } else { delete np.names[x.k]; if (v && v !== x.def) np.names[x.k] = v; }
            });
            var rgOrder = ord.filter(function (k) { return k.indexOf('rg:') === 0; }).map(function (k) { var x = itemOf(k), v = String(lab[k] || '').trim(); return v || x.cur; });
            if (rgOrder.length && R && R.setGroupOrder) { R.setGroupOrder(rgOrder); changed = true; }
            np.order = ord.filter(function (k) { return k.indexOf('rg:') !== 0; }); np.corder = corder.slice(); savePrefs(np);
            setTimeout(paint, changed ? 350 : 0);
            toast('success', 'Настройки сохранены', changed ? 'Названия и порядок общие с РНП и «Остатками»' : 'Названия и порядок блоков обновлены');
        } }] });
        function repaintOrd() { var e = d.el.querySelector('#rps-ord'); if (e) e.innerHTML = ordRows(); }
        d.el.addEventListener('input', function (e) { var n = e.target && e.target.getAttribute && e.target.getAttribute('data-n'); if (n) lab[n] = e.target.value; });
        d.el.addEventListener('click', function (e) {
            var b = e.target.closest('button'); if (!b) return;
            var sw = function (arr, i, dlt) { var j = i + dlt; if (j < 0 || j >= arr.length) return; var t = arr[i]; arr[i] = arr[j]; arr[j] = t; repaintOrd(); };
            if (b.hasAttribute('data-oc')) { sw(corder, Number(b.getAttribute('data-oc')), Number(b.getAttribute('data-d'))); return; }
            if (b.hasAttribute('data-og')) { sw(ord, Number(b.getAttribute('data-og')), Number(b.getAttribute('data-d'))); return; }
            var a = b.getAttribute('data-s');
            if (a === 'cost') { d.close(); openCostImport(); return; }
            if (a === 'move') { var src = (d.el.querySelector('#rps-src') || {}).value; d.close(); if (src) openModal('move', src); return; }
            if (a === 'mvart') {
                var nm = (d.el.querySelector('#rps-art') || {}).value, to = rg[Number((d.el.querySelector('#rps-to') || {}).value)];
                if (!nm || !to || !R || !R.setCategory) return;
                d.close(); R.setCategory(Number(nm), to.orig || to.name);
                toast('success', 'Товар перенесён', 'Теперь в группе «' + to.name + '», в РНП и «Остатках» тоже'); setTimeout(function () { open(); }, 600);
            }
        });
    }

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
        Promise.resolve(root.NrPriceSend ? root.NrPriceSend(cab, { items: items, old: old }) : root.callWbProxy('prices_set', { items: items, old: old }, cab)).then(function (res) {
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
    var U = { cab: '', arts: [], agg: {}, tax: 0, load: false, token: 0, raf: 0, gi: 0, nm: '', ed: {}, open: false, all: false };
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
    function uCacheKey(cab) { var m = mpMode(); return 'nr_ru_' + cab + (m !== 'wb' ? '_' + m : ''); }
    function uSchedule() { if (U.raf) return; U.raf = root.requestAnimationFrame ? root.requestAnimationFrame(function () { U.raf = 0; paintUnit(); }) : (paintUnit(), 0); }
    function openUnit() {
        var utries = 0; (function wait() { if (rnpGroups().length || ++utries > 12 || mpMode() !== 'wb') { if (rnpGroups().length && S.view === 'unit') uSchedule(); return; } setTimeout(wait, 700); })();
        var cab = cabId(); if (!cab || !sb()) { paintUnit(); return; }
        var my = ++U.token, mode = mpMode();
        if (cab !== U.cab || U.mode !== mode || !U.arts.length) {
            U.cab = cab; U.mode = mode; U.arts = []; U.agg = {}; U.tax = 0;
            try { var c = JSON.parse(root.localStorage.getItem(uCacheKey(cab)) || 'null'); if (c) { U.arts = c.arts || []; U.agg = c.agg || {}; U.tax = c.tax || 0; } } catch (_) {}
        }
        U.load = true; paintUnit();
        var per = period();
        var wbP = mode === 'ozon' ? Promise.resolve([[], []]) : Promise.all([
            pageAll(function () { return sb().from('rnp_articles').select('nm_id,name,photo_url,imt_id,card_title,subject_name,cost_price,logistics_unit,other_costs_unit').eq('cabinet_id', cab).eq('is_active', true); }),
            pageAll(function () { return sb().from('rnp_daily_data').select('nm_id,sales_count,sales_sum,returns_count,to_transfer,delivery_sum,storage_sum,penalty_sum,deduction_sum,commission_pct').eq('cabinet_id', cab).gte('date', per.from).lte('date', per.to); })
        ]);
        // Ozon: артикулы без размера и их расходы из финотчёта Ozon (ozon_unit_rows считает на сервере)
        var ozP = mode === 'wb' ? Promise.resolve([[], []]) : Promise.all([
            Promise.resolve(sb().rpc('ozon_rnp_articles', { p_cabinet: cab })).then(function (r) { return (r && r.data) || []; }, function () { return []; }),
            Promise.resolve(sb().rpc('ozon_unit_rows', { p_cabinet: cab, p_from: per.from, p_to: per.to })).then(function (r) { return (r && r.data) || []; }, function () { return []; })
        ]);
        // Реклама по артикулам: РК пишутся по кампаниям, разбивка по артикулам лежит в data (как читает РНП)
        var adP = mode === 'ozon' ? Promise.resolve({}) : Promise.resolve(pageAll(function () { return sb().from('advertising_daily_stats').select('stat_date,data').eq('cabinet_id', cab).gte('stat_date', per.from).lte('stat_date', per.to); })).then(function (rows) {
            var out = {}, list = function (v) { return Array.isArray(v) ? v : (v && typeof v === 'object' ? [v] : []); };
            (rows || []).forEach(function (r) {
                var d = r.data || {}, nms = [].concat(list(d.nm), list(d.nms), list(d.nmIds));
                (d.apps || []).forEach(function (ap) { if (ap) nms = nms.concat(list(ap.nm), list(ap.nms), list(ap.nmIds)); });
                nms.forEach(function (n) { var id = Number(n && (n.nmId != null ? n.nmId : n.nmID != null ? n.nmID : n.nm_id != null ? n.nm_id : n.id)) || 0; if (id) out[id] = (out[id] || 0) + (num(n.sum) || num(n.spend)); });
            });
            return out;
        }, function () { return {}; });
        var stP = Promise.resolve(sb().from('rnp_settings').select('options').eq('cabinet_id', cab).limit(1)).then(function (r) { return (r && r.data && r.data[0] && r.data[0].options) || {}; }, function () { return {}; });
        Promise.all([wbP, ozP, stP, adP]).then(function (a) {
            if (my !== U.token || mpMode() !== mode) return;
            var agg = {};
            a[0][1].forEach(function (x) {
                var g = agg[x.nm_id] = agg[x.nm_id] || { n: 0, r: 0, ss: 0, tt: 0, dl: 0, st: 0, pn: 0, cm: 0 };
                g.n += num(x.sales_count); g.r += num(x.returns_count); g.ss += num(x.sales_sum); g.tt += num(x.to_transfer); g.dl += num(x.delivery_sum);
                g.st += num(x.storage_sum); g.pn += num(x.penalty_sum) + num(x.deduction_sum); g.cm += num(x.commission_pct) * num(x.sales_sum);
            });
            Object.keys(a[3] || {}).forEach(function (id) { if (agg[id]) agg[id].ad = a[3][id]; });
            var arts = a[0][0].slice();
            a[1][1].forEach(function (x) { agg[x.nm_id] = { n: num(x.n), r: num(x.r), ss: num(x.ss), tt: num(x.tt), dl: num(x.dl), st: num(x.st), pn: num(x.pn), cm: num(x.cm) }; });
            a[1][0].forEach(function (x) { arts.push({ nm_id: x.nm_id, name: x.name, photo_url: x.photo_url, card_title: x.card_title, subject_name: x.subject_name, cost_price: x.cost_price, oz: 1 }); });
            U.arts = arts; U.agg = agg; U.tax = num(a[2] && a[2].taxRate); U.load = false; uSchedule();
            try { root.localStorage.setItem(uCacheKey(cab), JSON.stringify({ arts: U.arts, agg: U.agg, tax: U.tax, at: Date.now() })); } catch (_) {}
        }, function () { if (my === U.token) { U.load = false; uSchedule(); } });
    }
    function ruRow(a, u, ld) {
        var cell = function (t, cls) { return '<td class="n' + (cls ? ' ' + cls : '') + (ld ? ' rp-ld' : '') + '">' + t + '</td>'; };
        if (!u) return '';
        var parts = [[u.commU, '#b9b9b9'], [u.resid, '#8a8a8a'], [u.log, '#5a5a5a'], [u.stoPen, '#3a3a3a'], [u.cost, '#d0d0d0'], [u.tax, '#7a7a7a']].map(function (p) { return '<i style="width:' + Math.max(0, p[0] / u.price * 100).toFixed(1) + '%;background:' + p[1] + '"></i>'; }).join('') +
            '<i style="width:' + Math.max(0, u.profit / u.price * 100).toFixed(1) + '%;background:var(--text-primary)"></i>';
        return '<tr data-nm="' + a.nm_id + '"><td class="ru-nm"><span class="ru-im">' + (pic(a) ? '<img src="' + esc(pic(a)) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()">' : '') + '</span><div><b>' + esc(a.name || a.nm_id) + '</b><small>' + (a.oz ? 'Ozon' : 'WB ' + a.nm_id) + '</small></div></td>' +
            cell(fmt(u.n)) + cell('<b>' + fmt(u.price) + '</b>') + cell(u.comm.toFixed(1).replace('.', ',') + '%') + cell(u.retPct.toFixed(0) + '%') + cell(fmt(u.log)) + cell(u.stoPen ? fmt(u.stoPen) : '—') + cell(fmt(u.cost)) +
            cell('<b class="' + (u.profit <= 0 ? 'dn' : (u.margin >= 15 ? 'up' : '')) + '">' + fmt(u.profit) + '</b>') + cell('<span class="' + (u.margin < 10 ? 'dn' : '') + '">' + u.margin.toFixed(0) + '%</span>') + '<td class="ru-bar"><div class="ru-bw">' + parts + '</div></td></tr>';
    }
    /* ───── Юнит-экономика (макет «Юнит-экономика в стиле РНП», 17 ноября 2026) ─────
       Сверху группы как в РНП, под ними фото артикулов группы; выбрали фото, ниже таблица: «Снимок» (заморожен, как блокнот),
       «Значения» (можно менять, итоги пересчитываются сразу) и «Разница». Расходы на единицу из финотчёта (WB) или начислений (Ozon). */
    var UR = [
        ['sec', 'Цена'], ['ed', 'price', 'Цена продажи, сом'],
        ['sec', 'Расходы на единицу'], ['ed', 'comm', 'Комиссия, %'], ['calc', 'commR', 'Комиссия площадки, сом'], ['ed', 'log', 'Логистика WB, сом'], ['ed', 'resid', 'Прочие удержания WB, сом'], ['ed', 'sto', 'Хранение и штрафы, сом'],
        ['ed', 'own', 'Логистика до склада, сом'], ['ed', 'other', 'Прочие расходы, сом'],
        ['ed', 'ads', 'Реклама, % цены'], ['calc', 'adsR', 'Реклама, сом'], ['ed', 'tax', 'Налог, % цены'], ['ed', 'cost', 'Себестоимость, сом'],
        ['sec', 'Итог'], ['hero', 'profit', 'Остаётся с единицы, сом'], ['calc', 'margin', 'Маржа от цены, %']
    ];
    /* Откуда цифра: короткая подсказка по кнопке «i» рядом с названием строки */
    var UINFO = {
        price: ['Из финотчёта', 'Продажи ÷ проданные штуки.'], comm: ['Из финотчёта', 'Комиссия ÷ продажи, как в РНП.'], commR: ['Считается', 'Цена × комиссия %.'],
        log: ['Из финотчёта', 'Доставка на 1 штуку, с возвратами и невыкупами.'], resid: ['Из финотчёта', 'Цена − «к перечислению» − комиссия: всё остальное, что удержал WB.'],
        sto: ['Из финотчёта', 'Хранение, штрафы и удержания на 1 штуку.'], own: ['Из РНП', 'Поле «Логистика за шт» у артикула.'], other: ['Из РНП', 'Поле «Прочие расходы за шт» у артикула.'],
        ads: ['Из рекламы', 'Расход на рекламу артикула ÷ его продажи.'], adsR: ['Считается', 'Цена × реклама %.'], tax: ['Из настроек РНП', 'Ваша ставка налога.'],
        cost: ['Из «Товары»', 'Себестоимость на 1 выкупленную штуку.'], profit: ['Считается', 'Цена минус все расходы.'], margin: ['Считается', 'Остаётся ÷ цена.']
    };
    function uInfoBtn(k) { return UINFO[k] ? '<button type="button" class="ru-i" data-ui="' + k + '" aria-label="Откуда цифра">i</button>' : ''; }
    function uPop(btn) {
        var old = doc.getElementById('ru-pop'); if (old) old.remove();
        Array.prototype.forEach.call(doc.querySelectorAll('.ru-i.on'), function (x) { x.classList.remove('on'); });
        if (!btn) return; var t = UINFO[btn.getAttribute('data-ui')]; if (!t) return;
        btn.classList.add('on');
        var p = doc.createElement('div'); p.id = 'ru-pop'; p.className = 'ru-pop'; p.innerHTML = '<small>' + t[0] + '</small>' + t[1]; doc.body.appendChild(p);
        var r = btn.getBoundingClientRect(); p.style.left = Math.max(8, Math.min(r.left, root.innerWidth - p.offsetWidth - 12)) + 'px'; p.style.top = (r.bottom + 6) + 'px';
    }
    function uSnapKey() { return 'nr_ru_snap_' + (U.cab || cabId()) + '_' + mpMode(); }
    function uSnaps() { try { return JSON.parse(root.localStorage.getItem(uSnapKey()) || '{}') || {}; } catch (_) { return {}; } }
    function uSaveSnaps(m) { try { root.localStorage.setItem(uSnapKey(), JSON.stringify(m)); } catch (_) {} }
    function uVals(a) {
        var u = unitOf(U.agg[a.nm_id], a.cost_price, U.tax); if (!u) return null;
        var ag = U.agg[a.nm_id] || {}, adPct = num(ag.ss) > 0 ? num(ag.ad) / num(ag.ss) * 100 : 0;
        return { price: Math.round(u.price), comm: Math.round(u.comm * 10) / 10, log: Math.round(u.log), resid: Math.round(u.resid), sto: Math.round(u.stoPen),
            own: Math.round(num(a.logistics_unit)), other: Math.round(num(a.other_costs_unit)), ads: Math.round(adPct * 10) / 10, tax: Number(U.tax) > 0 ? Number(U.tax) : 0, cost: Math.round(u.cost) };
    }
    function uCalc(v) {
        var o = {}; o.commR = v.price * v.comm / 100; o.adsR = v.price * v.ads / 100; var tx = v.price * v.tax / 100;
        o.profit = v.price - o.commR - v.log - v.resid - v.sto - (v.own || 0) - (v.other || 0) - o.adsR - tx - v.cost; o.margin = v.price ? o.profit / v.price * 100 : 0; return o;
    }
    function uGroups() {
        var byNm = {}; U.arts.forEach(function (a) { byNm[a.nm_id] = a; });
        var rg = mpMode() === 'wb' ? rnpGroups() : [], out = [];
        if (rg.length) rg.forEach(function (g) { var items = g.nms.map(function (nm) { return byNm[nm]; }).filter(Boolean); if (items.length) out.push({ name: g.name, items: items }); });
        else {
            var cats = {}; U.arts.forEach(function (a) { var c = catOf(a); (cats[c] = cats[c] || []).push(a); });
            CATS.concat(['Другое']).forEach(function (c) { if (cats[c]) out.push({ name: c, items: cats[c] }); });
        }
        // группы без единой продажи за период не показываем
        return out.filter(function (g) { return g.items.some(function (a) { return !!uVals(a); }); });
    }
    function uNum(n, pct) { return pct ? String(n).replace('.', ',') : fmt(n); }
    /* Карточки справа: чёрная главная метрика и контурная со структурой цены */
    function uSide(c, v, all) {
        var hero = '<div class="ru-hero2"><small>Остаётся с единицы' + (all ? ' · в среднем' : '') + '</small><b class="' + (c.profit < 0 ? 'dn' : '') + '">' + fmt(c.profit) + ' сом</b><span class="ru-pill">маржа ' + c.margin.toFixed(1).replace('.', ',') + '%</span></div>';
        if (all) return hero + all;
        var parts = [['Комиссия', c.commR, 'var(--text-primary)'], ['Логистика WB', v.log, 'var(--text-muted)'], ['Хранение', v.sto, 'var(--mono-3, #a8a8a8)'], ['Прочее', Math.max(0, v.resid + (v.own || 0) + (v.other || 0) + c.adsR + v.price * v.tax / 100 + v.cost), 'var(--mono-2, #6b6b6b)'], ['Остаётся', Math.max(0, c.profit), 'var(--green, #16803c)']];
        var tot = parts.reduce(function (a, p) { return a + Math.max(0, p[1]); }, 0) || 1;
        return hero + '<div class="ru-card2"><small>Из чего складывается цена</small><div class="ru-bar2">' + parts.map(function (p) { return '<i style="flex:' + (Math.max(0, p[1]) / tot) + ';background:' + p[2] + '"></i>'; }).join('') + '</div><div class="ru-leg2">' + parts.map(function (p) { return '<span>' + p[0] + ' ' + fmt(p[1]) + '</span>'; }).join('') + '</div></div>';
    }
    /* «Σ Общее»: колонка на артикул группы и колонка «В среднем» */
    function uAllBody(items) {
        var cols = items.map(function (a) { var v = uVals(a); return v ? { a: a, v: v, c: uCalc(v) } : null; }).filter(Boolean);
        if (!cols.length) return '';
        var pct = function (k) { return k === 'comm' || k === 'ads' || k === 'tax'; };
        var head = '<thead><tr><th>На 1 штуку</th>' + cols.map(function (x) { return '<th title="' + esc(x.a.name || x.a.nm_id) + '">' + esc(String(x.a.name || x.a.nm_id).replace(/^свитер[-_ ]?/i, '')) + '</th>'; }).join('') + '<th>В среднем</th></tr></thead>';
        var body = '<tbody>' + UR.map(function (r) {
            if (r[0] === 'sec') return '<tr class="ru-sec"><td>▾ ' + r[1] + '</td><td colspan="' + (cols.length + 1) + '"></td></tr>';
            var k = r[1], sum = 0;
            var cells = cols.map(function (x) {
                var val = k in x.v ? x.v[k] : x.c[k]; sum += val; var cls = (k === 'profit' || k === 'margin') ? (val < 0 ? ' dn' : ' up') : (k === 'commR' || k === 'adsR') && val > 0 ? ' dn' : '';
                var txt = (k === 'commR' || k === 'adsR') ? (val > 0 ? '−' + fmt(val) : '—') : (k === 'margin' ? val.toFixed(1).replace('.', ',') + '%' : uNum(pct(k) ? Math.round(val * 10) / 10 : Math.round(val), pct(k)));
                return '<td class="' + cls.trim() + '">' + txt + '</td>';
            }).join('');
            var avg = sum / cols.length, acls = (k === 'profit' || k === 'margin') ? (avg < 0 ? ' dn' : ' up') : '';
            var atxt = (k === 'commR' || k === 'adsR') ? (avg > 0 ? '−' + fmt(avg) : '—') : (k === 'margin' ? avg.toFixed(1).replace('.', ',') + '%' : uNum(pct(k) ? Math.round(avg * 10) / 10 : Math.round(avg), pct(k)));
            return '<tr class="' + (r[0] === 'hero' ? 'ru-hero' : 'ru-row') + '"><td>' + r[2] + uInfoBtn(k) + '</td>' + cells + '<td class="ru-c' + acls + '">' + atxt + '</td></tr>';
        }).join('') + '</tbody>';
        var avgV = {}, n = cols.length; Object.keys(cols[0].v).forEach(function (k) { avgV[k] = cols.reduce(function (a, x) { return a + (x.v[k] || 0); }, 0) / n; });
        var ac = uCalc(avgV), mx = Math.max.apply(null, cols.map(function (x) { return x.c.margin; })) || 1;
        var rank = '<div class="ru-card2"><small>Маржа по артикулам</small>' + cols.map(function (x) { return '<div class="ru-rk"><span>' + esc(String(x.a.name || x.a.nm_id).replace(/^свитер[-_ ]?/i, '')) + '</span><u><i style="width:' + Math.max(0, x.c.margin) / mx * 100 + '%"></i></u><b>' + x.c.margin.toFixed(1).replace('.', ',') + '%</b></div>'; }).join('') + '</div>';
        return '<div class="ru-stage2"><div class="ru-wrap"><table class="ru-t2 ru-all">' + head + body + '</table></div><aside class="ru-side">' + uSide(ac, avgV, rank) + '</aside></div>' +
            '<p class="rp-hint">В общем виде цифры только смотрим. Чтобы поменять значение, выберите один артикул. Кнопка «i» у строки объясняет, откуда цифра.</p>';
    }
    function paintUnit() {
        var pane = doc.getElementById('rnp-unit-pane'); if (!pane || S.view !== 'unit') return;
        if (!U.arts.length) { pane.innerHTML = '<div class="rp-tools">' + subTabs('unit') + '</div><div class="rp-stage">' + (U.load ? skeleton() : '<div class="rp-empty"><b>Пока нет данных для юнит-экономики</b><p>Нужны артикулы РНП и продажи за последние ' + UDAYS + ' дней.</p></div>') + '</div>'; return; }
        var groups = uGroups();
        if (!groups.length) { pane.innerHTML = '<div class="rp-tools">' + subTabs('unit') + '</div><div class="rp-stage"><div class="rp-empty"><b>Нет артикулов с продажами</b><p>За последние ' + UDAYS + ' дней продаж не было, расчёт строить не из чего.</p></div></div>'; return; }
        if (!groups[U.gi]) U.gi = 0;
        var g = groups[U.gi], items = g.items;
        if (!items.some(function (a) { return String(a.nm_id) === String(U.nm) && uVals(a); })) { var f = items.filter(function (a) { return uVals(a); })[0]; U.nm = f ? String(f.nm_id) : ''; }
        var sel = items.filter(function (a) { return String(a.nm_id) === String(U.nm); })[0], base = sel ? uVals(sel) : null;
        var snaps = uSnaps(), key = String(U.nm), snap = snaps[key];
        if (base && !snap) { snap = snaps[key] = { at: Date.now(), v: base }; uSaveSnaps(snaps); }
        // Заморожены цена и расходы WB; себестоимость, налог, реклама и расходы артикула из РНП всегда свежие
        var snapV = base ? Object.assign({}, snap.v, { cost: base.cost, tax: base.tax, ads: base.ads, own: base.own, other: base.other }) : null;
        U.ed = U.ed || {}; var cur = base ? Object.assign({}, snapV, U.ed[key] || {}) : null;
        // Как в РНП: сверху одна кнопка с текущей группой, по нажатию раскрывается список групп, рядом сразу фото артикулов выбранной группы
        var menu = U.open ? '<div class="ru-gmenu" role="listbox">' + groups.map(function (x, i) { return '<button type="button" class="ru-gi' + (i === U.gi ? ' on' : '') + '" role="option" data-ug="' + i + '"><b>' + esc(x.name) + '</b><span>' + x.items.length + '</span></button>'; }).join('') + '</div>' : '';
        var allBtn = '<button type="button" class="ru-allb' + (U.all ? ' on' : '') + '" data-uall="1">Σ Общее</button><span class="ru-sepv"></span>';
        var tabs = allBtn + '<div class="ru-gwrap"><button type="button" class="ru-gbtn" data-ugo="1" aria-expanded="' + (U.open ? 'true' : 'false') + '"><i>▾</i>' + esc(g.name) + '<small>' + items.length + '</small></button>' + menu + '</div>';
        var photos = '<div class="ru-ph">' + items.map(function (a) {
            var v = uVals(a), on = !U.all && String(a.nm_id) === String(U.nm);
            return '<button type="button" class="ru-pt' + (on ? ' on' : '') + (v ? '' : ' off') + '" data-un="' + a.nm_id + '" aria-label="' + esc(a.name || a.nm_id) + '"><span class="ru-pi">' + (pic(a) ? '<img src="' + esc(pic(a)) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()">' : '') + '</span><b>' + (v ? fmt(v.price) : '—') + '</b><em>' + esc(String(a.name || a.nm_id).slice(0, 14)) + '</em></button>';
        }).join('') + '</div>';
        var body = '';
        if (cur) {
            var cs = uCalc(cur), cp = uCalc(snapV), h = '';
            UR.forEach(function (r) {
                if (r[0] === 'sec') { h += '<tr class="ru-sec"><td>▾ ' + r[1] + '</td><td colspan="3"></td></tr>'; return; }
                var k = r[1], pct = k === 'comm' || k === 'ads' || k === 'tax', vp, vc, d, dv;
                h += '<tr class="' + (r[0] === 'hero' ? 'ru-hero' : 'ru-row') + '"><td>' + r[2] + uInfoBtn(k) + '</td>';
                if (r[0] === 'ed') {
                    vp = uNum(snapV[k], pct); dv = cur[k] - snapV[k];
                    vc = '<input class="ru-ed' + (dv ? ' chg' : '') + '" data-k="' + k + '" value="' + uNum(cur[k], pct) + '" inputmode="decimal" aria-label="' + esc(r[2]) + '">';
                    d = dv ? '<span class="' + ((k === 'price') ? (dv > 0 ? 'up' : 'dn') : (dv > 0 ? 'dn' : 'up')) + '">' + (dv > 0 ? '+' : '') + uNum(Math.round(dv * 10) / 10, pct) + '</span>' : '—';
                } else if (k === 'commR' || k === 'adsR') { vp = cp[k] > 0 ? '−' + fmt(cp[k]) : '—'; vc = cs[k] > 0 ? '<span class="dn">−' + fmt(cs[k]) + '</span>' : '—'; dv = cs[k] - cp[k]; d = Math.round(dv) ? '<span class="' + (dv > 0 ? 'dn' : 'up') + '">' + (dv < 0 ? '+' : '−') + fmt(Math.abs(dv)) + '</span>' : '—'; }
                else if (k === 'profit') { vp = fmt(cp[k]); vc = '<span class="' + (cs[k] < 0 ? 'dn' : 'up') + '">' + fmt(cs[k]) + '</span>'; dv = cs[k] - cp[k]; d = Math.round(dv) ? '<span class="' + (dv > 0 ? 'up' : 'dn') + '">' + (dv > 0 ? '+' : '−') + fmt(Math.abs(dv)) + '</span>' : '—'; }
                else if (k === 'margin') { vp = cp.margin.toFixed(1).replace('.', ',') + '%'; vc = cs.margin.toFixed(1).replace('.', ',') + '%'; dv = cs.margin - cp.margin; d = Math.abs(dv) < 0.05 ? '—' : '<span class="' + (dv > 0 ? 'up' : 'dn') + '">' + (dv > 0 ? '+' : '−') + Math.abs(dv).toFixed(1).replace('.', ',') + ' п.п.</span>'; }
                h += '<td class="ru-s">' + vp + '</td><td class="ru-c">' + vc + '</td><td>' + d + '</td></tr>';
            });
            var ds = new Date(snap.at), dstr = ds.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) + ', ' + ('0' + ds.getHours()).slice(-2) + ':' + ('0' + ds.getMinutes()).slice(-2);
            body = '<div class="ru-snap"><b>Снимок от ' + esc(dstr) + '</b><span class="ru-tag">заморожено: расходы и продажи за ' + UDAYS + ' дней</span><span class="ru-sp"></span><button type="button" class="rp-btn" data-ua="reset">Сбросить значения</button><button type="button" class="rp-btn" data-ua="snap">Сделать новый снимок</button></div>' +
                '<div class="ru-wrap"><table class="ru-t2"><thead><tr><th>на 1 штуку · ' + esc(sel.name || sel.nm_id) + '</th><th>Снимок</th><th class="c">Значения<small>можно менять</small></th><th>Разница</th></tr></thead><tbody>' + h + '</tbody></table></div>' +
                '<p class="rp-hint">Пунктирные значения правятся на месте. Себестоимость, реклама, налог и расходы из РНП всегда свежие, остальное заморожено на момент снимка. Кнопка «i» у строки объясняет, откуда цифра.</p>';
        }
        if (U.all) body = uAllBody(items);
        else if (cur && body) {
            var csd = uCalc(cur), side = uSide(csd, cur, null);
            body = body.replace('<div class="ru-wrap">', '<div class="ru-stage2"><div class="ru-wrap">').replace('<p class="rp-hint">', '<aside class="ru-side">' + side + '</aside></div><p class="rp-hint">');
        }
        var actKey = doc.activeElement && doc.activeElement.dataset && doc.activeElement.dataset.k ? doc.activeElement.dataset.k : '';
        var sc = pane.scrollTop;
        pane.innerHTML = '<div class="rp-tools">' + subTabs('unit') + '</div><div class="ru-bar">' + tabs + photos + '</div>' + body;
        pane.scrollTop = sc;
        if (actKey) { var n = pane.querySelector('input[data-k="' + actKey + '"]'); if (n) { n.focus(); try { n.setSelectionRange(n.value.length, n.value.length); } catch (_) {} } }
    }
    function unitClick(e) {
        var b;
        if ((b = e.target.closest('.ru-i'))) { var same = b.classList.contains('on'); uPop(same ? null : b); return; }
        if (!e.target.closest('.ru-pop')) uPop(null);
        if ((b = e.target.closest('[data-vw]'))) { setView(b.getAttribute('data-vw')); return; }
        if ((b = e.target.closest('[data-ugo]'))) { U.open = !U.open; paintUnit(); return; }
        if ((b = e.target.closest('[data-ug]'))) { U.gi = Number(b.getAttribute('data-ug')); U.nm = ''; U.open = false; paintUnit(); return; }
        if (U.open && !e.target.closest('.ru-gwrap')) { U.open = false; paintUnit(); }
        if ((b = e.target.closest('[data-un]'))) { U.nm = b.getAttribute('data-un'); U.all = false; paintUnit(); return; }
        if ((b = e.target.closest('[data-uall]'))) { U.all = !U.all; paintUnit(); return; }
        if ((b = e.target.closest('[data-ua]'))) {
            var a = b.getAttribute('data-ua'); U.ed = U.ed || {};
            if (a === 'reset') { delete U.ed[String(U.nm)]; paintUnit(); return; }
            if (a === 'snap') { var art = U.arts.filter(function (x) { return String(x.nm_id) === String(U.nm); })[0], v = art && uVals(art); if (v) { var sn = uSnaps(); sn[String(U.nm)] = { at: Date.now(), v: v }; uSaveSnaps(sn); delete U.ed[String(U.nm)]; paintUnit(); toast('success', 'Снимок обновлён', 'Цифры взяты из свежих данных'); } }
        }
    }
    function unitInput(e) {
        var t = e.target; if (!t.classList || !t.classList.contains('ru-ed')) return;
        var v = parseFloat(String(t.value).replace(/\s/g, '').replace(',', '.')); if (!isFinite(v)) v = 0;
        U.ed = U.ed || {}; var k = String(U.nm); U.ed[k] = Object.assign({}, U.ed[k] || {}); U.ed[k][t.getAttribute('data-k')] = v; paintUnit();
    }

    /* ───── страница внутри вкладки РНП ───── */
    function setView(v) {
        try { if (v === 'prices' || v === 'unit') doc.documentElement.setAttribute('data-nr-rv', v); else doc.documentElement.removeAttribute('data-nr-rv'); } catch (_) {}
        S.view = v; S.opened = (v === 'prices' || v === 'unit') && !!doc.getElementById('tab-rnp') && doc.getElementById('tab-rnp').classList.contains('active'); try { root.localStorage.setItem('nr_rnp_view', v); } catch (_) {}
        var tab = doc.getElementById('tab-rnp'); if (!tab) return;
        tab.classList.toggle('rp-on', v === 'prices'); tab.classList.toggle('ru-on', v === 'unit');
        Array.prototype.forEach.call(doc.querySelectorAll('#rnp-views [data-rv]'), function (b) { b.classList.toggle('is-on', b.getAttribute('data-rv') === v); b.setAttribute('aria-selected', b.getAttribute('data-rv') === v ? 'true' : 'false'); });
        // Заголовок страницы и запомненный подраздел меняем и при программном переходе (строка юнитки → РНП артикула), иначе сверху остаётся «Юнит-экономика»
        try { root.localStorage.setItem('nr_sub_rnp', v); } catch (_) {}
        if (root.NrNav && root.NrNav.refresh) setTimeout(function () { try { root.NrNav.refresh(); } catch (_) {} }, 0);
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
        bar.innerHTML = '<button type="button" class="gg-view-btn is-on" role="tab" aria-selected="true" data-rv="rnp">РНП</button><button type="button" class="gg-view-btn" role="tab" aria-selected="false" data-rv="prices">Товары</button><button type="button" class="gg-view-btn" role="tab" aria-selected="false" data-rv="unit">Юнит-экономика</button>';
        var pane = doc.createElement('div'); pane.id = 'rnp-prices-pane'; pane.className = 'rp-pane';
        var upane = doc.createElement('div'); upane.id = 'rnp-unit-pane'; upane.className = 'rp-pane';
        tab.insertBefore(bar, tab.firstChild); tab.appendChild(pane); tab.appendChild(upane);
        upane.addEventListener('click', unitClick); upane.addEventListener('input', unitInput);
        // после обновления страницы остаёмся на «Ценах», если были на них (открываем, когда вкладка РНП действительно показана)
        try { var sv = root.localStorage.getItem('nr_rnp_view'); if (sv === 'prices') { S.view = 'prices'; tab.classList.add('rp-on'); } else if (sv === 'unit') { S.view = 'unit'; tab.classList.add('ru-on'); } } catch (_) {}
        function kick() { if ((S.view === 'prices' || S.view === 'unit') && tab.classList.contains('active') && !S.opened) { S.opened = true; setView(S.view); } }
        if (root.MutationObserver) new MutationObserver(function () { if (!tab.classList.contains('active')) S.opened = false; kick(); }).observe(tab, { attributes: true, attributeFilter: ['class'] });
        setTimeout(kick, 0);
        bar.addEventListener('click', function (e) { var b = e.target.closest('[data-rv]'); if (b) setView(b.getAttribute('data-rv')); });
        pane.addEventListener('click', function (e) {
            var b;
            if ((b = e.target.closest('[data-vw]'))) { setView(b.getAttribute('data-vw')); return; }
            if ((b = e.target.closest('[data-oact]'))) { ozAct(b); return; }
            if ((b = e.target.closest('[data-ock]'))) { var bk = b.getAttribute('data-ock'); if (OZ.sel[bk]) delete OZ.sel[bk]; else OZ.sel[bk] = true; paint(); return; }
            if ((b = e.target.closest('[data-ck]'))) { var nm = b.getAttribute('data-ck'); if (S.sel[nm]) delete S.sel[nm]; else S.sel[nm] = true; paint(); return; }
            if ((b = e.target.closest('[data-act]'))) {
                var act = b.getAttribute('data-act');
                if (act === 'clear') { S.sel = {}; paint(); return; }
                if (act === 'settings') { openSettings(); return; }
                if (act === 'costimport') { openCostImport(); return; }
                openModal(act, b.getAttribute('data-g')); return;
            }
            if ((b = e.target.closest('[data-nm]'))) goRnp(b.getAttribute('data-nm'));
        });
        pane.addEventListener('change', function (e) { var i = e.target.closest && e.target.closest('.rp-cost-in'); if (i) saveGroupCost(i.getAttribute('data-gc'), i.value); });
        pane.addEventListener('keydown', function (e) { if (e.target.hasAttribute && e.target.hasAttribute('data-ock') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.target.click(); return; } if (e.target.classList && e.target.classList.contains('rp-cost-in')) { if (e.key === 'Enter') e.target.blur(); return; } if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('rp-it')) { e.preventDefault(); goRnp(e.target.getAttribute('data-nm')); } });
        // с кнопки РНП на левой панели всегда открывается сам РНП
        doc.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('.rail-btn[data-tab="rnp"]') && S.view !== 'rnp') setView('rnp'); }, true);
    }
    // Сайт сообщает о смене кабинета событием document «cabinet-changed» (кабинет к этому моменту уже выбран): сбрасываем чужие данные и грузим новые
    function onCabinetChanged() { OZ.cab = ''; OZ.rows = []; OZ.stock = {}; OZ.sel = {}; OZ.token++; S.cab = ''; S.arts = []; S.prices = {}; S.stock = {}; S.fbo = {}; S.fbs = {}; S.pd = {}; S.ratio = {}; S.ord = {}; S.sal = {}; S.sel = {}; S.token++; U.cab = ''; U.arts = []; U.agg = {}; U.token++; closeModal(); if (S.view === 'prices') open(); else if (S.view === 'unit') openUnit(); }
    doc.addEventListener('cabinet-changed', onCabinetChanged);
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') uPop(null); });
    doc.addEventListener('nr-mp-change', function () { if (S.view === 'prices') { if (mpMode() !== 'wb') loadOz(); else paint(); } });
    doc.addEventListener('nr-mp-change', function () { if (S.view === 'unit' && doc.getElementById('tab-rnp') && doc.getElementById('tab-rnp').classList.contains('active')) openUnit(); });
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', mount); else mount();

    root.NrRnpPrices = { open: open, setView: setView, _catOf: catOf, _build: build, _nextPrice: nextPrice, _beforeDiscount: beforeDiscount, _ratioPct: ratioPct, _unitOf: unitOf };
})(typeof window !== 'undefined' ? window : globalThis);

/* Товары: цветное оформление раздела «Остатки» поверх готовой таблицы.
   Добавляет карточки-итоги, фильтр-чипы, фото артикула и метку «Хватит на N дней»
   (остаток ФБО+ФБС ÷ заказы в день за последние 14 дней). Данные таблицы не меняет. */
(function (root) {
    'use strict';
    var doc = root.document;
    if (!doc) return;
    var DAYS = 14;
    var S = { sales: null, cab: '', loading: false, filter: 'all', busy: false, mo: null };

    function num(t) {
        var s = String(t == null ? '' : t).replace(/[\s  ]/g, '').replace(',', '.');
        var v = parseFloat(s);
        return isFinite(v) ? v : 0;
    }
    function fmt(n) { return Math.round(n).toLocaleString('ru-RU').replace(/[  ]/g, ' '); }
    function cls(days) { return days == null ? '' : days < 7 ? 'r' : days < 21 ? 'o' : days > 90 ? 'b' : 'g'; }

    function cab() { try { return root.currentCabinetId || (typeof currentCabinetId !== 'undefined' ? currentCabinetId : '') || ''; } catch (e) { return ''; } }
    function db() { try { return typeof supabase !== 'undefined' ? supabase : null; } catch (e) { return null; } }

    async function loadSales() {
        var c = cab(), d = db();
        if (!c || !d || S.loading || (S.sales && S.cab === c)) return;
        S.loading = true;
        try {
            var from = new Date(Date.now() - DAYS * 86400000).toISOString().slice(0, 10), acc = {}, off = 0;
            for (var page = 0; page < 15; page++) {
                var r = await d.from('rnp_daily_data').select('nm_id, orders_count').eq('cabinet_id', c).gte('date', from).range(off, off + 999);
                var rows = r && r.data || [];
                rows.forEach(function (x) { acc[x.nm_id] = (acc[x.nm_id] || 0) + (Number(x.orders_count) || 0); });
                if (rows.length < 1000) break;
                off += 1000;
            }
            S.sales = {}; Object.keys(acc).forEach(function (k) { S.sales[k] = acc[k] / DAYS; });
            S.cab = c;
        } catch (e) { S.sales = S.sales || {}; }
        S.loading = false;
        schedule();
    }

    function colIndex() {
        var map = {}, ths = doc.querySelectorAll('#gg-table-head th');
        Array.prototype.forEach.call(ths, function (th, i) {
            var t = th.textContent.trim();
            if (t === 'Артикул') map.art = i; else if (t === 'ФБО') map.fbo = i; else if (t === 'ФБС') map.fbs = i;
            else if (t === 'Итого') map.total = i;
        });
        return map;
    }

    function decorate() {
        if (S.busy) return;
        var host = doc.getElementById('gg-view-now'), body = doc.getElementById('gg-table-body');
        if (!host || !body || host.hidden || host.offsetParent === null) return;
        S.busy = true;
        if (S.mo) S.mo.disconnect();
        try {
            var cols = colIndex(), tot = { stock: 0, transit: 0, r: 0, o: 0, g: 0, b: 0, n: 0 };
            var ph = root.RNP && root.RNP.wbPhotoUrl;
            var secIdx = -1, rows = body.querySelectorAll('tr');
            Array.prototype.forEach.call(rows, function (tr) {
                if (tr.classList.contains('gg-sec-row')) {
                    secIdx++;
                    tr.className = 'gg-sec-row ggx-g' + (secIdx % 5);
                    return;
                }
                var key = tr.getAttribute('data-key') || '';
                if (key.indexOf('nm:') !== 0) return;
                var nm = key.slice(3), tds = tr.children;
                tr.setAttribute('data-ggx', '1');
                tr.classList.remove('ggx-r', 'ggx-o', 'ggx-g', 'ggx-b');
                tr.classList.add('ggx-s' + (secIdx % 5));
                var fbo = cols.fbo != null ? num(tds[cols.fbo] && tds[cols.fbo].textContent) : 0;
                var fbs = cols.fbs != null ? num(tds[cols.fbs] && tds[cols.fbs].textContent) : 0;
                var stock = fbo + fbs, perDay = S.sales ? (S.sales[nm] || 0) : null;
                var days = perDay ? stock / perDay : (perDay === 0 && stock > 0 ? 999 : null);
                var c = days == null ? '' : (stock === 0 ? 'r' : cls(days));
                tot.stock += stock; tot.n++; if (c) tot[c]++;
                tr.setAttribute('data-ggx-c', c || '');
                if (c) tr.classList.add('ggx-' + c);
                var art = cols.art != null ? tds[cols.art] : null;
                if (art && !art.querySelector('.ggx-ph') && ph) {
                    var u = ph(nm, 'c246x328');
                    if (u) { var im = doc.createElement('img'); im.className = 'ggx-ph'; im.loading = 'lazy'; im.alt = ''; im.src = u; im.onerror = function () { im.style.display = 'none'; }; art.insertBefore(im, art.firstChild); }
                }
                var tcell = cols.total != null ? tds[cols.total] : null;
                if (tcell) {
                    var old = tcell.querySelector('.ggx-cv'); if (old) old.remove();
                    if (c) {
                        var sp = doc.createElement('span');
                        sp.className = 'ggx-cv ' + c;
                        sp.textContent = stock === 0 ? 'Нет' : days > 365 ? '>1 года' : Math.round(days) + ' дн.';
                        sp.title = 'Хватит на ' + (stock === 0 ? '0' : Math.round(days)) + ' дн. при продажах ' + (perDay ? perDay.toFixed(1).replace('.', ',') : '0') + ' заказов в день';
                        tcell.appendChild(sp);
                        if (art) { var o2 = art.querySelector('.ggx-cv2'); if (o2) o2.remove(); var s2 = sp.cloneNode(true); s2.className = 'ggx-cv ggx-cv2 ' + c; art.appendChild(s2); }
                    }
                }
                var f = S.filter;
                tr.style.display = (f === 'all' || f === c) ? '' : 'none';
            });
            // заголовки групп без видимых строк прячем
            var cur = null, vis = 0;
            var flush = function () { if (cur) cur.style.display = vis || S.filter === 'all' ? '' : 'none'; };
            Array.prototype.forEach.call(rows, function (tr) {
                if (tr.classList.contains('gg-sec-row')) { flush(); cur = tr; vis = 0; }
                else if (tr.style.display !== 'none') vis++;
            });
            flush();
            panel(host, tot);
        } catch (e) { /* оформление не должно ломать таблицу */ }
        S.busy = false;
        observe();
    }

    function panel(host, t) {
        var top = doc.getElementById('ggx-top');
        if (!top) { top = doc.createElement('div'); top.id = 'ggx-top'; host.parentNode.insertBefore(top, host); top.addEventListener('click', onClick); }
        var sel = function (k) { return S.filter === k ? ' on' : ''; };
        var ready = S.sales != null;
        top.innerHTML =
            '<div class="ggx-kp"><div class="ggx-k k1"><small>Всего на складах</small><b>' + fmt(t.stock) + ' шт</b></div>' +
            '<div class="ggx-k k2"><small>Артикулов</small><b>' + t.n + '</b></div>' +
            '<div class="ggx-k k3"><small>Заканчиваются (до 21 дн.)</small><b>' + (ready ? t.r + t.o : '…') + ' арт.</b></div>' +
            '<div class="ggx-k k4"><small>Срочно пополнить (до 7 дн.)</small><b>' + (ready ? t.r : '…') + ' арт.</b></div></div>' +
            '<div class="ggx-chips"><button type="button" class="ggx-chip' + sel('all') + '" data-f="all">Все<b>' + t.n + '</b></button>' +
            '<button type="button" class="ggx-chip r' + sel('r') + '" data-f="r">Мало<b>' + t.r + '</b></button>' +
            '<button type="button" class="ggx-chip o' + sel('o') + '" data-f="o">Заканчиваются<b>' + t.o + '</b></button>' +
            '<button type="button" class="ggx-chip g' + sel('g') + '" data-f="g">В норме<b>' + t.g + '</b></button>' +
            '<button type="button" class="ggx-chip b' + sel('b') + '" data-f="b">Много<b>' + t.b + '</b></button>' +
            '<span class="ggx-note">«Хватит на» — остаток ÷ заказы в день за 14 дней</span></div>';
    }

    function onClick(e) {
        var b = e.target.closest('[data-f]'); if (!b) return;
        S.filter = b.getAttribute('data-f'); decorate();
    }

    var timer = 0;
    function schedule() { clearTimeout(timer); timer = setTimeout(function () { loadSales(); decorate(); }, 120); }
    function observe() {
        var body = doc.getElementById('gg-table-body');
        if (!body) return;
        if (!S.mo) S.mo = new MutationObserver(schedule);
        S.mo.observe(body, { childList: true, subtree: true });
        var head = doc.getElementById('gg-table-head'); if (head) S.mo.observe(head, { childList: true, subtree: true });
    }
    function boot() {
        if (!doc.getElementById('gg-table-body')) { setTimeout(boot, 800); return; }
        observe(); schedule();
        doc.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('#tab-goods-groups')) setTimeout(schedule, 200); }, true);
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
    root.NrGoodsUi = { refresh: schedule };
})(typeof window !== 'undefined' ? window : globalThis);

/**
 * Товары → «Логистика» (товары, которые едут в WB) и «Заказ на производство» (план пошива).
 * Таблицы goods_shipments и production_orders; суммы по размерам видны в РНП (строки «В пути» и «В пошиве»).
 * Вкладки добавляются в блок «Разделы Товаров» без правок основного скрипта страницы.
 */
(function (root) {
    'use strict';
    var KINDS = {
        ship: {
            view: 'ship', btn: 'gg-view-ship-btn', pane: 'gg-view-ship', table: 'goods_shipments', title: 'Логистика',
            hint: 'Товары, которые едут в WB. Суммы по размерам показываются в РНП в строке «В пути».',
            dateA: 'sent_date', dateAName: 'Отправлено', dateB: 'eta_date', dateBName: 'Прибытие',
            statuses: [['transit', 'В пути'], ['arrived', 'Принято на WB']], openStatus: 'transit',
        },
        prod: {
            view: 'prod', btn: 'gg-view-prod-btn', pane: 'gg-view-prod', table: 'production_orders', title: 'Заказ на производство',
            hint: 'План пошива. Суммы по размерам показываются в РНП в строке «В пошиве».',
            dateA: 'order_date', dateAName: 'Заказано', dateB: 'due_date', dateBName: 'Срок',
            statuses: [['plan', 'В плане'], ['sewing', 'В пошиве'], ['done', 'Готово']], openStatus: ['plan', 'sewing'],
        },
    };
    var st = { arts: [], draftBatches: [], rows: { ship: [], prod: [] }, cab: null, showDone: { ship: false, prod: false }, loadedCab: null };

    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function sb() { return typeof supabase !== 'undefined' ? supabase : root.supabase; }
    function cabId() { return root.currentCabinetId || (typeof window !== 'undefined' && window.currentCabinetId) || null; }
    function isOpen(k, r) { var o = KINDS[k].openStatus; return Array.isArray(o) ? o.indexOf(r.status) >= 0 : r.status === o; }
    function artLabel(a) { return String((a.manual_data && (a.manual_data.seller_article || a.manual_data.sa_name)) || a.name || a.nm_id).trim(); }
    function artByNm(nm) { for (var i = 0; i < st.arts.length; i++) if (Number(st.arts[i].nm_id) === Number(nm)) return st.arts[i]; return null; }

    async function load() {
        var cab = cabId();
        st.cab = cab;
        if (!cab || !sb()) return;
        var a = await sb().from('rnp_articles').select('nm_id,name,manual_data,is_active').eq('cabinet_id', cab).order('nm_id').range(0, 1999);
        st.arts = (a.data || []).filter(function (x) { return x.is_active !== false; });
        var s = await sb().from('goods_shipments').select('*').eq('cabinet_id', cab).order('created_at', { ascending: true }).range(0, 1999);
        var p = await sb().from('production_orders').select('*').eq('cabinet_id', cab).order('created_at', { ascending: false }).range(0, 1999);
        st.rows.ship = s.data || [];
        st.rows.prod = p.data || [];
        st.loadedCab = cab;
    }

    function pane(k) { return document.getElementById(KINDS[k].pane); }

    function render(k) {
        if (k === 'ship') return renderShip();
        var K = KINDS[k], host = pane(k);
        if (!host) return;
        var rows = st.rows[k].filter(function (r) { return st.showDone[k] || isOpen(k, r); });
        var openRows = st.rows[k].filter(function (r) { return isOpen(k, r); });
        var total = openRows.reduce(function (s, r) { return s + (Number(r.qty) || 0); }, 0);
        var dl = '<datalist id="gs-arts-' + k + '">' + st.arts.map(function (a) { return '<option value="' + esc(artLabel(a)) + '">' + a.nm_id + '</option>'; }).join('') + '</datalist>';
        var opts = function (sel) { return K.statuses.map(function (s) { return '<option value="' + s[0] + '"' + (s[0] === sel ? ' selected' : '') + '>' + s[1] + '</option>'; }).join(''); };
        var body = rows.map(function (r) {
            var a = artByNm(r.nm_id);
            return '<tr data-id="' + esc(r.id || '') + '" data-tmp="' + esc(r._tmp || '') + '">' +
                '<td class="gs-art"><input class="gs-in" data-f="art" list="gs-arts-' + k + '" value="' + esc(a ? artLabel(a) : (r.nm_id || '')) + '" placeholder="Артикул"></td>' +
                '<td class="gs-nm">' + esc(r.nm_id || '') + '</td>' +
                '<td><input class="gs-in gs-sz" data-f="size" value="' + esc(r.size) + '" placeholder="Размер"></td>' +
                '<td><input class="gs-in gs-qty" data-f="qty" type="number" min="0" value="' + (r.qty || '') + '" placeholder="0"></td>' +
                '<td><input class="gs-in" data-f="' + K.dateA + '" type="date" value="' + esc(r[K.dateA] || '') + '"></td>' +
                '<td><input class="gs-in" data-f="' + K.dateB + '" type="date" value="' + esc(r[K.dateB] || '') + '"></td>' +
                '<td><select class="gs-in" data-f="status">' + opts(r.status) + '</select></td>' +
                '<td><input class="gs-in gs-note" data-f="note" value="' + esc(r.note) + '" placeholder="Комментарий"></td>' +
                '<td class="gs-edit"><button type="button" class="gs-del" data-act="del" title="Удалить строку">×</button></td></tr>';
        }).join('');
        host.innerHTML = dl +
            '<div class="gs-head"><div><div class="gs-title">' + K.title + '</div><div class="gs-hint">' + K.hint + '</div></div>' +
            '<div class="gs-tools"><label class="gs-chk"><input type="checkbox" data-act="done"' + (st.showDone[k] ? ' checked' : '') + '> показывать завершённые</label>' +
            '<button type="button" class="gs-add gs-edit" data-act="add">+ Добавить</button></div></div>' +
            '<div class="gg-table-scroll"><table class="gg-table gs-table"><thead><tr>' +
            '<th class="gg-art">Артикул</th><th class="gs-nm">WB</th><th>Размер</th><th class="gg-num">Кол-во</th><th>' + K.dateAName + '</th><th>' + K.dateBName + '</th><th>Статус</th><th>Комментарий</th><th class="gs-edit"></th></tr></thead><tbody>' +
            (body || '<tr><td colspan="9" class="gs-empty">Пока пусто. Нажмите «+ Добавить».</td></tr>') +
            '</tbody><tfoot><tr class="gg-foot"><td class="gg-art">Итого в работе</td><td></td><td></td><td class="gg-num">' + total.toLocaleString('ru') + '</td><td colspan="5"></td></tr></tfoot></table></div>';
        bind(k, host);
    }


    // ─── «Логистика» как таблица «В пути»: партии блоками, размеры колонками ───────────────────
    var SHIP_SIZES = ['XXXS/36', 'XXS/38', 'XS/40', 'S/42', 'M/44', 'L/46', 'XL/48', '2XL/50', '3XL/52', '4XL/54', '5XL/56', '5XL/58'];
    var SHIP_LISTS = {
        method: ['AiLIN', 'ZEVINA', 'ОсОО', 'ИП', 'Бишкек', 'В серую', 'В белую', 'OZON', 'FBS', 'FBO', 'WBO', 'BAZ.A'],
        status: ['В цеху', 'в пути', 'на карго', 'Принято ФФ', 'В китае', 'Скоро отправка', 'В продажах WB', 'ЕДЕТ В МСК', 'Маркировка', 'В продажах ОZON'],
        delivery: ['АВТО', 'АВИА', 'АВТО+ФФ'],
        origin: ['Бишкек', 'Китай', 'Москва'],
        cargo: ['KGMART', 'АЛЬФА', 'AK LOGISTIK', 'РЕД'],
    };
    // Статусы, при которых товар «едет в WB» и попадает в РНП в строку «В пути».
    var SHIP_OPEN = ['в пути', 'на карго', 'Принято ФФ', 'ЕДЕТ В МСК', 'Маркировка'];
    function statusCls(v) {
        v = String(v || '').trim();
        if (/продажах/i.test(v)) return 'ok';
        if (v === 'Принято ФФ') return 'ff';
        if (v === 'в пути' || v === 'на карго' || v === 'ЕДЕТ В МСК') return 'tr';
        if (v === 'В цеху' || v === 'В китае' || v === 'Скоро отправка' || v === 'Маркировка') return 'ws';
        return '';
    }
    function sel(list, val, f, cls) {
        var l = list.slice(); if (val && l.indexOf(val) < 0) l.unshift(val);
        return '<select class="gs-in gs-sel ' + (cls || '') + '" data-f="' + f + '"><option value=""></option>' + l.map(function (x) { return '<option' + (x === val ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select>';
    }
    function dlist(id, list) { return '<datalist id="' + id + '">' + list.map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist>'; }
    function shipTotal(r) { var t = 0, s = r.sizes || {}; Object.keys(s).forEach(function (k) { t += Number(s[k]) || 0; }); return t; }

    function groupsOf() {
        var order = [], map = {};
        st.rows.ship.forEach(function (r) {
            var b = r.batch || '';
            if (!map[b]) { map[b] = []; order.push(b); }
            map[b].push(r);
        });
        st.draftBatches.forEach(function (b) { if (!map[b]) { map[b] = []; order.push(b); } });
        return { order: order, map: map };
    }

    function renderShip() {
        var host = pane('ship');
        if (!host) return;
        var g = groupsOf();
        var showAll = st.showDone.ship;
        var colspan = 9 + SHIP_SIZES.length + 2;
        var dls = '<datalist id="gs-arts-ship">' + st.arts.map(function (a) { return '<option value="' + esc(artLabel(a)) + '">' + a.nm_id + '</option>'; }).join('') + '</datalist>' +
            dlist('gs-origin', SHIP_LISTS.origin) + dlist('gs-cargo', SHIP_LISTS.cargo);
        var sizeTh = SHIP_SIZES.map(function (z) { return '<th class="gs-szh">' + esc(z.replace('/', ' / ')) + '</th>'; }).join('');
        var body = '', grand = 0;
        g.order.forEach(function (b) {
            var rows = g.map[b].filter(function (r) { return showAll || SHIP_OPEN.indexOf(r.status) >= 0 || !r.status || r.status === 'transit'; });
            var tot = rows.reduce(function (s, r) { return s + shipTotal(r); }, 0);
            grand += tot;
            body += '<tr class="gs-grp" data-batch="' + esc(b) + '"><td colspan="' + colspan + '"><input class="gs-batch gs-in" value="' + esc(b) + '" placeholder="Название партии (например «№7 ИП Уркунбаев 100%»)">' +
                '<span class="gs-gtot">' + (tot ? 'всего ' + tot.toLocaleString('ru') + ' шт' : '') + '</span>' +
                '<button type="button" class="gs-addrow gs-edit" data-act="addrow">+ строка</button></td></tr>';
            rows.forEach(function (r) {
                var a = artByNm(r.nm_id), sizes = r.sizes || {};
                var cells = SHIP_SIZES.map(function (z) {
                    var v = sizes[z];
                    return '<td class="gs-szc"><input class="gs-in gs-sz" data-f="sz" data-z="' + esc(z) + '" type="number" min="0" value="' + (v ? v : '') + '"></td>';
                }).join('');
                body += '<tr class="gs-row" data-id="' + esc(r.id || '') + '" data-tmp="' + esc(r._tmp || '') + '">' +
                    '<td>' + sel(SHIP_LISTS.method, r.method, 'method', 'gs-m') + '</td>' +
                    '<td><input class="gs-in gs-prod" data-f="product" value="' + esc(r.product) + '" placeholder="Товар"></td>' +
                    '<td class="gs-art"><input class="gs-in" data-f="art" list="gs-arts-ship" value="' + esc(a ? artLabel(a) : '') + '" placeholder="Артикул"></td>' +
                    '<td><input class="gs-in gs-date" data-f="sent_date" type="date" value="' + esc(r.sent_date || '') + '"></td>' +
                    '<td>' + sel(SHIP_LISTS.status, r.status, 'status', 'gs-st gs-s-' + statusCls(r.status)) + '</td>' +
                    '<td><input class="gs-in gs-or" data-f="origin" list="gs-origin" value="' + esc(r.origin) + '"></td>' +
                    '<td><input class="gs-in gs-cg" data-f="cargo" list="gs-cargo" value="' + esc(r.cargo) + '"></td>' +
                    '<td><input class="gs-in gs-pr" data-f="price" type="number" step="any" value="' + (r.price == null ? '' : r.price) + '"></td>' +
                    '<td>' + sel(SHIP_LISTS.delivery, r.delivery, 'delivery', 'gs-dl') + '</td>' +
                    cells + '<td class="gs-tot">' + (shipTotal(r) || '') + '</td>' +
                    '<td class="gs-edit"><button type="button" class="gs-del" data-act="del" title="Удалить строку">×</button></td></tr>';
            });
        });
        host.innerHTML = dls +
            '<div class="gs-head"><div><div class="gs-title">Логистика</div><div class="gs-hint">Как таблица «В пути»: партии блоками, размеры колонками. В РНП суммы по размерам идут в строку «В пути» (статусы: в пути, на карго, Принято ФФ, ЕДЕТ В МСК, Маркировка).</div></div>' +
            '<div class="gs-tools"><span class="gs-gt">В пути всего: <b>' + grand.toLocaleString('ru') + ' шт</b></span><label class="gs-chk"><input type="checkbox" data-act="done"' + (showAll ? ' checked' : '') + '> показывать «в продажах» и «в цеху»</label>' +
            '<button type="button" class="gs-add gs-edit" data-act="addbatch">+ Партия</button></div></div>' +
            '<div class="gs-sheet"><table class="gs-table gs-ship"><thead><tr><th>Метод</th><th>Товар</th><th>Артикул</th><th>Дата отправки</th><th>Статус</th><th>Откуда</th><th>Карго</th><th>Цена</th><th>Доставка</th>' + sizeTh + '<th>Общее</th><th class="gs-edit"></th></tr></thead><tbody>' +
            (body || '<tr><td colspan="' + colspan + '" class="gs-empty">Пока пусто. Нажмите «+ Партия».</td></tr>') + '</tbody></table></div>';
        bindShip(host);
    }

    function shipRow(tr) {
        var id = tr.getAttribute('data-id'), tmp = tr.getAttribute('data-tmp');
        var list = st.rows.ship;
        for (var i = 0; i < list.length; i++) if ((id && list[i].id === id) || (!id && tmp && list[i]._tmp === tmp)) return list[i];
        return null;
    }

    function bindShip(host) {
        if (host._gsShipBound) return;
        host._gsShipBound = true;
        host.addEventListener('click', function (e) {
            var b = e.target.closest('[data-act]');
            if (!b) return;
            var act = b.getAttribute('data-act');
            if (act === 'addbatch') {
                var n = 'Новая партия ' + (groupsOf().order.length + 1);
                st.draftBatches.push(n); addShipRow(n);
            } else if (act === 'addrow') {
                addShipRow(b.closest('tr').getAttribute('data-batch') || '');
            } else if (act === 'del') {
                delShip(b.closest('tr'));
            }
        });
        host.addEventListener('change', function (e) {
            var el = e.target;
            if (el.getAttribute('data-act') === 'done') { st.showDone.ship = el.checked; renderShip(); return; }
            var tr = el.closest('tr');
            if (el.classList.contains('gs-batch')) { renameBatch(tr.getAttribute('data-batch') || '', String(el.value || '').trim()); return; }
            var f = el.getAttribute('data-f');
            if (!f || !tr) return;
            var r = shipRow(tr);
            if (!r) return;
            if (f === 'art') {
                var v = String(el.value || '').trim().toLowerCase();
                var a = st.arts.filter(function (x) { return artLabel(x).toLowerCase() === v || String(x.nm_id) === v; })[0];
                r.nm_id = a ? a.nm_id : null;
                el.style.outline = a || !v ? '' : '2px solid #ef4444';
            } else if (f === 'sz') {
                r.sizes = r.sizes || {};
                var q = Math.max(0, parseInt(el.value, 10) || 0);
                if (q) r.sizes[el.getAttribute('data-z')] = q; else delete r.sizes[el.getAttribute('data-z')];
                var t = tr.querySelector('.gs-tot'); if (t) t.textContent = shipTotal(r) || '';
            } else if (f === 'price') {
                r.price = el.value === '' ? null : Number(el.value);
            } else if (f === 'status') {
                r.status = el.value;
                el.className = el.className.replace(/gs-s-\S*/g, '') + ' gs-s-' + statusCls(el.value);
            } else {
                r[f] = el.value === '' ? (f === 'sent_date' ? null : '') : el.value;
            }
            saveShip(r, tr);
        });
    }

    function addShipRow(batch) {
        var r = { _tmp: 't' + Date.now(), cabinet_id: st.cab, nm_id: null, batch: batch, method: '', product: '', origin: 'Бишкек', cargo: '', delivery: 'АВТО', price: null, sizes: {}, status: 'в пути', note: '', sent_date: new Date().toISOString().slice(0, 10) };
        var idx = -1;
        st.rows.ship.forEach(function (x, i) { if ((x.batch || '') === batch) idx = i; });
        if (idx >= 0) st.rows.ship.splice(idx + 1, 0, r); else st.rows.ship.push(r);
        renderShip();
        var tr = pane('ship').querySelector('tr[data-tmp="' + r._tmp + '"]');
        var first = tr && tr.querySelector('[data-f="art"]'); if (first) first.focus();
    }

    async function saveShip(r, tr) {
        if (!r.nm_id || !(shipTotal(r) > 0)) { tr.classList.add('gs-incomplete'); return; }
        tr.classList.remove('gs-incomplete');
        var payload = { cabinet_id: st.cab, nm_id: r.nm_id, size: '', qty: shipTotal(r), sizes: r.sizes || {}, status: r.status || '', note: r.note || '', batch: r.batch || '', method: r.method || '', product: r.product || '', origin: r.origin || '', cargo: r.cargo || '', delivery: r.delivery || '', price: r.price == null ? null : r.price, sent_date: r.sent_date || null, updated_at: new Date().toISOString() };
        try {
            var res;
            if (r.id) res = await sb().from('goods_shipments').update(payload).eq('id', r.id);
            else {
                res = await sb().from('goods_shipments').insert(payload).select('id').single();
                if (!res.error && res.data) { r.id = res.data.id; tr.setAttribute('data-id', r.id); }
            }
            if (res.error) throw res.error;
            tr.style.outline = '';
            changed();
        } catch (e) { tr.style.outline = '2px solid #ef4444'; tr.title = String((e && e.message) || e); }
    }

    async function renameBatch(oldName, name) {
        st.draftBatches = st.draftBatches.map(function (b) { return b === oldName ? name : b; });
        var ids = [];
        st.rows.ship.forEach(function (r) { if ((r.batch || '') === oldName) { r.batch = name; if (r.id) ids.push(r.id); } });
        if (ids.length) { try { await sb().from('goods_shipments').update({ batch: name }).in('id', ids); } catch (e) {} }
        renderShip();
    }

    async function delShip(tr) {
        var r = shipRow(tr);
        if (!r) return;
        if (r.id) {
            if (!root.confirm('Удалить строку?')) return;
            var res = await sb().from('goods_shipments').delete().eq('id', r.id);
            if (res.error) { tr.style.outline = '2px solid #ef4444'; tr.title = res.error.message; return; }
        }
        st.rows.ship = st.rows.ship.filter(function (x) { return x !== r; });
        renderShip();
        changed();
    }

    function rowFor(k, tr) {
        var id = tr.getAttribute('data-id'), tmp = tr.getAttribute('data-tmp');
        var list = st.rows[k];
        for (var i = 0; i < list.length; i++) if ((id && list[i].id === id) || (!id && tmp && list[i]._tmp === tmp)) return list[i];
        return null;
    }

    function bind(k, host) {
        if (host._gsBound) return;
        host._gsBound = true;
        host.addEventListener('click', function (e) {
            var b = e.target.closest('[data-act]');
            if (!b) return;
            var act = b.getAttribute('data-act');
            if (act === 'add') { addRow(k); }
            else if (act === 'del') { delRow(k, b.closest('tr')); }
        });
        host.addEventListener('change', function (e) {
            var el = e.target;
            if (el.getAttribute('data-act') === 'done') { st.showDone[k] = el.checked; render(k); return; }
            var f = el.getAttribute('data-f');
            if (!f) return;
            var tr = el.closest('tr'), r = rowFor(k, tr);
            if (!r) return;
            if (f === 'art') {
                var v = String(el.value || '').trim().toLowerCase();
                var a = st.arts.filter(function (x) { return artLabel(x).toLowerCase() === v || String(x.nm_id) === v; })[0];
                r.nm_id = a ? a.nm_id : null;
                tr.querySelector('.gs-nm').textContent = a ? a.nm_id : '';
                el.style.outline = a ? '' : '2px solid #ef4444';
            } else if (f === 'qty') {
                r.qty = Math.max(0, parseInt(el.value, 10) || 0);
            } else if (f === 'size') {
                r.size = String(el.value || '').trim();
            } else {
                r[f] = el.value === '' ? (f === 'status' ? r.status : (f === 'note' ? '' : null)) : el.value;
            }
            save(k, r, tr);
        });
    }

    function addRow(k) {
        var K = KINDS[k];
        var r = { _tmp: 't' + Date.now(), cabinet_id: st.cab, nm_id: null, size: '', qty: 0, status: K.statuses[0][0], note: '' };
        r[K.dateA] = new Date().toISOString().slice(0, 10);
        r[K.dateB] = null;
        st.rows[k].unshift(r);
        render(k);
        var first = pane(k).querySelector('tbody tr .gs-in');
        if (first) first.focus();
    }

    async function save(k, r, tr) {
        var K = KINDS[k];
        if (!r.nm_id || !(r.qty > 0)) { tr.classList.add('gs-incomplete'); return; }
        tr.classList.remove('gs-incomplete');
        var payload = { cabinet_id: st.cab, nm_id: r.nm_id, size: r.size || '', qty: r.qty, status: r.status, note: r.note || '', updated_at: new Date().toISOString() };
        payload[K.dateA] = r[K.dateA] || null;
        payload[K.dateB] = r[K.dateB] || null;
        try {
            var res;
            if (r.id) res = await sb().from(K.table).update(payload).eq('id', r.id);
            else {
                res = await sb().from(K.table).insert(payload).select('id').single();
                if (!res.error && res.data) { r.id = res.data.id; tr.setAttribute('data-id', r.id); }
            }
            if (res.error) throw res.error;
            tr.style.outline = '';
            changed();
        } catch (e) {
            tr.style.outline = '2px solid #ef4444';
            tr.title = String((e && e.message) || e);
        }
    }

    async function delRow(k, tr) {
        var r = rowFor(k, tr);
        if (!r) return;
        if (r.id) {
            if (!root.confirm('Удалить строку?')) return;
            var res = await sb().from(KINDS[k].table).delete().eq('id', r.id);
            if (res.error) { tr.style.outline = '2px solid #ef4444'; tr.title = res.error.message; return; }
        }
        st.rows[k] = st.rows[k].filter(function (x) { return x !== r; });
        render(k);
        changed();
    }

    // РНП перечитывает суммы и перерисовывает блок остатков.
    function changed() { try { root.dispatchEvent(new CustomEvent('nr-supply-changed')); } catch (e) {} }

    var cur = null;
    async function show(k) {
        cur = k;
        var host = pane(k);
        if (!host) return;
        host.hidden = false;
        if (st.loadedCab !== cabId()) { host.innerHTML = '<div style="padding:24px;color:var(--text-secondary)">Загрузка…</div>'; try { await load(); } catch (e) { host.innerHTML = '<div style="padding:24px;color:#ef4444">Не удалось загрузить: ' + esc(e && e.message) + '</div>'; return; } }
        render(k);
    }

    function hideAll() { Object.keys(KINDS).forEach(function (k) { var p = pane(k); if (p) p.hidden = true; var b = document.getElementById(KINDS[k].btn); if (b) { b.classList.remove('is-on'); b.setAttribute('aria-selected', 'false'); } }); cur = null; }

    function install() {
        var views = document.querySelector('#tab-goods-groups .gg-views');
        var fbsPane = document.getElementById('gg-view-fbs');
        if (!views || !fbsPane || typeof root.setGoodsView !== 'function' || views.getAttribute('data-gs')) return false;
        views.setAttribute('data-gs', '1');
        var after = document.getElementById('gg-view-fbs-btn') || views.lastElementChild;
        Object.keys(KINDS).reverse().forEach(function (k) {
            var K = KINDS[k];
            var b = document.createElement('button');
            b.type = 'button'; b.className = 'gg-view-btn'; b.id = K.btn; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', 'false');
            b.textContent = K.title;
            b.onclick = function () { root.setGoodsView(K.view); };
            after.after(b);
            var p = document.createElement('div');
            p.id = K.pane; p.hidden = true; p.className = 'gs-pane';
            fbsPane.after(p);
        });
        var orig = root.setGoodsView;
        root.setGoodsView = function (view, opts) {
            if (view === 'ship' || view === 'prod') {
                orig('now', { skipLoad: true });
                ['gg-view-now', 'gg-view-daily', 'gg-view-cost', 'gg-view-give', 'gg-view-fbs'].forEach(function (id) { var e = document.getElementById(id); if (e) e.hidden = true; });
                ['now', 'daily', 'cost', 'fbs', 'give'].forEach(function (n) { var e = document.getElementById('gg-view-' + n + '-btn'); if (e) { e.classList.remove('is-on'); e.setAttribute('aria-selected', 'false'); } });
                var tools = document.getElementById('gg-now-tools'); if (tools) tools.style.visibility = 'hidden';
                hideAll();
                var b = document.getElementById(KINDS[view].btn); if (b) { b.classList.add('is-on'); b.setAttribute('aria-selected', 'true'); }
                show(view);
                return;
            }
            hideAll();
            return orig.apply(this, arguments);
        };
        return true;
    }

    var tries = 0;
    var timer = setInterval(function () { if (install() || ++tries > 240) clearInterval(timer); }, 500);

    // Смена кабинета: перечитываем при следующем открытии.
    root.addEventListener('nr-cabinet-changed', function () { st.loadedCab = null; });
    root.NrGoodsSupply = { show: show, reload: function () { st.loadedCab = null; } };
})(typeof window !== 'undefined' ? window : globalThis);

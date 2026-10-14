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
            hint: 'План пошива: артикул, расцветка, общее количество и процентовка по размерам. В РНП идёт в строку «В пошиве».',
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
    // Артикул можно вводить как угодно: точное название, nm_id, начало или часть (если подходит ровно один).
    function findArt(text) {
        var v = String(text || '').trim().toLowerCase();
        if (!v) return null;
        var hit = st.arts.filter(function (x) { return artLabel(x).toLowerCase() === v || String(x.nm_id) === v; })[0];
        if (hit) return hit;
        var part = st.arts.filter(function (x) { return artLabel(x).toLowerCase().indexOf(v) >= 0 || String(x.nm_id).indexOf(v) === 0; });
        return part.length === 1 ? part[0] : null;
    }
    function artByNm(nm) { for (var i = 0; i < st.arts.length; i++) if (Number(st.arts[i].nm_id) === Number(nm)) return st.arts[i]; return null; }

    async function load() {
        var cab = cabId();
        st.cab = cab;
        if (!cab || !sb()) return;
        var a = await sb().from('rnp_articles').select('nm_id,name,manual_data,is_active,photo_url').eq('cabinet_id', cab).order('nm_id').range(0, 1999);
        st.arts = (a.data || []).filter(function (x) { return x.is_active !== false; });
        var s = await sb().from('goods_shipments').select('*').eq('cabinet_id', cab).order('sort_idx', { ascending: true }).order('created_at', { ascending: true }).range(0, 1999);
        var p = await sb().from('production_orders').select('*').eq('cabinet_id', cab).order('created_at', { ascending: false }).range(0, 1999);
        st.rows.ship = s.data || [];
        st.rows.prod = p.data || [];
        st.loadedCab = cab;
    }

    function pane(k) { return document.getElementById(KINDS[k].pane); }

    function render(k) { return k === 'ship' ? renderShip() : renderProd(); }


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
            var all = g.map[b];
            var onAll = all.length > 0 && all.every(function (r) { return r.in_rnp; });
            var onSome = !onAll && all.some(function (r) { return r.in_rnp; });
            var noNm = all.filter(function (r) { return !r.nm_id; }).length;
            body += '<tr class="gs-grp" data-batch="' + esc(b) + '"><td colspan="' + colspan + '"><input class="gs-batch gs-in" value="' + esc(b) + '" placeholder="Название партии (например «№7 ИП Уркунбаев 100%»)">' +
                '<span class="gs-gtot">' + (tot ? 'всего ' + tot.toLocaleString('ru') + ' шт' : '') + '</span>' +
                '<button type="button" class="gs-rnp-sw gs-edit' + (onAll ? ' is-on' : (onSome ? ' is-part' : '')) + '" data-act="rnpbatch" title="' + esc((onAll ? 'Поставка показывается в РНП (строка «В пути»). Нажмите, чтобы убрать.' : 'Показать эту поставку в РНП (строка «В пути»).') + (noNm ? ' Строк без артикула WB: ' + noNm + ': они в РНП не попадут.' : '')) + '">' + (onAll ? '✓ В РНП' : (onSome ? '◐ В РНП' : 'В РНП')) + '</button>' +
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
                    '<td class="gs-art"><input class="gs-in' + (!a && r.article ? ' gs-nomatch' : '') + '" data-f="art" list="gs-arts-ship" value="' + esc(a ? artLabel(a) : (r.article || '')) + '" placeholder="Артикул"' + (!a && r.article ? ' title="Артикул WB не найден: выберите из списка, иначе в РНП эта строка не попадёт"' : '') + '></td>' +
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
        bindFill(host);
        host.addEventListener('click', function (e) {
            var b = e.target.closest('[data-act]');
            if (!b) return;
            var act = b.getAttribute('data-act');
            if (act === 'addbatch') {
                var n = 'Новая партия ' + (groupsOf().order.length + 1);
                st.draftBatches.push(n); addShipRow(n);
            } else if (act === 'rnpbatch') {
                toggleBatchRnp(b.closest('tr').getAttribute('data-batch') || '');
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
                r.article = a ? artLabel(a) : String(el.value || '').trim();
                el.classList.toggle('gs-nomatch', !a && !!v);
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

    // ─── Как в Google Таблицах: у выбранной ячейки квадратик, тянем вниз (или вверх) — значение копируется ───
    function bindFill(host) {
        var handle = null, srcEl = null, dragging = false, targets = [];
        function ensure() {
            if (handle) return handle;
            handle = document.createElement('div');
            handle.className = 'gs-fill'; handle.hidden = true; handle.title = 'Потяните вниз, чтобы скопировать значение';
            document.body.appendChild(handle);
            handle.addEventListener('pointerdown', start);
            return handle;
        }
        function place() {
            if (!handle || !srcEl || !document.body.contains(srcEl)) { if (handle) handle.hidden = true; return; }
            var td = srcEl.closest('td'), r = (td || srcEl).getBoundingClientRect(), box = host.querySelector('.gs-sheet');
            var sb = box ? box.getBoundingClientRect() : null;
            if (sb && (r.bottom > sb.bottom + 1 || r.bottom < sb.top || r.right > sb.right + 1 || r.right < sb.left)) { handle.hidden = true; return; }
            handle.hidden = false;
            handle.style.left = (r.right - 6) + 'px'; handle.style.top = (r.bottom - 6) + 'px';
        }
        function colOf(el) { var td = el.closest('td'); return td ? td.cellIndex : -1; }
        function clearSel() { targets.forEach(function (t) { var td = t.closest('td'); if (td) td.classList.remove('gs-fillsel'); }); targets = []; }
        function cellInput(tr, col) { var td = tr.cells[col]; return td ? td.querySelector('input:not([type=checkbox]),select') : null; }
        function rowsBetween(a, b) {
            var all = Array.prototype.slice.call(host.querySelectorAll('tbody tr.gs-row')), i = all.indexOf(a), j = all.indexOf(b);
            if (i < 0 || j < 0 || i === j) return [];
            return i < j ? all.slice(i + 1, j + 1) : all.slice(j, i).reverse();
        }
        function start(e) {
            if (!srcEl) return;
            e.preventDefault();
            dragging = true; handle.classList.add('is-drag');
            document.addEventListener('pointermove', move);
            document.addEventListener('pointerup', end, { once: true });
        }
        function move(e) {
            var under = document.elementFromPoint(e.clientX, e.clientY), tr = under && under.closest ? under.closest('tr.gs-row') : null;
            clearSel();
            if (!tr) return;
            var src = srcEl.closest('tr.gs-row'), col = colOf(srcEl);
            rowsBetween(src, tr).forEach(function (r) { var inp = cellInput(r, col); if (inp) { targets.push(inp); inp.closest('td').classList.add('gs-fillsel'); } });
        }
        function end() {
            document.removeEventListener('pointermove', move);
            dragging = false; handle.classList.remove('is-drag');
            var val = srcEl ? srcEl.value : '', list = targets.slice();
            clearSel();
            list.forEach(function (inp) {
                if (inp.tagName === 'SELECT' && !Array.prototype.some.call(inp.options, function (o) { return o.value === val; })) {
                    var o = document.createElement('option'); o.value = val; o.textContent = val; inp.appendChild(o);
                }
                inp.value = val;
                inp.dispatchEvent(new Event('change', { bubbles: true }));
            });
            place();
        }
        host.addEventListener('focusin', function (e) {
            var el = e.target;
            if (!el.closest || !el.closest('tbody tr.gs-row') || el.classList.contains('gs-batch') || !(el.matches('input:not([type=checkbox]),select'))) return;
            srcEl = el; ensure(); place();
        });
        host.addEventListener('focusout', function (e) {
            setTimeout(function () { if (!dragging && handle && document.activeElement && !host.contains(document.activeElement)) handle.hidden = true; }, 50);
        });
        host.addEventListener('scroll', place, true);
        window.addEventListener('resize', place);
    }

    function addShipRow(batch) {
        var r = { _tmp: 't' + Date.now(), cabinet_id: st.cab, nm_id: null, article: '', in_rnp: true, batch: batch, method: '', product: '', origin: 'Бишкек', cargo: '', delivery: 'АВТО', price: null, sizes: {}, status: 'в пути', note: '', sent_date: new Date().toISOString().slice(0, 10) };
        var idx = -1;
        st.rows.ship.forEach(function (x, i) { if ((x.batch || '') === batch) idx = i; });
        if (idx >= 0) st.rows.ship.splice(idx + 1, 0, r); else st.rows.ship.push(r);
        renderShip();
        var tr = pane('ship').querySelector('tr[data-tmp="' + r._tmp + '"]');
        var first = tr && tr.querySelector('[data-f="art"]'); if (first) first.focus();
    }

    async function saveShip(r, tr) {
        if (!r.nm_id && !r.article) { tr.classList.add('gs-incomplete'); return; }
        tr.classList.remove('gs-incomplete');
        var payload = { cabinet_id: st.cab, nm_id: r.nm_id || null, article: r.article || '', in_rnp: r.in_rnp === true, size: '', qty: shipTotal(r), sizes: r.sizes || {}, status: r.status || '', note: r.note || '', batch: r.batch || '', method: r.method || '', product: r.product || '', origin: r.origin || '', cargo: r.cargo || '', delivery: r.delivery || '', price: r.price == null ? null : r.price, sent_date: r.sent_date || null, updated_at: new Date().toISOString() };
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

    async function toggleBatchRnp(batch) {
        var rows = st.rows.ship.filter(function (r) { return (r.batch || '') === batch; });
        if (!rows.length) return;
        var on = !rows.every(function (r) { return r.in_rnp; });
        var ids = [];
        rows.forEach(function (r) { r.in_rnp = on; if (r.id) ids.push(r.id); });
        renderShip();
        if (!ids.length) return;
        try {
            var res = await sb().from('goods_shipments').update({ in_rnp: on }).in('id', ids);
            if (res.error) throw res.error;
            changed();
        } catch (e) {
            rows.forEach(function (r) { r.in_rnp = !on; });
            renderShip();
            root.alert('Не удалось переключить: ' + String((e && e.message) || e));
        }
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

    // ─── «Заказ на производство» как таблица заказа: артикул + расцветка, размеры строками, процентовка ───
    var PROD_STATUS = [['plan', 'В плане'], ['sewing', 'В пошиве'], ['done', 'Готово']];
    var PROD_SIZES = ['42', '44', '46', '48', '50', '52'];
    function uuid() {
        if (root.crypto && root.crypto.randomUUID) return root.crypto.randomUUID();
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
    }
    function fmtDate(d) { if (!d) return ''; var m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '.' + m[2] + '.' + m[1] : String(d); }
    // Равные проценты по размерам: 17,17,17,17,16,16 (остаток от деления на первые размеры).
    function evenPct(n) { var base = Math.floor(100 / n), rest = 100 - base * n, a = []; for (var i = 0; i < n; i++) a.push(base + (i < rest ? 1 : 0)); return a; }
    // Количество по размерам = общее × % ; остаток от округления уходит в крупные (последние) размеры.
    function splitQty(total, pcts) {
        var q = pcts.map(function (p) { return Math.floor(total * (Number(p) || 0) / 100); });
        var sumP = pcts.reduce(function (s, p) { return s + (Number(p) || 0); }, 0);
        if (Math.round(sumP) === 100) {
            var rest = total - q.reduce(function (s, x) { return s + x; }, 0);
            for (var i = q.length - 1; i >= 0 && rest > 0; i--, rest--) q[i] += 1;
        }
        return q;
    }
    function prodGroups() {
        var order = [], map = {};
        st.rows.prod.slice().sort(function (a, b) { return (a.sort_idx || 0) - (b.sort_idx || 0); }).forEach(function (r) {
            var k = r.grp || r.id || r._tmp;
            if (!map[k]) { map[k] = { key: k, rows: [] }; order.push(k); }
            map[k].rows.push(r);
        });
        var gs = order.map(function (k) { return map[k]; });
        gs.forEach(function (g) {
            var f = g.rows[0];
            g.nm_id = f.nm_id; g.color = f.color || ''; g.status = f.status || 'plan'; g.order_date = f.order_date || ''; g.due_date = f.due_date || '';
            g.total = Number(f.total_qty) || g.rows.reduce(function (s, r) { return s + (Number(r.qty) || 0); }, 0);
            g.created = f.created_at || '9999';
        });
        // новые сверху (черновики без created_at — самые верхние)
        gs.sort(function (a, b) { return a.created < b.created ? 1 : a.created > b.created ? -1 : 0; });
        return gs;
    }
    function groupByKey(key) { var g = prodGroups().filter(function (x) { return x.key === key; })[0]; return g || null; }

    function renderProd() {
        var host = pane('prod');
        if (!host) return;
        var K = KINDS.prod;
        var groups = prodGroups().filter(function (g) { return st.showDone.prod || g.status !== 'done'; });
        var open = prodGroups().filter(function (g) { return g.status !== 'done'; });
        var grand = open.reduce(function (s, g) { return s + g.total; }, 0);
        var dl = '<datalist id="gs-arts-prod">' + st.arts.map(function (a) { return '<option value="' + esc(artLabel(a)) + '">' + a.nm_id + '</option>'; }).join('') + '</datalist>';
        var statusSel = function (g) { return '<select class="gs-in gp-st gp-st-' + g.status + '" data-g="' + esc(g.key) + '" data-gf="status">' + PROD_STATUS.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === g.status ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select>'; };
        var body = '';
        groups.forEach(function (g) {
            var n = g.rows.length, rs = ' rowspan="' + n + '"';
            var a = artByNm(g.nm_id), photo = a && a.photo_url ? a.photo_url : ''; if (!photo && g.nm_id && root.RNP && root.RNP.wbPhotoUrl) { try { photo = root.RNP.wbPhotoUrl(g.nm_id) || ''; } catch (e) {} }
            var sumP = g.rows.reduce(function (s, r) { return s + (Number(r.pct) || 0); }, 0);
            var pctBad = Math.round(sumP * 100) / 100 !== 100;
            var diffP = Math.round((100 - sumP) * 100) / 100;
            var diffQ = Math.round(Math.abs(diffP) * g.total / 100);
            var pctMsg = pctBad ? (diffP > 0 ? 'Не хватает ' + diffP + '%' : 'Лишние ' + Math.abs(diffP) + '%') + (g.total ? ' (≈' + diffQ.toLocaleString('ru') + ' шт)' : '') : '';
            g.rows.forEach(function (r, i) {
                body += '<tr class="gp-row" data-id="' + esc(r.id || '') + '" data-tmp="' + esc(r._tmp || '') + '" data-g="' + esc(g.key) + '">';
                if (i === 0) {
                    body += '<td' + rs + ' class="gp-date"><input class="gs-in gp-din" type="date" data-g="' + esc(g.key) + '" data-gf="order_date" value="' + esc(g.order_date) + '"></td>' +
                        '<td' + rs + ' class="gp-photo">' + (photo ? '<img src="' + esc(photo) + '" alt="" onerror="this.style.display=\'none\'">' : '<span class="gp-nophoto">нет фото</span>') + '</td>' +
                        '<td' + rs + ' class="gp-art"><input class="gs-in' + (!a && g.rows[0]._tmp ? ' gs-nomatch' : '') + '" list="gs-arts-prod" data-g="' + esc(g.key) + '" data-gf="art" value="' + esc(a ? artLabel(a) : (g.rows[0]._art || g.nm_id || '')) + '" placeholder="Артикул или WB-код">' + (g.nm_id ? '<div class="gp-nm">WB ' + esc(g.nm_id) + '</div>' : (g.rows[0]._art ? '<div class="gp-nm gp-bad">Артикул не найден в кабинете</div>' : '')) + '</td>' +
                        '<td' + rs + ' class="gp-color"><input class="gs-in" data-g="' + esc(g.key) + '" data-gf="color" value="' + esc(g.color) + '" placeholder="Расцветка"></td>';
                }
                body += '<td class="gp-size"><input class="gs-in" data-f="size" value="' + esc(r.size) + '" placeholder="Размер"></td>' +
                    '<td class="gp-qty">' + (Number(r.qty) || 0) + '</td>';
                if (i === 0) {
                    body += '<td' + rs + ' class="gp-total"><input class="gs-in gp-tin" type="number" min="0" data-g="' + esc(g.key) + '" data-gf="total" value="' + (g.total || '') + '" placeholder="0"><span>всего</span></td>';
                }
                body += '<td class="gp-pct"><input class="gs-in" type="number" min="0" max="100" step="any" data-f="pct" value="' + (r.pct == null ? '' : r.pct) + '"><i>%</i>' +
                    '<button type="button" class="gp-x gs-edit" data-act="delsize" title="Убрать размер">×</button></td>';
                if (i === 0) {
                    body += '<td' + rs + ' class="gp-status">' + statusSel(g) + (pctBad ? '<div class="gp-warn">' + pctMsg + '</div><button type="button" class="gp-fix gs-edit" data-act="fixpct" data-g="' + esc(g.key) + '">Добавить в последний размер</button>' : '') +
                        '<button type="button" class="gp-addsz gs-edit" data-act="addsize" data-g="' + esc(g.key) + '">+ размер</button></td>' +
                        '<td' + rs + ' class="gp-due"><input class="gs-in gp-din" type="date" data-g="' + esc(g.key) + '" data-gf="due_date" value="' + esc(g.due_date) + '">' +
                        '<button type="button" class="gp-delg gs-edit" data-act="delgrp" data-g="' + esc(g.key) + '" title="Удалить заказ">Удалить</button></td>';
                }
                body += '</tr>';
            });
            body += '<tr class="gp-sep"><td colspan="10"></td></tr>';
        });
        host.innerHTML = dl +
            '<div class="gs-head"><div><div class="gs-title">Заказ на производство</div><div class="gs-hint">Введите общее количество и процентовку по размерам: количество по размерам считается само, остаток от округления уходит в крупные размеры. В РНП идёт в строку «В пошиве».</div></div>' +
            '<div class="gs-tools"><span class="gs-gt">В работе: <b>' + grand.toLocaleString('ru') + ' шт</b></span><label class="gs-chk"><input type="checkbox" data-act="done"' + (st.showDone.prod ? ' checked' : '') + '> показывать готовые</label>' +
            '<button type="button" class="gs-add gs-edit" data-act="addgrp">+ Добавить артикул</button></div></div>' +
            '<div class="gs-sheet"><table class="gs-table gp-table"><thead><tr><th>Дата заказа</th><th>Фото</th><th>Артикул</th><th>Расцветка</th><th>Размер</th><th>Кол-во</th><th>Общее кол-во</th><th>Процентовка</th><th>Статус</th><th>Срок</th></tr></thead><tbody>' +
            (body || '<tr><td colspan="10" class="gs-empty">Пока пусто. Нажмите «+ Добавить артикул».</td></tr>') + '</tbody></table></div>';
        bindProd(host);
    }

    function prodRow(tr) {
        var id = tr.getAttribute('data-id'), tmp = tr.getAttribute('data-tmp');
        var list = st.rows.prod;
        for (var i = 0; i < list.length; i++) if ((id && list[i].id === id) || (!id && tmp && list[i]._tmp === tmp)) return list[i];
        return null;
    }

    // Пересчёт количества по размерам из общего и процентов; групповые поля копируются в каждую строку.
    function recalcGroup(g) {
        var q = splitQty(g.total, g.rows.map(function (r) { return r.pct; }));
        g.rows.forEach(function (r, i) {
            r.qty = q[i]; r.total_qty = g.total; r.nm_id = g.nm_id; r.color = g.color; r.status = g.status;
            r.order_date = g.order_date || null; r.due_date = g.due_date || null; r.sort_idx = i;
        });
    }

    var saveTimer = null;
    function saveGroupSoon(g) { clearTimeout(saveTimer); saveTimer = setTimeout(function () { saveGroup(g.key); }, 250); }

    async function saveGroup(key) {
        var g = groupByKey(key);
        if (!g) return;
        if (!g.nm_id || !(g.total > 0)) return; // ждём артикул WB и количество
        recalcGroup(g);
        var now = new Date().toISOString();
        try {
            for (var i = 0; i < g.rows.length; i++) {
                var r = g.rows[i];
                var payload = { cabinet_id: st.cab, nm_id: r.nm_id, size: r.size || '', qty: r.qty, status: r.status, note: r.note || '', order_date: r.order_date, due_date: r.due_date, grp: g.key, color: r.color || '', pct: r.pct == null || r.pct === '' ? null : Number(r.pct), total_qty: g.total, sort_idx: i, updated_at: now };
                var res;
                if (r.id) res = await sb().from('production_orders').update(payload).eq('id', r.id);
                else {
                    res = await sb().from('production_orders').insert(payload).select('id,created_at').single();
                    if (!res.error && res.data) { r.id = res.data.id; r.created_at = res.data.created_at; r.grp = g.key; }
                }
                if (res.error) throw res.error;
            }
            changed();
        } catch (e) {
            root.alert('Не удалось сохранить заказ: ' + String((e && e.message) || e));
        }
    }

    function bindProd(host) {
        if (host._gsProdBound) return;
        host._gsProdBound = true;
        host.addEventListener('click', function (e) {
            var b = e.target.closest('[data-act]');
            if (!b) return;
            var act = b.getAttribute('data-act');
            if (act === 'addgrp') addProdGroup();
            else if (act === 'addsize') addProdSize(b.getAttribute('data-g'));
            else if (act === 'delsize') delProdSize(b.closest('tr'));
            else if (act === 'delgrp') delProdGroup(b.getAttribute('data-g'));
            else if (act === 'fixpct') fixPct(b.getAttribute('data-g'));
        });
        host.addEventListener('change', function (e) {
            var el = e.target;
            if (el.getAttribute('data-act') === 'done') { st.showDone.prod = el.checked; renderProd(); return; }
            var gk = el.getAttribute('data-g'), gf = el.getAttribute('data-gf'), f = el.getAttribute('data-f');
            if (gf) {
                var g = groupByKey(gk);
                if (!g) return;
                if (gf === 'art') {
                    var a = findArt(el.value);
                    g.nm_id = a ? a.nm_id : null;
                    g.rows[0]._art = a ? '' : String(el.value || '').trim();
                } else if (gf === 'total') g.total = Math.max(0, parseInt(el.value, 10) || 0);
                else if (gf === 'color') g.color = String(el.value || '').trim();
                else if (gf === 'status') g.status = el.value;
                else if (gf === 'order_date') g.order_date = el.value || '';
                else if (gf === 'due_date') g.due_date = el.value || '';
                recalcGroup(g); renderProd(); saveGroupSoon(g);
            } else if (f) {
                var tr = el.closest('tr'), r = prodRow(tr);
                if (!r) return;
                var g2 = groupByKey(r.grp || r.id || r._tmp);
                if (f === 'size') r.size = String(el.value || '').trim();
                else if (f === 'pct') r.pct = el.value === '' ? null : Math.max(0, Number(el.value));
                if (g2) { recalcGroup(g2); renderProd(); saveGroupSoon(g2); }
            }
        });
    }

    function addProdGroup() {
        var key = uuid(), pcts = evenPct(PROD_SIZES.length);
        var today = new Date().toISOString().slice(0, 10);
        PROD_SIZES.forEach(function (z, i) {
            st.rows.prod.push({ _tmp: 't' + Date.now() + '_' + i, grp: key, cabinet_id: st.cab, nm_id: null, size: z, qty: 0, pct: pcts[i], total_qty: 0, color: '', status: 'plan', note: '', order_date: today, due_date: null, sort_idx: i });
        });
        renderProd();
        var el = pane('prod').querySelector('tr[data-g="' + key + '"] [data-gf="art"]'); if (el) el.focus();
    }

    // Остаток процентов (или лишнее) уходит в последний размер, чтобы сумма стала ровно 100.
    function fixPct(key) {
        var g = groupByKey(key);
        if (!g || !g.rows.length) return;
        var sum = g.rows.reduce(function (s, r) { return s + (Number(r.pct) || 0); }, 0);
        var last = g.rows[g.rows.length - 1];
        last.pct = Math.max(0, Math.round(((Number(last.pct) || 0) + 100 - sum) * 100) / 100);
        recalcGroup(g); renderProd(); saveGroupSoon(g);
    }

    function addProdSize(key) {
        var g = groupByKey(key);
        if (!g) return;
        g.rows.push({ _tmp: 't' + Date.now(), grp: key, cabinet_id: st.cab, nm_id: g.nm_id, size: '', qty: 0, pct: 0, total_qty: g.total, color: g.color, status: g.status, note: '', order_date: g.order_date || null, due_date: g.due_date || null, sort_idx: g.rows.length });
        st.rows.prod.push(g.rows[g.rows.length - 1]);
        renderProd();
    }

    async function delProdSize(tr) {
        var r = prodRow(tr);
        if (!r) return;
        var g = groupByKey(r.grp || r.id || r._tmp);
        if (g && g.rows.length <= 1) return;
        if (r.id) {
            var res = await sb().from('production_orders').delete().eq('id', r.id);
            if (res.error) { root.alert(res.error.message); return; }
        }
        st.rows.prod = st.rows.prod.filter(function (x) { return x !== r; });
        g = groupByKey(r.grp || r.id || r._tmp);
        if (g) { recalcGroup(g); saveGroupSoon(g); }
        renderProd();
    }

    async function delProdGroup(key) {
        var g = groupByKey(key);
        if (!g) return;
        var ids = g.rows.filter(function (r) { return r.id; }).map(function (r) { return r.id; });
        if (ids.length && !root.confirm('Удалить заказ целиком?')) return;
        if (ids.length) {
            var res = await sb().from('production_orders').delete().in('id', ids);
            if (res.error) { root.alert(res.error.message); return; }
        }
        st.rows.prod = st.rows.prod.filter(function (r) { return (r.grp || r.id || r._tmp) !== key; });
        renderProd();
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
        var VIEWS = ['now', 'daily', 'cost', 'fbs', 'give', 'ship', 'prod'];
        function savedView() { try { var v = localStorage.getItem('nr_goods_view'); return VIEWS.indexOf(v) >= 0 ? v : 'now'; } catch (e) { return 'now'; } }
        function rememberView(v) { try { if (VIEWS.indexOf(v) >= 0) localStorage.setItem('nr_goods_view', v); } catch (e) {} }
        root.setGoodsView = function (view, opts) {
            // Открытие вкладки «Товары» зовёт setGoodsView('now', {skipLoad}) — вместо этого возвращаем последний раздел (после обновления, смены кабинета).
            if (view === 'now' && opts && opts.skipLoad) {
                var sv = savedView();
                if (sv !== 'now') { view = sv; opts = undefined; }
            } else rememberView(view);
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
            return orig.call(this, view, opts);
        };
        // После жёсткого обновления «Логистика» / «Заказ на производство» восстанавливаем, когда кабинет уже известен.
        var rt = 0, restoreTimer = setInterval(function () {
            var sv = savedView(), tab = document.getElementById('tab-goods-groups');
            if (++rt > 75 || (sv !== 'ship' && sv !== 'prod')) { clearInterval(restoreTimer); return; }
            if (tab && tab.classList.contains('active') && cabId()) { clearInterval(restoreTimer); if (cur !== sv) root.setGoodsView(sv); }
        }, 400);
        return true;
    }

    var tries = 0;
    var timer = setInterval(function () { if (install() || ++tries > 240) clearInterval(timer); }, 500);

    // Смена кабинета: перечитываем при следующем открытии.
    function cabinetChanged() { st.loadedCab = null; if (cur) show(cur); }
    root.addEventListener('nr-cabinet-changed', cabinetChanged);
    document.addEventListener('cabinet-changed', cabinetChanged);
    root.NrGoodsSupply = { show: show, reload: function () { st.loadedCab = null; } };
})(typeof window !== 'undefined' ? window : globalThis);

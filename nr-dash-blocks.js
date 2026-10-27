/* Дашборд: ряд из пяти карточек вместо «Динамики заказов» (баланс и вывод, Фулфилмент, товары в пути, заказ на производство, остатки).
   Баланс и «К выводу» взяты из РНП. Данные берутся маленькими запросами и запоминаются на устройстве по кабинету:
   после обновления страницы и при смене кабинета карточки видны сразу, свежие цифры подставляются следом.
   «Фулфилмент» (nr-ff.js) остаётся как был, сюда добавлены записи начислено/оплачено; «В пути» открывает окно по маршрутам. */
(function (root) {
    'use strict';
    var doc = root.document;
    var ROUTES = [['bishkek', 'Бишкек → WB', /бишкек/i], ['china', 'Китай → WB', /китай/i], ['moscow', 'Москва → WB', /москв/i]];
    var S = { cab: '', data: null, busy: false, route: 'bishkek', ledger: [], ff: '' };

    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function fmt(n) { return Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/[  ]/g, ' '); }
    function todayBishkek() { return new Date(Date.now() + 6 * 3600 * 1000).toISOString().slice(0, 10); }
    function dm(iso) { return iso ? String(iso).slice(0, 10).split('-').reverse().slice(0, 2).join('.') : ''; }
    function db() { try { return typeof supabase !== 'undefined' ? supabase : null; } catch (e) { return null; } }
    function cab() { try { return (typeof currentCabinetId !== 'undefined' ? currentCabinetId : '') || ''; } catch (e) { return ''; } }
    function viewer() { return !!(root.NrViewer && root.NrViewer.on); }
    var MONTHS = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];

    // ===== Чистые расчёты (проверяются тестом) =====
    function routeOf(origin) {
        for (var i = 0; i < ROUTES.length; i++) if (ROUTES[i][2].test(String(origin || ''))) return ROUTES[i][0];
        return 'other';
    }
    function transit(rows) {
        var out = { total: 0, parts: 0, refs: [], routes: { bishkek: [], china: [], moscow: [], other: [] } };
        (rows || []).forEach(function (r) {
            if (String(r.status || '').toLowerCase() !== 'в пути') return;
            var q = Number(r.qty) || 0;
            out.total += q; out.parts++;
            (String(r.batch || '') + ' ' + String(r.note || '')).replace(/\d{6,}/g, function (m) { if (out.refs.indexOf(m) < 0) out.refs.push(m); });
            out.routes[routeOf(r.origin)].push({ article: r.article || r.product || '', qty: q, sent: r.sent_date || '', eta: r.eta_date || '', cargo: r.cargo || '' });
        });
        return out;
    }
    // Поставки WB на склады (FBW), которые ещё не приняты: едут или ждут приёмки. По складам назначения.
    function wbSupplies(items, skip) {
        var out = { total: 0, n: 0, byWh: {}, list: [] };
        (items || []).forEach(function (x) {
            if (!x || x.done || (skip && skip.indexOf(String(x.id)) >= 0)) return;
            var q = Number(x.itemsCount) || 0, wh = String(x.warehouse || 'склад не указан');
            out.total += q; out.n++;
            (out.byWh[wh] = out.byWh[wh] || { qty: 0, n: 0 });
            out.byWh[wh].qty += q; out.byWh[wh].n++;
            out.list.push({ id: x.id, warehouse: wh, status: x.statusName || '', qty: q, created: x.createdAt || '' });
        });
        return out;
    }
    function production(rows) {
        var o = { qty: 0, models: 0, due: '', state: '' }, grp = {};
        (rows || []).forEach(function (r) {
            if (r.status !== 'plan' && r.status !== 'sewing') return;
            o.qty += Number(r.qty) || 0;
            grp[r.grp || r.nm_id || r.id] = 1;
            if (r.due_date && (!o.due || r.due_date < o.due)) o.due = r.due_date;
            if (r.status === 'sewing') o.state = 'в цеху'; else if (!o.state) o.state = 'в плане';
        });
        o.models = Object.keys(grp).length;
        return o;
    }
    // Партии «С FBS на FBO» в пути уже уехали со своего склада: вычитаем их из FBS, пока WB не принял и остатки не обновились.
    function stock(rows, ship) {
        var o = { fbo: 0, fbs: 0, moved: 0 };
        (rows || []).forEach(function (r) { if (r.stock_scheme === 'fbs') o.fbs += Number(r.quantity) || 0; else o.fbo += Number(r.quantity) || 0; });
        (ship || []).forEach(function (r) {
            if (String(r.status || '').toLowerCase() === 'в пути' && /fbs/i.test(String(r.origin || ''))) o.moved += Number(r.qty) || 0;
        });
        o.moved = Math.min(o.moved, o.fbs); o.fbs -= o.moved;
        o.total = o.fbo + o.fbs;
        return o;
    }
    function nextPayout(payouts, today) {
        var list = (payouts || []).filter(function (p) { return p.closed && String(p.pay_date) > today; });
        list.sort(function (a, b) { return String(a.pay_date).localeCompare(String(b.pay_date)); });
        return list[0] ? { date: list[0].pay_date, amount: Number(list[0].to_withdraw) || 0 } : null;
    }
    function lastYear(hist, today) {
        var y = Number(today.slice(0, 4)) - 1, m = today.slice(5, 7), sum = 0, n = 0;
        (hist || []).forEach(function (h) {
            var d = String(h.pay_date);
            if (Number(d.slice(0, 4)) === y && d.slice(5, 7) === m) { sum += Number(h.to_withdraw) || 0; n++; }
        });
        return n ? { year: y, month: Number(m), sum: sum } : null;
    }
    function ledgerTotals(rows) {
        var t = { charge: 0, payment: 0 };
        (rows || []).forEach(function (r) { t[r.kind === 'payment' ? 'payment' : 'charge'] += Number(r.amount) || 0; });
        t.due = t.charge - t.payment;
        return t;
    }

    // ===== Данные =====
    var KEY = function (c) { return 'nr_dashblocks_v1_' + c; };
    // Активные поставки WB: сразу из списка раздела «Логистика» (если он уже загружался), свежие запрашиваем у WB не чаще раза в 10 минут.
    function loadSupplies(c) {
        var items = null;
        try { var snap = JSON.parse(localStorage.getItem('nr_supplies_list_' + c) || 'null'); if (snap && snap.items) items = snap.items; } catch (e) { /* нет кэша */ }
        if (items && S.data && c === cab()) { S.data.wb = wbSupplies(items, S.data.transit && S.data.transit.refs); paint(); }
        var last = Number(S.supAt && S.supAt[c] || 0);
        if (Date.now() - last < 10 * 60 * 1000) return;
        (S.supAt = S.supAt || {})[c] = Date.now();
        var call = typeof root.callWbProxy === 'function' ? root.callWbProxy : null;
        if (!call) return;
        Promise.resolve(call('fbw_supplies', { limit: 300, offset: 0 })).then(function (r) {
            if (!r || r.error || c !== cab() || !S.data || typeof root.mapFbwSupply !== 'function') return;
            var batch = Array.isArray(r) ? r : (r.supplies || r.data || []);
            S.data.wb = wbSupplies(batch.map(root.mapFbwSupply), S.data.transit && S.data.transit.refs);
            persist(); paint();
        }).catch(function () { /* WB не ответил: остаётся то, что было */ });
    }
    function load(c) {
        var d = db();
        if (!d || !c || S.busy) return;
        S.busy = true;
        var q = function (p) { return Promise.resolve(p).then(function (r) { return r && !r.error ? r.data : null; }, function () { return null; }); };
        Promise.all([
            q(d.from('wb_balance_daily').select('date,current,for_withdraw').eq('cabinet_id', c).order('date', { ascending: false }).limit(1)),
            q(d.rpc('rnp_cabinet_payouts', { p_cabinet: c, p_weeks: 8 })),
            q(d.from('payout_history').select('pay_date,to_withdraw').eq('cabinet_id', c)),
            q(d.from('goods_shipments').select('article,product,qty,status,origin,sent_date,eta_date,cargo,batch,note').eq('cabinet_id', c).limit(1000)),
            q(d.from('production_orders').select('id,grp,nm_id,qty,status,due_date').eq('cabinet_id', c).limit(1000)),
            q(d.from('wb_stocks').select('quantity,stock_scheme').eq('cabinet_id', c).limit(5000)),
            q(d.from('ff_ledger').select('id,ff_name,kind,title,boxes,amount,entry_date').eq('cabinet_id', c).order('entry_date', { ascending: false }).limit(200))
        ]).then(function (r) {
            S.busy = false;
            if (c !== cab()) return;
            var today = todayBishkek();
            var data = {
                bal: r[0] && r[0][0] || null, next: nextPayout(r[1], today), ly: lastYear(r[2], today),
                transit: transit(r[3]), prod: production(r[4]), stock: stock(r[5], r[3]), ledger: r[6] || [], at: Date.now()
            };
            data.wb = S.data && S.data.wb || null;
            S.cab = c; S.data = data; S.ledger = data.ledger;
            try { localStorage.setItem(KEY(c), JSON.stringify(data)); } catch (e) { /* без кэша */ }
            paint();
            loadSupplies(c);
        });
    }

    // ===== Карточки =====
    var CSS = '#tab-dashboard .pnl-grid.ff-row{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;align-items:stretch}' +
        '#tab-dashboard .pnl-grid.ff-row>#ff-chart{display:none}#tab-dashboard .pnl-grid.ff-row>#ff-sum{order:2}' +
        '.nrdb{order:5;background:var(--bg-card);border:1px solid var(--border);border-radius:16px;padding:14px 16px;display:grid;gap:6px;align-content:start;min-width:0;color:var(--text-primary);font-size:12px}' +
        '.nrdb .l{display:flex;justify-content:space-between;gap:8px;align-items:center;color:var(--text-muted)}.nrdb .chip{font-style:normal;font-size:11px;font-weight:800;padding:2px 9px;border-radius:99px;background:var(--sel);color:var(--accent);white-space:nowrap}' +
        '.nrdb .v{font-size:26px;font-weight:800;letter-spacing:-.02em;line-height:1.1;font-variant-numeric:tabular-nums}.nrdb .v small{font-size:12px;font-weight:600;color:var(--text-muted)}' +
        '.nrdb .r{display:flex;justify-content:space-between;gap:8px}.nrdb .r span{color:var(--text-muted)}.nrdb .r b{font-variant-numeric:tabular-nums;text-align:right}.nrdb .r.hi b{color:#16a34a}' +
        '.nrdb .hint{font-size:11px;color:var(--text-muted);line-height:1.35}.nrdb .more{font-size:11px;color:var(--accent);font-weight:700;background:none;border:0;padding:0;text-align:left;cursor:pointer}' +
        '.nrdb.clk{cursor:pointer}.nrdb .split{height:6px;border-radius:99px;background:var(--sel);overflow:hidden}.nrdb .split i{display:block;height:100%;background:var(--accent)}' +
        '#nrdb-bal{order:1;background:linear-gradient(150deg,#6d5df0,#8f82ff);color:#fff;border:0}#nrdb-bal .l,#nrdb-bal .r span,#nrdb-bal .v small,#nrdb-bal .hint{color:rgba(255,255,255,.85)}#nrdb-bal .chip{background:rgba(255,255,255,.25);color:#fff}#nrdb-bal .r.hi b{color:#fff}' +
        '#nrdb-transit{order:3}#nrdb-prod{order:4}#nrdb-stock{order:5}.nrff-add{margin-top:6px;font-size:11.5px;font-weight:700;color:var(--accent);background:none;border:0;padding:0;cursor:pointer;text-align:left}.nrff-due{font-size:11.5px;color:var(--text-muted)}.nrff-due b{color:var(--text-primary)}' +
        '@media(max-width:1100px){#tab-dashboard .pnl-grid.ff-row{grid-template-columns:repeat(2,minmax(0,1fr))}}' +
        '#nrdb-modal{position:fixed;inset:0;z-index:9000;background:rgba(20,19,28,.45);backdrop-filter:blur(4px);display:grid;place-items:center;padding:16px}' +
        '#nrdb-modal .m{background:var(--bg-card);color:var(--text-primary);border-radius:20px;width:min(640px,100%);max-height:90vh;overflow:auto;box-shadow:0 30px 80px rgba(0,0,0,.35)}' +
        '#nrdb-modal .mh{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:16px 20px;border-bottom:1px solid var(--border)}#nrdb-modal h3{margin:0;font-size:17px}' +
        '#nrdb-modal .x{width:30px;height:30px;border-radius:50%;background:var(--sel);border:0;color:var(--text-muted);cursor:pointer;font-size:16px}' +
        '#nrdb-modal .mb{padding:16px 20px;display:grid;gap:14px}#nrdb-modal .sum{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}#nrdb-modal .sum div{background:var(--sel);border-radius:12px;padding:10px 12px}#nrdb-modal .sum small{display:block;color:var(--text-muted);font-size:11px}#nrdb-modal .sum b{font-size:17px;font-variant-numeric:tabular-nums}' +
        '#nrdb-modal .list{border:1px solid var(--border);border-radius:12px;overflow:hidden}#nrdb-modal .li{display:grid;grid-template-columns:54px 1fr auto auto;gap:10px;padding:9px 12px;font-size:12.5px;border-top:1px solid var(--border);align-items:center}#nrdb-modal .li:first-child{border-top:0}#nrdb-modal .li time{color:var(--text-muted)}' +
        '#nrdb-modal .pos{color:#16a34a}#nrdb-modal .neg{color:#dc2626}#nrdb-modal .del{background:none;border:0;color:var(--text-muted);cursor:pointer}#nrdb-modal .tabs{display:flex;gap:6px;flex-wrap:wrap}#nrdb-modal .tab{padding:7px 12px;border-radius:99px;background:var(--sel);border:0;font-weight:700;font-size:12.5px;color:var(--text-muted);cursor:pointer}#nrdb-modal .tab.on{background:var(--accent);color: var(--on-accent, #fff)}' +
        '#nrdb-modal .form{display:grid;grid-template-columns:120px 1fr 80px 110px auto;gap:8px;align-items:end;font-size:11px;color:var(--text-muted)}#nrdb-modal .form label{display:grid;gap:3px}#nrdb-modal .form input,#nrdb-modal .form select{background:var(--sel);border:1px solid var(--border);border-radius:10px;padding:8px 10px;color:var(--text-primary);font-size:12.5px;min-width:0}' +
        '#nrdb-modal .btn{background:var(--accent);color: var(--on-accent, #fff);border:0;border-radius:10px;padding:9px 14px;font-weight:700;font-size:12.5px;cursor:pointer}#nrdb-modal .empty{padding:14px;color:var(--text-muted);font-size:12.5px;text-align:center}' +
        '#nrdb-modal .hint{font-size:12px;color:var(--text-muted);line-height:1.4}@media(max-width:700px){#nrdb-modal .form{grid-template-columns:1fr 1fr}#nrdb-modal .sum{grid-template-columns:1fr}}';

    function ensure() {
        var row = doc.querySelector('.pnl-grid.ff-row');
        if (!row) return null;
        if (!doc.getElementById('nrdb-css')) { var st = doc.createElement('style'); st.id = 'nrdb-css'; st.textContent = CSS; doc.head.appendChild(st); }
        ['bal', 'transit', 'prod', 'stock'].forEach(function (k) {
            if (doc.getElementById('nrdb-' + k)) return;
            var el = doc.createElement('div'); el.id = 'nrdb-' + k; el.className = 'nrdb' + (k === 'transit' ? ' clk' : '');
            row.appendChild(el);
        });
        return row;
    }
    function paint() {
        var row = ensure(), D = S.data;
        if (!row || !D) return;
        var today = todayBishkek();
        var ly = D.ly ? '<div class="hint">В ' + MONTHS[D.ly.month - 1] + ' ' + D.ly.year + ' вывод был ≈ ' + fmt(D.ly.sum) + ' ₽</div>' : '';
        var set = function (k, html) { var el = doc.getElementById('nrdb-' + k); if (el && el.__h !== html) { el.innerHTML = html; el.__h = html; } };
        set('bal', '<div class="l"><span>Баланс WB</span>' + (D.bal ? '<em class="chip">' + dm(D.bal.date) + '</em>' : '') + '</div><div class="v">' + (D.bal ? fmt(D.bal.current) : '—') + ' <small>₽</small></div>' +
            (D.next ? '<div class="r hi"><span>К выводу ' + dm(D.next.date) + '</span><b>' + fmt(D.next.amount) + ' ₽</b></div>' : '<div class="r"><span>К выводу</span><b>—</b></div>') + ly);
        var T = D.transit, W = D.wb || { total: 0, n: 0, byWh: {}, list: [] };
        var whRows = Object.keys(W.byWh).sort(function (a, b) { return W.byWh[b].qty - W.byWh[a].qty; }).slice(0, 3).map(function (k) { return '<div class="r"><span>→ ' + esc(k) + '</span><b>' + (W.byWh[k].qty ? fmt(W.byWh[k].qty) + ' шт' : W.byWh[k].n + ' пост.') + '</b></div>'; }).join('');
        var manual = ROUTES.map(function (r) { var n = T.routes[r[0]].reduce(function (a, x) { return a + x.qty; }, 0); return n ? '<div class="r"><span>' + r[1] + '</span><b>' + fmt(n) + ' шт</b></div>' : ''; }).join('');
        var totalTransit = T.total + W.total;
        set('transit', '<div class="l"><span>Товары в пути</span><em class="chip">' + fmt(totalTransit) + ' шт</em></div>' + (whRows || manual ? whRows + manual : '<div class="hint">Сейчас ничего не едет</div>') + '<button type="button" class="more" data-nrdb="transit">Что в каждой →</button>');
        var P = D.prod;
        set('prod', '<div class="l"><span>Производство</span><em class="chip">' + P.models + ' мод.</em></div><div class="v">' + fmt(P.qty) + ' <small>шт</small></div>' +
            (P.state ? '<div class="r"><span>Сейчас</span><b>' + P.state + '</b></div>' : '') + (P.due ? '<div class="r"><span>Срок</span><b>' + dm(P.due) + (P.due < today ? ' (просрочен)' : '') + '</b></div>' : '<div class="r"><span>Срок</span><b>не указан</b></div>'));
        var St = D.stock, fbo = St.total ? Math.round(St.fbo / St.total * 100) : 0;
        set('stock', '<div class="l"><span>Остатки всего</span><em class="chip">ФБО + ФБС</em></div><div class="v">' + fmt(St.total) + ' <small>шт</small></div>' +
            '<div class="r"><span>ФБО · склад WB</span><b>' + fmt(St.fbo) + ' шт</b></div><div class="r"><span>ФБС · свой склад</span><b>' + fmt(St.fbs) + ' шт</b></div>' + (St.moved ? '<div class="r"><span>Уехало с ФБС на ФБО</span><b>−' + fmt(St.moved) + ' шт</b></div>' : '') + '<div class="split"><i style="width:' + fbo + '%"></i></div>');
        ffExtra();
    }
    // В карточку «Фулфилмент» добавляем итог записей и кнопку окна; сам расчёт nr-ff.js не трогаем.
    function ffExtra() {
        var host = doc.getElementById('ff-sum');
        if (!host) return;
        var t = ledgerTotals(S.ledger), box = host.querySelector('.nrff-box');
        if (!box) { box = doc.createElement('div'); box.className = 'nrff-box'; host.appendChild(box); }
        var h = (S.ledger.length ? '<div class="nrff-due">Записи: начислено ' + fmt(t.charge) + ' ₽, оплачено ' + fmt(t.payment) + ' ₽ · к выплате <b>' + fmt(t.due) + ' ₽</b></div>' : '') +
            '<button type="button" class="nrff-add" data-nrdb="ff">' + (viewer() ? 'Записи и оплаты →' : 'Записи и оплаты: добавить →') + '</button>';
        if (box.__h !== h) { box.innerHTML = h; box.__h = h; }
    }

    // ===== Окна =====
    function close() { var m = doc.getElementById('nrdb-modal'); if (m) m.remove(); }
    function modal(title, body) {
        close();
        var m = doc.createElement('div'); m.id = 'nrdb-modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
        m.innerHTML = '<div class="m"><div class="mh"><h3>' + esc(title) + '</h3><button type="button" class="x" data-close aria-label="Закрыть">×</button></div><div class="mb">' + body + '</div></div>';
        m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('[data-close]')) close(); });
        doc.body.appendChild(m);
        return m;
    }
    function ffModal() {
        var t = ledgerTotals(S.ledger), ro = viewer();
        var list = S.ledger.length ? S.ledger.map(function (r) {
            return '<div class="li"><time>' + dm(r.entry_date) + '</time><span>' + esc(r.title || (r.kind === 'payment' ? 'Оплата' : 'Начислено')) + (r.boxes ? ' · ' + r.boxes + ' кор.' : '') + '</span><b class="' + (r.kind === 'payment' ? 'pos' : 'neg') + '">' + (r.kind === 'payment' ? '− ' : '+ ') + fmt(r.amount) + ' ₽</b>' + (ro ? '<span></span>' : '<button class="del" data-del="' + esc(r.id) + '" title="Удалить" aria-label="Удалить">×</button>') + '</div>';
        }).join('') : '<div class="empty">Записей пока нет</div>';
        var form = ro ? '' : '<div class="form"><label>Тип<select id="nrdb-kind"><option value="charge">Начислено</option><option value="payment">Оплачено</option></select></label><label>Что (например, отгрузка 50 коробов на Казань)<input id="nrdb-title" maxlength="120" placeholder="Отгрузка 50 коробов, Казань"></label><label>Коробов<input id="nrdb-boxes" inputmode="numeric" placeholder="50"></label><label>Сумма, ₽<input id="nrdb-amt" inputmode="decimal" placeholder="50 000"></label><button type="button" class="btn" data-add>Добавить</button></div>';
        var m = modal('Фулфилмент: записи и оплаты', '<div class="sum"><div><small>Начислено</small><b>' + fmt(t.charge) + ' ₽</b></div><div><small>Оплачено</small><b>' + fmt(t.payment) + ' ₽</b></div><div><small>К выплате по записям</small><b>' + fmt(t.due) + ' ₽</b></div></div><div class="hint">Подмены, отмены, хранение и отправки считаются автоматически в карточке «Фулфилмент». Здесь записи, которые вы вносите сами.</div><div class="list">' + list + '</div>' + form);
        m.addEventListener('click', function (e) {
            var del = e.target.closest('[data-del]'), add = e.target.closest('[data-add]');
            if (del) { var id = del.getAttribute('data-del'); S.ledger = S.ledger.filter(function (r) { return r.id !== id; }); S.data.ledger = S.ledger; persist(); ffModal(); paint(); db().from('ff_ledger').delete().eq('id', id).then(function (r) { if (r && r.error) load(cab()); }); }
            if (add) {
                var amt = parseFloat(String(m.querySelector('#nrdb-amt').value).replace(/\s/g, '').replace(',', '.')), title = m.querySelector('#nrdb-title').value.trim(), boxes = parseInt(m.querySelector('#nrdb-boxes').value, 10) || null, kind = m.querySelector('#nrdb-kind').value;
                if (!(amt >= 0) || !isFinite(amt)) { m.querySelector('#nrdb-amt').focus(); return; }
                var row = { id: 'tmp' + Date.now(), cabinet_id: cab(), kind: kind, title: title, boxes: boxes, amount: amt, entry_date: todayBishkek() };
                S.ledger = [row].concat(S.ledger); S.data.ledger = S.ledger; persist(); ffModal(); paint();
                db().from('ff_ledger').insert({ cabinet_id: row.cabinet_id, kind: kind, title: title, boxes: boxes, amount: amt, entry_date: row.entry_date }).then(function (r) { if (r && r.error) { S.ledger = S.ledger.filter(function (x) { return x.id !== row.id; }); S.data.ledger = S.ledger; persist(); paint(); say('Не получилось сохранить запись. Попробуйте ещё раз.'); } else load(cab()); });
            }
        });
    }
    function say(t) { try { if (root.NrUi) root.NrUi.alert(t); else root.alert(t); } catch (e) { /* ничего */ } }
    function persist() { try { localStorage.setItem(KEY(cab()), JSON.stringify(S.data)); } catch (e) { /* нет места */ } }
    function transitModal() {
        var T = S.data.transit, W = S.data.wb || { total: 0, n: 0, byWh: {}, list: [] };
        function draw() {
            var wbTab = S.route === 'wb';
            var items = wbTab ? [] : (T.routes[S.route] || []), by = {};
            items.forEach(function (x) { var k = (x.sent || '') + '|' + (x.cargo || ''); (by[k] = by[k] || { sent: x.sent, cargo: x.cargo, eta: x.eta, list: [] }).list.push(x); });
            var groups = Object.keys(by).map(function (k) { return by[k]; });
            var body = '<div class="tabs"><button type="button" class="tab' + (wbTab ? ' on' : '') + '" data-route="wb">Поставки WB · ' + fmt(W.total) + '</button>' + ROUTES.map(function (r) { var n = T.routes[r[0]].reduce(function (a, x) { return a + x.qty; }, 0); return '<button type="button" class="tab' + (S.route === r[0] ? ' on' : '') + '" data-route="' + r[0] + '">' + r[1] + ' · ' + fmt(n) + '</button>'; }).join('') + '</div>' +
                (wbTab ? (W.list.length ? '<div class="list">' + W.list.map(function (x) { return '<div class="li"><time>' + dm(x.created) + '</time><span>' + esc(x.warehouse) + ' · ' + esc(x.status) + ' · № ' + esc(x.id) + '</span><b>' + (x.qty ? fmt(x.qty) + ' шт' : '—') + '</b><span></span></div>'; }).join('') + '</div>' : '<div class="empty">Поставок WB в пути нет</div>') : '') +
                (groups.length ? groups.map(function (g) {
                    var sum = g.list.reduce(function (a, x) { return a + x.qty; }, 0);
                    return '<div class="sum"><div><small>Отправлено</small><b>' + (g.sent ? dm(g.sent) : '—') + '</b></div><div><small>Карго</small><b>' + esc(g.cargo || '—') + '</b></div><div><small>Ожидаем</small><b>' + (g.eta ? dm(g.eta) : 'дата не указана') + '</b></div></div><div class="list">' +
                        g.list.sort(function (a, b) { return b.qty - a.qty; }).map(function (x) { return '<div class="li"><span></span><span>' + esc(x.article) + '</span><b>' + fmt(x.qty) + ' шт</b><span></span></div>'; }).join('') + '<div class="li"><span></span><b>Итого</b><b>' + fmt(sum) + ' шт</b><span></span></div></div>';
                }).join('') : (wbTab ? '' : '<div class="empty">По этому маршруту ничего нет в пути</div>')) +
                '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><span class="hint">Партии, даты и «получено на ФФ» ведутся в Логистике. Эти же артикулы в РНП помечены «в пути».</span>' + (viewer() ? '' : '<button type="button" class="btn" data-open-log>Открыть Логистику</button>') + '</div>';
            var m = modal('Товары в пути', body);
            m.addEventListener('click', function (e) {
                var r = e.target.closest('[data-route]'); if (r) { S.route = r.getAttribute('data-route'); draw(); }
                if (e.target.closest('[data-open-log]')) { close(); try { root.showTab('goods-groups'); } catch (x) { /* вкладка недоступна */ } }
            });
        }
        S.route = W.list.length ? 'wb' : 'bishkek';
        draw();
    }

    function onClick(e) {
        var b = e.target.closest && e.target.closest('[data-nrdb]');
        var card = e.target.closest && e.target.closest('#nrdb-transit');
        if (b && b.getAttribute('data-nrdb') === 'ff') { if (S.data) ffModal(); }
        else if ((b && b.getAttribute('data-nrdb') === 'transit') || card) { if (S.data) transitModal(); }
    }
    function start() {
        var c = cab();
        if (!c) return;
        if (S.cab !== c) {
            S.cab = c; S.data = null; S.ledger = [];
            try { var raw = localStorage.getItem(KEY(c)); if (raw) { S.data = JSON.parse(raw); S.ledger = S.data.ledger || []; } } catch (e) { /* битый кэш */ }
            if (S.data) paint();
        }
        load(c);
    }
    if (doc) {
        doc.addEventListener('click', onClick);
        doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
        doc.addEventListener('cabinet-changed', function () { S.cab = ''; S.busy = false; start(); });
        var tries = 0, iv = setInterval(function () { tries++; if (cab() && doc.querySelector('.pnl-grid.ff-row')) { start(); clearInterval(iv); } else if (tries > 80) clearInterval(iv); }, 500);
        setInterval(function () { if (S.data && !doc.hidden) { ensure(); ffExtra(); } }, 2000);
        setInterval(function () { if (cab() && !doc.hidden) load(cab()); }, 10 * 60 * 1000);
    }
    root.NrDashBlocks = { wbSupplies: wbSupplies, routeOf: routeOf, transit: transit, production: production, stock: stock, nextPayout: nextPayout, lastYear: lastYear, ledgerTotals: ledgerTotals };

    // ===== Чёрно-белый график «Динамика показателей»: плавные линии, заливка, вертикаль с точкой =====
    root.NrMonoChart = function (Chart, cv, labels, series) {
        var html = document.documentElement;
        function css(n) { return getComputedStyle(html).getPropertyValue(n).trim() || '#0b0b0c'; }
        var cross = {
            id: 'nrMonoCross',
            afterDatasetsDraw: function (c) {
                var act = c.tooltip && c.tooltip.getActiveElements && c.tooltip.getActiveElements();
                if (!act || !act.length) return;
                var el = act[0].element, x = el.x, ctx = c.ctx, ink = css('--text-primary');
                ctx.save(); ctx.strokeStyle = ink; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, el.y); ctx.lineTo(x, c.chartArea.bottom); ctx.stroke();
                ctx.fillStyle = css('--surface-solid'); ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(x, el.y, 4.5, 0, 6.2832); ctx.fill(); ctx.stroke(); ctx.restore();
            },
        };
        function ds(s) {
            var ink = css('--text-primary'), mut = css('--text-muted');
            var main = s.kind === 'main';
            return { label: s.label, data: s.data, tension: 0.4, pointRadius: 0, pointHoverRadius: 0, borderWidth: main ? 3 : 2.4, borderColor: main ? ink : mut,
                borderDash: s.kind === 'dash' ? [5, 5] : [], borderCapStyle: 'round', fill: main, backgroundColor: main ? ink + '14' : 'transparent' };
        }
        var chart = new Chart(cv, {
            type: 'line', plugins: [cross],
            data: { labels: labels, datasets: series.map(ds) },
            options: {
                responsive: true, maintainAspectRatio: false, animation: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { position: 'bottom', align: 'start', labels: { usePointStyle: true, pointStyle: 'line', boxWidth: 22, boxHeight: 8, font: { size: 11.5 }, padding: 16 } },
                    tooltip: { displayColors: false, padding: 10, cornerRadius: 10, titleFont: { size: 11 }, bodyFont: { size: 12, weight: '700' },
                        callbacks: { title: function (it) { return it.length ? 'День ' + it[0].label : ''; }, label: function (it) { return it.dataset.label + ': ' + Number(it.parsed.y).toLocaleString('ru-RU'); } } },
                },
                scales: {
                    x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 11.5, weight: '600' } } },
                    y: { border: { display: false }, ticks: { font: { size: 11.5 }, callback: function (v) { return Number(v).toLocaleString('ru-RU'); } } },
                },
            },
        });
        function paint() {
            var ink = css('--text-primary'), mut = css('--text-muted'), line = css('--border');
            series.forEach(function (s, i) { var d = chart.data.datasets[i], m = s.kind === 'main'; d.borderColor = m ? ink : mut; d.backgroundColor = m ? ink + '14' : 'transparent'; });
            var o = chart.options; o.scales.x.ticks.color = mut; o.scales.y.ticks.color = mut; o.scales.y.grid = { color: line };
            o.plugins.legend.labels.color = mut; o.plugins.tooltip.backgroundColor = ink; o.plugins.tooltip.titleColor = css('--surface-solid'); o.plugins.tooltip.bodyColor = css('--surface-solid');
            chart.update('none');
        }
        paint();
        if (!root.__nrMonoChartObs && root.MutationObserver) {
            root.__nrMonoChartObs = new MutationObserver(function () { if (root.__nrMonoChartPaint) root.__nrMonoChartPaint(); });
            root.__nrMonoChartObs.observe(html, { attributes: true, attributeFilter: ['data-theme', 'class'] });
        }
        root.__nrMonoChartPaint = function () { if (chart.canvas && chart.canvas.isConnected) paint(); };
        return chart;
    };

    // Колокольчик уведомлений живёт в левом меню, рядом с настройками (решение владельца).
    function moveBell() {
        var bell = document.getElementById('nr-notify'), row = document.querySelector('.rail-bottom-icons');
        if (!bell || !row || bell.parentNode === row) return;
        var after = document.getElementById('rail-settings-btn');
        row.insertBefore(bell, after ? after.nextSibling : row.firstChild);
        bell.classList.add('nr-notify--rail');
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', moveBell); else moveBell();
})(typeof window !== 'undefined' ? window : this);

/* «Пульт РК»: список кампаний, где ставку, товары и новую кампанию меняют без ожидания.
 * Изменение сразу видно на сайте, в WB его отправляет очередь adv_ops (функция adv-ops-run, повторы и догон по cron).
 * Данные берёт у AdsHQ (ads-command-center.js), в WB сам не ходит. */
(function (root) {
    'use strict';
    var doc = root.document;

    /* ───────── чистые функции (проверяются тестами) ───────── */
    function payKind(camp) { return String((camp && camp.paymentType) || '').toLowerCase() === 'cpc' ? 'cpc' : 'cpm'; }
    function kopToSom(k) { return Math.round(Number(k) || 0) / 100; }
    function somToKop(s) { return Math.round((Number(s) || 0) * 100); }
    function stepSom(kind) { return kind === 'cpc' ? 1 : 5; }
    function clampKop(kop, minKop, maxKop) {
        var lo = Math.max(100, Number(minKop) || 100), hi = Math.min(5000000, Number(maxKop) || 5000000);
        var v = Math.round(Number(kop) || 0);
        return Math.max(lo, Math.min(hi, v));
    }
    function badge(kind, size) {
        var m = kind === 'cpc' ? 'C' : 'M';
        return '<span class="adp2-ty ' + (size || '') + '" title="' + (kind === 'cpc' ? 'Оплата за клик' : 'Оплата за 1000 показов') +
            '">CP<i class="adp2-k' + m.toLowerCase() + '">' + m + '</i></span>';
    }
    function fmtSom(v) {
        var n = Number(v) || 0;
        return (Math.abs(n - Math.round(n)) < 0.005 ? String(Math.round(n)) : n.toFixed(2)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    }
    function unitText(kind) { return kind === 'cpc' ? 'сом за клик' : 'сом за 1000 показов'; }

    /** Ставки и товары кампании из ответа advert_get_bids (форма ответа WB гуляет, поэтому ищем везде, где она бывает). */
    function parseAdvertInfo(res) {
        var advert = (res && res.advert) || {};
        var bids = Array.isArray(res && res.bids) ? res.bids : [];
        var entries = bids.map(function (b) {
            return { nm: Number(b.nm_id != null ? b.nm_id : b.nmId), placement: String(b.placement || 'search'), kop: Number(b.bid_kopecks != null ? b.bid_kopecks : b.bid) || 0 };
        }).filter(function (e) { return e.nm > 0; });
        if (!entries.length) {
            // v2/adverts: ставки лежат в nm_settings[].bids_kopecks.{search,recommendations}, уже в копейках
            [advert.nm_settings, (advert.settings || {}).nm_settings].forEach(function (list) {
                (Array.isArray(list) ? list : []).forEach(function (n) {
                    var id = Number(n && (n.nm_id != null ? n.nm_id : n.nmId)), bk = (n && (n.bids_kopecks || n.bidsKopecks)) || {};
                    if (!(id > 0)) return;
                    ['search', 'recommendations'].forEach(function (pl) {
                        var v = Number(bk[pl]); if (v > 0) entries.push({ nm: id, placement: pl, kop: Math.round(v) });
                    });
                });
            });
        }
        var set = {};
        function add(v) {
            if (!Array.isArray(v)) return;
            v.forEach(function (x) {
                var id = typeof x === 'object' && x ? Number(x.nm || x.nmId || x.nm_id || x.id) : Number(x);
                if (id > 0) set[id] = 1;
            });
        }
        var st = advert.settings || {};
        [advert.nms, st.nms, advert.nm_ids, st.nm_ids, advert.nm_settings, st.nm_settings].forEach(add);
        [advert.unitedParams, advert.united_params, advert.params, advert.autoParams].forEach(function (l) {
            (Array.isArray(l) ? l : l ? [l] : []).forEach(function (p) { add(p && (p.nms || p.nmIds || p.nm_ids)); });
        });
        entries.forEach(function (e) { set[e.nm] = 1; });
        var nms = Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
        return { entries: entries, nms: nms, bidType: String(res && res.bidType || advert.bid_type || '').toLowerCase() };
    }

    /** Применяет к базовому списку то, что пользователь уже поменял на экране, но ещё не подтвердила очередь. */
    function effectiveNms(base, ov) {
        var del = (ov && ov.del) || {}, add = (ov && ov.add) || {};
        var out = (base || []).filter(function (n) { return !del[n]; });
        Object.keys(add).forEach(function (n) { n = Number(n); if (out.indexOf(n) < 0) out.push(n); });
        return out;
    }

    /* ───────── состояние ───────── */
    var S = { bal: {}, cw: {},
        deps: null, rows: [], open: {}, tab: {}, info: {}, ov: {}, ops: {}, timers: {}, arts: {}, virtual: [],
        view: 'pulse', kw: {}, kwOps: {}, kwBusy: false, kwTab: {}, polling: 0, queue: [], qBusy: false, toastTimer: 0, undo: null,
    };
    function db() { return S.deps && S.deps.supabase; }
    function call(action, params, cab) { return S.deps.callWbProxy(action, params, cab); }
    function esc(s) { return S.deps && S.deps.escapeHtml ? S.deps.escapeHtml(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
    function $(id) { return doc.getElementById(id); }
    function keyOf(cab, camp) { return cab.id + ':' + camp.wbId; }
    function findCamp(key) {
        for (var i = 0; i < S.rows.length; i++) for (var j = 0; j < S.rows[i].campaigns.length; j++) {
            var c = S.rows[i].campaigns[j];
            if (keyOf(S.rows[i], c) === key) return { cab: S.rows[i], camp: c };
        }
        return null;
    }
    function ovOf(key) { return S.ov[key] || (S.ov[key] = { bid: {}, add: {}, del: {}, paused: null }); }

    /* ───────── ставки: что показывать ───────── */
    function entriesOf(key, camp) {
        var info = S.info[key];
        var base = info && info.loaded ? info.entries : (camp.currentBids || []).map(function (b) {
            return { nm: Number(b.nm_id), placement: String(b.placement || 'search'), kop: Number(b.bid_kopecks) || 0 };
        }).filter(function (e) { return e.nm > 0; });
        var ov = S.ov[key];
        return base.map(function (e) {
            var o = ov && ov.bid[e.nm + ':' + e.placement];
            return o != null ? { nm: e.nm, placement: e.placement, kop: o, changed: true } : e;
        });
    }
    function minKop(key, nm) { var i = S.info[key]; return (i && i.min && i.min[nm]) || 100; }
    function mainEntry(key, camp) {
        var list = entriesOf(key, camp);
        if (!list.length) return null;
        return list.filter(function (e) { return e.placement === 'search' || e.placement === 'combined'; })[0] || list[0];
    }

    /* ───────── загрузка данных кампании (лениво, по одной) ───────── */
    function ensureInfo(key) {
        var f = findCamp(key); if (!f) return Promise.resolve();
        var inf = S.info[key] || (S.info[key] = { loaded: false, loading: false, entries: [], nms: [], min: {} });
        if (inf.loaded || inf.loading) return inf.promise || Promise.resolve();
        inf.loading = true;
        inf.promise = call('advert_get_bids', { advertId: f.camp.wbId }, f.cab.id).then(function (res) {
            var p = parseAdvertInfo(res);
            inf.entries = p.entries; inf.nms = p.nms; inf.bidType = p.bidType;
            inf.loaded = true; inf.loading = false;
            var ids = p.nms.slice(0, 50);
            if (!ids.length) return null;
            var placement = (p.bidType === 'manual') ? 'search' : 'combined';
            return call('advert_bids_min', { advertId: f.camp.wbId, nmIds: ids, placement: placement }, f.cab.id).then(function (m) {
                (m && m.bids || []).forEach(function (b) {
                    var nm = Number(b.nm_id != null ? b.nm_id : b.nmId), k = Number(b.bid_kopecks != null ? b.bid_kopecks : b.bid) || 0;
                    if (nm && k) inf.min[nm] = k;
                });
                if (!inf.entries.length) {
                    inf.entries = ids.filter(function (n) { return inf.min[n]; }).map(function (n) { return { nm: n, placement: placement, kop: inf.min[n], isMin: true }; });
                }
            }).catch(function () { /* минимальные ставки не критичны */ });
        }).catch(function (e) {
            inf.loaded = false; inf.loading = false; inf.error = String((e && e.message) || e || 'ошибка');
        }).then(function () { inf.loading = false; patchRow(key); });
        return inf.promise;
    }
    function enqueueInfo(keys) {
        keys.forEach(function (k) { if (S.queue.indexOf(k) < 0) S.queue.push(k); });
        if (S.qBusy) return;
        S.qBusy = true;
        (function next() {
            var k = S.queue.shift();
            if (!k) { S.qBusy = false; return; }
            var inf = S.info[k];
            if (inf && (inf.loaded || inf.loading)) return next();
            ensureInfo(k).then(function () { setTimeout(next, 450); });
        })();
    }

    /* ───────── очередь в WB ───────── */
    function setOp(id, patch) { S.ops[id] = Object.assign(S.ops[id] || {}, patch); }
    function opsFor(key) { return Object.keys(S.ops).map(function (id) { return S.ops[id]; }).filter(function (o) { return o.key === key; }); }

    function enqueue(key, cabId, advertId, kind, payload, meta) {
        var tmp = 't' + Math.random().toString(36).slice(2);
        setOp(tmp, { key: key, cab: cabId, kind: kind, payload: payload, status: 'saving', meta: meta || {}, advertId: advertId, tries: 0 });
        send(tmp);
        if (key) patchRow(key);
        return tmp;
    }
    function send(tmp) {
        var o = S.ops[tmp]; if (!o) return;
        o.status = 'saving';
        Promise.resolve(db().from('adv_ops').insert({ cabinet_id: o.cab, advert_id: o.advertId, kind: o.kind, payload: o.payload }).select('id')).then(function (r) {
            if (r.error || !r.data || !r.data[0]) throw new Error((r.error && r.error.message) || 'не записалось');
            var id = r.data[0].id;
            S.ops[id] = Object.assign({}, o, { status: 'pending', id: id }); delete S.ops[tmp];
            run(o.cab, [id]); watch();
            if (o.key) patchRow(o.key);
        }).catch(function (e) {
            o.tries = (o.tries || 0) + 1;
            if (o.tries < 3) { setTimeout(function () { send(tmp); }, 1500 * o.tries); return; }
            o.status = 'error'; o.err = 'Не удалось сохранить: ' + String((e && e.message) || e);
            if (o.key) patchRow(o.key);
        });
    }
    function run(cabId, ids) {
        try {
            Promise.resolve(db().functions.invoke('adv-ops-run', { body: { cabinet_id: cabId, ids: ids } })).then(function () { checkOps(); }).catch(function () { /* догонит cron */ });
        } catch (e) { /* догонит cron */ }
    }
    function checkOps() {
        var ids = Object.keys(S.ops).filter(function (id) { var s = S.ops[id].status; return id.charAt(0) !== 't' && (s === 'pending'); });
        if (!ids.length) return Promise.resolve();
        return Promise.resolve(db().from('adv_ops').select('id,status,last_error,result,advert_id,attempts').in('id', ids)).then(function (r) {
            (r.data || []).forEach(function (row) {
                var o = S.ops[row.id]; if (!o) return;
                if (row.status === 'done') { o.status = 'done'; o.doneAt = Date.now(); applyDone(o, row); }
                else if (row.status === 'error') { o.status = 'error'; o.err = row.last_error || 'WB не принял изменение'; }
                else { o.note = row.last_error || ''; }
                if (o.key) patchRow(o.key);
            });
            if (S.virtualPatch) S.virtualPatch();
        }).catch(function () { /* следующий опрос */ });
    }
    function applyDone(o, row) {
        var inf = o.key && S.info[o.key];
        if (o.kind === 'set_bid' && inf) {
            var e = inf.entries.filter(function (x) { return x.nm === Number(o.payload.nm_id) && x.placement === (o.payload.placement || 'search'); })[0];
            if (e) { e.kop = Number(o.payload.bid_kopecks); e.isMin = false; }
            var ov = S.ov[o.key]; if (ov) delete ov.bid[o.payload.nm_id + ':' + (o.payload.placement || 'search')];
        }
        if ((o.kind === 'add_nm' || o.kind === 'remove_nm') && inf) {
            var nms = o.payload.nms || [], ov2 = S.ov[o.key];
            nms.forEach(function (n) {
                if (o.kind === 'add_nm') { if (inf.nms.indexOf(n) < 0) inf.nms.push(n); if (ov2) delete ov2.add[n]; }
                else { inf.nms = inf.nms.filter(function (x) { return x !== n; }); inf.entries = inf.entries.filter(function (x) { return x.nm !== n; }); if (ov2) delete ov2.del[n]; }
            });
        }
        if (o.kind === 'create') {
            var id = row.result && row.result.advert_id;
            toast('Кампания «' + esc(o.payload.name) + '» создана в WB' + (id ? ' (№ ' + id + ')' : ''), null);
            setTimeout(function () { if (root.AdsHQ && root.AdsHQ.load) root.AdsHQ.load(); }, 1500);
        }
    }
    function watch() {
        if (S.polling) return;
        S.polling = setInterval(function () {
            var live = Object.keys(S.ops).some(function (id) { return S.ops[id].status === 'pending' || S.ops[id].status === 'saving'; });
            checkOps();
            if (!live) { clearInterval(S.polling); S.polling = 0; }
        }, 3500);
    }

    /* ───────── действия пользователя ───────── */
    function applyBid(key, nm, placement, kop, opts) {
        var f = findCamp(key); if (!f) return;
        var v = clampKop(kop, minKop(key, nm));
        var ov = ovOf(key), id = nm + ':' + placement;
        var cur = (entriesOf(key, f.camp).filter(function (e) { return e.nm === nm && e.placement === placement; })[0] || {}).kop;
        if (cur === v) { refreshBid(key); return; }
        var base = (S.info[key] && S.info[key].entries.filter(function (e) { return e.nm === nm && e.placement === placement; })[0]) || {};
        if (S.last == null || S.last.key !== key || S.last.id !== id || Date.now() - S.last.t > 8000) S.last = { key: key, id: id, nm: nm, placement: placement, from: base.kop != null ? base.kop : cur, t: Date.now() };
        S.last.t = Date.now();
        ov.bid[id] = v;
        refreshBid(key);
        clearTimeout(S.timers[key + '|' + id]);
        S.timers[key + '|' + id] = setTimeout(function () { flushBid(key, nm, placement); }, (opts && opts.now) ? 0 : 700);
    }
    function flushBid(key, nm, placement) {
        var f = findCamp(key), ov = S.ov[key]; if (!f || !ov) return;
        var kop = ov.bid[nm + ':' + placement]; if (kop == null) return;
        var prev = S.last && S.last.key === key ? S.last.from : null;
        S.last = null;
        enqueue(key, f.cab.id, f.camp.wbId, 'set_bid', { nm_id: nm, bid_kopecks: kop, placement: placement }, { prev: prev });
        if (prev != null && prev !== kop) toast('Ставка ' + fmtSom(kopToSom(prev)) + ' → ' + fmtSom(kopToSom(kop)), { label: 'Отменить', fn: function () { applyBid(key, nm, placement, prev, { now: true }); S.last = null; } });
    }
    function removeProduct(key, nm) {
        var f = findCamp(key); if (!f) return;
        var info = S.info[key]; var cur = effectiveNms(info ? info.nms : [], S.ov[key]);
        if (cur.length <= 1) { toast('В кампании должен остаться хотя бы один товар', null); return; }
        ovOf(key).del[nm] = 1; patchRow(key);
        var t = setTimeout(function () {
            if (!S.ov[key] || !S.ov[key].del[nm]) return;
            enqueue(key, f.cab.id, f.camp.wbId, 'remove_nm', { nms: [nm] });
        }, 5000);
        toast('Товар убран из кампании', { label: 'Вернуть', fn: function () { clearTimeout(t); delete S.ov[key].del[nm]; patchRow(key); } });
    }
    function addProducts(key, nms) {
        var f = findCamp(key); if (!f || !nms.length) return;
        var cur = effectiveNms(S.info[key] ? S.info[key].nms : [], S.ov[key]);
        if (cur.length + nms.length > 50) { toast('В кампании не больше 50 товаров', null); return; }
        var ov = ovOf(key); nms.forEach(function (n) { ov.add[n] = 1; });
        enqueue(key, f.cab.id, f.camp.wbId, 'add_nm', { nms: nms });
        toast('Добавлено товаров: ' + nms.length + '. WB поставит минимальную ставку', null);
    }
    function togglePause(key) {
        var f = findCamp(key); if (!f) return;
        var ov = ovOf(key), live = ov.paused == null ? f.camp.live : !ov.paused;
        var verb = live ? 'advert_pause' : 'advert_start';
        ov.paused = live; patchRow(key);
        Promise.resolve(call(verb, { advertId: f.camp.wbId }, f.cab.id)).then(function () {
            setTimeout(function () { if (root.AdsHQ && root.AdsHQ.load) root.AdsHQ.load(); }, 2500);
        }).catch(function (e) {
            ov.paused = null; patchRow(key);
            toast(String((e && e.message) || e || 'Не удалось изменить статус'), null);
        });
    }
    function retryOps(key) {
        opsFor(key).filter(function (o) { return o.status === 'error'; }).forEach(function (o) {
            Object.keys(S.ops).forEach(function (id) { if (S.ops[id] === o) delete S.ops[id]; });
            enqueue(key, o.cab, o.advertId, o.kind, o.payload, o.meta);
        });
    }
    function dropOps(key) {
        var ov = S.ov[key];
        opsFor(key).filter(function (o) { return o.status === 'error'; }).forEach(function (o) {
            Object.keys(S.ops).forEach(function (id) { if (S.ops[id] === o) delete S.ops[id]; });
            if (ov && o.kind === 'set_bid') delete ov.bid[o.payload.nm_id + ':' + (o.payload.placement || 'search')];
            if (ov && o.kind === 'add_nm') o.payload.nms.forEach(function (n) { delete ov.add[n]; });
            if (ov && o.kind === 'remove_nm') o.payload.nms.forEach(function (n) { delete ov.del[n]; });
        });
        patchRow(key);
    }

    /* ───────── отрисовка ───────── */
    function artsOf(cabId) {
        if (S.arts[cabId]) return S.arts[cabId].promise || Promise.resolve(S.arts[cabId]);
        var rec = S.arts[cabId] = { list: [], by: {}, loaded: false };
        rec.promise = Promise.resolve(db().from('rnp_articles').select('nm_id,name,photo_url,is_active,manual_data').eq('cabinet_id', cabId).range(0, 1999)).then(function (r) {
            rec.list = (r.data || []).filter(function (a) { return a.is_active !== false; });
            rec.list.forEach(function (a) { rec.by[a.nm_id] = a; });
            rec.loaded = true; return rec;
        }).catch(function () { rec.loaded = true; return rec; }).then(function () {
            return Promise.resolve(db().from('wb_stocks').select('nm_id,quantity').eq('cabinet_id', cabId).range(0, 4999)).then(function (r) {
                var st = {}; (r.data || []).forEach(function (x) { st[x.nm_id] = (st[x.nm_id] || 0) + (Number(x.quantity) || 0); }); rec.stock = st;
            }).catch(function () { /* остатки не критичны */ }).then(function () { return rec; });
        });
        return rec.promise;
    }
    function artName(cabId, nm) { var a = S.arts[cabId] && S.arts[cabId].by[nm]; return a ? (a.name || ('Артикул ' + nm)) : 'Артикул ' + nm; }
    function artPhoto(cabId, nm) { var a = S.arts[cabId] && S.arts[cabId].by[nm]; return (a && a.photo_url) || ''; }
    function thumb(cabId, nm, cls) {
        var p = artPhoto(cabId, nm);
        return '<i class="adp2-th ' + (cls || '') + '"' + (p ? ' style="background-image:url(\'' + esc(p) + '\')"' : '') + '></i>';
    }

    function chipHtml(key) {
        var ops = opsFor(key), err = ops.filter(function (o) { return o.status === 'error'; });
        if (err.length) {
            return '<span class="adp2-chip bad" data-chip="1">⚠ ' + esc(err[0].err || 'ошибка') + ' <button type="button" data-pact="retry" data-key="' + esc(key) + '">Повторить</button> <button type="button" data-pact="drop" data-key="' + esc(key) + '">Отменить</button></span>';
        }
        if (ops.some(function (o) { return o.status === 'saving' || o.status === 'pending'; })) return '<span class="adp2-chip wait">В WB отправляется…</span>';
        if (ops.some(function (o) { return o.status === 'done' && Date.now() - (o.doneAt || 0) < 4000; })) return '<span class="adp2-chip ok">✓ В WB</span>';
        return '';
    }
    function campWord(n) { var m = n % 10, h = n % 100; return m === 1 && h !== 11 ? 'кампания' : (m >= 2 && m <= 4 && (h < 12 || h > 14)) ? 'кампании' : 'кампаний'; }
    function drrOf(camp) {
        var sp = Number(camp.spendToday) || 0, rev = Number(camp.revenue7) || 0;
        return rev > 0 ? sp / rev * 100 : null;
    }
    function fmtInt(v) { return Math.round(Number(v) || 0).toLocaleString('ru-RU').replace(/\u00a0/g, ' '); }
    /* Расход, заказы и ДРР за выбранный период прямо в строке */
    function balOf(key, camp) {
        var o = S.bal && S.bal[key];
        if (o != null) return o;
        return camp.budget == null || !isFinite(Number(camp.budget)) ? null : Number(camp.budget);
    }
    function balHtml(key, camp) {
        var b = balOf(key, camp), low = b != null && b < 300;
        return '<button type="button" class="adp2-bal' + (low ? ' low' : '') + '" data-pact="topup" data-key="' + esc(key) + '" title="Баланс кампании. Нажмите, чтобы пополнить">' +
            '<b class="' + (low ? 'bad' : '') + '">' + (b == null ? '—' : '<span class="adp2-bn">' + fmtInt(b) + '</span><span class="adp2-cur"> ₽</span>') + '</b><i>+</i></button>';
    }
    function bidControlHtml(key, camp, kind) {
        var inf = S.info[key], list = entriesOf(key, camp);
        if (String(camp.bidType).toLowerCase() === 'unified' && !list.length && !(inf && inf.loaded)) {
            return inf && inf.loading ? '<span class="adp2-skel"></span>' : '<button type="button" class="adp2-load" data-pact="load" data-key="' + esc(key) + '">Показать ставку</button>';
        }
        if (!list.length) return inf && inf.loading ? '<span class="adp2-skel"></span>' : (inf && inf.error ? '<span class="adp2-mut">ставка недоступна</span>' : '<button type="button" class="adp2-load" data-pact="load" data-key="' + esc(key) + '">Показать ставку</button>');
        return '<button type="button" class="adp2-range" data-pact="open" data-key="' + esc(key) + '">' + rangeText(list) + '</button>';
    }
    function rangeText(list) {
        var nmSet = {}; list.forEach(function (e) { nmSet[e.nm] = 1; });
        var vals = list.map(function (e) { return e.kop; }), lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
        var n = Object.keys(nmSet).length;
        return '<b>' + fmtSom(kopToSom(lo)) + (hi !== lo ? '–' + fmtSom(kopToSom(hi)) : '') + '</b> ₽' + (n > 1 ? ' · ' + n + ' тов.' : '');
    }
    /* Фото главного товара РК (самая высокая ставка); без фото остаётся значок типа оплаты */
    function mainPhotoHtml(cab, camp, kind) {
        var url = (camp.mainNm && artPhoto(cab.id, camp.mainNm)) || camp.photoUrl || '';
        var img = url
            ? '<img class="adp2-mph" src="' + esc(url) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement(\'i\'),{className:\'adp2-mph\'}))">'
            : '<i class="adp2-mph"></i>';
        /* Тип оплаты (СРС / СРМ) маленькой меткой на углу фото */
        return '<span class="adp2-ph">' + img + badge(kind, 's') + '</span>';
    }
    function mainLine(cab, camp, nmCount) {
        var t = camp.mainNm ? (camp.mainTitle || artName(cab.id, camp.mainNm)) : '';
        if (!t || (nmCount || 0) < 2) return '';
        return '<small class="adp2-main">главный: ' + esc(t) + '</small>';
    }
    /* Ползунок: 0 — выкл, 1 — включена, A — автопилот */
    function switchHtml(key, camp, live) {
        var AS = root.AdvShelves, kp = String(key).split(':');
        var pos = !live ? 0 : ((camp.auto || (AS && AS.has(kp[0], kp[1]))) ? 2 : 1);
        var IC = ['<path d="M12 3v8M6.3 6.8a8 8 0 1 0 11.4 0"/>', '<path d="M8 5.5v13l11-6.5z"/>', '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>'];
        function b(n, l, t) { return '<button type="button" data-pact="pos" data-pos="' + n + '" data-key="' + esc(key) + '" class="' + (pos === n ? 'on' : '') + '" aria-pressed="' + (pos === n) + '" aria-label="' + t + '" title="' + t + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + IC[n] + '</svg></button>'; }
        return '<div class="adp2-sl p' + pos + '" role="group" aria-label="Режим кампании">' + b(0, '0', 'Выключена') + b(1, '1', 'Включена') + b(2, 'A', 'Автопилот сам ведёт ставки') + '</div>';
    }
    /* Таблица на широком экране: тип кампании меткой и остальные колонки метрик справа (на телефоне прячутся CSS) */
    function bidWord(camp) { var b = String(camp.bidType || '').toLowerCase(); return b === 'unified' ? 'единая' : (b === 'manual' ? 'ручная' : ''); }
    function typeCellHtml(camp, kind) {
        var w = bidWord(camp);
        return '<div class="adp2-ty"><span class="adp2-tag2">' + (kind === 'cpc' ? 'CPC' : 'CPM') + (w ? ' · ' + w : '') + '</span></div>';
    }
    function tableCols() {
        var A = root.AdsHQ, all = A && A.COL_PRESETS && A.COL_PRESETS.all ? A.COL_PRESETS.all.cols : [];
        return all.filter(function (c) { return c.key !== 'budget'; });
    }
    var SHORT = { spend: 'Затраты', views: 'Показы', ctr: 'CTR', orders: 'Заказы', drr: 'Доля', pos: 'Позиция', clicks: 'Клики', atbs: 'Корзина', revenue: 'Сумма', cpc: 'CPC', cpo: 'CPO', cr: 'CR', cpm: 'CPM', roas: 'ROAS' };
    function metricCellsHtml(camp) {
        var A = root.AdsHQ;
        var cell = function (c) { return '<div class="adp2-mc" data-l="' + esc(SHORT[c.key] || c.title) + '">' + esc(A && A.formatMetric ? A.formatMetric(camp, c.key) : '—') + '</div>'; };
        var cols = tableCols();
        /* На телефоне первые пять цифр сеткой, остальные в строке со свайпом; на ПК обе обёртки прозрачны */
        return '<div class="adp2-mx"><div class="adp2-m5">' + cols.slice(0, 5).map(cell).join('') + '</div><div class="adp2-mmore">' + cols.slice(5).map(cell).join('') + '</div></div>';
    }
    function headerHtml() {
        var A = root.AdsHQ, all = A && A.COL_PRESETS && A.COL_PRESETS.all ? A.COL_PRESETS.all.cols : [];
        var tip = function (t, x) { return '<div class="' + x + ' adp2-tip" data-tip="' + esc(t || '') + '"><span>'; };
        return '<div class="adp2-hd" data-key="hd" aria-hidden="true">' +
            tip('Выключена, включена или автопилот сам ведёт ставки.', 'adp2-hpos') + 'Режим</span></div>' +
            tip('Название, номер и статус кампании.', 'adp2-hnm') + 'Кампания</span></div>' +
            tip('Как оплачивается реклама (CPM за показы, CPC за клики) и как ведётся ставка.', 'adp2-ty') + 'Тип</span></div>' +
            all.map(function (c) { return tip(c.tip, c.key === 'budget' ? 'adp2-hbal' : 'adp2-mc') + esc(c.title) + '</span></div>'; }).join('') +
            '</div>';
    }
    /* Окно кампании — в верхнем слое браузера (popover): оно открывается поверх страницы, что бы ни стояло у родительских блоков
       (раньше при некоторых состояниях страницы оно «прилипало» к таблице и раскрывалось внутри неё). Без поддержки остаётся fixed в CSS. */
    var CAN_POP = !!(root.HTMLElement && root.HTMLElement.prototype && typeof root.HTMLElement.prototype.showPopover === 'function');
    function showModals() {
        if (!CAN_POP) return;
        var host = $('adv-pulse'); if (!host) return;
        Array.prototype.forEach.call(host.querySelectorAll('.adp2-row.open > .adp2-body[popover]'), function (b) {
            try { if (!b.matches(':popover-open')) b.showPopover(); } catch (e) { /* остаётся fixed из CSS */ }
        });
    }
    /* ───────── окно кампании ───────── */
    /* Новые действия идут через root.AdvCtl (его пишет другой модуль). Нет модуля или метода: контрол виден, но неактивен. */
    function hasCtl(name) { var C = root.AdvCtl; return !!(C && typeof C[name] === 'function'); }
    function ctlState(key) { var C = root.AdvCtl; return C && typeof C.getState === 'function' ? (C.getState(key) || null) : null; }
    /* Если AdvCtl знает, что WB не умеет это делать (supports[name] === false), контрол неактивен и объясняет почему */
    function offText(name) {
        var C = root.AdvCtl;
        if (!C || typeof C[name] !== 'function') return 'Пока недоступно';
        if (C.supports && C.supports[name] === false) return (C.unsupportedText && C.unsupportedText[name]) || 'Пока недоступно';
        return '';
    }
    function offAttr(name) { var t = offText(name); return t ? ' disabled title="' + esc(t) + '"' : ''; }
    function ctlOk(name) { return !offText(name); }
    function fmtMoney(v) { var p = (Number(v) || 0).toFixed(2).split('.'); return p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + '.' + p[1]; }
    var LIMIT_MIN_SOM = 1200;
    function cwOf(key) { return S.cw[key] || (S.cw[key] = {}); }
    function pick(a, b) { return a != null ? a : b; }
    function limitState(key, camp) {
        var o = cwOf(key), l = camp.limit || {};
        return {
            on: !!pick(o.limitOn, l.on), kop: pick(o.limitKop, l.amountKop != null ? Number(l.amountKop) : null),
            carry: !!pick(o.carry, l.carryOver), known: o.limitOn != null || camp.limit != null
        };
    }
    function refillState(key, camp) { var o = cwOf(key); return !!pick(o.refill, camp.autoRefill); }
    /* Зоны: из camp.zones, иначе по тому, для каких зон у товаров есть ставки; пока ничего не известно, null (нейтрально) */
    function zonesState(key, camp) {
        var cs = ctlState(key), o = (cs && cs.zones) || {}, z = camp.zones || camp.placements || null, res = { search: null, recommendations: null };
        if (z) { ['search', 'recommendations'].forEach(function (k) { if (z[k] != null) res[k] = !!z[k]; }); }
        else {
            var list = entriesOf(key, camp);
            if (list.length) {
                res.search = list.some(function (e) { return e.placement === 'search' || e.placement === 'combined' || (e.placement !== 'recommendations'); });
                res.recommendations = list.some(function (e) { return e.placement === 'recommendations'; });
            }
        }
        ['search', 'recommendations'].forEach(function (k) { if (o[k] != null) res[k] = o[k]; });
        return res;
    }
    function ico(path) { return '<svg class="cw-ico" viewBox="0 0 24 24" aria-hidden="true">' + path + '</svg>'; }
    var IC = {
        pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/>', pause: '<path d="M9 5v14M15 5v14"/>', play: '<path d="M8 5.5v13l11-6.5z"/>',
        hist: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3.5 4.5v4h4M12 8v4l3 2"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
        bars: '<path d="M6 20V10M12 20V4M18 20v-7"/>', tag: '<path d="M4 20l5-5M14 4l6 6-9 9-6-6z"/>'
    };
    function qHtml(t) { return '<span class="cw-q" title="' + esc(t) + '">?</span>'; }
    function swHtml(on, pact, key, extra, label, name) {
        var dis = name && typeof name === 'object' ? ' disabled title="' + esc(name.off) + '"' : (name === false ? ' disabled title="Пока недоступно"' : (name ? offAttr(name) : ''));
        return '<button type="button" class="cw-tg' + (on ? ' on' : '') + '" role="switch" aria-checked="' + (on == null ? 'mixed' : !!on) + '" aria-label="' + esc(label) + '" data-ctl="1" data-pact="' + pact + '" data-key="' + esc(key) + '"' + (extra || '') + dis + '></button>';
    }
    function headHtml(key, camp, kind, live) {
        var cs0 = ctlState(key), fin = !!(cs0 && (cs0.finished || cs0.finishing)), finDone = !!(cs0 && cs0.finished);
        var cs = ctlState(key), created = (cs && cs.createdAt) || camp.createdAt || camp.wbCreatedAt || camp.created_at || '';
        if (created) { var d = new Date(created); if (!isNaN(d)) created = ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + d.getFullYear() + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
        return '<div class="cw-hd"><div class="cw-ttl"><h2 class="cw-h2"><span class="cw-name">' + esc(camp.name) + '</span>' +
            '<button type="button" class="cw-pen" data-ctl="1" data-pact="rename" data-key="' + esc(key) + '" aria-label="Переименовать"' + (hasCtl('rename') ? '' : ' disabled title="Пока недоступно"') + '>' + ico(IC.pen) + '</button></h2>' +
            '<div class="cw-chips"><span class="cw-chip' + (live && !fin ? ' on' : '') + '">' + (fin ? (finDone ? 'Завершена' : 'Завершается…') : (live ? 'Активна' : 'Приостановлена')) + '</span><span class="cw-chip">' + (kind === 'cpc' ? 'CPC' : 'CPM') + '</span>' +
            '<button type="button" class="cw-id" data-pact="copyid" data-id="' + esc(camp.wbId) + '" title="Скопировать номер">ID ' + esc(camp.wbId) + ' ⧉</button>' + (created ? '<span class="cw-date">' + esc(created) + '</span>' : '') + '</div></div>' +
            '<div class="cw-act"><a class="cw-lnk" href="https://dev.wildberries.ru/openapi/promotion" target="_blank" rel="noopener">Инструкция</a>' +
            '<button type="button" data-pact="toggle" data-key="' + esc(key) + '" class="cw-btn k adp2-tg"' + (fin ? ' disabled' : '') + '>' + ico(live ? IC.pause : IC.play) + (live ? 'Приостановить' : 'Запустить') + '</button>' +
            '<button type="button" class="cw-btn" data-ctl="1" data-pact="finish" data-key="' + esc(key) + '"' + (fin ? ' disabled' : offAttr('finish')) + '>Завершить</button>' +
            '<button type="button" class="cw-btn sq" data-pact="hist" data-key="' + esc(key) + '" title="История" aria-label="История"' + (hasCtl('history') ? '' : ' disabled title="Пока недоступно"') + '>' + ico(IC.hist) + '</button></div>' +
            '<button type="button" class="cw-x" data-pact="open" data-key="' + esc(key) + '" aria-label="Закрыть">' + ico(IC.x) + '</button></div>';
    }
    function budgetCardsHtml(key, camp) {
        var b = balOf(key, camp), lim = limitState(key, camp), refill = refillState(key, camp);
        var min = LIMIT_MIN_SOM, lv = lim.kop != null && lim.kop > 0 ? String(kopToSom(lim.kop)) : '';
        return '<div class="cw-grid2"><section class="cw-card"><h3>Остаток бюджета</h3>' +
            '<div class="cw-lab cw-bal"><span class="cw-big">' + (b == null ? '—' : fmtMoney(b)) + '<small>KGS</small></span>' +
            '<button type="button" class="cw-btn sm" data-pact="topup" data-key="' + esc(key) + '">＋ Пополнить</button>' +
            '<span class="cw-lab">' + swHtml(refill, 'refill', key, '', 'Автопополнение бюджета', 'setAutoRefill') + 'Автопополнение бюджета ' + qHtml('Бюджет сам пополнится, когда деньги на кампании заканчиваются') + '</span></div></section>' +
            '<section class="cw-card"><div class="cw-lim"><div class="cw-col">' +
            '<div class="cw-lab">' + swHtml(lim.on, 'limit', key, '', 'Дневной лимит', 'setLimit') + '<h3>Дневной лимит</h3>' + qHtml('Сумма, больше которой кампания не потратит за сутки') + '</div>' +
            '<label class="cw-inp' + (lim.on ? ' live' : '') + '"><input type="text" inputmode="decimal" class="cw-limit-in" data-key="' + esc(key) + '" value="' + esc(lv) + '" placeholder="Задайте от ' + min + '" aria-label="Дневной лимит"' + (lim.on && ctlOk('setLimit') ? '' : ' disabled') + '><span>KGS</span></label>' +
            '<label class="cw-lab cw-cbl"><button type="button" class="cw-cb' + (lim.carry ? ' on' : '') + '" role="checkbox" aria-checked="' + lim.carry + '" data-ctl="1" data-pact="carry" data-key="' + esc(key) + '"' + (lim.on && ctlOk('setLimit') ? '' : ' disabled') + '></button>Переносить неистраченные деньги ' + qHtml('Неистраченная за день сумма добавится к лимиту следующего дня') + '</label></div>' +
            '<div class="cw-hint">Равномерно распределим сумму в течение суток</div></div></section></div>';
    }
    function zonesHtml(key, camp, kind) {
        var z = zonesState(key, camp), C = root.AdvCtl, allowed = true;
        try { if (C && typeof C.zonesAllowed === 'function') allowed = C.zonesAllowed(Object.assign({}, ctlState(key) || {}, { paymentType: camp.paymentType, bidType: (S.info[key] && S.info[key].bidType) || camp.bidType })); } catch (e) { allowed = true; }
        var lock = !allowed ? { off: (C.unsupportedText && C.unsupportedText.zonesCpc) || 'Пока недоступно' } : 'setZones';
        function one(k, t) {
            var on = z[k];
            return '<div class="cw-zone' + (on === false ? ' off' : '') + '"><span class="cw-lab">' + swHtml(on, 'zone', key, ' data-zone="' + k + '"', t, lock) + t + '</span><span class="cw-pic" aria-hidden="true"><i class="a"></i><i></i><i></i></span></div>';
        }
        return '<section class="cw-card"><h3>Зоны показов</h3><div class="cw-zones">' + one('search', 'Поиск') + one('recommendations', 'Рекомендации') + '</div></section>';
    }
    /* Шкала ставки: диапазон WB (info.rng, если он есть в данных), иначе только минимум. Подпись выдумывать нельзя: нет диапазона, нет и «Ставка за 11–34». */
    function bidMeta(key, e) {
        var inf = S.info[key], mn = inf && inf.min && inf.min[e.nm] || 0, rg = inf && inf.rng && inf.rng[e.nm + ':' + e.placement] || null;
        var kop = e.kop, out = { warn: false, fill: null, cap: '' };
        if (rg && rg.hi > rg.lo) {
            out.fill = Math.max(0, Math.min(1, (kop - rg.lo) / (rg.hi - rg.lo)));
            out.warn = kop < rg.lo; out.cap = out.warn ? 'Ставка ниже рекомендуемой' : 'Ставка за ' + fmtSom(kopToSom(rg.lo)) + '–' + fmtSom(kopToSom(rg.hi));
        } else if (mn) {
            var hi = Math.max(mn * 3, kop * 1.25);
            out.fill = Math.max(0, Math.min(1, (kop - mn) / (hi - mn)));
            out.warn = kop < mn; out.cap = out.warn ? 'Ставка ниже минимальной' : 'Минимум ' + fmtSom(kopToSom(mn));
        }
        return out;
    }
    function bidCellHtml(key, e, withMini) {
        var m = bidMeta(key, e), som = kopToSom(e.kop);
        return '<div class="adp2-bid cw-bid" data-key="' + esc(key) + '" data-nm="' + e.nm + '" data-pl="' + esc(e.placement) + '"><div class="cw-bw">' +
            '<div class="cw-inp live"><span class="cw-wslot">' + (m.warn ? '<span class="cw-warn" title="' + esc(m.cap) + '">!</span>' : '') + '</span>' +
            '<input type="text" inputmode="decimal" class="adp2-num' + (e.changed ? ' ch' : '') + '" value="' + esc(fmtSom(som).replace(/ /g, '')) + '" aria-label="Ставка в сомах"><span>KGS</span></div>' +
            '<div class="cw-rng"' + (m.fill == null ? ' hidden' : '') + '><i style="width:' + Math.round((m.fill || 0) * 100) + '%"></i></div><div class="cw-cp">' + (m.cap ? esc(m.cap) : '&nbsp;') + '</div></div>' +
            (withMini ? '<button type="button" class="cw-mini" disabled title="Пока недоступно" aria-label="График ставки">' + ico(IC.bars) + '</button>' : '') + '</div>';
    }
    function productsHtml(key, cab, camp) {
        var info = S.info[key], nms = effectiveNms(info ? info.nms : [], S.ov[key]);
        var list = entriesOf(key, camp), z = zonesState(key, camp), stock = (S.arts[cab.id] && S.arts[cab.id].stock) || null;
        var head = '<div class="cw-ch"><h3>Товары <small>' + (info && info.loaded ? nms.length + ' шт.' : '') + '</small></h3><div class="cw-tools">' +
            '<button type="button" class="cw-btn" data-pact="addp" data-key="' + esc(key) + '">＋ Добавить товары</button>' +
            '<button type="button" class="cw-btn" disabled title="Пока недоступно">Загрузить ⌄</button></div></div>' +
            '<div class="cw-note">' + ico(IC.tag) + 'Умный алгоритм помогает платить меньше с аукционом второй цены</div>';
        if (!info || !info.loaded) return '<section class="cw-card cw-prod">' + head + '<div class="adp2-load-line">Загружаем товары кампании…</div></section>';
        var th = '<div class="cw-th"><span>Фото</span><span>Бренд · Артикул · Название</span><span>Остатки ' + qHtml('Сколько штук товара лежит на складах WB') + '</span><span>Поиск ' + qHtml('Ставка в поисковой выдаче') + '</span><span>Рекомендации ' + qHtml('Ставка в блоках рекомендаций') + '</span><span></span></div>';
        var rows = nms.map(function (nm) {
            var es = list.filter(function (x) { return x.nm === nm; });
            var adding = S.ov[key] && S.ov[key].add[nm];
            var es1 = es.filter(function (x) { return x.placement !== 'recommendations'; })[0], es2 = es.filter(function (x) { return x.placement === 'recommendations'; })[0];
            var p = artPhoto(cab.id, nm), qty = stock && stock[nm] != null ? stock[nm] : null;
            var cell = function (e, mini, zoneOn) {
                return '<div class="cw-bc' + (zoneOn === false ? ' off' : '') + '">' + (e ? bidCellHtml(key, e, mini) : (adding ? '<span class="adp2-mut">появится после добавления</span>' : '<span class="adp2-mut">—</span>')) + '</div>';
            };
            return '<div class="cw-tr" data-nm="' + nm + '"><span class="cw-ph"' + (p ? ' style="background-image:url(\'' + esc(p) + '\')"' : '') + '></span>' +
                '<div class="cw-nmw"><div class="cw-nm">' + esc(artName(cab.id, nm)) + '</div><div class="cw-meta">' + nm + (adding ? ' · добавляется…' : '') + '<span class="cw-ms">' + (qty != null ? ' · <b>' + fmtSom(qty) + '</b> шт' : '') + '</span></div></div>' +
                '<div class="cw-stk">' + (qty != null ? '<b>' + fmtSom(qty) + '</b> шт' : '<span class="adp2-mut">—</span>') + '</div>' +
                '<div class="cw-bids"><div class="cw-bcw"><span class="cw-lb">Поиск</span>' + cell(es1, true, z.search) + '</div><div class="cw-bcw"><span class="cw-lb">Рекомендации</span>' + cell(es2, false, z.recommendations) + '</div></div>' +
                '<div class="cw-dots" data-nostop="1"><button type="button" class="cw-dbtn" data-pact="rowmenu" aria-label="Действия" aria-haspopup="true">··· ⌄</button><div class="cw-menu"><button type="button" data-ctl="1" data-pact="rm" data-key="' + esc(key) + '" data-nm="' + nm + '">Убрать из кампании</button></div></div></div>';
        }).join('');
        return '<section class="cw-card cw-prod">' + head + '<div class="cw-tbl">' + th + rows + '</div></section>';
    }
    function bodyHtml(key, cab, camp, kind, live) {
        try { if (hasCtl('register')) root.AdvCtl.register(key, { paymentType: camp.paymentType, bidType: (S.info[key] && S.info[key].bidType) || camp.bidType, createdAt: camp.createdAt || camp.wbCreatedAt, zones: camp.zones || camp.placements, limit: camp.limit, autoRefill: camp.autoRefill }); } catch (e) { /* состояние кампании не критично */ }
        var legacy = !root.AdvStats, kw = legacy && tabOf(key) === 'keys';
        var tabs = legacy ? '<div class="adp2-tabs"><button type="button" data-pact="tab" data-tab="prod" data-key="' + esc(key) + '" class="' + (!kw ? 'on' : '') + '">Товары</button><button type="button" data-pact="tab" data-tab="keys" data-key="' + esc(key) + '" class="' + (kw ? 'on' : '') + '">Ключи' + (S.kw[key] && S.kw[key].loaded ? '<em>' + S.kw[key].rows.length + '</em>' : '') + '</button></div>' : '';
        return '<div class="adp2-body cw" role="dialog" aria-modal="true" aria-label="Окно кампании"' + (CAN_POP ? ' popover="manual"' : '') + '><div class="cw-in">' +
            headHtml(key, camp, kind, live) + budgetCardsHtml(key, camp) + zonesHtml(key, camp, kind) + tabs +
            (kw ? '<div class="adp2-kwp" data-key="' + esc(key) + '">' + kwHtml(key, cab, camp) + '</div>' : productsHtml(key, cab, camp)) +
            (legacy ? '' : '<div class="adp2-slot" data-slot="stats" data-key="' + esc(key) + '"></div><div class="adp2-slot" data-slot="keys" data-key="' + esc(key) + '"></div>') +
            '</div></div>';
    }
    /* Слоты статистики и ключей наполняет root.AdvStats прямо в DOM; морфинг списка их не должен стирать:
       в новую разметку переносим то, что уже лежит в живом слоте (клон вместе с введёнными значениями). */
    function freezeSlots(scope, fresh) {
        if (!scope || !scope.querySelectorAll) return;
        Array.prototype.forEach.call(scope.querySelectorAll('.adp2-slot'), function (live) {
            var row = live.closest('.adp2-row'); if (!row) return;
            var tgt = Array.prototype.filter.call(fresh.querySelectorAll('.adp2-slot[data-slot="' + live.dataset.slot + '"]'), function (n) { return n.closest('.adp2-row') && n.closest('.adp2-row').dataset.key === row.dataset.key; })[0];
            if (!tgt) return;
            Array.prototype.forEach.call(live.attributes, function (a) { if (a.name !== 'class' || a.value) tgt.setAttribute(a.name, a.value); });
            tgt.innerHTML = ''; Array.prototype.forEach.call(live.childNodes, function (n) { tgt.appendChild(n.cloneNode(true)); });
        });
    }
    function mountSlots() {
        var host = $('adv-pulse'); if (!host || !root.AdvStats || typeof root.AdvStats.mount !== 'function') return;
        S.mounted = S.mounted || new WeakSet();
        Array.prototype.forEach.call(host.querySelectorAll('.adp2-row.open .adp2-slot'), function (el) {
            if (S.mounted.has(el)) return;
            S.mounted.add(el);
            var f = findCamp(el.dataset.key); if (!f) return;
            try { root.AdvStats.mount(el, { key: el.dataset.key, slot: el.dataset.slot, cabId: f.cab.id, campaign: f.camp }); } catch (e) { /* статистика не должна ломать окно */ }
        });
    }
    function closeMenus(except) { var h = $('adv-pulse'); if (!h) return; Array.prototype.forEach.call(h.querySelectorAll('.cw-dots.open'), function (d) { if (d !== except) d.classList.remove('open'); }); }
    /* Действие через AdvCtl. Он сам меняет состояние сразу, показывает сообщения и шлёт 'advctl:change', по которому мы перерисовываем окно.
       Мы только вызываем метод; отказ (WB не умеет, неверные данные) показываем коротко и откатываем то, что нарисовали заранее. */
    function ctlRun(key, method, args, revert, again) {
        var C = root.AdvCtl;
        if (!C || typeof C[method] !== 'function') { toast('Пока недоступно', null); if (revert) revert(); patchRow(key); return; }
        var p; try { p = C[method].apply(C, args); } catch (e) { p = Promise.reject(e); }
        return Promise.resolve(p).then(function (res) {
            patchRow(key);
            setTimeout(function () { if (root.AdsHQ && root.AdsHQ.load) root.AdsHQ.load(); }, 2500);
            return res;
        }).catch(function (e) {
            if (revert) revert(); patchRow(key);
            var why = (e && (e.reason || e.message || e.error)) || (typeof e === 'string' ? e : '') || 'WB не ответил';
            toast(esc(String(why)) + (e && (e.unsupported || e.invalid) ? '' : '. Повторите'), again && !(e && (e.unsupported || e.invalid)) ? { label: 'Повторить', fn: again } : null);
        });
    }
    function setLimitFlow(key, patch) {
        var f = findCamp(key); if (!f) return;
        var cw = cwOf(key), cur = limitState(key, f.camp), prev = { limitOn: cw.limitOn, limitKop: cw.limitKop, carry: cw.carry };
        var next = { on: patch.on != null ? patch.on : cur.on, amountKop: patch.amountKop != null ? patch.amountKop : (cur.kop || 0), carryOver: patch.carryOver != null ? patch.carryOver : cur.carry };
        cw.limitOn = next.on; cw.limitKop = next.amountKop || null; cw.carry = next.carryOver;
        patchRow(key);
        if (next.on && !(next.amountKop > 0)) { var inp = doc.querySelector('.adp2-row[data-key="' + key.replace(/"/g, '') + '"] .cw-limit-in'); if (inp) inp.focus(); return; }
        ctlRun(key, 'setLimit', [key, { on: next.on, amountKop: next.amountKop, carryOver: next.carryOver }], function () { cw.limitOn = prev.limitOn; cw.limitKop = prev.limitKop; cw.carry = prev.carry; }, function () { setLimitFlow(key, patch); });
    }
    function refillFlow(key) {
        var f = findCamp(key); if (!f) return;
        var cw = cwOf(key), prev = cw.refill, nx = !refillState(key, f.camp);
        cw.refill = nx; patchRow(key);
        ctlRun(key, 'setAutoRefill', [key, nx], function () { cw.refill = prev; }, function () { refillFlow(key); });
    }
    function zoneFlow(key, zone) {
        var f = findCamp(key); if (!f) return;
        var z = zonesState(key, f.camp), next = { search: !!z.search, recommendations: !!z.recommendations };
        next[zone] = !next[zone];
        if (!next.search && !next.recommendations) { toast('Должна быть включена хотя бы одна зона', null); return; }
        ctlRun(key, 'setZones', [key, next], null, function () { zoneFlow(key, zone); });
    }
    function finishFlow(key) {
        var f = findCamp(key); if (!f) return;
        var m = modal('<div class="adp2-mh"><b>Завершить кампанию?</b><button type="button" data-close="1" class="adp2-x" aria-label="Закрыть">✕</button></div>' +
            '<p class="adp2-mut" style="font-size:13px"><b>' + esc(f.camp.name) + '</b> · № ' + esc(f.camp.wbId) + '<br>Завершённую кампанию нельзя запустить снова.</p>' +
            '<div class="adp2-mf"><button type="button" class="adp2-gh" data-close="1">Отмена</button><button type="button" class="adp2-go" id="cw-fin">Завершить</button></div>');
        m.el.querySelector('#cw-fin').addEventListener('click', function () { m.close(); ctlRun(key, 'finish', [key], null, function () { finishFlow(key); }); });
    }
    function historyFlow(key) {
        var m = modal('<div class="adp2-mh"><b>История кампании</b><button type="button" data-close="1" class="adp2-x" aria-label="Закрыть">✕</button></div><div class="cw-hist" id="cw-hist"><div class="adp2-load-line">Загружаем историю…</div></div>');
        var box = m.el.querySelector('#cw-hist');
        var p; try { p = root.AdvCtl.history(key); } catch (e) { p = Promise.reject(e); }
        Promise.resolve(p).then(function (res) {
            var rows = Array.isArray(res) ? res : (res && (res.items || res.rows || res.history)) || [];
            var note = res && res.note ? '<div class="adp2-mut" style="font-size:12px;margin-bottom:6px">' + esc(res.note) + '</div>' : '';
            if (!rows.length) { box.innerHTML = note + '<div class="adp2-mut">Изменений пока нет</div>'; return; }
            box.innerHTML = note + rows.map(function (r) {
                var t = r.at || r.created_at || r.time || r.date || '', txt = r.text || r.title || r.description || r.action || r.kind || '';
                return '<div class="cw-hrow"><span>' + esc(String(t).replace('T', ' ').slice(0, 16)) + '</span><b>' + esc(txt || JSON.stringify(r)) + '</b>' + (r.statusText ? '<em>' + esc(r.statusText) + '</em>' : '') + '</div>';
            }).join('');
        }).catch(function (e) { box.innerHTML = '<div class="adp2-mut">Не удалось загрузить: ' + esc(String((e && (e.reason || e.message || e.error)) || e || 'ошибка')) + '</div>'; });
    }
    function renameFlow(key) {
        var f = findCamp(key); if (!f) return;
        var m = modal('<div class="adp2-mh"><b>Название кампании</b><button type="button" data-close="1" class="adp2-x" aria-label="Закрыть">✕</button></div><input type="text" id="cw-rn" class="adp2-q" maxlength="100" value="' + esc(f.camp.name) + '" aria-label="Название">' +
            '<div class="adp2-mf"><button type="button" class="adp2-gh" data-close="1">Отмена</button><button type="button" class="adp2-go" id="cw-rnok">Сохранить</button></div>');
        m.el.querySelector('#cw-rnok').addEventListener('click', function () {
            var v = m.el.querySelector('#cw-rn').value.trim(); if (!v || v === f.camp.name) { m.close(); return; }
            var old = f.camp.name; m.close(); f.camp.name = v;
            ctlRun(key, 'rename', [key, v], function () { f.camp.name = old; }, function () { renameFlow(key); });
        });
    }
    function rowHtml(cab, camp) {
        var key = keyOf(cab, camp), kind = payKind(camp), open = !!S.open[key];
        var ov = S.ov[key], live = ov && ov.paused != null ? !ov.paused : camp.live;
        var c = Object.assign({}, camp, { live: live });
        var info = S.info[key], nmCount = info && info.loaded ? effectiveNms(info.nms, ov).length : (camp.nmId ? 1 : 0);
        return '<article class="adp2-row' + (open ? ' open' : '') + (live ? '' : ' off') + '" data-key="' + esc(key) + '">' +
            '<div class="adp2-head" data-pact="open" data-key="' + esc(key) + '">' +
            '<div class="adp2-tc">' + mainPhotoHtml(cab, camp, kind) + '</div>' +
            '<div class="adp2-nm"><b><span class="adp2-dot' + (live ? '' : ' off') + '"></span>' + esc(camp.name) + (camp.auto ? '<span class="adp2-auto" title="Ставками управляет автопилот">авто</span>' : '') + '</b><small><span class="adp2-stt">' + (live ? 'Активна' : 'Приостановлена') + ' · </span>' + esc(camp.wbId) + (nmCount ? '<span class="adp2-nmc"> · ' + nmCount + ' тов.</span>' : '') + '</small>' + mainLine(cab, camp, nmCount) + (root.AdvShelves ? root.AdvShelves.slotHtml(cab.id, camp.wbId) : '') + '</div>' +
            typeCellHtml(camp, kind) +
            '<div class="adp2-r" data-nostop="1">' + balHtml(key, camp) + '<div class="adp2-pos">' + switchHtml(key, camp, live) + '</div></div>' +
            metricCellsHtml(c) +
            '<div class="adp2-ch" data-chipbox="1">' + chipHtml(key) + '</div>' +
            '<div class="adp2-shl">' + (root.AdvShelves ? root.AdvShelves.slotHtml(cab.id, camp.wbId) : '') + '</div>' +
            '</div>' +
            (open ? bodyHtml(key, cab, camp, kind, live) : '') +
            '</article>';
    }
    function virtualHtml() {
        return S.virtual.map(function (v) {
            var o = S.ops[v.opId] || {};
            var st = o.status === 'error' ? '<span class="adp2-chip bad">⚠ ' + esc(o.err || 'не создалась') + ' <button type="button" data-pact="vretry" data-v="' + esc(v.opId) + '">Повторить</button> <button type="button" data-pact="vdrop" data-v="' + esc(v.opId) + '">Убрать</button></span>' :
                '<span class="adp2-chip wait">Создаётся в WB…</span>';
            return '<article class="adp2-row virt" data-key="virt:' + esc(v.opId) + '"><div class="adp2-head"><div class="adp2-tc">' + badge(v.kind, 'xl') + '</div><div class="adp2-nm"><b><span class="adp2-dot"></span>' + esc(v.name) + '</b><small>новая кампания · ' + v.nms.length + ' тов.</small></div><div class="adp2-st"></div><div class="adp2-bw"></div><div class="adp2-ch">' + st + '</div></div></article>';
        }).join('');
    }

    /* Карточка-скелет той же формы, что и настоящая строка (ползунок/фото/имя/метрики/статус) —
       когда данные придут, меняется не форма блока, а только содержимое внутри неё. */
    function skelRowHtml(i) {
        var bar = function (w, h, extra) { return '<span class="adp2-skel" style="max-width:' + w + 'px;height:' + h + 'px' + (extra || '') + '"></span>'; };
        return '<article class="adp2-row skel" data-key="skel:' + i + '" aria-hidden="true">' +
            '<div class="adp2-head">' +
            '<div class="adp2-pos">' + bar(84, 30, ';border-radius:10px') + '</div>' +
            '<div class="adp2-tc">' + bar(40, 40, ';border-radius:50%') + '</div>' +
            '<div class="adp2-nm">' + bar(150, 14, ';margin-bottom:6px') + bar(90, 11, '') + '</div>' +
            '<div class="adp2-ch">' + bar(74, 22, ';border-radius:999px') + '</div>' +
            '</div></article>';
    }
    function render() {
        var host = $('adv-pulse'); if (!host || S.view !== 'pulse') return;
        S.rows = (root.AdsHQ && root.AdsHQ.getVisibleRows) ? root.AdsHQ.getVisibleRows() : [];
        var total = 0, html = '';
        S.rows.forEach(function (cab) {
            if (S.rows.length > 1 && cab.campaigns.length) html += '<h3 class="adp2-cab" data-key="cab:' + esc(cab.id) + '"><b>' + esc(cab.name) + '</b><span>' + cab.campaigns.length + ' ' + campWord(cab.campaigns.length) +'</span></h3>';
            cab.campaigns.forEach(function (camp) { total++; html += rowHtml(cab, camp); });
        });
        if (!root.AdsHQ || !root.AdsHQ.getModelReady || !root.AdsHQ.getModelReady()) html = [0, 1, 2, 3].map(skelRowHtml).join('');
        else if (!total && !S.virtual.length) html = '<div class="adp2-empty" data-key="empty">Кампаний по выбранному фильтру нет. Нажмите «Новая РК», чтобы создать.</div>';
        var full = headerHtml() + virtualHtml() + html;
        // Полная перерисовка списка на каждое обновление данных роняла фокус и сбрасывала ползунки
        // («трясло» при любом обновлении) — теперь патчим по data-key, как в ads-command-center.js.
        var fresh = null;
        if (host.querySelector('.adp2-slot')) { fresh = doc.createElement('div'); fresh.innerHTML = full; freezeSlots(host, fresh); full = fresh.innerHTML; }
        if (root.domMorph && host.querySelector('[data-key]')) root.domMorph.morphList(host, full, 'data-key');
        else host.innerHTML = full;
        showModals(); mountSlots();
        // подгружаем ставки активных кампаний по очереди, не блокируя экран
        var keys = [];
        S.rows.forEach(function (cab) { cab.campaigns.forEach(function (c) { if (c.live) keys.push(keyOf(cab, c)); }); });
        enqueueInfo(keys.slice(0, 40));
        S.rows.forEach(function (cab) { if (cab.campaigns.length) artsOf(cab.id).then(function () { /* имена и фото подтянутся при следующей отрисовке строки */ }); });
    }
    function patchRow(key) {
        var host = $('adv-pulse'); if (!host || !key) return;
        var f = findCamp(key), el = host.querySelector('[data-key="' + key.replace(/"/g, '') + '"].adp2-row');
        if (!f || !el) return;
        var focused = doc.activeElement && el.contains(doc.activeElement) ? doc.activeElement : null;
        if (focused && (focused.classList.contains('adp2-num') || focused.classList.contains('adp2-rg'))) { refreshBid(key); var cb = el.querySelector('[data-chipbox]'); if (cb) cb.innerHTML = chipHtml(key); return; }
        var tmp = doc.createElement('div'); tmp.innerHTML = rowHtml(f.cab, f.camp);
        freezeSlots(el, tmp);
        // Закрытие окна: морфинг не удаляет блок с полями ввода, поэтому убираем окно сами
        var oldBody = el.querySelector(':scope > .adp2-body');
        if (oldBody && !tmp.querySelector('.adp2-body')) { try { if (oldBody.matches(':popover-open')) oldBody.hidePopover(); } catch (e) { /* уже закрыт */ } oldBody.remove(); }
        // Патчим узел на месте, а не меняем целиком: replaceWith сбрасывал ползунок/фокус
        // при каждой фоновой подгрузке ставок (enqueueInfo зовёт patchRow на каждую кампанию).
        if (root.domMorph && typeof root.domMorph.patchNode === 'function') root.domMorph.patchNode(el, tmp.firstChild);
        else el.replaceWith(tmp.firstChild);
        showModals(); mountSlots();
    }
    function refreshBid(key) {
        var host = $('adv-pulse'), f = findCamp(key); if (!host || !f) return;
        var list = entriesOf(key, f.camp);
        host.querySelectorAll('.adp2-bid[data-key="' + key.replace(/"/g, '') + '"]').forEach(function (w) {
            var e = list.filter(function (x) { return x.nm === Number(w.dataset.nm) && x.placement === w.dataset.pl; })[0]; if (!e) return;
            var rg = w.querySelector('.adp2-rg'), nu = w.querySelector('.adp2-num');
            if (rg) rg.value = kopToSom(e.kop);
            var bm = bidMeta(key, e), ws = w.querySelector('.cw-wslot'), rn = w.querySelector('.cw-rng'), cp = w.querySelector('.cw-cp');
            if (ws) ws.innerHTML = bm.warn ? '<span class="cw-warn" title="' + esc(bm.cap) + '">!</span>' : '';
            if (rn) { rn.hidden = bm.fill == null; var fi = rn.querySelector('i'); if (fi) fi.style.width = Math.round((bm.fill || 0) * 100) + '%'; }
            if (cp) cp.innerHTML = bm.cap ? esc(bm.cap) : '&nbsp;';
            if (nu && doc.activeElement !== nu) nu.value = fmtSom(kopToSom(e.kop)).replace(/ /g, '');
            if (nu) nu.classList.toggle('ch', !!e.changed);
        });
        var el = host.querySelector('.adp2-row[data-key="' + key.replace(/"/g, '') + '"] [data-chipbox]'); if (el) el.innerHTML = chipHtml(key);
        var range = host.querySelector('.adp2-row[data-key="' + key.replace(/"/g, '') + '"] .adp2-range');
        if (range && list.length) range.innerHTML = rangeText(list);
    }

    /* ───────── всплывающее: сообщение, выбор товара, мастер ───────── */
    function toast(html, action) {
        var tmp = doc.createElement('div'); tmp.innerHTML = html; var text = tmp.textContent || '';
        if (root.NrUi) root.NrUi.toast('info', text, '', action ? { duration: 6500, action: { label: action.label, onClick: action.fn } } : { duration: 3500 });
    }
    function modal(inner, onClose) {
        var ov = doc.createElement('div'); ov.className = 'adp2-ov';
        ov.innerHTML = '<div class="adp2-md" role="dialog" aria-modal="true">' + inner + '</div>';
        doc.body.appendChild(ov);
        function close() { ov.remove(); doc.removeEventListener('keydown', onKey); if (onClose) onClose(); }
        function onKey(e) { if (e.key === 'Escape') close(); }
        doc.addEventListener('keydown', onKey);
        ov.addEventListener('click', function (e) { if (e.target === ov || e.target.closest('[data-close]')) close(); });
        return { el: ov, close: close };
    }
    function pickerList(cabId, exclude, q, picked) {
        var rec = S.arts[cabId], list = rec ? rec.list : [];
        q = String(q || '').trim().toLowerCase();
        var items = list.filter(function (a) { return exclude.indexOf(a.nm_id) < 0 && (!q || String(a.name || '').toLowerCase().indexOf(q) >= 0 || String(a.nm_id).indexOf(q) >= 0); }).slice(0, 80);
        if (!items.length) return '<div class="adp2-mut" style="padding:14px">' + (rec && rec.loaded ? 'Нет подходящих товаров' : 'Загружаем товары…') + '</div>';
        return items.map(function (a) {
            return '<label class="adp2-pk"><input type="checkbox" value="' + a.nm_id + '"' + (picked[a.nm_id] ? ' checked' : '') + '>' + thumb(cabId, a.nm_id) + '<span><b>' + esc(a.name || ('Артикул ' + a.nm_id)) + '</b><small>' + a.nm_id + '</small></span></label>';
        }).join('');
    }
    function openPicker(opts) {
        // opts: {cabId, exclude:[], title, button, multi, onPick(nms[])}
        var picked = {};
        var m = modal('<div class="adp2-mh"><b>' + esc(opts.title) + '</b><button type="button" data-close="1" class="adp2-x" aria-label="Закрыть">✕</button></div>' +
            '<input type="search" class="adp2-q" id="adp2-q" placeholder="Название или артикул" autocomplete="off"><div class="adp2-pl" id="adp2-pl"></div>' +
            '<div class="adp2-mf"><span class="adp2-mut" id="adp2-cnt">Выбрано: 0</span><button type="button" class="adp2-go" id="adp2-ok" disabled>' + esc(opts.button) + '</button></div>');
        function paint() { $('adp2-pl').innerHTML = pickerList(opts.cabId, opts.exclude, $('adp2-q').value, picked); count(); }
        function count() { var n = Object.keys(picked).length; $('adp2-cnt').textContent = 'Выбрано: ' + n; $('adp2-ok').disabled = !n; }
        m.el.addEventListener('change', function (e) {
            if (e.target.type !== 'checkbox') return;
            var v = Number(e.target.value);
            if (opts.single) { picked = {}; m.el.querySelectorAll('.adp2-pk input').forEach(function (i) { if (i !== e.target) i.checked = false; }); }
            if (e.target.checked) picked[v] = 1; else delete picked[v];
            count();
        });
        $('adp2-q').addEventListener('input', paint);
        $('adp2-ok').addEventListener('click', function () { var n = Object.keys(picked).map(Number); m.close(); opts.onPick(n); });
        artsOf(opts.cabId).then(paint); paint();
        setTimeout(function () { $('adp2-q').focus(); }, 30);
    }
    function addProductsFlow(key) {
        var f = findCamp(key); if (!f) return;
        var cur = effectiveNms(S.info[key] ? S.info[key].nms : [], S.ov[key]);
        openPicker({ cabId: f.cab.id, exclude: cur, title: 'Добавить товары в «' + f.camp.name + '»', button: 'Добавить', onPick: function (nms) { addProducts(key, nms); patchRow(key); } });
    }

    function createFlow() {
        var cabs = S.rows.length ? S.rows : (root.AdsHQ && root.AdsHQ.getVisibleRows ? root.AdsHQ.getVisibleRows() : []);
        if (!cabs.length) { toast('Сначала выберите кабинет', null); return; }
        var st = { step: 1, cab: cabs[0].id, kind: 'cpm', bidType: 'manual', nms: [], name: '', bid: 400 };
        var m = modal('<div id="adp2-wz"></div>');
        function paint() {
            var s = st.step, h = '<div class="adp2-mh"><b>Новая кампания</b><button type="button" data-close="1" class="adp2-x" aria-label="Закрыть">✕</button></div><div class="adp2-steps">' +
                [1, 2, 3].map(function (i) { return '<i class="' + (i <= s ? 'on' : '') + '"></i>'; }).join('') + '</div>';
            if (s === 1) {
                h += (cabs.length > 1 ? '<label class="adp2-lb">Кабинет<select id="wz-cab">' + cabs.map(function (c) { return '<option value="' + esc(c.id) + '"' + (c.id === st.cab ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select></label>' : '') +
                    '<div class="adp2-opt">' +
                    '<button type="button" data-kind="cpc" class="' + (st.kind === 'cpc' ? 'sel' : '') + '">' + badge('cpc', 'xl') + '<span>Оплата за клик</span><small>Платите, когда человек нажал. Ставка на старте минимальная.</small></button>' +
                    '<button type="button" data-kind="cpm" class="' + (st.kind === 'cpm' ? 'sel' : '') + '">' + badge('cpm', 'xl') + '<span>Оплата за 1000 показов</span><small>Платите за показы. Ставку задаёте сами.</small></button></div>' +
                    '<div class="adp2-seg"><button type="button" data-bt="manual" class="' + (st.bidType === 'manual' ? 'sel' : '') + '">Ручная ставка (поиск)</button><button type="button" data-bt="unified" class="' + (st.bidType === 'unified' ? 'sel' : '') + '">Единая ставка</button></div>';
            } else if (s === 2) {
                h += '<div class="adp2-sel">' + (st.nms.length ? st.nms.map(function (n) { return '<span class="adp2-tag">' + thumb(st.cab, n, 's') + esc(artName(st.cab, n)) + ' <u data-del="' + n + '">✕</u></span>'; }).join('') : '<span class="adp2-mut">Товары не выбраны</span>') + '</div>' +
                    '<button type="button" class="adp2-addp" data-pick="1">＋ Выбрать товары</button>';
            } else {
                var f = findCamp(''); void f;
                if (!st.name) st.name = (st.nms.length ? artName(st.cab, st.nms[0]) : 'Новая кампания').slice(0, 60) + ' ' + (st.kind === 'cpc' ? 'CPC' : 'CPM');
                h += '<label class="adp2-lb">Название<input type="text" id="wz-name" maxlength="100" value="' + esc(st.name) + '"></label>' +
                    (st.kind === 'cpm' ? '<label class="adp2-lb">Стартовая ставка, сом за 1000 показов<input type="number" id="wz-bid" min="1" step="5" value="' + st.bid + '"></label>' : '<p class="adp2-mut">В CPC ставка на старте минимальная. Поменять её можно сразу после создания.</p>') +
                    '<p class="adp2-mut">Кампания появится в списке сразу, а в WB создастся в фоне. Запустить её можно после создания.</p>';
            }
            h += '<div class="adp2-mf">' + (s > 1 ? '<button type="button" class="adp2-gh" data-back="1">Назад</button>' : '<span></span>') +
                '<button type="button" class="adp2-go" data-next="1"' + (s === 2 && !st.nms.length ? ' disabled' : '') + '>' + (s === 3 ? 'Создать' : 'Далее') + '</button></div>';
            $('adp2-wz').innerHTML = h;
        }
        m.el.addEventListener('click', function (e) {
            var t = e.target.closest('button,u'); if (!t) return;
            if (t.dataset.kind) { st.kind = t.dataset.kind; paint(); }
            else if (t.dataset.bt) { st.bidType = t.dataset.bt; paint(); }
            else if (t.dataset.back) { st.step--; paint(); }
            else if (t.dataset.del) { st.nms = st.nms.filter(function (n) { return n !== Number(t.dataset.del); }); paint(); }
            else if (t.dataset.pick) { openPicker({ cabId: st.cab, exclude: st.nms, title: 'Товары новой кампании', button: 'Выбрать', onPick: function (n) { st.nms = st.nms.concat(n).slice(0, 50); paint(); } }); }
            else if (t.dataset.next) {
                if (st.step === 3) {
                    var nm = $('wz-name'), bd = $('wz-bid');
                    st.name = String(nm.value || '').trim(); if (bd) st.bid = Number(bd.value) || 400;
                    if (!st.name) { nm.focus(); return; }
                    m.close(); createCampaign(st);
                } else { st.step++; paint(); }
            }
        });
        m.el.addEventListener('change', function (e) { if (e.target.id === 'wz-cab') { st.cab = e.target.value; st.nms = []; } });
        paint();
    }
    function createCampaign(st) {
        var payload = { name: st.name, nms: st.nms, payment_type: st.kind, bid_type: st.bidType };
        if (st.kind === 'cpm') payload.bid_kopecks = somToKop(st.bid);
        var v = { name: st.name, kind: st.kind, nms: st.nms, opId: null };
        S.virtual.unshift(v);
        v.opId = enqueue(null, st.cab, null, 'create', payload, { virtual: v });
        // enqueue() подменяет временный id настоящим, ищем запись по созданной операции
        S.virtualPatch = function () {
            Object.keys(S.ops).forEach(function (id) { if (S.ops[id].meta && S.ops[id].meta.virtual === v) v.opId = id; });
            var o = S.ops[v.opId];
            if (o && o.status === 'done') { S.virtual = S.virtual.filter(function (x) { return x !== v; }); }
            render();
        };
        render(); toast('Создаю «' + esc(st.name) + '» в WB…', null);
    }


    /* ───────── ключи (кластеры) кампании ───────── */
    function tabOf(key) { return S.kwTab[key] || 'prod'; }
    function kwKey(r) { return r.nmId + '|' + r.normQuery; }
    function kwState(key) { return S.kw[key] || (S.kw[key] = { loaded: false, loading: false, rows: [], editable: false, ov: {}, mn: {}, sel: {}, filter: 'all', sort: 'spend', limit: 40, q: '' }); }
    function kwFind(key, k) { var st = S.kw[key]; if (!st) return null; for (var i = 0; i < st.rows.length; i++) if (kwKey(st.rows[i]) === k) return st.rows[i]; return null; }
    function kwBid(st, r) { var o = st.ov[kwKey(r)]; return o != null ? o : r.bid; }
    function kwOff(st, r) { var m = st.mn[kwKey(r)]; return m != null ? m : !!r.minus; }
    function kwCpo(r) { return r.orders > 0 ? Math.round(r.spend / r.orders) : null; }
    function kwStep() { return 5; }
    function loadKw(key, force) {
        var f = findCamp(key); if (!f) return;
        var st = kwState(key); if ((st.loading || st.loaded) && !force) return;
        st.loading = true; st.error = ''; kwRender(key);
        var range = (S.deps.getDateRange && S.deps.getDateRange()) || {};
        Promise.resolve(call('adv_cluster_board', { advertId: f.camp.wbId, dateFrom: range.from, dateTo: range.to }, f.cab.id)).then(function (res) {
            st.loading = false;
            if (!res || res.error) { st.error = String((res && res.error) || 'WB не отдал ключи этой кампании'); kwRender(key); return; }
            st.rows = (res.rows || []).filter(function (r) { return r.state !== 'archived'; });
            st.editable = !!res.editable; st.currency = res.currency || ''; st.loaded = true;
            kwRender(key); patchTabs(key);
        }).catch(function (e) { st.loading = false; st.error = String((e && e.message) || e || 'ошибка'); kwRender(key); });
    }
    function patchTabs(key) {
        var host = $('adv-pulse'); if (!host) return;
        var b = host.querySelector('.adp2-row[data-key="' + key.replace(/"/g, '') + '"] .adp2-tabs [data-tab="keys"]'); var st = S.kw[key];
        if (b && st && st.loaded) b.innerHTML = 'Ключи<em>' + st.rows.length + '</em>';
    }
    function kwVisible(st) {
        var q = String(st.q || '').trim().toLowerCase();
        var list = st.rows.filter(function (r) {
            var off = kwOff(st, r);
            if (st.filter === 'orders' && !(r.orders > 0)) return false;
            if (st.filter === 'noorders' && (r.orders > 0 || off)) return false;
            if (st.filter === 'off' ? !off : off) return false;
            return !q || r.normQuery.toLowerCase().indexOf(q) >= 0;
        });
        var by = st.sort;
        list.sort(function (a, b) {
            if (by === 'orders') return b.orders - a.orders;
            if (by === 'cpo') { var x = kwCpo(a), y = kwCpo(b); return (x == null ? 1e9 : x) - (y == null ? 1e9 : y); }
            if (by === 'pos') return (a.avgPos || 1e9) - (b.avgPos || 1e9);
            return b.spend - a.spend;
        });
        return list;
    }
    function kwWaste(st) {
        var n = 0, sum = 0, items = [];
        st.rows.forEach(function (r) { if (!kwOff(st, r) && r.orders === 0 && r.spend > 0) { n++; sum += r.spend; items.push(r); } });
        return { n: n, sum: sum, items: items };
    }
    function kwStatusHtml(key) {
        var ops = S.kwOps[key] || [], err = ops.filter(function (o) { return o.status === 'error'; });
        var wait = ops.filter(function (o) { return o.status === 'pending' || o.status === 'sending'; }).length;
        if (err.length) return '<span class="adp2-chip bad">⚠ ' + esc(err[0].err || 'ошибка') + ' <button type="button" data-pact="kretry" data-key="' + esc(key) + '">Повторить</button> <button type="button" data-pact="kdrop" data-key="' + esc(key) + '">Отменить</button></span>';
        if (wait) return '<span class="adp2-chip wait">В WB отправляется: ' + wait + '</span>';
        var ok = ops.some(function (o) { return o.status === 'done' && Date.now() - (o.doneAt || 0) < 4000; });
        return ok ? '<span class="adp2-chip ok">✓ В WB</span>' : '';
    }
    function kwRowHtml(key, st, r, multi, cabId) {
        var k = kwKey(r), off = kwOff(st, r), bid = kwBid(st, r), cpo = kwCpo(r), sel = !!st.sel[k];
        var cpoTxt = cpo != null ? '<span class="cpo ok">CPO <b>' + fmtSom(cpo) + ' ₽</b></span>' : (r.spend > 0 ? '<span class="cpo bad">заказов нет</span>' : '');
        var lad = '';
        if (st.editable && bid > 0) {
            var lo = Math.max(1, Math.floor(Math.min(r.bidMin || bid, bid) * 0.6)), hi = Math.ceil(Math.max(r.bidMax || bid, bid) * 1.25);
            var marks = [['Мин', r.bidMin], ['Средн.', r.bidMedium], ['Макс', r.bidMax]].filter(function (m) { return m[1] > 0; });
            lad = '<div class="adp2-lad"><input type="range" class="adp2-kr" min="' + lo + '" max="' + hi + '" step="1" value="' + bid + '" aria-label="Ставка по ключу"><div class="adp2-lmk">' +
                marks.map(function (m) { return '<button type="button" data-pact="kmark" data-key="' + esc(key) + '" data-k="' + esc(k) + '" data-v="' + m[1] + '" title="Коридор WB">' + m[0] + ' ' + fmtSom(m[1]) + '</button>'; }).join('') + '</div></div>';
        }
        var ctrl = (st.editable && bid > 0)
            ? '<div class="adp2-kb" data-key="' + esc(key) + '" data-k="' + esc(k) + '"><button type="button" data-pact="kstep" data-dir="-1" aria-label="Меньше">−</button><input type="text" inputmode="decimal" class="adp2-kn' + (st.ov[k] != null ? ' ch' : '') + '" value="' + fmtSom(bid).replace(/ /g, '') + '" aria-label="Ставка"><button type="button" data-pact="kstep" data-dir="1" aria-label="Больше">+</button></div>'
            : '<span class="adp2-mut">' + (bid > 0 ? fmtSom(bid) + ' ₽' : 'ставка не задана') + '</span>';
        return '<div class="adp2-k' + (sel ? ' sel' : '') + (off ? ' off' : '') + '" data-k="' + esc(k) + '">' +
            '<label class="adp2-cb"><input type="checkbox" data-pact="ksel" data-key="' + esc(key) + '" data-k="' + esc(k) + '"' + (sel ? ' checked' : '') + '><i></i></label>' +
            '<div class="adp2-kt"><b>' + (multi ? thumb(cabId, r.nmId, 's') : '') + esc(r.normQuery) + '</b><div class="adp2-ks"><span>Показы <b>' + fmtSom(r.views) + '</b></span><span>Заказы <b>' + fmtSom(r.orders) + '</b></span><span>Расход <b>' + fmtSom(Math.round(r.spend)) + '</b></span>' + cpoTxt + (r.avgPos ? '<span>поз. <b>' + Math.round(r.avgPos) + '</b></span>' : '') + '</div></div>' +
            lad + ctrl +
            '<button type="button" class="adp2-sw' + (off ? ' o' : '') + '" data-pact="kminus" data-key="' + esc(key) + '" data-k="' + esc(k) + '" role="switch" aria-checked="' + (!off) + '" aria-label="Показывать по ключу"></button></div>';
    }
    function kwHtml(key, cab, camp) {
        var st = kwState(key);
        if (!st.loaded) {
            if (st.error) return '<div class="adp2-load-line">' + esc(st.error) + ' <button type="button" class="adp2-load" data-pact="kload" data-key="' + esc(key) + '">Повторить</button></div>';
            if (!st.loading) setTimeout(function () { loadKw(key); }, 0);
            return '<div class="adp2-load-line">Загружаем ключи кампании…</div><span class="adp2-skel big"></span><span class="adp2-skel big"></span>';
        }
        var waste = kwWaste(st), list = kwVisible(st), shown = list.slice(0, st.limit);
        var multi = false, seen = {}; st.rows.forEach(function (r) { seen[r.nmId] = 1; }); multi = Object.keys(seen).length > 1;
        var cnt = { all: 0, orders: 0, noorders: 0, off: 0 };
        st.rows.forEach(function (r) { var off = kwOff(st, r); if (off) cnt.off++; else { cnt.all++; if (r.orders > 0) cnt.orders++; else cnt.noorders++; } });
        var chips = [['all', 'Все ' + cnt.all], ['orders', 'Есть заказы ' + cnt.orders], ['noorders', 'Без заказов ' + cnt.noorders], ['off', 'Убраны ' + cnt.off]].map(function (c) {
            return '<button type="button" class="adp2-fc' + (st.filter === c[0] ? ' on' : '') + '" data-pact="kfilter" data-key="' + esc(key) + '" data-f="' + c[0] + '">' + c[1] + '</button>';
        }).join('');
        var nsel = Object.keys(st.sel).length;
        return (st.editable ? '' : '<div class="adp2-note">WB разрешает менять ставку по ключу только у кампаний с ручной ставкой и оплатой за показы (CPM). Здесь можно смотреть статистику и убирать лишние ключи.</div>') +
            (waste.n ? '<div class="adp2-waste"><span>Слито без заказов за период: <b>' + fmtSom(Math.round(waste.sum)) + ' ₽</b> на ' + waste.n + ' ' + plural(waste.n, 'ключе', 'ключах', 'ключах') + '</span><button type="button" data-pact="kwaste" data-key="' + esc(key) + '">Убрать эти ключи</button></div>' : '') +
            '<div class="adp2-kt-tools">' + chips + '<input type="search" class="adp2-ksearch" placeholder="Поиск по ключу" value="' + esc(st.q) + '" data-key="' + esc(key) + '"><select class="adp2-ksort" data-key="' + esc(key) + '" aria-label="Сортировка">' +
            [['spend', 'по расходу'], ['orders', 'по заказам'], ['cpo', 'по цене заказа'], ['pos', 'по позиции']].map(function (o) { return '<option value="' + o[0] + '"' + (st.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
            '<div class="adp2-klist">' + (shown.length ? shown.map(function (r) { return kwRowHtml(key, st, r, multi, cab.id); }).join('') : '<div class="adp2-mut" style="padding:12px">Ключей по фильтру нет</div>') +
            (list.length > shown.length ? '<button type="button" class="adp2-addp" data-pact="kmore" data-key="' + esc(key) + '">Показать ещё ' + Math.min(40, list.length - shown.length) + '</button>' : '') + '</div>' +
            '<div class="adp2-kfoot"><span data-kstatus="1">' + kwStatusHtml(key) + '</span></div>' +
            (nsel ? '<div class="adp2-bulk"><span><b>' + nsel + '</b> ' + plural(nsel, 'ключ', 'ключа', 'ключей') + ' выбрано</span>' +
                (st.editable ? '<button type="button" data-pact="kbulk" data-key="' + esc(key) + '" data-b="mid">Ставка = средняя</button><button type="button" data-pact="kbulk" data-key="' + esc(key) + '" data-b="+10">+10 ₽</button><button type="button" data-pact="kbulk" data-key="' + esc(key) + '" data-b="-10">−10 ₽</button>' : '') +
                '<button type="button" class="p" data-pact="kbulk" data-key="' + esc(key) + '" data-b="off">Убрать из показа</button><button type="button" data-pact="kbulk" data-key="' + esc(key) + '" data-b="clear">Снять выбор</button></div>' : '');
    }
    function plural(n, a, b, c) { var m = n % 100, d = n % 10; return m > 10 && m < 15 ? c : d === 1 ? a : d >= 2 && d <= 4 ? b : c; }
    function kwRender(key) {
        var host = $('adv-pulse'); if (!host) return;
        var el = host.querySelector('.adp2-kwp[data-key="' + key.replace(/"/g, '') + '"]'); var f = findCamp(key);
        if (!el || !f) return;
        var fo = doc.activeElement;
        if (fo && el.contains(fo) && (fo.classList.contains('adp2-kn') || fo.classList.contains('adp2-ksearch') || fo.classList.contains('adp2-kr'))) { kwSoft(key, el); return; }
        el.innerHTML = kwHtml(key, f.cab, f.camp);
    }
    /** Пока человек печатает или тянет ползунок, список не перерисовываем: обновляем только значения и статус. */
    function kwSoft(key, el) {
        var st = S.kw[key]; if (!st) return;
        var s = el.querySelector('[data-kstatus]'); if (s) s.innerHTML = kwStatusHtml(key);
        el.querySelectorAll('.adp2-k').forEach(function (row) {
            var r = kwFind(key, row.dataset.k); if (!r) return;
            var nu = row.querySelector('.adp2-kn'), rg = row.querySelector('.adp2-kr'), b = kwBid(st, r);
            if (nu && doc.activeElement !== nu) nu.value = fmtSom(b).replace(/ /g, '');
            if (rg && doc.activeElement !== rg) rg.value = b;
            if (nu) nu.classList.toggle('ch', st.ov[row.dataset.k] != null);
        });
    }
    /* очередь ключей: по одному запросу, минус-фразы одной кампании объединяются (WB перезаписывает список целиком) */
    function kwEnqueue(key, op) {
        var list = S.kwOps[key] || (S.kwOps[key] = []);
        if (op.type === 'bid') list.forEach(function (o) { if (o.type === 'bid' && o.k === op.k && o.status === 'pending') o.status = 'merged'; });
        op.status = 'pending'; op.tries = 0; op.id = 'k' + Math.random().toString(36).slice(2); op.key = key; list.push(op);
        S.kwOps[key] = list.filter(function (o) { return o.status !== 'merged'; });
        kwPump();
    }
    function kwPump() {
        if (S.kwBusy) return; S.kwBusy = true;
        (function step() {
            var next = null, nkey = null;
            Object.keys(S.kwOps).some(function (key) {
                var o = S.kwOps[key].filter(function (x) { return x.status === 'pending' && (!x.at || x.at <= Date.now()); })[0];
                if (o) { next = o; nkey = key; return true; } return false;
            });
            if (!next) {
                var later = Object.keys(S.kwOps).some(function (key) { return S.kwOps[key].some(function (x) { return x.status === 'pending'; }); });
                S.kwBusy = false; if (later) setTimeout(kwPump, 1200); return;
            }
            kwSend(nkey, next).then(function () { setTimeout(step, 260); });
        })();
    }
    function kwSend(key, op) {
        var f = findCamp(key), st = S.kw[key]; if (!f || !st) { op.status = 'error'; op.err = 'кампания недоступна'; return Promise.resolve(); }
        op.status = 'sending'; kwStatus(key);
        var req;
        if (op.type === 'bid') {
            req = call('adv_cluster_bid', { advertId: f.camp.wbId, nmId: op.nm, normQuery: op.q, bid: op.val }, f.cab.id);
        } else {
            var group = (S.kwOps[key] || []).filter(function (x) { return x.type === 'minus' && x.nm === op.nm && (x.status === 'pending' || x === op); });
            group.forEach(function (x) { x.status = 'sending'; });
            op.group = group;
            var add = [], remove = [];
            group.forEach(function (x) { (x.off ? add : remove).push(x.q); });
            req = call('adv_cluster_minus', { advertId: f.camp.wbId, nmId: op.nm, add: add, remove: remove }, f.cab.id);
        }
        return Promise.resolve(req).then(function (res) {
            if (!res || res.error) throw new Error(String((res && res.error) || 'WB не ответил'));
            var done = op.type === 'bid' ? [op] : op.group;
            done.forEach(function (x) {
                x.status = 'done'; x.doneAt = Date.now();
                var r = kwFind(key, x.nm + '|' + x.q);
                if (x.type === 'bid') { if (r) r.bid = x.val; if (st.ov[x.nm + '|' + x.q] === x.val) delete st.ov[x.nm + '|' + x.q]; }
                else { if (r) r.minus = x.off; delete st.mn[x.nm + '|' + x.q]; }
            });
        }).catch(function (e) {
            var done = op.type === 'bid' ? [op] : (op.group || [op]);
            var msg = String((e && e.message) || e || 'ошибка');
            var retry = /timeout|network|fetch|abort|50\d|429|не ответил/i.test(msg);
            done.forEach(function (x) {
                x.tries = (x.tries || 0) + 1;
                if (retry && x.tries < 4) { x.status = 'pending'; x.at = Date.now() + 2000 * x.tries; }
                else { x.status = 'error'; x.err = msg; }
            });
        }).then(function () { kwRender(key); setTimeout(function () { kwStatus(key); }, 4200); });
    }
    function kwStatus(key) {
        var host = $('adv-pulse'); if (!host) return;
        var el = host.querySelector('.adp2-kwp[data-key="' + key.replace(/"/g, '') + '"] [data-kstatus]'); if (el) el.innerHTML = kwStatusHtml(key);
    }
    function kwSetBid(key, k, val, now) {
        var st = S.kw[key], r = kwFind(key, k); if (!st || !r || !st.editable) return;
        var lo = Math.max(1, r.bidMin ? Math.floor(r.bidMin * 0.3) : 1);
        val = Math.round(Math.max(lo, Math.min(50000, Number(val) || 0)));
        if (kwBid(st, r) === val) { kwSoft(key, $('adv-pulse').querySelector('.adp2-kwp[data-key="' + key.replace(/"/g, '') + '"]')); return; }
        if (!st.prev) st.prev = {}; if (st.prev[k] == null) st.prev[k] = r.bid;
        st.ov[k] = val; kwRender(key);
        clearTimeout(S.timers['kw' + key + k]);
        S.timers['kw' + key + k] = setTimeout(function () {
            var cur = st.ov[k]; if (cur == null) return;
            var was = st.prev[k]; delete st.prev[k];
            kwEnqueue(key, { type: 'bid', nm: r.nmId, q: r.normQuery, k: k, val: cur });
            kwStatus(key);
            if (was != null && was !== cur) toast('«' + esc(r.normQuery) + '»: ' + fmtSom(was) + ' → ' + fmtSom(cur), { label: 'Отменить', fn: function () { kwSetBid(key, k, was, true); } });
        }, now ? 0 : 700);
    }
    function kwSetOff(key, keys, off, silent) {
        var st = S.kw[key]; if (!st) return;
        var changed = [];
        keys.forEach(function (k) { var r = kwFind(key, k); if (!r || kwOff(st, r) === off) return; st.mn[k] = off; changed.push(r); });
        if (!changed.length) return;
        changed.forEach(function (r) { kwEnqueue(key, { type: 'minus', nm: r.nmId, q: r.normQuery, k: kwKey(r), off: off }); });
        kwRender(key);
        if (!silent) toast(off ? 'Убрано ключей: ' + changed.length : 'Возвращено ключей: ' + changed.length, off ? { label: 'Вернуть', fn: function () { kwSetOff(key, changed.map(kwKey), false, true); } } : null);
    }
    function kwBulk(key, how) {
        var st = S.kw[key]; if (!st) return;
        var keys = Object.keys(st.sel);
        if (how === 'clear') { st.sel = {}; kwRender(key); return; }
        if (how === 'off') { st.sel = {}; kwSetOff(key, keys, true); return; }
        keys.forEach(function (k) {
            var r = kwFind(key, k); if (!r) return;
            var cur = kwBid(st, r);
            kwSetBid(key, k, how === 'mid' ? (r.bidMedium || cur) : cur + Number(how), true);
        });
        st.sel = {}; kwRender(key);
    }
    function kwWasteFlow(key) {
        var st = S.kw[key]; if (!st) return;
        var w = kwWaste(st); if (!w.n) return;
        var m = modal('<div class="adp2-mh"><b>Убрать ключи без заказов?</b><button type="button" data-close="1" class="adp2-x" aria-label="Закрыть">✕</button></div>' +
            '<p class="adp2-mut" style="font-size:13px">Ключей: <b>' + w.n + '</b>, слито без заказов: <b>' + fmtSom(Math.round(w.sum)) + ' ₽</b>. Они перестанут показываться. Вернуть можно в любой момент (переключатель справа у ключа).</p>' +
            '<div class="adp2-mf"><button type="button" class="adp2-gh" data-close="1">Отмена</button><button type="button" class="adp2-go" id="adp2-wok">Убрать ' + w.n + '</button></div>');
        $('adp2-wok').addEventListener('click', function () { m.close(); kwSetOff(key, w.items.map(kwKey), true); });
    }

    /* ───────── пополнение баланса кампании ───────── */
    function topupFlow(key) {
        var f = findCamp(key); if (!f) return;
        var cur = balOf(key, f.camp), presets = [500, 1000, 2000, 5000], sel = 1000, busy = false;
        var m = modal('<div class="adp2-mh"><b>Пополнить РК</b><button type="button" data-close="1" class="adp2-x" aria-label="Закрыть">✕</button></div>' +
            '<p class="adp2-mut" style="font-size:13px;margin:0 0 10px"><b>' + esc(f.camp.name) + '</b> · № ' + esc(f.camp.wbId) + '<br>Сейчас на балансе: <b>' + (cur == null ? '—' : fmtInt(cur) + ' ₽') + '</b></p>' +
            '<div class="adp2-pre" id="adp2-pre">' + presets.map(function (v) { return '<button type="button" data-sum="' + v + '" class="' + (v === sel ? 'on' : '') + '">' + fmtInt(v) + ' ₽</button>'; }).join('') + '</div>' +
            '<label class="adp2-mut" style="font-size:12px;display:block;margin:10px 0 4px">Или другая сумма, от 500 ₽</label>' +
            '<input type="text" inputmode="numeric" id="adp2-sum" class="adp2-num" style="width:100%;font-size:16px" value="' + sel + '" aria-label="Сумма пополнения">' +
            '<p class="adp2-mut" style="font-size:12px;margin:10px 0 0">Деньги спишутся с баланса рекламного кабинета WB и придут на эту кампанию.</p>' +
            '<div class="adp2-mf"><button type="button" class="adp2-gh" data-close="1">Отмена</button><button type="button" class="adp2-go" id="adp2-dep">Пополнить на ' + fmtInt(sel) + ' ₽</button></div>');
        var inp = $('adp2-sum'), go = $('adp2-dep');
        function val() { return Math.round(Number(String(inp.value).replace(/[^\d]/g, '')) || 0); }
        function sync() {
            var v = val();
            m.el.querySelectorAll('#adp2-pre button').forEach(function (b) { b.classList.toggle('on', Number(b.dataset.sum) === v); });
            go.disabled = v < 500 || v > 1000000;
            go.textContent = v < 500 ? 'Минимум 500 ₽' : 'Пополнить на ' + fmtInt(v) + ' ₽';
        }
        m.el.querySelector('#adp2-pre').addEventListener('click', function (e) { var b = e.target.closest('button[data-sum]'); if (b) { inp.value = b.dataset.sum; sync(); } });
        inp.addEventListener('input', sync);
        go.addEventListener('click', function () {
            if (busy) return; var sum = val(); if (sum < 500 || sum > 1000000) return; busy = true;
            m.close();
            var before = S.bal[key], base = balOf(key, f.camp);
            // Баланс на экране меняется сразу; если WB откажет, возвращаем прежний и говорим об этом.
            S.bal[key] = (base || 0) + sum; patchRow(key);
            Promise.resolve(call('advert_deposit', { advertId: f.camp.wbId, sum: sum }, f.cab.id)).then(function (res) {
                if (res && res.total != null && isFinite(Number(res.total))) S.bal[key] = Number(res.total);
                patchRow(key);
                toast('Баланс пополнен на ' + fmtInt(sum) + ' ₽');
                setTimeout(function () { if (root.AdsHQ && root.AdsHQ.load) root.AdsHQ.load(); }, 2500);
            }).catch(function (e) {
                if (before == null) delete S.bal[key]; else S.bal[key] = before;
                patchRow(key);
                toast('Не удалось пополнить: ' + esc(String((e && e.message) || e || 'WB не ответил')) + '. Повторите', { label: 'Повторить', fn: function () { topupFlow(key); } });
            });
        });
        setTimeout(function () { try { inp.focus(); inp.select(); } catch (e) {} }, 50);
    }

    /* ───────── события ───────── */
    function onClick(e) {
        // клик по затемнению вокруг окна кампании закрывает его
        if (e.target.classList && e.target.classList.contains('adp2-row') && e.target.classList.contains('open')) { var ck = e.target.dataset.key; S.open[ck] = false; patchRow(ck); return; }
        var t = e.target.closest('[data-pact]');
        closeMenus(t && t.closest('.cw-dots'));
        if (!t) return;
        var key = t.dataset.key, act = t.dataset.pact;
        if (act === 'open') {
            if (e.target.closest('.adp2-bw') && !e.target.closest('.adp2-range,.adp2-load')) return;
            var wasOpen = !!S.open[key];
            Object.keys(S.open).forEach(function (k) { if (S.open[k] && k !== key) { S.open[k] = false; patchRow(k); } });
            S.open[key] = !wasOpen;
            if (S.open[key]) { var f = findCamp(key); if (f) artsOf(f.cab.id).then(function () { patchRow(key); }); ensureInfo(key); }
            patchRow(key);
        } else if (act === 'load') { ensureInfo(key); patchRow(key); }
        else if (act === 'step') {
            var w = t.closest('.adp2-bid'), f2 = findCamp(w.dataset.key); if (!f2) return;
            var e2 = entriesOf(w.dataset.key, f2.camp).filter(function (x) { return x.nm === Number(w.dataset.nm) && x.placement === w.dataset.pl; })[0]; if (!e2) return;
            applyBid(w.dataset.key, e2.nm, e2.placement, e2.kop + Number(t.dataset.dir) * somToKop(stepSom(payKind(f2.camp))));
        }
        else if (act === 'rm') { closeMenus(); removeProduct(key, Number(t.dataset.nm)); }
        else if (act === 'addp') addProductsFlow(key);
        else if (act === 'topup') topupFlow(key);
        else if (act === 'toggle') togglePause(key);
        else if (act === 'rowmenu') { var dd = t.closest('.cw-dots'); dd.classList.toggle('open'); }
        else if (act === 'copyid') { var idv = String(t.dataset.id || ''); try { Promise.resolve(root.navigator.clipboard.writeText(idv)).catch(function () {}); } catch (er) { /* без буфера */ } toast('Номер ' + esc(idv) + ' скопирован', null); }
        else if (act === 'refill') { if (!t.disabled) refillFlow(key); }
        else if (act === 'limit') { var fl = findCamp(key); if (fl && !t.disabled) setLimitFlow(key, { on: !limitState(key, fl.camp).on }); }
        else if (act === 'carry') { var fc = findCamp(key); if (fc && !t.disabled) setLimitFlow(key, { carryOver: !limitState(key, fc.camp).carry }); }
        else if (act === 'zone') { if (!t.disabled) zoneFlow(key, t.dataset.zone); }
        else if (act === 'finish') { if (!t.disabled) finishFlow(key); }
        else if (act === 'hist') { if (!t.disabled) historyFlow(key); }
        else if (act === 'rename') { if (!t.disabled) renameFlow(key); }
        else if (act === 'pos') { var fp = findCamp(key); if (fp && root.AdsHQ && root.AdsHQ.setCampPos) root.AdsHQ.setCampPos(fp.cab.id, fp.camp.wbId, Number(t.dataset.pos)); }
        else if (act === 'retry') retryOps(key);
        else if (act === 'drop') dropOps(key);
        else if (act === 'vretry') { var o = S.ops[t.dataset.v]; if (o) { o.tries = 0; send(t.dataset.v); render(); } }
        else if (act === 'vdrop') { S.virtual = S.virtual.filter(function (x) { return x.opId !== t.dataset.v; }); delete S.ops[t.dataset.v]; render(); }
        else if (act === 'new') createFlow();
        else if (act === 'tab') { S.kwTab[key] = t.dataset.tab; patchRow(key); }
        else if (act === 'kload') { loadKw(key, true); }
        else if (act === 'kfilter') { var s1 = kwState(key); s1.filter = t.dataset.f; s1.limit = 40; kwRender(key); }
        else if (act === 'kmore') { kwState(key).limit += 40; kwRender(key); }
        else if (act === 'kwaste') kwWasteFlow(key);
        else if (act === 'kbulk') kwBulk(key, t.dataset.b);
        else if (act === 'kminus') { var s2 = kwState(key), r2 = kwFind(key, t.dataset.k); if (r2) kwSetOff(key, [t.dataset.k], !kwOff(s2, r2)); }
        else if (act === 'kmark') kwSetBid(key, t.dataset.k, Number(t.dataset.v), true);
        else if (act === 'kstep') { var w2 = t.closest('.adp2-kb'), s3 = kwState(w2.dataset.key), r3 = kwFind(w2.dataset.key, w2.dataset.k); if (r3) kwSetBid(w2.dataset.key, w2.dataset.k, kwBid(s3, r3) + Number(t.dataset.dir) * kwStep()); }
        else if (act === 'kretry') { (S.kwOps[key] || []).forEach(function (o) { if (o.status === 'error') { o.status = 'pending'; o.tries = 0; o.at = 0; } }); kwPump(); kwStatus(key); }
        else if (act === 'kdrop') {
            var st4 = kwState(key);
            S.kwOps[key] = (S.kwOps[key] || []).filter(function (o) { if (o.status !== 'error') return true; if (o.type === 'bid') delete st4.ov[o.k]; else delete st4.mn[o.k]; return false; });
            kwRender(key);
        }
    }
    function bidFrom(w, kopFromSom) {
        var f = findCamp(w.dataset.key); if (!f) return;
        applyBid(w.dataset.key, Number(w.dataset.nm), w.dataset.pl, kopFromSom);
    }
    function onInput(e) {
        var tg = e.target;
        if (tg.classList.contains('adp2-kr')) { var kb = tg.closest('.adp2-k'), kk = tg.closest('.adp2-kwp').dataset.key; kwSetBid(kk, kb.dataset.k, Number(tg.value)); return; }
        if (tg.classList.contains('adp2-ksearch')) { var s5 = kwState(tg.dataset.key); s5.q = tg.value; s5.limit = 40; var pos = tg.selectionStart; var pan = tg.closest('.adp2-kwp'); var f5 = findCamp(tg.dataset.key); if (pan && f5) { var kl = pan.querySelector('.adp2-klist'); var tmp = doc.createElement('div'); tmp.innerHTML = kwHtml(tg.dataset.key, f5.cab, f5.camp); var nl = tmp.querySelector('.adp2-klist'); if (kl && nl) kl.innerHTML = nl.innerHTML; } return; }
        var w = e.target.closest('.adp2-bid'); if (!w) return;
        if (e.target.classList.contains('adp2-rg')) { bidFrom(w, somToKop(e.target.value)); var nu = w.querySelector('.adp2-num'); nu.value = e.target.value; }
    }
    function onChange(e) {
        var tg = e.target;
        if (tg.classList.contains('cw-limit-in')) {
            var lk = tg.dataset.key, lf = findCamp(lk), lv = parseFloat(String(tg.value).replace(',', '.').replace(/\s/g, ''));
            if (!lf) return;
            if (!isFinite(lv) || lv < LIMIT_MIN_SOM) { toast('Дневной лимит: от ' + LIMIT_MIN_SOM + ' KGS', null); var cl = limitState(lk, lf.camp); tg.value = cl.kop ? String(kopToSom(cl.kop)) : ''; return; }
            setLimitFlow(lk, { on: true, amountKop: somToKop(lv) }); return;
        }
        if (tg.classList.contains('adp2-ksort')) { kwState(tg.dataset.key).sort = tg.value; kwRender(tg.dataset.key); return; }
        if (tg.dataset && tg.dataset.pact === 'ksel') { var s6 = kwState(tg.dataset.key); if (tg.checked) s6.sel[tg.dataset.k] = 1; else delete s6.sel[tg.dataset.k]; kwRender(tg.dataset.key); return; }
        if (tg.classList.contains('adp2-kn')) {
            var wb = tg.closest('.adp2-kb'), v = parseFloat(String(tg.value).replace(',', '.').replace(/\s/g, ''));
            if (!isFinite(v) || v <= 0) { kwSoft(wb.dataset.key, tg.closest('.adp2-kwp')); return; }
            kwSetBid(wb.dataset.key, wb.dataset.k, v); return;
        }
        var w = e.target.closest('.adp2-bid'); if (!w) return;
        if (e.target.classList.contains('adp2-num')) {
            var v = parseFloat(String(e.target.value).replace(',', '.').replace(/\s/g, ''));
            if (!isFinite(v) || v <= 0) { refreshBid(w.dataset.key); return; }
            bidFrom(w, somToKop(v));
        }
    }
    function onKey(e) {
        if (e.target.classList && (e.target.classList.contains('adp2-num') || e.target.classList.contains('adp2-kn') || e.target.classList.contains('cw-limit-in')) && e.key === 'Enter') { e.target.blur(); }
        if (e.target.classList && e.target.classList.contains('adp2-num') && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
            e.preventDefault(); var w = e.target.closest('.adp2-bid'), f = findCamp(w.dataset.key); if (!f) return;
            var en = entriesOf(w.dataset.key, f.camp).filter(function (x) { return x.nm === Number(w.dataset.nm) && x.placement === w.dataset.pl; })[0];
            if (en) applyBid(w.dataset.key, en.nm, en.placement, en.kop + (e.key === 'ArrowUp' ? 1 : -1) * somToKop(stepSom(payKind(f.camp))));
        }
    }

    /* ───────── переключатель вида и запуск ───────── */
    function setView(v) {
        S.view = v === 'table' ? 'table' : 'pulse';
        try { root.localStorage.setItem('nr_ads_view', S.view); } catch (e) { /* без хранилища просто не запомним */ }
        var wrap = $('adv-view-ads'); if (wrap) wrap.classList.toggle('adp2-on', S.view === 'pulse');
        doc.querySelectorAll('[data-pulse-view]').forEach(function (b) { b.classList.toggle('on', b.dataset.pulseView === S.view); });
        if (S.view === 'pulse') render();
    }
    function mountSwitch() {
        if ($('adp2-switch')) return;
        var bar = doc.querySelector('#adv-view-ads .ads-hq-filters'); if (!bar) return;
        var sw = doc.createElement('div'); sw.id = 'adp2-switch'; sw.className = 'adp2-switch';
        sw.innerHTML = '<button type="button" class="adp2-newbtn" data-pact="new" id="adp2-new">＋ Новая РК</button>' +
            '<button type="button" class="adp2-tab on" data-list-view="campaigns">Кампании</button><button type="button" class="adp2-tab" data-list-view="products">Товары</button>';
        bar.appendChild(sw);
        sw.addEventListener('click', function (e) {
            var b = e.target.closest('[data-pulse-view]'); if (b) { setView(b.dataset.pulseView); return; }
            var t = e.target.closest('.adp2-tab'); if (t) { sw.querySelectorAll('.adp2-tab').forEach(function (x) { x.classList.toggle('on', x === t); }); return; }
            if (e.target.closest('[data-pact="new"]')) createFlow();
        });
        // Вкладок «Активные» и «Все» больше нет: список всегда показывает все кампании.
        try { if (root.AdsHQ && root.AdsHQ.setCampFilter) root.AdsHQ.setCampFilter('all'); } catch (e) { /* список остаётся как был */ }
        mountGear();
    }
    /* Шестерёнка: значки списка (автопилот, поиск, обновить, колонки) выпадают списком, страница затемняется как при выборе даты и кабинета. */
    function mountGear() {
        var bulk = doc.querySelector('#adv-view-ads .ads-hq-bulk'), tools = $('ads-hq-tools'), view = $('adv-view-ads');
        if (!bulk || !tools || !view || $('adp2-gear')) return;
        var g = doc.createElement('button'); g.type = 'button'; g.id = 'adp2-gear'; g.className = 'adp2-gear';
        g.setAttribute('aria-label', 'Настройки списка'); g.setAttribute('aria-expanded', 'false');
        g.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';
        bulk.insertBefore(g, tools);
        // Подписи пунктов выпадающего списка берём из title значков и держим в актуальном виде
        function label(b) {
            var l = b.querySelector('.adp2-lbl'); if (!l) { l = doc.createElement('span'); l.className = 'adp2-lbl'; b.appendChild(l); }
            var t = b.getAttribute('title') || b.getAttribute('aria-label') || ''; if (l.textContent !== t) l.textContent = t;
        }
        function labels() { tools.querySelectorAll('.rnp-tool-icon, .ads-hq-search-btn').forEach(label); }
        labels();
        if (root.MutationObserver) new root.MutationObserver(function () { labels(); }).observe(tools, { subtree: true, attributes: true, attributeFilter: ['title'] });
        function set(open) { view.classList.toggle('ads-gear-open', open); g.setAttribute('aria-expanded', open ? 'true' : 'false'); }
        g.addEventListener('click', function (e) { e.stopPropagation(); set(!view.classList.contains('ads-gear-open')); });
        doc.addEventListener('click', function (e) {
            if (!view.classList.contains('ads-gear-open')) return;
            if (e.target.closest('#ads-hq-reload')) { set(false); return; }
            if (!e.target.closest('#ads-hq-tools, #adp2-gear')) set(false);
        });
        doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') set(false); });
        // На широком экране поле поиска стоит прямо в панели, на телефоне остаётся в списке
        var wrap = $('ads-hq-search-wrap');
        if (wrap && root.matchMedia) {
            var mq = root.matchMedia('(min-width: 761px)');
            var place = function () { if (mq.matches) bulk.insertBefore(wrap, g); else tools.insertBefore(wrap, tools.firstChild); wrap.classList.toggle('adp2-inline', mq.matches); };
            place(); if (mq.addEventListener) mq.addEventListener('change', place);
        }
    }
    function init(deps) {
        if (S.inited) { S.deps = deps || S.deps; return; }
        S.deps = deps;
        // Если #adv-pulse ещё не в DOM (вкладка открылась раньше, чем вставилась разметка) —
        // не помечаем инициализацию выполненной: следующий вызов (следующий заход на вкладку)
        // должен попробовать снова, а не молча остаться ни с чем навсегда.
        var host = $('adv-pulse'); if (!host) return;
        S.inited = true;
        S.view = 'pulse'; // таблица убрана: один вид, список как в макете
        doc.addEventListener('keydown', function (e) { if (e.key !== 'Escape' || doc.querySelector('.adp2-ov')) return; Object.keys(S.open).forEach(function (k) { if (S.open[k]) { S.open[k] = false; patchRow(k); } }); });
        doc.addEventListener('advctl:change', function (e) { var k = e && e.detail && e.detail.key; if (k && S.open[k]) patchRow(k); });
        host.addEventListener('click', onClick); host.addEventListener('input', onInput); host.addEventListener('change', onChange); host.addEventListener('keydown', onKey);
        mountSwitch();
        if (root.AdsHQ && root.AdsHQ.onRendered) root.AdsHQ.onRendered(function () { if (S.view === 'pulse') render(); });
        setView(S.view);
    }

    var api = { init: init, setView: setView, render: render, payKind: payKind, kopToSom: kopToSom, somToKop: somToKop, stepSom: stepSom, clampKop: clampKop, badge: badge, fmtSom: fmtSom, parseAdvertInfo: parseAdvertInfo, effectiveNms: effectiveNms, _state: S };
    root.AdsPulse = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

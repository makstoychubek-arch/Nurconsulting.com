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
    var S = {
        deps: null, rows: [], open: {}, tab: {}, info: {}, ov: {}, ops: {}, timers: {}, arts: {}, virtual: [],
        view: 'pulse', polling: 0, queue: [], qBusy: false, toastTimer: 0, undo: null,
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
        }).catch(function () { rec.loaded = true; return rec; });
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
    function drrPill(camp) {
        var d = (root.AdsHQ && root.AdsHQ.formatDrr) ? root.AdsHQ.formatDrr(camp) : '';
        if (!camp.live) return '<span class="adp2-pill off">пауза</span>';
        var n = parseFloat(String(d).replace(',', '.'));
        var cl = isFinite(n) ? (n < 9 ? 'ok' : n < 13 ? 'wa' : 'bad') : '';
        return '<span class="adp2-pill ' + cl + '">ДРР ' + esc(d || '—') + '</span>';
    }
    function bidControlHtml(key, camp, kind) {
        var inf = S.info[key], list = entriesOf(key, camp);
        if (String(camp.bidType).toLowerCase() === 'unified' && !list.length && !(inf && inf.loaded)) {
            return inf && inf.loading ? '<span class="adp2-skel"></span>' : '<button type="button" class="adp2-load" data-pact="load" data-key="' + esc(key) + '">Показать ставку</button>';
        }
        if (!list.length) return inf && inf.loading ? '<span class="adp2-skel"></span>' : (inf && inf.error ? '<span class="adp2-mut">ставка недоступна</span>' : '<button type="button" class="adp2-load" data-pact="load" data-key="' + esc(key) + '">Показать ставку</button>');
        var nmSet = {}; list.forEach(function (e) { nmSet[e.nm] = 1; });
        if (Object.keys(nmSet).length > 1) {
            var vals = list.map(function (e) { return e.kop; }), lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
            return '<button type="button" class="adp2-range" data-pact="open" data-key="' + esc(key) + '">' + fmtSom(kopToSom(lo)) + (hi !== lo ? '–' + fmtSom(kopToSom(hi)) : '') + ' ₽ · ' + Object.keys(nmSet).length + ' тов.</button>';
        }
        return stepperHtml(key, list[0], kind, minKop(key, list[0].nm));
    }
    function stepperHtml(key, e, kind, min) {
        var st = stepSom(kind), som = kopToSom(e.kop), lo = kopToSom(min), hi = Math.max(som * 2, lo * 3, som + 50);
        return '<div class="adp2-bid" data-key="' + esc(key) + '" data-nm="' + e.nm + '" data-pl="' + esc(e.placement) + '">' +
            '<button type="button" data-pact="step" data-dir="-1" aria-label="Меньше">−</button>' +
            '<input type="range" class="adp2-rg" min="' + lo + '" max="' + Math.ceil(hi) + '" step="' + st + '" value="' + som + '" aria-label="Ставка">' +
            '<button type="button" data-pact="step" data-dir="1" aria-label="Больше">+</button>' +
            '<input type="text" inputmode="decimal" class="adp2-num' + (e.changed ? ' ch' : '') + '" value="' + fmtSom(som).replace(/ /g, '') + '" aria-label="Ставка в сомах">' +
            '</div>';
    }
    function productsHtml(key, cab, camp) {
        var info = S.info[key], nms = effectiveNms(info ? info.nms : [], S.ov[key]);
        var list = entriesOf(key, camp), kind = payKind(camp);
        if (!info || !info.loaded) return '<div class="adp2-load-line">Загружаем товары кампании…</div>';
        var rows = nms.map(function (nm) {
            var e = list.filter(function (x) { return x.nm === nm; })[0];
            var adding = S.ov[key] && S.ov[key].add[nm];
            return '<div class="adp2-pr">' + thumb(cab.id, nm) + '<div class="adp2-prn"><b>' + esc(artName(cab.id, nm)) + '</b><small>' + nm + (adding ? ' · добавляется…' : '') + '</small></div>' +
                (e ? stepperHtml(key, e, kind, minKop(key, nm)) : '<span class="adp2-mut">ставка появится после добавления</span>') +
                '<button type="button" class="adp2-x" data-pact="rm" data-key="' + esc(key) + '" data-nm="' + nm + '" title="Убрать из кампании" aria-label="Убрать товар">✕</button></div>';
        }).join('');
        return '<div class="adp2-prs">' + rows + '<button type="button" class="adp2-addp" data-pact="addp" data-key="' + esc(key) + '">＋ Добавить товар</button></div>';
    }
    function rowHtml(cab, camp) {
        var key = keyOf(cab, camp), kind = payKind(camp), open = !!S.open[key];
        var ov = S.ov[key], live = ov && ov.paused != null ? !ov.paused : camp.live;
        var c = Object.assign({}, camp, { live: live });
        var info = S.info[key], nmCount = info && info.loaded ? effectiveNms(info.nms, ov).length : (camp.nmId ? 1 : 0);
        return '<article class="adp2-row' + (open ? ' open' : '') + (live ? '' : ' off') + '" data-key="' + esc(key) + '">' +
            '<div class="adp2-head" data-pact="open" data-key="' + esc(key) + '">' +
            '<div class="adp2-tc">' + badge(kind, 'xl') + '</div>' +
            '<div class="adp2-nm"><b><span class="adp2-dot' + (live ? '' : ' off') + '"></span>' + esc(camp.name) + '</b><small>' + unitText(kind) + ' · № ' + esc(camp.wbId) + (nmCount ? ' · ' + nmCount + ' тов.' : '') + '</small></div>' +
            '<div class="adp2-st">' + drrPill(c) + '</div>' +
            '<div class="adp2-bw" data-nostop="1">' + bidControlHtml(key, camp, kind) + '</div>' +
            '<div class="adp2-ch" data-chipbox="1">' + chipHtml(key) + '</div>' +
            '<span class="adp2-cv">⌄</span></div>' +
            (open ? '<div class="adp2-body"><div class="adp2-bar">' +
                '<button type="button" data-pact="toggle" data-key="' + esc(key) + '" class="adp2-tg ' + (live ? 'on' : '') + '">' + (live ? 'Поставить на паузу' : 'Запустить') + '</button>' +
                '<span class="adp2-mut">Показы ' + fmtSom(camp.views) + ' · клики ' + fmtSom(camp.clicks) + ' · заказы ' + fmtSom(camp.orders) + ' · расход ' + fmtSom(camp.spendToday) + '</span></div>' +
                productsHtml(key, cab, camp) + '</div>' : '') +
            '</article>';
    }
    function virtualHtml() {
        return S.virtual.map(function (v) {
            var o = S.ops[v.opId] || {};
            var st = o.status === 'error' ? '<span class="adp2-chip bad">⚠ ' + esc(o.err || 'не создалась') + ' <button type="button" data-pact="vretry" data-v="' + esc(v.opId) + '">Повторить</button> <button type="button" data-pact="vdrop" data-v="' + esc(v.opId) + '">Убрать</button></span>' :
                '<span class="adp2-chip wait">Создаётся в WB…</span>';
            return '<article class="adp2-row virt"><div class="adp2-head"><div class="adp2-tc">' + badge(v.kind, 'xl') + '</div><div class="adp2-nm"><b><span class="adp2-dot"></span>' + esc(v.name) + '</b><small>новая кампания · ' + v.nms.length + ' тов.</small></div><div class="adp2-st"></div><div class="adp2-bw"></div><div class="adp2-ch">' + st + '</div></div></article>';
        }).join('');
    }

    function render() {
        var host = $('adv-pulse'); if (!host || S.view !== 'pulse') return;
        S.rows = (root.AdsHQ && root.AdsHQ.getVisibleRows) ? root.AdsHQ.getVisibleRows() : [];
        var total = 0, html = '';
        S.rows.forEach(function (cab) {
            if (S.rows.length > 1 && cab.campaigns.length) html += '<h3 class="adp2-cab">' + esc(cab.name) + '</h3>';
            cab.campaigns.forEach(function (camp) { total++; html += rowHtml(cab, camp); });
        });
        if (!root.AdsHQ || !root.AdsHQ.getModelReady || !root.AdsHQ.getModelReady()) html = '<div class="adp2-empty"><span class="adp2-skel big"></span><span class="adp2-skel big"></span><span class="adp2-skel big"></span></div>';
        else if (!total && !S.virtual.length) html = '<div class="adp2-empty">Кампаний по выбранному фильтру нет. Нажмите «Новая РК», чтобы создать.</div>';
        host.innerHTML = virtualHtml() + html;
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
        el.replaceWith(tmp.firstChild);
    }
    function refreshBid(key) {
        var host = $('adv-pulse'), f = findCamp(key); if (!host || !f) return;
        var list = entriesOf(key, f.camp);
        host.querySelectorAll('.adp2-bid[data-key="' + key.replace(/"/g, '') + '"]').forEach(function (w) {
            var e = list.filter(function (x) { return x.nm === Number(w.dataset.nm) && x.placement === w.dataset.pl; })[0]; if (!e) return;
            var rg = w.querySelector('.adp2-rg'), nu = w.querySelector('.adp2-num');
            if (rg) rg.value = kopToSom(e.kop);
            if (nu && doc.activeElement !== nu) nu.value = fmtSom(kopToSom(e.kop)).replace(/ /g, '');
            if (nu) nu.classList.toggle('ch', !!e.changed);
        });
        var el = host.querySelector('.adp2-row[data-key="' + key.replace(/"/g, '') + '"] [data-chipbox]'); if (el) el.innerHTML = chipHtml(key);
        var range = host.querySelector('.adp2-row[data-key="' + key.replace(/"/g, '') + '"] .adp2-range');
        if (range) { var vals = list.map(function (e) { return e.kop; }); range.textContent = fmtSom(kopToSom(Math.min.apply(null, vals))) + (Math.max.apply(null, vals) !== Math.min.apply(null, vals) ? '–' + fmtSom(kopToSom(Math.max.apply(null, vals))) : '') + ' ₽ · ' + list.length + ' тов.'; }
    }

    /* ───────── всплывающее: сообщение, выбор товара, мастер ───────── */
    function toast(html, action) {
        var t = $('adp2-toast'); if (!t) { t = doc.createElement('div'); t.id = 'adp2-toast'; t.className = 'adp2-toast'; t.setAttribute('role', 'status'); doc.body.appendChild(t); }
        t.innerHTML = '<span>' + html + '</span>' + (action ? '<button type="button" id="adp2-toast-act">' + esc(action.label) + '</button>' : '');
        t.classList.add('on');
        if (action) $('adp2-toast-act').onclick = function () { t.classList.remove('on'); action.fn(); };
        clearTimeout(S.toastTimer); S.toastTimer = setTimeout(function () { t.classList.remove('on'); }, action ? 6500 : 3500);
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

    /* ───────── события ───────── */
    function onClick(e) {
        var t = e.target.closest('[data-pact]'); if (!t) return;
        var key = t.dataset.key, act = t.dataset.pact;
        if (act === 'open') {
            if (e.target.closest('.adp2-bw') && !e.target.closest('.adp2-range,.adp2-load')) return;
            S.open[key] = !S.open[key];
            if (S.open[key]) { var f = findCamp(key); if (f) artsOf(f.cab.id).then(function () { patchRow(key); }); ensureInfo(key); }
            patchRow(key);
        } else if (act === 'load') { ensureInfo(key); patchRow(key); }
        else if (act === 'step') {
            var w = t.closest('.adp2-bid'), f2 = findCamp(w.dataset.key); if (!f2) return;
            var e2 = entriesOf(w.dataset.key, f2.camp).filter(function (x) { return x.nm === Number(w.dataset.nm) && x.placement === w.dataset.pl; })[0]; if (!e2) return;
            applyBid(w.dataset.key, e2.nm, e2.placement, e2.kop + Number(t.dataset.dir) * somToKop(stepSom(payKind(f2.camp))));
        }
        else if (act === 'rm') removeProduct(key, Number(t.dataset.nm));
        else if (act === 'addp') addProductsFlow(key);
        else if (act === 'toggle') togglePause(key);
        else if (act === 'retry') retryOps(key);
        else if (act === 'drop') dropOps(key);
        else if (act === 'vretry') { var o = S.ops[t.dataset.v]; if (o) { o.tries = 0; send(t.dataset.v); render(); } }
        else if (act === 'vdrop') { S.virtual = S.virtual.filter(function (x) { return x.opId !== t.dataset.v; }); delete S.ops[t.dataset.v]; render(); }
        else if (act === 'new') createFlow();
    }
    function bidFrom(w, kopFromSom) {
        var f = findCamp(w.dataset.key); if (!f) return;
        applyBid(w.dataset.key, Number(w.dataset.nm), w.dataset.pl, kopFromSom);
    }
    function onInput(e) {
        var w = e.target.closest('.adp2-bid'); if (!w) return;
        if (e.target.classList.contains('adp2-rg')) { bidFrom(w, somToKop(e.target.value)); var nu = w.querySelector('.adp2-num'); nu.value = e.target.value; }
    }
    function onChange(e) {
        var w = e.target.closest('.adp2-bid'); if (!w) return;
        if (e.target.classList.contains('adp2-num')) {
            var v = parseFloat(String(e.target.value).replace(',', '.').replace(/\s/g, ''));
            if (!isFinite(v) || v <= 0) { refreshBid(w.dataset.key); return; }
            bidFrom(w, somToKop(v));
        }
    }
    function onKey(e) {
        if (e.target.classList && e.target.classList.contains('adp2-num') && e.key === 'Enter') { e.target.blur(); }
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
        sw.innerHTML = '<button type="button" class="ads-hq-chip" data-pulse-view="pulse">Пульт</button><button type="button" class="ads-hq-chip" data-pulse-view="table">Таблица</button>' +
            '<button type="button" class="adp2-newbtn" data-pact="new" id="adp2-new">＋ Новая РК</button>';
        bar.appendChild(sw);
        sw.addEventListener('click', function (e) {
            var b = e.target.closest('[data-pulse-view]'); if (b) { setView(b.dataset.pulseView); return; }
            if (e.target.closest('[data-pact="new"]')) createFlow();
        });
    }
    function init(deps) {
        if (S.inited) { S.deps = deps || S.deps; return; }
        S.inited = true; S.deps = deps;
        var saved = ''; try { saved = root.localStorage.getItem('nr_ads_view') || ''; } catch (e) { /* нет хранилища */ }
        S.view = saved === 'table' ? 'table' : 'pulse';
        var host = $('adv-pulse'); if (!host) return;
        host.addEventListener('click', onClick); host.addEventListener('input', onInput); host.addEventListener('change', onChange); host.addEventListener('keydown', onKey);
        mountSwitch();
        if (root.AdsHQ && root.AdsHQ.onRendered) root.AdsHQ.onRendered(function () { if (S.view === 'pulse') render(); });
        setView(S.view);
    }

    var api = { init: init, setView: setView, render: render, payKind: payKind, kopToSom: kopToSom, somToKop: somToKop, stepSom: stepSom, clampKop: clampKop, badge: badge, fmtSom: fmtSom, parseAdvertInfo: parseAdvertInfo, effectiveNms: effectiveNms, _state: S };
    root.AdsPulse = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

/* Управление кампанией из окна кампании: завершить, зоны показов, история.
 * Изменение сразу видно на сайте (локальное состояние + тост), в WB его отправляет очередь adv_ops
 * (функция adv-ops-run, повторы и догон по cron), так же, как ставки в ads-pulse.js. В WB сам не ходит.
 * Чего нет в публичном API WB, то честно отклоняется: Promise.reject({unsupported:true}), AdvCtl.supports это отражает.
 * Подробности по методам: docs/adv-controls-api.md. Ключ кампании: «<id кабинета>:<номер кампании WB>», как в ads-pulse.js. */
(function (root) {
    'use strict';

    /* что реально умеет API WB (см. docs/adv-controls-api.md) */
    var supports = {
        finish: true,          // GET /adv/v0/stop
        setZones: true,        // PUT /adv/v0/auction/placements, только ручная ставка + cpm
        history: true,         // из нашей очереди adv_ops: только то, что сделано через NR Space (журнала у WB нет)
        createdAt: true,       // timestamps.created из v2/adverts
        setLimit: false,       // в API нет
        setAutoRefill: false   // в API нет
    };
    var UNSUPPORTED_TEXT = {
        setLimit: 'Дневной лимит WB не отдаёт в публичном API, поэтому менять его с сайта нельзя. Меняется только в кабинете WB.',
        setAutoRefill: 'Автопополнение бюджета в публичном API WB отсутствует. Включается только в кабинете WB.',
        zonesCpc: 'Зоны показов можно менять только у кампаний с ручной ставкой и оплатой за показы.'
    };

    var S = { deps: null, state: {}, ops: {}, seq: 0 };

    /* ───────── чистые функции (проверяются тестами) ───────── */
    function parseKey(key) {
        var s = String(key == null ? '' : key), i = s.lastIndexOf(':');
        if (i <= 0) return null;
        var advertId = Number(s.slice(i + 1));
        if (!advertId || advertId <= 0) return null;
        return { cab: s.slice(0, i), advertId: advertId };
    }
    /** Зоны можно менять только при ручной ставке и оплате за показы (cpm). Если тип неизвестен, не блокируем: WB сам откажет. */
    function zonesAllowed(info) {
        if (!info) return true;
        var pay = String(info.paymentType || '').toLowerCase(), bid = String(info.bidType || '').toLowerCase();
        if (pay === 'cpc') return false;
        if (/unified|auto|единая/.test(bid)) return false;
        return true;
    }
    function normZones(z) {
        if (!z || typeof z.search !== 'boolean' || typeof z.recommendations !== 'boolean') return null;
        return { search: z.search, recommendations: z.recommendations };
    }
    function zonesText(z) {
        return 'поиск ' + (z.search ? 'включён' : 'выключен') + ', рекомендации ' + (z.recommendations ? 'включены' : 'выключены');
    }
    var KIND_TEXT = {
        finish: function () { return 'Кампания завершена'; },
        set_zones: function (p) { return 'Зоны показов: ' + zonesText({ search: !!p.search, recommendations: !!p.recommendations }); },
        set_bid: function (p) { return 'Ставка по артикулу ' + (p.nm_id || '') + ': ' + ((Number(p.bid_kopecks) || 0) / 100) + ' сом' + (p.placement ? ' (' + p.placement + ')' : ''); },
        add_nm: function (p) { return 'Добавлены товары: ' + ((p.nms || []).length); },
        remove_nm: function (p) { return 'Убраны товары: ' + ((p.nms || []).length); },
        create: function (p) { return 'Кампания создана' + (p.name ? ' («' + p.name + '»)' : ''); }
    };
    var STATUS_TEXT = { pending: 'ждёт отправки', sending: 'отправляется', done: 'готово', error: 'не принято WB' };
    function describeOp(row) {
        var f = KIND_TEXT[row && row.kind];
        return {
            at: row.created_at || null,
            kind: row.kind,
            text: f ? f(row.payload || {}) : 'Изменение',
            status: row.status,
            statusText: STATUS_TEXT[row.status] || '',
            error: row.last_error || null
        };
    }

    /* ───────── окружение ───────── */
    function db() {
        var d = S.deps || (root.AdsPulse && root.AdsPulse._state && root.AdsPulse._state.deps) ||
            (root.AdsHQ && root.AdsHQ.getDeps && root.AdsHQ.getDeps());
        return d && d.supabase;
    }
    function toast(type, title, text, action) {
        if (root.NrUi && root.NrUi.toast) root.NrUi.toast(type, title, text || '', action ? { duration: 7000, action: { label: action.label, onClick: action.fn } } : { duration: 3500 });
    }
    function emit(key) {
        try {
            if (root.document && typeof root.CustomEvent === 'function') root.document.dispatchEvent(new root.CustomEvent('advctl:change', { detail: { key: key, state: S.state[key] || null } }));
        } catch (e) { /* без события тоже работает */ }
    }
    function st(key) { return S.state[key] || (S.state[key] = {}); }

    /** Данные кампании, которые знает экран (тип оплаты, зоны, дата создания), чтобы не угадывать. */
    function register(key, info) {
        var s = st(key); info = info || {};
        ['paymentType', 'bidType', 'status', 'createdAt', 'startedAt'].forEach(function (k) { if (info[k] != null) s[k] = info[k]; });
        var z = normZones(info.zones); if (z && !s.zonesPending) s.zones = z;
        if (info.limit != null) s.limit = info.limit;
        if (info.autoRefill != null) s.autoRefill = info.autoRefill;
        return s;
    }
    function getState(key) { return S.state[key] || null; }

    /* ───────── очередь в WB ───────── */
    function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    function insertOp(cab, advertId, kind, payload) {
        var tries = 0;
        function once() {
            return Promise.resolve(db().from('adv_ops').insert({ cabinet_id: cab, advert_id: advertId, kind: kind, payload: payload }).select('id')).then(function (r) {
                if (r.error || !r.data || !r.data[0]) throw new Error((r.error && r.error.message) || 'не записалось');
                return r.data[0].id;
            }).catch(function (e) {
                tries++;
                if (tries >= 3) throw e;
                return sleep(1500 * tries).then(once);
            });
        }
        return once();
    }
    function runNow(cab, id) {
        try {
            Promise.resolve(db().functions.invoke('adv-ops-run', { body: { cabinet_id: cab, ids: [id] } })).catch(function () { /* догонит cron */ });
        } catch (e) { /* догонит cron */ }
    }
    /** Ждём итога в фоне: экран уже показал результат. Ошибка WB приходит позже тостом с «Повторить». */
    function waitDone(id, deadline) {
        return sleep(3000).then(function () {
            return Promise.resolve(db().from('adv_ops').select('id,status,last_error').eq('id', id)).then(function (r) {
                var row = r && r.data && r.data[0];
                if (row && row.status === 'done') return { ok: true };
                if (row && row.status === 'error') return { ok: false, error: row.last_error || 'WB не принял изменение' };
                if (Date.now() > deadline) return { ok: true, slow: true }; // догонит cron, пугать не будем
                return waitDone(id, deadline);
            }).catch(function () { return Date.now() > deadline ? { ok: true, slow: true } : waitDone(id, deadline); });
        });
    }
    /** Кладёт операцию в очередь; onFail(msg) вызывается, когда очередь или WB не приняли изменение. */
    function enqueue(key, kind, payload, hooks) {
        var k = parseKey(key);
        if (!k || !db()) { Promise.resolve().then(function () { hooks.onFail('Нет связи с сайтом, попробуйте ещё раз'); }); return; }
        insertOp(k.cab, k.advertId, kind, payload).then(function (id) {
            runNow(k.cab, id);
            return waitDone(id, Date.now() + 120000);
        }).then(function (res) {
            if (res.ok) hooks.onDone(res); else hooks.onFail(res.error);
        }).catch(function (e) {
            hooks.onFail('Не удалось сохранить: ' + String((e && e.message) || e));
        });
    }

    /* ───────── действия ───────── */
    function unsupported(what, reason) {
        return Promise.reject({ unsupported: true, what: what, reason: reason || UNSUPPORTED_TEXT[what] || 'WB не поддерживает это действие' });
    }

    function finish(key) {
        var k = parseKey(key);
        if (!k) return Promise.reject({ invalid: true, reason: 'Нет номера кампании' });
        var s = st(key);
        if (s.finished || s.finishing) return Promise.resolve({ queued: false, state: s });
        var prev = s.status;
        s.finishing = true; s.status = 'finishing';
        emit(key);
        toast('info', 'Завершаем кампанию', 'Это нельзя отменить. WB подтвердит в течение минуты.');
        enqueue(key, 'finish', {}, {
            onDone: function () {
                s.finishing = false; s.finished = true; s.status = 'finished';
                emit(key);
                toast('success', 'Кампания завершена');
            },
            onFail: function (msg) {
                s.finishing = false; s.status = prev;
                emit(key);
                toast('error', 'Не удалось завершить', msg, { label: 'Повторить', fn: function () { finish(key); } });
            }
        });
        return Promise.resolve({ queued: true, state: s });
    }

    function setZones(key, zones) {
        var k = parseKey(key);
        if (!k) return Promise.reject({ invalid: true, reason: 'Нет номера кампании' });
        var z = normZones(zones);
        if (!z) return Promise.reject({ invalid: true, reason: 'Нужно указать «Поиск» и «Рекомендации»' });
        if (!z.search && !z.recommendations) return Promise.reject({ invalid: true, reason: 'Должна остаться хотя бы одна зона показов' });
        var s = st(key);
        if (!zonesAllowed(s)) return unsupported('zonesCpc');
        var prev = s.zones || null;
        if (prev && prev.search === z.search && prev.recommendations === z.recommendations) return Promise.resolve({ queued: false, state: s });
        s.zones = z; s.zonesPending = (s.zonesPending || 0) + 1;
        emit(key);
        toast('info', 'Зоны показов', zonesText(z));
        enqueue(key, 'set_zones', { search: z.search, recommendations: z.recommendations }, {
            onDone: function () { s.zonesPending = Math.max(0, (s.zonesPending || 1) - 1); emit(key); },
            onFail: function (msg) {
                s.zonesPending = Math.max(0, (s.zonesPending || 1) - 1);
                if (!s.zonesPending) s.zones = prev;
                emit(key);
                toast('error', 'Зоны не изменились', msg, { label: 'Повторить', fn: function () { setZones(key, z); } });
            }
        });
        return Promise.resolve({ queued: true, state: s });
    }

    function setLimit() { return unsupported('setLimit'); }
    function setAutoRefill() { return unsupported('setAutoRefill'); }

    /** История: наши операции по кампании (adv_ops) и дата создания из WB. Журнала изменений у WB нет. */
    function history(key) {
        var k = parseKey(key);
        if (!k) return Promise.reject({ invalid: true, reason: 'Нет номера кампании' });
        var cl = db();
        if (!cl) return Promise.reject({ error: 'Нет связи с сайтом' });
        return Promise.resolve(cl.from('adv_ops').select('id,kind,payload,status,last_error,created_at')
            .eq('cabinet_id', k.cab).eq('advert_id', k.advertId).order('created_at', { ascending: false }).limit(50)).then(function (r) {
            if (r.error) throw r.error;
            return {
                source: 'nr-space',
                note: 'Показаны изменения, сделанные через NR Space. Журнала правок в кабинете WB публичный API не отдаёт.',
                createdAt: (S.state[key] && S.state[key].createdAt) || null,
                items: (r.data || []).map(describeOp)
            };
        });
    }

    function init(deps) { S.deps = deps || S.deps; }

    var api = {
        init: init, register: register, getState: getState,
        finish: finish, setLimit: setLimit, setAutoRefill: setAutoRefill, setZones: setZones, history: history,
        supports: supports, unsupportedText: UNSUPPORTED_TEXT,
        parseKey: parseKey, zonesAllowed: zonesAllowed, normZones: normZones, describeOp: describeOp, _state: S
    };
    root.AdvCtl = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

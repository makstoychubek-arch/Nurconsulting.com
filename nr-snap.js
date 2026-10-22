/* Общий механизм «упакованной выгрузки» больших таблиц кабинета.
 *
 * Было: каждое устройство качает таблицу страницами по 1000 строк (60 колонок, ключи в каждой строке).
 * Стало: одна компактная выгрузка {cols, rows} за период (RPC nr_pack_rows) + кэш на устройстве (IndexedDB).
 * При следующем открытии спрашиваем у сервера только «подпись» (число строк + сумма хэшей, RPC nr_pack_version):
 * совпала — берём строки из кэша без скачивания, нет — качаем одну свежую выгрузку.
 * Любая ошибка (нет RPC, таймаут, чужая схема) → вернём null, и вызывающий код пойдёт старым путём. */
(function (root) {
    'use strict';

    // Таблица → колонка даты, по которой сервер режет период ('' = без периода). Совпадает с nr_pack_allowed() в SQL.
    var TABLES = { rnp_daily_data: 'date', rnp_articles: '', wb_stocks: '' };
    var DB_NAME = 'nr-snap', STORE = 'p', KEEP = 12, TIMEOUT_MS = 25000;
    var mem = new Map();
    var inflight = new Map();
    var disabled = false;

    // Фильтры вызывающего кода ({op, column, value}) применяем к строкам локально.
    function applyFilters(rows, filters) {
        var fs = (filters || []).filter(function (f) { return f.column !== 'cabinet_id'; });
        if (!fs.length) return rows.slice();
        return rows.filter(function (r) {
            for (var i = 0; i < fs.length; i++) {
                var f = fs[i], v = r[f.column];
                if (f.op === 'eq') { if (String(v) !== String(f.value)) return false; }
                else if (f.op === 'gte') { if (!(v >= f.value)) return false; }
                else if (f.op === 'lte') { if (!(v <= f.value)) return false; }
                else if (f.op === 'in') { if (f.value.map(String).indexOf(String(v)) < 0) return false; }
                else if (f.op === 'notIsNull') { if (v == null) return false; }
                else return false;
            }
            return true;
        });
    }

    // Разбор набора фильтров: что можно отдать серверу (период), что оставить локально.
    function plan(table, filters, columns) {
        if (!(table in TABLES)) return null;
        // Список колонок — просто проекция: в кэше лежит всё, лишнее отрежем при выдаче.
        if (columns && columns !== '*' && /[^\w,\s]/.test(columns)) return null;
        var dcol = TABLES[table], cab = null, from = null, to = null, byItem = false;
        for (var i = 0; i < (filters || []).length; i++) {
            var f = filters[i];
            if (f.op === 'eq' && f.column === 'cabinet_id') cab = f.value;
            else if (dcol && f.column === dcol && f.op === 'gte') from = f.value;
            else if (dcol && f.column === dcol && f.op === 'lte') to = f.value;
            else if (f.op === 'eq' && f.column === 'nm_id') byItem = true;
            else if (['eq', 'gte', 'lte', 'in', 'notIsNull'].indexOf(f.op) < 0) return null;
        }
        if (!cab) return null;
        var proj = (columns && columns !== '*') ? columns.split(',').map(function (c) { return c.trim(); }).filter(Boolean) : null;
        return { cab: String(cab), from: from, to: to, byItem: byItem, proj: proj, key: [table, cab, from || '', to || ''].join('|') };
    }

    function unpack(res) {
        var cols = res.cols, out = new Array(res.rows.length);
        for (var i = 0; i < res.rows.length; i++) {
            var a = res.rows[i], o = {};
            for (var j = 0; j < cols.length; j++) o[cols[j]] = a[j];
            out[i] = o;
        }
        return out;
    }

    function openDb() {
        return new Promise(function (resolve, reject) {
            try {
                var rq = indexedDB.open(DB_NAME, 1);
                rq.onupgradeneeded = function () { rq.result.createObjectStore(STORE); };
                rq.onsuccess = function () { resolve(rq.result); };
                rq.onerror = function () { reject(rq.error); };
            } catch (e) { reject(e); }
        });
    }
    function idbGet(key) {
        return openDb().then(function (db) {
            return new Promise(function (resolve) {
                var rq = db.transaction(STORE).objectStore(STORE).get(key);
                rq.onsuccess = function () { resolve(rq.result || null); };
                rq.onerror = function () { resolve(null); };
            });
        }).catch(function () { return null; });
    }
    function idbPut(key, val) {
        return openDb().then(function (db) {
            return new Promise(function (resolve) {
                var tx = db.transaction(STORE, 'readwrite'), st = tx.objectStore(STORE);
                st.put(val, key);
                // Храним не больше KEEP выгрузок: самые старые выкидываем.
                var all = st.openCursor(), items = [];
                all.onsuccess = function () {
                    var c = all.result;
                    if (c) { items.push([c.key, (c.value && c.value.ts) || 0]); c.continue(); return; }
                    items.sort(function (a, b) { return b[1] - a[1]; }).slice(KEEP).forEach(function (it) { st.delete(it[0]); });
                };
                tx.oncomplete = function () { resolve(); };
                tx.onerror = function () { resolve(); };
            });
        }).catch(function () { /* кэш — это бонус, не обязанность */ });
    }

    function withTimeout(p) {
        return new Promise(function (resolve, reject) {
            var t = setTimeout(function () { reject(new Error('nr-snap timeout')); }, TIMEOUT_MS);
            p.then(function (v) { clearTimeout(t); resolve(v); }, function (e) { clearTimeout(t); reject(e); });
        });
    }

    function rpc(db, name, pl) {
        return withTimeout(Promise.resolve(db.rpc(name, { p_table: pl.table, p_cab: pl.cab, p_from: pl.from, p_to: pl.to })))
            .then(function (r) {
                if (r.error || !r.data) throw new Error((r.error && r.error.message) || 'пустой ответ');
                return r.data;
            });
    }

    async function load(db, table, pl) {
        var cached = mem.get(pl.key) || await idbGet(pl.key);
        if (cached && cached.rows) {
            var v = await rpc(db, 'nr_pack_version', { table: table, cab: pl.cab, from: pl.from, to: pl.to });
            if (v.n === cached.n && v.h === cached.h) { cached.ts = Date.now(); mem.set(pl.key, cached); return cached.rows; }
        }
        var res = await rpc(db, 'nr_pack_rows', { table: table, cab: pl.cab, from: pl.from, to: pl.to });
        var entry = { rows: unpack(res), n: res.n, h: res.h, ts: Date.now() };
        mem.set(pl.key, entry);
        idbPut(pl.key, { rows: entry.rows, n: entry.n, h: entry.h, ts: entry.ts });
        return entry.rows;
    }

    // Возвращает строки или null (значит: идите старым постраничным путём).
    async function fetchRows(db, table, filters, columns) {
        if (disabled || !db || typeof db.rpc !== 'function') return null;
        var pl = plan(table, filters, columns);
        if (!pl) return null;
        // Запрос по одному артикулу не стоит выгрузки всего кабинета: берём кэш, если он уже есть.
        if (pl.byItem && !mem.has(pl.key) && !(await idbGet(pl.key))) return null;
        var p = inflight.get(pl.key);
        if (!p) {
            p = load(db, table, pl);
            inflight.set(pl.key, p);
            var done = function () { inflight.delete(pl.key); };
            p.then(done, done);
        }
        try {
            var rows = await p;
            // Отдаём копии строк: вызывающий код правит их (дозаливка воронки и т.п.), кэш трогать нельзя.
            return applyFilters(rows, filters).map(function (r) {
                if (!pl.proj) return Object.assign({}, r);
                var o = {};
                for (var i = 0; i < pl.proj.length; i++) o[pl.proj[i]] = r[pl.proj[i]];
                return o;
            });
        } catch (e) {
            // Нет функции на сервере или она падает: до перезагрузки страницы не пробуем, чтобы не тормозить.
            if (/Could not find|does not exist|not allowed|permission/i.test(String(e && e.message))) disabled = true;
            console.warn('[NrSnap] fallback:', e && e.message);
            return null;
        }
    }

    var api = { fetchRows: fetchRows, plan: plan, applyFilters: applyFilters, unpack: unpack, _reset: function () { mem.clear(); inflight.clear(); disabled = false; } };
    root.NrSnap = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

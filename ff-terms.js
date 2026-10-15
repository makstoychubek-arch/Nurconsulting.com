/* Тарифы фулфилмента по каждому ФФ (складу продавца): отправка и хранение, по периодам.
   Строка тарифа: { ff_name, kind: 'ship'|'storage', value, daily_cap, date_from, date_to|null }.
   ship — ₽ за 1 заказ; storage — ₽ за 1 шт в сутки (daily_cap — лимит ₽ в сутки на ФФ). */
(function (root) {
    'use strict';
    function addDays(iso, n) { var d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
    function fmtD(iso) { var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '.' + m[2] + '.' + m[1] : ''; }
    // Индекс для быстрых запросов: { 'ФФ|kind': [строки по дате] }.
    function index(terms) {
        var by = {};
        (terms || []).forEach(function (t) { (by[t.ff_name + '|' + t.kind] = by[t.ff_name + '|' + t.kind] || []).push(t); });
        Object.keys(by).forEach(function (k) { by[k].sort(function (a, b) { return a.date_from < b.date_from ? -1 : a.date_from > b.date_from ? 1 : 0; }); });
        return by;
    }
    // Тариф ФФ на день или null.
    function at(idx, ff, kind, d) {
        var list = idx[ff + '|' + kind] || [], hit = null;
        for (var i = 0; i < list.length; i++) if (list[i].date_from <= d && (!list[i].date_to || d <= list[i].date_to)) hit = list[i];
        return hit;
    }
    // Новый тариф с даты from (по to, если задано) для (ff, kind). Возвращает { remove: [id], update: [{id, date_to}], insert: row, add: [row] }.
    function plan(terms, ff, kind, value, cap, from, to, fx, mode) {
        var out = { remove: [], update: [], insert: null, add: [] };
        (terms || []).filter(function (t) { return t.ff_name === ff && t.kind === kind; }).forEach(function (t) {
            var tt = t.date_to || '9999-12-31', nt = to || '9999-12-31';
            if (tt < from || t.date_from > nt) return;                       // не пересекается
            if (t.date_from >= from && tt <= nt) { out.remove.push(t.id); return; }   // целиком внутри нового
            if (t.date_from < from) out.update.push({ id: t.id, date_to: addDays(from, -1) });   // хвост до новой даты
            if (tt > nt) out.add.push({ ff_name: ff, kind: kind, value: t.value, daily_cap: t.daily_cap == null ? null : t.daily_cap, fx_rate: t.fx_rate == null ? null : t.fx_rate, storage_mode: t.storage_mode === 'fixed' ? 'fixed' : 'unit', date_from: addDays(to, 1), date_to: t.date_to || null });   // часть после нового периода
        });
        out.insert = { ff_name: ff, kind: kind, value: Number(value), storage_mode: kind === 'storage' && mode === 'fixed' ? 'fixed' : 'unit', daily_cap: kind === 'storage' && mode !== 'fixed' && cap !== null && cap !== undefined && cap !== '' ? Number(cap) : null, fx_rate: Number(fx) > 0 ? Number(fx) : null, date_from: from, date_to: to || null };
        return out;
    }
    // Дни [from..to], на которые у ФФ нет тарифа вида kind (после первого заданного): список {from,to}.
    function gaps(idx, ff, kind, from, to) {
        var list = idx[ff + '|' + kind] || [];
        if (!list.length) return [];
        var start = list[0].date_from > from ? list[0].date_from : from, out = [], cur = null;
        for (var d = start; d <= to; d = addDays(d, 1)) {
            if (!at(idx, ff, kind, d)) { if (!cur) cur = { from: d, to: d }; else cur.to = d; }
            else if (cur) { out.push(cur); cur = null; }
        }
        if (cur) out.push(cur);
        return out;
    }
    // Средняя цена отправки одного заказа товара в день d (если лежит на нескольких ФФ — по доле остатка); null, если цены нет.
    function shipFor(idx, shares, d, rates) {
        if (!shares || !shares.length) return null;
        var sum = 0, has = false;
        shares.forEach(function (x) { var t = at(idx, x.k, 'ship', d); if (t) { sum += x.w * Number(t.value) * fxFor(t, rates, d); has = true; } });
        return has ? sum : null;
    }
    // Заказы FBS с номером склада (fbs_orders) → индекс: на какие ФФ упали заказы товара в день.
    function ordersIndex(rows) {
        var by = {}, days = {};
        (rows || []).forEach(function (r) {
            if (!r.order_date || !r.nm_id) return;
            days[r.order_date] = true;
            var k = r.nm_id + '|' + r.order_date, m = by[k] = by[k] || {};
            var ff = r.ff_name || 'none';
            m[ff] = (m[ff] || 0) + 1;
        });
        return { by: by, days: days };
    }
    // Доли ФФ по заказам товара за день (и за день раньше, если в этот день заказов нет); null — данных нет.
    function distFor(oidx, nm, d) {
        if (!oidx) return null;
        var m = oidx.by[nm + '|' + d];
        if (!m) m = oidx.by[nm + '|' + addDays(d, -1)];
        if (!m) return null;
        var tot = 0, k;
        for (k in m) tot += m[k];
        if (!tot) return null;
        var out = [];
        for (k in m) out.push({ k: k, w: m[k] / tot });
        return out;
    }
    // Множитель «₽ → сом» для тарифа в день d: свой курс ФФ или курс НБКР на день (ближайший прошлый); 1, если курсов нет.
    function fxFor(term, rates, d) {
        if (term && Number(term.fx_rate) > 0) return Number(term.fx_rate);
        if (!rates) return 1;
        if (rates[d]) return Number(rates[d]);
        var best = null;
        Object.keys(rates).forEach(function (k) { if (k <= d && (best === null || k > best)) best = k; });
        return best ? Number(rates[best]) : 1;
    }
    // Тарифы объединённых ФФ могут повторяться: одинаковые строки (вид, значение, даты) оставляем одной.
    function dedupe(terms) {
        var seen = {}, out = [];
        (terms || []).forEach(function (t) {
            var k = [t.ff_name, t.kind, t.value, t.daily_cap, t.fx_rate, t.storage_mode, t.date_from, t.date_to].join('|');
            if (!seen[k]) { seen[k] = 1; out.push(t); }
        });
        return out;
    }
    var api = { dedupe: dedupe, fxFor: fxFor, ordersIndex: ordersIndex, distFor: distFor, addDays: addDays, fmtD: fmtD, index: index, at: at, plan: plan, gaps: gaps, shipFor: shipFor };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.FfTerms = api;
})(typeof window !== 'undefined' ? window : globalThis);

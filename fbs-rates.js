/* Тарифы фулфилмента по периодам (FBS): «отправка за 1 шт» и «хранение в день» меняются со временем.
   Хранятся в rnp_articles.manual_data.fbs_rates = { ship: [{f,t,v}], storage: [{f,t,v}] }
   f — первый день (YYYY-MM-DD), t — последний день или null («и дальше»), v — значение.
   Старые одиночные значения (fbs_ship_price / fbs_storage_day) считаются действующими «всегда»,
   пока для этого вида не задан ни один период. */
(function (root) {
    'use strict';
    var MIN = '1970-01-01';
    var LEGACY = { ship: 'fbs_ship_price', storage: 'fbs_storage_day' };

    function addDays(iso, n) {
        var d = new Date(iso + 'T00:00:00Z');
        d.setUTCDate(d.getUTCDate() + n);
        return d.toISOString().slice(0, 10);
    }
    function ranges(md, kind) {
        var r = md && md.fbs_rates && md.fbs_rates[kind];
        return Array.isArray(r) ? r.slice() : [];
    }
    function legacy(md, kind) {
        var v = Number(md && md[LEGACY[kind]]);
        return v > 0 ? v : 0;
    }
    // Все периоды вида, включая «старое» значение как период с начала времён.
    function list(md, kind) {
        var r = ranges(md, kind);
        if (!r.length && legacy(md, kind)) r = [{ f: MIN, t: null, v: legacy(md, kind) }];
        return r.sort(function (a, b) { return a.f < b.f ? -1 : a.f > b.f ? 1 : 0; });
    }
    function rateOn(md, kind, date) {
        var r = list(md, kind), hit = 0;
        for (var i = 0; i < r.length; i++) if (r[i].f <= date && (r[i].t == null || date <= r[i].t)) hit = Number(r[i].v) || 0;
        return hit;
    }
    // Новое значение на период [from..to] (to = null — «и дальше»). Пересечения со старыми периодами обрезаются.
    function setRange(md, kind, value, from, to) {
        var out = [];
        list(md, kind).forEach(function (x) {
            var xt = x.t == null ? '9999-12-31' : x.t, nt = to == null ? '9999-12-31' : to;
            if (xt < from || x.f > nt) { out.push(x); return; }          // не пересекается
            if (x.f < from) out.push({ f: x.f, t: addDays(from, -1), v: x.v });   // хвост до новой даты
            if (xt > nt) out.push({ f: addDays(to, 1), t: x.t, v: x.v });         // часть после нового периода
        });
        if (value !== null && value !== undefined && value !== '' && Number(value) >= 0) out.push({ f: from, t: to == null ? null : to, v: Number(value) });
        out.sort(function (a, b) { return a.f < b.f ? -1 : a.f > b.f ? 1 : 0; });
        var merged = [];
        out.forEach(function (x) {
            var last = merged[merged.length - 1];
            if (last && last.t != null && addDays(last.t, 1) === x.f && last.v === x.v) last.t = x.t;
            else merged.push({ f: x.f, t: x.t, v: x.v });
        });
        var res = Object.assign({}, md || {});
        res.fbs_rates = Object.assign({}, res.fbs_rates || {});
        res.fbs_rates[kind] = merged;
        delete res[LEGACY[kind]];
        return res;
    }
    // Дни периода [from..to], на которые значение не задано (или 0): список {from,to}.
    function gaps(md, kind, from, to) {
        var out = [], cur = null;
        for (var d = from; d <= to; d = addDays(d, 1)) {
            if (!rateOn(md, kind, d)) { if (!cur) cur = { from: d, to: d }; else cur.to = d; }
            else if (cur) { out.push(cur); cur = null; }
        }
        if (cur) out.push(cur);
        return out;
    }
    // Сумма значения за каждый день периода (для хранения: ставка × дни).
    function sumDaily(md, kind, from, to) {
        var s = 0;
        for (var d = from; d <= to; d = addDays(d, 1)) s += rateOn(md, kind, d);
        return s;
    }
    function fmtD(iso) { var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '.' + m[2] + '.' + m[1] : ''; }
    function describe(md, kind) {
        return list(md, kind).map(function (x) {
            return (x.f === MIN ? 'всегда' : 'с ' + fmtD(x.f)) + (x.t ? ' по ' + fmtD(x.t) : ' и дальше') + ': ' + x.v;
        }).join('\n');
    }

    var api = { addDays: addDays, rateOn: rateOn, setRange: setRange, gaps: gaps, sumDaily: sumDaily, list: list, describe: describe, fmtD: fmtD };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.FbsRates = api;
})(typeof window !== 'undefined' ? window : globalThis);

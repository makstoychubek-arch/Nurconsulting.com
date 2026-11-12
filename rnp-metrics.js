/**
 * Метрики шапки артикула в РНП: литраж по карточке WB, литраж остатка, хранение в день, логистика за шт.
 * Всё считаем от габаритов упаковки из карточки WB (rnp_articles.dim_*_cm) и тарифа WB на короба
 * (функция wb-tariffs: уже в сомах). Если габаритов или тарифа нет, метрика пустая («—»), а не ноль.
 *
 *   литраж, л        = длина × ширина × высота / 1000
 *   логистика за шт  = база за 1-й литр + (литраж − 1) × цена за каждый следующий литр
 *   хранение в день  = (база за 1-й литр + (литраж − 1) × цена за следующий) на шт; на остаток = × «В стоке»
 */
(function (root) {
    'use strict';
    function num(v) { v = Number(v); return isFinite(v) ? v : 0; }

    /** Литраж одной упаковки по карточке; null, если нет одного из размеров. */
    function litres(art) {
        var l = num(art && art.dim_l_cm), w = num(art && art.dim_w_cm), h = num(art && art.dim_h_cm);
        if (!(l > 0 && w > 0 && h > 0)) return null;
        return l * w * h / 1000;
    }

    function tier(vol, base, perLiter) {
        if (!(vol > 0) || base == null || !isFinite(Number(base))) return null;
        return Number(base) + Math.max(vol - 1, 0) * num(perLiter);
    }

    /** Логистика WB за 1 шт (сом) по литражу и тарифу; null, если тарифа нет. */
    function logisticsPerUnit(vol, t) {
        if (!t || t.ok === false) return null;
        return tier(vol, t.delivery_base, t.delivery_liter);
    }

    /** Хранение за 1 шт в день (сом). */
    function storagePerUnitDay(vol, t) {
        if (!t || t.ok === false) return null;
        return tier(vol, t.storage_base, t.storage_liter);
    }

    /** Все четыре метрики шапки. stockWh: штук «В стоке» по артикулу. */
    function forArticle(art, stockWh, t) {
        var vol = litres(art);
        var stock = Math.max(0, num(stockWh));
        var perUnit = vol == null ? null : storagePerUnitDay(vol, t);
        return {
            litres: vol,
            litresStock: vol == null ? null : vol * stock,
            storageDay: perUnit == null ? null : perUnit * stock,
            storageUnit: perUnit,
            logistics: vol == null ? null : logisticsPerUnit(vol, t)
        };
    }

    function round1(v) { return Math.round(v * 10) / 10; }
    /** «6,3», «384», «—»: одна десятая только у малых значений. */
    function fmt(v, digits) {
        if (v == null || !isFinite(v)) return '—';
        var d = digits == null ? (Math.abs(v) < 100 ? 1 : 0) : digits;
        var s = d === 0 ? String(Math.round(v)) : round1(v).toFixed(d);
        var parts = s.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        return parts.join(',');
    }

    root.NrRnpMetrics = { litres: litres, logisticsPerUnit: logisticsPerUnit, storagePerUnitDay: storagePerUnitDay, forArticle: forArticle, fmt: fmt };
})(typeof window !== 'undefined' ? window : this);

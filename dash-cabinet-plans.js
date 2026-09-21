/**
 * План заказов текущего кабинета на дашборде.
 * Факт = воронка WB (Корзина × Заказы%), как в РНП / Excel «План/факт».
 */
(function (root) {
    function num(v) {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    }

    function fmtInt(n) {
        return Number(n || 0).toLocaleString('ru-RU');
    }

    function funnelQty(r) {
        const cart = num(r && r.basket_count);
        const conv = num(r && r.funnel_order_conv);
        if (cart > 0 && conv > 0) return Math.round(cart * conv / 100);
        return num(r && r.orders_count);
    }

    function fromRows(ids, plans, daily) {
        const by = {};
        (ids || []).forEach((id) => {
            by[id] = { cabinet_id: id, plan_orders: 0, plan_sales: 0, orders: 0, sales: 0, has_plan: false };
        });
        (plans || []).forEach((r) => {
            const id = r.cabinet_id;
            if (!id) return;
            const b = by[id] || (by[id] = { cabinet_id: id, plan_orders: 0, plan_sales: 0, orders: 0, sales: 0, has_plan: false });
            if (r.planned_orders != null) {
                b.plan_orders += num(r.planned_orders);
                b.has_plan = true;
            }
            if (r.planned_sales != null) {
                b.plan_sales += num(r.planned_sales);
                b.has_plan = true;
            }
        });
        (daily || []).forEach((r) => {
            const id = r.cabinet_id;
            if (!id) return;
            const b = by[id] || (by[id] = { cabinet_id: id, plan_orders: 0, plan_sales: 0, orders: 0, sales: 0, has_plan: false });
            b.orders += funnelQty(r);
            b.sales += num(r.sales_count);
        });
        return Object.values(by);
    }

    function cardModel(cab, row, currentId) {
        const planOrders = num(row && row.plan_orders);
        const orders = num(row && row.orders);
        const hasPlan = planOrders > 0;
        const pct = hasPlan ? (orders / planOrders) * 100 : 0;
        let tone = 'none';
        let label = 'Нет плана';
        if (hasPlan) {
            if (pct >= 100) { tone = 'done'; label = 'Выполнен'; }
            else if (pct >= 80) { tone = 'ok'; label = 'В плане'; }
            else { tone = 'low'; label = 'Отстаёт'; }
        }
        return {
            id: cab && cab.id,
            name: (cab && (cab.name || cab.displayName)) || 'Кабинет',
            current: String(cab && cab.id) === String(currentId),
            hasPlan: hasPlan,
            pct: pct,
            tone: tone,
            label: label,
            orders: orders,
            planOrders: planOrders,
        };
    }

    function cards(cabs, rows, currentId) {
        const by = {};
        (rows || []).forEach((r) => {
            if (r && r.cabinet_id) by[r.cabinet_id] = r;
        });
        return (cabs || []).map((c) => cardModel(c, by[c.id], currentId));
    }

    function html(m, esc) {
        const safe = typeof esc === 'function' ? esc : function (s) { return String(s == null ? '' : s); };
        const pctTxt = m.hasPlan ? String(Math.round(m.pct)) + '%' : 'Нет плана';
        const bar = m.hasPlan ? Math.min(100, Math.max(0, m.pct)) : 0;
        const meta = m.hasPlan
            ? (fmtInt(m.orders) + ' из ' + fmtInt(m.planOrders))
            : 'Задайте план в РНП';
        const id = safe(m.id);
        return '<button type="button" class="dash-plan-card' + (m.current ? ' is-current' : '') +
            '" data-tone="' + safe(m.tone) + '" data-cabinet="' + id +
            '" onclick="openDashCabinetPlan(\'' + id + '\')" title="Открыть РНП">' +
            '<div class="dash-plan-name">' + safe(m.name) + '</div>' +
            '<div class="dash-plan-status"><b>' + safe(pctTxt) + '</b><span>' + safe(m.label) + '</span></div>' +
            '<div class="dash-plan-meta">' + safe(meta) + '</div>' +
            '<div class="dash-plan-bar" aria-hidden="true"><i style="width:' + bar.toFixed(1) + '%"></i></div>' +
            '</button>';
    }

    function skuName(art) {
        const md = art && art.manual_data;
        const sa = md && (md.seller_article || md.sa_name);
        if (sa && String(sa).trim()) return String(sa).trim();
        const name = String((art && art.name) || '').trim();
        if (name && !/^артикул\s+\d+$/i.test(name)) return name;
        return String((art && art.nm_id) || '');
    }

    function basketHost(vol) {
        const map = [
            [0, 143, 1], [144, 287, 2], [288, 431, 3], [432, 719, 4],
            [720, 1007, 5], [1008, 1061, 6], [1062, 1115, 7], [1116, 1169, 8],
            [1170, 1313, 9], [1314, 1601, 10], [1602, 1655, 11], [1656, 1919, 12],
            [1920, 2045, 13], [2046, 2189, 14], [2190, 2405, 15],
        ];
        const found = map.find(function (row) { return vol >= row[0] && vol <= row[1]; });
        return found ? found[2] : 16;
    }

    function wbPhotoUrl(nmId) {
        const n = Number(nmId);
        if (!n) return '';
        const vol = Math.floor(n / 100000);
        const part = Math.floor(n / 1000);
        const host = String(basketHost(vol)).padStart(2, '0');
        return 'https://basket-' + host + '.wbbasket.ru/vol' + vol + '/part' + part + '/' + n + '/images/c246x328/1.webp';
    }

    function photoUrl(nmId, stored) {
        const s = String(stored || '').trim();
        if (/^https?:\/\//i.test(s) && /\/\d{6,}\/images\//.test(s)) return s;
        return wbPhotoUrl(nmId);
    }

    function skuModels(arts, plans, daily) {
        const by = {};
        (arts || []).forEach(function (a) {
            const id = Number(a.nm_id);
            if (!id) return;
            by[id] = { nm_id: id, name: skuName(a), photo_url: a.photo_url || '', plan_orders: 0, orders: 0 };
        });
        (plans || []).forEach(function (r) {
            const id = Number(r.nm_id);
            if (!id) return;
            const b = by[id] || (by[id] = { nm_id: id, name: String(id), photo_url: '', plan_orders: 0, orders: 0 });
            b.plan_orders += num(r.planned_orders);
        });
        (daily || []).forEach(function (r) {
            const id = Number(r.nm_id);
            if (!by[id]) return;
            by[id].orders += funnelQty(r);
        });
        return Object.values(by).filter(function (s) { return s.plan_orders > 0; })
            .sort(function (a, b) { return (b.orders / b.plan_orders) - (a.orders / a.plan_orders); });
    }

    function fromSkuRpc(rows) {
        return (rows || []).map(function (r) {
            return {
                nm_id: Number(r.nm_id),
                name: r.name || String(r.nm_id || ''),
                photo_url: r.photo_url || '',
                plan_orders: num(r.plan_orders),
                orders: num(r.orders),
            };
        }).filter(function (s) { return s.nm_id && s.plan_orders > 0; });
    }

    function splitSkus(list) {
        const done = [];
        const miss = [];
        (list || []).forEach(function (s) {
            if (num(s.orders) >= num(s.plan_orders)) done.push(s);
            else miss.push(s);
        });
        return { done: done, miss: miss };
    }

    function skuBtn(s, esc) {
        const safe = typeof esc === 'function' ? esc : function (v) { return String(v == null ? '' : v); };
        const done = num(s.orders) >= num(s.plan_orders);
        const url = photoUrl(s.nm_id, s.photo_url);
        const title = safe(s.name) + ' · ' + fmtInt(s.orders) + ' из ' + fmtInt(s.plan_orders);
        return '<button type="button" class="dash-plan-sku' + (done ? ' is-done' : ' is-miss') +
            '" title="' + title + '" onclick="openDashPlanSku(' + Number(s.nm_id) + ')">' +
            (url ? '<img src="' + safe(url) + '" alt="" loading="lazy" onerror="this.remove()">' : '') +
            '</button>';
    }

    function skusColHtml(title, list, esc) {
        const safe = typeof esc === 'function' ? esc : function (v) { return String(v == null ? '' : v); };
        const max = 16;
        const shown = (list || []).slice(0, max);
        const more = (list || []).length - shown.length;
        const body = shown.length
            ? shown.map(function (s) { return skuBtn(s, esc); }).join('')
            : '<span class="dash-plan-skus-empty">Нет</span>';
        return '<div class="dash-plan-skus-col">' +
            '<div class="dash-plan-skus-kicker">' + safe(title) +
            ((list || []).length ? ' · ' + (list || []).length : '') + '</div>' +
            '<div class="dash-plan-skus-row">' + body +
            (more > 0 ? '<span class="dash-plan-more">+' + more + '</span>' : '') +
            '</div></div>';
    }

    function skusHtml(groups, esc) {
        return skusColHtml('Выполнили план', (groups && groups.done) || [], esc)
            + skusColHtml('Не добрали', (groups && groups.miss) || [], esc);
    }

    const api = {
        num: num, fmtInt: fmtInt, funnelQty: funnelQty, fromRows: fromRows,
        cardModel: cardModel, cards: cards, html: html,
        skuName: skuName, photoUrl: photoUrl, skuModels: skuModels,
        fromSkuRpc: fromSkuRpc, splitSkus: splitSkus, skusHtml: skusHtml,
    };
    root.DashCabinetPlans = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

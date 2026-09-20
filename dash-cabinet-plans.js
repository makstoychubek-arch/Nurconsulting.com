/**
 * План заказов по всем кабинетам для дашборда.
 * Тот же процент, что в РНП: факт заказов / planned_orders за период.
 */
(function (root) {
    function num(v) {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    }

    function fmtInt(n) {
        return Number(n || 0).toLocaleString('ru-RU');
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
            b.orders += num(r.orders_count);
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

    const api = { num: num, fmtInt: fmtInt, fromRows: fromRows, cardModel: cardModel, cards: cards, html: html };
    root.DashCabinetPlans = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

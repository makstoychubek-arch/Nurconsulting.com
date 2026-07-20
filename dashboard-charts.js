/**
 * NR Space — графики дашборда из реальных данных wb_orders / wb_stocks
 */
(function () {
    const charts = {};
    let cachedOrders = [];
    let cachedStocks = [];
    let cachedSeries = null;
    let cachedWarehouseEntries = null;

    function chartColors() {
        const dark = document.documentElement.getAttribute('data-theme') === 'neon';
        return {
            text: dark ? '#A0A0B8' : '#5C5C6B',
            grid: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
            purple: '#7B61FF',
            blue: '#3B82F6',
            pink: '#EC4899',
            green: '#34D399',
            red: '#F87171',
            fills: ['#7B61FF', '#3B82F6', '#EC4899', '#34D399', '#FBBF24', '#60A5FA']
        };
    }

    function aggregateByDate(orders) {
        const map = {};
        (orders || []).forEach(o => {
            const d = o.order_date;
            if (!d) return;
            if (!map[d]) map[d] = { sum: 0, count: 0, returns: 0 };
            if (o.is_return) { map[d].returns++; return; }
            map[d].sum += Number(o.price || 0);
            map[d].count++;
        });
        return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
    }

    function lastNDays(series, n) {
        const slice = series.slice(-n);
        return {
            labels: slice.map(([d]) => d.slice(5)),
            sums: slice.map(([, v]) => v.sum),
            counts: slice.map(([, v]) => v.count)
        };
    }

    function aggregateWarehouses(stocks) {
        const map = {};
        (stocks || []).forEach(s => {
            const w = s.warehouse_name || 'Неизвестно';
            map[w] = (map[w] || 0) + Number(s.quantity || 0);
        });
        return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
    }

    function destroyChart(id) {
        if (charts[id]) { charts[id].destroy(); delete charts[id]; }
    }

    function baseOptions(c) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: c.text, font: { family: 'Inter', size: 11 } } }
            },
            scales: {
                x: { ticks: { color: c.text, maxRotation: 0 }, grid: { color: c.grid } },
                y: { ticks: { color: c.text }, grid: { color: c.grid } }
            }
        };
    }

    function renderSparkline(canvasId, data, color) {
        const el = document.getElementById(canvasId);
        if (!el || typeof Chart === 'undefined') return;
        destroyChart(canvasId);
        const c = chartColors();
        charts[canvasId] = new Chart(el, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    data: data.values,
                    borderColor: color || c.purple,
                    backgroundColor: (color || c.purple) + '33',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { enabled: true } },
                scales: { x: { display: false }, y: { display: false } }
            }
        });
    }

    function renderBarChart(series) {
        const el = document.getElementById('chart-orders-bar');
        if (!el || typeof Chart === 'undefined') return;
        destroyChart('chart-orders-bar');
        const c = chartColors();
        const data = lastNDays(series, 14);
        charts['chart-orders-bar'] = new Chart(el, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [
                    { label: 'Заказы, ₽', data: data.sums, backgroundColor: c.purple, borderRadius: 6 },
                    { label: 'Кол-во', data: data.counts, backgroundColor: c.blue, borderRadius: 6, yAxisID: 'y1' }
                ]
            },
            options: {
                ...baseOptions(c),
                scales: {
                    x: { ticks: { color: c.text }, grid: { display: false } },
                    y: { position: 'left', ticks: { color: c.text }, grid: { color: c.grid } },
                    y1: { position: 'right', ticks: { color: c.text }, grid: { display: false } }
                }
            }
        });
    }

    function renderLineChart(series) {
        const el = document.getElementById('chart-orders-line');
        if (!el || typeof Chart === 'undefined') return;
        destroyChart('chart-orders-line');
        const c = chartColors();
        const data = lastNDays(series, 30);
        charts['chart-orders-line'] = new Chart(el, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [
                    { label: 'Сумма заказов', data: data.sums, borderColor: c.purple, backgroundColor: c.purple + '22', fill: true, tension: 0.35 },
                    { label: 'Количество', data: data.counts, borderColor: c.pink, tension: 0.35, yAxisID: 'y1' }
                ]
            },
            options: {
                ...baseOptions(c),
                scales: {
                    x: { ticks: { color: c.text }, grid: { color: c.grid } },
                    y: { ticks: { color: c.text }, grid: { color: c.grid } },
                    y1: { position: 'right', ticks: { color: c.text }, grid: { display: false } }
                }
            }
        });
    }

    function renderDonutChart(warehouses) {
        const el = document.getElementById('chart-warehouse-donut');
        if (!el || typeof Chart === 'undefined') return;
        destroyChart('chart-warehouse-donut');
        const c = chartColors();
        if (!warehouses.length) {
            charts['chart-warehouse-donut'] = new Chart(el, {
                type: 'doughnut',
                data: { labels: ['Нет данных'], datasets: [{ data: [1], backgroundColor: ['#333'] }] },
                options: { plugins: { legend: { display: false } } }
            });
            return;
        }
        charts['chart-warehouse-donut'] = new Chart(el, {
            type: 'doughnut',
            data: {
                labels: warehouses.map(([n]) => n.length > 18 ? n.slice(0, 16) + '…' : n),
                datasets: [{ data: warehouses.map(([, q]) => q), backgroundColor: c.fills, borderWidth: 0 }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '68%',
                plugins: { legend: { position: 'right', labels: { color: c.text, boxWidth: 10, font: { size: 10 } } } }
            }
        });
    }

    function renderChartsCore(series, warehouseEntries) {
        const recent = lastNDays(series, 14);
        const c = chartColors();

        renderSparkline('spark-profit', { labels: recent.labels, values: recent.sums.map(v => Math.round(v * 0.35)) }, c.green);
        renderSparkline('spark-sales', { labels: recent.labels, values: recent.sums.map(v => Math.round(v * 0.65)) }, c.purple);
        renderSparkline('spark-orders', { labels: recent.labels, values: recent.counts }, c.blue);
        renderSparkline('spark-stock', { labels: recent.labels, values: recent.counts }, c.pink);

        renderBarChart(series);
        renderLineChart(series);
        renderDonutChart(warehouseEntries);
    }

    function renderAllCharts(orders, stocks) {
        cachedOrders = orders || [];
        cachedStocks = stocks || [];
        cachedSeries = null;
        cachedWarehouseEntries = null;
        renderChartsCore(aggregateByDate(cachedOrders), aggregateWarehouses(cachedStocks));
    }

    // Тот же результат, что renderAllCharts, но без сырых строк wb_orders/
    // wb_stocks на клиенте — принимает уже готовую агрегацию с сервера
    // (dashboard_summary RPC): series в формате aggregateByDate([[date,{sum,
    // count,returns}],...]) и warehouseEntries в формате aggregateWarehouses
    // ([[name,qty],...]). Раньше ради этих же графиков тянули постранично
    // тысячи сырых строк — теперь клиенту приходит уже готовая агрегация.
    function renderAllChartsAgg(series, warehouseEntries) {
        cachedOrders = [];
        cachedStocks = [];
        cachedSeries = series || [];
        cachedWarehouseEntries = warehouseEntries || [];
        renderChartsCore(cachedSeries, cachedWarehouseEntries);
    }

    function refreshChartTheme() {
        if (cachedSeries || cachedWarehouseEntries) renderChartsCore(cachedSeries || [], cachedWarehouseEntries || []);
        else if (cachedOrders.length || cachedStocks.length) renderAllCharts(cachedOrders, cachedStocks);
        if (cachedAdvSeries) renderAdvertisingCharts(cachedAdvSeries);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Контроль РК — детальный дашборд кабинета: 6 графиков по дням
    // (расход, показы, клики, CTR, заказы, эффективность/ROAS), кабинет-level
    // агрегация (сумма по всем кампаниям кабинета за день). Следует тем же
    // конвенциям, что и графики выше (chartColors/baseOptions/destroyChart).
    // ═══════════════════════════════════════════════════════════════════════
    let cachedAdvSeries = null;

    const ADV_CHART_IDS = ['chart-adv-spend', 'chart-adv-views', 'chart-adv-clicks', 'chart-adv-ctr', 'chart-adv-orders', 'chart-adv-efficiency'];

    function renderAdvSingleLine(canvasId, labels, values, color, suffix) {
        const el = document.getElementById(canvasId);
        if (!el || typeof Chart === 'undefined') return;
        destroyChart(canvasId);
        const c = chartColors();
        charts[canvasId] = new Chart(el, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    data: values, borderColor: color, backgroundColor: color + '22',
                    fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2
                }]
            },
            options: {
                ...baseOptions(c),
                plugins: {
                    ...baseOptions(c).plugins,
                    legend: { display: false },
                    tooltip: { callbacks: { label: (ctx) => `${ctx.parsed.y}${suffix || ''}` } }
                }
            }
        });
    }

    // series: [{ date, spend, views, clicks, orders, sum_price }] sorted by date,
    // already aggregated across all campaigns of the cabinet per day.
    function renderAdvertisingCharts(series) {
        cachedAdvSeries = series || [];
        if (!cachedAdvSeries.length) {
            ADV_CHART_IDS.forEach(destroyChart);
            return;
        }
        const c = chartColors();
        const labels = cachedAdvSeries.map(d => d.date.slice(5));
        const ctrVals = cachedAdvSeries.map(d => d.views > 0 ? +(d.clicks / d.views * 100).toFixed(2) : 0);
        // Эффективность (ROAS), % — см. EFFICIENCY_* константы в dashboard.html,
        // здесь пересчитывается из дневных агрегатов, а не усредняется наивно.
        const effVals = cachedAdvSeries.map(d => d.spend > 0 ? +(d.sum_price / d.spend * 100).toFixed(1) : 0);

        renderAdvSingleLine('chart-adv-spend', labels, cachedAdvSeries.map(d => Math.round(d.spend)), c.purple, ' ₽');
        renderAdvSingleLine('chart-adv-views', labels, cachedAdvSeries.map(d => d.views), c.blue, '');
        renderAdvSingleLine('chart-adv-clicks', labels, cachedAdvSeries.map(d => d.clicks), c.pink, '');
        renderAdvSingleLine('chart-adv-ctr', labels, ctrVals, c.green, '%');
        renderAdvSingleLine('chart-adv-orders', labels, cachedAdvSeries.map(d => d.orders), c.blue, '');
        renderAdvSingleLine('chart-adv-efficiency', labels, effVals, c.green, '%');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // "Топ 5 маржинальных товаров" — донат-диаграмма на главном дашборде,
    // items: [{ name, value, pct }] уже отсортированные по убыванию доли.
    // ═══════════════════════════════════════════════════════════════════════
    function renderTopMarginDonut(items) {
        const el = document.getElementById('chart-top-margin-donut');
        if (!el || typeof Chart === 'undefined') return;
        destroyChart('chart-top-margin-donut');
        const c = chartColors();
        if (!items || !items.length) {
            charts['chart-top-margin-donut'] = new Chart(el, {
                type: 'doughnut',
                data: { labels: ['Нет данных'], datasets: [{ data: [1], backgroundColor: ['#333'] }] },
                options: { plugins: { legend: { display: false }, tooltip: { enabled: false } }, cutout: '62%' }
            });
            return;
        }
        charts['chart-top-margin-donut'] = new Chart(el, {
            type: 'doughnut',
            data: {
                labels: items.map(i => i.name),
                datasets: [{ data: items.map(i => Math.max(0, i.value)), backgroundColor: c.fills, borderWidth: 0 }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '62%',
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${items[ctx.dataIndex].pct.toFixed(2)}%` } }
                }
            }
        });
    }

    window.NRCharts = { renderAllCharts, renderAllChartsAgg, refreshChartTheme, renderAdvertisingCharts, renderTopMarginDonut };
})();

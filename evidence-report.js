/**
 * Evidence-стиль сводного отчёта: KPI + P&L + остатки из тех же метрик дашборда.
 * Не ходит в WB/IG. Данные приходят из WBFormulas.calculateMetrics.
 */
(function (root) {
    function num(v) {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    }
    function money(v) {
        if (v == null || v === '') return '—';
        const n = Number(v);
        if (!Number.isFinite(n)) return '—';
        return Math.round(n).toLocaleString('ru-RU') + ' ₽';
    }
    function pct(v) {
        if (v == null || v === '') return '—';
        const n = Number(v);
        if (!Number.isFinite(n)) return '—';
        return n.toFixed(1) + '%';
    }
    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function buildReport(m, extra) {
        const x = extra || {};
        const stocks = x.stocks || {};
        const has = !!(m && m.hasRealData);
        const kpis = [
            { id: 'profit', label: 'Чистая прибыль', value: has ? money(m.profitFull) : '—', tone: 'good' },
            { id: 'margin', label: 'Маржа', value: has ? pct(m.margin) : '—', tone: 'good' },
            { id: 'sales', label: 'Продажи', value: has ? money(m.salesSum) : '—', tone: '' },
            { id: 'roi', label: 'ROI', value: has && m.roi != null ? pct(m.roi) : '—', tone: '' },
            { id: 'orders', label: 'Заказы', value: has ? money(m.ordersSum) : '—', tone: '' },
            { id: 'buyout', label: 'Выкуп', value: has && m.buyoutRate != null ? pct(m.buyoutRate) : '—', tone: '' },
            { id: 'logistics', label: 'Логистика', value: has ? money(m.logisticsSum) : '—', tone: 'bad' },
            { id: 'returns', label: 'Возвраты', value: has ? money(m.returnsSum) : '—', tone: 'bad' },
        ];
        const pnl = [
            { label: 'Продажи после СПП', value: has ? m.salesSum : null, sign: '+' },
            { label: 'К перечислению', value: has ? m.toTransferSum : null, sign: '+' },
            { label: 'Комиссия WB', value: has ? m.totalWbFee : null, sign: '−' },
            { label: 'Логистика', value: has ? m.logisticsSum : null, sign: '−' },
            { label: 'Хранение', value: has ? m.storageSum : null, sign: '−' },
            { label: 'Реклама', value: has ? m.adsSum : null, sign: '−' },
            { label: 'Штрафы', value: has ? m.penaltySum : null, sign: '−' },
            { label: 'Налог', value: has ? m.taxSum : null, sign: '−' },
            { label: 'Себестоимость', value: has ? m.costOfSalesSum : null, sign: '−' },
            { label: 'Чистая прибыль', value: has ? m.profitFull : null, sign: '=', tone: 'good' },
        ];
        const stockRows = [
            { label: 'FBO', value: stocks.fbo != null ? num(stocks.fbo) : null },
            { label: 'FBS', value: stocks.fbs != null ? num(stocks.fbs) : null },
            { label: 'Всего', value: stocks.total != null ? num(stocks.total) : null },
        ];
        return {
            title: 'Сводный отчёт',
            engine: 'evidence',
            hasData: has,
            periodFrom: x.from || '',
            periodTo: x.to || '',
            kpis,
            pnl,
            stockRows,
        };
    }

    function reportHtml(report) {
        const r = report || buildReport(null, {});
        const period = r.periodFrom && r.periodTo
            ? `${esc(r.periodFrom)} — ${esc(r.periodTo)}`
            : 'как на дашборде';
        const kpis = r.kpis.map((k) =>
            `<div class="ev-kpi${k.tone ? ' tone-' + k.tone : ''}"><div class="ev-kpi-l">${esc(k.label)}</div><div class="ev-kpi-v" id="sum-${k.id === 'sales' ? 'sales' : k.id}">${esc(k.value)}</div></div>`
        ).join('');
        const pnl = r.pnl.map((row) =>
            `<tr class="${row.tone === 'good' ? 'ev-total' : ''}"><td>${esc(row.sign)} ${esc(row.label)}</td><td>${row.value == null ? '—' : esc(money(row.value))}</td></tr>`
        ).join('');
        const stocks = r.stockRows.map((row) =>
            `<tr><td>${esc(row.label)}</td><td>${row.value == null ? '—' : esc(Number(row.value).toLocaleString('ru-RU'))}</td></tr>`
        ).join('');
        return `<div class="ev-report">
            <div class="ev-head">
                <div>
                    <div class="ev-kicker">Evidence</div>
                    <h3>${esc(r.title)}</h3>
                    <p class="ev-period">Период ${period}. Те же строки finance-api, что и дашборд.</p>
                </div>
            </div>
            <div class="ev-kpi-grid">${kpis}</div>
            <div class="ev-grid">
                <div class="ev-card">
                    <h4>P&amp;L</h4>
                    <table class="ev-table"><tbody>${pnl}</tbody></table>
                </div>
                <div class="ev-card">
                    <h4>Остатки сейчас</h4>
                    <table class="ev-table"><tbody>${stocks || '<tr><td colspan="2">—</td></tr>'}</tbody></table>
                </div>
            </div>
        </div>`;
    }

    function paint(targetId, metrics, extra) {
        const el = typeof targetId === 'string' ? document.getElementById(targetId) : targetId;
        if (!el) return null;
        const report = buildReport(metrics, extra);
        el.innerHTML = reportHtml(report);
        return report;
    }

    const EvidenceReport = { buildReport, reportHtml, paint, money, pct };
    root.EvidenceReport = EvidenceReport;
    if (typeof module !== 'undefined' && module.exports) module.exports = EvidenceReport;
})(typeof window !== 'undefined' ? window : globalThis);

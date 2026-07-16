/**
 * NR Space — раздел "Кластеры" (/wb-clusters)
 * Полностью изолированный модуль: собственный API-клиент (wbClusterApi),
 * собственный рендеринг. НЕ импортирует и не изменяет код раздела "РК"
 * (кабинеты/кампании/кнопка "Фразы") — только читает глобальные
 * window.currentCabinetId / window.supabase и слушает событие
 * "cabinet-changed", которое уже диспатчится при смене кабинета.
 */
(function () {
    'use strict';

    const WB_CLUSTERS_URL = 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/wb-clusters';

    const state = {
        periodDays: 14,
        loadedForCabinet: null,
        campaigns: [],
        statsByCampaign: {},      // id -> { cur: {views,clicks,spend,orders,sumPrice}, prev: {...} }
        expandedId: null,
        clustersByCampaign: {},   // id -> { clusters, noData }
        chartOpenPhrase: {},      // campaignId -> phrase currently charted
        charts: {},               // canvasId -> Chart.js instance
    };

    // ── API-клиент (wbClusterApi) — отдельный от callWbProxy ────────────────
    const wbClusterApi = {
        async call(action, params) {
            const cabinetId = window.currentCabinetId;
            if (!cabinetId) return null;
            if (!window.supabase) return null;
            try {
                const { data } = await window.supabase.auth.getSession();
                const session = data && data.session;
                if (!session) return null;
                const res = await fetch(WB_CLUSTERS_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer ' + session.access_token,
                    },
                    body: JSON.stringify({ cabinet_id: cabinetId, action, params: params || {} }),
                });
                return await res.json().catch(() => null);
            } catch (e) {
                console.warn('[wb-clusters] api error:', e);
                return null;
            }
        },
    };
    window.wbClusterApi = wbClusterApi;

    // ── Утилиты ───────────────────────────────────────────────────────────────
    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
        }[c]));
    }
    function fmtRub(n) { return Math.round(Number(n) || 0).toLocaleString('ru-RU') + ' ₽'; }
    function fmtNum(n) { return Math.round(Number(n) || 0).toLocaleString('ru-RU'); }
    function fmtPct(n, digits) { return (Number(n) || 0).toFixed(digits == null ? 1 : digits) + '%'; }
    function isoDate(d) { return d.toISOString().split('T')[0]; }
    function rangeFor(days, offsetDays) {
        const to = new Date(); to.setDate(to.getDate() - (offsetDays || 0));
        const from = new Date(to); from.setDate(from.getDate() - days + 1);
        return { from: isoDate(from), to: isoDate(to) };
    }

    function aggregateFullstats(statsArr, campaignId) {
        const acc = { views: 0, clicks: 0, spend: 0, orders: 0, sumPrice: 0 };
        (statsArr || []).forEach((c) => {
            if (Number(c.advertId) !== Number(campaignId)) return;
            (c.days || []).forEach((d) => {
                acc.views += Number(d.views || 0);
                acc.clicks += Number(d.clicks || 0);
                acc.spend += Number(d.sum || 0);
                acc.orders += Number(d.orders || 0);
                acc.sumPrice += Number(d.sum_price || 0);
            });
        });
        return acc;
    }

    function trendArrowHtml(cur, prev) {
        if (!prev || prev <= 0) return '';
        const diff = ((cur - prev) / prev) * 100;
        if (Math.abs(diff) < 0.5) return '<span class="wbc-trend flat">— 0%</span>';
        const up = diff > 0;
        return `<span class="wbc-trend ${up ? 'up' : 'down'}">${up ? '↑' : '↓'} ${Math.abs(diff).toFixed(1)}%</span>`;
    }

    // ── Инициализация вкладки ────────────────────────────────────────────────
    async function initTab(force) {
        const listEl = document.getElementById('wbc-campaigns-list');
        if (!listEl) return;
        if (!window.currentCabinetId) {
            listEl.innerHTML = emptyMsg('Выберите кабинет, чтобы посмотреть кластеры.');
            return;
        }
        if (!force && state.loadedForCabinet === window.currentCabinetId && state.campaigns.length) {
            renderCampaignList();
            return;
        }
        listEl.innerHTML = emptyMsg('Загрузка кампаний…', true);
        state.expandedId = null;

        const res = await wbClusterApi.call('campaigns', {});
        if (!res || res.error) {
            listEl.innerHTML = emptyMsg('Не удалось загрузить список кампаний WB. Проверьте токен кабинета в разделе «РК».');
            return;
        }
        state.loadedForCabinet = window.currentCabinetId;
        state.campaigns = (res.campaigns || []).filter((c) => c.status === 9 || c.status === 11);
        state.statsByCampaign = {};
        state.clustersByCampaign = {};

        if (!state.campaigns.length) {
            listEl.innerHTML = emptyMsg('В этом кабинете нет активных или приостановленных рекламных кампаний.');
            return;
        }
        renderCampaignList();
        loadCampaignStats();
    }

    function emptyMsg(text, spinner) {
        return `<div class="text-center py-10 text-sm" style="color:var(--text-muted)">${spinner ? '<span class="wbc-spinner"></span> ' : ''}${escapeHtml(text)}</div>`;
    }

    async function loadCampaignStats() {
        const ids = state.campaigns.map((c) => c.id);
        const cur = rangeFor(state.periodDays, 0);
        const prev = rangeFor(state.periodDays, state.periodDays);

        const [curRes, prevRes] = await Promise.all([
            wbClusterApi.call('campaign_stats', { campaignIds: ids, dateFrom: cur.from, dateTo: cur.to }),
            wbClusterApi.call('campaign_stats', { campaignIds: ids, dateFrom: prev.from, dateTo: prev.to }),
        ]);
        if (window.currentCabinetId !== state.loadedForCabinet) return; // кабинет успели сменить

        const curStats = (curRes && curRes.stats) || [];
        const prevStats = (prevRes && prevRes.stats) || [];
        state.campaigns.forEach((c) => {
            state.statsByCampaign[c.id] = {
                cur: aggregateFullstats(curStats, c.id),
                prev: aggregateFullstats(prevStats, c.id),
            };
        });
        renderCampaignList();
    }

    function renderCampaignList() {
        const listEl = document.getElementById('wbc-campaigns-list');
        if (!listEl) return;
        listEl.innerHTML = state.campaigns.map(renderCampaignCard).join('');
        state.campaigns.forEach((c) => {
            if (state.expandedId === c.id) renderClusterPanel(c.id);
        });
    }

    function renderCampaignCard(c) {
        const s = state.statsByCampaign[c.id];
        const cur = s ? s.cur : null;
        const prev = s ? s.prev : null;
        const roas = cur && cur.spend > 0 ? (cur.sumPrice / cur.spend) * 100 : null;
        const roasPrev = prev && prev.spend > 0 ? (prev.sumPrice / prev.spend) * 100 : null;
        const expanded = state.expandedId === c.id;
        const statusColor = c.status === 9 ? 'var(--green)' : 'var(--amber)';

        return `
        <div class="wbc-campaign-card" data-campaign-id="${c.id}">
            <div class="wbc-campaign-head" data-action="toggle-campaign" data-campaign-id="${c.id}">
                <div class="wbc-campaign-name">
                    <span class="wbc-status-dot" style="background:${statusColor}"></span>
                    ${escapeHtml(c.name)}
                    <span class="wbc-campaign-sub">${escapeHtml(c.statusLabel || '')}${c.paymentType ? ' · ' + escapeHtml(c.paymentType) : ''}</span>
                </div>
                <div class="wbc-campaign-metrics">
                    ${!s ? '<span class="wbc-spinner"></span>' : `
                        <div class="wbc-metric"><span class="wbc-metric-label">Расход</span><span class="wbc-metric-value">${fmtRub(cur.spend)}</span>${trendArrowHtml(cur.spend, prev.spend)}</div>
                        <div class="wbc-metric"><span class="wbc-metric-label">Заказы</span><span class="wbc-metric-value">${fmtNum(cur.orders)}</span>${trendArrowHtml(cur.orders, prev.orders)}</div>
                        <div class="wbc-metric"><span class="wbc-metric-label">ROAS</span><span class="wbc-metric-value">${roas != null ? fmtPct(roas, 0) : '—'}</span>${roas != null ? trendArrowHtml(roas, roasPrev) : ''}</div>
                    `}
                </div>
                <svg class="wbc-chevron ${expanded ? 'open' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <div class="wbc-cluster-panel" id="wbc-panel-${c.id}" style="${expanded ? '' : 'display:none'}"></div>
        </div>`;
    }

    function toggleCampaign(id) {
        if (state.expandedId === id) {
            state.expandedId = null;
            renderCampaignList();
            return;
        }
        state.expandedId = id;
        renderCampaignList();
        renderClusterPanel(id);
    }

    async function renderClusterPanel(campaignId) {
        const panel = document.getElementById('wbc-panel-' + campaignId);
        if (!panel) return;
        panel.style.display = '';
        panel.innerHTML = emptyMsg('Загрузка кластеров…', true);

        let data = state.clustersByCampaign[campaignId];
        if (!data) {
            const range = rangeFor(state.periodDays, 0);
            const res = await wbClusterApi.call('campaign_clusters', {
                campaignId, dateFrom: range.from, dateTo: range.to,
            });
            data = res && !res.error ? res : { clusters: [], noData: true };
            state.clustersByCampaign[campaignId] = data;
        }
        if (state.expandedId !== campaignId) return; // пользователь успел свернуть

        if (data.noData || !data.clusters || !data.clusters.length) {
            panel.innerHTML = `<div class="wbc-nodata">WB пока не отдаёт статистику по кластерам для этой кампании — попробуйте другой период или зайдите позже.</div>`;
            return;
        }
        panel.innerHTML = buildClusterPanelHtml(campaignId, data.clusters);
    }

    function buildClusterPanelHtml(campaignId, clusters) {
        const totalSpend = clusters.reduce((s, c) => s + c.spend, 0) || 1;
        const totalOrders = clusters.reduce((s, c) => s + c.orders, 0);
        const totalClicks = clusters.reduce((s, c) => s + c.clicks, 0);
        const avgCr = totalClicks > 0 ? (totalOrders / totalClicks) * 100 : 0;

        const cposWithOrders = clusters.filter((c) => c.cpo != null && c.cpo > 0).map((c) => c.cpo);
        const avgCpo = cposWithOrders.length ? cposWithOrders.reduce((a, b) => a + b, 0) / cposWithOrders.length : 0;

        function tierOf(c) {
            if (c.cpo == null) return 'mid';
            if (!avgCpo) return 'mid';
            if (c.cpo <= avgCpo * 0.85) return 'good';
            if (c.cpo >= avgCpo * 1.25) return 'bad';
            return 'mid';
        }

        const alerts = [];
        clusters.forEach((c) => {
            const share = (c.spend / totalSpend) * 100;
            const cr = c.clicks > 0 ? (c.orders / c.clicks) * 100 : 0;
            if (share >= 15 && cr < avgCr * 0.7) {
                alerts.push(`Кластер «${escapeHtml(c.phrase)}» тратит ${share.toFixed(0)}% бюджета кампании при CR ниже среднего (${cr.toFixed(1)}% vs ${avgCr.toFixed(1)}%).`);
            }
        });

        const rows = clusters.map((c, idx) => {
            const tier = tierOf(c);
            const chartOpen = state.chartOpenPhrase[campaignId] === c.phrase;
            return `
            <tr class="wbc-cluster-row wbc-tier-${tier}" data-action="toggle-chart" data-campaign-id="${campaignId}" data-phrase-idx="${idx}">
                <td class="wbc-td-phrase">${escapeHtml(c.phrase)}${chartOpen ? ' <span class="wbc-chart-hint">▲ график</span>' : ''}</td>
                <td>${fmtNum(c.impressions)}</td>
                <td>${fmtNum(c.clicks)}</td>
                <td>${fmtPct(c.ctr, 2)}</td>
                <td>${fmtRub(c.spend)}</td>
                <td>${fmtNum(c.orders)}</td>
                <td>${c.cpo != null ? fmtRub(c.cpo) : '—'}</td>
                <td><span class="wbc-badge ${c.active ? 'wbc-badge-active' : 'wbc-badge-inactive'}">${c.active ? 'Активен' : 'Неактивен'}</span></td>
            </tr>
            ${chartOpen ? `<tr class="wbc-chart-row"><td colspan="8"><div class="wbc-chart-wrap"><canvas id="wbc-chart-${campaignId}"></canvas></div></td></tr>` : ''}
            `;
        }).join('');

        return `
        ${alerts.length ? `<div class="wbc-alert-box">${alerts.map((a) => `<div class="wbc-alert-row">⚠️ ${a}</div>`).join('')}</div>` : ''}
        <div class="wbc-table-wrap">
            <table class="wbc-cluster-table">
                <thead><tr>
                    <th>Фраза</th><th>Показы</th><th>Клики</th><th>CTR</th>
                    <th>Расход</th><th>Заказы</th><th>CPO</th><th>Статус</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
    }

    function toggleClusterChartByIdx(campaignId, idx) {
        const data = state.clustersByCampaign[campaignId];
        const cluster = data && data.clusters && data.clusters[idx];
        if (!cluster) return;
        toggleClusterChart(campaignId, cluster.phrase);
    }

    async function toggleClusterChart(campaignId, phrase) {
        if (state.chartOpenPhrase[campaignId] === phrase) {
            delete state.chartOpenPhrase[campaignId];
        } else {
            state.chartOpenPhrase[campaignId] = phrase;
        }
        const panel = document.getElementById('wbc-panel-' + campaignId);
        if (!panel) return;
        const data = state.clustersByCampaign[campaignId];
        if (!data || !data.clusters) return;
        panel.innerHTML = buildClusterPanelHtml(campaignId, data.clusters);

        if (state.chartOpenPhrase[campaignId] === phrase) {
            const range = rangeFor(state.periodDays, 0);
            const res = await wbClusterApi.call('campaign_clusters_daily', {
                campaignId, phrase, dateFrom: range.from, dateTo: range.to,
            });
            renderClusterChart(campaignId, phrase, res);
        }
    }

    function renderClusterChart(campaignId, phrase, res) {
        const canvasId = 'wbc-chart-' + campaignId;
        const canvas = document.getElementById(canvasId);
        if (!canvas || typeof Chart === 'undefined') return;
        if (state.charts[canvasId]) { state.charts[canvasId].destroy(); delete state.charts[canvasId]; }

        if (!res || res.noData || !res.series || !res.series.length) {
            const wrap = canvas.closest('.wbc-chart-wrap');
            if (wrap) wrap.innerHTML = `<div class="wbc-nodata">WB пока не отдаёт статистику по дням для этой фразы.</div>`;
            return;
        }
        const labels = res.series.map((d) => d.date.slice(5));
        state.charts[canvasId] = new Chart(canvas, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    { label: 'Расход, ₽', data: res.series.map((d) => Math.round(d.spend)), borderColor: '#7B61FF', backgroundColor: '#7B61FF22', fill: true, tension: 0.35, yAxisID: 'y' },
                    { label: 'Заказы', data: res.series.map((d) => d.orders), borderColor: '#34D399', tension: 0.35, yAxisID: 'y1' },
                ],
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#A0A0B8', font: { size: 11 } } } },
                scales: {
                    x: { ticks: { color: '#A0A0B8' }, grid: { display: false } },
                    y: { position: 'left', ticks: { color: '#A0A0B8' }, grid: { color: 'rgba(255,255,255,0.06)' } },
                    y1: { position: 'right', ticks: { color: '#A0A0B8' }, grid: { display: false } },
                },
            },
        });
    }

    function setPeriod(days) {
        state.periodDays = days;
        document.querySelectorAll('#wbc-period-picker button').forEach((b) => {
            b.classList.toggle('active', Number(b.dataset.days) === days);
        });
        state.statsByCampaign = {};
        state.clustersByCampaign = {};
        state.expandedId = null;
        renderCampaignList();
        loadCampaignStats();
    }

    // ── Точки входа, вызываемые из dashboard.html (showTab / cabinet switch) ──
    window.WBClusters = {
        openTab: () => initTab(false),
        toggleCampaign, toggleClusterChart, setPeriod,
    };

    document.addEventListener('cabinet-changed', () => {
        state.loadedForCabinet = null;
        if (document.getElementById('tab-wb-clusters')?.classList.contains('active')) {
            initTab(true);
        }
    });

    // Делегирование кликов (без inline onclick — безопаснее для динамических
    // текстов фраз, которые могут содержать кавычки/спецсимволы).
    function bindDelegatedEvents() {
        document.getElementById('wbc-period-picker')?.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-days]');
            if (btn) setPeriod(Number(btn.dataset.days));
        });
        document.getElementById('wbc-campaigns-list')?.addEventListener('click', (e) => {
            const el = e.target.closest('[data-action]');
            if (!el) return;
            const campaignId = Number(el.dataset.campaignId);
            if (el.dataset.action === 'toggle-campaign') toggleCampaign(campaignId);
            else if (el.dataset.action === 'toggle-chart') toggleClusterChartByIdx(campaignId, Number(el.dataset.phraseIdx));
        });
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindDelegatedEvents);
    } else {
        bindDelegatedEvents();
    }
})();

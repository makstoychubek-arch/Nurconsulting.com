/**
 * Командный центр «Реклама» — docs/autobidder.md §8 + §11.6.
 * Старую вкладку Автобиддер (legacy_mvp) не трогает.
 */
(function (root) {
    const HOURS = Array.from({ length: 24 }, (_, i) => i);
    const DEFAULT_HOURS = HOURS.filter((h) => h >= 7 && h <= 23);

    function pad2(n) {
        return String(n).padStart(2, '0');
    }

    function ymd(d) {
        const x = d instanceof Date ? d : new Date(d);
        return x.getFullYear() + '-' + pad2(x.getMonth() + 1) + '-' + pad2(x.getDate());
    }

    function addDays(date, delta) {
        const x = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        x.setDate(x.getDate() + delta);
        return x;
    }

    function num(v) {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    }

    function formatMoney(n) {
        if (n == null || !Number.isFinite(Number(n))) return '—';
        return Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 0 });
    }

    function formatDrr(spend, revenue) {
        const s = num(spend);
        const r = num(revenue);
        if (s <= 0 && r <= 0) return null;
        if (r <= 0) return s > 0 ? Infinity : null;
        return (s / r) * 100;
    }

    function formatDrrLabel(pct) {
        if (pct == null) return '—';
        if (!Number.isFinite(pct)) return '∞';
        return pct.toFixed(1) + '%';
    }

    function tokenState(cab) {
        if (cab.adv_token_valid === false) return 'bad';
        if (cab.adv_token_secret_id || (cab.wb_token && String(cab.wb_token).length > 50)) return 'ok';
        return 'none';
    }

    function campaignLive(status) {
        const s = Number(status);
        return s === 9 || String(status) === 'active' || String(status) === '9';
    }

    function ruleRangeStatus(rule, pos) {
        if (!rule || pos == null || !Number.isFinite(Number(pos))) return 'unknown';
        const from = Number(rule.target_pos_from);
        const to = Number(rule.target_pos_to);
        if (pos < from) return 'better';
        if (pos > to) return 'worse';
        return 'in';
    }

    function buildHqModel(input) {
        const today = input.today;
        const from7 = input.from7;
        const cabinets = input.cabinets || [];
        const legacyCamps = input.legacyCampaigns || [];
        const legacyStats = input.legacyStats || [];
        const v2Camps = input.v2Campaigns || [];
        const clusters = input.clusters || [];
        const rules = input.rules || [];
        const snaps = input.snapshots || [];
        const v2Stats = input.v2Stats || [];

        const spendToday = new Map();
        const spend7 = new Map();
        const rev7 = new Map();
        function addStat(cabinetId, campaignKey, date, spend, revenue) {
            const day = String(date || '').slice(0, 10);
            if (day === today) {
                spendToday.set(cabinetId, (spendToday.get(cabinetId) || 0) + spend);
            }
            if (day >= from7 && day <= today) {
                spend7.set(cabinetId, (spend7.get(cabinetId) || 0) + spend);
                rev7.set(cabinetId, (rev7.get(cabinetId) || 0) + revenue);
                const ck = cabinetId + ':' + campaignKey;
                spend7.set(ck, (spend7.get(ck) || 0) + spend);
                rev7.set(ck, (rev7.get(ck) || 0) + revenue);
            }
        }
        for (const r of legacyStats) {
            addStat(r.cabinet_id, String(r.campaign_id), r.stat_date, num(r.spend), num(r.sum_price || r.revenue));
        }
        const v2CabByCamp = new Map(v2Camps.map((c) => [c.id, c.cabinet_id]));
        for (const r of v2Stats) {
            const cab = v2CabByCamp.get(r.campaign_id);
            if (!cab) continue;
            addStat(cab, r.campaign_id, r.date, num(r.spend), num(r.revenue));
        }

        const latestSnap = new Map();
        for (const s of snaps) {
            const key = s.campaign_id + '\0' + String(s.cluster_key || '').toLowerCase();
            const prev = latestSnap.get(key);
            if (!prev || String(s.captured_at) > String(prev.captured_at)) latestSnap.set(key, s);
        }

        const rulesByCamp = new Map();
        const rulesByCluster = new Map();
        for (const rule of rules) {
            const list = rulesByCamp.get(rule.campaign_id) || [];
            list.push(rule);
            rulesByCamp.set(rule.campaign_id, list);
            if (rule.cluster_id) rulesByCluster.set(rule.cluster_id, rule);
        }

        const clustersByCamp = new Map();
        for (const cl of clusters) {
            const list = clustersByCamp.get(cl.campaign_id) || [];
            list.push(cl);
            clustersByCamp.set(cl.campaign_id, list);
        }

        const v2ByCabWb = new Map();
        for (const c of v2Camps) {
            v2ByCabWb.set(c.cabinet_id + ':' + String(c.wb_campaign_id), c);
        }

        const campsByCab = new Map();
        for (const c of legacyCamps) {
            const list = campsByCab.get(c.cabinet_id) || [];
            list.push(c);
            campsByCab.set(c.cabinet_id, list);
        }
        for (const c of v2Camps) {
            const list = campsByCab.get(c.cabinet_id) || [];
            const wb = String(c.wb_campaign_id);
            if (!list.some((x) => String(x.campaign_id || x.wb_campaign_id) === wb)) {
                list.push({
                    cabinet_id: c.cabinet_id,
                    campaign_id: c.wb_campaign_id,
                    campaign_name: c.name,
                    status: c.status === 'active' ? 9 : c.status,
                    type: c.campaign_type,
                    _v2: c,
                });
            }
            campsByCab.set(c.cabinet_id, list);
        }

        const rows = cabinets.map((cab) => {
            const token = tokenState(cab);
            const rawCamps = campsByCab.get(cab.id) || [];
            let inRange = 0;
            let outRange = 0;
            let maxHit = 0;
            const campaigns = rawCamps.map((raw) => {
                const wbId = raw.campaign_id != null ? raw.campaign_id : raw.wb_campaign_id;
                const v2 = raw._v2 || v2ByCabWb.get(cab.id + ':' + String(wbId));
                const campUuid = v2 && v2.id;
                const clist = campUuid ? (clustersByCamp.get(campUuid) || []) : [];
                const campRules = campUuid ? (rulesByCamp.get(campUuid) || []) : [];
                const mappedClusters = clist.map((cl) => {
                    const rule = rulesByCluster.get(cl.id) || campRules.find((r) => !r.cluster_id) || null;
                    const snap = campUuid
                        ? latestSnap.get(campUuid + '\0' + String(cl.cluster_key || '').toLowerCase())
                        : null;
                    const pos = snap && snap.ad_position != null ? Number(snap.ad_position) : null;
                    const range = ruleRangeStatus(rule, pos);
                    if (range === 'in') inRange += 1;
                    if (range === 'worse' || range === 'better') outRange += 1;
                    if (rule && rule.max_bid != null && snap && false) maxHit += 0;
                    return {
                        id: cl.id,
                        key: cl.cluster_key,
                        active: cl.is_active !== false,
                        tier: cl.tier || 'no_data',
                        pos,
                        range,
                        rule,
                    };
                });
                if (!clist.length && campRules.length) {
                    for (const rule of campRules) {
                        if (rule.is_active === false) continue;
                        const st = 'unknown';
                        if (st === 'unknown') outRange += 0;
                    }
                }
                return {
                    wbId,
                    uuid: campUuid || null,
                    name: raw.campaign_name || (v2 && v2.name) || ('РК ' + wbId),
                    status: raw.status,
                    type: raw.type || (v2 && v2.campaign_type) || '',
                    live: campaignLive(raw.status),
                    spend7: spend7.get(cab.id + ':' + String(wbId)) || spend7.get(cab.id + ':' + String(campUuid || '')) || 0,
                    revenue7: rev7.get(cab.id + ':' + String(wbId)) || 0,
                    clusters: mappedClusters,
                    rules: campRules,
                };
            });

            for (const camp of campaigns) {
                for (const rule of camp.rules || []) {
                    if (rule.reason === 'max_bid_hit') maxHit += 1;
                }
            }

            const spendT = spendToday.get(cab.id) || 0;
            const s7 = spend7.get(cab.id) || 0;
            const r7 = rev7.get(cab.id) || 0;
            return {
                id: cab.id,
                name: cab.name,
                token,
                cap: cab.adv_daily_budget_cap,
                spendToday: spendT,
                spend7: s7,
                revenue7: r7,
                drr7: formatDrr(s7, r7),
                activeCampaigns: campaigns.filter((c) => c.live).length,
                inRange,
                outRange,
                maxHit,
                campaigns,
            };
        });

        rows.sort((a, b) => (b.outRange - a.outRange) || ((b.drr7 || 0) - (a.drr7 || 0)));

        const totals = rows.reduce((acc, r) => {
            acc.spendToday += r.spendToday;
            acc.spend7 += r.spend7;
            acc.revenue7 += r.revenue7;
            acc.active += r.activeCampaigns;
            acc.inRange += r.inRange;
            acc.outRange += r.outRange;
            acc.maxHit += r.maxHit;
            acc.saved7 += 0;
            return acc;
        }, { spendToday: 0, spend7: 0, revenue7: 0, active: 0, inRange: 0, outRange: 0, maxHit: 0, saved7: 0 });
        totals.drr7 = formatDrr(totals.spend7, totals.revenue7);
        totals.cabinets = rows.length;
        totals.tokenBad = rows.filter((r) => r.token === 'bad').length;

        return { rows, totals, today, from7 };
    }

    function defaultRuleForm() {
        return {
            strategy: 'min_sufficient',
            target_pos_from: 5,
            target_pos_to: 10,
            capMode: 'max_bid',
            max_bid: '',
            target_drr_pct: '',
            min_bid_floor: 50,
            step_pct: 7,
            hysteresis: 3,
            organic_skip_threshold: 5,
            hours: DEFAULT_HOURS.slice(),
            boost: '',
        };
    }

    const state = {
        deps: null,
        model: null,
        open: { cabinets: new Set(), campaigns: new Set() },
        selected: null,
        form: defaultRuleForm(),
        history: [],
        loading: false,
        filterCabinetId: '',
    };

    function dep() {
        return state.deps || {};
    }

    function esc(s) {
        if (dep().escapeHtml) return dep().escapeHtml(s);
        return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function cabName(name) {
        return dep().cabinetDisplayName ? dep().cabinetDisplayName(name) : (name || 'Кабинет');
    }

    function tokenHtml(token) {
        if (token === 'ok') return '<span class="ads-hq-dot ok" title="Токен живой"></span>';
        if (token === 'bad') return '<span class="ads-hq-dot bad" title="401 / токен невалиден"></span>';
        return '<span class="ads-hq-dot none" title="Нет рекламного токена"></span>';
    }

    function statusPill(status) {
        const s = Number(status);
        if (s === 9 || status === 'active') return '<span class="advcab-status-pill ok">Активна</span>';
        if (s === 11) return '<span class="advcab-status-pill warn">На паузе</span>';
        if (s === 4) return '<span class="advcab-status-pill none">Готова</span>';
        if (s === 7) return '<span class="advcab-status-pill none">Завершена</span>';
        return '<span class="advcab-status-pill none">' + esc(status || '—') + '</span>';
    }

    function rangeLabel(range) {
        if (range === 'in') return '<span style="color:var(--green)">в диапазоне</span>';
        if (range === 'worse') return '<span style="color:var(--red)">хуже</span>';
        if (range === 'better') return '<span style="color:var(--amber)">выше цели</span>';
        return '<span style="color:var(--text-muted)">—</span>';
    }

    function selectedKeys() {
        return [...document.querySelectorAll('#ads-hq-tbody input.ads-hq-check:checked')].map((el) => ({
            kind: el.dataset.kind,
            cabinetId: el.dataset.cabinet,
            wbId: el.dataset.wb,
            uuid: el.dataset.uuid || '',
            cluster: el.dataset.cluster || '',
        }));
    }

    function renderKpis(totals) {
        const el = document.getElementById('ads-hq-kpis');
        if (!el) return;
        const tiles = [
            ['Кабинеты', String(totals.cabinets) + (totals.tokenBad ? ' · ' + totals.tokenBad + ' без токена' : '')],
            ['Активных РК', String(totals.active)],
            ['Расход сегодня', formatMoney(totals.spendToday)],
            ['ДРР 7д', formatDrrLabel(totals.drr7)],
            ['Сэкономлено 7д', totals.saved7 ? formatMoney(totals.saved7) : '—'],
        ];
        el.innerHTML = tiles.map(([label, value]) =>
            '<div class="adv-kpi-tile"><div class="adv-kpi-tile-label">' + esc(label) +
            '</div><div class="adv-kpi-tile-value">' + esc(value) + '</div></div>'
        ).join('');
    }

    function chevron(open) {
        return '<span class="ads-hq-chev' + (open ? ' open' : '') + '" aria-hidden="true"></span>';
    }

    function renderTable() {
        const tb = document.getElementById('ads-hq-tbody');
        if (!tb || !state.model) return;
        let rows = state.model.rows;
        if (state.filterCabinetId) rows = rows.filter((r) => r.id === state.filterCabinetId);
        if (!rows.length) {
            tb.innerHTML = '<tr><td colspan="10" class="text-center py-10" style="color:var(--text-muted)">Нет кабинетов или ещё нет данных синка. Карточки РК при этом остаются как были.</td></tr>';
            return;
        }
        const html = [];
        for (const cab of rows) {
            const cabOpen = state.open.cabinets.has(cab.id);
            const cap = cab.cap != null && Number.isFinite(Number(cab.cap)) ? formatMoney(cab.cap) : '—';
            html.push(
                '<tr class="ads-hq-cab" data-cab="' + esc(cab.id) + '">' +
                '<td><input type="checkbox" class="ads-hq-check" data-kind="cabinet" data-cabinet="' + esc(cab.id) + '"></td>' +
                '<td><button type="button" class="ads-hq-expand" data-expand="cab" data-id="' + esc(cab.id) + '">' +
                chevron(cabOpen) + esc(cabName(cab.name)) + '</button></td>' +
                '<td>' + tokenHtml(cab.token) + '</td>' +
                '<td>' + cab.activeCampaigns + '</td>' +
                '<td>' + formatMoney(cab.spendToday) + ' / ' + cap + '</td>' +
                '<td>' + formatDrrLabel(cab.drr7) + '</td>' +
                '<td>' + cab.inRange + '</td>' +
                '<td>' + (cab.outRange ? '<span style="color:var(--red)">' + cab.outRange + '</span>' : '0') + '</td>' +
                '<td>' + cab.maxHit + '</td>' +
                '<td><button type="button" class="adv-camp-action-btn" data-act="pause-cab" data-cabinet="' + esc(cab.id) + '">Пауза</button> ' +
                '<button type="button" class="adv-camp-action-btn" data-act="start-cab" data-cabinet="' + esc(cab.id) + '">Старт</button></td>' +
                '</tr>'
            );
            if (!cabOpen) continue;
            if (!cab.campaigns.length) {
                html.push('<tr class="ads-hq-empty"><td></td><td colspan="9" style="color:var(--text-muted)">Нет кампаний в advertising_campaigns / adv_campaigns</td></tr>');
                continue;
            }
            for (const camp of cab.campaigns) {
                const ck = cab.id + ':' + camp.wbId;
                const campOpen = state.open.campaigns.has(ck);
                html.push(
                    '<tr class="ads-hq-camp" data-ck="' + esc(ck) + '">' +
                    '<td><input type="checkbox" class="ads-hq-check" data-kind="campaign" data-cabinet="' + esc(cab.id) + '" data-wb="' + esc(camp.wbId) + '" data-uuid="' + esc(camp.uuid || '') + '"></td>' +
                    '<td style="padding-left:28px"><button type="button" class="ads-hq-expand" data-expand="camp" data-id="' + esc(ck) + '">' +
                    chevron(campOpen) + esc(camp.name) + ' <span class="ads-hq-mono">#' + esc(camp.wbId) + '</span></button></td>' +
                    '<td colspan="2">' + statusPill(camp.status) + '</td>' +
                    '<td>' + formatMoney(camp.spend7) + '</td>' +
                    '<td>' + formatDrrLabel(formatDrr(camp.spend7, camp.revenue7)) + '</td>' +
                    '<td colspan="2">' + camp.clusters.length + ' класт.</td>' +
                    '<td></td>' +
                    '<td><button type="button" class="adv-camp-action-btn" data-act="' + (camp.live ? 'pause' : 'start') + '" data-cabinet="' + esc(cab.id) + '" data-wb="' + esc(camp.wbId) + '">' +
                    (camp.live ? 'Пауза' : 'Старт') + '</button></td>' +
                    '</tr>'
                );
                if (!campOpen) continue;
                if (!camp.clusters.length) {
                    html.push('<tr class="ads-hq-empty"><td></td><td colspan="9" style="color:var(--text-muted);padding-left:44px">Кластеры появятся после sync_campaigns (adv_clusters)</td></tr>');
                    continue;
                }
                for (const cl of camp.clusters) {
                    html.push(
                        '<tr class="ads-hq-cl' + (state.selected && state.selected.clusterId === cl.id ? ' is-on' : '') + '">' +
                        '<td><input type="checkbox" class="ads-hq-check" data-kind="cluster" data-cabinet="' + esc(cab.id) + '" data-wb="' + esc(camp.wbId) + '" data-uuid="' + esc(camp.uuid || '') + '" data-cluster="' + esc(cl.id) + '"></td>' +
                        '<td style="padding-left:44px"><button type="button" class="ads-hq-link" data-pick="cluster" data-cabinet="' + esc(cab.id) + '" data-camp="' + esc(camp.uuid || '') + '" data-wb="' + esc(camp.wbId) + '" data-cluster="' + esc(cl.id) + '">' +
                        esc(cl.key) + '</button></td>' +
                        '<td colspan="2">' + (cl.active ? 'активен' : 'выкл') + '</td>' +
                        '<td>' + esc(cl.tier) + '</td>' +
                        '<td>' + (cl.pos != null ? ('поз. ' + cl.pos) : '—') + '</td>' +
                        '<td colspan="3">' + rangeLabel(cl.range) + '</td>' +
                        '<td></td>' +
                        '</tr>'
                    );
                }
            }
        }
        tb.innerHTML = html.join('');
    }

    function renderPhone() {
        const el = document.getElementById('ads-hq-phone');
        if (!el || !state.model) return;
        let rows = state.model.rows;
        if (state.filterCabinetId) rows = rows.filter((r) => r.id === state.filterCabinetId);
        if (!rows.length) {
            el.innerHTML = '<div class="ads-hq-phone-empty text-center py-8">Нет кабинетов или ещё нет данных синка.</div>';
            return;
        }
        const html = [];
        for (const cab of rows) {
            const cabOpen = state.open.cabinets.has(cab.id);
            const cap = cab.cap != null && Number.isFinite(Number(cab.cap)) ? formatMoney(cab.cap) : '—';
            html.push('<article class="ads-hq-phone-card">');
            html.push(
                '<button type="button" class="ads-hq-phone-head" data-expand="cab" data-id="' + esc(cab.id) + '">' +
                '<span>' + tokenHtml(cab.token) + ' ' + esc(cabName(cab.name)) + '</span>' +
                chevron(cabOpen) + '</button>'
            );
            html.push(
                '<div class="ads-hq-phone-metrics">' +
                '<span>Активных РК<b>' + cab.activeCampaigns + '</b></span>' +
                '<span>Сегодня / лимит<b>' + formatMoney(cab.spendToday) + ' / ' + cap + '</b></span>' +
                '<span>ДРР 7д<b>' + formatDrrLabel(cab.drr7) + '</b></span>' +
                '<span>Вне диапазона<b' + (cab.outRange ? ' style="color:var(--red)"' : '') + '>' + cab.outRange + '</b></span>' +
                '</div>'
            );
            html.push(
                '<div class="ads-hq-bulk" style="margin:0">' +
                '<button type="button" class="adv-camp-action-btn" data-act="pause-cab" data-cabinet="' + esc(cab.id) + '">Пауза</button>' +
                '<button type="button" class="adv-camp-action-btn" data-act="start-cab" data-cabinet="' + esc(cab.id) + '">Старт</button>' +
                '</div>'
            );
            if (cabOpen) {
                html.push('<div class="ads-hq-phone-camps">');
                if (!cab.campaigns.length) {
                    html.push('<div class="ads-hq-phone-empty">Нет кампаний в advertising_campaigns / adv_campaigns</div>');
                }
                for (const camp of cab.campaigns) {
                    const ck = cab.id + ':' + camp.wbId;
                    const campOpen = state.open.campaigns.has(ck);
                    html.push('<div class="ads-hq-phone-camp">');
                    html.push(
                        '<button type="button" class="ads-hq-expand" data-expand="camp" data-id="' + esc(ck) + '">' +
                        chevron(campOpen) + esc(camp.name) + ' <span class="ads-hq-mono">#' + esc(camp.wbId) + '</span></button>'
                    );
                    html.push('<div>' + statusPill(camp.status) + ' · ДРР ' + formatDrrLabel(formatDrr(camp.spend7, camp.revenue7)) + '</div>');
                    html.push(
                        '<button type="button" class="adv-camp-action-btn" data-act="' + (camp.live ? 'pause' : 'start') +
                        '" data-cabinet="' + esc(cab.id) + '" data-wb="' + esc(camp.wbId) + '">' +
                        (camp.live ? 'Пауза' : 'Старт') + '</button>'
                    );
                    if (campOpen) {
                        if (!camp.clusters.length) {
                            html.push('<div class="ads-hq-phone-empty">Кластеры появятся после sync_campaigns</div>');
                        }
                        for (const cl of camp.clusters) {
                            const on = state.selected && state.selected.clusterId === cl.id;
                            html.push(
                                '<button type="button" class="ads-hq-link" data-pick="cluster" data-cabinet="' +
                                esc(cab.id) + '" data-camp="' + esc(camp.uuid || '') + '" data-wb="' + esc(camp.wbId) +
                                '" data-cluster="' + esc(cl.id) + '"' + (on ? ' style="font-weight:700"' : '') + '>' +
                                esc(cl.key) + ' · ' + (cl.pos != null ? ('поз. ' + cl.pos) : '—') + ' · ' +
                                (cl.range === 'worse' ? 'хуже' : cl.range === 'in' ? 'в диапазоне' : '—') +
                                '</button>'
                            );
                        }
                    }
                    html.push('</div>');
                }
                html.push('</div>');
            }
            html.push('</article>');
        }
        el.innerHTML = html.join('');
    }

    function paintTree() {
        renderTable();
        renderPhone();
    }

    function fillFormFromRule(rule) {
        const f = defaultRuleForm();
        if (rule) {
            f.strategy = rule.strategy || f.strategy;
            f.target_pos_from = rule.target_pos_from ?? f.target_pos_from;
            f.target_pos_to = rule.target_pos_to ?? f.target_pos_to;
            f.max_bid = rule.max_bid == null ? '' : rule.max_bid;
            f.target_drr_pct = rule.target_drr_pct == null ? '' : rule.target_drr_pct;
            f.capMode = f.target_drr_pct !== '' ? 'target_drr' : 'max_bid';
            f.min_bid_floor = rule.min_bid_floor ?? f.min_bid_floor;
            f.step_pct = rule.step_pct != null ? Number(rule.step_pct) * 100 : f.step_pct;
            f.hysteresis = rule.hysteresis != null ? Number(rule.hysteresis) * 100 : f.hysteresis;
            f.organic_skip_threshold = rule.organic_skip_threshold ?? f.organic_skip_threshold;
            const hours = rule.schedule && Array.isArray(rule.schedule.hours) ? rule.schedule.hours : DEFAULT_HOURS;
            f.hours = hours.map(Number);
            f.boost = rule.schedule && rule.schedule.boost ? JSON.stringify(rule.schedule.boost) : '';
        }
        state.form = f;
        paintForm();
    }

    function paintForm() {
        const f = state.form;
        const set = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
        };
        set('ads-hq-strategy', f.strategy);
        set('ads-hq-pos-from', f.target_pos_from);
        set('ads-hq-pos-to', f.target_pos_to);
        set('ads-hq-max-bid', f.max_bid);
        set('ads-hq-drr', f.target_drr_pct);
        set('ads-hq-floor', f.min_bid_floor);
        set('ads-hq-step', f.step_pct);
        set('ads-hq-hyst', f.hysteresis);
        set('ads-hq-organic', f.organic_skip_threshold);
        const mode = document.getElementById('ads-hq-cap-mode');
        if (mode) mode.value = f.capMode;
        const hours = document.getElementById('ads-hq-hours');
        if (hours) {
            hours.innerHTML = HOURS.map((h) => {
                const on = f.hours.includes(h);
                return '<label class="ads-hq-hour' + (on ? ' on' : '') + '"><input type="checkbox" value="' + h + '"' + (on ? ' checked' : '') + '> ' + pad2(h) + '</label>';
            }).join('');
        }
        const hint = document.getElementById('ads-hq-rule-hint');
        if (hint) {
            if (!state.selected) hint.textContent = 'Выберите кластер или кампанию в таблице — форма привяжется к правилу v2.';
            else if (!state.selected.campaignUuid) hint.textContent = 'У этой РК ещё нет строки в adv_campaigns. Сохранение правила — после sync_campaigns.';
            else hint.textContent = (state.selected.clusterKey ? state.selected.clusterKey + ' · ' : '') + 'РК #' + state.selected.wbId;
        }
        const drrWrap = document.getElementById('ads-hq-drr-wrap');
        const maxWrap = document.getElementById('ads-hq-max-wrap');
        if (drrWrap) drrWrap.classList.toggle('hidden', f.capMode !== 'target_drr');
        if (maxWrap) maxWrap.classList.toggle('hidden', f.capMode !== 'max_bid');
    }

    function readForm() {
        const g = (id) => document.getElementById(id);
        const hours = [...document.querySelectorAll('#ads-hq-hours input:checked')].map((el) => Number(el.value));
        state.form = {
            strategy: (g('ads-hq-strategy') || {}).value || 'min_sufficient',
            target_pos_from: Number((g('ads-hq-pos-from') || {}).value || 5),
            target_pos_to: Number((g('ads-hq-pos-to') || {}).value || 10),
            capMode: (g('ads-hq-cap-mode') || {}).value || 'max_bid',
            max_bid: (g('ads-hq-max-bid') || {}).value,
            target_drr_pct: (g('ads-hq-drr') || {}).value,
            min_bid_floor: Number((g('ads-hq-floor') || {}).value || 0),
            step_pct: Number((g('ads-hq-step') || {}).value || 7),
            hysteresis: Number((g('ads-hq-hyst') || {}).value || 3),
            organic_skip_threshold: Number((g('ads-hq-organic') || {}).value || 5),
            hours,
            boost: state.form.boost,
        };
        return state.form;
    }

    let journalChart = null;

    function renderJournal() {
        const table = document.getElementById('ads-hq-journal-table');
        const empty = document.getElementById('ads-hq-journal-empty');
        const rows = state.history || [];
        if (empty) empty.classList.toggle('hidden', rows.length > 0);
        if (table) {
            table.innerHTML = rows.slice(0, 40).map((h) =>
                '<div class="autobidder-log-row">' +
                '<span>' + esc(String(h.created_at || '').replace('T', ' ').slice(0, 16)) + '</span>' +
                '<span>' + esc(h.source || '—') + '</span>' +
                '<span>' + esc(h.reason || '—') + (h.observed_pos != null ? ' · поз. ' + h.observed_pos : '') + '</span>' +
                '<span>' + esc(h.old_bid) + ' → ' + esc(h.new_bid) + '</span>' +
                '</div>'
            ).join('') || '';
        }
        const canvas = document.getElementById('ads-hq-journal-chart');
        if (!canvas || typeof Chart === 'undefined') return;
        const labels = rows.slice().reverse().map((h) => String(h.created_at || '').slice(5, 16));
        const bids = rows.slice().reverse().map((h) => num(h.new_bid));
        const pos = rows.slice().reverse().map((h) => (h.observed_pos == null ? null : num(h.observed_pos)));
        if (journalChart) journalChart.destroy();
        journalChart = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: labels.length ? labels : ['—'],
                datasets: [
                    { label: 'Ставка', data: bids.length ? bids : [null], yAxisID: 'y', borderColor: '#3B82F6', backgroundColor: 'transparent', tension: 0.25, pointRadius: 2 },
                    { label: 'Позиция', data: pos.length ? pos : [null], yAxisID: 'y1', borderColor: '#16A34A', backgroundColor: 'transparent', tension: 0.25, pointRadius: 2 },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: true, labels: { boxWidth: 8, font: { size: 11 } } } },
                scales: {
                    y: { position: 'left', ticks: { font: { size: 10 } }, grid: { color: 'rgba(0,0,0,0.06)' } },
                    y1: { position: 'right', reverse: true, ticks: { font: { size: 10 } }, grid: { drawOnChartArea: false } },
                    x: { ticks: { font: { size: 10 }, maxRotation: 0 }, grid: { display: false } },
                },
            },
        });
    }

    async function loadHistory(ruleId) {
        state.history = [];
        const sb = dep().supabase;
        if (!sb || !ruleId) {
            renderJournal();
            return;
        }
        const { data, error } = await sb.from('bid_history')
            .select('created_at, old_bid, new_bid, observed_pos, source, reason, applied')
            .eq('rule_id', ruleId)
            .order('created_at', { ascending: false })
            .limit(80);
        if (error) console.warn('[ads-hq] bid_history', error.message);
        state.history = data || [];
        renderJournal();
    }

    function findSelection(cabinetId, campaignUuid, clusterId, wbId) {
        const cab = (state.model && state.model.rows || []).find((r) => r.id === cabinetId);
        if (!cab) return null;
        const camp = cab.campaigns.find((c) => (campaignUuid && c.uuid === campaignUuid) || String(c.wbId) === String(wbId));
        if (!camp) return { cabinetId, cabinetName: cab.name, wbId, campaignUuid: campaignUuid || null, clusterId: null, clusterKey: '', rule: null };
        const cl = clusterId ? camp.clusters.find((x) => x.id === clusterId) : null;
        const rule = (cl && cl.rule) || (camp.rules && camp.rules[0]) || null;
        return {
            cabinetId,
            cabinetName: cab.name,
            wbId: camp.wbId,
            campaignUuid: camp.uuid,
            clusterId: cl ? cl.id : null,
            clusterKey: cl ? cl.key : '',
            rule,
        };
    }

    async function pickRow(cabinetId, campaignUuid, clusterId, wbId) {
        state.selected = findSelection(cabinetId, campaignUuid, clusterId, wbId);
        fillFormFromRule(state.selected && state.selected.rule);
        paintTree();
        await loadHistory(state.selected && state.selected.rule && state.selected.rule.id);
    }

    async function saveRule() {
        const sb = dep().supabase;
        const modal = dep().showPremiumModal;
        const f = readForm();
        if (!state.selected || !state.selected.campaignUuid) {
            if (modal) modal('error', 'Нет кампании v2', 'Сначала нужен sync_campaigns — строка в adv_campaigns.');
            return;
        }
        const payload = {
            campaign_id: state.selected.campaignUuid,
            cluster_id: state.selected.clusterId || null,
            strategy: f.strategy,
            target_pos_from: f.target_pos_from,
            target_pos_to: f.target_pos_to,
            max_bid: f.capMode === 'max_bid' && f.max_bid !== '' ? Number(f.max_bid) : null,
            target_drr_pct: f.capMode === 'target_drr' && f.target_drr_pct !== '' ? Number(f.target_drr_pct) : null,
            min_bid_floor: f.min_bid_floor,
            step_pct: f.step_pct / 100,
            hysteresis: f.hysteresis / 100,
            organic_skip_threshold: f.organic_skip_threshold,
            schedule: { hours: f.hours },
            is_active: true,
            updated_at: new Date().toISOString(),
        };
        const existing = state.selected.rule && state.selected.rule.id;
        const q = existing
            ? sb.from('autobidder_rules').update(payload).eq('id', existing)
            : sb.from('autobidder_rules').insert(payload);
        const { error } = await q;
        if (error) {
            if (modal) modal('error', 'Правило не сохранилось', error.message);
            return;
        }
        if (modal) modal('success', 'Правило сохранено', 'Тик v2 подхватит его на следующем проходе (DRY_RUN пока включён).');
        await load();
    }

    async function runBulk(verb, items) {
        const call = dep().callWbProxy;
        const modal = dep().showPremiumModal;
        if (!call) return;
        const camps = [];
        const seen = new Set();
        for (const it of items) {
            if (it.kind === 'cabinet') {
                const cab = state.model.rows.find((r) => r.id === it.cabinetId);
                for (const c of (cab && cab.campaigns) || []) {
                    const k = it.cabinetId + ':' + c.wbId;
                    if (seen.has(k)) continue;
                    seen.add(k);
                    camps.push({ cabinetId: it.cabinetId, wbId: c.wbId });
                }
            } else if (it.wbId) {
                const k = it.cabinetId + ':' + it.wbId;
                if (seen.has(k)) continue;
                seen.add(k);
                camps.push({ cabinetId: it.cabinetId, wbId: it.wbId });
            }
        }
        if (!camps.length) {
            if (modal) modal('error', 'Ничего не выбрано', 'Отметьте кабинеты или кампании.');
            return;
        }
        let ok = 0;
        let fail = 0;
        for (const c of camps) {
            const result = await call(verb === 'start' ? 'advert_start' : 'advert_pause', { advertId: c.wbId }, c.cabinetId);
            if (result) ok += 1;
            else fail += 1;
        }
        if (modal) {
            modal(fail ? 'error' : 'success',
                verb === 'start' ? 'Запуск' : 'Пауза',
                'Готово: ' + ok + ', ошибок: ' + fail + '. Edge Function adv_bulk_action ещё нет — шлём по одной через существующий proxy.');
        }
        await load();
    }

    async function applyTemplate() {
        const items = selectedKeys().filter((x) => x.kind === 'campaign' || x.kind === 'cluster');
        const modal = dep().showPremiumModal;
        const sb = dep().supabase;
        if (!items.length) {
            if (modal) modal('error', 'Нет выбора', 'Отметьте кампании или кластеры.');
            return;
        }
        const f = readForm();
        let saved = 0;
        for (const it of items) {
            if (!it.uuid) continue;
            const payload = {
                campaign_id: it.uuid,
                cluster_id: it.kind === 'cluster' && it.cluster ? it.cluster : null,
                strategy: f.strategy,
                target_pos_from: f.target_pos_from,
                target_pos_to: f.target_pos_to,
                max_bid: f.capMode === 'max_bid' && f.max_bid !== '' ? Number(f.max_bid) : null,
                min_bid_floor: f.min_bid_floor,
                step_pct: f.step_pct / 100,
                hysteresis: f.hysteresis / 100,
                organic_skip_threshold: f.organic_skip_threshold,
                schedule: { hours: f.hours },
                is_active: true,
                updated_at: new Date().toISOString(),
            };
            const { error } = await sb.from('autobidder_rules').insert(payload);
            if (!error) saved += 1;
        }
        if (modal) modal(saved ? 'success' : 'error', 'Шаблон', saved ? ('Правила с текущей формой: ' + saved) : 'Нужен uuid кампании из adv_campaigns.');
        await load();
    }

    function bindOnce() {
        const root = document.getElementById('adv-view-ads');
        if (!root || root.dataset.bound === '1') return;
        root.dataset.bound = '1';
        root.addEventListener('click', (e) => {
            const expand = e.target.closest('[data-expand]');
            if (expand) {
                const kind = expand.dataset.expand;
                const id = expand.dataset.id;
                const set = kind === 'cab' ? state.open.cabinets : state.open.campaigns;
                if (set.has(id)) set.delete(id);
                else set.add(id);
                paintTree();
                return;
            }
            const pick = e.target.closest('[data-pick="cluster"]');
            if (pick) {
                pickRow(pick.dataset.cabinet, pick.dataset.camp, pick.dataset.cluster, pick.dataset.wb);
                return;
            }
            const act = e.target.closest('[data-act]');
            if (act) {
                const verb = act.dataset.act === 'start' || act.dataset.act === 'start-cab' ? 'start' : 'pause';
                if (act.dataset.act.endsWith('-cab')) {
                    runBulk(verb, [{ kind: 'cabinet', cabinetId: act.dataset.cabinet }]);
                } else {
                    runBulk(verb, [{ kind: 'campaign', cabinetId: act.dataset.cabinet, wbId: act.dataset.wb }]);
                }
            }
        });
        document.getElementById('ads-hq-save')?.addEventListener('click', () => saveRule());
        document.getElementById('ads-hq-bulk-pause')?.addEventListener('click', () => runBulk('pause', selectedKeys()));
        document.getElementById('ads-hq-bulk-start')?.addEventListener('click', () => runBulk('start', selectedKeys()));
        document.getElementById('ads-hq-bulk-tpl')?.addEventListener('click', () => applyTemplate());
        document.getElementById('ads-hq-cap-mode')?.addEventListener('change', () => {
            state.form.capMode = document.getElementById('ads-hq-cap-mode').value;
            paintForm();
        });
        document.getElementById('ads-hq-hours')?.addEventListener('change', () => {
            document.querySelectorAll('#ads-hq-hours label').forEach((lab) => {
                lab.classList.toggle('on', lab.querySelector('input')?.checked);
            });
        });
        document.getElementById('ads-hq-reload')?.addEventListener('click', () => load());
    }

    async function safeRows(table, filters, columns) {
        const fetchAll = dep().fetchAllRows;
        if (!fetchAll) return [];
        try {
            return await fetchAll(table, filters, columns) || [];
        } catch (e) {
            console.warn('[ads-hq]', table, e);
            return [];
        }
    }

    async function load() {
        if (state.loading) return;
        state.loading = true;
        const note = document.getElementById('ads-hq-freshness');
        if (note) note.textContent = 'обновляем…';
        try {
            const now = new Date();
            const today = ymd(now);
            const from7 = ymd(addDays(now, -6));
            const cabs = await safeRows('cabinets', [], 'id, name, wb_token, adv_token_valid, adv_token_secret_id, adv_daily_budget_cap');
            const cabinets = (cabs || []).filter((c) => !state.filterCabinetId || c.id === state.filterCabinetId);
            const ids = cabinets.map((c) => c.id);
            const [legacyCampaigns, legacyStats, v2Campaigns] = ids.length ? await Promise.all([
                safeRows('advertising_campaigns', [{ op: 'in', column: 'cabinet_id', value: ids }]),
                safeRows('advertising_daily_stats', [
                    { op: 'in', column: 'cabinet_id', value: ids },
                    { op: 'gte', column: 'stat_date', value: from7 },
                    { op: 'lte', column: 'stat_date', value: today },
                ]),
                safeRows('adv_campaigns', [{ op: 'in', column: 'cabinet_id', value: ids }]),
            ]) : [[], [], []];
            const v2Ids = (v2Campaigns || []).map((c) => c.id);
            const [clusters, rules, snapshots, v2Stats] = v2Ids.length ? await Promise.all([
                safeRows('adv_clusters', [{ op: 'in', column: 'campaign_id', value: v2Ids }]),
                safeRows('autobidder_rules', [{ op: 'in', column: 'campaign_id', value: v2Ids }]),
                safeRows('serp_position_snapshots', [{ op: 'in', column: 'campaign_id', value: v2Ids }]),
                safeRows('adv_daily_stats', [
                    { op: 'in', column: 'campaign_id', value: v2Ids },
                    { op: 'gte', column: 'date', value: from7 },
                ]),
            ]) : [[], [], [], []];
            state.model = buildHqModel({
                today, from7, cabinets, legacyCampaigns, legacyStats, v2Campaigns, clusters, rules, snapshots, v2Stats,
            });
            if (!state.open.cabinets.size && state.model.rows[0]) {
                state.open.cabinets.add(state.model.rows[0].id);
                const firstCamp = state.model.rows[0].campaigns[0];
                if (firstCamp && firstCamp.clusters.length) {
                    state.open.campaigns.add(state.model.rows[0].id + ':' + firstCamp.wbId);
                }
            }
            renderKpis(state.model.totals);
            paintTree();
            paintForm();
            renderJournal();
            if (note) note.textContent = 'сегодня ' + today + ' · ДРР за 7 дней';
        } finally {
            state.loading = false;
        }
    }

    function init(deps) {
        state.deps = deps || {};
        bindOnce();
        paintForm();
    }

    function open(opts) {
        state.filterCabinetId = '';
        if (opts && opts.cabinetId) state.open.cabinets.add(opts.cabinetId);
        bindOnce();
        load();
    }

    const AdsHQ = {
        buildHqModel,
        formatMoney,
        formatDrr,
        formatDrrLabel,
        tokenState,
        ruleRangeStatus,
        defaultRuleForm,
        init,
        open,
        load,
        renderTable,
        renderPhone,
        paintForm,
        ymd,
        addDays,
    };

    root.AdsHQ = AdsHQ;
    if (typeof module !== 'undefined' && module.exports) module.exports = AdsHQ;
})(typeof window !== 'undefined' ? window : globalThis);

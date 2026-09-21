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

    function resolveHqRange(input) {
        const src = input || {};
        let from = String(src.from || src.from7 || '').slice(0, 10);
        let to = String(src.to || src.today || '').slice(0, 10);
        if (from && to && from > to) {
            const swap = from;
            from = to;
            to = swap;
        }
        return { from, to };
    }

    function num(v) {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    }

    function formatMoney(n) {
        if (n == null || !Number.isFinite(Number(n))) return '—';
        return Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 0 });
    }

    function formatInt(n) {
        if (n == null || !Number.isFinite(Number(n))) return '—';
        return Math.round(Number(n)).toLocaleString('ru-RU', { maximumFractionDigits: 0 });
    }

    function formatMoney2(n) {
        if (n == null || !Number.isFinite(Number(n))) return '—';
        const x = Number(n);
        const sign = x < 0 ? '-' : '';
        const [i, f] = Math.abs(x).toFixed(2).split('.');
        return sign + i.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0') + '.' + f;
    }

    function formatFixed(n, digits) {
        if (n == null || !Number.isFinite(Number(n))) return '—';
        return Number(n).toFixed(digits);
    }

    function formatPct2(n) {
        if (n == null || !Number.isFinite(Number(n))) return '—';
        return Number(n).toFixed(2) + ' %';
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

    const WB_METRIC_COLS = [
        { key: 'budget', title: 'Остаток бюджета' },
        { key: 'spend', title: 'Затраты' },
        { key: 'views', title: 'Показы' },
        { key: 'ctr', title: 'CTR' },
        { key: 'orders', title: 'Созданные заказы' },
        { key: 'shks', title: 'Принятые заказы' },
        { key: 'drr', title: 'Доля затрат' },
        { key: 'pos', title: 'Позиция в поиске' },
        { key: 'clicks', title: 'Клики' },
        { key: 'atbs', title: 'Добавления в корзину' },
        { key: 'revenue', title: 'Сумма заказов' },
        { key: 'cpc', title: 'CPC' },
        { key: 'cpo', title: 'CPO' },
        { key: 'cr', title: 'CR' },
        { key: 'cpm', title: 'CPM' },
        { key: 'roas', title: 'ROAS' },
        { key: 'cancels', title: 'Отмены технические' },
    ];

    const COL_PRESETS = {
        all: {
            id: 'all',
            label: 'Все',
            cols: WB_METRIC_COLS,
        },
        stats: {
            id: 'stats',
            label: 'Затраты',
            cols: [
                { key: 'budget', title: 'Остаток бюджета' },
                { key: 'spend', title: 'Затраты' },
                { key: 'views', title: 'Показы' },
                { key: 'ctr', title: 'CTR' },
                { key: 'orders', title: 'Созданные заказы' },
                { key: 'shks', title: 'Принятые заказы' },
            ],
        },
        funnel: {
            id: 'funnel',
            label: 'Воронка',
            cols: [
                { key: 'budget', title: 'Остаток бюджета' },
                { key: 'drr', title: 'Доля затрат' },
                { key: 'pos', title: 'Позиция в поиске' },
                { key: 'clicks', title: 'Клики' },
                { key: 'atbs', title: 'Добавления в корзину' },
                { key: 'revenue', title: 'Сумма заказов' },
            ],
        },
        unit: {
            id: 'unit',
            label: 'Эффективность',
            cols: [
                { key: 'budget', title: 'Остаток бюджета' },
                { key: 'cpc', title: 'CPC' },
                { key: 'cpo', title: 'CPO' },
                { key: 'cr', title: 'CR' },
                { key: 'cpm', title: 'CPM' },
                { key: 'roas', title: 'ROAS' },
                { key: 'cancels', title: 'Отмены технические' },
            ],
        },
    };

    function campHasStats(camp) {
        if (!camp) return false;
        return num(camp.spendToday) > 0 || num(camp.views) > 0 || num(camp.clicks) > 0
            || num(camp.orders) > 0 || num(camp.atbs) > 0 || num(camp.shks) > 0;
    }

    function formatMetric(camp, key) {
        const na = 'Н/Д';
        const has = campHasStats(camp);
        const spend = num(camp && camp.spendToday);
        const views = num(camp && camp.views);
        const clicks = num(camp && camp.clicks);
        const orders = num(camp && camp.orders);
        const shks = num(camp && camp.shks);
        const atbs = num(camp && camp.atbs);
        const rev = num(camp && camp.revenue7);
        const pos = camp && camp.searchPos;
        switch (key) {
            case 'budget':
            case 'limit':
                return na;
            case 'cancels':
                if (!has && camp && camp.canceled == null) return na;
                return formatInt(camp && camp.canceled);
            case 'spend':
                return has ? formatMoney2(spend) : na;
            case 'views':
                return has ? formatInt(views) : na;
            case 'ctr':
                return has && clicks > 0 && views > 0 ? formatPct2(clicks / views * 100) : na;
            case 'orders':
                return has ? formatInt(orders) : na;
            case 'shks':
                return has ? formatInt(shks) : na;
            case 'drr':
                return has && rev > 0 ? formatPct2(spend / rev * 100) : na;
            case 'pos':
                return pos != null && Number(pos) > 0 ? String(Math.round(Number(pos))) : na;
            case 'clicks':
                return has ? formatInt(clicks) : na;
            case 'atbs':
                return has ? formatInt(atbs) : na;
            case 'revenue':
                return has ? formatInt(rev) : na;
            case 'cpc':
                return has && clicks > 0 ? formatMoney2(spend / clicks) : na;
            case 'cpo':
                return has && orders > 0 ? formatMoney2(spend / orders) : na;
            case 'cr':
                return has && clicks > 0 ? formatFixed(orders / clicks * 100, 2) : na;
            case 'cpm':
                return has && views > 0 ? formatMoney2(spend / views * 1000) : na;
            case 'roas':
                return has && spend > 0 && rev > 0 ? formatFixed(rev / spend, 2) : na;
            default:
                return na;
        }
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

    const TYPE_LABELS = {
        4: 'Каталог / полка',
        5: 'Карточка',
        6: 'Поиск',
        7: 'Рекомендации',
        8: 'Авто',
        9: 'Поиск + каталог',
        manual_bid: 'Поиск + полка',
        auto_bid: 'Авто',
    };

    function campaignTypeLabel(type) {
        if (type == null || type === '') return '—';
        const n = Number(type);
        if (Number.isFinite(n) && TYPE_LABELS[n]) return TYPE_LABELS[n];
        const key = String(type);
        if (TYPE_LABELS[key]) return TYPE_LABELS[key];
        return key;
    }

    function normalizeCampaignStatus(status) {
        if (status === 'active' || status === 9 || status === '9') return 9;
        if (status === 'paused' || status === 11 || status === '11') return 11;
        if (status === 4 || status === '4' || status === 'ready') return 4;
        if (status === 7 || status === '7' || status === 'done') return 7;
        return status;
    }

    function campaignStatusLabel(status) {
        const s = normalizeCampaignStatus(status);
        if (s === 9) return 'Активна';
        if (s === 11) return 'Приостановлена';
        if (s === 4) return 'Готова к запуску';
        if (s === 7) return 'Завершена';
        return status == null || status === '' ? '—' : String(status);
    }

    function bidTypeLabel(bidType) {
        const raw = String(bidType || '').toLowerCase();
        if (raw === 'manual') return 'Ручная';
        if (raw === 'auto' || raw === 'unified') return 'Единая';
        return '';
    }

    function paymentTypeLabel(paymentType) {
        const raw = String(paymentType || '').toLowerCase();
        if (raw === 'cpc') return 'CPC';
        if (raw === 'cpm') return 'CPM';
        return '';
    }

    // WB: 7 завершена, 8 отклонена, -1 удалена. Не показываем даже на «Все».
    function campaignEnded(camp) {
        const status = camp != null && typeof camp === 'object' ? camp.status : camp;
        const s = normalizeCampaignStatus(status);
        if (s === 7 || s === -1 || s === 8) return true;
        const raw = String(status == null ? '' : status).toLowerCase();
        return raw === 'deleted' || raw === 'refused';
    }

    function listableCampaigns(campaigns) {
        return (campaigns || []).filter((c) => !campaignEnded(c));
    }

    function campaignMatchesSearch(camp, query) {
        const q = String(query || '').trim().toLowerCase();
        if (!q) return true;
        const name = String(camp && camp.name || '').toLowerCase();
        const id = String(camp && camp.wbId != null ? camp.wbId : '');
        return name.includes(q) || id.includes(q);
    }

    function nmIdFromName(name) {
        const s = String(name || '').trim();
        const m = s.match(/^(\d{6,})\b/) || s.match(/(?:^|[^\d])(\d{6,})(?:[^\d]|$)/);
        const n = m ? Number(m[1]) : 0;
        return Number.isFinite(n) && n > 0 ? n : 0;
    }

    function nmList(v) {
        if (Array.isArray(v)) return v;
        if (v && typeof v === 'object') return [v];
        if (v != null && v !== '') return [v];
        return [];
    }

    function pushNmId(out, nm) {
        const id = Number(nm && typeof nm === 'object'
            ? (nm.nmId ?? nm.nmID ?? nm.nm_id ?? nm.nm ?? nm.id)
            : nm);
        if (Number.isFinite(id) && id > 0) out.push(Math.trunc(id));
    }

    function nmIdsFromDayData(data) {
        const out = [];
        if (!data || typeof data !== 'object') return out;
        for (const nm of nmList(data.nms).concat(nmList(data.nm), nmList(data.nmIds))) pushNmId(out, nm);
        for (const app of nmList(data.apps)) {
            if (!app) continue;
            for (const nm of nmList(app.nms).concat(nmList(app.nm), nmList(app.nmIds))) pushNmId(out, nm);
        }
        return out;
    }

    function nmIdByCampaignFromStats(legacyStats) {
        const votes = new Map();
        for (const r of legacyStats || []) {
            const ck = String(r.cabinet_id) + ':' + String(r.campaign_id);
            const ids = nmIdsFromDayData(r.data);
            if (!ids.length) continue;
            let bag = votes.get(ck);
            if (!bag) { bag = new Map(); votes.set(ck, bag); }
            for (const id of ids) bag.set(id, (bag.get(id) || 0) + 1);
        }
        const out = new Map();
        for (const [ck, bag] of votes) {
            let best = 0;
            let n = 0;
            for (const [id, c] of bag) {
                if (c > n) { best = id; n = c; }
            }
            if (best) out.set(ck, best);
        }
        return out;
    }

    function articleIndex(articles) {
        const photos = new Map();
        const prices = new Map();
        const namesByCab = new Map();
        const namesAll = [];
        const titles = new Map();
        for (const a of articles || []) {
            const id = Number(a && a.nm_id);
            if (!id) continue;
            const cab = a.cabinet_id != null ? String(a.cabinet_id) : '';
            const url = String(a.photo_url || '').trim();
            if (url) {
                photos.set(id, url);
                if (cab) photos.set(cab + ':' + id, url);
            }
            const md = a.manual_data && typeof a.manual_data === 'object' ? a.manual_data : {};
            const price = Number(md.price || md.wb_price || md.discount_price || md.sale_price || a.price || 0);
            if (price > 0) {
                prices.set(id, price);
                if (cab) prices.set(cab + ':' + id, price);
            }
            const title = String(a.name || md.sa_name || '').trim();
            if (title) {
                titles.set(id, title);
                if (cab) titles.set(cab + ':' + id, title);
            }
            const label = String(md.seller_article || md.sa_name || a.name || '').trim();
            if (label.length < 4) continue;
            const row = { id, label: label.toLowerCase() };
            namesAll.push(row);
            if (!cab) continue;
            const list = namesByCab.get(cab) || [];
            list.push(row);
            namesByCab.set(cab, list);
        }
        namesAll.sort((a, b) => b.label.length - a.label.length);
        for (const list of namesByCab.values()) list.sort((a, b) => b.label.length - a.label.length);
        return { photos, prices, titles, namesByCab, namesAll };
    }

    function stockIndex(stocks) {
        const map = new Map();
        for (const s of stocks || []) {
            const id = Number(s && s.nm_id);
            if (!id) continue;
            const cab = s.cabinet_id != null ? String(s.cabinet_id) : '';
            const q = num(s.quantity || s.quantity_full || s.quantityFull);
            if (!q) continue;
            map.set(id, (map.get(id) || 0) + q);
            if (cab) map.set(cab + ':' + id, (map.get(cab + ':' + id) || 0) + q);
        }
        return map;
    }

    function nmsFromDayData(data) {
        const out = [];
        if (!data || typeof data !== 'object') return out;
        for (const app of nmList(data.apps)) {
            if (!app) continue;
            for (const nm of nmList(app.nms).concat(nmList(app.nm))) {
                const id = Number(nm && typeof nm === 'object'
                    ? (nm.nmId ?? nm.nmID ?? nm.nm_id ?? nm.nm ?? nm.id)
                    : nm);
                if (!Number.isFinite(id) || id <= 0) continue;
                out.push({
                    nmId: Math.trunc(id),
                    name: String((nm && nm.name) || ''),
                    spend: num(nm && (nm.sum || nm.spend)),
                    views: num(nm && nm.views),
                    clicks: num(nm && nm.clicks),
                    orders: num(nm && nm.orders),
                    atbs: num(nm && (nm.atbs || nm.carts)),
                    revenue: num(nm && (nm.sum_price || nm.revenue)),
                    canceled: num(nm && nm.canceled),
                    shks: num(nm && nm.shks),
                });
            }
        }
        return out;
    }

    function canceledFromRow(r) {
        if (r && r.canceled != null && r.canceled !== '') return num(r.canceled);
        const d = r && r.data;
        if (d && d.canceled != null) return num(d.canceled);
        return 0;
    }

    function shksFromRow(r) {
        if (r && r.shks != null && r.shks !== '') return num(r.shks);
        const d = r && r.data;
        if (d && d.shks != null) return num(d.shks);
        return 0;
    }

    function posFromRow(r) {
        const d = r && r.data;
        const boost = d && (d.boosterStats || d.booster_stats);
        if (!Array.isArray(boost) || !boost.length) return null;
        const vals = boost.map((b) => Number(b && (b.avg_position || b.avgPosition)))
            .filter((n) => Number.isFinite(n) && n > 0);
        if (!vals.length) return null;
        return vals.reduce((a, b) => a + b, 0) / vals.length;
    }

    function nmIdFromArticleName(name, names) {
        const s = String(name || '').toLowerCase();
        if (!s) return 0;
        for (const row of names || []) {
            if (row.label && s.includes(row.label)) return row.id;
        }
        return 0;
    }

    function wbBasketHost(vol) {
        const n = Number(vol) || 0;
        const map = [
            [0, 143, 1], [144, 287, 2], [288, 431, 3], [432, 719, 4],
            [720, 1007, 5], [1008, 1061, 6], [1062, 1115, 7], [1116, 1169, 8],
            [1170, 1313, 9], [1314, 1601, 10], [1602, 1655, 11], [1656, 1919, 12],
            [1920, 2045, 13], [2046, 2189, 14], [2190, 2405, 15],
        ];
        const found = map.find((row) => n >= row[0] && n <= row[1]);
        if (found) return found[2];
        const anchors = [
            [2406, 16], [2626, 17], [2876, 18], [3074, 19], [3345, 20], [3911, 22],
            [3996, 23], [4143, 24], [4357, 25], [4950, 27], [5394, 28], [5978, 30],
            [6296, 31], [6641, 32], [7053, 33], [7408, 35], [7714, 36], [8493, 38],
            [8897, 39], [9719, 41], [11503, 43], [12187, 44], [15444, 48],
        ];
        const last = anchors[anchors.length - 1];
        if (n >= last[0]) return last[1] + Math.round((n - last[0]) / 760);
        let host = 16;
        for (const [anchorVol, anchorHost] of anchors) {
            if (n < anchorVol) break;
            host = anchorHost;
        }
        return host;
    }

    function campPhotoUrl(nmId, stored) {
        const s = String(stored || '').trim();
        if (/^https?:\/\//i.test(s)) return s;
        const n = Number(nmId);
        if (!n) return '';
        const vol = Math.floor(n / 100000);
        const part = Math.floor(n / 1000);
        const host = String(wbBasketHost(vol)).padStart(2, '0');
        return 'https://basket-' + host + '.wbbasket.ru/vol' + vol + '/part' + part + '/' + n + '/images/c246x328/1.webp';
    }

    function campThumbHtml(url, nmId) {
        if (!url) return '';
        return '<img class="ads-hq-thumb" src="' + esc(url) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"' +
            (nmId ? ' data-nmid="' + esc(nmId) + '"' : '') +
            ' onerror="this.remove()">';
    }

    function resolveCampNmId(name, wbId, statsNm, names) {
        let n = nmIdFromName(name);
        if (n && Number(n) === Number(wbId)) n = 0;
        return n || Number(statsNm) || nmIdFromArticleName(name, names) || 0;
    }

    function compareCampaigns(a, b) {
        const yu = (b && b.usedYesterday ? 1 : 0) - (a && a.usedYesterday ? 1 : 0);
        if (yu) return yu;
        const rec = (Number(b && b.recentAt) || 0) - (Number(a && a.recentAt) || 0);
        if (rec) return rec;
        const last = String((b && b.lastSpendDate) || '').localeCompare(String((a && a.lastSpendDate) || ''));
        if (last) return last;
        const sp = (Number(b && b.spendToday) || 0) - (Number(a && a.spendToday) || 0);
        if (sp) return sp;
        const live = (b && b.live ? 1 : 0) - (a && a.live ? 1 : 0);
        if (live) return live;
        return String((a && a.name) || '').localeCompare(String((b && b.name) || ''), 'ru');
    }

    function filterCampaigns(campaigns, mode, query) {
        let list = listableCampaigns(campaigns);
        if (mode !== 'all') list = list.filter((c) => c.live);
        if (query) list = list.filter((c) => campaignMatchesSearch(c, query));
        return list.slice().sort(compareCampaigns);
    }

    function extendRangeForRanking(range, now) {
        const src = range || {};
        const n = now instanceof Date ? now : new Date();
        const yest = ymd(addDays(n, -1));
        const from = src.from && src.from < yest ? src.from : yest;
        const to = src.to && src.to > yest ? src.to : yest;
        return { from, to, yesterday: yest };
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
        const range = resolveHqRange(input);
        const from = range.from;
        const to = range.to;
        const today = to;
        const from7 = from;
        const cabinets = input.cabinets || [];
        const legacyCamps = input.legacyCampaigns || [];
        const legacyStats = input.legacyStats || [];
        const v2Camps = input.v2Campaigns || [];
        const clusters = input.clusters || [];
        const rules = input.rules || [];
        const snaps = input.snapshots || [];
        const v2Stats = input.v2Stats || [];
        const statsNmByCamp = nmIdByCampaignFromStats(legacyStats);
        const artIdx = articleIndex(input.articles);
        const stocks = stockIndex(input.stocks);

        const spendToday = new Map();
        const spend7 = new Map();
        const rev7 = new Map();
        const lastSpend = new Map();
        const spendYesterday = new Map();
        const clicksIn = new Map();
        const cartsIn = new Map();
        const ordersIn = new Map();
        const viewsIn = new Map();
        const canceledIn = new Map();
        const shksIn = new Map();
        const posIn = new Map();
        const posDay = new Map();
        const productDays = [];
        const now = input.now instanceof Date ? input.now : new Date();
        const yesterday = String(input.yesterday || ymd(addDays(now, -1))).slice(0, 10);
        function bump(map, key, n) {
            const v = num(n);
            if (!v) return;
            map.set(key, (map.get(key) || 0) + v);
        }
        function addStat(cabinetId, campaignKey, date, spend, revenue, clicks, carts, orders, views, canceled, searchPos, shks) {
            const day = String(date || '').slice(0, 10);
            const ck = cabinetId + ':' + campaignKey;
            const n = num(spend);
            if (n > 0) {
                const prev = lastSpend.get(ck);
                if (!prev || day > prev) lastSpend.set(ck, day);
                if (day === yesterday) {
                    spendYesterday.set(cabinetId, (spendYesterday.get(cabinetId) || 0) + n);
                    spendYesterday.set(ck, (spendYesterday.get(ck) || 0) + n);
                }
            }
            if (from && day < from) return;
            if (to && day > to) return;
            spendToday.set(cabinetId, (spendToday.get(cabinetId) || 0) + n);
            spendToday.set(ck, (spendToday.get(ck) || 0) + n);
            spend7.set(cabinetId, (spend7.get(cabinetId) || 0) + n);
            rev7.set(cabinetId, (rev7.get(cabinetId) || 0) + revenue);
            spend7.set(ck, (spend7.get(ck) || 0) + n);
            rev7.set(ck, (rev7.get(ck) || 0) + revenue);
            bump(clicksIn, cabinetId, clicks);
            bump(clicksIn, ck, clicks);
            bump(cartsIn, cabinetId, carts);
            bump(cartsIn, ck, carts);
            bump(ordersIn, cabinetId, orders);
            bump(ordersIn, ck, orders);
            bump(viewsIn, cabinetId, views);
            bump(viewsIn, ck, views);
            bump(canceledIn, cabinetId, canceled);
            bump(canceledIn, ck, canceled);
            bump(shksIn, cabinetId, shks);
            bump(shksIn, ck, shks);
            if (searchPos != null && Number(searchPos) > 0) {
                const prev = posDay.get(ck);
                if (!prev || day >= prev) {
                    posDay.set(ck, day);
                    posIn.set(ck, Math.round(Number(searchPos)));
                }
            }
        }
        for (const r of legacyStats) {
            addStat(
                r.cabinet_id, String(r.campaign_id), r.stat_date,
                num(r.spend), num(r.sum_price || r.revenue),
                num(r.clicks), num(r.atbs || r.carts), num(r.orders),
                num(r.views), canceledFromRow(r), posFromRow(r), shksFromRow(r)
            );
            const day = String(r.stat_date || '').slice(0, 10);
            if (from && day < from) continue;
            if (to && day > to) continue;
            for (const nm of nmsFromDayData(r.data)) {
                productDays.push({ cabinetId: r.cabinet_id, campaignId: String(r.campaign_id), ...nm });
            }
        }
        const v2CabByCamp = new Map(v2Camps.map((c) => [c.id, c.cabinet_id]));
        for (const r of v2Stats) {
            const cab = v2CabByCamp.get(r.campaign_id);
            if (!cab) continue;
            addStat(
                cab, r.campaign_id, r.date, num(r.spend), num(r.revenue),
                num(r.clicks), num(r.carts || r.atbs), num(r.orders),
                num(r.views), num(r.canceled), null, num(r.shks)
            );
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
                    status: normalizeCampaignStatus(c.status),
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
                const status = normalizeCampaignStatus(raw.status);
                const spendKeyWb = cab.id + ':' + String(wbId);
                const spendKeyUuid = campUuid ? cab.id + ':' + String(campUuid) : '';
                const pickSpend = (map) => {
                    if (map.has(spendKeyWb)) return map.get(spendKeyWb);
                    if (spendKeyUuid && map.has(spendKeyUuid)) return map.get(spendKeyUuid);
                    return 0;
                };
                const pickLast = () => lastSpend.get(spendKeyWb) || (spendKeyUuid ? lastSpend.get(spendKeyUuid) : '') || '';
                const name = raw.campaign_name || (v2 && v2.name) || ('РК ' + wbId);
                const nmId = resolveCampNmId(
                    name,
                    wbId,
                    statsNmByCamp.get(spendKeyWb) || (spendKeyUuid ? statsNmByCamp.get(spendKeyUuid) : 0),
                    artIdx.namesByCab.get(String(cab.id)) || artIdx.namesAll
                );
                const stored = nmId
                    ? (artIdx.photos.get(String(cab.id) + ':' + nmId) || artIdx.photos.get(nmId) || '')
                    : '';
                const clusterPos = mappedClusters
                    .map((cl) => cl.pos)
                    .filter((p) => p != null && Number(p) > 0);
                const snapPos = clusterPos.length ? Math.min.apply(null, clusterPos) : null;
                const fromBoost = posIn.get(spendKeyWb) || (spendKeyUuid ? posIn.get(spendKeyUuid) : 0) || 0;
                const price = nmId
                    ? (artIdx.prices.get(String(cab.id) + ':' + nmId) || artIdx.prices.get(nmId) || 0)
                    : 0;
                const stock = nmId
                    ? (stocks.get(String(cab.id) + ':' + nmId) || stocks.get(nmId) || 0)
                    : 0;
                return {
                    cabinetId: cab.id,
                    wbId,
                    uuid: campUuid || null,
                    name,
                    nmId: nmId || 0,
                    photoUrl: campPhotoUrl(nmId, stored),
                    price,
                    stock,
                    status,
                    type: raw.type || (v2 && v2.campaign_type) || '',
                    typeLabel: campaignTypeLabel(raw.type || (v2 && v2.campaign_type) || ''),
                    paymentType: raw.payment_type || (v2 && (v2.payment_type || v2.paymentType)) || '',
                    bidType: raw.bid_type || (v2 && (v2.bid_type || v2.bidType)) || '',
                    live: campaignLive(status),
                    spendToday: pickSpend(spendToday),
                    spend7: pickSpend(spend7),
                    revenue7: pickSpend(rev7),
                    views: pickSpend(viewsIn),
                    clicks: pickSpend(clicksIn),
                    atbs: pickSpend(cartsIn),
                    orders: pickSpend(ordersIn),
                    shks: pickSpend(shksIn),
                    canceled: pickSpend(canceledIn),
                    searchPos: fromBoost || snapPos || null,
                    usedYesterday: pickSpend(spendYesterday) > 0,
                    lastSpendDate: pickLast(),
                    clusters: mappedClusters,
                    rules: campRules,
                };
            });
            campaigns.sort(compareCampaigns);

            for (const camp of campaigns) {
                for (const rule of camp.rules || []) {
                    if (rule.reason === 'max_bid_hit') maxHit += 1;
                }
            }

            const listed = listableCampaigns(campaigns);
            const listedIds = new Set(listed.map((c) => String(c.wbId)));
            const sumField = (field) => listed.reduce((s, c) => s + num(c[field]), 0);
            const spendT = sumField('spendToday');
            const s7 = sumField('spend7');
            const r7 = sumField('revenue7');
            const views = sumField('views');
            const clicks = sumField('clicks');
            const carts = sumField('atbs');
            const orders = sumField('orders');
            const productsMap = new Map();
            for (const row of productDays) {
                if (String(row.cabinetId) !== String(cab.id)) continue;
                if (!listedIds.has(String(row.campaignId))) continue;
                let agg = productsMap.get(row.nmId);
                if (!agg) {
                    const stored = artIdx.photos.get(String(cab.id) + ':' + row.nmId) || artIdx.photos.get(row.nmId) || '';
                    agg = {
                        nmId: row.nmId,
                        name: row.name || artIdx.titles.get(String(cab.id) + ':' + row.nmId) || artIdx.titles.get(row.nmId) || String(row.nmId),
                        photoUrl: campPhotoUrl(row.nmId, stored),
                        spend: 0, views: 0, clicks: 0, orders: 0, atbs: 0, revenue: 0, shks: 0,
                        campaignIds: new Set(),
                        live: false,
                    };
                    productsMap.set(row.nmId, agg);
                }
                if (row.name && agg.name === String(row.nmId)) agg.name = row.name;
                agg.spend += num(row.spend);
                agg.views += num(row.views);
                agg.clicks += num(row.clicks);
                agg.orders += num(row.orders);
                agg.atbs += num(row.atbs);
                agg.revenue += num(row.revenue);
                agg.shks += num(row.shks);
                agg.campaignIds.add(String(row.campaignId));
            }
            for (const camp of listed) {
                if (!camp.nmId) continue;
                let agg = productsMap.get(camp.nmId);
                if (!agg) {
                    agg = {
                        nmId: camp.nmId,
                        name: artIdx.titles.get(String(cab.id) + ':' + camp.nmId) || artIdx.titles.get(camp.nmId) || camp.name,
                        photoUrl: camp.photoUrl,
                        spend: 0, views: 0, clicks: 0, orders: 0, atbs: 0, revenue: 0, shks: 0,
                        campaignIds: new Set(),
                        live: false,
                    };
                    productsMap.set(camp.nmId, agg);
                }
                agg.campaignIds.add(String(camp.wbId));
                if (camp.live) agg.live = true;
            }
            const products = [...productsMap.values()].map((p) => {
                const ids = [...p.campaignIds];
                return {
                    nmId: p.nmId,
                    name: p.name,
                    photoUrl: p.photoUrl,
                    spend: p.spend,
                    views: p.views,
                    clicks: p.clicks,
                    orders: p.orders,
                    atbs: p.atbs,
                    revenue: p.revenue,
                    shks: p.shks,
                    campaigns: ids.length,
                    live: p.live || listed.some((c) => c.live && ids.includes(String(c.wbId))),
                };
            }).sort((a, b) => b.spend - a.spend);
            return {
                id: cab.id,
                name: cab.name,
                token,
                cap: cab.adv_daily_budget_cap,
                spendToday: spendT,
                spend7: s7,
                revenue7: r7,
                views,
                clicks,
                carts,
                orders,
                ctr: views > 0 && clicks > 0 ? clicks / views * 100 : null,
                roas: spendT > 0 && r7 > 0 ? r7 / spendT : null,
                drr7: formatDrr(spendT, r7),
                activeCampaigns: campaigns.filter((c) => c.live).length,
                inRange,
                outRange,
                maxHit,
                campaigns,
                products,
            };
        });

        rows.sort((a, b) => (b.outRange - a.outRange) || ((b.drr7 || 0) - (a.drr7 || 0)));

        const totals = rows.reduce((acc, r) => {
            acc.spendToday += r.spendToday;
            acc.spend7 += r.spend7;
            acc.revenue7 += r.revenue7;
            acc.views += r.views || 0;
            acc.clicks += r.clicks || 0;
            acc.carts += r.carts || 0;
            acc.orders += r.orders || 0;
            acc.active += r.activeCampaigns;
            acc.inRange += r.inRange;
            acc.outRange += r.outRange;
            acc.maxHit += r.maxHit;
            acc.saved7 += 0;
            return acc;
        }, { spendToday: 0, spend7: 0, revenue7: 0, views: 0, clicks: 0, carts: 0, orders: 0, active: 0, inRange: 0, outRange: 0, maxHit: 0, saved7: 0 });
        totals.drr7 = formatDrr(totals.spend7, totals.revenue7);
        totals.ctr = totals.views > 0 && totals.clicks > 0 ? totals.clicks / totals.views * 100 : null;
        totals.roas = totals.spendToday > 0 && totals.revenue7 > 0 ? totals.revenue7 / totals.spendToday : null;
        totals.cabinets = rows.length;
        totals.tokenBad = rows.filter((r) => r.token === 'bad').length;

        return { rows, totals, today, from7, from, to, yesterday };
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
        loadGen: 0,
        filterCabinetId: '',
        campFilter: 'all',
        colPreset: 'all',
        listView: 'campaigns',
        searchQuery: '',
        recent: {},
        didAutoSync: false,
        schedules: [],
    };

    const RECENT_KEY = 'nr-ads-hq-recent';

    function readRecent() {
        try {
            if (typeof localStorage === 'undefined') return {};
            const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || '{}');
            return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
        } catch (e) {
            return {};
        }
    }

    function persistRecent() {
        try {
            if (typeof localStorage === 'undefined') return;
            localStorage.setItem(RECENT_KEY, JSON.stringify(state.recent || {}));
        } catch (e) { /* ignore quota / private mode */ }
    }

    function touchRecent(cabinetId, wbId) {
        if (!cabinetId || wbId == null || wbId === '') return;
        const k = cabinetId + ':' + String(wbId);
        if (!state.recent) state.recent = {};
        state.recent[k] = Date.now();
        const keys = Object.keys(state.recent);
        if (keys.length > 40) {
            keys.sort((a, b) => (state.recent[a] || 0) - (state.recent[b] || 0));
            for (const old of keys.slice(0, keys.length - 40)) delete state.recent[old];
        }
        persistRecent();
    }

    function withRecent(camp, cabinetId) {
        const k = (cabinetId || camp.cabinetId || '') + ':' + String(camp.wbId);
        const at = (state.recent && state.recent[k]) || 0;
        if (!at) return camp;
        if (camp.recentAt === at) return camp;
        return Object.assign({}, camp, { recentAt: at });
    }

    function visibleCampaigns(cab) {
        const decorated = (cab.campaigns || []).map((c) => withRecent(c, cab.id));
        return filterCampaigns(decorated, state.campFilter, state.searchQuery);
    }

    function usedMark(camp) {
        if (!camp || !camp.usedYesterday) return '';
        return ' <span class="ads-hq-used">вчера</span>';
    }

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
        const s = normalizeCampaignStatus(status);
        const label = campaignStatusLabel(status);
        if (s === 9) return '<span class="ads-hq-wb-st live">' + esc(label) + '</span>';
        if (s === 11) return '<span class="ads-hq-wb-st pause">' + esc(label) + '</span>';
        if (s === 4) return '<span class="ads-hq-wb-st ready">' + esc(label) + '</span>';
        return '<span class="ads-hq-wb-st ready">' + esc(label) + '</span>';
    }

    function currentCols() {
        return (COL_PRESETS[state.colPreset] || COL_PRESETS.all).cols;
    }

    function tableColspan() {
        return 5 + currentCols().length;
    }

    function rangeLabel(range) {
        if (range === 'in') return '<span style="color:var(--green)">в диапазоне</span>';
        if (range === 'worse') return '<span style="color:var(--red)">хуже</span>';
        if (range === 'better') return '<span style="color:var(--amber)">выше цели</span>';
        return '<span style="color:var(--text-muted)">—</span>';
    }

    function selectedKeys() {
        const nodes = typeof document === 'undefined' || !document.querySelectorAll
            ? []
            : document.querySelectorAll('#ads-hq-tbody input.ads-hq-check:checked, #ads-hq-phone input.ads-hq-check:checked');
        return [...nodes].map((el) => ({
            kind: el.dataset.kind,
            cabinetId: el.dataset.cabinet,
            wbId: el.dataset.wb,
            uuid: el.dataset.uuid || '',
            cluster: el.dataset.cluster || '',
        }));
    }

    function parseScheduleAt(value, now) {
        const n = now instanceof Date ? now.getTime() : Date.now();
        if (value == null || String(value).trim() === '') return { error: 'empty' };
        const d = new Date(String(value));
        if (Number.isNaN(d.getTime())) return { error: 'invalid' };
        if (d.getTime() <= n) return { error: 'past' };
        return { at: d };
    }

    function defaultScheduleLocal(now) {
        const d = now instanceof Date ? new Date(now.getTime()) : new Date();
        d.setMinutes(0, 0, 0);
        d.setHours(d.getHours() + 1);
        return ymd(d) + 'T' + pad2(d.getHours()) + ':00';
    }

    function formatScheduleWhen(iso) {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '—';
        return d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    }

    function collectScheduleItems(items, model) {
        const camps = [];
        const seen = new Set();
        const rows = (model && model.rows) || [];
        for (const it of items || []) {
            if (it.kind === 'cabinet') {
                const cab = rows.find((r) => r.id === it.cabinetId);
                for (const c of listableCampaigns((cab && cab.campaigns) || [])) {
                    const k = it.cabinetId + ':' + c.wbId;
                    if (seen.has(k)) continue;
                    seen.add(k);
                    camps.push({ cabinetId: it.cabinetId, wbId: Number(c.wbId), name: c.name || '' });
                }
            } else if (it.wbId) {
                const k = it.cabinetId + ':' + it.wbId;
                if (seen.has(k)) continue;
                seen.add(k);
                const cab = rows.find((r) => r.id === it.cabinetId);
                const camp = cab && (cab.campaigns || []).find((c) => String(c.wbId) === String(it.wbId));
                camps.push({
                    cabinetId: it.cabinetId,
                    wbId: Number(it.wbId),
                    name: (camp && camp.name) || '',
                });
            }
        }
        return camps;
    }

    function pendingFor(cabinetId, wbId) {
        return (state.schedules || []).find((s) =>
            s.status === 'pending'
            && s.cabinet_id === cabinetId
            && Number(s.campaign_id) === Number(wbId)
        ) || null;
    }

    function scheduleMark(cabinetId, wbId) {
        const row = pendingFor(cabinetId, wbId);
        if (!row) return '';
        return ' <span class="ads-hq-when" title="Запуск по времени">' + esc(formatScheduleWhen(row.start_at)) + '</span>';
    }

    function setCabinet(cabinetId) {
        const id = cabinetId ? String(cabinetId) : '';
        const changed = id !== state.filterCabinetId;
        if (changed) {
            state.open = { cabinets: new Set(id ? [id] : []), campaigns: new Set() };
            state.selected = null;
            state.history = [];
            state.didAutoSync = false;
        }
        state.filterCabinetId = id;
        if (id) state.open.cabinets.add(id);
        if (changed) {
            if (cabinetRows().length && state.model) {
                renderKpis(state.model.totals);
                paintTree();
            } else {
                paintPending();
            }
        }
        return state.filterCabinetId;
    }

    function setCampFilter(mode) {
        state.campFilter = mode === 'all' ? 'all' : 'active';
        paintFilters();
        paintTree();
        return state.campFilter;
    }

    function setColPreset(id) {
        state.colPreset = COL_PRESETS[id] ? id : 'all';
        paintFilters();
        paintTree();
        return state.colPreset;
    }

    function setListView(view) {
        state.listView = view === 'products' ? 'products' : 'campaigns';
        paintFilters();
        paintTree();
        return state.listView;
    }

    function setSearch(query) {
        state.searchQuery = String(query || '');
        paintSearch();
        paintTree();
        return state.searchQuery;
    }

    function filterProducts(products, mode, query) {
        let list = products || [];
        if (mode !== 'all') list = list.filter((p) => p.live);
        const q = String(query || '').trim().toLowerCase();
        if (q) {
            list = list.filter((p) => String(p.nmId).includes(q) || String(p.name || '').toLowerCase().includes(q));
        }
        return list;
    }

    function visibleProducts(cab) {
        return filterProducts(cab.products, state.campFilter, state.searchQuery);
    }

    function cabinetRows() {
        if (!state.model) return [];
        let rows = state.model.rows;
        if (state.filterCabinetId) rows = rows.filter((r) => r.id === state.filterCabinetId);
        return rows;
    }

    function paintFilters() {
        if (typeof document === 'undefined' || !document.querySelectorAll) return;
        document.querySelectorAll('[data-camp-filter]').forEach((el) => {
            el.classList.toggle('on', el.dataset.campFilter === state.campFilter);
        });
        document.querySelectorAll('[data-list-view]').forEach((el) => {
            el.classList.toggle('on', el.dataset.listView === state.listView);
        });
        document.querySelectorAll('[data-col-preset]').forEach((el) => {
            el.classList.toggle('on', el.dataset.colPreset === state.colPreset);
        });
        const campsWrap = document.getElementById('ads-hq-camps-wrap');
        const productsWrap = document.getElementById('ads-hq-products-wrap');
        if (campsWrap && campsWrap.classList) campsWrap.classList.toggle('is-products', state.listView === 'products');
        if (productsWrap && productsWrap.classList) productsWrap.classList.toggle('hidden', state.listView !== 'products');
        paintSearch();
    }

    function paintSearch() {
        if (typeof document === 'undefined' || !document.getElementById) return;
        const wrap = document.getElementById('ads-hq-search-wrap');
        const input = document.getElementById('ads-hq-search');
        const q = state.searchQuery || '';
        if (input && typeof document.activeElement !== 'undefined' && document.activeElement !== input) {
            if (input.value !== q) input.value = q;
        } else if (input && !input.value && q) {
            input.value = q;
        }
        if (wrap && wrap.classList) {
            wrap.classList.toggle('has-query', !!String(q).trim());
        }
    }

    function paintPending() {
        if (typeof document === 'undefined' || !document.getElementById) return;
        const note = document.getElementById('ads-hq-freshness');
        if (note) note.textContent = 'обновляем…';
        renderKpis(null, true);
        const span = tableColspan();
        const tb = document.getElementById('ads-hq-tbody');
        if (tb) {
            tb.innerHTML = '<tr><td colspan="' + span + '" class="text-center py-10" style="color:var(--text-muted)">Загрузка кампаний…</td></tr>';
        }
        const pb = document.getElementById('ads-hq-products-tbody');
        if (pb) {
            pb.innerHTML = '<tr><td colspan="7" class="text-center py-10" style="color:var(--text-muted)">Загрузка товаров…</td></tr>';
        }
        const phone = document.getElementById('ads-hq-phone');
        if (phone) phone.innerHTML = '<div class="ads-hq-phone-empty text-center py-8">Загрузка кампаний…</div>';
    }

    function kpiRatio(src, kind) {
        if (!src) return '—';
        if (kind === 'drr') {
            const pct = src.drr7;
            return pct != null && Number.isFinite(pct) ? formatPct2(pct) : '—';
        }
        if (kind === 'roas') {
            const v = src.roas != null ? src.roas : (num(src.spendToday) > 0 && num(src.revenue7) > 0 ? src.revenue7 / src.spendToday : null);
            return v != null && Number.isFinite(v) ? formatFixed(v, 2) : '—';
        }
        if (kind === 'ctr') {
            const v = src.ctr != null ? src.ctr : (num(src.views) > 0 && num(src.clicks) > 0 ? src.clicks / src.views * 100 : null);
            return v != null && Number.isFinite(v) ? formatPct2(v) : '—';
        }
        return '—';
    }

    function renderKpis(totals, pending) {
        const el = document.getElementById('ads-hq-kpis');
        if (!el) return;
        const one = state.filterCabinetId ? (cabinetRows()[0] || null) : null;
        const useTotals = !state.filterCabinetId && totals;
        const src = pending ? null : (one || (useTotals ? totals : null));
        const revenue = pending ? '—' : formatInt(src && src.revenue7);
        const spend = pending ? '—' : formatMoney2(src && src.spendToday);
        const drr = pending ? '—' : kpiRatio(src, 'drr');
        const roas = pending ? '—' : kpiRatio(src, 'roas');
        const ctr = pending ? '—' : kpiRatio(src, 'ctr');
        const values = {
            'ads-hq-kpi-revenue': revenue,
            'ads-hq-kpi-spend': spend,
            'ads-hq-kpi-drr': drr,
            'ads-hq-kpi-roas': roas,
            'ads-hq-kpi-ctr': ctr,
        };
        const live = Object.keys(values).every((id) => document.getElementById(id));
        if (live) {
            Object.keys(values).forEach((id) => {
                const node = document.getElementById(id);
                const next = values[id];
                if (!node || node.textContent === next) return;
                if (window.NrWow) window.NrWow.tickText(node, next);
                else node.textContent = next;
            });
            return;
        }
        el.innerHTML =
            '<div class="ads-hq-kpi"><div class="ads-hq-kpi-label">Сумма заказов</div>' +
            '<div class="ads-hq-kpi-value" id="ads-hq-kpi-revenue">' + esc(revenue) + '</div></div>' +
            '<div class="ads-hq-kpi"><div class="ads-hq-kpi-label">Затраты</div>' +
            '<div class="ads-hq-kpi-value" id="ads-hq-kpi-spend">' + esc(spend) + '</div></div>' +
            '<div class="ads-hq-kpi"><div class="ads-hq-kpi-label">Доля затрат</div>' +
            '<div class="ads-hq-kpi-value" id="ads-hq-kpi-drr">' + esc(drr) + '</div></div>' +
            '<div class="ads-hq-kpi"><div class="ads-hq-kpi-label">ROAS</div>' +
            '<div class="ads-hq-kpi-value" id="ads-hq-kpi-roas">' + esc(roas) + '</div></div>' +
            '<div class="ads-hq-kpi"><div class="ads-hq-kpi-label">CTR</div>' +
            '<div class="ads-hq-kpi-value" id="ads-hq-kpi-ctr">' + esc(ctr) + '</div></div>';
    }

    function emptyShelvesHtml(pausedCount, totalCount) {
        const q = String(state.searchQuery || '').trim();
        const noun = state.listView === 'products' ? 'товаров' : 'кампаний';
        if (q) {
            return 'Нет ' + noun + ' по запросу «' + esc(q) + '».';
        }
        const syncBtn = '<button type="button" class="ui-btn ui-btn-primary" data-act="sync-wb">Подтянуть из WB</button>';
        if (!totalCount) {
            return 'В кабинете ещё нет кампаний. Нажмите «Подтянуть из WB».<div class="ads-hq-empty-actions">' + syncBtn + '</div>';
        }
        if (state.campFilter !== 'all' && pausedCount) {
            return 'Нет активных ' + noun + '. На паузе: ' + pausedCount + '. Откройте «Все» или подтяните свежие из WB.<div class="ads-hq-empty-actions">' +
                '<button type="button" class="ui-btn ui-btn-secondary" data-camp-filter="all">Показать все</button> ' + syncBtn + '</div>';
        }
        return 'Нет активных ' + noun + ' в этом кабинете.<div class="ads-hq-empty-actions">' + syncBtn + '</div>';
    }

    function toggleHtml(cab, camp) {
        const on = camp.live ? ' on' : '';
        const act = camp.live ? 'pause' : 'start';
        return '<button type="button" class="tg-switch ads-hq-toggle' + on + '" data-act="' + act +
            '" data-cabinet="' + esc(cab.id) + '" data-wb="' + esc(camp.wbId) +
            '" aria-pressed="' + (camp.live ? 'true' : 'false') +
            '" title="' + (camp.live ? 'Пауза' : 'Запуск') + '"><span></span></button>';
    }

    function typeCellHtml(camp) {
        const payment = paymentTypeLabel(camp.paymentType);
        const bid = bidTypeLabel(camp.bidType);
        if (payment) {
            return '<div class="ads-hq-type"><b>' + esc(payment) + '</b>' +
                (bid ? '<span>' + esc(bid) + '</span>' : '') + '</div>';
        }
        return esc(camp.typeLabel || campaignTypeLabel(camp.type));
    }

    function productCellHtml(camp) {
        const price = num(camp.price);
        const stock = num(camp.stock);
        if (!price && !stock) return '<span class="ads-hq-na">Н/Д</span>';
        return '<div class="ads-hq-product">' +
            (price ? '<div class="ads-hq-price">' + formatInt(price) + '</div>' : '') +
            '<div class="ads-hq-stock">' + formatInt(stock) + ' шт.</div></div>';
    }

    function campIdentityHtml(cab, camp) {
        return '<div class="ads-hq-camp-name">' +
            campThumbHtml(camp.photoUrl, camp.nmId) +
            '<div class="ads-hq-camp-meta">' +
            '<button type="button" class="ads-hq-wb-name" data-keys="' + esc(camp.wbId) + '" data-cabinet="' + esc(cab.id) + '">' +
            esc(camp.name) + '</button>' + usedMark(camp) + scheduleMark(cab.id, camp.wbId) +
            '<div class="ads-hq-wb-id">ID ' + esc(camp.wbId) + '</div>' +
            statusPill(camp.status) +
            '</div></div>';
    }

    function renderThead() {
        const el = document.getElementById('ads-hq-thead');
        if (!el) return;
        const cols = currentCols();
        el.innerHTML = '<tr>' +
            '<th class="ads-hq-pin ads-hq-pin-check"></th>' +
            '<th class="ads-hq-pin ads-hq-pin-tg"></th>' +
            '<th class="ads-hq-pin ads-hq-pin-camp">Кампания</th>' +
            '<th class="ads-hq-pin ads-hq-pin-sku">Товар</th>' +
            '<th class="ads-hq-pin ads-hq-pin-type">Тип кампании</th>' +
            cols.map((c) => '<th class="ads-hq-metric">' + esc(c.title) + '</th>').join('') +
            '</tr>';
    }

    function renderCampRow(cab, camp, pad) {
        const ck = cab.id + ':' + camp.wbId;
        const cols = currentCols();
        return '<tr class="ads-hq-camp ads-hq-camp-top ads-hq-wb-row" data-key="camp:' + esc(ck) + '" data-ck="' + esc(ck) + '">' +
            '<td class="ads-hq-pin ads-hq-pin-check"><input type="checkbox" class="ads-hq-check" data-kind="campaign" data-cabinet="' + esc(cab.id) + '" data-wb="' + esc(camp.wbId) + '" data-uuid="' + esc(camp.uuid || '') + '"></td>' +
            '<td class="ads-hq-pin ads-hq-pin-tg">' + toggleHtml(cab, camp) + '</td>' +
            '<td class="ads-hq-pin ads-hq-pin-camp"' + (pad ? ' style="padding-left:28px"' : '') + '>' + campIdentityHtml(cab, camp) + '</td>' +
            '<td class="ads-hq-pin ads-hq-pin-sku">' + productCellHtml(camp) + '</td>' +
            '<td class="ads-hq-pin ads-hq-pin-type">' + typeCellHtml(camp) + '</td>' +
            cols.map((col) => '<td class="ads-hq-metric">' + formatMetric(camp, col.key) + '</td>').join('') +
            '</tr>';
    }

    function renderTable() {
        renderThead();
        const tb = document.getElementById('ads-hq-tbody');
        if (!tb || !state.model) return;
        const span = tableColspan();
        const rows = cabinetRows();
        if (!rows.length) {
            tb.innerHTML = '<tr><td colspan="' + span + '" class="text-center py-10 ads-hq-empty-cell">' +
                emptyShelvesHtml(0, 0) + '</td></tr>';
            return;
        }
        const hideCab = !!state.filterCabinetId;
        const html = [];
        let shown = 0;
        let paused = 0;
        let total = 0;
        for (const cab of rows) {
            const visible = visibleCampaigns(cab);
            const listable = listableCampaigns(cab.campaigns);
            paused += listable.filter((c) => !c.live).length;
            total += listable.length;
            shown += visible.length;
            if (!hideCab) {
                html.push(
                    '<tr class="ads-hq-cab" data-key="cab:' + esc(cab.id) + '" data-cab="' + esc(cab.id) + '">' +
                    '<td><input type="checkbox" class="ads-hq-check" data-kind="cabinet" data-cabinet="' + esc(cab.id) + '"></td>' +
                    '<td colspan="' + (span - 1) + '">' + tokenHtml(cab.token) + ' ' + esc(cabName(cab.name)) +
                    ' · ' + cab.activeCampaigns + ' акт. · ' + formatMoney2(cab.spendToday) + '</td></tr>'
                );
            }
            for (const camp of visible) html.push(renderCampRow(cab, camp, !hideCab));
        }
        if (!shown) {
            tb.innerHTML = '<tr><td colspan="' + span + '" class="text-center py-10 ads-hq-empty-cell">' +
                emptyShelvesHtml(paused, total) + '</td></tr>';
            return;
        }
        if (typeof window !== 'undefined' && window.domMorph && tb.querySelector && tb.querySelector('tr[data-key]')) {
            window.domMorph.morphList(tb, html.join(''), 'data-key');
        } else {
            tb.innerHTML = html.join('');
        }
    }

    function renderProductRow(p) {
        const fake = {
            spendToday: p.spend, views: p.views, clicks: p.clicks, orders: p.orders,
            atbs: p.atbs, revenue7: p.revenue,
        };
        return '<tr class="ads-hq-wb-row" data-key="nm:' + esc(p.nmId) + '">' +
            '<td><div class="ads-hq-camp-name">' + campThumbHtml(p.photoUrl, p.nmId) +
            '<div class="ads-hq-camp-meta"><div class="ads-hq-wb-name">' + esc(p.name) + '</div>' +
            '<div class="ads-hq-wb-id">' + esc(p.nmId) + '</div></div></div></td>' +
            '<td>' + formatInt(p.campaigns) + '</td>' +
            '<td>' + formatMetric(fake, 'spend') + '</td>' +
            '<td>' + formatMetric(fake, 'views') + '</td>' +
            '<td>' + formatMetric(fake, 'ctr') + '</td>' +
            '<td>' + formatMetric(fake, 'orders') + '</td>' +
            '<td>' + formatMetric(fake, 'cpc') + '</td></tr>';
    }

    function renderProducts() {
        const tb = document.getElementById('ads-hq-products-tbody');
        if (!tb || !state.model) return;
        const rows = cabinetRows();
        if (!rows.length) {
            tb.innerHTML = '<tr><td colspan="7" class="text-center py-10 ads-hq-empty-cell">' + emptyShelvesHtml(0, 0) + '</td></tr>';
            return;
        }
        const html = [];
        let shown = 0;
        let paused = 0;
        let total = 0;
        for (const cab of rows) {
            const visible = visibleProducts(cab);
            const all = cab.products || [];
            paused += all.filter((p) => !p.live).length;
            total += all.length;
            shown += visible.length;
            for (const p of visible) html.push(renderProductRow(p));
        }
        if (!shown) {
            tb.innerHTML = '<tr><td colspan="7" class="text-center py-10 ads-hq-empty-cell">' + emptyShelvesHtml(paused, total) + '</td></tr>';
            return;
        }
        tb.innerHTML = html.join('');
    }

    function renderPhoneCamp(cab, camp) {
        const ck = cab.id + ':' + camp.wbId;
        const cols = currentCols().filter((c) => c.key !== 'budget' && c.key !== 'limit');
        const html = [];
        html.push('<article class="ads-hq-phone-card ads-hq-phone-shelf" data-key="' + esc(ck) + '">');
        html.push(
            '<div class="ads-hq-phone-pick">' +
            '<input type="checkbox" class="ads-hq-check" data-kind="campaign" data-cabinet="' + esc(cab.id) +
            '" data-wb="' + esc(camp.wbId) + '" data-uuid="' + esc(camp.uuid || '') + '">' +
            toggleHtml(cab, camp) +
            campThumbHtml(camp.photoUrl, camp.nmId) +
            '<div class="ads-hq-camp-meta">' +
            '<button type="button" class="ads-hq-wb-name" data-keys="' + esc(camp.wbId) + '" data-cabinet="' + esc(cab.id) + '">' +
            esc(camp.name) + '</button>' + usedMark(camp) +
            '<div class="ads-hq-wb-id">ID ' + esc(camp.wbId) + '</div>' +
            statusPill(camp.status) + scheduleMark(cab.id, camp.wbId) +
            '</div></div>'
        );
        html.push('<div class="ads-hq-phone-type">' + typeCellHtml(camp) + ' · ' + productCellHtml(camp) + '</div>');
        html.push(
            '<div class="ads-hq-phone-metrics">' +
            cols.map((col) => '<span>' + esc(col.title) + '<b>' + formatMetric(camp, col.key) + '</b></span>').join('') +
            '</div>'
        );
        html.push(
            '<button type="button" class="adv-camp-action-btn" data-keys="' + esc(camp.wbId) +
            '" data-cabinet="' + esc(cab.id) + '">Ключи</button>'
        );
        html.push('</article>');
        return html.join('');
    }

    function renderPhoneProduct(p) {
        const fake = {
            spendToday: p.spend, views: p.views, clicks: p.clicks, orders: p.orders,
            atbs: p.atbs, revenue7: p.revenue,
        };
        return '<article class="ads-hq-phone-card ads-hq-phone-shelf" data-key="nm:' + esc(p.nmId) + '">' +
            '<div class="ads-hq-phone-pick">' + campThumbHtml(p.photoUrl, p.nmId) +
            '<div class="ads-hq-camp-meta"><div class="ads-hq-wb-name">' + esc(p.name) + '</div>' +
            '<div class="ads-hq-wb-id">' + esc(p.nmId) + '</div></div></div>' +
            '<div class="ads-hq-phone-metrics">' +
            '<span>Затраты<b>' + formatMetric(fake, 'spend') + '</b></span>' +
            '<span>Показы<b>' + formatMetric(fake, 'views') + '</b></span>' +
            '<span>Заказы<b>' + formatMetric(fake, 'orders') + '</b></span>' +
            '</div></article>';
    }

    function renderPhone() {
        const el = document.getElementById('ads-hq-phone');
        if (!el || !state.model) return;
        const rows = cabinetRows();
        if (!rows.length) {
            el.innerHTML = '<div class="ads-hq-phone-empty text-center py-8">' + emptyShelvesHtml(0, 0) + '</div>';
            return;
        }
        const html = [];
        let shown = 0;
        let paused = 0;
        let total = 0;
        const productsMode = state.listView === 'products';
        for (const cab of rows) {
            if (!state.filterCabinetId) {
                html.push('<div class="ads-hq-phone-cab-name" data-key="cab:' + esc(cab.id) + '">' + tokenHtml(cab.token) + ' ' + esc(cabName(cab.name)) + '</div>');
            }
            if (productsMode) {
                const visible = visibleProducts(cab);
                const all = cab.products || [];
                paused += all.filter((p) => !p.live).length;
                total += all.length;
                shown += visible.length;
                for (const p of visible) html.push(renderPhoneProduct(p));
            } else {
                const visible = visibleCampaigns(cab);
                const listable = listableCampaigns(cab.campaigns);
                paused += listable.filter((c) => !c.live).length;
                total += listable.length;
                shown += visible.length;
                for (const camp of visible) html.push(renderPhoneCamp(cab, camp));
            }
        }
        if (!shown) {
            el.innerHTML = '<div class="ads-hq-phone-empty text-center py-8">' + emptyShelvesHtml(paused, total) + '</div>';
            return;
        }
        if (typeof window !== 'undefined' && window.domMorph && el.querySelector && el.querySelector('[data-key]')) {
            window.domMorph.morphList(el, html.join(''), 'data-key');
        } else {
            el.innerHTML = html.join('');
        }
    }

    function paintTree() {
        renderTable();
        renderProducts();
        renderPhone();
        paintSchedule();
    }

    function paintSchedule() {
        const el = document.getElementById('ads-hq-schedule');
        if (!el) return;
        const cab = state.filterCabinetId;
        const rows = (state.schedules || []).filter((s) =>
            s.status === 'pending' && (!cab || s.cabinet_id === cab)
        );
        if (!rows.length) {
            el.innerHTML = '';
            return;
        }
        el.innerHTML = '<div class="ads-hq-schedule-title">Запуск по времени</div>' + rows.map((s) =>
            '<div class="ads-hq-schedule-row">' +
            '<span>' + esc(s.campaign_name || ('РК ' + s.campaign_id)) +
            ' · ' + esc(formatScheduleWhen(s.start_at)) + '</span>' +
            '<button type="button" class="ui-btn ui-btn-secondary" data-cancel-schedule="' + esc(s.id) + '">Отмена</button>' +
            '</div>'
        ).join('');
    }

    async function upsertPending(sb, row) {
        const found = await sb.from('adv_start_schedule')
            .select('id')
            .eq('cabinet_id', row.cabinet_id)
            .eq('campaign_id', row.campaign_id)
            .eq('status', 'pending')
            .maybeSingle();
        const existing = found && found.data;
        if (existing && existing.id) {
            const upd = await sb.from('adv_start_schedule')
                .update({ start_at: row.start_at, campaign_name: row.campaign_name })
                .eq('id', existing.id)
                .eq('status', 'pending');
            return upd && upd.error;
        }
        const ins = await sb.from('adv_start_schedule').insert(row);
        return ins && ins.error;
    }

    async function scheduleStart(picked, now) {
        const modal = dep().showPremiumModal;
        const parsed = parseScheduleAt(
            typeof document !== 'undefined' ? document.getElementById('ads-hq-start-at')?.value : '',
            now
        );
        if (parsed.error === 'empty' || parsed.error === 'invalid') {
            if (modal) modal('error', 'Нет времени', 'Выберите дату и время запуска.');
            return { ok: false, reason: parsed.error };
        }
        if (parsed.error === 'past') {
            if (modal) modal('error', 'Время уже прошло', 'Поставьте время в будущем — сейчас кампании не запускаем.');
            return { ok: false, reason: 'past' };
        }
        const items = collectScheduleItems(picked || selectedKeys(), state.model);
        if (!items.length) {
            if (modal) modal('error', 'Ничего не выбрано', 'Отметьте полки, которые нужно включить в это время.');
            return { ok: false, reason: 'empty' };
        }
        const sb = dep().supabase;
        if (!sb || !sb.from) {
            if (modal) modal('error', 'Нет доступа', 'Не удалось сохранить расписание.');
            return { ok: false, reason: 'no_sb' };
        }
        const iso = parsed.at.toISOString();
        let saved = 0;
        let fail = 0;
        for (const c of items) {
            const error = await upsertPending(sb, {
                cabinet_id: c.cabinetId,
                campaign_id: c.wbId,
                campaign_name: c.name || null,
                start_at: iso,
                status: 'pending',
            });
            if (error) fail += 1;
            else {
                saved += 1;
                touchRecent(c.cabinetId, c.wbId);
            }
        }
        if (modal) {
            modal(fail && !saved ? 'error' : 'success',
                'На время',
                saved
                    ? ('Поставили ' + saved + ' полок на ' + formatScheduleWhen(iso) + '. Сейчас не запускаем — система включит их в это время.')
                    : (fail ? String(fail) + ' не сохранились' : 'Ничего не поставили'));
        }
        await refreshSchedules();
        paintTree();
        return { ok: saved > 0, saved, fail };
    }

    async function cancelSchedule(id) {
        const sb = dep().supabase;
        if (!sb || !id) return { ok: false };
        const { error } = await sb.from('adv_start_schedule')
            .update({ status: 'cancelled' })
            .eq('id', id)
            .eq('status', 'pending');
        if (error && dep().showPremiumModal) {
            dep().showPremiumModal('error', 'Не отменилось', error.message);
            return { ok: false };
        }
        await refreshSchedules();
        paintTree();
        return { ok: true };
    }

    async function refreshSchedules() {
        const ids = cabinetRows().map((r) => r.id);
        if (!ids.length && state.filterCabinetId) ids.push(state.filterCabinetId);
        const rows = ids.length
            ? await safeRows('adv_start_schedule', [
                { op: 'in', column: 'cabinet_id', value: ids },
                { op: 'eq', column: 'status', value: 'pending' },
            ])
            : [];
        state.schedules = rows || [];
        return state.schedules;
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
            if (!state.selected) hint.textContent = 'Откройте полку, нажмите кластер — правило сохранится на него.';
            else if (!state.selected.campaignUuid) hint.textContent = 'Эту полку ещё не подтянули. Сначала «Подтянуть из WB».';
            else hint.textContent = (state.selected.clusterKey ? ('Кластер «' + state.selected.clusterKey + '» · ') : '') + 'полка #' + state.selected.wbId;
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
        const labels = rows.slice().reverse().map((h) => String(h.created_at || '').slice(11, 16) || String(h.created_at || '').slice(5, 10));
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
        for (const c of camps) touchRecent(c.cabinetId, c.wbId);
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
            const chip = e.target.closest('[data-camp-filter]');
            if (chip) {
                setCampFilter(chip.dataset.campFilter);
                return;
            }
            const listView = e.target.closest('[data-list-view]');
            if (listView) {
                setListView(listView.dataset.listView);
                return;
            }
            const colPreset = e.target.closest('[data-col-preset]');
            if (colPreset) {
                setColPreset(colPreset.dataset.colPreset);
                return;
            }
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
            // Ключи полки открываются в модалке кластеров (ставка CPM + позиции).
            const keys = e.target.closest('[data-keys]');
            if (keys) {
                touchRecent(keys.dataset.cabinet, keys.dataset.keys);
                const open = typeof window !== 'undefined' && window.openClusterModal;
                if (open) open(Number(keys.dataset.keys), keys.dataset.cabinet || '');
                return;
            }
            const cancel = e.target.closest('[data-cancel-schedule]');
            if (cancel) {
                cancelSchedule(cancel.dataset.cancelSchedule);
                return;
            }
            const pick = e.target.closest('[data-pick="cluster"]');
            if (pick) {
                pickRow(pick.dataset.cabinet, pick.dataset.camp, pick.dataset.cluster, pick.dataset.wb);
                return;
            }
            const act = e.target.closest('[data-act]');
            if (act) {
                if (act.dataset.act === 'sync-wb') {
                    reloadFromWb();
                    return;
                }
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
        document.getElementById('ads-hq-schedule-start')?.addEventListener('click', () => scheduleStart());
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
        document.getElementById('ads-hq-reload')?.addEventListener('click', () => reloadFromWb());
        const searchBtn = document.getElementById('ads-hq-search-btn');
        const search = document.getElementById('ads-hq-search');
        searchBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            const wrap = document.getElementById('ads-hq-search-wrap');
            if (!wrap || !wrap.classList) return;
            wrap.classList.toggle('is-open');
            if (wrap.classList.contains('is-open') && search && search.focus) search.focus();
        });
        search?.addEventListener('input', () => setSearch(search.value || ''));
        search?.addEventListener('blur', () => {
            const wrap = document.getElementById('ads-hq-search-wrap');
            if (wrap && wrap.classList && !(search.value || '').trim()) wrap.classList.remove('is-open');
        });
        document.getElementById('ads-hq-when-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const pop = document.getElementById('ads-hq-when-pop');
            if (pop && pop.classList) pop.classList.toggle('is-open');
        });
        document.getElementById('ads-hq-cols-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const pop = document.getElementById('ads-hq-cols-pop');
            if (pop && pop.classList) pop.classList.toggle('is-open');
        });
        document.addEventListener('click', (e) => {
            for (const id of ['ads-hq-when-pop', 'ads-hq-cols-pop']) {
                const pop = document.getElementById(id);
                if (!pop || !pop.classList || !pop.classList.contains('is-open')) continue;
                if (typeof pop.contains === 'function' && pop.contains(e.target)) continue;
                pop.classList.remove('is-open');
            }
        });
        const atEl = document.getElementById('ads-hq-start-at');
        if (atEl && !atEl.value) atEl.value = defaultScheduleLocal();
    }

    async function safeRows(table, filters, columns) {
        const fetchAll = dep().fetchAllRows;
        if (!fetchAll) return [];
        let timer = 0;
        try {
            const work = Promise.resolve(fetchAll(table, filters, columns) || []);
            const rows = await Promise.race([
                work,
                new Promise((resolve) => { timer = setTimeout(() => resolve(null), 5000); }),
            ]);
            if (rows == null) {
                console.warn('[ads-hq] timeout', table);
                return [];
            }
            return rows || [];
        } catch (e) {
            console.warn('[ads-hq]', table, e);
            return [];
        } finally {
            if (timer) clearTimeout(timer);
        }
    }

    function activeHqRange() {
        const now = new Date();
        let from = ymd(addDays(now, -6));
        let to = ymd(now);
        try {
            const r = dep().getDateRange && dep().getDateRange();
            if (r && r.from && r.to) {
                from = String(r.from).slice(0, 10);
                to = String(r.to).slice(0, 10);
            }
        } catch (e) { /* keep fallback */ }
        if (from > to) {
            const swap = from;
            from = to;
            to = swap;
        }
        return { from, to };
    }

    async function fetchAndRender() {
        const cab = state.filterCabinetId;
        const note = document.getElementById('ads-hq-freshness');
        if (note && !note.textContent) note.textContent = 'обновляем…';
        const range = activeHqRange();
        const from = range.from;
        const to = range.to;
        const now = new Date();
        const rank = extendRangeForRanking(range, now);
        const cabs = await safeRows('cabinets', cab ? [{ op: 'eq', column: 'id', value: cab }] : [], 'id, name, adv_token_valid, adv_token_secret_id, adv_daily_budget_cap');
        if (cab !== state.filterCabinetId) return null;
        const cabinets = (cabs || []).filter((c) => {
            if (cab && c.id !== cab) return false;
            try {
                if (typeof window !== 'undefined' && typeof window.isHiddenCabinet === 'function' && window.isHiddenCabinet(c)) return false;
            } catch (_) {}
            return true;
        });
        const ids = cabinets.map((c) => c.id);
        const [legacyCampaigns, legacyStats, v2Campaigns, articles, stocks] = ids.length ? await Promise.all([
            safeRows('advertising_campaigns', [{ op: 'in', column: 'cabinet_id', value: ids }]),
            safeRows('advertising_daily_stats', [
                { op: 'in', column: 'cabinet_id', value: ids },
                { op: 'gte', column: 'stat_date', value: rank.from },
                { op: 'lte', column: 'stat_date', value: rank.to },
            ]),
            safeRows('adv_campaigns', [{ op: 'in', column: 'cabinet_id', value: ids }]),
            safeRows('rnp_articles', [
                { op: 'in', column: 'cabinet_id', value: ids },
            ], 'cabinet_id,nm_id,photo_url,name,manual_data'),
            safeRows('wb_stocks', [
                { op: 'in', column: 'cabinet_id', value: ids },
            ], 'cabinet_id,nm_id,quantity,quantity_full'),
        ]) : [[], [], [], [], []];
        if (cab !== state.filterCabinetId) return null;
        const v2Ids = (v2Campaigns || []).map((c) => c.id);
        const [clusters, rules, snapshots, v2Stats] = v2Ids.length ? await Promise.all([
            safeRows('adv_clusters', [{ op: 'in', column: 'campaign_id', value: v2Ids }]),
            safeRows('autobidder_rules', [{ op: 'in', column: 'campaign_id', value: v2Ids }]),
            safeRows('serp_position_snapshots', [{ op: 'in', column: 'campaign_id', value: v2Ids }]),
            safeRows('adv_daily_stats', [
                { op: 'in', column: 'campaign_id', value: v2Ids },
                { op: 'gte', column: 'date', value: rank.from },
                { op: 'lte', column: 'date', value: rank.to },
            ]),
        ]) : [[], [], [], []];
        if (cab !== state.filterCabinetId) return null;
        const schedules = ids.length ? await safeRows('adv_start_schedule', [
            { op: 'in', column: 'cabinet_id', value: ids },
            { op: 'eq', column: 'status', value: 'pending' },
        ]) : [];
        if (cab !== state.filterCabinetId) return null;
        state.schedules = schedules || [];
        state.model = buildHqModel({
            from, to, yesterday: rank.yesterday, now, today: to, from7: from,
            cabinets, legacyCampaigns, legacyStats, v2Campaigns, clusters, rules, snapshots, v2Stats,
            articles, stocks,
        });
        if (state.filterCabinetId) state.open.cabinets.add(state.filterCabinetId);
        renderKpis(state.model.totals);
        paintFilters();
        paintTree();
        paintForm();
        const advanced = typeof document !== 'undefined' && document.querySelector
            ? document.querySelector('.ads-hq-advanced')
            : null;
        if (!advanced || advanced.open) renderJournal();
        if (note) note.textContent = '';
        return state.model;
    }

    async function load() {
        const gen = ++state.loadGen;
        if (!cabinetRows().length) paintPending();
        state.loading = true;
        try {
            await fetchAndRender();
        } finally {
            if (gen === state.loadGen) state.loading = false;
        }
    }

    async function reloadFromWb() {
        const gen = ++state.loadGen;
        state.loading = true;
        const note = document.getElementById('ads-hq-freshness');
        if (note) note.textContent = 'подтягиваем из WB…';
        try {
            let syncErr = null;
            if (dep().syncFromWb) {
                try {
                    await dep().syncFromWb();
                    state.didAutoSync = true;
                } catch (e) {
                    syncErr = e;
                    if (dep().showPremiumModal) dep().showPremiumModal('error', 'Не удалось подтянуть полки', e && e.message ? e.message : String(e));
                }
            }
            if (gen !== state.loadGen) return;
            await fetchAndRender();
            if (syncErr && note && gen === state.loadGen) note.textContent = 'синк не вышел: ' + (syncErr.message || syncErr);
        } finally {
            if (gen === state.loadGen) state.loading = false;
        }
    }

    function init(deps) {
        state.deps = deps || {};
        state.recent = readRecent();
        bindOnce();
        paintForm();
        paintSearch();
    }

    function open(opts) {
        const id = opts && opts.cabinetId ? String(opts.cabinetId) : '';
        setCabinet(id);
        bindOnce();
        if (state.loading && state.filterCabinetId === id) return;
        load();
    }

    const AdsHQ = {
        buildHqModel,
        campaignTypeLabel,
        campaignStatusLabel,
        campaignEnded,
        filterCampaigns,
        compareCampaigns,
        extendRangeForRanking,
        formatMoney,
        formatMoney2,
        formatInt,
        formatPct2,
        formatMetric,
        COL_PRESETS,
        formatDrr,
        formatDrrLabel,
        tokenState,
        ruleRangeStatus,
        defaultRuleForm,
        init,
        open,
        setCabinet,
        setCampFilter,
        setColPreset,
        setListView,
        setSearch,
        getFilterCabinetId: () => state.filterCabinetId,
        getCampFilter: () => state.campFilter,
        getColPreset: () => state.colPreset,
        getListView: () => state.listView,
        getSearch: () => state.searchQuery,
        load,
        reload: reloadFromWb,
        renderTable,
        renderPhone,
        paintForm,
        parseScheduleAt,
        defaultScheduleLocal,
        formatScheduleWhen,
        collectScheduleItems,
        scheduleStart,
        cancelSchedule,
        resolveHqRange,
        ymd,
        addDays,
        nmIdFromName,
        nmIdsFromDayData,
        campPhotoUrl,
        campThumbHtml,
    };

    root.AdsHQ = AdsHQ;
    if (typeof module !== 'undefined' && module.exports) module.exports = AdsHQ;
})(typeof window !== 'undefined' ? window : globalThis);

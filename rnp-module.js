/**
 * NR Space — Модуль РНП («Рука на пульсе»)
 * Ежедневный мониторинг бизнеса по артикулам WB
 */
const RNP = (() => {
    'use strict';

    // ─── STATE ────────────────────────────────────────────────────────────────
    let _db = null;
    let _cab = null;
    let _callProxy = null; // async (action, params) => data
    let _settings = { exchangeRate: 13.5, calcPeriod: 7 };
    let _articles = [];
    let _activeNm = null;
    let _collapsed = new Set();

    // ─── SECTIONS & METRICS ──────────────────────────────────────────────────
    const SECTIONS = [
        { id: 'stocks', label: 'Остатки', color: '#6366f1', rows: [
            { key: 'stock_warehouse',    label: 'На складах',       type: 'int', src: 'auto' },
            { key: 'stock_transit',      label: 'В пути',           type: 'int', src: 'auto' },
            { key: 'stock_total',        label: 'Общий',            type: 'int', src: 'auto' },
            { key: 'in_production',      label: 'В пошиве',         type: 'int', src: 'manual' },
        ]},
        { id: 'sales', label: 'Продажи', color: '#10b981', rows: [
            { key: 'orders_count',       label: 'ЗАКАЗЫ',                   type: 'int', src: 'auto',   bold: true },
            { key: 'plan_orders',        label: 'План заказов',             type: 'int', src: 'manual', isPlan: true },
            { key: 'spp_pct',            label: 'СПП %',                    type: 'pct', src: 'auto' },
            { key: 'sales_count',        label: 'Продажи',                  type: 'int', src: 'auto',   bold: true },
            { key: 'plan_sales',         label: 'План продаж',              type: 'int', src: 'manual', isPlan: true },
            { key: 'avg_check',          label: 'СР. Чек',                  type: 'som', src: 'auto' },
            { key: 'giveaways',          label: 'Раздачи',                  type: 'int', src: 'manual' },
            { key: 'plan_orders_pct',    label: 'Выпол. план ЗАКАЗЫ %',     type: 'pct', src: 'calc',   cl: 'plan' },
            { key: 'plan_sales_pct',     label: 'Выпол. план ПРОДАЖИ %',    type: 'pct', src: 'calc',   cl: 'plan' },
            { key: 'orders_sum',         label: 'Сумма Заказов',            type: 'som', src: 'auto' },
            { key: 'sales_sum',          label: 'Сумма Продаж',             type: 'som', src: 'auto' },
        ]},
        { id: 'funnel', label: 'Воронка (общая)', color: '#f59e0b', rows: [
            { key: 'impressions',        label: 'Показы',                   type: 'int',  src: 'promo' },
            { key: 'organic_imp_pct',    label: '% органики показов',       type: 'pct',  src: 'calc' },
            { key: 'plan_impressions',   label: 'План показов',             type: 'int',  src: 'manual', isPlan: true },
            { key: 'clicks',             label: 'Клики',                    type: 'int',  src: 'promo' },
            { key: 'ctr_pct',            label: 'CTR%',                     type: 'pct2', src: 'promo' },
            { key: 'basket_pct',         label: 'Корзина%',                 type: 'pct2', src: 'promo' },
            { key: 'competitor_basket',  label: '% Корзины конкурентов',    type: 'pct2', src: 'manual' },
            { key: 'basket_count',       label: 'Корзина',                  type: 'int',  src: 'promo' },
            { key: 'orders_conv_pct',    label: 'Заказы%',                  type: 'pct2', src: 'calc' },
            { key: 'competitor_orders',  label: '% Заказов конкурентов',    type: 'pct2', src: 'manual' },
            { key: 'cro_pct',            label: 'CRO%',                     type: 'pct2', src: 'calc' },
            { key: 'competitor_cro',     label: '% CRO конкурентов',        type: 'pct2', src: 'manual' },
        ]},
        { id: 'ads', label: 'Воронка (реклама)', color: '#8b5cf6', rows: [
            { key: 'ad_impressions',     label: 'Показы с РК',              type: 'int',  src: 'promo' },
            { key: 'ad_imp_pct',         label: '% показов с рекламы',      type: 'pct',  src: 'calc' },
            { key: 'ad_clicks',          label: 'Клики РК',                 type: 'int',  src: 'promo' },
            { key: 'plan_clicks',        label: 'План кликов РК',           type: 'int',  src: 'manual', isPlan: true },
            { key: 'ad_ctr',             label: 'CTR% РК',                  type: 'pct2', src: 'promo' },
            { key: 'competitor_ctr',     label: '% CTR конкурентов',        type: 'pct2', src: 'manual' },
            { key: 'ad_cro',             label: 'CRO РК%',                  type: 'pct2', src: 'promo' },
            { key: 'ad_cpc',             label: 'Стоимость клика',          type: 'som',  src: 'promo' },
            { key: 'ad_basket',          label: 'Корзин с РК',              type: 'int',  src: 'promo' },
            { key: 'ad_orders',          label: 'Заказов с РК',             type: 'int',  src: 'promo' },
        ]},
        { id: 'adspend', label: 'Расходы РК', color: '#ef4444', rows: [
            { key: 'ad_spend',           label: 'Расход РК',                type: 'som',  src: 'promo' },
            { key: 'plan_drr',           label: 'ДРР% план',                type: 'pct',  src: 'manual', isPlan: true },
            { key: 'drr_pct',            label: 'ДРР%',                     type: 'pct',  src: 'calc',  hm: 'low' },
        ]},
        { id: 'finance', label: 'Финансы', color: '#06b6d4', rows: [
            { key: 'sales_count',        label: 'Продаж, шт',               type: 'int',  src: 'auto' },
            { key: 'sales_sum',          label: 'Сумма продаж',             type: 'som',  src: 'auto' },
            { key: 'avg_check_sales',    label: 'Средний чек',              type: 'som',  src: 'auto' },
            { key: 'return_pct',         label: '% возврата',               type: 'pct',  src: 'auto',  hm: 'low' },
            { key: 'buyout_pct',         label: '% выкупа',                 type: 'pct',  src: 'auto',  hm: 'high' },
            { key: 'logistics_per_unit', label: 'Логистика на ед',          type: 'som',  src: 'auto',  hm: 'low' },
            { key: 'logistics_pct',      label: 'Логистика%',               type: 'pct',  src: 'auto',  hm: 'low' },
            { key: 'storage_pct',        label: 'Хранение%',                type: 'pct',  src: 'auto',  hm: 'low' },
            { key: 'wb_share_pct',       label: 'Вся доля ВБ с ДРР%',       type: 'pct',  src: 'calc',  hm: 'low' },
        ]},
        { id: 'result', label: 'Финансовый итог', color: '#84cc16', rows: [
            { key: 'to_transfer',        label: 'К перечислению',           type: 'som',  src: 'auto' },
            { key: 'to_transfer_unit',   label: 'К перечислению на ед',     type: 'som',  src: 'auto' },
            { key: 'cost_price_val',     label: 'Себестоимость',            type: 'som',  src: 'settings' },
            { key: 'profit',             label: 'Прибыль',                  type: 'som',  src: 'calc',  bold: true, hm: 'profit' },
            { key: 'profit_per_unit',    label: 'Прибыль на 1 ед',          type: 'som',  src: 'calc',  bold: true },
            { key: 'margin_pct',         label: 'Маржинальность%',          type: 'pct',  src: 'calc',  bold: true, hm: 'margin' },
            { key: 'roi_pct',            label: 'Рентабельность%',          type: 'pct',  src: 'calc',  bold: true },
        ]},
    ];

    // ─── PHOTO URL ────────────────────────────────────────────────────────────
    function _photoUrl(nmId) {
        const vol  = Math.floor(nmId / 100000);
        const part = Math.floor(nmId / 1000);
        // Extended basket map — each entry [volFrom, volTo, basketNum]
        const map = [
            [0,143,1],[144,287,2],[288,431,3],[432,719,4],
            [720,1007,5],[1008,1061,6],[1062,1115,7],[1116,1169,8],
            [1170,1313,9],[1314,1601,10],[1602,1655,11],[1656,1919,12],
            [1920,2045,13],[2046,2189,14],[2190,2405,15],
            [2406,2621,16],[2622,2837,17],[2838,3053,18],
            [3054,3269,19],[3270,3485,20],[3486,3701,21],
            [3702,3917,22],[3918,4133,23],[4134,4349,24],
            [4350,4565,25],[4566,4781,26],[4782,4997,27],
            [4998,5213,28],[5214,5429,29],[5430,5645,30],
            [5646,5861,31],[5862,6077,32],[6078,6293,33],
            [6294,6509,34],[6510,6725,35],[6726,6941,36],
            [6942,7157,37],[7158,7373,38],[7374,7589,39],
            [7590,7805,40],[7806,8021,41],[8022,8237,42],
            [8238,8453,43],[8454,8669,44],[8670,8885,45],
        ];
        const found = map.find(([lo, hi]) => vol >= lo && vol <= hi);
        const num = found ? found[2] : 46 + Math.floor((vol - 8886) / 216);
        const b = String(Math.max(1, num)).padStart(2, '0');
        return `https://basket-${b}.wbbasket.ru/vol${vol}/part${part}/${nmId}/images/big/1.webp`;
    }

    // ─── SETTINGS ─────────────────────────────────────────────────────────────
    async function _loadSettings() {
        try {
            const { data } = await _db.from('rnp_settings').select('*').eq('cabinet_id', _cab).maybeSingle();
            if (data) _settings = { ..._settings, exchangeRate: data.exchange_rate || 13.5, calcPeriod: data.calc_period || 7, promotionToken: data.promotion_api_token || '' };
        } catch(e) { console.warn('[RNP] settings load:', e.message); }
    }

    async function _saveSettings(updates) {
        if (updates.exchangeRate !== undefined) _settings.exchangeRate = updates.exchangeRate;
        if (updates.calcPeriod !== undefined) _settings.calcPeriod = updates.calcPeriod;
        if (updates.promotionToken !== undefined) _settings.promotionToken = updates.promotionToken;
        try {
            await _db.from('rnp_settings').upsert({
                cabinet_id: _cab,
                exchange_rate: _settings.exchangeRate,
                calc_period: _settings.calcPeriod,
                promotion_api_token: _settings.promotionToken,
                updated_at: new Date().toISOString()
            }, { onConflict: 'cabinet_id' });
        } catch(e) { console.warn('[RNP] settings save:', e.message); }
    }

    // ─── ARTICLES ─────────────────────────────────────────────────────────────
    async function _loadArticles() {
        try {
            const { data } = await _db.from('rnp_articles').select('*').eq('cabinet_id', _cab).order('nm_id');
            _articles = data || [];
        } catch(e) { console.warn('[RNP] articles load:', e.message); }
    }

    async function _syncFromOrders() {
        try {
            const { data: orders, error } = await _db.from('wb_orders')
                .select('nm_id')
                .eq('cabinet_id', _cab)
                .not('nm_id', 'is', null);
            if (error) throw error;
            if (!orders?.length) { alert('Нет данных в wb_orders. Сначала загрузите данные кабинета на вкладке Оцифровка → Дашборд.'); return; }
            const uniq = new Map();
            orders.forEach(o => {
                const nm = o.nm_id;
                if (nm && !uniq.has(nm)) uniq.set(nm, `Артикул ${nm}`);
            });
            for (const [nmId, name] of uniq) {
                if (!_articles.find(a => a.nm_id == nmId)) {
                    await _db.from('rnp_articles').upsert({
                        cabinet_id: _cab, nm_id: nmId, name,
                        photo_url: _photoUrl(nmId), is_active: false, cost_price: 0
                    }, { onConflict: 'cabinet_id,nm_id', ignoreDuplicates: true });
                }
            }
            await _loadArticles();
        } catch(e) { console.error('[RNP] sync:', e.message); }
    }

    async function _updateArticle(nmId, updates) {
        await _db.from('rnp_articles').update(updates).eq('cabinet_id', _cab).eq('nm_id', nmId);
        const idx = _articles.findIndex(a => a.nm_id == nmId);
        if (idx >= 0) _articles[idx] = { ..._articles[idx], ...updates };
    }

    // ─── CALENDAR ─────────────────────────────────────────────────────────────
    function _buildCalendar() {
        const today = new Date();
        const Y = today.getFullYear();
        const M = today.getMonth(); // 0-based current month

        // Previous month
        const prevY = M === 0 ? Y - 1 : Y;
        const prevM = M === 0 ? 11 : M - 1;
        const prevDays = new Date(Y, M, 0).getDate();
        const prevName = new Date(prevY, prevM, 1).toLocaleString('ru', { month: 'long', year: 'numeric' });

        const weeks = [];
        let wk = null;
        for (let d = 1; d <= prevDays; d++) {
            const dt = new Date(prevY, prevM, d);
            const iso = dt.getDay() === 0 ? 7 : dt.getDay();
            if (iso === 1 || d === 1) {
                if (wk) weeks.push(wk);
                wk = { type: 'week', label: `Нед ${weeks.length + 1}`, dates: [] };
            }
            wk.dates.push(_dateStr(prevY, prevM + 1, d));
        }
        if (wk?.dates.length) weeks.push(wk);

        // Current month
        const currName = today.toLocaleString('ru', { month: 'long', year: 'numeric' });
        const days = [];
        for (let d = 1; d <= today.getDate(); d++) {
            days.push({ type: 'day', date: _dateStr(Y, M + 1, d), label: String(d), isToday: d === today.getDate() });
        }

        return { prevName, weeks, currName, days, todayStr: _dateStr(Y, M + 1, today.getDate()) };
    }

    function _dateStr(y, m, d) {
        return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    }

    // ─── DATA LOADING ─────────────────────────────────────────────────────────
    async function _loadDailyData(nmId) {
        const cal = _buildCalendar();
        const allDates = [...cal.weeks.flatMap(w => w.dates), ...cal.days.map(d => d.date)];
        if (!allDates.length) return {};
        try {
            const { data } = await _db.from('rnp_daily_data')
                .select('*').eq('cabinet_id', _cab).eq('nm_id', nmId)
                .gte('date', allDates[0]).lte('date', allDates[allDates.length - 1]);
            const map = {};
            (data || []).forEach(r => { map[r.date] = r; });
            return map;
        } catch(e) { console.warn('[RNP] load daily:', e.message); return {}; }
    }

    async function _syncToday(nmId) {
        const today = new Date().toISOString().split('T')[0];
        try {
            const { data: ex } = await _db.from('rnp_daily_data').select('updated_at')
                .eq('cabinet_id', _cab).eq('nm_id', nmId).eq('date', today).maybeSingle();
            if (ex?.updated_at) {
                const hrs = (Date.now() - new Date(ex.updated_at)) / 3600000;
                if (hrs < 2) return;
            }
            // Pull from wb_orders for today
            const { data: orders } = await _db.from('wb_orders').select('*')
                .eq('cabinet_id', _cab)
                .eq('nm_id', nmId);

            const { data: stocks } = await _db.from('wb_stocks').select('*')
                .eq('cabinet_id', _cab)
                .eq('nm_id', nmId);

            const row = _buildRow(nmId, today, orders || [], stocks || []);
            await _db.from('rnp_daily_data').upsert(row, { onConflict: 'cabinet_id,nm_id,date' });
        } catch(e) { console.warn('[RNP] sync today:', e.message); }
    }

    function _buildRow(nmId, date, orders, stocks) {
        const todayOrders = orders.filter(o => {
            // support both direct column and nested data JSONB
            const d = (o.order_date || o.date || (o.data && o.data.date) || '').split('T')[0];
            return d === date;
        });
        const active = todayOrders.filter(o => !o.is_return && !(o.data && o.data.isCancel));
        const ordersCount = active.length;
        const ordersSum = active.reduce((s, o) => s + (o.price || (o.data && o.data.priceWithDiscount) || 0), 0);
        const avgCheck = ordersCount > 0 ? ordersSum / ordersCount : 0;

        // wb_stocks columns vary — support multiple schemas
        const stockWh = stocks.reduce((s, st) => s + (st.quantity || st.quantity_full || st.quantityFull || 0), 0);
        const stockTr = stocks.reduce((s, st) => s + (st.in_way_to_client || st.inWayToClient || 0), 0) +
                        stocks.reduce((s, st) => s + (st.in_way_from_client || st.inWayFromClient || 0), 0);

        return {
            cabinet_id: _cab, nm_id: nmId, date,
            orders_count: ordersCount, orders_sum: ordersSum, avg_check: avgCheck,
            stock_warehouse: stockWh, stock_transit: stockTr,
            stock_total: stockWh + stockTr,
            updated_at: new Date().toISOString()
        };
    }

    // ─── HISTORICAL ORDERS SYNC (from wb_orders table) ───────────────────────
    async function _syncOrdersHistory(nmId) {
        try {
            const now = new Date();
            const dateFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
            const { data: orders } = await _db.from('wb_orders')
                .select('order_date, price, is_return')
                .eq('cabinet_id', _cab)
                .eq('nm_id', nmId)
                .gte('order_date', dateFrom);
            if (!orders?.length) return;

            // Group by date
            const byDate = {};
            orders.forEach(o => {
                const date = (o.order_date || '').split('T')[0];
                if (!date) return;
                if (!byDate[date]) byDate[date] = { count: 0, sum: 0 };
                if (!o.is_return) {
                    byDate[date].count++;
                    byDate[date].sum += Number(o.price || 0);
                }
            });

            const upserts = Object.entries(byDate).map(([date, d]) => ({
                cabinet_id: _cab, nm_id: nmId, date,
                orders_count: d.count,
                orders_sum: d.sum,
                avg_check: d.count > 0 ? d.sum / d.count : 0,
                updated_at: new Date().toISOString()
            }));
            if (upserts.length) {
                await _db.from('rnp_daily_data').upsert(upserts, { onConflict: 'cabinet_id,nm_id,date' });
            }
        } catch(e) { console.warn('[RNP] syncOrdersHistory:', e.message); }
    }

    // ─── FINANCE REPORT SYNC ─────────────────────────────────────────────────
    async function _syncFinanceRange(nmId) {
        if (!_callProxy) return;
        const now = new Date();
        const dateFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
        const dateTo   = now.toISOString().split('T')[0];
        try {
            const rows = await _callProxy('finance_report', { dateFrom, dateTo });
            if (!Array.isArray(rows) || !rows.length) return;

            const byDate = {};
            rows.filter(r => String(r.nm_id) === String(nmId)).forEach(row => {
                const date = (row.sale_dt || '').split('T')[0];
                if (!date) return;
                if (!byDate[date]) byDate[date] = { sc: 0, ss: 0, tt: 0, log: 0, sto: 0, rc: 0 };
                const d = byDate[date];
                const type = (row.doc_type_name || '').toLowerCase();
                const qty  = Number(row.quantity || 0);
                if (type === 'продажа') {
                    d.sc  += qty;
                    d.ss  += Number(row.retail_price_withdisc_rub || 0) * qty;
                    d.tt  += Number(row.ppvz_for_pay || 0);
                } else if (type === 'возврат') {
                    d.rc  += qty;
                    d.tt  += Number(row.ppvz_for_pay || 0); // negative for returns
                }
                d.log += Number(row.delivery_rub || 0);
                d.sto += Number(row.storage_fee  || 0);
            });

            const upserts = Object.entries(byDate).map(([date, d]) => {
                const total       = d.sc + d.rc;
                const buyoutPct   = total > 0 ? d.sc / total * 100 : 0;
                const returnPct   = total > 0 ? d.rc / total * 100 : 0;
                const commission  = d.ss - d.tt;
                const commPct     = d.ss > 0 ? commission / d.ss * 100 : 0;
                const logPct      = d.ss > 0 ? d.log / d.ss * 100 : 0;
                const stoPct      = d.ss > 0 ? d.sto / d.ss * 100 : 0;
                const logUnit     = d.sc > 0  ? d.log / d.sc      : 0;
                return {
                    cabinet_id: _cab, nm_id: nmId, date,
                    sales_count: d.sc,   sales_sum: d.ss,
                    returns_count: d.rc, buyout_pct: buyoutPct, return_pct: returnPct,
                    to_transfer: d.tt,   to_transfer_unit: d.sc > 0 ? d.tt / d.sc : 0,
                    logistics_per_unit: logUnit, logistics_pct: logPct,
                    storage_sum: d.sto,  storage_pct: stoPct,
                    commission_pct: commPct,
                    updated_at: new Date().toISOString()
                };
            });
            if (upserts.length) {
                await _db.from('rnp_daily_data').upsert(upserts, { onConflict: 'cabinet_id,nm_id,date' });
            }
        } catch(e) { console.warn('[RNP] syncFinance:', e.message); }
    }

    // ─── PROMOTION / AD SYNC ─────────────────────────────────────────────────
    async function _syncAdStats(nmId) {
        if (!_callProxy) return;
        const now = new Date();
        const dateFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
        const dateTo   = now.toISOString().split('T')[0];
        try {
            // 1. Get list of active campaigns for this cabinet
            const campaigns = await _callProxy('advert_list', {});
            if (!Array.isArray(campaigns) || !campaigns.length) return;

            // 2. Filter campaigns that target this nmId
            const relevantIds = campaigns
                .filter(c => {
                    const nms = (c.unitedParams || []).flatMap(p => p.nms || []);
                    return nms.includes(Number(nmId));
                })
                .map(c => c.advertId);
            if (!relevantIds.length) return;

            // 3. Fetch stats for those campaigns
            const stats = await _callProxy('advert_stats', { advertIds: relevantIds, dateFrom, dateTo });
            if (!Array.isArray(stats) || !stats.length) return;

            // 4. Aggregate by date
            const byDate = {};
            stats.forEach(camp => {
                (camp.days || []).forEach(day => {
                    const date = (day.date || '').split('T')[0];
                    if (!date) return;
                    const nms = (camp.nm || []);
                    const nmRow = nms.find(n => n.nmId == nmId);
                    if (!nmRow) return;
                    if (!byDate[date]) byDate[date] = { imp: 0, cl: 0, spend: 0, orders: 0, basket: 0 };
                    const d = byDate[date];
                    d.imp    += Number(nmRow.views   || 0);
                    d.cl     += Number(nmRow.clicks  || 0);
                    d.spend  += Number(nmRow.sum     || 0);
                    d.orders += Number(nmRow.orders  || 0);
                    d.basket += Number(nmRow.atbs    || 0); // добавлено в корзину
                });
            });

            const upserts = Object.entries(byDate).map(([date, d]) => ({
                cabinet_id: _cab, nm_id: nmId, date,
                ad_impressions: d.imp,
                ad_clicks: d.cl,
                ad_ctr: d.imp > 0 ? d.cl / d.imp * 100 : 0,
                ad_spend: d.spend,
                ad_cpc: d.cl > 0 ? d.spend / d.cl : 0,
                ad_orders: d.orders,
                ad_basket: d.basket,
                ad_cro: d.cl > 0 ? d.orders / d.cl * 100 : 0,
                updated_at: new Date().toISOString()
            }));
            if (upserts.length) {
                await _db.from('rnp_daily_data').upsert(upserts, { onConflict: 'cabinet_id,nm_id,date' });
            }
        } catch(e) { console.warn('[RNP] syncAds:', e.message); }
    }

    // ─── AGGREGATION ──────────────────────────────────────────────────────────
    function _aggWeek(map, dates) {
        const rows = dates.map(d => map[d]).filter(Boolean);
        if (!rows.length) return null;
        const SUM = ['orders_count','orders_sum','sales_count','sales_sum','ad_impressions','ad_clicks',
                     'ad_basket','ad_orders','ad_spend','to_transfer','profit','giveaways','in_production'];
        const AVG = ['spp_pct','avg_check','buyout_pct','return_pct','logistics_per_unit','logistics_pct',
                     'storage_pct','ctr_pct','drr_pct','margin_pct','roi_pct','ad_ctr','ad_cro','ad_cpc','wb_share_pct'];
        const LAST = ['stock_warehouse','stock_transit','stock_total','plan_orders','plan_sales',
                      'plan_impressions','plan_clicks','plan_drr','competitor_basket','competitor_orders',
                      'competitor_cro','competitor_ctr'];
        const a = {};
        SUM.forEach(k => a[k] = rows.reduce((s, r) => s + (r[k] || 0), 0));
        AVG.forEach(k => {
            const vs = rows.map(r => r[k] || 0).filter(v => v > 0);
            a[k] = vs.length ? vs.reduce((s,v) => s + v, 0) / vs.length : 0;
        });
        LAST.forEach(k => a[k] = rows[rows.length - 1]?.[k] || 0);
        return a;
    }

    // ─── DERIVED METRICS ──────────────────────────────────────────────────────
    function _derive(r, art) {
        if (!r) return null;
        const d = { ...r };
        const cost = (art?.cost_price || 0); // already in soms
        const er = _settings.exchangeRate;

        d.plan_orders_pct = d.plan_orders > 0 ? d.orders_count / d.plan_orders * 100 : 0;
        d.plan_sales_pct  = d.plan_sales  > 0 ? d.sales_count  / d.plan_sales  * 100 : 0;
        d.avg_check_sales = d.sales_count > 0 ? (d.sales_sum || 0) / d.sales_count : 0;
        d.to_transfer_unit = d.sales_count > 0 ? (d.to_transfer || 0) / d.sales_count : 0;
        d.drr_pct = (d.sales_sum || 0) > 0 ? (d.ad_spend || 0) / (d.sales_sum || 1) * 100 : 0;
        d.wb_share_pct = (d.logistics_pct || 0) + (d.storage_pct || 0) + (d.commission_pct || 0) + (d.drr_pct || 0);

        // Financials — to_transfer already in RUB, convert to soms
        const revenue  = (d.to_transfer || 0) * er;
        const totalCost = (d.sales_count || 0) * cost;
        const adSpend  = (d.ad_spend || 0) * er;
        d.cost_price_val  = cost;
        d.profit          = revenue - totalCost - adSpend;
        d.profit_per_unit = (d.sales_count || 0) > 0 ? d.profit / d.sales_count : 0;
        d.margin_pct      = revenue > 0 ? d.profit / revenue * 100 : 0;
        d.roi_pct         = totalCost > 0 ? d.profit / totalCost * 100 : 0;

        // Funnel derived
        const totalImpr = (d.impressions || 0);
        const adImpr    = (d.ad_impressions || 0);
        d.organic_imp_pct = totalImpr > 0 ? (totalImpr - adImpr) / totalImpr * 100 : 0;
        d.ad_imp_pct      = totalImpr > 0 ? adImpr / totalImpr * 100 : 0;
        d.orders_conv_pct = (d.basket_count || 0) > 0 ? (d.orders_count || 0) / d.basket_count * 100 : 0;
        d.cro_pct         = (d.clicks || 0) > 0 ? (d.orders_count || 0) / d.clicks * 100 : 0;
        return d;
    }

    // ─── FORMATTERS ───────────────────────────────────────────────────────────
    function _fmt(val, type) {
        if (val === null || val === undefined || val === '' || val === 0) return null;
        const n = parseFloat(val);
        if (isNaN(n)) return null;
        switch (type) {
            case 'int':  return Math.round(n).toLocaleString('ru');
            case 'som':  return Math.round(n).toLocaleString('ru');
            case 'pct':  return n.toFixed(1) + '%';
            case 'pct2': return n.toFixed(2) + '%';
        }
        return n;
    }

    function _cellColor(val, hm) {
        if (!hm || val === null || val === undefined) return '';
        const n = parseFloat(val);
        if (isNaN(n)) return '';
        switch (hm) {
            case 'high':   return n >= 70 ? 'rnp-green' : n >= 50 ? 'rnp-yellow' : 'rnp-red';
            case 'low':    return n <= 20 ? 'rnp-green' : n <= 35 ? 'rnp-yellow' : 'rnp-red';
            case 'profit': return n > 0 ? 'rnp-green' : n < 0 ? 'rnp-red' : '';
            case 'margin': return n >= 20 ? 'rnp-green' : n >= 10 ? 'rnp-yellow' : 'rnp-red';
            case 'plan':   return n >= 100 ? 'rnp-green' : n >= 80 ? 'rnp-yellow' : 'rnp-red';
        }
        return '';
    }

    // ─── RENDER SETTINGS ──────────────────────────────────────────────────────
    function _renderSettings() {
        const el = document.getElementById('tab-rnp-settings');
        if (!el) return;
        el.innerHTML = `
        <div class="space-y-5">
          <div class="widget-card p-5">
            <h3 class="font-semibold mb-4 flex items-center gap-2" style="color:var(--text-primary)">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M2 12h2M20 12h2M4.93 19.07l1.41-1.41M19.07 19.07l-1.41-1.41"/></svg>
              Основные настройки
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="text-xs font-semibold mb-1 block" style="color:var(--text-muted)">Курс ₽ → сом</label>
                <div class="flex gap-2">
                  <input id="rnp-rate" type="number" step="0.1" min="0.1" value="${_settings.exchangeRate}"
                    class="rounded-xl px-3 py-2 text-sm w-full" style="background:var(--surface);border:1px solid var(--border);color:var(--text-primary)">
                  <button onclick="RNP.saveRate()" class="px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap"
                    style="background:var(--accent-gradient);color:#fff">Сохранить</button>
                </div>
              </div>
              <div>
                <label class="text-xs font-semibold mb-1 block" style="color:var(--text-muted)">Период расчёта метрик</label>
                <select id="rnp-period" onchange="RNP.savePeriod(this.value)"
                  class="rounded-xl px-3 py-2 text-sm w-full" style="background:var(--surface);border:1px solid var(--border);color:var(--text-primary)">
                  <option value="7" ${_settings.calcPeriod==7?'selected':''}>7 дней (быстрее реагирует)</option>
                  <option value="28" ${_settings.calcPeriod==28?'selected':''}>28 дней (сглаживает колебания)</option>
                </select>
              </div>
            </div>
          </div>

          <div class="widget-card p-5" style="border-left:3px solid var(--green)">
            <div class="flex items-center gap-2">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--green)"><polyline points="20 6 9 17 4 12"/></svg>
              <span class="text-sm font-semibold" style="color:var(--text-primary)">Реклама подключена автоматически</span>
            </div>
            <p class="text-xs mt-2" style="color:var(--text-muted)">Данные рекламных кампаний (Показы, Клики, CTR, ДРР) загружаются через тот же токен кабинета WB — отдельный токен не нужен.</p>
          </div>

          <div class="widget-card p-5">
            <div class="flex items-center justify-between mb-4">
              <h3 class="font-semibold flex items-center gap-2" style="color:var(--text-primary)">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                Артикулы
                <span class="text-xs font-normal" style="color:var(--text-muted)">${_articles.filter(a=>a.is_active).length} активных из ${_articles.length}</span>
              </h3>
              <button onclick="RNP.syncArts()" id="rnp-sync-btn"
                class="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold"
                style="background:var(--surface);border:1px solid var(--border);color:var(--text-secondary)">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
                Из заказов
              </button>
            </div>
            ${_articles.length === 0 ? `
            <div class="text-center py-10" style="color:var(--text-muted)">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="mx-auto mb-3 opacity-30"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
              <p class="text-sm">Нажмите «Из заказов» чтобы загрузить список артикулов</p>
            </div>` : `
            <div class="space-y-2">
              ${_articles.map(a => `
              <div class="flex items-center gap-3 p-3 rounded-xl" style="background:var(--bg);border:1px solid var(--border)">
                <img src="${a.photo_url || _photoUrl(a.nm_id)}" onerror="this.style.visibility='hidden'"
                  class="w-12 h-12 rounded-lg object-cover flex-shrink-0" style="background:var(--surface)">
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-semibold truncate" style="color:var(--text-primary)">${a.name || '—'}</div>
                  <div class="text-xs" style="color:var(--text-muted)">nmId: ${a.nm_id}</div>
                </div>
                <div class="flex items-center gap-4 flex-shrink-0">
                  <div class="text-right">
                    <div class="text-xs mb-1" style="color:var(--text-muted)">Себест. (сом)</div>
                    <input type="number" value="${a.cost_price||0}" min="0"
                      onchange="RNP.setCost(${a.nm_id},this.value)"
                      class="w-24 rounded-lg px-2 py-1.5 text-sm text-center font-semibold"
                      style="background:var(--surface);border:1px solid var(--border);color:var(--text-primary)">
                  </div>
                  <div class="text-center">
                    <div class="text-xs mb-1" style="color:var(--text-muted)">В РНП</div>
                    <button onclick="RNP.toggleArt(${a.nm_id},this)" class="relative w-11 h-6 rounded-full transition-all duration-200 flex-shrink-0"
                      style="background:${a.is_active?'var(--accent)':'var(--border)'}">
                      <span class="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200"
                        style="left:${a.is_active?'22px':'2px'}"></span>
                    </button>
                  </div>
                </div>
              </div>`).join('')}
            </div>`}
          </div>
        </div>`;
    }

    // ─── RENDER MAIN TAB ──────────────────────────────────────────────────────
    async function _renderMain() {
        const el = document.getElementById('tab-rnp');
        if (!el) return;
        const active = _articles.filter(a => a.is_active);

        if (!active.length) {
            el.innerHTML = `
            <div class="glass rounded-2xl p-14 text-center">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" class="mx-auto mb-5 opacity-20" style="color:var(--text-primary)"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
              <h3 class="text-lg font-bold mb-2" style="color:var(--text-primary)">Нет активных артикулов</h3>
              <p class="text-sm mb-5" style="color:var(--text-muted)">Перейдите в Настройки РНП, включите тумблеры нужных товаров</p>
              <button onclick="showTab('rnp-settings',null)" class="px-5 py-2.5 rounded-xl text-sm font-bold"
                style="background:var(--accent-gradient);color:#fff">Открыть Настройки РНП</button>
            </div>`;
            return;
        }

        if (!_activeNm || !active.find(a => a.nm_id == _activeNm)) _activeNm = active[0].nm_id;
        const art = active.find(a => a.nm_id == _activeNm);

        el.innerHTML = `
        <!-- Picker -->
        <div class="flex items-center gap-2 mb-4 flex-wrap">
          ${active.map(a => `
          <button onclick="RNP.pick(${a.nm_id})"
            class="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all border"
            style="background:${a.nm_id==_activeNm?'var(--accent-gradient)':'var(--surface)'};
                   color:${a.nm_id==_activeNm?'#fff':'var(--text-secondary)'};
                   border-color:${a.nm_id==_activeNm?'transparent':'var(--border)'}">
            <img src="${a.photo_url||_photoUrl(a.nm_id)}" onerror="this.style.display='none'"
              class="w-6 h-6 rounded object-cover flex-shrink-0">
            <span class="truncate" style="max-width:140px">${a.name||a.nm_id}</span>
          </button>`).join('')}
        </div>

        <!-- Header card -->
        <div class="widget-card p-4 mb-4 flex items-center gap-4">
          <img src="${art.photo_url||_photoUrl(art.nm_id)}" onerror="this.onerror=null;this.style.display='none'"
            class="w-16 h-16 rounded-xl object-cover flex-shrink-0" style="background:var(--surface)">
          <div class="flex-1 min-w-0">
            <div class="text-base font-bold truncate" style="color:var(--text-primary)">${art.name||'—'}</div>
            <div class="text-xs mt-0.5" style="color:var(--text-muted)">nmId: ${art.nm_id} &nbsp;·&nbsp; Себестоимость: <b>${art.cost_price||0} сом</b> &nbsp;·&nbsp; Курс: <b>1₽ = ${_settings.exchangeRate} сом</b></div>
          </div>
          <button onclick="RNP.refresh(${art.nm_id})" id="rnp-refresh-btn"
            class="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold flex-shrink-0"
            style="background:var(--surface);border:1px solid var(--border);color:var(--text-secondary)">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
            Обновить
          </button>
        </div>

        <!-- Table -->
        <div id="rnp-table-wrap" class="widget-card overflow-hidden">
          <div class="p-10 text-center" style="color:var(--text-muted)">
            <div style="width:24px;height:24px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 12px"></div>
            Загрузка данных...
          </div>
        </div>`;

        await _renderTable(art);
    }

    async function _renderTable(art) {
        const wrap = document.getElementById('rnp-table-wrap');
        if (!wrap) return;

        const rawData = await _loadDailyData(art.nm_id);
        const cal = _buildCalendar();

        // Build columns
        const cols = [
            ...cal.weeks.map(w => ({ ...w, data: _derive(_aggWeek(rawData, w.dates), art) })),
            ...cal.days.map(d => ({ ...d, data: _derive(rawData[d.date] || null, art) }))
        ];

        const nPrev = cal.weeks.length;
        const nCurr = cal.days.length;

        const html = `
        <div style="overflow-x:auto;max-height:calc(100vh - 280px);overflow-y:auto">
        <table style="border-collapse:separate;border-spacing:0;font-size:11.5px;min-width:max-content;width:100%">
          <thead>
            <tr>
              <th style="min-width:188px;position:sticky;left:0;top:0;z-index:30;background:var(--surface);padding:8px 14px;text-align:left;font-size:10px;font-weight:700;color:var(--text-muted);border-bottom:1px solid var(--border);border-right:1px solid var(--border)" rowspan="2">Метрика</th>
              <th colspan="${nPrev}" style="text-align:center;padding:6px 8px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-muted);background:var(--surface);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:20;opacity:0.7">
                ${cal.prevName}
              </th>
              <th colspan="${nCurr}" style="text-align:center;padding:6px 8px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--accent);background:var(--surface);border-bottom:1px solid var(--border);border-left:2px solid var(--accent);position:sticky;top:0;z-index:20">
                ${cal.currName}
              </th>
            </tr>
            <tr>
              ${cal.weeks.map(w => `<th style="text-align:center;padding:4px 6px;font-size:10px;font-weight:600;color:var(--text-muted);background:var(--surface);border-bottom:2px solid var(--border);min-width:52px;position:sticky;top:28px;z-index:20">${w.label}</th>`).join('')}
              ${cal.days.map(d => `<th style="text-align:center;padding:4px 6px;font-size:10px;font-weight:${d.isToday?'800':'600'};color:${d.isToday?'var(--accent)':'var(--text-muted)'};background:var(--surface);border-bottom:2px solid var(--border);${d.isToday?'border-left:2px solid var(--accent);border-right:2px solid var(--accent);':''}min-width:40px;position:sticky;top:28px;z-index:20;${!d.isToday&&d===cal.days[0]?'border-left:2px solid var(--accent);':''}">${d.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${SECTIONS.map(s => _renderSection(s, cols, art)).join('')}
          </tbody>
        </table>
        </div>`;

        wrap.innerHTML = html;
    }

    function _renderSection(sec, cols, art) {
        const collapsed = _collapsed.has(sec.id);
        const arrow = collapsed ? '▸' : '▾';

        const hdr = `<tr onclick="RNP.toggle('${sec.id}')" style="cursor:pointer">
          <td colspan="${cols.length+1}" style="padding:5px 14px;font-size:9.5px;font-weight:800;letter-spacing:0.09em;text-transform:uppercase;color:${sec.color};background:var(--bg);position:sticky;left:0;border-bottom:1px solid var(--border)">
            <span style="display:inline-flex;align-items:center;gap:6px">${arrow} ${sec.label}</span>
          </td>
        </tr>`;

        if (collapsed) return hdr;

        const rows = sec.rows.map(m => {
            const lbl = `<td style="position:sticky;left:0;z-index:5;background:var(--surface);padding:3px 14px;white-space:nowrap;font-weight:${m.bold?700:400};color:var(--text-secondary);border-bottom:1px solid var(--border);font-style:${m.isPlan?'italic':'normal'};border-right:1px solid var(--border)">
              ${m.label}${m.src==='manual'?' <span style="font-size:9px;opacity:0.4">✏</span>':''}${m.src==='promo'?' <span style="font-size:9px;opacity:0.4">📣</span>':''}
            </td>`;

            const cells = cols.map((col,ci) => {
                const d = col.data;
                const isWeek = col.type === 'week';
                const isToday = col.isToday;
                const isCurrFirst = !isWeek && ci === cols.findIndex(c=>c.type==='day');
                const val = d ? d[m.key] : null;
                const str = _fmt(val, m.type);
                const cc  = m.hm ? _cellColor(val, m.hm) : (m.cl === 'plan' ? _cellColor(val, 'plan') : '');
                const bgColor = cc === 'rnp-green'  ? 'rgba(16,185,129,0.12)'
                              : cc === 'rnp-yellow' ? 'rgba(245,158,11,0.12)'
                              : cc === 'rnp-red'    ? 'rgba(239,68,68,0.12)'
                              : isWeek ? 'rgba(99,102,241,0.04)' : 'transparent';
                const txtColor = cc === 'rnp-green'  ? 'var(--green)'
                               : cc === 'rnp-yellow' ? 'var(--amber)'
                               : cc === 'rnp-red'    ? 'var(--red)'
                               : m.bold ? 'var(--text-primary)' : 'var(--text-secondary)';
                return `<td style="text-align:center;padding:3px 6px;background:${bgColor};color:${txtColor};border-bottom:1px solid var(--border);font-weight:${m.bold?700:400};${isToday?'border-left:2px solid var(--accent);border-right:2px solid var(--accent);':''}${isCurrFirst?'border-left:2px solid var(--accent);':''}">${str||'—'}</td>`;
            }).join('');

            return `<tr style="transition:background 0.1s" onmouseenter="this.style.filter='brightness(1.05)'" onmouseleave="this.style.filter=''">${lbl}${cells}</tr>`;
        }).join('');

        return hdr + rows;
    }

    // ─── PUBLIC API ───────────────────────────────────────────────────────────
    async function init(supabase, cabId, proxyFn) {
        _db = supabase; _cab = cabId;
        if (typeof proxyFn === 'function') _callProxy = proxyFn;
        await _loadSettings();
        await _loadArticles();
    }

    async function openSettings() {
        _renderSettings();
    }

    async function openMain() {
        await _renderMain();
    }

    async function pick(nmId) {
        _activeNm = nmId;
        await _renderMain();
    }

    async function syncArts() {
        const btn = document.getElementById('rnp-sync-btn');
        if (btn) btn.textContent = '⏳ Загрузка...';
        await _syncFromOrders();
        _renderSettings();
    }

    async function toggleArt(nmId, btn) {
        const art = _articles.find(a => a.nm_id == nmId);
        if (!art) return;
        await _updateArticle(nmId, { is_active: !art.is_active });
        _renderSettings();
    }

    async function setCost(nmId, val) {
        await _updateArticle(nmId, { cost_price: parseFloat(val) || 0 });
    }

    async function saveRate() {
        const v = parseFloat(document.getElementById('rnp-rate')?.value);
        if (v > 0) { await _saveSettings({ exchangeRate: v }); }
    }

    async function savePeriod(v) {
        await _saveSettings({ calcPeriod: parseInt(v) });
    }

    async function savePromo() {
        const v = document.getElementById('rnp-promo')?.value || '';
        await _saveSettings({ promotionToken: v });
        _renderSettings();
    }

    async function refresh(nmId) {
        const btn = document.getElementById('rnp-refresh-btn');
        if (btn) { btn.textContent = '⏳...'; btn.disabled = true; }

        // Quick: sync today from orders/stocks cache
        await _syncToday(nmId);

        // Sync historical orders from wb_orders table (always available)
        if (btn) btn.textContent = '⏳ Заказы...';
        await _syncOrdersHistory(nmId);

        // Full: sync finance report + ads if proxy available
        if (_callProxy) {
            if (btn) btn.textContent = '⏳ Финансы...';
            await _syncFinanceRange(nmId);
            if (btn) btn.textContent = '⏳ Реклама...';
            await _syncAdStats(nmId).catch(e => console.warn('[RNP] ads skipped:', e.message));
        }

        const art = _articles.find(a => a.nm_id == nmId);
        if (art) await _renderTable(art);
        if (btn) { btn.textContent = '✓ Обновлено'; setTimeout(() => { btn.disabled = false; btn.textContent = '↻ Обновить'; }, 2500); }
    }

    function toggle(sectionId) {
        if (_collapsed.has(sectionId)) _collapsed.delete(sectionId);
        else _collapsed.add(sectionId);
        const art = _articles.find(a => a.nm_id == _activeNm);
        if (art) _renderTable(art);
    }

    return { init, openSettings, openMain, pick, syncArts, toggleArt, setCost, saveRate, savePeriod, savePromo, refresh, toggle,
             syncFinance: _syncFinanceRange, syncAds: _syncAdStats };
})();

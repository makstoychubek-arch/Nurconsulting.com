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
    let _collapsedSections = new Set();
    let _financeCache = { key: '', rows: [], ts: 0 };
    let _dataCache = {}; // nmId -> { date -> row }
    let _stockCache = {}; // nmId -> { size -> { wh, transit } }

    const SIZE_ORDER = ['XXS','XS','S','M','L','XL','XXL','2XL','3XL','4XL','5XL'];
    const ALL_SIZES = ['XXS','XS','S','M','L','XL','XXL','3XL','4XL','5XL'];
    const PLAN_KEYS = ['plan_orders','plan_sales','plan_impressions','plan_clicks','plan_drr'];

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
    function _basketNum(vol) {
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
        return found ? found[2] : 46 + Math.floor((vol - 8886) / 216);
    }

    function _photoMeta(nmId) {
        const vol  = Math.floor(nmId / 100000);
        const part = Math.floor(nmId / 1000);
        const basket = _basketNum(vol);
        const basketStr = String(Math.max(1, basket)).padStart(2, '0');
        return { vol, part, basket, basketStr };
    }

    function _photoUrl(nmId, size = 'c516x688') {
        const { vol, part, basketStr } = _photoMeta(nmId);
        return `https://basket-${basketStr}.wbbasket.ru/vol${vol}/part${part}/${nmId}/images/${size}/1.webp`;
    }

    function _imgHtml(art, className, size = 'c516x688', extraStyle = '') {
        const nmId = art.nm_id;
        const meta = _photoMeta(nmId);
        const src = (art.photo_url && art.photo_url.startsWith('http'))
            ? art.photo_url
            : _photoUrl(nmId, size);
        const cls = className ? ` class="${className}"` : '';
        const sty = extraStyle ? ` style="${extraStyle}"` : '';
        return `<img${cls}${sty} src="${src}" referrerpolicy="no-referrer" loading="lazy" alt=""
          data-nmid="${nmId}" data-vol="${meta.vol}" data-part="${meta.part}" data-basket="${meta.basket}" data-size="${size}"
          onerror="RNP.imgFallback(this)">`;
    }

    function imgFallback(img) {
        const attempt = parseInt(img.dataset.attempt || '0', 10) + 1;
        img.dataset.attempt = String(attempt);
        const nmId = img.dataset.nmid;
        const vol = img.dataset.vol;
        const part = img.dataset.part;
        const size = img.dataset.size || 'c516x688';
        const base = parseInt(img.dataset.basket || '1', 10);
        if (attempt <= 6) {
            const delta = Math.ceil(attempt / 2) * (attempt % 2 ? 1 : -1);
            const b = String(Math.max(1, Math.min(99, base + delta))).padStart(2, '0');
            img.src = `https://basket-${b}.wbbasket.ru/vol${vol}/part${part}/${nmId}/images/${size}/1.webp`;
            return;
        }
        if (attempt === 7) {
            img.src = `https://basket-${String(base).padStart(2, '0')}.wbbasket.ru/vol${vol}/part${part}/${nmId}/images/big/1.jpg`;
            return;
        }
        img.style.background = 'var(--surface)';
        img.alt = 'нет фото';
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
                if (wk?.dates.length) {
                    wk.label = _weekLabel(wk.dates);
                    wk.weekStart = wk.dates[0];
                    weeks.push(wk);
                }
                wk = { type: 'week', label: '', dates: [], weekStart: _dateStr(prevY, prevM + 1, d) };
            }
            wk.dates.push(_dateStr(prevY, prevM + 1, d));
        }
        if (wk?.dates.length) {
            wk.label = _weekLabel(wk.dates);
            wk.weekStart = wk.dates[0];
            weeks.push(wk);
        }

        // Current month
        const currName = today.toLocaleString('ru', { month: 'long', year: 'numeric' });
        const days = [];
        for (let d = 1; d <= today.getDate(); d++) {
            const date = _dateStr(Y, M + 1, d);
            const dt = new Date(Y, M, d);
            const dd = String(d).padStart(2, '0');
            const mm = String(M + 1).padStart(2, '0');
            days.push({
                type: 'day', date,
                label: `${dd}.${mm}`,
                dow: dt.toLocaleString('ru', { weekday: 'short' }),
                isToday: d === today.getDate()
            });
        }

        return { prevName, weeks, currName, days, todayStr: _dateStr(Y, M + 1, today.getDate()) };
    }

    function _dateStr(y, m, d) {
        return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    }

    function _sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    /** Split [from..to] into chunks of maxDays (WB limit: 7) */
    function _splitDateRange(from, to, maxDays = 7) {
        const chunks = [];
        let cur = new Date(from);
        const end = new Date(to);
        while (cur <= end) {
            const chunkEnd = new Date(cur);
            chunkEnd.setDate(chunkEnd.getDate() + maxDays - 1);
            if (chunkEnd > end) chunkEnd.setTime(end.getTime());
            chunks.push({
                from: cur.toISOString().split('T')[0],
                to: chunkEnd.toISOString().split('T')[0],
            });
            cur = new Date(chunkEnd);
            cur.setDate(cur.getDate() + 1);
        }
        return chunks;
    }

    function _weekLabel(dates) {
        const fmt = ds => { const p = ds.split('-'); return `${p[2]}.${p[1]}`; };
        return `${fmt(dates[0])}–${fmt(dates[dates.length - 1])}`;
    }

    function _sortSizes(a, b) {
        const ia = SIZE_ORDER.indexOf(a.toUpperCase());
        const ib = SIZE_ORDER.indexOf(b.toUpperCase());
        if (ia >= 0 && ib >= 0) return ia - ib;
        if (ia >= 0) return -1;
        if (ib >= 0) return 1;
        return a.localeCompare(b, 'ru');
    }

    async function _loadAllStocks(nmIds) {
        if (!nmIds.length) return;
        try {
            const { data } = await _db.from('wb_stocks').select('*')
                .eq('cabinet_id', _cab).in('nm_id', nmIds);
            nmIds.forEach(id => { _stockCache[id] = {}; });
            (data || []).forEach(s => {
                const nm = s.nm_id;
                if (!_stockCache[nm]) _stockCache[nm] = {};
                const size = (s.tech_size || s.techSize || s.size || '').trim().toUpperCase() || '—';
                if (!_stockCache[nm][size]) _stockCache[nm][size] = { wh: 0, transit: 0 };
                _stockCache[nm][size].wh += Number(s.quantity || 0);
                _stockCache[nm][size].transit +=
                    Number(s.in_way_to_client || s.inWayToClient || 0) +
                    Number(s.in_way_from_client || s.inWayFromClient || 0);
            });
        } catch (e) { console.warn('[RNP] load stocks:', e.message); }
    }

    function _planVal(art, key, colKey) {
        const v = art.manual_data?.plans?.[colKey]?.[key];
        return (v != null && v !== '') ? v : '';
    }

    function _applyColPlans(data, art, colKey) {
        const d = data ? { ...data } : {};
        const md = art.manual_data?.plans?.[colKey] || {};
        PLAN_KEYS.forEach(k => {
            if (md[k] != null && md[k] !== '') d[k] = Number(md[k]);
        });
        d.plan_orders_pct = d.plan_orders > 0 ? (d.orders_count || 0) / d.plan_orders * 100 : 0;
        d.plan_sales_pct  = d.plan_sales  > 0 ? (d.sales_count  || 0) / d.plan_sales  * 100 : 0;
        return d;
    }

    function _stockTotals(bySize) {
        let wh = 0, tr = 0;
        Object.values(bySize).forEach(x => { wh += x.wh; tr += x.transit; });
        return { wh, tr, total: wh + tr };
    }

    function _periodSummary(art, rawData, cal) {
        const dates = cal.days.map(d => d.date);
        if (!dates.length) return {};
        const agg = _aggWeek(rawData, dates);
        const d = _derive(agg, art);
        return _applyColPlans(d, art, dates[dates.length - 1]);
    }

    function _fmtKpi(val, type) {
        if (val == null || val === '' || isNaN(val)) return '—';
        const n = parseFloat(val);
        if (type === 'pct') return n.toFixed(1).replace('.', ',') + '%';
        if (type === 'som') return Math.round(n).toLocaleString('ru');
        return String(n);
    }

    function _sparkline(values, w = 54, h = 16) {
        const nums = values.map(v => Number(v) || 0);
        if (!nums.length || nums.every(n => n === 0)) return '<span class="rnp-spark-empty">—</span>';
        const max = Math.max(...nums, 1);
        const min = Math.min(...nums);
        const range = max - min || 1;
        const pts = nums.map((n, i) => {
            const x = (i / Math.max(nums.length - 1, 1)) * (w - 2) + 1;
            const y = h - 2 - ((n - min) / range) * (h - 4);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(' ');
        return `<svg class="rnp-spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline fill="none" stroke="#10b981" stroke-width="1.5" points="${pts}"/></svg>`;
    }

    function _getSize(bySize, sz) {
        if (bySize[sz]) return bySize[sz];
        const key = Object.keys(bySize).find(k => k.toUpperCase() === sz.toUpperCase());
        return key ? bySize[key] : { wh: 0, transit: 0 };
    }

    function _sizeCellCls(total) {
        return (Number(total) || 0) > 0 ? 'rnp-size-has' : 'rnp-size-zero';
    }

    function _buildStockSizeHTML(bySize) {
        const extra = Object.keys(bySize).filter(s => !ALL_SIZES.includes(s.toUpperCase()) && s !== '—');
        const sizes = [...ALL_SIZES, ...extra.sort(_sortSizes)];

        const cell = (sz, v) => {
            const n = Number(v) || 0;
            return `<td class="${_sizeCellCls(n)}">${n > 0 ? n : 0}</td>`;
        };
        const hdrCell = (sz) => {
            const x = _getSize(bySize, sz);
            const t = x.wh + x.transit;
            return `<th class="${_sizeCellCls(t)}">${sz}</th>`;
        };
        const row = (label, rowCls, fn) => {
            const cells = sizes.map(sz => cell(sz, fn(_getSize(bySize, sz))));
            const total = sizes.reduce((s, sz) => s + fn(_getSize(bySize, sz)), 0);
            return `<tr class="${rowCls}"><td class="rnp-stock-label">${label}</td>${cells.join('')}<td class="${_sizeCellCls(total)}" style="font-weight:800">${total}</td></tr>`;
        };

        return `<div class="rnp-stock-block">
          <table class="rnp-stock-table">
            <thead><tr>
              <th class="rnp-stock-label"></th>
              ${sizes.map(hdrCell).join('')}
              <th>Σ</th>
            </tr></thead>
            <tbody>
              ${row('На складах', 'rnp-row-wh', x => x.wh)}
              ${row('В пути', 'rnp-row-tr', x => x.transit)}
              ${row('Общий', 'rnp-row-sum', x => x.wh + x.transit)}
              ${row('В продаже', 'rnp-row-sale', x => x.wh)}
            </tbody>
          </table>
        </div>`;
    }

    function _buildTopPanelHTML(art, stockBySize, rawData, cal) {
        const kpi = _periodSummary(art, rawData, cal);
        const st = _stockTotals(stockBySize);
        const roiCls = (kpi.roi_pct || 0) >= 100 ? 'pos' : '';
        const marginCls = (kpi.margin_pct || 0) >= 15 ? 'pos' : ((kpi.margin_pct || 0) < 5 ? 'neg' : '');
        const profitCls = (kpi.profit || 0) >= 0 ? 'pos' : 'neg';
        const planCls = (kpi.plan_orders_pct || 0) >= 100 ? 'pos' : ((kpi.plan_orders_pct || 0) < 80 ? 'neg' : '');

        return `<div class="rnp-top-panel">
          <div class="rnp-top-photo">${_imgHtml(art, 'rnp-top-photo-img', 'c516x688')}</div>
          <div class="rnp-top-info">
            <div class="rnp-top-title">${art.name || '—'}</div>
            <div class="rnp-top-nmid">Арт. WB: <b>${art.nm_id}</b> · Себест: <b>${art.cost_price || 0}</b> сом</div>
            <div class="rnp-kpi-grid">
              <div class="rnp-kpi"><span>Рентабельность</span><b class="${roiCls}">${_fmtKpi(kpi.roi_pct, 'pct')}</b></div>
              <div class="rnp-kpi"><span>ДРР %</span><b>${_fmtKpi(kpi.drr_pct, 'pct')}</b></div>
              <div class="rnp-kpi"><span>Маржа %</span><b class="${marginCls}">${_fmtKpi(kpi.margin_pct, 'pct')}</b></div>
              <div class="rnp-kpi"><span>Прибыль</span><b class="${profitCls}">${_fmtKpi(kpi.profit, 'som')}</b></div>
              <div class="rnp-kpi"><span>План/факт %</span><b class="${planCls}">${_fmtKpi(kpi.plan_orders_pct, 'pct')}</b></div>
              <div class="rnp-kpi"><span>CTR %</span><b>${_fmtKpi(kpi.ctr_pct, 'pct')}</b></div>
            </div>
            <div class="rnp-stock-totals">
              <span>На складах: <b>${st.wh.toLocaleString('ru')}</b></span>
              <span>В пути: <b>${st.tr.toLocaleString('ru')}</b></span>
              <span>Общий: <b>${st.total.toLocaleString('ru')}</b></span>
            </div>
            <div class="rnp-top-actions">
              <button onclick="RNP.refresh(${art.nm_id})" id="rnp-refresh-btn"
                class="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold btn-smooth"
                style="background:var(--surface);border:1px solid var(--border);color:var(--text-secondary)">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
                Обновить
              </button>
            </div>
          </div>
          <div class="rnp-top-stock-wrap">${_buildStockSizeHTML(stockBySize)}</div>
        </div>`;
    }
    async function _loadDailyData(nmId) {
        if (_dataCache[nmId]) return _dataCache[nmId];
        const cal = _buildCalendar();
        const allDates = [...cal.weeks.flatMap(w => w.dates), ...cal.days.map(d => d.date)];
        if (!allDates.length) return {};
        try {
            const { data } = await _db.from('rnp_daily_data')
                .select('*').eq('cabinet_id', _cab).eq('nm_id', nmId)
                .gte('date', allDates[0]).lte('date', allDates[allDates.length - 1]);
            const map = {};
            (data || []).forEach(r => { map[r.date] = r; });
            _dataCache[nmId] = map;
            return map;
        } catch(e) { console.warn('[RNP] load daily:', e.message); return {}; }
    }

    async function _loadAllDailyData(nmIds) {
        const cal = _buildCalendar();
        const allDates = [...cal.weeks.flatMap(w => w.dates), ...cal.days.map(d => d.date)];
        if (!allDates.length || !nmIds.length) return;
        try {
            const { data } = await _db.from('rnp_daily_data')
                .select('*').eq('cabinet_id', _cab)
                .in('nm_id', nmIds)
                .gte('date', allDates[0]).lte('date', allDates[allDates.length - 1]);
            nmIds.forEach(id => { _dataCache[id] = {}; });
            (data || []).forEach(r => {
                if (!_dataCache[r.nm_id]) _dataCache[r.nm_id] = {};
                _dataCache[r.nm_id][r.date] = r;
            });
        } catch(e) { console.warn('[RNP] load all daily:', e.message); }
    }

    function _invalidateCache(nmId) {
        if (nmId) delete _dataCache[nmId];
        else _dataCache = {};
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
                .select('order_date, price, is_return, data')
                .eq('cabinet_id', _cab)
                .eq('nm_id', nmId)
                .gte('order_date', dateFrom);
            if (!orders?.length) return;

            // Group by date
            const byDate = {};
            orders.forEach(o => {
                const date = (o.order_date || '').split('T')[0];
                if (!date) return;
                if (!byDate[date]) byDate[date] = { count: 0, sum: 0, sppSum: 0, sppCnt: 0 };
                if (!o.is_return) {
                    byDate[date].count++;
                    byDate[date].sum += Number(o.price || 0);
                    const spp = o.data?.spp ?? o.data?.Spp;
                    if (spp != null && Number(spp) > 0) {
                        byDate[date].sppSum += Number(spp);
                        byDate[date].sppCnt++;
                    }
                }
            });

            const upserts = Object.entries(byDate).map(([date, d]) => ({
                cabinet_id: _cab, nm_id: nmId, date,
                orders_count: d.count,
                orders_sum: d.sum,
                avg_check: d.count > 0 ? d.sum / d.count : 0,
                spp_pct: d.sppCnt > 0 ? d.sppSum / d.sppCnt : 0,
                updated_at: new Date().toISOString()
            }));
            if (upserts.length) {
                await _db.from('rnp_daily_data').upsert(upserts, { onConflict: 'cabinet_id,nm_id,date' });
            }
        } catch(e) { console.warn('[RNP] syncOrdersHistory:', e.message); }
    }

    // ─── FINANCE REPORT SYNC ─────────────────────────────────────────────────
    async function _fetchFinanceAgg(nmId) {
        const now = new Date();
        const dateFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
        const dateTo   = now.toISOString().split('T')[0];
        const cacheKey = `${_cab}_${dateFrom}_${dateTo}_${nmId}`;
        if (_financeCache.key === cacheKey && Date.now() - _financeCache.ts < 30 * 60 * 1000) {
            return _financeCache.rows;
        }
        const rows = await _callProxy('finance_report', { dateFrom, dateTo, aggregate: true, nmId });
        if (Array.isArray(rows) && rows.length) {
            _financeCache = { key: cacheKey, rows, ts: Date.now() };
        }
        return Array.isArray(rows) ? rows : [];
    }

    async function _syncFinanceRange(nmId) {
        if (!_callProxy) return;
        try {
            const rows = await _fetchFinanceAgg(nmId);
            if (!rows.length) return;

            const byDate = {};
            rows.forEach(row => {
                const date = row.date || (row.sale_dt || '').split('T')[0];
                if (!date) return;
                if (!byDate[date]) byDate[date] = { sc: 0, ss: 0, tt: 0, log: 0, sto: 0, rc: 0 };
                const d = byDate[date];
                d.sc  += Number(row.sc  || 0);
                d.ss  += Number(row.ss  || 0);
                d.tt  += Number(row.tt  || 0);
                d.rc  += Number(row.rc  || 0);
                d.log += Number(row.log || 0);
                d.sto += Number(row.sto || 0);
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

    // ─── SALES FUNNEL (Analytics API v3) ─────────────────────────────────────
    async function _syncFunnelHistory(nmId, onProgress) {
        if (!_callProxy) return;
        const now = new Date();
        const rangeStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const chunks = _splitDateRange(rangeStart, now, 7);
        const byDate = {};

        for (let i = 0; i < chunks.length; i++) {
            if (i > 0) await _sleep(21000); // WB rate limit: 3 req/min, 20s interval
            if (onProgress) onProgress(i + 1, chunks.length);

            let resp;
            try {
                resp = await _callProxy('sales_funnel_history', {
                    dateFrom: chunks[i].from,
                    dateTo: chunks[i].to,
                    nmId,
                    aggregationLevel: 'day',
                });
            } catch (e) {
                console.warn('[RNP] funnel chunk error:', e.message);
                continue;
            }

            const items = Array.isArray(resp) ? resp : (resp?.data || []);
            for (const item of items) {
                if (String(item.product?.nmId) !== String(nmId)) continue;
                for (const day of (item.history || [])) {
                    const date = (day.date || '').split('T')[0];
                    if (!date) continue;
                    const opens = Number(day.openCount || 0);
                    const cart  = Number(day.cartCount || 0);
                    byDate[date] = {
                        impressions: opens,
                        clicks: opens, // переходы в карточку = openCount
                        ctr_pct: opens > 0 ? cart / opens * 100 : 0,
                        basket_count: cart,
                        basket_pct: Number(day.addToCartConversion || 0),
                        funnel_order_conv: Number(day.cartToOrderConversion || 0),
                    };
                }
            }
        }

        if (!Object.keys(byDate).length) {
            console.info('[RNP] funnel: no data returned');
            return;
        }

        console.info(`[RNP] funnel: ${Object.keys(byDate).length} dates synced`);
        const upserts = Object.entries(byDate).map(([date, d]) => ({
            cabinet_id: _cab, nm_id: nmId, date,
            ...d,
            updated_at: new Date().toISOString(),
        }));
        await _db.from('rnp_daily_data').upsert(upserts, { onConflict: 'cabinet_id,nm_id,date' });
    }

    // ─── PROMOTION / AD SYNC (WB API v2/v3) ─────────────────────────────────
    async function _syncAdStats(nmId) {
        if (!_callProxy) return;
        const now = new Date();
        const dateFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
        const dateTo   = now.toISOString().split('T')[0];
        try {
            // 1. Get all campaign IDs via /adv/v1/promotion/count
            const resp = await _callProxy('advert_list', {});
            // New format: { ids: [...] }; old fallback: { adverts: [...] } or array
            const allIds = resp?.ids ||
                           (resp?.adverts ? resp.adverts.map(c => c.advertId || c.id).filter(Boolean) : null) ||
                           (Array.isArray(resp) ? resp.map(c => c.advertId || c.id).filter(Boolean) : []);
            if (!allIds.length) { console.info('[RNP] advert_list: no campaign IDs'); return; }
            console.info(`[RNP] advert_list: ${allIds.length} campaign IDs`);

            // 2. Fetch stats (GET /adv/v3/fullstats)
            const stats = await _callProxy('advert_stats', { advertIds: allIds, dateFrom, dateTo });
            if (!Array.isArray(stats) || !stats.length) { console.info('[RNP] advert_stats: empty response'); return; }
            console.info(`[RNP] advert_stats: ${stats.length} campaigns returned`);

            // 3. Aggregate by date — handle multiple possible structures from WB:
            //    a) days[] → {date, nm[]/nms[]/apps[{nm/nms}]} — per-article breakdown
            //    b) days[] → {date, views, clicks, sum, ...} — day-level aggregate
            const byDate = {};
            stats.forEach(camp => {
                (camp.days || []).forEach(day => {
                    const date = (day.date || '').split('T')[0];
                    if (!date) return;

                    let imp = 0, cl = 0, spend = 0, orders = 0, basket = 0;

                    // Collect all nm-level entries from any nesting
                    const allNms = [];
                    if (Array.isArray(day.nm))   allNms.push(...day.nm);
                    if (Array.isArray(day.nms))  allNms.push(...day.nms);
                    (day.apps || []).forEach(app => {
                        const nms = app.nm || app.nms || [];
                        if (Array.isArray(nms)) allNms.push(...nms);
                    });

                    if (allNms.length) {
                        // Per-article data available — find our nmId
                        const row = allNms.find(n => String(n.nmId || n.nm_id) === String(nmId));
                        if (!row) return;
                        imp    = Number(row.views  || 0);
                        cl     = Number(row.clicks || 0);
                        spend  = Number(row.sum    || 0);
                        orders = Number(row.orders || 0);
                        basket = Number(row.atbs   || 0);
                    } else {
                        // Day-level aggregate (no nm breakdown) — use as-is
                        imp    = Number(day.views  || 0);
                        cl     = Number(day.clicks || 0);
                        spend  = Number(day.sum    || 0);
                        orders = Number(day.orders || 0);
                        basket = Number(day.atbs   || 0);
                    }

                    if (!imp && !cl && !spend) return;
                    if (!byDate[date]) byDate[date] = { imp: 0, cl: 0, spend: 0, orders: 0, basket: 0 };
                    byDate[date].imp    += imp;
                    byDate[date].cl     += cl;
                    byDate[date].spend  += spend;
                    byDate[date].orders += orders;
                    byDate[date].basket += basket;
                });
            });

            console.info(`[RNP] advert_stats: aggregated for ${Object.keys(byDate).length} dates`);

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
                     'ad_basket','ad_orders','ad_spend','to_transfer','profit','giveaways','in_production',
                     'impressions','clicks','basket_count'];
        const AVG = ['spp_pct','avg_check','buyout_pct','return_pct','logistics_per_unit','logistics_pct',
                     'storage_pct','ctr_pct','basket_pct','drr_pct','margin_pct','roi_pct','ad_ctr','ad_cro','ad_cpc','wb_share_pct',
                     'funnel_order_conv'];
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

        // Overlay manual benchmarks (plans are per-column via _applyColPlans)
        const md = art?.manual_data || {};
        const MANUAL_KEYS = ['in_production','giveaways',
                             'competitor_basket','competitor_orders','competitor_ctr','competitor_cro'];
        MANUAL_KEYS.forEach(k => {
            if (md[k] !== undefined && md[k] !== null && Number(md[k]) > 0) {
                d[k] = Number(md[k]);
            }
        });

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
        d.orders_conv_pct = (d.funnel_order_conv > 0)
            ? d.funnel_order_conv
            : ((d.basket_count || 0) > 0 ? (d.orders_count || 0) / d.basket_count * 100 : 0);
        d.cro_pct         = (d.clicks || 0) > 0 ? (d.orders_count || 0) / d.clicks * 100 : 0;
        if (!d.ctr_pct && (d.impressions || 0) > 0) {
            d.ctr_pct = (d.clicks || 0) / d.impressions * 100;
        }
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
            <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 class="font-semibold flex items-center gap-2" style="color:var(--text-primary)">
                Артикулы
                <span class="text-xs font-normal" style="color:var(--text-muted)">${_articles.filter(a=>a.is_active).length} / ${_articles.length} в РНП</span>
              </h3>
              <div class="flex gap-2 flex-wrap">
                <button onclick="RNP.syncArts()" id="rnp-sync-btn"
                  class="px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style="background:var(--surface);border:1px solid var(--border);color:var(--text-secondary)">Из заказов</button>
                <button onclick="RNP.enableAll(true)" class="px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style="background:var(--accent-soft);border:1px solid var(--accent-border);color:var(--accent)">Включить все</button>
                <button onclick="RNP.enableAll(false)" class="px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style="background:var(--surface);border:1px solid var(--border);color:var(--text-muted)">Выключить все</button>
              </div>
            </div>
            ${_articles.length === 0 ? `
            <div class="text-center py-10" style="color:var(--text-muted)">
              <p class="text-sm">Нажмите «Из заказов» чтобы загрузить артикулы</p>
            </div>` : `
            <div style="overflow-x:auto;max-height:calc(100vh - 320px);overflow-y:auto">
              <table class="rnp-sheet-table" style="font-size:11px">
                <thead>
                  <tr>
                    <th class="rnp-th-metric" style="width:40px"></th>
                    <th class="rnp-th-metric">Товар</th>
                    <th style="min-width:90px">nmId</th>
                    <th style="min-width:80px">Себест. (сом)</th>
                    <th style="min-width:60px">В РНП</th>
                  </tr>
                </thead>
                <tbody>
                  ${_articles.map(a => `
                  <tr>
                    <td>${_imgHtml(a, '', 'c246x328', 'width:32px;height:40px;border-radius:3px;object-fit:cover;display:block')}</td>
                    <td class="rnp-metric-col" style="max-width:200px;overflow:hidden;text-overflow:ellipsis">${a.name||'—'}</td>
                    <td style="color:var(--text-muted)">${a.nm_id}</td>
                    <td><input type="number" value="${a.cost_price||0}" min="0"
                      onchange="RNP.setCost(${a.nm_id},this.value)"
                      style="width:70px;padding:2px 4px;text-align:center;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text-primary);font-size:11px"></td>
                    <td><button onclick="RNP.toggleArt(${a.nm_id})" class="relative w-9 h-5 rounded-full"
                      style="background:${a.is_active?'var(--accent)':'var(--border)'}">
                      <span style="position:absolute;top:2px;left:${a.is_active?'18px':'2px'};width:16px;height:16px;border-radius:50%;background:#fff;transition:0.2s"></span>
                    </button></td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>`}
          </div>
        </div>`;
    }

    // ─── RENDER MAIN TAB (Google Sheets layout) ─────────────────────────────
    async function _renderMain() {
        const el = document.getElementById('tab-rnp');
        if (!el) return;
        const active = _articles.filter(a => a.is_active);

        if (!active.length) {
            el.innerHTML = `
            <div class="glass rounded-2xl p-14 text-center">
              <h3 class="text-lg font-bold mb-2" style="color:var(--text-primary)">Нет активных артикулов</h3>
              <p class="text-sm mb-5" style="color:var(--text-muted)">Перейдите в Настройки РНП → «Из заказов» → включите нужные товары</p>
              <button onclick="showTab('rnp-settings',null)" class="px-5 py-2.5 rounded-xl text-sm font-bold"
                style="background:var(--accent-gradient);color:#fff">Открыть Настройки РНП</button>
            </div>`;
            return;
        }

        if (!_activeNm || !active.find(a => a.nm_id == _activeNm)) _activeNm = active[0].nm_id;

        el.innerHTML = `
        <div class="rnp-workspace">
          <div class="rnp-toolbar">
            <div class="flex items-center gap-3 flex-wrap">
              <span style="font-weight:700;color:var(--text-primary)">РНП</span>
              <span style="color:var(--text-muted)">${active.length} артикулов</span>
              <span style="color:var(--text-muted)">·</span>
              <span style="color:var(--text-muted)">1₽ = <b style="color:var(--text-primary)">${_settings.exchangeRate}</b> сом</span>
            </div>
            <div class="flex items-center gap-2">
              <button onclick="RNP.refreshAll()" id="rnp-refresh-all-btn"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold btn-smooth"
                style="background:var(--accent-gradient);color:#fff">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
                Обновить все
              </button>
            </div>
          </div>
          <div class="rnp-sheet-tabs" id="rnp-sheet-tabs">
            ${active.map(a => `
            <div class="rnp-sheet-tab${a.nm_id==_activeNm?' active':''}" onclick="RNP.pick(${a.nm_id})" title="${a.name||a.nm_id}">
              ${_imgHtml(a, 'rnp-tab-img', 'c246x328')}
              <span>${(a.name||String(a.nm_id)).substring(0,22)}</span>
            </div>`).join('')}
          </div>
          <div class="rnp-sheet-body" id="rnp-sheet-body">
            <div class="p-10 text-center" style="color:var(--text-muted)">
              <div style="width:24px;height:24px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 12px"></div>
              Загрузка...
            </div>
          </div>
        </div>`;

        await _loadAllDailyData(active.map(a => a.nm_id));
        await _loadAllStocks(active.map(a => a.nm_id));
        await _renderActiveTable();
    }

    async function _renderActiveTable() {
        const body = document.getElementById('rnp-sheet-body');
        if (!body) return;
        const art = _articles.find(a => a.nm_id == _activeNm);
        if (!art) return;

        const rawData = _dataCache[art.nm_id] || {};
        const cal = _buildCalendar();

        const stockBySize = _stockCache[art.nm_id] || {};

        body.innerHTML = `
          ${_buildTopPanelHTML(art, stockBySize, rawData, cal)}
          <div class="rnp-table-scroll" id="rnp-table-wrap">
            ${_buildTableHTML(art, rawData, cal)}
          </div>`;

        // Update active tab highlight
        document.querySelectorAll('.rnp-sheet-tab').forEach(tab => {
            const nm = tab.getAttribute('onclick')?.match(/pick\((\d+)\)/)?.[1];
            tab.classList.toggle('active', nm == _activeNm);
        });
    }

    function _buildTableHTML(art, rawData, cal) {
        const cols = [
            ...cal.weeks.map(w => {
                const colKey = w.weekStart || w.dates[0];
                const agg = _derive(_aggWeek(rawData, w.dates), art);
                return { ...w, colKey, data: _applyColPlans(agg, art, colKey) };
            }),
            ...cal.days.map(d => {
                const derived = _derive(rawData[d.date] || null, art);
                return { ...d, colKey: d.date, data: _applyColPlans(derived, art, d.date) };
            })
        ];
        const nPrev = cal.weeks.length;
        const nCurr = cal.days.length;
        const firstDayIdx = cols.findIndex(c => c.type === 'day');

        return `
        <table class="rnp-sheet-table">
          <thead>
            <tr>
              <th class="rnp-th-metric" rowspan="3" style="top:0">Метрика</th>
              <th class="rnp-th-spark" rowspan="3" style="top:0">тренд</th>
              <th class="rnp-th-month" colspan="${nPrev}" style="color:var(--text-muted);opacity:0.8;top:0">${cal.prevName}</th>
              <th class="rnp-th-month" colspan="${nCurr}" style="color:var(--accent);top:0;border-left:2px solid var(--accent)">${cal.currName}</th>
            </tr>
            <tr>
              ${cal.weeks.map(w => `<th class="rnp-th-day" style="top:22px;color:var(--text-muted)">${w.label}</th>`).join('')}
              ${cal.days.map((d,i) => `<th class="rnp-th-day${d.isToday?' today':''}${i===0?' rnp-cell-month-start':''}" style="top:22px" title="${d.dow||''}">${d.label}</th>`).join('')}
            </tr>
            <tr>
              ${cal.weeks.map(() => `<th class="rnp-th-day" style="top:44px;font-weight:400;color:var(--text-muted);font-size:9px">нед</th>`).join('')}
              ${cal.days.map((d,i) => `<th class="rnp-th-day${i===0?' rnp-cell-month-start':''}" style="top:44px;font-weight:400;color:var(--text-muted);font-size:9px">${d.dow||''}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${SECTIONS.map(s => _renderSection(s, cols, art, firstDayIdx)).join('')}
          </tbody>
        </table>`;
    }

    function _renderSection(sec, cols, art, firstDayIdx) {
        const key = `${art.nm_id}:${sec.id}`;
        const collapsed = _collapsedSections.has(key);
        const arrow = collapsed ? '▸' : '▾';
        const hdr = `<tr class="rnp-section-hdr" onclick="RNP.toggleSection(${art.nm_id},'${sec.id}')">
          <td colspan="${cols.length+2}" style="color:${sec.color};background:${sec.color}18;border-color:${sec.color}40">
            ${arrow} ${sec.label}
          </td>
        </tr>`;
        if (collapsed) return hdr;

        const daySeries = cols.filter(c => c.type === 'day');

        const rows = sec.rows.map(m => {
            const sparkVals = daySeries.map(c => (c.data && c.data[m.key]) || 0);
            const spark = m.isPlan ? '' : _sparkline(sparkVals);

            const cells = cols.map((col, ci) => {
                const d = col.data;
                const isWeek = col.type === 'week';
                const isToday = col.isToday;
                const isMonthStart = ci === firstDayIdx;
                const cls = [isToday?'rnp-cell-today':'', isMonthStart?'rnp-cell-month-start':''].filter(Boolean).join(' ');

                if (m.isPlan) {
                    const pv = _planVal(art, m.key, col.colKey);
                    return `<td class="${cls} rnp-cell-plan" style="padding:1px 2px">
                      <input type="number" min="0" step="any" class="rnp-plan-input" value="${pv}"
                        placeholder="—" title="План — заполните вручную"
                        onchange="RNP.savePlan(${art.nm_id},'${m.key}','${col.colKey}',this.value)">
                    </td>`;
                }

                const val = d ? d[m.key] : null;
                const str = _fmt(val, m.type);
                const cc  = m.hm ? _cellColor(val, m.hm) : (m.cl === 'plan' ? _cellColor(val, 'plan') : '');
                let bg = isWeek ? 'rnp-cell-week' : '';
                if (cc === 'rnp-green')  bg = 'background:rgba(16,185,129,0.15)';
                else if (cc === 'rnp-yellow') bg = 'background:rgba(245,158,11,0.15)';
                else if (cc === 'rnp-red')    bg = 'background:rgba(239,68,68,0.15)';
                const txtColor = cc === 'rnp-green' ? 'var(--green)'
                               : cc === 'rnp-yellow' ? 'var(--amber)'
                               : cc === 'rnp-red' ? 'var(--red)'
                               : m.bold ? 'var(--text-primary)' : 'var(--text-secondary)';
                return `<td class="${cls}" style="${bg?bg+';':''}color:${txtColor};font-weight:${m.bold?700:400}">${str||'—'}</td>`;
            }).join('');
            return `<tr>
              <td class="rnp-metric-col" style="font-weight:${m.bold?700:400};font-style:${m.isPlan?'italic':'normal'}">
                ${m.label}${m.isPlan?' <span style="opacity:0.5;font-size:9px">✏</span>':''}${m.src==='manual'&&!m.isPlan?' <span style="opacity:0.35;font-size:9px">✏</span>':''}${m.src==='promo'?' <span style="opacity:0.35;font-size:9px">📣</span>':''}
              </td>
              <td class="rnp-spark-col">${spark}</td>${cells}
            </tr>`;
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
        await _renderActiveTable();
    }

    async function syncArts() {
        const btn = document.getElementById('rnp-sync-btn');
        if (btn) btn.textContent = '⏳ Загрузка...';
        await _syncFromOrders();
        _renderSettings();
    }

    async function toggleArt(nmId) {
        const art = _articles.find(a => a.nm_id == nmId);
        if (!art) return;
        await _updateArticle(nmId, { is_active: !art.is_active });
        _renderSettings();
    }

    async function enableAll(on) {
        for (const a of _articles) {
            if (a.is_active !== on) await _updateArticle(a.nm_id, { is_active: on });
        }
        _renderSettings();
    }

    async function setCost(nmId, val) {
        await _updateArticle(nmId, { cost_price: parseFloat(val) || 0 });
    }

    async function savePlan(nmId, key, colKey, val) {
        const art = _articles.find(a => a.nm_id == nmId);
        if (!art) return;
        const md = { ...(art.manual_data || {}) };
        if (!md.plans) md.plans = {};
        if (!md.plans[colKey]) md.plans[colKey] = {};
        const num = val === '' ? null : (parseFloat(val) || 0);
        if (num === null) delete md.plans[colKey][key];
        else md.plans[colKey][key] = num;
        await _updateArticle(nmId, { manual_data: md });
        if (_activeNm == nmId) await _renderActiveTable();
    }

    async function saveManual(nmId, key, val) {
        const art = _articles.find(a => a.nm_id == nmId);
        if (!art) return;
        const manual_data = { ...(art.manual_data || {}), [key]: parseFloat(val) || 0 };
        await _updateArticle(nmId, { manual_data });
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

        await _syncToday(nmId);
        if (btn) btn.textContent = '⏳ Заказы...';
        await _syncOrdersHistory(nmId);

        if (_callProxy) {
            if (btn) btn.textContent = '⏳ Воронка...';
            await _syncFunnelHistory(nmId, (n, total) => {
                if (btn) btn.textContent = `⏳ Воронка ${n}/${total}...`;
            }).catch(e => console.warn('[RNP] funnel skipped:', e.message));
            if (btn) btn.textContent = '⏳ Финансы...';
            await _syncFinanceRange(nmId);
            if (btn) btn.textContent = '⏳ Реклама...';
            await _syncAdStats(nmId).catch(e => console.warn('[RNP] ads skipped:', e.message));
        }

        _invalidateCache(nmId);
        await _loadDailyData(nmId);
        await _loadAllStocks([nmId]);
        if (_activeNm == nmId) await _renderActiveTable();
        if (btn) { btn.textContent = '✓ Готово'; setTimeout(() => { btn.disabled = false; btn.textContent = '↻ Обновить'; }, 2000); }
    }

    async function refreshAll() {
        const btn = document.getElementById('rnp-refresh-all-btn');
        const active = _articles.filter(a => a.is_active);
        if (!active.length) return;
        if (btn) { btn.disabled = true; btn.textContent = '⏳ 0/' + active.length; }

        for (let i = 0; i < active.length; i++) {
            const a = active[i];
            if (btn) btn.textContent = `⏳ ${i+1}/${active.length}: ${(a.name||a.nm_id).substring(0,15)}...`;
            await refresh(a.nm_id);
        }

        _invalidateCache();
        await _loadAllDailyData(active.map(a => a.nm_id));
        await _loadAllStocks(active.map(a => a.nm_id));
        await _renderActiveTable();
        if (btn) { btn.textContent = '✓ Все обновлено'; setTimeout(() => { btn.disabled = false; btn.textContent = '↻ Обновить все'; }, 2500); }
    }

    async function toggleSection(nmId, sectionId) {
        const key = `${nmId}:${sectionId}`;
        if (_collapsedSections.has(key)) _collapsedSections.delete(key);
        else _collapsedSections.add(key);
        if (_activeNm == nmId) await _renderActiveTable();
    }

    return { init, openSettings, openMain, pick, syncArts, toggleArt, enableAll, setCost, saveManual, savePlan, saveRate, savePeriod, savePromo, refresh, refreshAll, toggleSection, imgFallback,
             syncFinance: _syncFinanceRange, syncAds: _syncAdStats };
})();

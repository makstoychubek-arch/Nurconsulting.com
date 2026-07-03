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
    let _settings = {
        exchangeRate: 13.5,
        calcPeriod: 7,
        usdRate: 87.5,
        defaultPlanPeriod: 'week',
        monthFrom: 6,
        monthTo: 12,
        showGiveaways: true,
        showCompetitor: true,
    };
    let _articles = [];
    let _activeNm = null;
    let _collapsedSections = new Set();
    let _financeCache = { key: '', rows: [], ts: 0 };
    let _dataCache = {}; // nmId -> { date -> row }
    let _stockCache = {}; // nmId -> { size -> { wh, transit } }

    const SIZE_ORDER = ['XXS','XS','S','M','L','XL','XXL','2XL','3XL','4XL','5XL'];
    const ALL_SIZES = ['XXS','XS','S','M','L','XL','XXL','2XL','3XL','4XL','5XL'];
    const GALLERY_SIZE = 6;
    const GALLERY_DEFAULT_COMMENTS = ['', 'Нестабильно', 'СВЕРХ-КОСТЮМ', 'Рекламная таблица', 'Размерная сетка', 'Выход в прибыль'];
    const PLAN_KEYS = ['plan_orders','plan_sales','plan_impressions','plan_clicks','plan_drr','plan_ad_spend'];
    const SUMMARY_TAB = 'summary';
    const VIEW_PRESETS = {
        all: null,
        sales_finance: new Set(['sales', 'finance', 'result']),
        compact: new Set(['sales', 'result']),
    };

    let _userEmail = '';
    let _compareNm = null;
    let _sectionView = 'all';
    let _notesCache = {}; // nmId -> date -> { text, history[] }
    let _strategyTab = 0;
    let _notesVisible = true;
    let _galleryCollapsed = true;
    let _marqueeRo = null;
    let _planPeriod = 'week';

    const FROZEN_METRIC_W = 132;
    const FROZEN_SPARK_W = 40;
    const FROZEN_COL_W = 38;
    const DAY_COL_W = 30;
    const MONTH_COL_W = 68;
    const MONTH_SHORT = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
    const CAL_MONTH_FROM = 5;  // июнь (0-based)
    const CAL_MONTH_TO = 11;   // декабрь

    /** Поля, которые в Google Sheets РНП заполняются вручную */
    const MANUAL_RNP_FIELDS = [
        { key: 'plans', label: 'Планы (заказы, продажи, показы, клики, ДРР, расход РК)', locked: true },
        { key: 'giveaways', label: 'Раздачи', setting: 'showGiveaways' },
        { key: 'competitor', label: 'Показатели конкурентов (CTR, корзина, заказы, CR0)', setting: 'showCompetitor' },
        { key: 'cost_price', label: 'Себестоимость за ед.', locked: true },
        { key: 'in_production', label: 'В пошиве (размерная сетка)', locked: true },
        { key: 'meta', label: 'Ответственный и статус артикула', locked: true },
        { key: 'notes', label: 'Комментарии под датами / месяцами', locked: true },
        { key: 'gallery', label: 'Комментарии к фото тестов', locked: true },
    ];
    const GALLERY_PHOTO_COUNT = 12;

    const STRATEGY_TABS = [
        { label: 'Комментарий', galleryIdx: 0 },
        { label: 'Нестабильно', galleryIdx: 1 },
        { label: 'СВЕРХ-КОСТЮМ (Локомотив)', galleryIdx: 2 },
        { label: 'Рекламная таб.', galleryIdx: 3 },
        { label: 'Размерная сетка', galleryIdx: 4 },
        { label: 'Выход в прибыль', galleryIdx: 5 },
    ];

    // ─── SECTIONS & METRICS ──────────────────────────────────────────────────
    const SECTIONS = [
        { id: 'sales', label: '', noHeader: true, color: '#217346', rows: [
            { key: 'orders_count',       label: 'ЗАКАЗЫ',                           type: 'int', src: 'auto',   bold: true, hero: true },
            { key: 'plan_orders',        label: 'План заказ',                       type: 'int', src: 'manual', isPlan: true },
            { key: 'spp_pct',            label: 'СПП %',                            type: 'pct', src: 'auto' },
            { key: 'sales_count',        label: 'Продажи',                          type: 'int', src: 'auto',   bold: true },
            { key: 'plan_sales',         label: 'План продаж',                      type: 'int', src: 'manual', isPlan: true },
            { key: 'avg_check',          label: 'СР. Чек',                          type: 'som', src: 'auto' },
            { key: 'giveaways',          label: 'Раздачи',                          type: 'int', src: 'manual' },
            { key: 'plan_fulfillment_pct', label: 'Процент выполнения плана',       type: 'pct', src: 'calc',   cl: 'planStrong', bold: true },
            { key: 'plan_orders_pct',    label: 'Выпол. плана ЗАКАЗ, шт %',        type: 'pct', src: 'calc',   cl: 'plan' },
            { key: 'plan_sales_pct',     label: 'Выпол. плана ПРОДАЖИ %',           type: 'pct', src: 'calc',   cl: 'plan' },
        ]},
        { id: 'cash', label: 'Сумма продаж в кассе', color: '#1a73e8', rows: [
            { key: 'orders_sum',         label: 'Сумма Заказов',                    type: 'som', src: 'auto' },
            { key: 'sales_sum',          label: 'Сумма Продаж',                     type: 'som', src: 'auto' },
        ]},
        { id: 'funnel', label: 'Показатели воронки Общие', color: '#f59e0b', rows: [
            { key: 'impressions',        label: 'Показы',                           type: 'int',  src: 'promo' },
            { key: 'organic_imp_pct',    label: 'Процент органики показов',         type: 'pct',  src: 'calc' },
            { key: 'plan_impressions',   label: 'План Показов',                     type: 'int',  src: 'manual', isPlan: true },
            { key: 'clicks',             label: 'Клики',                            type: 'int',  src: 'promo' },
            { key: 'ctr_pct',            label: 'CTR%',                             type: 'pct2', src: 'promo' },
            { key: 'basket_pct',         label: 'Корзина%',                         type: 'pct2', src: 'promo' },
            { key: 'competitor_basket',  label: '% Корзина конкурентов',            type: 'pct2', src: 'manual', competitor: true },
            { key: 'basket_count',       label: 'Корзина',                          type: 'int',  src: 'promo' },
            { key: 'orders_conv_pct',    label: 'Заказы%',                          type: 'pct2', src: 'calc' },
            { key: 'competitor_orders',  label: '% Заказов конкурентов',            type: 'pct2', src: 'manual', competitor: true },
            { key: 'cro_pct',            label: 'CR0 %',                            type: 'pct2', src: 'calc' },
            { key: 'competitor_cro',   label: '% CR0 конкурентов',                type: 'pct2', src: 'manual', competitor: true },
        ]},
        { id: 'ads', label: 'Показатели воронки Рекламы', color: '#8b5cf6', rows: [
            { key: 'ad_impressions',     label: 'Показы с рк',                      type: 'int',  src: 'promo' },
            { key: 'ad_imp_pct',         label: 'Процент показов с Рекламы',        type: 'pct',  src: 'calc' },
            { key: 'ad_clicks',          label: 'Клики РК',                         type: 'int',  src: 'promo' },
            { key: 'plan_clicks',        label: 'План Кликов из РК',                type: 'int',  src: 'manual', isPlan: true },
            { key: 'ad_ctr',             label: 'CTR % РК',                         type: 'pct2', src: 'promo' },
            { key: 'competitor_ctr',     label: '% CTR Конкурентов',                type: 'pct2', src: 'manual', competitor: true },
            { key: 'ad_cro',             label: 'CR0 РК%',                          type: 'pct2', src: 'promo' },
            { key: 'ad_cpc',             label: 'Стоимость Клика',                  type: 'som',  src: 'promo' },
            { key: 'ad_basket',          label: 'Корзин с РК',                      type: 'int',  src: 'promo' },
            { key: 'ad_orders',          label: 'Заказов с РК',                     type: 'int',  src: 'promo' },
        ]},
        { id: 'adspend', label: 'Доля Рекламных Расходов', color: '#ef4444', rows: [
            { key: 'ad_spend',           label: 'Расход РК (пополнение)',           type: 'som',  src: 'promo' },
            { key: 'plan_ad_spend',      label: 'Расход План',                      type: 'som',  src: 'manual', isPlan: true },
            { key: 'plan_drr',           label: 'ДРР % План',                       type: 'pct',  src: 'manual', isPlan: true },
            { key: 'drr_pct',            label: 'ДРР %',                            type: 'pct',  src: 'calc',  hm: 'low' },
        ]},
        { id: 'finance', label: 'Физ. показатели', color: '#06b6d4', rows: [
            { key: 'sales_count',        label: 'Продаж, шт',                       type: 'int',  src: 'auto' },
            { key: 'sales_sum',          label: 'Сумма продаж',                     type: 'som',  src: 'auto' },
            { key: 'avg_check_sales',    label: 'Средний чек',                      type: 'som',  src: 'auto' },
            { key: 'return_pct',         label: 'Процент возврата %',               type: 'pct',  src: 'auto',  hm: 'low' },
            { key: 'buyout_pct',         label: 'Процент выкупа%',                  type: 'pct',  src: 'auto',  hm: 'high' },
            { key: 'ad_spend',           label: 'Расход РК ком',                    type: 'som',  src: 'promo' },
            { key: 'logistics_per_unit', label: 'Логистика на ед',                  type: 'som',  src: 'auto',  hm: 'low' },
            { key: 'logistics_pct',      label: 'Логистика %',                      type: 'pct',  src: 'auto',  hm: 'low' },
            { key: 'storage_pct',        label: 'Хранение %',                       type: 'pct',  src: 'auto',  hm: 'low' },
            { key: 'wb_share_pct',       label: 'Все допы ВБ + ДРР %',              type: 'pct',  src: 'calc',  hm: 'low' },
        ]},
        { id: 'result', label: 'Финансовый итог по дням', color: '#84cc16', rows: [
            { key: 'to_transfer',        label: 'К перечислению',                   type: 'som',  src: 'auto' },
            { key: 'to_transfer_unit',   label: 'К перечислению на ед',             type: 'som',  src: 'auto' },
            { key: 'cost_price_val',     label: 'Себестоимость',                    type: 'som',  src: 'settings' },
            { key: 'profit',             label: 'Прибыль',                          type: 'som',  src: 'calc',  bold: true, hm: 'profit' },
            { key: 'profit_per_unit',    label: 'Прибыль на 1 ед',                  type: 'som',  src: 'calc',  bold: true },
            { key: 'margin_pct',         label: 'Маржинальность %',                 type: 'pct',  src: 'calc',  bold: true, hm: 'margin' },
            { key: 'roi_pct',            label: 'Рентабельность %',                 type: 'pct',  src: 'calc',  bold: true },
        ]},
    ];

    function _normSize(raw) {
        const s = (raw || '').trim().toUpperCase();
        if (!s || s === '—') return '—';
        if (s === 'ONE SIZE' || s === 'OS' || s === 'UNIVERSAL') return 'ONE';
        return s;
    }

    function _nrDialog(title, text, type = 'warning') {
        if (typeof window.showNrDialog === 'function') window.showNrDialog(type, title, text);
        else alert(text || title);
    }
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

    const _photoResolveCache = {};
    const _photoIndexCache = {};  // nmId -> { 2: url, 3: url, ... }
    const _galleryPhotosCache = {}; // nmId -> [url, url, ...] (photos 2+)
    const _basketCache = {};

    const _PHOTO_PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="100" viewBox="0 0 80 100"><rect fill="%23e8e8ec" width="80" height="100"/><text x="40" y="52" text-anchor="middle" fill="%23999" font-size="10" font-family="sans-serif">WB</text></svg>'
    );

    function _photoMeta(nmId) {
        const vol  = Math.floor(nmId / 100000);
        const part = Math.floor(nmId / 1000);
        const basket = _basketCache[nmId] || _basketNum(vol);
        const basketStr = String(Math.max(1, basket)).padStart(2, '0');
        return { vol, part, basket, basketStr };
    }

    function _photoUrls(nmId, size = 'c516x688', photoIndex = 1, basketOverride) {
        const { vol, part, basket, basketStr } = _photoMeta(nmId);
        const b = basketOverride || basket;
        const bStr = String(Math.max(1, b)).padStart(2, '0');
        const urls = [];
        const idx = Math.max(1, Math.min(15, photoIndex || 1));
        const sizes = size === 'c246x328'
            ? ['c246x328', 'tm', 'big']
            : ['c516x688', 'big', 'tm', 'c246x328'];
        const exts = ['webp', 'jpg'];
        [bStr, basketStr].forEach(bs => {
            sizes.forEach(s => {
                exts.forEach(ext => {
                    urls.push(`https://basket-${bs}.wbbasket.ru/vol${vol}/part${part}/${nmId}/images/${s}/${idx}.${ext}`);
                });
            });
        });
        return [...new Set(urls)];
    }

    function _photoUrl(nmId, size = 'c516x688', photoIndex = 1) {
        return _photoUrls(nmId, size, photoIndex)[0];
    }

    async function _resolveBasketProbe(nmId) {
        if (_basketCache[nmId]) return _basketCache[nmId];
        const vol = Math.floor(nmId / 100000);
        const part = Math.floor(nmId / 1000);
        const guess = _basketNum(vol);
        const candidates = [guess];
        for (let d = 1; d <= 3; d++) {
            if (guess + d <= 45) candidates.push(guess + d);
            if (guess - d >= 1) candidates.push(guess - d);
        }
        for (let i = 0; i < candidates.length; i += 4) {
            const batch = candidates.slice(i, i + 4);
            const hits = await Promise.all(batch.map(async b => {
                const bs = String(b).padStart(2, '0');
                const url = `https://basket-${bs}.wbbasket.ru/vol${vol}/part${part}/${nmId}/images/c246x328/1.webp`;
                const ok = await _probePhoto(url);
                return ok ? b : null;
            }));
            const hit = hits.find(Boolean);
            if (hit) {
                _basketCache[nmId] = hit;
                return hit;
            }
        }
        _basketCache[nmId] = guess;
        return guess;
    }

    async function _resolvePhotoUrl(nmId, size = 'c246x328') {
        if (_photoResolveCache[nmId]) return _photoResolveCache[nmId];
        await _resolveBasketProbe(nmId);
        const hit = await _probePhotoParallel(_photoUrls(nmId, size, 1).slice(0, 6), 4);
        if (hit) _photoResolveCache[nmId] = hit;
        return hit;
    }

    function _rnpRoot() {
        return document.getElementById('rnp-workspace') || document;
    }

    function _refreshTabsAfterPhotos() {
        const tabsEl = document.getElementById('rnp-sheet-tabs');
        if (!tabsEl) return;
        const active = _articles.filter(a => a.is_active);
        tabsEl.innerHTML = _renderTabsHTML(active);
        _updateTabHighlight();
    }

    function _applyResolvedPhotos(root) {
        const scope = root || _rnpRoot();
        scope.querySelectorAll('img[data-nmid]').forEach(img => {
            const id = Number(img.dataset.nmid);
            const idx = parseInt(img.dataset.photo || '1', 10);
            let url = null;
            if (idx === 1) url = _photoResolveCache[id];
            else url = _photoIndexCache[id]?.[idx] || _galleryPhotosCache[id]?.[idx - 2];
            if (url && img.src !== url) img.src = url;
        });
    }

    function _isTrustedPhotoUrl(url) {
        if (!url?.startsWith('http') || url.includes('placeholder')) return false;
        if (url.includes('wb.ru/') && !url.includes('wbbasket.ru')) return false;
        return true;
    }

    async function _probePhoto(url) {
        if (!url) return null;
        return new Promise(resolve => {
            const img = new Image();
            img.referrerPolicy = 'no-referrer';
            img.onload = () => resolve(url);
            img.onerror = () => resolve(null);
            img.src = url;
        });
    }

    function _storeCardGalleryExtras(p, id) {
        if (!id || !Array.isArray(p.photos) || p.photos.length < 2) return;
        const extras = [];
        p.photos.forEach((ph, i) => {
            if (i === 0) return;
            let pu = typeof ph === 'string' ? ph : (ph.big || ph.c516x688 || ph.c246x328 || ph.tm);
            if (pu?.startsWith('//')) pu = 'https:' + pu;
            if (pu) extras.push(pu);
        });
        if (!extras.length) return;
        _galleryPhotosCache[id] = extras;
        if (!_photoIndexCache[id]) _photoIndexCache[id] = {};
        extras.forEach((pu, i) => { _photoIndexCache[id][i + 2] = pu; });
    }

    async function _fetchCardPhoto(nmId) {
        await _fetchPhotosViaProxy([nmId]);
        if (_photoResolveCache[nmId]) return _photoResolveCache[nmId];
        await _resolveBasketProbe(nmId);
        return _resolvePhotoUrl(nmId);
    }

    async function _fetchCardPhotosBatch(nmIds) {
        const ids = [...new Set(nmIds.map(Number).filter(Boolean))];
        if (!ids.length) return;
        await _fetchPhotosViaProxy(ids);
        const stillMissing = ids.filter(id => !_photoResolveCache[id]).slice(0, 12);
        const concurrency = 3;
        for (let i = 0; i < stillMissing.length; i += concurrency) {
            const batch = stillMissing.slice(i, i + concurrency);
            await Promise.all(batch.map(async nmId => {
                await _resolveBasketProbe(nmId);
                const hit = await _resolvePhotoUrl(nmId);
                if (hit) _photoResolveCache[nmId] = hit;
            }));
        }
    }

    async function _fetchPhotosViaProxy(nmIds) {
        if (!_callProxy || !nmIds.length) return;
        const slice = nmIds.slice(0, 100);
        try {
            const data = await _callProxy('product_photos', { nmIds: slice });
            if (data && typeof data === 'object') {
                Object.entries(data).forEach(([id, url]) => {
                    if (url) _photoResolveCache[Number(id)] = String(url);
                });
            }
        } catch (e) { console.warn('[RNP] product_photos proxy:', e.message); }
        try {
            const resp = await _callProxy('content_cards', { nmIds: slice, limit: slice.length, withPhoto: -1 });
            const cards = resp?.cards || resp?.data?.cards || [];
            cards.forEach(card => {
                const id = Number(card.nmID ?? card.nmId ?? 0);
                if (!id || !Array.isArray(card.photos) || !card.photos.length) return;
                const first = card.photos[0];
                let url = typeof first === 'string' ? first : (first?.big || first?.c516x688 || first?.c246x328 || first?.tm);
                if (url?.startsWith('//')) url = 'https:' + url;
                if (url) _photoResolveCache[id] = url;
                _storeCardGalleryExtras(card, id);
            });
        } catch (e) { console.warn('[RNP] content_cards photos:', e.message); }
    }

    async function _probePhotoParallel(urls, concurrency = 6) {
        const list = urls.filter(Boolean);
        for (let i = 0; i < list.length; i += concurrency) {
            const batch = list.slice(i, i + concurrency);
            const results = await Promise.all(batch.map(u => _probePhoto(u)));
            const hit = results.find(Boolean);
            if (hit) return hit;
        }
        return null;
    }

    async function _preloadPhotos(articles) {
        if (!articles?.length) return;
        articles.forEach(a => {
            const u = a.photo_url;
            if (_isTrustedPhotoUrl(u) && !u.includes('wbbasket.ru')) {
                _photoResolveCache[a.nm_id] = u;
            }
        });
        const missing = articles.filter(a => !_photoResolveCache[a.nm_id]).map(a => a.nm_id);
        if (!missing.length) return;
        await _fetchPhotosViaProxy(missing);
        const stillMissing = missing.filter(id => !_photoResolveCache[id]);
        if (stillMissing.length) await _fetchCardPhotosBatch(stillMissing);
        const persist = stillMissing
            .filter(id => _photoResolveCache[id])
            .map(nm_id => ({ nm_id, photo_url: _photoResolveCache[nm_id] }));
        if (_db && _cab && persist.length) {
            await Promise.all(persist.map(p =>
                _db.from('rnp_articles').update({ photo_url: p.photo_url })
                    .eq('cabinet_id', _cab).eq('nm_id', p.nm_id)
            ));
            persist.forEach(p => {
                const art = articles.find(a => a.nm_id === p.nm_id);
                if (art) art.photo_url = p.photo_url;
            });
        }
        _applyResolvedPhotos();
    }

    async function _preloadGalleryPhotos(nmId) {
        if (_galleryPhotosCache[nmId]?.length) return;
        await _fetchCardPhotosBatch([nmId]);
        if (_galleryPhotosCache[nmId]?.length) return;
        await _resolveBasketProbe(nmId);
        const extras = [];
        if (!_photoIndexCache[nmId]) _photoIndexCache[nmId] = {};
        for (let idx = 2; idx <= 15; idx++) {
            const hit = await _probePhotoParallel(_photoUrls(nmId, 'c246x328', idx).slice(0, 12), 6);
            if (hit) {
                extras.push(hit);
                _photoIndexCache[nmId][idx] = hit;
            } else if (idx > 4 && extras.length) break;
        }
        if (extras.length) _galleryPhotosCache[nmId] = extras;
    }

    async function _ensurePhoto(art) {
        if (!art?.nm_id) return;
        if (_photoResolveCache[art.nm_id]) {
            art.photo_url = _photoResolveCache[art.nm_id];
            return;
        }
        if (art.photo_url?.startsWith('http') && _isTrustedPhotoUrl(art.photo_url) && !art.photo_url.includes('wbbasket.ru')) {
            _photoResolveCache[art.nm_id] = art.photo_url;
            return;
        }
        await _fetchPhotosViaProxy([art.nm_id]);
        if (_photoResolveCache[art.nm_id]) {
            art.photo_url = _photoResolveCache[art.nm_id];
            if (_db && _cab) {
                _db.from('rnp_articles').update({ photo_url: art.photo_url })
                    .eq('cabinet_id', _cab).eq('nm_id', art.nm_id).then(() => {});
            }
            return;
        }
        await _fetchCardPhotosBatch([art.nm_id]);
        if (_photoResolveCache[art.nm_id]) {
            art.photo_url = _photoResolveCache[art.nm_id];
            if (_db && _cab) {
                _db.from('rnp_articles').update({ photo_url: art.photo_url })
                    .eq('cabinet_id', _cab).eq('nm_id', art.nm_id).then(() => {});
            }
            return;
        }
        const cardUrl = await _fetchCardPhoto(art.nm_id);
        if (cardUrl) {
            _photoResolveCache[art.nm_id] = cardUrl;
            art.photo_url = cardUrl;
            if (_db && _cab) {
                _db.from('rnp_articles').update({ photo_url: cardUrl })
                    .eq('cabinet_id', _cab).eq('nm_id', art.nm_id).then(() => {});
            }
            return;
        }
        const hit = await _resolvePhotoUrl(art.nm_id, 'c516x688');
        if (hit) art.photo_url = hit;
    }

    function _imgHtml(art, className, size = 'c516x688', extraStyle = '', photoIndex = 1, eager = false) {
        const nmId = art.nm_id;
        const meta = _photoMeta(nmId);
        const idx = Math.max(1, photoIndex || 1);
        let cached = null;
        if (idx === 1) {
            cached = _photoResolveCache[nmId]
                || (_isTrustedPhotoUrl(art.photo_url) && !String(art.photo_url).includes('wbbasket.ru')
                    ? art.photo_url : null);
        } else {
            cached = _photoIndexCache[nmId]?.[idx]
                || _galleryPhotosCache[nmId]?.[idx - 2]
                || null;
        }
        const src = cached || _PHOTO_PLACEHOLDER;
        const cls = className ? ` class="${className}"` : '';
        const sty = extraStyle ? ` style="${extraStyle}"` : '';
        const urls = _photoUrls(nmId, size, idx).slice(0, 6).join('|');
        const loading = eager ? 'eager' : 'lazy';
        return `<img${cls}${sty} src="${src}" referrerpolicy="no-referrer" loading="${loading}" alt=""
          data-nmid="${nmId}" data-vol="${meta.vol}" data-part="${meta.part}" data-basket="${meta.basket}" data-size="${size}" data-photo="${idx}"
          data-urls="${urls}"
          onerror="RNP.imgFallback(this)">`;
    }

    function imgFallback(img) {
        const attempt = parseInt(img.dataset.attempt || '0', 10) + 1;
        img.dataset.attempt = String(attempt);
        const queue = (img.dataset.urls || '').split('|').filter(Boolean);
        if (attempt <= queue.length) {
            img.src = queue[attempt - 1];
            return;
        }
        const nmId = img.dataset.nmid;
        const vol = img.dataset.vol;
        const part = img.dataset.part;
        const photoIdx = img.dataset.photo || '1';
        const size = img.dataset.size || 'c246x328';
        const base = parseInt(img.dataset.basket || '1', 10);
        const offsets = [0, 1, -1, 2];
        const offIdx = attempt - queue.length - 1;
        if (offIdx < offsets.length) {
            const b = String(Math.max(1, Math.min(45, base + offsets[offIdx]))).padStart(2, '0');
            img.src = `https://basket-${b}.wbbasket.ru/vol${vol}/part${part}/${nmId}/images/${size}/${photoIdx}.webp`;
            return;
        }
        img.onerror = null;
        img.classList.add('rnp-photo-fail');
        img.src = _PHOTO_PLACEHOLDER;
    }

    // ─── SETTINGS ─────────────────────────────────────────────────────────────
    function _normalizeOptions(raw) {
        const o = raw && typeof raw === 'object' ? raw : {};
        return {
            usdRate: Number(o.usdRate) > 0 ? Number(o.usdRate) : 87.5,
            defaultPlanPeriod: o.defaultPlanPeriod === 'month' ? 'month' : 'week',
            monthFrom: Math.min(12, Math.max(1, parseInt(o.monthFrom, 10) || 6)),
            monthTo: Math.min(12, Math.max(1, parseInt(o.monthTo, 10) || 12)),
            showGiveaways: o.showGiveaways !== false,
            showCompetitor: o.showCompetitor !== false,
        };
    }

    function _settingsOptions() {
        return {
            usdRate: _settings.usdRate,
            defaultPlanPeriod: _settings.defaultPlanPeriod,
            monthFrom: _settings.monthFrom,
            monthTo: _settings.monthTo,
            showGiveaways: _settings.showGiveaways,
            showCompetitor: _settings.showCompetitor,
        };
    }

    function _sellerArticle(art) {
        const sa = String(art?.manual_data?.seller_article || art?.manual_data?.sa_name || '').trim();
        if (sa) return sa;
        const name = String(art?.name || '').trim();
        if (name && !/^артикул\s+\d+$/i.test(name)) return name;
        return String(art?.nm_id || '—');
    }

    function _extractSellerArticle(d) {
        if (!d || typeof d !== 'object') return '';
        const keys = ['supplierArticle', 'supplier_article', 'sa_name', 'vendorCode', 'vendor_code', 'supplierVendorCode', 'article'];
        for (const k of keys) {
            const v = d[k];
            if (v != null && String(v).trim()) return String(v).trim();
        }
        return '';
    }

    async function _fetchSellerArticlesFromContentApi(nmIds) {
        const map = new Map();
        const ids = [...new Set(nmIds.map(Number).filter(Boolean))];
        if (!_callProxy || !ids.length) return map;
        for (let i = 0; i < ids.length; i += 100) {
            const chunk = ids.slice(i, i + 100);
            try {
                const resp = await _callProxy('content_cards', { nmIds: chunk, limit: chunk.length });
                const cards = resp?.cards || resp?.data?.cards || [];
                cards.forEach(card => {
                    const id = Number(card.nmID || card.nmId);
                    const sa = _extractSellerArticle(card);
                    if (id && sa) map.set(id, sa);
                });
            } catch (e) { console.warn('[RNP] content_cards seller:', e.message); }
        }
        return map;
    }

    function _orderSellerArticle(order) {
        return _extractSellerArticle(order?.data) || _extractSellerArticle(order);
    }

    async function _fetchSellerArticlesFromCards(nmIds) {
        return _fetchSellerArticlesFromContentApi(nmIds);
    }

    async function _backfillSellerArticlesFromDb() {
        if (!_cab || !_articles.length) return;
        const map = new Map();
        const nmIds = _articles.map(a => a.nm_id);

        const contentMap = await _fetchSellerArticlesFromContentApi(nmIds);
        contentMap.forEach((sa, id) => map.set(id, sa));

        try {
            const { data: orders } = await _db.from('wb_orders')
                .select('nm_id, data')
                .eq('cabinet_id', _cab)
                .not('nm_id', 'is', null);
            (orders || []).forEach(o => {
                if (map.has(Number(o.nm_id))) return;
                const sa = _orderSellerArticle(o);
                if (sa && o.nm_id) map.set(Number(o.nm_id), sa);
            });
        } catch (e) { console.warn('[RNP] seller_article orders:', e.message); }

        const missing = _articles.filter(a => !map.has(Number(a.nm_id))).map(a => a.nm_id);
        if (missing.length) {
            const cardMap = await _fetchSellerArticlesFromCards(missing);
            cardMap.forEach((sa, id) => map.set(id, sa));
        }

        for (const art of _articles) {
            const sa = map.get(Number(art.nm_id));
            if (!sa) continue;
            if (art.manual_data?.seller_article === sa && art.name === sa) continue;
            const md = { ...(art.manual_data || {}), seller_article: sa };
            await _updateArticle(art.nm_id, { manual_data: md, name: sa });
        }
    }

    function _sectionRows(sec) {
        return sec.rows.filter(m => {
            if (m.key === 'giveaways' && !_settings.showGiveaways) return false;
            if (m.competitor && !_settings.showCompetitor) return false;
            return true;
        });
    }

    function _sortBySeller(a, b) {
        return _sellerArticle(a).localeCompare(_sellerArticle(b), 'ru', { sensitivity: 'base' });
    }

    async function _loadSettings() {
        try {
            const { data } = await _db.from('rnp_settings').select('*').eq('cabinet_id', _cab).maybeSingle();
            if (data) {
                _settings = {
                    ..._settings,
                    exchangeRate: data.exchange_rate || 13.5,
                    calcPeriod: data.calc_period || 7,
                    promotionToken: data.promotion_api_token || '',
                    ..._normalizeOptions(data.options),
                };
            }
        } catch(e) { console.warn('[RNP] settings load:', e.message); }
    }

    async function _saveSettings(updates) {
        if (updates.exchangeRate !== undefined) _settings.exchangeRate = updates.exchangeRate;
        if (updates.calcPeriod !== undefined) _settings.calcPeriod = updates.calcPeriod;
        if (updates.promotionToken !== undefined) _settings.promotionToken = updates.promotionToken;
        if (updates.options) Object.assign(_settings, _normalizeOptions({ ..._settingsOptions(), ...updates.options }));
        try {
            await _db.from('rnp_settings').upsert({
                cabinet_id: _cab,
                exchange_rate: _settings.exchangeRate,
                calc_period: _settings.calcPeriod,
                promotion_api_token: _settings.promotionToken,
                options: _settingsOptions(),
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
                .select('nm_id, data')
                .eq('cabinet_id', _cab)
                .not('nm_id', 'is', null);
            if (error) throw error;
            if (!orders?.length) { _nrDialog('Нет данных', 'Сначала загрузите данные кабинета на вкладке Оцифровка → Дашборд.', 'warning'); return; }
            const uniq = new Map();
            orders.forEach(o => {
                const nm = o.nm_id;
                if (!nm) return;
                const sa = _orderSellerArticle(o);
                const subject = String(o.data?.subject || o.data?.brand || '').trim();
                const prev = uniq.get(nm) || { sa: '', subject: '' };
                if (sa) prev.sa = sa;
                if (subject && !prev.subject) prev.subject = subject;
                uniq.set(nm, prev);
            });
            for (const [nmId, meta] of uniq) {
                const existing = _articles.find(a => a.nm_id == nmId);
                const md = { ...(existing?.manual_data || {}) };
                if (meta.sa) md.seller_article = meta.sa;
                const displayName = meta.sa || meta.subject || md.seller_article || `Артикул ${nmId}`;
                if (!existing) {
                    await _db.from('rnp_articles').upsert({
                        cabinet_id: _cab, nm_id: nmId, name: displayName,
                        photo_url: _photoUrl(nmId), is_active: false, cost_price: 0,
                        manual_data: md,
                    }, { onConflict: 'cabinet_id,nm_id', ignoreDuplicates: true });
                } else if (meta.sa) {
                    await _updateArticle(nmId, { manual_data: md, name: displayName });
                }
            }
            await _loadArticles();
            await _backfillSellerArticlesFromDb();
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
        return _planPeriod === 'month' ? _buildMonthCalendar(today) : _buildWeekCalendar(today);
    }

    function _calAllDates(cal) {
        if (cal.mode === 'month') return (cal.months || []).flatMap(m => m.dates);
        return [...cal.weeks.flatMap(w => w.dates), ...cal.days.map(d => d.date)];
    }

    function _calTimelineSpan(cal) {
        if (cal.mode === 'month') return cal.months?.length || 0;
        return cal.days.length;
    }

    function _buildWeekCalendar(today) {
        const Y = today.getFullYear();
        const M = today.getMonth();

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
                    wk.label = _weekLabel(wk.dates, weeks.length + 1);
                    wk.weekStart = wk.dates[0];
                    wk.weekNum = weeks.length + 1;
                    weeks.push(wk);
                }
                wk = { type: 'week', label: '', dates: [], weekStart: _dateStr(prevY, prevM + 1, d) };
            }
            wk.dates.push(_dateStr(prevY, prevM + 1, d));
        }
        if (wk?.dates.length) {
            wk.label = _weekLabel(wk.dates, weeks.length + 1);
            wk.weekStart = wk.dates[0];
            wk.weekNum = weeks.length + 1;
            weeks.push(wk);
        }

        const currName = today.toLocaleString('ru', { month: 'long', year: 'numeric' });
        const currDaysInMonth = new Date(Y, M + 1, 0).getDate();
        const todayMid = new Date(Y, M, today.getDate());
        const days = [];
        for (let d = 1; d <= currDaysInMonth; d++) {
            const date = _dateStr(Y, M + 1, d);
            const dt = new Date(Y, M, d);
            const dd = String(d).padStart(2, '0');
            const mm = String(M + 1).padStart(2, '0');
            days.push({
                type: 'day', date,
                label: `${dd}.${mm}`,
                dow: dt.toLocaleString('ru', { weekday: 'short' }),
                isToday: d === today.getDate(),
                isFuture: dt > todayMid
            });
        }

        return { mode: 'week', prevName, weeks, currName, days, todayStr: _dateStr(Y, M + 1, today.getDate()) };
    }

    function _buildMonthCalendar(today) {
        const Y = today.getFullYear();
        const todayM = today.getMonth();
        const fromM = Math.min(_settings.monthFrom, _settings.monthTo) - 1;
        const toM = Math.max(_settings.monthFrom, _settings.monthTo) - 1;
        const fromLabel = MONTH_SHORT[fromM] || '';
        const toLabel = MONTH_SHORT[toM] || '';
        const months = [];
        for (let m = fromM; m <= toM; m++) {
            const daysInMonth = new Date(Y, m + 1, 0).getDate();
            const dates = [];
            for (let d = 1; d <= daysInMonth; d++) dates.push(_dateStr(Y, m + 1, d));
            months.push({
                type: 'month',
                month: m + 1,
                year: Y,
                colKey: `${Y}-${String(m + 1).padStart(2, '0')}`,
                date: dates[0],
                label: MONTH_SHORT[m],
                fullName: new Date(Y, m, 1).toLocaleString('ru', { month: 'long' }),
                dayCount: daysInMonth,
                dates,
                isCurrent: todayM === m && today.getFullYear() === Y,
                isFuture: new Date(Y, m, 1) > new Date(Y, todayM, 1),
            });
        }
        return {
            mode: 'month',
            year: Y,
            rangeLabel: `${Y} · ${fromLabel} — ${toLabel}`,
            months,
            quarters: [
                { label: 'II кв.', span: 1 },
                { label: 'III кв.', span: 3 },
                { label: 'IV кв.', span: 3 },
            ],
            weeks: [],
            days: [],
            prevName: '',
            currName: '',
            todayStr: _dateStr(Y, todayM + 1, today.getDate()),
        };
    }

    function _dateStr(y, m, d) {
        return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    }

    function _localDateStr(d) {
        return _dateStr(d.getFullYear(), d.getMonth() + 1, d.getDate());
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
                from: _localDateStr(cur),
                to: _localDateStr(chunkEnd),
            });
            cur = new Date(chunkEnd);
            cur.setDate(cur.getDate() + 1);
        }
        return chunks;
    }

    function _weekLabel(dates, weekNum) {
        if (weekNum) return `Нед ${weekNum}`;
        const fmtD = ds => { const p = ds.split('-'); return p[2]; };
        const fmtDM = ds => { const p = ds.split('-'); return `${p[2]}.${p[1]}`; };
        if (dates.length === 1) return fmtDM(dates[0]);
        return `${fmtD(dates[0])}–${fmtDM(dates[dates.length - 1])}`;
    }

    function _buildCols(rawData, art, cal) {
        if (cal.mode === 'month') {
            const allDates = cal.months.flatMap(m => m.dates);
            const totalCol = {
                type: 'total', colKey: 'ytd-total', label: 'ИТОГ',
                data: _applyColPlans(_derive(_aggWeek(rawData, allDates), art), art, 'ytd-total'),
            };
            const monthCols = cal.months.map(m => {
                const agg = _derive(_aggWeek(rawData, m.dates), art);
                return { ...m, data: _applyColPlans(agg, art, m.colKey) };
            });
            return [totalCol, ...monthCols];
        }
        const weekCols = cal.weeks.map(w => {
            const colKey = w.weekStart || w.dates[0];
            const agg = _derive(_aggWeek(rawData, w.dates), art);
            return { ...w, colKey, data: _applyColPlans(agg, art, colKey) };
        });
        const allPrevDates = cal.weeks.flatMap(w => w.dates);
        const totalCol = allPrevDates.length ? {
            type: 'total', colKey: 'prev-total', label: 'ИТОГ',
            data: _applyColPlans(_derive(_aggWeek(rawData, allPrevDates), art), art, 'prev-total'),
        } : null;
        const dayCols = cal.days.map(d => {
            const derived = _derive(rawData[d.date] || null, art);
            return { ...d, colKey: d.date, data: _applyColPlans(derived, art, d.date) };
        });
        return totalCol ? [...weekCols, totalCol, ...dayCols] : [...weekCols, ...dayCols];
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
                const size = _normSize(s.tech_size || s.techSize || s.size || '');
                if (size === '—') return;
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
        if (cal.mode === 'month') {
            const cur = cal.months.find(m => m.isCurrent)
                || [...cal.months].reverse().find(m => !m.isFuture)
                || cal.months[0];
            if (!cur) return {};
            const dates = cur.dates.filter(d => d <= cal.todayStr);
            const agg = _aggWeek(rawData, dates.length ? dates : cur.dates);
            return _applyColPlans(_derive(agg, art), art, cur.colKey);
        }
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
        if (type === 'int') return Math.round(n).toLocaleString('ru');
        return String(n);
    }

    function _sparkline(values, w = 36, h = 14) {
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
        return `<svg class="rnp-spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline fill="none" stroke="var(--green)" stroke-width="1.5" points="${pts}"/></svg>`;
    }

    function _getSize(bySize, sz) {
        const n = _normSize(sz);
        if (bySize[sz]) return bySize[sz];
        if (bySize[n]) return bySize[n];
        const key = Object.keys(bySize).find(k => _normSize(k) === n);
        return key ? bySize[key] : { wh: 0, transit: 0 };
    }

    function _sizeCellCls(total) {
        return (Number(total) || 0) > 0 ? 'rnp-size-has' : 'rnp-size-zero';
    }

    function _buildStockSizeHTML(bySize, art) {
        const merged = {};
        Object.entries(bySize).forEach(([k, v]) => {
            const nk = _normSize(k);
            if (nk === '—') return;
            if (!merged[nk]) merged[nk] = { wh: 0, transit: 0 };
            merged[nk].wh += v.wh;
            merged[nk].transit += v.transit;
        });
        const extra = Object.keys(merged).filter(s => !ALL_SIZES.includes(s) && s !== 'ONE');
        const sizes = [...ALL_SIZES, ...extra.sort(_sortSizes)];
        const inProd = Number(art?.manual_data?.in_production) || 0;

        const cell = (sz, v) => {
            const n = Number(v) || 0;
            return `<td class="${_sizeCellCls(n)}">${n > 0 ? n : 0}</td>`;
        };
        const hdrCell = (sz) => {
            const x = _getSize(merged, sz);
            const t = x.wh + x.transit;
            return `<th class="${_sizeCellCls(t)}">${sz}</th>`;
        };
        const row = (label, rowCls, fn) => {
            const cells = sizes.map(sz => cell(sz, fn(_getSize(merged, sz))));
            const total = sizes.reduce((s, sz) => s + fn(_getSize(merged, sz)), 0);
            return `<tr class="${rowCls}"><td class="rnp-stock-label">${label}</td>${cells.join('')}<td class="${_sizeCellCls(total)}" style="font-weight:800">${total}</td></tr>`;
        };
        const prodCells = sizes.map(() => `<td class="rnp-size-zero">0</td>`).join('');
        const prodRow = `<tr class="rnp-row-prod"><td class="rnp-stock-label">В пошиве</td>${prodCells}<td class="${_sizeCellCls(inProd)}" style="font-weight:800">${inProd}</td></tr>`;

        return `<div class="rnp-stock-block">
          <table class="rnp-stock-table">
            <thead><tr>
              <th class="rnp-stock-label"></th>
              ${sizes.map(hdrCell).join('')}
              <th>Σ</th>
            </tr></thead>
            <tbody>
              ${row('На складе', 'rnp-row-wh', x => x.wh)}
              ${row('В пути', 'rnp-row-tr', x => x.transit)}
              ${row('Общий', 'rnp-row-sum', x => x.wh + x.transit)}
              ${prodRow}
            </tbody>
          </table>
        </div>`;
    }

    function _weekStartStr(dateStr) {
        const d = new Date(dateStr + 'T12:00:00');
        const day = d.getDay();
        const diff = day === 0 ? 6 : day - 1;
        d.setDate(d.getDate() - diff);
        return d.toISOString().split('T')[0];
    }

    function _sectionsForView() {
        const allowed = VIEW_PRESETS[_sectionView];
        if (!allowed) return SECTIONS;
        return SECTIONS.filter(s => allowed.has(s.id));
    }

    function _syncStatus(nmId) {
        const map = _dataCache[nmId] || {};
        const dates = Object.keys(map).sort();
        if (!dates.length) return { level: 'red', label: 'Нет данных' };
        let latestTs = 0;
        let hasOrders = false, hasAds = false, hasFunnel = false;
        dates.forEach(d => {
            const r = map[d];
            if (r.orders_count > 0) hasOrders = true;
            if (r.ad_impressions > 0 || r.ad_spend > 0) hasAds = true;
            if (r.impressions > 0 || r.clicks > 0) hasFunnel = true;
            if (r.updated_at) latestTs = Math.max(latestTs, new Date(r.updated_at).getTime());
        });
        const hours = latestTs ? (Date.now() - latestTs) / 3600000 : 999;
        if (hours > 48 || !hasOrders) return { level: 'red', label: 'Обновить' };
        if (hours > 24 || !hasAds || !hasFunnel) return { level: 'yellow', label: 'Частично' };
        return { level: 'green', label: 'Актуально' };
    }

    function _syncDot(level) {
        return `<span class="rnp-sync-dot rnp-sync-${level}" title="${level}"></span>`;
    }

    function _buildAlerts(art, stockBySize, kpi) {
        const alerts = [];
        const planDrr = kpi.plan_drr || 0;
        if (planDrr > 0 && (kpi.drr_pct || 0) > planDrr) {
            alerts.push({ type: 'warn', text: `ДРР ${(kpi.drr_pct || 0).toFixed(1)}% > плана ${planDrr}%` });
        } else if ((kpi.drr_pct || 0) > 20) {
            alerts.push({ type: 'warn', text: `ДРР ${(kpi.drr_pct || 0).toFixed(1)}%` });
        }
        ['M', 'S', 'L'].forEach(sz => {
            const x = _getSize(stockBySize, sz);
            if ((x.wh + x.transit) === 0) alerts.push({ type: 'danger', text: `${sz} = 0` });
        });
        if (kpi.plan_orders_pct > 0 && kpi.plan_orders_pct < 80) {
            alerts.push({ type: 'warn', text: `План заказов ${kpi.plan_orders_pct.toFixed(0)}%` });
        }
        if ((kpi.profit || 0) < 0) alerts.push({ type: 'danger', text: 'Убыток' });
        if ((kpi.margin_pct || 0) > 0 && kpi.margin_pct < 10) {
            alerts.push({ type: 'warn', text: `Маржа ${kpi.margin_pct.toFixed(1)}%` });
        }
        return alerts;
    }

    function _alertsHTML(alerts) {
        if (!alerts.length) return '';
        return `<div class="rnp-alerts">${alerts.map(a =>
            `<span class="rnp-alert rnp-alert-${a.type}">${a.text}</span>`).join('')}</div>`;
    }

    async function _loadNotes(nmIds) {
        if (!nmIds.length) return;
        nmIds.forEach(id => { if (!_notesCache[id]) _notesCache[id] = {}; });
        try {
            const cal = _buildCalendar();
            const allDates = _calAllDates(cal);
            const from = allDates[0];
            const to = allDates[allDates.length - 1];
            if (!from || !to) return;
            const { data, error } = await _db.from('rnp_date_notes')
                .select('*').eq('cabinet_id', _cab).in('nm_id', nmIds)
                .gte('note_date', from).lte('note_date', to)
                .order('created_at', { ascending: false });
            if (error) throw error;
            (data || []).forEach(row => {
                const nm = row.nm_id;
                const d = row.note_date;
                if (!_notesCache[nm][d]) _notesCache[nm][d] = { text: '', history: [] };
                const entry = { text: row.note, author: row.author || '—', at: row.created_at };
                _notesCache[nm][d].history.push(entry);
                if (!_notesCache[nm][d].text) _notesCache[nm][d].text = row.note;
            });
        } catch (e) {
            console.warn('[RNP] notes from DB, fallback manual_data:', e.message);
            nmIds.forEach(nmId => {
                const art = _articles.find(a => a.nm_id == nmId);
                const notes = art?.manual_data?.notes || {};
                Object.entries(notes).forEach(([d, v]) => {
                    _notesCache[nmId][d] = typeof v === 'string'
                        ? { text: v, history: [{ text: v, author: '—', at: '' }] }
                        : v;
                });
            });
        }
    }

    function _noteTip(nmId, date) {
        const h = _notesCache[nmId]?.[date]?.history || [];
        if (!h.length) return '';
        return h.slice(0, 5).map(x => {
            const when = x.at ? new Date(x.at).toLocaleString('ru') : '';
            return `${x.text} (${x.author}${when ? ', ' + when : ''})`;
        }).join('\n');
    }

    async function saveNote(nmId, date, text) {
        const t = (text || '').trim();
        const art = _articles.find(a => a.nm_id == nmId);
        if (!art) return;
        if (!t) return;
        try {
            await _db.from('rnp_date_notes').insert({
                cabinet_id: _cab, nm_id: nmId, note_date: date,
                note: t, author: _userEmail || 'user'
            });
        } catch (e) {
            const md = { ...(art.manual_data || {}) };
            if (!md.notes) md.notes = {};
            const prev = md.notes[date];
            const history = (prev?.history || []).slice();
            history.unshift({ text: t, author: _userEmail || '—', at: new Date().toISOString() });
            md.notes[date] = { text: t, history };
            await _updateArticle(nmId, { manual_data: md });
        }
        if (!_notesCache[nmId]) _notesCache[nmId] = {};
        const hist = _notesCache[nmId][date]?.history || [];
        hist.unshift({ text: t, author: _userEmail || '—', at: new Date().toISOString() });
        _notesCache[nmId][date] = { text: t, history: hist };
    }

    function _leftFrozenSpan(cal) {
        if (cal.mode === 'month') return 3;
        return 2 + cal.weeks.length + (cal.weeks.length ? 1 : 0);
    }

    function _timelinePeriods(art, cal) {
        const saved = art?.manual_data?.strategy_timeline;
        if (Array.isArray(saved) && saved.length) {
            return saved.map((p, i) => ({
                galleryIdx: p.galleryIdx ?? p.idx ?? i,
                label: (p.label || '').trim(),
                from: p.from || p.start || p.date,
                to: p.to || p.end || p.from || p.date,
            })).filter(p => p.from);
        }
        const slots = _gallerySlots(art);
        const idxMap = [1, 2, 3, 4, 5];
        if (cal.mode === 'month') {
            const months = cal.months || [];
            if (!months.length) return [];
            const bounds = [[0, 0], [1, 1], [2, 2], [3, 4], [5, 6]];
            return bounds.map(([a, b], i) => ({
                galleryIdx: idxMap[i] ?? i,
                label: (slots[idxMap[i]]?.comment || STRATEGY_TABS[idxMap[i]]?.label || '').trim(),
                from: months[Math.min(a, months.length - 1)]?.colKey,
                to: months[Math.min(b, months.length - 1)]?.colKey,
            })).filter(p => p.from && p.label);
        }
        const days = cal.days;
        if (!days.length) return [];
        const n = days.length;
        const bounds = [
            [0, Math.min(10, n - 1)],
            [Math.min(11, n - 1), Math.min(14, n - 1)],
            [Math.min(15, n - 1), Math.min(19, n - 1)],
            [Math.min(20, n - 1), Math.min(24, n - 1)],
            [Math.min(25, n - 1), n - 1],
        ];
        return bounds.map(([a, b], i) => ({
            galleryIdx: idxMap[i] ?? i,
            label: (slots[idxMap[i]]?.comment || STRATEGY_TABS[idxMap[i]]?.label || '').trim(),
            from: days[Math.min(a, n - 1)]?.date,
            to: days[Math.min(b, n - 1)]?.date,
        })).filter(p => p.from && p.label && p.from <= p.to);
    }

    function _buildDaySpanCells(cal, periods, renderSpan, renderGap) {
        const parts = [];
        let i = 0;
        while (i < cal.days.length) {
            const date = cal.days[i].date;
            const period = periods.find(p => p.from && date >= p.from && date <= p.to);
            if (period && date === period.from) {
                let endIdx = i;
                while (endIdx < cal.days.length && cal.days[endIdx].date <= period.to) endIdx++;
                parts.push(renderSpan(period, endIdx - i, i));
                i = endIdx;
            } else {
                parts.push(renderGap(cal.days[i], i));
                i++;
            }
        }
        return parts.join('');
    }

    function _buildTestCardHTML(art, period) {
        const gi = period.galleryIdx ?? 0;
        const photoIdx = gi + 2;
        const label = (period.label || '').replace(/"/g, '&quot;');
        const img = _imgHtml(art, 'rnp-test-img', 'c516x688', '', photoIdx, true);
        return `<div class="rnp-test-card" data-gallery-idx="${gi}" data-photo-idx="${photoIdx}" title="${label}">
          <div class="rnp-test-photo">${img}</div>
        </div>`;
    }

    function _buildMarqueeHTML(art, cal) {
        const periods = _timelinePeriods(art, cal);
        if (!periods.length) return '<div class="rnp-marquee-empty">—</div>';
        const cards = periods.map(p => _buildTestCardHTML(art, p)).join('');
        return `<div class="rnp-marquee-wrap">
          <div class="rnp-marquee-track">${cards}</div>
        </div>`;
    }

    function _buildLeftPanelHTML(art, stockBySize, rawData, cal) {
        return `<div class="rnp-head-left-stack">
          ${_buildKpiTopHTML(art, stockBySize, rawData, cal)}
          <div class="rnp-head-sizes-inline">${_buildStockSizeHTML(stockBySize, art)}</div>
        </div>`;
    }

    function _buildSheetHeadRows(art, stockBySize, rawData, cal) {
        const leftSpan = _leftFrozenSpan(cal);
        const nTimeline = _calTimelineSpan(cal);

        return `
            <tr class="rnp-head-panel">
              <th colspan="${leftSpan}" class="rnp-head-left">${_buildLeftPanelHTML(art, stockBySize, rawData, cal)}</th>
              <th colspan="${nTimeline}" class="rnp-head-marquee">${_buildMarqueeHTML(art, cal)}</th>
            </tr>`;
    }

    function _frozenLeft(ci, cols) {
        const col = cols[ci];
        if (!col) return null;
        const base = FROZEN_METRIC_W + FROZEN_SPARK_W;
        if (col.type === 'week') {
            const wi = cols.slice(0, ci).filter(c => c.type === 'week').length;
            return base + wi * FROZEN_COL_W;
        }
        if (col.type === 'total') {
            const weekCount = cols.filter(c => c.type === 'week').length;
            if (!weekCount && cols[0]?.type === 'total') return base;
            return base + weekCount * FROZEN_COL_W;
        }
        return null;
    }

    function _stickyColAttrs(ci, cols, zBody = 11, zHead = 28) {
        const left = _frozenLeft(ci, cols);
        if (left == null) return { cls: '', style: '' };
        const isTotal = cols[ci]?.type === 'total';
        return {
            cls: ` rnp-col-sticky${isTotal ? ' rnp-col-sticky-total' : ''}`,
            style: `left:${left}px;z-index:${zHead}`,
        };
    }

    function _stickyDataAttrs(ci, cols) {
        const left = _frozenLeft(ci, cols);
        if (left == null) return { cls: '', style: '' };
        const isTotal = cols[ci]?.type === 'total';
        return {
            cls: ` rnp-col-sticky${isTotal ? ' rnp-col-sticky-total' : ''}`,
            style: `left:${left}px;z-index:11`,
        };
    }

    function _buildNotesHeadCells(cols, art) {
        const nmId = art.nm_id;
        return cols.map((col, ci) => {
            const d = col.date || col.colKey || col.weekStart;
            const text = (_notesCache[nmId]?.[d]?.text || '').replace(/"/g, '&quot;');
            const tip = _noteTip(nmId, d).replace(/"/g, '&quot;');
            const st = _stickyColAttrs(ci, cols, 11, 27);
            const colCls = col.type === 'day' ? 'rnp-day-col' : 'rnp-data-col';
            return `<th class="rnp-th-note ${colCls}${st.cls}"${st.style ? ` style="${st.style}"` : ''}>
              <input class="rnp-note-input" value="${text}" title="${tip || 'Комментарий к дате'}"
                placeholder="+"
                onblur="RNP.saveNote(${nmId},'${d}',this.value)">
            </th>`;
        }).join('');
    }

    function _buildActionBar(active) {
        const compareOpts = active.filter(a => a.nm_id != _activeNm && _activeNm !== SUMMARY_TAB)
            .map(a => `<option value="${a.nm_id}"${_compareNm == a.nm_id ? ' selected' : ''}>${_sellerArticle(a).substring(0, 24)}</option>`).join('');
        return `<div class="rnp-action-bar">
          <select onchange="RNP.setView(this.value)" title="Секции таблицы">
            <option value="all"${_sectionView === 'all' ? ' selected' : ''}>Все секции</option>
            <option value="sales_finance"${_sectionView === 'sales_finance' ? ' selected' : ''}>Заказы + Финансы</option>
            <option value="compact"${_sectionView === 'compact' ? ' selected' : ''}>Компакт</option>
          </select>
          <select title="Период планирования" onchange="RNP.setPlanPeriod(this.value)">
            <option value="week"${_planPeriod === 'week' ? ' selected' : ''}>План → неделя</option>
            <option value="month"${_planPeriod === 'month' ? ' selected' : ''}>План → месяц</option>
          </select>
          <button type="button" class="rnp-action-btn" onclick="RNP.copyPlanFromPrevWeek()" title="${_planPeriod === 'month' ? 'Скопировать план с прошлого месяца' : 'Скопировать план с прошлой недели'}">↵ План</button>
          <select id="rnp-compare-sel" onchange="RNP.setCompare(this.value)" title="Сравнить с…" ${_activeNm === SUMMARY_TAB ? 'disabled' : ''}>
            <option value="">Сравнить с…</option>${compareOpts}
          </select>
          <button type="button" class="rnp-action-btn${_compareNm ? ' active' : ''}" onclick="RNP.toggleCompare()" ${_activeNm === SUMMARY_TAB ? 'disabled' : ''} title="Режим A/B">А/Б тест</button>
          <button type="button" class="rnp-action-btn" onclick="RNP.exportExcel()">Excel</button>
          <label class="rnp-notes-toggle" title="Строка комментариев под датами">
            <input type="checkbox"${_notesVisible ? ' checked' : ''} onchange="RNP.toggleNotes(this.checked)">
            Комментарии под датами
          </label>
        </div>`;
    }

    function _buildSummaryHTML(active, cal) {
        const rows = active.map(a => {
            const raw = _dataCache[a.nm_id] || {};
            const kpi = _periodSummary(a, raw, cal);
            const st = _syncStatus(a.nm_id);
            const stock = _stockCache[a.nm_id] || {};
            const alerts = _buildAlerts(a, stock, kpi);
            const planCls = (kpi.plan_orders_pct || 0) >= 100 ? 'var(--green)' : (kpi.plan_orders_pct || 0) < 80 ? 'var(--red)' : 'var(--text-primary)';
            const profitCls = (kpi.profit || 0) >= 0 ? 'var(--green)' : 'var(--red)';
            return `<tr class="rnp-summary-row" onclick="RNP.pick(${a.nm_id})" title="WB ${a.nm_id}">
              <td>${_syncDot(st.level)}</td>
              <td>${_imgHtml(a, '', 'c246x328', 'width:28px;height:36px;border-radius:3px;object-fit:cover')}</td>
              <td class="rnp-summary-name">${_sellerArticle(a)}</td>
              <td style="color:var(--text-muted)">${a.nm_id}</td>
              <td>${Math.round(kpi.orders_count || 0)}</td>
              <td style="color:${planCls}">${kpi.plan_orders_pct ? kpi.plan_orders_pct.toFixed(0) + '%' : '—'}</td>
              <td style="color:${profitCls}">${Math.round(kpi.profit || 0).toLocaleString('ru')}</td>
              <td>${kpi.margin_pct ? kpi.margin_pct.toFixed(1) + '%' : '—'}</td>
              <td>${kpi.drr_pct ? kpi.drr_pct.toFixed(1) + '%' : '—'}</td>
              <td>${_stockTotals(stock).total}</td>
              <td>${alerts.length ? alerts.map(x => x.text).join('; ') : '—'}</td>
            </tr>`;
        }).join('');
        return `<div class="rnp-table-scroll" style="padding:8px">
          <table class="rnp-summary-table">
            <thead><tr>
              <th></th><th></th><th style="text-align:left">Товар</th><th>nmId</th>
              <th>Заказы</th><th>План%</th><th>Прибыль</th><th>Маржа</th><th>ДРР</th><th>Остаток</th><th>Алерты</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="font-size:10px;color:var(--text-muted);margin-top:8px">Клик по строке → открыть артикул</p>
        </div>`;
    }

    function _updateTabHighlight() {
        document.querySelectorAll('.rnp-sheet-tab').forEach(tab => {
            const onclick = tab.getAttribute('onclick') || '';
            const isSummary = onclick.includes("'summary'") || onclick.includes('"summary"');
            const nm = onclick.match(/pick\((\d+|'summary'|"summary")\)/)?.[1]?.replace(/['"]/g, '');
            const active = nm === String(_activeNm) || (nm === 'summary' && _activeNm === SUMMARY_TAB);
            tab.classList.toggle('active', active);
        });
    }

    function _renderTabsHTML(active) {
        const sumActive = _activeNm === SUMMARY_TAB;
        return `<div class="rnp-sheet-tab rnp-tab-summary${sumActive ? ' active' : ''}" onclick="RNP.pick('summary')">
            <span class="rnp-tab-icon">📊</span><span>Сводная</span>
          </div>
          ${[...active].sort(_sortBySeller).map(a => {
            const st = _syncStatus(a.nm_id);
            const label = _sellerArticle(a);
            return `<div class="rnp-sheet-tab${a.nm_id == _activeNm ? ' active' : ''}" onclick="RNP.pick(${a.nm_id})" title="WB ${a.nm_id}${a.name ? ' · ' + a.name : ''}">
              ${_syncDot(st.level)}${_imgHtml(a, 'rnp-tab-img', 'c246x328')}
              <span class="rnp-tab-label">${label.replace(/</g, '&lt;')}</span>
            </div>`;
          }).join('')}`;
    }

    function _csvCell(v) {
        const s = String(v ?? '').replace(/"/g, '""');
        return `"${s}"`;
    }

    function _downloadBlob(filename, content, mime) {
        const blob = new Blob([content], { type: mime });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    function exportExcel() {
        const cal = _buildCalendar();
        const sep = ';';
        const BOM = '\uFEFF';
        if (_activeNm === SUMMARY_TAB) {
            const active = _articles.filter(a => a.is_active);
            const header = ['Статус', 'Артикул продавца', 'Артикул WB', 'Заказы', 'План%', 'Прибыль', 'Маржа%', 'ДРР%', 'Остаток', 'Алерты'];
            const lines = [header.map(_csvCell).join(sep)];
            active.forEach(a => {
                const kpi = _periodSummary(a, _dataCache[a.nm_id] || {}, cal);
                const st = _syncStatus(a.nm_id);
                const alerts = _buildAlerts(a, _stockCache[a.nm_id] || {}, kpi);
                lines.push([
                    st.label, _sellerArticle(a), a.nm_id,
                    kpi.orders_count || 0, (kpi.plan_orders_pct || 0).toFixed(1),
                    Math.round(kpi.profit || 0), (kpi.margin_pct || 0).toFixed(1),
                    (kpi.drr_pct || 0).toFixed(1), _stockTotals(_stockCache[a.nm_id] || {}).total,
                    alerts.map(x => x.text).join(', ')
                ].map(_csvCell).join(sep));
            });
            _downloadBlob(`RNP_сводная_${cal.todayStr}.csv`, BOM + lines.join('\n'), 'text/csv;charset=utf-8');
            return;
        }
        const art = _articles.find(a => a.nm_id == _activeNm);
        if (!art) return;
        const raw = _dataCache[art.nm_id] || {};
        const cols = _buildCols(raw, art, cal);
        const header = ['Метрика', ...cols.map(c => c.label)];
        const lines = [header.map(_csvCell).join(sep)];
        _sectionsForView().forEach(sec => {
            lines.push([sec.label, ...cols.map(() => '')].map(_csvCell).join(sep));
            _sectionRows(sec).forEach(m => {
                const vals = cols.map(c => {
                    if (m.isPlan) return _planVal(art, m.key, c.colKey);
                    const v = c.data?.[m.key];
                    return v != null && v !== '' ? _fmt(v, m.type) || v : '';
                });
                lines.push([m.label, ...vals].map(_csvCell).join(sep));
            });
        });
        _downloadBlob(`RNP_${_sellerArticle(art)}_${cal.todayStr}.csv`, BOM + lines.join('\n'), 'text/csv;charset=utf-8');
    }

    async function copyPlanFromPrevWeek() {
        const art = _articles.find(a => a.nm_id == _activeNm);
        if (!art || _activeNm === SUMMARY_TAB) return;
        const cal = _buildCalendar();
        const md = { ...(art.manual_data || {}) };
        if (!md.plans) md.plans = {};

        if (cal.mode === 'month') {
            const cur = cal.months.find(m => m.isCurrent) || cal.months.filter(m => !m.isFuture).pop();
            if (!cur) return;
            const idx = cal.months.indexOf(cur);
            if (idx <= 0) {
                _nrDialog('План не найден', 'Нет предыдущего месяца для копирования.', 'info');
                return;
            }
            const prev = cal.months[idx - 1];
            const src = md.plans[prev.colKey] || {};
            if (!Object.keys(src).length) {
                _nrDialog('План не найден', `Нет плана за ${prev.fullName} — заполните вручную.`, 'info');
                return;
            }
            if (!md.plans[cur.colKey]) md.plans[cur.colKey] = {};
            PLAN_KEYS.forEach(k => { if (src[k] != null) md.plans[cur.colKey][k] = src[k]; });
            await _updateArticle(art.nm_id, { manual_data: md });
            await _renderActiveTable();
            return;
        }

        const curWs = _weekStartStr(cal.todayStr);
        const prevD = new Date(curWs + 'T12:00:00');
        prevD.setDate(prevD.getDate() - 7);
        const prevWs = prevD.toISOString().split('T')[0];
        let src = md.plans[prevWs] || {};
        if (!Object.keys(src).length && cal.weeks.length) {
            const lw = cal.weeks[cal.weeks.length - 1];
            src = md.plans[lw.weekStart || lw.dates[0]] || {};
        }
        if (!Object.keys(src).length) { _nrDialog('План не найден', 'Нет плана за прошлую неделю — заполните вручную или выберите другую неделю.', 'info'); return; }
        cal.days.filter(d => _weekStartStr(d.date) === curWs).forEach(d => {
            if (!md.plans[d.date]) md.plans[d.date] = {};
            PLAN_KEYS.forEach(k => { if (src[k] != null) md.plans[d.date][k] = src[k]; });
        });
        await _updateArticle(art.nm_id, { manual_data: md });
        await _renderActiveTable();
    }

    function setView(v) {
        _sectionView = v;
        try { localStorage.setItem('rnp_section_view', v); } catch (e) {}
        if (_activeNm !== SUMMARY_TAB) _renderActiveTable();
    }

    function setStrategyTab(idx) {
        _strategyTab = Number(idx) || 0;
        try { localStorage.setItem('rnp_strategy_tab', String(_strategyTab)); } catch (e) {}
        if (_activeNm !== SUMMARY_TAB) {
            _renderActiveTable();
            requestAnimationFrame(() => {
                const el = document.querySelector(`.rnp-test-card[data-gallery-idx="${STRATEGY_TABS[_strategyTab]?.galleryIdx ?? 0}"]`);
                el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            });
        }
    }

    function toggleNotes(on) {
        _notesVisible = !!on;
        try { localStorage.setItem('rnp_notes_visible', _notesVisible ? '1' : '0'); } catch (e) {}
        if (_activeNm !== SUMMARY_TAB) _renderActiveTable();
    }

    async function setPlanPeriod(val) {
        const next = val === 'month' ? 'month' : 'week';
        if (next === _planPeriod) return;
        _planPeriod = next;
        try { localStorage.setItem('rnp_plan_period', _planPeriod); } catch (e) {}
        _dataCache = {};
        const active = _articles.filter(a => a.is_active);
        await _loadAllDailyData(active.map(a => a.nm_id));
        await _renderActiveTable();
    }

    function setCompare(nmId) {
        _compareNm = nmId ? Number(nmId) : null;
        if (_activeNm !== SUMMARY_TAB) _renderActiveTable();
    }

    function toggleCompare() {
        if (_compareNm) _compareNm = null;
        else {
            const sel = document.getElementById('rnp-compare-sel');
            _compareNm = sel?.value ? Number(sel.value) : null;
        }
        if (_activeNm !== SUMMARY_TAB) _renderActiveTable();
    }

    function _gallerySlots(art) {
        const saved = art?.manual_data?.photo_gallery;
        if (Array.isArray(saved) && saved.length >= GALLERY_SIZE) {
            return saved.slice(0, GALLERY_SIZE).map((s, i) => ({
                comment: s.comment || '',
                large: i === 2 || !!s.large,
            }));
        }
        return Array.from({ length: GALLERY_SIZE }, (_, i) => ({
            comment: GALLERY_DEFAULT_COMMENTS[i] || '',
            large: i === 2,
        }));
    }

    function _buildPhotoGalleryHTML(art) {
        const slots = _gallerySlots(art);
        const nmId = art.nm_id;
        const activeIdx = STRATEGY_TABS[_strategyTab]?.galleryIdx ?? 0;
        return `<div class="rnp-gallery-scroll">
          ${Array.from({ length: GALLERY_PHOTO_COUNT }, (_, i) => {
            const slot = slots[i] || { comment: GALLERY_DEFAULT_COMMENTS[i] || '', large: i === 2 };
            const cls = (i === 2 || slot.large) ? ' rnp-gallery-item--lg' : '';
            const active = i === activeIdx ? ' rnp-gallery-item--active' : '';
            const comment = (slot.comment || '').replace(/"/g, '&quot;');
            const gray = (i === 2 || slot.large) ? '' : 'filter:grayscale(0.15) contrast(1.05);';
            const img = _imgHtml(art, 'rnp-gallery-img', 'c246x328', gray, i + 1);
            const commentField = i < GALLERY_SIZE
                ? `<input type="text" class="rnp-gallery-comment" value="${comment}" placeholder="комментарий"
                    title="Подпись под фото"
                    onblur="RNP.savePhotoComment(${nmId}, ${i}, this.value)">`
                : `<span class="rnp-gallery-num">#${i + 1}</span>`;
            return `<div class="rnp-gallery-item${cls}${active}" data-photo-idx="${i}">
              <div class="rnp-gallery-photo">${img}</div>
              ${commentField}
            </div>`;
          }).join('')}
        </div>`;
    }

    function _buildStrategyBar() {
        return `<div class="rnp-strategy-bar">
          ${STRATEGY_TABS.map((t, i) =>
            `<button type="button" class="rnp-strategy-tab${_strategyTab === i ? ' active' : ''}"
              onclick="RNP.setStrategyTab(${i})">${t.label}</button>`
          ).join('')}
        </div>`;
    }

    function _buildMediaPanel(art) {
        if (_strategyTab === 4 && _galleryCollapsed) return _buildStrategyBar();
        const collapsed = _galleryCollapsed;
        return `<div class="rnp-media-panel${collapsed ? ' is-collapsed' : ''}">
          <div class="rnp-media-panel-head">
            ${_buildStrategyBar()}
            <button type="button" class="rnp-gallery-toggle" onclick="RNP.toggleGalleryPanel()" title="${collapsed ? 'Развернуть фото' : 'Свернуть фото'}">
              ${collapsed ? '▸ Фото' : '▾ Свернуть'}
            </button>
          </div>
          ${collapsed ? '' : `<div class="rnp-gallery-strip">${_buildPhotoGalleryHTML(art)}</div>`}
        </div>`;
    }

    function toggleGalleryPanel() {
        _galleryCollapsed = !_galleryCollapsed;
        try { localStorage.setItem('rnp_gallery_collapsed', _galleryCollapsed ? '1' : '0'); } catch (e) {}
        if (_activeNm !== SUMMARY_TAB) _renderActiveTable();
    }

    function _buildKpiTopHTML(art, stockBySize, rawData, cal) {
        const kpi = _periodSummary(art, rawData, cal);
        const er = _settings.exchangeRate;
        const toTransferSom = Math.round((kpi.to_transfer || 0) * er);
        const costTotal = Math.round((kpi.sales_count || 0) * (art.cost_price || 0));
        const roiCls = (kpi.roi_pct || 0) >= 100 ? 'pos' : '';
        const marginCls = (kpi.margin_pct || 0) >= 15 ? 'pos' : ((kpi.margin_pct || 0) < 5 ? 'neg' : '');
        const profitCls = (kpi.profit || 0) >= 0 ? 'pos' : 'neg';
        const planCls = (kpi.plan_orders_pct || 0) >= 100 ? 'pos' : ((kpi.plan_orders_pct || 0) < 80 ? 'neg' : '');
        const syncSt = _syncStatus(art.nm_id);
        const moneySom = Math.round((kpi.sales_sum || 0) * er);
        const moneyUsd = moneySom > 0 ? (moneySom / (_settings.usdRate || 87.5)).toLocaleString('ru', { minimumFractionDigits: 1, maximumFractionDigits: 3 }) : '0';
        const seller = _sellerArticle(art).replace(/"/g, '&quot;');
        const prodName = (art.name || '—').replace(/"/g, '&quot;');

        return `<div class="rnp-kpi-block${_strategyTab === 4 ? ' rnp-kpi-block--sizes-focus' : ''}">
          <div class="rnp-kpi-top">
            <div class="rnp-gs-photo">${_imgHtml(art, 'rnp-gs-photo-img', 'c516x688')}</div>
            <div class="rnp-gs-name" title="${seller}">${_syncDot(syncSt.level)} ${seller}</div>
            <div class="rnp-gs-nmid"><span class="rnp-gs-lbl">артикул WB</span><b>${art.nm_id}</b></div>
            <div class="rnp-gs-cost">
              <span class="rnp-gs-lbl">себест.</span>
              <input type="number" class="rnp-gs-cost-input" value="${art.cost_price || 0}" min="0" step="1"
                title="Себестоимость за ед. (сом)"
                onchange="RNP.setCost(${art.nm_id}, this.value)">
            </div>
            <div class="rnp-gs-money-lbl">В деньгах</div>
            <div class="rnp-gs-money-val">${moneySom.toLocaleString('ru', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</div>
            <div class="rnp-gs-usd-lbl">В долларах</div>
            <div class="rnp-gs-usd-val">$${moneyUsd}</div>
            <div class="rnp-gs-kpis">
              <div class="rnp-kpi-grid rnp-kpi-grid--gs">
                <div class="rnp-kpi"><span>Рентабельность</span><b class="${roiCls}">${_fmtKpi(kpi.roi_pct, 'pct')}</b></div>
                <div class="rnp-kpi"><span>К перечислению</span><b>${toTransferSom.toLocaleString('ru')}</b></div>
                <div class="rnp-kpi"><span>ДРР %</span><b>${_fmtKpi(kpi.drr_pct, 'pct')}</b></div>
                <div class="rnp-kpi"><span>Маржа %</span><b class="${marginCls}">${_fmtKpi(kpi.margin_pct, 'pct')}</b></div>
                <div class="rnp-kpi"><span>Прибыль</span><b class="${profitCls}">${_fmtKpi(kpi.profit, 'som')}</b></div>
                <div class="rnp-kpi"><span>План заказ %</span><b class="${planCls}">${_fmtKpi(kpi.plan_orders_pct, 'pct')}</b></div>
                <div class="rnp-kpi"><span>CTR %</span><b>${_fmtKpi(kpi.ctr_pct, 'pct')}</b></div>
                <div class="rnp-kpi"><span>Показов</span><b>${_fmtKpi(kpi.impressions, 'int')}</b></div>
                <div class="rnp-kpi"><span>Логистика ед</span><b>${_fmtKpi(kpi.logistics_per_unit, 'som')}</b></div>
                <div class="rnp-kpi"><span>Выкуп %</span><b>${_fmtKpi(kpi.buyout_pct, 'pct')}</b></div>
                <div class="rnp-kpi"><span>CRO %</span><b>${_fmtKpi(kpi.cro_pct, 'pct')}</b></div>
                <div class="rnp-kpi"><span>Пр. Себес</span><b>${costTotal.toLocaleString('ru')}</b></div>
              </div>
            </div>
          </div>
        </div>`;
    }

    function _buildKpiPanelHTML(art, stockBySize, rawData, cal) {
        return `${_buildKpiTopHTML(art, stockBySize, rawData, cal)}
          <div class="rnp-kpi-sizes-row${_strategyTab === 4 ? ' rnp-kpi-sizes-row--focus' : ''}">${_buildStockSizeHTML(stockBySize, art)}</div>`;
    }

    function _buildTopPanelHTML(art, stockBySize, rawData, cal) {
        return _buildKpiPanelHTML(art, stockBySize, rawData, cal);
    }
    async function _loadDailyData(nmId) {
        if (_dataCache[nmId]) return _dataCache[nmId];
        const cal = _buildCalendar();
        const allDates = _calAllDates(cal);
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
        const allDates = _calAllDates(cal);
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
    // WB limit: only the last 7 days (no historical chunks without Jam CSV)
    async function _syncFunnelHistory(nmId, onProgress) {
        if (!_callProxy) return;
        const now = new Date();
        const rangeStart = new Date(now);
        rangeStart.setDate(rangeStart.getDate() - 6);
        const dateFrom = _localDateStr(rangeStart);
        const dateTo = _localDateStr(now);
        if (onProgress) onProgress(1, 1);

        let resp;
        try {
            resp = await _callProxy('sales_funnel_history', {
                dateFrom,
                dateTo,
                nmId,
                aggregationLevel: 'day',
            });
        } catch (e) {
            console.warn('[RNP] funnel error:', e.message);
            return;
        }
        if (!resp) return;

        const byDate = {};
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
                    clicks: opens,
                    ctr_pct: opens > 0 ? cart / opens * 100 : 0,
                    basket_count: cart,
                    basket_pct: Number(day.addToCartConversion || 0),
                    funnel_order_conv: Number(day.cartToOrderConversion || 0),
                };
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
                      'plan_impressions','plan_clicks','plan_drr','plan_ad_spend','competitor_basket','competitor_orders',
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
        d.plan_fulfillment_pct = (d.plan_orders_pct > 0 && d.plan_sales_pct > 0)
            ? (d.plan_orders_pct + d.plan_sales_pct) / 2
            : (d.plan_orders_pct || d.plan_sales_pct || 0);
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
        if (val === null || val === undefined || val === '') return null;
        const n = parseFloat(val);
        if (isNaN(n)) return null;
        if (n === 0 && type !== 'pct' && type !== 'pct2') return '0';
        switch (type) {
            case 'int':  return Math.round(n).toLocaleString('ru');
            case 'som':  return Math.round(n).toLocaleString('ru');
            case 'pct':  return n.toFixed(1).replace('.', ',') + '%';
            case 'pct2': return n.toFixed(2).replace('.', ',') + '%';
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
            case 'plan':
            case 'planStrong':
                return n >= 100 ? 'rnp-green' : n >= 80 ? 'rnp-yellow' : 'rnp-red';
        }
        return '';
    }

    // ─── RENDER SETTINGS ──────────────────────────────────────────────────────
    function _renderSettings() {
        const el = document.getElementById('tab-rnp-settings');
        if (!el) return;
        const monthOpts = (n, sel) => Array.from({ length: 12 }, (_, i) => {
            const m = i + 1;
            return `<option value="${m}"${m === sel ? ' selected' : ''}>${MONTH_SHORT[i]}</option>`;
        }).join('');
        const manualList = MANUAL_RNP_FIELDS.map(f => {
            const chk = f.setting
                ? `<label class="rnp-set-chk"><input type="checkbox" data-opt="${f.setting}"${_settings[f.setting] ? ' checked' : ''}> показывать</label>`
                : '<span class="rnp-set-lock">всегда</span>';
            return `<li><b>${f.label}</b> ${chk}</li>`;
        }).join('');
        el.innerHTML = `
        <div class="space-y-5">
          <div class="widget-card p-5">
            <h3 class="font-semibold mb-4 flex items-center gap-2" style="color:var(--text-primary)">Основные настройки</h3>
            <div class="flex flex-wrap gap-4 mb-4 text-xs" style="color:var(--text-muted)">
              <span>Активных: <b style="color:var(--text-primary)">${_articles.filter(a=>a.is_active).length}</b> / ${_articles.length}</span>
              <span>Курс: <b style="color:var(--text-primary)">1₽ = ${_settings.exchangeRate} сом</b></span>
              <span>$: <b style="color:var(--text-primary)">1$ = ${_settings.usdRate} сом</b></span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label class="text-xs font-semibold mb-1 block" style="color:var(--text-muted)">Курс ₽ → сом</label>
                <div class="flex gap-2">
                  <input id="rnp-rate" type="number" step="0.1" min="0.1" value="${_settings.exchangeRate}"
                    class="rounded-xl px-3 py-2 text-sm w-full" style="background:var(--surface);border:1px solid var(--border);color:var(--text-primary)">
                  <button onclick="RNP.saveRate()" class="px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap"
                    style="background:var(--accent-gradient);color:#fff">OK</button>
                </div>
              </div>
              <div>
                <label class="text-xs font-semibold mb-1 block" style="color:var(--text-muted)">Курс $ → сом (для KPI)</label>
                <input id="rnp-usd-rate" type="number" step="0.1" min="1" value="${_settings.usdRate}"
                  class="rounded-xl px-3 py-2 text-sm w-full" style="background:var(--surface);border:1px solid var(--border);color:var(--text-primary)">
              </div>
              <div>
                <label class="text-xs font-semibold mb-1 block" style="color:var(--text-muted)">Период расчёта метрик</label>
                <select id="rnp-period" onchange="RNP.savePeriod(this.value)"
                  class="rounded-xl px-3 py-2 text-sm w-full" style="background:var(--surface);border:1px solid var(--border);color:var(--text-primary)">
                  <option value="7" ${_settings.calcPeriod==7?'selected':''}>7 дней</option>
                  <option value="28" ${_settings.calcPeriod==28?'selected':''}>28 дней</option>
                </select>
              </div>
              <div>
                <label class="text-xs font-semibold mb-1 block" style="color:var(--text-muted)">План по умолчанию</label>
                <select id="rnp-default-plan" class="rounded-xl px-3 py-2 text-sm w-full" style="background:var(--surface);border:1px solid var(--border);color:var(--text-primary)">
                  <option value="week"${_settings.defaultPlanPeriod === 'week' ? ' selected' : ''}>Неделя</option>
                  <option value="month"${_settings.defaultPlanPeriod === 'month' ? ' selected' : ''}>Месяц</option>
                </select>
              </div>
              <div>
                <label class="text-xs font-semibold mb-1 block" style="color:var(--text-muted)">Месяцы в таблице (с — по)</label>
                <div class="flex gap-2">
                  <select id="rnp-month-from" class="rounded-xl px-2 py-2 text-sm flex-1" style="background:var(--surface);border:1px solid var(--border);color:var(--text-primary)">${monthOpts(6, _settings.monthFrom)}</select>
                  <select id="rnp-month-to" class="rounded-xl px-2 py-2 text-sm flex-1" style="background:var(--surface);border:1px solid var(--border);color:var(--text-primary)">${monthOpts(12, _settings.monthTo)}</select>
                </div>
              </div>
            </div>
            <button onclick="RNP.saveRnpOptions()" class="mt-4 px-4 py-2 rounded-xl text-xs font-bold"
              style="background:var(--accent-gradient);color:#fff">Сохранить параметры РНП</button>
          </div>

          <div class="widget-card p-5">
            <h3 class="font-semibold mb-2" style="color:var(--text-primary)">Ручные поля (как в Google Sheets)</h3>
            <p class="text-xs mb-3" style="color:var(--text-muted)">Планы, себестоимость, «В пошиве», ответственный и комментарии всегда доступны для ручного ввода. Остальное можно скрыть.</p>
            <ul class="rnp-manual-list text-xs" style="color:var(--text-secondary)">${manualList}</ul>
          </div>

          <div class="widget-card p-5" style="border-left:3px solid var(--green)">
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold" style="color:var(--text-primary)">Реклама подключена автоматически</span>
            </div>
            <p class="text-xs mt-2" style="color:var(--text-muted)">Показы, клики, CTR, ДРР — через токен кабинета WB.</p>
          </div>

          <div class="widget-card p-5">
            <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 class="font-semibold flex items-center gap-2" style="color:var(--text-primary)">
                Артикулы
                <span class="text-xs font-normal" style="color:var(--text-muted)">${_articles.filter(a=>a.is_active).length} / ${_articles.length} в РНП · артикул продавца из WB</span>
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
              <p class="text-sm">Нажмите «Из заказов» — подтянутся артикулы WB и <b>артикулы продавца</b> из заказов автоматически</p>
            </div>` : `
            <div style="overflow-x:auto;max-height:calc(100vh - 320px);overflow-y:auto">
              <table class="rnp-sheet-table" style="font-size:11px">
                <thead>
                  <tr>
                    <th class="rnp-th-metric" style="width:40px"></th>
                    <th style="min-width:120px">Артикул продавца <span style="font-weight:400;color:var(--text-muted)">(из WB)</span></th>
                    <th style="min-width:90px">Артикул WB</th>
                    <th class="rnp-th-metric">Название WB</th>
                    <th style="min-width:80px">Себест. (сом)</th>
                    <th style="min-width:60px">В РНП</th>
                  </tr>
                </thead>
                <tbody>
                  ${_articles.slice().sort(_sortBySeller).map(a => {
                    const sa = _sellerArticle(a).replace(/</g, '&lt;');
                    const auto = !!(a.manual_data?.seller_article);
                    return `
                  <tr>
                    <td>${_imgHtml(a, '', 'c246x328', 'width:32px;height:40px;border-radius:3px;object-fit:cover;display:block')}</td>
                    <td style="font-weight:600;color:var(--text-primary)">${sa || '—'}${auto ? ' <span style="color:var(--green);font-weight:400;font-size:10px">авто</span>' : ' <span style="color:var(--text-muted);font-weight:400;font-size:10px">(нет данных — Обновить на дашборде)</span>'}</td>
                    <td style="color:var(--text-muted)">${a.nm_id}</td>
                    <td class="rnp-metric-col" style="max-width:180px;overflow:hidden;text-overflow:ellipsis">${(a.name||'—').replace(/</g,'&lt;')}</td>
                    <td><input type="number" value="${a.cost_price||0}" min="0"
                      onchange="RNP.setCost(${a.nm_id},this.value)"
                      style="width:70px;padding:2px 4px;text-align:center;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text-primary);font-size:11px"></td>
                    <td><button onclick="RNP.toggleArt(${a.nm_id})" class="relative w-9 h-5 rounded-full"
                      style="background:${a.is_active?'var(--accent)':'var(--border)'}">
                      <span style="position:absolute;top:2px;left:${a.is_active?'18px':'2px'};width:16px;height:16px;border-radius:50%;background:#fff;transition:0.2s"></span>
                    </button></td>
                  </tr>`;
                  }).join('')}
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

        if (!_activeNm || (_activeNm !== SUMMARY_TAB && !active.find(a => a.nm_id == _activeNm))) {
            try {
                const saved = sessionStorage.getItem('rnp_active_nm');
                _activeNm = saved === SUMMARY_TAB || active.find(a => a.nm_id == saved) ? saved : SUMMARY_TAB;
                if (_activeNm !== SUMMARY_TAB) _activeNm = Number(_activeNm);
            } catch (e) { _activeNm = SUMMARY_TAB; }
        }

        el.innerHTML = `
        <div class="rnp-workspace">
          <div id="rnp-action-bar-wrap">${_buildActionBar(active)}</div>
          <div class="rnp-sheet-tabs" id="rnp-sheet-tabs">
            ${_renderTabsHTML(active)}
          </div>
          <div class="rnp-sheet-body" id="rnp-sheet-body">
            <div class="p-10 text-center" style="color:var(--text-muted)">
              <div style="width:24px;height:24px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 12px"></div>
              Загрузка...
            </div>
          </div>
        </div>`;

        try { _sectionView = localStorage.getItem('rnp_section_view') || 'all'; } catch (e) {}
        try { _notesVisible = localStorage.getItem('rnp_notes_visible') !== '0'; } catch (e) {}
        try { _strategyTab = parseInt(localStorage.getItem('rnp_strategy_tab') || '0', 10) || 0; } catch (e) {}
        try {
            const pp = localStorage.getItem('rnp_plan_period');
            _planPeriod = pp === 'month' ? 'month' : (pp === 'week' ? 'week' : (_settings.defaultPlanPeriod || 'week'));
        } catch (e) { _planPeriod = _settings.defaultPlanPeriod || 'week'; }
        try {
            const gc = localStorage.getItem('rnp_gallery_collapsed');
            _galleryCollapsed = gc === null ? false : gc === '1';
        } catch (e) {}

        await _loadAllDailyData(active.map(a => a.nm_id));
        await _loadAllStocks(active.map(a => a.nm_id));
        await _loadNotes(active.map(a => a.nm_id));
        try {
            await _renderActiveTable();
        } catch (e) {
            console.error('[RNP] render:', e);
            const body = document.getElementById('rnp-sheet-body');
            if (body) body.innerHTML = `<div class="p-10 text-center" style="color:var(--text-muted)">
              <p class="mb-3">Не удалось загрузить таблицу</p>
              <button type="button" onclick="RNP.openMain()" class="px-4 py-2 rounded-lg text-sm font-semibold"
                style="background:var(--accent-gradient);color:#fff">Повторить</button></div>`;
        }
        _preloadPhotos(active).then(() => {
            _refreshTabsAfterPhotos();
            _applyResolvedPhotos();
            const body = document.getElementById('rnp-sheet-body');
            if (!body) return;
            return _renderActiveTable();
        }).catch(e => console.warn('[RNP] photos preload:', e.message));
    }

    async function _renderActiveTable() {
        const body = document.getElementById('rnp-sheet-body');
        if (!body) return;
        const active = _articles.filter(a => a.is_active);
        const cal = _buildCalendar();

        if (_activeNm === SUMMARY_TAB) {
            body.innerHTML = _buildSummaryHTML(active, cal);
            _applyResolvedPhotos(_rnpRoot());
            _updateTabHighlight();
            const bar = document.getElementById('rnp-action-bar-wrap');
            if (bar) bar.innerHTML = _buildActionBar(active);
            return;
        }

        const art = _articles.find(a => a.nm_id == _activeNm);
        if (!art) return;

        await _ensurePhoto(art);
        await _preloadGalleryPhotos(art.nm_id);
        if (_compareNm) {
            const art2 = _articles.find(a => a.nm_id == _compareNm);
            if (art2) await _ensurePhoto(art2);
        }

        const rawData = _dataCache[art.nm_id] || {};
        const stockBySize = _stockCache[art.nm_id] || {};

        let topHTML = '';
        if (_compareNm && _compareNm !== art.nm_id) {
            const art2 = _articles.find(a => a.nm_id == _compareNm);
            if (art2) {
                const raw2 = _dataCache[art2.nm_id] || {};
                const stock2 = _stockCache[art2.nm_id] || {};
                topHTML = `<div class="rnp-article-panel rnp-compare-split">
                  <div><div class="rnp-compare-label">A — ${_sellerArticle(art).substring(0, 24)}</div>${_buildKpiPanelHTML(art, stockBySize, rawData, cal)}</div>
                  <div><div class="rnp-compare-label">B — ${_sellerArticle(art2).substring(0, 24)}</div>${_buildKpiPanelHTML(art2, stock2, raw2, cal)}</div>
                </div>`;
            }
        }

        body.innerHTML = `
          ${topHTML}
          <div class="rnp-table-scroll" id="rnp-table-wrap">
            ${_buildTableHTML(art, stockBySize, rawData, cal)}
          </div>`;

        _updateTabHighlight();
        const bar = document.getElementById('rnp-action-bar-wrap');
        if (bar) bar.innerHTML = _buildActionBar(active);

        _applyResolvedPhotos(_rnpRoot());
        _refreshMarqueeBaseHtml(body);
        requestAnimationFrame(() => {
            _syncMarqueeFill(body);
            requestAnimationFrame(() => _syncMarqueeFill(body));
            _bindMarqueeResize(body);
        });
        _preloadGalleryPhotos(art.nm_id).then(() => {
            _applyResolvedPhotos(_rnpRoot());
            _refreshMarqueeBaseHtml(body);
            _syncMarqueeFill(body);
        }).catch(() => {});
        _preloadPhotos(_articles.filter(a => a.is_active)).then(() => {
            _refreshTabsAfterPhotos();
            _applyResolvedPhotos(_rnpRoot());
            _refreshMarqueeBaseHtml(body);
            _syncMarqueeFill(body);
        }).catch(() => {});
    }

    function _refreshMarqueeBaseHtml(scope) {
        const track = (scope || document).querySelector('.rnp-marquee-track');
        if (!track?.dataset.baseCount) return;
        const n = parseInt(track.dataset.baseCount, 10);
        if (n > 0 && track.children.length >= n) {
            track.dataset.baseHtml = [...track.children].slice(0, n).map(c => c.outerHTML).join('');
        }
    }

    function _bindMarqueeResize(root) {
        if (_marqueeRo) {
            _marqueeRo.disconnect();
            _marqueeRo = null;
        }
        if (typeof ResizeObserver === 'undefined') return;
        const scope = root || document;
        const left = scope.querySelector('.rnp-head-left');
        const wrap = scope.querySelector('.rnp-marquee-wrap');
        const marqueeTh = scope.querySelector('.rnp-head-marquee');
        if (!left || !wrap) return;
        _marqueeRo = new ResizeObserver(() => _syncMarqueeFill(scope));
        _marqueeRo.observe(left);
        if (marqueeTh) _marqueeRo.observe(marqueeTh);
    }

    function _syncMarqueeFill(root) {
        const scope = root || document;
        const left = scope.querySelector('.rnp-head-left');
        const marqueeTh = scope.querySelector('.rnp-head-marquee');
        const wrap = scope.querySelector('.rnp-marquee-wrap');
        const track = wrap?.querySelector('.rnp-marquee-track');
        if (!wrap || !track || !track.children.length) return;

        if (!track.dataset.baseCount) {
            track.dataset.baseCount = String(track.children.length);
            track.dataset.baseHtml = [...track.children].map(c => c.outerHTML).join('');
        }

        const h = left?.offsetHeight || 0;
        const gap = 3;
        const aspect = 516 / 688;
        let cardW = 56;
        if (h > 0) {
            cardW = Math.max(40, Math.round(h * aspect));
            track.style.height = '100%';
        }

        const baseCount = parseInt(track.dataset.baseCount, 10) || track.children.length;
        const oneSetHtml = track.dataset.baseHtml || '';
        const setW = baseCount * (cardW + gap) - gap;
        const nMonthCols = scope.querySelectorAll('.rnp-th-month-col').length;
        const nDayCols = scope.querySelectorAll('.rnp-th-date.rnp-day-col').length;
        const colUnit = nMonthCols ? MONTH_COL_W : DAY_COL_W;
        const nCols = nMonthCols || nDayCols;
        const viewW = wrap.clientWidth || marqueeTh?.clientWidth || nCols * colUnit || 0;
        const totalReps = Math.max(3, Math.ceil(viewW / Math.max(setW, 1)));

        if (track.children.length !== baseCount * totalReps && oneSetHtml) {
            track.innerHTML = oneSetHtml.repeat(totalReps);
            _applyResolvedPhotos(scope);
        }

        track.querySelectorAll('.rnp-test-card').forEach(card => {
            card.style.flex = `0 0 ${cardW}px`;
            card.style.width = `${cardW}px`;
            card.style.height = '100%';
        });

        track.style.setProperty('--rnp-marquee-reps', String(totalReps));
        const loopW = track.scrollWidth / totalReps;
        if (loopW > 0) {
            const sec = Math.max(22, Math.min(48, loopW / 20));
            track.style.animationDuration = sec + 's';
        }
    }

    function _buildMetaRows(cols, art) {
        const md = art.manual_data || {};
        const responsible = (md.responsible || '').replace(/"/g, '&quot;');
        const status = md.status || 'Локомотив';
        return `<tr class="rnp-meta-row">
          <td class="rnp-metric-col">Ответственный</td>
          <td class="rnp-spark-col"></td>
          <td class="rnp-meta-cell" colspan="${cols.length}">
            <input class="rnp-meta-input" value="${responsible}" placeholder="Дастан"
              onblur="RNP.saveMeta(${art.nm_id},'responsible',this.value)">
            <span class="rnp-meta-status">Статус: <b>${status}</b></span>
          </td>
        </tr>`;
    }

    function _buildTableHTML(art, stockBySize, rawData, cal) {
        const cols = _buildCols(rawData, art, cal);
        const sheetHead = _compareNm && _compareNm !== art.nm_id
            ? ''
            : _buildSheetHeadRows(art, stockBySize, rawData, cal);
        const galleryCls = cal.mode === 'month' ? ' rnp-sheet-table--months' : '';
        const headRows = _notesVisible ? 4 : 3;
        const notesRow = _notesVisible ? `<tr class="rnp-notes-head-row">
              ${_buildNotesHeadCells(cols, art)}
            </tr>` : '';
        const firstTimelineIdx = cols.findIndex(c => c.type === 'day' || c.type === 'month');

        if (cal.mode === 'month') {
            const monthHeadRows = _notesVisible ? 4 : 3;
            const totalSt = _stickyColAttrs(0, cols, 11, 31);
            const totalTh = `<th class="rnp-th-week rnp-th-total rnp-data-col${totalSt.cls}"${totalSt.style ? ` style="${totalSt.style}"` : ''}>ИТОГ</th>`;
            const monthThs = cal.months.map((m, i) => {
                const cls = [
                    'rnp-th-month-col', 'rnp-month-col',
                    m.isCurrent ? 'is-current' : '',
                    m.isFuture ? 'rnp-th-future' : '',
                    i === 0 ? 'rnp-cell-month-start' : '',
                ].filter(Boolean).join(' ');
                return `<th class="rnp-th-date ${cls}" title="${m.fullName}">${m.label}</th>`;
            }).join('');
            const monthSubs = cal.months.map(m =>
                `<th class="rnp-th-dow rnp-month-col${m.isCurrent ? ' is-current' : ''}">${m.dayCount} дн</th>`
            ).join('');

            return `
        <table class="rnp-sheet-table${galleryCls}${_notesVisible ? '' : ' rnp-sheet-table--no-notes'}">
          <thead>
            ${sheetHead}
            <tr class="rnp-cal-quarter-row">
              <th class="rnp-th-metric" rowspan="${monthHeadRows}"></th>
              <th class="rnp-th-spark" rowspan="${monthHeadRows}"></th>
              <th class="rnp-th-year-band" colspan="${cols.length}">${cal.rangeLabel}</th>
            </tr>
            <tr class="rnp-cal-date-row">
              ${totalTh}${monthThs}
            </tr>
            <tr class="rnp-dow-head-row">
              <th class="rnp-th-dow rnp-data-col${totalSt.cls}"${totalSt.style ? ` style="${totalSt.style}"` : ''}></th>
              ${monthSubs}
            </tr>
            ${notesRow}
          </thead>
          <tbody>
            ${_buildMetaRows(cols, art)}
            ${_sectionsForView().map(s => _renderSection(s, cols, art, firstTimelineIdx)).join('')}
          </tbody>
        </table>`;
        }

        const nPrev = cal.weeks.length + (cal.weeks.length ? 1 : 0);
        const nCurr = cal.days.length;
        const firstDayIdx = firstTimelineIdx;

        const weekThs = cal.weeks.map((w, wi) => {
            const st = _stickyColAttrs(wi, cols, 11, 30);
            return `<th class="rnp-th-week rnp-data-col${st.cls}"${st.style ? ` style="${st.style}"` : ''}>${w.label || ('Нед ' + w.weekNum)}</th>`;
        }).join('');
        const totalCi = cal.weeks.length;
        const totalSt = totalCi < cols.length ? _stickyColAttrs(totalCi, cols, 11, 31) : { cls: '', style: '' };
        const totalTh = cal.weeks.length
            ? `<th class="rnp-th-week rnp-th-total rnp-data-col${totalSt.cls}"${totalSt.style ? ` style="${totalSt.style}"` : ''}>ИТОГ</th>`
            : '';
        const dayThs = cal.days.map((d, i) => {
            const ci = totalCi + (cal.weeks.length ? 1 : 0) + i;
            return `<th class="rnp-th-date rnp-day-col${d.isToday ? ' today' : ''}${d.isFuture ? ' rnp-th-future' : ''}${i === 0 ? ' rnp-cell-month-start' : ''}">${d.label}</th>`;
        }).join('');
        const dowWeeks = cal.weeks.map((w, wi) => {
            const st = _stickyColAttrs(wi, cols, 11, 29);
            return `<th class="rnp-th-dow rnp-data-col${st.cls}"${st.style ? ` style="${st.style}"` : ''}></th>`;
        }).join('');
        const dowTotalSt = totalCi < cols.length ? _stickyColAttrs(totalCi, cols, 11, 29) : { cls: '', style: '' };
        const dowTotal = cal.weeks.length
            ? `<th class="rnp-th-dow rnp-data-col${dowTotalSt.cls}"${dowTotalSt.style ? ` style="${dowTotalSt.style}"` : ''}></th>`
            : '';
        const dowDays = cal.days.map(d =>
            `<th class="rnp-th-dow rnp-day-col">${d.dow || ''}</th>`).join('');

        return `
        <table class="rnp-sheet-table${galleryCls}${_notesVisible ? '' : ' rnp-sheet-table--no-notes'}">
          <thead>
            ${sheetHead}
            <tr class="rnp-cal-month-row">
              <th class="rnp-th-metric" rowspan="${headRows}"></th>
              <th class="rnp-th-spark" rowspan="${headRows}"></th>
              <th class="rnp-th-month" colspan="${nPrev}">${cal.prevName}</th>
              <th class="rnp-th-month rnp-th-month-curr" colspan="${nCurr}">${cal.currName}</th>
            </tr>
            <tr class="rnp-cal-date-row">
              ${weekThs}${totalTh}${dayThs}
            </tr>
            <tr class="rnp-dow-head-row">
              ${dowWeeks}${dowTotal}${dowDays}
            </tr>
            ${notesRow}
          </thead>
          <tbody>
            ${_buildMetaRows(cols, art)}
            ${_sectionsForView().map(s => _renderSection(s, cols, art, firstDayIdx)).join('')}
          </tbody>
        </table>`;
    }

    function _renderSection(sec, cols, art, firstDayIdx) {
        const key = `${art.nm_id}:${sec.id}`;
        const collapsed = _collapsedSections.has(key);
        const arrow = collapsed ? '▸' : '▾';
        const hdr = sec.noHeader ? '' : `<tr class="rnp-section-hdr" onclick="RNP.toggleSection(${art.nm_id},'${sec.id}')">
          <td class="rnp-metric-col rnp-section-stick rnp-gs-section-title">${arrow} ${sec.label}</td>
          <td class="rnp-spark-col rnp-section-stick"></td>
          <td class="rnp-section-fill" colspan="${cols.length}"></td>
        </tr>`;
        if (collapsed && !sec.noHeader) return hdr;
        if (collapsed && sec.noHeader) return '';

        const daySeries = cols.filter(c => (c.type === 'day' || c.type === 'month') && !c.isFuture);

        const rows = _sectionRows(sec).map(m => {
            const sparkVals = daySeries.map(c => (c.data && c.data[m.key]) || 0);
            const spark = m.isPlan ? '' : _sparkline(sparkVals, 48, 16);

            const cells = cols.map((col, ci) => {
                const d = col.data;
                const isWeek = col.type === 'week';
                const isTotal = col.type === 'total';
                const isToday = col.isToday || col.isCurrent;
                const isMonthStart = ci === firstDayIdx;
                const isFuture = col.isFuture;
                const isDay = col.type === 'day';
                const isMonth = col.type === 'month';
                const cls = [
                    isDay ? 'rnp-day-col' : '',
                    isMonth ? 'rnp-month-col' : '',
                    isToday ? 'rnp-cell-today' : '',
                    isMonthStart ? 'rnp-cell-month-start' : '',
                    isFuture ? 'rnp-cell-future' : '',
                    isWeek ? 'rnp-cell-week' : '',
                    isTotal ? 'rnp-cell-total' : '',
                    m.competitor ? 'rnp-cell-competitor' : '',
                    m.hero && (isWeek || isTotal || isMonth) ? 'rnp-cell-hero' : '',
                ].filter(Boolean).join(' ');
                const sticky = _stickyDataAttrs(ci, cols);
                const colWCls = isDay ? 'rnp-day-col' : (isMonth ? 'rnp-month-col' : 'rnp-data-col');

                if (m.isPlan) {
                    const pv = _planVal(art, m.key, col.colKey);
                    const valAttr = pv !== '' && pv != null ? ` value="${pv}"` : '';
                    return `<td class="${cls} rnp-cell-plan ${colWCls}${sticky.cls}"${sticky.style ? ` style="${sticky.style}"` : ''}>
                      <input type="text" inputmode="decimal"${valAttr}
                        class="rnp-plan-input" placeholder=""
                        onchange="RNP.savePlan(${art.nm_id},'${m.key}','${col.colKey}',this.value)">
                    </td>`;
                }

                const val = d ? d[m.key] : null;
                const str = _fmt(val, m.type);
                const cc  = m.hm ? _cellColor(val, m.hm) : (m.cl ? _cellColor(val, m.cl === 'planStrong' ? 'planStrong' : 'plan') : '');
                let style = sticky.style || '';
                if (cc === 'rnp-green')  style += (style ? ';' : '') + 'background:rgba(16,185,129,0.15);color:var(--green)';
                else if (cc === 'rnp-yellow') style += (style ? ';' : '') + 'background:rgba(245,158,11,0.15);color:var(--amber)';
                else if (cc === 'rnp-red')    style += (style ? ';' : '') + 'background:rgba(239,68,68,0.15);color:var(--red)';
                else if (m.bold) style += (style ? ';' : '') + 'font-weight:600';
                if (m.cl === 'planStrong' && cc) style += (style ? ';' : '') + 'font-size:10px;font-weight:700';
                return `<td class="${cls} ${colWCls}${sticky.cls}"${style ? ` style="${style}"` : ''}>${str ?? ''}</td>`;
            }).join('');
            const rowCls = [
                m.isPlan ? 'rnp-row-plan' : '',
                m.hero ? 'rnp-row-hero' : '',
                m.competitor ? 'rnp-row-competitor' : '',
                m.cl === 'planStrong' ? 'rnp-row-plan-strong' : '',
            ].filter(Boolean).join(' ');
            return `<tr class="${rowCls}">
              <td class="rnp-metric-col${m.bold ? ' rnp-metric-bold' : ''}${m.hero ? ' rnp-metric-hero' : ''}">
                ${m.label}
              </td>
              <td class="rnp-spark-col">${spark}</td>${cells}
            </tr>`;
        }).join('');
        return hdr + rows;
    }

    // ─── PUBLIC API ───────────────────────────────────────────────────────────
    async function init(supabase, cabId, proxyFn, opts) {
        _db = supabase; _cab = cabId;
        if (typeof proxyFn === 'function') _callProxy = proxyFn;
        if (opts?.userEmail) _userEmail = opts.userEmail;
        try { _sectionView = localStorage.getItem('rnp_section_view') || 'all'; } catch (e) {}
        await _loadSettings();
        await _loadArticles();
        _backfillSellerArticlesFromDb().catch(e => console.warn('[RNP] seller backfill:', e.message));
    }

    async function openSettings() {
        _renderSettings();
    }

    async function openMain() {
        await _renderMain();
    }

    async function pick(nmId) {
        _activeNm = nmId === SUMMARY_TAB || nmId === 'summary' ? SUMMARY_TAB : Number(nmId);
        if (_activeNm !== SUMMARY_TAB && _activeNm === _compareNm) _compareNm = null;
        try { sessionStorage.setItem('rnp_active_nm', String(_activeNm)); } catch (e) {}
        await _renderActiveTable();
    }

    async function syncArts() {
        const btn = document.getElementById('rnp-sync-btn');
        if (btn) btn.textContent = '⏳ Загрузка...';
        try {
            await _syncFromOrders();
        } finally {
            if (btn) btn.textContent = 'Из заказов';
        }
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

    async function saveMeta(nmId, key, val) {
        const art = _articles.find(a => a.nm_id == nmId);
        if (!art) return;
        const manual_data = { ...(art.manual_data || {}), [key]: (val || '').trim() };
        await _updateArticle(nmId, { manual_data });
    }

    async function savePhotoComment(nmId, idx, text) {
        const art = _articles.find(a => a.nm_id == nmId);
        if (!art) return;
        const md = { ...(art.manual_data || {}) };
        const slots = _gallerySlots(art);
        slots[idx] = { ...(slots[idx] || {}), comment: (text || '').trim(), large: idx === 2 };
        md.photo_gallery = slots;
        await _updateArticle(nmId, { manual_data: md });
    }

    async function saveManual(nmId, key, val) {
        const art = _articles.find(a => a.nm_id == nmId);
        if (!art) return;
        const manual_data = { ...(art.manual_data || {}), [key]: parseFloat(val) || 0 };
        await _updateArticle(nmId, { manual_data });
    }

    async function saveRnpOptions() {
        const opts = {
            usdRate: parseFloat(document.getElementById('rnp-usd-rate')?.value) || 87.5,
            defaultPlanPeriod: document.getElementById('rnp-default-plan')?.value === 'month' ? 'month' : 'week',
            monthFrom: parseInt(document.getElementById('rnp-month-from')?.value, 10) || 6,
            monthTo: parseInt(document.getElementById('rnp-month-to')?.value, 10) || 12,
            showGiveaways: !!document.querySelector('[data-opt="showGiveaways"]')?.checked,
            showCompetitor: !!document.querySelector('[data-opt="showCompetitor"]')?.checked,
        };
        await _saveSettings({ options: opts });
        if (!localStorage.getItem('rnp_plan_period')) {
            _planPeriod = opts.defaultPlanPeriod;
        }
        _nrDialog('Сохранено', 'Параметры РНП обновлены.', 'success');
        _renderSettings();
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
        await _syncToday(nmId);
        await _syncOrdersHistory(nmId);

        if (_callProxy) {
            await _syncFunnelHistory(nmId).catch(e => console.warn('[RNP] funnel skipped:', e.message));
            await _syncFinanceRange(nmId);
            await _syncAdStats(nmId).catch(e => console.warn('[RNP] ads skipped:', e.message));
        }

        _invalidateCache(nmId);
        await _loadDailyData(nmId);
        await _loadAllStocks([nmId]);
        if (_activeNm == nmId) await _renderActiveTable();
    }

    async function refreshAll() {
        const btn = document.getElementById('rnp-header-refresh');
        const active = _articles.filter(a => a.is_active);
        if (!active.length) return;
        if (btn) btn.disabled = true;

        for (let i = 0; i < active.length; i++) {
            await refresh(active[i].nm_id);
        }

        _invalidateCache();
        await _loadAllDailyData(active.map(a => a.nm_id));
        await _loadAllStocks(active.map(a => a.nm_id));
        _notesCache = {};
        await _loadNotes(active.map(a => a.nm_id));
        await _preloadPhotos(active);
        _refreshTabsAfterPhotos();
        _applyResolvedPhotos();
        await _renderActiveTable();
        if (btn) { btn.disabled = false; }
    }

    async function toggleSection(nmId, sectionId) {
        const key = `${nmId}:${sectionId}`;
        if (_collapsedSections.has(key)) _collapsedSections.delete(key);
        else _collapsedSections.add(key);
        if (_activeNm == nmId) await _renderActiveTable();
    }

    return { init, openSettings, openMain, pick, syncArts, toggleArt, enableAll, setCost, saveRnpOptions, saveManual, savePlan, saveNote, savePhotoComment, saveMeta, saveRate, savePeriod, savePromo, refresh, refreshAll, toggleSection, imgFallback,
             setView, setCompare, toggleCompare, copyPlanFromPrevWeek, exportExcel, setStrategyTab, toggleNotes, setPlanPeriod, toggleGalleryPanel,
             syncFinance: _syncFinanceRange, syncAds: _syncAdStats };
})();

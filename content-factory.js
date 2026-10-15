/**
 * Контент-завод: календарь публикаций, блогеры, карусель, Instagram, сводка.
 * Фото — только точный числовой nmId (без поиска по названию и без «похожих»).
 * В Instagram — только после предпросмотра слайдов и кнопки «Подтверждено».
 */
(function (root) {
    const PLATFORMS = [
        { id: 'instagram', label: 'Instagram' },
        { id: 'tiktok', label: 'TikTok' },
        { id: 'youtube', label: 'YouTube' },
        { id: 'wibes', label: 'Wibes' },
    ];
    const STATUSES = [
        { id: 'draft', label: 'Черновик' },
        { id: 'review', label: 'На подтверждении' },
        { id: 'scheduled', label: 'Запланировано' },
        { id: 'published', label: 'Опубликовано' },
        { id: 'error', label: 'Ошибка' },
    ];
    const VIEWS = [
        { id: 'overview', label: 'Обзор' },
        { id: 'calendar', label: 'Календарь' },
        { id: 'create', label: 'Создать' },
        { id: 'review', label: 'Очередь' },
        { id: 'bloggers', label: 'Блогеры' },
        { id: 'dashboard', label: 'Аналитика' },
    ];
    const FORMATS = [
        { id: 'post', label: 'Пост', hint: '1 фото' },
        { id: 'carousel', label: 'Карусель', hint: 'до 10 слайдов' },
        { id: 'story', label: 'Сторис', hint: 'вертикальная' },
    ];
    const TOKEN_WARN_DAYS = 14;
    const SLIDE_W = 1080;
    const SLIDE_H = 1350;
    const PHOTO_PAGES = 3;

    function num(v) {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    }
    function computePayout(rate, views, threshold, bonus) {
        return num(rate) + (num(views) > num(threshold) ? num(bonus) : 0);
    }
    function monthStart(d) {
        const x = d instanceof Date ? d : new Date(d);
        if (!Number.isFinite(x.getTime())) return '';
        return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-01`;
    }
    function ymd(d) {
        const x = d instanceof Date ? d : new Date(d);
        if (!Number.isFinite(x.getTime())) return '';
        return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
    }
    function pad(n) { return String(n).padStart(2, '0'); }
    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function platformLabel(id) {
        return (PLATFORMS.find((p) => p.id === id) || {}).label || id || '—';
    }
    function statusLabel(id) {
        return (STATUSES.find((s) => s.id === id) || {}).label || id || '—';
    }
    function uniqUrls(urls) {
        const out = [];
        const seen = new Set();
        (Array.isArray(urls) ? urls : []).forEach((raw) => {
            let u = String(raw || '').trim();
            if (u.startsWith('//')) u = 'https:' + u;
            if (!u || seen.has(u)) return;
            seen.add(u);
            out.push(u);
        });
        return out;
    }
    function nmIdFromPhotoUrl(url) {
        const m = String(url || '').match(/\/(\d{6,})\/images\//);
        return m ? Number(m[1]) : 0;
    }
    function photoUrlFitsNmId(url, nmId) {
        const id = Number(nmId);
        if (!id) return false;
        const inUrl = nmIdFromPhotoUrl(url);
        if (inUrl) return inUrl === id;
        return true;
    }
    function photosForNmId(urls, nmId) {
        const id = Number(nmId);
        if (!id) return [];
        return uniqUrls(urls).filter((u) => photoUrlFitsNmId(u, id));
    }
    function wbBasketHostFromUrl(url) {
        const m = String(url || '').match(/basket-(\d+)\.wbbasket\.ru/i);
        return m ? Number(m[1]) : 0;
    }
    function wbBasketSlotUrl(host, nmId, slot) {
        const vol = Math.floor(nmId / 100000);
        const part = Math.floor(nmId / 1000);
        const bStr = String(host).padStart(2, '0');
        return 'https://basket-' + bStr + '.wbbasket.ru/vol' + vol + '/part' + part + '/' + nmId + '/images/big/' + slot + '.webp';
    }
    function galleryUrlsFromManual(manual, nmId) {
        const id = Number(nmId);
        if (!id || !manual || typeof manual !== 'object') return [];
        const gal = manual.cached_gallery_urls;
        if (!gal || typeof gal !== 'object' || Array.isArray(gal)) return [];
        const urls = Object.keys(gal).sort((a, b) => Number(a) - Number(b)).map((k) => String(gal[k] || ''));
        return photosForNmId(urls, id);
    }
    function bindExactArticlePhotos(input) {
        const id = Number(input && input.nmId);
        if (!id) return [];
        const raw = [].concat(
            Array.isArray(input.cardPhotos) ? input.cardPhotos : [],
            input.articlePhoto ? [input.articlePhoto] : [],
            Array.isArray(input.gallery) ? input.gallery : [],
        );
        const bound = photosForNmId(raw, id);
        const slots = input.slots == null ? 8 : input.slots;
        if (bound.length >= slots) return bound;
        const host = bound.map(wbBasketHostFromUrl).find((h) => h > 0) || 0;
        if (!host) return bound;
        const extra = [];
        for (let s = 1; s <= slots; s++) extra.push(wbBasketSlotUrl(host, id, s));
        return uniqUrls(bound.concat(extra));
    }
    function pickComposition(card) {
        if (!card) return '';
        const bags = [card.options, card.addin, card.characteristics];
        for (let b = 0; b < bags.length; b++) {
            const bag = bags[b];
            if (!Array.isArray(bag)) continue;
            for (let i = 0; i < bag.length; i++) {
                const o = bag[i] || {};
                if (!/состав|composition/i.test(String(o.name || o.title || o.key || ''))) continue;
                const val = o.value ?? o.val ?? o.text;
                if (Array.isArray(val)) return val.map(String).filter(Boolean).join(', ');
                const s = String(val || '').trim();
                if (s) return s;
            }
        }
        return '';
    }
    function pickCardPrice(card) {
        const sizes = card && card.sizes;
        if (Array.isArray(sizes)) {
            for (let i = 0; i < sizes.length; i++) {
                const p = num(sizes[i] && (sizes[i].discountedPrice ?? sizes[i].price ?? sizes[i].salePrice));
                if (p > 0) return p > 10000000 ? p / 100 : p;
            }
        }
        const p = num(card && (card.price ?? card.salePrice));
        return p > 0 ? (p > 10000000 ? p / 100 : p) : null;
    }
    function parseWbCard(card) {
        const c = card || {};
        const nmId = Number(c.nmID ?? c.nmId ?? c.nm_id ?? 0) || 0;
        const photosRaw = Array.isArray(c.photos) ? c.photos : [];
        const photosMapped = uniqUrls(photosRaw.map((p) => {
            if (typeof p === 'string') return p;
            if (p && typeof p === 'object') return p.big || p.c516x688 || p.c246x328 || p.tm || '';
            return '';
        }));
        const photos = nmId ? photosForNmId(photosMapped, nmId) : photosMapped;
        return {
            nmId,
            title: String(c.title ?? c.imtName ?? c.vendorCode ?? (nmId ? 'Артикул ' + nmId : '')).trim(),
            photos,
            price: pickCardPrice(c),
            composition: pickComposition(c),
            vendorCode: String(c.vendorCode || c.vendor_code || '').trim(),
            brand: String(c.brand || c.brandName || '').trim(),
            description: pickCardDescription(c),
        };
    }
    function pickCardDescription(card) {
        if (!card) return '';
        return String(card.description || card.imtDescription || card.desc || '').replace(/\s+/g, ' ').trim();
    }
    function pickCardByNmId(cards, nmId) {
        const id = Number(nmId);
        if (!id) return null;
        const list = Array.isArray(cards) ? cards : [];
        for (let i = 0; i < list.length; i++) {
            const parsed = parseWbCard(list[i]);
            if (parsed.nmId === id) return parsed;
        }
        return null;
    }
    function planCarouselSlides(input) {
        const nmExact = Number(input.nmId) || 0;
        const photos = uniqUrls([].concat(
            photosForNmId(input.photos || [], nmExact),
            photosForNmId(input.extraPhotos || [], nmExact),
        ));
        const cover = photos[0] || '';
        const details = photos.slice(1, 5);
        while (details.length < 4 && cover) details.push(cover);
        const used = new Set([cover].concat(photos.slice(1, 5)).filter(Boolean));
        const rest = photos.filter((u) => u && !used.has(u));
        const pool = rest.length ? rest : (photos.slice(1).length ? photos.slice(1) : (cover ? [cover] : []));
        const plains = [];
        for (let i = 0; i < PHOTO_PAGES; i++) {
            const u = pool[i] || pool[i % Math.max(pool.length, 1)];
            if (u) plains.push(u);
        }
        const base = {
            width: SLIDE_W,
            height: SLIDE_H,
            title: shortSeo(String(input.title || '').trim(), 60),
            nmId: Number(input.nmId) || 0,
            composition: String(input.composition || '').trim(),
            brand: String(input.brand || '').trim() || 'NR',
            price: input.price == null || input.price === '' ? null : num(input.price),
            vendorCode: String(input.vendorCode || '').trim(),
            description: String(input.description || '').trim(),
            headline: '',
            line: '',
        };
        const raw = [
            Object.assign({}, base, { kind: 'cover', photos: cover ? [cover] : [] }),
            Object.assign({}, base, { kind: 'collage', photos: details.slice(0, 4) }),
        ].concat(plains.map((u) => Object.assign({}, base, { kind: 'photo', photos: [u] }))).concat([
            Object.assign({}, base, { kind: 'info', photos: [] }),
            Object.assign({}, base, { kind: 'brand', photos: [] }),
        ]);
        const overlays = layoutSeoOverlays(raw.map((p) => p.kind), input);
        return raw.map((p, i) => Object.assign({}, p, overlays[i] || {}));
    }
    function clipText(s, max) {
        const t = String(s || '').replace(/\s+/g, ' ').trim();
        if (!t) return '';
        if (t.length <= max) return t;
        const cut = t.slice(0, Math.max(1, max - 1));
        const sp = cut.lastIndexOf(' ');
        return ((sp > max * 0.45 ? cut.slice(0, sp) : cut).trim() || cut.trim()) + '…';
    }
    const SEO_HEADLINE_MAX = 32;
    const SEO_LINE_MAX = 52;
    const SEO_STOP = new Set(['и','в','во','на','с','со','к','ко','по','для','из','от','до','или','а','но','как','при','без','над','под','о','об','про','же','ли','бы','это','этот','эта','эти','тот','та','те','не','ни','да','у','за','через']);
    function seoToken(word) {
        const w = String(word || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, '');
        if (!w || SEO_STOP.has(w)) return '';
        const stem = w.replace(/(иями|ями|ами|ого|ему|ому|ыми|ими|ов|ев|ей|ой|ий|ый|ая|ое|ее|ые|ие|ую|юю|ах|ях|ам|ям|ом|ем|а|я|о|е|у|ю|ы|и|ь)$/i, '');
        return stem.length >= 4 ? stem : w;
    }
    function dedupeSeoText(text) {
        const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
        const seen = new Set();
        const out = [];
        for (const w of words) {
            const t = seoToken(w);
            if (t && seen.has(t)) continue;
            if (t) seen.add(t);
            out.push(w);
        }
        return out.join(' ').replace(/\s+/g, ' ').trim();
    }
    function withoutUsedSeo(text, used) {
        const bag = used || new Set();
        const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
        const out = [];
        for (const w of words) {
            const t = seoToken(w);
            if (t && bag.has(t)) continue;
            out.push(w);
            if (t) bag.add(t);
        }
        return out.join(' ').replace(/\s+/g, ' ').trim();
    }
    function shortSeo(text, max) {
        return clipText(dedupeSeoText(text), max == null ? SEO_HEADLINE_MAX : max);
    }
    function collectSeoInto(text, used) {
        withoutUsedSeo(text, used);
    }
    function splitSeoSentences(text) {
        return String(text || '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?…;])\s+/).map((s) => s.trim()).filter((s) => s.length >= 8);
    }
    function splitHeadlineLine(sentence, used) {
        const bag = used || new Set();
        const t = withoutUsedSeo(dedupeSeoText(sentence), bag);
        if (!t) return { headline: '', line: '' };
        const words = t.split(' ').filter(Boolean);
        if (words.length <= 4 && t.length <= SEO_HEADLINE_MAX) return { headline: clipText(t, SEO_HEADLINE_MAX), line: '' };
        const n = Math.min(4, Math.max(2, Math.ceil(words.length / 3)));
        return {
            headline: clipText(words.slice(0, n).join(' '), SEO_HEADLINE_MAX),
            line: clipText(words.slice(n).join(' '), SEO_LINE_MAX),
        };
    }
    function layoutSeoOverlays(kinds, input) {
        const sentences = splitSeoSentences(input && input.description);
        const title = shortSeo(input && input.title, SEO_HEADLINE_MAX);
        const composition = shortSeo(input && input.composition, SEO_LINE_MAX);
        const used = new Set();
        let i = 0;
        const take = () => sentences[i++] || '';
        let photos = 0;
        return (kinds || []).map((kind) => {
            if (kind === 'cover') {
                const hook = take();
                const headline = title || shortSeo(hook, SEO_HEADLINE_MAX);
                collectSeoInto(headline, used);
                return { headline, line: clipText(withoutUsedSeo(hook, used), SEO_LINE_MAX) };
            }
            if (kind === 'collage') return { headline: '', line: '' };
            if (kind === 'photo') {
                photos += 1;
                if (photos === 2 && composition) {
                    const already = sentences.some((s) => composition.length >= 4 && s.toLowerCase().includes(composition.slice(0, 8).toLowerCase()));
                    if (!already) {
                        collectSeoInto(composition, used);
                        return { headline: 'Состав', line: composition };
                    }
                }
                return splitHeadlineLine(take() || (photos === 1 ? composition : ''), used);
            }
            return { headline: '', line: '' };
        });
    }
    function parseGptOverlayJson(raw, kinds, fallback) {
        let data = raw;
        if (typeof raw === 'string') {
            const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
            try { data = JSON.parse(trimmed); } catch (e) { return fallback; }
        }
        const obj = data && typeof data === 'object' && !Array.isArray(data) ? data : null;
        const list = Array.isArray(data) ? data : (obj && (obj.overlays || obj.slides));
        if (!Array.isArray(list)) return fallback;
        const used = new Set();
        const stems = new Set();
        return (kinds || []).map((kind, idx) => {
            let row = null;
            const at = list[idx];
            if (at && typeof at === 'object' && String(at.kind || kind) === kind) { used.add(idx); row = at; }
            if (!row) {
                const found = list.findIndex((item, j) => !used.has(j) && item && typeof item === 'object' && String(item.kind || '') === kind);
                if (found >= 0) { used.add(found); row = list[found]; }
            }
            if (!row) return fallback[idx] || { headline: '', line: '' };
            const headline = shortSeo(row.headline || row.title || '', SEO_HEADLINE_MAX);
            const lineRaw = dedupeSeoText(row.line || row.text || row.body || '');
            const head = withoutUsedSeo(headline, stems);
            const line = clipText(withoutUsedSeo(lineRaw, stems), SEO_LINE_MAX);
            if (!head && !line) return fallback[idx] || { headline: '', line: '' };
            return { headline: head, line };
        });
    }
    function groupPostsByDay(posts, year, month) {
        const map = {};
        (posts || []).forEach((p) => {
            if (!p.publish_at) return;
            const d = new Date(p.publish_at);
            if (d.getFullYear() !== year || d.getMonth() !== month) return;
            const key = ymd(d);
            if (!map[key]) map[key] = [];
            map[key].push(p);
        });
        return map;
    }
    function calendarCells(year, month) {
        const first = new Date(year, month, 1);
        const start = (first.getDay() + 6) % 7;
        const days = new Date(year, month + 1, 0).getDate();
        const cells = [];
        for (let i = 0; i < start; i++) cells.push(null);
        for (let d = 1; d <= days; d++) cells.push(d);
        while (cells.length % 7) cells.push(null);
        return cells;
    }
    function viewsByPlatform(posts, from, to) {
        const out = { instagram: 0, tiktok: 0, youtube: 0, wibes: 0 };
        const series = {};
        (posts || []).forEach((p) => {
            const d = p.publish_at ? ymd(p.publish_at) : '';
            if (from && d && d < from) return;
            if (to && d && d > to) return;
            const plat = p.platform;
            if (out[plat] == null) return;
            out[plat] += num(p.views);
            if (!d) return;
            if (!series[d]) series[d] = { instagram: 0, tiktok: 0, youtube: 0, wibes: 0 };
            series[d][plat] += num(p.views);
        });
        const days = Object.keys(series).sort();
        return { totals: out, days, series };
    }
    function topPosts(posts, n) {
        return (posts || []).slice().sort((a, b) => num(b.views) - num(a.views)).slice(0, n || 5);
    }
    function filterPosts(posts, filters) {
        return (posts || []).filter((p) => {
            if (filters.platform && p.platform !== filters.platform) return false;
            if (filters.blogger && String(p.blogger_id || '') !== String(filters.blogger)) return false;
            if (filters.status && p.status !== filters.status) return false;
            return true;
        });
    }

    /* Сколько осталось жить токену Instagram: ok / warn (меньше 14 дней) / bad (истёк) / none */
    function tokenState(expiresAt, now) {
        if (!expiresAt) return { level: 'none', days: null };
        const t = new Date(expiresAt).getTime();
        if (!Number.isFinite(t)) return { level: 'none', days: null };
        const days = Math.floor((t - (now || Date.now())) / 86400000);
        if (days < 0) return { level: 'bad', days };
        return { level: days < TOKEN_WARN_DAYS ? 'warn' : 'ok', days };
    }
    /* Сводка месяца: опубликовано, запланировано, просмотры, лучший пост */
    function monthStats(posts, year, month) {
        const inMonth = (posts || []).filter((p) => {
            if (!p.publish_at) return false;
            const d = new Date(p.publish_at);
            return d.getFullYear() === year && d.getMonth() === month;
        });
        const published = inMonth.filter((p) => p.status === 'published');
        const planned = inMonth.filter((p) => p.status === 'scheduled' || p.status === 'review' || p.status === 'published');
        const views = published.reduce((s, p) => s + num(p.views), 0);
        const best = published.slice().sort((a, b) => num(b.views) - num(a.views))[0] || null;
        return { published: published.length, planned: planned.length, views, best };
    }
    /* Колонки очереди */
    function queueGroups(posts) {
        const g = { draft: [], review: [], scheduled: [], done: [] };
        (posts || []).forEach((p) => {
            if (p.status === 'draft') g.draft.push(p);
            else if (p.status === 'review') g.review.push(p);
            else if (p.status === 'scheduled') g.scheduled.push(p);
            else g.done.push(p);
        });
        return g;
    }
    /* Что нужно сделать прямо сейчас: ждут подтверждения, ошибки, пустая неделя */
    function todoItems(posts, now) {
        const t = now || Date.now();
        const list = posts || [];
        const out = [];
        const review = list.filter((p) => p.status === 'review').length;
        const errors = list.filter((p) => p.status === 'error').length;
        if (review) out.push({ kind: 'review', n: review });
        if (errors) out.push({ kind: 'error', n: errors });
        const soon = list.some((p) => p.publish_at && (p.status === 'scheduled' || p.status === 'review')
            && new Date(p.publish_at).getTime() >= t && new Date(p.publish_at).getTime() <= t + 7 * 86400000);
        if (!soon) out.push({ kind: 'empty-week', n: 0 });
        return out;
    }
    function upcomingPosts(posts, n, now) {
        const t = now || Date.now();
        return (posts || []).filter((p) => p.publish_at && new Date(p.publish_at).getTime() >= t
            && (p.status === 'scheduled' || p.status === 'review'))
            .sort((a, b) => new Date(a.publish_at) - new Date(b.publish_at)).slice(0, n || 3);
    }

    const state = {
        view: 'overview',
        fmt: 'post',
        own: false,
        ownIg: null,
        tg: { loaded: false, bot: null, source: null, canSetupBot: false },
        tgForm: null,
        qFilter: 'all',
        busy: {},
        accounts: [],
        igMap: {},
        accQuery: '',
        listMode: 'calendar',
        cursor: new Date(),
        posts: [],
        bloggers: [],
        payouts: [],
        articles: [],
        articleMap: {},
        filters: { platform: '', blogger: '', status: '' },
        payoutMonth: monthStart(new Date()),
        form: null,
        card: null,
        extraPhotos: [],
        carouselUrls: [],
        ig: { configured: false, connected: false },
        searchTexts: null,
        loading: false,
        err: '',
        loadedCab: '',
        fetchCab: '',
        igLoaded: false,
        igBusy: false,
        loadGen: 0,
    };
    const FN_TIMEOUT_MS = 4000;
    const FN_LONG_MS = 30000;
    const QUERY_TIMEOUT_MS = 8000;

    let sb = null;
    let cab = '';
    let callWb = null;
    let opts = {};

    /* NR Space (@nurcon.kg): свой календарь без кабинета и артикулов WB, только супер-админ */
    function key() { return state.own ? 'own' : cab; }
    /* Пост без артикула WB (свой календарь или пост из Telegram): форма «фото + подпись + время» */
    function freeForm() { return state.own || !!(state.form && state.form.source === 'telegram'); }
    function tbl() { return state.own ? 'nr_content_posts' : 'content_posts'; }
    function scoped(q) { return state.own ? q : q.eq('cabinet_id', cab); }

    function rootEl() {
        if (typeof document === 'undefined') return null;
        return document.getElementById('cf-root');
    }
    function functionsUrl(name) {
        const base = (opts.functionsUrl || (opts.supabaseUrl ? opts.supabaseUrl + '/functions/v1' : ''))
            || 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1';
        return base.replace(/\/$/, '') + '/' + name;
    }
    function withTimeout(thenable, ms) {
        const wait = Number(ms);
        if (!Number.isFinite(wait) || wait <= 0) return Promise.resolve(thenable);
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Таймаут')), wait);
            Promise.resolve(thenable).then(
                (v) => { clearTimeout(timer); resolve(v); },
                (e) => { clearTimeout(timer); reject(e); },
            );
        });
    }
    function queryTimeoutMs() {
        const n = num(opts.queryTimeoutMs);
        return n > 0 ? n : QUERY_TIMEOUT_MS;
    }
    async function userToken() {
        if (!sb) return '';
        let session = null;
        if (root.NrAuth && typeof root.NrAuth.recoverBrokenSession === 'function') {
            session = await withTimeout(root.NrAuth.recoverBrokenSession(sb), FN_TIMEOUT_MS).catch(() => null);
        }
        if (!session || !session.access_token) {
            const pack = await withTimeout(sb.auth.getSession(), FN_TIMEOUT_MS).catch(() => ({ data: {} }));
            session = ((pack && pack.data) || {}).session;
        }
        return (session && session.access_token) || '';
    }
    async function callFn(name, body, timeoutMs) {
        const token = await userToken();
        const ms = num(timeoutMs) > 0 ? num(timeoutMs) : FN_TIMEOUT_MS;
        const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = ctrl ? setTimeout(function () { ctrl.abort(); }, ms) : null;
        try {
            const res = await fetch(functionsUrl(name), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
                body: JSON.stringify(Object.assign({ cabinet_id: cab }, body || {})),
                signal: ctrl ? ctrl.signal : undefined,
            });
            const js = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(js.error || ('HTTP ' + res.status));
            return js;
        } catch (e) {
            if (e && (e.name === 'AbortError' || /aborted|abort/i.test(String(e.message || e)))) {
                throw new Error('Таймаут');
            }
            throw e;
        } finally {
            if (timer) clearTimeout(timer);
        }
    }
    function needsReload() {
        return !!cab && state.loadedCab !== key();
    }
    function shouldHoldPaint() {
        if (typeof document === 'undefined') return false;
        const el = rootEl();
        const active = document.activeElement;
        if (!el || !active || !el.contains(active)) return false;
        const tag = active.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    }
    function paintAfterLoad() {
        if (!shouldHoldPaint()) paint();
    }
    function toast(kind, title, text) {
        if (typeof root.showPremiumModal === 'function') root.showPremiumModal(kind, title, text);
        else if (kind === 'error') console.error(title, text);
    }

    function articleOf(post) {
        if (!post) return null;
        return state.articleMap[post.article_id] || null;
    }
    function bloggerOf(id) {
        return state.bloggers.find((b) => b.id === id) || null;
    }

    async function loadArticles() {
        if (!sb || !cab) return;
        const { data, error } = await withTimeout(sb.from('rnp_articles')
            .select('id, nm_id, name, photo_url, is_active, cost_price')
            .eq('cabinet_id', cab)
            .order('name'), queryTimeoutMs());
        if (error) throw error;
        state.articles = data || [];
        state.articleMap = {};
        state.articles.forEach((a) => { state.articleMap[a.id] = a; });
    }
    function isMissingTable(err) {
        const m = String((err && (err.message || err.details || err.code)) || err || '');
        return /schema cache|Could not find the table|does not exist|PGRST205/i.test(m);
    }
    async function loadPosts() {
        const { data, error } = await withTimeout(scoped(sb.from(tbl()).select('*'))
            .order('publish_at', { ascending: false, nullsFirst: false }), queryTimeoutMs());
        if (error) {
            if (isMissingTable(error)) { state.posts = []; return; }
            throw error;
        }
        state.posts = data || [];
    }
    async function loadBloggers() {
        const { data, error } = await withTimeout(sb.from('bloggers')
            .select('*')
            .eq('cabinet_id', cab)
            .order('name'), queryTimeoutMs());
        if (error) {
            if (isMissingTable(error)) { state.bloggers = []; return; }
            throw error;
        }
        state.bloggers = data || [];
    }
    async function loadPayouts() {
        const { data, error } = await withTimeout(sb.from('blogger_payouts')
            .select('*')
            .eq('cabinet_id', cab)
            .eq('month', state.payoutMonth), queryTimeoutMs());
        if (error) {
            if (isMissingTable(error)) { state.payouts = []; return; }
            throw error;
        }
        state.payouts = data || [];
    }
    async function loadIg() {
        try {
            state.ig = await callFn('content-ig-oauth', { action: 'status' }, FN_TIMEOUT_MS);
        } catch (_) {
            state.ig = { configured: false, connected: false };
        }
        state.igLoaded = true;
    }
    /* Кабинеты = Instagram-аккаунты: статус подключения берём одним запросом (RLS отдаёт только доступные) */
    async function loadTg() {
        try {
            const r = await callFn('content-tg-source', { action: 'status' }, FN_TIMEOUT_MS);
            state.tg = { loaded: true, bot: r.bot || null, source: r.source || null, canSetupBot: !!r.can_setup_bot };
        } catch (_) { state.tg = Object.assign({}, state.tg, { loaded: true }); }
        state.tgForm = null;
        if (state.view === 'instagram') paintAfterLoad();
    }
    async function loadOwnIg() {
        try { state.ownIg = await callFn('nr-ig-admin', { action: 'get' }, FN_TIMEOUT_MS); } catch (_) { state.ownIg = state.ownIg || null; }
    }
    /* Для NR Space срок токена считаем от даты сохранения: долгий токен живёт около 60 дней */
    function ownTokenRow() {
        const g = state.ownIg;
        if (!g || !g.has_token || !g.ig_user_id) return null;
        const exp = g.token_set_at ? new Date(new Date(g.token_set_at).getTime() + 60 * 86400000).toISOString() : null;
        return { ig_username: g.ig_username, ig_user_id: g.ig_user_id, token_secret_id: 'own', token_expires_at: exp };
    }
    async function loadAccounts() {
        try {
            const list = typeof root.nrCabinetList === 'function' ? root.nrCabinetList() : [];
            state.accounts = (list || []).map((c) => ({ id: String(c.id), name: c.name || 'Кабинет' }));
        } catch (_) { state.accounts = []; }
        if (!state.accounts.some((a) => a.id === cab)) state.accounts.unshift({ id: cab, name: 'Кабинет' });
        try {
            const { data } = await withTimeout(sb.from('content_ig_accounts')
                .select('cabinet_id, ig_username, ig_user_id, token_secret_id, token_expires_at'), queryTimeoutMs());
            const map = {};
            (data || []).forEach((r) => { map[String(r.cabinet_id)] = r; });
            state.igMap = map;
        } catch (_) { state.igMap = state.igMap || {}; }
        state.accLoaded = true;
    }
    function igRow(id) { return state.igMap[String(id)] || null; }
    function igConnected(id) { const r = igRow(id); return !!(r && r.token_secret_id && r.ig_user_id); }
    function ensureIg() {
        if (state.igLoaded || state.igBusy) return Promise.resolve();
        state.igBusy = true;
        return loadIg().catch(() => {}).finally(() => { state.igBusy = false; }).then(() => {
            if (state.view === 'instagram') paintAfterLoad();
        });
    }
    async function reload() {
        if (!sb || !cab) return;
        const gen = ++state.loadGen;
        state.fetchCab = key();
        state.err = '';
        try {
            if (state.own) await Promise.all([loadPosts(), loadAccounts(), loadOwnIg()]);
            else { if (!state.tg.loaded) void loadTg(); await Promise.all([loadArticles(), loadPosts(), loadBloggers(), loadPayouts(), loadAccounts()]); }
            if (gen !== state.loadGen) return;
            state.loadedCab = key();
        } catch (e) {
            if (gen !== state.loadGen) return;
            if (!isMissingTable(e)) state.err = e.message || String(e);
        } finally {
            if (state.fetchCab === key() && gen === state.loadGen) state.fetchCab = '';
        }
        if (gen === state.loadGen) paintAfterLoad();
    }

    async function pullArticleCard(article) {
        if (!article) return null;
        const nm = Number(article.nm_id);
        if (!nm) return null;
        let hit = null;
        if (callWb) {
            try {
                const data = await withTimeout(callWb('content_cards', {
                    limit: 100,
                    textSearch: String(nm),
                    withPhoto: 1,
                    nmIds: [nm],
                }), FN_TIMEOUT_MS);
                hit = pickCardByNmId((data && data.cards) || [], nm);
            } catch (_) {
                hit = null;
            }
        }
        if (article.manual_data == null && sb && cab && article.id) {
            try {
                const { data } = await withTimeout(sb.from('rnp_articles')
                    .select('manual_data')
                    .eq('cabinet_id', cab)
                    .eq('id', article.id)
                    .maybeSingle(), queryTimeoutMs());
                if (data) article.manual_data = data.manual_data;
            } catch (_) { /* gallery stays empty */ }
        }
        const gallery = galleryUrlsFromManual(article.manual_data, nm);
        const photos = bindExactArticlePhotos({
            nmId: nm,
            cardPhotos: hit && hit.photos,
            articlePhoto: article.photo_url,
            gallery,
        });
        const bound = {
            nmId: nm,
            title: (hit && hit.title) || article.name || ('Артикул ' + nm),
            photos,
            photo_url: photos[0] || '',
            price: hit ? hit.price : null,
            composition: (hit && hit.composition) || '',
            vendorCode: (hit && hit.vendorCode) || '',
            brand: (hit && hit.brand) || '',
            description: (hit && hit.description) || '',
            localName: article.name,
            article_id: article.id,
            cost_price: article.cost_price,
            exact: true,
        };
        state.card = bound;
        return bound;
    }

    async function findArticleByNmId(nmId) {
        const id = Number(nmId);
        if (!id || !sb || !cab) return null;
        const local = state.articles.find((a) => Number(a.nm_id) === id);
        if (local) return local;
        const { data, error } = await withTimeout(sb.from('rnp_articles')
            .select('id, nm_id, name, photo_url, is_active, cost_price, manual_data')
            .eq('cabinet_id', cab)
            .eq('nm_id', id)
            .maybeSingle(), queryTimeoutMs());
        if (error) throw error;
        if (data) {
            if (!state.articleMap[data.id]) {
                state.articles.push(data);
                state.articleMap[data.id] = data;
            }
        }
        return data || null;
    }

    function emptyForm(dayYmd) {
        return {
            id: null,
            article_id: '',
            platform: 'instagram',
            status: 'draft',
            blogger_id: '',
            publish_at: dayYmd ? dayYmd + 'T12:00' : '',
            file_url: '',
            post_url: '',
            caption: '',
            composition_text: '',
            brand_name: '',
            slide_urls: [],
            post_kind: 'feed',
            title: '',
            source: 'manual',
            views: 0,
        };
    }
    function formFromPost(p) {
        const at = p.publish_at ? new Date(p.publish_at) : null;
        const local = at && Number.isFinite(at.getTime())
            ? `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`
            : '';
        return {
            id: p.id,
            article_id: p.article_id,
            platform: p.platform,
            status: p.status,
            blogger_id: p.blogger_id || '',
            publish_at: local,
            file_url: p.file_url || '',
            post_url: p.post_url || '',
            caption: p.caption || '',
            composition_text: p.composition_text || '',
            brand_name: p.brand_name || '',
            slide_urls: Array.isArray(p.slide_urls) ? p.slide_urls : [],
            post_kind: p.post_kind === 'story' ? 'story' : 'feed',
            title: p.title || '',
            source: p.source || 'manual',
            tg_note: p.tg_note || '',
            views: p.views || 0,
            error_text: p.error_text || '',
            approved_at: p.approved_at || null,
        };
    }
    function publishAtIso(local) {
        if (!local) return null;
        const d = new Date(local);
        return Number.isFinite(d.getTime()) ? d.toISOString() : null;
    }

    async function savePost(form, extra) {
        if (state.own) return saveOwnPost(form, extra);
        if (!form.article_id && form.source !== 'telegram') throw new Error('Выберите артикул');
        const patch = Object.assign({
            cabinet_id: cab,
            article_id: form.article_id || null,
            title: form.title || null,
            platform: form.platform,
            status: form.status,
            blogger_id: form.blogger_id || null,
            publish_at: publishAtIso(form.publish_at),
            file_url: form.file_url || null,
            post_url: form.post_url || null,
            caption: form.caption || null,
            composition_text: form.composition_text || null,
            brand_name: form.brand_name || null,
            slide_urls: form.slide_urls || [],
            post_kind: form.post_kind === 'story' ? 'story' : 'feed',
            approved_at: form.approved_at || null,
        }, extra || {});
        if ((patch.status === 'scheduled' || patch.status === 'published') && !patch.approved_at) {
            patch.status = 'review';
        }
        if (patch.status === 'scheduled' && !patch.publish_at) throw new Error('Для отложенной публикации укажите дату');
        if (form.id) {
            const { error } = await sb.from('content_posts').update(patch).eq('id', form.id).eq('cabinet_id', cab);
            if (error) throw error;
            return form.id;
        }
        const { data, error } = await sb.from('content_posts').insert(patch).select('id').single();
        if (error) throw error;
        return data.id;
    }

    async function saveOwnPost(form, extra) {
        const slides = (form.slide_urls || []).filter(Boolean);
        const patch = Object.assign({
            platform: 'instagram',
            status: form.status,
            title: form.title || null,
            publish_at: publishAtIso(form.publish_at),
            file_url: form.file_url || slides[0] || null,
            caption: form.caption || null,
            slide_urls: slides,
            post_kind: form.post_kind === 'story' ? 'story' : 'feed',
            approved_at: form.approved_at || null,
            updated_at: new Date().toISOString(),
        }, extra || {});
        if ((patch.status === 'scheduled' || patch.status === 'published') && !patch.approved_at) patch.status = 'review';
        if (patch.status === 'scheduled' && !patch.publish_at) throw new Error('Для отложенной публикации укажите дату');
        if (form.id) {
            const { error } = await sb.from('nr_content_posts').update(patch).eq('id', form.id);
            if (error) throw error;
            return form.id;
        }
        const { data, error } = await sb.from('nr_content_posts').insert(patch).select('id').single();
        if (error) throw error;
        return data.id;
    }

    async function deletePost(id) {
        const { error } = await scoped(sb.from(tbl()).delete().eq('id', id));
        if (error) throw error;
    }

    async function saveBlogger(row) {
        const platforms = Array.isArray(row.platforms) ? row.platforms : [];
        const patch = {
            cabinet_id: cab,
            name: String(row.name || '').trim(),
            platforms,
            rate_per_video: num(row.rate_per_video),
            bonus_views_threshold: Math.round(num(row.bonus_views_threshold)),
            bonus_amount: num(row.bonus_amount),
        };
        if (!patch.name) throw new Error('Имя блогера');
        if (row.id) {
            const { error } = await sb.from('bloggers').update(patch).eq('id', row.id).eq('cabinet_id', cab);
            if (error) throw error;
            return row.id;
        }
        const { data, error } = await sb.from('bloggers').insert(patch).select('id').single();
        if (error) throw error;
        return data.id;
    }

    async function savePayout(bloggerId, postId, views) {
        const blogger = bloggerOf(bloggerId);
        const accrued = computePayoutFrom(blogger, views);
        const row = {
            cabinet_id: cab,
            blogger_id: bloggerId,
            post_id: postId,
            month: state.payoutMonth,
            actual_views: Math.round(num(views)),
            accrued,
        };
        const existing = state.payouts.find((p) => p.blogger_id === bloggerId && p.post_id === postId);
        if (existing) {
            const { error } = await sb.from('blogger_payouts').update(row).eq('id', existing.id);
            if (error) throw error;
        } else {
            const { error } = await sb.from('blogger_payouts').insert(row);
            if (error) throw error;
        }
    }
    function computePayoutFrom(blogger, views) {
        if (!blogger) return 0;
        return computePayout(blogger.rate_per_video, views, blogger.bonus_views_threshold, blogger.bonus_amount);
    }

    function onClick(e) {
        const t = e.target.closest('[data-cf]');
        if (!t) return;
        const act = t.getAttribute('data-cf');
        const id = t.getAttribute('data-id') || '';
        handle(act, id, t).catch((err) => {
            if (isMissingTable(err)) return;
            toast('error', 'Контент-завод', err.message || String(err));
        });
    }
    function onChange(e) {
        const t = e.target;
        if (!t || !t.getAttribute) return;
        const act = t.getAttribute('data-cf-change');
        if (!act) return;
        handle(act, t.value, t).catch((err) => {
            if (isMissingTable(err)) return;
            toast('error', 'Контент-завод', err.message || String(err));
        });
    }

    async function approvePost(p) {
        const slides = Array.isArray(p.slide_urls) ? p.slide_urls.filter(Boolean) : [];
        if (!slides.length && !p.file_url) throw new Error('Нет слайдов — подтверждать нечего');
        const nowIso = new Date().toISOString();
        const at = p.publish_at ? new Date(p.publish_at).getTime() : 0;
        const goNow = !at || at <= Date.now();
        if (p.platform === 'instagram' && goNow) {
            const { error } = await scoped(sb.from(tbl()).update({
                approved_at: nowIso,
                status: 'review',
                error_text: null,
                updated_at: nowIso,
            }).eq('id', p.id));
            if (error) throw error;
            toast('info', 'Публикуем в Instagram', 'Это занимает до полминуты, повторно нажимать не нужно');
            await callFn('content-ig-publish', { post_id: p.id, dry_run: false, own: state.own }, FN_LONG_MS);
        } else {
            const { error } = await scoped(sb.from(tbl()).update({
                approved_at: nowIso,
                status: 'scheduled',
                updated_at: nowIso,
            }).eq('id', p.id));
            if (error) throw error;
        }
        await reload();
        toast('success', 'Подтверждено', goNow && p.platform === 'instagram' ? 'В Instagram' : 'В слот по дате');
        return;
    }

    async function handle(act, id, el) {
        if (act === 'view') {
            state.view = id;
            state.form = null;
            if (id === 'create') { state.form = emptyForm(''); state.fmt = 'post'; state.carouselUrls = []; state.card = null; }
            paint();
            if (id === 'instagram') void ensureIg();
            return;
        }
        if (act === 'acc') {
            if (state.own) {
                state.own = false; state.posts = []; state.loadedCab = ''; state.form = null; state.view = 'overview';
                state.loadGen += 1; paint(); void reload();
                if (id && id !== cab && typeof root.nrSelectCabinet === 'function') root.nrSelectCabinet(id);
                return;
            }
            if (id && id !== cab && typeof root.nrSelectCabinet === 'function') root.nrSelectCabinet(id);
            return;
        }
        if (act === 'acc-own') {
            if (!isSuperAdminUi()) return;
            state.own = true; state.posts = []; state.articles = []; state.articleMap = {}; state.bloggers = []; state.payouts = [];
            state.loadedCab = ''; state.form = null; state.card = null; state.view = 'overview'; state.fmt = 'post'; state.loadGen += 1;
            paint(); void reload();
            return;
        }
        if (act === 'own-settings') {
            const b = typeof document !== 'undefined' && document.getElementById('cf-ig-btn');
            if (b) b.click();
            return;
        }
        if (act === 'acc-more') { state.accAll = !state.accAll; paint(); return; }
        if (act === 'fmt') {
            if (state.form) state.form = readForm();
            state.fmt = id;
            paint();
            return;
        }
        if (act === 'pick-photo') {
            if (state.form) { state.form = readForm(); state.form.file_url = el.getAttribute('data-url') || ''; }
            paint();
            return;
        }
        if (act === 'rm-photo') {
            if (!state.form) return;
            state.form = readForm();
            const list = (state.form.slide_urls || []).slice();
            list.splice(Number(id), 1);
            state.form.slide_urls = list;
            state.form.file_url = list[0] || '';
            paint();
            return;
        }
        if (act === 'tg-mode' || act === 'tg-target' || act === 'tg-timing') {
            const d = readTg();
            if (act === 'tg-mode') d.mode = id; else if (act === 'tg-target') d.target = id; else d.timing = id;
            paint();
            return;
        }
        if (act === 'tg-bot-save') {
            const token = (document.getElementById('cf-tg-bot-token') || {}).value;
            const r = await callFn('content-tg-source', { action: 'save_bot', token }, FN_LONG_MS);
            state.tg = Object.assign({}, state.tg, { bot: r.bot, loaded: true });
            paint();
            toast('success', 'Бот контента', 'Подключён, посты из каналов будут приходить');
            return;
        }
        if (act === 'tg-save' || act === 'tg-check') {
            const d = act === 'tg-save' ? readTg() : tgDraft();
            const body = act === 'tg-save' ? {
                action: 'save', channel: d.channel, mode: d.mode, target: d.target,
                delay_minutes: d.timing === 'delay' ? d.delay_minutes : (state.tg.source ? state.tg.source.delay_minutes : 120),
                daily_time: d.timing === 'daily' ? d.daily_time : '',
                take_text: d.take_text, take_albums: d.take_albums, strip_links: d.strip_links, add_signature: d.add_signature, signature: d.signature,
            } : { action: 'check' };
            const r = await callFn('content-tg-source', body, FN_LONG_MS);
            state.tg = Object.assign({}, state.tg, { source: r.source, bot: r.bot || state.tg.bot, loaded: true });
            state.tgForm = null;
            paint();
            const ok = r.check && r.check.ok;
            toast(ok ? 'success' : 'warning', ok ? 'Канал подключён' : 'Бот не администратор канала', ok ? (r.source.chat_title || 'Посты будут приходить в очередь') : 'Добавьте бота администратором канала и нажмите «Проверить канал»');
            return;
        }
        if (act === 'tg-remove') {
            const ok = root.NrUi && root.NrUi.confirm ? await root.NrUi.confirm({ title: 'Отвязать канал?', text: 'Новые посты из Telegram перестанут приходить. Уже полученные останутся в очереди.', confirmLabel: 'Отвязать', danger: true }) : true;
            if (!ok) return;
            const r = await callFn('content-tg-source', { action: 'remove' }, FN_LONG_MS);
            state.tg = Object.assign({}, state.tg, { source: r.source, loaded: true });
            state.tgForm = null;
            paint();
            return;
        }
        if (act === 'q-filter') { state.qFilter = id; paint(); return; }
        if (act === 'q-date') {
            const p = state.posts.find((x) => x.id === el.getAttribute('data-pid'));
            if (!p) return;
            const iso = publishAtIso(id);
            const { error } = await scoped(sb.from(tbl()).update({ publish_at: iso, updated_at: new Date().toISOString() }).eq('id', p.id));
            if (error) throw error;
            p.publish_at = iso;
            return;
        }
        if (act === 'approve-all') {
            const list = state.posts.filter((p) => p.status === 'review' && (p.file_url || (Array.isArray(p.slide_urls) && p.slide_urls.filter(Boolean).length)));
            if (!list.length) return;
            const ok = root.NrUi && root.NrUi.confirm ? await root.NrUi.confirm({ title: 'Подтвердить ' + list.length + ' постов?', text: 'Посты с датой в будущем встанут в расписание, остальные уйдут в Instagram сразу.', confirmLabel: 'Подтвердить все' }) : true;
            if (!ok) return;
            for (const p of list) await handle('approve-post', p.id, el);
            return;
        }
        if (act === 'mark-done') {
            const { error } = await scoped(sb.from(tbl()).update({ status: 'published', tg_note: 'Опубликовано вручную', updated_at: new Date().toISOString() }).eq('id', id));
            if (error) throw error;
            await reload();
            return;
        }
        if (act === 'hide-post') {
            await deletePost(id);
            await reload();
            return;
        }
        if (act === 'when') {
            const inp = document.getElementById('cf-f-at') || document.getElementById('cf-car-at');
            if (!inp) return;
            const d = new Date();
            if (id === 'tomorrow') d.setDate(d.getDate() + 1);
            d.setHours(12, 0, 0, 0);
            inp.value = id === 'now' ? '' : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
            return;
        }
        if (act === 'mode') { state.listMode = id; paint(); return; }
        if (act === 'prev-month') {
            state.cursor = new Date(state.cursor.getFullYear(), state.cursor.getMonth() - 1, 1);
            paint(); return;
        }
        if (act === 'next-month') {
            state.cursor = new Date(state.cursor.getFullYear(), state.cursor.getMonth() + 1, 1);
            paint(); return;
        }
        if (act === 'filter-platform') { state.filters.platform = id; paint(); return; }
        if (act === 'filter-blogger') { state.filters.blogger = id; paint(); return; }
        if (act === 'filter-status') { state.filters.status = id; paint(); return; }
        if (act === 'new-day') { state.form = emptyForm(id); state.fmt = 'post'; state.carouselUrls = []; state.card = null; state.backView = state.view === 'create' ? 'calendar' : state.view; state.view = 'create'; paint(); return; }
        if (act === 'edit-post') {
            const p = state.posts.find((x) => x.id === id);
            if (!p) return;
            state.form = formFromPost(p);
            state.fmt = state.form.post_kind === 'story' ? 'story' : 'post';
            state.backView = state.view === 'create' ? 'calendar' : state.view;
            state.view = 'create';
            const art = articleOf(p);
            if (art) pullArticleCard(art).then(() => paint());
            paint(); return;
        }
        if (act === 'close-form') { state.form = null; state.view = state.backView || 'calendar'; paint(); return; }
        if (act === 'pick-article') {
            const art = state.articleMap[id];
            if (art) return handle('lookup-nm', art.nm_id, el);
            return;
        }
        if (act === 'lookup-nm') {
            const raw = id || (document.getElementById('cf-f-nm') || document.getElementById('cf-car-nm') || {}).value;
            const art = await findArticleByNmId(raw);
            if (!art) throw new Error('Нет nmId ' + raw);
            state.carouselUrls = [];
            if (state.form) {
                state.form.article_id = art.id;
                state.form.slide_urls = [];
                state.form.file_url = '';
            }
            const card = await pullArticleCard(art);
            if (card && state.form) {
                if (!state.form.composition_text) state.form.composition_text = card.composition || '';
                if (!state.form.brand_name) state.form.brand_name = card.brand || '';
            }
            paint();
            return;
        }
        if (act === 'save-post') {
            const form = readForm();
            if (form.status === 'published' || form.status === 'scheduled') form.status = 'review';
            await savePost(form);
            state.form = null;
            state.view = 'calendar';
            await reload();
            toast('success', 'Сохранено', 'Черновик в календаре');
            return;
        }
        if (act === 'to-review') {
            const form = readForm();
            form.status = 'review';
            if (!((form.slide_urls && form.slide_urls.length) || form.file_url || (state.carouselUrls && state.carouselUrls.length))) {
                throw new Error('Соберите слайды');
            }
            if (state.carouselUrls && state.carouselUrls.length) form.slide_urls = state.carouselUrls;
            await savePost(form, { status: 'review' });
            state.form = null;
            state.view = 'review';
            await reload();
            toast('info', 'Очередь', 'Ждёт подтверждения');
            return;
        }
        if (act === 'approve-post') {
            const p = state.posts.find((x) => x.id === id);
            if (!p) return;
            if (state.busy[id]) return; // уже идёт: повторные нажатия не публикуют второй раз
            state.busy[id] = true;
            paint();
            try { await approvePost(p); } finally { delete state.busy[id]; paint(); }
            return;
        }
        if (act === 'reject-post') {
            const { error } = await scoped(sb.from(tbl()).update({
                status: 'draft',
                approved_at: null,
            }).eq('id', id));
            if (error) throw error;
            await reload();
            return;
        }
        if (act === 'delete-post') {
            if (!state.form || !state.form.id) return;
            await deletePost(state.form.id);
            state.form = null;
            await reload();
            return;
        }
        if (act === 'new-blogger') {
            await saveBlogger({
                name: (document.getElementById('cf-b-name') || {}).value,
                platforms: [...rootEl().querySelectorAll('input[name="cf-b-plat"]:checked')].map((i) => i.value),
                rate_per_video: (document.getElementById('cf-b-rate') || {}).value,
                bonus_views_threshold: (document.getElementById('cf-b-thr') || {}).value,
                bonus_amount: (document.getElementById('cf-b-bonus') || {}).value,
            });
            ['cf-b-name', 'cf-b-rate', 'cf-b-thr', 'cf-b-bonus'].forEach((i) => {
                const n = document.getElementById(i); if (n) n.value = '';
            });
            await reload();
            return;
        }
        if (act === 'del-blogger') {
            const { error } = await sb.from('bloggers').delete().eq('id', id).eq('cabinet_id', cab);
            if (error) throw error;
            await reload();
            return;
        }
        if (act === 'payout-month') {
            state.payoutMonth = (id || '').slice(0, 7) + '-01';
            await loadPayouts();
            paint();
            return;
        }
        if (act === 'payout-views') {
            const bloggerId = el.getAttribute('data-blogger');
            const postId = el.getAttribute('data-post');
            await savePayout(bloggerId, postId, el.value);
            await Promise.all([loadPayouts(), loadPosts()]);
            paint();
            return;
        }
        if (act === 'carousel-article') {
            const art = state.articleMap[id];
            if (art) return handle('lookup-nm', art.nm_id, el);
            return;
        }
        if (act === 'gen-carousel') {
            const raw = (document.getElementById('cf-car-nm') || {}).value;
            const art = await findArticleByNmId(raw);
            if (!art) throw new Error('Укажите nmId');
            const card = await pullArticleCard(art);
            if (!card || !(card.photos && card.photos.length)) {
                throw new Error('Нет фото nmId ' + art.nm_id);
            }
            const composition = (document.getElementById('cf-car-comp') || {}).value || card.composition || '';
            const brand = (document.getElementById('cf-car-brand') || {}).value || card.brand || '';
            const js = await callFn('content-carousel', {
                photos: card.photos,
                extra_photos: state.extraPhotos,
                title: card.title || art.name,
                nm_id: art.nm_id,
                composition,
                brand,
                price: card.price,
                vendor_code: card.vendorCode,
                description: card.description || '',
            }, FN_LONG_MS);
            state.carouselUrls = js.urls || [];
            if (!state.carouselUrls.length) throw new Error('Слайды не собрались');
            paint();
            return;
        }
        if (act === 'save-carousel-draft') {
            const raw = (document.getElementById('cf-car-nm') || {}).value;
            const art = await findArticleByNmId(raw);
            if (!art) throw new Error('Укажите nmId');
            if (!state.carouselUrls.length) throw new Error('Соберите слайды');
            await savePost({
                id: null,
                article_id: art.id,
                platform: 'instagram',
                status: 'review',
                blogger_id: '',
                publish_at: '',
                file_url: state.carouselUrls[0],
                post_url: '',
                caption: (document.getElementById('cf-car-cap') || {}).value || '',
                publish_at: (document.getElementById('cf-car-at') || {}).value || '',
                composition_text: (document.getElementById('cf-car-comp') || {}).value || '',
                brand_name: (document.getElementById('cf-car-brand') || {}).value || '',
                slide_urls: state.carouselUrls,
            }, { status: 'review' });
            state.view = 'review';
            await reload();
            toast('info', 'Очередь', 'Ждёт подтверждения');
            return;
        }
        if (act === 'ig-store') {
            const token = (document.getElementById('cf-ig-token') || {}).value;
            const igUser = (document.getElementById('cf-ig-user') || {}).value;
            await callFn('content-ig-oauth', { action: 'store_token', token, ig_user_id: igUser });
            const inp = document.getElementById('cf-ig-token');
            if (inp) inp.value = '';
            await loadIg();
            paint();
            toast('success', 'Instagram', 'Токен сохранён');
            return;
        }
        if (act === 'ig-oauth') {
            const js = await callFn('content-ig-oauth', { action: 'oauth_url' });
            if (js.url) location.href = js.url;
            return;
        }
        if (act === 'ig-off') {
            await callFn('content-ig-oauth', { action: 'disconnect' });
            await loadIg();
            paint();
            return;
        }
        if (act === 'move-post') {
            const pid = el.getAttribute('data-pid');
            const p = state.posts.find((x) => x.id === pid);
            if (!p || p.status === 'published') return;
            const old = p.publish_at ? new Date(p.publish_at) : new Date(id + 'T12:00:00');
            const to = new Date(id + 'T00:00:00');
            to.setHours(old.getHours(), old.getMinutes(), 0, 0);
            const { error } = await scoped(sb.from(tbl()).update({ publish_at: to.toISOString(), updated_at: new Date().toISOString() }).eq('id', pid));
            if (error) throw error;
            await reload();
            toast('success', 'Перенесено', to.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }));
            return;
        }
        if (act === 'wb-search') {
            const art = state.articles[0];
            if (!art || !callWb) {
                state.searchTexts = { error: 'Нет артикулов' };
                paint();
                return;
            }
            try {
                const data = await callWb('seo_search_texts', {
                    nmId: art.nm_id,
                    dateFrom: ymd(new Date(Date.now() - 14 * 86400000)),
                    dateTo: ymd(new Date()),
                });
                state.searchTexts = data;
            } catch (e) {
                state.searchTexts = { error: e.message || 'WB search-report недоступен (нужна подписка «Джем»)' };
            }
            paint();
            return;
        }
    }

    function readForm() {
        const f = Object.assign({}, state.form || emptyForm());
        f.article_id = (document.getElementById('cf-f-art') || {}).value || f.article_id;
        f.platform = (document.getElementById('cf-f-plat') || {}).value || f.platform;
        f.status = (document.getElementById('cf-f-status') || {}).value || f.status;
        f.blogger_id = (document.getElementById('cf-f-blogger') || {}).value || '';
        f.publish_at = (document.getElementById('cf-f-at') || {}).value || '';
        f.file_url = (document.getElementById('cf-f-file') || {}).value || '';
        f.post_url = (document.getElementById('cf-f-url') || {}).value || '';
        f.caption = (document.getElementById('cf-f-cap') || {}).value || '';
        f.composition_text = (document.getElementById('cf-f-comp') || {}).value || '';
        f.brand_name = (document.getElementById('cf-f-brand') || {}).value || '';
        f.post_kind = state.fmt === 'story' ? 'story' : 'feed';
        if (freeForm()) f.title = (document.getElementById('cf-f-title') || {}).value || '';
        return f;
    }

    function paint() {
        const el = rootEl();
        if (!el) return;
        el.innerHTML = [
            accountsHtml(),
            navHtml(),
            state.err ? `<div class="cf-err">${escapeHtml(state.err)}</div>` : '',
            `<div class="cf-screen" data-view="${state.view}">`,
            state.view === 'overview' ? overviewHtml() : '',
            state.view === 'calendar' ? calendarHtml() : '',
            state.view === 'create' ? createHtml() : '',
            state.view === 'review' ? reviewHtml() : '',
            state.view === 'bloggers' ? bloggersHtml() : '',
            state.view === 'instagram' ? igHtml() : '',
            state.view === 'dashboard' ? dashHtml() : '',
            '</div>',
        ].join('');
        bindExtra();
        placePill();
    }

    /* Пояснение прячем за значком «?»: видно при наведении и нажатии, место не занимает */
    function tip(text) {
        const t = escapeHtml(text);
        return `<span class="cf-i" tabindex="0" data-tip="${t}" aria-label="${t}">?</span>`;
    }

    /* ── Выбор Instagram (кабинет) ── */
    const AV = ['', 'b', 'c', 'd'];
    function avClass(id) { let h = 0; String(id).split('').forEach((ch) => { h = (h * 31 + ch.charCodeAt(0)) >>> 0; }); return AV[h % AV.length]; }
    function initial(name) { return escapeHtml(String(name || '?').trim().charAt(0).toUpperCase() || '?'); }
    function isSuperAdminUi() {
        if (typeof document === 'undefined') return false;
        const b = document.getElementById('cf-ig-bar');
        return !!(b && b.style.display !== 'none');
    }
    function accountsHtml() {
        const list = state.accounts.length ? state.accounts : [{ id: cab, name: 'Кабинет' }];
        const many = list.length > 6;
        const q = String(state.accQuery || '').toLowerCase();
        let shown = q ? list.filter((a) => a.name.toLowerCase().includes(q)) : list;
        if (many && !state.accAll && !q) {
            const cur = list.find((a) => a.id === cab);
            shown = list.slice(0, 6);
            if (cur && !shown.includes(cur)) shown = shown.slice(0, 5).concat(cur);
        }
        const cards = shown.map((a) => {
            const r = igRow(a.id);
            const ok = igConnected(a.id);
            const ts = ok ? tokenState(r.token_expires_at) : { level: 'none' };
            const dot = !ok ? 'g' : (ts.level === 'bad' ? 'r' : ts.level === 'warn' ? 'a' : '');
            const title = !state.accLoaded ? '' : ok ? ('@' + (r.ig_username || 'instagram') + (ts.level === 'warn' ? ' · токен истекает' : ts.level === 'bad' ? ' · токен истёк' : '')) : 'Instagram не подключён';
            return `<button type="button" class="cf-acc${a.id === cab && !state.own ? ' on' : ''}" data-cf="acc" data-id="${escapeHtml(a.id)}" title="${escapeHtml(title)}">
                <span class="cf-av ${avClass(a.id)}">${initial(a.name)}</span><b>${escapeHtml(a.name)}</b><i class="cf-dot ${dot}"></i>
            </button>`;
        }).join('');
        const own = isSuperAdminUi()
            ? `<button type="button" class="cf-acc cf-acc-own${state.own ? ' on' : ''}" data-cf="acc-own" title="@${escapeHtml((ownTokenRow() && ownTokenRow().ig_username) || 'nurcon.kg')} · наш аккаунт"><span class="cf-av">N</span><b>NR Space</b><i class="cf-dot ${ownTokenRow() ? '' : 'g'}"></i></button>` : '';
        const more = many && !q ? `<button type="button" class="cf-acc cf-acc-add" data-cf="acc-more"><b>${state.accAll ? 'Свернуть' : 'Все ' + list.length}</b></button>` : '';
        const search = many && state.accAll ? `<input class="cf-acc-q" id="cf-acc-q" placeholder="Найти кабинет" value="${escapeHtml(state.accQuery || '')}">` : '';
        return `${search}<div class="cf-accs">${own}${cards}${more}</div>`;
    }
    function statusHtml() {
        const r = state.own ? ownTokenRow() : igRow(cab);
        const ok = state.own ? !!r : igConnected(cab);
        const ts = ok ? tokenState(r.token_expires_at) : { level: 'none', days: null };
        const now = new Date();
        const ms = monthStats(state.posts, now.getFullYear(), now.getMonth());
        const loaded = state.own ? state.ownIg !== null : state.accLoaded;
        const tone = !loaded ? 'g' : !ok ? 'r' : ts.level === 'bad' ? 'r' : ts.level === 'warn' ? 'a' : '';
        const who = !loaded ? 'Проверяем подключение…' : ok ? '@' + (r.ig_username || 'instagram') : 'Instagram не подключён';
        const tok = ok && ts.days != null ? ` · ${ts.level === 'bad' ? 'токен истёк' : 'токен ещё ' + ts.days + ' дн.'}` : '';
        const text = `${who}${tok} · ${ms.published} опубл. · ${ms.planned} в плане · ${ms.views.toLocaleString('ru-RU')} просм.`;
        const t = escapeHtml(text);
        return `<div class="cf-stat-l"><i class="cf-dot ${tone}"></i><span class="cf-i cf-i-r" tabindex="0" data-tip="${t}" aria-label="${t}">?</span>
            <button type="button" class="cf-gear" data-cf="${state.own ? 'own-settings' : 'view'}" data-id="instagram" title="Настройки Instagram" aria-label="Настройки Instagram">⚙</button></div>`;
    }
    function navHtml() {
        const queue = state.posts.filter((p) => p.status === 'review').length;
        return `<div class="cf-navwrap"><div class="cf-tabs" id="cf-tabs">${VIEWS.filter((v) => !(state.own && v.id === 'bloggers')).map((v) =>
            `<button type="button" class="${state.view === v.id ? 'on' : ''}" data-cf="view" data-id="${v.id}">${v.label}${v.id === 'review' && queue ? `<span class="cf-badge">${queue}</span>` : ''}</button>`
        ).join('')}<span class="cf-pill"></span></div>${statusHtml()}</div>${nmDatalistHtml()}`;
    }
    function placePill() {
        if (typeof document === 'undefined') return;
        const box = document.getElementById('cf-tabs');
        if (!box) return;
        const on = box.querySelector('button.on');
        const pill = box.querySelector('.cf-pill');
        if (!pill) return;
        if (!on) { pill.style.opacity = '0'; return; }
        pill.style.opacity = '1';
        pill.style.width = on.offsetWidth + 'px';
        pill.style.transform = 'translateX(' + on.offsetLeft + 'px)';
    }

    /* ── Обзор ── */
    function thumbOf(p) {
        const art = articleOf(p);
        const slides = (Array.isArray(p.slide_urls) ? p.slide_urls : []).filter(Boolean);
        return slides[0] || p.file_url || (art && art.photo_url) || '';
    }
    function thumbHtml(p, cls) {
        const u = thumbOf(p);
        return u ? `<img class="cf-th ${cls || ''}" src="${escapeHtml(u)}" alt="" loading="lazy">` : `<span class="cf-th cf-th-ph ${cls || ''} ${avClass(p.id)}"></span>`;
    }
    function postTitle(p) {
        const art = articleOf(p);
        return p.title || (art && (art.name || String(art.nm_id))) || (state.own ? 'Пост NR Space' : 'Пост');
    }
    function kindLabel(p) {
        if (p.post_kind === 'story') return 'Сторис';
        return Array.isArray(p.slide_urls) && p.slide_urls.filter(Boolean).length > 1 ? 'Карусель' : 'Пост';
    }
    function whenLabel(p) {
        if (!p.publish_at) return 'без даты';
        const d = new Date(p.publish_at);
        return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    }
    function overviewHtml() {
        const now = new Date();
        const ok = state.own ? !!ownTokenRow() : igConnected(cab);
        const r = state.own ? ownTokenRow() : igRow(cab);
        const ts = ok ? tokenState(r.token_expires_at) : { level: 'none', days: null };
        const act = state.own ? 'own-settings' : 'view';
        const loaded = state.own ? state.ownIg !== null : state.accLoaded;
        let banner = '';
        if (loaded && !ok) {
            banner = `<div class="cf-warn bad"><span class="cf-dot r"></span><span>${state.own ? 'Instagram NR Space не подключён' : 'Instagram этого кабинета не подключён'}: публиковать пока нельзя.</span><button type="button" class="ui-btn ui-btn-primary" data-cf="${act}" data-id="instagram">Подключить</button></div>`;
        } else if (ts.level === 'warn' || ts.level === 'bad') {
            banner = `<div class="cf-warn"><span class="cf-dot a"></span><span>${ts.level === 'bad' ? 'Токен Instagram истёк.' : 'Токен Instagram истекает через ' + ts.days + ' дн.'} Переподключите, чтобы публикации не остановились.</span><button type="button" class="ui-btn ui-btn-primary" data-cf="${act}" data-id="instagram">Переподключить</button></div>`;
        }
        const todo = todoItems(state.posts).map((t) => {
            if (t.kind === 'review') return `<div class="cf-todo w"><b>${t.n} ${t.n === 1 ? 'пост ждёт' : 'поста ждут'} подтверждения</b>${tip('Проверьте слайды и нажмите «Подтвердить»')}<button type="button" class="ui-btn ui-btn-primary" data-cf="view" data-id="review">Открыть очередь</button></div>`;
            if (t.kind === 'error') return `<div class="cf-todo e"><b>${t.n} ${t.n === 1 ? 'пост не опубликовался' : 'поста не опубликовались'}</b>${tip('Причина указана в очереди, можно повторить')}<button type="button" class="ui-btn ui-btn-secondary" data-cf="view" data-id="review">Посмотреть</button></div>`;
            return `<div class="cf-todo i"><b>На неделю ничего не запланировано</b>${tip('Создайте пост, чтобы аккаунт не молчал')}<button type="button" class="ui-btn ui-btn-secondary" data-cf="view" data-id="create">Создать</button></div>`;
        }).join('');
        const up = upcomingPosts(state.posts, 3).map((p) =>
            `<button type="button" class="cf-li" data-cf="edit-post" data-id="${p.id}">${thumbHtml(p)}<span><b>${escapeHtml(postTitle(p))}</b><small>${kindLabel(p)} · ${whenLabel(p)}</small></span></button>`).join('');
        return `${banner}
        <div class="cf-grid2">
            <div class="cf-card"><h3>Нужно сделать</h3>${todo || '<div class="cf-muted">Всё в порядке</div>'}</div>
            <div class="cf-card"><h3>Ближайшие публикации</h3>${up || '<div class="cf-muted">Ничего не запланировано</div>'}</div>
        </div>`;
    }

    function nmDatalistHtml() {
        return `<datalist id="cf-nm-list">${state.articles.map((a) =>
            `<option value="${escapeHtml(String(a.nm_id))}">${escapeHtml(a.name || ('nmId ' + a.nm_id))}</option>`
        ).join('')}</datalist>`;
    }

    function filtersHtml() {
        const plat = [`<option value="">Все площадки</option>`]
            .concat(PLATFORMS.map((p) => `<option value="${p.id}"${state.filters.platform === p.id ? ' selected' : ''}>${p.label}</option>`)).join('');
        const blogs = [`<option value="">Все блогеры</option>`]
            .concat(state.bloggers.map((b) => `<option value="${b.id}"${state.filters.blogger === b.id ? ' selected' : ''}>${escapeHtml(b.name)}</option>`)).join('');
        const st = [`<option value="">Все статусы</option>`]
            .concat(STATUSES.map((s) => `<option value="${s.id}"${state.filters.status === s.id ? ' selected' : ''}>${s.label}</option>`)).join('');
        return `<div class="cf-filters">
            <select data-cf-change="filter-platform">${plat}</select>
            <select data-cf-change="filter-blogger">${blogs}</select>
            <select data-cf-change="filter-status">${st}</select>
            <div class="cf-mode">
                <button type="button" class="cf-chip${state.listMode === 'calendar' ? ' on' : ''}" data-cf="mode" data-id="calendar">Месяц</button>
                <button type="button" class="cf-chip${state.listMode === 'table' ? ' on' : ''}" data-cf="mode" data-id="table">Список</button>
            </div>
        </div>`;
    }

    function calendarHtml() {
        const y = state.cursor.getFullYear();
        const m = state.cursor.getMonth();
        const title = state.cursor.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
        const posts = filterPosts(state.posts, state.filters);
        const byDay = groupPostsByDay(posts, y, m);
        const head = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => `<div class="cf-cal-h">${d}</div>`).join('');
        const cells = calendarCells(y, m).map((d) => {
            if (!d) return '<div class="cf-cal-empty"></div>';
            const key = `${y}-${pad(m + 1)}-${pad(d)}`;
            const items = byDay[key] || [];
            return `<div class="cf-cal-day" data-cf="new-day" data-id="${key}">
                <div class="cf-cal-n">${d}</div>
                ${items.map((p) => {
                    return `<button type="button" class="cf-cal-post st-${p.status}" data-cf="edit-post" data-id="${p.id}"${p.status === 'published' ? '' : ' draggable="true"'} data-pid="${p.id}">${thumbHtml(p, 'cf-th-s')}<span>${escapeHtml(postTitle(p))}</span></button>`;
                }).join('')}
            </div>`;
        }).join('');
        return `<div class="cf-toolbar">
            <button type="button" class="ui-btn ui-btn-secondary" data-cf="prev-month">←</button>
            <div class="cf-month">${escapeHtml(title)}</div>
            <button type="button" class="ui-btn ui-btn-secondary" data-cf="next-month">→</button>
            <button type="button" class="ui-btn ui-btn-primary" data-cf="new-day" data-id="${ymd(new Date())}">+ Новый пост</button>
        </div>
        ${filtersHtml()}
        ${state.listMode === 'calendar' ? `<div class="cf-cal"><div class="cf-cal-week">${head}</div><div class="cf-cal-grid">${cells}</div></div>
        <div class="cf-legend"><span><i class="cf-dot g"></i>Черновик</span><span><i class="cf-dot a"></i>На подтверждении</span><span><i class="cf-dot b"></i>Запланировано</span><span><i class="cf-dot"></i>Опубликовано</span><span><i class="cf-dot r"></i>Ошибка</span>${tip('Перетащите пост на другой день, чтобы перенести')}</div>` : tableHtml(posts)}`;
    }

    function tableHtml(posts) {
        const rows = (posts || []).map((p) => {
            const art = articleOf(p);
            const b = bloggerOf(p.blogger_id);
            return `<tr>
                <td>${p.publish_at ? escapeHtml(new Date(p.publish_at).toLocaleString('ru-RU')) : '—'}</td>
                <td class="cf-art-cell">${art && art.photo_url ? `<img src="${escapeHtml(art.photo_url)}" alt="">` : ''}${escapeHtml((art && (art.name || art.nm_id)) || p.article_id)}</td>
                <td>${escapeHtml(platformLabel(p.platform))}</td>
                <td>${escapeHtml(b ? b.name : '—')}</td>
                <td><span class="cf-st st-${p.status}">${escapeHtml(statusLabel(p.status))}</span></td>
                <td>${num(p.views).toLocaleString('ru-RU')}</td>
                <td><button type="button" class="cf-link" data-cf="edit-post" data-id="${p.id}">Открыть</button></td>
            </tr>`;
        }).join('');
        return `<div class="cf-table-wrap"><table class="data-table cf-table">
            <thead><tr><th>Дата</th><th>Артикул</th><th>Площадка</th><th>Блогер</th><th>Статус</th><th>Просмотры</th><th></th></tr></thead>
            <tbody>${rows || '<tr><td colspan="7" class="cf-muted">Нет постов за фильтр</td></tr>'}</tbody>
        </table></div>`;
    }

    function articleNmInput(id, value) {
        return `<span class="cf-nm-row"><input id="${id}" list="cf-nm-list" type="text" inputmode="numeric" pattern="[0-9]*" placeholder="247347214" value="${escapeHtml(value || '')}" data-cf-change="lookup-nm" autocomplete="off"><button type="button" class="ui-btn ui-btn-secondary" data-cf="lookup-nm">Найти nmId</button></span>`;
    }

    function previewHtml(img, caption) {
        const a = state.own ? { id: 'nr-space', name: 'NR Space' } : (state.accounts.find((x) => x.id === cab) || { name: 'Кабинет' });
        const r = state.own ? ownTokenRow() : igRow(cab);
        const handle = (r && r.ig_username) || (state.own ? 'nurcon.kg' : String(a.name || 'instagram').toLowerCase().replace(/\s+/g, ''));
        const story = state.fmt === 'story';
        return `<div class="cf-prev-t">Как увидят в Instagram</div>
            <div class="cf-phone${story ? ' story' : ''}">
                <div class="cf-ph-top"><span class="cf-av ${avClass(cab)}">${initial(a.name)}</span><b>${escapeHtml(handle)}</b></div>
                <div class="cf-ph-img">${img ? `<img src="${escapeHtml(img)}" alt="">` : '<span class="cf-muted">Выберите фото</span>'}</div>
                ${story ? '' : `<div class="cf-ph-ac"><span>♡</span><span>◯</span><span>➤</span></div><div class="cf-ph-cap" id="cf-ph-cap"><b>${escapeHtml(handle)}</b> ${escapeHtml(caption || '')}</div>`}
            </div>`;
    }
    function createOwnHtml() {
        const f = state.form;
        const slides = (f.slide_urls || []).filter(Boolean);
        const fromTg = !state.own && f.source === 'telegram';
        const fmtTabs = fromTg ? `<div class="cf-fmt cf-fmt2"><button type="button" class="on" disabled>${state.fmt === 'story' ? 'Сторис' : 'Пост'}<small>из Telegram</small></button></div>` : `<div class="cf-fmt cf-fmt2">${FORMATS.filter((x) => x.id !== 'carousel').map((x) =>
            `<button type="button" class="${state.fmt === x.id ? 'on' : ''}" data-cf="fmt" data-id="${x.id}">${x.label}<small>${x.id === 'story' ? 'вертикальная' : '1 фото или несколько'}</small></button>`).join('')}</div>`;
        const pics = slides.length
            ? `<div class="cf-pics">${slides.map((u, i) => `<button type="button" data-cf="rm-photo" data-id="${i}" title="Убрать фото"><img src="${escapeHtml(u)}" alt=""></button>`).join('')}</div>${tip((slides.length > 1 ? 'Несколько фото уйдут каруселью. ' : '') + 'Нажмите на фото, чтобы убрать.')}` : '';
        const when = `<div class="cf-step"><h3><span class="cf-n">4</span>Когда${tip('Публикация идёт только после кнопки «Подтвердить» в очереди')}</h3>
            <div class="cf-when"><input id="cf-f-at" type="datetime-local" value="${escapeHtml(f.publish_at || '')}">
            <button type="button" class="cf-chip" data-cf="when" data-id="now">Сразу после подтверждения</button>
            <button type="button" class="cf-chip" data-cf="when" data-id="today">Сегодня 12:00</button>
            <button type="button" class="cf-chip" data-cf="when" data-id="tomorrow">Завтра 12:00</button></div>
            </div>`;
        return `<div class="cf-comp"><div class="cf-steps">
            <div class="cf-step"><h3><span class="cf-n">1</span>${fromTg ? 'Пост из Telegram' : 'Что публикуем'}${f.tg_note ? tip(f.tg_note) : ''}</h3>${fmtTabs}</div>
            ${f.error_text ? `<div class="cf-err">${escapeHtml(f.error_text)}</div>` : ''}
            <input type="hidden" id="cf-f-file" value="${escapeHtml(f.file_url || slides[0] || '')}">
            <input type="hidden" id="cf-f-status" value="${escapeHtml(f.status === 'published' || f.status === 'scheduled' ? 'review' : (f.status || 'draft'))}">
            <div class="cf-step"><h3><span class="cf-n">2</span>Фото</h3>
                <label class="cf-lab">Название поста (для себя)<input id="cf-f-title" value="${escapeHtml(f.title || '')}" placeholder="Например: кейс Zevina, сентябрь"></label>
                <label class="cf-lab">Загрузить фото<input id="cf-own-files" type="file" accept="image/*" multiple></label>
                ${pics}
            </div>
            <div class="cf-step"><h3><span class="cf-n">3</span>Подпись</h3>
                <textarea id="cf-f-cap" placeholder="Текст к посту и хэштеги">${escapeHtml(f.caption || '')}</textarea></div>
            ${when}
            <div class="cf-actions">
                <button type="button" class="ui-btn ui-btn-secondary" data-cf="close-form">Закрыть</button>
                ${f.id ? '<button type="button" class="ui-btn ui-btn-secondary" data-cf="delete-post">Удалить</button>' : ''}
                <span class="cf-sp"></span>
                <button type="button" class="ui-btn ui-btn-secondary" data-cf="save-post">Сохранить черновик</button>
                <button type="button" class="ui-btn ui-btn-primary" data-cf="to-review"${slides.length || f.file_url ? '' : ' disabled'}>В очередь на подтверждение</button>
            </div></div>
            <div>${previewHtml(slides[0] || f.file_url || '', f.caption)}</div></div>`;
    }
    function createHtml() {
        if (!state.form) state.form = emptyForm('');
        if (freeForm()) return createOwnHtml();
        const f = state.form;
        const card = state.card;
        const fmtTabs = `<div class="cf-fmt">${FORMATS.map((x) =>
            `<button type="button" class="${state.fmt === x.id ? 'on' : ''}" data-cf="fmt" data-id="${x.id}"${f.id && x.id === 'carousel' ? ' disabled' : ''}>${x.label}<small>${x.hint}</small></button>`).join('')}</div>`;
        const head = `<div class="cf-step"><h3><span class="cf-n">1</span>Что публикуем</h3>${fmtTabs}</div>`;
        const when = `<div class="cf-step"><h3><span class="cf-n">${state.fmt === 'carousel' ? 3 : 4}</span>Когда${tip('Публикация идёт только после кнопки «Подтвердить» в очереди')}</h3>
            <div class="cf-when"><input id="${state.fmt === 'carousel' ? 'cf-car-at' : 'cf-f-at'}" type="datetime-local" value="${escapeHtml(f.publish_at || '')}">
            <button type="button" class="cf-chip" data-cf="when" data-id="now">Сразу после подтверждения</button>
            <button type="button" class="cf-chip" data-cf="when" data-id="today">Сегодня 12:00</button>
            <button type="button" class="cf-chip" data-cf="when" data-id="tomorrow">Завтра 12:00</button></div>
            </div>`;
        if (state.fmt === 'carousel') {
            const slides = state.carouselUrls || [];
            return `<div class="cf-comp"><div class="cf-steps">${head}
                <div class="cf-step"><h3><span class="cf-n">2</span>Карусель</h3>${carouselHtml()}</div>${when}</div>
                <div>${previewHtml(slides[0] || (card && card.photos && card.photos[0]) || '', (document.getElementById && (document.getElementById('cf-car-cap') || {}).value) || '')}</div></div>`;
        }
        const art = state.articleMap[f.article_id];
        const plat = PLATFORMS.map((p) => `<option value="${p.id}"${f.platform === p.id ? ' selected' : ''}>${p.label}</option>`).join('');
        const blogs = [`<option value="">Без блогера</option>`].concat(state.bloggers.map((b) =>
            `<option value="${b.id}"${String(f.blogger_id) === String(b.id) ? ' selected' : ''}>${escapeHtml(b.name)}</option>`)).join('');
        const photo = (card && (card.photo_url || (card.photos && card.photos[0]))) || (art && art.photo_url) || '';
        const price = card && card.price != null ? Math.round(card.price).toLocaleString('ru-RU') + ' ₽' : '—';
        const slides = (Array.isArray(f.slide_urls) ? f.slide_urls : []).filter(Boolean);
        const readySlides = (state.carouselUrls && state.carouselUrls.length) ? state.carouselUrls : slides;
        const pics = ((card && card.photos) || []).slice(0, 10);
        const previewImg = f.file_url || readySlides[0] || photo;
        const stLabel = statusLabel(f.status || 'draft');
        return `<div class="cf-comp"><div class="cf-steps">${head}
            ${f.error_text ? `<div class="cf-err">${escapeHtml(f.error_text)}</div>` : ''}
            <input type="hidden" id="cf-f-art" value="${escapeHtml(f.article_id || '')}">
            <input type="hidden" id="cf-f-status" value="${escapeHtml(f.status === 'published' || f.status === 'scheduled' ? 'review' : (f.status || 'draft'))}">
            <div class="cf-step"><h3><span class="cf-n">2</span>Товар</h3>
                ${articleNmInput('cf-f-nm', (art && art.nm_id) || (card && card.nmId) || '')}
                <div class="cf-card-preview">
                    ${photo ? `<img src="${escapeHtml(photo)}" alt="">` : '<div class="cf-ph">Фото этого nmId</div>'}
                    <div><div class="cf-card-name">${escapeHtml((card && card.title) || (art && art.name) || 'Введите артикул WB')}</div>
                    <div class="cf-muted">${art ? 'nmId ' + art.nm_id + ' · ' : ''}${escapeHtml(stLabel)} · цена ${price}${art && art.cost_price ? ' · себест. ' + art.cost_price : ''}</div></div>
                </div>
                ${pics.length ? `<div class="cf-pics">${pics.map((u) => `<button type="button" class="${f.file_url === u ? 'on' : ''}" data-cf="pick-photo" data-url="${escapeHtml(u)}"><img src="${escapeHtml(u)}" alt=""></button>`).join('')}</div>` : ''}
                <label class="cf-lab">Ссылка на файл<input id="cf-f-file" value="${escapeHtml(f.file_url || '')}" placeholder="https://… (подставится при выборе фото)"></label>
            </div>
            <div class="cf-step"><h3><span class="cf-n">3</span>Подпись</h3>
                <textarea id="cf-f-cap" placeholder="Текст к посту и хэштеги">${escapeHtml(f.caption || '')}</textarea>
            </div>
            ${when}
            <details class="cf-more"><summary>Дополнительно</summary><div class="cf-form-grid">
                <label>Площадка<select id="cf-f-plat">${plat}</select></label>
                <label>Блогер<select id="cf-f-blogger">${blogs}</select></label>
                <label>Ссылка на пост<input id="cf-f-url" value="${escapeHtml(f.post_url || '')}" placeholder="https://instagram.com/…"></label>
                <label>Состав<input id="cf-f-comp" value="${escapeHtml(f.composition_text || '')}"></label>
                <label>Бренд<input id="cf-f-brand" value="${escapeHtml(f.brand_name || '')}"></label>
            </div></details>
            ${readySlides.length > 1 ? `<div class="cf-slides">${readySlides.map((u) => `<div class="cf-slide"><img src="${escapeHtml(u)}" alt=""></div>`).join('')}</div>` : ''}
            <div class="cf-actions">
                <button type="button" class="ui-btn ui-btn-secondary" data-cf="close-form">Закрыть</button>
                ${f.id ? '<button type="button" class="ui-btn ui-btn-secondary" data-cf="delete-post">Удалить</button>' : ''}
                <span class="cf-sp"></span>
                <button type="button" class="ui-btn ui-btn-secondary" data-cf="save-post">Сохранить черновик</button>
                <button type="button" class="ui-btn ui-btn-primary" data-cf="to-review"${readySlides.length || f.file_url ? '' : ' disabled'}>В очередь на подтверждение</button>
            </div></div>
            <div>${previewHtml(previewImg, f.caption)}</div></div>`;
    }

    function localInput(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        return Number.isFinite(d.getTime()) ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}` : '';
    }
    function kanCard(p, actions) {
        const tgb = p.source === 'telegram' ? '<span class="cf-tgb">Telegram</span>' : '';
        const note = p.tg_note && p.status !== 'published' ? `<small class="cf-amber">${escapeHtml(p.tg_note)}</small>` : '';
        return `<div class="cf-kc" data-cf="edit-post" data-id="${p.id}">${thumbHtml(p, 'cf-th-k')}<div class="cf-kc-t"><b>${escapeHtml(postTitle(p))}${tgb}</b><small>${kindLabel(p)} · ${whenLabel(p)}</small>${note}${p.error_text ? `<small class="cf-red">${escapeHtml(p.error_text)}</small>` : ''}${actions || ''}</div></div>`;
    }
    function reviewHtml() {
        const all = state.posts;
        const nTg = all.filter((p) => p.source === 'telegram').length;
        const posts = state.qFilter === 'tg' ? all.filter((p) => p.source === 'telegram') : state.qFilter === 'manual' ? all.filter((p) => p.source !== 'telegram') : all;
        const g = queueGroups(posts);
        const errs = posts.filter((p) => p.status === 'error');
        const hasMedia = (p) => (Array.isArray(p.slide_urls) && p.slide_urls.filter(Boolean).length) || p.file_url;
        const col = (title, items, render) => `<div class="cf-col"><h3>${title}<span>${items.length}</span></h3>${items.map(render).join('') || '<div class="cf-muted">Пусто</div>'}</div>`;
        const done = g.done.filter((p) => p.status !== 'error').slice(0, 12);
        const readyN = g.review.filter(hasMedia).length;
        const bar = (nTg || state.qFilter !== 'all') ? `<div class="cf-qbar">${seg('q-filter', state.qFilter, [['all', 'Все ' + all.length], ['tg', 'Из Telegram ' + nTg], ['manual', 'Вручную ' + (all.length - nTg)]])}<span class="cf-sp"></span>${readyN > 1 ? `<button type="button" class="ui-btn ui-btn-primary" data-cf="approve-all">Подтвердить все ${readyN}</button>` : ''}</div>` : '';
        const reviewCard = (p) => {
            const media = hasMedia(p);
            const dateIn = media ? `<input type="datetime-local" class="cf-qdate" value="${escapeHtml(localInput(p.publish_at))}" data-cf-change="q-date" data-pid="${p.id}">` : '';
            return kanCard(p, `${dateIn}<div class="cf-kc-a"><button type="button" class="ui-btn ui-btn-primary" data-cf="approve-post" data-id="${p.id}"${media && !state.busy[p.id] ? '' : ' disabled'}>${state.busy[p.id] ? 'Публикуем…' : 'Подтвердить'}</button><button type="button" class="cf-link" data-cf="reject-post" data-id="${p.id}">В черновик</button></div>`);
        };
        const draftCard = (p) => {
            if (p.source === 'telegram' && /Видео/.test(p.tg_note || '')) {
                return kanCard(p, `<div class="cf-kc-a"><button type="button" class="ui-btn ui-btn-secondary" data-cf="mark-done" data-id="${p.id}">Опубликовано вручную</button><button type="button" class="cf-link" data-cf="hide-post" data-id="${p.id}">Скрыть</button></div>`);
            }
            return kanCard(p);
        };
        return `${bar}<div class="cf-kan">
            ${col('Черновик', g.draft, draftCard)}
            ${col('На подтверждении', g.review, reviewCard)}
            ${col('Запланировано', g.scheduled, (p) => kanCard(p))}
            ${col('Опубликовано и ошибки', errs.concat(done), (p) => p.status === 'error'
                ? kanCard(p, `<div class="cf-kc-a"><button type="button" class="ui-btn ui-btn-secondary" data-cf="approve-post" data-id="${p.id}"${state.busy[p.id] ? ' disabled' : ''}>${state.busy[p.id] ? 'Публикуем…' : 'Повторить'}</button></div>`)
                : kanCard(Object.assign({}, p, { error_text: '' }), `<small><i class="cf-dot"></i>${num(p.views).toLocaleString('ru-RU')} просмотров</small>`))}
        </div>`;
    }

    function bloggersHtml() {
        const monthVal = state.payoutMonth.slice(0, 7);
        const rows = state.bloggers.map((b) => {
            const related = state.posts.filter((p) => p.blogger_id === b.id && p.publish_at && monthStart(p.publish_at) === state.payoutMonth);
            const pays = state.payouts.filter((p) => p.blogger_id === b.id);
            const total = pays.reduce((s, p) => s + num(p.accrued), 0);
            const postRows = related.map((p) => {
                const pay = pays.find((x) => x.post_id === p.id);
                const views = pay ? pay.actual_views : p.views;
                const acc = computePayoutFrom(b, views);
                const art = articleOf(p);
                return `<tr>
                    <td>${escapeHtml((art && art.name) || p.id.slice(0, 8))}</td>
                    <td>${escapeHtml(platformLabel(p.platform))}</td>
                    <td><input class="cf-views" data-cf-change="payout-views" data-blogger="${b.id}" data-post="${p.id}" type="number" min="0" value="${num(views)}"></td>
                    <td>${acc.toLocaleString('ru-RU')}</td>
                </tr>`;
            }).join('');
            return `<div class="widget-card cf-blogger">
                <div class="cf-blogger-h">
                    <div>
                        <div class="cf-card-name">${escapeHtml(b.name)}</div>
                        <div class="cf-muted">${(b.platforms || []).map(platformLabel).join(', ') || 'площадки не указаны'} · ставка ${num(b.rate_per_video).toLocaleString('ru-RU')} · бонус ${num(b.bonus_amount).toLocaleString('ru-RU')} после ${num(b.bonus_views_threshold).toLocaleString('ru-RU')} просмотров</div>
                    </div>
                    <div class="cf-pay-total">${total.toLocaleString('ru-RU')}</div>
                    <button type="button" class="cf-link" data-cf="del-blogger" data-id="${b.id}">Удалить</button>
                </div>
                <table class="data-table cf-table"><thead><tr><th>Пост</th><th>Площадка</th><th>Просмотры</th><th>Начислено</th></tr></thead>
                <tbody>${postRows || '<tr><td colspan="4" class="cf-muted">Нет постов в этом месяце</td></tr>'}</tbody></table>
            </div>`;
        }).join('');
        const grand = state.payouts.reduce((s, p) => s + num(p.accrued), 0);
        return `<div class="cf-toolbar">
            <label class="cf-month-lab">Месяц <input type="month" value="${monthVal}" data-cf-change="payout-month"></label>
            <div class="cf-pay-total">К выплате: ${grand.toLocaleString('ru-RU')}</div>
        </div>
        <div class="widget-card cf-form">
            <h3>Новый блогер</h3>
            <div class="cf-form-grid">
                <label>Имя<input id="cf-b-name" placeholder="Имя"></label>
                <label>Ставка за видео<input id="cf-b-rate" type="number" min="0" placeholder="0"></label>
                <label>Порог просмотров<input id="cf-b-thr" type="number" min="0" placeholder="10000"></label>
                <label>Бонус<input id="cf-b-bonus" type="number" min="0" placeholder="0"></label>
            </div>
            <div class="cf-plats">${PLATFORMS.map((p) =>
                `<label class="cf-check"><input type="checkbox" name="cf-b-plat" value="${p.id}"> ${p.label}</label>`
            ).join('')}</div>
            <button type="button" class="ui-btn ui-btn-primary" data-cf="new-blogger">Сохранить блогера</button>
        </div>
        ${rows || '<div class="cf-muted">Пока нет блогеров</div>'}`;
    }

    function carouselHtml() {
        const card = state.card;
        const plans = planCarouselSlides({
            photos: (card && card.photos) || [],
            extraPhotos: state.extraPhotos,
            title: card && card.title,
            nmId: card && card.nmId,
            composition: card && card.composition,
            brand: card && card.brand,
            price: card && card.price,
            vendorCode: card && card.vendorCode,
            description: card && card.description,
        });
        const preview = plans.map((s, i) => {
            const ready = state.carouselUrls[i];
            if (ready) return `<div class="cf-slide"><img src="${escapeHtml(ready)}" alt="${s.kind}"><div class="cf-slide-k">${slideKindLabel(s.kind)}</div></div>`;
            return `<div class="cf-slide cf-slide-css kind-${s.kind}">
                ${(s.kind === 'cover' || s.kind === 'photo') && s.photos[0] ? `<img src="${escapeHtml(s.photos[0])}" alt="">` : ''}
                ${s.kind === 'collage' ? `<div class="cf-grid2">${s.photos.map((u) => `<img src="${escapeHtml(u)}" alt="">`).join('')}</div>` : ''}
                ${s.kind === 'info' ? `<div class="cf-slide-info"><div>Артикул ${s.nmId || ''}</div><strong>${escapeHtml(s.title || '')}</strong><div>${s.price != null ? Math.round(s.price).toLocaleString('ru-RU') + ' ₽' : ''}</div><p>${escapeHtml(s.composition || '')}</p></div>` : ''}
                ${s.kind === 'brand' ? `<div class="cf-slide-brand">${escapeHtml(s.brand)}</div>` : ''}
                ${(s.kind === 'cover' || s.kind === 'photo') && (s.headline || s.line) ? `<div class="cf-slide-cap">${s.headline ? `<b>${escapeHtml(s.headline)}</b>` : ''}${s.line ? `<span>${escapeHtml(s.line)}</span>` : ''}</div>` : ''}
                <div class="cf-slide-k">${slideKindLabel(s.kind)}</div>
            </div>`;
        }).join('');
        const hasPreview = state.carouselUrls.length > 0;
        return `<div class="cf-form">
            <div class="cf-form-grid">
                <label>nmId${articleNmInput('cf-car-nm', (card && card.nmId) || '')}</label>
                <label>Состав<input id="cf-car-comp" value="${escapeHtml((card && card.composition) || '')}"></label>
                <label>Бренд<input id="cf-car-brand" value="${escapeHtml((card && card.brand) || '')}"></label>
                <label>Подпись<input id="cf-car-cap" placeholder="Текст к посту"></label>
                <label>Доп. фото<input id="cf-car-extra" type="file" accept="image/*" multiple></label>
            </div>
            ${card ? `<p class="cf-muted">nmId ${escapeHtml(card.nmId)} · ${escapeHtml(shortSeo(card.title, 60) || card.title || '')} · ${card.photos.length} фото${card.description ? ' · SEO' : ''}</p>` : ''}
            <div class="cf-slides">${preview}</div>
            <div class="cf-form-actions">
                <button type="button" class="ui-btn ui-btn-primary" data-cf="gen-carousel">Собрать</button>
                <button type="button" class="ui-btn ui-btn-secondary" data-cf="save-carousel-draft"${hasPreview ? '' : ' disabled'}>В очередь</button>
            </div>
        </div>`;
    }
    function slideKindLabel(k) {
        return { cover: 'Обложка', collage: 'Детали 2×2', photo: 'Фото', info: 'Артикул + состав', brand: 'Бренд' }[k] || k;
    }

    function igHtml() {
        const ig = state.ig || {};
        const label = !state.igLoaded ? '…' : (ig.connected ? 'Подключено' : 'Не подключено');
        return `<div class="widget-card cf-form">
            <h3>Instagram этого кабинета: настройки</h3>
            <div class="cf-st ${ig.connected ? 'st-published' : 'st-draft'}">${label}${ig.ig_username ? ' · @' + escapeHtml(ig.ig_username) : ''}</div>
            <div class="cf-form-grid">
                <label>Токен<input id="cf-ig-token" type="password" autocomplete="off"></label>
                <label>IG user id<input id="cf-ig-user" placeholder="17841…"></label>
            </div>
            <div class="cf-form-actions">
                <button type="button" class="ui-btn ui-btn-primary" data-cf="ig-store">Сохранить</button>
                <button type="button" class="ui-btn ui-btn-secondary" data-cf="ig-oauth"${ig.configured ? '' : ' disabled'}>OAuth</button>
                ${ig.connected ? '<button type="button" class="ui-btn ui-btn-secondary" data-cf="ig-off">Отключить</button>' : ''}
            </div>
        </div>${tgHtml()}`;
    }

    /* ── Telegram-канал кабинета как источник постов ── */
    function tgDraft() {
        if (!state.tgForm) {
            const s0 = state.tg.source;
            state.tgForm = {
                channel: s0 ? (s0.chat_username ? '@' + s0.chat_username : String(s0.chat_id)) : '',
                mode: s0 ? s0.mode : 'manual', target: s0 ? s0.target : 'feed',
                timing: s0 && s0.daily_time ? 'daily' : 'delay',
                delay_minutes: s0 ? s0.delay_minutes : 120, daily_time: (s0 && s0.daily_time) || '12:00',
                take_text: s0 ? s0.take_text : true, take_albums: s0 ? s0.take_albums : true,
                strip_links: s0 ? s0.strip_links : true, add_signature: s0 ? s0.add_signature : true,
                signature: (s0 && s0.signature) || '',
            };
        }
        return state.tgForm;
    }
    function seg(act, cur, items) {
        return `<div class="cf-seg">${items.map((x) => `<button type="button" class="${cur === x[0] ? 'on' : ''}" data-cf="${act}" data-id="${x[0]}">${x[1]}</button>`).join('')}</div>`;
    }
    function sw(id, on, label, off) {
        return `<label class="cf-sw${off ? ' off' : ''}"><b>${label}</b>${off ? `<span class="cf-muted">${off}</span>` : ''}<input type="checkbox" id="${id}"${on ? ' checked' : ''}${off ? ' disabled' : ''}><span class="cf-tg"></span></label>`;
    }
    function tgHtml() {
        const t = state.tg;
        if (!t.loaded) return '<div class="cf-card cf-tgc"><h3>Telegram-канал</h3><div class="cf-muted">Загрузка…</div></div>';
        const bot = t.bot || {};
        if (!bot.configured) {
            return `<div class="cf-card cf-tgc"><h3>Telegram-канал${tip('Посты из канала клиента попадают в очередь и уходят в Instagram. Для этого нужен бот контента.')}</h3>
                ${t.canSetupBot ? `<div class="cf-lab">Токен бота контента (создаётся в @BotFather)<input id="cf-tg-bot-token" type="password" autocomplete="off" placeholder="123456:ABC…"></div>
                <div class="cf-actions"><span class="cf-sp"></span><button type="button" class="ui-btn ui-btn-primary" data-cf="tg-bot-save">Подключить бота</button></div>`
                : '<div class="cf-muted">Бот контента ещё не подключён. Попросите администратора NR Space.</div>'}</div>`;
        }
        const d = tgDraft();
        const src = t.source;
        const st = !src ? '' : src.bot_ok ? '<span class="cf-chip2 ok">бот администратор канала, посты приходят</span>' : '<span class="cf-chip2 bad">бот не администратор канала</span>';
        return `<div class="cf-tgc cf-tgg">
            <div class="cf-card"><h3>Источник: Telegram-канал</h3>
                <label class="cf-lab">Канал<input id="cf-tg-channel" value="${escapeHtml(d.channel)}" placeholder="@имя_канала или t.me/имя"></label>
                <div class="cf-row"><span class="cf-chip2">Бот @${escapeHtml(bot.username || 'bot')}</span>${st}${tip('Добавьте бота администратором в канал клиента с правом читать сообщения. Видео бот не берёт: их публикуют вручную.')}</div>
                <div class="cf-lab">Куда отправлять${seg('tg-target', d.target, [['feed', 'Лента'], ['story', 'Сторис'], ['both', 'Лента и сторис']])}</div>
                <div class="cf-lab">Что брать
                    ${sw('cf-tg-text', d.take_text, 'Фото и текст')}
                    ${sw('cf-tg-album', d.take_albums, 'Альбом (несколько фото) в карусель')}
                    ${sw('cf-tg-video', false, 'Видео', 'публикуем вручную')}
                </div>
            </div>
            <div class="cf-card"><h3>Правила публикации</h3>
                <div class="cf-lab">Режим${seg('tg-mode', d.mode, [['manual', 'Подтверждать вручную'], ['auto', 'Авто в очередь']])}${tip('В авто-режиме пост сам встаёт в расписание, до выхода его можно снять в очереди. В ручном нужно нажать «Подтвердить».')}</div>
                <div class="cf-lab">Выложить${seg('tg-timing', d.timing, [['delay', 'Через N минут'], ['daily', 'В заданное время дня']])}</div>
                <div class="cf-when">${d.timing === 'daily'
                    ? `<input id="cf-tg-daily" type="time" value="${escapeHtml(d.daily_time)}"><span class="cf-muted">время Бишкека</span>`
                    : `<input id="cf-tg-delay" type="number" min="0" max="10080" value="${escapeHtml(String(d.delay_minutes))}" style="max-width:110px"><span class="cf-muted">минут после поста в Telegram</span>`}</div>
                ${sw('cf-tg-strip', d.strip_links, 'Убрать ссылки на Telegram из подписи')}
                ${sw('cf-tg-sigon', d.add_signature, 'Добавить подпись кабинета')}
                <label class="cf-lab">Подпись кабинета<textarea id="cf-tg-sig" rows="2" placeholder="Заказать на Wildberries: ссылка в шапке профиля. #zevina">${escapeHtml(d.signature)}</textarea></label>
            </div>
            <div class="cf-actions" style="grid-column:1/-1">
                ${src ? '<button type="button" class="cf-link" data-cf="tg-remove">Отвязать канал</button>' : ''}<span class="cf-sp"></span>
                ${src ? '<button type="button" class="ui-btn ui-btn-secondary" data-cf="tg-check">Проверить канал</button>' : ''}
                <button type="button" class="ui-btn ui-btn-primary" data-cf="tg-save">Сохранить</button>
            </div></div>`;
    }
    function readTg() {
        const g = (id) => document.getElementById(id);
        const d = tgDraft();
        d.channel = (g('cf-tg-channel') || {}).value || '';
        d.take_text = !!(g('cf-tg-text') || {}).checked; d.take_albums = !!(g('cf-tg-album') || {}).checked;
        d.strip_links = !!(g('cf-tg-strip') || {}).checked; d.add_signature = !!(g('cf-tg-sigon') || {}).checked;
        d.signature = (g('cf-tg-sig') || {}).value || '';
        if (g('cf-tg-daily')) d.daily_time = g('cf-tg-daily').value || '12:00';
        if (g('cf-tg-delay')) d.delay_minutes = Number(g('cf-tg-delay').value) || 0;
        return d;
    }

    function dashHtml() {
        const from = ymd(new Date(state.cursor.getFullYear(), state.cursor.getMonth(), 1));
        const to = ymd(new Date(state.cursor.getFullYear(), state.cursor.getMonth() + 1, 0));
        const v = viewsByPlatform(state.posts, from, to);
        const top = topPosts(state.posts.filter((p) => {
            const d = p.publish_at ? ymd(p.publish_at) : '';
            return (!from || d >= from) && (!to || d <= to);
        }), 5);
        const bars = PLATFORMS.map((p) => {
            const n = v.totals[p.id] || 0;
            const max = Math.max(1, ...PLATFORMS.map((x) => v.totals[x.id] || 0));
            const w = Math.round(n / max * 100);
            return `<div class="cf-bar-row"><span>${p.label}</span><div class="cf-bar"><i style="width:${w}%"></i></div><b>${n.toLocaleString('ru-RU')}</b></div>`;
        }).join('');
        const dayRows = v.days.map((d) => {
            const s = v.series[d];
            const sum = PLATFORMS.reduce((a, p) => a + (s[p.id] || 0), 0);
            return `<tr><td>${escapeHtml(d)}</td>${PLATFORMS.map((p) => `<td>${(s[p.id] || 0).toLocaleString('ru-RU')}</td>`).join('')}<td>${sum.toLocaleString('ru-RU')}</td></tr>`;
        }).join('');
        const topRows = top.map((p, i) => {
            const art = articleOf(p);
            return `<tr><td>${i + 1}</td><td>${escapeHtml(postTitle(p))}</td><td>${escapeHtml(platformLabel(p.platform))}</td><td>${num(p.views).toLocaleString('ru-RU')}</td></tr>`;
        }).join('');
        const search = state.searchTexts;
        let searchHtml = '<button type="button" class="ui-btn ui-btn-secondary" data-cf="wb-search">Запросы WB</button>';
        if (search && search.error) searchHtml += `<div class="cf-err">${escapeHtml(search.error)}</div>`;
        else if (search) {
            const items = search.data || search.items || search.texts || search;
            const list = Array.isArray(items) ? items : (items && items.items) || [];
            searchHtml += `<table class="data-table cf-table"><thead><tr><th>Запрос</th><th>Заказы</th></tr></thead><tbody>${
                (list.slice ? list.slice(0, 15) : []).map((row) => {
                    const q = row.text || row.query || row.keyword || row.name || JSON.stringify(row).slice(0, 80);
                    const o = row.orders ?? row.count ?? row.frequency ?? '—';
                    return `<tr><td>${escapeHtml(q)}</td><td>${escapeHtml(o)}</td></tr>`;
                }).join('') || '<tr><td colspan="2" class="cf-muted">Нет фраз за период</td></tr>'
            }</tbody></table>`;
        }
        return `<div class="cf-toolbar"><div class="cf-month">${escapeHtml(state.cursor.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }))}</div>
            <button type="button" class="ui-btn ui-btn-secondary" data-cf="prev-month">←</button>
            <button type="button" class="ui-btn ui-btn-secondary" data-cf="next-month">→</button></div>
        <div class="widget-card cf-form"><h3>Просмотры по площадкам</h3>${bars}</div>
        <div class="widget-card cf-form"><h3>По дням</h3>
            <div class="cf-table-wrap"><table class="data-table cf-table">
                <thead><tr><th>День</th>${PLATFORMS.map((p) => `<th>${p.label}</th>`).join('')}<th>Итого</th></tr></thead>
                <tbody>${dayRows || '<tr><td colspan="6" class="cf-muted">Нет данных</td></tr>'}</tbody>
            </table></div>
        </div>
        <div class="widget-card cf-form"><h3>Топ-5 постов</h3>
            <table class="data-table cf-table"><thead><tr><th>#</th><th>Пост</th><th>Площадка</th><th>Просмотры</th></tr></thead>
            <tbody>${topRows || '<tr><td colspan="4" class="cf-muted">Нет данных за месяц</td></tr>'}</tbody></table>
        </div>
        ${state.own ? '' : `<div class="widget-card cf-form"><h3>Поиск бренда в WB</h3>${searchHtml}</div>`}`;
    }

    function bindExtra() {
        const own = document.getElementById('cf-own-files');
        if (own && !own._cfBound) {
            own._cfBound = true;
            own.addEventListener('change', async () => {
                const files = [...(own.files || [])];
                if (!files.length || !state.form) return;
                state.form = readForm();
                const list = (state.form.slide_urls || []).slice();
                for (const file of files) {
                    const path = `${state.own ? 'nr' : cab + '/tg'}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, '_')}`;
                    const { error } = await sb.storage.from('content-factory').upload(path, file, { upsert: true, contentType: file.type });
                    if (error) { toast('error', 'Загрузка фото', error.message); continue; }
                    const { data } = sb.storage.from('content-factory').getPublicUrl(path);
                    if (data && data.publicUrl) list.push(data.publicUrl);
                }
                state.form.slide_urls = list;
                state.form.file_url = list[0] || '';
                paint();
            });
        }
        const extra = document.getElementById('cf-car-extra');
        if (!extra || extra._cfBound) return;
        extra._cfBound = true;
        extra.addEventListener('change', async () => {
            const files = [...(extra.files || [])];
            for (const file of files) {
                const path = `${cab}/extra/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, '_')}`;
                const { error } = await sb.storage.from('content-factory').upload(path, file, { upsert: true, contentType: file.type });
                if (error) { toast('error', 'Загрузка', error.message); continue; }
                const { data } = sb.storage.from('content-factory').getPublicUrl(path);
                if (data && data.publicUrl) state.extraPhotos.push(data.publicUrl);
            }
            paint();
        });
    }

    function ensureReady(supabase, cabinetId, callWbProxy, extra) {
        const next = String(cabinetId || '');
        if (next !== cab) {
            state.loadedCab = '';
            state.fetchCab = '';
            state.igLoaded = false;
            state.igBusy = false;
            state.ig = { configured: false, connected: false };
            state.posts = [];
            state.bloggers = [];
            state.payouts = [];
            state.articles = [];
            state.articleMap = {};
            state.card = null;
            state.carouselUrls = [];
            state.extraPhotos = [];
            state.searchTexts = null;
            state.err = '';
            state.form = null;
            state.accLoaded = false;
            state.tg = { loaded: false, bot: null, source: null, canSetupBot: false };
            state.tgForm = null;
            state.qFilter = 'all';
            state.own = false;
            state.ownIg = null;
            state.fmt = 'post';
            state.loadGen += 1;
        }
        sb = supabase;
        cab = next;
        callWb = callWbProxy;
        opts = extra || {};
        return ContentFactory;
    }
    function bindRoot() {
        const el = rootEl();
        if (el && !el._cfBound) {
            el._cfBound = true;
            el.addEventListener('click', onClick);
            el.addEventListener('change', onChange);
            el.addEventListener('input', (e) => {
                const t = e.target;
                if (!t || !t.id) return;
                if (t.id === 'cf-f-cap' || t.id === 'cf-car-cap') {
                    const c = document.getElementById('cf-ph-cap');
                    if (c) { const b = c.querySelector('b'); c.textContent = ' ' + t.value; if (b) c.insertBefore(b, c.firstChild); }
                } else if (t.id === 'cf-acc-q') {
                    state.accQuery = t.value;
                    const pos = t.selectionStart;
                    paint();
                    const n = document.getElementById('cf-acc-q');
                    if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (_) {} }
                }
            });
            el.addEventListener('dragstart', (e) => {
                const c = e.target.closest && e.target.closest('.cf-cal-post[data-pid]');
                if (!c) return;
                state.dragId = c.getAttribute('data-pid');
                try { e.dataTransfer.setData('text/plain', state.dragId); e.dataTransfer.effectAllowed = 'move'; } catch (_) {}
                c.classList.add('drag');
            });
            el.addEventListener('dragend', () => { state.dragId = null; el.querySelectorAll('.drag,.over').forEach((n) => n.classList.remove('drag', 'over')); });
            el.addEventListener('dragover', (e) => {
                const d = e.target.closest && e.target.closest('.cf-cal-day[data-id]');
                if (!d || !state.dragId) return;
                e.preventDefault();
                el.querySelectorAll('.over').forEach((n) => { if (n !== d) n.classList.remove('over'); });
                d.classList.add('over');
            });
            el.addEventListener('drop', (e) => {
                const d = e.target.closest && e.target.closest('.cf-cal-day[data-id]');
                if (!d || !state.dragId) return;
                e.preventDefault();
                const pid = state.dragId; state.dragId = null;
                const fake = { getAttribute: (k) => (k === 'data-pid' ? pid : '') };
                handle('move-post', d.getAttribute('data-id'), fake).catch((err) => toast('error', 'Контент-завод', err.message || String(err)));
            });
            if (typeof window !== 'undefined') window.addEventListener('resize', placePill);
        }
    }
    function open() {
        bindRoot();
        paint();
        if (!needsReload()) return Promise.resolve();
        if (state.fetchCab === key()) return Promise.resolve();
        void reload();
        return Promise.resolve();
    }

    const ContentFactory = {
        PLATFORMS, STATUSES, SLIDE_W, SLIDE_H, PHOTO_PAGES,
        computePayout, monthStart, ymd, parseWbCard, pickComposition, pickCardPrice, pickCardByNmId,
        pickCardDescription, layoutSeoOverlays, parseGptOverlayJson, clipText, dedupeSeoText, shortSeo,
        nmIdFromPhotoUrl, photoUrlFitsNmId, photosForNmId, bindExactArticlePhotos, galleryUrlsFromManual,
        planCarouselSlides, groupPostsByDay, calendarCells, viewsByPlatform, topPosts, filterPosts, uniqUrls,
        withTimeout, needsReload, FN_TIMEOUT_MS, QUERY_TIMEOUT_MS,
        tokenState, monthStats, queueGroups, todoItems, upcomingPosts, FORMATS, VIEWS,
        ensureReady, open, reload,
        _state: state,
    };
    root.ContentFactory = ContentFactory;
    if (typeof module !== 'undefined' && module.exports) module.exports = ContentFactory;
})(typeof window !== 'undefined' ? window : globalThis);

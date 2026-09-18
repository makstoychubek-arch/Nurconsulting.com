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
        { id: 'calendar', label: 'Календарь' },
        { id: 'review', label: 'Очередь' },
        { id: 'bloggers', label: 'Блогеры' },
        { id: 'carousel', label: 'Карусель' },
        { id: 'instagram', label: 'Instagram' },
        { id: 'dashboard', label: 'Сводка' },
    ];
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
            title: String(input.title || '').trim(),
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
    function splitSeoSentences(text) {
        return String(text || '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?…;])\s+/).map((s) => s.trim()).filter((s) => s.length >= 8);
    }
    function splitHeadlineLine(sentence) {
        const t = String(sentence || '').replace(/\s+/g, ' ').trim();
        if (!t) return { headline: '', line: '' };
        const words = t.split(' ').filter(Boolean);
        if (words.length <= 5 && t.length <= 42) return { headline: clipText(t, 42), line: '' };
        const n = Math.min(5, Math.max(2, Math.ceil(words.length / 3)));
        const headline = clipText(words.slice(0, n).join(' '), 42);
        return { headline, line: clipText(words.slice(n).join(' '), 90) };
    }
    function layoutSeoOverlays(kinds, input) {
        const sentences = splitSeoSentences(input && input.description);
        const title = clipText(input && input.title, 42);
        const composition = clipText(input && input.composition, 70);
        let i = 0;
        const take = () => sentences[i++] || '';
        let photos = 0;
        return (kinds || []).map((kind) => {
            if (kind === 'cover') {
                const hook = take();
                return { headline: title || clipText(hook, 42), line: title ? clipText(hook, 70) : '' };
            }
            if (kind === 'collage') return { headline: '', line: '' };
            if (kind === 'photo') {
                photos += 1;
                if (photos === 2 && composition) {
                    const already = sentences.some((s) => composition.length >= 4 && s.toLowerCase().includes(composition.slice(0, 8).toLowerCase()));
                    if (!already) return { headline: 'Состав', line: composition };
                }
                return splitHeadlineLine(take() || (photos === 1 ? composition : ''));
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
        return (kinds || []).map((kind, idx) => {
            let row = null;
            const at = list[idx];
            if (at && typeof at === 'object' && String(at.kind || kind) === kind) { used.add(idx); row = at; }
            if (!row) {
                const found = list.findIndex((item, j) => !used.has(j) && item && typeof item === 'object' && String(item.kind || '') === kind);
                if (found >= 0) { used.add(found); row = list[found]; }
            }
            if (!row) return fallback[idx] || { headline: '', line: '' };
            const headline = clipText(row.headline || row.title || '', 42);
            const line = clipText(row.line || row.text || row.body || '', 90);
            if (!headline && !line) return fallback[idx] || { headline: '', line: '' };
            return { headline, line };
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

    const state = {
        view: 'calendar',
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
        return !!cab && state.loadedCab !== cab;
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
        const { data, error } = await withTimeout(sb.from('content_posts')
            .select('*')
            .eq('cabinet_id', cab)
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
        state.fetchCab = cab;
        state.err = '';
        try {
            await Promise.all([loadArticles(), loadPosts(), loadBloggers(), loadPayouts()]);
            if (gen !== state.loadGen) return;
            state.loadedCab = cab;
        } catch (e) {
            if (gen !== state.loadGen) return;
            if (!isMissingTable(e)) state.err = e.message || String(e);
        } finally {
            if (state.fetchCab === cab && gen === state.loadGen) state.fetchCab = '';
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
        if (!form.article_id) throw new Error('Выберите артикул');
        const patch = Object.assign({
            cabinet_id: cab,
            article_id: form.article_id,
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

    async function deletePost(id) {
        const { error } = await sb.from('content_posts').delete().eq('id', id).eq('cabinet_id', cab);
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

    async function handle(act, id, el) {
        if (act === 'view') {
            state.view = id;
            state.form = null;
            paint();
            if (id === 'instagram') void ensureIg();
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
        if (act === 'new-day') { state.form = emptyForm(id); state.view = 'calendar'; paint(); return; }
        if (act === 'edit-post') {
            const p = state.posts.find((x) => x.id === id);
            if (!p) return;
            state.form = formFromPost(p);
            const art = articleOf(p);
            if (art) pullArticleCard(art).then(() => paint());
            paint(); return;
        }
        if (act === 'close-form') { state.form = null; paint(); return; }
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
            const slides = Array.isArray(p.slide_urls) ? p.slide_urls.filter(Boolean) : [];
            if (!slides.length && !p.file_url) throw new Error('Нет слайдов — подтверждать нечего');
            const nowIso = new Date().toISOString();
            const at = p.publish_at ? new Date(p.publish_at).getTime() : 0;
            const goNow = !at || at <= Date.now();
            if (p.platform === 'instagram' && goNow) {
                const { error } = await sb.from('content_posts').update({
                    approved_at: nowIso,
                    status: 'review',
                    error_text: null,
                    updated_at: nowIso,
                }).eq('id', p.id).eq('cabinet_id', cab);
                if (error) throw error;
                await callFn('content-ig-publish', { post_id: p.id, dry_run: false }, FN_LONG_MS);
            } else {
                const { error } = await sb.from('content_posts').update({
                    approved_at: nowIso,
                    status: 'scheduled',
                    updated_at: nowIso,
                }).eq('id', p.id).eq('cabinet_id', cab);
                if (error) throw error;
            }
            await reload();
            toast('success', 'Подтверждено', goNow && p.platform === 'instagram' ? 'В Instagram' : 'В слот по дате');
            return;
        }
        if (act === 'reject-post') {
            const { error } = await sb.from('content_posts').update({
                status: 'draft',
                approved_at: null,
            }).eq('id', id).eq('cabinet_id', cab);
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
        return f;
    }

    function paint() {
        const el = rootEl();
        if (!el) return;
        el.innerHTML = [
            navHtml(),
            state.err ? `<div class="cf-err">${escapeHtml(state.err)}</div>` : '',
            state.view === 'calendar' ? calendarHtml() : '',
            state.view === 'review' ? reviewHtml() : '',
            state.view === 'bloggers' ? bloggersHtml() : '',
            state.view === 'carousel' ? carouselHtml() : '',
            state.view === 'instagram' ? igHtml() : '',
            state.view === 'dashboard' ? dashHtml() : '',
        ].join('');
        bindExtra();
    }

    function navHtml() {
        return `<div class="cf-nav">${VIEWS.map((v) =>
            `<button type="button" class="cf-nav-btn${state.view === v.id ? ' on' : ''}" data-cf="view" data-id="${v.id}">${v.label}</button>`
        ).join('')}</div>${nmDatalistHtml()}`;
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
                <button type="button" class="cf-chip${state.listMode === 'calendar' ? ' on' : ''}" data-cf="mode" data-id="calendar">Календарь</button>
                <button type="button" class="cf-chip${state.listMode === 'table' ? ' on' : ''}" data-cf="mode" data-id="table">Таблица</button>
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
                    const art = articleOf(p);
                    return `<button type="button" class="cf-cal-post st-${p.status}" data-cf="edit-post" data-id="${p.id}">${escapeHtml(platformLabel(p.platform))}${art ? ' · ' + escapeHtml(art.name || art.nm_id) : ''}</button>`;
                }).join('')}
            </div>`;
        }).join('');
        return `<div class="cf-toolbar">
            <button type="button" class="ui-btn ui-btn-secondary" data-cf="prev-month">←</button>
            <div class="cf-month">${escapeHtml(title)}</div>
            <button type="button" class="ui-btn ui-btn-secondary" data-cf="next-month">→</button>
            <button type="button" class="ui-btn ui-btn-primary" data-cf="new-day" data-id="${ymd(new Date())}">Новый пост</button>
        </div>
        ${filtersHtml()}
        ${state.listMode === 'calendar' ? `<div class="cf-cal"><div class="cf-cal-week">${head}</div><div class="cf-cal-grid">${cells}</div></div>` : tableHtml(posts)}
        ${state.form ? formHtml() : ''}`;
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

    function formHtml() {
        const f = state.form;
        const card = state.card;
        const art = state.articleMap[f.article_id];
        const plat = PLATFORMS.map((p) => `<option value="${p.id}"${f.platform === p.id ? ' selected' : ''}>${p.label}</option>`).join('');
        const blogs = [`<option value="">Без блогера</option>`].concat(state.bloggers.map((b) =>
            `<option value="${b.id}"${String(f.blogger_id) === String(b.id) ? ' selected' : ''}>${escapeHtml(b.name)}</option>`
        )).join('');
        const photo = (card && (card.photo_url || (card.photos && card.photos[0]))) || (art && art.photo_url) || '';
        const price = card && card.price != null ? Math.round(card.price).toLocaleString('ru-RU') + ' ₽' : '—';
        const slides = (Array.isArray(f.slide_urls) ? f.slide_urls : []).filter(Boolean);
        const readySlides = (state.carouselUrls && state.carouselUrls.length) ? state.carouselUrls : slides;
        const stLabel = statusLabel(f.status || 'draft');
        return `<div class="cf-form widget-card">
            <div class="cf-form-h">
                <h3>${f.id ? 'Пост' : 'Новый пост'}</h3>
                <button type="button" class="cf-link" data-cf="close-form">Закрыть</button>
            </div>
            ${f.error_text ? `<div class="cf-err">${escapeHtml(f.error_text)}</div>` : ''}
            <input type="hidden" id="cf-f-art" value="${escapeHtml(f.article_id || '')}">
            <input type="hidden" id="cf-f-status" value="${escapeHtml(f.status === 'published' || f.status === 'scheduled' ? 'review' : (f.status || 'draft'))}">
            <div class="cf-form-grid">
                <label>nmId${articleNmInput('cf-f-nm', (art && art.nm_id) || (card && card.nmId) || '')}</label>
                <label>Площадка<select id="cf-f-plat">${plat}</select></label>
                <label>Блогер<select id="cf-f-blogger">${blogs}</select></label>
                <label>Дата публикации<input id="cf-f-at" type="datetime-local" value="${escapeHtml(f.publish_at || '')}"></label>
                <label>Ссылка на файл<input id="cf-f-file" value="${escapeHtml(f.file_url || '')}" placeholder="https://…"></label>
                <label>Ссылка на пост<input id="cf-f-url" value="${escapeHtml(f.post_url || '')}" placeholder="https://instagram.com/…"></label>
                <label class="cf-span">Подпись<textarea id="cf-f-cap">${escapeHtml(f.caption || '')}</textarea></label>
                <label>Состав<input id="cf-f-comp" value="${escapeHtml(f.composition_text || '')}"></label>
                <label>Бренд<input id="cf-f-brand" value="${escapeHtml(f.brand_name || '')}"></label>
            </div>
            <div class="cf-card-preview">
                ${photo ? `<img src="${escapeHtml(photo)}" alt="">` : '<div class="cf-ph">Фото этого nmId</div>'}
                <div>
                    <div class="cf-card-name">${escapeHtml((card && card.title) || (art && art.name) || 'nmId')}</div>
                    <div class="cf-muted">${art ? 'nmId ' + art.nm_id : ''} · ${escapeHtml(stLabel)} · цена ${price}${art && art.cost_price ? ' · себест. ' + art.cost_price : ''}</div>
                </div>
            </div>
            ${readySlides.length ? `<div class="cf-slides">${readySlides.map((u) => `<div class="cf-slide"><img src="${escapeHtml(u)}" alt=""></div>`).join('')}</div>` : ''}
            <div class="cf-form-actions">
                <button type="button" class="ui-btn ui-btn-primary" data-cf="save-post">Сохранить черновик</button>
                <button type="button" class="ui-btn ui-btn-secondary" data-cf="to-review"${readySlides.length || f.file_url ? '' : ' disabled'}>В очередь</button>
                ${f.id ? '<button type="button" class="ui-btn ui-btn-secondary" data-cf="delete-post">Удалить</button>' : ''}
            </div>
        </div>`;
    }

    function reviewHtml() {
        const queue = state.posts.filter((p) => p.status === 'review' || p.status === 'error');
        const cards = queue.map((p) => {
            const art = articleOf(p);
            const slides = (Array.isArray(p.slide_urls) ? p.slide_urls : []).filter(Boolean);
            const preview = slides.length
                ? slides.map((u) => `<img src="${escapeHtml(u)}" alt="">`).join('')
                : (art && art.photo_url ? `<img src="${escapeHtml(art.photo_url)}" alt="">` : '<div class="cf-muted">Нет слайдов</div>');
            return `<div class="widget-card cf-form">
                <div class="cf-form-h">
                    <h3>nmId ${escapeHtml((art && art.nm_id) || '—')} · ${escapeHtml(platformLabel(p.platform))}</h3>
                    <span class="cf-st st-review">ждёт подтверждения</span>
                </div>
                <p class="cf-muted">${escapeHtml((art && art.name) || '')}${p.publish_at ? ' · ' + escapeHtml(new Date(p.publish_at).toLocaleString('ru-RU')) : ''}</p>
                ${p.error_text ? `<div class="cf-err">${escapeHtml(p.error_text)}</div>` : ''}
                <div class="cf-slides">${preview}</div>
                <div class="cf-form-actions">
                    <button type="button" class="ui-btn ui-btn-secondary" data-cf="reject-post" data-id="${p.id}">Возврат в черновик</button>
                    <button type="button" class="ui-btn ui-btn-primary" data-cf="approve-post" data-id="${p.id}"${slides.length || p.file_url ? '' : ' disabled'}>Подтверждено</button>
                    <button type="button" class="cf-link" data-cf="edit-post" data-id="${p.id}">Открыть</button>
                </div>
            </div>`;
        }).join('');
        return cards || '<div class="cf-muted">Очередь пуста</div>';
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
        return `<div class="widget-card cf-form">
            <h3>Карусель</h3>
            <div class="cf-form-grid">
                <label>nmId${articleNmInput('cf-car-nm', (card && card.nmId) || '')}</label>
                <label>Состав<input id="cf-car-comp" value="${escapeHtml((card && card.composition) || '')}"></label>
                <label>Бренд<input id="cf-car-brand" value="${escapeHtml((card && card.brand) || '')}"></label>
                <label>Подпись<input id="cf-car-cap" placeholder="Текст к посту"></label>
                <label>Доп. фото<input id="cf-car-extra" type="file" accept="image/*" multiple></label>
            </div>
            ${card ? `<p class="cf-muted">nmId ${escapeHtml(card.nmId)} · ${escapeHtml(card.title || '')} · ${card.photos.length} фото${card.description ? ' · SEO' : ''}</p>` : ''}
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
            <h3>Instagram</h3>
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
        </div>`;
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
            return `<tr><td>${i + 1}</td><td>${escapeHtml((art && art.name) || p.id.slice(0, 8))}</td><td>${escapeHtml(platformLabel(p.platform))}</td><td>${num(p.views).toLocaleString('ru-RU')}</td></tr>`;
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
        <div class="widget-card cf-form"><h3>Поиск бренда в WB</h3>${searchHtml}</div>`;
    }

    function bindExtra() {
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
        }
    }
    function open() {
        bindRoot();
        paint();
        if (!needsReload()) return Promise.resolve();
        if (state.fetchCab === cab) return Promise.resolve();
        void reload();
        return Promise.resolve();
    }

    const ContentFactory = {
        PLATFORMS, STATUSES, SLIDE_W, SLIDE_H, PHOTO_PAGES,
        computePayout, monthStart, ymd, parseWbCard, pickComposition, pickCardPrice, pickCardByNmId,
        pickCardDescription, layoutSeoOverlays, parseGptOverlayJson, clipText,
        nmIdFromPhotoUrl, photoUrlFitsNmId, photosForNmId, bindExactArticlePhotos, galleryUrlsFromManual,
        planCarouselSlides, groupPostsByDay, calendarCells, viewsByPlatform, topPosts, filterPosts, uniqUrls,
        withTimeout, needsReload, FN_TIMEOUT_MS, QUERY_TIMEOUT_MS,
        ensureReady, open, reload,
        _state: state,
    };
    root.ContentFactory = ContentFactory;
    if (typeof module !== 'undefined' && module.exports) module.exports = ContentFactory;
})(typeof window !== 'undefined' ? window : globalThis);

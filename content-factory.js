/**
 * Контент-завод: календарь публикаций, блогеры, карусель, Instagram, сводка.
 * Фото/цена/остатки — из rnp_articles + callWbProxy('content_cards'), без своей копии.
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
        (urls || []).forEach((raw) => {
            let u = String(raw || '').trim();
            if (u.startsWith('//')) u = 'https:' + u;
            if (!u || seen.has(u)) return;
            seen.add(u);
            out.push(u);
        });
        return out;
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
        const photos = uniqUrls(photosRaw.map((p) => {
            if (typeof p === 'string') return p;
            if (p && typeof p === 'object') return p.big || p.c516x688 || p.c246x328 || p.tm || '';
            return '';
        }));
        return {
            nmId,
            title: String(c.title ?? c.imtName ?? c.vendorCode ?? (nmId ? 'Артикул ' + nmId : '')).trim(),
            photos,
            price: pickCardPrice(c),
            composition: pickComposition(c),
            vendorCode: String(c.vendorCode || c.vendor_code || '').trim(),
            brand: String(c.brand || c.brandName || '').trim(),
        };
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
        const photos = uniqUrls([].concat(input.photos || [], input.extraPhotos || []));
        const cover = photos[0] || '';
        const details = photos.slice(1, 5);
        while (details.length < 4 && cover) details.push(cover);
        const base = {
            width: SLIDE_W,
            height: SLIDE_H,
            title: String(input.title || '').trim(),
            nmId: Number(input.nmId) || 0,
            composition: String(input.composition || '').trim(),
            brand: String(input.brand || '').trim() || 'NR',
            price: input.price == null || input.price === '' ? null : num(input.price),
            vendorCode: String(input.vendorCode || '').trim(),
        };
        return [
            Object.assign({}, base, { kind: 'cover', photos: cover ? [cover] : [] }),
            Object.assign({}, base, { kind: 'collage', photos: details.slice(0, 4) }),
            Object.assign({}, base, { kind: 'info', photos: [] }),
            Object.assign({}, base, { kind: 'brand', photos: [] }),
        ];
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
    };

    let sb = null;
    let cab = '';
    let callWb = null;
    let opts = {};

    function rootEl() { return document.getElementById('cf-root'); }
    function functionsUrl(name) {
        const base = (opts.functionsUrl || (opts.supabaseUrl ? opts.supabaseUrl + '/functions/v1' : ''))
            || 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1';
        return base.replace(/\/$/, '') + '/' + name;
    }
    async function userToken() {
        if (!sb) return '';
        let session = null;
        if (root.NrAuth && typeof root.NrAuth.recoverBrokenSession === 'function') {
            session = await root.NrAuth.recoverBrokenSession(sb);
        }
        if (!session || !session.access_token) {
            session = ((await sb.auth.getSession()).data || {}).session;
        }
        return (session && session.access_token) || '';
    }
    async function callFn(name, body) {
        const token = await userToken();
        const res = await fetch(functionsUrl(name), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify(Object.assign({ cabinet_id: cab }, body || {})),
        });
        const js = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(js.error || ('HTTP ' + res.status));
        return js;
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
        const { data, error } = await sb.from('rnp_articles')
            .select('id, nm_id, name, photo_url, is_active, cost_price, manual_data')
            .eq('cabinet_id', cab)
            .order('name');
        if (error) throw error;
        state.articles = data || [];
        state.articleMap = {};
        state.articles.forEach((a) => { state.articleMap[a.id] = a; });
    }
    async function loadPosts() {
        const { data, error } = await sb.from('content_posts')
            .select('*')
            .eq('cabinet_id', cab)
            .order('publish_at', { ascending: false, nullsFirst: false });
        if (error) throw error;
        state.posts = data || [];
    }
    async function loadBloggers() {
        const { data, error } = await sb.from('bloggers')
            .select('*')
            .eq('cabinet_id', cab)
            .order('name');
        if (error) throw error;
        state.bloggers = data || [];
    }
    async function loadPayouts() {
        const { data, error } = await sb.from('blogger_payouts')
            .select('*')
            .eq('cabinet_id', cab)
            .eq('month', state.payoutMonth);
        if (error) throw error;
        state.payouts = data || [];
    }
    async function loadIg() {
        try {
            state.ig = await callFn('content-ig-oauth', { action: 'status' });
        } catch (_) {
            state.ig = { configured: false, connected: false };
        }
    }
    async function reload() {
        if (!sb || !cab) return;
        state.loading = true;
        state.err = '';
        paint();
        try {
            await Promise.all([loadArticles(), loadPosts(), loadBloggers(), loadPayouts(), loadIg()]);
        } catch (e) {
            state.err = e.message || String(e);
        }
        state.loading = false;
        paint();
    }

    async function pullArticleCard(article) {
        if (!article) return null;
        const nm = Number(article.nm_id);
        if (!nm) return null;
        let hit = null;
        if (callWb) {
            const data = await callWb('content_cards', { limit: 10, textSearch: String(nm), withPhoto: 1 });
            hit = pickCardByNmId((data && data.cards) || [], nm);
        }
        if (!hit) {
            hit = {
                nmId: nm,
                title: article.name || ('Артикул ' + nm),
                photos: article.photo_url ? [article.photo_url] : [],
                photo_url: article.photo_url || '',
                price: null,
                composition: '',
                vendorCode: '',
                brand: '',
            };
        }
        hit.photo_url = (hit.photos && hit.photos[0]) || article.photo_url || '';
        hit.localName = article.name;
        hit.article_id = article.id;
        hit.cost_price = article.cost_price;
        state.card = hit;
        return hit;
    }

    async function findArticleByNmId(nmId) {
        const id = Number(nmId);
        if (!id || !sb || !cab) return null;
        const local = state.articles.find((a) => Number(a.nm_id) === id);
        if (local) return local;
        const { data, error } = await sb.from('rnp_articles')
            .select('id, nm_id, name, photo_url, is_active, cost_price, manual_data')
            .eq('cabinet_id', cab)
            .eq('nm_id', id)
            .maybeSingle();
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
            article_id: Number(form.article_id),
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
        handle(act, id, t).catch((err) => toast('error', 'Контент-завод', err.message || String(err)));
    }
    function onChange(e) {
        const t = e.target;
        if (!t || !t.getAttribute) return;
        const act = t.getAttribute('data-cf-change');
        if (!act) return;
        handle(act, t.value, t).catch((err) => toast('error', 'Контент-завод', err.message || String(err)));
    }

    async function handle(act, id, el) {
        if (act === 'view') { state.view = id; state.form = null; paint(); return; }
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
            if (!state.form) return;
            state.form.article_id = id;
            const art = state.articleMap[id];
            state.card = null;
            paint();
            if (art) {
                const card = await pullArticleCard(art);
                if (card && state.form) {
                    if (!state.form.composition_text) state.form.composition_text = card.composition || '';
                    if (!state.form.brand_name) state.form.brand_name = card.brand || '';
                }
                paint();
            }
            return;
        }
        if (act === 'lookup-nm') {
            const raw = (document.getElementById('cf-f-nm') || document.getElementById('cf-car-nm') || {}).value;
            const art = await findArticleByNmId(raw);
            if (!art) throw new Error('Артикул ' + raw + ' не найден в этом кабинете');
            if (state.form) state.form.article_id = art.id;
            state.card = null;
            await pullArticleCard(art);
            paint();
            return;
        }
        if (act === 'save-post') {
            const form = readForm();
            if (form.status === 'published' || form.status === 'scheduled') form.status = 'review';
            await savePost(form);
            state.form = null;
            await reload();
            toast('success', 'Сохранено', 'Пост в календаре. В Instagram — только из очереди после просмотра слайдов.');
            return;
        }
        if (act === 'to-review') {
            const form = readForm();
            form.status = 'review';
            if (!((form.slide_urls && form.slide_urls.length) || form.file_url || (state.carouselUrls && state.carouselUrls.length))) {
                throw new Error('Сначала соберите и посмотрите слайды');
            }
            if (state.carouselUrls && state.carouselUrls.length) form.slide_urls = state.carouselUrls;
            await savePost(form, { status: 'review' });
            state.form = null;
            state.view = 'review';
            await reload();
            toast('info', 'Очередь', 'Пост ждёт подтверждения');
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
                await callFn('content-ig-publish', { post_id: p.id, dry_run: false });
            } else {
                const { error } = await sb.from('content_posts').update({
                    approved_at: nowIso,
                    status: 'scheduled',
                    updated_at: nowIso,
                }).eq('id', p.id).eq('cabinet_id', cab);
                if (error) throw error;
            }
            await reload();
            toast('success', 'Подтверждено', goNow && p.platform === 'instagram' ? 'Отправлено в Instagram' : 'Встанет в слот по дате');
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
            state.card = null;
            state.carouselUrls = [];
            if (art) await pullArticleCard(art);
            paint();
            return;
        }
        if (act === 'gen-carousel') {
            const artId = (document.getElementById('cf-car-art') || {}).value;
            const art = state.articleMap[artId];
            if (!art) throw new Error('Выберите артикул');
            const card = state.card && state.card.article_id === art.id ? state.card : await pullArticleCard(art);
            const composition = (document.getElementById('cf-car-comp') || {}).value || (card && card.composition) || '';
            const brand = (document.getElementById('cf-car-brand') || {}).value || (card && card.brand) || '';
            const js = await callFn('content-carousel', {
                photos: (card && card.photos) || (art.photo_url ? [art.photo_url] : []),
                extra_photos: state.extraPhotos,
                title: (card && card.title) || art.name,
                nm_id: art.nm_id,
                composition,
                brand,
                price: card && card.price,
                vendor_code: card && card.vendorCode,
            });
            state.carouselUrls = js.urls || [];
            paint();
            return;
        }
        if (act === 'save-carousel-draft') {
            const artId = (document.getElementById('cf-car-art') || {}).value;
            if (!artId) throw new Error('Выберите артикул');
            if (!state.carouselUrls.length) throw new Error('Сначала соберите слайды');
            await savePost({
                id: null,
                article_id: artId,
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
            toast('info', 'Очередь', 'Карусель в очереди на подтверждение — Instagram не уйдёт, пока не нажмёте «Ок»');
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
            toast('success', 'Instagram', 'Токен сохранён в Vault');
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
                state.searchTexts = { error: 'Нет артикулов — запросы WB берутся из существующего SEO-отчёта карточки' };
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
            state.loading ? '<div class="cf-muted">Загрузка…</div>' : '',
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
        ).join('')}</div>`;
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

    function articleOptions(selected) {
        return [`<option value="">Артикул из РНП</option>`].concat(state.articles.map((a) =>
            `<option value="${a.id}"${String(selected) === String(a.id) ? ' selected' : ''}>${escapeHtml(a.name || a.nm_id)} · ${a.nm_id}</option>`
        )).join('');
    }

    function formHtml() {
        const f = state.form;
        const card = state.card;
        const art = state.articleMap[f.article_id];
        const plat = PLATFORMS.map((p) => `<option value="${p.id}"${f.platform === p.id ? ' selected' : ''}>${p.label}</option>`).join('');
        const st = STATUSES.map((s) => `<option value="${s.id}"${f.status === s.id ? ' selected' : ''}>${s.label}</option>`).join('');
        const blogs = [`<option value="">Без блогера</option>`].concat(state.bloggers.map((b) =>
            `<option value="${b.id}"${String(f.blogger_id) === String(b.id) ? ' selected' : ''}>${escapeHtml(b.name)}</option>`
        )).join('');
        const photo = (card && (card.photo_url || card.photos[0])) || (art && art.photo_url) || '';
        const price = card && card.price != null ? Math.round(card.price).toLocaleString('ru-RU') + ' ₽' : '—';
        return `<div class="cf-form widget-card">
            <div class="cf-form-h">
                <h3>${f.id ? 'Пост' : 'Новый пост'}</h3>
                <button type="button" class="cf-link" data-cf="close-form">Закрыть</button>
            </div>
            ${f.error_text ? `<div class="cf-err">${escapeHtml(f.error_text)}</div>` : ''}
            <div class="cf-form-grid">
                <label>nmId (точный номер)<span class="cf-nm-row"><input id="cf-f-nm" type="number" inputmode="numeric" placeholder="247347214" value="${escapeHtml((art && art.nm_id) || (card && card.nmId) || '')}"><button type="button" class="ui-btn ui-btn-secondary" data-cf="lookup-nm">Найти</button></span></label>
                <label>Артикул в РНП<select id="cf-f-art" data-cf-change="pick-article">${articleOptions(f.article_id)}</select></label>
                <label>Площадка<select id="cf-f-plat">${plat}</select></label>
                <label>Статус<select id="cf-f-status">${st}</select></label>
                <label>Блогер<select id="cf-f-blogger">${blogs}</select></label>
                <label>Дата публикации<input id="cf-f-at" type="datetime-local" value="${escapeHtml(f.publish_at || '')}"></label>
                <label>Ссылка на файл<input id="cf-f-file" value="${escapeHtml(f.file_url || '')}" placeholder="https://…"></label>
                <label>Ссылка на пост<input id="cf-f-url" value="${escapeHtml(f.post_url || '')}" placeholder="https://instagram.com/…"></label>
                <label class="cf-span">Подпись<textarea id="cf-f-cap">${escapeHtml(f.caption || '')}</textarea></label>
                <label>Состав<input id="cf-f-comp" value="${escapeHtml(f.composition_text || '')}"></label>
                <label>Бренд<input id="cf-f-brand" value="${escapeHtml(f.brand_name || '')}"></label>
            </div>
            <div class="cf-card-preview">
                ${photo ? `<img src="${escapeHtml(photo)}" alt="">` : '<div class="cf-ph">Фото из WB</div>'}
                <div>
                    <div class="cf-card-name">${escapeHtml((card && card.title) || (art && art.name) || 'Выберите артикул — подтянем фото, название и цену из WB')}</div>
                    <div class="cf-muted">${art ? 'nmId ' + art.nm_id : ''} · цена ${price}${art && art.cost_price ? ' · себест. ' + art.cost_price : ''}</div>
                </div>
            </div>
            <div class="cf-form-actions">
                <button type="button" class="ui-btn ui-btn-primary" data-cf="save-post">Сохранить черновик</button>
                <button type="button" class="ui-btn ui-btn-secondary" data-cf="to-review">В очередь на подтверждение</button>
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
                    <h3>${escapeHtml((art && (art.name || art.nm_id)) || 'Пост')} · ${escapeHtml(platformLabel(p.platform))}</h3>
                    <span class="cf-st st-draft">ждёт «Ок»</span>
                </div>
                <p class="cf-muted">nmId ${escapeHtml((art && art.nm_id) || '—')} · ${p.publish_at ? escapeHtml(new Date(p.publish_at).toLocaleString('ru-RU')) : 'сразу после подтверждения'}</p>
                ${p.error_text ? `<div class="cf-err">${escapeHtml(p.error_text)}</div>` : ''}
                <div class="cf-slides">${preview}</div>
                <div class="cf-form-actions">
                    <button type="button" class="ui-btn ui-btn-primary" data-cf="approve-post" data-id="${p.id}"${slides.length || p.file_url ? '' : ' disabled'}>Ок</button>
                    <button type="button" class="ui-btn ui-btn-secondary" data-cf="reject-post" data-id="${p.id}">Вернуть в черновик</button>
                    <button type="button" class="cf-link" data-cf="edit-post" data-id="${p.id}">Открыть</button>
                </div>
            </div>`;
        }).join('');
        return `<p class="cf-muted">Пока генератор проверяете глазами: ничего само в Instagram не уходит. «Ок» — единственный путь публикации.</p>
        ${cards || '<div class="cf-muted">Очередь пуста</div>'}`;
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
        const artId = (state.card && state.card.article_id) || '';
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
        });
        const preview = plans.map((s, i) => {
            const ready = state.carouselUrls[i];
            if (ready) return `<div class="cf-slide"><img src="${escapeHtml(ready)}" alt="${s.kind}"><div class="cf-slide-k">${slideKindLabel(s.kind)}</div></div>`;
            return `<div class="cf-slide cf-slide-css kind-${s.kind}">
                ${s.kind === 'cover' && s.photos[0] ? `<img src="${escapeHtml(s.photos[0])}" alt="">` : ''}
                ${s.kind === 'collage' ? `<div class="cf-grid2">${s.photos.map((u) => `<img src="${escapeHtml(u)}" alt="">`).join('')}</div>` : ''}
                ${s.kind === 'info' ? `<div class="cf-slide-info"><div>Артикул ${s.nmId || ''}</div><strong>${escapeHtml(s.title || '')}</strong><div>${s.price != null ? Math.round(s.price).toLocaleString('ru-RU') + ' ₽' : ''}</div><p>${escapeHtml(s.composition || '')}</p></div>` : ''}
                ${s.kind === 'brand' ? `<div class="cf-slide-brand">${escapeHtml(s.brand)}</div>` : ''}
                <div class="cf-slide-k">${slideKindLabel(s.kind)}</div>
            </div>`;
        }).join('');
        return `<div class="widget-card cf-form">
            <h3>Генератор карусели 1080×1350</h3>
            <p class="cf-muted">Обложка целиком → коллаж 2×2 → артикул и состав → закрывающий слайд бренда. Фото из WB API, плюс свои файлы.</p>
            <div class="cf-form-grid">
                <label>Точный nmId<span class="cf-nm-row"><input id="cf-car-nm" type="number" inputmode="numeric" placeholder="247347214" value="${escapeHtml((card && card.nmId) || '')}"><button type="button" class="ui-btn ui-btn-secondary" data-cf="lookup-nm">Найти</button></span></label>
                <label>Артикул в РНП<select id="cf-car-art" data-cf-change="carousel-article">${articleOptions(artId)}</select></label>
                <label>Состав<input id="cf-car-comp" value="${escapeHtml((card && card.composition) || '')}"></label>
                <label>Бренд<input id="cf-car-brand" value="${escapeHtml((card && card.brand) || '')}"></label>
                <label>Подпись<input id="cf-car-cap" placeholder="Текст к посту"></label>
                <label>Доп. фото<input id="cf-car-extra" type="file" accept="image/*" multiple></label>
            </div>
            <div class="cf-slides">${preview}</div>
            <div class="cf-form-actions">
                <button type="button" class="ui-btn ui-btn-primary" data-cf="gen-carousel">Собрать PNG</button>
                <button type="button" class="ui-btn ui-btn-secondary" data-cf="save-carousel-draft">В очередь на подтверждение</button>
            </div>
        </div>`;
    }
    function slideKindLabel(k) {
        return { cover: 'Обложка', collage: 'Детали 2×2', info: 'Артикул + состав', brand: 'Бренд' }[k] || k;
    }

    function igHtml() {
        const ig = state.ig || {};
        return `<div class="widget-card cf-form">
            <h3>Instagram Graph API</h3>
            <p class="cf-muted">App ID и Secret регистрируются на developers.facebook.com и кладутся в env функции (<code>FACEBOOK_APP_ID</code> / <code>FACEBOOK_APP_SECRET</code>). Long-lived токен хранится в Vault, как рекламный токен WB — в таблицу не пишется.</p>
            <div class="cf-st ${ig.connected ? 'st-published' : 'st-draft'}">${ig.connected ? 'Подключено' : 'Не подключено'}${ig.ig_username ? ' · @' + escapeHtml(ig.ig_username) : ''}</div>
            <p class="cf-muted">${ig.configured ? 'OAuth приложения настроен.' : 'OAuth ещё не настроен — можно вставить уже полученный long-lived token.'}</p>
            <div class="cf-form-grid">
                <label>Long-lived token<input id="cf-ig-token" type="password" autocomplete="off" placeholder="вставляется один раз, дальше только Vault"></label>
                <label>IG user id (если известен)<input id="cf-ig-user" placeholder="17841…"></label>
            </div>
            <div class="cf-form-actions">
                <button type="button" class="ui-btn ui-btn-primary" data-cf="ig-store">Сохранить в Vault</button>
                <button type="button" class="ui-btn ui-btn-secondary" data-cf="ig-oauth"${ig.configured ? '' : ' disabled'}>OAuth Business</button>
                ${ig.connected ? '<button type="button" class="ui-btn ui-btn-secondary" data-cf="ig-off">Отключить</button>' : ''}
            </div>
            <p class="cf-muted">Карусель: контейнер на слайд → объединение → publish. В ленту только после «Ок» в очереди. Крон раз в 5 минут берёт уже подтверждённые слоты с датой. Ошибка пишет статус «ошибка» и текст. Тесты — dry_run, живой Graph не дергаем.</p>
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
        let searchHtml = '<p class="cf-muted">Рост поисковых запросов бренда — тот же WB search-report, что в SEO-позициях. Новый источник не заводим.</p><button type="button" class="ui-btn ui-btn-secondary" data-cf="wb-search">Показать запросы WB</button>';
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
                <tbody>${dayRows || '<tr><td colspan="6" class="cf-muted">Пока нет просмотров — их вводят в выплатах блогеров</td></tr>'}</tbody>
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
        sb = supabase;
        cab = cabinetId;
        callWb = callWbProxy;
        opts = extra || {};
        return ContentFactory;
    }
    async function open() {
        const el = rootEl();
        if (el && !el._cfBound) {
            el._cfBound = true;
            el.addEventListener('click', onClick);
            el.addEventListener('change', onChange);
        }
        await reload();
    }

    const ContentFactory = {
        PLATFORMS, STATUSES, SLIDE_W, SLIDE_H,
        computePayout, monthStart, ymd, parseWbCard, pickComposition, pickCardPrice, pickCardByNmId,
        planCarouselSlides, groupPostsByDay, calendarCells, viewsByPlatform, topPosts, filterPosts, uniqUrls,
        ensureReady, open, reload,
        _state: state,
    };
    root.ContentFactory = ContentFactory;
    if (typeof module !== 'undefined' && module.exports) module.exports = ContentFactory;
})(typeof window !== 'undefined' ? window : globalThis);

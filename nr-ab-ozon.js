/* А/Б тесты фото для Ozon: переключатель WB | Ozon в разделе, мастер создания теста для Ozon и смена главного фото.
   Всё тяжёлое идёт в фоне: окно закрывается сразу, карточка теста видна сразу, фото грузятся и ставятся потом.
   Ключи Ozon на сайт не попадают: фото меняет edge-функция ozon-photo (и по расписанию ab-test-rotate). */
(function (root) {
    'use strict';
    var doc = root.document; if (!doc) return;
    var KEY = 'nr_ab_mp', mode = 'wb';
    try { var v = root.localStorage.getItem(KEY); if (v === 'ozon') mode = 'ozon'; } catch (_) { /* без памяти */ }

    var LOGO = {
        wb: '<svg viewBox="0 0 30 14" aria-hidden="true"><text x="15" y="11.5" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="13.5" fill="currentColor" letter-spacing="-.6">WB</text></svg>',
        ozon: '<svg viewBox="0 0 40 14" aria-hidden="true"><text x="20" y="11.5" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="13.5" fill="currentColor" letter-spacing="-.6">ozon</text></svg>'
    };
    function $(id) { return doc.getElementById(id); }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function toast(kind, title, text, opts) { if (root.NrUi) return root.NrUi.toast(kind, title, text || '', opts || {}); return null; }
    function tests() { try { return allABTests; } catch (_) { return []; } }
    function cab() { try { return currentCabinetId; } catch (_) { return null; } }
    function sb() { try { return supabase; } catch (_) { return null; } }
    function plat(t) { return t && t.marketplace === 'ozon' ? 'ozon' : 'wb'; }

    /* ───── Переключатель площадки в панели раздела ───── */
    function paintSwitch() {
        var bar = $('ab-mp'); if (!bar) return;
        Array.prototype.forEach.call(bar.querySelectorAll('button'), function (b) { var on = b.getAttribute('data-mp') === mode; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    }
    function setMode(m) {
        if (m === mode) return; mode = m;
        try { root.localStorage.setItem(KEY, m); } catch (_) { /* без памяти */ }
        paintSwitch();
        try { renderABTests(); } catch (_) { /* список ещё не готов */ }
    }
    function mount() {
        var bar0 = $('ab-mp'); var tb = doc.querySelector('#tab-ab-testing .ab-toolbar');
        if (!tb || bar0) { paintSwitch(); return; }
        var bar = doc.createElement('div'); bar.id = 'ab-mp'; bar.className = 'nr-mp ab-mp'; bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'Площадка');
        bar.innerHTML = ['wb', 'ozon'].map(function (m) { return '<button type="button" data-mp="' + m + '" title="' + (m === 'wb' ? 'WB' : 'Ozon') + '" aria-label="' + (m === 'wb' ? 'WB' : 'Ozon') + '">' + LOGO[m] + '</button>'; }).join('');
        bar.addEventListener('click', function (e) { var b = e.target.closest('button[data-mp]'); if (b) setMode(b.getAttribute('data-mp')); });
        var pill = $('ab-new-btn'); tb.insertBefore(bar, pill ? pill.nextSibling : tb.firstChild); paintSwitch();
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', mount); else mount();
    var mt = 0; new MutationObserver(function () { if (mt || $('ab-mp')) return; mt = setTimeout(function () { mt = 0; mount(); }, 250); }).observe(doc.body || doc.documentElement, { childList: true, subtree: true });

    /* ───── Смена главного фото у теста Ozon ───── */
    function isOz(testId) { var t = tests().find(function (x) { return String(x.id) === String(testId); }); return plat(t) === 'ozon'; }
    async function rotate(testId, variantIndex, photoUrl, variantLabel) {
        var t = tests().find(function (x) { return String(x.id) === String(testId); });
        var oz = (t && t.settings && t.settings.ozon) || {};
        if (!photoUrl || !(oz.products || []).length) { toast('error', 'Фото на Ozon не поменялось', 'У теста нет товаров Ozon.'); return false; }
        try {
            var r = await sb().functions.invoke('ozon-photo', { body: { action: 'set_main', cabinet_id: t.cabinet_id, photo_url: photoUrl, products: oz.products } });
            var d = r && r.data;
            if (r.error || !d || d.error || !d.applied) { toast('error', 'Ozon не принял фото', String((d && d.error) || (r.error && r.error.message) || 'попробуйте ещё раз').slice(0, 160)); return false; }
            if (!d.ok) toast('info', 'Фото поставлено не везде', d.applied + ' из ' + d.total + ' товаров');
            var lg = await sb().from('ab_test_rotation_log').insert({ test_id: testId, variant_label: variantLabel || '', action: variantIndex === 0 ? 'start' : 'rotate' });
            if (lg && lg.error) console.warn('[AB Ozon] лог ротации:', lg.error.message);
            return true;
        } catch (e) { toast('error', 'Ozon не принял фото', String(e && e.message || e).slice(0, 160)); return false; }
    }

    /* ───── Мастер создания теста для Ozon ───── */
    var W = { arts: null, art: null, card: null, variants: [], busy: false };
    function overlay() {
        var el = $('ab-oz-form'); if (el) return el;
        el = doc.createElement('div'); el.id = 'ab-oz-form'; el.className = 'rnp-settings-overlay';
        el.innerHTML = '<div class="rnp-settings-dialog ab-new-dialog nr-win" role="dialog" aria-modal="true" aria-label="Новый А/Б тест Ozon">' +
            '<button type="button" class="rnp-settings-close" data-oz="close" aria-label="Закрыть">×</button>' +
            '<div class="ab-new-body" id="ab-oz-body"></div>' +
            '<div class="ab-new-foot"><button type="button" class="ab-btn ab-btn-ghost" data-oz="close">Отмена</button><button type="button" class="ab-btn ab-btn-primary" id="ab-oz-create" data-oz="create" hidden>Создать тест</button></div></div>';
        el.addEventListener('click', function (e) {
            if (e.target === el || e.target.closest('[data-oz="close"]')) { close(); return; }
            var b;
            if ((b = e.target.closest('[data-oz-art]'))) { pick(b.getAttribute('data-oz-art')); return; }
            if ((b = e.target.closest('[data-oz-add]'))) { addUrl(b.getAttribute('data-oz-add')); return; }
            if ((b = e.target.closest('[data-oz-del]'))) { W.variants.splice(Number(b.getAttribute('data-oz-del')), 1); paintVariants(); return; }
            if (e.target.closest('[data-oz="create"]')) create();
        });
        el.addEventListener('input', function (e) { if (e.target.id === 'ab-oz-q') paintList(e.target.value); });
        el.addEventListener('change', function (e) { if (e.target.id === 'ab-oz-file') { addFiles(e.target.files); e.target.value = ''; } });
        doc.addEventListener('paste', function (e) {
            if (!el.classList.contains('is-open') || !W.art) return;
            var items = (e.clipboardData && e.clipboardData.files) || [];
            if (items.length) { addFiles(items); e.preventDefault(); }
        });
        doc.body.appendChild(el); return el;
    }
    function close() { var el = $('ab-oz-form'); if (el) el.classList.remove('is-open'); }
    function openNew() {
        if (!cab()) { toast('info', 'Выберите кабинет', ''); return; }
        W.art = null; W.card = null; W.variants = [];
        var el = overlay(); try { mountNrGlass(el); } catch (_) { /* без стекла */ }
        el.classList.add('is-open');
        paintPick(); loadArts();
        setTimeout(function () { var q = $('ab-oz-q'); if (q) q.focus(); }, 80);
    }
    function paintPick() {
        $('ab-oz-create').hidden = true;
        $('ab-oz-body').innerHTML = '<div class="ab-wizard-card"><h4>Товар Ozon</h4><input type="text" id="ab-oz-q" class="ab-product-search" placeholder="Название или артикул, например костюм_укороченный_чёрный" autocomplete="off"><div id="ab-oz-list" class="ab-oz-list"></div></div>';
        paintList('');
    }
    async function loadArts() {
        var key = 'nr_ab_oz_arts_' + cab();
        if (!W.arts) { try { W.arts = JSON.parse(root.localStorage.getItem(key) || 'null'); } catch (_) { W.arts = null; } paintList(($('ab-oz-q') || {}).value || ''); }
        try {
            var r = await sb().rpc('ozon_rnp_articles', { p_cabinet: cab() });
            if (r && Array.isArray(r.data)) { W.arts = r.data; try { root.localStorage.setItem(key, JSON.stringify(r.data)); } catch (_) { /* кэш не влез */ } paintList(($('ab-oz-q') || {}).value || ''); }
            else if (!W.arts) { var l = $('ab-oz-list'); if (l) l.innerHTML = '<div class="ab-pick-status">Не удалось загрузить товары Ozon. Закройте окно и откройте снова.</div>'; }
        } catch (_) { /* старый список остаётся */ }
    }
    function paintList(q) {
        var l = $('ab-oz-list'); if (!l) return;
        if (!W.arts) { l.innerHTML = '<div class="ab-skel" style="height:120px"></div>'; return; }
        q = String(q || '').trim().toLowerCase();
        var list = W.arts.filter(function (a) { return !q || String(a.name || '').toLowerCase().indexOf(q) >= 0 || String(a.card_title || '').toLowerCase().indexOf(q) >= 0; }).slice(0, 60);
        l.innerHTML = list.length ? list.map(function (a) { return '<button type="button" class="ab-oz-row" data-oz-art="' + esc(a.name) + '"><b>' + esc(a.name) + '</b><small>' + esc(a.card_title || '') + '</small></button>'; }).join('') : '<div class="ab-pick-status">Ничего не найдено</div>';
    }
    async function pick(base) {
        W.art = (W.arts || []).find(function (a) { return a.name === base; }) || { name: base };
        $('ab-oz-body').innerHTML = '<div class="ab-wizard-card"><h4>' + esc(base) + '</h4><div class="ab-skel" style="height:140px"></div></div>';
        try {
            var r = await sb().functions.invoke('ozon-photo', { body: { action: 'card', cabinet_id: cab(), base: base } });
            if (r.error || !r.data || r.data.error) throw new Error((r.data && r.data.error) || (r.error && r.error.message) || 'нет ответа');
            W.card = r.data;
        } catch (e) { toast('error', 'Не удалось получить карточку Ozon', String(e.message || e).slice(0, 160)); paintPick(); return; }
        W.variants = W.card.primary ? [{ url: W.card.primary, cur: true }] : [];
        paintForm();
    }
    function paintForm() {
        var c = W.card;
        $('ab-oz-create').hidden = false;
        $('ab-oz-body').innerHTML =
            '<div class="ab-wizard-card"><h4>' + esc(W.art.name) + '</h4><div class="ab-wizard-hint">Размеры (' + c.offers.length + ' шт.) получат одно и то же главное фото. Остальные фото карточек не трогаем.</div>' +
            '<div class="ab-photo-gallery">' + (c.rest || []).map(function (u) { return '<img class="ab-photo-thumb" src="' + esc(u) + '" data-oz-add="' + esc(u) + '" title="Добавить это фото вариантом" alt="">'; }).join('') + '</div></div>' +
            '<div class="ab-wizard-card"><h4>Варианты главного фото</h4><div id="ab-oz-vars" class="ab-var-grid"></div>' +
            '<label class="ab-btn ab-btn-ghost ab-oz-file">+ Фото файлом<input type="file" id="ab-oz-file" accept="image/*" multiple hidden></label>' +
            '<div class="ab-wizard-hint">Первый вариант: текущее главное фото. Добавьте минимум одно: файлом, Ctrl+V или кликом по фото карточки выше.</div></div>' +
            '<div class="ab-wizard-card"><h4>Смена фото</h4><div class="ab-stop-grid"><div><div class="text-xs mb-1">Менять каждые, мин</div><input type="number" id="ab-oz-int" value="180" min="60" max="1440" step="30" class="ab-product-search"></div>' +
            '<div><div class="text-xs mb-1">Макс. ротаций</div><input type="number" id="ab-oz-max" value="0" min="0" class="ab-product-search"></div></div>' +
            '<div class="ab-wizard-hint">Победитель считается по заказам Ozon за время, пока стояло фото. Ozon проверяет новые фото, поэтому реже раза в час не меняем.</div></div>';
        paintVariants();
    }
    function paintVariants() {
        var g = $('ab-oz-vars'); if (!g) return;
        g.innerHTML = W.variants.map(function (v, i) {
            var src = v.url || v.preview || '';
            return '<div class="ab-var-slot"><img src="' + esc(src) + '" alt=""><b>' + (typeof abVariantLabel === 'function' ? abVariantLabel(i) : i + 1) + '</b>' + (v.cur ? '<small>сейчас</small>' : '<button type="button" data-oz-del="' + i + '" aria-label="Убрать">×</button>') + '</div>';
        }).join('');
    }
    function addUrl(u) { if (!u || W.variants.some(function (v) { return v.url === u; })) return; W.variants.push({ url: u }); paintVariants(); }
    function addFiles(list) {
        Array.prototype.forEach.call(list || [], function (f) {
            if (!f || !/^image\//.test(f.type || '')) return;
            var v = { file: f, preview: '' }; W.variants.push(v); paintVariants();
            var rd = new FileReader(); rd.onload = function (e) { v.preview = e.target.result; paintVariants(); }; rd.readAsDataURL(f);
        });
    }
    function create() {
        if (!W.card || W.busy) return;
        if (W.variants.length < 2) { toast('info', 'Нужно минимум 2 фото', 'Добавьте ещё один вариант.'); return; }
        var snap = {
            cabinetId: cab(), base: W.art.name, title: W.card.name || W.art.name, nm: W.art.nm_id,
            interval: Math.max(60, parseInt(($('ab-oz-int') || {}).value, 10) || 180), maxRot: parseInt(($('ab-oz-max') || {}).value, 10) || 0,
            variants: W.variants.slice(), offers: W.card.offers.map(function (o) { return { product_id: o.product_id, rest: W.card.rest || [] }; }), offerIds: W.card.offers.map(function (o) { return o.offer_id; })
        };
        close(); toast('success', 'Тест создан', 'Фото загружаются в фоне. Главное фото на Ozon не меняется, пока не пройдёт первый интервал.');
        run(snap);
    }
    async function run(snap) {
        var settings = { metric: 'orders', sources: { ads: false, funnel: false }, platforms: ['all'], campaigns: [], rotateByImpressions: false, autoStop: false, stopOnWinner: false, finishOnCampaignOff: false, stopCampaigns: false,
            ozon: { base: snap.base, products: snap.offers, offer_ids: snap.offerIds } };
        var tmp = { id: 'tmp-' + Date.now(), cabinet_id: snap.cabinetId, nm_id: String(snap.nm || ''), product_name: snap.title, marketplace: 'ozon', status: 'active', rotation_interval_min: snap.interval, started_at: new Date().toISOString(), settings: settings, variants: [] };
        try { allABTests.unshift(tmp); renderABTests(); } catch (_) { /* список ещё не открыт */ }
        var testId = null;
        try {
            var ins = await sb().from('ab_tests').insert({ cabinet_id: snap.cabinetId, nm_id: String(snap.nm || ''), product_name: snap.title, marketplace: 'ozon', status: 'active', rotation_interval_min: snap.interval,
                max_rotations: snap.maxRot || null, current_variant_index: 0, rotation_count: 0, started_at: new Date().toISOString(), last_rotated_at: new Date().toISOString(), settings: settings }).select().single();
            if (ins.error || !ins.data) throw new Error((ins.error && ins.error.message) || 'Тест не сохранился.');
            testId = ins.data.id;
            var urls = await Promise.all(snap.variants.map(function (v, i) { return v.file ? uploadVariantPhoto(v.file, testId, abVariantLabel(i)) : Promise.resolve(v.url); }));
            var rows = urls.map(function (u, i) { return { test_id: testId, variant_label: abVariantLabel(i), photo_url: u, impressions: 0, clicks: 0, orders: 0, minutes_active: 0, is_currently_on_wb: i === 0 }; });
            var vr = await sb().from('ab_test_variants').insert(rows);
            if (vr.error) throw new Error(vr.error.message);
            await sb().from('ab_test_rotation_log').insert({ test_id: testId, variant_label: rows[0].variant_label, action: 'start' });
            toast('success', 'Тест запущен', 'Фото будет меняться каждые ' + snap.interval + ' мин.');
        } catch (e) {
            if (testId) { try { await sb().from('ab_tests').delete().eq('id', testId); } catch (_) { /* уже нет */ } }
            toast('error', 'Тест не создался', String(e && e.message || e).slice(0, 160), { action: { label: 'Повторить', onClick: function () { run(snap); } } });
        } finally {
            try { allABTests = allABTests.filter(function (t) { return t !== tmp; }); renderABTests(); loadABTests(); } catch (_) { /* вкладка закрыта */ }
        }
    }

    root.NrAbOz = {
        mode: function () { return mode; },
        filter: function (list) { return (list || []).filter(function (t) { return plat(t) === mode; }); },
        isOz: isOz, rotate: rotate, openNew: openNew
    };
})(typeof window !== 'undefined' ? window : globalThis);

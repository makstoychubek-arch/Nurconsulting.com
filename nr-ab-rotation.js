/* Окно «Новый А/Б тест»: по умолчанию смена фото «по кругу по времени».
 * Кнопки интервала 15 / 20 / 30 / 60 / 120 минут, подсказка про длину круга и автозавершение,
 * когда лидер выигрывает с вероятностью 95%. Работает поверх существующих полей формы,
 * поэтому серверная часть и расчёт не меняются. Существующие тесты не затрагиваются. */
(function (root) {
    'use strict';
    var doc = root.document;
    if (!doc) return;
    var PRESETS = [15, 20, 30, 60, 120];

    function $(id) { return doc.getElementById(id); }
    function fmtDur(min) {
        var h = Math.floor(min / 60), m = Math.round(min % 60);
        return (h ? h + ' ч' : '') + (h && m ? ' ' : '') + (m ? m + ' мин' : (h ? '' : '0 мин'));
    }
    function variantCount() {
        var box = $('variant-inputs');
        return box ? box.querySelectorAll('.ab-var-tile.has-img, .ab-var-tile.is-current').length : 0;
    }
    function paintChips() {
        var input = $('abt-interval');
        var v = input ? parseInt(input.value, 10) : 0;
        doc.querySelectorAll('#ab-rot-chips .ab-pill').forEach(function (p) {
            p.classList.toggle('active', Number(p.getAttribute('data-min')) === v);
        });
        var note = $('ab-rot-note');
        if (!note) return;
        var n = variantCount();
        note.textContent = n >= 2 && v > 0
            ? n + ' фото × ' + v + ' мин = круг за ' + fmtDur(n * v) + '. Потом снова первое фото.'
            : 'Фото идут по кругу и возвращаются, каждое побывает и утром, и вечером.';
    }
    function setup() {
        var sel = $('ab-rot-mode'), wrap = $('abWInt'), input = $('abt-interval');
        if (!sel || !wrap || !input) return;
        if (!sel.__nrRot) {
            sel.__nrRot = true;
            var opts = sel.options;
            for (var i = 0; i < opts.length; i++) {
                if (opts[i].value === 'time') opts[i].textContent = 'по кругу по времени (рекомендуем)';
                if (opts[i].value === 'imp') opts[i].textContent = 'по показам (запасной режим)';
            }
            var time = null; for (var j = 0; j < opts.length; j++) if (opts[j].value === 'time') time = opts[j];
            if (time) sel.insertBefore(time, sel.firstChild);
            var lbl = wrap.querySelector('.text-xs'); if (lbl) lbl.textContent = 'Держать каждое фото, мин';
            var chips = doc.createElement('div');
            chips.id = 'ab-rot-chips'; chips.className = 'ab-pill-toggle'; chips.style.cssText = 'margin-top:8px';
            chips.innerHTML = PRESETS.map(function (m) { return '<div class="ab-pill" data-min="' + m + '">' + (m >= 60 ? (m / 60) + ' ч' : m + ' мин') + '</div>'; }).join('');
            chips.addEventListener('click', function (e) {
                var p = e.target.closest && e.target.closest('.ab-pill'); if (!p) return;
                input.value = p.getAttribute('data-min'); paintChips();
            });
            wrap.appendChild(chips);
            var note = doc.createElement('div');
            note.id = 'ab-rot-note'; note.className = 'ab-wizard-hint'; wrap.appendChild(note);
            input.addEventListener('input', paintChips);
            input.min = '15'; input.step = '1';
            var vi = $('variant-inputs'); if (vi) new MutationObserver(paintChips).observe(vi, { childList: true, subtree: true });
            var stop = doc.querySelector('#ab-stop-on-winner'), stopLbl = stop && stop.closest('label');
            if (stopLbl && !$('ab-stop-conf')) {
                var l = doc.createElement('label'); l.className = 'ab-check';
                l.innerHTML = '<input type="checkbox" id="ab-stop-conf" checked> Завершить, когда лидер выигрывает с вероятностью 95% (от 1000 показов у лидера)';
                stopLbl.parentNode.insertBefore(l, stopLbl);
            }
        }
        var conf = $('ab-stop-conf'); if (conf) conf.checked = true;
        sel.value = 'time';
        if (!input.value || Number(input.value) < 15) input.value = '30';
        wrap.hidden = false;
        var imp = $('abWImp'); if (imp) imp.hidden = true;
        paintChips();
    }
    // Дополнительные настройки теста для createABTest: автозавершение по вероятности лидера.
    function extra() {
        var c = $('ab-stop-conf');
        return c && c.checked ? { stopOnWinner: true, minWinnerProb: 0.95, minCtr: 0.01, minWinnerImpressions: 1000 } : {};
    }
    function boot() {
        var orig = root.showNewTestForm;
        if (typeof orig === 'function' && !orig.__nrRot) {
            var w = function () { var r = orig.apply(this, arguments); try { setup(); } catch (e) { /* форма работает и без дополнения */ } return r; };
            w.__nrRot = true; root.showNewTestForm = w;
        }
    }

    /* ───── Перезапуск завершённого теста ─────
     * Кнопка «Перезапустить» у завершённого А/Б теста: окно открывается сразу, фото те же и в том же порядке,
     * остаётся выбрать РК (прежние уже отмечены). Дальше тест создаётся в фоне как обычный новый:
     * карточка появляется в списке сразу, фото встают на WB само. Старый тест остаётся в списке как история. */
    var busy = {};
    function esc(x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function findTest(id) { try { return (root.allABTests || allABTests || []).filter(function (t) { return String(t.id) === String(id); })[0]; } catch (e) { return null; } }
    function photosOf(t) {
        return (t.variants || []).slice().sort(function (a, b) { return String(a.variant_label).localeCompare(String(b.variant_label), 'ru', { numeric: true }); })
            .map(function (v) { return v.photo_url; }).filter(Boolean);
    }
    function btn(t) {
        if (!t || t.status !== 'finished' || String(t.id).indexOf('tmp-') === 0 || (t.settings && t.settings.ozon) || photosOf(t).length < 2) return '';
        return '<button class="btn-outline" style="font-size:11px;padding:5px 10px;color:var(--accent)" onclick="NrAbRot.restart(\'' + esc(t.id) + '\')">Перезапустить</button>';
    }
    function toast(kind, title, text) { try { root.NrUi ? root.NrUi.toast(kind, title, text || '') : root.alert(title + ' ' + (text || '')); } catch (e) { /* без уведомления */ } }
    function restart(id) {
        var t = findTest(id);
        if (!t || busy[id]) return;
        var photos = photosOf(t);
        if (photos.length < 2) { toast('error', 'Нечего перезапускать', 'У теста нет сохранённых фото.'); return; }
        // На одном артикуле два активных теста дрались бы за обложку
        var clash = (root.allABTests || allABTests || []).filter(function (x) { return x.status === 'active' && String(x.nm_id) === String(t.nm_id) && x.id !== t.id; })[0];
        if (clash) { toast('error', 'У артикула уже идёт тест', 'Сначала завершите его, потом перезапускайте этот.'); return; }
        var st = t.settings || {};
        var names = Object.assign({}, st.campaignNames || {});
        var picked = new Set((st.campaigns || []).map(Number));
        var rows = {}; // id → { id, name, status }
        (st.campaigns || []).forEach(function (cid) { rows[cid] = { id: Number(cid), name: names[String(cid)] || ('РК ' + cid), status: null }; });
        var body = doc.createElement('div');
        body.innerHTML = '<div style="font-size:13px;margin-bottom:10px">Фото те же: <b>' + photos.length + '</b>, в прежнем порядке. Выберите РК.</div>'
            + '<div style="display:flex;gap:6px;overflow:hidden;margin-bottom:10px">' + photos.slice(0, 6).map(function (u) { return '<img src="' + esc(u) + '" alt="" style="width:44px;height:58px;object-fit:cover;border-radius:6px;border:1px solid var(--border)">'; }).join('') + '</div>'
            + '<input type="search" placeholder="Найти РК" class="ab-rs-q" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:10px;background:transparent;color:inherit;font-size:13px;margin-bottom:8px">'
            + '<div class="ab-rs-list" style="max-height:260px;overflow:auto;display:flex;flex-direction:column;gap:2px"></div>';
        var listEl = body.querySelector('.ab-rs-list'), qEl = body.querySelector('.ab-rs-q');
        function paint() {
            var q = (qEl.value || '').trim().toLowerCase();
            var arr = Object.keys(rows).map(function (k) { return rows[k]; }).filter(function (r) { return !q || (r.name + ' ' + r.id).toLowerCase().indexOf(q) >= 0; });
            arr.sort(function (a, b) { return (picked.has(b.id) ? 1 : 0) - (picked.has(a.id) ? 1 : 0); });
            listEl.innerHTML = arr.length ? arr.map(function (r) {
                var lbl = r.status === 9 ? 'идёт' : r.status === 11 ? 'на паузе' : (r.status === 'gone' ? 'не найдена' : '');
                return '<label style="display:flex;gap:8px;align-items:center;padding:6px 4px;font-size:13px;cursor:pointer"><input type="checkbox" style="accent-color:var(--accent)" data-id="' + r.id + '"' + (picked.has(r.id) ? ' checked' : '') + '><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(r.name) + ' <span style="color:var(--text-muted)">· ' + r.id + '</span></span><span style="font-size:11px;color:var(--text-muted)">' + lbl + '</span></label>';
            }).join('') : '<div style="font-size:12px;color:var(--text-muted);padding:8px 4px">Ничего не найдено</div>';
        }
        listEl.addEventListener('change', function (e) { var c = e.target; if (!c || !c.getAttribute) return; var cid = Number(c.getAttribute('data-id')); if (c.checked) picked.add(cid); else picked.delete(cid); });
        qEl.addEventListener('input', paint);
        paint();
        // Полный список РК подтягиваем в фоне: окно уже открыто, отметки не сбрасываются
        Promise.resolve(root.callWbProxy ? root.callWbProxy('advert_campaigns', {}) : null).then(function (data) {
            var list = (data && data.campaigns) || [], seen = {};
            list.forEach(function (c) {
                var cid = Number(c.id); if (!cid || (c.status !== 9 && c.status !== 11)) return;
                var nm = String(c.name || '').trim(), generic = !nm || /^кампания\s+\d+$/i.test(nm);
                rows[cid] = { id: cid, name: (!generic && nm) || (rows[cid] && rows[cid].name) || ('РК ' + cid), status: c.status }; seen[cid] = 1;
            });
            if (list.length) Object.keys(rows).forEach(function (k) { if (!seen[k]) { rows[k].status = 'gone'; picked.delete(Number(k)); } });
            paint();
        }).catch(function () { /* остаются прежние РК из теста */ });
        var dlg = root.NrUi && root.NrUi.dialog({
            title: 'Перезапустить тест', body: body, size: 's',
            actions: [{ label: 'Отмена' }, { label: 'Запустить', primary: true, onClick: function () { go(t, photos, picked, rows); } }],
        });
        if (!dlg) go(t, photos, picked, rows);
    }
    function go(t, photos, picked, rows) {
        var st = Object.assign({}, t.settings || {});
        var ids = Array.from(picked);
        var sources = st.sources || { ads: true, funnel: true };
        if (sources.ads && !ids.length) { toast('error', 'Выберите РК', 'Тест крутится на рекламе, нужна хотя бы одна кампания.'); return false; }
        var byImp = st.rotateByImpressions === true;
        if (byImp && !ids.length) { toast('error', 'Выберите РК', 'Для смены по показам нужна РК.'); return false; }
        busy[t.id] = 1;
        setTimeout(function () { delete busy[t.id]; }, 8000);
        st.campaigns = ids;
        st.campaignNames = Object.fromEntries(ids.map(function (cid) { return [String(cid), (rows[cid] && rows[cid].name) || ('РК ' + cid)]; }));
        st.rotateByImpressions = byImp && ids.length > 0;
        var snap = {
            cabinetId: t.cabinet_id, nmId: String(t.nm_id), name: t.product_name,
            interval: t.rotation_interval_min || 30, maxRot: t.max_rotations || 0,
            abFiles: photos, rotMode: st.rotateByImpressions ? 'imp' : 'time', minImp: Number(st.minImpressions) || 1000, settings: st,
        };
        toast('success', 'Тест перезапущен', 'Фото встают на WB в фоне. РК запускаете в кабинете WB сами.');
        try { root.runABCreate(snap); } catch (e) { toast('error', 'Не удалось перезапустить', String(e && e.message || e)); }
    }

    /* ───── Карточка теста: кольцо до смены фото, подсказки кнопок-иконок, метка «+N» у ленты ───── */
    function ringVals(t) {
        var st = t.settings || {};
        if (st.rotateByImpressions === true) {
            var quota = Number(st.minImpressions) || 2000;
            var cur = (t.variants || []).filter(function (v) { return v.is_currently_on_wb; })[0];
            var have = Math.max(0, Math.round(Number(cur && cur.impressions) || 0));
            var pct = Math.min(100, have / quota * 100);
            return { p: pct, text: String(Math.round(pct)), imp: true, title: 'Показов у этого фото: ' + have + ' из ' + quota };
        }
        var ms = (t.rotation_interval_min || 60) * 60000;
        var since = new Date(t.last_rotated_at || t.started_at || Date.now()).getTime();
        var left = Math.max(0, ms - (Date.now() - since));
        var min = Math.ceil(left / 60000);
        return { p: Math.min(100, (ms - left) / ms * 100), text: String(min), imp: false, title: min > 0 ? 'До смены фото: ' + min + ' мин' : 'Фото сменится сейчас' };
    }
    function ring(t) {
        if (!t || t.status !== 'active' || String(t.id).indexOf('tmp-') === 0) return '';
        var v = ringVals(t);
        return '<span class="ab-ring' + (v.imp ? ' is-imp' : '') + '" data-ab-ring="' + esc(t.id) + '" style="--p:' + v.p.toFixed(1) + '" title="' + esc(v.title) + '" role="img" aria-label="' + esc(v.title) + '"><b>' + v.text + '</b></span>';
    }
    function tickRings() {
        var list; try { list = allABTests || []; } catch (e) { return; }
        doc.querySelectorAll('.ab-ring[data-ab-ring]').forEach(function (el) {
            var t = list.filter(function (x) { return String(x.id) === el.getAttribute('data-ab-ring'); })[0];
            if (!t) return;
            var v = ringVals(t), b = el.firstElementChild;
            el.style.setProperty('--p', v.p.toFixed(1));
            if (b && b.textContent !== v.text) b.textContent = v.text;
            if (el.title !== v.title) { el.title = v.title; el.setAttribute('aria-label', v.title); }
        });
    }
    var TITLES = { openABReportModal: 'Отчёт', editABTest: 'Редактировать', finishABTest: 'Завершить', deleteABTest: 'Удалить' };
    function decorate() {
        doc.querySelectorAll('.abtest-card-actions button[onclick]').forEach(function (b) {
            var m = /^(\w+)/.exec(b.getAttribute('onclick') || ''), t = m && TITLES[m[1]];
            if (t && b.getAttribute('aria-label') !== t) { b.setAttribute('aria-label', t); b.title = t; }
        });
        doc.querySelectorAll('.abtest-strip').forEach(function (st) {
            var n = st.querySelectorAll('.abtest-variant').length;
            if (n > 4) { if (st.getAttribute('data-more') !== '+' + (n - 4)) st.setAttribute('data-more', '+' + (n - 4)); } else { st.removeAttribute('data-more'); st.removeAttribute('data-end'); }
        });
        tickRings();
        if (root.NrAbImg) root.NrAbImg.warmDom();
    }
    function stripScroll(e) {
        var r = e.target;
        if (!r || !r.classList || !r.classList.contains('abtest-variants') || !r.parentNode) return;
        var end = r.scrollLeft + r.clientWidth >= r.scrollWidth - 4;
        if (end) r.parentNode.setAttribute('data-end', ''); else r.parentNode.removeAttribute('data-end');
    }
    function watchList() {
        var host = $('abtests-list');
        if (!host || host.__nrAbDeco) return !!host;
        host.__nrAbDeco = true;
        new root.MutationObserver(function () { decorate(); }).observe(host, { childList: true, subtree: true });
        host.addEventListener('scroll', stripScroll, true);
        decorate();
        return true;
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function () { watchList(); });
    else watchList();
    root.setInterval(function () { wrapEdit(); if (!watchList()) return; decorate(); }, 1000);


    /* ───── Фото А/Б тестов: лёгкие копии в памяти и IndexedDB, как в РНП ─────
     * Оригиналы в хранилище большие, плитка 88 px тянет мегабайты. Скачиваем один раз, сжимаем до 360 px, кладём в IndexedDB
     * и держим готовые blob-ссылки в памяти: при следующем заходе фото на месте с первого кадра. Прогрев идёт в фоне
     * сразу после загрузки страницы по сохранённому списку тестов. Нет копии: показываем оригинал и подменяем на лету. */
    var Img = (function () {
        var map = {}, busy = {}, queue = [], active = 0, db = null;
        function openDb() {
            return new Promise(function (res) {
                try { var r = root.indexedDB.open('nr-ab-img', 1); r.onupgradeneeded = function () { r.result.createObjectStore('t'); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { res(null); }; } catch (e) { res(null); }
            });
        }
        var ready = openDb().then(function (d) {
            db = d; if (!d) return;
            return new Promise(function (res) {
                try { var c = d.transaction('t').objectStore('t').openCursor(); c.onsuccess = function () { var cur = c.result; if (cur) { try { map[cur.key] = root.URL.createObjectURL(cur.value); } catch (e) { /* пропускаем */ } cur.continue(); } else res(); }; c.onerror = function () { res(); }; } catch (e) { res(); }
            }).then(function () { swap(); });
        });
        function swap(url) {
            doc.querySelectorAll('.abtest-variant img[src^="http"], .ab-report-img-wrap img[src^="http"]').forEach(function (im) {
                var u = im.getAttribute('src');
                if ((!url || u === url) && map[u]) im.setAttribute('src', map[u]);
            });
        }
        function thumb(url) {
            return root.fetch(url, { cache: 'force-cache' }).then(function (r) { if (!r.ok) throw new Error('http'); return r.blob(); })
                .then(function (b) { return root.createImageBitmap(b); })
                .then(function (bm) {
                    var w = Math.min(360, bm.width), h = Math.max(1, Math.round(bm.height * w / bm.width)), c = doc.createElement('canvas');
                    c.width = w; c.height = h; c.getContext('2d').drawImage(bm, 0, 0, w, h); if (bm.close) bm.close();
                    return new Promise(function (res, rej) { c.toBlob(function (x) { x ? res(x) : rej(new Error('blob')); }, 'image/webp', 0.82); });
                });
        }
        function pump() {
            while (active < 3 && queue.length) {
                (function (url) {
                    active++;
                    thumb(url).then(function (blob) {
                        map[url] = root.URL.createObjectURL(blob);
                        if (db) { try { db.transaction('t', 'readwrite').objectStore('t').put(blob, url); } catch (e) { /* без сохранения */ } }
                        swap(url);
                    }).catch(function () { /* остаётся оригинал */ }).then(function () { active--; pump(); });
                })(queue.shift());
            }
        }
        function warm(urls) {
            ready.then(function () {
                (urls || []).forEach(function (u) { if (typeof u === 'string' && /^https?:/.test(u) && !map[u] && !busy[u]) { busy[u] = 1; queue.push(u); } });
                pump();
            });
        }
        function u(url) { return (url && map[url]) || url; }
        function warmDom() {
            var urls = []; doc.querySelectorAll('.abtest-variant img[src^="http"], .ab-report-img-wrap img[src^="http"]').forEach(function (im) { urls.push(im.getAttribute('src')); });
            if (urls.length) warm(urls);
        }
        function warmSaved() {
            var urls = [];
            try {
                for (var i = 0; i < root.localStorage.length; i++) {
                    var k = root.localStorage.key(i); if (!/^nr_ab_[0-9a-f-]{20,}$/i.test(k)) continue;
                    var arr = JSON.parse(root.localStorage.getItem(k) || 'null'); if (!Array.isArray(arr)) continue;
                    arr.forEach(function (t) { (t.variants || []).forEach(function (v) { if (v.photo_url) urls.push(v.photo_url); }); });
                }
            } catch (e) { /* нет сохранённого списка */ }
            if (urls.length) warm(urls.slice(0, 160));
        }
        (root.requestIdleCallback || function (f) { return root.setTimeout(f, 1500); })(warmSaved);
        return { u: u, warm: warm, warmDom: warmDom, swap: swap };
    })();

    /* ───── РК теста: аккуратный ряд, убрать лишнюю можно в «Редактировать» ───── */
    function camps(t, all) {
        var st = (t && t.settings) || {}, ids = (st.campaigns || []).map(Number).filter(Boolean), names = st.campaignNames || {};
        if (!ids.length) return '';
        var show = all ? ids : ids.slice(0, 3);
        return '<div class="abtest-camps' + (all ? ' all' : '') + '">' + show.map(function (id) { return '<span title="' + esc((names[String(id)] || 'РК') + ' · ' + id) + '">РК ' + id + '</span>'; }).join('')
            + (!all && ids.length > show.length ? '<span class="more" title="' + esc(ids.slice(3).join(', ')) + '">+' + (ids.length - show.length) + '</span>' : '') + '</div>';
    }
    function editCamps(t) {
        var host = $('ab-edit-camps'), dlg = $('ab-edit-title');
        if (!dlg) return;
        if (!host) { host = doc.createElement('div'); host.id = 'ab-edit-camps'; dlg.parentNode.insertBefore(host, dlg.nextSibling); }
        var st = (t && t.settings) || {}, ids = (st.campaigns || []).map(Number).filter(Boolean), names = st.campaignNames || {};
        host.innerHTML = ids.length ? '<div class="cap" style="font-size:11px;color:var(--text-muted);margin:0 0 6px">РК теста</div><div class="abtest-camps all edit">'
            + ids.map(function (id) { return '<span title="' + esc((names[String(id)] || 'РК') + ' · ' + id) + '">РК ' + id + '<button type="button" data-rm="' + id + '" aria-label="Убрать РК ' + id + ' из теста" title="Убрать из теста">×</button></span>'; }).join('') + '</div>' : '';
        host.style.marginBottom = ids.length ? '12px' : '0';
        host.onclick = function (e) {
            var b = e.target && e.target.getAttribute && e.target.getAttribute('data-rm'); if (!b) return;
            var cur = findTest(t.id); if (!cur) return;
            var s2 = Object.assign({}, cur.settings || {});
            s2.campaigns = (s2.campaigns || []).filter(function (x) { return String(x) !== b; });
            var nm = Object.assign({}, s2.campaignNames || {}); delete nm[b]; s2.campaignNames = nm;
            if (!s2.campaigns.length && s2.rotateByImpressions === true) { toast('error', 'Нельзя убрать последнюю РК', 'Тест меняет фото по показам, ему нужна кампания.'); return; }
            cur.settings = s2; root.saveABSettings(cur.id, s2); try { root.renderABTests(); } catch (x) { /* список обновится сам */ }
            editCamps(cur); toast('success', 'РК убрана из теста', 'Статистика этой РК больше не считается в тесте.');
        };
    }
    function wrapEdit() {
        var orig = root.editABTest;
        if (typeof orig !== 'function' || orig.__nrCamps) return;
        root.editABTest = function (id) { var r = orig.apply(this, arguments); try { editCamps(findTest(id)); } catch (e) { /* без блока РК */ } return r; };
        root.editABTest.__nrCamps = true;
    }
    wrapEdit();

    root.NrAbImg = Img;
    root.NrAbRot = { extra: extra, setup: setup, btn: btn, restart: restart, ring: ring, camps: camps };
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
})(typeof window !== 'undefined' ? window : globalThis);

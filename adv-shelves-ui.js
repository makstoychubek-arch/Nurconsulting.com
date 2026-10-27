/**
 * Продвижение → кампании «Полки»: сайт сам исключает поисковые фразы, чтобы показы шли только на рекомендательных полках.
 * Ползунок «A» у CPM-кампании спрашивает один раз: «Только полки» или «Обычный автопилот». Работу делает edge function adv-shelves-tick.
 * Здесь: вопрос при включении, метка в строке кампании и окно с журналом чистки (с кнопкой «Вернуть»).
 */
(function (root) {
    'use strict';
    var doc = root.document;
    var rows = {};              // 'cab:advert' -> строка adv_shelves
    var loaded = {};            // cabinetId -> true
    var logCache = {};          // 'cab:advert' -> { at, items }

    function sb() { return root.supabase; }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function key(cab, adv) { return cab + ':' + adv; }
    function isShelvesName(n) { return /полк/i.test(String(n || '')); }
    function ago(iso) {
        if (!iso) return 'ещё не проверяли';
        var m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
        return m < 1 ? 'только что' : (m < 60 ? m + ' мин назад' : Math.round(m / 60) + ' ч назад');
    }
    function isDry(r) { return !!(r && r.dry_run_until && Date.parse(r.dry_run_until) > Date.now()); }
    function toast(type, title, text) {
        try { if (root.NrUi && root.NrUi.toast) return root.NrUi.toast(type, title, text || ''); } catch (e) { /* без тоста */ }
    }
    function memKey(cab, adv) { return 'adv_shelves_choice_' + cab + '_' + adv; }
    function remembered(cab, adv) { try { return root.localStorage.getItem(memKey(cab, adv)); } catch (e) { return null; } }
    function remember(cab, adv, v) { try { root.localStorage.setItem(memKey(cab, adv), v); } catch (e) { /* без памяти */ } }

    // ===== Данные =====
    function load(cabId) {
        if (!cabId || loaded[cabId] || !sb()) return Promise.resolve();
        loaded[cabId] = true;
        return Promise.resolve(sb().from('adv_shelves').select('*').eq('cabinet_id', cabId).range(0, 499)).then(function (r) {
            if (r.error) { loaded[cabId] = false; return; }
            (r.data || []).forEach(function (x) { rows[key(x.cabinet_id, x.advert_id)] = x; });
            paintSlots();
            if (root.AdsHQ && root.AdsHQ.renderTable) root.AdsHQ.renderTable();
        }).catch(function () { loaded[cabId] = false; });
    }
    function has(cab, adv) { var r = rows[key(cab, adv)]; return !!(r && r.enabled); }
    function needsAsk(cab, camp) {
        if (!camp || String(camp.paymentType || '').toLowerCase() !== 'cpm') return false;
        if (rows[key(cab, camp.wbId)]) return false;
        return !remembered(cab, camp.wbId);
    }
    function save(cab, adv, patch) {
        var cur = rows[key(cab, adv)] || { cabinet_id: cab, advert_id: Number(adv), enabled: true, interval_min: 10, keep_phrases: [] };
        var next = Object.assign({}, cur, patch, { updated_at: new Date().toISOString() });
        rows[key(cab, adv)] = next;                         // экран меняем сразу, база догоняет
        paintSlots();
        var payload = { cabinet_id: cab, advert_id: Number(adv), enabled: next.enabled, interval_min: next.interval_min, dry_run_until: next.dry_run_until || null, keep_phrases: next.keep_phrases || [], updated_at: next.updated_at };
        return Promise.resolve(sb().from('adv_shelves').upsert(payload, { onConflict: 'cabinet_id,advert_id' })).then(function (r) {
            if (r.error) throw r.error;
        }).catch(function (e) {
            rows[key(cab, adv)] = cur; paintSlots();
            toast('error', 'Не сохранилось', 'Повторите. ' + ((e && e.message) || ''));
        });
    }
    function setEnabled(cab, adv, on) { if (rows[key(cab, adv)]) return save(cab, adv, { enabled: !!on }); return Promise.resolve(); }

    // ===== Вопрос при включении «A» =====
    function ask(cab, camp) {
        return new Promise(function (resolve) {
            var pre = 'shelves';
            var choice = pre, interval = 10, dry = true;
            var box = doc.createElement('div'); box.className = 'shv-ov';
            function paint() {
                box.innerHTML = '<div class="shv-dlg" role="dialog" aria-label="Что делает эта кампания"><div class="shv-grab"></div><h3>Что делает эта кампания?</h3>' +
                    '<p>«' + esc(camp.name) + '» с единой ставкой. Скажите, как её вести на автопилоте.</p>' +
                    '<div class="shv-opt' + (choice === 'shelves' ? ' sel' : '') + '" data-c="shelves"><i></i><div><b>Только рекомендательные полки</b><span>Сайт сам исключает поисковые фразы, чтобы показы шли только на полках. Так показы дешевле.</span></div></div>' +
                    '<div class="shv-opt' + (choice === 'bids' ? ' sel' : '') + '" data-c="bids"><i></i><div><b>Обычный автопилот ставок</b><span>Ставки по ДРР, как у остальных кампаний. Ключи не трогаем.</span></div></div>' +
                    (choice === 'shelves' ? '<div class="shv-lbl">Как часто проверять новые фразы</div><div class="shv-iv">' + [5, 10, 30].map(function (m) { return '<button type="button" data-iv="' + m + '" class="' + (interval === m ? 'sel' : '') + '">' + m + ' мин</button>'; }).join('') + '</div>' +
                    '<label class="shv-chk"><input type="checkbox" id="shv-dry"' + (dry ? ' checked' : '') + '> Первые 24 часа только показывать, что исключил бы</label>' : '') +
                    '<div class="shv-act"><button type="button" class="shv-b g" data-x="1">Отмена</button><button type="button" class="shv-b" data-go="1">Включить</button></div></div>';
            }
            function close(v) { box.remove(); resolve(v); }
            paint();
            box.addEventListener('click', function (e) {
                var t = e.target;
                if (t === box || t.closest('[data-x]')) return close(null);
                var o = t.closest('[data-c]'); if (o) { choice = o.getAttribute('data-c'); paint(); return; }
                var iv = t.closest('[data-iv]'); if (iv) { interval = Number(iv.getAttribute('data-iv')); paint(); return; }
                if (t.closest('[data-go]')) {
                    var d = box.querySelector('#shv-dry'); if (d) dry = d.checked;
                    if (choice === 'bids') { remember(cab, camp.wbId, 'bids'); return close('bids'); }
                    remember(cab, camp.wbId, 'shelves');
                    save(cab, camp.wbId, { enabled: true, interval_min: interval, dry_run_until: dry ? new Date(Date.now() + 24 * 3600 * 1000).toISOString() : null });
                    toast('success', 'Полки включены', 'Чистка каждые ' + interval + ' мин' + (dry ? ', первые сутки пробные' : ''));
                    close('shelves');
                }
            });
            doc.body.appendChild(box);
        });
    }

    // ===== Метка в строке кампании =====
    function slotHtml(cab, adv) {
        return '<span class="shv-slot" data-shv-cab="' + esc(cab) + '" data-shv-adv="' + esc(adv) + '"></span>';
    }
    function paintSlots() {
        var els = doc.querySelectorAll('.shv-slot');
        for (var i = 0; i < els.length; i++) {
            var el = els[i], r = rows[key(el.getAttribute('data-shv-cab'), el.getAttribute('data-shv-adv'))];
            var html = '';
            if (r && r.enabled) {
                var dry = isDry(r);
                html = '<button type="button" class="shv-pill' + (r.last_status === 'error' ? ' err' : '') + '" data-shv-open="1"><i></i>Полки · чистка каждые ' + r.interval_min + ' мин' + (dry ? ' · пробный' : '') + '</button>' +
                    '<span class="shv-sub">' + (dry ? 'Пробный режим, WB не трогаем' : 'Исключено ' + (r.excluded_total || 0) + ' фраз') + ' · ' + (r.last_run_at ? 'проверка ' + ago(r.last_run_at) : 'ещё не проверяли') + '</span>';
            }
            if (el.getAttribute('data-h') !== html) { el.innerHTML = html; el.setAttribute('data-h', html); }
        }
    }

    // ===== Окно кампании: журнал и настройки =====
    function loadLog(cab, adv) {
        var k = key(cab, adv), c = logCache[k];
        if (c && Date.now() - c.at < 20000) return Promise.resolve(c.items);
        return Promise.resolve(sb().from('adv_shelves_log').select('id,nm_id,phrase,action,impressions,created_at').eq('cabinet_id', cab).eq('advert_id', Number(adv)).order('created_at', { ascending: false }).range(0, 59)).then(function (r) {
            var items = r.error ? [] : (r.data || []);
            logCache[k] = { at: Date.now(), items: items };
            return items;
        }).catch(function () { return []; });
    }
    function openDetail(cab, adv) {
        var r = rows[key(cab, adv)]; if (!r) return;
        var old = doc.getElementById('shv-detail'); if (old) old.remove();
        var box = doc.createElement('div'); box.id = 'shv-detail'; box.className = 'shv-ov';
        function paint(items) {
            var ex = items.filter(function (x) { return x.action === 'exclude' || x.action === 'would_exclude'; });
            var hour = ex.filter(function (x) { return Date.now() - Date.parse(x.created_at) < 3600 * 1000; }).length;
            var dry = isDry(r);
            box.innerHTML = '<div class="shv-dlg wide" role="dialog"><div class="shv-grab"></div>' +
                '<div class="shv-top"><div><h3>Кампания ' + esc(adv) + '</h3><span class="shv-pill' + (r.last_status === 'error' ? ' err' : '') + '"><i></i>' + (r.enabled ? 'Чистка идёт, каждые ' + r.interval_min + ' мин' : 'Чистка на паузе') + '</span></div><button type="button" class="shv-b g" data-x="1">Закрыть</button></div>' +
                '<div class="shv-kp"><div><small>' + (dry ? 'Нашли бы исключить' : 'Исключено фраз') + '</small><b>' + (dry ? ex.length : (r.excluded_total || 0)) + '</b><em>' + hour + ' за час</em></div>' +
                '<div><small>Последняя проверка</small><b class="s">' + ago(r.last_run_at) + '</b></div></div>' +
                (r.last_status === 'error' ? '<p class="shv-err">Последняя проверка не удалась: ' + esc(r.last_error || 'ошибка') + '. Повторим автоматически.</p>' : '') +
                (dry ? '<div class="shv-dry"><span>Пробный режим до ' + new Date(r.dry_run_until).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + '. Фразы пока в WB не добавляются.</span><button type="button" class="shv-b" data-live="1">Подтвердить и включить</button></div>' : '') +
                '<div class="shv-act left"><select id="shv-iv">' + [5, 10, 30].map(function (m) { return '<option value="' + m + '"' + (m === r.interval_min ? ' selected' : '') + '>каждые ' + m + ' мин</option>'; }).join('') + '</select>' +
                '<button type="button" class="shv-b g" data-now="1">Проверить сейчас</button><button type="button" class="shv-b g" data-toggle="1">' + (r.enabled ? 'Пауза чистки' : 'Возобновить') + '</button></div>' +
                '<h4>Журнал чистки</h4><div class="shv-log">' + (ex.length ? ex.slice(0, 40).map(function (x) {
                    return '<div class="shv-li"><div><span>' + esc(x.phrase) + '</span><small>' + new Date(x.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) + (x.action === 'would_exclude' ? ' · пробно' : '') + '</small></div>' +
                        (x.action === 'exclude' ? '<button type="button" class="shv-undo" data-undo="' + x.id + '" data-nm="' + x.nm_id + '" data-ph="' + esc(x.phrase) + '">Вернуть</button>' : '<span class="shv-tag">пробно</span>') + '</div>';
                }).join('') : '<div class="shv-li mut">Пока ничего не исключали. Новые фразы появятся здесь.</div>') + '</div>' +
                '<p class="shv-hint">Исключаются только поисковые фразы. Ставка и бюджет остаются как заданы. Возвращённые фразы сайт больше не трогает.</p></div>';
        }
        paint((logCache[key(cab, adv)] || {}).items || []);
        box.addEventListener('click', function (e) {
            var t = e.target;
            if (t === box || t.closest('[data-x]')) { box.remove(); return; }
            if (t.closest('[data-toggle]')) { save(cab, adv, { enabled: !r.enabled }).then(function () { r = rows[key(cab, adv)]; paint((logCache[key(cab, adv)] || {}).items || []); }); r = rows[key(cab, adv)]; paint((logCache[key(cab, adv)] || {}).items || []); return; }
            if (t.closest('[data-live]')) { save(cab, adv, { dry_run_until: null }); r = rows[key(cab, adv)]; paint((logCache[key(cab, adv)] || {}).items || []); toast('success', 'Чистка включена', 'С следующей проверки фразы исключаются по-настоящему'); return; }
            if (t.closest('[data-now]')) { runNow(cab, adv); return; }
            var u = t.closest('[data-undo]');
            if (u) { undo(cab, adv, u); return; }
        });
        box.addEventListener('change', function (e) {
            if (e.target.id === 'shv-iv') { save(cab, adv, { interval_min: Number(e.target.value) }); r = rows[key(cab, adv)]; }
        });
        doc.body.appendChild(box);
        loadLog(cab, adv).then(function (items) { if (doc.getElementById('shv-detail') === box) paint(items); });
    }
    function runNow(cab, adv) {
        // Сбрасываем время последней проверки, ближайший тик (до 5 минут) подхватит кампанию.
        save(cab, adv, { last_run_at: null });
        Promise.resolve(sb().from('adv_shelves').update({ last_run_at: null }).eq('cabinet_id', cab).eq('advert_id', Number(adv)));
        toast('success', 'Проверка запланирована', 'Запустится в течение 5 минут');
    }
    function undo(cab, adv, btn) {
        var phrase = btn.getAttribute('data-ph'), nm = Number(btn.getAttribute('data-nm')), id = btn.getAttribute('data-undo');
        btn.disabled = true; btn.textContent = 'Возвращаем…';
        var call = root.callWbProxy;
        if (typeof call !== 'function') { toast('error', 'Не получилось', 'Нет связи с WB'); return; }
        Promise.resolve(call('adv_cluster_minus', { advertId: Number(adv), nmId: nm, remove: [phrase] }, cab)).then(function (res) {
            if (!res || res.error) throw new Error((res && res.error) || 'WB не принял');
            var r = rows[key(cab, adv)] || {}, keep = (r.keep_phrases || []).concat([phrase]);
            save(cab, adv, { keep_phrases: keep });
            sb().from('adv_shelves_log').insert({ cabinet_id: cab, advert_id: Number(adv), nm_id: nm, phrase: phrase, action: 'restore' });
            btn.textContent = 'Возвращена'; btn.classList.add('done');
            logCache[key(cab, adv)] = null;
        }).catch(function (e) { btn.disabled = false; btn.textContent = 'Вернуть'; toast('error', 'Фраза не вернулась', 'Попробуйте ещё раз. ' + ((e && e.message) || '')); });
    }

    // ===== Подключение =====
    doc.addEventListener('click', function (e) {
        var o = e.target.closest && e.target.closest('[data-shv-open]');
        if (!o) return;
        var slot = o.closest('.shv-slot');
        if (slot) { e.preventDefault(); e.stopPropagation(); openDetail(slot.getAttribute('data-shv-cab'), slot.getAttribute('data-shv-adv')); }
    }, true);
    function hook() {
        if (!root.AdsHQ || !root.AdsHQ.onRendered) return false;
        root.AdsHQ.onRendered(function () {
            var cab = root.AdsHQ.getFilterCabinetId && root.AdsHQ.getFilterCabinetId();
            var ids = {};
            var els = doc.querySelectorAll('.shv-slot'); for (var i = 0; i < els.length; i++) ids[els[i].getAttribute('data-shv-cab')] = 1;
            if (cab) ids[cab] = 1;
            Object.keys(ids).forEach(load);
            paintSlots();
        });
        return true;
    }
    var tries = 0, t = setInterval(function () { if (hook() || ++tries > 120) clearInterval(t); }, 500);

    // «Пульт» рисует строки сам, без событий AdsHQ: следим за списком и подгружаем метки по мере появления.
    var watchT = 0;
    function watch() {
        var host = doc.getElementById('adv-view-ads') || doc.body;
        new MutationObserver(function () {
            if (watchT) return;
            watchT = setTimeout(function () {
                watchT = 0;
                var ids = {}, els = doc.querySelectorAll('.shv-slot');
                for (var i = 0; i < els.length; i++) ids[els[i].getAttribute('data-shv-cab')] = 1;
                Object.keys(ids).forEach(load);
                paintSlots();
            }, 80);
        }).observe(host, { childList: true, subtree: true });
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', watch); else watch();

    var CSS = '.shv-slot{display:block;margin-top:4px}.shv-slot:empty{display:none}' +
        '.shv-pill{display:inline-flex;align-items:center;gap:6px;border:0;font:inherit;font-weight:800;font-size:11.5px;padding:3px 10px;border-radius:99px;background:var(--sel,#f1effc);color:var(--accent,#5b4be8);cursor:pointer}.shv-pill i{width:7px;height:7px;border-radius:50%;background:#16a34a;box-shadow:0 0 0 3px rgba(22,163,74,.25)}.shv-pill.err i{background:#dc2626;box-shadow:0 0 0 3px rgba(220,38,38,.25)}' +
        '.shv-sub{display:block;font-size:11px;color:var(--text-muted,#6b7280);margin-top:2px}' +
        '.shv-ov{position:fixed;inset:0;z-index:9500;background:rgba(20,19,28,.45);backdrop-filter:blur(4px);display:grid;place-items:center;padding:16px}' +
        '.shv-dlg{box-sizing:border-box;background:var(--bg-card,#fff);color:var(--text-primary,#182433);border-radius:20px;padding:20px;width:min(460px,100%);max-height:92vh;overflow:auto;display:grid;gap:12px;box-shadow:0 30px 80px rgba(0,0,0,.35)}.shv-dlg.wide{width:min(640px,100%)}.shv-dlg h3{margin:0;font-size:16px}.shv-dlg h4{margin:4px 0 0;font-size:13px}.shv-dlg p{margin:0;font-size:13px;color:var(--text-muted,#6b7280);line-height:1.45}.shv-grab{display:none}' +
        '.shv-opt{border:1.5px solid var(--border,#e5e3f0);border-radius:12px;padding:10px 12px;display:grid;grid-template-columns:18px 1fr;gap:10px;cursor:pointer;font-size:13px}.shv-opt i{width:16px;height:16px;border-radius:50%;border:2px solid var(--border,#e5e3f0);margin-top:2px}.shv-opt b{display:block}.shv-opt span{color:var(--text-muted,#6b7280);font-size:12px}.shv-opt.sel{border-color:var(--accent,#5b4be8);background:var(--sel,#f1effc)}.shv-opt.sel i{border-color:var(--accent,#5b4be8);background:radial-gradient(var(--accent,#5b4be8) 40%,transparent 42%)}' +
        '.shv-lbl{font-size:12px;color:var(--text-muted,#6b7280)}.shv-iv{display:flex;gap:6px;flex-wrap:wrap}.shv-iv button{border:1.5px solid var(--border,#e5e3f0);background:none;color:inherit;border-radius:99px;padding:8px 14px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer}.shv-iv button.sel{border-color:var(--accent,#5b4be8);background:var(--sel,#f1effc);color:var(--accent,#5b4be8)}' +
        '.shv-chk{display:flex;gap:8px;align-items:center;font-size:12px;color:var(--text-muted,#6b7280)}.shv-act{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}.shv-act.left{justify-content:flex-start;align-items:center}.shv-act select{border:1px solid var(--border,#e5e3f0);border-radius:10px;padding:8px;background:var(--bg-card,#fff);color:inherit;font:inherit;font-size:12.5px}' +
        '.shv-b{border:0;background:var(--accent,#5b4be8);color:#fff;border-radius:10px;padding:10px 16px;font:inherit;font-weight:700;font-size:13px;cursor:pointer}.shv-b.g{background:var(--sel,#f1effc);color:var(--accent,#5b4be8)}' +
        '.shv-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.shv-kp{display:grid;grid-template-columns:1fr 1fr;gap:10px}.shv-kp>div{background:var(--sel,#f1effc);border-radius:12px;padding:10px 12px;display:grid;gap:2px}.shv-kp small{font-size:11px;color:var(--text-muted,#6b7280)}.shv-kp b{font-size:20px;font-variant-numeric:tabular-nums}.shv-kp b.s{font-size:15px}.shv-kp em{font-style:normal;font-size:11px;color:#16a34a}' +
        '.shv-dry{display:flex;gap:10px;justify-content:space-between;align-items:center;background:rgba(217,119,6,.12);border-radius:12px;padding:10px 12px;font-size:12.5px;flex-wrap:wrap}.shv-err{color:#dc2626!important}' +
        '.shv-log{border:1px solid var(--border,#e5e3f0);border-radius:12px;overflow:hidden}.shv-li{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:9px 12px;border-bottom:1px solid var(--border,#e5e3f0);font-size:13px}.shv-li:last-child{border:0}.shv-li small{display:block;color:var(--text-muted,#6b7280);font-size:11px}.shv-li.mut{color:var(--text-muted,#6b7280)}' +
        '.shv-undo{border:0;background:var(--sel,#f1effc);color:var(--accent,#5b4be8);border-radius:99px;padding:8px 14px;font:inherit;font-size:12px;font-weight:800;cursor:pointer}.shv-undo.done{opacity:.6}.shv-tag{font-size:11px;font-weight:700;color:#d97706;background:rgba(217,119,6,.14);padding:2px 8px;border-radius:99px}.shv-hint{font-size:12px!important}' +
        '@media(max-width:700px){.shv-ov{place-items:end center;padding:0}.shv-dlg,.shv-dlg.wide{width:100%;border-radius:22px 22px 0 0;padding:10px 16px calc(18px + env(safe-area-inset-bottom,0px))}.shv-grab{display:block;width:38px;height:4px;border-radius:9px;background:var(--border,#e5e3f0);margin:0 auto 4px}.shv-b{padding:13px 16px;font-size:14px}.shv-act .shv-b{flex:1}.shv-undo{padding:10px 16px}.shv-iv button{padding:10px 16px}}';
    var st = doc.createElement('style'); st.id = 'shv-css'; st.textContent = CSS; doc.head.appendChild(st);

    root.AdvShelves = { has: has, needsAsk: needsAsk, ask: ask, slotHtml: slotHtml, setEnabled: setEnabled, load: load, paintSlots: paintSlots, isShelvesName: isShelvesName };
})(typeof window !== 'undefined' ? window : globalThis);

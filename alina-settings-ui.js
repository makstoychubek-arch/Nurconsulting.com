/**
 * «Продвижение → Алина»: настройки Алины на сайте. Только для команды (таблица alina_settings под RLS is_staff).
 * Страница сразу показывает каркас и значения из кэша устройства, свежие подставляются без перерисовки;
 * сохранение идёт в фоне (оптимистично), при ошибке тост с «Повторить».
 * Значения по умолчанию и границы совпадают с supabase/functions/_shared/alina-settings.ts.
 */
(function (root) {
    var CACHE_KEY = 'nr_alina_settings_v1';
    var DEFAULTS = {
        read: true, typing: true, pauseMaxSec: 3, useName: true,
        phrases: ['Минутку, уточню.', 'Секунду, сейчас уточню.', 'Сейчас спрошу и вернусь к вам.'],
        remindMin: 10, reactions: true, copyButton: true, admitLimit: 30, admitHours: 3, llmBudgetUsd: 0,
    };
    var KEYS = Object.keys(DEFAULTS);
    var LABELS = {
        read: 'Прочитано', typing: '«Печатает…»', pauseMaxSec: 'Пауза «печатает»', useName: 'Имя клиента', phrases: 'Фразы «уточняю»',
        remindMin: 'Напоминание менеджерам', reactions: 'Итог реакцией', copyButton: 'Кнопка копирования логина',
        admitLimit: 'Лимит новых клиентов', admitHours: 'Период лимита', llmBudgetUsd: 'Бюджет ChatGPT',
    };

    function clone(o) { return JSON.parse(JSON.stringify(o)); }
    function bool(v, d) { return typeof v === 'boolean' ? v : d; }
    function num(v, d, min, max) { var n = typeof v === 'number' ? v : Number(v); return isFinite(n) ? Math.min(max, Math.max(min, n)) : d; }

    /** Допустимые значения: неверное заменяется значением по умолчанию, числа обрезаются по границам. */
    function normalize(raw) {
        var r = raw || {};
        var phrases = Array.isArray(r.phrases) ? r.phrases.map(function (p) { return String(p == null ? '' : p).trim().slice(0, 120); }).filter(Boolean).slice(0, 12) : [];
        return {
            read: bool(r.read, DEFAULTS.read), typing: bool(r.typing, DEFAULTS.typing),
            pauseMaxSec: num(r.pauseMaxSec, DEFAULTS.pauseMaxSec, 1, 6), useName: bool(r.useName, DEFAULTS.useName),
            phrases: phrases.length ? phrases : DEFAULTS.phrases.slice(),
            remindMin: Math.round(num(r.remindMin, DEFAULTS.remindMin, 1, 120)),
            reactions: bool(r.reactions, DEFAULTS.reactions), copyButton: bool(r.copyButton, DEFAULTS.copyButton),
            admitLimit: Math.round(num(r.admitLimit, DEFAULTS.admitLimit, 0, 100000)), admitHours: Math.round(num(r.admitHours, DEFAULTS.admitHours, 1, 72)),
            llmBudgetUsd: Math.round(num(r.llmBudgetUsd, DEFAULTS.llmBudgetUsd, 0, 100000) * 100) / 100,
        };
    }

    function changedKeys(saved, cur) {
        return KEYS.filter(function (k) { return JSON.stringify(saved[k]) !== JSON.stringify(cur[k]); });
    }

    /** Что увидит клиент: фраза «уточняю» с именем или без. */
    function previewPhrase(s, name) {
        var t = (s.phrases[0] || DEFAULTS.phrases[0]);
        return s.useName && name ? name + ', ' + t.charAt(0).toLowerCase() + t.slice(1) : t;
    }

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
    }

    var state = { sb: null, host: null, saved: clone(DEFAULTS), cur: clone(DEFAULTS), active: false, built: false, loadedFresh: false, canPower: false, power: { known: false, on: false, busy: false, confirm: false, error: '' } };

    function readCache() { try { var r = JSON.parse(root.localStorage.getItem(CACHE_KEY) || 'null'); return r ? normalize(r) : null; } catch (e) { return null; } }
    function writeCache(s) { try { root.localStorage.setItem(CACHE_KEY, JSON.stringify(s)); } catch (e) { /* без кэша работает */ } }

    function switchHtml(k, title, sub) {
        return '<div class="as-row"><div class="as-t"><b>' + esc(title) + '</b><span>' + esc(sub) + '</span></div>' +
            '<label class="as-sw"><input type="checkbox" data-k="' + k + '"><u></u></label></div>';
    }
    function numHtml(k, title, sub, unit, step, min) {
        return '<div class="as-row"><div class="as-t"><b>' + esc(title) + '</b><span>' + esc(sub) + '</span></div>' +
            '<div class="as-num"><button type="button" data-step="-' + step + '" data-for="' + k + '" aria-label="Меньше">−</button>' +
            '<input type="number" data-k="' + k + '" min="' + min + '" step="' + step + '" aria-label="' + esc(title) + '"><button type="button" data-step="' + step + '" data-for="' + k + '" aria-label="Больше">+</button></div>' +
            '<span class="as-unit">' + esc(unit) + '</span></div>';
    }

    function build() {
        var h = '<div class="as-wrap">' +
            '<div class="as-head"><p>Как Алина отвечает клиентам и менеджерам. Изменения применяются в течение полуминуты.</p></div>' +
            '<div class="as-cols"><div class="as-stack">' +
            '<section class="as-card" data-v="powercard" hidden><h3>Кому отвечает</h3>' +
            '<div class="as-row"><div class="as-t"><b>Алина отвечает клиентам</b><span data-v="powersub">Проверяю состояние…</span></div>' +
            '<label class="as-sw"><input type="checkbox" data-power="1"><u></u></label></div>' +
            '<div class="as-confirm" data-v="confirm" hidden><b>Включить Алину для всех клиентов?</b><span>Она начнёт отвечать каждому, кто напишет в Business-чат. Чтобы подтвердить, введите слово «включить».</span>' +
            '<div class="as-actions"><input type="text" data-v="word" placeholder="включить" autocomplete="off" aria-label="Подтверждение"><button type="button" class="as-btn as-ink" data-act="powerok">Подтвердить</button><button type="button" class="as-btn" data-act="powerno">Отмена</button></div><p class="as-err" data-v="powererr"></p></div></section>' +
            '<section class="as-card"><h3>Клиенты и расход</h3>' +
            numHtml('admitLimit', 'Лимит новых клиентов', '0 значит без лимита. Остальные ждут очереди и допускаются по мере освобождения', 'клиентов', 5, 0) +
            numHtml('admitHours', 'Период лимита', 'За какое время считается лимит', 'ч', 1, 1) +
            numHtml('llmBudgetUsd', 'Бюджет ChatGPT в месяц', '0 значит без ограничения. При превышении Алина отвечает по шаблонам и пишет вам в Telegram', '$', 5, 0) + '</section>' +
            '<section class="as-card"><h3>Как отвечает</h3>' +
            switchHtml('read', 'Отмечать прочитанным', 'Сообщение клиента помечается прочитанным до ответа') +
            switchHtml('typing', '«Печатает…» перед ответом', 'Индикатор виден в чате клиента') +
            '<div class="as-row"><div class="as-t"><b>Пауза «печатает»</b><span>Зависит от длины текста, но не больше выбранного</span></div>' +
            '<input type="range" data-k="pauseMaxSec" min="1" max="6" step="0.5" aria-label="Максимум паузы"><span class="as-unit" data-v="pause"></span></div>' +
            switchHtml('useName', 'Обращаться по имени', '«Мара, минутку, уточню.»') +
            '<div class="as-t as-pt"><b>Фразы «уточняю»</b><span>Алина выбирает одну из них. Меняйте и добавляйте.</span></div>' +
            '<div class="as-chips" data-v="phrases"></div><button type="button" class="as-btn" data-act="addPhrase">+ Добавить фразу</button></section>' +
            '<section class="as-card"><h3>Менеджеры</h3>' +
            numHtml('remindMin', 'Напомнить, если нет ответа', 'Один раз менеджерам и клиенту «ещё уточняю»', 'мин', 5, 1) +
            switchHtml('reactions', 'Итог реакцией', '❤ ответ доставлен, 👎 не доставлен, без лишних сообщений') +
            switchHtml('copyButton', 'Кнопка «Скопировать @логин»', 'Под обращением в группе менеджеров') + '</section>' +
            '<section class="as-card asb" data-v="sandbox" hidden></section>' +
            '<p class="as-hist" data-v="hist"></p></div>' +
            '<aside class="as-prev"><h3>Как это увидит клиент</h3><div class="as-phone" data-v="phone"></div>' +
            '<h3 style="margin-top:14px">Что увидят менеджеры</h3><div class="as-grp" data-v="grp"></div></aside></div>' +
            '<div class="as-save" data-v="bar" hidden><div><span data-v="cnt"></span><button type="button" class="as-btn" data-act="undo">Отменить</button><button type="button" class="as-btn as-ink" data-act="save">Сохранить</button></div></div>' +
            '<div class="as-toast" data-v="toast" hidden></div></div>';
        state.host.innerHTML = h;
        state.built = true;
        bind();
    }

    function q(sel) { return state.host.querySelector(sel); }

    function paintValues() {
        var s = state.cur, host = state.host;
        Array.prototype.forEach.call(host.querySelectorAll('[data-k]'), function (el) {
            var k = el.getAttribute('data-k');
            if (el.type === 'checkbox') el.checked = !!s[k]; else if (String(el.value) !== String(s[k])) el.value = s[k];
        });
        q('[data-v="pause"]').textContent = 'до ' + String(s.pauseMaxSec).replace('.', ',') + ' с';
        var box = q('[data-v="phrases"]');
        if (!box.contains(state.host.ownerDocument.activeElement) || box.children.length !== s.phrases.length) {
            box.innerHTML = s.phrases.map(function (p, i) {
                return '<span class="as-chip"><input type="text" data-p="' + i + '" value="' + esc(p) + '" aria-label="Фраза ' + (i + 1) + '" maxlength="120" style="width:' + Math.min(48, Math.max(12, p.length + 3)) + 'ch"><button type="button" data-del="' + i + '" aria-label="Удалить фразу">×</button></span>';
            }).join('');
        }
        paintPower(); paintPreview();
        var n = changedKeys(state.saved, s).length;
        q('[data-v="bar"]').hidden = n === 0;
        q('[data-v="cnt"]').textContent = 'Изменено: ' + n;
    }

    function paintPower() {
        var card = q('[data-v="powercard"]'); if (!card) return;
        var sbx = q('[data-v="sandbox"]');
        if (sbx) { sbx.hidden = !state.canPower; if (state.canPower && !sbx.getAttribute('data-mounted') && root.NrAlinaSandbox) { sbx.setAttribute('data-mounted', '1'); root.NrAlinaSandbox.mount({ host: sbx, supabase: state.sb }); } }
        card.hidden = !state.canPower; if (!state.canPower) return;
        var p = state.power, sw = card.querySelector('[data-power]');
        sw.checked = p.on; sw.disabled = p.busy || !p.known;
        q('[data-v="powersub"]').textContent = !p.known ? 'Проверяю состояние…' : p.on ? 'Включено: отвечает всем, кто написал в Business-чат' : 'Выключено: отвечает только @nurcon на тестовый вопрос';
        var box = q('[data-v="confirm"]'); box.hidden = !p.confirm; q('[data-v="powererr"]').textContent = p.error || '';
    }

    function loadPower() {
        if (!state.canPower) return Promise.resolve();
        return Promise.resolve(state.sb.functions.invoke('telegram-admin', { body: { action: 'list' } })).then(function (r) {
            var bots = (r && r.data && r.data.bots) || [], a = bots.filter(function (b) { return b.id === 'alina'; })[0];
            state.power.known = !!a; state.power.on = !!(a && a.is_enabled); if (state.active) paintPower();
        }, function () { /* состояние не определилось: переключатель остаётся недоступным */ });
    }
    function setPower(on) {
        state.power.busy = true; state.power.error = ''; paintPower();
        return Promise.resolve(state.sb.functions.invoke('telegram-admin', { body: { action: on ? 'enable' : 'disable', bot_id: 'alina' } })).then(function (r) {
            if (r && (r.error || (r.data && r.data.error))) throw new Error('fail');
            state.power.on = on; state.power.confirm = false; state.power.busy = false; paintPower(); toast(on ? 'Алина включена для клиентов' : 'Алина выключена для клиентов');
        }, function () { state.power.busy = false; state.power.error = 'Не получилось. Повторите.'; paintPower(); });
    }

    function paintPreview() {
        var s = state.cur;
        var p = '<div class="as-m as-me">Можно поговорить с менеджером?</div>';
        if (s.read) p += '<div class="as-tag">прочитано</div>';
        if (s.typing) p += '<div class="as-typing" aria-label="Алина печатает"><i></i><i></i><i></i></div>';
        p += '<div class="as-m as-bot">' + esc(previewPhrase(s, 'Мара')) + '</div>';
        p += '<div class="as-m as-bot">Да, я на связи. Чем помочь?</div><div class="as-tag">ответ менеджера из группы</div>';
        q('[data-v="phone"]').innerHTML = p;
        var g = '<b>@логин клиента</b><br>Можно поговорить с менеджером?<br><span class="as-mute">Ответьте на это сообщение. Текст ответа будет отправлен клиенту.</span>';
        if (s.copyButton) g += '<span class="as-fakebtn">Скопировать @логин</span>';
        if (s.reactions) g += '<div class="as-react">❤ <span class="as-mute">на ответ менеджера</span></div>';
        g += '<div class="as-mute" style="margin-top:6px">Без ответа ' + s.remindMin + ' мин: «Клиент ждёт ответа».</div>';
        q('[data-v="grp"]').innerHTML = g;
    }

    function toast(text, retry) {
        var t = q('[data-v="toast"]');
        t.innerHTML = esc(text) + (retry ? ' <button type="button" data-act="save">Повторить</button>' : '');
        t.hidden = false; clearTimeout(toast.t);
        if (!retry) toast.t = setTimeout(function () { t.hidden = true; }, 2200);
    }

    function setValue(k, v) { state.cur[k] = v; state.cur = normalize(state.cur); paintValues(); }

    function bind() {
        state.host.addEventListener('input', function (e) {
            var el = e.target, k = el.getAttribute && el.getAttribute('data-k');
            if (k) { setValue(k, el.type === 'checkbox' ? el.checked : (el.type === 'number' || el.type === 'range' ? Number(el.value) : el.value)); return; }
            var pi = el.getAttribute && el.getAttribute('data-p');
            if (pi != null) { state.cur.phrases[Number(pi)] = el.value; paintPreview(); var n = changedKeys(state.saved, normalize(state.cur)).length; q('[data-v="bar"]').hidden = n === 0; q('[data-v="cnt"]').textContent = 'Изменено: ' + n; }
        });
        state.host.addEventListener('click', function (e) {
            var t = e.target, st = t.closest('[data-step]');
            if (st) { var k = st.getAttribute('data-for'); setValue(k, Number(state.cur[k]) + Number(st.getAttribute('data-step'))); return; }
            var del = t.closest('[data-del]');
            if (del) { if (state.cur.phrases.length > 1) { state.cur.phrases.splice(Number(del.getAttribute('data-del')), 1); paintValues(); } return; }
            var pw = t.closest('[data-power]');
            if (pw) { if (pw.checked) { pw.checked = false; state.power.confirm = true; state.power.error = ''; paintPower(); var wi = q('[data-v="word"]'); if (wi) wi.focus(); } else setPower(false); return; }
            var act = t.closest('[data-act]'); if (!act) return;
            var a = act.getAttribute('data-act');
            if (a === 'powerno') { state.power.confirm = false; state.power.error = ''; paintPower(); return; }
            if (a === 'powerok') {
                var w = q('[data-v="word"]'); if (String(w.value || '').trim().toLowerCase() !== 'включить') { state.power.error = 'Введите слово «включить» для подтверждения.'; paintPower(); return; }
                w.value = ''; setPower(true); return;
            }
            if (a === 'addPhrase') { state.cur.phrases.push('Сейчас уточню.'); q('[data-v="phrases"]').innerHTML = ''; paintValues(); }
            else if (a === 'undo') { state.cur = clone(state.saved); q('[data-v="phrases"]').innerHTML = ''; paintValues(); }
            else if (a === 'save') save();
        });
    }

    /** Сохранение: экран обновляется сразу, запись в базу идёт в фоне. */
    function save() {
        var next = normalize(state.cur), keys = changedKeys(state.saved, next);
        if (!keys.length) return;
        var prev = clone(state.saved);
        state.saved = clone(next); state.cur = clone(next); writeCache(next);
        paintValues(); toast('Сохранено (' + keys.length + '). Алина применит за полминуты');
        var rows = keys.map(function (k) { return { key: k, value: next[k], updated_at: new Date().toISOString() }; });
        var log = keys.map(function (k) { return { key: k, old_value: prev[k], new_value: next[k] }; });
        return Promise.resolve(state.sb.from('alina_settings').upsert(rows, { onConflict: 'key' })).then(function (res) {
            if (res && res.error) throw res.error;
            return state.sb.from('alina_settings_log').insert(log);
        }).then(function () { return null; }, function () {
            // не записалось: возвращаем изменения в «несохранённые» и предлагаем повторить
            state.saved = prev; state.cur = clone(next); writeCache(prev); paintValues();
            toast('Не сохранилось. Проверьте соединение', true);
        });
    }

    function paintHistory(rows) {
        var el = q('[data-v="hist"]'); if (!el) return;
        if (!rows || !rows.length) { el.textContent = ''; return; }
        el.innerHTML = 'Последние изменения: ' + rows.map(function (r) {
            var d = new Date(r.changed_at);
            return esc(LABELS[r.key] || r.key) + ' (' + d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) + ')';
        }).join('; ');
    }

    async function load() {
        var res = await state.sb.from('alina_settings').select('key,value');
        if (res.error) throw res.error;
        var raw = {}; (res.data || []).forEach(function (r) { raw[r.key] = r.value; });
        var fresh = normalize(raw);
        var dirty = changedKeys(state.saved, state.cur).length > 0;
        state.saved = fresh; if (!dirty) state.cur = clone(fresh);
        writeCache(fresh); state.loadedFresh = true;
        if (state.active) paintValues();
        try {
            var h = await state.sb.from('alina_settings_log').select('key,changed_at').order('changed_at', { ascending: false }).limit(3);
            if (!h.error && state.active) paintHistory(h.data);
        } catch (e) { /* история не обязательна */ }
    }

    function show(opts) {
        if (!opts || !opts.host || !opts.supabase) return;
        state.sb = opts.supabase; state.active = true; state.canPower = !!opts.canPower;
        if (state.host !== opts.host) { state.host = opts.host; state.built = false; }
        if (!state.built) {
            var c = readCache(); if (c) { state.saved = c; state.cur = clone(c); }
            build();
        }
        paintValues();
        loadPower();
        load().catch(function () { if (state.active && !state.loadedFresh) toast('Не удалось загрузить настройки, показаны сохранённые на этом устройстве'); });
    }

    function hide() { state.active = false; }

    var api = {
        DEFAULTS: DEFAULTS, normalize: normalize, changedKeys: changedKeys, previewPhrase: previewPhrase, show: show, hide: hide,
        _state: state, _save: save,
    };
    root.NrAlinaSettings = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

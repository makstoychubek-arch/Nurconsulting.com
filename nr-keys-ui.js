/**
 * Настройки → «Боты и ключи» (только супер-админ): Telegram-боты, ключ ChatGPT (OpenAI), Google-аккаунт для таблиц.
 * Значения ключей на сайт не возвращаются: показываются маска и статус. Telegram-ботов ведёт функция telegram-admin,
 * ключи OpenAI и Google ведёт integrations-admin. Страница сразу показывает последний известный статус (кэш устройства
 * без секретов), свежий подставляется без перерисовки; долгие проверки идут в фоне, кнопка отвечает сразу.
 */
(function (root) {
    var CACHE_KEY = 'nr_keys_status_v1';
    var state = { sb: null, host: null, tg: null, keys: null, busy: {}, form: '', active: false, built: false };

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
    }
    function readCache() { try { return JSON.parse(root.localStorage.getItem(CACHE_KEY) || 'null'); } catch (e) { return null; } }
    function writeCache() { try { root.localStorage.setItem(CACHE_KEY, JSON.stringify({ tg: state.tg, keys: state.keys })); } catch (e) { /* кэш не обязателен */ } }

    /** Чистая функция для теста: что показать в карточке ключа. */
    function keyView(item) {
        if (!item || !item.configured) return { tone: 'off', label: 'Не подключён', detail: '' };
        var m = item.meta || {};
        if (item.source === 'env') return { tone: 'ok', label: 'Подключён', detail: 'Задан на сервере (переменная окружения)' };
        return { tone: 'ok', label: 'Подключён', detail: (m.mask || m.email || '') };
    }

    function botStatus(b) {
        var map = { online: ['ok', 'На связи'], offline: ['bad', 'Не отвечает'], no_token: ['bad', 'Нет токена'], disabled: ['off', 'Выключен'], deleted: ['off', 'Удалён'] };
        return map[b.status] || ['off', b.status || '—'];
    }
    function scenario(b) { return b.id === 'alina' || b.id === 'alina2' ? 'Алина: самовыкупы и раздачи' : 'Сценарий не назначен'; }

    function pill(tone, text) { return '<span class="nk-pill nk-' + tone + '"><i></i>' + esc(text) + '</span>'; }

    function botRow(b) {
        var st = botStatus(b), busy = state.busy['bot:' + b.id];
        var name = b.live_username ? '@' + b.live_username : (b.title || b.id);
        return '<div class="nk-row" data-bot="' + esc(b.id) + '">' +
            '<div class="nk-ava" aria-hidden="true">' + esc((b.title || b.id || '?').charAt(0).toUpperCase()) + '</div>' +
            '<div class="nk-t"><b>' + esc(b.title || b.id) + '</b><span>' + esc(name) + ' · ' + esc(scenario(b)) + '</span></div>' +
            pill(st[0], st[1]) +
            '<button type="button" class="nk-btn" data-act="webhook" data-id="' + esc(b.id) + '"' + (busy ? ' disabled' : '') + '>' + (busy === 'webhook' ? 'Подключаю…' : 'Обновить связь') + '</button>' +
            '<label class="nk-sw" title="Включить или выключить"><input type="checkbox" data-act="toggle" data-id="' + esc(b.id) + '"' + (b.is_enabled ? ' checked' : '') + '><u></u></label></div>';
    }

    function tgCard() {
        var bots = ((state.tg && state.tg.bots) || []).filter(function (b) { return b.status !== 'deleted'; });
        var h = '<section class="nk-card" data-card="tg"><div class="nk-head"><h3>Telegram-боты</h3><span class="nk-sub">Через них бот общается с клиентами</span></div>';
        h += bots.length ? bots.map(botRow).join('') : '<p class="nk-empty">' + (state.tg ? 'Ботов пока нет.' : 'Загружаю список…') + '</p>';
        if (state.form === 'bot') {
            h += '<form class="nk-form" data-form="bot"><label>Название<input type="text" name="title" placeholder="Например, Алина Элиум" autocomplete="off" maxlength="60"></label>' +
                '<label>Токен бота<input type="password" name="token" placeholder="123456:AA…" autocomplete="off" spellcheck="false"></label>' +
                '<p class="nk-hint">Токен выдаёт @BotFather. Он сохранится на сервере и больше нигде не показывается.</p>' +
                '<div class="nk-actions"><button type="submit" class="nk-btn nk-ink"' + (state.busy.addbot ? ' disabled' : '') + '>' + (state.busy.addbot ? 'Подключаю…' : 'Подключить') + '</button><button type="button" class="nk-btn" data-act="cancel">Отмена</button></div></form>';
        } else {
            h += '<div class="nk-actions"><button type="button" class="nk-btn" data-act="addbot">+ Добавить бота</button></div>';
        }
        return h + '</section>';
    }

    function keyCard(kind) {
        var isG = kind === 'google', item = state.keys && state.keys[isG ? 'google' : 'openai'], v = keyView(item), busy = state.busy[kind];
        var title = isG ? 'Google-аккаунт для таблиц' : 'ChatGPT (OpenAI)';
        var sub = isG ? 'Через него бот читает и заполняет таблицу «Раздачи»' : 'Через него бот понимает вопросы клиентов и скриншоты';
        var h = '<section class="nk-card" data-card="' + kind + '"><div class="nk-head"><h3>' + title + '</h3><span class="nk-sub">' + sub + '</span></div>';
        h += '<div class="nk-row"><div class="nk-t"><b>' + (state.keys ? esc(v.label) : 'Загружаю…') + '</b><span>' + esc(v.detail) +
            (item && item.meta && item.meta.model && !isG ? ' · модель ' + esc(item.meta.model) : '') + '</span></div>' + (state.keys ? pill(v.tone, v.label) : '') + '</div>';
        if (isG && item && item.configured && item.meta && item.meta.email) {
            h += '<p class="nk-hint">Чтобы бот видел таблицу, откройте её доступ для адреса <code class="nk-code">' + esc(item.meta.email) + '</code> ' +
                '<button type="button" class="nk-link" data-act="copyemail" data-email="' + esc(item.meta.email) + '">Скопировать адрес</button></p>';
        }
        if (state.sheet && isG) h += '<p class="nk-hint ' + (state.sheet.ok ? 'nk-okt' : 'nk-badt') + '">' + esc(state.sheet.text) + '</p>';
        if (state.form === kind) {
            h += '<form class="nk-form" data-form="' + kind + '">';
            if (isG) h += '<label>Файл ключа (JSON)<input type="file" name="file" accept="application/json,.json"></label><label>или вставьте содержимое<textarea name="json" rows="4" placeholder=\'{"type":"service_account", …}\' spellcheck="false"></textarea></label>';
            else h += '<label>Ключ API<input type="password" name="key" placeholder="sk-…" autocomplete="off" spellcheck="false"></label><label>Модель<select name="model">' +
                ((state.keys && state.keys.models) || ['gpt-4o-mini']).map(function (m) { return '<option>' + esc(m) + '</option>'; }).join('') + '</select></label>';
            h += '<p class="nk-hint">Ключ проверяется у ' + (isG ? 'Google' : 'OpenAI') + ' до сохранения и после этого больше не показывается.</p>' +
                '<div class="nk-actions"><button type="submit" class="nk-btn nk-ink"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Проверяю…' : 'Сохранить') + '</button><button type="button" class="nk-btn" data-act="cancel">Отмена</button></div></form>';
        } else {
            h += '<div class="nk-actions"><button type="button" class="nk-btn" data-act="replace" data-kind="' + kind + '">' + (item && item.configured ? 'Заменить ключ' : '+ Подключить') + '</button>' +
                (item && item.configured && item.source === 'db' ? '<button type="button" class="nk-btn" data-act="test" data-kind="' + kind + '"' + (busy ? ' disabled' : '') + '>' + (busy === 'test' ? 'Проверяю…' : 'Проверить') + '</button><button type="button" class="nk-btn nk-danger" data-act="remove" data-kind="' + kind + '">Отключить</button>' : '') + '</div>';
        }
        return h + '</section>';
    }

    function paint() {
        if (!state.host) return;
        // форму и введённое в ней не затираем: перерисовываем карточки только когда форма не в фокусе
        if (state.host.querySelector('.nk-form input:focus, .nk-form textarea:focus')) return;
        // введённое в формах (кроме файла) переживает перерисовку, например после ошибки проверки
        var vals = {};
        Array.prototype.forEach.call(state.host.querySelectorAll('.nk-form [name]'), function (el) {
            if (el.type !== 'file' && el.value) vals[el.closest('form').getAttribute('data-form') + ':' + el.name] = el.value;
        });
        state.host.innerHTML = '<div class="nk-wrap"><p class="nk-lead">Боту по сценарию Алины нужны три вещи: Telegram-бот (общается с клиентами), ключ ChatGPT (понимает вопросы и скриншоты) и Google-аккаунт (читает и заполняет таблицу). Здесь они подключаются и меняются без разработчика.</p>' +
            '<div class="nk-grid">' + tgCard() + keyCard('openai') + keyCard('google') + '</div>' + toastHtml() + '</div>';
        Array.prototype.forEach.call(state.host.querySelectorAll('.nk-form [name]'), function (el) {
            var k = el.closest('form').getAttribute('data-form') + ':' + el.name;
            if (el.type !== 'file' && vals[k] != null) el.value = vals[k];
        });
    }

    // Тост хранится в состоянии: перерисовка карточек его не стирает.
    function toastHtml() {
        var t = state.toast;
        return '<div class="nk-toast' + (t && t.bad ? ' nk-toast-bad' : '') + '" data-v="toast"' + (t ? '' : ' hidden') + '>' + (t ? esc(t.text) : '') + '</div>';
    }
    function toast(text, bad) {
        state.toast = { text: text, bad: !!bad };
        var t = state.host && state.host.querySelector('[data-v="toast"]');
        if (t) { t.textContent = text; t.className = 'nk-toast' + (bad ? ' nk-toast-bad' : ''); t.hidden = false; }
        clearTimeout(toast.t);
        toast.t = setTimeout(function () {
            state.toast = null;
            var el = state.host && state.host.querySelector('[data-v="toast"]'); if (el) el.hidden = true;
        }, 3200);
    }

    function call(fn, body) {
        return Promise.resolve(state.sb.functions.invoke(fn, { body: body })).then(function (r) {
            var d = r && r.data;
            if (r && r.error && !(d && (d.error || d.ok === false))) throw new Error('Нет связи с сервером');
            if (d && (d.ok === false || d.error)) throw new Error(d.error || 'Не получилось');
            return d || {};
        });
    }

    function refreshTg() { return call('telegram-admin', { action: 'list' }).then(function (d) { state.tg = { bots: d.bots || [] }; writeCache(); paint(); }, function () { if (!state.tg) { state.tg = { bots: [] }; paint(); } }); }
    function refreshKeys() { return call('integrations-admin', { action: 'status' }).then(function (d) { state.keys = { openai: d.openai, google: d.google, models: d.models }; writeCache(); paint(); }, function () { /* остаётся кэш */ }); }

    function onSubmit(e) {
        var f = e.target.closest('form[data-form]'); if (!f) return; e.preventDefault();
        var kind = f.getAttribute('data-form'), v = function (n) { var el = f.elements[n]; return el ? String(el.value || '').trim() : ''; };
        if (kind === 'bot') {
            if (!v('title') || !v('token')) return toast('Укажите название и токен бота', true);
            state.busy.addbot = true; paint();
            call('telegram-admin', { action: 'create', title: v('title'), token: v('token'), kind: 'agent' }).then(function (d) {
                state.busy.addbot = false; state.form = ''; toast('Бот @' + (d.username || '') + ' подключён'); refreshTg();
            }, function (err) { state.busy.addbot = false; toast(err.message, true); paint(); });
            return;
        }
        var go = function (body) {
            state.busy[kind] = true; paint();
            call('integrations-admin', body).then(function (d) {
                state.busy[kind] = false; state.form = '';
                if (kind === 'google') state.sheet = d.sheet === false ? { ok: false, text: 'Ключ принят, но таблицы бот не видит. Откройте доступ к ней для адреса сервисного аккаунта.' } : d.sheet ? { ok: true, text: 'Таблица «' + (d.title || '') + '» доступна.' } : null;
                toast('Сохранено и проверено'); refreshKeys();
            }, function (err) { state.busy[kind] = false; toast(err.message, true); paint(); });
        };
        if (kind === 'openai') {
            if (!v('key')) return toast('Вставьте ключ', true);
            go({ action: 'set_openai', api_key: v('key'), model: v('model') });
        } else {
            var file = f.elements.file && f.elements.file.files && f.elements.file.files[0];
            if (file) { var rd = new root.FileReader(); rd.onload = function () { go({ action: 'set_google', json: String(rd.result || '') }); }; rd.readAsText(file); }
            else if (v('json')) go({ action: 'set_google', json: v('json') });
            else toast('Загрузите файл или вставьте его содержимое', true);
        }
    }

    function onClick(e) {
        var a = e.target.closest('[data-act]'); if (!a) return;
        var act = a.getAttribute('data-act'), id = a.getAttribute('data-id'), kind = a.getAttribute('data-kind');
        if (act === 'toggle') {
            var on = a.checked;
            call('telegram-admin', { action: on ? 'enable' : 'disable', bot_id: id }).then(function () { toast(on ? 'Бот включён' : 'Бот выключен'); refreshTg(); }, function (er) { a.checked = !on; toast(er.message, true); });
        } else if (act === 'webhook') {
            state.busy['bot:' + id] = 'webhook'; paint();
            call('telegram-admin', { action: 'set_webhook', bot_id: id }).then(function () { state.busy['bot:' + id] = false; toast('Связь с Telegram обновлена'); refreshTg(); }, function (er) { state.busy['bot:' + id] = false; toast(er.message, true); paint(); });
        } else if (act === 'addbot') { state.form = 'bot'; paint(); }
        else if (act === 'replace') { state.form = kind; paint(); }
        else if (act === 'cancel') { state.form = ''; paint(); }
        else if (act === 'copyemail') {
            var email = a.getAttribute('data-email'), done = function () { toast('Адрес скопирован'); };
            try { root.navigator.clipboard.writeText(email).then(done, function () { toast(email); }); } catch (er) { toast(email); }
        } else if (act === 'test') {
            state.busy[kind] = 'test'; paint();
            call('integrations-admin', { action: 'test', provider: kind }).then(function (d) {
                state.busy[kind] = false;
                if (kind === 'google') state.sheet = d.sheet === false ? { ok: false, text: 'Таблицу бот не видит. Откройте доступ для адреса сервисного аккаунта.' } : d.sheet ? { ok: true, text: 'Таблица «' + (d.title || '') + '» доступна.' } : null;
                toast('Всё работает'); paint();
            }, function (er) { state.busy[kind] = false; toast(er.message, true); paint(); });
        } else if (act === 'remove') {
            if (a.getAttribute('data-sure') !== '1') { a.setAttribute('data-sure', '1'); a.textContent = 'Нажмите ещё раз, чтобы отключить'; return; }
            call('integrations-admin', { action: 'remove', provider: kind }).then(function () { state.sheet = null; toast('Отключено'); refreshKeys(); }, function (er) { toast(er.message, true); });
        }
    }

    function show(opts) {
        if (!opts || !opts.host || !opts.supabase) return;
        state.sb = opts.supabase; state.active = true;
        if (state.host !== opts.host) {
            state.host = opts.host; state.built = false;
            opts.host.addEventListener('click', onClick); opts.host.addEventListener('submit', onSubmit);
        }
        if (!state.tg && !state.keys) { var c = readCache(); if (c) { state.tg = c.tg; state.keys = c.keys; } }
        paint();
        refreshTg(); refreshKeys();
    }
    function hide() { state.active = false; }

    var api = { keyView: keyView, botStatus: botStatus, scenario: scenario, show: show, hide: hide };
    root.NrKeys = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

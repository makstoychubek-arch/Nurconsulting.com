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
        hoursOn: false, hoursFrom: '09:00', hoursTo: '22:00', offHoursText: '', topicsOff: [], managerGroup: 0, blacklist: [], texts: {},
    };
    // Темы, по которым Алина не отвечает сама, а спрашивает менеджера (идентификаторы совпадают с alina-gate.ts).
    var TOPICS = [
        { id: 'other_item', label: 'Заказал другой вариант', hint: '«заказала не ту модель», «другой артикул»' },
        { id: 'payout_missing', label: 'Выплата не пришла', hint: '«деньги не пришли», «выплата не пришла»' },
        { id: 'payout_when', label: 'Когда выплата', hint: '«когда придут деньги»' },
        { id: 'receipt', label: 'Чек перевода', hint: '«где чек»' },
        { id: 'manager', label: 'Позвать менеджера', hint: '«можно поговорить с менеджером»' },
    ];
    var KEYS = Object.keys(DEFAULTS);
    var LABELS = {
        read: 'Прочитано', typing: '«Печатает…»', pauseMaxSec: 'Пауза «печатает»', useName: 'Имя клиента', phrases: 'Фразы «уточняю»',
        remindMin: 'Напоминание менеджерам', reactions: 'Итог реакцией', copyButton: 'Кнопка копирования логина',
        admitLimit: 'Лимит новых клиентов', admitHours: 'Период лимита', llmBudgetUsd: 'Бюджет ChatGPT',
        hoursOn: 'Часы работы', hoursFrom: 'Начало работы', hoursTo: 'Конец работы', offHoursText: 'Сообщение вне часов', topicsOff: 'Вопросы менеджеру', managerGroup: 'Группа менеджеров', blacklist: 'Чёрный список', texts: 'Тексты Алины',
    };

    function clone(o) { return JSON.parse(JSON.stringify(o)); }
    function bool(v, d) { return typeof v === 'boolean' ? v : d; }
    function num(v, d, min, max) { var n = typeof v === 'number' ? v : Number(v); return isFinite(n) ? Math.min(max, Math.max(min, n)) : d; }

    function hm(v, d) {
        var m = String(v == null ? '' : v).trim().match(/^(\d{1,2}):(\d{2})$/);
        if (!m) return d;
        var h = Number(m[1]), min = Number(m[2]);
        return h >= 0 && h <= 23 && min >= 0 && min < 60 ? (h < 10 ? '0' : '') + h + ':' + m[2] : d;
    }
    /** Логин без @, ссылки t.me и регистра (как на сервере). */
    function normLogin(v) {
        var s = String(v == null ? '' : v).trim().toLowerCase().replace(/^https?:\/\/(?:www\.)?t\.me\//, '').replace(/^@+/, '').replace(/[\/?#].*$/, '').replace(/[.,;:\s]+$/, '');
        return /^[a-z0-9_]{3,64}$/.test(s) ? s : '';
    }
    function cleanTexts(v) {
        var out = {};
        if (v && typeof v === 'object') Object.keys(v).forEach(function (k) { if (/^[a-z_]{1,30}$/.test(k) && typeof v[k] === 'string' && v[k].trim()) out[k] = v[k].slice(0, 4000); });
        return out;
    }
    /** Значения подстановок для предпросмотра текстов. */
    var SAMPLE = { 'товар': 'Пижама 2в1 шоколадный', 'ключ': 'пижама женская', 'срок': '18.11.2026 до 22:00 МСК' };
    function previewText(raw, vars) {
        return String(raw || '').replace(/\{([^{}]+)\}/g, function (m, k) { return (vars || SAMPLE)[k] != null ? (vars || SAMPLE)[k] : m; });
    }
    function groupId(v) {
        var n = typeof v === 'number' ? v : Number(String(v == null ? '' : v).trim());
        return isFinite(n) && Math.floor(n) === n && n < 0 ? n : 0;
    }

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
            hoursOn: bool(r.hoursOn, DEFAULTS.hoursOn), hoursFrom: hm(r.hoursFrom, DEFAULTS.hoursFrom), hoursTo: hm(r.hoursTo, DEFAULTS.hoursTo),
            offHoursText: typeof r.offHoursText === 'string' ? r.offHoursText.trim().slice(0, 400) : '',
            topicsOff: Array.isArray(r.topicsOff) ? r.topicsOff.map(String).filter(function (x, i, a) { return /^[a-z_]{1,30}$/.test(x) && a.indexOf(x) === i; }).slice(0, 20) : [],
            managerGroup: groupId(r.managerGroup),
            blacklist: Array.isArray(r.blacklist) ? r.blacklist.map(normLogin).filter(function (x, i, a) { return x && a.indexOf(x) === i; }).slice(0, 2000) : [],
            texts: cleanTexts(r.texts),
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
            '<section class="as-card"><h3>Часы работы</h3>' +
            switchHtml('hoursOn', 'Отвечать только в рабочие часы', 'Вне часов клиент один раз получает сообщение о времени работы') +
            '<div class="as-row"><div class="as-t"><b>Время работы по Москве</b><span>Окно может переходить через полночь</span></div>' +
            '<input type="time" class="as-time" data-k="hoursFrom" aria-label="Начало работы"><span class="as-unit">до</span><input type="time" class="as-time" data-k="hoursTo" aria-label="Конец работы"></div>' +
            '<div class="as-t as-pt"><b>Сообщение вне часов</b><span>Подставляются {от} и {до}. Пусто: стандартный текст</span></div>' +
            '<textarea class="as-area" data-k="offHoursText" rows="3" maxlength="400" placeholder="Сейчас нерабочее время. Я на связи с {от} до {до} по Москве. Напишите мне после {от}, отвечу сразу." aria-label="Сообщение вне часов"></textarea></section>' +
            '<section class="as-card"><h3>Вопросы менеджеру</h3><p class="as-sub">Если клиент пишет об этом, Алина отвечает «Минутку, уточню» и отправляет вопрос в группу менеджеров.</p>' +
            TOPICS.map(function (t) { return '<div class="as-row"><div class="as-t"><b>' + esc(t.label) + '</b><span>' + esc(t.hint) + '</span></div><label class="as-sw"><input type="checkbox" data-topic="' + t.id + '"><u></u></label></div>'; }).join('') +
            '<div class="as-row"><div class="as-t"><b>Группа менеджеров</b><span>Номер группы Telegram, например -1004465341061. Пусто: группа по умолчанию</span></div>' +
            '<input type="text" class="as-group" data-k="managerGroup" inputmode="numeric" placeholder="по умолчанию" autocomplete="off" aria-label="Номер группы менеджеров"></div></section>' +
            '<section class="as-card"><h3>Чёрный список</h3><p class="as-sub">Этим клиентам Алина не отвечает совсем: ни в рабочие часы, ни вне них, и вопросы менеджеру от них не уходят.</p>' +
            '<textarea class="as-area" data-bl="1" rows="4" placeholder="по одному логину в строке, например @ivan_petrov" aria-label="Чёрный список" spellcheck="false"></textarea><p class="as-hint" data-v="blcount"></p></section>' +
            '<section class="as-card" data-v="textscard" hidden><h3>Тексты Алины</h3><p class="as-sub">Измените любой ответ. Подстановки в фигурных скобках: {товар}, {ключ}, {срок}. Пустое поле или «Вернуть» возвращают стандартный текст. Изменения применяются за полминуты, проверить можно в песочнице.</p><div data-v="texts"></div></section>' +
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
            if (el.type === 'checkbox') el.checked = !!s[k];
            else if (k === 'managerGroup') { var gv = s.managerGroup ? String(s.managerGroup) : ''; if (document.activeElement !== el && el.value !== gv) el.value = gv; }
            else if (document.activeElement === el && (el.type === 'time' || el.tagName === 'TEXTAREA')) { /* не мешаем вводу */ }
            else if (String(el.value) !== String(s[k])) el.value = s[k];
        });
        var bl = q('[data-bl]');
        if (bl && document.activeElement !== bl) { var blv = s.blacklist.join('\n'); if (bl.value !== blv) bl.value = blv; }
        var blc = q('[data-v="blcount"]'); if (blc) blc.textContent = s.blacklist.length ? 'В списке: ' + s.blacklist.length : 'Список пуст';
        paintTexts();
        Array.prototype.forEach.call(host.querySelectorAll('[data-topic]'), function (el) { el.checked = s.topicsOff.indexOf(el.getAttribute('data-topic')) === -1; });
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

    function updateBar() {
        var n = changedKeys(state.saved, normalize(state.cur)).length;
        q('[data-v="bar"]').hidden = n === 0; q('[data-v="cnt"]').textContent = 'Изменено: ' + n;
    }

    /** Редактор текстов (только администратор): стандартные тексты приходят с сервера, чтобы не дублировать их в браузере. */
    function paintTexts() {
        var card = q('[data-v="textscard"]'); if (!card) return;
        card.hidden = !state.canPower || !state.textDefs; if (card.hidden) return;
        var key = JSON.stringify(state.cur.texts) + '|' + state.textDefs.length;
        var box = q('[data-v="texts"]');
        if (state.textsKey === key || box.contains(document.activeElement)) return;
        state.textsKey = key;
        var groups = [];
        state.textDefs.forEach(function (d) { if (groups.indexOf(d.group) === -1) groups.push(d.group); });
        box.innerHTML = groups.map(function (g) {
            return '<h4 class="as-grp-h">' + esc(g) + '</h4>' + state.textDefs.filter(function (d) { return d.group === g; }).map(function (d) {
                var cur = state.cur.texts[d.id], val = cur != null ? cur : d.text;
                return '<div class="as-text"><div class="as-text-h"><b>' + esc(d.label) + '</b>' + (d.vars.length ? '<span>' + d.vars.map(function (v) { return '{' + esc(v) + '}'; }).join(' ') + '</span>' : '') +
                    '<button type="button" class="as-link" data-reset="' + d.id + '"' + (cur != null ? '' : ' hidden') + '>Вернуть стандартный</button></div>' +
                    '<textarea class="as-area" data-text="' + d.id + '" rows="' + Math.min(8, Math.max(2, Math.ceil(val.length / 70))) + '" aria-label="' + esc(d.label) + '">' + esc(val) + '</textarea>' +
                    '<div class="as-text-pv" aria-label="Так увидит клиент">' + esc(previewText(val)) + '</div></div>';
            }).join('');
        }).join('');
    }

    function loadTexts() {
        if (!state.canPower || state.textDefs) return Promise.resolve();
        return Promise.resolve(state.sb.functions.invoke('alina-sandbox', { body: { action: 'texts' } })).then(function (r) {
            var t = r && r.data && r.data.texts; if (Array.isArray(t) && t.length) { state.textDefs = t; if (state.active) paintValues(); }
        }, function () { /* без списка редактор остаётся скрытым */ });
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
            if (el.getAttribute && el.getAttribute('data-bl')) { state.cur.blacklist = el.value.split(/[\n,;]+/).map(normLogin).filter(function (x, i, a) { return x && a.indexOf(x) === i; }); updateBar(); var c2 = q('[data-v="blcount"]'); if (c2) c2.textContent = state.cur.blacklist.length ? 'В списке: ' + state.cur.blacklist.length : 'Список пуст'; return; }
            var tid = el.getAttribute && el.getAttribute('data-text');
            if (tid) {
                var def = (state.textDefs || []).filter(function (d) { return d.id === tid; })[0];
                var next = Object.assign({}, state.cur.texts);
                if (!el.value.trim() || (def && el.value === def.text)) delete next[tid]; else next[tid] = el.value;
                state.cur.texts = cleanTexts(next); updateBar();
                var pv = el.closest('.as-text').querySelector('.as-text-pv'); if (pv) pv.textContent = previewText(el.value.trim() ? el.value : def.text);
                var rs = el.closest('.as-text').querySelector('[data-reset]'); if (rs) rs.hidden = !state.cur.texts[tid];
                return;
            }
            var tp = el.getAttribute && el.getAttribute('data-topic');
            if (tp) {
                var off = state.cur.topicsOff.filter(function (x) { return x !== tp; });
                if (!el.checked) off.push(tp);
                setValue('topicsOff', off); return;
            }
            var pi = el.getAttribute && el.getAttribute('data-p');
            if (pi != null) { state.cur.phrases[Number(pi)] = el.value; paintPreview(); var n = changedKeys(state.saved, normalize(state.cur)).length; q('[data-v="bar"]').hidden = n === 0; q('[data-v="cnt"]').textContent = 'Изменено: ' + n; }
        });
        state.host.addEventListener('click', function (e) {
            var t = e.target, st = t.closest('[data-step]');
            if (st) { var k = st.getAttribute('data-for'); setValue(k, Number(state.cur[k]) + Number(st.getAttribute('data-step'))); return; }
            var del = t.closest('[data-del]');
            if (del) { if (state.cur.phrases.length > 1) { state.cur.phrases.splice(Number(del.getAttribute('data-del')), 1); paintValues(); } return; }
            var rst = t.closest('[data-reset]');
            if (rst) { var rid = rst.getAttribute('data-reset'), n2 = Object.assign({}, state.cur.texts); delete n2[rid]; state.cur.texts = cleanTexts(n2); state.textsKey = ''; if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); paintValues(); return; }
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
        loadPower(); loadTexts();
        load().catch(function () { if (state.active && !state.loadedFresh) toast('Не удалось загрузить настройки, показаны сохранённые на этом устройстве'); });
    }

    function hide() { state.active = false; }

    /** Окно настроек Алины из шестерёнки в «Раздачах». Фон за окном размыт (правило сайта), Esc и клик по фону закрывают. */
    var win = null;
    function openWindow(opts) {
        if (!opts || !opts.supabase) return;
        var doc = root.document;
        if (!win) {
            var ov = doc.createElement('div'); ov.className = 'as-overlay'; ov.setAttribute('data-nr-blur', ''); ov.hidden = true;
            ov.innerHTML = '<div class="as-win" role="dialog" aria-modal="true" aria-label="Настройки раздач"><div class="as-win-bar"><b>Настройки раздач · Алина</b><button type="button" class="as-win-x" aria-label="Закрыть">×</button></div><div class="as-win-body"></div></div>';
            doc.body.appendChild(ov);
            var close = function () { ov.hidden = true; hide(); };
            ov.addEventListener('click', function (e) { if (e.target === ov || e.target.closest('.as-win-x')) close(); });
            doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !ov.hidden) close(); });
            win = { ov: ov, body: ov.querySelector('.as-win-body') };
        }
        win.ov.hidden = false;
        var canPower = false; try { canPower = typeof isSuperAdmin !== 'undefined' && isSuperAdmin === true; } catch (e) { canPower = false; }
        show({ host: win.body, supabase: opts.supabase, canPower: canPower });
    }

    var api = { previewText: previewText, normLogin: normLogin, openWindow: openWindow,
        DEFAULTS: DEFAULTS, normalize: normalize, changedKeys: changedKeys, previewPhrase: previewPhrase, show: show, hide: hide,
        _state: state, _save: save,
    };
    root.NrAlinaSettings = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

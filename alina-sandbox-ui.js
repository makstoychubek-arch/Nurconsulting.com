/**
 * «Песочница» Алины на странице «Продвижение → Алина» (только супер-админ): написать ей как клиент и увидеть ответы.
 * Сообщение проходит через настоящий сценарий (функция alina-sandbox), в Telegram и в рабочую таблицу ничего не уходит.
 * Сообщение клиента появляется сразу, ответ подставляется в фоне; при ошибке «Повторить».
 */
(function (root) {
    var KEY = 'nr_alina_sandbox_v1';
    var CHIPS = ['Здравствуйте, хочу участвовать', 'Можно поговорить с менеджером?', 'Сколько мест осталось?', 'Где мой кэшбэк?'];
    var STAGES = { new: 'новый', ask_ad: 'выясняет объявление', ask_type: 'выясняет вид', done: 'завершён' };

    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

    /** Строка состояния диалога под чатом. Чистая функция для теста. */
    function stateLine(lead, ms) {
        var parts = [];
        if (lead) {
            parts.push('Этап: ' + (STAGES[lead.status] || lead.status || '—'));
            if (lead.product_name) parts.push('товар: ' + lead.product_name);
            if (lead.deal_type) parts.push('вид: ' + (lead.deal_type === 'barter' ? 'бартер' : lead.deal_type === 'cashback' ? 'кэшбэк' : lead.deal_type));
        }
        if (ms != null) parts.push('ответила за ' + (ms < 1000 ? ms + ' мс' : (ms / 1000).toFixed(1).replace('.', ',') + ' с'));
        return parts.join(' · ');
    }

    var state = { sb: null, host: null, msgs: [], login: 'sandbox_client', busy: false, lead: null, ms: null, error: null, built: false };

    function load() { try { var r = JSON.parse(root.localStorage.getItem(KEY) || 'null'); if (r) { state.msgs = (r.msgs || []).slice(-60); state.login = r.login || state.login; } } catch (e) { /* без кэша */ } }
    function save() { try { root.localStorage.setItem(KEY, JSON.stringify({ msgs: state.msgs.slice(-60), login: state.login })); } catch (e) { /* без кэша */ } }

    function bubble(m) {
        if (m.from === 'note') return '<div class="asb-note">' + esc(m.text) + '</div>';
        var cls = m.from === 'me' ? 'asb-me' : 'asb-bot';
        var h = '<div class="asb-m ' + cls + '">';
        if (m.photo) h += '<img class="asb-img" alt="" src="' + esc(m.photo) + '">';
        return h + esc(m.text) + '</div>';
    }

    function build() {
        state.host.innerHTML = '<h3>Песочница</h3><p class="asb-sub">Напишите Алине как клиент. В Telegram и в рабочую таблицу ничего не уходит, расходуется ключ ChatGPT.</p>' +
            '<div class="asb-bar"><label class="asb-login">Логин клиента <input type="text" data-sb="login" maxlength="32" autocomplete="off" aria-label="Логин клиента"></label>' +
            '<label class="asb-login">Время (МСК) <input type="time" data-sb="time" aria-label="Время по Москве для проверки часов работы"></label>' +
            '<button type="button" class="as-btn" data-sb-act="reset">Начать заново</button></div>' +
            '<div class="asb-chat" data-sb="chat" role="log" aria-live="polite"></div>' +
            '<div class="asb-state" data-sb="state"></div>' +
            '<div class="asb-chips" data-sb="chips">' + CHIPS.map(function (c) { return '<button type="button" class="asb-chip" data-sb-chip="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') + '</div>' +
            '<form class="asb-form" data-sb="form"><input type="text" data-sb="text" placeholder="Сообщение клиента" autocomplete="off" aria-label="Сообщение клиента" maxlength="1500">' +
            '<button type="submit" class="as-btn as-ink" data-sb="send">Отправить</button></form>';
        state.built = true;
        state.host.addEventListener('submit', function (e) { e.preventDefault(); send(q('[data-sb="text"]').value); });
        state.host.addEventListener('click', function (e) {
            var chip = e.target.closest('[data-sb-chip]'); if (chip) return send(chip.getAttribute('data-sb-chip'));
            var act = e.target.closest('[data-sb-act]'); if (!act) return;
            if (act.getAttribute('data-sb-act') === 'reset') reset();
            if (act.getAttribute('data-sb-act') === 'retry') { var last = state.msgs.filter(function (m) { return m.from === 'me'; }).pop(); if (last) { state.msgs = state.msgs.filter(function (m) { return !m.err; }); send(last.text, true); } }
        });
        state.host.addEventListener('input', function (e) { if (e.target.getAttribute && e.target.getAttribute('data-sb') === 'login') { state.login = e.target.value; save(); } });
    }

    function q(sel) { return state.host.querySelector(sel); }

    function paint() {
        if (!state.built) return;
        var chat = q('[data-sb="chat"]');
        var h = state.msgs.length ? state.msgs.map(function (m) { return m.err ? '<div class="asb-m asb-err">' + esc(m.text) + ' <button type="button" class="asb-retry" data-sb-act="retry">Повторить</button></div>' : bubble(m); }).join('') : '<div class="asb-empty">Диалог пуст. Выберите фразу ниже или напишите сами.</div>';
        if (state.busy) h += '<div class="asb-typing" aria-label="Алина печатает"><i></i><i></i><i></i></div>';
        chat.innerHTML = h; chat.scrollTop = chat.scrollHeight;
        var inp = q('[data-sb="login"]'); if (inp && inp.value !== state.login) inp.value = state.login;
        q('[data-sb="state"]').textContent = stateLine(state.lead, state.ms);
        q('[data-sb="send"]').disabled = state.busy;
    }

    function call(body) {
        return Promise.resolve(state.sb.functions.invoke('alina-sandbox', { body: body })).then(function (r) {
            var d = r && r.data;
            if (r && r.error && !(d && d.error)) throw new Error('Нет связи с сервером');
            if (d && (d.ok === false || d.error)) throw new Error(d.error || 'Не получилось');
            return d || {};
        });
    }

    function send(text, isRetry) {
        text = String(text || '').trim(); if (!text || state.busy) return;
        if (!isRetry) state.msgs.push({ from: 'me', text: text });
        var inp = q('[data-sb="text"]'); if (inp) inp.value = '';
        state.busy = true; paint(); save();
        call({ action: 'send', text: text, username: state.login, now_msk: (q('[data-sb="time"]') || {}).value || '' }).then(function (d) {
            (d.photos || []).forEach(function (p) { if (p.url || p.caption) state.msgs.push({ from: 'bot', text: p.caption || '', photo: p.url || '' }); });
            (d.replies || []).forEach(function (t) { state.msgs.push({ from: 'bot', text: t }); });
            if (d.escalate) state.msgs.push({ from: 'note', text: 'Менеджерам в группу ушло бы: ' + d.escalate.question });
            state.lead = d.lead || null; state.ms = d.ms == null ? null : d.ms; state.busy = false; paint(); save();
        }, function (err) { state.msgs.push({ from: 'bot', err: true, text: err.message }); state.busy = false; paint(); save(); });
    }

    function reset() {
        state.msgs = []; state.lead = null; state.ms = null; state.busy = false; paint(); save();
        call({ action: 'reset' }).catch(function () { /* следующий диалог всё равно начнётся с чистого экрана */ });
    }

    function mount(opts) {
        if (!opts || !opts.host || !opts.supabase) return;
        state.sb = opts.supabase;
        if (state.host !== opts.host) { state.host = opts.host; state.built = false; load(); }
        if (!state.built) build();
        paint();
        if (!state.lead) call({ action: 'state' }).then(function (d) { state.lead = d.lead || null; paint(); }, function () { /* состояние не обязательно */ });
    }

    var api = { stateLine: stateLine, mount: mount, _state: state };
    root.NrAlinaSandbox = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

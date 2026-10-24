/* «Старт» для нового клиента: отсчёт пробного доступа и мини-план из пяти шагов.
   Шаги отмечаются сами по данным кабинета; Telegram подключается одной кнопкой (ссылка выдаётся сервером).
   Показывается только аккаунтам с ограниченным по времени доступом (plan_until), у команды панели нет. */
(function (root) {
    'use strict';
    var doc = root.document;
    if (!doc) return;
    var S = { db: null, userId: '', cab: '', el: null, timer: 0, poll: 0, space: null, steps: null, open: true, started: false };

    // Владелец или гость кабинета, выданного командой: ему не нужны ни пробный срок, ни «Продлить», ни шаги подключения.
    function isViewer() { return !!(root.NrViewer && root.NrViewer.on); }

    function lsGet(k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { root.localStorage.setItem(k, v); } catch (e) {} }

    function left(ms) {
        if (ms <= 0) return null;
        var m = Math.floor(ms / 60000), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mi = m % 60;
        if (d >= 1) return d + ' д ' + h + ' ч';
        if (h >= 1) return h + ' ч ' + mi + ' мин';
        return mi + ' мин';
    }

    async function api(fn, body) {
        try {
            var r = await S.db.auth.getSession(), ses = r && r.data && r.data.session;
            if (!ses) return null;
            var res = await fetch(root.SUPABASE_URL + '/functions/v1/' + fn, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + ses.access_token },
                body: JSON.stringify(body || {}),
            });
            return await res.json().catch(function () { return null; });
        } catch (e) { return null; }
    }

    async function count(table) {
        try {
            var r = await S.db.from(table).select('id', { count: 'exact', head: true }).eq('cabinet_id', S.cab);
            return r && !r.error && (r.count || 0) > 0;
        } catch (e) { return false; }
    }

    async function load() {
        try {
            var sp = await S.db.from('spaces').select('status, tariff_plan, plan_until').eq('user_id', S.userId).maybeSingle();
            S.space = sp && sp.data || null;
        } catch (e) { S.space = null; }
        var st = await api('akylai-status', { action: 'state' });
        var rnpData = false;
        try {
            var q = await S.db.from('rnp_daily_data').select('nm_id', { count: 'exact', head: true }).eq('cabinet_id', S.cab);
            rnpData = !!(q && !q.error && (q.count || 0) > 0);
        } catch (e) {}
        S.steps = [
            { id: 'cab', t: 'Магазин подключён', done: true },
            { id: 'data', t: 'Данные загружены', hint: 'Первая загрузка занимает 5–10 минут', done: rnpData },
            { id: 'rnp', t: 'Посмотреть РНП', done: lsGet('nr_seen_rnp') === '1', go: 'rnp', btn: 'Открыть' },
            { id: 'ab', t: 'Запустить первый А/Б тест', done: await count('ab_tests'), go: 'ab-testing', btn: 'Открыть' },
            { id: 'tg', t: 'Получать штрафы и отзывы в Telegram', done: !!(st && st.ok && st.telegram === 'connected'), tg: true, btn: 'Подключить' },
        ];
        draw();
    }

    function planInfo() {
        var sp = S.space;
        if (!sp || !sp.plan_until) return null;
        var ms = new Date(sp.plan_until).getTime() - Date.now();
        return { ms: ms, text: left(ms) };
    }

    function draw() {
        if (isViewer()) { if (S.el) { S.el.remove(); S.el = null; } return; }
        var info = planInfo(), steps = S.steps || [];
        var doneN = steps.filter(function (s) { return s.done; }).length, all = doneN === steps.length;
        var showTrial = info && info.ms < 3 * 86400000;
        if (!info || (all && !showTrial)) { if (S.el) { S.el.remove(); S.el = null; } return; }
        if (!S.el) { S.el = doc.createElement('div'); S.el.className = 'nx'; doc.body.appendChild(S.el); S.el.addEventListener('click', onClick); }
        var expired = info.ms <= 0;
        var strip = showTrial
            ? '<div class="nx-trial' + (expired ? ' off' : '') + '"><div><b>' + (expired ? 'Пробный доступ закончился' : 'Фулл-доступ: осталось ' + info.text) + '</b><small>' + (expired ? 'Продлите, чтобы данные и отчёты продолжили работать' : 'Дальше доступ по тарифу') + '</small></div><button type="button" data-act="plans">' + (expired ? 'Продлить' : 'Тарифы') + '</button></div>'
            : '';
        var list = steps.map(function (s) {
            var btn = !s.done && (s.go || s.tg) ? '<button type="button" class="nx-b" ' + (s.go ? 'data-go="' + s.go + '"' : 'data-act="tg"') + '>' + s.btn + '</button>' : '';
            return '<div class="nx-s' + (s.done ? ' ok' : '') + '"><i>' + (s.done ? '✓' : '') + '</i><span>' + s.t + (s.hint && !s.done ? '<small>' + s.hint + '</small>' : '') + '</span>' + btn + '</div>';
        }).join('');
        var pill = (showTrial ? (expired ? 'Продлить доступ' : 'Осталось ' + info.text) : 'Старт ' + doneN + '/' + steps.length);
        S.el.innerHTML = S.open
            ? '<div class="nx-card"><div class="nx-h"><b>Старт · ' + doneN + ' из ' + steps.length + '</b><button type="button" class="nx-x" data-act="min" aria-label="Свернуть">×</button></div>' +
              '<div class="nx-bar"><i style="width:' + Math.round(doneN / steps.length * 100) + '%"></i></div>' + strip + (all ? '' : list) + '</div>'
            : '<button type="button" class="nx-pill' + (expired ? ' off' : '') + '" data-act="max">' + pill + '</button>';
    }

    function onClick(e) {
        var t = e.target.closest('[data-act],[data-go]');
        if (!t) return;
        var act = t.getAttribute('data-act'), go = t.getAttribute('data-go');
        if (go) { if (root.showTab) root.showTab(go); return; }
        if (act === 'min') { S.open = false; lsSet('nr_next_min', '1'); draw(); }
        else if (act === 'max') { S.open = true; lsSet('nr_next_min', '0'); draw(); }
        else if (act === 'plans') { if (root.showTab) root.showTab('tariffs'); }
        else if (act === 'tg') connectTelegram(t);
    }

    async function connectTelegram(btn) {
        btn.disabled = true; btn.textContent = 'Открываем…';
        var out = await api('akylai-status', { action: 'link' });
        if (out && out.ok && out.url) {
            root.open(out.url, '_blank', 'noopener');
            btn.textContent = 'Жду Start в Telegram';
            var until = Date.now() + 150000;
            clearInterval(S.poll);
            S.poll = setInterval(async function () {
                var st = await api('akylai-status', { action: 'state' });
                if (st && st.ok && st.telegram === 'connected') { clearInterval(S.poll); load(); }
                else if (Date.now() > until) { clearInterval(S.poll); btn.disabled = false; btn.textContent = 'Подключить'; }
            }, 4000);
        } else { btn.disabled = false; btn.textContent = 'Подключить'; }
    }

    // шаг «Посмотреть РНП» отмечается, когда клиент открыл вкладку РНП
    function watchTabs() {
        var o = root.showTab;
        if (typeof o !== 'function' || o._nx) return;
        root.showTab = function (tab) {
            if (tab === 'rnp' && lsGet('nr_seen_rnp') !== '1') {
                lsSet('nr_seen_rnp', '1');
                if (S.steps) { S.steps.forEach(function (s) { if (s.id === 'rnp') s.done = true; }); draw(); }
            }
            return o.apply(this, arguments);
        };
        root.showTab._nx = true;
    }

    function init(db, userId, cabinetId) {
        if (!db || !userId || !cabinetId || isViewer()) return;
        if (S.started && S.cab === cabinetId) return;
        S.db = db; S.userId = userId; S.cab = cabinetId; S.started = true;
        S.open = lsGet('nr_next_min') !== '1';
        watchTabs();
        if (lsGet('nr_active_tab') === 'rnp') lsSet('nr_seen_rnp', '1');
        load();
        clearInterval(S.timer);
        S.timer = setInterval(function () { if (!doc.hidden) { if (S.steps && S.steps.some(function (s) { return !s.done; })) load(); else draw(); } }, 90000);
    }
    // Одноразовое окно «Вам открыт фулл-доступ»: когда команда включила пробный доступ, клиент видит это сразу.
    var noticed = false;
    async function notice(db, userId) {
        if (noticed || !db || !userId || isViewer()) return;
        noticed = true;
        var sp = null;
        try { var r = await db.from('spaces').select('status, plan_until').eq('user_id', userId).maybeSingle(); sp = r && r.data; } catch (e) {}
        if (!sp || sp.status !== 'active' || !sp.plan_until) return;
        var ms = new Date(sp.plan_until).getTime() - Date.now();
        if (ms <= 0 || ms > 3 * 86400000) return;
        var key = 'nr_trial_notice_' + sp.plan_until;
        if (lsGet(key)) return;
        var show = function () {
            if (doc.querySelector('.nw-ov')) return setTimeout(show, 3000);
            lsSet(key, '1');
            var until = new Date(sp.plan_until), pad = function (n) { return String(n).padStart(2, '0'); };
            var when = pad(until.getDate()) + '.' + pad(until.getMonth() + 1) + ' в ' + pad(until.getHours()) + ':' + pad(until.getMinutes());
            var el = doc.createElement('div');
            el.className = 'nx-ov';
            el.innerHTML = '<div class="nx-modal nr-win" role="dialog" aria-modal="true"><div class="nx-ic">🎁</div><h3>Вам открыт полный доступ</h3>' +
                '<p>Команда NR подключила вам полный доступ на ' + Math.max(1, Math.ceil(ms / 3600000)) + ' ч, до ' + when + '. Всё открыто: РНП, Дашборд, А/Б тесты, реклама и Акылай.</p>' +
                '<p class="nx-sm">После этого, чтобы продолжить, нужно выбрать тариф. Данные магазина сохранятся.</p><button type="button" class="nx-go">Понятно</button></div>';
            doc.body.appendChild(el);
            var close = function () { el.remove(); };
            el.querySelector('.nx-go').onclick = close;
            el.addEventListener('click', function (e) { if (e.target === el) close(); });
        };
        show();
    }
    root.NrNext = { init: init, notice: notice, _left: left };
})(typeof window !== 'undefined' ? window : globalThis);

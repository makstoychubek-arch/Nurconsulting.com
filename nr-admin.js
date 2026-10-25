/* Страница супер-админа NR Space: «Требует внимания», кабинеты, сотрудники, Telegram и боты, система.
 * Открывается оранжевой плашкой «Space» у логотипа, только для супер-админа, только на компьютере.
 * Данные: RPC admin_overview (кабинеты, размер данных, синхронизация, доступы, сотрудники),
 * функция telegram-admin (боты), таблица admin_map_nodes (расписание и задачи).
 * Подключение: NrAdmin.init({ supabase, isSuperAdmin: () => boolean }). */
(function (root) {
    'use strict';
    var doc = root.document;
    var sb = null, isSuper = function () { return false; };
    var OPEN_KEY = 'nr_admin_open', CACHE_KEY = 'nr_admin_cache_v1';
    var PLAN_DB = 8 * 1024 * 1024 * 1024; // 8 ГБ на тарифе Pro
    var el = null;
    var S = { sec: 'home', q: '', open: {}, ov: null, bots: null, botsErr: '', jobs: null, busy: {}, toast: '', al: null, audit: null, site: null, feat: {}, users: null, uopen: {}, supers: null };

    var NAV = [
        ['home', 'Главная'], ['acc', 'Консалтинг'], ['users', 'Пользователи сайта'], ['staff', 'Сотрудники консалтинга'],
        ['tg', 'Telegram и боты'], ['sys', 'Система и задачи'], ['alr', 'Оповещения'], ['log', 'Журнал'], ['own', 'Спейс владельца'],
    ];
    var FEATURE_LABEL = { reviews: 'Ответы на отзывы', sync: 'Автосинхронизация', ads: 'РК и автоставки', ab_rotation: 'Ротация А/Б', rnp_morning: 'Утренний РНП', order_alerts: 'Уведомления о заказах' };

    function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function mb(bytes) {
        var b = Number(bytes) || 0;
        if (b < 1024 * 1024) return Math.max(0.1, b / 1024 / 1024).toFixed(1).replace('.', ',') + ' МБ';
        if (b < 1024 * 1024 * 1024) return Math.round(b / 1024 / 1024).toLocaleString('ru-RU') + ' МБ';
        return (b / 1024 / 1024 / 1024).toFixed(1).replace('.', ',') + ' ГБ';
    }
    function ago(iso) {
        if (!iso) return 'нет данных';
        var s = (Date.now() - new Date(iso).getTime()) / 1000;
        if (s < 90) return 'только что';
        if (s < 3600) return Math.round(s / 60) + ' мин назад';
        if (s < 86400) return Math.round(s / 3600) + ' ч назад';
        return Math.round(s / 86400) + ' дн назад';
    }
    function initials(s) { var t = String(s || '?').replace(/@.*/, '').trim(); return (t.slice(0, 2) || '?').toUpperCase(); }
    var COLORS = ['#4f46e5', '#e11d74', '#0e9f6e', '#d97706', '#0891b2', '#9333ea'];
    function colorOf(s) { var h = 0; String(s || '').split('').forEach(function (c) { h = (h * 31 + c.charCodeAt(0)) >>> 0; }); return COLORS[h % COLORS.length]; }

    /* ---------- состояние кабинета ---------- */
    function cabDots(c) {
        var syncBad = !!c.sync_error && (!c.last_sync || new Date(c.sync_error_at || 0) >= new Date(c.last_sync || 0));
        var featBad = (c.features || []).some(function (f) { return f.status === 'error' && f.enabled !== false; });
        var stale = !c.last_sync || (Date.now() - new Date(c.last_sync).getTime()) > 36 * 3600 * 1000;
        return [
            ['sd' + (c.has_wb ? (syncBad || stale ? ' bd' : '') : ' wn'), 'Синхронизация: ' + (c.has_wb ? ago(c.last_sync) : 'нет токена WB')],
            ['sd' + (c.adv_ok === false ? ' wn' : ''), c.adv_ok === false ? 'Токен рекламы не принят' : 'Токен рекламы в порядке'],
            ['sd' + (featBad ? ' bd' : ''), featBad ? 'Есть ошибки в функциях кабинета' : 'Функции кабинета работают'],
        ];
    }
    function attention() {
        var a = [];
        if (S.ov) {
            S.ov.cabinets.forEach(function (c) {
                if (!c.has_wb) a.push({ d: 'wn', t: c.name + ': не подключён токен WB', s: 'Данные не собираются, пока клиент не подключит токен.', go: 'acc', open: c.id });
                else if (c.sync_error) a.push({ d: 'bd', t: c.name + ': синхронизация с ошибкой', s: String(c.sync_error).slice(0, 140), go: 'acc', open: c.id });
                else if (!c.last_sync || Date.now() - new Date(c.last_sync).getTime() > 36 * 3600 * 1000) a.push({ d: 'wn', t: c.name + ': давно нет синхронизации', s: 'Последняя удачная: ' + ago(c.last_sync) + '.', go: 'acc', open: c.id });
                if (c.adv_ok === false) a.push({ d: 'wn', t: c.name + ': токен рекламы не принят', s: 'Реклама по этому кабинету не обновляется. Нужен новый токен.', go: 'acc', open: c.id });
                (c.features || []).forEach(function (f) { if (f.status === 'error' && f.enabled !== false) a.push({ d: 'wn', t: c.name + ': «' + (FEATURE_LABEL[f.feature] || f.feature) + '» с ошибкой', s: String(f.error || 'без описания').slice(0, 140), go: 'acc', open: c.id }); });
            });
            if (S.ov.db_bytes / PLAN_DB > 0.8) a.push({ d: 'bd', t: 'База заполнена больше чем на 80%', s: mb(S.ov.db_bytes) + ' из ' + mb(PLAN_DB) + '.', go: 'home' });
        }
        var pend = (S.users || []).filter(function (u) { return u.status === 'pending'; }).length;
        if (pend) a.push({ d: 'wn', t: 'Ждут одобрения: ' + pend, s: 'Новые пользователи, которых ещё не пустили на сайт.', go: 'users' });
        (S.bots || []).forEach(function (b) {
            if (b.status === 'offline' || b.status === 'no_token') a.push({ d: 'bd', t: 'Бот «' + (b.title || b.id) + '»: ' + (b.status === 'no_token' ? 'нет токена' : 'не на связи'), s: 'Сообщения через этого бота не отправляются.', go: 'tg', act: ['hook', b.id, 'Переподключить'] });
        });
        (S.jobs || []).forEach(function (j) { if (j.status === 'bad') a.push({ d: 'bd', t: 'Задача «' + j.title + '» упала', s: (j.meta && (j.meta.lastMessage || j.meta.lastStatus)) || 'Последний запуск завершился ошибкой.', go: 'sys' }); });
        return a;
    }
    function sectionDot(sec, att) {
        var bad = att.filter(function (x) { return x.go === sec && x.d === 'bd'; }).length, wn = att.filter(function (x) { return x.go === sec && x.d === 'wn'; }).length;
        if (sec === 'home') return att.some(function (x) { return x.d === 'bd'; }) ? 'bd' : att.length ? 'wn' : '';
        return bad ? 'bd' : wn ? 'wn' : '';
    }

    /* ---------- отрисовка ---------- */
    function ring(p, cls, label) { return '<span class="nra-ring ' + (cls || '') + '" style="--p:' + Math.max(0, Math.min(100, p)) + '" data-v="' + label + '"></span>'; }
    function resources() {
        var db = S.ov ? S.ov.db_bytes : 0, pct = Math.round(db / PLAN_DB * 100);
        var h = '<div class="nra-res">';
        h += '<div class="nra-r">' + ring(pct, pct > 80 ? 'bd' : pct > 60 ? 'wn' : '', S.ov ? pct + '%' : '…') + '<span>Supabase база</span><b>' + (S.ov ? mb(db) : '…') + '</b></div>';
        ['Vercel', 'ИИ-токены', 'GitHub'].forEach(function (n) { h += '<div class="nra-r off" title="Подключим позже">' + ring(0, '', '—') + '<span>' + n + '</span><b>скоро</b></div>'; });
        return h + '</div>';
    }
    function homeH(att) {
        var h = '<div class="nra-h">Нужно внимание: ' + att.length + '</div><p class="nra-sub">Только то, что требует действия. Остальное работает.</p>';
        if (!S.ov) return h + '<div class="nra-card"><div class="nra-skel"></div></div>';
        if (att.length) {
            h += '<div class="nra-card">' + att.map(function (a, i) {
                return '<div class="nra-att"><span class="sd ' + a.d + '"></span><div class="t"><b>' + esc(a.t) + '</b><small>' + esc(a.s) + '</small></div>' +
                    (a.go && a.go !== 'home' ? '<button class="nra-btn" type="button" data-go="' + a.go + '"' + (a.open ? ' data-open="' + esc(a.open) + '"' : '') + '>Открыть</button>' : '') +
                    (a.act ? '<button class="nra-btn p" type="button" data-hook="' + esc(a.act[1]) + '">' + a.act[2] + '</button>' : '') + '</div>';
            }).join('') + '</div>';
        } else h += '<div class="nra-ok"><span class="sd"></span>Всё в порядке. Проблем не найдено.</div>';
        h += '<div class="nra-card nra-kv"><div><b>' + S.ov.cabinets.length + '</b><small>кабинетов</small></div><div><b>' + S.ov.staff.length + '</b><small>сотрудников</small></div><div><b>' + mb(S.ov.db_bytes) + '</b><small>данные в базе</small></div></div>';
        if (S.audit && S.audit.length) h += '<div class="nra-h" style="font-size:15px;margin-top:6px">Последние действия</div><div class="nra-card">' + S.audit.slice(0, 5).map(function (a) { return '<div class="nra-att"><span class="sd off"></span><div class="t"><b>' + esc(ACTION[a.action] || a.action) + (a.target ? ': ' + esc(a.target) : '') + '</b><small>' + esc(a.actor_email || '') + ' · ' + ago(a.at) + '</small></div></div>'; }).join('') + '</div>';
        return h;
    }
    function ownersOf(c) { return S.ov.viewers.filter(function (v) { return v.cabinet_id === c.id; }); }

    var BOTFEAT = [
        ['reviews', 'Акылай', 'отзывы и вопросы', '#4f46e5'], ['order_alerts', 'Амина', 'продажи и заказы', '#e11d74'],
        ['ads', 'Манас', 'реклама', '#0e9f6e'], ['ab_rotation', 'Карина', 'А/Б тесты', '#d97706'],
    ];
    function featH(c) {
        var st = S.feat[c.id], h = '<h5>Боты кабинета</h5>';
        if (st === 'err') return h + '<p class="m">Не удалось получить состояние. <a href="#" data-featreload="' + c.id + '">Повторить</a></p>';
        if (!st) return h + '<div class="nra-skel" style="height:60px;border-radius:10px"></div>';
        var by = {}; st.forEach(function (f) { by[f.feature] = f; });
        return h + '<div class="nra-bots">' + BOTFEAT.map(function (b) {
            var f = by[b[0]] || { enabled: true, active: true };
            var busy = S.busy['f' + c.id + b[0]];
            var text = f.paused_until ? 'пауза до ' + new Date(f.paused_until).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : f.active ? 'работает' : 'выключен';
            var warn = f.active && f.blockers && f.blockers.length ? '<small class="bad">' + esc(f.blockers[0].text) + '</small>' : '';
            return '<div class="nra-bot"><i class="av" style="background:' + b[3] + '">' + b[1][0] + '</i><div class="t"><b>' + b[1] + '</b><small>' + b[2] + ' · ' + text + '</small>' + warn + '</div>' +
                (f.active ? '<select class="nra-sel" data-fp="' + c.id + '|' + b[0] + '" aria-label="Пауза"><option value="">Пауза…</option><option value="60">на 1 час</option><option value="360">на 6 часов</option><option value="1440">на сутки</option></select>' : '') +
                '<button type="button" class="nra-sw' + (f.active ? ' on' : '') + '" data-ft="' + c.id + '|' + b[0] + '" aria-pressed="' + (!!f.active) + '"' + (busy ? ' disabled' : '') + ' aria-label="Включить или выключить"></button></div>';
        }).join('') + '</div>';
    }
    function loadFeat(id) {
        sb.functions.invoke('cabinet-features', { body: { action: 'state', cabinet_id: id } }).then(function (r) {
            S.feat[id] = r.error || !(r.data && r.data.ok) ? 'err' : r.data.features; render();
        });
    }
    function setFeat(id, feature, action, minutes) {
        var list = S.feat[id]; if (!Array.isArray(list)) return;
        var f = list.filter(function (x) { return x.feature === feature; })[0]; if (!f) return;
        var prev = JSON.parse(JSON.stringify(f));
        if (action === 'pause') { f.paused_until = new Date(Date.now() + minutes * 60000).toISOString(); f.enabled = true; f.active = false; }
        else if (action === 'resume') { f.paused_until = null; f.enabled = true; f.active = true; }
        else { f.enabled = false; f.active = false; f.paused_until = null; }
        S.busy['f' + id + feature] = true; render();
        var body = { cabinet_id: id, feature: feature };
        if (action === 'off') { body.action = 'set'; body.enabled = false; } else { body.action = action; if (minutes) body.minutes = minutes; }
        sb.functions.invoke('cabinet-features', { body: body }).then(function (r) {
            S.busy['f' + id + feature] = false;
            if (r.error || !(r.data && r.data.ok)) { Object.assign(f, prev); S.toast = 'Не получилось изменить. Попробуй ещё раз.'; setTimeout(function () { S.toast = ''; render(); }, 4000); }
            else {
                S.feat[id] = r.data.features;
                var cab = S.ov && S.ov.cabinets.filter(function (x) { return x.id === id; })[0];
                sb.rpc('admin_log', { p_action: 'feature_' + action, p_target: cab ? cab.name : id, p_detail: feature + (minutes ? ' на ' + minutes + ' мин' : '') }).then(function () {});
            }
            render();
        });
    }

    /* Владелец кабинета: по Google-почте. Человек заходит на сайт, и доступ определяется сам. */
    function ownerH(c, v) {
        var owners = v.filter(function (x) { return x.role === 'owner'; }), viewers = v.filter(function (x) { return x.role !== 'owner'; });
        var inv = ((S.ov && S.ov.invites) || []).filter(function (x) { return x.cabinet_id === c.id; });
        function chip(email, note, pending) {
            return '<div class="nra-who"><i class="av" style="background:' + colorOf(email) + '">' + initials(email) + '</i><span>' + esc(email) + '</span><small>' + note + '</small>' +
                '<button type="button" class="nra-x" data-unown="' + c.id + '|' + esc(email) + '" title="' + (pending ? 'Отменить приглашение' : 'Снять владельца') + '" aria-label="Убрать">×</button></div>';
        }
        var h = '<h5>Владелец кабинета</h5>';
        h += owners.map(function (x) { return chip(x.email, 'владелец · ' + ago(x.created_at), false); }).join('');
        h += inv.map(function (x) { return chip(x.email, 'ждёт первого входа', true); }).join('');
        if (!owners.length && !inv.length) h += '<p class="m" style="margin:0 0 8px">Не назначен.</p>';
        h += '<div class="nra-own"><input type="email" id="nra-own-' + c.id + '" placeholder="Google-почта владельца" autocomplete="off"><button type="button" class="nra-btn p" data-own="' + c.id + '"' + (S.busy['o' + c.id] ? ' disabled' : '') + '>Назначить</button></div>' +
            '<p class="m" style="margin:6px 0 0">Когда человек зайдёт на сайт под этой почтой, он сам увидит этот кабинет (только просмотр).</p>';
        if (viewers.length) h += '<h5>Доступ на просмотр</h5>' + viewers.map(function (x) { return '<div class="nra-who"><i class="av" style="background:' + colorOf(x.email) + '">' + initials(x.email) + '</i><span>' + esc(x.email) + '</span><small>просмотр · ' + ago(x.created_at) + '</small></div>'; }).join('');
        h += '<h5>Пользователи (до 5)</h5><button type="button" class="nra-btn" data-acc="' + c.id + '|' + esc(c.name) + '">Управлять пользователями</button>';
        return h;
    }
    function toast(t) { S.toast = t; render(); setTimeout(function () { S.toast = ''; render(); }, 4500); }
    function assignOwner(id) {
        var inp = el.querySelector('#nra-own-' + id), mail = inp ? String(inp.value).trim().toLowerCase() : '';
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) { toast('Введи почту целиком, например name@gmail.com'); return; }
        if (S.busy['o' + id]) return;
        S.busy['o' + id] = true;
        var inv = S.ov.invites || (S.ov.invites = []);
        var temp = { cabinet_id: id, email: mail, role: 'owner', created_at: new Date().toISOString(), _tmp: true };
        inv.push(temp); render();
        sb.rpc('admin_assign_owner', { p_cabinet: id, p_email: mail }).then(function (r) {
            S.busy['o' + id] = false;
            if (r.error) {
                S.ov.invites = S.ov.invites.filter(function (x) { return x !== temp; });
                toast(String(r.error.message || '').indexOf('forbidden') > -1 ? 'Нужны права владельца.' : 'Не получилось назначить. Проверь почту и попробуй ещё раз.'); return;
            }
            toast(r.data && r.data.status === 'assigned' ? 'Назначен: аккаунт уже есть, кабинет у него открыт.' : 'Приглашение сохранено: кабинет откроется при первом входе.');
            load();
        });
    }
    function unassignOwner(id, mail) {
        if (S.ov) { S.ov.invites = (S.ov.invites || []).filter(function (x) { return !(x.cabinet_id === id && x.email === mail); }); S.ov.viewers = S.ov.viewers.filter(function (x) { return !(x.cabinet_id === id && String(x.email).toLowerCase() === mail && x.role === 'owner'); }); render(); }
        sb.rpc('admin_unassign_owner', { p_cabinet: id, p_email: mail }).then(function (r) {
            if (r.error) toast('Не получилось снять. Попробуй ещё раз.'); else toast('Владелец снят.');
            load();
        });
    }
    function teamEmails() {
        var t = {}; t[ROOT] = 1;
        ((S.ov && S.ov.staff) || []).forEach(function (p) { t[String(p.email).toLowerCase()] = 1; });
        return t;
    }
    function isTeamCab(c) { var t = teamEmails(); return !!c.nr_managed || !!t[String(c.owner_email || '').toLowerCase()]; }
    function accH() {
        if (!S.ov) return '<div class="nra-card"><div class="nra-skel"></div></div>';
        var q = S.q.toLowerCase();
        var rows = S.ov.cabinets.filter(function (c) { return isTeamCab(c) && (!q || String(c.name).toLowerCase().indexOf(q) > -1 || String(c.owner_email || '').toLowerCase().indexOf(q) > -1); });
        var h = '<div class="nra-h">Консалтинг</div><p class="nra-sub">' + rows.length + ' кабинетов, которые ведёт команда. Кабинеты клиентов смотри в «Пользователях сайта», там кнопка «В консалтинг». Нажми на кабинет, чтобы раскрыть подробности.</p><table class="nra-t"><tr><th>Кабинет</th><th>Владелец аккаунта</th><th>Данные</th><th>Артикулов</th><th>Синхронизация</th><th>Статус</th><th>Доступ</th></tr>';
        rows.forEach(function (c) {
            var v = ownersOf(c);
            h += '<tr class="r" data-cab="' + c.id + '"><td><b>' + esc(c.name) + '</b></td><td>' + esc(c.owner_email || '—') + '</td><td>' + mb(c.daily_bytes) + '</td><td>' + c.articles + '</td><td>' + ago(c.last_sync) + '</td><td><span class="dots">' + cabDots(c).map(function (d) { return '<i class="' + d[0] + '" title="' + esc(d[1]) + '"></i>'; }).join('') + '</span></td><td><span class="avs">' + (v.length ? v.slice(0, 4).map(function (x) { return '<i class="av" style="background:' + colorOf(x.email) + '" title="' + esc(x.email) + ' · просмотр">' + initials(x.email) + '</i>'; }).join('') : '<span class="m">только мы</span>') + '</span></td></tr>';
            if (S.open[c.id]) {
                h += '<tr class="d"><td colspan="7"><div class="nra-det"><div><div class="nra-kv"><div><b>' + mb(c.daily_bytes) + '</b><small>дневные данные (' + (c.daily_rows || 0).toLocaleString('ru-RU') + ' строк)</small></div><div><b>' + c.articles + '</b><small>артикулов</small></div><div><b>' + ago(c.last_sync) + '</b><small>последняя синхронизация</small></div></div>' +
                    featH(c) + '</div>' +
                    '<div>' + ownerH(c, v) +
                    '<div class="nra-acts"><button class="nra-btn" type="button" data-openc="' + c.id + '">Открыть кабинет</button></div></div></div></td></tr>';
            }
        });
        return h + '</table>';
    }

    function userCabs(u) {
        var out = [];
        if (!S.ov) return out;
        S.ov.cabinets.forEach(function (c) { if (c.user_id === u.user_id) out.push({ c: c, rel: 'владелец аккаунта' }); });
        S.ov.viewers.forEach(function (v) {
            if (v.user_id !== u.user_id) return;
            var c = S.ov.cabinets.filter(function (x) { return x.id === v.cabinet_id; })[0];
            if (c && !out.some(function (o) { return o.c.id === c.id; })) out.push({ c: c, rel: v.role === 'owner' ? 'владелец кабинета' : 'просмотр' });
        });
        return out;
    }
    var STATUS = { active: ['ok', 'активен'], pending: ['wn', 'ждёт одобрения'], blocked: ['bd', 'заблокирован'] };
    function usersH() {
        var h = '<div class="nra-h">Пользователи сайта</div>';
        if (!S.users || !S.ov) return h + '<div class="nra-card"><div class="nra-skel"></div></div>';
        var q = S.q.toLowerCase(), staff = {};
        S.ov.staff.forEach(function (p) { staff[String(p.email).toLowerCase()] = 1; });
        var rows = S.users.filter(function (u) { return !q || String(u.email || '').toLowerCase().indexOf(q) > -1 || String(u.full_name || '').toLowerCase().indexOf(q) > -1; });
        h += '<p class="nra-sub">' + rows.length + ' из ' + S.users.length + ' человек. Нажми на человека, чтобы увидеть его кабинеты и нагрузку.</p><table class="nra-t"><tr><th>Пользователь</th><th>Статус</th><th>Тариф</th><th>Кабинеты</th><th>Последний вход</th><th>Регистрация</th></tr>';
        rows.forEach(function (u) {
            var cabs = userCabs(u), st = STATUS[u.status] || ['off', u.status], name = u.full_name && String(u.full_name).trim() ? u.full_name : String(u.email || '').replace(/@.*/, '');
            h += '<tr class="r" data-user="' + esc(u.user_id) + '"><td><span class="who"><i class="av" style="background:' + colorOf(u.email) + '">' + initials(name) + '</i><span><b>' + esc(name) + '</b>' + (staff[String(u.email).toLowerCase()] ? ' <span class="nra-chip ok"><i></i>команда</span>' : '') + '<br><small class="m">' + esc(u.email) + '</small></span></span></td>' +
                '<td><span class="nra-chip ' + st[0] + '"><i></i>' + st[1] + '</span></td><td>' + esc(u.tariff_plan || '—') + '</td>' +
                '<td>' + (cabs.length ? cabs.slice(0, 3).map(function (x) { return '<span class="nra-chip off">' + esc(x.c.name) + '</span>'; }).join(' ') + (cabs.length > 3 ? ' +' + (cabs.length - 3) : '') : '<span class="m">нет</span>') + '</td>' +
                '<td>' + ago(u.last_sign_in_at) + '</td><td>' + (u.created_at ? new Date(u.created_at).toLocaleDateString('ru-RU') : '—') + '</td></tr>';
            if (S.uopen[u.user_id]) {
                h += '<tr class="d"><td colspan="6">' + (cabs.length ? '<div class="nra-ucabs">' + cabs.map(function (x) {
                    var c = x.c;
                    return '<div class="nra-ucab"><div class="t"><b>' + esc(c.name) + '</b><small>' + x.rel + '</small></div><div class="nra-kv"><div><b>' + mb(c.daily_bytes) + '</b><small>данные</small></div><div><b>' + c.articles + '</b><small>артикулов</small></div><div><b>' + ago(c.last_sync) + '</b><small>синхронизация</small></div></div>' +
                        '<span class="dots">' + cabDots(c).map(function (d) { return '<i class="' + d[0] + '" title="' + esc(d[1]) + '"></i>'; }).join('') + '</span>' + (isTeamCab(c) ? '<span class="nra-chip ok"><i></i>в консалтинге</span>' : '<button type="button" class="nra-btn p" data-tocons="' + c.id + '">' + (S.confirm === c.id ? 'Подтвердить' : 'В консалтинг') + '</button>') + '<button type="button" class="nra-btn" data-openc="' + c.id + '">Открыть</button></div>';
                }).join('') + '</div>' : '<p class="m">У этого человека нет подключённых кабинетов.</p>') + '</td></tr>';
            }
        });
        return h + '</table>';
    }
    var ROOT = 'global.pro.1004@gmail.com';
    function superH() {
        var list = (S.supers || []).filter(function (x) { return String(x.email).toLowerCase() !== ROOT; });
        var h = '<div class="nra-h">Суперадмины</div><p class="nra-sub">Те, кто видит эту админку и все кабинеты. Назначить можно только того, кто уже заходил на сайт.</p><div class="nra-card">';
        function row(mail, note, canX) {
            return '<div class="nra-who"><i class="av" style="background:' + colorOf(mail) + '">' + initials(mail) + '</i><span>' + esc(mail) + '</span><small>' + note + '</small>' + (canX ? '<button type="button" class="nra-x" data-unsuper="' + esc(mail) + '" title="Снять суперадмина">×</button>' : '') + '</div>';
        }
        h += row(ROOT, 'владелец, снять нельзя', false);
        h += list.map(function (x) { return row(String(x.email), 'суперадмин', true); }).join('');
        h += '<div class="nra-own"><input type="email" id="nra-super" placeholder="Google-почта нового суперадмина" autocomplete="off"><button type="button" class="nra-btn p" data-super="1">Назначить</button></div></div>';
        return h;
    }
    function moveToCons(id) {
        var c = S.ov && S.ov.cabinets.filter(function (x) { return x.id === id; })[0];
        if (!c || S.busy['m' + id]) return;
        if (S.confirm !== id) { S.confirm = id; toast('Нажми «Подтвердить»: кабинет перейдёт к команде, а клиент станет его владельцем в режиме просмотра.'); render(); return; }
        S.confirm = null; S.busy['m' + id] = true;
        var was = c.owner_email, wasId = c.user_id;
        c.owner_email = ROOT; c.nr_managed = true; render();
        sb.rpc('admin_move_to_consulting', { p_cabinet: id }).then(function (r) {
            S.busy['m' + id] = false;
            if (r.error) { c.owner_email = was; c.user_id = wasId; c.nr_managed = false; toast(String(r.error.message || '').indexOf('already') > -1 ? 'Кабинет уже у команды.' : 'Не получилось перенести. Повтори.'); render(); return; }
            toast('Кабинет в консалтинге. Клиент стал владельцем и видит его в режиме просмотра.');
            load();
        });
    }
    function setSuper(mail, on) {
        if (S.busy.super) return;
        S.busy.super = true;
        var prev = S.supers;
        S.supers = (S.supers || []).filter(function (x) { return String(x.email).toLowerCase() !== mail; });
        if (on) S.supers.push({ email: mail });
        render();
        sb.rpc('admin_set_super_admin', { p_email: mail, p_on: on }).then(function (r) {
            S.busy.super = false;
            if (r.error) {
                S.supers = prev;
                var m = String(r.error.message || '');
                toast(m.indexOf('no_user') > -1 ? 'Этот человек ещё не заходил на сайт. Пусть сначала войдёт под этой почтой.' : m.indexOf('self') > -1 ? 'Себя снять нельзя.' : m.indexOf('root') > -1 ? 'Владельца снять нельзя.' : m.indexOf('bad_email') > -1 ? 'Проверь почту.' : 'Не получилось. Повтори.');
                return;
            }
            toast(on ? 'Суперадмин назначен.' : 'Суперадмин снят.');
            load();
        });
    }
    function staffH() {
        if (!S.ov) return '<div class="nra-card"><div class="nra-skel"></div></div>';
        return superH() + '<div class="nra-h">Сотрудники консалтинга</div><p class="nra-sub">' + S.ov.staff.length + ' человек в команде. Роли и права по ролям добавим следующим шагом.</p><table class="nra-t"><tr><th>Сотрудник</th><th>Заметка</th><th>Последний вход</th><th>В команде с</th></tr>' +
            S.ov.staff.map(function (p) { return '<tr><td><span class="who"><i class="av" style="background:' + colorOf(p.email) + '">' + initials(p.email) + '</i><b>' + esc(p.email) + '</b></span></td><td>' + esc(p.note || '—') + '</td><td>' + ago(p.last_sign_in) + '</td><td>' + new Date(p.created_at).toLocaleDateString('ru-RU') + '</td></tr>'; }).join('') + '</table>';
    }
    function tgH() {
        var h = '<div class="nra-h">Telegram и боты</div><p class="nra-sub">Состояние ботов команды. «Переподключить» заново регистрирует адрес приёма сообщений.</p>';
        if (S.botsErr) return h + '<div class="nra-card"><div class="nra-att"><span class="sd wn"></span><div class="t"><b>Не удалось получить список ботов</b><small>' + esc(S.botsErr) + '</small></div><button class="nra-btn" type="button" data-reload="1">Повторить</button></div></div>';
        if (!S.bots) return h + '<div class="nra-card"><div class="nra-skel"></div></div>';
        var L = { online: ['ok', 'на связи'], offline: ['bd', 'не на связи'], no_token: ['bd', 'нет токена'], disabled: ['off', 'выключен'], deleted: ['off', 'удалён'] };
        return h + '<div class="nra-card">' + S.bots.filter(function (b) { return b.status !== 'deleted'; }).map(function (b) {
            var l = L[b.status] || ['off', b.status];
            return '<div class="nra-row"><span class="sd ' + (l[0] === 'ok' ? '' : l[0]) + '"></span><div class="t"><b>' + esc(b.title || b.id) + '</b><small>' + esc(b.live_username ? '@' + b.live_username : b.notes || '') + '</small></div><span class="nra-chip ' + l[0] + '"><i></i>' + l[1] + '</span>' +
                '<button class="nra-btn' + (l[0] === 'bd' ? ' p' : '') + '" type="button" data-hook="' + esc(b.id) + '"' + (S.busy[b.id] ? ' disabled' : '') + '>' + (S.busy[b.id] ? 'Подключаю…' : 'Переподключить') + '</button></div>';
        }).join('') + '</div>';
    }
    function sysH() {
        var h = '<div class="nra-h">Система и задачи</div><p class="nra-sub">Сайт и регулярные задачи по карте системы. Данные задач обновляются при синхронизации карты.</p>' + siteCard();
        if (!S.jobs) return h + '<div class="nra-card"><div class="nra-skel"></div></div>';
        if (!S.jobs.length) return h + '<div class="nra-card"><p class="m" style="padding:16px">Задач в карте системы пока нет.</p></div>';
        return h + '<div class="nra-card">' + S.jobs.map(function (j) {
            var m = j.meta || {};
            return '<div class="nra-row"><span class="sd ' + (j.status === 'bad' ? 'bd' : j.status === 'warn' ? 'wn' : '') + '"></span><div class="t"><b>' + esc(j.title) + '</b><small>' + esc(m.schedule || j.subtitle || '') + '</small></div><span class="m">' + esc(m.lastStatus || '') + '</span></div>';
        }).join('') + '</div>';
    }

    var ALERTS = [
        ['ai_balance', 'Баланс ИИ ниже порога', 'Иначе перестанут приходить ответы на отзывы и вопросы. Остаток вводишь вручную после пополнения.', 'порог, $'],
        ['tokens', 'Токен WB или рекламы не работает', 'По кабинетам команды, сразу как заметили.', ''],
        ['sync', 'Нет синхронизации с WB', 'Если данные давно не обновлялись или была ошибка.', 'часов без данных'],
        ['jobs', 'Упала регулярная задача', 'Синхронизации, штрафы, рекламные рутины.', ''],
        ['bots', 'Telegram-бот не отвечает', 'Бот выключен, без токена или Telegram его не видит.', ''],
        ['db_full', 'База заполнена', 'Чтобы вовремя докупить место на тарифе.', 'порог, %'],
        ['access', 'Изменился доступ к кабинету', 'Каждая выдача или отзыв доступа.', ''],
        ['traffic', 'Кабинет тратит трафик слишком много', 'Появится, когда начнём замерять трафик по кабинетам.', 'раз выше среднего'],
    ];
    function alrH() {
        var h = '<div class="nra-h">Оповещения</div><p class="nra-sub">Сообщения владельцу в Telegram. Проверка идёт каждые 15 минут, одно и то же повторяется не чаще раза в сутки.</p>';
        if (!S.al) return h + '<div class="nra-card"><div class="nra-skel"></div></div>';
        return h + '<div class="nra-card">' + ALERTS.map(function (a) {
            var r = S.al[a[0]] || { enabled: false };
            var th = a[3] ? '<label class="nra-th">' + a[3] + '<input type="number" step="any" data-th="' + a[0] + '" value="' + esc(r.threshold == null ? '' : r.threshold) + '"></label>' : '';
            var val = a[0] === 'ai_balance' ? '<label class="nra-th">остаток сейчас, $<input type="number" step="any" data-val="ai_balance" value="' + esc(r.value == null ? '' : r.value) + '"></label>' + (r.value_at ? '<small class="m">обновлён ' + ago(r.value_at) + '</small>' : '') : '';
            return '<div class="nra-row"><div class="t"><b>' + a[1] + '</b><small>' + a[2] + '</small></div>' + val + th + '<button type="button" class="nra-sw' + (r.enabled ? ' on' : '') + '" data-alr="' + a[0] + '" aria-pressed="' + (!!r.enabled) + '" aria-label="Включить или выключить"></button></div>';
        }).join('') + '</div>';
    }
    var ACTION = {
        access_granted: 'Выдан доступ', super_admin_on: 'Назначен суперадмин', moved_to_consulting: 'Кабинет в консалтинге', super_admin_off: 'Снят суперадмин', access_revoked: 'Доступ отозван', staff_added: 'Добавлен сотрудник', staff_removed: 'Сотрудник убран',
        cabinet_added: 'Кабинет добавлен', cabinet_deleted: 'Кабинет удалён', wb_token_changed: 'Токен WB изменён', adv_token_changed: 'Токен рекламы изменён',
        feature_toggled: 'Функция кабинета', bot_reconnect: 'Бот переподключён',
    };
    function logH() {
        var h = '<div class="nra-h">Журнал действий</div><p class="nra-sub">Кто и что менял: доступы, сотрудники, кабинеты, токены (без значений), функции и боты.</p>';
        if (!S.audit) return h + '<div class="nra-card"><div class="nra-skel"></div></div>';
        if (!S.audit.length) return h + '<div class="nra-card"><p class="m" style="padding:16px">Записей пока нет. Журнал ведётся с момента включения.</p></div>';
        return h + '<div class="nra-card">' + S.audit.map(function (a) {
            return '<div class="nra-row"><span class="m" style="min-width:96px">' + new Date(a.at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + '</span><b style="min-width:130px">' + esc(String(a.actor_email || 'система').replace(/@.*/, '')) + '</b><div class="t"><b>' + esc(ACTION[a.action] || a.action) + (a.target ? ': ' + esc(a.target) : '') + '</b>' + (a.detail ? '<small>' + esc(a.detail) + '</small>' : '') + '</div></div>';
        }).join('') + '</div>';
    }
    function siteCard() {
        if (!S.site) return '';
        var u = S.site.up, e = S.site.errors;
        return '<div class="nra-card nra-kv"><div><b class="' + (u && u.status === 'down' ? 'bad' : '') + '">' + (u ? (u.status === 'down' ? 'не отвечает' : 'работает') : '—') + '</b><small>сайт ' + (u && u.last_checked ? '· проверка ' + ago(u.last_checked) : '') + '</small></div><div><b>' + (e == null ? '—' : e) + '</b><small>ошибок в браузерах за сутки</small></div></div>';
    }
    function saveAlert(key, fields) {
        var row = Object.assign({}, S.al[key] || { enabled: false }, fields);
        S.al[key] = row; render();
        var rec = { key: key, enabled: !!row.enabled, threshold: row.threshold === '' ? null : row.threshold, value: row.value === '' ? null : row.value, updated_at: new Date().toISOString() };
        if (fields.value !== undefined) { row.value_at = rec.value_at = new Date().toISOString(); }
        sb.from('admin_alert_settings').upsert(rec).then(function (r) {
            if (r.error) { S.toast = 'Не сохранилось: ' + (r.error.message || 'ошибка'); render(); setTimeout(function () { S.toast = ''; render(); }, 4000); }
        });
    }
    function soon(title, text) { return '<div class="nra-h">' + title + '</div><p class="nra-sub">' + text + '</p><div class="nra-card"><p class="m" style="padding:18px 16px">Этот раздел подключим на следующем шаге.</p></div>'; }

    function render() {
        if (!el) return;
        var att = attention();
        var body = '';
        if (S.sec === 'home') body = homeH(att);
        else if (S.sec === 'acc') body = accH();
        else if (S.sec === 'users') body = usersH();
        else if (S.sec === 'staff') body = staffH();
        else if (S.sec === 'tg') body = tgH();
        else if (S.sec === 'sys') body = sysH();
        else if (S.sec === 'alr') body = alrH();
        else if (S.sec === 'log') body = logH();
        else if (S.sec === 'own') body = soon('Спейс владельца', 'Здесь будет превью кабинета глазами владельца и подключение его Telegram.');
        var nav = NAV.map(function (n) {
            var d = sectionDot(n[0], att);
            return '<button type="button" data-sec="' + n[0] + '" class="' + (S.sec === n[0] ? 'on' : '') + '">' + n[1] + '<i class="sd ' + d + '"></i></button>';
        }).join('');
        var keep = el.querySelector('.nra-main'), sc = keep ? keep.scrollTop : 0;
        el.innerHTML = '<div class="nra-box"><div class="nra-side"><div class="nra-brand">NR · админ</div>' + nav + '<hr>' + resources() + '</div><div class="nra-main"><div class="nra-top"><div class="nra-search"><input id="nra-q" placeholder="Найти кабинет или владельца" value="' + esc(S.q) + '" autocomplete="off"></div><button class="nra-btn" type="button" data-close="1">Закрыть</button></div>' + body + '</div></div>' + (S.toast ? '<div class="nra-toast">' + esc(S.toast) + '</div>' : '');
        var m = el.querySelector('.nra-main'); if (m && sc) m.scrollTop = sc;
    }

    /* ---------- данные ---------- */
    function readCache() { try { var c = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null'); if (c && c.ov) { S.ov = c.ov; S.jobs = c.jobs || null; } } catch (e) { /* без кэша */ } }
    function writeCache() { try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ov: S.ov, jobs: S.jobs })); } catch (e) { /* ок */ } }
    function load() {
        sb.rpc('admin_overview').then(function (r) {
            if (r.error) { S.toast = 'Не удалось получить сводку: ' + (r.error.message || 'ошибка'); render(); return; }
            S.ov = r.data; writeCache(); render();
        });
        sb.from('admin_map_nodes').select('title,subtitle,status,meta').eq('kind', 'cron').eq('hidden', false).order('title').then(function (r) {
            S.jobs = r.error ? [] : (r.data || []); writeCache(); render();
        });
        sb.from('admin_alert_settings').select('key,enabled,threshold,value,value_at').then(function (r) {
            var m = {}; (r.data || []).forEach(function (x) { m[x.key] = x; }); S.al = m; render();
        });
        sb.from('admin_audit').select('at,actor_email,action,target,detail').order('at', { ascending: false }).limit(100).then(function (r) { S.audit = r.error ? [] : (r.data || []); render(); });
        Promise.all([
            sb.from('site_uptime').select('status,last_checked').eq('id', 1).maybeSingle(),
            sb.from('client_errors').select('count', { count: 'exact', head: false }).gte('last_seen', new Date(Date.now() - 86400000).toISOString()),
        ]).then(function (a) { S.site = { up: a[0].data || null, errors: a[1].error ? null : (a[1].data || []).reduce(function (n, x) { return n + (Number(x.count) || 1); }, 0) }; render(); });
        sb.from('spaces').select('user_id,email,full_name,status,tariff_plan,plan_until,created_at,last_sign_in_at').order('created_at', { ascending: false }).limit(1000).then(function (r) { S.users = r.error ? [] : (r.data || []); render(); });
        sb.from('spaces').select('email,user_id').eq('is_super_admin', true).then(function (r) { S.supers = r.error ? [] : (r.data || []); render(); });
        loadBots();
    }
    function loadBots() {
        sb.functions.invoke('telegram-admin', { body: { action: 'list' } }).then(function (r) {
            if (r.error) { S.botsErr = (r.error.message || 'нет ответа') + (String(r.error.message || '').indexOf('403') > -1 ? '. Нужны права владельца.' : ''); S.bots = null; }
            else { S.bots = (r.data && r.data.bots) || []; S.botsErr = ''; }
            render();
        });
    }
    function reconnect(id) {
        if (!id || S.busy[id]) return;
        S.busy[id] = true; render();
        sb.functions.invoke('telegram-admin', { body: { action: 'set_webhook', bot_id: id } }).then(function (r) {
            S.busy[id] = false;
            var okRe = !r.error && r.data && r.data.ok;
            S.toast = okRe ? 'Бот переподключён.' : 'Не получилось переподключить бота. Попробуй ещё раз.';
            if (okRe) sb.rpc('admin_log', { p_action: 'bot_reconnect', p_target: id, p_detail: null }).then(function () {});
            render(); loadBots();
            setTimeout(function () { S.toast = ''; render(); }, 4000);
        });
    }

    /* ---------- открытие и события ---------- */
    function build() {
        if (el) return;
        el = doc.createElement('div'); el.id = 'nr-admin'; el.className = 'nra';
        el.addEventListener('click', function (e) {
            var t = e.target.closest('[data-user],[data-sec],[data-go],[data-cab],[data-close],[data-hook],[data-openc],[data-reload],[data-alr],[data-ft],[data-featreload],[data-own],[data-unown],[data-acc],[data-super],[data-unsuper],[data-tocons]'); if (!t) return;
            if (t.dataset.user) { S.uopen[t.dataset.user] = !S.uopen[t.dataset.user]; render(); return; }
            if (t.dataset.tocons) { moveToCons(t.dataset.tocons); return; }
            if (t.dataset.super) { var si = el.querySelector('#nra-super'), sm = si ? String(si.value).trim().toLowerCase() : ''; if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(sm)) { toast('Введи почту целиком, например name@gmail.com'); return; } setSuper(sm, true); return; }
            if (t.dataset.unsuper) { setSuper(t.dataset.unsuper, false); return; }
            if (t.dataset.own) { assignOwner(t.dataset.own); return; }
            if (t.dataset.acc) { var ac = t.dataset.acc.split('|'); if (window.NrAccess) window.NrAccess.open(ac[0], ac[1]); return; }
            if (t.dataset.unown) { var uo = t.dataset.unown.split('|'); unassignOwner(uo[0], uo[1]); return; }
            if (t.dataset.ft) { var q = t.dataset.ft.split('|'), lf = S.feat[q[0]], cur = Array.isArray(lf) && lf.filter(function (x) { return x.feature === q[1]; })[0]; if (cur) setFeat(q[0], q[1], cur.active ? 'off' : 'resume'); return; }
            if (t.dataset.featreload) { e.preventDefault(); S.feat[t.dataset.featreload] = null; loadFeat(t.dataset.featreload); render(); return; }
            if (t.dataset.close) return close();
            if (t.dataset.alr) { if (S.al) saveAlert(t.dataset.alr, { enabled: !(S.al[t.dataset.alr] && S.al[t.dataset.alr].enabled) }); return; }
            if (t.dataset.sec) { S.sec = t.dataset.sec; }
            else if (t.dataset.go) { S.sec = t.dataset.go; if (t.dataset.open) { S.open[t.dataset.open] = true; if (!S.feat[t.dataset.open]) loadFeat(t.dataset.open); } }
            else if (t.dataset.cab) { S.open[t.dataset.cab] = !S.open[t.dataset.cab]; if (S.open[t.dataset.cab] && !S.feat[t.dataset.cab]) loadFeat(t.dataset.cab); }
            else if (t.dataset.hook) { reconnect(t.dataset.hook); return; }
            else if (t.dataset.reload) { loadBots(); return; }
            else if (t.dataset.openc) { close(); try { if (root.nrSelectCabinet) root.nrSelectCabinet(t.dataset.openc); if (root.showTab) root.showTab('rnp'); } catch (err) { /* кабинет не открылся */ } return; }
            render();
        });
        el.addEventListener('change', function (e) {
            var d = e.target.dataset || {};
            if (d.fp && e.target.value) { var z = d.fp.split('|'); setFeat(z[0], z[1], 'pause', Number(e.target.value)); return; }
            if (d.th && S.al) saveAlert(d.th, { threshold: e.target.value === '' ? null : Number(e.target.value) });
            else if (d.val && S.al) saveAlert(d.val, { value: e.target.value === '' ? null : Number(e.target.value) });
        });
        el.addEventListener('input', function (e) {
            if (e.target.id !== 'nra-q') return;
            S.q = e.target.value; if (S.sec !== 'acc' && S.sec !== 'users') S.sec = 'acc';
            var pos = e.target.selectionStart; render();
            var i = el.querySelector('#nra-q'); if (i) { i.focus(); i.setSelectionRange(pos, pos); }
        });
        doc.addEventListener('keydown', function (e) {
            if (!el || !el.classList.contains('open')) return;
            if (e.key === 'Escape') close();
            else if (e.key === '/' && doc.activeElement.tagName !== 'INPUT') { var i = el.querySelector('#nra-q'); if (i) { e.preventDefault(); i.focus(); } }
        });
        doc.body.appendChild(el);
    }
    function open() {
        if (!isSuper() || root.innerWidth < 760) return;
        build(); readCache();
        el.classList.add('open'); render();      // сразу виден экран, свежее подтянется в фоне
        doc.documentElement.style.overflow = 'hidden';
        try { localStorage.setItem(OPEN_KEY, '1'); } catch (e) { /* ок */ }
        load();
    }
    function close() {
        if (!el) return;
        el.classList.remove('open'); doc.documentElement.style.overflow = '';
        try { localStorage.removeItem(OPEN_KEY); } catch (e) { /* ок */ }
    }
    function init(opts) {
        sb = opts.supabase; isSuper = opts.isSuperAdmin || isSuper;
        var btn = doc.getElementById('sidebar-home-btn');
        if (!btn) return;
        var pill = btn.querySelector('.rail-logo-name');
        btn.addEventListener('click', function (ev) {
            if (!isSuper() || root.innerWidth < 760 || !ev.target.closest('.rail-logo-name')) return; // логотип NR работает как раньше
            ev.preventDefault(); ev.stopPropagation(); open();
        }, true);
        var tries = 0, t = setInterval(function () {
            tries++;
            if (isSuper()) { clearInterval(t); if (pill) { pill.classList.add('nra-entry'); pill.title = 'Администрирование'; } try { if (localStorage.getItem(OPEN_KEY) === '1') open(); } catch (e) { /* ок */ } }
            if (tries > 60) clearInterval(t);
        }, 1000);
    }
    root.NrAdmin = { init: init, open: open, close: close, _attention: attention, _state: S };
})(typeof window !== 'undefined' ? window : globalThis);

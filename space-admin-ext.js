// «Доступ к NR Space» (Настройки → Безопасность): сделать сотрудником и выдать «Фулл».
// Кнопки добавляются к строкам таблицы после каждой отрисовки; данные берутся из spaces и team_staff.
(function () {
    'use strict';
    const wrapId = 'admin-spaces-table-wrap';

    async function authedPost(body) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Сессия истекла, войдите заново');
        const res = await fetch(ADMIN_SPACE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
            body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data.error || 'Ошибка') + ' (' + res.status + ')');
        return data;
    }

    function uidOf(btn) {
        const m = /\('([0-9a-f-]{36})'/.exec(btn.getAttribute('onclick') || '');
        return m ? m[1] : '';
    }

    const ICO = {
        gift: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/></svg>',
        eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>',
        user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>',
        userOk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M16 11l2 2 4-4"/></svg>',
        star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21.1 7 14.2 2 9.3l6.9-1z"/></svg>',
        check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
        gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
        ban: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/></svg>',
        trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg>',
    };
    const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

    function mkBtn(text, cls, handler, icon) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = cls;
        b.setAttribute('data-ext', '1');
        b.innerHTML = (icon ? ICO[icon] : '') + '<span>' + esc(text) + '</span>';
        // Кнопка отвечает сразу: обработчик сам обновляет экран, сервер догоняет в фоне.
        b.onclick = () => {
            try {
                const r = handler();
                if (r && typeof r.catch === 'function') r.catch((e) => toast('error', 'Ошибка', (e && e.message) || 'Не получилось'));
            } catch (e) { toast('error', 'Ошибка', (e && e.message) || 'Не получилось'); }
        };
        return b;
    }

    // Родные кнопки строки (Разрешить, Заблокировать, Удалить…) — в том же стиле, опасные отделены чертой.
    function styleNative(box) {
        box.classList.add('ax-box');
        const map = [['adminGrantSpaceAccess', 'ax ax-ok', 'check'], ['adminUnblockSpace', 'ax ax-ok', 'check'], ['adminBlockSpace', 'ax ax-danger', 'ban'], ['adminDeleteUser', 'ax ax-danger', 'trash']];
        map.forEach(([fn, cls, icon]) => {
            box.querySelectorAll('button[onclick^="' + fn + '("]').forEach((b) => {
                if (b.hasAttribute('data-ax')) return;
                b.setAttribute('data-ax', '1');
                b.className = cls;
                b.innerHTML = ICO[icon] + '<span>' + esc(b.textContent.trim()) + '</span>';
            });
        });
        box.querySelectorAll('.ax-sep').forEach((x) => x.remove());
        const first = box.querySelector('.ax-danger');
        if (first && first !== box.firstElementChild) { const sep = document.createElement('i'); sep.className = 'ax-sep'; first.before(sep); }
    }

    // Доступ «только просмотр»: окно в общем стиле модалок сайта.
    const SECTIONS = [['all', 'Все разделы'], ['dashboard', 'Дашборд'], ['rnp', 'РНП'], ['goods', 'Товары'], ['ads', 'Реклама'], ['ab', 'А/Б тесты'], ['logistics', 'Логистика'], ['reports', 'Отчёты']];
    const escH = (t) => String(t || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    async function openViewerModal(uid, email) {
        // Окно открывается сразу из кэша; свежие данные подтягиваются в фоне. Новому человеку по умолчанию только РНП.
        const curRows = AX.viewers.get(uid) || [];
        const list = AX.cabs.filter(c => typeof isHiddenCabinet !== 'function' || !isHiddenCabinet(c));
        const have = new Set(curRows.map(r => r.cabinet_id));
        let secs = new Set((curRows[0] && curRows[0].sections) || ['rnp']);
        document.getElementById('nr-viewer-modal')?.remove();
        const ov = document.createElement('div');
        ov.id = 'nr-viewer-modal';
        ov.className = 'rnp-plan-overlay';
        const pills = () => SECTIONS.map(([k, t]) => `<button type="button" class="nrv-pill${secs.has(k) ? ' on' : ''}" data-sec="${k}">${t}</button>`).join('');
        ov.innerHTML = `<div class="rnp-plan-panel rnp-modal-panel" role="dialog" aria-modal="true">
          <div class="rnp-plan-head"><div class="rnp-modal-titles"><div class="rnp-plan-title">Доступ на просмотр</div><div class="rnp-modal-sub">${escH(email)} · выберите кабинеты и разделы</div></div>
          <button type="button" class="rnp-plan-close" aria-label="Закрыть">×</button></div>
          <div class="rnp-modal-body"><div class="nrv-grid">
            <div><div class="nrv-h">КАБИНЕТЫ</div><div class="nrv-cabs">${list.map(c => `<label class="nrv-cab"><input type="checkbox" value="${c.id}"${have.has(c.id) ? ' checked' : ''}><span>${escH(c.name)}</span></label>`).join('') || '<div class="nrv-note">Кабинетов нет</div>'}</div></div>
            <div><div class="nrv-h">РАЗДЕЛЫ</div><div class="nrv-pills">${pills()}</div>
              <div class="nrv-note"><b>Только просмотр.</b> Пользователь видит цифры выбранных кабинетов, но ничего не может менять: кнопки редактирования, планы, заметки, ставки, запуск РК и настройки скрыты, а база отклоняет любые изменения от него. Токены WB ему не видны.</div></div>
          </div>
          <div class="nrv-actions">${have.size ? '<button type="button" class="nrv-remove">Убрать доступ</button>' : ''}<button type="button" class="nrv-save">Сохранить</button></div></div></div>`;
        const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); };
        const onKey = (e) => { if (e.key === 'Escape') close(); };
        document.addEventListener('keydown', onKey);
        ov.addEventListener('click', async (e) => {
            if (e.target === ov || e.target.closest('.rnp-plan-close')) { close(); return; }
            const pill = e.target.closest('.nrv-pill');
            if (pill) {
                const k = pill.dataset.sec;
                if (k === 'all') secs = new Set(['all']);
                else {
                    secs.delete('all');
                    if (secs.has(k)) { if (secs.size > 1) secs.delete(k); } // последний выбранный раздел не снимаем, иначе доступ молча стал бы «ко всему»
                    else secs.add(k);
                }
                ov.querySelector('.nrv-pills').innerHTML = pills();
                return;
            }
            const save = e.target.closest('.nrv-save'), rem = e.target.closest('.nrv-remove');
            if (!save && !rem) return;
            const btn = save || rem;
            const ids = rem ? [] : [...ov.querySelectorAll('.nrv-cab input:checked')].map(i => i.value);
            if (save && !ids.length) { showPremiumModal('error', 'Выберите кабинет', 'Отметьте хотя бы один кабинет или нажмите «Убрать доступ».'); return; }
            const prevRows = AX.viewers.get(uid) || [];
            const secList = [...secs];
            // Сразу закрываем окно и обновляем кэш, запрос уходит в фоне; при ошибке возвращаем как было.
            if (ids.length) AX.viewers.set(uid, ids.map(id => ({ user_id: uid, cabinet_id: id, sections: secList }))); else AX.viewers.delete(uid);
            close();
            toast('success', rem ? 'Доступ снят' : 'Доступ на просмотр выдан',
                rem ? 'Пользователь больше не видит кабинеты.' : 'Кабинетов: ' + ids.length + ', разделы: ' + secList.map((x) => (SECTIONS.find((r) => r[0] === x) || [x, x])[1]).join(', ') + '. Изменять данные он не сможет.');
            renderSpacesAdminView();
            try {
                await authedPost({ action: 'set_viewer', user_id: uid, cabinet_ids: ids, sections: secList });
                softRefresh();
            } catch (err) {
                if (prevRows.length) AX.viewers.set(uid, prevRows); else AX.viewers.delete(uid);
                renderSpacesAdminView();
                toast('error', 'Доступ не сохранился', err.message || 'Не получилось');
            }
        });
        document.body.appendChild(ov);
    }

    // ===== Управление доступом одного человека: тариф, роль, просмотр кабинетов, опасные действия =====
    const fmtDT = (d) => new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    function planInfo(row) {
        const live = !row.plan_until || new Date(row.plan_until).getTime() > Date.now();
        const full = (row.tariff_plan === 'premium' || row.tariff_plan === 'vip') && live;
        if (full && row.plan_until) return { key: 'trial', label: 'Фулл до ' + fmtDT(row.plan_until), cls: 'amber' };
        if (full) return { key: 'full', label: row.tariff_plan === 'vip' ? 'VIP' : 'Фулл без срока', cls: 'amber' };
        if ((row.tariff_plan === 'premium' || row.tariff_plan === 'vip') && !live) return { key: 'free', label: 'Фулл закончился', cls: 'red' };
        return { key: 'free', label: 'Бесплатный', cls: 'gray' };
    }
    function chip(t, cls) { return '<span class="acx-chip ' + cls + '">' + escH(t) + '</span>'; }

    async function openAccessModal(uid) {
        // Окно открывается мгновенно из кэша списка; сервер подтверждает изменения в фоне.
        const cached = rowsAll().find((r) => r.user_id === uid) || AX.sp.get(uid);
        if (!cached) { toast('error', 'Не найдено', 'Пользователь не найден.'); return; }
        const row = Object.assign({}, AX.sp.get(uid) || {}, cached);
        const state = {
            row,
            staff: AX.staff.has(String(row.email || '').toLowerCase()),
            views: AX.viewers.get(uid) || [],
        };
        const cabName = AX.cabName;
        document.getElementById('nr-access-modal')?.remove();
        const ov = document.createElement('div');
        ov.id = 'nr-access-modal';
        ov.className = 'rnp-plan-overlay';
        const secName = { all: 'Все разделы', dashboard: 'Дашборд', rnp: 'РНП', goods: 'Товары', ads: 'Реклама', ab: 'А/Б', logistics: 'Логистика', reports: 'Отчёты' };
        const paint = () => {
            const pi = planInfo(state.row);
            const tile = (key, title, text, active) => '<button type="button" class="acx-tile' + (active ? ' on' : '') + '" data-plan="' + key + '"><b>' + title + '</b><small>' + text + '</small></button>';
            const views = state.views.length
                ? state.views.map((v) => '<div class="acx-view"><b>' + escH(cabName.get(v.cabinet_id) || 'Кабинет') + '</b><span>' + escH((v.sections || ['all']).map((x) => secName[x] || x).join(', ')) + '</span></div>').join('')
                : '<div class="acx-empty">Чужие кабинеты не выданы</div>';
            ov.querySelector('.acx-body').innerHTML =
                '<div class="acx-sec"><div class="acx-h"><i>1</i>Тариф <em>что человеку доступно</em></div><div class="acx-tiles">' +
                tile('free', 'Бесплатный', 'Только «Тарифы» и «Настройки»', pi.key === 'free') +
                tile('trial', 'Тест на 1 день', 'Все разделы 24 часа, потом замок до оплаты', pi.key === 'trial') +
                tile('full', 'Фулл без срока', 'Все разделы, пока вы не снимете', pi.key === 'full') + '</div></div>' +
                '<div class="acx-sec"><div class="acx-h"><i>2</i>Роль <em>кто это</em></div>' +
                '<button type="button" class="acx-switch' + (state.staff ? ' on' : '') + '" data-staff="1"><span class="acx-knob"></span><span><b>Сотрудник NR</b><small>' + (state.staff ? 'Видит внутренние разделы и все кабинеты команды' : 'Обычный клиент: видит только свои кабинеты') + '</small></span></button></div>' +
                '<div class="acx-sec"><div class="acx-h"><i>3</i>Просмотр чужих кабинетов <em>только смотреть, менять нельзя</em></div>' + views +
                '<button type="button" class="acx-link" data-view="1">Настроить просмотр</button></div>' +
                '<div class="acx-sec acx-danger"><div class="acx-h"><i>4</i>Опасные действия</div><div class="acx-drow">' +
                '<button type="button" class="ax ax-danger" data-act="block">' + ICO.ban + '<span>Заблокировать</span></button><small>Вход закрыт, сессии завершены, синхронизация кабинетов заморожена</small></div>' +
                '<div class="acx-drow"><button type="button" class="ax ax-danger" data-act="delete">' + ICO.trash + '<span>Удалить аккаунт</span></button><small>Удаляет пользователя и его данные. Это нельзя отменить</small></div></div>';
            ov.querySelector('.acx-chips').innerHTML = chip(pi.label, pi.cls) + (state.staff ? chip('Сотрудник', 'purple') : chip('Клиент', 'gray')) + (state.views.length ? chip('Просмотр: ' + state.views.length + ' каб.', 'blue') : '');
        };
        ov.innerHTML = '<div class="rnp-plan-panel rnp-modal-panel acx-panel" role="dialog" aria-modal="true"><div class="rnp-plan-head"><div class="rnp-modal-titles"><div class="rnp-plan-title">Управление доступом</div><div class="rnp-modal-sub">' + escH(row.email) + '</div></div><button type="button" class="rnp-plan-close" aria-label="Закрыть">×</button></div>' +
            '<div class="rnp-modal-body"><div class="acx-chips"></div><div class="acx-body"></div></div></div>';
        const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); };
        const onKey = (e) => { if (e.key === 'Escape') close(); };
        document.addEventListener('keydown', onKey);
        const reload = async () => { paint(); softRefresh(); };
        ov.addEventListener('click', async (e) => {
            if (e.target === ov || e.target.closest('.rnp-plan-close')) { close(); return; }
            const t = e.target.closest('[data-plan],[data-staff],[data-view],[data-act]');
            if (!t || t.disabled) return;
            try {
                if (t.dataset.plan) {
                    const k = t.dataset.plan;
                    const patch = k === 'free' ? { tariff_plan: 'start', plan_until: null }
                        : k === 'trial' ? { tariff_plan: 'premium', plan_until: new Date(Date.now() + 864e5).toISOString() }
                        : { tariff_plan: 'premium', plan_until: null };
                    const prev = { tariff_plan: state.row.tariff_plan, plan_until: state.row.plan_until };
                    Object.assign(state.row, patch);
                    syncRow(uid, patch);
                    paint();
                    const body = k === 'free' ? { action: 'set_plan', user_id: uid, plan: 'start' }
                        : k === 'trial' ? { action: 'set_plan', user_id: uid, plan: 'premium', days: 1 }
                        : { action: 'set_plan', user_id: uid, plan: 'premium' };
                    authedPost(body).then(softRefresh).catch((err) => {
                        Object.assign(state.row, prev); syncRow(uid, prev); paint();
                        toast('error', 'Тариф не сохранился', err.message || 'Не получилось');
                    });
                } else if (t.dataset.staff) {
                    const want = !state.staff;
                    state.staff = want;
                    const mail = String(state.row.email || '').toLowerCase();
                    if (want) AX.staff.add(mail); else AX.staff.delete(mail);
                    paint();
                    authedPost({ action: 'set_staff', user_id: uid, value: want }).then(softRefresh).catch((err) => {
                        state.staff = !want;
                        if (want) AX.staff.delete(mail); else AX.staff.add(mail);
                        paint();
                        toast('error', 'Роль не сохранилась', err.message || 'Не получилось');
                    });
                } else if (t.dataset.view) {
                    close();
                    openViewerModal(uid, state.row.email);
                } else if (t.dataset.act === 'block') {
                    close();
                    if (typeof adminBlockSpace === 'function') adminBlockSpace(uid, null);
                } else if (t.dataset.act === 'delete') {
                    close();
                    if (typeof adminDeleteUser === 'function') adminDeleteUser(uid, null);
                }
            } catch (err) {
                showPremiumModal('error', 'Ошибка', err.message || 'Не получилось');
                paint();
            }
        });
        document.body.appendChild(ov);
        paint();
    }

    // ===== Быстрый слой: один кэш, оптимистичные действия, перерисовка на месте =====
    // Правило проекта (CLAUDE.md): кнопка отвечает сразу, тяжёлая работа идёт в фоне после нажатия.
    const AX = { sp: new Map(), staff: new Set(), viewers: new Map(), cabs: [], cabName: new Map() };

    function toast(type, title, text) {
        try { if (window.NrUi && typeof window.NrUi.toast === 'function') return window.NrUi.toast(type, title, text || ''); } catch (_) {}
        try { showPremiumModal(type === 'error' ? 'error' : 'success', title, text || ''); } catch (_) {}
    }

    function rowsAll() {
        const c = typeof _spacesAdminCache !== 'undefined' ? _spacesAdminCache : null;
        return c ? [...c.allowedRows, ...c.requestRows, ...c.blockedRows] : [];
    }

    function scrollBox(el) {
        let n = el;
        while (n && n !== document.body) {
            const cs = getComputedStyle(n);
            if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight) return n;
            n = n.parentElement;
        }
        return document.scrollingElement || document.documentElement;
    }

    // Перерисовка на месте: положение прокрутки и высота блока сохраняются, страница не прыгает.
    function keepPlace(fn) {
        const wrap = document.getElementById(wrapId);
        const box = wrap ? scrollBox(wrap) : null;
        const top = box ? box.scrollTop : 0;
        const h = wrap ? wrap.offsetHeight : 0;
        if (wrap && h) wrap.style.minHeight = h + 'px';
        try { fn(); } finally {
            if (box) box.scrollTop = top;
            requestAnimationFrame(() => { if (wrap) wrap.style.minHeight = ''; if (box) box.scrollTop = top; });
        }
    }

    // Правка строки в кэше списка и перерисовка (без запросов).
    function patchRow(uid, patch) {
        if (typeof _spacesAdminCache === 'undefined' || !_spacesAdminCache) return null;
        const all = rowsAll();
        const row = all.find((r) => r.user_id === uid);
        if (!row) return null;
        const prev = {};
        Object.keys(patch).forEach((k) => { prev[k] = row[k]; });
        Object.assign(row, patch);
        const c = _spacesAdminCache;
        c.allowedRows = sortAllowedSpaces(all);
        c.requestRows = sortPendingRequests(all);
        c.blockedRows = sortBlockedSpaces(all);
        const sp = AX.sp.get(uid);
        if (sp) Object.assign(sp, patch);
        renderSpacesAdminView();
        return prev;
    }
    function syncRow(uid, patch) { patchRow(uid, patch); }

    function dropRow(uid) {
        const c = _spacesAdminCache;
        if (!c) return;
        c.allowedRows = c.allowedRows.filter((r) => r.user_id !== uid);
        c.requestRows = c.requestRows.filter((r) => r.user_id !== uid);
        c.blockedRows = c.blockedRows.filter((r) => r.user_id !== uid);
        renderSpacesAdminView();
    }

    let softTimer = null;
    function softRefresh() {
        clearTimeout(softTimer);
        softTimer = setTimeout(() => { try { window.loadSpacesAdmin(); } catch (_) {} }, 1500);
    }

    // Действие «сначала на экране, потом на сервере»: при ошибке экран возвращается назад.
    function act(uid, patch, call, okTitle, okText, extra) {
        const prev = patchRow(uid, patch);
        if (!prev) { Promise.resolve().then(call).then(softRefresh).catch((e) => toast('error', 'Ошибка', e.message || 'Не получилось')); return; }
        if (extra && extra.apply) extra.apply();
        toast('success', okTitle, okText);
        Promise.resolve().then(call).then(softRefresh).catch((e) => {
            patchRow(uid, prev);
            if (extra && extra.revert) extra.revert();
            toast('error', 'Не получилось', (e && e.message) || 'Сервер не принял действие, вернул как было.');
        });
    }

    async function loadAll() {
        const [sp, cb, st, vw] = await Promise.all([
            supabase.from('spaces').select('id, user_id, email, status, tariff_plan, plan_until, created_at, is_super_admin, first_name, last_name, full_name, avatar_url, last_sign_in_at, sign_in_attempts'),
            supabase.from('cabinets').select('id, name, user_id'),
            supabase.from('team_staff').select('email'),
            supabase.from('cabinet_viewers').select('user_id, cabinet_id, sections'),
        ]);
        if (sp.error) return { error: sp.error };
        AX.sp = new Map((sp.data || []).map((r) => [r.user_id, r]));
        AX.staff = new Set((st.data || []).map((r) => String(r.email || '').toLowerCase()));
        AX.viewers = new Map();
        (vw.data || []).forEach((v) => { if (!AX.viewers.has(v.user_id)) AX.viewers.set(v.user_id, []); AX.viewers.get(v.user_id).push(v); });
        AX.cabs = (cb.data || []).slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru'));
        AX.cabName = new Map(AX.cabs.map((c) => [c.id, c.name]));
        const counts = {};
        (cb.data || []).forEach((c) => { if (c.user_id) counts[c.user_id] = (counts[c.user_id] || 0) + 1; });
        return { spaces: sp.data || [], counts };
    }

    // Список «Доступ к NR Space»: никакого «Загрузка…» поверх готовой таблицы, один набор запросов вместо двенадцати.
    async function loadSpacesAdminFast() {
        const wrap = document.getElementById(wrapId);
        if (!wrap || typeof isSuperAdmin === 'undefined' || !isSuperAdmin) return;
        if (!wrap.querySelector('table') && !_spacesAdminCache) wrap.innerHTML = '<div class="text-center py-10 text-sm" style="color:var(--text-muted)">Загрузка…</div>';
        const r = await loadAll();
        if (r.error) {
            if (!_spacesAdminCache) wrap.innerHTML = '<div class="text-center py-10 text-sm px-6" style="color:var(--red)">' + esc(r.error.message || 'Не удалось загрузить') + '</div>';
            else toast('error', 'Не удалось обновить список', r.error.message || '');
            return;
        }
        const all = r.spaces;
        _spacesAdminCache = {
            allowedRows: sortAllowedSpaces(all),
            requestRows: sortPendingRequests(all),
            blockedRows: sortBlockedSpaces(all),
            counts: r.counts,
        };
        renderSpacesAdminView();
    }

    // Кнопки строки добавляются в той же задаче, что и отрисовка таблицы, поэтому ничего не мигает и не перестраивается позже.
    function decorate() {
        const wrap = document.getElementById(wrapId);
        if (!wrap) return;
        const rows = [...wrap.querySelectorAll('tbody tr')].filter((tr) => !tr.querySelector('[data-ext]'));
        rows.forEach((tr) => {
            const grant = tr.querySelector('button[onclick^="adminGrantSpaceAccess("]');
            const block = tr.querySelector('button[onclick^="adminBlockSpace("]');
            const box = tr.querySelector('.admin-space-actions') || (block || grant)?.parentElement;
            if (!box) return;
            styleNative(box);
            if (grant && !tr.querySelector('button[onclick^="adminUnblockSpace("]')) {
                const uid = uidOf(grant);
                const mail = String((AX.sp.get(uid) || {}).email || '').toLowerCase();
                // Новый клиент: сразу «Фулл» на 1 день (потом замок до оплаты) или сразу сотрудником.
                grant.after(mkBtn('Тест: Фулл на 1 день', 'ax ax-test', () => act(uid,
                    { status: 'active', tariff_plan: 'premium', plan_until: new Date(Date.now() + 864e5).toISOString() },
                    () => authedPost({ action: 'activate', user_id: uid, trial_days: 1 }),
                    'Тест на 1 день', 'Доступ разрешён, «Фулл» на 24 часа, потом замок до оплаты.'), 'gift'));
                grant.after(mkBtn('Как сотрудник', 'ax ax-staff', () => act(uid,
                    { status: 'active', tariff_plan: 'premium', plan_until: null },
                    () => authedPost({ action: 'activate', user_id: uid, as_staff: true }),
                    'Сотрудник добавлен', 'Доступ разрешён, «Фулл» выдан, права сотрудника включены.',
                    { apply: () => { if (mail) AX.staff.add(mail); }, revert: () => { if (mail) AX.staff.delete(mail); } }), 'user'));
                box.querySelectorAll('button[onclick^="adminDeleteUser("]').forEach((x) => x.remove());
                styleNative(box);
                return;
            }
            if (block && !grant) {
                const uid = uidOf(block);
                const row = AX.sp.get(uid) || rowsAll().find((r) => r.user_id === uid);
                if (!row) return;
                const isStaff = AX.staff.has(String(row.email || '').toLowerCase());
                const pi = planInfo(row);
                const views = AX.viewers.get(uid) || [];
                box.innerHTML = '';
                box.classList.add('ax-box');
                const info = document.createElement('div');
                info.className = 'acx-chips acx-row';
                info.setAttribute('data-ext', '1');
                info.innerHTML = chip(pi.label, pi.cls) + (isStaff ? chip('Сотрудник', 'purple') : '') + (views.length ? chip('Просмотр: ' + views.map((v) => AX.cabName.get(v.cabinet_id) || 'кабинет').join(', ') + ' · ' + (views[0].sections || ['all']).join(', '), 'blue') : '');
                const btns = document.createElement('div');
                btns.className = 'acx-btns';
                if (pi.key === 'free' && !isStaff) {
                    btns.appendChild(mkBtn('Тест: Фулл на 1 день', 'ax ax-test', () => act(uid,
                        { tariff_plan: 'premium', plan_until: new Date(Date.now() + 864e5).toISOString() },
                        () => authedPost({ action: 'set_plan', user_id: uid, plan: 'premium', days: 1 }),
                        'Тест на 1 день', '«Фулл» выдан на 24 часа, потом разделы закроются до оплаты.'), 'gift'));
                }
                btns.appendChild(mkBtn('Управлять', 'ax ax-manage', () => openAccessModal(uid), 'gear'));
                box.append(info, btns);
            }
        });
    }

    function installOverrides() {
        if (window.__axFast) return;
        window.__axFast = true;
        const origRender = window.renderSpacesAdminView;
        window.renderSpacesAdminView = function () {
            keepPlace(() => { if (typeof origRender === 'function') origRender(); decorate(); });
        };
        window.loadSpacesAdmin = loadSpacesAdminFast;
        window.adminGrantSpaceAccess = (uid) => {
            if (!uid || !isSuperAdmin) return;
            act(uid, { status: 'active' }, () => authedPost({ action: 'activate', user_id: uid }), 'Доступ разрешён', 'Пользователь в «Разрешённые».');
        };
        window.adminUnblockSpace = (uid) => {
            if (!uid || !isSuperAdmin) return;
            act(uid, { status: 'active' }, () => authedPost({ action: 'activate', user_id: uid }), 'Спейс разблокирован', 'Пользователь снова в «Разрешённые».');
        };
        window.adminBlockSpace = async (uid) => {
            if (!uid || !isSuperAdmin) return;
            if (!(await nrAsk('Заблокировать спейс? Все сессии клиента будут аннулированы, WB-синхронизация заморожена.'))) return;
            act(uid, { status: 'blocked' }, () => authedPost({ action: 'block', user_id: uid }), 'Спейс заблокирован', 'Сессии завершены, войти он не сможет.');
        };
        window.adminDeleteUser = async (uid) => {
            if (!uid || !isSuperAdmin) return;
            const row = findAdminSpaceRow(uid);
            if (row && isSuperAdminRow(row)) return;
            const email = (row && row.email) || 'этого пользователя';
            const ok = await showConfirmModal('Удалить пользователя?',
                'Удалить ' + email + '? Аккаунт будет удалён без возможности восстановления. Кабинеты и их данные останутся, но владелец будет снят.');
            if (!ok) return;
            const snapshot = row ? Object.assign({}, row) : null;
            dropRow(uid);
            toast('success', 'Пользователь удалён', 'Кабинеты и данные сохранены, владелец снят.');
            callDeleteUser(uid).then(softRefresh).catch((e) => {
                if (snapshot && _spacesAdminCache) {
                    const all = [...rowsAll(), snapshot];
                    _spacesAdminCache.allowedRows = sortAllowedSpaces(all);
                    _spacesAdminCache.requestRows = sortPendingRequests(all);
                    _spacesAdminCache.blockedRows = sortBlockedSpaces(all);
                    renderSpacesAdminView();
                }
                toast('error', 'Не удалили', (e && e.message) || 'Не получилось');
            });
        };
    }

    // ===== «Активные сеансы»: список сразу, регистрация устройства и геолокация позже =====
    function sessionsFast() {
        window.loadSessionsPanel = async function (opts) {
            const listEl = document.getElementById(opts.listId);
            const endAllBtn = document.getElementById(opts.endAllBtnId);
            if (!listEl || !currentUserId) return;
            const currentKey = getOrCreateSessionKey();
            const terminateHandler = opts.terminateHandler || 'terminateSession';
            const paintRows = (rows) => {
                const others = rows.filter((r) => r.current_session_token !== currentKey);
                listEl.innerHTML = rows.length
                    ? rows.map((r) => renderSecuritySessionRow(r, currentKey, terminateHandler)).join('')
                    : '<div class="text-center py-10 text-sm px-6" style="color:var(--text-muted)">Нет зарегистрированных сеансов.</div>';
                if (endAllBtn) endAllBtn.disabled = others.length === 0;
            };
            const read = () => supabase.from('user_sessions').select('*').eq('user_id', currentUserId).order('last_active', { ascending: false });
            const first = await read();
            if (first.error) {
                listEl.innerHTML = '<div class="text-center py-10 text-sm px-6" style="color:var(--red)">Не удалось загрузить сеансы: ' + esc(first.error.message) + '</div>';
                if (endAllBtn) endAllBtn.disabled = true;
                return;
            }
            keepSessions(listEl, () => paintRows(first.data || []));
            // Свой сеанс записываем в фоне (там внешний запрос геолокации, он медленный) и обновляем список без «Загрузка…».
            registerUserSession().then(read).then((r) => { if (!r.error) keepSessions(listEl, () => paintRows(r.data || [])); }).catch(() => {});
            if (opts.heartbeatPaneId) {
                clearInterval(_securityHeartbeatTimer);
                _securityHeartbeatTimer = setInterval(() => {
                    const pane = document.getElementById(opts.heartbeatPaneId);
                    if (pane && !pane.classList.contains('hidden')) touchUserSession().then(() => (opts.reloadFn || loadSecuritySessions)());
                }, 120000);
            }
        };
        // Завершить сеанс: строка исчезает сразу, удаление идёт в фоне, при ошибке строка возвращается.
        window.terminateSessionById = async function (sessionId, reloadFn) {
            if (!sessionId || !currentUserId) return;
            const currentKey = getOrCreateSessionKey();
            const rowEl = document.querySelector('.security-session-row[data-session-id="' + (window.CSS && CSS.escape ? CSS.escape(String(sessionId)) : String(sessionId).replace(/"/g, '')) + '"]');
            if (rowEl && !rowEl.querySelector('.security-end-btn')) return; // текущий сеанс завершить нельзя
            if (rowEl) rowEl.remove();
            toast('success', 'Сеанс завершён', 'Устройство удалено из списка.');
            const { error } = await supabase.from('user_sessions').delete().eq('id', sessionId).eq('user_id', currentUserId).neq('current_session_token', currentKey);
            if (error) { toast('error', 'Не получилось завершить', error.message); await (reloadFn || loadSecuritySessions)(); }
        };
    }

    function keepSessions(listEl, fn) {
        const box = scrollBox(listEl);
        const top = box ? box.scrollTop : 0;
        fn();
        if (box) box.scrollTop = top;
    }

    function init() {
        installOverrides();
        try { sessionsFast(); } catch (_) {}
        const wrap = document.getElementById(wrapId);
        if (!wrap) return;
        // Подстраховка: если какой-то другой код перерисовал таблицу мимо нашей обёртки, кнопки всё равно появятся.
        new MutationObserver(() => decorate()).observe(wrap, { childList: true });
        if (typeof _spacesAdminCache !== 'undefined' && _spacesAdminCache) decorate();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();

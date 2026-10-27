// «Доступ к NR Space» (Настройки → Безопасность): сделать сотрудником и выдать «Фулл».
// Кнопки добавляются к строкам таблицы после каждой отрисовки; данные берутся из spaces и team_staff.
// «Пока грузится, не стираем то, что уже на экране»: если загрузчик пытается заменить готовый блок на «Загрузка…»,
// оставляем старое содержимое (чуть приглушённое), пока не придёт новое. Сменили кабинет: старое НЕ показываем.
// Работает для всех загрузчиков кабинета сразу, правило проекта в CLAUDE.md.
(function keepStaleWhileLoading() {
    'use strict';
    try {
        const desc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
        if (!desc || !desc.set || Element.prototype.__nrKeepStale) return;
        Element.prototype.__nrKeepStale = true;
        const st = document.createElement('style');
        st.textContent = '.nr-stale{opacity:1}';
        (document.head || document.documentElement).appendChild(st);
        const PH = /^(Загрузка|Загружаем|Считаем|Обновляем)/i;
        const cab = () => { try { return typeof currentCabinetId !== 'undefined' && currentCabinetId ? String(currentCabinetId) : ''; } catch (_) { return ''; } };
        Object.defineProperty(Element.prototype, 'innerHTML', {
            configurable: true,
            enumerable: desc.enumerable,
            get: desc.get,
            set(v) {
                if (typeof v === 'string') {
                    if (v.length < 420 && PH.test(v.replace(/<[^>]*>/g, '').trim())) {
                        const cur = (this.textContent || '').trim();
                        if (this.childElementCount > 0 && cur.length > 60 && !PH.test(cur) && this.dataset && this.dataset.nsCab === cab() && !this.hasAttribute('data-ns-fresh')) {
                            this.classList.add('nr-stale');
                            clearTimeout(this.__nrStaleT); this.__nrStaleT = setTimeout(() => this.classList.remove('nr-stale'), 6000);
                            return;
                        }
                    } else {
                        desc.set.call(this, v);
                        if (this.classList && this.classList.contains('nr-stale')) this.classList.remove('nr-stale');
                        if (v.length > 200 && this.dataset) this.dataset.nsCab = cab();
                        return;
                    }
                }
                desc.set.call(this, v);
            },
        });
    } catch (_) { /* без подмены всё работает как раньше */ }
})();

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

    // ===== Вид «Настройки»: минимализм (вариант B) =====
    const MIN_CSS = `
#tab-settings.active{display:grid;grid-template-columns:200px minmax(0,1fr);column-gap:40px;align-items:start;max-width:1000px;margin:0 auto}
#tab-settings>.space-pending-banner{grid-column:1/-1}
#tab-settings>.settings-section-tabs{grid-column:1;grid-row:2/span 30;position:sticky;top:12px;display:flex;flex-direction:column;gap:2px;background:none;border:0;padding:0;margin:0}
#tab-settings>[id^="settings-"]:not(.settings-section-tabs){grid-column:2;grid-row:2;min-width:0}
#tab-settings .settings-section-tab{flex:none;text-align:left;padding:9px 12px;font-size:14px;font-weight:500;border-radius:10px;color:var(--text-muted);background:none}
#tab-settings .settings-section-tab:hover{background:var(--sel,#ededed);color:var(--text-primary)}
#tab-settings .settings-section-tab.active{background:var(--sel,#ededed);color:var(--text-primary);font-weight:600}
#tab-settings .widget-card{box-shadow:none;border:1px solid var(--border);border-radius:16px;background:var(--surface-solid,var(--surface))}
#tab-settings #settings-security .security-sessions-card{background:transparent!important;border:0!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;border-radius:0;overflow:visible}
#tab-settings #settings-security .security-sessions-card>.p-6{padding:0 0 10px!important}
#tab-settings #settings-security .security-sessions-card h3{font-size:15px;font-weight:600}
#tab-settings #settings-security .security-sessions-card>.px-6{padding:0!important}
#tab-settings #security-sessions-list{background:var(--surface-solid,var(--surface));border:1px solid var(--border);border-radius:14px;overflow:hidden}
#tab-settings #settings-devsessions .security-sessions-card{background:transparent!important;border:0!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;border-radius:0;overflow:visible}
#tab-settings #settings-devsessions .security-sessions-card>.p-6{padding:0 0 10px!important}
#tab-settings #settings-devsessions .security-sessions-card h3{font-size:15px;font-weight:600}
#tab-settings #settings-devsessions .security-sessions-card>.px-6{padding:0!important}
#tab-settings #dev-sessions-list{background:var(--surface-solid,var(--surface));border:1px solid var(--border);border-radius:14px;overflow:hidden}
#tab-settings #settings-profile>.widget-card,#tab-settings #settings-api>.widget-card,#tab-settings #settings-features>.widget-card,#tab-settings #settings-about>.widget-card{background:transparent!important;border:0!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;padding:0!important}
#tab-settings #settings-profile h3,#tab-settings #settings-api h3,#tab-settings #settings-features h3,#tab-settings #settings-about h3{font-size:15px;font-weight:600;margin-bottom:12px}
#tab-settings #settings-api .flex.items-center.justify-between h3{margin-bottom:0}
#tab-settings #settings-user-info,#tab-settings #settings-about .text-sm[class*="space-y"]{background:var(--surface-solid,var(--surface));border:1px solid var(--border);border-radius:14px;padding:16px 18px}
#tab-settings #settings-profile button[onclick^="handleLogout"]{background:none!important;border:1px solid var(--border)!important;color:var(--red,#d4372c)!important;border-radius:9px!important;padding:8px 16px!important;margin-top:14px!important;font-weight:550}
#tab-settings #cabinets-api-list>*{background:var(--surface-solid,var(--surface));border:1px solid var(--border)!important;border-radius:14px;padding:14px 16px}
#tab-settings #settings-api button[onclick^="showAddCabinetForm"]{background:var(--text-primary);color:var(--bg,#fff);border:1px solid var(--text-primary);border-radius:9px}
#tab-settings #add-cabinet-form{background:var(--surface-solid,var(--surface))!important;border:1px solid var(--border)!important;border-radius:14px}
#tab-settings #settings-features .ft-list>*,#tab-settings #settings-features .ft-all{border-radius:14px}
#tab-settings #settings-security.space-y-4>*+*{margin-top:36px}
#tab-settings #settings-security .security-sessions-card+.security-sessions-card,#tab-settings #settings-security #admin-access-card+.security-sessions-card{margin-top:36px}
#tab-settings .security-device-icon{width:34px;height:34px;border-radius:9px;border:0;background:var(--sel,#ededed)}
#tab-settings .security-session-row{padding:14px 18px;gap:12px}
#tab-settings .security-session-title{font-size:14px}
#tab-settings .security-end-btn{font-size:13px}
#tab-settings .security-end-all-btn{width:auto;margin:10px 0 0 auto;padding:6px 10px;font-size:13px;font-weight:500;color:var(--text-muted)}
#tab-settings .security-end-all-btn:hover:not(:disabled){color:var(--red,#d4372c);background:none}
#tab-settings #admin-access-card .p-6{padding:20px 20px 0}
#tab-settings .admin-spaces-subtabs{display:flex;gap:4px;margin:12px 0 10px;overflow-x:auto;scrollbar-width:none;background:none;border:0;padding:0}
#tab-settings .admin-spaces-subtab{flex:none;border:0;background:none;padding:6px 12px;border-radius:8px;color:var(--text-muted);font-weight:500;font-size:13px}
#tab-settings .admin-spaces-subtab.active{background:var(--sel,#ededed);color:var(--text-primary)}
.axm-list{padding:4px 0 0;display:flex;flex-direction:column;gap:10px}
.axm-card{border:1px solid var(--border);border-radius:14px;padding:16px;background:var(--surface-solid,var(--surface))}
.axm-top{display:flex;align-items:center;gap:12px}
.axm-av{width:36px;height:36px;border-radius:50%;background:var(--sel,#ededed);display:grid;place-items:center;font-weight:600;font-size:13px;flex:none;overflow:hidden}
.axm-av img{width:100%;height:100%;object-fit:cover}
.axm-who{flex:1;min-width:0}.axm-who b{display:block;font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.axm-who small{display:block;color:var(--text-muted);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.axm-meta{margin-top:10px;font-size:13px;color:var(--text-muted)}
.axm-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.axm-btns .ax{border:1px solid var(--border);background:none;color:var(--text-primary);border-radius:9px;padding:8px 14px;font:inherit;font-size:13px;font-weight:550;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.axm-btns .ax svg{width:14px;height:14px}
.axm-btns .ax-ok{background:var(--text-primary);color:var(--bg,#fff);border-color:var(--text-primary);box-shadow:none}
.axm-btns .ax-danger{color:var(--red,#d4372c)}
.axm-btns .ax-test,.axm-btns .ax-staff,.axm-btns .ax-rnp{box-shadow:none;background:none;color:var(--text-primary);border:1px solid var(--border)}
.axm-btns .ax:hover{background:var(--sel,#ededed)}.axm-btns .ax-ok:hover{opacity:.88;background:var(--text-primary)}
.axm-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}
.axm-chip{font-size:12px;border-radius:99px;padding:3px 10px;background:var(--sel,#ededed);color:var(--text-secondary)}
.axm-chip.amber{background:rgba(245,158,11,.14);color:#b45309}.axm-chip.purple{background:rgba(109,79,232,.12);color:#5b3fd0}.axm-chip.blue{background:rgba(59,130,246,.12);color:#2563eb}.axm-chip.red{background:rgba(212,55,44,.1);color:#d4372c}
.axm-row{display:flex;align-items:center;gap:12px;padding:12px 4px;border-bottom:1px solid var(--border)}.axm-row:last-child{border:0}
.axm-empty{padding:36px 20px;text-align:center;color:var(--text-muted);font-size:13px}
@media(max-width:760px){
 #tab-settings.active{display:block}
 #tab-settings>.settings-section-tabs{position:static;flex-direction:row;overflow-x:auto;scrollbar-width:none;white-space:nowrap;margin-bottom:16px}
 #tab-settings .security-session-row{flex-wrap:wrap}
 .axm-btns .ax{flex:1 1 auto;justify-content:center}.axm-btns .ax-ok{flex:1 1 100%}
 .axm-row{flex-wrap:wrap}
}`;

    function injectMinCss() {
        if (document.getElementById('nr-settings-min')) return;
        const st = document.createElement('style');
        st.id = 'nr-settings-min';
        st.textContent = MIN_CSS;
        document.head.appendChild(st);
    }

    function avatarOf(row) {
        const url = String(row.avatar_url || '').trim();
        return '<div class="axm-av">' + (url ? '<img src="' + escH(url) + '" alt="" referrerpolicy="no-referrer" loading="lazy" onerror="this.remove()">' : escH(spaceUserInitial(row))) + '</div>';
    }
    function emailLabel(row) {
        const tg = /^tg(\d+)@telegram\.nurcon\.kg$/i.exec(row.email || '');
        return tg ? 'Telegram · ID ' + tg[1] : (row.email || '—');
    }
    const axBtn = (cls, act, uid, icon, text) => '<button type="button" class="ax ' + cls + '" data-ax="' + act + '" data-uid="' + uid + '">' + (icon ? ICO[icon] : '') + '<span>' + esc(text) + '</span></button>';

    function renderRequests(rows) {
        if (!rows.length) return '<div class="axm-empty">Запросов на вход пока нет.</div>';
        return '<div class="axm-list">' + rows.map((s) => {
            const n = Number(s.sign_in_attempts) || 1;
            return '<div class="axm-card" data-uid="' + s.user_id + '"><div class="axm-top">' + avatarOf(s) +
                '<div class="axm-who"><b>' + escH(spaceDisplayName(s)) + '</b><small>' + escH(emailLabel(s)) + '</small></div><span class="axm-chip amber">В ожидании</span></div>' +
                '<div class="axm-meta">Пытался войти ' + escH(formatAttemptTime(s.last_sign_in_at)) + ' · ' + escH(formatAttemptIntensity(n)) + '</div>' +
                '<div class="axm-btns">' +
                '<button type="button" class="ax ax-ok" onclick="adminGrantSpaceAccess(\'' + s.user_id + '\', this)">' + ICO.check + '<span>Разрешить</span></button>' +
                axBtn('ax-rnp', 'rnp', s.user_id, 'eye', 'Только РНП') + axBtn('ax-staff', 'staff', s.user_id, 'user', 'Как сотрудник') + axBtn('ax-test', 'trial', s.user_id, 'gift', 'Тест: Фулл на 1 день') +
                '<button type="button" class="ax ax-danger" onclick="adminBlockSpace(\'' + s.user_id + '\', this)">' + ICO.ban + '<span>Заблокировать</span></button>' +
                '</div></div>';
        }).join('') + '</div>';
    }

    function renderAllowed(rows, counts) {
        if (!rows.length) return '<div class="axm-empty">Разрешённых спейсов пока нет</div>';
        return '<div class="axm-list">' + rows.map((s) => {
            const mine = isSuperAdminRow(s);
            const sp = AX.sp.get(s.user_id) || s;
            const pi = planInfo(Object.assign({}, s, { plan_until: sp.plan_until, tariff_plan: s.tariff_plan }));
            const staff = AX.staff.has(String(s.email || '').toLowerCase());
            const views = AX.viewers.get(s.user_id) || [];
            const nCab = counts[s.user_id] || 0;
            const chips = chip(pi.label, pi.cls).replace('acx-chip', 'axm-chip') + (staff ? '<span class="axm-chip purple">Сотрудник</span>' : '') +
                (views.length ? '<span class="axm-chip blue">Просмотр: ' + escH(views.map((v) => AX.cabName.get(v.cabinet_id) || 'кабинет').join(', ')) + ' · ' + escH((views[0].sections || ['all']).join(', ')) + '</span>' : '') +
                (nCab ? '<span class="axm-chip">' + escH(cabinetCountLabel(nCab)) + '</span>' : '');
            return '<div class="axm-card" data-uid="' + s.user_id + '"><div class="axm-top">' + avatarOf(s) +
                '<div class="axm-who"><b>' + escH(spaceDisplayName(s)) + (mine ? ' · создатель' : '') + '</b><small>' + escH(emailLabel(s)) + ' · ' + escH(formatLastSignIn(s.last_sign_in_at)) + '</small></div>' +
                (mine ? '' : axBtn('ax-manage', 'manage', s.user_id, 'gear', 'Управлять')) + '</div><div class="axm-chips" style="margin-top:10px">' + chips + '</div></div>';
        }).join('') + '</div>';
    }

    function renderBlocked(rows) {
        if (!rows.length) return '<div class="axm-empty">Заблокированных спейсов нет.</div>';
        return '<div class="axm-list">' + rows.map((s) =>
            '<div class="axm-card" data-uid="' + s.user_id + '"><div class="axm-top">' + avatarOf(s) +
            '<div class="axm-who"><b>' + escH(spaceDisplayName(s)) + '</b><small>' + escH(emailLabel(s)) + ' · ' + escH(formatAttemptTime(s.last_sign_in_at || s.updated_at)) + '</small></div></div>' +
            '<div class="axm-btns"><button type="button" class="ax ax-ok" onclick="adminUnblockSpace(\'' + s.user_id + '\', this)">' + ICO.check + '<span>Разблокировать</span></button>' +
            '<button type="button" class="ax ax-danger" onclick="adminDeleteUser(\'' + s.user_id + '\', this)">' + ICO.trash + '<span>Удалить</span></button></div></div>').join('') + '</div>';
    }

    function renderSpacesMin() {
        const wrap = document.getElementById(wrapId);
        const c = typeof _spacesAdminCache !== 'undefined' ? _spacesAdminCache : null;
        if (!wrap || !c) return;
        const set = (id, n) => { const el = document.getElementById('admin-spaces-count-' + id); if (el) el.textContent = String(n); };
        set('allowed', c.allowedRows.length); set('requests', c.requestRows.length); set('blocked', c.blockedRows.length);
        const tab = _spacesAdminTab === 'active' ? 'allowed' : _spacesAdminTab;
        wrap.innerHTML = tab === 'requests' ? renderRequests(c.requestRows) : tab === 'blocked' ? renderBlocked(c.blockedRows) : renderAllowed(c.allowedRows, c.counts || {});
    }

    // Кнопки карточек «Только РНП», «Как сотрудник», «Тест», «Управлять»: один обработчик на весь блок.
    function bindCards() {
        const wrap = document.getElementById(wrapId);
        if (!wrap || wrap.__axBound) return;
        wrap.__axBound = true;
        wrap.addEventListener('click', (e) => {
            const b = e.target.closest('[data-ax]');
            if (!b) return;
            const uid = b.dataset.uid;
            const row = AX.sp.get(uid) || rowsAll().find((r) => r.user_id === uid) || {};
            const mail = String(row.email || '').toLowerCase();
            const day = () => new Date(Date.now() + 864e5).toISOString();
            switch (b.dataset.ax) {
                case 'manage': openAccessModal(uid); break;
                case 'rnp':
                    act(uid, { status: 'active' }, () => authedPost({ action: 'activate', user_id: uid }), 'Доступ разрешён', 'Выберите кабинет: будет доступен только РНП.');
                    openViewerModal(uid, row.email);
                    break;
                case 'staff':
                    act(uid, { status: 'active', tariff_plan: 'premium', plan_until: null }, () => authedPost({ action: 'activate', user_id: uid, as_staff: true }),
                        'Сотрудник добавлен', 'Доступ разрешён, «Фулл» выдан, права сотрудника включены.',
                        { apply: () => { if (mail) AX.staff.add(mail); }, revert: () => { if (mail) AX.staff.delete(mail); } });
                    break;
                case 'trial':
                    act(uid, { status: 'active', tariff_plan: 'premium', plan_until: day() }, () => authedPost({ action: 'activate', user_id: uid, trial_days: 1 }),
                        'Тест на 1 день', 'Доступ разрешён, «Фулл» на 24 часа, потом замок до оплаты.');
                    break;
            }
        });
    }

    function installOverrides() {
        if (window.__axFast) return;
        window.__axFast = true;
        injectMinCss();
        bindCards();
        window.renderSpacesAdminView = function () { keepPlace(renderSpacesMin); };
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
                AX.sess[opts.listId] = listEl.innerHTML;
            };
            // Повторное открытие вкладки: сразу показываем прошлый список, свежий подтянется следом.
            AX.sess = AX.sess || {};
            if (AX.sess[opts.listId] && !listEl.querySelector('.security-session-row')) listEl.innerHTML = AX.sess[opts.listId];
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

    // ===== Остальные «долгие» кнопки кабинета: ответ сразу, тяжёлое (синхронизация WB) идёт в фоне =====
    function syncInBackground(cabinetId, mode, onDone) {
        return Promise.resolve().then(async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Сессия истекла, перезайдите.');
            const res = await fetch(AUTO_SYNC_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
                body: JSON.stringify({ mode, cabinet_id: cabinetId }),
            });
            const result = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(result.error || 'HTTP ' + res.status);
            return result;
        }).then(onDone, (e) => toast('error', 'Загрузка данных не удалась', (e && e.message) || 'Попробуйте ещё раз позже.'));
    }

    function addCabinetFast(read, closeForm, restoreForm) {
        const { name, token } = read();
        if (!name) { showPremiumModal('warning', 'Укажите название', 'Введите название нового кабинета.'); return; }
        if (!currentUserId) { showPremiumModal('error', 'Сессия', 'Войдите заново и повторите.'); return; }
        closeForm(); // окно закрывается сразу, кабинет создаётся в фоне
        toast('info', 'Добавляем кабинет', '«' + name + '»: проверяем токен.');
        supabase.functions.invoke('cabinet-token', { body: { action: 'create', name, token } }).then(({ data, error }) => {
            const cabinet = data && data.cabinet;
            if (error || !cabinet) {
                toast('error', 'Кабинет не добавился', 'Проверьте токен и повторите: введённые данные сохранены в окне.');
                restoreForm(name, token);
                return;
            }
            const long = !!(token && token.length > 50);
            toast('success', 'Кабинет добавлен', long ? 'Данные грузятся в фоне, они появятся сами.' : 'Токен можно добавить позже в «Кабинеты».');
            try { if (typeof loadCabinetsAPIList === 'function') loadCabinetsAPIList(); } catch (_) {}
            loadCabinets();
            if (long) {
                syncInBackground(cabinet.id, 'full', () => {
                    toast('success', 'Данные загружены', '«' + name + '»: заказы и остатки подтянуты.');
                    if (currentCabinetId === cabinet.id) { try { loadFromDB(); } catch (_) {} }
                });
            }
        });
    }

    function backgroundFlows() {
        window.submitAddCabinetModal = () => addCabinetFast(
            () => ({ name: (document.getElementById('modal-cabinet-name')?.value || '').trim(), token: (document.getElementById('modal-cabinet-token')?.value || '').trim().replace(/\s+/g, '') }),
            () => closeAddCabinetModal(),
            (n, t) => { openAddCabinetModal(); const a = document.getElementById('modal-cabinet-name'), b = document.getElementById('modal-cabinet-token'); if (a) a.value = n; if (b) b.value = t; });
        window.addNewCabinet = () => addCabinetFast(
            () => ({ name: (document.getElementById('new-cabinet-name')?.value || '').trim(), token: (document.getElementById('new-cabinet-token')?.value || '').trim().replace(/\s+/g, '') }),
            () => hideAddCabinetForm(),
            (n, t) => { showAddCabinetForm(); const a = document.getElementById('new-cabinet-name'), b = document.getElementById('new-cabinet-token'); if (a) a.value = n; if (b) b.value = t; });

        // «Синхронизировать сейчас»: кнопка не зависает на минуты, результат приходит уведомлением.
        let syncing = false;
        window.manualSync = function () {
            if (!hasUserCabinets || !currentCabinetId || syncing) return;
            syncing = true;
            const btn = document.getElementById('manual-sync-btn');
            if (btn) btn.textContent = 'Идёт загрузка…';
            const cab = currentCabinetId;
            toast('info', 'Синхронизация запущена', 'Идёт в фоне, можно работать дальше. Скажем, когда закончится.');
            syncInBackground(cab, 'full', async (result) => {
                if (currentCabinetId === cab) { try { await loadFromDB(); await loadLastSyncTime(); } catch (_) {} }
                const r = (result && result.results && result.results[0]) || {};
                toast('success', 'Синхронизация завершена', 'Загружено: ' + (r.stocks || 0) + ' остатков, ' + (r.orders || 0) + ' заказов.');
            }).then(() => { syncing = false; if (btn) btn.textContent = 'Синхронизировать сейчас'; });
        };

        // Заказы склада: старая таблица остаётся на месте, пока приходят новые.
        window.syncWarehouseOrdersNow = async function () {
            if (!hasUserCabinets || !currentCabinetId) return;
            const tbody = document.getElementById('warehouse-sales-tbody');
            const hasRows = !!(tbody && tbody.querySelector('tr td:not([colspan])'));
            if (tbody && !hasRows) tbody.innerHTML = '<tr><td colspan="5" class="text-center py-10" style="color:var(--text-muted)">Загружаем заказы из WB…</td></tr>';
            if (hasRows) toast('info', 'Обновляем заказы', 'Таблица обновится сама.');
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) throw new Error('Сессия истекла, перезайдите.');
                const res = await fetch(AUTO_SYNC_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
                    body: JSON.stringify({ mode: 'rnp', cabinet_id: currentCabinetId }),
                });
                const result = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(result.error || 'HTTP ' + res.status);
                _warehouseSalesLoadedForCabinet = null;
                await loadWarehouseSales(true);
            } catch (e) {
                if (hasRows) toast('error', 'Заказы не обновились', (e && e.message) || '');
                else if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center py-10" style="color:var(--red)">Не удалось загрузить заказы: ' + esc((e && e.message) || String(e)) + '<div class="mt-3"><button class="ui-btn ui-btn-secondary" style="padding:6px 14px;font-size:12px" onclick="syncWarehouseOrdersNow()">Повторить</button></div></td></tr>';
            }
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
        try { backgroundFlows(); } catch (_) {}
        const wrap = document.getElementById(wrapId);
        if (!wrap) return;
        bindCards();
        if (typeof _spacesAdminCache !== 'undefined' && _spacesAdminCache) renderSpacesMin();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();

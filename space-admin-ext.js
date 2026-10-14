// «Доступ к NR Space» (Настройки → Безопасность): сделать сотрудником и выдать «Фулл».
// Кнопки добавляются к строкам таблицы после каждой отрисовки; данные берутся из spaces и team_staff.
(function () {
    'use strict';
    const wrapId = 'admin-spaces-table-wrap';
    let busy = false;
    let timer = null;

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
        ban: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/></svg>',
        trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg>',
    };
    const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

    function mkBtn(text, cls, handler, icon) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = cls;
        b.setAttribute('data-ext', '1');
        const paint = () => { b.innerHTML = (icon ? ICO[icon] : '') + '<span>' + esc(text) + '</span>'; };
        paint();
        b.onclick = async () => {
            b.disabled = true; b.innerHTML = '<span>…</span>';
            try { await handler(); }
            catch (e) {
                showPremiumModal('error', 'Ошибка', e.message || 'Не получилось');
                b.disabled = false; paint();
            }
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
        const [cabs, cur] = await Promise.all([
            supabase.from('cabinets').select('id, name').order('name'),
            authedPost({ action: 'get_viewer', user_id: uid }),
        ]);
        const list = (cabs.data || []).filter(c => typeof isHiddenCabinet !== 'function' || !isHiddenCabinet(c));
        const have = new Set((cur.rows || []).map(r => r.cabinet_id));
        let secs = new Set(((cur.rows || [])[0]?.sections) || ['dashboard', 'rnp', 'goods']);
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
                else { secs.delete('all'); secs.has(k) ? secs.delete(k) : secs.add(k); if (!secs.size) secs.add('all'); }
                ov.querySelector('.nrv-pills').innerHTML = pills();
                return;
            }
            const save = e.target.closest('.nrv-save'), rem = e.target.closest('.nrv-remove');
            if (!save && !rem) return;
            const btn = save || rem;
            const ids = rem ? [] : [...ov.querySelectorAll('.nrv-cab input:checked')].map(i => i.value);
            if (save && !ids.length) { showPremiumModal('error', 'Выберите кабинет', 'Отметьте хотя бы один кабинет или нажмите «Убрать доступ».'); return; }
            btn.disabled = true;
            try {
                await authedPost({ action: 'set_viewer', user_id: uid, cabinet_ids: ids, sections: [...secs] });
                close();
                showPremiumModal('success', rem ? 'Доступ снят' : 'Доступ на просмотр выдан',
                    rem ? 'Пользователь больше не видит кабинеты.' : `Кабинетов: ${ids.length}. Изменять данные пользователь не сможет. Пусть обновит страницу.`);
                await refresh('allowed');
            } catch (err) {
                btn.disabled = false;
                showPremiumModal('error', 'Ошибка', err.message || 'Не получилось');
            }
        });
        document.body.appendChild(ov);
    }

    function emailOf(tr) {
        const m = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.exec(tr.textContent || '');
        return m ? m[0] : '';
    }

    async function refresh(tabAfter) {
        await loadSpacesAdmin();
        if (tabAfter) switchSpacesAdminTab(tabAfter);
    }

    async function decorate() {
        const wrap = document.getElementById(wrapId);
        if (!wrap || busy) return;
        const rows = [...wrap.querySelectorAll('tbody tr')].filter(tr => !tr.querySelector('[data-ext]'));
        if (!rows.length) return;
        busy = true;
        try {
            const [sp, st] = await Promise.all([
                supabase.from('spaces').select('user_id, email, tariff_plan, plan_until'),
                supabase.from('team_staff').select('email'),
            ]);
            const byId = new Map((sp.data || []).map(r => [r.user_id, r]));
            const staff = new Set((st.data || []).map(r => String(r.email || '').toLowerCase()));
            rows.forEach(tr => {
                if (tr.querySelector('[data-ext]')) return;
                const grant = tr.querySelector('button[onclick^="adminGrantSpaceAccess("]');
                const block = tr.querySelector('button[onclick^="adminBlockSpace("]');
                const box = tr.querySelector('.admin-space-actions') || (block || grant)?.parentElement;
                if (!box) return;
                styleNative(box);
                if (grant && !tr.querySelector('button[onclick^="adminUnblockSpace("]')) {
                    const uid = uidOf(grant);
                    // Запрос: разрешить сразу сотрудником с полной подпиской.
                    grant.after(mkBtn('Просмотр кабинета', 'ax ax-view', async () => { await openViewerModal(uid, emailOf(tr)); }, 'eye'));
                    // Новый клиент: разрешить вход и сразу выдать «Фулл» на 1 день (потом замок до оплаты).
                    grant.after(mkBtn('Тест: Фулл на 1 день', 'ax ax-test', async () => {
                        await authedPost({ action: 'activate', user_id: uid, trial_days: 1 });
                        showPremiumModal('success', 'Тест на 1 день', 'Доступ разрешён, «Фулл» выдан на 24 часа. Потом разделы закроются до оплаты.');
                        await refresh('allowed');
                    }, 'gift'));
                    grant.after(mkBtn('Как сотрудник', 'ax ax-staff', async () => {
                        await authedPost({ action: 'activate', user_id: uid, as_staff: true });
                        showPremiumModal('success', 'Сотрудник добавлен', 'Доступ разрешён, подписка «Фулл» выдана, права сотрудника включены.');
                        await refresh('allowed');
                    }, 'user'));
                    return;
                }
                if (block && !grant) {
                    const uid = uidOf(block);
                    const row = byId.get(uid);
                    if (!row) return;
                    const isStaff = staff.has(String(row.email || '').toLowerCase());
                    const planLive = !row.plan_until || new Date(row.plan_until).getTime() > Date.now();
                    const isFull = (row.tariff_plan === 'premium' || row.tariff_plan === 'vip') && planLive;
                    const untilTxt = isFull && row.plan_until ? ' до ' + new Date(row.plan_until).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
                    if (!isFull && !isStaff) {
                        block.before(mkBtn('Тест: Фулл на 1 день', 'ax ax-test', async () => {
                            await authedPost({ action: 'set_plan', user_id: uid, plan: 'premium', days: 1 });
                            showPremiumModal('success', 'Тест на 1 день', '«Фулл» выдан на 24 часа. Потом разделы закроются до оплаты.');
                            await refresh();
                        }, 'gift'));
                    }
                    block.before(
                        mkBtn('Просмотр кабинета', 'ax ax-view', async () => { await openViewerModal(uid, row.email || emailOf(tr)); }, 'eye'),
                        mkBtn(isStaff ? 'Сотрудник' : 'Сделать сотрудником', 'ax ax-staff' + (isStaff ? ' on' : ''), async () => {
                            await authedPost({ action: 'set_staff', user_id: uid, value: !isStaff });
                            showPremiumModal('success', isStaff ? 'Права сотрудника сняты' : 'Теперь сотрудник', isStaff ? 'Видит только свои кабинеты.' : 'Видит внутренние разделы команды и все кабинеты.');
                            await refresh();
                        }, isStaff ? 'userOk' : 'user'),
                        mkBtn(isFull ? 'Фулл' + untilTxt : 'Дать Фулл', 'ax ax-full' + (isFull ? ' on' : ''), async () => {
                            await authedPost({ action: 'set_plan', user_id: uid, plan: isFull ? 'start' : 'premium' });
                            showPremiumModal('success', isFull ? 'Подписка снята' : 'Подписка «Фулл» выдана', isFull ? 'Тариф «Бесплатный».' : 'Без срока, пока вы её не снимете.');
                            await refresh();
                        }, 'star')
                    );
                    styleNative(box);
                }
            });
        } catch (e) {
            console.warn('[space-admin-ext]', e.message || e);
        } finally {
            busy = false;
        }
    }

    function schedule() {
        clearTimeout(timer);
        timer = setTimeout(decorate, 60);
    }

    function init() {
        const wrap = document.getElementById(wrapId);
        if (!wrap) return;
        new MutationObserver(schedule).observe(wrap, { childList: true, subtree: true });
        schedule();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();

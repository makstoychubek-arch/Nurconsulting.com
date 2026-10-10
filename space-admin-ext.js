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

    function mkBtn(text, cls, handler) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = cls;
        b.setAttribute('data-ext', '1');
        b.textContent = text;
        b.onclick = async () => {
            b.disabled = true; b.textContent = '…';
            try { await handler(); }
            catch (e) {
                showPremiumModal('error', 'Ошибка', e.message || 'Не получилось');
                b.disabled = false; b.textContent = text;
            }
        };
        return b;
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
                supabase.from('spaces').select('user_id, email, tariff_plan'),
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
                if (grant && !tr.querySelector('button[onclick^="adminUnblockSpace("]')) {
                    const uid = uidOf(grant);
                    // Запрос: разрешить сразу сотрудником с полной подпиской.
                    grant.after(mkBtn('Просмотр кабинета', 'admin-btn-grant', async () => { await openViewerModal(uid, emailOf(tr)); }));
                    grant.after(mkBtn('Как сотрудник', 'admin-btn-grant', async () => {
                        await authedPost({ action: 'activate', user_id: uid, as_staff: true });
                        showPremiumModal('success', 'Сотрудник добавлен', 'Доступ разрешён, подписка «Фулл» выдана, права сотрудника включены.');
                        await refresh('allowed');
                    }));
                    return;
                }
                if (block && !grant) {
                    const uid = uidOf(block);
                    const row = byId.get(uid);
                    if (!row) return;
                    const isStaff = staff.has(String(row.email || '').toLowerCase());
                    const isFull = row.tariff_plan === 'premium' || row.tariff_plan === 'vip';
                    block.before(
                        mkBtn('Просмотр кабинета', 'admin-btn-grant', async () => { await openViewerModal(uid, row.email || emailOf(tr)); }),
                        mkBtn(isStaff ? 'Сотрудник ✓' : 'Сделать сотрудником', isStaff ? 'admin-btn-grant' : 'admin-btn-block', async () => {
                            await authedPost({ action: 'set_staff', user_id: uid, value: !isStaff });
                            showPremiumModal('success', isStaff ? 'Права сотрудника сняты' : 'Теперь сотрудник', isStaff ? 'Видит только свои кабинеты.' : 'Видит внутренние разделы команды и все кабинеты.');
                            await refresh();
                        }),
                        mkBtn(isFull ? 'Фулл ✓' : 'Дать Фулл', isFull ? 'admin-btn-grant' : 'admin-btn-block', async () => {
                            await authedPost({ action: 'set_plan', user_id: uid, plan: isFull ? 'start' : 'premium' });
                            showPremiumModal('success', isFull ? 'Подписка снята' : 'Подписка «Фулл» выдана', isFull ? 'Тариф «Бесплатный».' : 'Без срока, пока вы её не снимете.');
                            await refresh();
                        })
                    );
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

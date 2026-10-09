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

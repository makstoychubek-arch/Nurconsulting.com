/* Расходы для расчёта прибыли: налог, операционные, фулфилмент (ФФ).
   Хранится в браузере; ФФ — по кабинету. Открывается кнопкой «Изменить» в карточке «Налоги и затраты». */
(function () {
    'use strict';
    function cab() { try { return window.currentCabinetId || (typeof currentCabinetId !== 'undefined' ? currentCabinetId : ''); } catch (e) { return ''; } }
    function get(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
    function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    function num(v) { const n = Number(String(v).replace(',', '.')); return n > 0 ? String(n) : '0'; }
    const INP = 'width:100%;box-sizing:border-box;padding:10px 12px;border-radius:12px;border:1px solid var(--border);background:var(--surface);color:var(--text-primary);font-size:15px;margin-top:5px';
    function field(id, label, hint, val) {
        return '<label style="display:block;text-align:left;margin:0 0 12px;font-size:12.5px;font-weight:700;color:var(--text-secondary)">' + label +
            '<input id="' + id + '" type="number" inputmode="decimal" min="0" placeholder="0" value="' + (val || '') + '" style="' + INP + '">' +
            '<small style="display:block;font-weight:400;color:var(--text-muted);margin-top:4px">' + hint + '</small></label>';
    }
    function close(ov) { ov.remove(); }
    function open() {
        const c = cab();
        const ov = document.createElement('div');
        ov.className = 'nx-ov';
        ov.innerHTML = '<div class="nx-modal">' +
            '<h3>Расходы для прибыли</h3><p class="nx-sm">Вводятся вручную, считаются пропорционально выбранному периоду и вычитаются из прибыли.</p>' +
            field('nc-ff', 'Фулфилмент (ФФ) в месяц, сом', 'Расходы на склад ФФ — только для выбранного кабинета', get('ff_cost_' + c)) +
            field('nc-opex', 'Прочие операционные расходы в месяц, сом', 'Аренда, зарплаты и т.п.', get('opex')) +
            field('nc-tax', 'Налог, %', '0 — если налог не платите', get('tax_rate_v2')) +
            '<button type="button" class="nx-go" data-save="1">Сохранить</button> ' +
            '<button type="button" class="nx-b" data-x="1" style="padding:10px 16px">Отмена</button></div>';
        ov.addEventListener('click', (e) => {
            if (e.target === ov || e.target.closest('[data-x]')) return close(ov);
            if (!e.target.closest('[data-save]')) return;
            if (c) { const v = num(ov.querySelector('#nc-ff').value); set('ff_cost_' + c, v); if (get('ff_on_' + c) === '' && v !== '0') set('ff_on_' + c, '1'); }
            set('opex', num(ov.querySelector('#nc-opex').value));
            set('tax_rate_v2', num(ov.querySelector('#nc-tax').value));
            close(ov);
            try { if (typeof loadFromDB === 'function') loadFromDB(); } catch (err) {}
        });
        document.body.appendChild(ov);
        ov.querySelector('#nc-ff').focus();
    }
    function toggleFf(on) {
        const c = cab();
        if (c) set('ff_on_' + c, on ? '1' : '0');
        try { if (typeof loadFromDB === 'function') loadFromDB(); } catch (err) {}
    }
    window.NrCosts = { open: open, toggleFf: toggleFf };
})();

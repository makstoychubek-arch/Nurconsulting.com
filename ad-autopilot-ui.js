/* Автопилот ставок в разделе «Контроль РК»: по крону сам подгоняет ставки по каждому артикулу под цену заказа.
 * Настройки хранятся в ad_autopilot_settings / ad_autopilot_campaigns, журнал в ad_autopilot_log.
 * Сам считает и меняет серверная функция ad-autopilot (каждые 3 часа); здесь только настройки и журнал. */
(function () {
    'use strict';
    var root = null, state = { cab: null, open: false, loaded: false, busy: false };
    var MODES = { off: 'Выключен', dry: 'Пробный (только журнал)', live: 'Боевой (меняет ставки)' };

    function sb() { return window.supabase; }
    function cabId() { try { return localStorage.getItem('selected_cabinet_id') || window.currentCabinetId || null; } catch (e) { return window.currentCabinetId || null; } }
    function h(tag, attrs, kids) {
        var el = document.createElement(tag);
        for (var k in (attrs || {})) {
            if (k === 'class') el.className = attrs[k];
            else if (k === 'text') el.textContent = attrs[k];
            else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), attrs[k]);
            else if (attrs[k] != null && attrs[k] !== false) el.setAttribute(k, attrs[k]);
        }
        (kids || []).forEach(function (c) { if (c) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
        return el;
    }
    function fmtTime(iso) { try { return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) { return iso; } }

    var CSS = '#ad-autopilot-card{margin-bottom:16px}.adp{border:1px solid var(--border,rgba(0,0,0,.1));border-radius:16px;background:var(--surface,#fff);overflow:hidden}' +
        '.adp-head{display:flex;align-items:center;gap:12px;padding:14px 18px;cursor:pointer}.adp-title{font-weight:700;font-size:15px}.adp-sub{font-size:12px;color:var(--text-muted,#71717a)}' +
        '.adp-pill{margin-left:auto;font-size:12px;font-weight:600;padding:4px 10px;border-radius:999px;background:var(--sel,#eee);color:var(--text-secondary,#444)}' +
        '.adp-pill.live{background:rgba(22,163,74,.14);color:#15803d}.adp-pill.dry{background:rgba(245,158,11,.16);color:#b45309}' +
        '.adp-body{padding:4px 18px 18px;border-top:1px solid var(--border,rgba(0,0,0,.08))}.adp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:14px 0}' +
        '.adp label{display:block;font-size:12px;color:var(--text-muted,#71717a);margin-bottom:4px}.adp input,.adp select{width:100%;box-sizing:border-box;padding:8px 10px;border-radius:10px;border:1px solid var(--border,rgba(0,0,0,.14));background:transparent;color:inherit;font:inherit}' +
        '.adp-camps{display:flex;flex-direction:column;gap:6px;margin:8px 0 14px;max-height:220px;overflow:auto}.adp-camp{display:flex;gap:8px;align-items:center;font-size:13px}.adp-camp input{width:auto}' +
        '.adp-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}.adp-btn{border:0;border-radius:10px;padding:9px 16px;font-weight:600;cursor:pointer;background:var(--text-primary,#111);color:var(--bg,#fff)}.adp-btn.alt{background:var(--sel,#eee);color:inherit}' +
        '.adp-note{font-size:12px;color:var(--text-muted,#71717a);margin:8px 0}.adp-log{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:8px}.adp-log td,.adp-log th{padding:6px 6px;border-bottom:1px solid var(--border,rgba(0,0,0,.08));text-align:left}' +
        '.adp-up{color:#15803d}.adp-down{color:#b91c1c}.adp-msg{font-size:13px;margin-top:10px}';

    function ensureRoot() {
        root = document.getElementById('ad-autopilot-card');
        if (root && !document.getElementById('adp-style')) { var st = h('style', { id: 'adp-style', text: CSS }); document.head.appendChild(st); }
        return root;
    }

    async function load() {
        var cab = cabId();
        if (!root || !cab || !sb()) return;
        state.cab = cab;
        var q = function (p) { return p.then(function (r) { return r; }); };
        var res = await Promise.all([
            q(sb().from('ad_autopilot_settings').select('*').eq('cabinet_id', cab).maybeSingle()),
            q(sb().from('ad_autopilot_campaigns').select('campaign_id').eq('cabinet_id', cab)),
            q(sb().from('advertising_campaigns').select('campaign_id,campaign_name,status,payment_type').eq('cabinet_id', cab).eq('payment_type', 'cpc').in('status', [9, 11])),
            q(sb().from('ad_autopilot_log').select('*').eq('cabinet_id', cab).order('created_at', { ascending: false }).limit(15)),
        ]);
        state.settings = res[0].data || null;
        state.chosen = new Set((res[1].data || []).map(function (r) { return Number(r.campaign_id); }));
        state.campaigns = (res[2].data || []).sort(function (a, b) { return String(a.campaign_name).localeCompare(String(b.campaign_name)); });
        state.log = res[3].data || [];
        var nms = Array.from(new Set(state.log.map(function (l) { return l.nm_id; }).filter(Boolean)));
        state.names = {};
        if (nms.length) {
            var n = await sb().from('rnp_articles').select('nm_id,name').eq('cabinet_id', cab).in('nm_id', nms);
            (n.data || []).forEach(function (r) { state.names[r.nm_id] = r.name; });
        }
        state.loaded = true;
        render();
    }

    function modeOf(s) { return !s || !s.enabled ? 'off' : (s.dry_run === false ? 'live' : 'dry'); }

    function render() {
        if (!root) return;
        var s = state.settings || {}, mode = modeOf(state.settings);
        var pill = h('span', { class: 'adp-pill ' + mode, text: mode === 'live' ? 'Боевой' : mode === 'dry' ? 'Пробный' : 'Выключен' });
        var head = h('div', { class: 'adp-head', onclick: function () { state.open = !state.open; render(); } }, [
            h('div', {}, [h('div', { class: 'adp-title', text: 'Автопилот ставок' }), h('div', { class: 'adp-sub', text: 'Сам по крону подгоняет ставки каждого артикула под выгодную цену заказа' })]), pill,
        ]);
        var card = h('div', { class: 'adp' }, [head]);
        if (state.open) card.appendChild(body(s, mode));
        root.textContent = '';
        root.appendChild(card);
    }

    function field(label, id, value, attrs) {
        return h('div', {}, [h('label', { for: id, text: label }), h('input', Object.assign({ id: id, value: value }, attrs || {}))]);
    }

    function body(s, mode) {
        var el = h('div', { class: 'adp-body' });
        var sel = h('select', { id: 'adp-mode' }, Object.keys(MODES).map(function (k) { var o = h('option', { value: k, text: MODES[k] }); if (k === mode) o.selected = true; return o; }));
        el.appendChild(h('div', { class: 'adp-grid' }, [
            h('div', {}, [h('label', { text: 'Режим' }), sel]),
            field('Потолок ДРР, %', 'adp-drr', s.max_drr_pct != null ? s.max_drr_pct : 15, { type: 'number', min: 1, max: 100, step: 1 }),
            field('Доля от предельной цены заказа, %', 'adp-share', Math.round((s.target_share != null ? s.target_share : 0.7) * 100), { type: 'number', min: 10, max: 100, step: 5 }),
            field('Мин. ставка, сом', 'adp-min', (s.min_bid_kop || 300) / 100, { type: 'number', min: 1, step: 0.5 }),
            field('Макс. ставка, сом', 'adp-max', (s.max_bid_kop || 1600) / 100, { type: 'number', min: 1, step: 0.5 }),
            field('Шаг, %', 'adp-step', s.step_pct || 10, { type: 'number', min: 1, max: 50, step: 1 }),
        ]));
        el.appendChild(h('div', { class: 'adp-note', text: 'Выберите кампании за клик (СРС), которыми управляет автопилот. Включать, выключать и пополнять бюджет он не умеет, только менять ставки артикулов.' }));
        var list = h('div', { class: 'adp-camps' });
        var seen = new Set();
        state.campaigns.forEach(function (c) {
            seen.add(Number(c.campaign_id));
            list.appendChild(h('label', { class: 'adp-camp' }, [h('input', { type: 'checkbox', 'data-cid': c.campaign_id, checked: state.chosen.has(Number(c.campaign_id)) ? 'checked' : null }), c.campaign_name + (Number(c.status) === 11 ? ' (на паузе)' : '')]));
        });
        if (!state.campaigns.length) list.appendChild(h('div', { class: 'adp-note', text: 'Кампаний СРС пока нет в списке (появятся после синхронизации).' }));
        el.appendChild(list);
        var msg = h('div', { class: 'adp-msg', id: 'adp-msg' });
        el.appendChild(h('div', { class: 'adp-btns' }, [
            h('button', { class: 'adp-btn', text: 'Сохранить', onclick: save }),
            h('button', { class: 'adp-btn alt', text: 'Проверить сейчас', onclick: function () { runNow(false); } }),
            mode === 'live' ? h('button', { class: 'adp-btn alt', text: 'Применить сейчас', onclick: function () { runNow(true); } }) : null,
        ]));
        el.appendChild(msg);
        el.appendChild(h('div', { class: 'adp-note', text: 'Как решает: цена заказа за 3 полных дня сравнивается с целью (доля от прибыли на выкуп и потолок ДРР). Заказ дешевле цели: ставка вверх на шаг, дороже: вниз. Артикул не чаще раза за ~11 часов. Прогон каждые 3 часа, сводка в Telegram утром.' }));
        el.appendChild(logTable());
        return el;
    }

    function logTable() {
        var wrap = h('div', {});
        wrap.appendChild(h('div', { class: 'adp-sub', text: 'Последние изменения' }));
        if (!state.log.length) { wrap.appendChild(h('div', { class: 'adp-note', text: 'Пока пусто. Автопилот ждёт данных за 3 полных дня по включённым кампаниям.' })); return wrap; }
        var t = h('table', { class: 'adp-log' }, [h('tr', {}, ['Когда', 'Артикул', 'Ставка', 'Цена заказа / цель', 'Почему'].map(function (x) { return h('th', { text: x }); }))]);
        state.log.forEach(function (l) {
            var arrow = l.action === 'raise' ? '↑' : l.action === 'lower' ? '↓' : '·';
            t.appendChild(h('tr', {}, [
                h('td', { text: fmtTime(l.created_at) + (l.applied ? '' : ' (пробно)') }),
                h('td', { text: (state.names[l.nm_id] || l.nm_id) }),
                h('td', { class: l.action === 'raise' ? 'adp-up' : 'adp-down', text: arrow + ' ' + (l.old_bid / 100) + ' → ' + (l.new_bid / 100) }),
                h('td', { text: (l.cpo != null ? Math.round(l.cpo) : '—') + ' / ' + (l.target_cpo != null ? Math.round(l.target_cpo) : '—') }),
                h('td', { text: l.reason || '' }),
            ]));
        });
        wrap.appendChild(t);
        return wrap;
    }

    function say(text, bad) { var m = document.getElementById('adp-msg'); if (m) { m.textContent = text; m.style.color = bad ? '#b91c1c' : ''; } }

    async function save() {
        if (state.busy) return; state.busy = true;
        try {
            var cab = state.cab, mode = document.getElementById('adp-mode').value;
            var num = function (id, d) { var v = Number(document.getElementById(id).value); return isFinite(v) && v > 0 ? v : d; };
            var minB = Math.round(num('adp-min', 3) * 100), maxB = Math.round(num('adp-max', 16) * 100);
            if (maxB < minB) { say('Максимальная ставка меньше минимальной', true); return; }
            var row = {
                cabinet_id: cab, enabled: mode !== 'off', dry_run: mode !== 'live', max_drr_pct: num('adp-drr', 15), target_share: Math.min(1, num('adp-share', 70) / 100),
                min_bid_kop: minB, max_bid_kop: maxB, step_pct: Math.min(50, Math.round(num('adp-step', 10))), updated_at: new Date().toISOString(),
            };
            var r = await sb().from('ad_autopilot_settings').upsert(row, { onConflict: 'cabinet_id' });
            if (r.error) throw r.error;
            var ids = Array.from(root.querySelectorAll('input[data-cid]')).filter(function (i) { return i.checked; }).map(function (i) { return Number(i.getAttribute('data-cid')); });
            var del = await sb().from('ad_autopilot_campaigns').delete().eq('cabinet_id', cab);
            if (del.error) throw del.error;
            if (ids.length) { var ins = await sb().from('ad_autopilot_campaigns').insert(ids.map(function (c) { return { cabinet_id: cab, campaign_id: c }; })); if (ins.error) throw ins.error; }
            state.settings = row; state.chosen = new Set(ids);
            say('Сохранено');
            render(); say('Сохранено');
        } catch (e) { say('Не сохранилось: ' + (e.message || e), true); } finally { state.busy = false; }
    }

    async function runNow(apply) {
        say('Считаю…');
        try {
            var r = await sb().functions.invoke('ad-autopilot', { body: { cabinet_id: state.cab, apply: apply === true } });
            if (r.error) throw r.error;
            var x = (r.data && r.data.results && r.data.results[0]) || {};
            var text = x.skipped
                ? 'Пропущено: ' + ({ no_campaigns: 'не выбраны кампании', no_token: 'нет токена рекламы', no_active_cpc: 'нет работающих СРС среди выбранных' }[x.skipped] || x.skipped)
                : (x.dry_run ? 'Пробный прогон: ' : 'Готово: ') + 'изменений ' + (x.changes || 0) + ', без изменений ' + (x.holds || 0) + (x.errors && x.errors.length ? '. Ошибки: ' + x.errors.join('; ') : '');
            await load();
            say(text);
        } catch (e) { say('Не вышло: ' + (e.message || e), true); }
    }

    function tick() {
        var tab = document.getElementById('tab-advertising');
        if (!tab || !tab.classList.contains('active')) return;
        if (!ensureRoot()) return;
        var cab = cabId();
        if (cab && (cab !== state.cab || !state.loaded)) { state.loaded = false; load().catch(function () {}); }
        else if (!root.firstChild && state.loaded) render();
    }

    window.loadAdAutopilot = function () { state.loaded = false; tick(); };
    setInterval(tick, 1500);
})();

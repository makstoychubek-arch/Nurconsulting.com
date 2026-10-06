/* Автопилот ставок в разделе «Контроль РК»: по крону сам подгоняет ставки по каждому артикулу под цену заказа.
 * Настройки хранятся в ad_autopilot_settings / ad_autopilot_campaigns, журнал в ad_autopilot_log.
 * Сам считает и меняет серверная функция ad-autopilot (каждые 3 часа); здесь только настройки и журнал. */
(function () {
    'use strict';
    var root = null, state = { cab: null, open: false, loaded: false, busy: false };
    var auto = { camps: {}, settings: {}, loaded: false };
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
        '.adp-head{display:flex;align-items:center;gap:12px;padding:12px 16px}.adp-title{font-weight:700;font-size:15px}.adp-sub{font-size:12px;color:var(--text-muted,#71717a)}' +
        '.adp-x{border:0;background:transparent;color:var(--text-muted,#71717a);font-size:20px;line-height:1;cursor:pointer;padding:0 4px}.adx-pills{display:inline-flex;gap:2px;align-items:center}.adx-ico{position:relative}.adx-ico.open{background:var(--sel,#eee);color:var(--accent)}.adx-ico i{position:absolute;top:4px;right:4px;width:6px;height:6px;border-radius:50%;background:#a1a1aa}.adx-ico i.live{background:#22c55e}.adx-ico i.dry{background:#f59e0b}.adx-pill{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 11px;border-radius:999px;border:1px solid var(--border,rgba(0,0,0,.12));background:transparent;color:var(--text-secondary,#444);font:600 12px/1 inherit;font-family:inherit;cursor:pointer;white-space:nowrap}.adx-pill i{width:7px;height:7px;border-radius:50%;background:#a1a1aa}.adx-pill i.live{background:#22c55e}.adx-pill i.dry{background:#f59e0b}.adx-pill.open{background:var(--sel,#eee)}.adp-head{cursor:default}' +
        '.adp-pill{margin-left:auto;font-size:12px;font-weight:600;padding:4px 10px;border-radius:999px;background:var(--sel,#eee);color:var(--text-secondary,#444)}' +
        '.adp-pill.live{background:rgba(22,163,74,.14);color:#15803d}.adp-pill.dry{background:rgba(245,158,11,.16);color:#b45309}' +
        '.adp-body{padding:4px 18px 18px;border-top:1px solid var(--border,rgba(0,0,0,.08))}.adp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:14px 0}' +
        '.adp label{display:block;font-size:12px;color:var(--text-muted,#71717a);margin-bottom:4px}.adp input,.adp select{width:100%;box-sizing:border-box;padding:8px 10px;border-radius:10px;border:1px solid var(--border,rgba(0,0,0,.14));background:transparent;color:inherit;font:inherit}' +
        '' +
        '.adp-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}.adp-btn{border:0;border-radius:10px;padding:9px 16px;font-weight:600;cursor:pointer;background:var(--text-primary,#111);color:var(--bg,#fff)}.adp-btn.alt{background:var(--sel,#eee);color:inherit}' +
        '.adp-note{font-size:12px;color:var(--text-muted,#71717a);margin:8px 0}.adp-log{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:8px}.adp-log td,.adp-log th{padding:6px 6px;border-bottom:1px solid var(--border,rgba(0,0,0,.08));text-align:left}' +
        '.adp-tg{position:relative;flex:none;margin-left:auto;width:42px;height:22px;border-radius:999px;background:var(--sel,#d4d4d8);border:1px solid var(--border,rgba(0,0,0,.12));cursor:pointer;transition:background .2s,border-color .2s;align-self:center}.adp-tg i{position:absolute;top:2px;left:calc(50% - 8px);width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.35);transition:left .2s}.adp-tg::before{content:"";display:none;position:absolute;right:calc(100% + 7px);top:50%;transform:translateY(-50%);font-size:11px;font-weight:700;letter-spacing:.02em;color:var(--text-muted,#71717a)}.adp-tg.on::before{color:#16a34a}.adp-tg{margin-right:2px}.adp-tg.on{background:#22c55e;border-color:#16a34a}.adp-tg.on i{left:calc(100% - 19px)}.adp-tg.on.idle{background:#86efac;border-color:#4ade80}.adp-tg.busy{opacity:.55;pointer-events:none}' +
        '.adp-up{color:#15803d}.adp-down{color:#b91c1c}.adp-msg{font-size:13px;margin-top:10px}';

    /* ---- переключатели «авто» у кампаний ---- */
    async function loadAuto() {
        if (!sb()) return;
        var r = await Promise.all([sb().from('ad_autopilot_campaigns').select('cabinet_id,campaign_id'), sb().from('ad_autopilot_settings').select('cabinet_id,enabled,dry_run')]);
        if (r[0].error || r[1].error) throw (r[0].error || r[1].error);
        auto.camps = {}; auto.settings = {};
        (r[0].data || []).forEach(function (x) { (auto.camps[x.cabinet_id] = auto.camps[x.cabinet_id] || new Set()).add(String(x.campaign_id)); });
        (r[1].data || []).forEach(function (x) { auto.settings[x.cabinet_id] = { enabled: x.enabled, dry_run: x.dry_run }; });
        auto.loaded = true;
        paint();
    }
    function isOn(cab, camp) { return !!(auto.camps[cab] && auto.camps[cab].has(String(camp))); }
    function paint() {
        document.querySelectorAll('.adp-tg').forEach(function (el) {
            var cab = el.getAttribute('data-adp-cab'), camp = el.getAttribute('data-adp-camp');
            var on = isOn(cab, camp), idle = on && !(auto.settings[cab] && auto.settings[cab].enabled);
            if (el.classList.contains('on') !== on) el.classList.toggle('on', on);
            if (el.classList.contains('idle') !== idle) el.classList.toggle('idle', idle);
            el.setAttribute('aria-checked', on ? 'true' : 'false');
            el.title = on ? 'Автопилот ставок включён: сам подгоняет ставки артикулов' : 'Автопилот ставок выключен. Нажмите, чтобы кампанией управлял автопилот';
        });
    }
    async function flip(el) {
        var cab = el.getAttribute('data-adp-cab'), camp = el.getAttribute('data-adp-camp');
        var turnOn = !isOn(cab, camp);
        el.classList.add('busy');
        try {
            if (turnOn) {
                var st = auto.settings[cab];
                if (!st || !st.enabled) {
                    var up = await sb().from('ad_autopilot_settings').upsert({ cabinet_id: cab, enabled: true, dry_run: st ? st.dry_run !== false : true, updated_at: new Date().toISOString() }, { onConflict: 'cabinet_id' });
                    if (up.error) throw up.error;
                    auto.settings[cab] = { enabled: true, dry_run: st ? st.dry_run !== false : true };
                }
                var ins = await sb().from('ad_autopilot_campaigns').upsert({ cabinet_id: cab, campaign_id: Number(camp) }, { onConflict: 'cabinet_id,campaign_id' });
                if (ins.error) throw ins.error;
                (auto.camps[cab] = auto.camps[cab] || new Set()).add(String(camp));
            } else {
                var del = await sb().from('ad_autopilot_campaigns').delete().eq('cabinet_id', cab).eq('campaign_id', Number(camp));
                if (del.error) throw del.error;
                if (auto.camps[cab]) auto.camps[cab].delete(String(camp));
            }
        } catch (e) { alert('Автопилот не переключился: ' + (e.message || e)); }
        el.classList.remove('busy');
        paint();
        if (root && state.loaded) { state.loaded = false; tick(); }
    }
    document.addEventListener('click', function (ev) {
        var el = ev.target.closest && ev.target.closest('.adp-tg');
        if (!el) return;
        ev.preventDefault(); ev.stopPropagation(); flip(el);
    }, true);
    document.addEventListener('keydown', function (ev) {
        if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.classList && ev.target.classList.contains('adp-tg')) { ev.preventDefault(); flip(ev.target); }
    });
    var paintTimer = null;
    function watchTable() {
        var tab = document.getElementById('tab-advertising');
        if (!tab || tab._adpWatched) return;
        tab._adpWatched = true;
        new MutationObserver(function () { clearTimeout(paintTimer); paintTimer = setTimeout(paint, 40); }).observe(tab, { childList: true, subtree: true });
    }

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
            q(sb().from('ad_autopilot_log').select('*').eq('cabinet_id', cab).order('created_at', { ascending: false }).limit(15)),
        ]);
        state.settings = res[0].data || null;
        state.log = res[1].data || [];
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
        paintPill(mode);
        root.textContent = '';
        root.style.display = state.open ? '' : 'none';
        if (!state.open) return;
        var title = h('div', { class: 'adp-title', text: 'Автопилот ставок' });
        var close = h('button', { class: 'adp-x', title: 'Закрыть', text: '×', onclick: function () { state.open = false; render(); } });
        var card = h('div', { class: 'adp' }, [h('div', { class: 'adp-head' }, [title, h('span', { class: 'adp-pill ' + mode, text: mode === 'live' ? 'Боевой' : mode === 'dry' ? 'Пробный' : 'Выключен' }), close]), body(s, mode)]);
        root.appendChild(card);
    }

    /* Маленькие кнопки справа в панели инструментов: «Автопилот» (тут) и «Автобиддер» (ads-campaign-detail.js) */
    function pillBox() {
        var tools = document.getElementById('ads-hq-tools');
        if (!tools) return null;
        var box = document.getElementById('adx-pills');
        if (!box) { box = h('div', { id: 'adx-pills', class: 'adx-pills' }); tools.insertBefore(box, tools.firstChild); }
        return box;
    }
    function paintPill(mode) {
        var el = document.getElementById('adx-pill-ap');
        if (!el) return;
        el.className = 'rnp-tool-icon adx-ico' + (state.open ? ' open' : '');
        el.querySelector('i').className = mode === 'live' ? 'live' : mode === 'dry' ? 'dry' : '';
        el.title = mode === 'live' ? 'Автопилот: боевой' : mode === 'dry' ? 'Автопилот: пробный режим' : 'Автопилот выключен';
    }
    function ensurePill() {
        var box = pillBox();
        if (!box || document.getElementById('adx-pill-ap')) return;
        var btn = h('button', { type: 'button', id: 'adx-pill-ap', class: 'rnp-tool-icon adx-ico', onclick: function () { state.open = !state.open; if (state.open && !state.loaded) { load().catch(function () {}); } render(); } }, [h('i')]);
        btn.insertAdjacentHTML('afterbegin', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"></path><path d="M18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"></path></svg>');
        box.insertBefore(btn, box.firstChild);
        paintPill(modeOf(state.settings));
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
        el.appendChild(h('div', { class: 'adp-note', text: 'Включайте автопилот переключателем «авто» справа у нужной кампании СРС в списке ниже. Включать, выключать кампании и пополнять бюджет он не умеет, только меняет ставки артикулов.' }));
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
                min_bid_kop: minB, max_bid_kop: maxB, step_pct: Math.max(1, Math.min(50, Math.round(num('adp-step', 10)))), updated_at: new Date().toISOString(),
            };
            var r = await sb().from('ad_autopilot_settings').upsert(row, { onConflict: 'cabinet_id' });
            if (r.error) throw r.error;
            state.settings = row; auto.settings[cab] = { enabled: row.enabled, dry_run: row.dry_run };
            render(); say('Сохранено'); paint();
        } catch (e) { say('Не сохранилось: ' + (e.message || e), true); } finally { state.busy = false; }
    }

    async function runNow(apply) {
        say('Считаю…');
        try {
            var r = await sb().functions.invoke('ad-autopilot', { body: { cabinet_id: state.cab, apply: apply === true } });
            if (r.error) throw r.error;
            var x = (r.data && r.data.results && r.data.results[0]) || {};
            var text = x.skipped
                ? 'Пропущено: ' + ({ no_campaigns: 'нет работающих СРС-кампаний', no_token: 'нет токена рекламы', no_active_cpc: 'нет работающих СРС-кампаний' }[x.skipped] || x.skipped)
                : (x.dry_run ? 'Пробный прогон: ' : 'Готово: ') + 'изменений ' + (x.changes || 0) + ', без изменений ' + (x.holds || 0) + (x.errors && x.errors.length ? '. Ошибки: ' + x.errors.join('; ') : '');
            await load();
            say(text);
        } catch (e) { say('Не вышло: ' + (e.message || e), true); }
    }

    var fails = 0;
    function tick() {
        var tab = document.getElementById('tab-advertising');
        if (document.hidden || !tab || !tab.classList.contains('active')) return;
        if (!document.getElementById('adp-style')) document.head.appendChild(h('style', { id: 'adp-style', text: CSS }));
        watchTable();
        ensurePill();
        if (!auto.loaded && fails < 3) loadAuto().catch(function () { fails++; });
        if (!ensureRoot()) return;
        var bulk = document.querySelector('#adv-view-ads .ads-hq-bulk');
        if (bulk && root.previousElementSibling !== bulk && root.parentNode !== bulk.parentNode) bulk.parentNode.insertBefore(root, bulk.nextSibling);
        var cab = cabId();
        if (cab && (cab !== state.cab || !state.loaded)) { if (fails < 3) { state.loaded = false; load().catch(function () { fails++; }); } }
        else if (!root.firstChild && state.loaded) render();
    }

    window.loadAdAutopilot = function () { fails = 0; state.loaded = false; auto.loaded = false; tick(); };
    setInterval(tick, 1500);
})();

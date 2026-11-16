/* Продвижение для Ozon: кампании рекламного кабинета Ozon за выбранный период (только чтение).
   Включается переключателем WB | Ozon | Вместе (NrMp). Данные берутся из ozon_ads_daily (её наполняет ozon-sync из Performance API):
   расход, показы, клики, заказы и выручка по дням и кампаниям. Запуск и пополнение кампаний остаются в кабинете Ozon.
   Правило проекта: сначала показываем сохранённое на устройстве, свежее подтягиваем в фоне и подставляем без перерисовки всего экрана. */
(function (root) {
    'use strict';
    var doc = root.document;

    function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
    function fmt(n) { return isFinite(n) ? Math.round(n).toLocaleString('ru-RU').replace(/[  ]/g, ' ') : '—'; }
    function pct(n) { return isFinite(n) ? n.toFixed(1).replace('.', ',') + '%' : '—'; }
    function money(n) { return isFinite(n) ? n.toFixed(2).replace('.', ',') : '—'; }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

    // Свод по кампаниям и общий итог. rows: строки ozon_ads_daily (d, campaign_id, title, impressions, clicks, spend, orders, orders_sum)
    function agg(rows) {
        var by = {}, tot = { spend: 0, impressions: 0, clicks: 0, orders: 0, revenue: 0 };
        (rows || []).forEach(function (r) {
            var id = String(r.campaign_id || ''); if (!id) return;
            var c = by[id] || (by[id] = { id: id, title: '', spend: 0, impressions: 0, clicks: 0, orders: 0, revenue: 0, last: '' });
            if (r.title) c.title = String(r.title);
            c.spend += num(r.spend); c.impressions += num(r.impressions); c.clicks += num(r.clicks); c.orders += num(r.orders); c.revenue += num(r.orders_sum);
            var d = String(r.d || '').slice(0, 10); if (d > c.last && (num(r.impressions) > 0 || num(r.spend) > 0)) c.last = d;
        });
        var list = Object.keys(by).map(function (k) { return by[k]; });
        list.forEach(function (c) {
            tot.spend += c.spend; tot.impressions += c.impressions; tot.clicks += c.clicks; tot.orders += c.orders; tot.revenue += c.revenue;
            c.ctr = c.impressions > 0 ? c.clicks / c.impressions * 100 : NaN;
            c.cpc = c.clicks > 0 ? c.spend / c.clicks : NaN;
            c.drr = c.revenue > 0 ? c.spend / c.revenue * 100 : NaN;
        });
        list.sort(function (a, b) { return b.spend - a.spend || b.impressions - a.impressions; });
        tot.ctr = tot.impressions > 0 ? tot.clicks / tot.impressions * 100 : NaN;
        tot.cpc = tot.clicks > 0 ? tot.spend / tot.clicks : NaN;
        tot.drr = tot.revenue > 0 ? tot.spend / tot.revenue * 100 : NaN;
        tot.roas = tot.spend > 0 ? tot.revenue / tot.spend : NaN;
        return { list: list, total: tot };
    }

    function html(a, state) {
        var t = a.total, k = [['Расход', fmt(t.spend) + ' ₽'], ['Выручка с РК', fmt(t.revenue) + ' ₽'], ['ДРР', pct(t.drr)], ['ROAS', isFinite(t.roas) ? t.roas.toFixed(2).replace('.', ',') : '—'],
            ['Показы', fmt(t.impressions)], ['Клики', fmt(t.clicks)], ['CTR', pct(t.ctr)], ['Заказы', fmt(t.orders)]];
        var h = '<div class="aoz-h"><b>РЕКЛАМА OZON</b><span>' + esc(state.range) + (state.when ? ' · обновлено ' + esc(state.when) : '') + '</span></div>';
        if (!a.list.length) {
            return h + '<div class="aoz-card aoz-empty">Нет данных рекламы Ozon за этот период.<br><small>Ключ рекламы Ozon вносится в «Настройки → API». Данные подтягиваются раз в несколько часов.</small></div>';
        }
        h += '<div class="aoz-k">' + k.map(function (x) { return '<div class="aoz-card"><span>' + x[0] + '</span><b>' + x[1] + '</b></div>'; }).join('') + '</div>';
        h += '<div class="aoz-card aoz-tc"><div class="aoz-t">Кампании</div><div class="aoz-tw"><table><thead><tr><th>Кампания</th><th>Расход</th><th>Показы</th><th>Клики</th><th>CTR</th><th>CPC</th><th>Заказы</th><th>Выручка</th><th>ДРР</th></tr></thead><tbody>' +
            a.list.map(function (c) {
                return '<tr><td><b>' + esc(c.title || ('Кампания ' + c.id)) + '</b><small>' + esc(c.id) + (c.last ? ' · была активна ' + esc(c.last.slice(8, 10) + '.' + c.last.slice(5, 7)) : '') + '</small></td><td>' + fmt(c.spend) + '</td><td>' + fmt(c.impressions) + '</td><td>' + fmt(c.clicks) + '</td><td>' + pct(c.ctr) + '</td><td>' + money(c.cpc) + '</td><td>' + fmt(c.orders) + '</td><td>' + fmt(c.revenue) + '</td><td>' + pct(c.drr) + '</td></tr>';
            }).join('') + '</tbody></table></div></div>';
        h += '<p class="aoz-note">Запуск, остановка и пополнение кампаний Ozon делаются в кабинете Ozon. Здесь только цифры.</p>';
        return h;
    }

    if (!doc) { root.NrAdsOz = { agg: agg, html: html }; if (typeof module !== 'undefined' && module.exports) module.exports = root.NrAdsOz; return; }

    var S = { key: '', busy: false, mem: {}, timer: 0 };
    function mp() { return (root.NrMp && root.NrMp.get()) || 'wb'; }
    function cab() { try { return localStorage.getItem('selected_cabinet_id') || (typeof currentCabinetId !== 'undefined' ? currentCabinetId : '') || ''; } catch (e) { return ''; } }
    function range() { try { return [activeDateFrom, activeDateTo]; } catch (e) { return ['', '']; } }
    function host() {
        var tab = doc.getElementById('tab-advertising'); if (!tab) return null;
        var el = doc.getElementById('adv-view-ozon');
        if (!el) { el = doc.createElement('div'); el.id = 'adv-view-ozon'; el.className = 'aoz'; tab.insertBefore(el, tab.firstChild); }
        return el;
    }
    function dd(iso) { return iso ? iso.slice(8, 10) + '.' + iso.slice(5, 7) : ''; }
    function paint(rows, when) {
        var el = host(); if (!el) return;
        var r = range(), out = html(agg(rows), { range: dd(r[0]) + ' – ' + dd(r[1]), when: when || '' });
        if (el.__html !== out) { el.innerHTML = out; el.__html = out; }
    }
    function active() { var t = doc.getElementById('tab-advertising'); return !!t && t.classList.contains('active') && mp() !== 'wb'; }
    async function refresh() {
        if (!active()) return;
        var c = cab(), r = range(), sb = root.supabase;
        if (!c || !r[0] || !r[1] || !sb) { if (!doc.getElementById('adv-view-ozon')) paint([], ''); return; }
        var key = c + '|' + r[0] + '|' + r[1], lsKey = 'nr_adoz_' + key;
        if (S.mem[key]) paint(S.mem[key].rows, S.mem[key].when);
        else { try { var raw = localStorage.getItem(lsKey); if (raw) { var o = JSON.parse(raw); S.mem[key] = o; paint(o.rows, o.when); } } catch (e) { /* без памяти */ } }
        if (!S.mem[key] && !doc.getElementById('adv-view-ozon')) paint([], '');
        if (S.busy && S.key === key) return;
        S.busy = true; S.key = key;
        try {
            var q = await sb.from('ozon_ads_daily').select('d,campaign_id,title,impressions,clicks,spend,orders,orders_sum').eq('cabinet_id', c).gte('d', r[0]).lte('d', r[1]).range(0, 4999);
            if (q.error) throw q.error;
            var st = null; try { var s2 = await sb.from('ozon_sync_state').select('last_ok_at').eq('cabinet_id', c).eq('part', 'ads').maybeSingle(); st = s2 && s2.data; } catch (e) { /* статус не критичен */ }
            var when = st && st.last_ok_at ? new Date(st.last_ok_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
            var rec = { rows: q.data || [], when: when }; S.mem[key] = rec;
            try { localStorage.setItem(lsKey, JSON.stringify(rec)); } catch (e) { /* место кончилось */ }
            if (cab() === c && key === (cab() + '|' + range()[0] + '|' + range()[1])) paint(rec.rows, rec.when);
        } catch (e) { if (root.console) console.warn('[NrAdsOz]', e && e.message || e); } finally { S.busy = false; }
    }
    function soon() { clearTimeout(S.timer); S.timer = setTimeout(refresh, 60); }
    function init() {
        if (root.NrMp && root.NrMp.onChange) root.NrMp.onChange(soon);
        doc.addEventListener('nr-mp-change', soon);
        root.addEventListener('nr-cabinet-changed', soon);
        var tab = doc.getElementById('tab-advertising');
        if (tab) new MutationObserver(soon).observe(tab, { attributes: true, attributeFilter: ['class'] });
        var dr = doc.getElementById('date-range');
        if (dr) new MutationObserver(soon).observe(dr, { childList: true, characterData: true, subtree: true });
        soon();
    }
    root.NrAdsOz = { agg: agg, html: html, refresh: refresh };
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
    if (typeof module !== 'undefined' && module.exports) module.exports = root.NrAdsOz;
})(typeof window !== 'undefined' ? window : globalThis);

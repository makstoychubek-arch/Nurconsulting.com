/* Раздел «Контроль РК»: компактные кампании, по нажатию видно товары внутри и их эффективность.
 * Ключевые запросы всё равно менять нельзя, поэтому кнопку «Ключи» убираем; «Автобиддер» уходит в маленькую кнопку справа. */
(function () {
    'use strict';
    var CSS = ''; // стили лежат в ads-campaign-detail.css и вшиваются в dashboard.html при сборке

    function sb() { return window.supabase; }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function fmt(n) { return Math.round(n).toLocaleString('ru-RU'); }
    function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
    function range() {
        try {
            var r = typeof window.getActiveDateRange === 'function' ? window.getActiveDateRange() : null;
            if (r && r.from && r.to) return { from: String(r.from).slice(0, 10), to: String(r.to).slice(0, 10) };
        } catch (e) { /* возьмём 7 дней */ }
        var now = new Date(), from = new Date(now.getTime() - 6 * 86400000);
        return { from: ymd(from), to: ymd(now) };
    }

    /* ---------- маленькая кнопка «Автобиддер» справа ---------- */
    var BIDICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"></path><circle cx="16" cy="7" r="2"></circle><circle cx="8" cy="17" r="2"></circle></svg>';
    function ensureBidderPill() {
        var box = document.getElementById('adx-pills');
        var det = document.querySelector('#adv-view-ads details.ads-hq-advanced');
        if (!box || !det) return;
        var btn = document.getElementById('adx-pill-bid');
        if (btn && btn._adxBound) return;
        if (!btn) {
            // значок уже есть в разметке страницы; запасной вариант на случай, если его там нет
            btn = document.createElement('button');
            btn.type = 'button'; btn.id = 'adx-pill-bid'; btn.className = 'rnp-tool-icon adx-ico'; btn.title = 'Автобиддер: ставка сама держит позицию';
            btn.innerHTML = BIDICON;
            box.appendChild(btn);
        }
        btn._adxBound = true;
        btn.addEventListener('click', function () {
            var show = !det.classList.contains('adx-show');
            det.classList.toggle('adx-show', show); det.open = show; btn.classList.toggle('open', show);
        });
        // блок автобиддера ставим сразу под панель инструментов, как и автопилот
        var bulk = document.querySelector('#adv-view-ads .ads-hq-bulk');
        var ap = document.getElementById('ad-autopilot-card');
        var anchor = ap && bulk && ap.parentNode === bulk.parentNode ? ap : bulk;
        if (anchor && det.previousElementSibling !== anchor) anchor.after(det);
    }

    /* ---------- компактные карточки на телефоне ---------- */
    function metricOf(card, label) {
        var spans = card.querySelectorAll('.ads-hq-phone-metrics > span');
        for (var i = 0; i < spans.length; i++) {
            var t = spans[i].firstChild ? spans[i].firstChild.textContent.trim() : '';
            if (t === label) { var b = spans[i].querySelector('b'); return b ? b.textContent.trim() : ''; }
        }
        return '';
    }
    function decorateCards() {
        document.querySelectorAll('#ads-hq-phone .ads-hq-phone-card').forEach(function (card) {
            if (!card.querySelector('.ads-hq-phone-metrics')) return;
            if (!card.classList.contains('adx-open')) card.classList.add('adx-compact');
            var sum = card.querySelector('.adx-sum');
            var values = [['Затраты', 'Затраты'], ['Принятые заказы', 'Заказы'], ['Доля затрат', 'Доля затрат']].map(function (p) { return [p[1], metricOf(card, p[0])]; }).filter(function (x) { return x[1]; });
            var bal = card.getAttribute('data-bal'); if (bal) values.unshift(['Баланс', bal]);
            var html = values.map(function (x) { return x[0] + '<b>' + esc(x[1]) + '</b>'; }).join('</span><span>');
            if (!sum) { sum = document.createElement('div'); sum.className = 'adx-sum'; var pick = card.querySelector('.ads-hq-phone-pick'); if (pick) pick.after(sum); else card.prepend(sum); }
            var want = '<span>' + html + '</span>';
            if (sum.innerHTML !== want) sum.innerHTML = want;
            sum.style.display = card.classList.contains('adx-open') ? 'none' : '';
        });
    }

    /* ---------- товары внутри кампании ---------- */
    async function loadProducts(cab, camp) {
        var r = range();
        var res = await sb().from('advertising_daily_stats').select('data').eq('cabinet_id', cab).eq('campaign_id', Number(camp)).gte('stat_date', r.from).lte('stat_date', r.to);
        var by = {};
        (res.data || []).forEach(function (row) {
            var apps = row && row.data && Array.isArray(row.data.apps) ? row.data.apps : [];
            apps.forEach(function (a) {
                (Array.isArray(a.nms) ? a.nms : []).forEach(function (n) {
                    var x = by[n.nmId] || (by[n.nmId] = { nm: n.nmId, spend: 0, views: 0, clicks: 0, orders: 0, rev: 0 });
                    x.spend += Number(n.sum) || 0; x.views += Number(n.views) || 0; x.clicks += Number(n.clicks) || 0; x.orders += Number(n.orders) || 0; x.rev += Number(n.sum_price) || 0;
                });
            });
        });
        var rows = Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return b.spend - a.spend; });
        var names = {};
        if (rows.length) {
            var a = await sb().from('rnp_articles').select('nm_id,name,photo_url').eq('cabinet_id', cab).in('nm_id', rows.map(function (x) { return x.nm; }));
            (a.data || []).forEach(function (x) { names[x.nm_id] = x; });
        }
        return { rows: rows, names: names, range: r };
    }

    function drrClass(d) { return d == null ? '' : d <= 7 ? 'adx-good' : d <= 15 ? 'adx-mid' : 'adx-bad'; }
    function productsHtml(d) {
        if (!d.rows.length) return '<div class="adx-note">За выбранные даты по товарам кампании данных нет.</div>';
        var tot = { spend: 0, views: 0, clicks: 0, orders: 0, rev: 0 };
        var body = d.rows.map(function (x) {
            Object.keys(tot).forEach(function (k) { tot[k] += x[k]; });
            var info = d.names[x.nm] || {}, drr = x.rev > 0 ? 100 * x.spend / x.rev : null, cpo = x.orders > 0 ? x.spend / x.orders : null, ctr = x.views > 0 ? 100 * x.clicks / x.views : null;
            var img = info.photo_url ? '<img src="' + esc(info.photo_url) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">' : '';
            return '<tr><td><div class="adx-nm">' + img + '<span>' + esc(info.name || x.nm) + '</span></div></td><td>' + fmt(x.spend) + '</td><td>' + fmt(x.clicks) + '</td><td>' + (ctr != null ? ctr.toFixed(1) + '%' : '—') + '</td><td>' + fmt(x.orders) + '</td><td>' + (cpo != null ? fmt(cpo) : '—') + '</td><td class="' + drrClass(drr) + '">' + (drr != null ? drr.toFixed(1) + '%' : '—') + '</td></tr>';
        }).join('');
        var tdrr = tot.rev > 0 ? 100 * tot.spend / tot.rev : null;
        return '<div class="adx-wrap"><table class="adx-tbl"><thead><tr><th>Товар</th><th>Расход</th><th>Клики</th><th>CTR</th><th>Заказы</th><th>Цена зак.</th><th>ДРР</th></tr></thead><tbody>' + body +
            '<tr class="adx-tot"><td>Всего</td><td>' + fmt(tot.spend) + '</td><td>' + fmt(tot.clicks) + '</td><td>' + (tot.views ? (100 * tot.clicks / tot.views).toFixed(1) + '%' : '—') + '</td><td>' + fmt(tot.orders) + '</td><td>' + (tot.orders ? fmt(tot.spend / tot.orders) : '—') + '</td><td class="' + drrClass(tdrr) + '">' + (tdrr != null ? tdrr.toFixed(1) + '%' : '—') + '</td></tr></tbody></table></div>' +
            '<div class="adx-note">Период: ' + d.range.from + ' – ' + d.range.to + '. Зелёный ДРР до 7%, жёлтый до 15%, красный выше.</div>';
    }

    async function fillDetail(box, cab, camp) {
        box.innerHTML = '<div class="adx-note">Загружаю товары…</div>';
        try { box.innerHTML = productsHtml(await loadProducts(cab, camp)); } catch (e) { box.innerHTML = '<div class="adx-note">Не удалось загрузить: ' + esc(e.message || e) + '</div>'; }
    }

    function toggleTableRow(btn) {
        var tr = btn.closest('tr'); if (!tr) return;
        var next = tr.nextElementSibling;
        if (next && next.classList.contains('adx-detail-row')) { next.remove(); return; }
        var cols = tr.children.length;
        var row = document.createElement('tr'); row.className = 'adx-detail-row';
        var td = document.createElement('td'); td.colSpan = cols + 20; row.appendChild(td);
        var box = document.createElement('div'); box.className = 'adx-detail'; box.style.borderTop = '0'; td.appendChild(box);
        tr.after(row);
        fillDetail(box, btn.getAttribute('data-cabinet'), btn.getAttribute('data-keys'));
    }
    function toggleCard(card, btn) {
        var open = card.classList.toggle('adx-open');
        card.classList.toggle('adx-compact', !open);
        var old = card.querySelector('.adx-detail'); if (old) old.remove();
        if (open) {
            var box = document.createElement('div'); box.className = 'adx-detail'; card.appendChild(box);
            fillDetail(box, btn.getAttribute('data-cabinet'), btn.getAttribute('data-keys'));
        }
        decorateCards();
    }

    document.addEventListener('click', function (ev) {
        var t = ev.target; if (!t || !t.closest) return;
        if (t.closest('.adx-detail, .tg-switch, .adp-tg, input, select, a')) return;
        var tab = document.getElementById('tab-advertising'); if (!tab || !tab.contains(t)) return;
        var card = t.closest('#ads-hq-phone .ads-hq-phone-card');
        if (card) {
            var nameBtn = card.querySelector('button.ads-hq-wb-name');
            if (nameBtn) { ev.preventDefault(); ev.stopPropagation(); toggleCard(card, nameBtn); }
            return;
        }
        var tb = t.closest('button.ads-hq-wb-name');
        if (tb && t.closest('#ads-hq-tbody')) { ev.preventDefault(); ev.stopPropagation(); toggleTableRow(tb); }
    }, true);


    /* ---------- сторож: остановить по балансу / по времени, запустить в нужный час ---------- */
    var guards = {}, guardsLoaded = false, guardsFails = 0;
    var ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8"></circle><path d="M12 9v4l2.5 2M9 2h6"></path></svg>';
    var TZ = 6; // Бишкек, UTC+6
    function toLocalH(u) { return u == null ? '' : String((u + TZ) % 24); }
    function toUtcH(l) { return l === '' ? null : ((Number(l) - TZ) % 24 + 24) % 24; }
    async function loadGuards() {
        if (!sb()) return;
        var r = await sb().from('ad_balance_guards').select('*');
        if (r.error) throw r.error;
        guards = {}; (r.data || []).forEach(function (g) { guards[g.cabinet_id + ':' + g.campaign_id] = g; });
        guardsLoaded = true;
    }
    function hourOptions(sel) {
        var o = '<option value="">не нужно</option>';
        for (var h = 0; h < 24; h++) o += '<option value="' + h + '"' + (String(h) === sel ? ' selected' : '') + '>' + (h < 10 ? '0' : '') + h + ':00</option>';
        return o;
    }
    function openGuard(cab, camp, name) {
        var g = guards[cab + ':' + camp] || {};
        var ov = document.createElement('div'); ov.className = 'adx-gp-ov';
        ov.innerHTML = '<div class="adx-gp" role="dialog"><h4>Остановить и запустить</h4><div class="sub">' + esc(name || ('РК ' + camp)) + ' · время по Бишкеку</div>' +
            '<label>Остановить, когда баланс упадёт до (сом)</label><input type="number" min="0" step="100" id="adx-g-bal" placeholder="не нужно" value="' + (g.pause_below == null ? '' : g.pause_below) + '">' +
            '<label>Остановить в</label><select id="adx-g-stop">' + hourOptions(toLocalH(g.stop_hour_utc)) + '</select>' +
            '<label>Запустить в</label><select id="adx-g-start">' + hourOptions(toLocalH(g.resume_hour_utc)) + '</select>' +
            '<div class="row"><button type="button" data-a="off">Выключить</button><button type="button" class="pri" data-a="save">Сохранить</button></div>' +
            '<div class="sub" id="adx-g-msg" style="margin:10px 0 0"></div></div>';
        document.body.appendChild(ov);
        function close() { ov.remove(); }
        function say(t) { ov.querySelector('#adx-g-msg').textContent = t; }
        ov.addEventListener('click', async function (e) {
            if (e.target === ov) return close();
            var a = e.target.getAttribute && e.target.getAttribute('data-a'); if (!a) return;
            try {
                var rec;
                if (a === 'off') rec = { cabinet_id: cab, campaign_id: Number(camp), active: false, state: 'idle' };
                else {
                    var bal = ov.querySelector('#adx-g-bal').value, stop = ov.querySelector('#adx-g-stop').value, start = ov.querySelector('#adx-g-start').value;
                    if (bal === '' && stop === '') { say('Укажи баланс или время остановки'); return; }
                    if (stop !== '' && start === '') { say('Для остановки по времени нужно время запуска'); return; }
                    rec = { cabinet_id: cab, campaign_id: Number(camp), pause_below: bal === '' ? null : Math.max(0, Math.round(Number(bal))), stop_hour_utc: toUtcH(stop), resume_hour_utc: toUtcH(start), active: true, state: 'idle' };
                }
                var r = await sb().from('ad_balance_guards').upsert(rec, { onConflict: 'cabinet_id,campaign_id' });
                if (r.error) throw r.error;
                await loadGuards(); paintGuards(); close();
            } catch (err) { say('Не сохранилось: ' + (err.message || err)); }
        });
    }
    function paintGuards() {
        document.querySelectorAll('#ads-hq-phone button.ads-hq-wb-name[data-keys], #ads-hq-tbody button.ads-hq-wb-name[data-keys]').forEach(function (nameBtn) {
            var cab = nameBtn.getAttribute('data-cabinet'), camp = nameBtn.getAttribute('data-keys');
            var host = nameBtn.parentNode && nameBtn.parentNode.querySelector('.ads-hq-wb-id');
            if (!host || !cab || !camp) return;
            var btn = host.querySelector('.adx-guard');
            if (!btn) {
                btn = document.createElement('button'); btn.type = 'button'; btn.className = 'adx-guard'; btn.title = 'Когда остановить и когда запустить';
                btn.innerHTML = ICON; btn.setAttribute('data-gcab', cab); btn.setAttribute('data-gcamp', camp);
                host.appendChild(btn);
            }
            var g = guards[cab + ':' + camp], on = !!(g && g.active);
            var dot = btn.querySelector('i');
            if (on && !dot) btn.insertAdjacentHTML('beforeend', '<i></i>'); else if (!on && dot) dot.remove();
        });
    }
    document.addEventListener('click', function (ev) {
        var b = ev.target && ev.target.closest && ev.target.closest('.adx-guard'); if (!b) return;
        ev.preventDefault(); ev.stopPropagation();
        var nameBtn = b.parentNode && b.parentNode.parentNode && b.parentNode.parentNode.querySelector('button.ads-hq-wb-name');
        openGuard(b.getAttribute('data-gcab'), b.getAttribute('data-gcamp'), nameBtn ? nameBtn.textContent.trim() : '');
    }, true);

    function tick() {
        var tab = document.getElementById('tab-advertising');
        if (document.hidden || !tab || !tab.classList.contains('active')) return;
        if (!document.getElementById('adx-style')) { var st = document.createElement('style'); st.id = 'adx-style'; st.textContent = CSS; document.head.appendChild(st); }
        ensureBidderPill();
        if (!guardsLoaded && guardsFails < 3) loadGuards().catch(function () { guardsFails++; });
        paintGuards();
        decorateCards();
    }
    try { ensureBidderPill(); } catch (e) { /* значок появится при первом такте */ }
    setInterval(tick, 1000);
})();

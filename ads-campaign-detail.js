/* Раздел «Контроль РК»: компактные кампании, по нажатию видно товары внутри и их эффективность.
 * Ключевые запросы всё равно менять нельзя, поэтому кнопку «Ключи» убираем; «Автобиддер» уходит в маленькую кнопку справа. */
(function () {
    'use strict';
    var CSS = [
        '#adv-view-ads .adv-camp-action-btn{display:none!important}',
        /* автобиддер: прячем заголовок и сам блок, открывается маленькой кнопкой */
        '#adv-view-ads details.ads-hq-advanced{display:none}#adv-view-ads details.ads-hq-advanced.adx-show{display:block}#adv-view-ads details.ads-hq-advanced>summary{display:none}',
        /* телефон: компактная карточка */
        '.ads-hq-phone-card.adx-compact .ads-hq-phone-type,.ads-hq-phone-card.adx-compact .ads-hq-phone-metrics{display:none}',
        '.ads-hq-phone-card.adx-open .ads-hq-phone-type{display:flex}',
        '.adx-sum{display:flex;flex-wrap:wrap;gap:4px 14px;margin:8px 2px 0;font-size:12.5px;color:var(--text-muted,#71717a)}.adx-sum b{color:var(--text-primary,#111);font-weight:700;margin-left:4px}',
        '.ads-hq-phone-card{cursor:pointer}',
        /* раскрытые товары */
        '.adx-detail{margin-top:10px;border-top:1px solid var(--border,rgba(0,0,0,.1));padding-top:8px;cursor:default}',
        '.adx-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}.adx-tbl{width:100%;border-collapse:collapse;font-size:12.5px}.adx-tbl th{font-weight:600;color:var(--text-muted,#71717a);text-align:right;padding:4px 6px;white-space:nowrap}.adx-tbl td{padding:6px;text-align:right;border-top:1px solid var(--border,rgba(0,0,0,.07));white-space:nowrap}',
        '.adx-tbl th:first-child,.adx-tbl td:first-child{text-align:left;white-space:normal;min-width:110px;max-width:150px}',
        '.adx-nm{display:flex;align-items:center;gap:8px}.adx-nm img{width:26px;height:34px;object-fit:cover;border-radius:6px;background:var(--sel,#eee);flex:none}.adx-nm span{line-height:1.2;overflow-wrap:anywhere}',
        '.adx-good{color:#16a34a;font-weight:700}.adx-mid{color:#d97706;font-weight:700}.adx-bad{color:#dc2626;font-weight:700}.adx-tot td{font-weight:700}',
        '.adx-note{font-size:12px;color:var(--text-muted,#71717a);padding:6px 2px}',
        '.adx-detail-row>td{padding:6px 10px 12px!important;background:var(--bg)}',
    ].join('\n');

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
    function ensureBidderPill() {
        var box = document.getElementById('adx-pills');
        var det = document.querySelector('#adv-view-ads details.ads-hq-advanced');
        if (!box || !det || document.getElementById('adx-pill-bid')) return;
        var btn = document.createElement('button');
        btn.type = 'button'; btn.id = 'adx-pill-bid'; btn.className = 'adx-pill'; btn.title = 'Автобиддер: ставка сама держит позицию';
        btn.innerHTML = '<i></i>Автобиддер';
        btn.addEventListener('click', function () {
            var show = !det.classList.contains('adx-show');
            det.classList.toggle('adx-show', show); det.open = show; btn.classList.toggle('open', show);
        });
        box.appendChild(btn);
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
            return '<tr><td><div class="adx-nm">' + img + '<span>' + esc(info.name || x.nm) + '</span></div></td><td>' + fmt(x.spend) + '</td><td>' + fmt(x.orders) + '</td><td>' + (cpo != null ? fmt(cpo) : '—') + '</td><td class="' + drrClass(drr) + '">' + (drr != null ? drr.toFixed(1) + '%' : '—') + '</td><td>' + (ctr != null ? ctr.toFixed(1) + '%' : '—') + '</td></tr>';
        }).join('');
        var tdrr = tot.rev > 0 ? 100 * tot.spend / tot.rev : null;
        return '<div class="adx-wrap"><table class="adx-tbl"><thead><tr><th>Товар</th><th>Расход</th><th>Заказы</th><th>Цена заказа</th><th>ДРР</th><th>CTR</th></tr></thead><tbody>' + body +
            '<tr class="adx-tot"><td>Всего</td><td>' + fmt(tot.spend) + '</td><td>' + fmt(tot.orders) + '</td><td>' + (tot.orders ? fmt(tot.spend / tot.orders) : '—') + '</td><td class="' + drrClass(tdrr) + '">' + (tdrr != null ? tdrr.toFixed(1) + '%' : '—') + '</td><td>' + (tot.views ? (100 * tot.clicks / tot.views).toFixed(1) + '%' : '—') + '</td></tr></tbody></table></div>' +
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

    function tick() {
        var tab = document.getElementById('tab-advertising');
        if (!tab || !tab.classList.contains('active')) return;
        if (!document.getElementById('adx-style')) { var st = document.createElement('style'); st.id = 'adx-style'; st.textContent = CSS; document.head.appendChild(st); }
        ensureBidderPill();
        decorateCards();
    }
    setInterval(tick, 700);
})();

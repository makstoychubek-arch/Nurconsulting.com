/* Логистика → «Остатки»: склейки строками, артикулы плитками по горизонтали, остатки по размерам.
   Источник списка групп и артикулов: готовая таблица (скрыта, но продолжает работать: сохранение «В пути» и «В плане»).
   Переключатель WB | Ozon | Вместе (window.NrMp): данные Ozon берутся из остатков Ozon (ozon_stock_rows) и товаров (ozon_rnp_articles).
   Без расчёта «хватит на N дней»: только остаток, размеры и нули. */
(function (root) {
    'use strict';
    var doc = root.document;
    if (!doc) return;
    var S = { cab: '', filter: 'all', busy: false, q: '', sz: {}, szCab: '', szLoading: false, oz: null, ozCab: '', ozLoading: false, open: {}, shut: {} };

    function num(t) {
        var v = parseFloat(String(t == null ? '' : t).replace(/[\s  ]/g, '').replace(',', '.'));
        return isFinite(v) ? v : 0;
    }
    function fmt(n) { return Math.round(n).toLocaleString('ru-RU').replace(/[  ]/g, ' '); }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function cab() { try { return (typeof currentCabinetId !== 'undefined' ? currentCabinetId : '') || ''; } catch (e) { return ''; } }
    function db() { try { return typeof supabase !== 'undefined' ? supabase : null; } catch (e) { return null; } }
    function mode() { return (root.NrMp && root.NrMp.get()) || 'wb'; }
    var ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
    function sizeKey(z) { var n = parseFloat(z); return isFinite(n) ? n : 1000 + (ORDER.indexOf(String(z).toUpperCase()) + 1); }
    function lsGet(k) { try { return JSON.parse(root.localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
    function lsSet(k, v) { try { root.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* кэш не влез */ } }

    // Размеры WB: остаток по размерам артикула (wb_stocks), кэш устройства и фоновое обновление
    async function loadSizes() {
        var c = cab(), d = db();
        if (!c || !d || S.szLoading) return;
        if (S.szCab !== c) { S.sz = lsGet('nr_stk_sz_' + c) || {}; S.szCab = c; }
        S.szLoading = true;
        try {
            var acc = {}, off = 0;
            for (var page = 0; page < 30; page++) {
                var r = await d.from('wb_stocks').select('nm_id, tech_size, quantity').eq('cabinet_id', c).range(off, off + 999);
                var rows = (r && r.data) || [];
                rows.forEach(function (x) {
                    var z = String(x.tech_size == null ? '' : x.tech_size).trim(); if (!z || z === '0') return;
                    var m = acc[x.nm_id] = acc[x.nm_id] || {}; m[z] = (m[z] || 0) + (Number(x.quantity) || 0);
                });
                if (rows.length < 1000) break;
                off += 1000;
            }
            if (c === cab()) { S.sz = acc; lsSet('nr_stk_sz_' + c, acc); }
        } catch (e) { /* остаются прежние размеры */ }
        S.szLoading = false;
        schedule();
    }

    // Ozon: товары без размера (артикул продавца) и остатки по размерам из ozon_stock_rows
    function ozGroup(name) {
        var n = String(name || '').toLowerCase();
        return /^свитер/.test(n) ? 'Свитер' : /^костюм_укороч/.test(n) ? 'Костюм укороченный' : /^костюм_оверсайз/.test(n) ? 'Костюм оверсайз' : /^пиджак/.test(n) ? 'Пиджак оверсайз' : /^спорт/.test(n) ? 'Спорт костюм' : 'Другое';
    }
    async function loadOzon() {
        var c = cab(), d = db();
        if (!c || !d || S.ozLoading) return;
        if (S.ozCab !== c) { S.oz = lsGet('nr_stk_oz_' + c); S.ozCab = c; if (S.oz) schedule(); }
        S.ozLoading = true;
        try {
            var res = await Promise.all([d.rpc('ozon_rnp_articles', { p_cabinet: c }), d.rpc('ozon_stock_rows', { p_cabinet: c })]);
            var arts = (res[0] && res[0].data) || [], stk = (res[1] && res[1].data) || [], by = {}, groups = {};
            stk.forEach(function (x) {
                var m = by[x.nm_id] = by[x.nm_id] || { fbo: 0, fbs: 0, sz: {} }, q = Number(x.quantity) || 0, z = String(x.tech_size || '').trim();
                if (String(x.stock_scheme || 'fbo').toLowerCase() === 'fbs') m.fbs += q; else m.fbo += q;
                if (z) m.sz[z] = (m.sz[z] || 0) + q;
            });
            arts.forEach(function (a) {
                var m = by[a.nm_id] || { fbo: 0, fbs: 0, sz: {} }, g = ozGroup(a.name);
                (groups[g] = groups[g] || []).push({ nm: String(a.nm_id), name: a.name, fbo: m.fbo, fbs: m.fbs, transit: 0, plan: 0, cab: c, oz: 1, photo: a.photo_url || '', sz: m.sz });
            });
            var list = Object.keys(groups).sort().map(function (k) { return { name: k, items: groups[k].sort(function (a, b) { return a.name.localeCompare(b.name, 'ru'); }), oz: 1 }; });
            if (c === cab()) { S.oz = list; lsSet('nr_stk_oz_' + c, list); }
        } catch (e) { /* остаётся прежнее */ }
        S.ozLoading = false;
        schedule();
    }

    // Данные WB: готовый список групп и артикулов из dashboard.html (nrGoodsList)
    function readWb() {
        var d = root.nrGoodsList ? root.nrGoodsList() : { msg: { t: 'Загрузка…' } };
        if (d.msg) return d;
        d.groups.forEach(function (g) { g.items.forEach(function (a) { a.cab = a.cab || cab(); a.sz = S.sz[a.nm] || null; }); });
        return d;
    }

    function zerosOf(a) { var k = a.sz ? Object.keys(a.sz) : []; return k.filter(function (z) { return !(a.sz[z] > 0); }).length; }

    function photo(a, ph) {
        var u = a.photo || (ph && a.nm && !a.oz ? ph(a.nm, 'c246x328') : '');
        return '<span class="nrs-ph"><svg viewBox="0 0 24 24"><path d="M8 4l-5 3 2 4 2-1v10h10V10l2 1 2-4-5-3c-.5 1.5-1.8 2.5-4 2.5S8.5 5.5 8 4z"/></svg>' + (u ? '<img src="' + esc(u) + '" alt="" loading="lazy" onerror="this.remove()">' : '') + '</span>';
    }
    function edit(a, field, val, label) {
        return '<label class="nrs-ed"><span>' + label + '</span><input class="gg-edit-input' + (val ? '' : ' gg-zero') + '" type="text" inputmode="numeric" placeholder="0" data-nm="' + esc(a.nm) + '" data-cab="' + esc(a.cab) + '" data-field="' + field + '" value="' + (val ? String(val) : '') + '" onfocus="ggEditFocus(this)" oninput="ggEditInput(this)" onchange="ggEditCommit(this)" onkeydown="ggEditKey(event, this)"></label>';
    }
    function tile(a, ph) {
        var stock = a.fbo + a.fbs, sizes = a.sz ? Object.keys(a.sz).sort(function (x, y) { return sizeKey(x) - sizeKey(y); }) : [], key = a.nm + (a.oz ? 'o' : 'w');
        var grid = sizes.length ? '<div class="nrs-sz" style="grid-template-columns:repeat(' + sizes.length + ',1fr)">' + sizes.map(function (z) { return '<span>' + esc(z) + '</span>'; }).join('') +
            sizes.map(function (z) { var v = a.sz[z] || 0; return '<b class="' + (v > 0 ? '' : 'z') + '">' + fmt(v) + '</b>'; }).join('') + '</div>' : '';
        var more = '<div class="nrs-more"><small>ФБО ' + fmt(a.fbo) + ' · ФБС ' + fmt(a.fbs) + '</small>' + (a.oz ? '' : '<div class="nrs-eds">' + edit(a, 'transit', a.transit, 'В пути') + edit(a, 'plan', a.plan, 'В плане') + '</div>') + '</div>';
        return '<div class="nrs-t' + (S.open[key] ? ' open' : '') + (stock <= 0 ? ' zero' : '') + '" data-k="' + esc(key) + '" data-nm="' + esc(a.nm) + '"><div class="nrs-top">' + photo(a, ph) +
            '<div><b title="' + esc(a.name) + '">' + esc(a.name || '—') + '</b><strong>' + fmt(stock) + '</strong></div></div>' + grid + more + '</div>';
    }
    function matches(a) { if (!S.q) return true; var q = S.q; return String(a.name || '').toLowerCase().indexOf(q) >= 0 || String(a.nm).indexOf(q) >= 0; }

    function render() {
        if (S.busy) return;
        adjustBtn(); adsTabs();
        var tab = doc.getElementById('tab-goods-groups'), host = doc.getElementById('gg-view-now');
        if (!tab || !host || host.hidden || tab.offsetParent === null) { doc.body.classList.remove('ggx-on'); return; }
        S.busy = true;
        try {
            var m = mode(), box = doc.getElementById('ggx-cards');
            if (!box) {
                box = doc.createElement('div'); box.id = 'ggx-cards';
                host.parentNode.insertBefore(box, host);
                box.addEventListener('click', onClick);
                box.addEventListener('input', onInput);
            }
            if (S.szCab !== cab()) loadSizes();
            if (m !== 'wb' && S.ozCab !== cab()) loadOzon();
            var ph = root.RNP && root.RNP.wbPhotoUrl, groups = [], msg = null;
            if (m !== 'ozon') {
                var d = readWb();
                if (d.msg) msg = d.msg; else d.groups.forEach(function (g) { groups.push({ name: g.name, items: g.items, oz: 0 }); });
            }
            if (m !== 'wb' && S.oz) S.oz.forEach(function (g) { groups.push(g); });
            if (msg && m === 'wb') {
                box.innerHTML = msg.err ? '<div class="ggx-msg err">' + esc(msg.t) + '</div>' : '<div class="nrs-sk"></div><div class="nrs-sk"></div>';
                doc.body.classList.add('ggx-on'); S.busy = false; return;
            }
            var all = 0, n = 0, way = 0, plan = 0, fbo = 0, fbs = 0, zr = 0;
            groups.forEach(function (g) { g.z = 0; g.items.forEach(function (a) { var z = zerosOf(a); g.z += z; if (z) zr++; all += a.fbo + a.fbs; n++; way += a.transit || 0; plan += a.plan || 0; fbo += a.fbo; fbs += a.fbs; }); });
            var third = m === 'ozon' ? ['ФБО', fbo] : ['в пути', way], fourth = m === 'wb' ? ['в плане', plan] : m === 'ozon' ? ['ФБС', fbs] : ['нулей по размерам', zr];
            var f = S.filter === 'zero';
            var list = groups.filter(function (g) { return !f || g.z > 0; }).slice().sort(function (a, b) { return (b.z > 0) - (a.z > 0) || b.z - a.z; });
            var html = '<div class="nrs-kp"><div class="nrs-k blk"><b>' + fmt(all) + ' шт</b><span>на складах</span></div><div class="nrs-k"><b>' + n + '</b><span>артикулов</span></div><div class="nrs-k"><b>' + fmt(third[1]) + '</b><span>' + third[0] + '</span></div><div class="nrs-k"><b>' + fmt(fourth[1]) + '</b><span>' + fourth[0] + '</span></div></div>' +
                '<div class="nrs-bar"><button type="button" class="nrs-chip' + (f ? ' on' : '') + '" data-f="zero">С нулевыми размерами ' + zr + '</button><span class="nrs-hint">Склейки с нулевыми размерами идут первыми. Нажмите на название склейки, чтобы свернуть её; на плитку, чтобы открыть «в пути» и «в плане».</span><input class="nrs-q" type="search" placeholder="Поиск по названию или артикулу" value="' + esc(S.q) + '"></div><div class="nrs-groups">';
            list.forEach(function (g) {
                var items = g.items.filter(matches); if (!items.length) return;
                var q = 0, w = 0, p = 0; items.forEach(function (a) { q += a.fbo + a.fbs; w += a.transit || 0; p += a.plan || 0; });
                var gk = (g.oz ? 'o:' : 'w:') + g.name, tag = m === 'all' ? '<span class="nrs-tag">' + (g.oz ? 'ozon' : 'WB') + '</span>' : '';
                html += '<div class="nrs-grp' + (S.shut[gk] ? ' shut' : '') + '" data-g="' + esc(gk) + '"><div class="nrs-rh"><span class="nrs-chev">▼</span>' + tag + '<b>' + esc(g.name) + '</b><span class="nrs-sum"><b>' + fmt(q) + '</b>' + (g.oz ? '' : ' · в пути ' + fmt(w) + ' · в плане ' + fmt(p)) + '</span>' +
                    (g.z ? '<span class="nrs-dots"><i></i>' + g.z + ' нулей</span>' : '') + '</div><div class="nrs-strip">' + items.map(function (a) { return tile(a, ph); }).join('') + '</div></div>';
            });
            html += '</div>';
            // не перерисовываем под руками у пользователя, пока он вводит число или поиск
            var act = doc.activeElement;
            if (!(act && box.contains(act) && act.tagName === 'INPUT')) box.innerHTML = html;
            doc.body.classList.add('ggx-on');
        } catch (e) { doc.body.classList.remove('ggx-on'); }
        S.busy = false;
    }

    function onClick(e) {
        var t = e.target;
        if (t.closest('input, label')) return;
        var f = t.closest('[data-f]'); if (f) { S.filter = S.filter === 'zero' ? 'all' : 'zero'; render(); return; }
        var rh = t.closest('.nrs-rh'); if (rh) { var g = rh.parentNode.getAttribute('data-g'); S.shut[g] = !S.shut[g]; rh.parentNode.classList.toggle('shut', !!S.shut[g]); return; }
        var tl = t.closest('.nrs-t'); if (tl) { var k = tl.getAttribute('data-k'); S.open[k] = !S.open[k]; tl.classList.toggle('open', !!S.open[k]); }
    }
    function onInput(e) { var q = e.target.closest('.nrs-q'); if (!q) return; S.q = q.value.trim().toLowerCase(); clearTimeout(S.qt); S.qt = setTimeout(function () { var v = q.selectionStart; var box = doc.getElementById('ggx-cards'); var act = doc.activeElement; if (act) act.blur(); render(); var q2 = box && box.querySelector('.nrs-q'); if (q2) { q2.focus(); try { q2.setSelectionRange(v, v); } catch (x) { /* не поддерживается */ } } }, 250); }

    var timer = 0;
    function schedule() { clearTimeout(timer); timer = setTimeout(render, 150); }
    doc.addEventListener('nr-mp-change', schedule);

    // Списание FBS: короба уехали на FBO, остатки склада на WB уменьшаются. Только команда; сначала таблица «было → станет».
    function staff() { try { return typeof isStaff !== 'undefined' && !!isStaff; } catch (e) { return false; } }
    function parseBoxes(text, list) {
        var items = [], notes = [], all = [];
        (list.groups || []).forEach(function (g) { g.items.forEach(function (a) { all.push(a); }); });
        String(text || '').split(/\n/).forEach(function (ln) {
            var m = ln.match(/^\s*(\d{3,9})\s*[:.\-]?\s*(.*)$/);
            if (!m) return;
            var hit = all.filter(function (a) { return a.nm === m[1] || a.nm.slice(-m[1].length) === m[1]; });
            if (hit.length !== 1) { notes.push('Артикул ' + m[1] + (hit.length ? ': найдено несколько' : ': не найден')); return; }
            var re = /(\d{2}|XXS|XS|S|M|L|XL|XXL)\s*[-–:= ]\s*(\d{1,4})/gi, x;
            while ((x = re.exec(m[2]))) items.push({ nm_id: Number(hit[0].nm), size: x[1].toUpperCase(), qty: Number(x[2]) });
        });
        var sum = {};
        items.forEach(function (i) { var k = i.nm_id + '|' + i.size; sum[k] = sum[k] ? { nm_id: i.nm_id, size: i.size, qty: sum[k].qty + i.qty } : i; });
        return { items: Object.keys(sum).map(function (k) { return sum[k]; }), notes: notes, all: all };
    }
    function adjustOpen() {
        var c = cab(); if (!c) return;
        var old = doc.getElementById('ggx-adj'); if (old) old.remove();
        var box = doc.createElement('div'); box.id = 'ggx-adj';
        box.innerHTML = '<div class="ggx-adj-b"><div class="ggx-adj-h"><b>Списать с FBS</b><button type="button" data-x="1">×</button></div>' +
            '<p>Короба ушли на FBO: остаток на складе WB уменьшится. По строке на артикул: «последние цифры: размер-штук, …», например <i>0276: 44-7, 46-7</i>. Одинаковые размеры складываются.</p>' +
            '<label>Склад <input id="ggx-adj-wh" value="АМАН ФФ"></label><textarea id="ggx-adj-t" rows="8" placeholder="1148: 44-8, 46-8, 48-8, 50-8"></textarea>' +
            '<div class="ggx-adj-a"><button type="button" data-chk="1">Проверить</button><button type="button" data-go="1" disabled>Отправить на WB</button></div><div id="ggx-adj-r"></div></div>';
        doc.body.appendChild(box);
        var plan = null, res = box.querySelector('#ggx-adj-r'), go = box.querySelector('[data-go]');
        function run(apply) {
            var d = root.nrGoodsList ? root.nrGoodsList() : {};
            var p = parseBoxes(box.querySelector('#ggx-adj-t').value, d);
            if (!p.items.length) { res.innerHTML = '<p class="err">Не нашёл ни одной строки. ' + esc(p.notes.join('; ')) + '</p>'; return; }
            var wh = box.querySelector('#ggx-adj-wh').value.trim();
            res.innerHTML = '<p>' + (apply ? 'Отправляем на WB…' : 'Считаем по живым остаткам WB…') + '</p>';
            go.disabled = true;
            root.callWbProxy('fbs_stock_adjust', { warehouse: wh, items: p.items, apply: apply }, c).then(function (r) {
                if (!r || !r.rows) { res.innerHTML = '<p class="err">Не получилось. Повторите.</p>'; return; }
                var nameOf = {}; p.all.forEach(function (a) { nameOf[a.nm] = a.name; });
                var ok = r.rows.filter(function (x) { return x.ok; }).length;
                res.innerHTML = (p.notes.length ? '<p class="err">' + esc(p.notes.join('; ')) + '</p>' : '') +
                    '<table><tr><th>Артикул</th><th>Размер</th><th>Было</th><th>Спишем</th><th>Станет</th></tr>' +
                    r.rows.map(function (x) { return '<tr class="' + (x.ok ? '' : 'bad') + '"><td>' + esc(nameOf[String(x.nm_id)] || x.nm_id) + '</td><td>' + esc(x.size) + '</td><td>' + x.was + '</td><td>' + x.qty + '</td><td>' + (x.ok ? x.will : esc(x.why)) + '</td></tr>'; }).join('') + '</table>' +
                    '<p>' + (r.applied ? 'Отправлено на WB: ' + r.sent + ' позиций. Остальные пропущены.' : 'Подходит позиций: ' + ok + ' из ' + r.rows.length + '. Красные пропустим, остаток там не меняется.') + '</p>';
                go.disabled = r.applied || !ok; plan = r;
            });
        }
        box.addEventListener('click', function (e) {
            var t = e.target;
            if (t === box || t.closest('[data-x]')) box.remove();
            else if (t.closest('[data-chk]')) run(false);
            else if (t.closest('[data-go]') && plan && !go.disabled) run(true);
        });
    }
    function adjustBtn() {
        if (!staff() || doc.getElementById('ggx-adj-btn')) return;
        var tools = doc.getElementById('gg-now-tools'); if (!tools) return;
        var b = doc.createElement('button'); b.type = 'button'; b.id = 'ggx-adj-btn'; b.className = 'rnp-tool-icon'; b.title = 'Списать с FBS'; b.setAttribute('aria-label', 'Списать с FBS');
        b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>';
        b.onclick = adjustOpen; tools.insertBefore(b, tools.firstChild);
    }

    // «Раздачи» и «Контент» живут в «Продвижении» (только команда): полоска «Реклама | Раздачи | Контент» над списком кампаний.
    function setAdsView(which) {
        var bar = doc.getElementById('nr-ads-tabs'), view = doc.getElementById('adv-view-ads');
        var give = doc.getElementById('nr-ads-give'), content = doc.getElementById('nr-ads-content');
        if (!bar || !view || !give || !content) return;
        Array.prototype.forEach.call(bar.children, function (x) { x.classList.toggle('is-on', x.getAttribute('data-av') === which); });
        give.hidden = which !== 'give'; content.hidden = which !== 'content';
        view.style.display = which === 'ads' ? '' : 'none';
        if (which === 'give' && root.NrGiveaways && cab()) root.NrGiveaways.show({ host: give, supabase: db(), cabinetId: cab() });
        else if (root.NrGiveaways) root.NrGiveaways.hide();
        if (which === 'content') {
            // разметка контент-завода переезжает сюда один раз, дальше он рисует в тот же #cf-root
            var src = doc.getElementById('tab-content-factory');
            if (src) Array.prototype.slice.call(src.children).forEach(function (n) { content.appendChild(n); });
            if (root.bootContentFactory) root.bootContentFactory();
        }
    }
    function adsTabs() {
        if (!staff() || doc.getElementById('nr-ads-tabs')) return;
        var tab = doc.getElementById('tab-advertising'), view = doc.getElementById('adv-view-ads');
        if (!tab || !view) return;
        var bar = doc.createElement('div'); bar.id = 'nr-ads-tabs';
        bar.innerHTML = '<button type="button" class="gg-view-btn is-on" data-av="ads">Реклама</button><button type="button" class="gg-view-btn" data-av="give">Раздачи</button><button type="button" class="gg-view-btn" data-av="content">Контент</button>';
        var host = doc.createElement('div'); host.id = 'nr-ads-give'; host.className = 'gg-give'; host.hidden = true;
        var cont = doc.createElement('div'); cont.id = 'nr-ads-content'; cont.hidden = true;
        tab.insertBefore(bar, tab.firstChild); tab.appendChild(host); tab.appendChild(cont);
        bar.addEventListener('click', function (e) {
            var b = e.target.closest('[data-av]'); if (b) setAdsView(b.getAttribute('data-av'));
        });
    }
    function boot() {
        schedule();
        // переключение вкладок внутри «Товаров» и разделов сайта
        doc.addEventListener('click', function () { setTimeout(schedule, 250); }, true);
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
    root.NrGoodsUi = { refresh: schedule, openAdsView: function (w) { adsTabs(); setAdsView(w); } };
})(typeof window !== 'undefined' ? window : globalThis);

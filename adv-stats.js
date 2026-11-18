/* Окно кампании: блок «Ключевые фразы» (блок «Статистика РК по дням» удалён навсегда: API WB не отдаёт разбивку по зонам).
   Контракт: window.AdvStats.mount(el, ctx), ctx = { key, cabId, campaign: { wbId, ... }, currency? }.
   mount вызывается при каждой перерисовке окна для слота <div class="adp2-slot" data-slot="keys" data-key="…">
   и идемпотентен: вкладки, фильтры и загруженные данные лежат в памяти по ключу кампании.
   Скорость (CLAUDE.md): каркас показывается сразу, свежие данные подтягиваются в фоне и подставляются в таблицу без перерисовки каркаса;
   пока идёт загрузка, готовая таблица остаётся на месте (приглушена).
   Данные: wb-proxy adv_cluster_board (ключи) и adv_cluster_positions (частота и позиции). */
(function (root) {
    'use strict';
    var doc = root.document;
    var NB = ' ';
    var ST = {};
    var DASH = '—';
    var CUR_NAMES = { KGS: 'сом', RUB: '₽', KZT: '₸', BYN: 'Br', UZS: 'сўм' };
    var CURRENCY = {}; // cabId -> символ

    /* ───────── форматы ───────── */
    function grp(n) { var s = String(Math.abs(Math.round(n))); return (n < 0 && Math.round(n) !== 0 ? '−' : '') + s.replace(/\B(?=(\d{3})+(?!\d))/g, NB); }
    function dec(n, d) {
        var neg = n < 0, s = Math.abs(n).toFixed(d), p = s.split('.');
        return (neg ? '−' : '') + p[0].replace(/\B(?=(\d{3})+(?!\d))/g, NB) + (p[1] ? ',' + p[1] : '');
    }
    function curSign(cabId) { return CURRENCY[cabId] || '₽'; }
    function curName(code) { code = String(code || '').toUpperCase(); return CUR_NAMES[code] || code || '₽'; }
    function fmt(kind, v, cur) {
        if (v == null || !isFinite(v)) return '';
        var c = NB + (cur || '₽');
        if (kind === 'int') return grp(v);
        if (kind === 'rub0') return grp(v) + c;
        if (kind === 'rub1') return dec(v, 1) + c;
        if (kind === 'rub2') return dec(v, 2) + c;
        if (kind === 'pct') return Math.abs(v) >= 100 ? grp(v) + '%' : dec(v, 2) + '%';
        return String(v);
    }
    function pad(n) { return n < 10 ? '0' + n : String(n); }
    function ruDate(ymd) { var p = String(ymd || '').split('-'); return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : ''; }
    function ymdOf(d) { return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
    function parseYmd(s) { var p = String(s || '').slice(0, 10).split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
    function addDays(ymd, n) { var d = parseYmd(ymd); d.setUTCDate(d.getUTCDate() + n); return ymdOf(d); }
    function todayYmd() { return ymdOf(new Date(Date.now() + 3 * 3600e3)); }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
    function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }

    /* ───────── состояние ───────── */
    function deps() { try { return (root.AdsHQ && root.AdsHQ.getDeps && root.AdsHQ.getDeps()) || {}; } catch (e) { return {}; } }

    function defaultRange() {
        var to = todayYmd(), from = addDays(to, -29);
        try {
            var r = deps().getDateRange && deps().getDateRange();
            if (r && validYmd(String(r.from).slice(0, 10)) && validYmd(String(r.to).slice(0, 10))) { from = String(r.from).slice(0, 10); to = String(r.to).slice(0, 10); }
        } catch (e) { /* диапазон по умолчанию */ }
        if (to > todayYmd()) to = todayYmd();
        if (from > to) from = to;
        return { from: from, to: to };
    }

    function stateOf(ctx) {
        var key = String(ctx.key || (ctx.cabId + ':' + (ctx.campaign && ctx.campaign.wbId)));
        var st = ST[key];
        if (!st) {
            var rg = defaultRange();
            st = ST[key] = {
                key: key, cabId: ctx.cabId, wbId: Number(ctx.campaign && ctx.campaign.wbId) || 0,
                applied: { from: rg.from, to: rg.to }, scroll: {}, els: {}, kw: null, ctxCurrency: ctx.currency || '',
            };
        }
        if (ctx.cabId) st.cabId = ctx.cabId;
        if (ctx.campaign && ctx.campaign.wbId) st.wbId = Number(ctx.campaign.wbId) || st.wbId;
        if (ctx.currency) { st.ctxCurrency = ctx.currency; CURRENCY[st.cabId] = curName(ctx.currency); }
        return st;
    }

    function q(root_, r) { return root_.querySelector('[data-r="' + r + '"]'); }
    function setText(el, t) { if (el && el.textContent !== t) el.textContent = t; }

    function curOf(st) { return curSign(st.cabId); }

    /* ───────── ключи ───────── */
    function kwStateOf(st) {
        return st.kw || (st.kw = { rows: null, loading: false, error: '', tab: 'kw', filter: 'all', nm: '', sel: {}, sort: 'spend', dir: -1, limit: 300, pos: {}, run: null, perCall: 30, currency: '', msg: '' });
    }
    function kwKeyOf(r) { return r.nmId + '|' + r.normQuery; }
    function kwNms(kw) { var s = {}; (kw.rows || []).forEach(function (r) { s[r.nmId] = (s[r.nmId] || 0) + num(r.spend); }); return Object.keys(s).map(Number).sort(function (a, b) { return s[b] - s[a]; }); }
    function kwSelNm(kw) { var nms = kwNms(kw); if (kw.nm && kw.nm !== 'all' && nms.indexOf(Number(kw.nm)) >= 0) return String(kw.nm); return nms.length === 1 ? String(nms[0]) : 'all'; }
    /** Строки ключей выбранного артикула; при «Все» одинаковые фразы разных артикулов склеиваются. */
    function kwScope(kw) {
        var nm = kwSelNm(kw), rows = (kw.rows || []).filter(function (r) { return r.state !== 'archived'; });
        var src = nm === 'all' ? rows : rows.filter(function (r) { return String(r.nmId) === nm; });
        var by = {}, out = [];
        src.forEach(function (r) {
            var k = nm === 'all' ? r.normQuery : kwKeyOf(r), p = kw.pos[kwKeyOf(r)], a = by[k];
            if (!a) { a = by[k] = { q: r.normQuery, nmId: r.nmId, keys: [], clicks: 0, spend: 0, views: 0, orders: 0, managed: false, active: false, freq: null, pos: null, checked: false }; out.push(a); }
            a.keys.push(kwKeyOf(r));
            a.clicks += num(r.clicks); a.spend += num(r.spend); a.views += num(r.views); a.orders += num(r.orders);
            if (num(r.bid) > 0) a.managed = true;
            if (r.state === 'active' && !r.minus) a.active = true;
            var f = p ? p.f : (r.frequency != null ? r.frequency : null); if (f != null && (a.freq == null || f > a.freq)) a.freq = f;
            var ps = p ? p.p : (r.searchPosition != null ? r.searchPosition : null); if (ps != null && (a.pos == null || ps < a.pos)) a.pos = ps;
            if (p || r.searchPosition != null || r.frequency != null) a.checked = true;
        });
        return out;
    }
    function kwFiltered(kw, scope) {
        var f = kw.filter;
        var list = scope.filter(function (a) { return f === 'managed' ? a.managed : f === 'active' ? a.active : true; });
        var by = kw.sort, dir = kw.dir;
        list.sort(function (x, y) {
            var a, b;
            if (by === 'freq') { a = x.freq == null ? -1 : x.freq; b = y.freq == null ? -1 : y.freq; }
            else if (by === 'pos') { a = x.pos == null ? 1e9 : x.pos; b = y.pos == null ? 1e9 : y.pos; }
            else if (by === 'clicks') { a = x.clicks; b = y.clicks; }
            else if (by === 'cpc') { a = x.clicks ? x.spend / x.clicks : -1; b = y.clicks ? y.spend / y.clicks : -1; }
            else { a = x.spend; b = y.spend; }
            if (a !== b) return (a - b) * dir;
            return x.q < y.q ? -1 : 1;
        });
        return list;
    }
    function kwWords(scope) {
        var by = {}, out = [];
        scope.forEach(function (a) {
            String(a.q).split(/\s+/).filter(function (w) { return w.length > 1; }).forEach(function (w) {
                var o = by[w]; if (!o) { o = by[w] = { q: w, n: 0, freq: null, clicks: 0, spend: 0 }; out.push(o); }
                o.n++; o.clicks += a.clicks; o.spend += a.spend; if (a.freq != null) o.freq = (o.freq || 0) + a.freq;
            });
        });
        return out.sort(function (x, y) { return y.spend - x.spend || y.n - x.n; });
    }
    function searchUrl(q_) { return 'https://www.wildberries.ru/catalog/0/search.aspx?search=' + encodeURIComponent(q_); }

    function keysFrame() {
        var chev = ' ⌄';
        return '<div class="advs" data-advs-root="keys"><div class="card"><div class="stt">' +
            '<div class="seg" style="align-self:flex-start" role="tablist"><span class="a" role="tab" tabindex="0" data-advs="ktab" data-t="kw">Ключевые фразы</span><span role="tab" tabindex="0" data-advs="ktab" data-t="words">Слова в запросах</span></div>' +
            '<div class="bar" data-r="kbar"><button type="button" class="btn k" data-advs="kcheck" data-r="kcheck">Проверить позиции</button>' +
            '<span class="sub" style="margin:0">Проверяем ключей</span><label class="dt"><span data-r="kper"></span>' + chev + '<select data-advs="kper" aria-label="Сколько ключей проверять за раз"><option>5</option><option>10</option><option>30</option><option>60</option></select></label>' +
                        '<span data-r="kart" style="display:contents"><span class="sub" style="margin:0">Артикул</span><label class="dt"><span data-r="knm"></span>' + chev + '<select data-advs="knm" aria-label="Артикул"></select></label></span></div>' +
            '<div class="bar" data-r="kflt"><span class="seg" role="tablist" data-r="kchips"></span>' +
            '</div>' +
            '<div class="pw"><div class="prog" data-r="kprog"></div><div class="pane" data-r="kpane"></div></div>' +
            '<div class="sub" data-r="knote" hidden></div>' +
            '</div></div></div>';
    }

    function keysSkeleton() {
        var rows = '';
        for (var i = 0; i < 8; i++) rows += '<tr><td class="c"><span class="cb"></span></td><td class="k"><span class="sk">черный костюм женский</span></td><td><span class="sk">1 841</span></td><td><span class="sk">2 / 4</span></td><td><span class="sk">12</span></td><td><span class="sk">6,80</span></td><td><span class="sk">75</span></td></tr>';
        return rows;
    }
    function kwTableHtml(st, kw, list, scope) {
        var cur = curOf(st), h = '<table class="t kt"><thead><tr><th style="width:30px"></th>';
        var ths = [['q', 'Кластеры', 'l'], ['freq', 'Частота', 'sort'], ['pos', 'Позиция', 'sort'], ['clicks', 'Клики', 'sort'], ['cpc', 'CPC', 'sort'], ['spend', 'Затраты', 'sort']];
        ths.forEach(function (t) {
            var srt = t[2] === 'sort', on = srt && kw.sort === t[0] && kw.touched;
            h += '<th class="' + (t[2] === 'l' ? 'l' : '') + (on ? ' sorted' + (kw.dir > 0 ? ' asc' : '') : '') + '"' + (srt ? ' data-advs="ksort" data-s="' + t[0] + '"' : '') + '>' + t[1] + '</th>';
        });
        h += '</tr></thead><tbody>';
        var shown = list.slice(0, kw.limit);
        shown.forEach(function (a) {
            var k = a.keys[0], on = !!kw.sel[k];
            var posCell = a.checked ? (a.pos != null ? String(Math.round(a.pos)) : DASH) : '<button type="button" class="pos' + (kw.run && kw.run.cur === k ? ' run' : '') + '" data-advs="kpos1" data-k="' + esc(k) + '">проверить</button>';
            h += '<tr><td class="c"><span class="cb' + (on ? ' on' : '') + '" role="checkbox" tabindex="0" aria-checked="' + on + '" data-advs="ksel" data-k="' + esc(k) + '"></span></td>' +
                '<td class="k"><a href="' + searchUrl(a.q) + '" target="_blank" rel="noopener" title="Открыть поиск WB">' + esc(a.q) + ' <span>↗</span></a></td>' +
                '<td>' + (a.freq != null ? grp(a.freq) : '') + '</td><td>' + posCell + '</td>' +
                '<td>' + (a.clicks ? grp(a.clicks) : '') + '</td><td>' + (a.clicks ? dec(a.spend / a.clicks, 2) + NB + cur : '') + '</td><td>' + (a.spend ? fmt(a.spend < 10 ? 'rub1' : 'rub0', a.spend, cur) : '') + '</td></tr>';
        });
        var tc = 0, ts = 0, tf = 0, anyF = false; list.forEach(function (a) { tc += a.clicks; ts += a.spend; if (a.freq != null) { tf += a.freq; anyF = true; } });
        h += '<tr class="sum"><td></td><td class="k">Итого ' + grp(list.length) + ' ' + plural(list.length, 'ключ', 'ключа', 'ключей') + '</td><td>' + (anyF ? grp(tf) : '') + '</td><td></td><td>' + (tc ? grp(tc) : '') + '</td><td>' + (tc ? dec(ts / tc, 2) + NB + cur : '') + '</td><td>' + (ts ? fmt('rub0', ts, cur) : '') + '</td></tr>';
        h += '</tbody></table>';
        if (list.length > shown.length) h += '<button type="button" class="btn more" data-advs="kmore" style="margin:8px">Показать ещё ' + Math.min(300, list.length - shown.length) + '</button>';
        return h;
    }
    function kwWordsHtml(st, words) {
        var cur = curOf(st), h = '<table class="t kt"><thead><tr><th class="l">Слова</th><th>Фраз</th><th>Частота</th><th>Клики</th><th>CPC</th><th>Затраты</th></tr></thead><tbody>';
        words.slice(0, 300).forEach(function (w) {
            h += '<tr><td class="k"><a href="' + searchUrl(w.q) + '" target="_blank" rel="noopener">' + esc(w.q) + ' <span>↗</span></a></td><td>' + w.n + '</td><td>' + (w.freq != null ? grp(w.freq) : '') + '</td><td>' + (w.clicks ? grp(w.clicks) : '') + '</td><td>' + (w.clicks ? dec(w.spend / w.clicks, 2) + NB + cur : '') + '</td><td>' + (w.spend ? fmt('rub0', w.spend, cur) : '') + '</td></tr>';
        });
        return h + '</tbody></table>';
    }
    function plural(n, a, b, c) { var m = n % 100, d = n % 10; return m > 10 && m < 15 ? c : d === 1 ? a : d >= 2 && d <= 4 ? b : c; }

    function paintKeys(st) {
        var el = st.els.keys; if (!el || !el.isConnected) return;
        var r0 = el.querySelector('[data-advs-root="keys"]'); if (!r0) return;
        var kw = kwStateOf(st);
        r0.querySelectorAll('[data-advs="ktab"]').forEach(function (t) { var a = t.getAttribute('data-t') === kw.tab; t.classList.toggle('a', a); t.setAttribute('aria-selected', a ? 'true' : 'false'); });
        var words = kw.tab === 'words';
        q(r0, 'kbar').hidden = words;
        setText(q(r0, 'kper'), String(kw.perCall));
        var pane = q(r0, 'kpane');
        if (!kw.rows) {
            if (!pane.getAttribute('data-sk')) { pane.innerHTML = '<div class="scr k"><table class="t kt"><thead><tr><th style="width:30px"></th><th class="l">Кластеры</th><th>Частота</th><th>Позиция</th><th>Клики</th><th>CPC</th><th>Затраты</th></tr></thead><tbody>' + keysSkeleton() + '</tbody></table></div>'; pane.setAttribute('data-sk', '1'); }
            q(r0, 'kprog').classList.toggle('on', !!kw.loading);
            q(r0, 'kchips').innerHTML = '<span class="a">Все<b>—</b></span><span>Управляемые<b>—</b></span><span>Активные<b>—</b></span>';
            setKeysNote(r0, kw.error ? kw.error : '', true, st);
            return;
        }
        pane.removeAttribute('data-sk');
        var scope = kwScope(kw), list = kwFiltered(kw, scope);
        var cnt = { all: scope.length, managed: scope.filter(function (a) { return a.managed; }).length, active: scope.filter(function (a) { return a.active; }).length };
        var chips = [['all', 'Все'], ['managed', 'Управляемые'], ['active', 'Активные']].map(function (c) { return '<span role="tab" tabindex="0" data-advs="kflt" data-f="' + c[0] + '"' + (kw.filter === c[0] ? ' class="a"' : '') + '>' + c[1] + '<b>' + cnt[c[0]] + '</b></span>'; }).join('');
        var kc = q(r0, 'kchips'); if (kc.getAttribute('data-sig') !== chips) { kc.innerHTML = chips; kc.setAttribute('data-sig', chips); }
        q(r0, 'kflt').hidden = false;
        var sel = r0.querySelector('select[data-advs="knm"]'), nms = kwNms(kw), cur = kwSelNm(kw);
        var opts = (nms.length > 1 ? '<option value="all">Все</option>' : '') + nms.map(function (n) { return '<option value="' + n + '">' + n + '</option>'; }).join('');
        if (sel.getAttribute('data-sig') !== opts) { sel.innerHTML = opts; sel.setAttribute('data-sig', opts); }
        sel.value = cur; setText(q(r0, 'knm'), cur === 'all' ? 'Все' : cur);
        var kart = q(r0, 'kart'); if (kart) kart.style.display = nms.length > 1 ? 'contents' : 'none'; // один артикул: выбирать нечего
        var per = r0.querySelector('select[data-advs="kper"]'); per.value = String(kw.perCall); setText(q(r0, 'kper'), String(kw.perCall));
        // кнопка проверки: пока идёт — «Остановить / Осталось: N»
        var kb = q(r0, 'kcheck'), left = 0; scope.forEach(function (a) { if (!a.checked) left++; });
        if (kw.run) { setText(kb, 'Остановить / Осталось: ' + kw.run.left); kb.classList.remove('off'); }
        else { setText(kb, left ? 'Проверить позиции · ' + left : 'Позиции проверены'); kb.classList.toggle('off', !left); }
        var sig = [kw.tab, kw.filter, kw.sort, kw.dir, kw.limit, cur, scope.length, list.length, JSON.stringify(kw.sel).length, Object.keys(kw.pos).length, kw.run ? kw.run.cur || '' : '', curOf(st), kw.touched ? 1 : 0, scope.reduce(function (s, a) { return s + a.spend + a.clicks; }, 0)].join('|');
        if (pane.getAttribute('data-sig') !== sig) {
            pane.innerHTML = '<div class="scr k">' + (words ? kwWordsHtml(st, kwWords(scope)) : kwTableHtml(st, kw, list, scope)) + '</div>';
            pane.setAttribute('data-sig', sig);
            var scr = pane.querySelector('.scr'), sc = st.scroll['k' + kw.tab];
            if (sc) { scr.scrollLeft = sc[0]; scr.scrollTop = sc[1]; }
            scr.addEventListener('scroll', function () { st.scroll['k' + kw.tab] = [scr.scrollLeft, scr.scrollTop]; }, { passive: true });
            var thead = scr.querySelector('thead tr'); if (thead) { /* шапка ключей закреплена сверху */ }
        }
        pane.classList.toggle('stale', !!kw.loading);
        q(r0, 'kprog').classList.toggle('on', !!kw.loading || !!(kw.run && kw.run.busy));
        setKeysNote(r0, kw.error || kw.msg || '', false, st);
    }
    function setKeysNote(r0, text, skel, st) {
        var n = q(r0, 'knote'); if (!n) return;
        n.hidden = !text; n.classList.toggle('err', !!(st.kw && st.kw.error));
        n.innerHTML = text ? esc(text) + (st.kw && st.kw.error ? ' <button type="button" class="lnk" data-advs="kretry">Повторить</button>' : '') : '';
    }

    function loadKeys(st, force, rng) {
        var kw = kwStateOf(st), d = deps(); rng = rng || st.applied;
        if (kw.loading || (kw.rows && !force)) return;
        if (!d.callWbProxy) { kw.error = 'Ключи сейчас недоступны'; paintKeys(st); return; }
        kw.loading = true; kw.error = ''; paintKeys(st);
        Promise.resolve(d.callWbProxy('adv_cluster_board', { advertId: st.wbId, dateFrom: rng.from, dateTo: rng.to }, st.cabId)).then(function (res) {
            kw.loading = false;
            if (!res || res.error) { kw.error = String((res && res.error) || 'WB не отдал ключи этой кампании'); paintKeys(st); return; }
            kw.rows = res.rows || []; kw.currency = res.currency || '';
            if (res.currency) CURRENCY[st.cabId] = curName(res.currency);
            paintKeys(st);
        }).catch(function (e) { kw.loading = false; kw.error = 'Не получилось загрузить ключи: ' + String((e && e.message) || e || 'ошибка'); paintKeys(st); });
    }

    /** Позиции и частоту WB отдаёт порциями (по 30 фраз, 3 запроса в минуту на кабинет): идём по очереди, не блокируя экран. */
    function checkPositions(st, only) {
        var kw = kwStateOf(st);
        if (kw.run) { kw.run.stop = true; kw.run = null; paintKeys(st); return; }
        var scope = kwScope(kw), todo = [];
        scope.forEach(function (a) {
            if (a.checked) return;
            a.keys.forEach(function (k) { var p = k.indexOf('|'); todo.push({ k: k, nm: Number(k.slice(0, p)), q: k.slice(p + 1) }); });
        });
        if (only) todo = todo.filter(function (t) { return only.indexOf(t.k) >= 0; });
        if (!todo.length) {
            kw.msg = kw.rows ? 'Позиции этих ключей уже проверены' : 'Ключи ещё загружаются';
            paintKeys(st); clearTimeout(kw.msgT); kw.msgT = setTimeout(function () { kw.msg = ''; paintKeys(st); }, 3000);
            return;
        }
        var run = kw.run = { left: todo.length, stop: false, cur: only && only.length === 1 ? only[0] : '', busy: true };
        kw.msg = '';
        paintKeys(st);
        function step() {
            if (run.stop) return;
            if (!todo.length) { kw.run = null; paintKeys(st); return; }
            var nm = todo[0].nm, batch = todo.filter(function (t) { return t.nm === nm; }).slice(0, only ? 60 : kw.perCall);
            run.busy = true; paintKeys(st);
            Promise.resolve(deps().callWbProxy('adv_cluster_positions', { nmId: nm, queries: batch.map(function (t) { return t.q; }), dateFrom: st.applied.from, dateTo: st.applied.to }, st.cabId)).then(function (res) {
                if (run.stop) return;
                run.busy = false;
                if (!res || res.error) { kw.msg = 'Позиции: ' + String((res && res.error) || 'нет ответа от WB') + '. Попробуйте ещё раз через минуту.'; kw.run = null; paintKeys(st); return; }
                var got = {}; (res.positions || []).forEach(function (p) { got[String(p.query).toLowerCase()] = p; });
                batch.forEach(function (t) {
                    var p = got[t.q.toLowerCase()];
                    kw.pos[t.k] = { f: p ? num(p.frequency) : null, p: p && p.avgPosition != null ? Number(p.avgPosition) : null, o: p ? num(p.orders) : 0 };
                });
                var done = {}; batch.forEach(function (t) { done[t.k] = 1; });
                todo = todo.filter(function (t) { return !done[t.k]; });
                run.left = todo.length; run.cur = '';
                if (res.errors && res.errors.length && !(res.positions || []).length) kw.msg = 'WB не вернул позиции: ' + String(res.errors[0]).slice(0, 120);
                paintKeys(st);
                if (todo.length) setTimeout(step, only ? 0 : 21000); else { kw.run = null; paintKeys(st); }
            }).catch(function (e) { run.busy = false; kw.msg = 'Позиции: ' + String((e && e.message) || e || 'ошибка'); kw.run = null; paintKeys(st); });
        }
        step();
    }

    function onClick(st, e) {
        var t = e.target.closest('[data-advs]'); if (!t) return;
        var a = t.getAttribute('data-advs');
        if (a === 'kper' || a === 'knm') return;
        // ключи
        var kw = kwStateOf(st);
        if (a === 'ktab') { kw.tab = t.getAttribute('data-t'); paintKeys(st); return; }
        if (a === 'kflt') { kw.filter = t.getAttribute('data-f'); kw.limit = 300; paintKeys(st); return; }
        if (a === 'ksort') { var s2 = t.getAttribute('data-s'); if (s2 === 'q') return; kw.dir = kw.sort === s2 ? -kw.dir : (s2 === 'pos' ? 1 : -1); kw.sort = s2; kw.touched = true; paintKeys(st); return; }
        if (a === 'ksel') { var k = t.getAttribute('data-k'); if (kw.sel[k]) delete kw.sel[k]; else kw.sel[k] = 1; paintKeys(st); return; }
        if (a === 'kmore') { kw.limit += 300; paintKeys(st); return; }
        if (a === 'kretry') { loadKeys(st, true); return; }
        if (a === 'kcheck') { checkPositions(st); return; }
        if (a === 'kpos1') { if (!kw.run) checkPositions(st, [t.getAttribute('data-k')]); return; }
    }
    function onChange(st, e) {
        var t = e.target, a = t.getAttribute && t.getAttribute('data-advs'); if (!a) return;
        var kw = kwStateOf(st);
        if (a === 'knm') { kw.nm = t.value; kw.limit = 300; paintKeys(st); return; }
        if (a === 'kper') { kw.perCall = Number(t.value) || 30; paintKeys(st); return; }
    }
    function onKey(st, e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        var t = e.target.closest && e.target.closest('[role="tab"],[role="checkbox"]'); if (!t) return;
        e.preventDefault(); onClick(st, { target: t });
    }

    /* ───────── mount ───────── */
    function mount(el, ctx) {
        if (!el || !ctx) return;
        var slot = el.getAttribute('data-slot') || ctx.slot || '';
        if (slot !== 'keys') return; // других слотов нет: блок «Статистика РК по дням» удалён навсегда
        if (!ctx.key && el.getAttribute('data-key')) ctx = Object.assign({}, ctx, { key: el.getAttribute('data-key') });
        var st = stateOf(ctx);
        var first = !el.__advs || el.__advs !== st.key + ':' + slot || !el.querySelector('.advs');
        st.els[slot] = el;
        if (first) {
            el.__advs = st.key + ':' + slot;
            el.innerHTML = keysFrame();
            if (!el.__advsBound) {
                el.__advsBound = true;
                el.addEventListener('click', function (e) { onClick(ST[el.__advs.slice(0, el.__advs.lastIndexOf(':'))], e); });
                el.addEventListener('change', function (e) { onChange(ST[el.__advs.slice(0, el.__advs.lastIndexOf(':'))], e); });
                el.addEventListener('keydown', function (e) { onKey(ST[el.__advs.slice(0, el.__advs.lastIndexOf(':'))], e); });
            }
        }
        paintKeys(st);
        if (!kwStateOf(st).rows && !kwStateOf(st).loading && !kwStateOf(st).error) setTimeout(function () { loadKeys(st); }, 0);
    }

    var api = {
        mount: mount,
        // чистые функции для тестов
        fmt: fmt, grp: grp, dec: dec, ruDate: ruDate, addDays: addDays,
        kwScope: kwScope, kwFiltered: kwFiltered, kwWords: kwWords, searchUrl: searchUrl, _state: ST,
    };
    root.AdvStats = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

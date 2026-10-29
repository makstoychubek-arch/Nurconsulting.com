/* Копии (Инструменты, только команда, BETA): чтение файлов копии базы прямо в браузере.
 * Принимает CSV и CSV.GZ (по файлу на таблицу), ничего никуда не отправляет, поэтому работает и без базы.
 * Страница и пункт меню создаются здесь, чтобы не раздувать dashboard.html. */
(function (root) {
    'use strict';
    var doc = root.document;
    if (!doc) return;

    var PAGE = 60;
    var S = { tables: [], cur: null, q: '', sort: -1, dir: 1, shown: PAGE, rows: [], view: 'read' };

    function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function fmtN(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
    function fmtBytes(b) { return b >= 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' МБ' : Math.max(1, Math.round(b / 1024)) + ' КБ'; }
    function tableName(f) { return f.name.replace(/\.gz$/i, '').replace(/\.csv$/i, '').replace(/[-_]?\d{4}-\d{2}-\d{2}.*$/, '') || f.name; }
    function fileDate(f) { var m = f.name.match(/\d{4}-\d{2}-\d{2}/); return m ? m[0] : new Date(f.lastModified).toISOString().slice(0, 10); }

    // Разбор CSV (RFC 4180): кавычки, запятая или точка с запятой, переводы строк внутри полей.
    function parseCsv(text) {
        if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
        var head = text.slice(0, text.indexOf('\n') > 0 ? text.indexOf('\n') : text.length);
        var delim = (head.match(/;/g) || []).length > (head.match(/,/g) || []).length ? ';' : ',';
        var rows = [], row = [], cell = '', q = false, i = 0, n = text.length, c;
        while (i < n) {
            c = text[i];
            if (q) {
                if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i += 2; continue; } q = false; i++; continue; }
                cell += c; i++; continue;
            }
            if (c === '"') { q = true; i++; continue; }
            if (c === delim) { row.push(cell); cell = ''; i++; continue; }
            if (c === '\n' || c === '\r') {
                if (c === '\r' && text[i + 1] === '\n') i++;
                row.push(cell); cell = ''; rows.push(row); row = []; i++; continue;
            }
            cell += c; i++;
        }
        if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
        return rows;
    }

    async function readFile(f) {
        var buf;
        if (/\.gz$/i.test(f.name)) {
            if (typeof DecompressionStream === 'undefined') throw new Error('Этот браузер не умеет читать .gz, откройте в Chrome или Safari 16+.');
            buf = await new Response(f.stream().pipeThrough(new DecompressionStream('gzip'))).text();
        } else buf = await f.text();
        var rows = parseCsv(buf);
        var cols = rows.shift() || [];
        return { name: tableName(f), file: f.name, date: fileDate(f), size: f.size, cols: cols, rows: rows };
    }

    function toNum(v) { var x = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); return isNaN(x) ? null : x; }

    function filtered() {
        var t = S.cur, q = S.q.trim().toLowerCase();
        var rows = t.rows;
        if (q) rows = rows.filter(function (r) { for (var i = 0; i < r.length; i++) if (String(r[i]).toLowerCase().indexOf(q) >= 0) return true; return false; });
        if (S.sort >= 0) {
            var k = S.sort, d = S.dir;
            rows = rows.slice().sort(function (a, b) {
                var x = a[k], y = b[k], nx = toNum(x), ny = toNum(y);
                if (nx != null && ny != null) return (nx - ny) * d;
                return String(x).localeCompare(String(y), 'ru') * d;
            });
        }
        return rows;
    }

    function csvOut(cols, rows) {
        var q = function (v) { v = String(v == null ? '' : v); return /[",;\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
        return '﻿' + [cols].concat(rows).map(function (r) { return r.map(q).join(';'); }).join('\r\n');
    }
    function download(name, text) {
        var a = doc.createElement('a');
        a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
        a.download = name; doc.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    }

    var tab = null;
    function nav() {
        return '<div class="an-nav bk-nav" role="tablist"><button type="button" class="an-tab' + (S.view === 'read' ? ' on' : '') + '" data-bk-view="read">Чтение копии</button>' +
            '<button type="button" class="an-tab' + (S.view === 'status' ? ' on' : '') + '" data-bk-view="status">Расписание и статус</button></div>';
    }
    function tile(l, v, dark, extra) { return '<div class="an-tile' + (dark ? ' an-dark' : '') + '"><div class="an-cap">' + l + '</div><b>' + v + '</b>' + (extra || '') + '</div>'; }

    function drawDrop(msg) {
        return '<div class="bk-drop"><b>Выберите файлы копии</b><p>Скачайте файлы из Google Drive и выберите их здесь, можно сразу все. Файл читается в браузере и никуда не отправляется, поэтому страница работает, даже если база недоступна.</p>' +
            '<label class="bk-btn">Выбрать файлы<input type="file" id="bk-file" accept=".csv,.gz,.csv.gz" multiple hidden></label>' +
            '<span class="an-note">Формат: CSV или CSV.GZ, по файлу на таблицу</span>' + (msg ? '<span class="bk-err">' + esc(msg) + '</span>' : '') + '</div>';
    }

    function drawList() {
        var total = S.tables.reduce(function (a, t) { return a + t.rows.length; }, 0);
        var size = S.tables.reduce(function (a, t) { return a + t.size; }, 0);
        var date = S.tables.map(function (t) { return t.date; }).sort().pop();
        return '<div class="an-tiles">' + tile('Копия от', esc(date), true) + tile('Таблиц', S.tables.length) + tile('Строк всего', fmtN(total)) + tile('Размер', fmtBytes(size)) + '</div>' +
            '<div class="an-tools"><label class="bk-btn bk-ghost">Другие файлы<input type="file" id="bk-file" accept=".csv,.gz,.csv.gz" multiple hidden></label></div>' +
            '<div class="bk-list">' + S.tables.map(function (t, i) {
                return '<button type="button" class="bk-tb" data-bk-open="' + i + '"><i>↗</i><b>' + esc(t.name) + '</b><span>' + fmtN(t.rows.length) + '</span><small>' + t.cols.slice(0, 4).map(esc).join(', ') + '</small></button>';
            }).join('') + '</div>';
    }

    function drawTable() {
        var t = S.cur, rows = filtered(), part = rows.slice(0, S.shown);
        return '<button type="button" class="bk-back" data-bk-back="1">← Все таблицы · копия от ' + esc(t.date) + '</button>' +
            '<div class="bk-ttl">' + esc(t.name) + '</div>' +
            '<div class="an-tools"><input class="an-inp" id="bk-q" placeholder="Поиск по таблице" value="' + esc(S.q) + '" autocomplete="off">' +
            '<span class="an-chip on">' + fmtN(rows.length) + ' из ' + fmtN(t.rows.length) + ' строк</span>' +
            '<button type="button" class="bk-btn bk-ghost" data-bk-dl="1">Скачать в Excel</button></div>' +
            '<div class="an-tw"><table class="an-table bk-table"><thead><tr>' + t.cols.map(function (c, i) {
                return '<th data-bk-sort="' + i + '">' + esc(c) + (S.sort === i ? (S.dir > 0 ? ' ▲' : ' ▼') : '') + '</th>';
            }).join('') + '</tr></thead><tbody>' + part.map(function (r) {
                return '<tr>' + t.cols.map(function (_, i) { return '<td>' + esc(r[i]) + '</td>'; }).join('') + '</tr>';
            }).join('') + '</tbody></table></div>' +
            (rows.length > part.length ? '<button type="button" class="bk-btn bk-ghost bk-more" data-bk-more="1">Показать ещё ' + Math.min(PAGE, rows.length - part.length) + '</button>' : '') +
            '<p class="an-note">Показано ' + fmtN(part.length) + ' из ' + fmtN(rows.length) + '.</p>';
    }

    function drawStatus() {
        return '<div class="an-tiles">' + tile('Последняя копия', 'не настроена', true) + tile('Хранится', '30 дней') + tile('Куда', 'Google Drive') + tile('Расписание', 'раз в сутки') + '</div>' +
            '<p class="an-note">Автоматическая ночная копия ещё не подключена: нужен ключ Google и папка на Drive. Пока копию можно снять вручную и читать здесь. Если автокопия включена, а за сутки файла нет, здесь появится красный статус «Нет копии» и придёт сообщение в Telegram.</p>';
    }

    function draw(msg) {
        if (!tab) return;
        var body;
        if (S.view === 'status') body = drawStatus();
        else if (S.cur) body = drawTable();
        else if (S.tables.length) body = drawList();
        else body = drawDrop(msg);
        var keepQ = tab.querySelector('#bk-q') === doc.activeElement;
        tab.innerHTML = '<div class="bk-wrap">' + nav() + '<div class="bk-body">' + body + '</div></div>';
        if (keepQ) { var q = tab.querySelector('#bk-q'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }
    }

    async function load(files) {
        var list = Array.prototype.slice.call(files || []).filter(function (f) { return /\.(csv|gz)$/i.test(f.name); });
        if (!list.length) { draw('Нужны файлы CSV или CSV.GZ.'); return; }
        draw('');
        var body = tab.querySelector('.bk-body');
        if (body) body.innerHTML = '<div class="bk-drop"><b>Читаем файлы…</b><p>Крупные таблицы читаются несколько секунд.</p></div>';
        var out = [];
        try {
            for (var i = 0; i < list.length; i++) { out.push(await readFile(list[i])); await new Promise(function (r) { setTimeout(r, 0); }); }
        } catch (e) { S.tables = []; draw(e && e.message ? e.message : 'Не удалось прочитать файл.'); return; }
        S.tables = out; S.cur = null; S.q = ''; S.sort = -1; S.dir = 1; S.shown = PAGE; S.view = 'read';
        draw();
    }

    function onClick(e) {
        var t = e.target;
        var v = t.closest && t.closest('[data-bk-view]');
        if (v) { S.view = v.getAttribute('data-bk-view'); draw(); return; }
        var o = t.closest && t.closest('[data-bk-open]');
        if (o) { S.cur = S.tables[+o.getAttribute('data-bk-open')]; S.q = ''; S.sort = -1; S.dir = 1; S.shown = PAGE; draw(); return; }
        if (t.closest && t.closest('[data-bk-back]')) { S.cur = null; draw(); return; }
        var s = t.closest && t.closest('[data-bk-sort]');
        if (s) { var k = +s.getAttribute('data-bk-sort'); if (S.sort === k) S.dir = -S.dir; else { S.sort = k; S.dir = 1; } S.shown = PAGE; draw(); return; }
        if (t.closest && t.closest('[data-bk-more]')) { S.shown += PAGE; draw(); return; }
        if (t.closest && t.closest('[data-bk-dl]')) { download(S.cur.name + '.csv', csvOut(S.cur.cols, filtered())); }
    }

    function mount() {
        if (doc.getElementById('tab-backups')) return;
        var anchor = doc.getElementById('tab-analytics');
        if (!anchor) return;
        tab = doc.createElement('div');
        tab.id = 'tab-backups'; tab.className = 'tab-content'; tab.setAttribute('data-staff-only', '1');
        anchor.parentNode.insertBefore(tab, anchor.nextSibling);
        tab.addEventListener('click', onClick);
        tab.addEventListener('change', function (e) { if (e.target && e.target.id === 'bk-file') load(e.target.files); });
        var timer = null;
        tab.addEventListener('input', function (e) {
            if (!e.target || e.target.id !== 'bk-q') return;
            clearTimeout(timer);
            timer = setTimeout(function () { S.q = e.target.value; S.shown = PAGE; draw(); }, 200);
        });
        draw();
        var fly = doc.querySelector('#fly-tools .flyout-body');
        if (fly && !fly.querySelector('[data-bk-nav]')) {
            var item = doc.createElement('div');
            item.className = 'nav-item'; item.setAttribute('data-bk-nav', '1'); item.setAttribute('data-staff-only', '1');
            item.setAttribute('onclick', "showTab('backups', this)");
            item.innerHTML = '<svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="6" rx="7.5" ry="3"/><path d="M4.5 6v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6M4.5 12v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6"/></svg>' +
                '<span class="nav-item-label">Копии</span><span class="nav-beta-badge">BETA</span>';
            var sec = doc.createElement('div'); sec.className = 'flyout-sec'; sec.setAttribute('data-staff-only', '1'); sec.textContent = 'Данные';
            fly.appendChild(sec); fly.appendChild(item);
        }
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', mount); else mount();
    root.NrBackups = { parseCsv: parseCsv, mount: mount };
})(typeof window !== 'undefined' ? window : globalThis);

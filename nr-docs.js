/* Документы (Настройки, только команда): сертификаты, декларации и т.п. по кабинету (каждый документ с артикулом)
 * и общая папка «Консалтинг». Файлы в закрытом бакете cabinet-docs, строки в cabinet_documents (доступ только is_staff).
 * Вкладка и панель создаются здесь, чтобы не раздувать dashboard.html. */
(function (root) {
    'use strict';
    var doc = root.document;
    if (!doc) return;

    var BUCKET = 'cabinet-docs';
    var FOLDERS = {
        cab: [['declaration', 'Декларации'], ['certificate', 'Сертификаты'], ['other', 'Прочее']],
        con: [['contract', 'Договоры'], ['requisites', 'Реквизиты'], ['other', 'Прочее']]
    };
    var S = { scope: 'cab', folder: '', q: '', rows: [], arts: [], cab: '', loading: false, form: null, err: '' };
    var pane = null, btn = null, uid = 0;

    function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function fmtBytes(b) { if (!b) return ''; return b >= 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' МБ' : Math.max(1, Math.round(b / 1024)) + ' КБ'; }
    function fmtDate(d) { if (!d) return ''; var p = String(d).slice(0, 10).split('-'); return p[2] + '.' + p[1] + '.' + p[0]; }
    function isStaffUser() { try { return typeof isStaff !== 'undefined' && !!isStaff; } catch (e) { return false; } }
    function curCab() { try { return (typeof currentCabinetId !== 'undefined' ? currentCabinetId : '') || ''; } catch (e) { return ''; } }
    function db() { try { return typeof supabase !== 'undefined' ? supabase : null; } catch (e) { return null; } }
    function safeName(n) { return String(n).replace(/[^\wа-яА-ЯёЁ.\-]+/g, '_').slice(-80); }
    function daysLeft(d) { if (!d) return null; return Math.round((new Date(String(d).slice(0, 10) + 'T00:00:00') - new Date(new Date().toDateString())) / 86400000); }

    function status(r) {
        if (r.pending) return '<span class="dc-pill dc-gr">Загружается…</span>';
        if (r.failed) return '<span class="dc-pill dc-dn">Не удалось</span>';
        var n = daysLeft(r.valid_until);
        if (n == null) return '<span class="dc-pill dc-gr">Без срока</span>';
        if (n < 0) return '<span class="dc-pill dc-dn">Истёк</span>';
        if (n <= 30) return '<span class="dc-pill dc-dn">Истекает через ' + n + ' дн.</span>';
        return '<span class="dc-pill dc-up">Действует</span>';
    }

    function scopeRows() { return S.rows.filter(function (r) { return S.scope === 'con' ? !r.cabinet_id : r.cabinet_id === S.cab; }); }
    function visibleRows() {
        var q = S.q.trim().toLowerCase();
        return scopeRows().filter(function (r) {
            if (S.folder && r.folder !== S.folder) return false;
            if (!q) return true;
            return (String(r.title) + ' ' + (r.seller_article || '') + ' ' + (r.nm_id || '')).toLowerCase().indexOf(q) >= 0;
        });
    }

    function draw() {
        if (!pane) return;
        var all = scopeRows(), list = visibleRows();
        var folders = FOLDERS[S.scope];
        var expiring = all.filter(function (r) { var n = daysLeft(r.valid_until); return n != null && n <= 30; }).length;
        var tiles = folders.map(function (f, i) {
            var n = all.filter(function (r) { return r.folder === f[0]; }).length;
            return '<button type="button" class="bk-tb dc-fd' + (S.folder === f[0] ? ' on' : '') + '" data-dc-folder="' + f[0] + '"><i>↗</i><b>' + f[1] + '</b><span>' + n + '</span><small>' + (i === 0 && S.scope === 'cab' && expiring ? expiring + ' скоро истекают' : 'нажмите, чтобы отфильтровать') + '</small></button>';
        }).join('');
        var nav = '<div class="an-nav"><button type="button" class="an-tab' + (S.scope === 'cab' ? ' on' : '') + '" data-dc-scope="cab">Кабинет</button><button type="button" class="an-tab' + (S.scope === 'con' ? ' on' : '') + '" data-dc-scope="con">Консалтинг</button></div>';
        var form = S.form ? drawForm() : '<div class="dc-drop"><div><b>Загрузить документ</b><p>' + (S.scope === 'cab' ? 'PDF или фото. Для каждого документа нужен артикул.' : 'Общая папка компании, от выбранного кабинета не зависит.') + '</p></div><label class="bk-btn">Выбрать файлы<input type="file" id="dc-file" multiple hidden accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"></label></div>';
        var rows = list.map(function (r) {
            var fd = (FOLDERS[r.cabinet_id ? 'cab' : 'con'].filter(function (f) { return f[0] === r.folder; })[0] || [0, r.folder])[1];
            return '<tr><td>' + esc(r.title) + '<small>' + esc(r.file_name || '') + (r.file_size ? ' · ' + fmtBytes(r.file_size) : '') + '</small></td><td>' + esc(fd) + '</td>' +
                (S.scope === 'cab' ? '<td>' + esc(r.seller_article || r.nm_id || '') + '<small>' + esc(r.nm_id || '') + '</small></td>' : '') +
                '<td>' + (r.valid_until ? fmtDate(r.valid_until) : 'без срока') + '</td><td>' + status(r) + '</td><td class="dc-act">' +
                (r.failed ? '<button type="button" data-dc-retry="' + esc(r.id) + '">Повторить</button>' : (r.pending ? '' : '<button type="button" data-dc-get="' + esc(r.id) + '">Скачать</button><button type="button" data-dc-del="' + esc(r.id) + '">Удалить</button>')) + '</td></tr>';
        }).join('');
        var table = list.length ? '<div class="an-tw"><table class="an-table dc-table"><thead><tr><th>Документ</th><th>Папка</th>' + (S.scope === 'cab' ? '<th>Артикул</th>' : '') + '<th>Действует до</th><th>Статус</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>'
            : '<p class="an-note">' + (S.loading ? 'Загружаем документы…' : (all.length ? 'Ничего не найдено.' : 'Документов пока нет. Загрузите первый.')) + '</p>';
        var keepQ = pane.querySelector('#dc-q') === doc.activeElement;
        pane.innerHTML = '<div class="bk-wrap">' + nav + '<div class="bk-body">' + (S.err ? '<span class="bk-err">' + esc(S.err) + '</span>' : '') +
            '<div class="bk-list">' + tiles + '</div>' + form +
            '<div class="an-tools"><input class="an-inp" id="dc-q" placeholder="Поиск по названию или артикулу" value="' + esc(S.q) + '" autocomplete="off">' + (S.folder ? '<button type="button" class="an-chip on dc-chip" data-dc-folder="">Все папки ✕</button>' : '') + '</div>' + table + '</div></div>';
        if (keepQ) { var q = pane.querySelector('#dc-q'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }
    }

    function drawForm() {
        var f = S.form, folders = FOLDERS[S.scope];
        var artSel = S.scope === 'cab' ? '<label class="dc-lbl">Артикул (обязательно)<select id="dc-art" class="an-inp"><option value="">Выберите артикул</option>' +
            S.arts.map(function (a) { return '<option value="' + esc(a.nm_id) + '"' + (String(f.nm) === String(a.nm_id) ? ' selected' : '') + '>' + esc((a.seller_article || a.name || '') + ' · ' + a.nm_id) + '</option>'; }).join('') + '</select></label>' : '';
        var term = (S.scope === 'cab' && f.folder !== 'other') ? '<label class="dc-lbl">Действует до<input type="date" id="dc-until" class="an-inp" value="' + esc(f.until || '') + '"></label>' : '';
        return '<div class="dc-form"><div class="an-cap">Загрузка · ' + f.files.length + ' ' + (f.files.length === 1 ? 'файл' : 'файла') + '</div>' +
            '<div class="dc-files">' + f.files.map(function (x) { return esc(x.name) + ' (' + fmtBytes(x.size) + ')'; }).join(', ') + '</div>' +
            '<div class="an-tools">' + folders.map(function (x) { return '<button type="button" class="an-chip' + (f.folder === x[0] ? ' on' : '') + '" data-dc-type="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' +
            '<div class="an-tools">' + artSel + term + '</div>' +
            '<div class="an-tools"><button type="button" class="bk-btn" data-dc-go="1">Загрузить</button><button type="button" class="bk-btn bk-ghost" data-dc-cancel="1">Отмена</button></div></div>';
    }

    async function load() {
        var c = db(); if (!c) return;
        S.cab = curCab(); S.loading = true; S.err = ''; draw();
        try {
            var q = c.from('cabinet_documents').select('*').order('created_at', { ascending: false }).limit(1000);
            var res = await q;
            if (res.error) throw res.error;
            var keep = S.rows.filter(function (r) { return r.pending || r.failed; });
            S.rows = (res.data || []).map(function (r) { r.file_name = r.file_path.split('/').pop().replace(/^\d+-/, ''); return r; }).concat(keep);
            if (S.cab) {
                var a = await c.from('rnp_articles').select('nm_id,seller_article,name').eq('cabinet_id', S.cab).order('seller_article');
                S.arts = (a && a.data) || [];
            } else S.arts = [];
        } catch (e) { S.err = 'Не удалось загрузить документы: ' + (e && e.message ? e.message : 'ошибка') + '. Попробуйте ещё раз.'; }
        S.loading = false; draw();
    }

    async function send(row, file) {
        var c = db();
        try {
            var up = await c.storage.from(BUCKET).upload(row.file_path, file, { upsert: false, contentType: file.type || undefined });
            if (up.error) throw up.error;
            var ins = await c.from('cabinet_documents').insert({
                cabinet_id: row.cabinet_id, folder: row.folder, nm_id: row.nm_id, seller_article: row.seller_article, title: row.title,
                file_path: row.file_path, file_size: row.file_size, mime: row.mime, valid_until: row.valid_until
            }).select().single();
            if (ins.error) throw ins.error;
            var real = ins.data; real.file_name = row.file_name;
            S.rows = S.rows.map(function (r) { return r.id === row.id ? real : r; });
        } catch (e) {
            S.rows = S.rows.map(function (r) { return r.id === row.id ? Object.assign({}, r, { pending: false, failed: true, _file: file }) : r; });
            S.err = 'Не удалось загрузить «' + row.title + '»: ' + (e && e.message ? e.message : 'ошибка') + '. Нажмите «Повторить».';
        }
        draw();
    }

    function startUpload() {
        var f = S.form, err = '';
        if (S.scope === 'cab' && !S.cab) err = 'Сначала выберите кабинет сверху.';
        var nmSel = pane.querySelector('#dc-art'), until = pane.querySelector('#dc-until');
        if (nmSel) f.nm = nmSel.value;
        if (until) f.until = until.value;
        if (!err && S.scope === 'cab' && !f.nm) err = 'Выберите артикул: без него документ не сохраняется.';
        if (err) { S.err = err; draw(); return; }
        var art = S.arts.filter(function (a) { return String(a.nm_id) === String(f.nm); })[0] || {};
        S.err = '';
        f.files.forEach(function (file) {
            var row = {
                id: 'tmp' + (++uid), pending: true,
                cabinet_id: S.scope === 'cab' ? S.cab : null, folder: f.folder, nm_id: S.scope === 'cab' ? Number(f.nm) : null,
                seller_article: art.seller_article || null, title: file.name.replace(/\.[^.]+$/, ''), file_name: file.name,
                file_path: (S.scope === 'cab' ? S.cab : 'consulting') + '/' + Date.now() + '-' + (uid) + '-' + safeName(file.name),
                file_size: file.size, mime: file.type || null, valid_until: (S.scope === 'cab' && f.folder !== 'other' && f.until) ? f.until : null
            };
            S.rows.unshift(row);
            send(row, file);
        });
        S.form = null; draw();
    }

    async function getFile(id) {
        var r = S.rows.filter(function (x) { return x.id === id; })[0]; if (!r) return;
        var res = await db().storage.from(BUCKET).createSignedUrl(r.file_path, 60);
        if (res.error || !res.data) { S.err = 'Не удалось получить файл. Попробуйте ещё раз.'; draw(); return; }
        var a = doc.createElement('a'); a.href = res.data.signedUrl; a.target = '_blank'; a.rel = 'noopener'; a.download = r.file_name || r.title;
        doc.body.appendChild(a); a.click(); a.remove();
    }

    async function del(id) {
        var r = S.rows.filter(function (x) { return x.id === id; })[0]; if (!r) return;
        if (!root.confirm || !root.confirm('Удалить документ «' + r.title + '»?')) return;
        S.rows = S.rows.filter(function (x) { return x.id !== id; }); draw();
        try {
            await db().storage.from(BUCKET).remove([r.file_path]);
            var res = await db().from('cabinet_documents').delete().eq('id', id);
            if (res.error) throw res.error;
        } catch (e) { S.err = 'Не удалось удалить: ' + (e && e.message ? e.message : 'ошибка'); load(); }
    }

    function onClick(e) {
        var t = e.target, el;
        if ((el = t.closest('[data-dc-scope]'))) { S.scope = el.getAttribute('data-dc-scope'); S.folder = ''; S.form = null; S.err = ''; draw(); return; }
        if ((el = t.closest('[data-dc-folder]'))) { var v = el.getAttribute('data-dc-folder'); S.folder = (S.folder === v) ? '' : v; draw(); return; }
        if ((el = t.closest('[data-dc-type]'))) { var nm = pane.querySelector('#dc-art'); if (nm) S.form.nm = nm.value; S.form.folder = el.getAttribute('data-dc-type'); draw(); return; }
        if (t.closest('[data-dc-cancel]')) { S.form = null; S.err = ''; draw(); return; }
        if (t.closest('[data-dc-go]')) { startUpload(); return; }
        if ((el = t.closest('[data-dc-get]'))) { getFile(el.getAttribute('data-dc-get')); return; }
        if ((el = t.closest('[data-dc-del]'))) { del(el.getAttribute('data-dc-del')); return; }
        if ((el = t.closest('[data-dc-retry]'))) {
            var r = S.rows.filter(function (x) { return x.id === el.getAttribute('data-dc-retry'); })[0];
            if (r && r._file) { S.err = ''; S.rows = S.rows.map(function (x) { return x === r ? Object.assign({}, x, { failed: false, pending: true }) : x; }); draw(); send(r, r._file); }
        }
    }

    function mount() {
        if (pane) return true;
        if (!isStaffUser()) return false;
        var tabs = doc.getElementById('settings-section-tabs'), sec = doc.getElementById('settings-security');
        if (!tabs || !sec) return false;
        btn = doc.createElement('div');
        btn.className = 'settings-section-tab'; btn.id = 'settings-tab-btn-docs'; btn.textContent = 'Документы';
        var anchor = doc.getElementById('settings-tab-btn-features') || tabs.lastElementChild;
        tabs.insertBefore(btn, anchor ? anchor.nextSibling : null);
        pane = doc.createElement('div'); pane.id = 'settings-docs'; pane.className = 'hidden';
        sec.parentNode.insertBefore(pane, sec.nextSibling);
        btn.addEventListener('click', function () {
            Array.prototype.forEach.call(tabs.querySelectorAll('.settings-section-tab'), function (t) { t.classList.remove('active'); });
            ['profile', 'security', 'devsessions', 'spaces', 'api', 'features', 'about', 'backups'].forEach(function (n) {
                var p = doc.getElementById('settings-' + n); if (p) p.classList.add('hidden');
            });
            btn.classList.add('active'); pane.classList.remove('hidden'); load();
        });
        tabs.addEventListener('click', function (e) {
            var t = e.target.closest && e.target.closest('.settings-section-tab');
            if (t && t !== btn) { pane.classList.add('hidden'); btn.classList.remove('active'); }
        }, true);
        pane.addEventListener('click', onClick);
        pane.addEventListener('change', function (e) {
            if (e.target && e.target.id === 'dc-file' && e.target.files.length) {
                S.form = { files: Array.prototype.slice.call(e.target.files), folder: FOLDERS[S.scope][0][0], nm: '', until: '' }; S.err = ''; draw();
            }
        });
        var timer = null;
        pane.addEventListener('input', function (e) {
            if (!e.target || e.target.id !== 'dc-q') return;
            clearTimeout(timer); timer = setTimeout(function () { S.q = e.target.value; draw(); }, 200);
        });
        // кабинет меняют сверху: список перечитываем
        setInterval(function () { if (!pane.classList.contains('hidden') && curCab() !== S.cab && !S.loading) load(); }, 1500);
        draw();
        return true;
    }
    function boot() { var tries = 0, t = setInterval(function () { if (mount() || ++tries > 60) clearInterval(t); }, 500); }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
    root.NrDocs = { mount: mount };
})(typeof window !== 'undefined' ? window : globalThis);

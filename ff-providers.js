/* Список фулфилментов (ФФ) кабинета: создать / переименовать / удалить + окно ввода названия. */
(function (root) {
    'use strict';
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    async function load(db, cab) {
        var r = await db.from('ff_providers').select('id,name').eq('cabinet_id', cab).order('created_at', { ascending: true }).range(0, 99);
        if (r.error) throw r.error;
        return r.data || [];
    }
    async function create(db, cab, name) {
        var r = await db.from('ff_providers').insert({ cabinet_id: cab, name: name }).select('id,name').single();
        if (r.error) throw r.error;
        return r.data;
    }
    async function rename(db, id, name) { var r = await db.from('ff_providers').update({ name: name }).eq('id', id); if (r.error) throw r.error; }
    async function remove(db, id) { var r = await db.from('ff_providers').delete().eq('id', id); if (r.error) throw r.error; }
    // Окно с одним полем: вернёт строку или null.
    function ask(title, value, hint) {
        return new Promise(function (resolve) {
            var ov = document.createElement('div');
            ov.className = 'nx-ov';
            ov.innerHTML = '<div class="nx-modal fbr-modal"><h3>' + esc(title) + '</h3>' + (hint ? '<p class="nx-sm">' + esc(hint) + '</p>' : '') +
                '<label class="fbr-l">Название<input type="text" id="ffp-name" maxlength="60" value="' + esc(value || '') + '" placeholder="Например, ФФ Бишкек"></label>' +
                '<div class="fbr-btns"><button type="button" class="nx-go" data-ok="1">Сохранить</button><button type="button" class="nx-b" data-x="1">Отмена</button></div></div>';
            function done(v) { ov.remove(); resolve(v); }
            function ok() { var v = ov.querySelector('#ffp-name').value.trim(); if (!v) { ov.querySelector('#ffp-name').style.outline = '2px solid #ef4444'; return; } done(v); }
            ov.addEventListener('click', function (e) { if (e.target === ov || e.target.closest('[data-x]')) done(null); else if (e.target.closest('[data-ok]')) ok(); });
            ov.addEventListener('keydown', function (e) { if (e.key === 'Enter') ok(); });
            document.body.appendChild(ov);
            ov.querySelector('#ffp-name').focus();
        });
    }
    root.FfProviders = { load: load, create: create, rename: rename, remove: remove, ask: ask };
})(typeof window !== 'undefined' ? window : globalThis);

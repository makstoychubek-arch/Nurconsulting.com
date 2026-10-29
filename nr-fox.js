/* Лисёнок убран с сайта («Минимализм»). Файл оставлен ради старых подключений: NrFox.mount ничего не рисует.
 * Остался только показ «Загружаем данные кабинета» при первой синхронизации, теперь обычным уведомлением NrUi. */
(function (root) {
    'use strict';
    var doc = root.document;
    root.NrFox = {
        mount: function (container) {
            var el = (doc && doc.createElement) ? doc.createElement('span') : null;
            if (el) { el.hidden = true; if (container && container.appendChild) container.appendChild(el); }
            return el;
        }
    };
    if (!doc) return;
    var st = doc.createElement('style');
    st.textContent = '.nr-fox-slot,.nr-hdr-fox,.nr-fox-in{display:none!important}';
    doc.head.appendChild(st);

    var path = root.location.pathname || '';
    var isApp = !!doc.querySelector('.tab-content') || /^\/(space|goods|rnp|advertising|ab-testing|content|agents|reports|cabinets)/.test(path);
    var firstSync = 0, pend = 0, tShow = null, tHide = null, tCap = null, toast = null, gaveUp = false;
    function relevant(u) { return firstSync > 0 && /supabase\.co\/(rest|functions)\//.test(u) && !/perf-sample|client-error/.test(u); }
    function showLong() {
        if (toast || gaveUp || !root.NrUi) return;
        toast = root.NrUi.toast('info', 'Загружаем данные кабинета', 'Первая синхронизация с Wildberries', { loading: true, key: 'first-sync' });
        tCap = setTimeout(function () { gaveUp = true; hideLong(); }, 30000);
    }
    function hideLong() {
        clearTimeout(tCap);
        if (toast && toast.close) toast.close();
        toast = null;
    }
    function begin(u) {
        if (!relevant(u)) return false;
        pend++; clearTimeout(tHide);
        if (pend === 1 && !toast) { clearTimeout(tShow); tShow = setTimeout(function () { if (pend > 0) showLong(); }, 1500); }
        return true;
    }
    function end() {
        pend = Math.max(0, pend - 1);
        if (pend === 0) { clearTimeout(tShow); gaveUp = false; tHide = setTimeout(function () { if (pend === 0) hideLong(); }, 400); }
    }
    if (isApp && root.fetch) {
        var f0 = root.fetch;
        root.fetch = function (input, init) {
            var url = typeof input === 'string' ? input : (input && input.url) || '';
            var counted = false, first = false;
            try {
                first = /functions\/v1\/auto-sync/.test(url) && init && typeof init.body === 'string' && /"mode"\s*:\s*"full"/.test(init.body);
                if (first) firstSync++;
                counted = begin(url);
            } catch (e) { /* не мешаем запросу */ }
            var p = f0.apply(this, arguments);
            var done = function () { if (first) firstSync = Math.max(0, firstSync - 1); if (counted) end(); };
            if (counted || first) p.then(done, done);
            return p;
        };
    }
})(typeof window !== 'undefined' ? window : globalThis);

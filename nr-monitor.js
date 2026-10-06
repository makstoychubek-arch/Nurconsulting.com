/* Сообщает об ошибках в браузере на сервер (таблица client_errors), чтобы мы узнавали о поломках раньше клиентов.
 * Лёгкий: не больше 5 сообщений за открытие страницы, без персональных данных (только страница, текст ошибки, место). */
(function () {
    'use strict';
    var URL_ = 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/client-error';
    var sent = 0, MAX = 5;
    var IGNORE = /ResizeObserver loop|Script error\.?$|Non-Error promise rejection|chrome-extension:|moz-extension:|Load failed|NetworkError|Failed to fetch|AbortError/i;

    function report(message, source, line, col, stack) {
        try {
            message = String(message || '');
            if (!message || sent >= MAX || IGNORE.test(message) || IGNORE.test(String(source || ''))) return;
            sent++;
            var body = JSON.stringify({ page: location.pathname, message: message, source: source || '', line: line || 0, col: col || 0, stack: stack || '' });
            if (navigator.sendBeacon) { navigator.sendBeacon(URL_, new Blob([body], { type: 'text/plain' })); return; }
            fetch(URL_, { method: 'POST', body: body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(function () {});
        } catch (e) { /* мониторинг не должен ломать сайт */ }
    }

    window.addEventListener('error', function (ev) {
        if (!ev || ev.target !== window && ev.target) return; // ошибки загрузки картинок и стилей не считаем
        report(ev.message, ev.filename, ev.lineno, ev.colno, ev.error && ev.error.stack);
    });
    window.addEventListener('unhandledrejection', function (ev) {
        var r = ev && ev.reason;
        report('Необработанная ошибка: ' + (r && r.message ? r.message : r), '', 0, 0, r && r.stack);
    });
})();

/* Замеры скорости страницы у реальных пользователей: LCP, FCP, сдвиги вёрстки (CLS), время загрузки.
 * Без персональных данных, одно сообщение за открытие страницы, ничего не ломает при ошибке. */
(function () {
    'use strict';
    try {
        if (!window.PerformanceObserver || !navigator.sendBeacon) return;
        var URL_ = 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/perf-sample';
        var lcp = null, cls = 0, fcp = null, sent = false;
        function watch(type, cb) {
            try { new PerformanceObserver(function (l) { l.getEntries().forEach(cb); }).observe({ type: type, buffered: true }); } catch (e) { /* не поддерживается */ }
        }
        watch('largest-contentful-paint', function (e) { lcp = e.startTime; });
        watch('layout-shift', function (e) { if (!e.hadRecentInput) cls += e.value; });
        watch('paint', function (e) { if (e.name === 'first-contentful-paint') fcp = e.startTime; });
        function send() {
            if (sent) return;
            var nav = (performance.getEntriesByType('navigation') || [])[0] || {};
            if (!nav.loadEventEnd && !lcp) return;
            sent = true;
            var c = navigator.connection || {};
            var body = JSON.stringify({
                page: location.pathname, lcp: lcp, fcp: fcp, cls: cls, load: nav.loadEventEnd || null, ttfb: nav.responseStart || null,
                mobile: /Mobi|Android|iPhone/i.test(navigator.userAgent), net: c.effectiveType || '',
            });
            navigator.sendBeacon(URL_, new Blob([body], { type: 'text/plain' }));
        }
        document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') send(); });
        window.addEventListener('pagehide', send);
    } catch (e) { /* замер не должен ломать сайт */ }
})();

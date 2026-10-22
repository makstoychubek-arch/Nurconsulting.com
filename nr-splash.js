/* Заставка при открытии кабинета: белый фон (в тёмной теме чёрный) и логотип NR в центре.
 * Логотип плавно появляется, пока страница и первые данные загружаются, затем заставка плавно гаснет.
 * Минимум 0,9 с, максимум 3 с: дольше пользователя не держим. Подключена только в dashboard.html. */
(function () {
    'use strict';
    try {
        if (document.getElementById('nr-splash')) return;
        var theme = ''; try { theme = localStorage.getItem('nr_theme') || ''; } catch (e) {}
        var dark = theme === 'neon';
        var reduce = false; try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
        var LOGO = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="NR"> <rect width="512" height="512" rx="120" ry="120" fill="#ffffff"/> <path d="M45.11126463115217 355.069120824337V144.93087917566302H103.34957731664181L183.20210914313793 240.3936803817749V144.93087917566302H252.24753139913082V355.069120824337H194.00921871364116L114.15668688714504 259.6063196182251V355.069120824337Z" fill="#000000"/> <path d="M277.4641203969717 355.069120824337V144.93087917566302H375.6286989957094Q423.96049457490443 144.93087917566302 449.17708357274535 166.24490082859995Q474.3936725705862 187.55892248153688 474.3936725705862 224.18301602602006Q474.3936725705862 246.99802511930466 464.0368592321872 263.8090844511986Q453.6800458937883 280.6201437830925 434.76760414540763 290.2264634013176L478.8966348916292 355.069120824337H403.24686789810653L367.52336681783197 302.23436292409895H348.3107275813818V355.069120824337ZM348.3107275813818 248.79921004772189H374.1277115553617Q388.83738847076893 248.79921004772189 395.892029440403 242.1948653101921Q402.94667041003703 235.59052057266234 402.94667041003703 224.18301602602006Q402.94667041003703 212.77551147937777 395.892029440403 206.17116674184803Q388.83738847076893 199.56682200431825 374.1277115553617 199.56682200431825H348.3107275813818Z" fill="#000000"/> </svg>';
        var st = document.createElement('style');
        st.textContent = '#nr-splash{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;background:' + (dark ? '#1C1C1E' : '#ffffff') + ';transition:opacity .45s ease;opacity:1}' +
            '#nr-splash.is-out{opacity:0;pointer-events:none}' +
            '#nr-splash svg{width:84px;height:84px;border-radius:24px;opacity:0;transform:scale(.86);animation:nrSplashIn .5s cubic-bezier(.22,1,.36,1) .08s forwards}' +
            '#nr-splash.is-out svg{transform:scale(1.04);transition:transform .45s ease}' +
            '@keyframes nrSplashIn{to{opacity:1;transform:scale(1)}}' +
            (reduce ? '#nr-splash svg{animation:none;opacity:1;transform:none}#nr-splash{transition-duration:.01s}' : '');
        var el = document.createElement('div');
        el.id = 'nr-splash'; el.setAttribute('aria-hidden', 'true'); el.innerHTML = LOGO;
        (document.head || document.documentElement).appendChild(st);
        document.documentElement.appendChild(el);
        var t0 = Date.now(), loaded = document.readyState === 'complete', done = false;
        function hide() {
            if (done) return; done = true;
            el.classList.add('is-out');
            setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); if (st.parentNode) st.parentNode.removeChild(st); }, 600);
        }
        function check() {
            var age = Date.now() - t0;
            if (age >= 3000 || (loaded && age >= 900)) hide();
        }
        window.addEventListener('load', function () { loaded = true; check(); });
        var iv = setInterval(function () { check(); if (done) clearInterval(iv); }, 120);
        window.NrSplash = { hide: hide };
    } catch (e) { /* заставка не должна ломать сайт */ }
})();

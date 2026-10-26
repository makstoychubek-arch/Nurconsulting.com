/* Нижняя часть кабинета: логотип и подпись, колонки «Продукт», «Компания», «Связь», соцсети, язык, документы.
   Рисуется один раз в конец прокручиваемой области кабинета (.main-content), без запросов к серверу.
   Пункты «Продукт» показываются только если раздел есть в левом меню этого человека. */
(function (root) {
    'use strict';
    var doc = root.document;
    if (!doc) return;
    var WA = 'https://wa.me/996502446688', IG = 'https://www.instagram.com/nurcon.kg', TG = 'https://t.me/nurcon', TGC = 'https://t.me/nurconkg';
    var PRODUCT = [['dashboard', 'Дашборд'], ['rnp', 'РНП'], ['advertising', 'Продвижение'], ['goods-groups', 'Логистика'], ['tariffs', 'Тарифы']];
    var CSS = '#nr-foot{box-sizing:border-box;margin:36px 0 0;width:100%;padding:14px 18px;border:1px solid var(--border);border-radius:16px;background:var(--bg-card);display:grid;gap:8px;font-size:13px;color:var(--text-primary)}' +
        '#nr-foot a{color:inherit;text-decoration:none}#nr-foot a:hover{color:var(--accent)}#nr-foot a:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:4px}' +
        '.nrf-r{display:flex;align-items:center;gap:8px 20px;flex-wrap:wrap}.nrf-r2{color:var(--text-muted);font-size:12px}' +
        '.nrf-brand{display:inline-flex;align-items:center;gap:7px}.nrf-brand img{width:24px;height:24px;border-radius:7px}' +
        '.nrf-brand i{font-style:normal;color:#f97316;border:1.5px solid #f97316;border-radius:99px;padding:0 8px;font-size:12px;line-height:1.5;font-weight:700}' +
        '.nrf-nav{display:flex;gap:4px 16px;flex-wrap:wrap;min-width:0}.nrf-docs{display:flex;gap:4px 16px;flex-wrap:wrap}' +
        '.nrf-end{margin-left:auto;display:inline-flex;gap:10px;align-items:center}' +
        '.nrf-soc{display:flex;gap:6px}.nrf-soc a{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:var(--sel);color:var(--text-muted)}.nrf-soc a:hover{color:var(--text-primary)}' +
        '.nrf-soc svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}' +
        '.nrf-lang{display:inline-flex;border:1px solid var(--border);border-radius:99px;padding:2px;font-size:11px;font-weight:800;letter-spacing:.04em}' +
        '.nrf-lang span{padding:2px 9px;border-radius:99px;color:var(--text-muted);cursor:default}.nrf-lang span.on{background:var(--sel);color:var(--text-primary)}' +
        '.main-content.rnp-compact>#nr-foot{display:none}@media(max-width:820px){#nr-foot{padding:14px 16px;margin-bottom:84px}.nrf-end{margin-left:0}}';
    var ICON = {
        tg: '<path d="M21 4L3 11l6 2.2L18 7l-7.5 7.5V19l3-3 4 3z"/>',
        ig: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".7" fill="currentColor"/>',
        wa: '<path d="M3.5 20.5l1.2-4.3A8.5 8.5 0 1 1 8 19.3z"/><path d="M9.2 8.6c0 3.3 2.9 6.2 6.2 6.2l1-1.4-2-1-.9.8c-1-.4-1.9-1.3-2.3-2.3l.8-.9-1-2z"/>'
    };
    function soc(k, href, label) { return '<a href="' + href + '" target="_blank" rel="noopener" aria-label="' + label + '" title="' + label + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + ICON[k] + '</svg></a>'; }
    function has(tab) {
        if (tab === 'tariffs') return true;
        var b = doc.querySelector('.rail-btn[data-tab="' + tab + '"]');
        return !!b && b.offsetParent !== null;
    }
    function build() {
        var prod = PRODUCT.filter(function (p) { return has(p[0]); }).map(function (p) { return '<a href="#" data-nrf-tab="' + p[0] + '">' + p[1] + '</a>'; }).join('');
        return '<div class="nrf-r"><span class="nrf-brand"><img src="/icons/logo-nr.svg" alt="NR" width="24" height="24"><i>Space</i></span>' +
            '<nav class="nrf-nav" aria-label="Разделы">' + prod + '<a href="/">О нас</a><a href="/consulting">Консалтинг</a><a href="/#contacts">Контакты</a><a href="' + TG + '" target="_blank" rel="noopener">Поддержка</a></nav>' +
            '<span class="nrf-end"><span class="nrf-soc">' + soc('tg', TGC, 'Telegram-канал') + soc('ig', IG, 'Instagram') + soc('wa', WA, 'WhatsApp') + '</span>' +
            '<span class="nrf-lang" role="group" aria-label="Язык"><span class="on" aria-current="true">RU</span><span title="Скоро" aria-disabled="true">KG</span><span title="Скоро" aria-disabled="true">EN</span></span></span></div>' +
            '<div class="nrf-r nrf-r2"><span>© 2026 Nur Consulting &amp; NR Space</span><nav class="nrf-docs" aria-label="Документы"><a href="/terms">Соглашение</a><a href="/privacy">Конфиденциальность</a><a href="/consent">Согласие на обработку данных</a></nav></div>';
    }
    function mount() {
        var host = doc.querySelector('.main-content');
        if (!host) return;
        var f = doc.getElementById('nr-foot');
        if (!f) {
            if (!doc.getElementById('nr-foot-css')) { var st = doc.createElement('style'); st.id = 'nr-foot-css'; st.textContent = CSS; doc.head.appendChild(st); }
            f = doc.createElement('footer');
            f.id = 'nr-foot';
            f.addEventListener('click', function (e) {
                var t = e.target.closest && e.target.closest('[data-nrf-tab]');
                if (t) { e.preventDefault(); try { root.showTab(t.getAttribute('data-nrf-tab')); } catch (_) {} }
            });
            host.appendChild(f);
        }
        var h = build();
        if (f.__h !== h) { f.innerHTML = h; f.__h = h; }
        push(host, f);
    }
    // Низ показывается только в самом конце прокрутки: если страница короче экрана, отодвигаем его под нижний край.
    function push(host, f) {
        if (!f.offsetParent && f.style.display !== 'none') return;
        var cur = parseFloat(f.style.marginTop) || 0;
        var top = f.getBoundingClientRect().top - host.getBoundingClientRect().top + host.scrollTop;
        var end = top - cur;
        var need = Math.max(32, Math.ceil(host.clientHeight - end + 24));
        if (Math.abs(need - cur) > 2) f.style.marginTop = need + 'px';
    }
    function fit() { var host = doc.querySelector('.main-content'), f = doc.getElementById('nr-foot'); if (host && f) push(host, f); }
    // Переключение разделов меняет высоту страницы: пересчитываем сразу, до отрисовки, чтобы низ не мелькал под коротким содержимым.
    function watch() {
        var host = doc.querySelector('.main-content');
        if (!host || !root.MutationObserver) return;
        var busy = false;
        new MutationObserver(function (list) {
            if (busy) return;
            var f = doc.getElementById('nr-foot');
            if (list.every(function (m) { return f && (m.target === f || f.contains(m.target)); })) return;
            busy = true;
            try { fit(); } finally { busy = false; }
        }).observe(host, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    }
    function init() { mount(); watch(); [2000, 6000, 15000].forEach(function (ms) { setTimeout(mount, ms); }); setInterval(fit, 700); root.addEventListener('resize', fit); }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : this);

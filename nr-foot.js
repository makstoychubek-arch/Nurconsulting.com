/* Нижняя часть кабинета: логотип и подпись, колонки «Продукт», «Компания», «Связь», соцсети, язык, документы.
   Рисуется один раз в конец прокручиваемой области кабинета (.main-content), без запросов к серверу.
   Пункты «Продукт» показываются только если раздел есть в левом меню этого человека. */
(function (root) {
    'use strict';
    var doc = root.document;
    if (!doc) return;
    var WA = 'https://wa.me/996502446688', IG = 'https://www.instagram.com/nurcon.kg', TG = 'https://t.me/nurcon', TGC = 'https://t.me/nurconkg';
    var PRODUCT = [['dashboard', 'Дашборд'], ['rnp', 'РНП'], ['advertising', 'Продвижение'], ['goods-groups', 'Логистика'], ['tariffs', 'Тарифы']];
    var CSS = '#nr-foot{margin:36px auto 0;max-width:1400px;padding:22px;border:1px solid var(--border);border-radius:20px;background:var(--bg-card);display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;gap:22px;font-size:13px;color:var(--text-primary)}' +
        '#nr-foot a{color:inherit;text-decoration:none}#nr-foot a:hover{color:var(--accent)}#nr-foot a:focus-visible,#nr-foot button:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:4px}' +
        '.nrf-brand{display:flex;align-items:center;gap:8px;font-weight:800;letter-spacing:-.02em}.nrf-brand img{width:26px;height:26px;border-radius:7px}' +
        '.nrf-brand i{font-style:normal;color:#f97316;border:1.5px solid #f97316;border-radius:99px;padding:0 8px;font-size:12px;line-height:1.5}' +
        '.nrf-tag{color:var(--text-muted);font-size:12px;margin:8px 0 0;max-width:28ch}' +
        '#nr-foot h4{margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted)}' +
        '#nr-foot ul{list-style:none;margin:0;padding:0;display:grid;gap:7px}' +
        '.nrf-bot{grid-column:1/-1;border-top:1px solid var(--border);padding-top:14px;display:flex;align-items:center;gap:10px 18px;flex-wrap:wrap;color:var(--text-muted);font-size:12px}' +
        '.nrf-bot .l{flex:1;min-width:200px}.nrf-bot nav{display:flex;gap:4px 16px;flex-wrap:wrap;width:100%}' +
        '.nrf-soc{display:flex;gap:8px}.nrf-soc a{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:var(--sel);color:var(--text-muted)}.nrf-soc a:hover{color:var(--text-primary)}' +
        '.nrf-soc svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}' +
        '.nrf-lang{display:inline-flex;border:1px solid var(--border);border-radius:99px;padding:2px;font-size:11px;font-weight:800;letter-spacing:.04em}' +
        '.nrf-lang span{padding:3px 9px;border-radius:99px;color:var(--text-muted);cursor:default}.nrf-lang span.on{background:var(--sel);color:var(--text-primary)}' +
        '@media(max-width:820px){#nr-foot{grid-template-columns:1fr 1fr;padding:18px 16px;margin-bottom:84px}#nr-foot>div:first-child{grid-column:1/-1}}';
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
        var prod = PRODUCT.filter(function (p) { return has(p[0]); }).map(function (p) { return '<li><a href="#" data-nrf-tab="' + p[0] + '">' + p[1] + '</a></li>'; }).join('');
        return '<div><div class="nrf-brand"><img src="/icons/logo-nr.svg" alt="" width="26" height="26">NR<i>Space</i></div><p class="nrf-tag">Аналитика и управление кабинетом Wildberries.</p></div>' +
            '<div><h4>Продукт</h4><ul>' + prod + '</ul></div>' +
            '<div><h4>Компания</h4><ul><li><a href="/">О нас</a></li><li><a href="/consulting">Консалтинг</a></li><li><a href="/#contacts">Контакты</a></li></ul></div>' +
            '<div><h4>Связь</h4><ul><li><a href="' + TG + '" target="_blank" rel="noopener">Telegram</a></li><li><a href="' + WA + '" target="_blank" rel="noopener">WhatsApp</a></li><li><a href="' + IG + '" target="_blank" rel="noopener">Instagram</a></li></ul></div>' +
            '<div class="nrf-bot"><span class="l">© 2026 Nur Consulting &amp; NR Space</span><div class="nrf-soc">' + soc('tg', TGC, 'Telegram-канал') + soc('ig', IG, 'Instagram') + soc('wa', WA, 'WhatsApp') + '</div>' +
            '<div class="nrf-lang" role="group" aria-label="Язык"><span class="on" aria-current="true">RU</span><span title="Скоро" aria-disabled="true">KG</span><span title="Скоро" aria-disabled="true">EN</span></div>' +
            '<nav aria-label="Документы"><a href="/terms">Пользовательское соглашение</a><a href="/privacy">Политика конфиденциальности</a><a href="/consent">Согласие на обработку данных</a></nav></div>';
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
    }
    function init() { mount(); [2000, 6000, 15000].forEach(function (ms) { setTimeout(mount, ms); }); }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : this);

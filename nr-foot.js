/* Нижняя часть кабинета: логотип, ссылки на разделы и документы, чат поддержки, соцсети.
   Рисуется один раз в конец прокручиваемой области кабинета (.main-content), без запросов к серверу. */
(function (root) {
    'use strict';
    var doc = root.document;
    if (!doc) return;
    var WA = 'https://wa.me/996502446688';
    var IG = 'https://www.instagram.com/___nurbolot';
    var CSS = '#nr-foot{margin:36px auto 0;max-width:1400px;padding:22px 4px 28px;border-top:1px solid var(--border);display:grid;gap:14px;font-size:13px;color:var(--text-primary)}' +
        '#nr-foot a{color:inherit;text-decoration:none}#nr-foot a:hover{color:var(--accent)}#nr-foot a:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:4px}' +
        '.nrf-top{display:flex;align-items:center;gap:22px;flex-wrap:wrap}.nrf-brand{display:flex;align-items:center;gap:8px;font-weight:800;letter-spacing:-.02em}' +
        '.nrf-brand img{width:26px;height:26px;border-radius:7px}.nrf-brand i{font-style:normal;color:#f97316;border:1.5px solid #f97316;border-radius:99px;padding:0 8px;font-size:12px;line-height:1.5}' +
        '.nrf-nav{display:flex;gap:6px 20px;flex-wrap:wrap;flex:1;min-width:0}.nrf-chat{display:flex;align-items:center;gap:8px;font-weight:600;white-space:nowrap}' +
        '.nrf-chat svg,.nrf-soc svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}' +
        '.nrf-bot{display:flex;align-items:center;gap:6px 20px;flex-wrap:wrap;color:var(--text-muted);font-size:12px}.nrf-bot .nrf-nav{gap:4px 18px}' +
        '.nrf-soc{display:flex;gap:12px;align-items:center}.nrf-soc a{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:var(--sel);color:var(--text-muted)}' +
        '@media(max-width:700px){#nr-foot{padding-bottom:84px}.nrf-top{gap:12px}.nrf-chat{width:100%}}';
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function a(href, t, ext) { return '<a href="' + esc(href) + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + t + '</a>'; }
    function mount() {
        var host = doc.querySelector('.main-content');
        if (!host || doc.getElementById('nr-foot')) return;
        if (!doc.getElementById('nr-foot-css')) { var st = doc.createElement('style'); st.id = 'nr-foot-css'; st.textContent = CSS; doc.head.appendChild(st); }
        var f = doc.createElement('footer');
        f.id = 'nr-foot';
        f.innerHTML = '<div class="nrf-top"><div class="nrf-brand"><img src="/icons/logo-nr.svg" alt="" width="26" height="26">NR<i>Space</i></div>' +
            '<nav class="nrf-nav" aria-label="Разделы">' + a('/', 'О нас') + a('/#contacts', 'Контакты') + a('/consulting', 'Консалтинг') + '<a href="#" data-nrf-tab="tariffs">Тарифы</a>' + a(WA, 'Поддержка', 1) + '</nav>' +
            a(WA, '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/><path d="M19 20a4 4 0 0 1-4 2h-2"/></svg>Чат с поддержкой', 1).replace('<a ', '<a class="nrf-chat" ') + '</div>' +
            '<div class="nrf-bot"><nav class="nrf-nav" aria-label="Документы">' + a('/terms', 'Пользовательское соглашение') + a('/privacy', 'Политика конфиденциальности') + a('/consent', 'Согласие на обработку данных') + '</nav>' +
            '<div class="nrf-soc">' + a(IG, '<svg viewBox="0 0 24 24" aria-label="Instagram"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17" cy="7" r=".6"/></svg>', 1) +
            a(WA, '<svg viewBox="0 0 24 24" aria-label="WhatsApp"><path d="M3.5 20.5l1.2-4.3A8.5 8.5 0 1 1 8 19.3z"/><path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.5-2-1-1 .8c-1-.4-2-1.4-2.4-2.4l.8-1-1-2z"/></svg>', 1) + '</div></div>' +
            '<div class="nrf-bot">© 2026 Nur Consulting &amp; NR Space</div>';
        f.addEventListener('click', function (e) {
            var t = e.target.closest && e.target.closest('[data-nrf-tab]');
            if (t) { e.preventDefault(); try { root.showTab(t.getAttribute('data-nrf-tab')); } catch (_) {} }
        });
        host.appendChild(f);
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', mount); else mount();
})(typeof window !== 'undefined' ? window : this);

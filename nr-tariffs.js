/* Тарифы: Старт / Рост / Лидер. Карточки со списками галочек, переключатель периода со скидкой,
   сравнение, частые вопросы. Рисуется в #tab-tariffs сразу при загрузке страницы (из кода, без запросов),
   оплата пока через WhatsApp NR: кнопка открывает чат с названием тарифа и периодом. */
(function (root) {
    'use strict';
    var doc = root.document;
    if (!doc) return;
    var WA = 'https://wa.me/996502446688';
    var PERIODS = [{ m: 1, off: 0, t: '1 месяц' }, { m: 3, off: 0.1, t: '3 месяца' }, { m: 6, off: 0.15, t: '6 месяцев' }, { m: 12, off: 0.2, t: '12 месяцев' }];
    var PLANS = [
        { id: 'start', name: 'Старт', base: 2599, old: 5999, day: 'Отвечайте на отзывы и тестируйте обложки, пока растёте.', cta: 'Выбрать «Старт»',
          yes: ['1 кабинет Wildberries', 'Акылай: ответы на отзывы с проверкой в Telegram', 'А/Б тесты фото и цен'],
          no: ['Дашборд и РНП', 'Продвижение, Логистика', 'Свой ИИ по вашим данным'] },
        { id: 'grow', name: 'Рост', base: 5599, old: 7999, day: 'Каждый день видите продажи, заказы и остатки.', cta: 'Выбрать «Рост»',
          yes: ['Всё из тарифа «Старт»', 'Дашборд: продажи, заказы, остатки, прибыль', 'Антон: ежедневный отчёт по заказам и складам'],
          no: ['РНП, Продвижение, Логистика', 'Пользователи кабинета', 'Свой ИИ по вашим данным'] },
        { id: 'lead', name: 'Лидер', base: 8999, top: true, day: 'Всё, чтобы управлять кабинетом и спрашивать у своего ИИ.', cta: 'Попробовать 3 дня',
          ai: 'Подключите Claude или ChatGPT: остатки, заказы, финансы. Только чтение.',
          yes: ['Всё из тарифа «Рост»', 'РНП и Продвижение', 'Логистика: остатки, партии, поставки, ДДС', 'Пользователи кабинета: до 5 человек',
                'Все агенты на максимум: Амина, Манас, Акылай, Изат', 'Новые функции по мере выхода'], no: [] }
    ];
    var TABLE = [['Акылай: ответы на отзывы', 1, 1, 1], ['А/Б тесты фото и цен', 1, 1, 1], ['Дашборд', 0, 1, 1], ['Антон: отчёт по заказам и складам', 0, 1, 1],
        ['РНП и Продвижение', 0, 0, 1], ['Логистика: остатки, партии, поставки, ДДС', 0, 0, 1], ['Пользователи кабинета (до 5)', 0, 0, 1], ['Свой ИИ (Claude, ChatGPT) по вашим данным', 0, 0, 1]];
    var FAQ = [['Безопасно ли давать токен Wildberries?', 'Токен хранится в зашифрованном виде и не показывается на сайте. Ваш ИИ работает только на чтение и видит только ваши кабинеты.'],
        ['Можно ли отменить подписку?', 'Да, в любой момент. Доступ сохраняется до конца оплаченного периода.'],
        ['Что будет с данными после отмены?', 'Данные кабинета остаются у вас. После отмены разделы закрываются, пока вы не вернётесь на тариф.'],
        ['Чем «Лидер» отличается от «Роста»?', 'В «Лидере» есть РНП, продвижение, логистика, пользователи кабинета и свой ИИ. Разница 3 400 сом в месяц.'],
        ['Когда будет Ozon?', 'Подключение Ozon готовим. Как только оно заработает, оно войдёт в тариф «Лидер».']];
    var S = { m: 1, sel: 'lead' };

    var CSS = '#nr-tr{display:grid;gap:16px;max-width:1080px;margin:0 auto;padding:8px 4px 24px;color:var(--text-primary)}' +
        '#nr-tr h2{font-size:24px;font-weight:600;letter-spacing:-.02em;text-align:center;margin:0}#nr-tr h3{font-size:16px;font-weight:700;text-align:center;margin:8px 0 0}' +
        '.nrt-lead{text-align:center;color:var(--text-muted);font-size:13px;margin:0}' +
        '.nrt-chips{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}.nrt-chip{font-size:12px;font-weight:700;padding:5px 12px;border-radius:99px;border:1px solid var(--border);color:var(--text-muted)}' +
        '.nrt-promo{justify-self:center;background:var(--sel);color:var(--accent);padding:7px 14px;border-radius:99px;font-size:12.5px;font-weight:700;text-align:center}' +
        '.nrt-akyl{display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:space-between;background:var(--bg-card);border:1px solid var(--border);border-radius:16px;padding:12px 16px;font-size:13px}' +
        '.nrt-akyl img{border-radius:50%;flex:none}.nrt-akyl b{display:block;font-size:14px}.nrt-akyl span{color:var(--text-muted)}.nrt-akyl .l{display:flex;gap:12px;align-items:center;min-width:0}' +
        '.nrt-per{display:inline-flex;gap:4px;background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:4px;justify-self:center;flex-wrap:wrap;justify-content:center;max-width:100%}' +
        '.nrt-per button{border:0;background:none;color:var(--text-muted);font:700 13px inherit;font-family:inherit;padding:8px 14px;border-radius:10px;cursor:pointer}' +
        '.nrt-per button small{color:#16a34a;font-weight:800;margin-left:4px}.nrt-per button[aria-pressed=true]{background:var(--sel);color:var(--text-primary)}' +
        '.nrt-plans{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;align-items:stretch}' +
        '.nrt-plan{background:var(--bg-card);border:1.5px solid var(--border);border-radius:18px;padding:20px;display:flex;flex-direction:column;gap:14px;position:relative;cursor:pointer;min-width:0}' +
        '.nrt-plan.sel{border-color:#16a34a;box-shadow:0 0 0 3px rgba(22,163,74,.16)}.nrt-plan:focus-visible{outline:2px solid var(--accent);outline-offset:2px}' +
        '.nrt-head{display:flex;justify-content:space-between;gap:10px}.nrt-head h3{margin:0;font-size:19px}' +
        '.nrt-radio{width:18px;height:18px;border-radius:50%;border:1.5px solid var(--text-muted);flex:none;margin-top:3px;position:relative}.nrt-plan.sel .nrt-radio{border-color:#16a34a}.nrt-plan.sel .nrt-radio:after{content:"";position:absolute;inset:3px;border-radius:50%;background:#16a34a}' +
        '.nrt-desc{font-size:12.5px;color:var(--text-muted);margin:-6px 0 0}' +
        '.nrt-ai{background:var(--sel);border-radius:12px;padding:10px 12px;font-size:12.5px}.nrt-ai b{display:block;color:var(--accent);margin-bottom:2px}' +
        '.nrt-feat{list-style:none;margin:0;padding:0;display:grid;gap:9px;font-size:12.5px;flex:1;align-content:start}.nrt-feat li{display:flex;gap:9px;align-items:flex-start}' +
        '.nrt-feat li:before{content:"✓";flex:none;width:16px;height:16px;border-radius:50%;border:1.5px solid #16a34a;color:#16a34a;font-size:10px;font-weight:800;display:grid;place-items:center;margin-top:1px}' +
        '.nrt-feat li.no{color:var(--text-muted)}.nrt-feat li.no:before{content:"";border-color:var(--border)}' +
        '.nrt-trial{align-self:flex-start;font-size:11px;font-weight:800;color:#16a34a;background:rgba(22,163,74,.12);border-radius:99px;padding:3px 10px}' +
        '.nrt-price{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}.nrt-price b{font-size:36px;line-height:1;font-variant-numeric:tabular-nums}.nrt-price span{color:var(--text-muted);font-size:13px}.nrt-price s{color:var(--text-muted);font-size:14px}' +
        '.nrt-sub{font-size:12px;color:var(--text-muted);margin:-8px 0 0}' +
        '.nrt-tag{position:absolute;top:-11px;left:18px;background:#16a34a;color:#fff;font-size:11px;font-weight:800;padding:3px 10px;border-radius:99px}' +
        '.nrt-btn{display:block;text-align:center;text-decoration:none;border-radius:12px;padding:12px;font-weight:700;font-size:14px;background:var(--sel);color:var(--text-primary)}.nrt-plan.sel .nrt-btn{background:var(--accent);color: var(--on-accent, #fff)}' +
        '.nrt-extra{background:var(--bg-card);border:1px dashed var(--border);border-radius:14px;padding:12px 16px;font-size:13px;text-align:center}' +
        '.nrt-tw{overflow-x:auto;border-radius:16px;border:1px solid var(--border);background:var(--bg-card)}.nrt-tw table{width:100%;border-collapse:collapse;font-size:13px;min-width:480px}' +
        '.nrt-tw th,.nrt-tw td{padding:10px 14px;text-align:center;border-top:1px solid var(--border)}.nrt-tw th:first-child,.nrt-tw td:first-child{text-align:left}.nrt-tw thead th{border-top:0;background:var(--sel);font-size:12.5px}' +
        '.nrt-tw td.y{color:#16a34a;font-weight:800}.nrt-tw td.n{color:var(--text-muted)}' +
        '.nrt-faq{display:grid;gap:8px}.nrt-faq details{background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:12px 14px;font-size:13px}.nrt-faq summary{cursor:pointer;font-weight:700}.nrt-faq p{margin:8px 0 0;color:var(--text-muted)}' +
        '.nrt-ask{justify-self:center;display:grid;gap:6px;text-align:center;font-size:13px;color:var(--text-muted)}.nrt-ask a{color:var(--accent);font-weight:800;text-decoration:none;border:1px solid var(--border);background:var(--bg-card);padding:10px 16px;border-radius:12px}' +
        '.nrt-foot{text-align:center;color:var(--text-muted);font-size:12px;margin:0}' +
        '@media(max-width:820px){.nrt-plans{grid-template-columns:1fr}}';

    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function fmt(n) { return Math.round(n).toLocaleString('ru-RU').replace(/[  ]/g, ' '); }
    function per() { return PERIODS.filter(function (p) { return p.m === S.m; })[0]; }
    function wa(name) {
        var p = per(), txt = 'Здравствуйте! Хочу тариф «' + name + '»' + (p.m > 1 ? ' на ' + p.t : '') + '.';
        return WA + '?text=' + encodeURIComponent(txt);
    }
    function planHtml(p) {
        var pr = per(), price = p.base * (1 - pr.off), sub = pr.m === 1 ? '≈ ' + fmt(price / 30) + ' сом в день' : 'за ' + pr.m + ' мес: ' + fmt(price * pr.m) + ' сом · экономия ' + fmt(p.base * pr.m * pr.off) + ' сом';
        if (p.top && pr.m === 1) sub += ' · на 3 400 дороже, чем «Рост»';
        var h = '<article class="nrt-plan' + (S.sel === p.id ? ' sel' : '') + '" tabindex="0" data-p="' + p.id + '">' + (p.top ? '<span class="nrt-tag">ВЫБОР ВЛАДЕЛЬЦЕВ КАБИНЕТОВ</span>' : '') +
            '<div class="nrt-head"><h3>' + p.name + '</h3><i class="nrt-radio"></i></div><p class="nrt-desc">' + p.day + '</p>' + (p.ai ? '<div class="nrt-ai"><b>Свой ИИ по вашим данным</b>' + p.ai + '</div>' : '') + '<ul class="nrt-feat">';
        p.yes.forEach(function (t) { h += '<li>' + esc(t) + '</li>'; });
        p.no.forEach(function (t) { h += '<li class="no">' + esc(t) + '</li>'; });
        h += '</ul>' + (p.top ? '<span class="nrt-trial">3 дня бесплатно</span>' : '') + '<div class="nrt-price">' + (p.old && pr.m === 1 ? '<s>' + fmt(p.old) + '</s>' : '') + '<b>' + fmt(price) + '</b><span>сом / мес</span></div><p class="nrt-sub">' + sub + '</p>' +
            '<a class="nrt-btn" href="' + wa(p.name) + '" target="_blank" rel="noopener">' + p.cta + '</a></article>';
        return h;
    }
    function render() {
        var el = doc.getElementById('nr-tr');
        if (!el) return;
        var h = '<h2>Тарифы NR Space</h2><p class="nrt-lead">Выберите тариф. Отменить можно в любой момент.</p>' +
            '<div class="nrt-chips"><span class="nrt-chip">Wildberries</span><span class="nrt-chip">Ozon: скоро</span></div>' +
            '<div class="nrt-promo">Акылай бесплатно до 1 ноября на любом тарифе · Скидки действуют до 1 ноября</div>' +
            '<div class="nrt-akyl"><div class="l"><img src="/img/agents/akylai-smile.svg" alt="" width="40" height="40"><div><b>Акылай: бесплатно до 1 ноября</b><span>Ответы на отзывы Wildberries, проверка в Telegram, 1 кабинет</span></div></div><button type="button" class="ui-btn ui-btn-primary" onclick="showTab(\'dashboard\')">Подключить магазин</button></div>' +
            '<div class="nrt-per" role="group" aria-label="Период оплаты">';
        PERIODS.forEach(function (p) { h += '<button type="button" data-m="' + p.m + '" aria-pressed="' + (p.m === S.m) + '">' + p.t + (p.off ? '<small>−' + Math.round(p.off * 100) + '%</small>' : '') + '</button>'; });
        h += '</div><div class="nrt-plans">' + PLANS.map(planHtml).join('') + '</div>' +
            '<div class="nrt-extra">Ещё один кабинет Wildberries: <b>+1 500 сом / мес</b> за каждый кабинет сверх первого.</div><h3>Сравнение тарифов</h3>' +
            '<div class="nrt-tw"><table><thead><tr><th>Что входит</th><th>Старт</th><th>Рост</th><th>Лидер</th></tr></thead><tbody>';
        TABLE.forEach(function (r) { h += '<tr><td>' + esc(r[0]) + '</td>' + [1, 2, 3].map(function (i) { return r[i] ? '<td class="y">✓</td>' : '<td class="n">—</td>'; }).join('') + '</tr>'; });
        h += '</tbody></table></div><h3>Частые вопросы</h3><div class="nrt-faq">' + FAQ.map(function (f) { return '<details><summary>' + esc(f[0]) + '</summary><p>' + esc(f[1]) + '</p></details>'; }).join('') + '</div>' +
            '<div class="nrt-ask">Остались вопросы по тарифу?<a href="' + WA + '" target="_blank" rel="noopener">Написать в WhatsApp: +996 502 446 688</a></div>' +
            '<p class="nrt-foot">Оплата пока через WhatsApp NR: кнопка откроет чат с названием тарифа.</p>';
        el.innerHTML = h;
    }
    function init() {
        var el = doc.getElementById('nr-tr');
        if (!el || el.dataset.ready) return;
        el.dataset.ready = '1';
        var st = doc.createElement('style');
        st.id = 'nr-tr-css';
        st.textContent = CSS;
        doc.head.appendChild(st);
        render();
        el.addEventListener('click', function (e) {
            var b = e.target.closest && e.target.closest('.nrt-per button');
            if (b) { S.m = +b.dataset.m; render(); return; }
            var p = e.target.closest && e.target.closest('.nrt-plan');
            if (p && !e.target.closest('a')) { S.sel = p.dataset.p; render(); }
        });
        el.addEventListener('keydown', function (e) {
            var p = e.target.classList && e.target.classList.contains('nrt-plan') ? e.target : null;
            if (p && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); S.sel = p.dataset.p; render(); }
        });
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
    root.NrTariffs = { render: render };
})(typeof window !== 'undefined' ? window : this);

/* Окно настроек собственного Instagram NR Space (только супер-админ). Открывается из раздела «Контент». */
(function (root) {
    'use strict';
    function h(tag, attrs, kids) {
        var el = document.createElement(tag);
        if (attrs) for (var k in attrs) {
            if (k === 'class') el.className = attrs[k];
            else if (k === 'text') el.textContent = attrs[k];
            else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), attrs[k]);
            else if (attrs[k] !== false && attrs[k] != null) el.setAttribute(k, attrs[k]);
        }
        (kids || []).forEach(function (c) { if (c) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
        return el;
    }
    function openIgWindow(sb) {
        var old = document.getElementById('nrc-ig-win'); if (old) old.remove();
        var S = {
            wrap: 'position:fixed;inset:0;z-index:200000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px',
            box: 'background:#fff;color:#111;border-radius:14px;width:min(520px,100%);max-height:90vh;overflow:auto;padding:20px;font:14px system-ui,sans-serif',
            lab: 'display:block;font-weight:600;margin:12px 0 4px', inp: 'width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #ccc;border-radius:8px;font:inherit',
            btn: 'padding:8px 14px;border:0;border-radius:8px;background:#f97316;color:#fff;font-weight:600;cursor:pointer;margin-right:8px',
            btn2: 'padding:8px 14px;border:1px solid #ccc;border-radius:8px;background:#fff;cursor:pointer;margin-right:8px',
            hint: 'color:#666;font-size:12px;margin-top:3px',
        };
        function call(body) {
            return sb.functions.invoke('nr-ig-admin', { body: body }).then(function (r) {
                if (r.error) {
                    var ctx = r.error.context;
                    var rd = ctx && typeof ctx.text === 'function' ? ctx.text() : Promise.resolve('');
                    return rd.then(function (t) {
                        var m = ''; try { m = JSON.parse(t).error; } catch (e) { m = t; }
                        throw new Error((m || r.error.message) + (ctx && ctx.status ? ' [' + ctx.status + ']' : ''));
                    });
                }
                if (r.data && r.data.error) throw new Error(r.data.error);
                return r.data;
            });
        }
        var status = h('div', { style: 'margin:8px 0;padding:8px 10px;border-radius:8px;background:#f3f4f6' }, ['Загрузка…']);
        var f = {
            ig: h('input', { style: S.inp, placeholder: '17841400000000000', inputmode: 'numeric' }),
            page: h('input', { style: S.inp, placeholder: 'ID страницы Facebook', inputmode: 'numeric' }),
            token: h('input', { style: S.inp, type: 'password', autocomplete: 'off', placeholder: 'Вставьте токен (сохранённый не показывается)' }),
            foot: h('textarea', { style: S.inp, rows: 2, placeholder: 'Подпись в конце каждого поста' }),
            tags: h('textarea', { style: S.inp, rows: 2, placeholder: '#wb #маркетплейсы' }),
            auto: h('input', { type: 'checkbox' }),
        };
        function render(d) {
            f.ig.value = d.ig_user_id || ''; f.page.value = d.page_id || ''; f.token.value = '';
            f.foot.value = (d.settings && d.settings.caption_footer) || ''; f.tags.value = (d.settings && d.settings.hashtags) || '';
            f.auto.checked = !!(d.settings && d.settings.auto_publish);
            var ok = d.verified_at && d.ig_username;
            status.textContent = ok ? 'Подключено: @' + d.ig_username : d.note ? 'Токен сохранён. ' + d.note : d.verify_error ? 'Ошибка: ' + d.verify_error : d.has_token ? 'Токен сохранён, не проверен' : 'Не подключено';
            status.style.background = ok ? '#dcfce7' : d.verify_error ? '#fee2e2' : '#f3f4f6';
        }
        function busy(p, msg) { status.textContent = msg; return p.then(render).catch(function (e) { status.textContent = 'Ошибка: ' + e.message; status.style.background = '#fee2e2'; }); }
        function payload() { var b = { action: 'save', ig_user_id: f.ig.value, page_id: f.page.value, settings: { caption_footer: f.foot.value, hashtags: f.tags.value, auto_publish: f.auto.checked } }; if (f.token.value.trim()) b.token = f.token.value; return b; }
        function row(label, el, hint) { return h('div', null, [h('label', { style: S.lab, text: label }), el, hint ? h('div', { style: S.hint, text: hint }) : null]); }
        var win = h('div', { id: 'nrc-ig-win', style: S.wrap, onclick: function (e) { if (e.target === win) win.remove(); } }, [
            h('div', { style: S.box }, [
                h('div', { style: 'display:flex;justify-content:space-between;align-items:center' }, [
                    h('b', { style: 'font-size:17px', text: 'Instagram NR Space' }),
                    h('button', { style: 'border:0;background:none;font-size:24px;cursor:pointer', onclick: function () { win.remove(); } }, ['×']),
                ]),
                h('div', { style: S.hint, text: 'Наш собственный аккаунт. Виден только супер-админу, кабинеты и клиенты его не видят.' }),
                status,
                row('ID Instagram-аккаунта (Business)', f.ig, 'Числовой ID профессионального аккаунта'),
                row('ID страницы Facebook', f.page, 'Страница, к которой привязан Instagram'),
                row('Токен доступа', f.token, 'Хранится в защищённом хранилище и больше не показывается'),
                row('Подпись в конце постов', f.foot), row('Хэштеги по умолчанию', f.tags),
                h('label', { style: 'display:flex;gap:8px;align-items:center;margin-top:12px' }, [f.auto, 'Публиковать по расписанию автоматически']),
                h('div', { style: 'margin-top:16px;padding:10px;border:1px dashed #ccc;border-radius:8px' }, [
                    h('button', { style: S.btn, onclick: function () { call({ action: 'oauth_url' }).then(function (r) { location.href = r.url; }).catch(function (e) { status.textContent = 'Ошибка: ' + e.message; status.style.background = '#fee2e2'; }); } }, ['Войти через Facebook']),
                    h('div', { style: S.hint, text: 'Сам найдёт страницу и Instagram, сохранит долгий токен. Вручную вводить ничего не нужно.' }),
                ]),
                h('div', { style: 'margin-top:16px' }, [
                    h('button', { style: S.btn2, onclick: function () { busy(call(payload()), 'Сохраняю…'); } }, ['Сохранить']),
                    h('button', { style: S.btn2, onclick: function () { busy(call(payload()).then(function () { return call({ action: 'verify' }); }), 'Проверяю…'); } }, ['Сохранить и проверить']),
                ]),
            ]),
        ]);
        document.body.appendChild(win);
        busy(call({ action: 'get' }), 'Загрузка…');
    }
    root.NrIgWindow = { open: openIgWindow };
})(typeof window !== 'undefined' ? window : globalThis);

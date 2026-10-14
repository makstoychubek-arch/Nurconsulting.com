/* Единые окна NR Space: уведомление, подтверждение, окно, лисёнок внутри.
 * NrUi.toast('success'|'error'|'warning'|'info', title, text, { action:{label,onClick}, duration, sticky, key })
 * NrUi.toast.promise(promise, { loading, success, error })
 * NrUi.confirm({ title, text, confirmLabel, cancelLabel, danger }) -> Promise<boolean>
 * NrUi.dialog({ title, body, actions:[{label, primary, danger, onClick}], size:'s'|'m'|'l' }) -> { close, el }
 * Цвета берутся из переменных темы сайта (--surface-solid, --text-primary, --border, --accent, --green, --red, --amber, --blue),
 * поэтому при смене темы окна перекрашиваются сами. Фон сплошной, текст не просвечивает. */
(function (root) {
    'use strict';
    var doc = root.document;
    if (!doc) return;
    var DUR = { success: 5000, info: 6000, warning: 8000, error: 0 };
    var COLOR = { success: 'var(--green,#16a34a)', error: 'var(--red,#dc2626)', warning: 'var(--amber,#d97706)', info: 'var(--blue,#2563eb)' };
    var GLYPH = { success: '✓', error: '!', warning: '!', info: 'i' };

    var css =
        '.nru-wrap{position:fixed;top:16px;right:16px;z-index:100000;display:flex;flex-direction:column;gap:10px;pointer-events:none;max-width:calc(100vw - 32px)}' +
        '.nru-toast,.nru-dlg,.nru-win{font:13px/1.45 var(--font-ui,Inter,system-ui,sans-serif);color:var(--text-primary,#111)}' +
        '.nru-toast{pointer-events:auto;width:344px;max-width:100%;display:flex;gap:12px;align-items:flex-start;padding:14px 14px 17px;background:var(--surface-solid,#fff);' +
        'border:1px solid var(--border-strong,rgba(0,0,0,.12));border-radius:var(--radius-control,14px);box-shadow:0 14px 40px rgba(0,0,0,.2);position:relative;overflow:hidden;' +
        'opacity:0;transform:translateX(24px) scale(.97);transition:opacity .22s ease,transform .22s cubic-bezier(.2,.8,.2,1)}' +
        '.nru-toast.on{opacity:1;transform:none}.nru-toast.static{opacity:1;transform:none;pointer-events:none}' +
        '.nru-ic{width:32px;height:32px;border-radius:10px;flex:none;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;' +
        'color:var(--c);background:color-mix(in srgb,var(--c) 16%,var(--surface-solid,#fff))}' +
        '.nru-ic.fox{background:none;width:40px;height:40px;margin:-4px -4px -4px -4px}' +
        '.nru-tx{flex:1;min-width:0}.nru-tx b{display:block;font-size:14px;font-weight:700;color:var(--text-primary,#111);margin-bottom:2px}' +
        '.nru-tx span{display:block;color:var(--text-secondary,#3f3f46);word-wrap:break-word}' +
        '.nru-act{display:inline-block;margin-top:8px;padding:0;border:0;background:none;font:600 13px var(--font-ui,inherit);color:var(--accent,#3b82f6);cursor:pointer}' +
        '.nru-x{border:0;background:none;color:var(--text-muted,#71717a);font-size:20px;line-height:1;cursor:pointer;padding:0 0 0 4px;margin:-2px -2px 0 0}' +
        '.nru-x:hover{color:var(--text-primary,#111)}' +
        '.nru-bar{position:absolute;left:0;bottom:0;height:3px;background:var(--c);width:100%;transform-origin:left;animation:nru-bar linear forwards}' +
        '.nru-toast.sticky .nru-bar{animation:none}.nru-toast:hover .nru-bar{animation-play-state:paused}' +
        '@keyframes nru-bar{from{transform:scaleX(1)}to{transform:scaleX(0)}}' +
        '.nru-ov{position:fixed;inset:0;z-index:100001;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.48);backdrop-filter:blur(3px);opacity:0;transition:opacity .2s ease}' +
        '.nru-ov.on{opacity:1}.nru-ov.on .nru-dlg,.nru-ov.on .nru-win{transform:none;opacity:1}' +
        '.nru-dlg,.nru-win{background:var(--surface-solid,#fff);border:1px solid var(--border-strong,rgba(0,0,0,.12));border-radius:var(--radius-card,20px);box-shadow:0 24px 70px rgba(0,0,0,.35);' +
        'transform:translateY(10px) scale(.97);opacity:0;transition:opacity .22s ease,transform .26s cubic-bezier(.2,.8,.2,1);max-width:100%}' +
        '.nru-dlg{width:400px;padding:22px;text-align:center}.nru-dlg.static,.nru-win.static{transform:none;opacity:1}' +
        '.nru-dlg .fx{display:flex;justify-content:center;margin:-6px 0 4px}' +
        '.nru-dlg h3{margin:0 0 6px;font-size:18px;font-weight:700;letter-spacing:-.01em}.nru-dlg p{margin:0;color:var(--text-secondary,#3f3f46);font-size:14px;line-height:1.5}' +
        '.nru-btns{display:flex;gap:10px;justify-content:flex-end;margin-top:20px}.nru-dlg .nru-btns{justify-content:center}' +
        '.nru-b{min-height:40px;border-radius:var(--radius-control,12px);padding:0 18px;font:600 14px var(--font-ui,inherit);cursor:pointer;border:1px solid var(--border-strong,rgba(0,0,0,.14));background:transparent;color:var(--text-primary,#111)}' +
        '.nru-b:hover{background:var(--sel,rgba(127,127,127,.12))}.nru-b.p{background:var(--accent,#3b82f6);border-color:var(--accent,#3b82f6);color:#fff}.nru-b.p:hover{filter:brightness(1.08)}' +
        '.nru-b.d{background:var(--red,#dc2626);border-color:var(--red,#dc2626);color:#fff}.nru-b.d:hover{filter:brightness(1.08)}' +
        '.nru-win{width:520px;display:flex;flex-direction:column;max-height:calc(100vh - 32px)}.nru-win.l{width:860px}.nru-win.s{width:400px}' +
        '.nru-hd{display:flex;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border,rgba(0,0,0,.1))}.nru-hd h3{margin:0;font-size:16px;font-weight:700}' +
        '.nru-hd .nru-x{margin-left:auto;font-size:22px}.nru-bd{padding:18px 20px;overflow:auto;color:var(--text-secondary,#3f3f46);font-size:14px}' +
        '.nru-ft{padding:14px 20px;border-top:1px solid var(--border,rgba(0,0,0,.1));display:flex;gap:10px;justify-content:flex-end;background:color-mix(in srgb,var(--text-primary,#111) 3%,var(--surface-solid,#fff));border-radius:0 0 var(--radius-card,20px) var(--radius-card,20px)}' +
        '@media (max-width:640px){.nru-wrap{left:12px;right:12px;top:12px}.nru-toast{width:100%}}' +
        '@media (prefers-reduced-motion:reduce){.nru-toast,.nru-ov,.nru-dlg,.nru-win{transition:none}.nru-bar{animation:none}}';
    var st = doc.createElement('style'); st.id = 'nru-css'; st.textContent = css; (doc.head || doc.documentElement).appendChild(st);

    function el(tag, cls, html) { var e = doc.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
    function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function fox(size, rest) {
        if (!root.NrFox) return null;
        var h = el('span'); h.style.cssText = 'display:inline-block;line-height:0;width:' + size + 'px;height:' + size + 'px';
        root.NrFox.mount(h, { size: size, rest: rest || null }); return h;
    }
    var wrap = null, n = 0;
    function wrapEl() { if (!wrap || !wrap.isConnected) { wrap = el('div', 'nru-wrap'); wrap.setAttribute('aria-live', 'polite'); doc.body.appendChild(wrap); } return wrap; }

    /* ───── Уведомление ───── */
    function toast(type, title, text, opts) {
        opts = opts || {};
        type = COLOR[type] ? type : 'info';
        var t = el('div', 'nru-toast'); t.setAttribute('role', type === 'error' ? 'alert' : 'status');
        var h = { el: t, timer: null, left: 0, started: 0 };
        function paint(ty, ti, tx) {
            type = ty; t.style.setProperty('--c', COLOR[ty]);
            var icon = t.querySelector('.nru-ic'); if (icon) icon.remove();
            var ic = el('div', 'nru-ic');
            var f = null;
            if (opts.loading) { f = fox(40, null); }
            else if (ty === 'success') { f = fox(40, n++ % 3 === 0 ? 'sparkle' : 'heart'); }
            if (f) { ic.className = 'nru-ic fox'; ic.appendChild(f); } else { ic.textContent = GLYPH[ty]; }
            t.insertBefore(ic, t.firstChild);
            t.querySelector('.nru-tx b').textContent = ti || '';
            var sp = t.querySelector('.nru-tx span'); sp.textContent = tx || ''; sp.style.display = tx ? 'block' : 'none';
        }
        t.innerHTML = '<div class="nru-tx"><b></b><span></span></div><button type="button" class="nru-x" aria-label="Закрыть">×</button><i class="nru-bar"></i>';
        paint(type, title, text);
        if (opts.action) {
            var a = el('button', 'nru-act'); a.type = 'button'; a.textContent = opts.action.label;
            a.addEventListener('click', function () { try { opts.action.onClick && opts.action.onClick(); } finally { h.close(); } });
            t.querySelector('.nru-tx').appendChild(a);
        }
        t.querySelector('.nru-x').addEventListener('click', function () { h.close(); });
        if (opts.preview) { t.classList.add('static'); if (!(opts.duration || DUR[type]) || opts.sticky || opts.loading) t.classList.add('sticky'); opts.preview.appendChild(t); h.close = function () {}; return h; }
        var w = wrapEl();
        if (opts.key) { var ex = w.querySelector('[data-k="' + opts.key + '"]'); if (ex) ex.remove(); t.setAttribute('data-k', opts.key); }
        while (w.children.length >= 4) w.firstChild.remove();
        w.appendChild(t);
        requestAnimationFrame(function () { t.classList.add('on'); });
        function arm(ms) {
            clearTimeout(h.timer); h.left = ms; h.started = Date.now();
            var bar = t.querySelector('.nru-bar'); bar.style.animationDuration = ms + 'ms'; bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = '';
            bar.style.animationDuration = ms + 'ms';
            h.timer = setTimeout(function () { h.close(); }, ms);
        }
        function schedule() {
            var ms = opts.sticky || opts.loading ? 0 : (opts.duration != null ? opts.duration : DUR[type]);
            t.classList.toggle('sticky', !ms); clearTimeout(h.timer);
            if (ms) arm(ms);
        }
        t.addEventListener('mouseenter', function () { if (h.timer) { clearTimeout(h.timer); h.left = Math.max(800, h.left - (Date.now() - h.started)); } });
        t.addEventListener('mouseleave', function () { if (!t.classList.contains('sticky') && h.left) { h.started = Date.now(); h.timer = setTimeout(function () { h.close(); }, h.left); } });
        h.close = function () { clearTimeout(h.timer); t.classList.remove('on'); setTimeout(function () { t.remove(); }, 260); };
        h.update = function (ty, ti, tx, o2) { opts.loading = false; if (o2) { for (var k in o2) opts[k] = o2[k]; } paint(ty, ti, tx); schedule(); };
        schedule();
        if (type === 'error' && root.NrMotion) root.NrMotion.shake(t);
        (function swipe() {
            var x0 = null, dx = 0;
            t.addEventListener('pointerdown', function (e) { if (e.target.closest('button')) return; x0 = e.clientX; dx = 0; });
            t.addEventListener('pointermove', function (e) { if (x0 == null) return; dx = e.clientX - x0; if (Math.abs(dx) > 6) { t.style.transition = 'none'; t.style.transform = 'translateX(' + dx + 'px)'; t.style.opacity = String(1 - Math.min(.7, Math.abs(dx) / 260)); } });
            function end() { if (x0 == null) return; x0 = null; t.style.transition = ''; if (Math.abs(dx) > 90) { h.close(); } else { t.style.transform = ''; t.style.opacity = ''; } }
            t.addEventListener('pointerup', end); t.addEventListener('pointercancel', end);
        })();
        return h;
    }
    toast.promise = function (p, msg) {
        var h = toast('info', msg.loading || 'Загрузка…', msg.loadingText || '', { loading: true });
        Promise.resolve(p).then(function (v) { h.update('success', typeof msg.success === 'function' ? msg.success(v) : msg.success || 'Готово', msg.successText || ''); return v; },
            function (e) { h.update('error', typeof msg.error === 'function' ? msg.error(e) : msg.error || 'Ошибка', (e && e.message) || ''); });
        return p;
    };

    /* ───── Подтверждение ───── */
    function overlay(content, onClose, preview) {
        if (preview) { content.classList.add('static'); preview.appendChild(content); return { close: function () {} }; }
        var ov = el('div', 'nru-ov'); ov.appendChild(content); doc.body.appendChild(ov);
        var prev = doc.activeElement;
        function close(v) { doc.removeEventListener('keydown', key, true); ov.classList.remove('on'); setTimeout(function () { ov.remove(); }, 220); try { prev && prev.focus && prev.focus(); } catch (e) {} onClose && onClose(v); }
        function key(e) { if (e.key === 'Escape') { e.stopPropagation(); close(false); } }
        doc.addEventListener('keydown', key, true);
        ov.addEventListener('mousedown', function (e) { if (e.target === ov) close(false); });
        requestAnimationFrame(function () { ov.classList.add('on'); });
        return { close: close, ov: ov };
    }
    function confirmDlg(o) {
        o = o || {};
        return new Promise(function (resolve) {
            var d = el('div', 'nru-dlg'); d.setAttribute('role', 'alertdialog'); d.setAttribute('aria-modal', 'true');
            var fx = el('div', 'fx'); var f = fox(o.danger ? 76 : 64, o.danger ? 'surprised' : null); if (f) d.appendChild(fx), fx.appendChild(f);
            d.appendChild(el('h3', null, esc(o.title || 'Подтвердите действие')));
            if (o.text) d.appendChild(el('p', null, esc(o.text)));
            var bt = el('div', 'nru-btns');
            var no = el('button', 'nru-b'); no.type = 'button'; no.textContent = o.cancelLabel || 'Отмена';
            var yes = el('button', 'nru-b ' + (o.danger ? 'd' : 'p')); yes.type = 'button'; yes.textContent = o.confirmLabel || (o.danger ? 'Удалить' : 'Подтвердить');
            bt.appendChild(no); bt.appendChild(yes); d.appendChild(bt);
            var ctl = overlay(d, function (v) { resolve(!!v); }, o.preview);
            if (o.preview) { resolve(false); return; }
            no.addEventListener('click', function () { ctl.close(false); }); yes.addEventListener('click', function () { ctl.close(true); });
            setTimeout(function () { (o.danger ? no : yes).focus(); }, 60);
        });
    }

    /* ───── Окно ───── */
    function dialog(o) {
        o = o || {};
        var w = el('div', 'nru-win ' + (o.size || 'm')); w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true');
        var hd = el('div', 'nru-hd'); hd.appendChild(el('h3', null, esc(o.title || '')));
        var x = el('button', 'nru-x'); x.type = 'button'; x.setAttribute('aria-label', 'Закрыть'); x.textContent = '×'; hd.appendChild(x); w.appendChild(hd);
        var bd = el('div', 'nru-bd'); if (typeof o.body === 'string') bd.innerHTML = o.body; else if (o.body) bd.appendChild(o.body); w.appendChild(bd);
        var ctl;
        if (o.actions && o.actions.length) {
            var ft = el('div', 'nru-ft');
            o.actions.forEach(function (a) {
                var b = el('button', 'nru-b' + (a.primary ? ' p' : a.danger ? ' d' : '')); b.type = 'button'; b.textContent = a.label;
                b.addEventListener('click', function () { var r = a.onClick && a.onClick(); if (a.keepOpen || r === false) return; ctl && ctl.close(); });
                ft.appendChild(b);
            });
            w.appendChild(ft);
        }
        ctl = overlay(w, o.onClose, o.preview);
        x.addEventListener('click', function () { ctl.close(); });
        return { close: function () { ctl.close(); }, el: w };
    }

    /* Окно-сообщение с одной кнопкой «Понятно» (вместо старого центрального окна) */
    function notice(o) {
        o = o || {};
        return new Promise(function (resolve) {
            var ty = COLOR[o.type] ? o.type : 'info';
            var d = el('div', 'nru-dlg'); d.setAttribute('role', 'alertdialog'); d.setAttribute('aria-modal', 'true'); d.style.setProperty('--c', COLOR[ty]);
            var f = ty === 'success' ? fox(72, 'heart') : null;
            if (f) { var fx = el('div', 'fx'); fx.appendChild(f); d.appendChild(fx); }
            else { var ic = el('div', 'nru-ic', GLYPH[ty]); ic.style.cssText = 'margin:0 auto 10px;width:44px;height:44px;font-size:20px'; d.appendChild(ic); }
            d.appendChild(el('h3', null, esc(o.title || '')));
            if (o.text) d.appendChild(el('p', null, esc(o.text)));
            var bt = el('div', 'nru-btns'); var ok = el('button', 'nru-b p'); ok.type = 'button'; ok.textContent = o.buttonLabel || 'Понятно'; bt.appendChild(ok); d.appendChild(bt);
            var ctl = overlay(d, function () { resolve(); }, o.preview);
            if (o.preview) { resolve(); return; }
            ok.addEventListener('click', function () { ctl.close(); }); setTimeout(function () { ok.focus(); }, 60);
        });
    }

    /* Замена системных alert/confirm: NrUi.alert(текст), await NrUi.ask(текст) */
    function alertFn(msg, title) { toast('error', title || 'Ошибка', String(msg == null ? '' : msg)); }
    var DANGER = /^\s*(Удалить|Заблокировать|Завершить|Остановить|Отключить|Сбросить)/i;
    function ask(msg, o) {
        o = o || {};
        var m = String(msg == null ? '' : msg), q = m.indexOf('?'), title, text;
        if (q > 0 && q < 100) { title = m.slice(0, q + 1); text = m.slice(q + 1).trim(); } else { title = o.title || 'Подтвердите действие'; text = m; }
        var verb = (m.match(DANGER) || [])[1];
        return confirmDlg({ title: title, text: text, danger: o.danger != null ? o.danger : !!verb, confirmLabel: o.confirmLabel || (verb ? verb.charAt(0).toUpperCase() + verb.slice(1).toLowerCase() : 'Подтвердить'), cancelLabel: o.cancelLabel });
    }

    root.NrUi = { toast: toast, confirm: confirmDlg, dialog: dialog, alert: alertFn, ask: ask, notice: notice };
})(typeof window !== 'undefined' ? window : globalThis);

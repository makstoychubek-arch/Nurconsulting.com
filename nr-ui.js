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
    var COLOR = { success: 'var(--green,#16803c)', error: 'var(--red,#c42b2b)', warning: 'var(--text-primary,#0b0b0b)', info: 'var(--text-primary,#0b0b0b)' };
    var GLYPH = { success: '✓', error: '!', warning: '!', info: 'i' };

    var css =
        '.nru-wrap[popover],.nru-ov[popover]{border:0;margin:0;padding:0;background:transparent;color:inherit;overflow:visible;max-width:none;max-height:none;width:auto;height:auto}.nru-wrap[popover]{inset:auto;top:16px;right:16px;overflow:hidden;max-width:calc(100vw - 32px);max-height:calc(100vh - 32px)}@media (max-width:640px){.nru-wrap[popover]{inset:auto 12px auto 12px;top:calc(env(safe-area-inset-top,0px) + 8px);max-width:none}}.nru-ov[popover]{inset:0;width:100%;height:100%;padding:16px}' +
        '.nru-wrap{position:fixed;top:16px;right:16px;z-index:100000;display:flex;flex-direction:column;gap:10px;pointer-events:none;max-width:calc(100vw - 32px);max-height:calc(100vh - 32px);overflow:hidden}' +
        '.nru-toast,.nru-dlg,.nru-win{font:13px/1.45 var(--font-ui,Inter,system-ui,sans-serif);color:var(--text-primary,#111)}' +
        '.nru-toast{pointer-events:auto;width:344px;max-width:100%;display:flex;gap:12px;align-items:flex-start;padding:12px 14px 14px;background:var(--surface-solid,#fff);' +
        'border:1px solid var(--toast-c,var(--text-primary,#0b0b0b));border-radius:18px;box-shadow:none;position:relative;overflow:hidden;' +
        'opacity:0;transform:translateX(24px) scale(.97);transition:opacity .22s ease,transform .22s cubic-bezier(.2,.8,.2,1)}' +
        '.nru-toast.on{opacity:1;transform:none}.nru-toast.static{opacity:1;transform:none;pointer-events:none}' +
        '.nru-ic{width:22px;height:22px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:12px;margin-top:1px;' +
        'color:var(--c);border:1.5px solid currentColor;background:none}' +
        '.nru-ic.ring{border:2px solid var(--border,rgba(0,0,0,.12));border-top-color:var(--text-primary,#0b0b0b);animation:nru-spin .9s linear infinite}@keyframes nru-spin{to{transform:rotate(360deg)}}' +
                '.nru-tx{flex:1;min-width:0}.nru-tx b{display:block;font-size:14px;font-weight:800;color:var(--text-primary,#111);margin-bottom:2px}' +
        '.nru-tx span{display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;color:var(--text-secondary,#3f3f46);word-wrap:break-word}' +
        '.nru-act{display:inline-block;margin-top:8px;padding:0;border:0;background:none;font:600 13px var(--font-ui,inherit);color:var(--text-primary,#0b0b0b);border-bottom:1.5px solid currentColor;cursor:pointer}' +
        '.nru-x{border:0;background:none;color:var(--text-muted,#71717a);font-size:20px;line-height:1;cursor:pointer;padding:0 0 0 4px;margin:-2px -2px 0 0}' +
        '.nru-x:hover{color:var(--text-primary,#111)}' +
        '.nru-bar{position:absolute;left:0;bottom:0;height:2px;background:var(--c);width:100%;transform-origin:left;animation:nru-bar linear forwards}' +
        '.nru-toast.sticky .nru-bar{display:none}.nru-toast:hover .nru-bar{animation-play-state:paused}' +
        '@keyframes nru-bar{from{transform:scaleX(1)}to{transform:scaleX(0)}}' +
        '.nru-ov{position:fixed;inset:0;z-index:100001;display:flex;align-items:center;justify-content:center;padding:16px;background:transparent;opacity:0;transition:opacity .2s ease}' +
        '.nru-ov.on{opacity:1}.nru-ov.on .nru-dlg,.nru-ov.on .nru-win{transform:none;opacity:1}' +
        '.nru-dlg,.nru-win{background:var(--surface-solid,#fff);border:1.5px solid var(--text-primary,#0b0b0b);border-radius:26px;box-shadow:none;' +
        'transform:translateY(10px) scale(.97);opacity:0;transition:opacity .16s ease,transform .18s cubic-bezier(.2,.8,.2,1);max-width:100%}' +
        '.nru-dlg{width:400px;padding:22px 24px;text-align:left}.nru-dlg.static,.nru-win.static{transform:none;opacity:1}' +
        '.nru-dlg .fx{display:flex;justify-content:center;margin:-6px 0 4px}' +
        '.nru-dlg h3{margin:0 0 8px;font-size:22px;font-weight:900;letter-spacing:-.01em}.nru-dlg p{margin:0;color:var(--text-secondary,#3f3f46);font-size:14px;line-height:1.5}' +
        '.nru-btns{display:flex;gap:10px;justify-content:flex-end;margin-top:20px}.nru-dlg .nru-btns{justify-content:flex-end}' +
        '.nru-b{min-height:42px;border-radius:999px;padding:0 24px;font:800 14px var(--font-ui,inherit);cursor:pointer;border:1px solid var(--text-primary,#0b0b0b);background:transparent;color:var(--text-primary,#111)}' +
        '.nru-b:hover{background:var(--sel,rgba(127,127,127,.12))}.nru-b.p{background:var(--text-primary,#0b0b0b);border-color:var(--text-primary,#0b0b0b);color:var(--surface-solid,#fff)}.nru-b.p:hover{opacity:.88;background:var(--text-primary,#0b0b0b)}' +
        '.nru-b.d{background:transparent;border-color:var(--red,#c42b2b);color:var(--red,#c42b2b)}.nru-b.d:hover{background:transparent;opacity:.8}' +
        '.nru-win{width:520px;display:flex;flex-direction:column;max-height:calc(100vh - 32px)}.nru-win.l{width:860px}.nru-win.s{width:400px}' +
        '.nru-hd{display:flex;align-items:center;padding:20px 22px 4px}.nru-hd h3{margin:0;font-size:22px;font-weight:900}' +
        '.nru-hd .nru-x{margin-left:auto;font-size:22px}.nru-bd{padding:18px 20px;overflow:auto;color:var(--text-secondary,#3f3f46);font-size:14px}' +
        '.nru-ft{padding:14px 22px 20px;display:flex;gap:10px;justify-content:flex-end;background:color-mix(in srgb,var(--text-primary,#111) 3%,var(--surface-solid,#fff));border-radius:0 0 var(--radius-card,20px) var(--radius-card,20px)}' +
        '@media (max-width:640px){.nru-wrap{left:12px;right:12px;top:calc(env(safe-area-inset-top,0px) + 8px)}.nru-toast{width:100%}}' +
        '@media (prefers-reduced-motion:reduce){.nru-toast,.nru-ov,.nru-dlg,.nru-win{transition:none}.nru-bar{animation:none}}';
    var st = doc.createElement('style'); st.id = 'nru-css'; st.textContent = css; (doc.head || doc.documentElement).appendChild(st);

    function el(tag, cls, html) { var e = doc.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
    function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    var wrap = null, n = 0;
    /* Окно кампании открыто в верхнем слое браузера (popover): уведомления и подтверждения поднимаем туда же, иначе они окажутся под ним. */
    function lift(e) {
        try {
            if (!e || typeof e.showPopover !== 'function') return;
            if (!e.hasAttribute('popover')) e.setAttribute('popover', 'manual');
            if (e.matches(':popover-open')) e.hidePopover();
            e.showPopover();
        } catch (err) { /* остаётся fixed */ }
    }
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
            if (opts.loading) { ic.className = 'nru-ic ring'; } else { ic.textContent = GLYPH[ty]; }
            t.style.setProperty('--toast-c', ty === 'error' ? COLOR.error : '');
            t.insertBefore(ic, t.firstChild);
            t.querySelector('.nru-tx b').textContent = ti || '';
            var sp = t.querySelector('.nru-tx span'); sp.textContent = tx || ''; sp.style.display = tx ? '' : 'none';
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
        var w = wrapEl(); lift(w);
        if (opts.key) { var ex = null; for (var i = 0; i < w.children.length; i++) { if (w.children[i].getAttribute('data-k') === String(opts.key)) { ex = w.children[i]; break; } } if (ex) ex.remove(); t.setAttribute('data-k', opts.key); }
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
        var ov = el('div', 'nru-ov'); ov.appendChild(content); doc.body.appendChild(ov); lift(ov);
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
            d.appendChild(el('h3', null, esc(o.title || 'Подтвердите действие')));
            if (o.text) d.appendChild(el('p', null, esc(o.text)));
            var bt = el('div', 'nru-btns');
            var no = el('button', 'nru-b'); no.type = 'button'; no.textContent = o.cancelLabel || 'Отмена';
            var yes = el('button', 'nru-b ' + (o.danger ? 'd' : 'p')); yes.type = 'button'; yes.textContent = o.confirmLabel || (o.danger ? 'Удалить' : 'Подтвердить');
            bt.appendChild(no); bt.appendChild(yes); d.appendChild(bt);
            var ctl = overlay(d, function (v) { resolve(!!v); }, o.preview);
            if (o.preview) { resolve(false); return; }
            no.addEventListener('click', function () { ctl.close(false); });
            if (o.danger && root.NrMotion && root.matchMedia && !root.matchMedia('(hover: none)').matches) {
                /* Опасное действие мышью: удержать кнопку; с клавиатуры подтверждается сразу */
                yes.classList.add('nrm-hold'); yes.appendChild(el('i')); var tm = null, held = false;
                yes.title = 'Удерживайте кнопку';
                yes.addEventListener('pointerdown', function (e) { if (e.button) return; held = false; yes.classList.add('holding'); tm = setTimeout(function () { held = true; yes.classList.remove('holding'); ctl.close(true); }, 700); });
                ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { yes.addEventListener(ev, function () { clearTimeout(tm); yes.classList.remove('holding'); }); });
                yes.addEventListener('click', function (e) { if (e.detail === 0) { ctl.close(true); return; } if (!held) { root.NrMotion.shake(yes); } });
            } else { yes.addEventListener('click', function () { ctl.close(true); }); }
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
            var ic = el('div', 'nru-ic', GLYPH[ty]); ic.style.cssText = 'margin:0 0 12px'; d.appendChild(ic);
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

    // Масштаб страницы: ползунок рядом с кабинетом меняет масштаб только содержимого вкладок (меню и шапка остаются), один на все страницы.
    (function pageZoom() {
        var KEY = 'nr_page_zoom';
        var d = root.document; if (!d) return;
        function get() { var z = 1; try { z = Number(root.localStorage.getItem(KEY)) || 1; } catch (_) { /* без памяти */ } return z >= 0.25 && z <= 2 ? z : 1; }
        var raf = 0;
        function apply(z) {
            d.documentElement.style.setProperty('--nr-zoom', String(z));
            var r = d.getElementById('nr-zoom-r'); if (r) { r.value = String(Math.round(z * 100)); r.title = 'Масштаб ' + Math.round(z * 100) + '% (двойной клик — 100%)'; r.style.setProperty('--p', ((z * 100 - 25) / 175 * 100) + '%'); }
            if (raf) return;
            raf = root.requestAnimationFrame(function () { raf = 0; try { root.dispatchEvent(new root.Event('resize')); } catch (_) { /* старый браузер */ } });
        }
        function set(z) { try { root.localStorage.setItem(KEY, String(z)); } catch (_) { /* без памяти */ } apply(z); }
        function init() {
            var r = d.getElementById('nr-zoom-r'); if (!r || r.__z) return; r.__z = 1;
            apply(get());
            r.addEventListener('input', function () { set(Number(r.value) / 100); });
            r.addEventListener('dblclick', function () { set(1); });
        }
        if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', init); else init();
    })();

    // Правило сайта: у каждой модалки размывается фон. Любой новый полноэкранный слой, добавленный в <body>, получает метку data-nr-blur (CSS в nr-mono.css).
    (function blurSafetyNet() {
        var d = root.document;
        if (!d || !root.MutationObserver || !d.body) return;
        function check(el) {
            if (!el || el.nodeType !== 1 || el.hasAttribute('data-nr-blur') || el.id === 'nr-splash' || el.classList.contains('nra')) return;
            try {
                var cs = root.getComputedStyle(el);
                if (cs.position !== 'fixed' || (parseInt(cs.zIndex, 10) || 0) < 100) return;
                var r = el.getBoundingClientRect();
                if (r.width >= root.innerWidth * 0.95 && r.height >= root.innerHeight * 0.95) el.setAttribute('data-nr-blur', '');
            } catch (e) { /* без метки */ }
        }
        new root.MutationObserver(function (list) { list.forEach(function (m) { m.addedNodes.forEach(check); }); }).observe(d.body, { childList: true });
    })();

    // Ошибки консоли (красные и ошибки API) уходят в базу пачкой раз в минуту, без адресов с параметрами (по просьбе владельца): чиним до скрина.
    (function () {
        var buf = {}, timer = 0, sent = 0;
        function add(msg, src) {
            msg = String(msg || '').replace(/\s+/g, ' ').slice(0, 300);
            if (!msg || /ResizeObserver|Script error|Non-Error promise/i.test(msg)) return;
            var b = buf[msg] || (buf[msg] = { msg: msg, src: String(src || '').replace(/[?#].*$/, '').slice(-120), n: 0 }); b.n++;
            if (!timer) timer = setTimeout(flush, 60000);
        }
        function flush() {
            timer = 0;
            var rows = Object.keys(buf).slice(0, 20).map(function (k) { return buf[k]; }); buf = {};
            var sb = root.supabase; if (!rows.length || !sb || !sb.rpc || sent > 30) return; sent++;
            try { sb.rpc('log_client_errors', { p_rows: rows, p_cabinet: root.currentCabinetId || null, p_mp: root.NrMp ? root.NrMp.get() : null, p_page: (root.getCurrentActiveTab ? root.getCurrentActiveTab() : '') || null }).then(function () {}, function () {}); } catch (e) { /* не мешаем сайту */ }
        }
        root.addEventListener('error', function (e) { add(e.message, e.filename); });
        root.addEventListener('unhandledrejection', function (e) { add('rejection: ' + ((e.reason && e.reason.message) || e.reason), ''); });
        ['error', 'warn'].forEach(function (lv) {
            var orig = root.console && root.console[lv]; if (!orig) return;
            root.console[lv] = function () {
                try { var t = [].slice.call(arguments).map(function (a) { return a && a.message ? a.message : typeof a === 'object' ? '' : String(a); }).join(' '); if (lv === 'error' || /error|API [45]\d\d|failed|не удалось/i.test(t)) add('[' + lv + '] ' + t, 'console'); } catch (e) { /* ок */ }
                return orig.apply(root.console, arguments);
            };
        });
    })();

    /* Смена цен: если сервер просит код (крупное снижение у сотрудников), спрашиваем код, который ушёл владельцу в Telegram, и повторяем отправку. */
    function askPriceCode(info, note) {
        return new Promise(function (resolve) {
            var done = false, box = el('div', 'nru-code'), inp = el('input'), msg = el('p', null, '');
            inp.type = 'text'; inp.inputMode = 'numeric'; inp.maxLength = 6; inp.autocomplete = 'one-time-code'; inp.placeholder = '000000'; inp.setAttribute('aria-label', 'Код подтверждения');
            inp.style.cssText = 'width:100%;font:800 28px/1.2 inherit;letter-spacing:.3em;text-align:center;padding:10px 12px;border:1.5px solid var(--text-primary);border-radius:14px;background:transparent;color:var(--text-primary);box-sizing:border-box';
            msg.innerHTML = 'Крупное снижение цен' + (info && info.count ? ': ' + info.count + ' арт.' : '') + (info && info.maxDrop ? ', до −' + Math.round(info.maxDrop * 100) + '%' : '') + '. Код отправлен владельцу в Telegram и действует ' + ((info && info.minutes) || 10) + ' минут.' + (note ? '<br><b style="color:var(--red,#dc2626)">' + esc(note) + '</b>' : '');
            box.appendChild(msg); box.appendChild(inp);
            var d = dialog({ title: 'Подтвердите смену цен', size: 's', body: box, onClose: function () { if (!done) { done = true; resolve(null); } }, actions: [
                { label: 'Отмена', onClick: function () { /* закрытие вызовет onClose */ } },
                { label: 'Подтвердить', primary: true, keepOpen: true, onClick: function () { var v = String(inp.value || '').replace(/\D/g, ''); if (v.length !== 6) { inp.focus(); return false; } done = true; d.close(); resolve(v); return false; } }
            ] });
            setTimeout(function () { try { inp.focus(); } catch (_) { /* окно закрыто */ } }, 50);
            inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { var v = String(inp.value || '').replace(/\D/g, ''); if (v.length === 6) { done = true; d.close(); resolve(v); } } });
        });
    }
    root.NrPriceSend = function (cab, params) {
        var call = function (extra) { return Promise.resolve(root.callWbProxy('prices_set', extra ? Object.assign({}, params, { confirm: extra }) : params, cab)); };
        var restarts = 0;
        function step(extra, note) {
            return call(extra).then(function (res) {
                if (!res || !res.confirmRequired) return res;
                if (res.restart || !res.confirmId) { if (++restarts > 2) return { error: 'Не удалось подтвердить смену цен. Повторите позже.' }; return step(null, res.error || ''); }
                return askPriceCode(res, note || res.error || '').then(function (code) {
                    if (code == null) return { error: 'Смена цен отменена: код не введён.' };
                    return step({ id: res.confirmId, code: code }, '');
                });
            });
        }
        return step(null, '');
    };

    /* Группы настроек в две ступени: крупные вкладки-группы и мелкие разделы внутри (макет «Настройки по группам», 19 ноября 2026).
       NrGroupTabs.mount(host, { key, groups: [{ id, n, c, secs: [{ id, n, admin }] }], onChange(g, s) }) -> { set(g, s), get() }. Выбор помнится в localStorage по key. */
    root.NrGroupTabs = (function () {
        function mount(host, spec) {
            var groups = spec.groups || [], st = { g: groups[0] && groups[0].id, s: groups[0] && groups[0].secs[0] && groups[0].secs[0].id };
            try { var raw = root.localStorage.getItem(spec.key || ''); if (raw) { var p = JSON.parse(raw); var gg = groups.filter(function (x) { return x.id === p.g; })[0]; if (gg) { st.g = gg.id; st.s = (gg.secs.filter(function (x) { return x.id === p.s; })[0] || gg.secs[0] || {}).id; } } } catch (_) { /* без памяти */ }
            var box = el('div', 'nr-gt'), gb = el('div', 'nr-gt-groups'), sb = el('div', 'nr-gt-secs');
            gb.setAttribute('role', 'tablist'); box.appendChild(gb); box.appendChild(sb); host.insertBefore(box, host.firstChild);
            function cur() { return groups.filter(function (x) { return x.id === st.g; })[0] || groups[0]; }
            function paint(silent) {
                var g = cur();
                gb.innerHTML = groups.map(function (x) { return '<button type="button" role="tab" class="nr-gt-g' + (x.id === g.id ? ' on' : '') + '" data-g="' + x.id + '" aria-selected="' + (x.id === g.id) + '">' + esc(x.n) + (x.c != null ? '<small>' + esc(x.c) + '</small>' : '') + '</button>'; }).join('');
                sb.hidden = g.secs.length < 2;
                sb.innerHTML = g.secs.length < 2 ? '' : g.secs.map(function (x) { return '<button type="button" class="nr-gt-s' + (x.id === st.s ? ' on' : '') + '" data-s="' + x.id + '">' + esc(x.n) + (x.admin ? ' <span class="nr-gt-adm">админ</span>' : '') + '</button>'; }).join('');
                try { root.localStorage.setItem(spec.key || '', JSON.stringify(st)); } catch (_) { /* без памяти */ }
                if (!silent && spec.onChange) spec.onChange(st.g, st.s);
            }
            box.addEventListener('click', function (e) {
                var b = e.target.closest && e.target.closest('button'); if (!b) return;
                if (b.hasAttribute('data-g')) { var g = groups.filter(function (x) { return x.id === b.getAttribute('data-g'); })[0]; st.g = g.id; st.s = g.secs[0] && g.secs[0].id; paint(); }
                else if (b.hasAttribute('data-s')) { st.s = b.getAttribute('data-s'); paint(); }
            });
            paint();
            return { set: function (g, s) { var gg = groups.filter(function (x) { return x.id === g; })[0]; if (!gg) return; st.g = gg.id; st.s = (gg.secs.filter(function (x) { return x.id === s; })[0] || gg.secs[0] || {}).id; paint(); }, get: function () { return { g: st.g, s: st.s }; }, el: box };
        }
        return { mount: mount };
    })();

    /* Общие настройки по группам (макет «Настройки по группам»): сверху группы, под ними разделы выбранной группы. Вызывается из showSettingsSection. */
    root.syncSettingsGroups = function (section) {
        var d = root.document, G = [
            { id: 'acct', n: 'Аккаунт', secs: ['profile', 'security', 'devsessions'] },
            { id: 'conn', n: 'Подключения', secs: ['integrations', 'api', 'keys'] },
            { id: 'pay', n: 'Оплата', secs: ['tariffs'] }
        ];
        var first = d.getElementById('settings-tab-btn-profile'), row = first && first.parentNode; if (!row) return;
        var visible = function (id) { var t = d.getElementById('settings-tab-btn-' + id); return !!t && !t.classList.contains('hidden-tab'); };
        var bar = d.getElementById('settings-groups');
        if (!bar) {
            bar = d.createElement('div'); bar.id = 'settings-groups'; bar.className = 'nr-gt-groups nr-gt-site'; bar.setAttribute('role', 'tablist');
            row.parentNode.insertBefore(bar, row);
            bar.addEventListener('click', function (e) {
                var b = e.target.closest && e.target.closest('button[data-sg]'); if (!b) return;
                var g = G.filter(function (x) { return x.id === b.getAttribute('data-sg'); })[0], sec = g && g.secs.filter(visible)[0];
                if (sec && root.showSettingsSection) root.showSettingsSection(sec);
            });
        }
        var cur = G.filter(function (g) { return g.secs.indexOf(section) >= 0; })[0] || G[0];
        bar.innerHTML = G.filter(function (g) { return g.secs.some(visible); }).map(function (g) { return '<button type="button" role="tab" class="nr-gt-g' + (g.id === cur.id ? ' on' : '') + '" data-sg="' + g.id + '" aria-selected="' + (g.id === cur.id) + '">' + g.n + '</button>'; }).join('');
        G.forEach(function (g) { g.secs.forEach(function (id) { var t = d.getElementById('settings-tab-btn-' + id); if (t) t.classList.toggle('nr-gt-off', cur.secs.indexOf(id) < 0); }); });
        row.classList.toggle('nr-gt-off', cur.secs.filter(visible).length < 2); // в группе один раздел: вторая ступень не нужна
    };

    root.NrUi = { toast: toast, confirm: confirmDlg, dialog: dialog, alert: alertFn, ask: ask, notice: notice };
})(typeof window !== 'undefined' ? window : globalThis);

/* ───── Живое стекло: преломление по краям (только Chrome и Edge) ─────
 * Для каждого стеклянного элемента строим карту смещения нужного размера и скругления и подключаем её SVG-фильтром к backdrop-filter.
 * В Safari и Firefox такие фильтры не работают, там остаётся обычное стекло (стили в nr-mono.css). Выключить: html[data-lg="off"]. */
(function (root) {
    'use strict';
    var doc = root.document; if (!doc) return;
    var SEL = '.bottom-nav,.nr-mp,.nru-toast,.cabinet-dropdown-menu,#header-date-chip-wrap,.nr-win:not(.nr-win-photo):not(.nw-modal),.nru-win';
    var ua = root.navigator && root.navigator.userAgent || '';
    var brands = (root.navigator.userAgentData && root.navigator.userAgentData.brands || []).map(function (b) { return b.brand; }).join(',');
    var chromium = /Chromium/.test(brands) || (/Chrome\//.test(ua) && !/iPhone|iPad|iPod|CriOS|FxiOS/.test(ua));
    var off = false; try { off = root.localStorage.getItem('nr_lg') === '0'; } catch (e) { /* по умолчанию включено */ }
    if (off) { doc.documentElement.setAttribute('data-lg', 'off'); return; }
    if (!chromium || !root.ResizeObserver) return;
    var svg = null, n = 0, map = new WeakMap(), timers = new WeakMap();
    function host() {
        if (svg) return svg;
        svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.setAttribute('aria-hidden', 'true');
        svg.style.cssText = 'position:absolute;width:0;height:0;pointer-events:none';
        (doc.body || doc.documentElement).appendChild(svg);
        return svg;
    }
    // Карта: у края вектор смещения направлен наружу, сила падает к центру (линза толщиной bezel).
    function makeMap(w, h, r, bezel, max) {
        var c = doc.createElement('canvas'); c.width = w; c.height = h;
        var ctx = c.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
        r = Math.min(r, w / 2, h / 2);
        for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
            var px = x + 0.5, py = y + 0.5;
            // ближайшая точка внутреннего прямоугольника (со скруглением) и расстояние до края
            var cx = Math.min(Math.max(px, r), w - r), cy = Math.min(Math.max(py, r), h - r);
            var dx = px - cx, dy = py - cy, len = Math.sqrt(dx * dx + dy * dy), dist, nx, ny;
            if (len > 0.0001) { dist = r - len; nx = dx / len; ny = dy / len; }
            else { var l = px, rr = w - px, t = py, b = h - py, m = Math.min(l, rr, t, b); dist = m; nx = m === l ? -1 : m === rr ? 1 : 0; ny = m === t ? -1 : m === b ? 1 : 0; }
            var k = dist >= bezel ? 0 : Math.pow(1 - Math.max(dist, 0) / bezel, 2);
            var i = (y * w + x) * 4;
            d[i] = Math.round(128 + nx * k * 127); d[i + 1] = Math.round(128 + ny * k * 127); d[i + 2] = 128; d[i + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
        return c.toDataURL('image/png');
    }
    function build(el) {
        var b = el.getBoundingClientRect(), w = Math.round(b.width), h = Math.round(b.height);
        if (w < 24 || h < 16 || w > 900 || h > 700) return;
        var rec = map.get(el);
        if (rec && rec.w === w && rec.h === h) return;
        var r = parseFloat(root.getComputedStyle(el).borderTopLeftRadius) || 12;
        var bezel = Math.max(8, Math.min(18, Math.round(Math.min(w, h) * 0.32))), max = Math.max(6, Math.min(14, Math.round(bezel * 0.8)));
        var id = rec ? rec.id : 'nr-lgf-' + (++n);
        var f = doc.getElementById(id);
        if (!f) { f = doc.createElementNS('http://www.w3.org/2000/svg', 'filter'); f.setAttribute('id', id); host().appendChild(f); }
        f.setAttribute('x', '0'); f.setAttribute('y', '0'); f.setAttribute('width', String(w)); f.setAttribute('height', String(h)); f.setAttribute('filterUnits', 'userSpaceOnUse');
        f.setAttribute('color-interpolation-filters', 'sRGB');
        f.innerHTML = '<feImage href="' + makeMap(w, h, r, bezel, max) + '" x="0" y="0" width="' + w + '" height="' + h + '" result="m"/>'
            + '<feDisplacementMap in="SourceGraphic" in2="m" scale="' + (max * 2) + '" xChannelSelector="R" yChannelSelector="G"/>';
        map.set(el, { id: id, w: w, h: h });
        el.style.setProperty('--lg-bf', 'url(#' + id + ') blur(var(--lg-blur, 10px)) saturate(1.7)');
    }
    var ro = new root.ResizeObserver(function (list) {
        list.forEach(function (e) { var el = e.target; clearTimeout(timers.get(el)); timers.set(el, setTimeout(function () { build(el); }, 120)); });
    });
    function scan() { doc.querySelectorAll(SEL).forEach(function (el) { if (!el.__nrLg) { el.__nrLg = true; ro.observe(el); } }); }
    scan();
    new root.MutationObserver(function () { scan(); }).observe(doc.body || doc.documentElement, { childList: true, subtree: true });
    root.NrGlass = { set: function (on) { try { root.localStorage.setItem('nr_lg', on ? '1' : '0'); } catch (e) { /* без памяти */ } root.location.reload(); } };
})(window);

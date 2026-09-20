/**
 * Лёгкие вау-эффекты для NR Space.
 * Идеи с GitHub (идеи, не копипаст исходников):
 *   barvian/number-flow — цифры перекатываются как одометр
 *   inorganik/countUp.js — easing при смене KPI
 *   catdad/canvas-confetti — короткий взрыв на победе
 *   formkit/auto-animate + View Transitions — вкладки не прыгают
 *   vanilla-tilt / spotlight-card — блик за курсором на карточках
 * Без React, без GSAP, без частиц на весь экран. prefers-reduced-motion выключает всё.
 */
(function (root) {
    function reduced() {
        try {
            return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
        } catch (_) {
            return false;
        }
    }

    function digitsOf(s) {
        return String(s || '').replace(/\D/g, '');
    }

    function parseLoose(s) {
        const n = parseFloat(String(s || '').replace(/\s/g, '').replace(',', '.').replace(/[^\d.\-−]/g, '').replace('−', '-'));
        return Number.isFinite(n) ? n : null;
    }

    function raf(fn) {
        if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(fn);
        return setTimeout(fn, 16);
    }

    function tickSpan(span, prevText, nextText) {
        if (!span || nextText == null) return;
        const next = String(nextText);
        if (reduced() || !next || next === '—') {
            span.textContent = next;
            return;
        }
        const prev = String(prevText || '');
        if (prev === next) {
            span.textContent = next;
            return;
        }
        if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
            span.textContent = next;
            return;
        }
        const fromN = parseLoose(prev);
        const toN = parseLoose(next);
        span.setAttribute('data-nr-dir', fromN != null && toN != null ? (toN > fromN ? 'up' : toN < fromN ? 'down' : '') : '');
        const chars = next.split('');
        const prevChars = prev.split('');
        span.textContent = '';
        chars.forEach((ch, i) => {
            if (!/\d/.test(ch)) {
                const sep = document.createElement('span');
                sep.className = 'nr-wow-sep';
                sep.textContent = ch;
                span.appendChild(sep);
                return;
            }
            const col = document.createElement('span');
            col.className = 'nr-wow-col';
            const strip = document.createElement('span');
            strip.className = 'nr-wow-strip';
            for (let d = 0; d <= 9; d++) {
                const cell = document.createElement('span');
                cell.textContent = String(d);
                strip.appendChild(cell);
            }
            col.appendChild(strip);
            span.appendChild(col);
            const start = /\d/.test(prevChars[i] || '') ? Number(prevChars[i]) : 0;
            const end = Number(ch);
            strip.style.transform = 'translateY(' + (-start * 10) + '%)';
            raf(function () {
                raf(function () {
                    strip.style.transform = 'translateY(' + (-end * 10) + '%)';
                });
            });
        });
    }

    function tickHost(el, prevText, nextText) {
        if (!el) return;
        const span = el.querySelector ? el.querySelector('.nr-num') : null;
        if (span) tickSpan(span, prevText, nextText);
        else tickText(el, nextText);
    }

    function tickText(el, nextText) {
        if (!el) return;
        const next = nextText == null ? '' : String(nextText);
        if (reduced() || !next || next === '—') {
            el.textContent = next;
            el._nrWowPrev = next;
            return;
        }
        const prev = el._nrWowPrev != null ? el._nrWowPrev : String(el.textContent || '');
        el._nrWowPrev = next;
        if (prev === next) {
            if (!el.querySelector || !el.querySelector('.nr-wow-col')) el.textContent = next;
            return;
        }
        tickSpan(el, prev, next);
    }

    function pulse(el) {
        if (!el || reduced()) return;
        el.classList.remove('nr-wow-pulse');
        void el.offsetWidth;
        el.classList.add('nr-wow-pulse');
    }

    function burst(opts) {
        const o = opts || {};
        if (reduced() || typeof document === 'undefined') return;
        const canvas = document.createElement('canvas');
        canvas.className = 'nr-wow-burst';
        canvas.setAttribute('aria-hidden', 'true');
        const w = root.innerWidth || 800;
        const h = root.innerHeight || 600;
        canvas.width = w;
        canvas.height = h;
        document.body.appendChild(canvas);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            canvas.remove();
            return;
        }
        const cx = o.x != null ? o.x : w / 2;
        const cy = o.y != null ? o.y : h * 0.28;
        const colors = o.colors || ['#066FD1', '#16A34A', '#F59E0B', '#FFFFFF'];
        const n = Math.min(48, o.count || 36);
        const bits = [];
        for (let i = 0; i < n; i++) {
            const a = (Math.PI * 2 * i) / n + Math.random() * 0.4;
            const v = 4 + Math.random() * 7;
            bits.push({
                x: cx,
                y: cy,
                vx: Math.cos(a) * v,
                vy: Math.sin(a) * v - 3,
                g: 0.18,
                life: 1,
                c: colors[i % colors.length],
                s: 2 + Math.random() * 3,
            });
        }
        let frames = 0;
        function step() {
            frames += 1;
            ctx.clearRect(0, 0, w, h);
            let alive = 0;
            for (let i = 0; i < bits.length; i++) {
                const p = bits[i];
                p.vy += p.g;
                p.x += p.vx;
                p.y += p.vy;
                p.life -= 0.018;
                if (p.life <= 0) continue;
                alive += 1;
                ctx.globalAlpha = Math.max(0, p.life);
                ctx.fillStyle = p.c;
                ctx.fillRect(p.x, p.y, p.s, p.s * 0.7);
            }
            if (alive && frames < 90) requestAnimationFrame(step);
            else canvas.remove();
        }
        requestAnimationFrame(step);
    }

    function spotlight(root) {
        const box = root || (typeof document !== 'undefined' ? document : null);
        if (!box || reduced() || box.getAttribute('data-nr-wow-spot') === '1') return;
        box.setAttribute('data-nr-wow-spot', '1');
        const sel = '.kpi-hero-card, .metric-card, .widget-card, .abtest-card, .adv-kpi-tile, .agents-canvas-card, .glass, .cf-card-preview, .rnp-stock-donut, .rnp-stock-scheme-wrap, .ev-kpi, .dash-plan-card';
        box.addEventListener('pointermove', function (e) {
            const card = e.target && e.target.closest ? e.target.closest(sel) : null;
            if (!card || card.closest('.rnp-sheet-table')) return;
            const r = card.getBoundingClientRect();
            card.style.setProperty('--spot-x', (e.clientX - r.left) + 'px');
            card.style.setProperty('--spot-y', (e.clientY - r.top) + 'px');
            if (!card.querySelector(':scope > .nr-wow-spot')) {
                const spot = document.createElement('span');
                spot.className = 'nr-wow-spot';
                spot.setAttribute('aria-hidden', 'true');
                card.insertBefore(spot, card.firstChild);
            }
        }, { passive: true });
    }

    function withView(fn) {
        if (typeof fn !== 'function') return;
        if (reduced() || typeof document === 'undefined' || typeof document.startViewTransition !== 'function') {
            fn();
            return;
        }
        try {
            document.startViewTransition(fn);
        } catch (_) {
            fn();
        }
    }

    const NrWow = {
        reduced: reduced,
        parseLoose: parseLoose,
        digitsOf: digitsOf,
        tickSpan: tickSpan,
        tickHost: tickHost,
        tickText: tickText,
        pulse: pulse,
        burst: burst,
        spotlight: spotlight,
        withView: withView,
    };
    root.NrWow = NrWow;
    if (typeof module !== 'undefined' && module.exports) module.exports = NrWow;
})(typeof window !== 'undefined' ? window : globalThis);

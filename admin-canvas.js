/* Админский холст NR Space («карта системы»): бесконечная площадь, как Obsidian / Miro.
 * Открывается из оранжевой плашки «Space» у логотипа, только для супер-админа (база всё равно отдаст данные только ему).
 * Узлы: функции, cron, таблицы, функции базы, секреты (имена), сервисы, боты, агенты, клиенты, кабинеты, заметки.
 * Ничего в системе не удаляет: пометка «К удалению» это только отметка для решения владельца.
 * Подключение: NRCanvas.init({ supabase, isSuperAdmin: () => boolean }). */
(function () {
    'use strict';

    var SIZE = {
        function: [230, 62], cron: [220, 54], table: [220, 54], sqlfn: [220, 54], secret: [200, 46], service: [200, 54],
        bot: [220, 56], agent: [220, 64], site: [260, 72], client: [240, 64], cabinet: [220, 56], note: [200, 80],
    };
    var KIND_LABEL = {
        function: 'Функция', cron: 'Расписание', table: 'Таблица', sqlfn: 'Функция базы', secret: 'Секрет', service: 'Сервис',
        bot: 'Бот', agent: 'Агент', site: 'Сайт', client: 'Клиент', cabinet: 'Кабинет', note: 'Заметка',
    };
    var KIND_COLOR = {
        function: '#3b82f6', cron: '#f97316', table: '#10b981', sqlfn: '#14b8a6', secret: '#a855f7', service: '#ec4899',
        bot: '#06b6d4', agent: '#f59e0b', site: '#64748b', client: '#8b5cf6', cabinet: '#6366f1', note: '#eab308',
    };
    var STATUS_LABEL = { ok: 'работает', warn: 'есть замечания', bad: 'сбой', unused: 'не используется', unknown: 'нет данных' };
    var DISTRICT = {
        ads: 'Реклама и ставки', reviews: 'Отзывы и Акылай', rnp: 'РНП, продажи и выгрузки WB', ab: 'А/Б тесты', content: 'Контент-завод',
        warehouse: 'Склад и отчёты команды', telegram: 'Telegram и боты', access: 'Клиенты, доступ и тарифы',
        core: 'Ядро и общее', other: 'Прочее', secrets: 'Секреты (только имена)', services: 'Внешние сервисы', agents: 'Агенты',
        site: 'Сайт', clients: 'Клиенты и кабинеты',
    };
    var EDGE_LABEL = {
        schedules: 'запускает по расписанию', calls: 'вызывает', uses: 'использует', reads: 'читает и пишет', fk: 'связана ключом',
        webhook: 'принимает вызовы от', runs: 'выполняет', trigger: 'срабатывает при записи', link: 'связь', owns: 'владеет',
    };
    var EDGE_COLOR = {
        schedules: '#f97316', calls: '#3b82f6', uses: '#94a3b8', reads: '#10b981', fk: '#94a3b8', webhook: '#a855f7',
        runs: '#14b8a6', trigger: '#ec4899', link: '#eab308', owns: '#8b5cf6',
    };
    var META_LABEL = {
        tables: 'Таблицы', rpcs: 'Функции базы', secrets: 'Секреты', calls: 'Вызывает функции', calledBy: 'Кто вызывает', crons: 'Расписание',
        integrations: 'Внешние сервисы', buckets: 'Хранилища файлов', version: 'Версия', files: 'Файлов в коде', inRepo: 'Исходники в репозитории',
        deployed: 'Запущена в Supabase', updatedAt: 'Обновлена', verifyJwt: 'Проверяет вход', rows: 'Строк', bytes: 'Размер, байт', rls: 'Защита RLS',
        policies: 'Правил доступа', writes: 'Записей за всё время', cols: 'Колонок', schedule: 'Расписание', active: 'Включено', lastRun: 'Последний запуск',
        lastStatus: 'Итог', lastMessage: 'Сообщение', command: 'Команда', cabinets: 'Кабинетов', nr_managed: 'Ведёт команда NR', adv_enabled: 'Реклама включена',
        has_token: 'Токен WB есть', created_at: 'Создан', hardcoded: 'Зашито в коде', username: 'Логин', enabled: 'Включён', usedBy: 'Кто использует',
        missing: 'Нет в Supabase', target: 'Запускает', readBy: 'Читают', writtenBy: 'Пишут',
    };
    var STORE = 'nr_canvas_view_v1', OPEN_KEY = 'nr_canvas_open';
    var MIN_K = 0.06, MAX_K = 2.2;

    var sb = null, isSuper = function () { return false; };
    var root = null, world = null, svg = null, edgeLayer = null, nodeLayer = null, districtLayer = null, panel = null, mini = null, miniCtx = null;
    var nodes = [], edges = [], byId = new Map(), byRef = new Map(), adj = new Map();
    var nodeEls = new Map(), edgeEls = new Map();
    var view = { x: 0, y: 0, k: 0.3 };
    var selected = null; // { type: 'node'|'edge', id }
    var filter = { kind: 'all', status: 'all', q: '' };
    var matches = [], matchIdx = -1;
    var loaded = false, loading = false, lastSync = null;
    var saveTimers = new Map();
    var showWeakAlways = false;

    /* ---------- утилиты ---------- */
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
    function svgEl(tag, attrs) {
        var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
        for (var k in attrs) el.setAttribute(k, attrs[k]);
        return el;
    }
    function size(n) { return SIZE[n.kind] || [220, 54]; }
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function ago(iso) {
        if (!iso) return '';
        var m = Math.round((Date.now() - Date.parse(iso)) / 60000);
        if (m < 1) return 'только что';
        if (m < 60) return m + ' мин назад';
        if (m < 1440) return Math.round(m / 60) + ' ч назад';
        return Math.round(m / 1440) + ' дн назад';
    }
    function fmtValue(key, v) {
        if (v === true) return 'да';
        if (v === false) return 'нет';
        if (v == null || v === '') return '—';
        if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}[T ]\d{2}:/.test(v)) {
            var d = new Date(v.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00').replace(/(\.\d{3})\d+/, '$1')); return isNaN(d) ? v : d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        }
        if (key === 'bytes' && typeof v === 'number') return (v / 1024 / 1024 >= 1 ? (v / 1024 / 1024).toFixed(1) + ' МБ' : Math.round(v / 1024) + ' КБ');
        if (typeof v === 'number') return v.toLocaleString('ru-RU');
        if (typeof v === 'object') return JSON.stringify(v);
        return String(v);
    }
    function toast(text, bad) {
        var t = h('div', { class: 'nrc-toast' + (bad ? ' bad' : ''), text: text });
        root.appendChild(t);
        setTimeout(function () { t.classList.add('out'); }, 2600);
        setTimeout(function () { t.remove(); }, 3200);
    }

    /* ---------- данные ---------- */
    async function fetchAll(table, cols) {
        var out = [], from = 0, step = 800;
        for (;;) {
            var r = await sb.from(table).select(cols).range(from, from + step - 1);
            if (r.error) throw r.error;
            out = out.concat(r.data || []);
            if (!r.data || r.data.length < step) break;
            from += step;
        }
        return out;
    }
    function index() {
        byId = new Map(); byRef = new Map(); adj = new Map();
        nodes.forEach(function (n) { byId.set(n.id, n); byRef.set(n.ref, n); adj.set(n.id, []); });
        edges = edges.filter(function (e) { return byId.has(e.source) && byId.has(e.target); });
        edges.forEach(function (e) {
            adj.get(e.source).push({ edge: e, other: e.target, dir: 'out' });
            adj.get(e.target).push({ edge: e, other: e.source, dir: 'in' });
        });
    }
    async function load(clientsRefresh) {
        if (loading) return;
        loading = true;
        setStatusLine('Загружаю карту…');
        try {
            var res = await Promise.all([
                fetchAll('admin_map_nodes', '*'), fetchAll('admin_map_edges', '*'),
                sb.from('admin_map_meta').select('value').eq('key', 'last_sync').maybeSingle(),
            ]);
            nodes = res[0]; edges = res[1]; lastSync = res[2].data && res[2].data.value ? res[2].data.value.at : null;
            if (!nodes.some(function (n) { return n.kind === 'client'; }) && !clientsRefresh) {
                loading = false;
                await refreshClients(true);
                return;
            }
            index(); render(); updateChips(); applyFilter(); setStatusLine('');
            loaded = true;
        } catch (e) {
            setStatusLine('Не удалось загрузить карту: ' + (e.message || e));
        }
        loading = false;
    }
    async function refreshClients(silent) {
        if (!silent) toast('Обновляю клиентов и кабинеты…');
        try {
            var r = await sb.functions.invoke('admin-canvas', { body: { action: 'refresh' } });
            if (r.error) throw r.error;
            if (!silent) toast('Клиентов: ' + (r.data && r.data.clients) + ', кабинетов: ' + (r.data && r.data.cabinets));
        } catch (e) { toast('Клиентов обновить не вышло: ' + (e.message || e), true); }
        loading = false;
        await load(true);
    }
    function setStatusLine(t) {
        var el = root && root.querySelector('.nrc-statusline');
        if (el) { el.textContent = t; el.style.display = t ? '' : 'none'; }
    }

    /* ---------- отрисовка ---------- */
    function nodeEl(n) {
        var s = size(n);
        var el = h('div', { class: 'nrc-node k-' + n.kind + ' s-' + n.status + (n.mark ? ' m-' + n.mark : '') + (n.hidden ? ' is-hidden' : ''), 'data-id': n.id });
        el.style.cssText = 'left:' + n.x + 'px;top:' + n.y + 'px;width:' + s[0] + 'px;height:' + s[1] + 'px;--kc:' + (KIND_COLOR[n.kind] || '#888');
        var tag = h('div', { class: 'nrc-node-kind' }, [h('span', { class: 'nrc-dot' }), KIND_LABEL[n.kind] || n.kind]);
        if (n.mark) tag.appendChild(h('span', { class: 'nrc-mark-tag', text: n.mark === 'delete' ? 'к удалению' : n.mark === 'review' ? 'проверить' : 'оставить' }));
        el.appendChild(tag);
        el.appendChild(h('div', { class: 'nrc-node-title', text: n.title }));
        if (n.subtitle && s[1] >= 54) el.appendChild(h('div', { class: 'nrc-node-sub', text: n.subtitle }));
        el.appendChild(h('div', { class: 'nrc-handle', title: 'Потяните к другому узлу, чтобы соединить' }));
        return el;
    }
    function anchors(a, b) {
        var sa = size(a), sb2 = size(b);
        var ac = { x: a.x + sa[0] / 2, y: a.y + sa[1] / 2 }, bc = { x: b.x + sb2[0] / 2, y: b.y + sb2[1] / 2 };
        var dx = bc.x - ac.x, dy = bc.y - ac.y;
        var p, q, horiz = Math.abs(dx) * 0.55 >= Math.abs(dy);
        if (horiz) {
            p = { x: dx >= 0 ? a.x + sa[0] : a.x, y: ac.y, dx: dx >= 0 ? 1 : -1, dy: 0 };
            q = { x: dx >= 0 ? b.x : b.x + sb2[0], y: bc.y, dx: dx >= 0 ? -1 : 1, dy: 0 };
        } else {
            p = { x: ac.x, y: dy >= 0 ? a.y + sa[1] : a.y, dx: 0, dy: dy >= 0 ? 1 : -1 };
            q = { x: bc.x, y: dy >= 0 ? b.y : b.y + sb2[1], dx: 0, dy: dy >= 0 ? -1 : 1 };
        }
        return [p, q];
    }
    function pathD(a, b) {
        var pq = anchors(a, b), p = pq[0], q = pq[1];
        var d = Math.max(40, Math.min(240, Math.hypot(q.x - p.x, q.y - p.y) * 0.45));
        return 'M' + p.x + ' ' + p.y + ' C' + (p.x + p.dx * d) + ' ' + (p.y + p.dy * d) + ' ' + (q.x + q.dx * d) + ' ' + (q.y + q.dy * d) + ' ' + q.x + ' ' + q.y;
    }
    function edgeEl(e) {
        var a = byId.get(e.source), b = byId.get(e.target);
        var d = pathD(a, b);
        var g = svgEl('g', { class: 'nrc-edge e-' + e.kind + (e.weak ? ' weak' : '') + (e.auto ? '' : ' manual'), 'data-id': e.id });
        g.style.setProperty('--ec', EDGE_COLOR[e.kind] || '#94a3b8');
        g.appendChild(svgEl('path', { class: 'hit', d: d }));
        g.appendChild(svgEl('path', { class: 'line', d: d, 'marker-end': 'url(#nrc-arrow)' }));
        return g;
    }
    function updateEdgesOf(id) {
        (adj.get(id) || []).forEach(function (x) {
            var g = edgeEls.get(x.edge.id);
            if (!g) return;
            var d = pathD(byId.get(x.edge.source), byId.get(x.edge.target));
            g.querySelectorAll('path').forEach(function (p) { p.setAttribute('d', d); });
        });
        drawDistricts();
    }
    function render() {
        nodeLayer.textContent = ''; edgeLayer.textContent = ''; nodeEls = new Map(); edgeEls = new Map();
        edges.forEach(function (e) { var g = edgeEl(e); edgeEls.set(e.id, g); edgeLayer.appendChild(g); });
        nodes.forEach(function (n) { var el = nodeEl(n); nodeEls.set(n.id, el); nodeLayer.appendChild(el); });
        drawDistricts();
        drawMini();
        if (!restoreView()) fitAll();
        applyTransform();
        applySelection();
    }
    function drawDistricts() {
        var groups = {};
        nodes.forEach(function (n) {
            if (!n.district || n.hidden) return;
            var s = size(n), g = groups[n.district] || (groups[n.district] = { x1: 1e9, y1: 1e9, x2: -1e9, y2: -1e9, n: 0 });
            g.x1 = Math.min(g.x1, n.x); g.y1 = Math.min(g.y1, n.y); g.x2 = Math.max(g.x2, n.x + s[0]); g.y2 = Math.max(g.y2, n.y + s[1]); g.n++;
        });
        districtLayer.textContent = '';
        Object.keys(groups).forEach(function (k) {
            var g = groups[k], pad = 44;
            var el = h('div', { class: 'nrc-district' }, [h('div', { class: 'nrc-district-title' }, [DISTRICT[k] || k, h('span', { text: String(g.n) })])]);
            el.style.cssText = 'left:' + (g.x1 - pad) + 'px;top:' + (g.y1 - pad - 54) + 'px;width:' + (g.x2 - g.x1 + pad * 2) + 'px;height:' + (g.y2 - g.y1 + pad * 2 + 54) + 'px';
            districtLayer.appendChild(el);
        });
    }

    /* ---------- камера ---------- */
    function applyTransform() {
        world.style.transform = 'translate(' + view.x + 'px,' + view.y + 'px) scale(' + view.k + ')';
        root.style.setProperty('--k', view.k);
        root.classList.toggle('lod-far', view.k < 0.22);
        root.classList.toggle('lod-mid', view.k >= 0.22 && view.k < 0.5);
        root.querySelector('.nrc-zoom-val').textContent = Math.round(view.k * 100) + '%';
        drawMini();
        try { localStorage.setItem(STORE, JSON.stringify(view)); } catch (e) { /* без хранилища тоже работает */ }
    }
    function restoreView() {
        try {
            var v = JSON.parse(localStorage.getItem(STORE) || 'null');
            if (v && isFinite(v.x) && isFinite(v.y) && isFinite(v.k)) { view = v; return true; }
        } catch (e) { /* нет сохранённого вида */ }
        return false;
    }
    function bounds(list) {
        var b = { x1: 1e9, y1: 1e9, x2: -1e9, y2: -1e9 };
        list.forEach(function (n) {
            var s = size(n);
            b.x1 = Math.min(b.x1, n.x); b.y1 = Math.min(b.y1, n.y); b.x2 = Math.max(b.x2, n.x + s[0]); b.y2 = Math.max(b.y2, n.y + s[1]);
        });
        return b;
    }
    function fitTo(list) {
        if (!list.length) return;
        var b = bounds(list), W = root.clientWidth, H = root.clientHeight, pad = 90;
        var k = clamp(Math.min((W - pad * 2) / (b.x2 - b.x1 || 1), (H - pad * 2 - 40) / (b.y2 - b.y1 || 1)), MIN_K, 1);
        if (W < 760 && k < 0.16) { k = 0.16; view = { k: k, x: 12 - b.x1 * k, y: 170 - b.y1 * k }; }
        else view = { k: k, x: (W - (b.x2 - b.x1) * k) / 2 - b.x1 * k, y: (H - (b.y2 - b.y1) * k) / 2 - b.y1 * k + 30 };
        applyTransform();
    }
    function fitAll() { fitTo(nodes.filter(function (n) { return !n.hidden; })); }
    function centerOn(n, k) {
        var s = size(n), W = root.clientWidth, H = root.clientHeight;
        k = k || Math.max(view.k, 0.7);
        var panelW = window.innerWidth > 760 && selected ? 180 : 0;
        view = { k: k, x: (W - panelW) / 2 - (n.x + s[0] / 2) * k, y: H / 2 - (n.y + s[1] / 2) * k };
        world.classList.add('glide');
        applyTransform();
        setTimeout(function () { world.classList.remove('glide'); }, 420);
    }
    function zoomAt(cx, cy, factor) {
        var k = clamp(view.k * factor, MIN_K, MAX_K), f = k / view.k;
        view.x = cx - (cx - view.x) * f; view.y = cy - (cy - view.y) * f; view.k = k;
        applyTransform();
    }
    function toWorld(cx, cy) { var r = root.getBoundingClientRect(); return { x: (cx - r.left - view.x) / view.k, y: (cy - r.top - view.y) / view.k }; }

    /* ---------- мини-карта ---------- */
    function drawMini() {
        if (!miniCtx || !nodes.length) return;
        var w = mini.width, hh = mini.height, b = bounds(nodes.filter(function (n) { return !n.hidden; }));
        var sc = Math.min(w / (b.x2 - b.x1), hh / (b.y2 - b.y1)), ox = (w - (b.x2 - b.x1) * sc) / 2, oy = (hh - (b.y2 - b.y1) * sc) / 2;
        mini._t = { sc: sc, ox: ox - b.x1 * sc, oy: oy - b.y1 * sc };
        miniCtx.clearRect(0, 0, w, hh);
        nodes.forEach(function (n) {
            if (n.hidden) return;
            var s = size(n);
            miniCtx.fillStyle = n.status === 'bad' ? '#ef4444' : n.status === 'unused' ? '#9ca3af' : n.status === 'warn' ? '#f59e0b' : (KIND_COLOR[n.kind] || '#888');
            miniCtx.globalAlpha = n.status === 'unused' ? 0.6 : 0.85;
            miniCtx.fillRect(n.x * sc + mini._t.ox, n.y * sc + mini._t.oy, Math.max(2, s[0] * sc), Math.max(1.5, s[1] * sc));
        });
        miniCtx.globalAlpha = 1;
        miniCtx.strokeStyle = '#f97316'; miniCtx.lineWidth = 1.5;
        var vx = -view.x / view.k, vy = -view.y / view.k;
        miniCtx.strokeRect(vx * sc + mini._t.ox, vy * sc + mini._t.oy, root.clientWidth / view.k * sc, root.clientHeight / view.k * sc);
    }

    /* ---------- выбор и фокус ---------- */
    function select(sel) {
        selected = sel;
        applySelection();
        renderPanel();
    }
    function applySelection() {
        var focus = null, focusEdges = null;
        if (selected && selected.type === 'node') {
            focus = new Set([selected.id]); focusEdges = new Set();
            (adj.get(selected.id) || []).forEach(function (x) { focus.add(x.other); focusEdges.add(x.edge.id); });
        } else if (selected && selected.type === 'edge') {
            var e = edges.find(function (x) { return x.id === selected.id; });
            if (e) { focus = new Set([e.source, e.target]); focusEdges = new Set([e.id]); }
        }
        root.classList.toggle('has-focus', !!focus);
        nodeEls.forEach(function (el, id) {
            el.classList.toggle('sel', !!selected && selected.type === 'node' && selected.id === id);
            el.classList.toggle('near', !!focus && focus.has(id));
        });
        edgeEls.forEach(function (g, id) {
            g.classList.toggle('hot', !!focusEdges && focusEdges.has(id));
            g.classList.toggle('sel', !!selected && selected.type === 'edge' && selected.id === id);
        });
    }

    /* ---------- фильтры ---------- */
    function isGarbage(n) { return n.status === 'unused' || n.mark === 'delete'; }
    function matchesFilter(n) {
        if (n.hidden && filter.status !== 'hidden') return false;
        var f = filter.status;
        if (f === 'garbage' && !isGarbage(n)) return false;
        if (f === 'bad' && n.status !== 'bad' && n.status !== 'warn') return false;
        if (f === 'norepo' && !(n.kind === 'function' && n.meta && n.meta.inRepo === false)) return false;
        if (f === 'marked' && !n.mark) return false;
        if (f === 'hidden' && !n.hidden) return false;
        if (filter.kind !== 'all' && n.kind !== filter.kind) return false;
        if (filter.q) {
            var q = filter.q.toLowerCase();
            if ((n.title + ' ' + (n.subtitle || '') + ' ' + n.ref).toLowerCase().indexOf(q) < 0) return false;
        }
        return true;
    }
    function applyFilter() {
        var active = filter.status !== 'all' || filter.kind !== 'all' || !!filter.q;
        root.classList.toggle('filtering', active);
        matches = [];
        nodes.forEach(function (n) {
            var ok = matchesFilter(n), el = nodeEls.get(n.id);
            if (!el) return;
            el.classList.toggle('match', active && ok);
            el.classList.toggle('nomatch', active && !ok);
            el.classList.toggle('is-hidden', n.hidden && filter.status !== 'hidden');
            if (active && ok) matches.push(n);
        });
        matches.sort(function (a, b) { return a.y - b.y || a.x - b.x; });
        matchIdx = -1;
        var c = root.querySelector('.nrc-match-count');
        c.textContent = active ? (matches.length ? matches.length + ' найдено' : 'ничего нет') : '';
        root.querySelector('.nrc-match-nav').style.display = active && matches.length ? '' : 'none';
    }
    function stepMatch(dir) {
        if (!matches.length) return;
        matchIdx = (matchIdx + dir + matches.length) % matches.length;
        var n = matches[matchIdx];
        select({ type: 'node', id: n.id });
        centerOn(n, Math.max(view.k, 0.6));
        root.querySelector('.nrc-match-count').textContent = (matchIdx + 1) + ' из ' + matches.length;
    }
    function updateChips() {
        var cnt = {
            garbage: nodes.filter(isGarbage).length,
            bad: nodes.filter(function (n) { return n.status === 'bad' || n.status === 'warn'; }).length,
            norepo: nodes.filter(function (n) { return n.kind === 'function' && n.meta && n.meta.inRepo === false; }).length,
            marked: nodes.filter(function (n) { return !!n.mark; }).length,
            hidden: nodes.filter(function (n) { return n.hidden; }).length,
        };
        root.querySelectorAll('.nrc-chip[data-status]').forEach(function (c) {
            var k = c.getAttribute('data-status'), b = c.querySelector('b');
            if (b) b.textContent = cnt[k] != null ? cnt[k] : '';
            c.classList.toggle('on', filter.status === k);
        });
        var meta = root.querySelector('.nrc-island-sub');
        meta.textContent = nodes.length + ' узлов · ' + edges.length + ' связей' + (lastSync ? ' · оцифровано ' + ago(lastSync) : '');
    }

    /* ---------- запись в базу ---------- */
    function saveNode(n, fields, quiet) {
        Object.keys(fields).forEach(function (k) { n[k] = fields[k]; });
        return sb.from('admin_map_nodes').update(fields).eq('id', n.id).then(function (r) {
            if (r.error) { toast('Не сохранилось: ' + r.error.message, true); return false; }
            return true;
        });
    }
    function savePosition(n) {
        clearTimeout(saveTimers.get(n.id));
        saveTimers.set(n.id, setTimeout(function () {
            sb.from('admin_map_nodes').update({ x: Math.round(n.x), y: Math.round(n.y) }).eq('id', n.id).then(function (r) {
                if (r.error) toast('Положение не сохранилось: ' + r.error.message, true);
            });
        }, 250));
    }
    async function addEdge(a, b) {
        if (a.id === b.id) return;
        if (edges.some(function (e) { return (e.source === a.id && e.target === b.id) || (e.source === b.id && e.target === a.id); })) {
            toast('Эти узлы уже соединены'); return;
        }
        var r = await sb.from('admin_map_edges').insert({ source: a.id, target: b.id, kind: 'link', label: '', auto: false, weak: false }).select().single();
        if (r.error) { toast('Связь не создалась: ' + r.error.message, true); return; }
        edges.push(r.data); index();
        var g = edgeEl(r.data); edgeEls.set(r.data.id, g); edgeLayer.appendChild(g);
        updateChips(); select({ type: 'edge', id: r.data.id });
    }
    async function deleteEdge(id) {
        var r = await sb.from('admin_map_edges').delete().eq('id', id);
        if (r.error) { toast('Не удалилось: ' + r.error.message, true); return; }
        edges = edges.filter(function (e) { return e.id !== id; }); index();
        var g = edgeEls.get(id); if (g) g.remove(); edgeEls.delete(id);
        select(null); updateChips();
    }
    async function addNote(pt) {
        var ref = 'note:' + (window.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
        var r = await sb.from('admin_map_nodes').insert({ ref: ref, kind: 'note', title: 'Новая заметка', subtitle: '', district: null, status: 'ok', x: Math.round(pt.x - 100), y: Math.round(pt.y - 40), auto: false }).select().single();
        if (r.error) { toast('Заметка не создалась: ' + r.error.message, true); return; }
        nodes.push(r.data); index();
        var el = nodeEl(r.data); nodeEls.set(r.data.id, el); nodeLayer.appendChild(el);
        select({ type: 'node', id: r.data.id });
        updateChips();
        setTimeout(function () { var i = panel.querySelector('input.nrc-title-input'); if (i) { i.focus({ preventScroll: true }); i.select(); } }, 30);
    }
    async function deleteNote(n) {
        if (n.auto) return;
        if (!window.confirm('Удалить заметку «' + n.title + '» с карты? Системы это не касается.')) return;
        var r = await sb.from('admin_map_nodes').delete().eq('id', n.id);
        if (r.error) { toast('Не удалилось: ' + r.error.message, true); return; }
        nodes = nodes.filter(function (x) { return x.id !== n.id; });
        edges = edges.filter(function (e) { return e.source !== n.id && e.target !== n.id; });
        index(); render(); select(null); updateChips(); applyFilter();
    }
    function patchNodeEl(n) {
        var old = nodeEls.get(n.id);
        if (!old) return;
        var el = nodeEl(n);
        old.replaceWith(el); nodeEls.set(n.id, el);
        applySelection(); applyFilter();
    }

    /* ---------- панель ---------- */
    function chipList(items, onPick) {
        var wrap = h('div', { class: 'nrc-chips' });
        items.slice(0, 80).forEach(function (t) {
            var target = onPick ? onPick(t) : null;
            wrap.appendChild(h('span', { class: 'nrc-tagchip' + (target ? ' link' : ''), text: String(t), onclick: target ? function () { jumpTo(target); } : null }));
        });
        if (items.length > 80) wrap.appendChild(h('span', { class: 'nrc-tagchip', text: '… ещё ' + (items.length - 80) }));
        return wrap;
    }
    function findByTitle(kinds, title) {
        for (var i = 0; i < nodes.length; i++) if (kinds.indexOf(nodes[i].kind) >= 0 && (nodes[i].title === title || nodes[i].title === title + '()')) return nodes[i];
        return null;
    }
    function jumpTo(n) { select({ type: 'node', id: n.id }); centerOn(n, Math.max(view.k, 0.7)); }
    function renderPanel() {
        panel.textContent = '';
        panel.classList.toggle('open', !!selected);
        if (!selected) return;
        panel.appendChild(h('button', { class: 'nrc-panel-x', title: 'Закрыть', onclick: function () { select(null); } }, ['×']));
        if (selected.type === 'edge') return renderEdgePanel();
        var n = byId.get(selected.id);
        if (!n) return;
        var head = h('div', { class: 'nrc-panel-head' }, [
            h('div', { class: 'nrc-panel-kind', style: '--kc:' + (KIND_COLOR[n.kind] || '#888') }, [h('span', { class: 'nrc-dot' }), KIND_LABEL[n.kind] || n.kind]),
        ]);
        if (n.kind === 'note') {
            var inp = h('input', { class: 'nrc-title-input', value: n.title, maxlength: 120 });
            inp.addEventListener('change', function () { saveNode(n, { title: inp.value.trim() || 'Заметка' }).then(function () { patchNodeEl(n); }); });
            head.appendChild(inp);
            var ta = h('textarea', { class: 'nrc-note-text', rows: 5, placeholder: 'Что тут важно помнить…' });
            ta.value = n.subtitle || '';
            ta.addEventListener('change', function () { saveNode(n, { subtitle: ta.value }).then(function () { patchNodeEl(n); }); });
            head.appendChild(ta);
        } else {
            head.appendChild(h('div', { class: 'nrc-panel-title', text: n.title }));
            if (n.subtitle) head.appendChild(h('div', { class: 'nrc-panel-sub', text: n.subtitle }));
            head.appendChild(h('div', { class: 's-' + n.status + ' nrc-status', text: STATUS_LABEL[n.status] || n.status }));
        }
        panel.appendChild(head);

        if (n.reasons && n.reasons.length) {
            var rs = h('div', { class: 'nrc-reasons' });
            n.reasons.forEach(function (t) { rs.appendChild(h('div', { class: 'nrc-reason s-' + n.status, text: t })); });
            panel.appendChild(rs);
        }

        // Пометки владельца: только флаги, ничего не удаляют.
        var marks = h('div', { class: 'nrc-marks' });
        [['keep', 'Оставить'], ['review', 'Проверить'], ['delete', 'К удалению']].forEach(function (m) {
            marks.appendChild(h('button', {
                class: 'nrc-mbtn m-' + m[0] + (n.mark === m[0] ? ' on' : ''), text: m[1],
                onclick: function () { saveNode(n, { mark: n.mark === m[0] ? null : m[0] }).then(function () { patchNodeEl(n); renderPanel(); updateChips(); }); },
            }));
        });
        panel.appendChild(h('div', { class: 'nrc-sec-title', text: 'Моё решение' }));
        panel.appendChild(marks);
        if (n.mark) {
            var note = h('input', { class: 'nrc-input', placeholder: 'Почему (по желанию)', value: n.mark_note || '', maxlength: 200 });
            note.addEventListener('change', function () { saveNode(n, { mark_note: note.value }); });
            panel.appendChild(note);
        }
        if (n.mark === 'delete') panel.appendChild(h('div', { class: 'nrc-hint', text: 'Это только пометка. Сама функция, таблица или задача останутся, пока вы отдельно не скажете удалить.' }));

        // подробности
        var meta = n.meta || {}, keys = Object.keys(META_LABEL).filter(function (k) { return meta[k] != null && !(Array.isArray(meta[k]) && !meta[k].length); });
        Object.keys(meta).forEach(function (k) { if (k !== 'human' && !META_LABEL[k] && keys.indexOf(k) < 0 && meta[k] != null && !(Array.isArray(meta[k]) && !meta[k].length)) keys.push(k); });
        if (keys.length) panel.appendChild(h('div', { class: 'nrc-sec-title', text: 'Что известно' }));
        keys.forEach(function (k) {
            var v = meta[k], row = h('div', { class: 'nrc-kv' }, [h('div', { class: 'nrc-k', text: META_LABEL[k] || k })]);
            if (Array.isArray(v)) {
                var tk = k === 'tables' ? ['table'] : k === 'secrets' || k === 'missing' ? ['secret'] : k === 'calls' ? ['function'] : k === 'rpcs' ? ['sqlfn'] : k === 'integrations' ? ['service'] : null;
                row.appendChild(chipList(v, tk ? function (t) { return findByTitle(tk, t); } : null));
            } else row.appendChild(h('div', { class: 'nrc-v', text: fmtValue(k, v) }));
            panel.appendChild(row);
        });

        // связи
        var links = adj.get(n.id) || [];
        if (links.length) {
            panel.appendChild(h('div', { class: 'nrc-sec-title', text: 'Связи (' + links.length + ')' }));
            var list = h('div', { class: 'nrc-links' });
            links.slice().sort(function (a, b) { return (a.edge.kind + a.dir).localeCompare(b.edge.kind + b.dir); }).forEach(function (x) {
                var o = byId.get(x.other);
                var verb = x.dir === 'out' ? (EDGE_LABEL[x.edge.kind] || x.edge.kind) : '← ' + (EDGE_LABEL[x.edge.kind] || x.edge.kind);
                list.appendChild(h('button', { class: 'nrc-link', onclick: function () { jumpTo(o); } }, [
                    h('span', { class: 'nrc-link-verb', text: verb }), h('span', { class: 'nrc-link-name', text: o.title }),
                ]));
            });
            panel.appendChild(list);
        }

        var foot = h('div', { class: 'nrc-panel-foot' });
        foot.appendChild(h('button', { class: 'nrc-linkbtn', text: n.hidden ? 'Вернуть на карту' : 'Скрыть с карты', onclick: function () {
            saveNode(n, { hidden: !n.hidden }).then(function () { patchNodeEl(n); drawDistricts(); drawMini(); select(null); updateChips(); });
        } }));
        if (!n.auto) foot.appendChild(h('button', { class: 'nrc-linkbtn danger', text: 'Удалить заметку', onclick: function () { deleteNote(n); } }));
        panel.appendChild(foot);
    }
    function renderEdgePanel() {
        var e = edges.find(function (x) { return x.id === selected.id; });
        if (!e) return;
        var a = byId.get(e.source), b = byId.get(e.target);
        panel.appendChild(h('div', { class: 'nrc-panel-head' }, [
            h('div', { class: 'nrc-panel-kind' }, ['Связь']),
            h('div', { class: 'nrc-panel-title', text: a.title + ' → ' + b.title }),
            h('div', { class: 'nrc-panel-sub', text: (EDGE_LABEL[e.kind] || e.kind) + (e.auto ? ' · найдена автоматически' : ' · проведена вами') }),
        ]));
        var lab = h('input', { class: 'nrc-input', placeholder: 'Подпись связи', value: e.label || '', maxlength: 80 });
        lab.addEventListener('change', function () {
            sb.from('admin_map_edges').update({ label: lab.value }).eq('id', e.id).then(function (r) { if (r.error) toast('Не сохранилось', true); else e.label = lab.value; });
        });
        panel.appendChild(lab);
        var foot = h('div', { class: 'nrc-panel-foot' });
        foot.appendChild(h('button', { class: 'nrc-linkbtn', text: 'К началу связи', onclick: function () { jumpTo(a); } }));
        foot.appendChild(h('button', { class: 'nrc-linkbtn', text: 'К концу связи', onclick: function () { jumpTo(b); } }));
        if (!e.auto) foot.appendChild(h('button', { class: 'nrc-linkbtn danger', text: 'Убрать связь', onclick: function () { deleteEdge(e.id); } }));
        else panel.appendChild(h('div', { class: 'nrc-hint', text: 'Автоматические связи пересоздаются при оцифровке: их можно посмотреть, а убрать только свою.' }));
        panel.appendChild(foot);
    }

    /* ---------- жесты ---------- */
    function bindGestures() {
        var pointers = new Map(), pan = null, drag = null, link = null, pinch = null, moved = false;

        root.addEventListener('wheel', function (ev) {
            if (ev.target.closest('.nrc-panel, .nrc-toolbar')) return;
            ev.preventDefault();
            if (ev.shiftKey) { view.x -= ev.deltaY; view.y -= ev.deltaX; applyTransform(); return; }
            var r = root.getBoundingClientRect();
            zoomAt(ev.clientX - r.left, ev.clientY - r.top, Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0016)));
        }, { passive: false });

        root.addEventListener('pointerdown', function (ev) {
            if (ev.target.closest('.nrc-panel, .nrc-toolbar, .nrc-island, .nrc-minimap, .nrc-zoom, .nrc-statusline')) return;
            pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
            moved = false;
            if (pointers.size === 2) {
                var p = Array.from(pointers.values());
                pinch = { d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y), k: view.k };
                pan = null; drag = null; return;
            }
            var handle = ev.target.closest('.nrc-handle');
            var nodeNode = ev.target.closest('.nrc-node');
            if (handle && nodeNode) {
                var src = byId.get(nodeNode.getAttribute('data-id'));
                var ln = svgEl('path', { class: 'nrc-temp-link' });
                edgeLayer.appendChild(ln);
                link = { src: src, el: ln };
                root.setPointerCapture(ev.pointerId); ev.preventDefault(); return;
            }
            if (nodeNode) {
                var n = byId.get(nodeNode.getAttribute('data-id'));
                drag = { n: n, sx: ev.clientX, sy: ev.clientY, ox: n.x, oy: n.y, el: nodeNode };
            } else {
                pan = { sx: ev.clientX, sy: ev.clientY, vx: view.x, vy: view.y, hitEdge: ev.target.closest('.nrc-edge') };
            }
            root.setPointerCapture(ev.pointerId);
        });
        root.addEventListener('pointermove', function (ev) {
            if (pointers.has(ev.pointerId)) pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
            if (pinch && pointers.size >= 2) {
                var p = Array.from(pointers.values()), d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
                var r = root.getBoundingClientRect(), cx = (p[0].x + p[1].x) / 2 - r.left, cy = (p[0].y + p[1].y) / 2 - r.top;
                zoomAt(cx, cy, clamp(pinch.k * d / pinch.d, MIN_K, MAX_K) / view.k);
                return;
            }
            if (link) {
                var pt = toWorld(ev.clientX, ev.clientY), s = size(link.src);
                link.el.setAttribute('d', 'M' + (link.src.x + s[0]) + ' ' + (link.src.y + s[1] / 2) + ' L' + pt.x + ' ' + pt.y);
                root.querySelectorAll('.nrc-node.link-target').forEach(function (e) { e.classList.remove('link-target'); });
                var t = document.elementFromPoint(ev.clientX, ev.clientY), tn = t && t.closest ? t.closest('.nrc-node') : null;
                if (tn && tn.getAttribute('data-id') !== link.src.id) tn.classList.add('link-target');
                return;
            }
            if (drag) {
                var dx = ev.clientX - drag.sx, dy = ev.clientY - drag.sy;
                if (!moved && Math.hypot(dx, dy) < 4) return;
                moved = true;
                drag.n.x = drag.ox + dx / view.k; drag.n.y = drag.oy + dy / view.k;
                drag.el.style.left = drag.n.x + 'px'; drag.el.style.top = drag.n.y + 'px';
                drag.el.classList.add('dragging');
                updateEdgesOf(drag.n.id);
                return;
            }
            if (pan) {
                var ddx = ev.clientX - pan.sx, ddy = ev.clientY - pan.sy;
                if (!moved && Math.hypot(ddx, ddy) < 3) return;
                moved = true;
                view.x = pan.vx + ddx; view.y = pan.vy + ddy;
                applyTransform();
            }
        });
        function end(ev) {
            pointers.delete(ev.pointerId);
            if (pointers.size < 2) pinch = null;
            if (link) {
                link.el.remove();
                root.querySelectorAll('.nrc-node.link-target').forEach(function (e) { e.classList.remove('link-target'); });
                var t = document.elementFromPoint(ev.clientX, ev.clientY), tn = t && t.closest ? t.closest('.nrc-node') : null;
                if (tn) addEdge(link.src, byId.get(tn.getAttribute('data-id')));
                link = null; return;
            }
            if (drag) {
                drag.el.classList.remove('dragging');
                if (moved) { savePosition(drag.n); drawDistricts(); drawMini(); }
                else select({ type: 'node', id: drag.n.id });
                drag = null; return;
            }
            if (pan) {
                if (!moved) {
                    var he = pan.hitEdge;
                    if (he) select({ type: 'edge', id: he.getAttribute('data-id') });
                    else if (selected) select(null);
                }
                pan = null;
            }
        }
        root.addEventListener('pointerup', end);
        root.addEventListener('pointercancel', end);
        root.addEventListener('dblclick', function (ev) {
            if (ev.target.closest('.nrc-panel, .nrc-toolbar, .nrc-island, .nrc-minimap, .nrc-zoom')) return;
            var under = document.elementFromPoint(ev.clientX, ev.clientY), un = under && under.closest ? under.closest('.nrc-node') : null;
            if (un) { var n = byId.get(un.getAttribute('data-id')); if (n) centerOn(n, Math.max(view.k, 1)); return; }
            addNote(toWorld(ev.clientX, ev.clientY));
        });
        mini.addEventListener('pointerdown', function (ev) {
            ev.stopPropagation();
            var r = mini.getBoundingClientRect(), t = mini._t; if (!t) return;
            var wx = ((ev.clientX - r.left) * (mini.width / r.width) - t.ox) / t.sc, wy = ((ev.clientY - r.top) * (mini.height / r.height) - t.oy) / t.sc;
            view.x = root.clientWidth / 2 - wx * view.k; view.y = root.clientHeight / 2 - wy * view.k;
            world.classList.add('glide'); applyTransform(); setTimeout(function () { world.classList.remove('glide'); }, 420);
        });
    }

    /* ---------- каркас ---------- */
    var CSS = [
        '.nrc-root{position:fixed;inset:0;z-index:150000;background:var(--bg,#f4f4f5);color:var(--text-primary,#111);font-family:var(--font-ui,system-ui,sans-serif);overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;display:none;--nrc-card:var(--surface-solid,#fff);--nrc-line:var(--border-strong,rgba(0,0,0,.12));--nrc-soft:var(--sel,#ededed)}',
        '.nrc-root.open{display:block;animation:nrc-in .28s ease}',
        '@keyframes nrc-in{from{opacity:0;transform:scale(1.015)}to{opacity:1;transform:none}}',
        '.nrc-root::before{content:"";position:absolute;inset:0;background-image:radial-gradient(circle,var(--nrc-line) 1px,transparent 1.4px);background-size:28px 28px;opacity:.7;pointer-events:none}',
        '.nrc-world{position:absolute;left:0;top:0;transform-origin:0 0}',
        '.nrc-world.glide{transition:transform .4s cubic-bezier(.2,.8,.2,1)}',
        '.nrc-svg{position:absolute;left:0;top:0;width:1px;height:1px;overflow:visible;pointer-events:none}',
        '.nrc-edge .line{fill:none;stroke:var(--ec);stroke-width:1.4px;vector-effect:non-scaling-stroke;opacity:.38;transition:opacity .15s}',
        '.nrc-edge .hit{fill:none;stroke:transparent;stroke-width:12px;vector-effect:non-scaling-stroke;pointer-events:stroke;cursor:pointer}',
        '.nrc-edge.e-fk .line{stroke-dasharray:5 5}',
        '.nrc-edge.manual .line{opacity:.9;stroke-width:2px}',
        '.nrc-edge.weak{display:none}',
        '.nrc-edge.weak.hot{display:inline}',
        '.nrc-edge.hot .line,.nrc-edge.sel .line{opacity:1;stroke-width:2.4px}',
        '.nrc-root.has-focus .nrc-edge:not(.hot) .line{opacity:.05}',
        '.nrc-root.lod-far .nrc-edge:not(.hot):not(.manual){display:none}',
        '.nrc-temp-link{fill:none;stroke:#f97316;stroke-width:2px;stroke-dasharray:6 5;vector-effect:non-scaling-stroke}',
        '.nrc-district{position:absolute;border-radius:36px;background:color-mix(in srgb,var(--nrc-soft) 55%,transparent);border:1.5px dashed var(--nrc-line);pointer-events:none}',
        '.nrc-district-title{position:absolute;left:34px;top:22px;max-width:calc(100% - 60px);overflow:hidden;text-overflow:ellipsis;font-size:34px;font-weight:700;letter-spacing:-.02em;color:var(--text-muted,#71717a);white-space:nowrap;display:flex;gap:14px;align-items:baseline}',
        '.nrc-district-title span{font-size:22px;font-weight:600;opacity:.6}',
        '.nrc-root.lod-far .nrc-district-title{font-size:78px}',
        '.nrc-node{position:absolute;box-sizing:border-box;background:var(--nrc-card);border:1.5px solid var(--nrc-line);border-radius:16px;padding:9px 12px 8px 14px;cursor:grab;overflow:visible;transition:opacity .15s,box-shadow .15s,border-color .15s;box-shadow:0 1px 2px rgba(0,0,0,.05)}',
        '.nrc-node::before{content:"";position:absolute;left:0;top:12px;bottom:12px;width:4px;border-radius:0 4px 4px 0;background:var(--kc)}',
        '.nrc-node:hover{box-shadow:0 8px 24px rgba(0,0,0,.12);border-color:var(--kc)}',
        '.nrc-node.sel{border-color:#f97316;box-shadow:0 0 0 calc(3px / var(--k,1)) rgba(249,115,22,.3),0 10px 28px rgba(0,0,0,.16);z-index:5}',
        '.nrc-node.dragging{cursor:grabbing;z-index:9;box-shadow:0 18px 40px rgba(0,0,0,.22)}',
        '.nrc-node.is-hidden{display:none}',
        '.nrc-node-kind{display:flex;align-items:center;gap:6px;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--kc);line-height:1}',
        '.nrc-dot{width:7px;height:7px;border-radius:50%;background:var(--kc);display:inline-block}',
        '.nrc-node-title{margin-top:5px;font-size:13.5px;font-weight:650;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
        '.nrc-node-sub{margin-top:3px;font-size:11px;color:var(--text-muted,#71717a);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
        '.nrc-node.k-note{background:#fef9c3;border-color:#eab308;color:#422006}',
        '.nrc-node.k-note .nrc-node-sub{white-space:normal;color:#713f12;max-height:34px}',
        '.nrc-node.s-ok .nrc-node-kind::after{content:"";margin-left:auto;width:7px;height:7px;border-radius:50%;background:#22c55e}',
        '.nrc-node.s-warn{border-color:#f59e0b}.nrc-node.s-warn .nrc-node-kind::after{content:"●";margin-left:auto;color:#f59e0b;font-size:10px}',
        '.nrc-node.s-bad{border-color:#ef4444;background:color-mix(in srgb,#ef4444 8%,var(--nrc-card))}.nrc-node.s-bad .nrc-node-kind::after{content:"сбой";margin-left:auto;color:#ef4444;font-size:10px}',
        '.nrc-node.s-unused{border-style:dashed;border-color:#9ca3af;background:repeating-linear-gradient(135deg,var(--nrc-card) 0 8px,color-mix(in srgb,#9ca3af 14%,var(--nrc-card)) 8px 16px)}',
        '.nrc-node.s-unused .nrc-node-title{color:var(--text-muted,#71717a)}',
        '.nrc-node.s-unused .nrc-node-kind::after{content:"мусор?";margin-left:auto;color:#6b7280;font-size:10px}',
        '.nrc-node.s-ok.k-note .nrc-node-kind::after{display:none}',
        '.nrc-mark-tag{margin-left:8px;padding:2px 6px;border-radius:999px;font-size:9px;background:#e5e7eb;color:#374151}',
        '.nrc-node.m-delete{outline:2px solid #ef4444;outline-offset:2px}.nrc-node.m-delete .nrc-mark-tag{background:#fee2e2;color:#b91c1c}',
        '.nrc-node.m-review .nrc-mark-tag{background:#fef3c7;color:#92400e}.nrc-node.m-keep .nrc-mark-tag{background:#dcfce7;color:#166534}',
        '.nrc-handle{position:absolute;right:-8px;top:50%;width:14px;height:14px;margin-top:-7px;border-radius:50%;background:#f97316;border:2px solid var(--nrc-card);opacity:0;transform:scale(calc(.6 / var(--k,1)));transition:opacity .15s;cursor:crosshair}',
        '.nrc-node:hover .nrc-handle,.nrc-node.sel .nrc-handle{opacity:1;transform:scale(calc(1 / var(--k,1)))}.nrc-root.lod-far .nrc-handle{display:none}',
        '.nrc-node.link-target{border-color:#f97316;box-shadow:0 0 0 4px rgba(249,115,22,.3)}',
        '.nrc-root.has-focus .nrc-node:not(.near){opacity:.18}',
        '.nrc-root.filtering .nrc-node.nomatch{opacity:.12}',
        '.nrc-root.filtering .nrc-node.match{box-shadow:0 0 0 calc(3px / var(--k,1)) rgba(249,115,22,.55)}',
        '.nrc-root.lod-far .nrc-node{border-radius:22px;padding:0}.nrc-root.lod-far .nrc-node>*{display:none}.nrc-root.lod-far .nrc-node{background:var(--kc);border-color:transparent}',
        '.nrc-root.lod-far .nrc-node.s-bad{background:#ef4444}.nrc-root.lod-far .nrc-node.s-unused{background:#9ca3af}.nrc-root.lod-far .nrc-node.s-warn{background:#f59e0b}',
        '.nrc-root.lod-far .nrc-node::before{display:none}',
        '.nrc-root.lod-mid .nrc-node-sub{display:none}',
        /* остров */
        '.nrc-island{position:absolute;left:50%;top:14px;transform:translateX(-50%);z-index:20;display:flex;align-items:center;gap:12px;padding:7px 10px 7px 14px;border-radius:999px;background:var(--nrc-card);border:1px solid var(--nrc-line);box-shadow:0 10px 34px rgba(0,0,0,.14);max-width:calc(100vw - 24px)}',
        '.nrc-island img{width:28px;height:28px;display:block}',
        '.nrc-pill{font-size:14px;font-weight:600;padding:5px 14px;border-radius:999px;border:1.5px solid #f97316;color:#f97316;background:transparent;cursor:pointer;transition:.18s;font-family:inherit}',
        '.nrc-pill:hover{background:#f97316;color:#fff;box-shadow:0 4px 16px rgba(249,115,22,.4)}',
        '.nrc-island-sep{width:1px;height:22px;background:var(--nrc-line)}',
        '.nrc-island-info{display:flex;flex-direction:column;line-height:1.15;min-width:0}.nrc-island-info b{font-size:12.5px}.nrc-island-sub{font-size:11px;color:var(--text-muted,#71717a);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
        '.nrc-ibtn{border:0;background:var(--nrc-soft);color:var(--text-primary,#111);border-radius:999px;height:30px;padding:0 12px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit}.nrc-ibtn:hover{background:var(--nrc-line)}',
        /* панель инструментов */
        '.nrc-toolbar{position:absolute;left:14px;top:14px;z-index:15;width:min(310px,calc(100vw - 28px));display:flex;flex-direction:column;gap:10px;margin-top:62px}',
        '.nrc-search{display:flex;align-items:center;gap:8px;background:var(--nrc-card);border:1px solid var(--nrc-line);border-radius:14px;padding:0 12px;height:40px;box-shadow:0 4px 16px rgba(0,0,0,.06)}',
        '.nrc-search input{flex:1;border:0;outline:0;background:transparent;color:inherit;font-size:14px;font-family:inherit;min-width:0}',
        '.nrc-chiprow{display:flex;flex-wrap:wrap;gap:6px}',
        '.nrc-chip{border:1px solid var(--nrc-line);background:var(--nrc-card);color:inherit;border-radius:999px;padding:5px 11px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;display:flex;gap:6px;align-items:center}',
        '.nrc-chip b{font-weight:700;color:var(--text-muted,#71717a)}',
        '.nrc-chip.on{background:#f97316;border-color:#f97316;color:#fff}.nrc-chip.on b{color:#fff}',
        '.nrc-kindrow{display:flex;flex-wrap:wrap;gap:5px}',
        '.nrc-kchip{border:1px solid var(--nrc-line);background:var(--nrc-card);border-radius:999px;padding:3px 9px 3px 7px;font-size:11px;cursor:pointer;display:flex;gap:5px;align-items:center;color:inherit;font-family:inherit;opacity:.85}',
        '.nrc-kchip i{width:8px;height:8px;border-radius:50%;background:var(--kc)}.nrc-kchip.on{opacity:1;border-color:var(--kc);box-shadow:0 0 0 2px color-mix(in srgb,var(--kc) 25%,transparent)}',
        '.nrc-match{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-muted,#71717a)}',
        '.nrc-root .nrc-toolbar .nrc-match-nav{display:none;gap:4px}.nrc-match-nav button{border:1px solid var(--nrc-line);background:var(--nrc-card);border-radius:8px;width:26px;height:26px;cursor:pointer;color:inherit}',
        '.nrc-help{font-size:11.5px;line-height:1.45;color:var(--text-muted,#71717a);padding:2px 4px}',
        /* зум и миникарта */
        '.nrc-zoom{position:absolute;right:14px;bottom:14px;z-index:15;display:flex;align-items:center;gap:6px;background:var(--nrc-card);border:1px solid var(--nrc-line);border-radius:14px;padding:4px;box-shadow:0 4px 16px rgba(0,0,0,.08)}',
        '.nrc-zoom button{border:0;background:transparent;width:32px;height:32px;border-radius:10px;font-size:17px;cursor:pointer;color:inherit;font-family:inherit}.nrc-zoom button:hover{background:var(--nrc-soft)}',
        '.nrc-zoom-val{font-size:11px;min-width:38px;text-align:center;color:var(--text-muted,#71717a)}',
        '.nrc-minimap{position:absolute;right:14px;bottom:62px;z-index:14;width:190px;height:130px;background:var(--nrc-card);border:1px solid var(--nrc-line);border-radius:14px;box-shadow:0 4px 16px rgba(0,0,0,.08);cursor:pointer}',
        '.nrc-statusline{position:absolute;left:50%;top:76px;transform:translateX(-50%);z-index:12;background:var(--nrc-card);border:1px solid var(--nrc-line);border-radius:999px;padding:6px 14px;font-size:12px}',
        /* панель сведений */
        '.nrc-panel{position:absolute;right:14px;top:14px;bottom:14px;width:min(360px,calc(100vw - 28px));z-index:16;background:var(--nrc-card);border:1px solid var(--nrc-line);border-radius:22px;box-shadow:0 18px 50px rgba(0,0,0,.18);padding:20px 18px;overflow:auto;transform:translateX(calc(100% + 30px));transition:transform .3s cubic-bezier(.2,.8,.2,1);user-select:text;-webkit-user-select:text}',
        '.nrc-panel.open{transform:none}',
        '.nrc-panel-x{position:absolute;right:12px;top:10px;border:0;background:var(--nrc-soft);width:30px;height:30px;border-radius:50%;font-size:18px;cursor:pointer;color:inherit}',
        '.nrc-panel-kind{display:flex;gap:7px;align-items:center;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--kc,var(--text-muted))}',
        '.nrc-panel-title{font-size:21px;font-weight:700;margin-top:6px;word-break:break-word;letter-spacing:-.01em;padding-right:28px}',
        '.nrc-panel-sub{font-size:13px;color:var(--text-muted,#71717a);margin-top:3px}',
        '.nrc-status{display:inline-block;margin-top:10px;padding:4px 11px;border-radius:999px;font-size:12px;font-weight:700}',
        '.nrc-status.s-ok{background:#dcfce7;color:#166534}.nrc-status.s-warn{background:#fef3c7;color:#92400e}.nrc-status.s-bad{background:#fee2e2;color:#b91c1c}.nrc-status.s-unused{background:#e5e7eb;color:#374151}.nrc-status.s-unknown{background:#e5e7eb;color:#374151}',
        '.nrc-reasons{margin-top:14px;display:flex;flex-direction:column;gap:7px}',
        '.nrc-reason{font-size:13px;line-height:1.4;padding:9px 12px;border-radius:12px;background:var(--nrc-soft)}',
        '.nrc-reason.s-bad{background:#fee2e2;color:#7f1d1d}.nrc-reason.s-warn{background:#fef3c7;color:#78350f}.nrc-reason.s-unused{background:#f3f4f6;color:#374151}',
        '.nrc-sec-title{font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--text-muted,#71717a);margin:20px 0 8px}',
        '.nrc-marks{display:flex;gap:6px}.nrc-mbtn{flex:1;border:1.5px solid var(--nrc-line);background:transparent;color:inherit;border-radius:12px;padding:8px 4px;font-size:12.5px;font-weight:600;cursor:pointer;font-family:inherit}',
        '.nrc-mbtn.m-keep.on{background:#dcfce7;border-color:#22c55e;color:#166534}.nrc-mbtn.m-review.on{background:#fef3c7;border-color:#f59e0b;color:#92400e}.nrc-mbtn.m-delete.on{background:#fee2e2;border-color:#ef4444;color:#b91c1c}',
        '.nrc-input,.nrc-title-input,.nrc-note-text{width:100%;box-sizing:border-box;margin-top:8px;border:1.5px solid var(--nrc-line);background:transparent;border-radius:12px;padding:9px 12px;font-size:13.5px;color:inherit;font-family:inherit;outline:0}',
        '.nrc-title-input{font-size:19px;font-weight:700;margin-top:6px}.nrc-note-text{resize:vertical;min-height:90px}',
        '.nrc-input:focus,.nrc-title-input:focus,.nrc-note-text:focus{border-color:#f97316}',
        '.nrc-hint{font-size:12px;color:var(--text-muted,#71717a);margin-top:8px;line-height:1.4}',
        '.nrc-kv{margin-bottom:10px}.nrc-k{font-size:12px;color:var(--text-muted,#71717a);margin-bottom:4px}.nrc-v{font-size:13.5px;word-break:break-word}',
        '.nrc-chips{display:flex;flex-wrap:wrap;gap:5px}.nrc-tagchip{font-size:12px;padding:3px 9px;border-radius:999px;background:var(--nrc-soft);word-break:break-all}',
        '.nrc-tagchip.link{cursor:pointer;background:color-mix(in srgb,#3b82f6 14%,var(--nrc-soft))}.nrc-tagchip.link:hover{background:#3b82f6;color:#fff}',
        '.nrc-links{display:flex;flex-direction:column;gap:4px}',
        '.nrc-link{display:flex;flex-direction:column;align-items:flex-start;text-align:left;border:0;background:var(--nrc-soft);border-radius:12px;padding:7px 12px;cursor:pointer;color:inherit;font-family:inherit}.nrc-link:hover{background:var(--nrc-line)}',
        '.nrc-link-verb{font-size:11px;color:var(--text-muted,#71717a)}.nrc-link-name{font-size:13.5px;font-weight:600}',
        '.nrc-panel-foot{margin-top:22px;display:flex;flex-wrap:wrap;gap:8px}',
        '.nrc-linkbtn{border:0;background:transparent;color:var(--text-muted,#71717a);font-size:12.5px;cursor:pointer;padding:6px 4px;text-decoration:underline;font-family:inherit}.nrc-linkbtn.danger{color:#dc2626}',
        '.nrc-toast{position:absolute;left:50%;bottom:26px;transform:translateX(-50%);background:#111;color:#fff;padding:10px 18px;border-radius:999px;font-size:13px;z-index:40;transition:opacity .5s}.nrc-toast.bad{background:#b91c1c}.nrc-toast.out{opacity:0}',
        '.rail-logo-name.nrc-entry{cursor:pointer;transition:.18s}.rail-logo-name.nrc-entry:hover{background:#f97316;color:#fff!important}',
        '@media (max-width:760px){',
        '.nrc-island{top:10px;gap:8px}',
        '.nrc-toolbar{left:10px;top:0;margin-top:58px;width:calc(100vw - 20px)}.nrc-help,.nrc-kindrow{display:none}.nrc-chiprow{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none}.nrc-chip{white-space:nowrap;flex:none}',
        '.nrc-panel{left:8px;right:8px;top:auto;bottom:8px;width:auto;max-height:62vh;transform:translateY(calc(100% + 20px))}.nrc-panel.open{transform:none}',
        '.nrc-minimap{display:none}.nrc-zoom{right:10px;bottom:10px}',
        '.nrc-root.sheet .nrc-zoom{display:none}',
        '}',
    ].join('\n');

    function build() {
        if (root) return;
        var style = h('style', { text: CSS }); document.head.appendChild(style);
        root = h('div', { class: 'nrc-root', role: 'dialog', 'aria-label': 'Карта системы' });

        districtLayer = h('div'); nodeLayer = h('div');
        svg = svgEl('svg', { class: 'nrc-svg' });
        var defs = svgEl('defs', {});
        var mk = svgEl('marker', { id: 'nrc-arrow', viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '6', markerHeight: '6', orient: 'auto-start-reverse', markerUnits: 'userSpaceOnUse' });
        mk.appendChild(svgEl('path', { d: 'M0 1 L9 5 L0 9 z', fill: 'context-stroke', opacity: '.8' }));
        defs.appendChild(mk); svg.appendChild(defs);
        edgeLayer = svgEl('g', {}); svg.appendChild(edgeLayer);
        world = h('div', { class: 'nrc-world' }, [districtLayer, svg, nodeLayer]);
        root.appendChild(world);

        // остров: логотип NR и оранжевая плашка Space, по нажатию возвращает в дашборд
        var logo = h('img', { src: '/icons/logo-nr.svg', alt: 'NR', width: 28, height: 28 });
        var pill = h('button', { class: 'nrc-pill', title: 'Вернуться в дашборд', text: 'Space', onclick: close });
        root.appendChild(h('div', { class: 'nrc-island' }, [logo, pill]));

        var search = h('input', { type: 'search', placeholder: 'Найти функцию, таблицу, секрет…', autocomplete: 'off' });
        search.addEventListener('input', function () { filter.q = search.value.trim(); applyFilter(); });
        search.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') stepMatch(ev.shiftKey ? -1 : 1); if (ev.key === 'Escape') { search.value = ''; filter.q = ''; applyFilter(); search.blur(); } });
        var chipRow = h('div', { class: 'nrc-chiprow' });
        [['all', 'Всё'], ['garbage', 'Мусор'], ['bad', 'Сбои'], ['norepo', 'Без исходников'], ['marked', 'Помечено'], ['hidden', 'Скрытые']].forEach(function (c) {
            var b = h('button', { class: 'nrc-chip' + (c[0] === 'all' ? ' on' : ''), 'data-status': c[0], onclick: function () {
                filter.status = filter.status === c[0] ? 'all' : c[0]; if (c[0] === 'all') filter.status = 'all';
                updateChips(); applyFilter();
            } }, [c[1], c[0] === 'all' ? null : h('b', { text: '' })]);
            chipRow.appendChild(b);
        });
        var kindRow = h('div', { class: 'nrc-kindrow' });
        Object.keys(KIND_LABEL).forEach(function (k) {
            if (k === 'note') return;
            kindRow.appendChild(h('button', { class: 'nrc-kchip', style: '--kc:' + KIND_COLOR[k], 'data-kind': k, onclick: function (ev) {
                filter.kind = filter.kind === k ? 'all' : k;
                kindRow.querySelectorAll('.nrc-kchip').forEach(function (e) { e.classList.toggle('on', e.getAttribute('data-kind') === filter.kind); });
                applyFilter();
            } }, [h('i'), KIND_LABEL[k]]));
        });
        var nav = h('span', { class: 'nrc-match-nav' }, [h('button', { text: '‹', title: 'Предыдущий', onclick: function () { stepMatch(-1); } }), h('button', { text: '›', title: 'Следующий', onclick: function () { stepMatch(1); } })]);
        var match = h('div', { class: 'nrc-match' }, [h('span', { class: 'nrc-match-count' }), nav]);
        var help = h('div', { class: 'nrc-help', text: 'Колёсико мыши: масштаб. Тяните пустое место, чтобы двигаться, узел, чтобы переставить. Оранжевая точка у узла: потяните к другому узлу и получится связь. Двойной щелчок по пустому месту: заметка.' });
        var actions = h('div', { class: 'nrc-chiprow' }, [
            h('button', { class: 'nrc-chip', text: 'Показать всё', onclick: fitAll }),
            h('button', { class: 'nrc-chip', text: 'Обновить клиентов', onclick: function () { refreshClients(false); } }),
        ]);
        var sub = h('div', { class: 'nrc-help nrc-island-sub', text: '' });
        root.appendChild(h('div', { class: 'nrc-toolbar' }, [h('label', { class: 'nrc-search' }, ['⌕', search]), chipRow, kindRow, actions, match, sub, help]));

        panel = h('div', { class: 'nrc-panel' }); root.appendChild(panel);
        mini = h('canvas', { class: 'nrc-minimap', width: 380, height: 260 }); miniCtx = mini.getContext('2d'); root.appendChild(mini);
        root.appendChild(h('div', { class: 'nrc-zoom' }, [
            h('button', { text: '−', title: 'Отдалить', onclick: function () { zoomAt(root.clientWidth / 2, root.clientHeight / 2, 0.8); } }),
            h('span', { class: 'nrc-zoom-val', text: '100%' }),
            h('button', { text: '+', title: 'Приблизить', onclick: function () { zoomAt(root.clientWidth / 2, root.clientHeight / 2, 1.25); } }),
        ]));
        root.appendChild(h('div', { class: 'nrc-statusline', style: 'display:none' }));
        document.body.appendChild(root);
        root.addEventListener('scroll', function () { root.scrollTop = 0; root.scrollLeft = 0; });
        bindGestures();
        document.addEventListener('keydown', function (ev) {
            if (!root.classList.contains('open')) return;
            var typing = /^(INPUT|TEXTAREA)$/.test((ev.target && ev.target.tagName) || '');
            if (ev.key === 'Escape' && !typing) { if (selected) select(null); else close(); }
            else if (!typing && (ev.key === 'f' || ev.key === 'а')) fitAll();
            else if (!typing && (ev.key === '/' )) { ev.preventDefault(); root.querySelector('.nrc-search input').focus(); }
        });
        window.addEventListener('resize', function () { if (root.classList.contains('open')) drawMini(); });
    }

    function open() {
        if (!isSuper() || window.innerWidth < 760) return; // на телефоне холст не нужен
        build();
        root.classList.add('open');
        try { localStorage.setItem(OPEN_KEY, '1'); } catch (e) { /* без хранилища просто не запомним */ }
        document.documentElement.style.overflow = 'hidden';
        if (!loaded) load(); else { applyTransform(); }
    }
    function close() {
        if (!root) return;
        root.classList.remove('open');
        try { localStorage.removeItem(OPEN_KEY); } catch (e) { /* ок */ }
        document.documentElement.style.overflow = '';
    }

    function init(opts) {
        sb = opts.supabase; isSuper = opts.isSuperAdmin || isSuper;
        var btn = document.getElementById('sidebar-home-btn');
        if (!btn) return;
        var pillEl = btn.querySelector('.rail-logo-name');
        btn.addEventListener('click', function (ev) {
            if (!isSuper() || window.innerWidth < 760 || !ev.target.closest('.rail-logo-name')) return; // логотип NR и все остальные люди, как раньше, ведут на главный сайт
            ev.preventDefault(); ev.stopPropagation();
            open();
        }, true);
        var tries = 0, t = setInterval(function () {
            tries++;
            if (isSuper()) { clearInterval(t); try { if (localStorage.getItem(OPEN_KEY) === '1') open(); } catch (e) { /* ок */ } if (pillEl) { pillEl.classList.add('nrc-entry'); pillEl.title = 'Карта системы'; } }
            if (tries > 60) clearInterval(t);
        }, 1000);
    }

    window.NRCanvas = { init: init, open: open, close: close };
}());

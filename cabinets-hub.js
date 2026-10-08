/* Окно «Кабинеты»: все кабинеты команды на одной странице.
 * Один кабинет = одна карточка: шапка с главными цифрами и значками проблем,
 * по нажатию раскрывается длинный блок (итоги дня, проблемы, реклама, остатки).
 * Данные одним вызовом RPC cabinets_hub(p_date): права проверяет база (RLS),
 * токены и чужие кабинеты сюда не попадают. Стили: cabinets-hub.css (вшиваются при сборке).
 */
(function () {
    'use strict';

    var TZ_OFFSET_H = 6; // Бишкек
    var LS_OPEN = 'cbh_open';
    var LS_FILTER = 'cbh_filter';
    var state = { from: null, to: null, inited: false, rows: [], filter: 'all', query: '', open: {}, loading: false, req: 0 };

    function sb() { return window.supabase; }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
    function int(n) { return Math.round(num(n)).toLocaleString('ru-RU'); }
    function money(n) {
        n = num(n);
        var a = Math.abs(n);
        if (a >= 1e6) return (n / 1e6).toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + ' млн';
        if (a >= 1e4) return Math.round(n / 1e3).toLocaleString('ru-RU') + ' тыс';
        return Math.round(n).toLocaleString('ru-RU');
    }
    function pct(n, digits) { return num(n).toLocaleString('ru-RU', { maximumFractionDigits: digits == null ? 0 : digits }) + '%'; }
    function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
    function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* без памяти тоже работает */ } }

    function bishkekYesterday() {
        var now = new Date(Date.now() + TZ_OFFSET_H * 3600000 - 86400000);
        return now.toISOString().slice(0, 10);
    }
    function range() {
        try {
            var r = typeof window.getActiveDateRange === 'function' ? window.getActiveDateRange() : null;
            if (r && r.from && r.to) return { from: String(r.from).slice(0, 10), to: String(r.to).slice(0, 10) };
        } catch (e) { /* возьмём вчера */ }
        var y = bishkekYesterday();
        return { from: y, to: y };
    }
    function periodLabel() {
        return state.from === state.to ? fmtDate(state.to) : fmtDate(state.from) + '–' + fmtDate(state.to);
    }
    function fmtDate(d) {
        var p = String(d).split('-');
        return p[2] + '.' + p[1];
    }
    function legalName(name) {
        try { if (typeof window.cabinetDisplayName === 'function') return window.cabinetDisplayName(name); } catch (e) { /* имя как есть */ }
        return name;
    }

    /* ---------- онбординг ---------- */
    // Что запрашиваем у нового клиента в WhatsApp-группе. auto — считаем сами по данным кабинета.
    var ONB_ITEMS = [
        { key: 'docs', label: 'Документы (договор, реквизиты)' },
        { key: 'gtin', label: 'GTIN на товары' },
        { key: 'cost', label: 'Себестоимость по артикулам', auto: true },
        { key: 'certs', label: 'Сертификаты на товары в продаже' },
        { key: 'token', label: 'Токен WB с полным доступом', auto: true },
        { key: 'photos', label: 'Оригиналы фотосессий и фото товаров' },
    ];

    function onboarding(r) {
        var ob = r.onboarding || {};
        var items = ob.items || {};
        var total = num(r.arts_total), withCost = num(r.arts_cost);
        var list = ONB_ITEMS.map(function (it) {
            var done, hint = '';
            if (it.key === 'cost') {
                done = total > 0 && withCost >= total;
                hint = total ? withCost + ' из ' + total + ' артикулов' : 'артикулов нет';
            } else if (it.key === 'token') {
                done = r.wb_token_set === true && r.adv_token_valid !== false;
                hint = r.wb_token_set ? (r.adv_token_valid === false ? 'токен рекламы не работает' : 'подключён') : 'не задан';
            } else {
                done = !!(items[it.key] && items[it.key].done);
                hint = items[it.key] && items[it.key].at ? 'отмечено ' + fmtDate(String(items[it.key].at).slice(0, 10)) : '';
            }
            return { key: it.key, label: it.label, auto: !!it.auto, done: done, hint: hint };
        });
        return {
            list: list,
            done: list.filter(function (x) { return x.done; }).length,
            manager: ob.manager || '',
            contact: ob.client_contact || '',
            drive: ob.drive_url || '',
            notes: ob.notes || '',
        };
    }

    /* ---------- расчёт по кабинету ---------- */
    function derive(r) {
        var rate = 1; // суммы WB и реклама уже в сомах
        var ordersSom = num(r.orders_rub) * rate;
        var adSpend = num(r.ad_spend);
        var plan = r.plan_orders == null ? null : num(r.plan_orders);
        // В блок попадают идущие РК и те, что за день потратили заметные деньги.
        var campaigns = (r.campaigns || []).filter(function (c) { return c.status === 9 || num(c.spend) >= 100; });
        var active = campaigns.filter(function (c) { return c.status === 9; });
        var budget = active.reduce(function (s, c) { return s + num(c.budget); }, 0);
        var d = {
            ordersCnt: num(r.orders_cnt),
            ordersSom: ordersSom,
            prevCnt: num(r.orders_prev_cnt),
            days: num(r.days) || 1,
            plan: plan,
            planPct: plan > 0 ? num(r.orders_cnt) / plan * 100 : null,
            salesCnt: r.sales_cnt == null ? null : num(r.sales_cnt),
            salesSom: r.sales_rub == null ? null : num(r.sales_rub) * rate,
            adSpend: adSpend,
            adOrders: num(r.ad_orders),
            drr: ordersSom > 0 ? adSpend / ordersSom * 100 : null,
            penalties: num(r.penalties_rub) * rate,
            activeCount: active.length,
            budget: budget,
            campaigns: campaigns,
            risk: r.stock_risk || [],
            series: r.series || [],
        };
        d.onb = onboarding(r);
        d.problems = problems(r, d);
        d.level = d.problems.some(function (p) { return p.level === 'red'; }) ? 'red'
            : (d.problems.length ? 'amber' : 'green');
        return d;
    }

    function names(list, fmt) {
        var head = list.slice(0, 3).map(fmt).join(', ');
        return list.length > 3 ? head + ' и ещё ' + (list.length - 3) : head;
    }

    function problems(r, d) {
        var out = [];
        // Остановилась за день кампания, которая реально тратила (мелкие хвосты не считаем).
        var stopped = d.campaigns.filter(function (c) { return c.status !== 9 && num(c.spend) >= 300; });
        if (stopped.length) {
            out.push({ level: 'red', key: 'ads', text: 'Остановились рабочие РК: ' + names(stopped, function (c) { return c.name; }), action: 'advertising' });
        }
        var low = d.campaigns.filter(function (c) { return c.status === 9 && num(c.budget) < 1000; });
        if (low.length) {
            out.push({ level: 'amber', key: 'ads', text: 'Бюджет меньше 1 000: ' + names(low, function (c) { return c.name + ' (' + int(c.budget) + ')'; }), action: 'advertising' });
        }
        var urgent = d.risk.filter(function (x) { return num(x.days) < 3; });
        if (urgent.length) {
            out.push({ level: 'red', key: 'stock', text: 'Остатков меньше чем на 3 дня: ' + urgent.length + ' арт.', action: 'goods-groups' });
        } else if (d.risk.length) {
            out.push({ level: 'amber', key: 'stock', text: 'Остатков меньше чем на 7 дней: ' + d.risk.length + ' арт.', action: 'goods-groups' });
        }
        if (d.planPct != null && d.planPct < 80) {
            out.push({ level: 'amber', key: 'plan', text: 'План заказов выполнен на ' + pct(d.planPct), action: 'rnp' });
        }
        if (d.prevCnt >= 10 && d.ordersCnt < d.prevCnt * 0.75) {
            out.push({ level: 'amber', key: 'drop', text: 'Заказов меньше на ' + pct((1 - d.ordersCnt / d.prevCnt) * 100) + ', чем за прошлый такой же период', action: 'rnp' });
        }
        if (r.adv_token_valid === false) {
            out.push({ level: 'red', key: 'token', text: 'Токен рекламы не работает', action: 'settings' });
        }
        if (r.wb_token_set === false) {
            out.push({ level: 'red', key: 'token', text: 'Токен WB не задан', action: 'settings' });
        }
        var missing = d.onb.list.filter(function (x) { return !x.done && x.key !== 'token'; });
        if (missing.length) {
            out.push({ level: 'amber', key: 'onb', text: 'Онбординг: не хватает ' + missing.map(function (x) { return x.label.toLowerCase(); }).join(', '), action: 'onb' });
        }
        if (d.penalties > 0) {
            out.push({ level: 'amber', key: 'pen', text: 'Штрафы за период: ' + money(d.penalties) + ' сом', action: 'rnp' });
        }
        return out;
    }

    /* ---------- разметка ---------- */
    var ICON = {
        chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>',
        ads: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg>',
        stock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/></svg>',
        plan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg>',
        drop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>',
        token: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="15" r="4"/><path d="M10.8 12.2L21 2"/><path d="M17 6l3 3"/></svg>',
        pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>',
        onb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
        check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
        link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
        refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15"/></svg>',
    };
    var FLAG_TITLE = { ads: 'Реклама', stock: 'Остатки', plan: 'План', drop: 'Падение заказов', token: 'Токен', pen: 'Штрафы', onb: 'Онбординг' };

    function spark(series) {
        var vals = series.map(function (p) { return num(p.cnt); });
        if (!vals.length) return '';
        var w = 168, h = 40, max = Math.max.apply(null, vals) || 1;
        var step = vals.length > 1 ? w / (vals.length - 1) : w;
        var pts = vals.map(function (v, i) { return (i * step).toFixed(1) + ',' + (h - 3 - v / max * (h - 8)).toFixed(1); });
        var area = '0,' + h + ' ' + pts.join(' ') + ' ' + w + ',' + h;
        var last = pts[pts.length - 1].split(',');
        return '<svg class="cbh-spark" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-label="Заказы по дням">' +
            '<polygon points="' + area + '" class="cbh-spark-area"/>' +
            '<polyline points="' + pts.join(' ') + '" class="cbh-spark-line"/>' +
            '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="2.6" class="cbh-spark-dot"/></svg>';
    }

    function delta(cur, base) {
        if (!(base > 0)) return '';
        var v = (cur - base) / base * 100;
        var cls = v >= 0 ? 'up' : 'down';
        return '<span class="cbh-delta ' + cls + '">' + (v >= 0 ? '+' : '−') + pct(Math.abs(v)) + '</span>';
    }

    function kpi(label, value, sub) {
        return '<div class="cbh-kpi"><span class="cbh-kpi-label">' + label + '</span><b class="cbh-kpi-value">' + value + '</b>' +
            (sub ? '<span class="cbh-kpi-sub">' + sub + '</span>' : '') + '</div>';
    }

    function headHtml(r, d) {
        var flags = {};
        d.problems.forEach(function (p) {
            if (!flags[p.key] || p.level === 'red') flags[p.key] = p.level;
        });
        var flagHtml = Object.keys(flags).map(function (k) {
            return '<span class="cbh-flag cbh-flag--' + flags[k] + '" title="' + esc(FLAG_TITLE[k] || '') + '">' + (ICON[k] || '') + '</span>';
        }).join('') || '<span class="cbh-ok">Всё в порядке</span>';
        return '<button type="button" class="cbh-head" data-cbh-toggle="' + esc(r.id) + '" aria-expanded="' + (state.open[r.id] ? 'true' : 'false') + '">' +
            '<span class="cbh-dot cbh-dot--' + d.level + '"></span>' +
            '<span class="cbh-name"><b>' + esc(r.name) + '</b><small>' + esc(legalName(r.name)) + (d.onb.manager ? ' · ' + esc(d.onb.manager) : '') + '</small></span>' +
            '<span class="cbh-head-kpis">' +
                '<span class="cbh-hk"><small>Заказы</small><b>' + int(d.ordersCnt) + '</b>' + delta(d.ordersCnt, d.prevCnt) + '</span>' +
                '<span class="cbh-hk"><small>Сумма</small><b>' + money(d.ordersSom) + '</b></span>' +
                '<span class="cbh-hk"><small>План</small><b>' + (d.planPct == null ? '—' : pct(d.planPct)) + '</b></span>' +
                '<span class="cbh-hk"><small>ДРР</small><b>' + (d.drr == null ? '—' : pct(d.drr, 1)) + '</b></span>' +
                '<span class="cbh-hk"><small>Бюджет РК</small><b>' + money(d.budget) + '</b></span>' +
            '</span>' +
            '<span class="cbh-flags">' + flagHtml + '</span>' +
            '<span class="cbh-chev">' + ICON.chevron + '</span>' +
            '</button>';
    }

    function section(title, body, actionTab, actionLabel, cabId) {
        var btn = actionTab
            ? '<button type="button" class="ui-btn ui-btn-secondary cbh-sec-btn" data-cbh-go="' + actionTab + '" data-cbh-cab="' + esc(cabId) + '">' + actionLabel + '</button>'
            : '';
        return '<section class="cbh-sec"><header class="cbh-sec-head"><h4>' + title + '</h4>' + btn + '</header>' + body + '</section>';
    }

    function bodyHtml(r, d) {
        var day = periodLabel();
        var summary = '<div class="cbh-summary">' +
            '<div class="cbh-kpis">' +
                kpi('Заказы', int(d.ordersCnt) + ' шт', 'прошлый период ' + int(d.prevCnt) + ' шт') +
                kpi('Сумма заказов', money(d.ordersSom) + ' сом', '') +
                kpi('План заказов', d.plan == null ? 'не задан' : int(d.plan) + ' шт', d.planPct == null ? '' : 'выполнено ' + pct(d.planPct)) +
                kpi('Продажи (выкупы)', d.salesCnt == null ? '—' : int(d.salesCnt) + ' шт', d.salesSom == null ? 'WB ещё догружает' : money(d.salesSom) + ' сом') +
                kpi('Реклама', money(d.adSpend) + ' сом', int(d.adOrders) + ' заказов с РК · ДРР ' + (d.drr == null ? '—' : pct(d.drr, 1))) +
                kpi('Штрафы', money(d.penalties) + ' сом', 'по финотчёту WB за период') +
            '</div>' +
            '<div class="cbh-trend"><span class="cbh-kpi-label">Заказы по дням</span>' + spark(d.series) + '</div>' +
            '</div>';

        var probs = d.problems.length
            ? '<ul class="cbh-problems">' + d.problems.map(function (p) {
                return '<li class="cbh-problem cbh-problem--' + p.level + '"><span class="cbh-problem-ico">' + (ICON[p.key] || '') + '</span>' +
                    '<span class="cbh-problem-text">' + esc(p.text) + '</span>' +
                    (p.action === 'onb'
                        ? '<button type="button" class="ui-btn ui-btn-secondary cbh-mini" data-cbh-jump="onb-' + esc(r.id) + '">К чек-листу</button></li>'
                        : '<button type="button" class="ui-btn ui-btn-secondary cbh-mini" data-cbh-go="' + p.action + '" data-cbh-cab="' + esc(r.id) + '">Открыть</button></li>');
            }).join('') + '</ul>'
            : '<p class="cbh-empty">Проблем нет.</p>';

        var camps = d.campaigns.length
            ? '<div class="cbh-table-wrap"><table class="cbh-table"><thead><tr><th>Кампания</th><th>Статус</th><th>Бюджет</th><th>Расход ' + day + '</th><th>Заказы</th><th>ДРР</th></tr></thead><tbody>' +
                d.campaigns.map(function (c) {
                    var on = c.status === 9;
                    var drr = num(c.revenue) > 0 ? pct(num(c.spend) / num(c.revenue) * 100, 1) : '—';
                    return '<tr><td class="cbh-td-name">' + esc(c.name) + '</td>' +
                        '<td><span class="ui-status ' + (on ? 'ui-status-success' : 'ui-status-danger') + '"><span class="ui-status-dot"></span>' + (on ? 'идёт' : 'стоит') + '</span></td>' +
                        '<td class="' + (on && num(c.budget) < 1000 ? 'cbh-warn' : '') + '">' + int(c.budget) + '</td>' +
                        '<td>' + int(c.spend) + '</td><td>' + int(c.orders) + '</td><td>' + drr + '</td></tr>';
                }).join('') + '</tbody></table></div>'
            : '<p class="cbh-empty">Активных кампаний нет.</p>';

        var stock = d.risk.length
            ? '<div class="cbh-table-wrap"><table class="cbh-table"><thead><tr><th>Артикул</th><th>Остаток</th><th>Заказов в день</th><th>Хватит на</th></tr></thead><tbody>' +
                d.risk.map(function (x) {
                    var days = num(x.days);
                    return '<tr><td class="cbh-td-name">' + esc(x.name || x.nm) + '<small>' + esc(x.nm) + '</small></td>' +
                        '<td>' + int(x.qty) + '</td><td>' + num(x.per_day).toLocaleString('ru-RU') + '</td>' +
                        '<td class="' + (days < 3 ? 'cbh-bad' : 'cbh-warn') + '">' + days.toLocaleString('ru-RU') + ' дн.</td></tr>';
                }).join('') + '</tbody></table></div>'
            : '<p class="cbh-empty">Остатков хватает больше чем на 7 дней.</p>';

        var o = d.onb;
        var onbHtml = '<div class="cbh-onb" id="onb-' + esc(r.id) + '" data-cbh-onb="' + esc(r.id) + '">' +
            '<div class="cbh-onb-progress"><span style="width:' + Math.round(o.done / o.list.length * 100) + '%"></span></div>' +
            '<ul class="cbh-checklist">' + o.list.map(function (it) {
                var btn = it.auto
                    ? '<span class="cbh-auto" title="Считается автоматически">авто</span>'
                    : '<button type="button" class="ui-btn ui-btn-secondary cbh-mini" data-cbh-onb-toggle="' + it.key + '">' + (it.done ? 'Снять' : 'Получено') + '</button>';
                return '<li class="cbh-check' + (it.done ? ' is-done' : '') + '"><span class="cbh-check-box">' + (it.done ? ICON.check : '') + '</span>' +
                    '<span class="cbh-check-text">' + esc(it.label) + (it.hint ? '<small>' + esc(it.hint) + '</small>' : '') + '</span>' + btn + '</li>';
            }).join('') + '</ul>' +
            '<div class="cbh-onb-fields">' +
                '<label class="cbh-field"><span>Менеджер</span><input class="cbh-input" data-cbh-onb-field="manager" value="' + esc(o.manager) + '" placeholder="Кто ведёт кабинет" maxlength="80"></label>' +
                '<label class="cbh-field"><span>Контакт клиента</span><input class="cbh-input" data-cbh-onb-field="client_contact" value="' + esc(o.contact) + '" placeholder="Имя, телефон, WhatsApp-группа" maxlength="160"></label>' +
                '<label class="cbh-field cbh-field--wide"><span>Папка в Google Drive</span><span class="cbh-field-row"><input class="cbh-input" data-cbh-onb-field="drive_url" value="' + esc(o.drive) + '" placeholder="https://drive.google.com/..." maxlength="400">' +
                    (/^https:\/\//.test(o.drive) ? '<a class="ui-btn ui-btn-secondary cbh-icon-btn" href="' + esc(o.drive) + '" target="_blank" rel="noopener noreferrer" title="Открыть папку" aria-label="Открыть папку">' + ICON.link + '</a>' : '') +
                '</span></label>' +
                '<label class="cbh-field cbh-field--wide"><span>Заметки</span><textarea class="cbh-input cbh-textarea" data-cbh-onb-field="notes" rows="2" maxlength="2000" placeholder="Что обещал прислать клиент, сроки">' + esc(o.notes) + '</textarea></label>' +
            '</div>' +
            '<span class="cbh-saved" aria-live="polite"></span>' +
            '</div>';

        return '<div class="cbh-body">' +
            section('Итоги за ' + day, summary, 'rnp', 'РНП', r.id) +
            section('Проблемы', probs, null, null, r.id) +
            section('Реклама', camps, 'advertising', 'Все РК', r.id) +
            section('Остатки на исходе', stock, 'goods-groups', 'Товары', r.id) +
            section('Онбординг и документы · ' + o.done + ' из ' + o.list.length, onbHtml, null, null, r.id) +
            '</div>';
    }

    function cardHtml(r) {
        var d = r._d;
        return '<article class="cbh-card cbh-card--' + d.level + (state.open[r.id] ? ' is-open' : '') + '" data-cbh-card="' + esc(r.id) + '">' +
            headHtml(r, d) + (state.open[r.id] ? bodyHtml(r, d) : '') + '</article>';
    }

    function skeleton() {
        var one = '<article class="cbh-card cbh-card--skel"><div class="cbh-head"><span class="cbh-dot"></span>' +
            '<span class="cbh-name"><i class="cbh-skel cbh-skel--w120"></i><i class="cbh-skel cbh-skel--w80"></i></span>' +
            '<span class="cbh-head-kpis">' + '<i class="cbh-skel cbh-skel--w60"></i>'.repeat(5) + '</span></div></article>';
        return one.repeat(4);
    }

    function visibleRows() {
        var q = state.query.trim().toLowerCase();
        return state.rows.filter(function (r) {
            if (state.filter === 'alert' && r._d.level === 'green') return false;
            if (!q) return true;
            return (r.name + ' ' + legalName(r.name)).toLowerCase().indexOf(q) >= 0;
        });
    }

    function renderList() {
        var list = document.getElementById('cbh-list');
        if (!list) return;
        var rows = visibleRows();
        var total = state.rows.length;
        var alerts = state.rows.filter(function (r) { return r._d.level !== 'green'; }).length;
        var counter = document.getElementById('cbh-counter');
        if (counter) counter.textContent = total ? (total + ' каб. · требуют внимания: ' + alerts) : '';
        if (!rows.length) {
            list.innerHTML = '<p class="cbh-empty cbh-empty--big">' + (total ? 'Под фильтр ничего не попало.' : 'Кабинетов нет.') + '</p>';
            return;
        }
        list.innerHTML = rows.map(cardHtml).join('');
    }

    /* ---------- данные ---------- */
    async function load() {
        var list = document.getElementById('cbh-list');
        if (!list || !sb()) return;
        var rg = range();
        state.from = rg.from; state.to = rg.to;
        var my = ++state.req;
        state.loading = true;
        if (!state.rows.length) list.innerHTML = skeleton();
        document.getElementById('cbh-refresh')?.classList.add('is-loading');
        try {
            var res = await sb().rpc('cabinets_hub', { p_from: state.from, p_to: state.to });
            if (my !== state.req) return;
            if (res.error) throw res.error;
            var rows = Array.isArray(res.data) ? res.data : [];
            rows.forEach(function (r) { r._d = derive(r); });
            var rank = { red: 0, amber: 1, green: 2 };
            rows.sort(function (a, b) {
                return (rank[a._d.level] - rank[b._d.level]) || (b._d.ordersSom - a._d.ordersSom);
            });
            state.rows = rows;
            renderList();
        } catch (e) {
            if (my !== state.req) return;
            list.innerHTML = '<p class="cbh-empty cbh-empty--big">Не удалось загрузить кабинеты. Обновите страницу.</p>';
            console.warn('[cabinets-hub]', e && e.message);
        } finally {
            if (my === state.req) {
                state.loading = false;
                document.getElementById('cbh-refresh')?.classList.remove('is-loading');
            }
        }
    }

    /* ---------- сохранение онбординга ---------- */
    var saveTimers = {};
    async function saveOnboarding(cabId, patch, box) {
        var row = state.rows.find(function (r) { return r.id === cabId; });
        if (!row || !sb()) return;
        var cur = row.onboarding || {};
        var next = Object.assign({}, cur, patch, { cabinet_id: cabId, updated_at: new Date().toISOString() });
        delete next.updated_by;
        var mark = box && box.querySelector('.cbh-saved');
        if (mark) mark.textContent = 'Сохраняю…';
        try {
            var res = await sb().from('cabinet_onboarding').upsert(next, { onConflict: 'cabinet_id' });
            if (res.error) throw res.error;
            var stored = Object.assign({}, next); delete stored.cabinet_id;
            row.onboarding = stored;
            row._d = derive(row);
            if (mark) mark.textContent = 'Сохранено';
            return true;
        } catch (e) {
            if (mark) mark.textContent = 'Не сохранилось, попробуйте ещё раз';
            console.warn('[cabinets-hub] onboarding', e && e.message);
            return false;
        }
    }

    function rerenderCard(root, id) {
        var row = state.rows.find(function (r) { return r.id === id; });
        var card = root.querySelector('[data-cbh-card="' + id + '"]');
        if (row && card) card.outerHTML = cardHtml(row);
    }

    /* ---------- события ---------- */
    function go(tab, cabId) {
        try {
            if (cabId && window.currentCabinetId !== cabId && typeof window.selectCabinet === 'function') window.selectCabinet(cabId);
        } catch (e) { /* откроем вкладку и так */ }
        if (typeof window.showTab === 'function') window.showTab(tab);
    }

    function bind(root) {
        if (root._cbhBound) return;
        root._cbhBound = true;
        root.addEventListener('click', function (e) {
            var goBtn = e.target.closest('[data-cbh-go]');
            if (goBtn) { e.stopPropagation(); go(goBtn.getAttribute('data-cbh-go'), goBtn.getAttribute('data-cbh-cab')); return; }
            var jump = e.target.closest('[data-cbh-jump]');
            if (jump) { document.getElementById(jump.getAttribute('data-cbh-jump'))?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
            var tg = e.target.closest('[data-cbh-onb-toggle]');
            if (tg) {
                var box = tg.closest('[data-cbh-onb]');
                var cabId = box.getAttribute('data-cbh-onb');
                var key = tg.getAttribute('data-cbh-onb-toggle');
                var rowT = state.rows.find(function (r) { return r.id === cabId; });
                var items = Object.assign({}, (rowT && rowT.onboarding && rowT.onboarding.items) || {});
                var was = !!(items[key] && items[key].done);
                items[key] = { done: !was, at: new Date().toISOString() };
                tg.disabled = true;
                saveOnboarding(cabId, { items: items }, box).then(function (ok) {
                    if (ok) rerenderCard(root, cabId); else tg.disabled = false;
                });
                return;
            }
            var t = e.target.closest('[data-cbh-toggle]');
            if (t) {
                var id = t.getAttribute('data-cbh-toggle');
                if (state.open[id]) delete state.open[id]; else state.open[id] = 1;
                lsSet(LS_OPEN, state.open);
                var row = state.rows.find(function (r) { return r.id === id; });
                var card = root.querySelector('[data-cbh-card="' + id + '"]');
                if (row && card) card.outerHTML = cardHtml(row);
                return;
            }
            var f = e.target.closest('[data-cbh-filter]');
            if (f) {
                state.filter = f.getAttribute('data-cbh-filter');
                lsSet(LS_FILTER, state.filter);
                root.querySelectorAll('[data-cbh-filter]').forEach(function (b) { b.classList.toggle('active', b === f); });
                renderList();
                return;
            }
            if (e.target.closest('#cbh-refresh')) { load(); return; }
            if (e.target.closest('#cbh-collapse')) { state.open = {}; lsSet(LS_OPEN, state.open); renderList(); }
        });
        root.addEventListener('input', function (e) {
            var f = e.target.closest('[data-cbh-onb-field]');
            if (!f) return;
            var box = f.closest('[data-cbh-onb]');
            var cabId = box.getAttribute('data-cbh-onb');
            var field = f.getAttribute('data-cbh-onb-field');
            var val = f.value.trim();
            if (field === 'drive_url' && val && !/^https:\/\//.test(val)) { box.querySelector('.cbh-saved').textContent = 'Ссылка должна начинаться с https://'; return; }
            clearTimeout(saveTimers[cabId + field]);
            saveTimers[cabId + field] = setTimeout(function () {
                var patch = {}; patch[field] = val || null;
                saveOnboarding(cabId, patch, box);
            }, 700);
        });
        root.querySelector('#cbh-search')?.addEventListener('input', function (e) {
            state.query = e.target.value || '';
            renderList();
        });
    }

    function open() {
        var root = document.getElementById('tab-cabinets-hub');
        if (!root) return;
        if (!state.inited) {
            state.inited = true;
            state.open = lsGet(LS_OPEN, {}) || {};
            state.filter = lsGet(LS_FILTER, 'all') === 'alert' ? 'alert' : 'all';
        }
        root.querySelectorAll('[data-cbh-filter]').forEach(function (b) {
            b.classList.toggle('active', b.getAttribute('data-cbh-filter') === state.filter);
        });
        bind(root);
        load();
    }

    window.CabinetsHub = { open: open, reload: load };
})();

'use strict';
/**
 * Из снимка системы строим карту: узлы, связи, статусы и причины человеческим языком.
 * Чистые функции без обращения к сети: их проверяют тесты (system_map_test.js).
 *
 * Статусы: ok (всё хорошо), warn (стоит посмотреть), bad (сбой), unused (кандидат на уборку), unknown.
 * «Кандидат» не значит «удалить»: решение всегда за владельцем.
 */

// ── Районы карты ───────────────────────────────────────────
const DISTRICTS = {
    ads:       { title: 'Реклама и ставки' },
    reviews:   { title: 'Отзывы и Акылай' },
    rnp:       { title: 'РНП, продажи и выгрузки WB' },
    ab:        { title: 'А/Б тесты' },
    content:   { title: 'Контент-завод' },
    warehouse: { title: 'Склад, штрафы, новости и отчёты команды' },
    telegram:  { title: 'Telegram и боты' },
    access:    { title: 'Клиенты, доступ и тарифы' },
    core:      { title: 'Ядро и общее' },
    other:     { title: 'Прочее' },
    secrets:   { title: 'Секреты (только имена)' },
    services:  { title: 'Внешние сервисы' },
    agents:    { title: 'Агенты' },
    site:      { title: 'Сайт' },
    clients:   { title: 'Клиенты и кабинеты' },
};

const FN_DISTRICT = [
    ['ads', /^(advertising-|autobidder-|adv-|sync-campaigns|check-campaigns|agent-ad-|wb-clusters|drr-)/],
    ['reviews', /^(akylai-(reviews|connect|status|bot|admin)|wb-review-)/],
    ['ab', /^ab-/],
    ['content', /^content-/],
    ['rnp', /^(rnp-|auto-sync|sync-daily|sync-queue|orders-|goods-|daily-sales|cleanup-)/],
    ['warehouse', /^(warehouse-|wb-restock|wb-news|daily-fbs|daily-penalties|penalties-|blockings-|marketplace-news|morning-digest|namaz-|agent-morning|diag-)/],
    ['telegram', /^(telegram-|tg-)/],
    ['access', /^(admin-space|delete-user|onboard-cabinet|cabinet-features)/],
    ['core', /^(wb-proxy)/],
];

const TABLE_DISTRICT = [
    ['other', /^admin_map_/],
    ['ads', /^(adv_|advertising_|autobidder|campaign_|auction_|wb_cluster|bid_|serp_|ads_)/],
    ['reviews', /^(akylai_|review_|ai_usage|agent_logs|cabinet_secrets)/],
    ['ab', /^ab_/],
    ['content', /^(content_|bloggers?|blogger_)/],
    ['rnp', /^(rnp_|wb_orders|wb_stocks|raw_|goods_|sync_|order_events|wb_sales|wb_finance|wb_funnel|cabinet_goods|orders_)/],
    ['warehouse', /^(warehouse_|card_block|wb_news|penalt|restock|cabinet_balance)/],
    ['telegram', /^(telegram_|tg_|whatsapp_)/],
    ['access', /^(spaces|cabinets|user_cabinet|team_|cabinet_features|cabinet_groups|giveaway|paid_|plans?|tariff)/],
];

const SQLFN_DISTRICT = [
    ['access', /(cabinet|super_admin|space|paid_access|team|access|tariff|plan)/],
    ['telegram', /(telegram|tg_)/],
    ['rnp', /(rnp|sync|order|goods)/],
    ['ads', /(adv|bid|campaign)/],
];

function pick(rules, name) {
    for (const [d, re] of rules) if (re.test(name)) return d;
    return null;
}

// ── Агенты: какая функция чья (то же, что показывают тумблеры в настройках кабинета) ──
const AGENTS = {
    akylai: { title: 'Акылай', role: 'ответы на отзывы', fns: ['akylai-reviews', 'akylai-bot', 'akylai-connect', 'akylai-status', 'akylai-admin', 'wb-review-auto-reply'] },
    amina:  { title: 'Амина',  role: 'РК и автоставки', fns: ['autobidder-tick', 'autobidder-run', 'advertising-sync', 'check-campaigns-notify', 'agent-ad-schedule-runner', 'sync-campaigns', 'drr-autopilot'] },
    anton:  { title: 'Антон',  role: 'заказы и склады', fns: ['orders-watch', 'orders-rescan', 'daily-fbs-report', 'warehouse-watch', 'warehouse-storage-fetch', 'wb-restock-poll'] },
    karina: { title: 'Карина', role: 'система и координация', fns: ['auto-sync', 'rnp-morning-fill', 'rnp-finance-sync', 'ab-test-rotate', 'sync-daily-stats', 'sync-queue-tick', 'agent-morning-greeting-runner', 'morning-digest'] },
};

// Функции, которые зовут снаружи (Telegram, редиректы): без вызовов из cron/сайта они не мусор.
const EXTERNAL_ENTRY = new Set(['telegram-router', 'telegram-webhook', 'akylai-bot', 'content-ig-oauth', 'tg-login', 'wb-proxy']);

// ── Расписание cron человеческим языком ─────────────────────
const pad = (n) => String(n).padStart(2, '0');
const bishkek = (h, m) => `${pad((Number(h) + 6) % 24)}:${pad(m)}`;

function humanCron(expr) {
    const e = String(expr || '').trim().split(/\s+/);
    if (e.length !== 5) return String(expr || '');
    const [m, h, dom, mon, dow] = e;
    const dailyOnly = dom === '*' && mon === '*' && dow === '*';
    if (!dailyOnly) return String(expr);
    if (m === '*' && h === '*') return 'каждую минуту';
    let r;
    if ((r = m.match(/^\*\/(\d+)$/)) && h === '*') return `каждые ${r[1]} мин`;
    if (/^\d+(,\d+)+$/.test(m) && h === '*') return `каждый час в минуты ${m}`;
    if ((r = h.match(/^\*\/(\d+)$/)) && /^\d+$/.test(m)) return Number(m) === 0 ? `каждые ${r[1]} ч` : `каждые ${r[1]} ч (в :${pad(m)})`;
    if (/^\d+$/.test(m) && h === '*') return `каждый час в :${pad(m)}`;
    if (/^\d+$/.test(m) && /^\d+(,\d+)*$/.test(h)) {
        const hours = h.split(',');
        return 'ежедневно в ' + hours.map((x) => `${pad(x)}:${pad(m)}`).join(', ') + ' UTC (Бишкек ' + hours.map((x) => bishkek(x, m)).join(', ') + ')';
    }
    return String(expr);
}

function humanRows(n) {
    n = Number(n) || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.', ',') + ' млн';
    if (n >= 1e3) return Math.round(n / 1e3) + ' тыс.';
    return String(n);
}

const SEVERITY = { unused: 4, bad: 3, warn: 2, unknown: 1, ok: 0 };
function worst(a, b) { return SEVERITY[b] > SEVERITY[a] ? b : a; }

/** Узел с накоплением причин: статус = самый тяжёлый из добавленных. */
class Node {
    constructor(ref, kind, title) {
        Object.assign(this, { ref, kind, title, subtitle: '', district: 'other', status: 'ok', reasons: [], meta: {} });
    }
    flag(status, reason) {
        this.status = worst(this.status, status);
        if (reason && !this.reasons.includes(reason)) this.reasons.push(reason);
        return this;
    }
}

function wordRe(name) {
    return new RegExp(`(?<![A-Za-z0-9_])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9_])`);
}

function buildGraph(snap, extra = {}) {
    const nodes = new Map();
    const edges = [];
    const add = (n) => { nodes.set(n.ref, n); return n; };
    const link = (from, to, kind, opts = {}) => {
        if (from === to || !nodes.has(from) || !nodes.has(to)) return;
        if (edges.some((e) => e.from === from && e.to === to && e.kind === kind)) return;
        edges.push({ from, to, kind, weak: Boolean(opts.weak), label: opts.label || null });
    };

    const live = new Set(snap.functions.map((f) => f.slug));
    const repoFacts = (snap.repoOnly || []).filter((r) => !live.has(r.slug)); // есть в репозитории, не задеплоены
    const repoOnly = repoFacts.map((r) => r.slug);
    const allFnSlugs = new Set([...live, ...repoOnly]);

    // Кто зовёт функцию: cron, сайт, другие функции, боты
    const calledBy = {};
    const mark = (slug, who) => { (calledBy[slug] = calledBy[slug] || []).push(who); };

    const cronTargets = new Map(); // имя cron -> slug|null
    for (const c of snap.cron) {
        const m = String(c.command || '').match(/functions\/v1\/([a-z0-9-]+)/);
        cronTargets.set(c.name, m ? m[1] : null);
        if (m) mark(m[1], `cron «${c.name}»`);
    }
    for (const [slug, files] of Object.entries(snap.site?.calls || {})) mark(slug, `сайт (${files.slice(0, 3).join(', ')}${files.length > 3 ? '…' : ''})`);
    for (const f of [...snap.functions, ...repoFacts]) for (const c of f.calls || []) mark(c, `функция «${f.slug}»`);
    for (const b of snap.bots || []) {
        const slug = String(b.webhook_path || '').split('?')[0];
        if (slug && !b.deleted) mark(slug, `бот «${b.title}»`);
    }

    // ── Сайт ──
    const site = add(new Node('site:main', 'site', 'Сайт nurcon.kg'));
    site.district = 'site';
    site.subtitle = 'дашборд, клиентская часть';
    site.meta = { files: Object.keys(snap.site?.calls || {}).length, tablesUsed: Object.keys(snap.site?.tables || {}).length };

    // ── Функции Supabase ──
    const fnTables = {};
    for (const f of snap.functions) {
        const n = add(new Node(`fn:${f.slug}`, 'function', f.slug));
        n.district = pick(FN_DISTRICT, f.slug) || 'other';
        const cronNames = [...cronTargets].filter(([, s]) => s === f.slug).map(([c]) => c);
        const by = calledBy[f.slug] || [];
        const siteCalled = Boolean(snap.site?.calls?.[f.slug]);
        n.meta = {
            version: f.version, verifyJwt: f.verifyJwt, updatedAt: f.updatedAt, inRepo: f.inRepo, files: f.files,
            tables: f.tables, rpcs: f.rpcs, secrets: f.secrets, integrations: f.integrations, calls: f.calls,
            calledBy: by, crons: cronNames, deployed: true,
        };
        n.subtitle = cronNames.length ? `v${f.version} · cron ×${cronNames.length}` : siteCalled ? `v${f.version} · из сайта` : `v${f.version}`;
        fnTables[f.slug] = new Set(f.tables);

        const external = EXTERNAL_ENTRY.has(f.slug) || by.some((w) => w.startsWith('бот'));
        if (by.length === 0 && !external) {
            n.flag('unused', 'Никто не вызывает: нет cron, нет вызовов с сайта, из других функций и от ботов. Возможно, временная или забытая.');
            if (/^diag-/.test(f.slug)) n.flag('unused', 'Название «diag» похоже на временную диагностику.');
        }
        if (!f.inRepo) n.flag('warn', 'Нет исходников в репозитории: функция живёт только в Supabase.');
        if (f.hardcoded?.length) n.flag('warn', 'В коде зашито значение по умолчанию для секрета (' + f.hardcoded.join(', ') + ').');
        if (!f.verifyJwt && by.length === 0 && !external) n.flag('warn', 'Открыта без проверки JWT и при этом не нужна ни cron, ни сайту.');
    }
    for (const r of repoFacts) {
        const n = add(new Node(`fn:${r.slug}`, 'function', r.slug));
        n.district = pick(FN_DISTRICT, r.slug) || 'other';
        n.subtitle = 'не задеплоена';
        n.meta = {
            deployed: false, inRepo: true, calledBy: calledBy[r.slug] || [], crons: [],
            tables: r.tables, rpcs: r.rpcs, secrets: r.secrets, integrations: r.integrations, calls: r.calls,
        };
        n.flag('warn', 'Есть в репозитории, но в Supabase не задеплоена.');
    }

    // ── Cron ──
    for (const c of snap.cron) {
        const n = add(new Node(`cron:${c.name}`, 'cron', c.name));
        const target = cronTargets.get(c.name);
        n.subtitle = humanCron(c.schedule);
        n.meta = {
            schedule: c.schedule, human: humanCron(c.schedule), active: c.active, target,
            lastRun: c.last_run || null, lastStatus: c.last_status || null, lastMessage: c.last_message || null,
        };
        if (target) {
            n.district = nodes.get(`fn:${target}`)?.district || 'other';
            if (!allFnSlugs.has(target)) n.flag('bad', `Вызывает функцию «${target}», которой нет в Supabase: каждый запуск заканчивается ошибкой 404.`);
            else if (repoOnly.includes(target)) n.flag('bad', `Вызывает функцию «${target}», которая не задеплоена.`);
        } else {
            n.district = 'core';
            const refs = snap.sqlfns.filter((s) => wordRe(s.name).test(c.command || '')).map((s) => s.name);
            n.meta.sqlTargets = refs;
            if (!refs.length) n.subtitle += ' · SQL';
        }
        if (!c.active) n.flag('warn', 'Задача выключена.');
        if (c.last_status && c.last_status !== 'succeeded') n.flag('bad', `Последний запуск не удался (${c.last_status}${c.last_message ? ': ' + c.last_message : ''}).`);
    }

    // ── Таблицы ──
    const sqlText = snap.sqlfns.map((f) => f.src || '').join('\n') + '\n' + snap.views.map((v) => v.definition || '').join('\n');
    const policyText = snap.policies.map((p) => `${p.qual} ${p.with_check}`).join('\n');
    const fkIn = {}, fkOut = {};
    for (const fk of snap.fks) {
        (fkIn[fk.dst] = fkIn[fk.dst] || new Set()).add(fk.src);
        (fkOut[fk.src] = fkOut[fk.src] || new Set()).add(fk.dst);
    }
    const trigByTable = {};
    for (const t of snap.triggers) (trigByTable[t.tbl] = trigByTable[t.tbl] || []).push(t);
    const tableUsers = {};
    for (const f of [...snap.functions, ...repoFacts]) for (const t of f.tables) (tableUsers[t] = tableUsers[t] || []).push(f.slug);

    for (const t of snap.tables) {
        const n = add(new Node(`tbl:${t.name}`, 'table', t.name));
        const users = tableUsers[t.name] || [];
        const siteFiles = snap.site?.tables?.[t.name] || [];
        const sqlRef = wordRe(t.name).test(sqlText) || wordRe(t.name).test(policyText);
        const inFk = [...(fkIn[t.name] || [])].filter((x) => x !== t.name);
        const trig = trigByTable[t.name] || [];
        const refs = users.length + siteFiles.length + (sqlRef ? 1 : 0) + inFk.length + trig.length;
        n.subtitle = t.rows ? `${humanRows(t.rows)} строк` : 'пустая';
        n.meta = {
            rows: t.rows, bytes: Number(t.bytes), writes: Number(t.writes), rls: t.rls, policies: t.policies, cols: t.cols,
            usedByFunctions: users, usedBySite: siteFiles, referencedInSql: sqlRef, fkIn: inFk, fkOut: [...(fkOut[t.name] || [])], triggers: trig.map((x) => x.name),
        };
        n.district = pick(TABLE_DISTRICT, t.name) || majorityDistrict(users, nodes) || (siteFiles.length ? 'access' : null) || 'other';

        if (!t.rls) n.flag('bad', 'Не включена защита строк (RLS): таблица открыта для чтения и записи через API по правам роли.');
        if (refs === 0 && t.rows === 0 && Number(t.writes) === 0) n.flag('unused', 'Пустая, в неё ничего не пишут и её никто не читает: ни функции, ни сайт, ни база.');
        else if (refs === 0 && t.rows > 0) n.flag('warn', 'В таблице есть данные, но её не читают ни функции, ни сайт, ни база. Забытые данные?');
        else if (refs === 0) n.flag('unused', 'Никто не читает: ни функции, ни сайт, ни база.');
    }

    // ── Функции базы (SQL) ──
    const cronText = snap.cron.map((c) => c.command || '').join('\n');
    const rpcFromFns = new Map();
    for (const f of [...snap.functions, ...repoFacts]) for (const r of f.rpcs) (rpcFromFns.get(r) || rpcFromFns.set(r, []).get(r)).push(f.slug);
    const trigFns = new Set([...snap.triggers.map((t) => t.fn), ...(snap.eventTriggers || []).map((t) => t.fn)]);
    for (const s of snap.sqlfns) {
        const n = add(new Node(`sql:${s.name}`, 'sqlfn', s.name + '()'));
        const asTrigger = trigFns.has(s.name);
        const otherFns = snap.sqlfns.filter((o) => o.name !== s.name && wordRe(s.name).test(o.src || '')).map((o) => o.name);
        const used = {
            trigger: asTrigger, cron: wordRe(s.name).test(cronText), policy: wordRe(s.name).test(policyText),
            view: snap.views.some((v) => wordRe(s.name).test(v.definition || '')), sql: otherFns,
            rpcFunctions: rpcFromFns.get(s.name) || [], rpcSite: Object.keys(snap.site?.rpcs || {}).includes(s.name),
        };
        n.meta = { args: s.args, returns: s.ret, securityDefiner: s.definer, usedAs: used };
        n.subtitle = asTrigger ? 'триггер' : s.definer ? 'security definer' : 'функция базы';
        const anyUse = asTrigger || used.cron || used.policy || used.view || otherFns.length || used.rpcFunctions.length || used.rpcSite;
        n.district = pick(SQLFN_DISTRICT, s.name) || 'core';
        if (!anyUse) n.flag('unused', 'Нигде не вызывается: ни триггером (в том числе событийным), ни cron, ни политикой, ни другими функциями базы, ни функциями Supabase, ни сайтом.');
    }

    // ── Секреты (только имена) ──
    const secretUsers = {};
    const secretHasDefault = {};
    for (const f of [...snap.functions, ...repoFacts]) {
        for (const s of f.secrets) (secretUsers[s] = secretUsers[s] || []).push(f.slug);
        for (const s of f.secretsWithDefault || []) secretHasDefault[s] = true;
    }
    const secretNames = new Set(snap.secrets.map((s) => s.name));
    for (const s of snap.secrets) {
        if (/^SUPABASE_/.test(s.name)) continue;
        const n = add(new Node(`secret:${s.name}`, 'secret', s.name));
        const users = secretUsers[s.name] || [];
        n.district = 'secrets';
        n.subtitle = users.length ? `читают ${users.length}` : 'не используется';
        n.meta = { usedBy: users, updatedAt: s.updatedAt };
        if (!users.length) n.flag('unused', 'Ни одна функция не читает этот секрет.');
    }
    for (const [name, users] of Object.entries(secretUsers)) {
        if (secretNames.has(name) || /^SUPABASE_/.test(name)) continue;
        if (secretHasDefault[name]) continue; // необязательная настройка: в коде есть значение по умолчанию
        if (!/(TOKEN|KEY|SECRET|PASSWORD|CREDENTIAL|JSON)/.test(name)) continue; // пороги и флаги (DRY_RUN, MAX_*) не секреты
        const n = add(new Node(`secret:${name}`, 'secret', name));
        n.district = 'secrets';
        n.subtitle = 'не задан';
        n.meta = { usedBy: users, missing: true };
        n.flag('warn', 'Код читает этот секрет, а в Supabase его нет: работает значение по умолчанию либо функция не сработает.');
    }

    // ── Внешние сервисы ──
    const svcUsers = {};
    for (const f of [...snap.functions, ...repoFacts]) for (const i of f.integrations) (svcUsers[i] = svcUsers[i] || []).push(f.slug);
    for (const [name, users] of Object.entries(svcUsers)) {
        const n = add(new Node(`svc:${name}`, 'service', name));
        n.district = 'services';
        n.subtitle = `${users.length} функций`;
        n.meta = { usedBy: users };
    }

    // ── Боты и агенты ──
    for (const b of snap.bots || []) {
        const n = add(new Node(`bot:${b.id}`, 'bot', b.title));
        n.district = 'telegram';
        n.subtitle = b.notes || (b.username ? '@' + b.username : b.kind);
        n.meta = { kind: b.kind, username: b.username, enabled: b.is_enabled, deleted: b.deleted, webhook: b.webhook_path };
        if (b.deleted) n.flag('unused', 'Удалён из админки.');
        else if (!b.is_enabled) n.flag('warn', 'Бот выключен.');
    }
    for (const [key, a] of Object.entries(AGENTS)) {
        const n = add(new Node(`agent:${key}`, 'agent', a.title));
        n.district = 'agents';
        n.subtitle = a.role;
        n.meta = { functions: a.fns.filter((s) => allFnSlugs.has(s)) };
    }

    // ── Связи ──
    for (const c of snap.cron) {
        const target = cronTargets.get(c.name);
        if (target && nodes.has(`fn:${target}`)) link(`cron:${c.name}`, `fn:${target}`, 'schedules');
        else if (!target) for (const s of nodes.get(`cron:${c.name}`).meta.sqlTargets || []) link(`cron:${c.name}`, `sql:${s}`, 'schedules');
    }
    for (const f of [...snap.functions, ...repoFacts]) {
        for (const t of f.tables) link(`fn:${f.slug}`, `tbl:${t}`, 'uses');
        for (const c of f.calls || []) link(`fn:${f.slug}`, `fn:${c}`, 'calls');
        for (const r of f.rpcs) link(`fn:${f.slug}`, `sql:${r}`, 'uses');
        for (const s of f.secrets) link(`secret:${s}`, `fn:${f.slug}`, 'reads', { weak: true });
        for (const i of f.integrations || []) link(`fn:${f.slug}`, `svc:${i}`, 'calls', { weak: true });
    }
    for (const slug of Object.keys(snap.site?.calls || {})) link('site:main', `fn:${slug}`, 'calls');
    for (const t of Object.keys(snap.site?.tables || {})) link('site:main', `tbl:${t}`, 'uses', { weak: true });
    for (const r of Object.keys(snap.site?.rpcs || {})) link('site:main', `sql:${r}`, 'uses', { weak: true });
    for (const fk of snap.fks) link(`tbl:${fk.src}`, `tbl:${fk.dst}`, 'fk', { weak: true });
    for (const t of snap.triggers) link(`tbl:${t.tbl}`, `sql:${t.fn}`, 'trigger');
    for (const b of snap.bots || []) {
        const slug = String(b.webhook_path || '').split('?')[0];
        if (slug) link(`bot:${b.id}`, `fn:${slug}`, 'webhook');
    }
    for (const [key, a] of Object.entries(AGENTS)) for (const s of a.fns) link(`agent:${key}`, `fn:${s}`, 'runs');
    link('bot:karina', 'agent:karina', 'link');
    for (const s of snap.sqlfns) for (const t of snap.tables) {
        if (s.src && wordRe(t.name).test(s.src) && !trigFns.has(s.name)) link(`sql:${s.name}`, `tbl:${t.name}`, 'uses', { weak: true });
    }

    const list = [...nodes.values()];
    return { nodes: list, edges, summary: summarize(list) };
}

function majorityDistrict(slugs, nodes) {
    const count = {};
    for (const s of slugs) {
        const d = nodes.get(`fn:${s}`)?.district;
        if (d && d !== 'other') count[d] = (count[d] || 0) + 1;
    }
    const best = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
    return best ? best[0] : null;
}

/** Итоги для отчёта владельцу: что мусор, что сбоит, где нет исходников. */
function summarize(nodes) {
    const by = (kind, status) => nodes.filter((n) => n.kind === kind && n.status === status).map((n) => n.title);
    return {
        total: nodes.length,
        byKind: nodes.reduce((a, n) => ((a[n.kind] = (a[n.kind] || 0) + 1), a), {}),
        unusedFunctions: by('function', 'unused'),
        unusedTables: by('table', 'unused'),
        forgottenDataTables: nodes.filter((n) => n.kind === 'table' && n.status === 'warn' && n.meta.rows > 0 && !n.meta.usedByFunctions.length && !n.meta.usedBySite.length).map((n) => n.title),
        unusedSqlFunctions: by('sqlfn', 'unused'),
        unusedSecrets: by('secret', 'unused'),
        missingSecrets: nodes.filter((n) => n.kind === 'secret' && n.meta.missing).map((n) => n.title),
        badCron: by('cron', 'bad'),
        noRepo: nodes.filter((n) => n.kind === 'function' && n.meta.deployed && !n.meta.inRepo).map((n) => n.title),
        notDeployed: nodes.filter((n) => n.kind === 'function' && n.meta.deployed === false).map((n) => n.title),
        hardcodedKey: nodes.filter((n) => n.kind === 'function' && (n.reasons || []).some((r) => r.startsWith('В коде зашито'))).map((n) => n.title),
        noRls: nodes.filter((n) => n.kind === 'table' && n.meta.rls === false).map((n) => n.title),
    };
}

module.exports = { buildGraph, humanCron, humanRows, DISTRICTS, AGENTS, EXTERNAL_ENTRY, summarize };

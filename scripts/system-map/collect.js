'use strict';
/**
 * Сбор «снимка системы»: что реально есть и работает.
 * Только чтение. Значения секретов не читаются: Management API отдаёт имена и контрольные суммы,
 * контрольные суммы мы тоже выбрасываем.
 */
const fs = require('fs');
const path = require('path');
const { projectModules } = require('./eszip');
const { extractFacts, mergeFacts, functionCalls, findHardcodedSecrets, envWithDefault, secretMentions } = require('./scan');

const REF = 'fiukyfyhotctvfdidktx';
const API = 'https://api.supabase.com';

function client(token) {
    async function call(method, p, body, raw) {
        for (let i = 0; i < 6; i++) {
            const res = await fetch(API + p, {
                method,
                headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'User-Agent': 'curl/8' },
                body: body ? JSON.stringify(body) : undefined,
            });
            if (res.status === 500) { await new Promise((r) => setTimeout(r, 3000)); continue; }
            if (!res.ok) throw new Error(`${p}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
            return raw ? Buffer.from(await res.arrayBuffer()) : res.json();
        }
        throw new Error(`${p}: Supabase не ответил`);
    }
    return {
        functions: () => call('GET', `/v1/projects/${REF}/functions`),
        functionBody: (slug) => call('GET', `/v1/projects/${REF}/functions/${slug}/body`, null, true),
        secrets: () => call('GET', `/v1/projects/${REF}/secrets`),
        sql: (query) => call('POST', `/v1/projects/${REF}/database/query`, { query }),
    };
}

/** Файлы сайта и репозитория, которые обращаются к функциям и таблицам. Без тестов, сборки и зависимостей. */
function siteFiles(root) {
    const out = [];
    const skip = new Set(['node_modules', 'dist', '.git', 'supabase', 'docs', 'reports', 'marking-app', 'frontend', 'backend', 'scripts']);
    for (const name of fs.readdirSync(root)) {
        if (skip.has(name)) continue;
        const full = path.join(root, name);
        const st = fs.statSync(full);
        if (st.isFile() && /\.(html|js)$/.test(name) && !/_test\.js$/.test(name) && !/\.min\./.test(name)) out.push(full);
    }
    return out;
}

function scanSite(root, knownSlugs) {
    const calls = new Map();   // slug -> Set(файлы)
    const tables = new Map();  // таблица -> Set(файлы)
    const rpcs = new Map();
    for (const file of siteFiles(root)) {
        const text = fs.readFileSync(file, 'utf8');
        const rel = path.relative(root, file);
        for (const slug of functionCalls(text, knownSlugs)) calls.set(slug, (calls.get(slug) || new Set()).add(rel));
        const f = extractFacts(text);
        for (const t of f.tables) tables.set(t, (tables.get(t) || new Set()).add(rel));
        for (const r of f.rpcs) rpcs.set(r, (rpcs.get(r) || new Set()).add(rel));
    }
    const plain = (m) => Object.fromEntries([...m].map(([k, v]) => [k, [...v].sort()]));
    return { calls: plain(calls), tables: plain(tables), rpcs: plain(rpcs) };
}

const SQL = {
    tables: `
        select c.relname as name, c.relrowsecurity as rls,
               (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)::int as policies,
               pg_total_relation_size(c.oid)::bigint as bytes,
               coalesce(s.n_tup_ins + s.n_tup_upd + s.n_tup_del, 0)::bigint as writes,
               (select count(*) from information_schema.columns col where col.table_schema = 'public' and col.table_name = c.relname)::int as cols
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          left join pg_stat_user_tables s on s.relid = c.oid
         where n.nspname = 'public' and c.relkind in ('r', 'p')
         order by c.relname`,
    fks: `
        select conrelid::regclass::text as src, confrelid::regclass::text as dst
          from pg_constraint where contype = 'f' and connamespace = 'public'::regnamespace`,
    views: `select viewname as name, definition from pg_views where schemaname = 'public'`,
    sqlfns: `
        select p.proname as name, pg_get_function_identity_arguments(p.oid) as args,
               p.prosecdef as definer, pg_get_function_result(p.oid) as ret, p.prosrc as src
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.prokind = 'f'
           and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
         order by p.proname`,
    eventTriggers: `select e.evtname as name, p.proname as fn from pg_event_trigger e join pg_proc p on p.oid = e.evtfoid`,
    triggers: `
        select t.tgname as name, t.tgrelid::regclass::text as tbl, p.proname as fn
          from pg_trigger t join pg_proc p on p.oid = t.tgfoid
         where not t.tgisinternal`,
    policies: `select tablename, coalesce(qual, '') as qual, coalesce(with_check, '') as with_check from pg_policies where schemaname = 'public'`,
    cron: `
        select j.jobid, j.jobname as name, j.schedule, j.active, j.command,
               (select d.status from cron.job_run_details d where d.jobid = j.jobid order by d.start_time desc limit 1) as last_status,
               (select d.start_time from cron.job_run_details d where d.jobid = j.jobid order by d.start_time desc limit 1) as last_run,
               (select left(d.return_message, 160) from cron.job_run_details d where d.jobid = j.jobid order by d.start_time desc limit 1) as last_message
          from cron.job j order by j.jobname`,
    bots: `select id, kind, title, username, is_enabled, deleted_at is not null as deleted, webhook_path, notes from telegram_bots order by kind, id`,
};

/** Функции, которые есть в репозитории: файл index.ts и то, что он импортирует из _shared. */
function repoFunctionSources(root, slug) {
    const base = path.join(root, 'supabase', 'functions');
    const seen = new Map();
    const queue = [path.join(slug, 'index.ts')];
    while (queue.length) {
        const rel = path.normalize(queue.pop());
        if (seen.has(rel)) continue;
        const file = path.join(base, rel);
        if (!fs.existsSync(file)) continue;
        const src = fs.readFileSync(file, 'utf8');
        seen.set(rel, src);
        for (const m of src.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)) queue.push(path.join(path.dirname(rel), m[1]));
    }
    return [...seen].map(([specifier, source]) => ({ specifier, source }));
}

function repoFunctionSlugs(root) {
    const base = path.join(root, 'supabase', 'functions');
    return fs.readdirSync(base).filter((d) => d !== '_shared' && fs.existsSync(path.join(base, d, 'index.ts')));
}

async function exactCounts(api, names) {
    // Один запрос с точными числами строк: оценка pg_class для не анализированных таблиц даёт -1.
    const out = {};
    for (let i = 0; i < names.length; i += 40) {
        const chunk = names.slice(i, i + 40);
        const q = chunk.map((n) => `select '${n}' as t, count(*)::bigint as c from public."${n}"`).join(' union all ');
        const rows = await api.sql(q);
        for (const r of rows) out[r.t] = Number(r.c);
    }
    return out;
}

async function collect(token, root) {
    const api = client(token);
    const [fnList, secretList] = await Promise.all([api.functions(), api.secrets()]);
    const knownSlugs = fnList.map((f) => f.slug);

    const secretNames = secretList.map((s) => s.name).filter((n) => !/^SUPABASE_/.test(n));
    const functions = [];
    for (const f of fnList) {
        const mods = projectModules(await api.functionBody(f.slug));
        const facts = mergeFacts(mods.map((m) => extractFacts(m.source)));
        const text = mods.map((m) => m.source).join('\n');
        const defaults = new Set(mods.flatMap((m) => [...envWithDefault(m.source)]));
        for (const n of secretMentions(text, secretNames)) facts.secrets.add(n);
        const calls = [...functionCalls(text, knownSlugs.filter((s) => s !== f.slug))];
        const hardcoded = [...new Set(mods.flatMap((m) => findHardcodedSecrets(m.source)))];
        functions.push({
            slug: f.slug,
            version: f.version,
            verifyJwt: f.verify_jwt !== false,
            updatedAt: f.updated_at ? new Date(Number(f.updated_at)).toISOString() : null,
            inRepo: fs.existsSync(path.join(root, 'supabase', 'functions', f.slug, 'index.ts')),
            files: mods.length,
            tables: [...facts.tables].sort(),
            rpcs: [...facts.rpcs].sort(),
            secrets: [...facts.secrets].filter((s) => !/^SUPABASE_/.test(s)).sort(),
            secretsWithDefault: [...defaults].filter((s) => !/^SUPABASE_/.test(s)).sort(),
            buckets: [...facts.buckets].sort(),
            integrations: [...facts.integrations].sort(),
            calls: calls.sort(),
            hardcoded,
            modules: mods, // исходники нужны только для снимка репозитория, в базу не уходят
        });
    }

    // Функции, которые есть только в репозитории (не задеплоены): их таблицы и секреты тоже «используются».
    const repoOnly = [];
    for (const slug of repoFunctionSlugs(root)) {
        if (fnList.some((f) => f.slug === slug)) continue;
        const mods = repoFunctionSources(root, slug);
        const facts = mergeFacts(mods.map((m) => extractFacts(m.source)));
        const text = mods.map((m) => m.source).join('\n');
        for (const n of secretMentions(text, secretNames)) facts.secrets.add(n);
        repoOnly.push({
            slug, tables: [...facts.tables].sort(), rpcs: [...facts.rpcs].sort(),
            secrets: [...facts.secrets].filter((s) => !/^SUPABASE_/.test(s)).sort(),
            secretsWithDefault: [...mods.reduce((a, m) => { for (const x of envWithDefault(m.source)) a.add(x); return a; }, new Set())],
            integrations: [...facts.integrations].sort(), calls: [...functionCalls(text, knownSlugs)].sort(),
        });
    }

    const tables = await api.sql(SQL.tables);
    const counts = await exactCounts(api, tables.map((t) => t.name));
    for (const t of tables) t.rows = counts[t.name] ?? 0;

    const snapshot = {
        generatedAt: new Date().toISOString(),
        functions,
        secrets: secretList.map((s) => ({ name: s.name, updatedAt: s.updated_at || null })), // значения НЕ берём
        tables,
        fks: await api.sql(SQL.fks),
        views: await api.sql(SQL.views),
        sqlfns: await api.sql(SQL.sqlfns),
        triggers: await api.sql(SQL.triggers),
        eventTriggers: await api.sql(SQL.eventTriggers),
        repoOnly,
        policies: await api.sql(SQL.policies),
        cron: await api.sql(SQL.cron),
        bots: await api.sql(SQL.bots),
        site: scanSite(root, knownSlugs),
    };
    return { snapshot, api };
}

module.exports = { collect, client, scanSite, SQL, REF };

#!/usr/bin/env node
'use strict';
/**
 * Оцифровка системы → карта в базе (admin_map_nodes / admin_map_edges).
 *
 *   SUPABASE_ACCESS_TOKEN=... node scripts/system-map/sync.js            обновить карту
 *   SUPABASE_ACCESS_TOKEN=... node scripts/system-map/sync.js --dry      только показать итоги, ничего не писать
 *   SUPABASE_ACCESS_TOKEN=... node scripts/system-map/sync.js --snapshots   ещё снять исходники боевых функций,
 *                                                                         которых нет в репозитории (зашитые ключи вырезаются)
 *
 * Пишет ТОЛЬКО в admin_map_*. Ничего в системе не удаляет и не меняет. Положения узлов, пометки и
 * ваши заметки повторный запуск не перезаписывает. Токены и значения секретов не читаются.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { collect } = require('./collect');
const { buildGraph } = require('./graph');
const { layout } = require('./layout');
const { redactSecrets } = require('./scan');

const ROOT = path.resolve(__dirname, '..', '..');
const SYNC_KINDS = ['function', 'sqlfn', 'cron', 'table', 'secret', 'service', 'bot', 'agent', 'site'];
const SYNC_EDGE_KINDS = ['schedules', 'calls', 'uses', 'reads', 'fk', 'webhook', 'runs', 'trigger', 'link'];

const lit = (v) => 'E' + "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "''") + "'";

/** JSON в SQL через долларовые кавычки со случайной меткой. */
function jsonArg(value) {
    const text = JSON.stringify(value);
    let tag;
    do { tag = '$j' + crypto.randomBytes(4).toString('hex') + '$'; } while (text.includes(tag));
    return `${tag}${text}${tag}::jsonb`;
}

function chunks(list, size) {
    const out = [];
    for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
    return out;
}

async function writeMap(api, graph, generatedAt) {
    const existing = await api.sql('select ref from admin_map_nodes');
    const known = new Map(existing.map((r) => [r.ref, true]));
    const positions = layout(graph.nodes, known);

    const rows = graph.nodes.map((n) => ({
        ref: n.ref, kind: n.kind, title: n.title, subtitle: n.subtitle || '', district: n.district, status: n.status,
        reasons: n.reasons, meta: n.meta, x: positions.get(n.ref)?.x ?? 0, y: positions.get(n.ref)?.y ?? 0,
    }));
    for (const part of chunks(rows, 60)) {
        await api.sql(`
            insert into admin_map_nodes (ref, kind, title, subtitle, district, status, reasons, meta, x, y, auto, seen_at)
            select t.ref, t.kind, t.title, t.subtitle, t.district, t.status,
                   array(select jsonb_array_elements_text(t.reasons)), t.meta, t.x, t.y, true, now()
              from jsonb_to_recordset(${jsonArg(part)}) as t(ref text, kind text, title text, subtitle text, district text,
                                                              status text, reasons jsonb, meta jsonb, x float8, y float8)
            on conflict (ref) do update set
                kind = excluded.kind, title = excluded.title, subtitle = excluded.subtitle, district = excluded.district,
                status = excluded.status, reasons = excluded.reasons, meta = excluded.meta, seen_at = now()
              where admin_map_nodes.auto`);
    }

    // Автоматические узлы, которых в системе больше нет, убираем с карты (положения и пометки у них исчезают вместе с ними).
    const refs = graph.nodes.map((n) => n.ref);
    await api.sql(`
        delete from admin_map_nodes
         where auto and kind in (${SYNC_KINDS.map(lit).join(',')})
           and ref <> all (array(select jsonb_array_elements_text(${jsonArg(refs)})))`);

    await api.sql(`delete from admin_map_edges where auto and kind in (${SYNC_EDGE_KINDS.map(lit).join(',')})`);
    const edgeRows = graph.edges.map((e) => ({ from_ref: e.from, to_ref: e.to, kind: e.kind, label: e.label, weak: e.weak }));
    for (const part of chunks(edgeRows, 350)) {
        await api.sql(`
            insert into admin_map_edges (source, target, kind, label, weak, auto)
            select s.id, t.id, e.kind, e.label, e.weak, true
              from jsonb_to_recordset(${jsonArg(part)}) as e(from_ref text, to_ref text, kind text, label text, weak boolean)
              join admin_map_nodes s on s.ref = e.from_ref
              join admin_map_nodes t on t.ref = e.to_ref
            on conflict (source, target, kind) do nothing`);
    }

    await api.sql(`
        insert into admin_map_meta (key, value, updated_at)
        values ('last_sync', ${jsonArg({ at: generatedAt, nodes: graph.nodes.length, edges: graph.edges.length, summary: graph.summary })}, now())
        on conflict (key) do update set value = excluded.value, updated_at = now()`);
}

/** Снимок исходников функций, которых нет в репозитории (задача F2). Зашитые ключи вырезаются. */
function writeSnapshots(functions) {
    const dir = path.join(ROOT, 'supabase', 'live-snapshot');
    const lines = [];
    for (const f of functions.filter((x) => !x.inRepo)) {
        for (const m of f.modules) {
            if (/^(https?:|---)/.test(m.specifier)) continue;
            const rel = m.specifier.startsWith('_shared/') ? path.join(f.slug, m.specifier) : m.specifier === 'index.ts' ? path.join(f.slug, 'index.ts') : m.specifier;
            const out = path.join(dir, rel);
            fs.mkdirSync(path.dirname(out), { recursive: true });
            const header = `// СНИМОК боевой функции «${f.slug}» (версия ${f.version}), снят ${new Date().toISOString().slice(0, 10)}.\n// Это скомпилированный код из Supabase, не исходник для деплоя. Зашитые ключи вырезаны.\n`;
            fs.writeFileSync(out, header + redactSecrets(m.source));
        }
        lines.push(`- \`${f.slug}\`: версия ${f.version}, ${f.files} файл(ов)${f.hardcoded.length ? ', в коде были зашитые значения: ' + f.hardcoded.join(', ') : ''}`);
    }
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'README.md'), [
        '# Снимок боевых функций без исходников',
        '',
        'Эти функции работают в Supabase, но исходников в `supabase/functions` у них нет. Здесь лежит то, что реально запущено,',
        'чтобы можно было прочитать и при необходимости вернуть в репозиторий. Это скомпилированный код: не деплоить отсюда.',
        'Зашитые ключи вырезаны. Обновляется командой `node scripts/system-map/sync.js --snapshots`.',
        '',
        ...lines,
        '',
    ].join('\n'));
    return lines.length;
}

async function main() {
    const token = process.env.SUPABASE_ACCESS_TOKEN;
    if (!token) { console.error('Нужна переменная SUPABASE_ACCESS_TOKEN'); process.exit(1); }
    const dry = process.argv.includes('--dry');
    const { snapshot, api } = await collect(token, ROOT);
    const graph = buildGraph(snapshot);

    console.log(`Оцифровано: ${graph.nodes.length} узлов, ${graph.edges.length} связей`);
    console.log('По видам:', JSON.stringify(graph.summary.byKind));
    for (const [k, v] of Object.entries(graph.summary)) if (Array.isArray(v) && v.length) console.log(`  ${k} (${v.length}): ${v.join(', ')}`);

    if (process.argv.includes('--snapshots')) console.log(`Снимок исходников: ${writeSnapshots(snapshot.functions)} функций`);
    if (dry) { console.log('--dry: в базу ничего не записано'); return; }
    await writeMap(api, graph, snapshot.generatedAt);
    console.log('Карта записана в admin_map_nodes / admin_map_edges');
}

if (require.main === module) main().catch((e) => { console.error('ОШИБКА:', e.message); process.exit(1); });

module.exports = { jsonArg, writeMap, writeSnapshots, chunks };

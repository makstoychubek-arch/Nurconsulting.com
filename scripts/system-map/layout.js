'use strict';
/**
 * Раскладка карты: районы (реклама, отзывы, РНП...) внутри каждого четыре «дорожки» слева направо:
 * cron → функции → таблицы → функции базы. Кандидаты на уборку идут в конце своей дорожки,
 * чтобы мусор собирался кучкой. Положения только для узлов, у которых их ещё нет: то, что вы
 * подвинули руками, повторная оцифровка не трогает.
 */

const SIZE = {
    function: [230, 62], cron: [220, 54], table: [220, 54], sqlfn: [220, 54], secret: [200, 46], service: [200, 54],
    bot: [220, 56], agent: [220, 64], site: [260, 72], client: [240, 64], cabinet: [220, 56], note: [200, 80],
};
const GAP_X = 26, GAP_Y = 22, LANE_GAP = 110, TITLE_H = 86, DISTRICT_GAP = 170, ROW_LIMIT = 5600;
const LANES = ['cron', 'function', 'table', 'sqlfn', 'bot', 'agent', 'service', 'secret', 'site'];
const ORDER = ['site', 'agents', 'telegram', 'access', 'ads', 'reviews', 'rnp', 'ab', 'content', 'warehouse', 'core', 'other', 'services', 'secrets'];
const SEVERITY = { ok: 0, unknown: 1, warn: 2, bad: 3, unused: 4 };

function laneCols(kind, n) {
    if (kind === 'secret') return Math.min(10, Math.max(4, Math.ceil(Math.sqrt(n * 2.2))));
    if (kind === 'table') return n > 28 ? 4 : n > 14 ? 3 : n > 6 ? 2 : 1;
    if (kind === 'function') return n > 18 ? 3 : n > 8 ? 2 : 1;
    if (kind === 'sqlfn') return n > 12 ? 2 : 1;
    if (kind === 'cron') return n > 14 ? 2 : 1;
    return n > 6 ? 2 : 1;
}

function districtBlock(nodes) {
    const lanes = LANES.map((kind) => [kind, nodes.filter((n) => n.kind === kind)]).filter(([, l]) => l.length);
    const placements = [];
    let x = 0, height = 0;
    for (const [kind, list] of lanes) {
        list.sort((a, b) => (SEVERITY[a.status] >= 4) - (SEVERITY[b.status] >= 4) || a.title.localeCompare(b.title));
        const [w, h] = SIZE[kind];
        const cols = laneCols(kind, list.length);
        const rows = Math.ceil(list.length / cols);
        list.forEach((n, i) => {
            placements.push([n.ref, x + (i % cols) * (w + GAP_X), TITLE_H + Math.floor(i / cols) * (h + GAP_Y)]);
        });
        x += cols * (w + GAP_X) - GAP_X + LANE_GAP;
        height = Math.max(height, TITLE_H + rows * (h + GAP_Y) - GAP_Y);
    }
    return { width: Math.max(0, x - LANE_GAP), height, placements };
}

/** Возвращает Map(ref -> {x, y}) для узлов без сохранённого положения. */
function layout(nodes, existing = new Map()) {
    const byDistrict = new Map();
    for (const n of nodes) (byDistrict.get(n.district || 'other') || byDistrict.set(n.district || 'other', []).get(n.district || 'other')).push(n);
    const names = [...ORDER.filter((d) => byDistrict.has(d)), ...[...byDistrict.keys()].filter((d) => !ORDER.includes(d))];

    const blocks = names.map((d) => [d, districtBlock(byDistrict.get(d))]);
    const out = new Map();
    let x = 0, y = 0, rowH = 0;
    for (const [, b] of blocks) {
        if (x > 0 && x + b.width > ROW_LIMIT) { x = 0; y += rowH + DISTRICT_GAP; rowH = 0; }
        for (const [ref, dx, dy] of b.placements) if (!existing.has(ref)) out.set(ref, { x: x + dx, y: y + dy });
        x += b.width + DISTRICT_GAP;
        rowH = Math.max(rowH, b.height);
    }
    return out;
}

module.exports = { layout, SIZE };

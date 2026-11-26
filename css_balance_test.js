/**
 * Скобки в CSS-файлах сбалансированы. Потерянная «}» тихо превращает всё, что ниже, в содержимое чужого @media:
 * так «живое стекло» и затемнение шапки перестали работать на ПК (21 ноября 2026).
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
for (const f of ['nr-mono.css', 'nr-motion.css', 'rnp-extra.css', 'cabinets-hub.css', 'nr-admin.css']) {
    const p = path.join(__dirname, f);
    if (!fs.existsSync(p)) continue;
    const s = fs.readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|url\([^)]*\)/g, '');
    let depth = 0, line = 1, firstBad = 0;
    for (const ch of s) {
        if (ch === '\n') line++;
        else if (ch === '{') depth++;
        else if (ch === '}') { depth--; if (depth < 0 && !firstBad) firstBad = line; }
    }
    assert.strictEqual(depth, 0, `${f}: скобки не сходятся (разница ${depth}${firstBad ? ', лишняя } около строки ' + firstBad : ''})`);
}
console.log('css_balance_test: ok');

#!/usr/bin/env node
/**
 * Статический бюджет скорости + опциональный Unlighthouse/LHCI.
 * По умолчанию не ходит в сеть и не поднимает Chrome.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'dashboard.html'), 'utf8');
const cssHref = html.match(/href="(\/dist\/tailwind\.[0-9a-f]+\.min\.css)"/);
assert.ok(cssHref, 'dashboard must use hashed tailwind, not cdn.tailwindcss.com');
assert.ok(!html.includes('cdn.tailwindcss.com'), 'runtime Tailwind CDN is banned');
assert.ok(html.includes('preconnect'), 'fonts/CDN must preconnect');

const distScripts = [...html.matchAll(/src="\/dist\/([^"]+\.min\.js)"/g)].map((m) => m[1]);
assert.ok(distScripts.length >= 5, 'hashed dashboard scripts must be present');

let jsBytes = 0;
for (const name of distScripts) {
    const p = path.join(ROOT, 'dist', name);
    if (!fs.existsSync(p)) continue;
    jsBytes += fs.statSync(p).size;
}
const htmlBytes = Buffer.byteLength(html);
assert.ok(htmlBytes < 1_200_000, `dashboard.html ${htmlBytes} is over 1.2MB`);
console.log(`[perf-audit] dashboard.html ${(htmlBytes / 1024).toFixed(0)} KB, dist js ${(jsBytes / 1024).toFixed(0)} KB, ${distScripts.length} scripts`);

if (process.env.PERF_LIVE === '1') {
    const { spawnSync } = require('child_process');
    const site = process.env.PERF_SITE || 'http://127.0.0.1:4173';
    console.log('[perf-audit] unlighthouse', site);
    const r = spawnSync('npx', ['--yes', 'unlighthouse-ci', '--site', site], {
        cwd: ROOT,
        stdio: 'inherit',
        env: process.env,
    });
    process.exit(r.status || 0);
}
console.log('perf-audit: ok');

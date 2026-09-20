'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const NrWow = require('./nr-wow.js');

assert.strictEqual(NrWow.parseLoose('13 517 сом'), 13517);
assert.strictEqual(NrWow.parseLoose('−1 100,5'), -1100.5);
assert.strictEqual(NrWow.parseLoose('—'), null);
assert.strictEqual(NrWow.digitsOf('1 100 440 шт.'), '1100440');
assert.strictEqual(NrWow.reduced(), false);

let ran = 0;
NrWow.withView(() => { ran += 1; });
assert.strictEqual(ran, 1, 'withView falls back when View Transitions are absent');

NrWow.burst();
NrWow.spotlight(null);
NrWow.tickSpan(null, '1', '2');
NrWow.tickText(null, '2');

const src = fs.readFileSync(path.join(__dirname, 'nr-wow.js'), 'utf8');
assert.ok(src.includes('barvian/number-flow'), 'cites NumberFlow as the digit-reel idea');
assert.ok(src.includes('canvas-confetti'), 'cites canvas-confetti as the burst idea');
assert.ok(src.includes('prefers-reduced-motion'), 'respects reduced motion');
assert.ok(!src.includes('particles.js') && !src.includes('gsap'), 'does not pull particles.js or GSAP');
assert.ok(src.includes('rnp-sheet-table'), 'spotlight skips the RNP sheet');

const html = fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8');
assert.ok(/<script src="\/(?:dist\/)?nr-wow(?:\.[0-9a-f]+)?(?:\.min)?\.js"><\/script>/.test(html),
    'nr-wow is loaded on the dashboard');
assert.ok(html.includes('NrWow.tickSpan') && html.includes('NrWow.withView') && html.includes('NrWow.spotlight') && html.includes('NrWow.burst'),
    'dashboard wires tick, tab view, spotlight and success burst');
assert.ok(html.includes("getElementById('abtest-card-' + testId)"),
    'A/B winner pulse targets the live card id');
assert.ok(html.includes('.nr-wow-col') && html.includes('.nr-wow-spot') && html.includes('@keyframes nr-wow-pulse'),
    'dashboard CSS hosts the reel, spotlight and winner pulse');

const rnp = fs.readFileSync(path.join(__dirname, 'rnp-module.js'), 'utf8');
assert.ok(rnp.includes("dst.matches('.rnp-stock-donut-center b, .rnp-gs-money-val, .rnp-kpi b')"),
    'RNP ticks donut and hero KPIs, not the sheet table');

const ads = fs.readFileSync(path.join(__dirname, 'ads-command-center.js'), 'utf8');
assert.ok(ads.includes('NrWow.tickText'), 'ads HQ tiles tick like dashboard numbers');

console.log('nr-wow_test: ok');

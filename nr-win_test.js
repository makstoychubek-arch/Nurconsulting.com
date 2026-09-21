'use strict';

const assert = require('assert');
const W = require('./nr-win.js');

assert.strictEqual(W.DEFAULT_W, 480);
assert.strictEqual(W.DEFAULT_H, 520);
assert.strictEqual(W.KEY, 'nr_win_size');

assert.deepStrictEqual(W.clamp({ w: 10, h: 10 }, 1200, 800), { w: 320, h: 280 });
assert.deepStrictEqual(W.clamp({ w: 2000, h: 2000 }, 1000, 800), { w: 976, h: 776 });
assert.deepStrictEqual(W.clamp({ w: 480, h: 520 }, 1200, 800), { w: 480, h: 520 });

assert.deepStrictEqual(W.parseSize('{"w":640,"h":400}'), W.clamp({ w: 640, h: 400 }));
assert.deepStrictEqual(W.parseSize('nope'), W.clamp({ w: 480, h: 520 }));
assert.deepStrictEqual(W.parseSize(''), W.clamp({ w: 480, h: 520 }));
assert.deepStrictEqual(W.parseSize({ w: 500, h: 500 }), W.clamp({ w: 500, h: 500 }));

const html = require('fs').readFileSync(require('path').join(__dirname, 'dashboard.html'), 'utf8');
assert.ok(html.includes('--nr-win-w: 480px') && html.includes('--nr-win-h: 520px'),
    'default modal size matches the A/B sheet');
assert.ok(html.includes('.nr-win-dot') && html.includes('#ff5f57') && html.includes('#febc2e') && html.includes('#28c840'),
    'Mac traffic lights are red / yellow / green');
assert.ok(html.includes('nr_win_size') && html.includes('function mountNrGlass'),
    'one remembered size is restored before paint and applied when a modal mounts');
assert.ok(html.includes('nr-win-resize-se') && html.includes('nr-win-bar'),
    'windows resize from edges like a Mac window');
assert.ok(
    /<script src="\/(?:dist\/)?nr-win(?:\.[0-9a-f]+)?(?:\.min)?\.js"><\/script>/.test(html),
    'nr-win script is on the dashboard'
);
assert.ok(!html.includes('#rnp-settings-overlay > .rnp-settings-dialog {\n            width: 100%; height: 100%;'),
    'RNP settings is a shared window, not a full-page sheet');
assert.ok(!html.includes('body.rnp-settings-open .rnp-workspace'),
    'a windowed settings dialog must not hide the RNP sheet behind the glass');
assert.ok(html.includes('class="nr-win nr-win-photo"') || html.includes('class="nr-win-photo nr-win"'),
    'photo lightbox uses the same window chrome');

const src = require('fs').readFileSync(require('path').join(__dirname, 'nr-win.js'), 'utf8');
assert.ok(src.includes("localStorage.setItem(KEY") && src.includes('applyCssVars') && src.includes('querySelectorAll(\'.nr-win\')'),
    'resizing one window writes the size and paints every .nr-win');
assert.ok(src.includes('startResize') && src.includes('startDrag') && src.includes('toggleMax'),
    'windows can be resized, dragged, and maximized');

console.log('nr-win_test: ok');

// Разбор CSV для страницы «Копии»: кавычки, переводы строк внутри поля, точка с запятой, BOM.
const assert = require('assert');
const fs = require('fs');
const code = fs.readFileSync(require('path').join(__dirname, 'nr-backups.js'), 'utf8');
const m = code.match(/function parseCsv\(text\) \{[\s\S]*?\n    \}\n/);
const parseCsv = new Function(m[0] + '; return parseCsv;')();
assert.deepStrictEqual(parseCsv('a,b\n1,2\n'), [['a', 'b'], ['1', '2']]);
assert.deepStrictEqual(parseCsv('﻿a;b\r\n"x;y";2\r\n'), [['a', 'b'], ['x;y', '2']]);
assert.deepStrictEqual(parseCsv('a,b\n"line1\nline2","q""uote"\n'), [['a', 'b'], ['line1\nline2', 'q"uote']]);
assert.deepStrictEqual(parseCsv('a,b\n1,'), [['a', 'b'], ['1', '']]);
console.log('nr-backups_test: ok');

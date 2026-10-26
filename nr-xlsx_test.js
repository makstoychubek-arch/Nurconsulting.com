// Запись .xlsx без библиотек: корректный zip и содержимое под шаблон WB.
const assert = require('assert');
const zlib = require('zlib');
global.window = undefined;
require('./nr-xlsx.js');
const X = globalThis.NrXlsx;
assert.ok(X, 'модуль подключился');
assert.strictEqual(X.crc32(new TextEncoder().encode('123456789')), 0xCBF43926, 'crc32 по стандарту');
const bytes = X.build([['Баркод', 'Количество'], ['2042105609267', 80], ['2042105609274', 85]]);
const b = Buffer.from(bytes);
assert.strictEqual(b.readUInt32LE(0), 0x04034b50, 'начало zip');
const eocd = b.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
assert.ok(eocd > 0 && b.readUInt16LE(eocd + 10) === 5, 'пять файлов в архиве');
// читаем файлы по центральному каталогу
const cdOff = b.readUInt32LE(eocd + 16), n = b.readUInt16LE(eocd + 10), files = {};
let p = cdOff;
for (let i = 0; i < n; i++) {
    const size = b.readUInt32LE(p + 24), nl = b.readUInt16LE(p + 28), el = b.readUInt16LE(p + 30), cl = b.readUInt16LE(p + 32), lh = b.readUInt32LE(p + 42);
    const name = b.slice(p + 46, p + 46 + nl).toString('utf8');
    const lnl = b.readUInt16LE(lh + 26), lel = b.readUInt16LE(lh + 28);
    files[name] = b.slice(lh + 30 + lnl + lel, lh + 30 + lnl + lel + size);
    p += 46 + nl + el + cl;
}
assert.ok(files['xl/worksheets/sheet1.xml'] && files['xl/workbook.xml'] && files['[Content_Types].xml'], 'обязательные части');
const sheet = files['xl/worksheets/sheet1.xml'].toString('utf8');
assert.ok(sheet.includes('<t>Баркод</t>') && sheet.includes('<t>2042105609267</t>') && sheet.includes('<c r="B2"><v>80</v></c>'), 'ячейки: баркод текстом, количество числом');
assert.ok(files['xl/workbook.xml'].toString('utf8').includes('name="Sheet1"'), 'лист Sheet1 как в шаблоне WB');
console.log('nr-xlsx_test: ok');

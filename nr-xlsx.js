/* Минимальная запись .xlsx без библиотек: один лист, строки текста и чисел (zip без сжатия).
   Нужна для файлов под шаблон WB («Баркод», «Количество»). Лист называется Sheet1, как в шаблоне. */
(function (root) {
    'use strict';
    var CRC = null;
    function crc32(b) {
        if (!CRC) { CRC = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; } }
        var x = 0xFFFFFFFF;
        for (var i = 0; i < b.length; i++) x = CRC[(x ^ b[i]) & 255] ^ (x >>> 8);
        return (x ^ 0xFFFFFFFF) >>> 0;
    }
    function utf8(s) { return new TextEncoder().encode(s); }
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function colName(i) { return String.fromCharCode(65 + i); }
    function sheetXml(rows) {
        var out = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="22" customWidth="1"/><col min="2" max="2" width="14" customWidth="1"/></cols><sheetData>';
        rows.forEach(function (r, ri) {
            out += '<row r="' + (ri + 1) + '">';
            r.forEach(function (v, ci) {
                var ref = colName(ci) + (ri + 1);
                if (typeof v === 'number' && isFinite(v)) out += '<c r="' + ref + '"><v>' + v + '</v></c>';
                else out += '<c r="' + ref + '" t="inlineStr"><is><t>' + esc(v == null ? '' : v) + '</t></is></c>';
            });
            out += '</row>';
        });
        return out + '</sheetData></worksheet>';
    }
    function u16(n) { return [n & 255, (n >>> 8) & 255]; }
    function u32(n) { return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]; }
    // Сборка zip без сжатия. files: [[имя, Uint8Array]]
    function zip(files) {
        var parts = [], central = [], offset = 0;
        files.forEach(function (f) {
            var name = utf8(f[0]), data = f[1], crc = crc32(data);
            var head = [].concat(u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0));
            parts.push(new Uint8Array(head), name, data);
            central.push(new Uint8Array([].concat(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset))), name);
            offset += head.length + name.length + data.length;
        });
        var cdSize = 0; central.forEach(function (c) { cdSize += c.length; });
        var end = new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cdSize), u32(offset), u16(0)));
        var all = parts.concat(central, [end]), total = 0;
        all.forEach(function (p) { total += p.length; });
        var out = new Uint8Array(total), pos = 0;
        all.forEach(function (p) { out.set(p, pos); pos += p.length; });
        return out;
    }
    function build(rows) {
        var ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>';
        var rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
        var wb = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>';
        var wbRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>';
        return zip([['[Content_Types].xml', utf8(ct)], ['_rels/.rels', utf8(rels)], ['xl/workbook.xml', utf8(wb)], ['xl/_rels/workbook.xml.rels', utf8(wbRels)], ['xl/worksheets/sheet1.xml', utf8(sheetXml(rows))]]);
    }
    function download(rows, filename) {
        var blob = new Blob([build(rows)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        var a = root.document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = filename;
        root.document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    }
    root.NrXlsx = { build: build, download: download, crc32: crc32 };
})(typeof window !== 'undefined' ? window : globalThis);

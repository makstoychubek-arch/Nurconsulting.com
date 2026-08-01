// Генерация FBS Excel (xlsx) через JSZip + OOXML.
// Колонки: Баркод | Артикул | Название | Размер | Кол-во

import JSZip from 'https://esm.sh/jszip@3.10.1';

export type FbsExcelRow = {
    barcode: string;
    article: string;
    productName: string;
    size: string;
    qty: number;
};

const MODEL_FILLS = ['FFF3E8', 'E8F1FF', 'EAF8EE', 'F8EAF3', 'F5F0E6', 'EEF7F7'];

type SheetLine = {
    barcode: string;
    article: string;
    name: string;
    size: string;
    qty: string | number;
    fillRgb: string | null;
    bold: boolean;
};

export async function buildFbsExcel(rows: FbsExcelRow[], reportDate: string): Promise<Uint8Array> {
    const lines = buildLines(rows);
    const { sheetXml, stylesXml } = buildXml(lines, reportDate);

    const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="FBS ${escapeXml(reportDate)}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

    const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

    const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

    const zip = new JSZip();
    zip.file('[Content_Types].xml', contentTypes);
    zip.folder('_rels')!.file('.rels', rootRels);
    const xl = zip.folder('xl')!;
    xl.file('workbook.xml', workbookXml);
    xl.file('styles.xml', stylesXml);
    xl.folder('_rels')!.file('workbook.xml.rels', workbookRels);
    xl.folder('worksheets')!.file('sheet1.xml', sheetXml);
    return await zip.generateAsync({ type: 'uint8array' });
}

function buildLines(rows: FbsExcelRow[]): SheetLine[] {
    const map = new Map<string, FbsExcelRow[]>();
    for (const r of rows) {
        const key = r.productName || r.article || r.barcode;
        const list = map.get(key) || [];
        list.push(r);
        map.set(key, list);
    }
    const groups = [...map.entries()]
        .map(([name, list]) => ({
            name,
            rows: list.sort((a, b) => sizeSortKey(a.size) - sizeSortKey(b.size) || a.barcode.localeCompare(b.barcode)),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'ru'));

    const lines: SheetLine[] = [];
    let grand = 0;
    groups.forEach((g, gi) => {
        const fill = MODEL_FILLS[gi % MODEL_FILLS.length];
        let sub = 0;
        for (const r of g.rows) {
            lines.push({
                barcode: r.barcode,
                article: r.article,
                name: r.productName,
                size: r.size || '—',
                qty: r.qty,
                fillRgb: fill,
                bold: false,
            });
            sub += r.qty;
            grand += r.qty;
        }
        lines.push({
            barcode: '',
            article: '',
            name: `Итого: ${g.name}`,
            size: '',
            qty: sub,
            fillRgb: fill,
            bold: true,
        });
    });
    lines.push({
        barcode: '',
        article: '',
        name: 'ОБЩИЙ ИТОГ',
        size: '',
        qty: grand,
        fillRgb: 'C9E7C5',
        bold: true,
    });
    return lines;
}

function buildXml(lines: SheetLine[], _reportDate: string): { sheetXml: string; stylesXml: string } {
    // style 0 default, 1 header, then unique fill+bold combos
    const styleKeyToId = new Map<string, number>();
    const styleDefs: Array<{ fillRgb: string | null; bold: boolean }> = [
        { fillRgb: null, bold: false }, // 0
        { fillRgb: 'C9E7C5', bold: true }, // 1 header
    ];
    const styleId = (fillRgb: string | null, bold: boolean): number => {
        const key = `${fillRgb || 'NONE'}|${bold ? 'B' : 'N'}`;
        if (styleKeyToId.has(key)) return styleKeyToId.get(key)!;
        const id = styleDefs.length;
        styleDefs.push({ fillRgb, bold });
        styleKeyToId.set(key, id);
        return id;
    };
    for (const line of lines) styleId(line.fillRgb, line.bold);

    const cols = [18, 28, 42, 10, 10]
        .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
        .join('');

    const header = ['Баркод', 'Артикул', 'Название товара', 'Размер', 'Кол-во'];
    let rowXml = `<row r="1">${header.map((h, i) => cellXml(1, i + 1, h, 1)).join('')}</row>`;
    lines.forEach((line, idx) => {
        const r = idx + 2;
        const s = styleId(line.fillRgb, line.bold);
        const vals: Array<string | number> = [line.barcode, line.article, line.name, line.size, line.qty];
        rowXml += `<row r="${r}">${vals.map((v, i) => cellXml(r, i + 1, v, s)).join('')}</row>`;
    });

    const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>${cols}</cols>
  <sheetData>${rowXml}</sheetData>
</worksheet>`;

    // fills: 0 none, 1 gray125, then solids for each unique rgb in styleDefs
    const fillParts = [
        '<fill><patternFill patternType="none"/></fill>',
        '<fill><patternFill patternType="gray125"/></fill>',
    ];
    const rgbToFillId = new Map<string, number>();
    const ensureFill = (rgb: string | null): number => {
        if (!rgb) return 0;
        if (rgbToFillId.has(rgb)) return rgbToFillId.get(rgb)!;
        const id = fillParts.length;
        fillParts.push(
            `<fill><patternFill patternType="solid"><fgColor rgb="FF${rgb}"/><bgColor indexed="64"/></patternFill></fill>`,
        );
        rgbToFillId.set(rgb, id);
        return id;
    };

    const fonts = [
        '<font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>',
        '<font><b/><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>',
    ];

    const xfs = styleDefs.map((def) => {
        const fillId = ensureFill(def.fillRgb);
        const fontId = def.bold ? 1 : 0;
        return `<xf numFmtId="0" fontId="${fontId}" fillId="${fillId}" borderId="0" xfId="0" applyFont="1" applyFill="1"/>`;
    });

    const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="${fonts.length}">${fonts.join('')}</fonts>
  <fills count="${fillParts.length}">${fillParts.join('')}</fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs>
</styleSheet>`;

    return { sheetXml, stylesXml };
}

function cellXml(row: number, col: number, value: string | number, style: number): string {
    const ref = colLetter(col) + row;
    if (typeof value === 'number') {
        return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
    }
    return `<c r="${ref}" s="${style}" t="inlineStr"><is><t>${escapeXml(String(value ?? ''))}</t></is></c>`;
}

function colLetter(n: number): string {
    let s = '';
    let x = n;
    while (x > 0) {
        const m = (x - 1) % 26;
        s = String.fromCharCode(65 + m) + s;
        x = Math.floor((x - 1) / 26);
    }
    return s;
}

function sizeSortKey(size: string): number {
    const n = Number(String(size).replace(/[^\d.]/g, ''));
    return Number.isFinite(n) && n > 0 ? n : 9999;
}

function escapeXml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

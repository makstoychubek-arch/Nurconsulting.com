// Генерация FBS Excel (xlsx) через JSZip + OOXML.
// Колонки: Кабинет | Баркод | Артикул | Название | Размер | Кол-во

import JSZip from 'https://esm.sh/jszip@3.10.1';
import { fbsCabinetLabel } from './fbs-cabinet-labels.ts';

export type FbsExcelRow = {
    cabinet: string;
    barcode: string;
    article: string;
    productName: string;
    size: string;
    qty: number;
};

const MODEL_FILLS = ['FFF3E8', 'E8F1FF', 'EAF8EE', 'F8EAF3', 'F5F0E6', 'EEF7F7'];

type SheetLine = {
    cabinet: string;
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
    // кабинет → модель → строки
    const byCab = new Map<string, Map<string, FbsExcelRow[]>>();
    for (const r of rows) {
        const cab = r.cabinet || '—';
        const model = r.productName || r.article || r.barcode;
        if (!byCab.has(cab)) byCab.set(cab, new Map());
        const models = byCab.get(cab)!;
        const list = models.get(model) || [];
        list.push(r);
        models.set(model, list);
    }

    const cabNames = [...byCab.keys()].sort((a, b) =>
        fbsCabinetLabel(a).localeCompare(fbsCabinetLabel(b), 'ru')
    );

    const lines: SheetLine[] = [];
    let grand = 0;
    let fillIdx = 0;

    for (const cab of cabNames) {
        const models = byCab.get(cab)!;
        const label = fbsCabinetLabel(cab);
        let cabTotal = 0;
        const groups = [...models.entries()]
            .map(([name, list]) => ({
                name,
                rows: list.sort(
                    (a, b) =>
                        sizeSortKey(a.size) - sizeSortKey(b.size) ||
                        a.barcode.localeCompare(b.barcode),
                ),
            }))
            .sort((a, b) => a.name.localeCompare(b.name, 'ru'));

        for (const g of groups) {
            const fill = MODEL_FILLS[fillIdx++ % MODEL_FILLS.length];
            let sub = 0;
            for (const r of g.rows) {
                lines.push({
                    cabinet: label,
                    barcode: r.barcode,
                    article: r.article,
                    name: r.productName,
                    size: r.size || '—',
                    qty: r.qty,
                    fillRgb: fill,
                    bold: false,
                });
                sub += r.qty;
                cabTotal += r.qty;
                grand += r.qty;
            }
            lines.push({
                cabinet: label,
                barcode: '',
                article: '',
                name: `Итого: ${g.name}`,
                size: '',
                qty: sub,
                fillRgb: fill,
                bold: true,
            });
        }

        lines.push({
            cabinet: label,
            barcode: '',
            article: '',
            name: `Итого кабинет: ${label}`,
            size: '',
            qty: cabTotal,
            fillRgb: 'DDE8DD',
            bold: true,
        });
    }

    lines.push({
        cabinet: '',
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
    const styleKeyToId = new Map<string, number>();
    const styleDefs: Array<{ fillRgb: string | null; bold: boolean }> = [
        { fillRgb: null, bold: false },
        { fillRgb: 'C9E7C5', bold: true },
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

    const cols = [18, 18, 28, 42, 10, 10]
        .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
        .join('');

    const header = ['Кабинет', 'Баркод', 'Артикул', 'Название товара', 'Размер', 'Кол-во'];
    let rowXml = `<row r="1">${header.map((h, i) => cellXml(1, i + 1, h, 1)).join('')}</row>`;
    lines.forEach((line, idx) => {
        const r = idx + 2;
        const s = styleId(line.fillRgb, line.bold);
        const vals: Array<string | number> = [
            line.cabinet,
            line.barcode,
            line.article,
            line.name,
            line.size,
            line.qty,
        ];
        rowXml += `<row r="${r}">${vals.map((v, i) => cellXml(r, i + 1, v, s)).join('')}</row>`;
    });

    const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>${cols}</cols>
  <sheetData>${rowXml}</sheetData>
</worksheet>`;

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

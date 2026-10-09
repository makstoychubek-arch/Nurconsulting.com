/**
 * «Оцифровка → Отчёты WB»: клиент сам загружает отчёты из кабинета Wildberries,
 * система определяет вид отчёта и день, раскладывает данные по дням и показывает итоги.
 * Пять видов: финансовый, продажи, динамика продаж, остатки WB (ФБО), остатки ФБС (до 5 складов).
 * Файл разбирается в браузере, на сервер уходят только строки (таблицы report_uploads / report_rows).
 * Описание для людей: docs/wb-reports.md.
 */
(function (root) {
    'use strict';

    // ───────────────────────── чтение .xlsx без библиотек ─────────────────────────
    const u16 = (b, o) => b[o] | (b[o + 1] << 8);
    const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
    const td = new TextDecoder('utf-8');

    async function inflateRaw(bytes) {
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return new Uint8Array(await new Response(stream).arrayBuffer());
    }

    function zipIndex(b) {
        let eocd = -1;
        for (let i = b.length - 22; i >= Math.max(0, b.length - 70000); i--) {
            if (u32(b, i) === 0x06054b50) { eocd = i; break; }
        }
        if (eocd < 0) throw new Error('Это не файл Excel (.xlsx)');
        const total = u16(b, eocd + 10);
        let p = u32(b, eocd + 16);
        const files = {};
        for (let n = 0; n < total; n++) {
            if (u32(b, p) !== 0x02014b50) break;
            const nameLen = u16(b, p + 28), extraLen = u16(b, p + 30), commLen = u16(b, p + 32);
            const name = td.decode(b.subarray(p + 46, p + 46 + nameLen));
            files[name] = { method: u16(b, p + 10), csize: u32(b, p + 20), offset: u32(b, p + 42) };
            p += 46 + nameLen + extraLen + commLen;
        }
        return files;
    }

    async function zipRead(b, files, name) {
        const f = files[name];
        if (!f) return null;
        const o = f.offset;
        const start = o + 30 + u16(b, o + 26) + u16(b, o + 28);
        const raw = b.subarray(start, start + f.csize);
        return td.decode(f.method === 0 ? raw : await inflateRaw(raw));
    }

    const xmlDecode = (s) => String(s)
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
        .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&amp;/g, '&');

    const textOf = (xml) => {
        const clean = xml.replace(/<rPh[\s\S]*?<\/rPh>/g, '');
        let out = '';
        clean.replace(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g, (_, t) => { out += t; return ''; });
        return xmlDecode(out);
    };

    const BUILTIN_DATE_FMT = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58]);

    function dateStyles(stylesXml) {
        const custom = {};
        (stylesXml || '').replace(/<numFmt\s+numFmtId="(\d+)"\s+formatCode="([^"]*)"/g, (_, id, code) => { custom[+id] = xmlDecode(code); return ''; });
        const cell = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(stylesXml || '');
        const out = [];
        if (cell) {
            cell[1].replace(/<xf\s[^>]*?numFmtId="(\d+)"[^>]*?>/g, (_, id) => {
                const n = +id;
                let isDate = BUILTIN_DATE_FMT.has(n);
                if (!isDate && custom[n]) isDate = /[ymdhs]/i.test(custom[n].replace(/"[^"]*"|\[[^\]]*\]|\\./g, ''));
                out.push(isDate);
                return '';
            });
        }
        return out;
    }

    const serialToIso = (v) => {
        const ms = Math.round((+v) * 86400000) + Date.UTC(1899, 11, 30);
        return new Date(ms).toISOString().slice(0, 10);
    };

    const colIndex = (ref) => {
        let n = 0;
        const m = /^([A-Z]+)/.exec(ref);
        for (const ch of (m ? m[1] : 'A')) n = n * 26 + (ch.charCodeAt(0) - 64);
        return n - 1;
    };

    /** Первый лист книги в виде массива строк (массивов значений). */
    async function readXlsxRows(buf) {
        const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
        const files = zipIndex(b);
        const sstXml = await zipRead(b, files, 'xl/sharedStrings.xml');
        const sst = [];
        if (sstXml) sstXml.replace(/<si>([\s\S]*?)<\/si>/g, (_, si) => { sst.push(textOf(si)); return ''; });
        const dateXf = dateStyles(await zipRead(b, files, 'xl/styles.xml'));
        const sheetName = files['xl/worksheets/sheet1.xml'] ? 'xl/worksheets/sheet1.xml'
            : Object.keys(files).filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort()[0];
        if (!sheetName) throw new Error('В файле нет листов');
        const xml = await zipRead(b, files, sheetName);
        const rows = [];
        xml.replace(/<row\b[^>]*>([\s\S]*?)<\/row>/g, (_, rowXml) => {
            const row = [];
            rowXml.replace(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, (__, attrs, inner) => {
                const ref = (/\br="([^"]+)"/.exec(attrs) || [])[1] || '';
                const t = (/\bt="([^"]+)"/.exec(attrs) || [])[1] || 'n';
                const s = (/\bs="(\d+)"/.exec(attrs) || [])[1];
                let val = '';
                if (inner) {
                    if (t === 'inlineStr') val = textOf(inner);
                    else {
                        const v = /<v[^>]*>([\s\S]*?)<\/v>/.exec(inner);
                        const raw = v ? xmlDecode(v[1]) : '';
                        if (t === 's') val = sst[+raw] ?? '';
                        else if (t === 'str' || t === 'e') val = raw;
                        else if (t === 'b') val = raw === '1';
                        else if (raw !== '') {
                            val = parseFloat(raw);
                            if (s != null && dateXf[+s] && isFinite(val)) val = serialToIso(val);
                        }
                    }
                }
                row[colIndex(ref)] = val;
                return '';
            });
            for (let i = 0; i < row.length; i++) if (row[i] === undefined) row[i] = '';
            rows.push(row);
            return '';
        });
        return rows;
    }

    // ───────────────────────── разбор отчётов ─────────────────────────
    const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim();
    const num = (v) => {
        if (typeof v === 'number') return isFinite(v) ? v : 0;
        const n = parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.'));
        return isFinite(n) ? n : 0;
    };
    const str = (v) => String(v == null ? '' : v).trim();
    const round2 = (n) => Math.round(n * 100) / 100;
    const isoDay = (v) => {
        const s = str(v);
        let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
        if (m) return `${m[1]}-${m[2]}-${m[3]}`;
        m = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(s);
        return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
    };

    function headerMap(row) {
        const map = {};
        row.forEach((h, i) => { const k = norm(h); if (k && map[k] === undefined) map[k] = i; });
        return map;
    }
    const pick = (map, ...names) => {
        for (const n of names) {
            const k = norm(n);
            if (map[k] !== undefined) return map[k];
        }
        for (const n of names) {
            const k = norm(n);
            const hit = Object.keys(map).find(x => x.startsWith(k));
            if (hit) return map[hit];
        }
        return -1;
    };
    const at = (row, i) => (i >= 0 ? row[i] : '');

    /** Определяет вид отчёта по заголовкам. Возвращает { type, headerIdx } или null. */
    function detectReport(rows) {
        for (let i = 0; i < Math.min(rows.length, 4); i++) {
            const h = rows[i].map(norm);
            const has = (s) => h.some(x => x === norm(s) || x.startsWith(norm(s)));
            if (has('Обоснование для оплаты') && has('Вайлдберриз реализовал Товар')) return { type: 'fin', headerIdx: i };
            if (has('Неделя года') && has('День') && has('Выкупили, шт.')) return { type: 'dynamics', headerIdx: i };
            if (has('Выкупили, шт.') && has('Текущий остаток, шт.') && has('Баркод') && has('Склад')) return { type: 'sales', headerIdx: i };
            if (has('Баркод') && has('Количество') && has('Артикул продавца') && has('Размер') && !has('Выкупили, шт.')) return { type: 'stock_fbs', headerIdx: i };
            if (i === 0 && h.filter(Boolean).length <= 3 && has('Артикул продавца') && h.some(x => x.startsWith('склад'))) return { type: 'stock_fbo', headerIdx: i };
        }
        return null;
    }

    function dateFromFileName(name) {
        const m = /(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])/.exec(String(name || ''));
        return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
    }

    function parseFin(rows, headerIdx, fileName) {
        const m = headerMap(rows[headerIdx]);
        const c = {
            type: pick(m, 'Тип документа'), reason: pick(m, 'Обоснование для оплаты'),
            article: pick(m, 'Артикул поставщика'), nm: pick(m, 'Код номенклатуры'), brand: pick(m, 'Бренд'),
            qty: pick(m, 'Кол-во'), realized: pick(m, 'Вайлдберриз реализовал Товар'),
            vv: pick(m, 'Вознаграждение Вайлдберриз (ВВ), без НДС'), toPay: pick(m, 'К перечислению Продавцу за реализованный Товар'),
            deliv: pick(m, 'Услуги по доставке товара покупателю'), fine: pick(m, 'Общая сумма штрафов'),
            storage: pick(m, 'Хранение'), hold: pick(m, 'Удержания'), kind: pick(m, 'Виды логистики, штрафов и корректировок ВВ'),
            saleDate: pick(m, 'Дата продажи'),
        };
        const sum = { sales_qty: 0, sales_sum: 0, returns_qty: 0, returns_sum: 0, commission: 0, logistics: 0, storage: 0, penalty: 0, ads: 0, hold_other: 0, compensation: 0, to_pay_sales: 0, to_pay_returns: 0 };
        const byArt = new Map();
        const days = new Map();
        const art = (a, nm, brand) => {
            const key = a || '—';
            if (!byArt.has(key)) byArt.set(key, { article: a, nm_id: nm, brand, sales_qty: 0, sales_sum: 0, ret_qty: 0, ret_sum: 0, commission: 0, to_pay: 0, logistics: 0 });
            const r = byArt.get(key);
            if (!r.nm_id && nm) r.nm_id = nm;
            return r;
        };
        let lines = 0;
        for (let i = headerIdx + 1; i < rows.length; i++) {
            const r = rows[i];
            if (!r || !r.some(x => x !== '')) continue;
            lines++;
            const reason = str(at(r, c.reason));
            const a = str(at(r, c.article));
            const nm = num(at(r, c.nm)) || null;
            const brand = str(at(r, c.brand));
            const d = isoDay(at(r, c.saleDate));
            if (d) days.set(d, (days.get(d) || 0) + 1);
            if (reason === 'Продажа') {
                const q = num(at(r, c.qty)), s = num(at(r, c.realized)), vv = num(at(r, c.vv)), tp = num(at(r, c.toPay));
                sum.sales_qty += q; sum.sales_sum += s; sum.commission += vv; sum.to_pay_sales += tp;
                const x = art(a, nm, brand); x.sales_qty += q; x.sales_sum += s; x.commission += vv; x.to_pay += tp;
            } else if (reason === 'Возврат') {
                const q = num(at(r, c.qty)), s = num(at(r, c.realized)), vv = num(at(r, c.vv)), tp = num(at(r, c.toPay));
                sum.returns_qty += q; sum.returns_sum += s; sum.commission -= vv; sum.to_pay_returns += tp;
                const x = art(a, nm, brand); x.ret_qty += q; x.ret_sum += s; x.commission -= vv; x.to_pay -= tp;
            } else if (reason === 'Добровольная компенсация при возврате') {
                const tp = num(at(r, c.toPay));
                sum.compensation += tp; art(a, nm, brand).to_pay += tp;
            } else if (reason === 'Логистика') {
                const l = num(at(r, c.deliv));
                sum.logistics += l; art(a, nm, brand).logistics += l;
            } else if (reason === 'Хранение') sum.storage += num(at(r, c.storage));
            else if (reason === 'Штраф') sum.penalty += num(at(r, c.fine));
            else if (reason === 'Удержание') {
                const h = num(at(r, c.hold));
                if (/продвижен/i.test(str(at(r, c.kind)))) sum.ads += h; else sum.hold_other += h;
            }
        }
        let date = dateFromFileName(fileName);
        if (!date && days.size) date = [...days.entries()].sort((x, y) => y[1] - x[1])[0][0];
        for (const k of Object.keys(sum)) sum[k] = round2(sum[k]);
        sum.to_pay_total = round2(sum.to_pay_sales + sum.compensation - sum.to_pay_returns - sum.logistics - sum.storage - sum.penalty - sum.ads - sum.hold_other);
        const out = [...byArt.values()].filter(x => x.article).map(x => ({
            article: x.article, nm_id: x.nm_id, qty: x.sales_qty - x.ret_qty, amount: round2(x.sales_sum - x.ret_sum),
            extra: { brand: x.brand, sales_qty: x.sales_qty, sales_sum: round2(x.sales_sum), ret_qty: x.ret_qty, ret_sum: round2(x.ret_sum), commission: round2(x.commission), to_pay: round2(x.to_pay), logistics: round2(x.logistics) },
        }));
        return { type: 'fin', date, dates: date ? [date] : [], lines, summary: sum, rows: out };
    }

    function parseSales(rows, headerIdx) {
        const m = headerMap(rows[headerIdx]);
        const c = {
            brand: pick(m, 'Бренд'), subject: pick(m, 'Предмет'), name: pick(m, 'Наименование'), article: pick(m, 'Артикул продавца'),
            nm: pick(m, 'Артикул WB'), barcode: pick(m, 'Баркод'), size: pick(m, 'Размер'), wh: pick(m, 'Склад'),
            ordered: pick(m, 'шт.'), orderedSum: pick(m, 'Сумма заказов минус комиссия WB'), bought: pick(m, 'Выкупили, шт.'),
            toPay: pick(m, 'К перечислению за товар'), stock: pick(m, 'Текущий остаток, шт.'),
        };
        const title = headerIdx > 0 ? str(rows[0][0]) : '';
        const range = /с (\d{2})\.(\d{2})\.(\d{4}) по (\d{2})\.(\d{2})\.(\d{4})/.exec(title);
        const from = range ? `${range[3]}-${range[2]}-${range[1]}` : '';
        const to = range ? `${range[6]}-${range[5]}-${range[4]}` : '';
        const out = [];
        const sum = { ordered_qty: 0, ordered_sum: 0, bought_qty: 0, to_pay: 0, stock: 0 };
        for (let i = headerIdx + 1; i < rows.length; i++) {
            const r = rows[i];
            if (!r || !r.some(x => x !== '')) continue;
            const ordered = num(at(r, c.ordered)), bought = num(at(r, c.bought)), stock = num(at(r, c.stock));
            const orderedSum = num(at(r, c.orderedSum)), toPay = num(at(r, c.toPay));
            sum.ordered_qty += ordered; sum.ordered_sum += orderedSum; sum.bought_qty += bought; sum.to_pay += toPay; sum.stock += stock;
            if (!ordered && !bought && !stock && !orderedSum) continue;
            out.push({
                article: str(at(r, c.article)), nm_id: num(at(r, c.nm)) || null, barcode: str(at(r, c.barcode)), size: str(at(r, c.size)),
                warehouse: str(at(r, c.wh)), qty: ordered, amount: round2(orderedSum),
                extra: { bought, to_pay: round2(toPay), stock, brand: str(at(r, c.brand)), subject: str(at(r, c.subject)), name: str(at(r, c.name)) },
            });
        }
        for (const k of Object.keys(sum)) sum[k] = round2(sum[k]);
        return { type: 'sales', date: from, dates: from ? [from] : [], multiDay: !!(from && to && from !== to), period: { from, to }, lines: out.length, summary: sum, rows: out };
    }

    function parseDynamics(rows, headerIdx) {
        const m = headerMap(rows[headerIdx]);
        const c = {
            brand: pick(m, 'Бренд'), day: pick(m, 'День'), article: pick(m, 'Артикул продавца'), bought: pick(m, 'Выкупили, шт.'),
            toPay: pick(m, 'К перечислению за товар'), ordered: pick(m, 'Заказано, шт.'), orderedSum: pick(m, 'Сумма заказов минус комиссия WB'),
        };
        const byDay = new Map();
        let lines = 0;
        for (let i = headerIdx + 1; i < rows.length; i++) {
            const r = rows[i];
            if (!r || !r.some(x => x !== '')) continue;
            const d = isoDay(at(r, c.day));
            if (!d) continue;
            lines++;
            if (!byDay.has(d)) byDay.set(d, []);
            byDay.get(d).push({
                article: str(at(r, c.article)), qty: num(at(r, c.ordered)), amount: round2(num(at(r, c.orderedSum))),
                extra: { bought: num(at(r, c.bought)), to_pay: round2(num(at(r, c.toPay))), brand: str(at(r, c.brand)) },
            });
        }
        const days = [...byDay.keys()].sort();
        const perDay = {};
        for (const d of days) {
            const list = byDay.get(d);
            perDay[d] = {
                rows: list,
                summary: {
                    ordered_qty: round2(list.reduce((s, x) => s + x.qty, 0)), ordered_sum: round2(list.reduce((s, x) => s + x.amount, 0)),
                    bought_qty: round2(list.reduce((s, x) => s + x.extra.bought, 0)), to_pay: round2(list.reduce((s, x) => s + x.extra.to_pay, 0)),
                },
            };
        }
        return { type: 'dynamics', date: days[0] || '', dates: days, lines, perDay };
    }

    function parseStockFbo(rows, headerIdx) {
        const m = headerMap(rows[headerIdx]);
        const ca = pick(m, 'Артикул продавца');
        const cq = Object.keys(m).find(k => k.startsWith('склад'));
        const out = [];
        let total = 0;
        for (let i = headerIdx + 1; i < rows.length; i++) {
            const r = rows[i];
            if (!r || !r.some(x => x !== '')) continue;
            const q = num(at(r, cq === undefined ? 1 : m[cq]));
            total += q;
            if (!str(at(r, ca))) continue;
            out.push({ article: str(at(r, ca)), qty: q, amount: 0, extra: {} });
        }
        return { type: 'stock_fbo', date: '', dates: [], lines: out.length, summary: { stock: round2(total), articles: out.length }, rows: out };
    }

    function parseStockFbs(rows, headerIdx) {
        const m = headerMap(rows[headerIdx]);
        const c = { barcode: pick(m, 'Баркод'), qty: pick(m, 'Количество'), subject: pick(m, 'Предмет'), brand: pick(m, 'Бренд'), name: pick(m, 'Наименование'), size: pick(m, 'Размер'), article: pick(m, 'Артикул продавца') };
        const out = [];
        let total = 0;
        for (let i = headerIdx + 1; i < rows.length; i++) {
            const r = rows[i];
            if (!r || !r.some(x => x !== '')) continue;
            const q = num(at(r, c.qty));
            total += q;
            out.push({ article: str(at(r, c.article)), barcode: str(at(r, c.barcode)), size: str(at(r, c.size)), qty: q, amount: 0, extra: { brand: str(at(r, c.brand)), subject: str(at(r, c.subject)), name: str(at(r, c.name)) } });
        }
        return { type: 'stock_fbs', date: '', dates: [], lines: out.length, summary: { stock: round2(total), barcodes: out.length }, rows: out };
    }

    /** Файл → разобранный отчёт. Бросает понятную ошибку, если вид отчёта не определён. */
    async function parseReportFile(buf, fileName) {
        const rows = await readXlsxRows(buf);
        const det = detectReport(rows);
        if (!det) throw new Error('Не получилось определить отчёт. Нужен один из пяти отчётов WB из инструкции (формат .xlsx).');
        const h = det.headerIdx;
        if (det.type === 'fin') return parseFin(rows, h, fileName);
        if (det.type === 'sales') return parseSales(rows, h);
        if (det.type === 'dynamics') return parseDynamics(rows, h);
        if (det.type === 'stock_fbo') return parseStockFbo(rows, h);
        return parseStockFbs(rows, h);
    }

    const api = { readXlsxRows, detectReport, parseReportFile, parseFin, parseSales, parseDynamics, parseStockFbo, parseStockFbs, dateFromFileName };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.WbReportParse = api;
})(typeof window !== 'undefined' ? window : globalThis);

// ───────────────────────── интерфейс ─────────────────────────
(function (root) {
    'use strict';
    if (typeof document === 'undefined') return;
    const P = root.WbReportParse;

    const SLOTS = [
        { type: 'fin', n: 1, title: 'Финансовый отчёт', sub: 'Ежедневный детализированный', hint: 'Финансы → Отчёты → ежедневный детализированный отчёт за нужный день. Скачайте Excel.', color: '#16a34a' },
        { type: 'sales', n: 2, title: 'Продажи', sub: 'Отчёт по данным поставщика', hint: 'Аналитика → Отчёты → «Отчёт по данным поставщика». Период: один день, склад: все. Скачайте Excel.', color: '#2563eb' },
        { type: 'dynamics', n: 3, title: 'Динамика продаж', sub: 'По дням и артикулам', hint: 'Аналитика → Отчёты → динамика продаж по артикулам, с разбивкой по дням. Скачайте Excel.', color: '#9333ea' },
        { type: 'stock_fbo', n: 4, title: 'Остатки WB (ФБО)', sub: 'На складах Wildberries', hint: 'Остатки по артикулам продавца на складах WB. Файл с двумя колонками: «Артикул продавца» и «Склад WB».', color: '#ea580c' },
        { type: 'stock_fbs', n: 5, title: 'Остатки ФБС', sub: 'До 5 ваших складов', hint: 'Остатки на ваших складах (FBS). По одному файлу на каждый склад: от 1 до 5.', color: '#0891b2' },
    ];
    const TYPE_TITLE = Object.fromEntries(SLOTS.map(s => [s.type, s.title]));
    const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

    const S = { cab: null, ym: '', day: '', uploads: [], rows: [], monthRows: [], stocks: { fbo: null, fbs: {} }, arts: new Map(), period: 'day', busy: false, msg: null, loaded: false, all: false };

    const sb = () => root.supabase;
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/ /g, ' ');
    const pad2 = (n) => String(n).padStart(2, '0');
    const ruDay = (iso) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '—');
    const todayBishkek = () => new Date(Date.now() + 6 * 3600000).toISOString().slice(0, 10);
    const addDays = (iso, d) => new Date(Date.parse(iso + 'T00:00:00Z') + d * 86400000).toISOString().slice(0, 10);
    const daysInMonth = (ym) => new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate();

    const CSS = `
    .wbr{--wbr-b:var(--border,#e5e7eb);--wbr-t:var(--text-primary,#111827);--wbr-m:var(--text-muted,#6b7280);--wbr-s:var(--surface-solid,#fff);--wbr-bg:var(--bg,#f4f4f5);color:var(--wbr-t)}
    .wbr *{box-sizing:border-box}
    .wbr-card{background:var(--wbr-s);border:1px solid var(--wbr-b);border-radius:20px;padding:20px 22px;margin-bottom:16px}
    .wbr-h1{font-size:20px;font-weight:800;margin:0 0 4px}.wbr-sub{color:var(--wbr-m);font-size:13px;line-height:1.5;margin:0}
    .wbr-steps{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
    .wbr-step{display:flex;align-items:center;gap:8px;padding:6px 12px 6px 6px;border-radius:999px;background:var(--wbr-bg);font-size:12.5px;font-weight:700}
    .wbr-step i{width:22px;height:22px;border-radius:50%;color:#fff;font-style:normal;display:flex;align-items:center;justify-content:center;font-size:12px}
    .wbr-drop{margin-top:16px;border:2px dashed var(--wbr-b);border-radius:18px;padding:22px;text-align:center;cursor:pointer;transition:.15s;background:var(--wbr-bg)}
    .wbr-drop:hover,.wbr-drop.is-over{border-color:var(--accent,#3b82f6);background:var(--accent-soft,rgba(59,130,246,.08))}
    .wbr-drop b{display:block;font-size:15px;margin-bottom:4px}.wbr-drop span{color:var(--wbr-m);font-size:12.5px}
    .wbr-msg{margin-top:12px;padding:10px 14px;border-radius:12px;font-size:13px;font-weight:600}
    .wbr-msg.ok{background:rgba(22,163,74,.12);color:#15803d}.wbr-msg.err{background:rgba(220,38,38,.1);color:#b91c1c}.wbr-msg.info{background:rgba(37,99,235,.1);color:#1d4ed8}
    .wbr-month{display:flex;align-items:center;gap:10px;margin-bottom:12px}.wbr-month b{font-size:15px;min-width:130px;text-align:center}
    .wbr-mbtn{border:1px solid var(--wbr-b);background:var(--wbr-s);color:var(--wbr-t);border-radius:10px;width:32px;height:32px;cursor:pointer;font-size:16px}
    .wbr-days{display:grid;grid-template-columns:repeat(auto-fill,minmax(54px,1fr));gap:6px}
    .wbr-day{border:1px solid var(--wbr-b);background:var(--wbr-s);color:var(--wbr-t);border-radius:12px;padding:6px 4px;cursor:pointer;text-align:center;font-size:13px;font-weight:700;position:relative}
    .wbr-day small{display:block;font-size:10px;font-weight:600;color:var(--wbr-m);margin-top:1px}
    .wbr-day.is-sel{border-color:var(--accent,#3b82f6);box-shadow:0 0 0 2px var(--accent-soft,rgba(59,130,246,.25))}
    .wbr-day.is-full{background:rgba(22,163,74,.12)}.wbr-day.is-part{background:rgba(234,179,8,.14)}
    .wbr-day.is-future{opacity:.45}
    .wbr-legend{display:flex;gap:14px;margin-top:10px;font-size:11.5px;color:var(--wbr-m);flex-wrap:wrap}.wbr-legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}
    .wbr-slots{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}
    .wbr-slot{border:1px solid var(--wbr-b);border-radius:16px;padding:14px;background:var(--wbr-s);display:flex;flex-direction:column;gap:8px;transition:.15s}
    .wbr-slot.is-over{border-color:var(--accent,#3b82f6);background:var(--accent-soft,rgba(59,130,246,.08))}
    .wbr-slot.is-done{border-color:rgba(22,163,74,.45)}
    .wbr-slot-h{display:flex;align-items:center;gap:10px}.wbr-slot-h i{width:26px;height:26px;border-radius:50%;color:#fff;font-style:normal;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;flex:none}
    .wbr-slot-h b{font-size:14px}.wbr-slot-h small{display:block;color:var(--wbr-m);font-size:11.5px;font-weight:500}
    .wbr-slot-hint{font-size:11.5px;color:var(--wbr-m);line-height:1.45}
    .wbr-slot-state{font-size:12.5px;font-weight:700}.wbr-slot-state.ok{color:#15803d}.wbr-slot-state.no{color:var(--wbr-m);font-weight:600}
    .wbr-slot-state small{display:block;font-weight:500;color:var(--wbr-m);word-break:break-all}
    .wbr-btns{display:flex;gap:6px;flex-wrap:wrap;margin-top:auto}
    .wbr-btn{border:1px solid var(--wbr-b);background:var(--wbr-s);color:var(--wbr-t);border-radius:10px;padding:6px 12px;font-size:12.5px;font-weight:700;cursor:pointer}
    .wbr-btn.pri{background:var(--wbr-t);color:var(--wbr-s);border-color:var(--wbr-t)}.wbr-btn.del{color:#b91c1c}
    .wbr-fbs{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}
    .wbr-fbs-i{border:1px solid var(--wbr-b);border-radius:10px;padding:6px 4px;text-align:center;font-size:11px;cursor:pointer;background:var(--wbr-bg);font-weight:700}
    .wbr-fbs-i.is-done{background:rgba(22,163,74,.12);border-color:rgba(22,163,74,.4)}.wbr-fbs-i small{display:block;font-weight:500;color:var(--wbr-m)}
    .wbr-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}
    .wbr-kpi{background:var(--wbr-bg);border-radius:18px;padding:16px 18px}
    .wbr-kpi h4{margin:0 0 6px;font-size:12.5px;color:var(--wbr-m);font-weight:700}.wbr-kpi .v{font-size:26px;font-weight:800;letter-spacing:-.5px}
    .wbr-kpi .v.pos{color:#16a34a}.wbr-kpi .v.neg{color:#dc2626}
    .wbr-kpi ul{list-style:none;padding:0;margin:10px 0 0;display:grid;gap:5px;font-size:12.5px}.wbr-kpi li{display:flex;justify-content:space-between;gap:10px}.wbr-kpi li span:first-child{color:var(--wbr-m)}
    .wbr-bar{height:6px;border-radius:6px;background:var(--wbr-b);margin-top:10px;overflow:hidden;display:flex}.wbr-bar i{display:block;height:100%}
    .wbr-sec{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 12px;flex-wrap:wrap}.wbr-sec h3{margin:0;font-size:16px;font-weight:800}
    .wbr-tabs{display:inline-flex;background:var(--wbr-bg);border-radius:999px;padding:3px}.wbr-tabs button{border:none;background:none;color:var(--wbr-m);padding:5px 14px;border-radius:999px;font-size:12.5px;font-weight:700;cursor:pointer}.wbr-tabs button.on{background:var(--wbr-s);color:var(--wbr-t);box-shadow:0 1px 3px rgba(0,0,0,.12)}
    .wbr-tbl{width:100%;border-collapse:collapse;font-size:13px}.wbr-tbl th{text-align:right;font-size:11.5px;color:var(--wbr-m);font-weight:700;padding:6px 8px;border-bottom:1px solid var(--wbr-b);white-space:nowrap}.wbr-tbl th:first-child,.wbr-tbl td:first-child{text-align:left}
    .wbr-tbl td{padding:8px;border-bottom:1px solid var(--wbr-b);text-align:right;white-space:nowrap}.wbr-tbl tr:last-child td{border-bottom:none}
    .wbr-prod{display:flex;align-items:center;gap:10px;min-width:180px;white-space:normal}.wbr-prod img,.wbr-prod .ph{width:36px;height:48px;border-radius:8px;object-fit:cover;background:var(--wbr-bg);flex:none}
    .wbr-prod b{display:block;font-size:13px}.wbr-prod small{color:var(--wbr-m)}
    .wbr-meter{display:block;height:5px;border-radius:5px;background:var(--wbr-b);margin-top:5px;overflow:hidden}.wbr-meter i{display:block;height:100%;background:#f97316}
    .wbr-more{margin-top:10px}.wbr-empty{padding:26px;text-align:center;color:var(--wbr-m);font-size:13px}
    .wbr-chart{display:flex;align-items:flex-end;gap:3px;height:150px;padding-top:8px}.wbr-col{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:1px;height:100%;cursor:pointer}
    .wbr-col div{display:flex;align-items:flex-end;gap:1px;width:100%;flex:1}.wbr-col div i{flex:1;border-radius:3px 3px 0 0;min-height:0}.wbr-col small{font-size:9.5px;color:var(--wbr-m);margin-top:3px}
    .wbr-col.is-sel small{color:var(--wbr-t);font-weight:800}
    .wbr-wh{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:14px}.wbr-wh div{background:var(--wbr-bg);border-radius:14px;padding:10px 12px}.wbr-wh small{display:block;color:var(--wbr-m);font-size:11.5px}.wbr-wh b{font-size:18px}
    @media(max-width:700px){.wbr-card{padding:16px}.wbr-fbs{grid-template-columns:repeat(5,1fr)}.wbr-tbl{font-size:12px}}
    `;

    function ensureStyle() {
        if (document.getElementById('wbr-style')) return;
        const st = document.createElement('style');
        st.id = 'wbr-style';
        st.textContent = CSS;
        document.head.appendChild(st);
    }

    function getRoot() {
        const tab = document.getElementById('tab-summary');
        if (!tab) return null;
        let el = document.getElementById('wbr-root');
        if (!el) {
            el = document.createElement('div');
            el.id = 'wbr-root';
            el.className = 'wbr';
            tab.insertBefore(el, tab.firstChild);
        }
        return el;
    }

    // ───── данные ─────
    async function fetchAll(build) {
        const out = [];
        for (let from = 0; from < 20000; from += 1000) {
            const { data, error } = await build().range(from, from + 999);
            if (error) throw error;
            out.push(...(data || []));
            if (!data || data.length < 1000) break;
        }
        return out;
    }

    async function loadMonth() {
        const first = `${S.ym}-01`, last = `${S.ym}-${pad2(daysInMonth(S.ym))}`;
        const { data, error } = await sb().from('report_uploads')
            .select('id, report_type, slot, report_date, file_name, rows_count, summary, created_at')
            .eq('cabinet_id', S.cab).gte('report_date', first).lte('report_date', last);
        if (error) throw error;
        S.uploads = data || [];
    }

    async function loadDay() {
        S.rows = S.day ? await fetchAll(() => sb().from('report_rows')
            .select('report_type, slot, article, nm_id, barcode, size, warehouse, qty, amount, extra')
            .eq('cabinet_id', S.cab).eq('report_date', S.day).in('report_type', ['fin', 'sales', 'dynamics'])) : [];
        const first = `${S.ym}-01`, last = `${S.ym}-${pad2(daysInMonth(S.ym))}`;
        S.monthRows = await fetchAll(() => sb().from('report_rows')
            .select('article, qty, amount, extra, report_date')
            .eq('cabinet_id', S.cab).eq('report_type', 'dynamics').gte('report_date', first).lte('report_date', last));
        // остатки: последние загруженные не позже выбранного дня
        const { data: stUp } = await sb().from('report_uploads')
            .select('id, report_type, slot, report_date, file_name, rows_count, summary')
            .eq('cabinet_id', S.cab).in('report_type', ['stock_fbo', 'stock_fbs']).lte('report_date', S.day || todayBishkek())
            .order('report_date', { ascending: false }).limit(40);
        const pick = { fbo: null, fbs: {} };
        for (const u of stUp || []) {
            if (u.report_type === 'stock_fbo' && !pick.fbo) pick.fbo = u;
            if (u.report_type === 'stock_fbs' && !pick.fbs[u.slot]) pick.fbs[u.slot] = u;
        }
        const ids = [pick.fbo, ...Object.values(pick.fbs)].filter(Boolean).map(u => u.id);
        const rows = ids.length ? await fetchAll(() => sb().from('report_rows').select('upload_id, article, barcode, size, qty').in('upload_id', ids)) : [];
        const by = {};
        rows.forEach(r => { (by[r.upload_id] = by[r.upload_id] || []).push(r); });
        S.stocks = {
            fbo: pick.fbo ? { up: pick.fbo, rows: by[pick.fbo.id] || [] } : null,
            fbs: Object.fromEntries(Object.entries(pick.fbs).map(([slot, u]) => [slot, { up: u, rows: by[u.id] || [] }])),
        };
    }

    async function loadArts() {
        if (S.artsFor === S.cab) return;
        const { data } = await sb().from('rnp_articles').select('nm_id, name, photo_url').eq('cabinet_id', S.cab).limit(2000);
        S.arts = new Map();
        (data || []).forEach(a => {
            if (a.name) S.arts.set(String(a.name).toLowerCase(), a);
            if (a.nm_id) S.arts.set(String(a.nm_id), a);
        });
        S.artsFor = S.cab;
    }

    async function reload() {
        try {
            await Promise.all([loadMonth(), loadArts()]);
            await loadDay();
            S.err = '';
        } catch (e) {
            S.err = e && e.code === '42P01' ? 'Таблицы для отчётов ещё не созданы. Напишите в поддержку.' : (e.message || 'Не удалось загрузить данные');
        }
        S.loaded = true;
        render();
    }

    // ───── сохранение ─────
    async function saveReport(type, slot, day, rows, summary, fileName) {
        const del = await sb().from('report_uploads').delete().eq('cabinet_id', S.cab).eq('report_type', type).eq('slot', slot).eq('report_date', day);
        if (del.error) throw del.error;
        const ins = await sb().from('report_uploads').insert({ cabinet_id: S.cab, report_type: type, slot, report_date: day, file_name: fileName, rows_count: rows.length, summary: summary || {} }).select('id').single();
        if (ins.error) throw ins.error;
        const id = ins.data.id;
        try {
            for (let i = 0; i < rows.length; i += 400) {
                const chunk = rows.slice(i, i + 400).map(r => ({
                    upload_id: id, cabinet_id: S.cab, report_type: type, report_date: day, slot,
                    article: r.article || null, nm_id: r.nm_id || null, barcode: r.barcode || null, size: r.size || null,
                    warehouse: r.warehouse || null, qty: r.qty || 0, amount: r.amount || 0, extra: r.extra || {},
                }));
                const { error } = await sb().from('report_rows').insert(chunk);
                if (error) throw error;
            }
        } catch (e) {
            await sb().from('report_uploads').delete().eq('id', id);
            throw e;
        }
    }

    function freeFbsSlot(day) {
        const used = new Set(S.uploads.filter(u => u.report_type === 'stock_fbs' && u.report_date === day).map(u => u.slot));
        for (let i = 1; i <= 5; i++) if (!used.has(i)) return i;
        return 0;
    }

    function say(kind, text) { S.msg = { kind, text }; render(); }

    async function handleFiles(fileList, forced) {
        if (S.busy) return;
        const files = [...fileList].filter(Boolean);
        if (!files.length) return;
        if (!S.cab) return say('err', 'Сначала выберите кабинет.');
        S.busy = true;
        say('info', 'Читаю файлы…');
        const done = [], errors = [];
        // 1) разбираем все файлы; день берём из финансового отчёта, продаж или динамики
        const parsedList = [];
        for (const f of files) {
            try {
                if (!/\.xlsx$/i.test(f.name)) throw new Error('нужен файл Excel (.xlsx)');
                parsedList.push({ f, parsed: await P.parseReportFile(await f.arrayBuffer(), f.name) });
            } catch (e) {
                errors.push(`«${f.name}»: ${e.message || e}`);
            }
        }
        const dated = parsedList.find(x => x.parsed.type !== 'stock_fbo' && x.parsed.type !== 'stock_fbs' && x.parsed.date && !x.parsed.multiDay);
        const batchDay = dated ? dated.parsed.date : (S.day || todayBishkek());
        const taken = new Set(S.uploads.filter(u => u.report_type === 'stock_fbs' && u.report_date === batchDay).map(u => u.slot));
        let jumpDay = '';
        // 2) сохраняем
        for (const { f, parsed } of parsedList) {
            try {
                const type = parsed.type;
                const title = TYPE_TITLE[type];
                if (forced && forced.type && forced.type !== type) {
                    errors.push(`«${f.name}»: это «${title}», а вы загружали в «${TYPE_TITLE[forced.type]}». Я положила его в «${title}».`);
                }
                if (type === 'dynamics') {
                    if (!parsed.dates.length) throw new Error('в файле нет дат');
                    for (const d of parsed.dates) {
                        await saveReport('dynamics', 1, d, parsed.perDay[d].rows, parsed.perDay[d].summary, f.name);
                    }
                    jumpDay = jumpDay || parsed.dates[parsed.dates.length - 1];
                    done.push(`${title}: ${parsed.dates.length} дн., ${parsed.lines} строк`);
                } else if (type === 'stock_fbo' || type === 'stock_fbs') {
                    let slot = 1;
                    if (type === 'stock_fbs') {
                        if (forced && forced.type === 'stock_fbs' && forced.slot) slot = forced.slot;
                        else { slot = [1, 2, 3, 4, 5].find(i => !taken.has(i)) || 0; }
                        if (!slot) throw new Error('все 5 складов ФБС за этот день уже загружены. Нажмите на нужный склад, чтобы заменить файл');
                        taken.add(slot);
                    }
                    await saveReport(type, slot, batchDay, parsed.rows, parsed.summary, f.name);
                    jumpDay = jumpDay || batchDay;
                    done.push(`${title}${type === 'stock_fbs' ? ' · склад ' + slot : ''} за ${ruDay(batchDay)}: ${parsed.lines} строк, ${fmt(parsed.summary.stock)} шт.`);
                } else {
                    if (parsed.multiDay) throw new Error(`в отчёте период ${ruDay(parsed.period.from)} – ${ruDay(parsed.period.to)}. Скачайте отчёт за один день`);
                    if (!parsed.date) throw new Error('не нашла в файле дату. Добавьте дату в название файла или скачайте отчёт за один день');
                    await saveReport(type, 1, parsed.date, parsed.rows, parsed.summary, f.name);
                    jumpDay = jumpDay || parsed.date;
                    done.push(`${title} за ${ruDay(parsed.date)}: ${parsed.lines} строк`);
                }
            } catch (e) {
                errors.push(`«${f.name}»: ${(e && (e.message || e.details)) || e}`);
            }
        }
        S.busy = false;
        if (jumpDay) { S.day = batchDay || jumpDay; S.ym = S.day.slice(0, 7); }
        await reload();
        const text = [done.length ? 'Загружено: ' + done.join('; ') + '.' : '', ...errors].filter(Boolean).join(' ');
        say(done.length && !errors.length ? 'ok' : (done.length ? 'info' : 'err'), text || 'Ничего не загрузилось.');
    }

    async function removeUpload(type, slot) {
        const up = S.uploads.find(u => u.report_type === type && u.slot === slot && u.report_date === S.day);
        if (!up) return;
        if (!confirm(`Удалить «${TYPE_TITLE[type]}${type === 'stock_fbs' ? ' · склад ' + slot : ''}» за ${ruDay(S.day)}?`)) return;
        const { error } = await sb().from('report_uploads').delete().eq('id', up.id);
        if (error) return say('err', 'Не удалось удалить: ' + error.message);
        await reload();
        say('ok', 'Отчёт удалён.');
    }

    // ───── показ ─────
    const dayUps = (day) => S.uploads.filter(u => u.report_date === day);
    function dayStatus(day) {
        const ups = dayUps(day);
        const got = new Set(ups.map(u => u.report_type));
        const n = ['fin', 'sales', 'dynamics', 'stock_fbo', 'stock_fbs'].filter(t => got.has(t)).length;
        return { n, cls: n === 5 ? 'is-full' : (n > 0 ? 'is-part' : '') };
    }
    const upOf = (type, slot = 1) => S.uploads.find(u => u.report_type === type && u.slot === slot && u.report_date === S.day);

    function head() {
        return `<div class="wbr-card">
          <h2 class="wbr-h1">Отчёты Wildberries</h2>
          <p class="wbr-sub">Скачайте отчёты в личном кабинете WB и перетащите файлы сюда. Система сама поймёт, что это за отчёт и за какой день, и разложит данные по дням.</p>
          <div class="wbr-steps">${SLOTS.map(s => `<div class="wbr-step"><i style="background:${s.color}">${s.n}</i>${esc(s.title)}</div>`).join('')}</div>
          <div class="wbr-drop" data-wbr-drop><b>Перетащите файлы сюда или нажмите, чтобы выбрать</b><span>Можно сразу все файлы. Формат .xlsx. Если файл за другой день, я сама перейду на нужный день.</span></div>
          <input type="file" accept=".xlsx" multiple hidden data-wbr-file>
          ${S.msg ? `<div class="wbr-msg ${S.msg.kind}">${esc(S.msg.text)}</div>` : ''}
          ${S.err ? `<div class="wbr-msg err">${esc(S.err)}</div>` : ''}
        </div>`;
    }

    function monthStrip() {
        const dim = daysInMonth(S.ym), today = todayBishkek();
        const cells = [];
        for (let d = 1; d <= dim; d++) {
            const iso = `${S.ym}-${pad2(d)}`;
            const st = dayStatus(iso);
            cells.push(`<button type="button" class="wbr-day ${st.cls} ${iso === S.day ? 'is-sel' : ''} ${iso > today ? 'is-future' : ''}" data-wbr-day="${iso}">${d}<small>${st.n ? st.n + ' из 5' : '—'}</small></button>`);
        }
        const mi = +S.ym.slice(5, 7) - 1;
        return `<div class="wbr-card">
          <div class="wbr-month"><button type="button" class="wbr-mbtn" data-wbr-month="-1">‹</button><b>${MONTHS[mi]} ${S.ym.slice(0, 4)}</b><button type="button" class="wbr-mbtn" data-wbr-month="1">›</button></div>
          <div class="wbr-days">${cells.join('')}</div>
          <div class="wbr-legend"><span><i style="background:rgba(22,163,74,.4)"></i>загружены все 5</span><span><i style="background:rgba(234,179,8,.5)"></i>загружено частично</span><span><i style="background:var(--border,#e5e7eb)"></i>пусто</span></div>
        </div>`;
    }

    function slotCard(s) {
        const ups = S.uploads.filter(u => u.report_type === s.type && u.report_date === S.day);
        const done = ups.length > 0;
        let state;
        if (s.type === 'stock_fbs') {
            const cells = [1, 2, 3, 4, 5].map(i => {
                const u = ups.find(x => x.slot === i);
                return `<div class="wbr-fbs-i ${u ? 'is-done' : ''}" data-wbr-fbs="${i}" title="${u ? esc(u.file_name || '') : 'Загрузить склад ' + i}">${i}<small>${u ? fmt(u.summary && u.summary.stock) + ' шт' : '+'}</small></div>`;
            }).join('');
            state = `<div class="wbr-fbs">${cells}</div><div class="wbr-slot-state ${done ? 'ok' : 'no'}">${done ? `Загружено складов: ${ups.length} из 5` : 'Не загружено'}</div>`;
        } else if (done) {
            const u = ups[0];
            state = `<div class="wbr-slot-state ok">✓ Загружено · ${fmt(u.rows_count)} строк<small>${esc(u.file_name || '')}</small></div>`;
        } else state = `<div class="wbr-slot-state no">Не загружен</div>`;
        const btns = s.type === 'stock_fbs'
            ? `<button type="button" class="wbr-btn pri" data-wbr-pick="stock_fbs:0">Выбрать файл</button>${done ? '<button type="button" class="wbr-btn del" data-wbr-clear="stock_fbs">Убрать склад…</button>' : ''}`
            : `<button type="button" class="wbr-btn ${done ? '' : 'pri'}" data-wbr-pick="${s.type}:1">${done ? 'Заменить файл' : 'Выбрать файл'}</button>${done ? `<button type="button" class="wbr-btn del" data-wbr-del="${s.type}:1">Удалить</button>` : ''}`;
        return `<div class="wbr-slot ${done ? 'is-done' : ''}" data-wbr-slotdrop="${s.type}">
          <div class="wbr-slot-h"><i style="background:${s.color}">${s.n}</i><div><b>${esc(s.title)}</b><small>${esc(s.sub)}</small></div></div>
          ${state}
          <div class="wbr-slot-hint"><b>Где взять:</b> ${esc(s.hint)}</div>
          <div class="wbr-btns">${btns}</div>
        </div>`;
    }

    function slotsBlock() {
        return `<div class="wbr-card"><div class="wbr-sec"><h3>Отчёты за ${esc(ruDay(S.day))}</h3><span class="wbr-sub">Загрузите по одному файлу в каждое окно</span></div>
          <div class="wbr-slots">${SLOTS.map(slotCard).join('')}</div></div>`;
    }

    const fin = () => (upOf('fin') || {}).summary || null;
    const dynS = () => (upOf('dynamics') || {}).summary || null;
    const salS = () => (upOf('sales') || {}).summary || null;

    function summaryBlock() {
        const f = fin(), d = dynS() || salS();
        if (!f && !d) return `<div class="wbr-card"><div class="wbr-empty">За ${esc(ruDay(S.day))} пока нет данных. Загрузите отчёты выше, и здесь появятся итоги дня.</div></div>`;
        const parts = [];
        if (f) {
            const net = f.sales_sum - f.returns_sum;
            const serv = f.commission + f.logistics + f.ads + f.storage + f.penalty + f.hold_other;
            const pct = (x) => (serv > 0 ? Math.round(x / serv * 100) : 0);
            parts.push(`<div class="wbr-kpi"><h4>Реализация</h4><div class="v">${fmt(net)}</div>
              <ul><li><span>Продажи (${fmt(f.sales_qty)} шт)</span><b>${fmt(f.sales_sum)}</b></li><li><span>Возвраты (${fmt(f.returns_qty)} шт)</span><b>−${fmt(f.returns_sum)}</b></li></ul>
              <div class="wbr-bar"><i style="width:${net > 0 ? Math.max(0, 100 - Math.round(f.returns_sum / (f.sales_sum || 1) * 100)) : 0}%;background:#16a34a"></i><i style="flex:1;background:#ef4444"></i></div></div>`);
            parts.push(`<div class="wbr-kpi"><h4>Услуги WB</h4><div class="v">${fmt(serv)}</div>
              <ul><li><span>Комиссия</span><b>${fmt(f.commission)} · ${pct(f.commission)}%</b></li><li><span>Логистика</span><b>${fmt(f.logistics)} · ${pct(f.logistics)}%</b></li><li><span>Реклама (WB Продвижение)</span><b>${fmt(f.ads)} · ${pct(f.ads)}%</b></li><li><span>Хранение, штрафы, прочее</span><b>${fmt(f.storage + f.penalty + f.hold_other)}</b></li></ul>
              <div class="wbr-bar"><i style="width:${pct(f.commission)}%;background:#f59e0b"></i><i style="width:${pct(f.logistics)}%;background:#38bdf8"></i><i style="width:${pct(f.ads)}%;background:#a855f7"></i><i style="flex:1;background:#6366f1"></i></div></div>`);
            parts.push(`<div class="wbr-kpi"><h4>К перечислению за день</h4><div class="v ${f.to_pay_total >= 0 ? 'pos' : 'neg'}">${fmt(f.to_pay_total)}</div>
              <ul><li><span>За проданные товары</span><b>${fmt(f.to_pay_sales)}</b></li><li><span>Компенсации</span><b>${fmt(f.compensation)}</b></li><li><span>За возвраты</span><b>−${fmt(f.to_pay_returns)}</b></li></ul></div>`);
        }
        if (d) {
            parts.push(`<div class="wbr-kpi"><h4>Заказы</h4><div class="v">${fmt(d.ordered_sum)}</div><ul><li><span>Заказано, шт</span><b>${fmt(d.ordered_qty)}</b></li><li><span>Выкуплено, шт</span><b>${fmt(d.bought_qty)}</b></li><li><span>К перечислению за выкупы</span><b>${fmt(d.to_pay)}</b></li></ul></div>`);
        }
        return `<div class="wbr-card"><div class="wbr-sec"><h3>Итоги дня · ${esc(ruDay(S.day))}</h3><span class="wbr-sub">Суммы в валюте отчёта</span></div><div class="wbr-grid">${parts.join('')}</div></div>`;
    }

    function artMeta(article, nm) {
        return S.arts.get(String(article || '').toLowerCase()) || (nm ? S.arts.get(String(nm)) : null) || null;
    }

    function productsBlock() {
        let list;
        if (S.period === 'month') {
            const m = new Map();
            S.monthRows.forEach(r => {
                const x = m.get(r.article) || { article: r.article, qty: 0, amount: 0, bought: 0, to_pay: 0 };
                x.qty += +r.qty || 0; x.amount += +r.amount || 0; x.bought += +(r.extra && r.extra.bought) || 0; x.to_pay += +(r.extra && r.extra.to_pay) || 0;
                m.set(r.article, x);
            });
            list = [...m.values()];
        } else {
            const dyn = S.rows.filter(r => r.report_type === 'dynamics');
            if (dyn.length) list = dyn.map(r => ({ article: r.article, qty: +r.qty, amount: +r.amount, bought: +(r.extra && r.extra.bought) || 0, to_pay: +(r.extra && r.extra.to_pay) || 0 }));
            else {
                const m = new Map();
                S.rows.filter(r => r.report_type === 'sales').forEach(r => {
                    const x = m.get(r.article) || { article: r.article, nm_id: r.nm_id, qty: 0, amount: 0, bought: 0, to_pay: 0 };
                    x.qty += +r.qty || 0; x.amount += +r.amount || 0; x.bought += +(r.extra && r.extra.bought) || 0; x.to_pay += +(r.extra && r.extra.to_pay) || 0;
                    m.set(r.article, x);
                });
                list = [...m.values()];
            }
        }
        list = list.filter(x => x.qty || x.amount || x.bought).sort((a, b) => b.amount - a.amount);
        const tabs = `<div class="wbr-tabs"><button type="button" data-wbr-period="day" class="${S.period === 'day' ? 'on' : ''}">День</button><button type="button" data-wbr-period="month" class="${S.period === 'month' ? 'on' : ''}">Месяц</button></div>`;
        if (!list.length) return `<div class="wbr-card"><div class="wbr-sec"><h3>Какие товары продаются лучше</h3>${tabs}</div><div class="wbr-empty">Для этого нужен отчёт «Динамика продаж» или «Продажи».</div></div>`;
        const total = list.reduce((s, x) => s + x.amount, 0) || 1;
        const max = list[0].amount || 1;
        const shown = S.all ? list : list.slice(0, 15);
        const stockBy = stockByArticle();
        const rowsHtml = shown.map((x, i) => {
            const a = artMeta(x.article, x.nm_id);
            const photo = a && a.photo_url ? `<img src="${esc(a.photo_url)}" alt="" loading="lazy">` : '<span class="ph"></span>';
            const st = stockBy.get(String(x.article || '').toLowerCase());
            return `<tr><td><div class="wbr-prod">${photo}<div><b>${i + 1}. ${esc(x.article || '—')}</b><small>${Math.round(x.amount / total * 100)}% от всех заказов</small><span class="wbr-meter"><i style="width:${Math.round(x.amount / max * 100)}%"></i></span></div></div></td>
              <td>${fmt(x.qty)}</td><td>${fmt(x.amount)}</td><td>${fmt(x.bought)}</td><td>${fmt(x.to_pay)}</td><td>${st == null ? '—' : fmt(st)}</td></tr>`;
        }).join('');
        return `<div class="wbr-card"><div class="wbr-sec"><h3>Какие товары продаются лучше</h3>${tabs}</div>
          <div style="overflow-x:auto"><table class="wbr-tbl"><thead><tr><th>Товар</th><th>Заказано, шт</th><th>Сумма заказов</th><th>Выкуплено, шт</th><th>К перечислению</th><th>Остаток всего, шт</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>
          ${list.length > 15 ? `<button type="button" class="wbr-btn wbr-more" data-wbr-all>${S.all ? 'Свернуть' : 'Показать все (' + list.length + ')'}</button>` : ''}</div>`;
    }

    function stockByArticle() {
        const m = new Map();
        const add = (a, q) => { const k = String(a || '').toLowerCase(); if (k) m.set(k, (m.get(k) || 0) + q); };
        if (S.stocks.fbo) S.stocks.fbo.rows.forEach(r => add(r.article, +r.qty || 0));
        Object.values(S.stocks.fbs).forEach(s => s.rows.forEach(r => add(r.article, +r.qty || 0)));
        return (S.stocks.fbo || Object.keys(S.stocks.fbs).length) ? m : new Map();
    }

    function stocksBlock() {
        const fbo = S.stocks.fbo, fbs = S.stocks.fbs;
        if (!fbo && !Object.keys(fbs).length) return `<div class="wbr-card"><div class="wbr-sec"><h3>Остатки</h3></div><div class="wbr-empty">Загрузите «Остатки WB (ФБО)» и «Остатки ФБС» (до 5 складов).</div></div>`;
        const sumRows = (rows) => rows.reduce((s, r) => s + (+r.qty || 0), 0);
        const cards = [];
        if (fbo) cards.push(`<div><small>Склады WB (ФБО) · на ${ruDay(fbo.up.report_date)}</small><b>${fmt(sumRows(fbo.rows))} шт</b></div>`);
        for (let i = 1; i <= 5; i++) {
            const s = fbs[i];
            cards.push(`<div style="${s ? '' : 'opacity:.45'}"><small>ФБС склад ${i}${s ? ' · ' + ruDay(s.up.report_date) : ''}</small><b>${s ? fmt(sumRows(s.rows)) + ' шт' : '—'}</b></div>`);
        }
        const per = new Map();
        const touch = (a) => { const k = String(a || '—'); if (!per.has(k)) per.set(k, { article: k, fbo: 0, fbs: [0, 0, 0, 0, 0] }); return per.get(k); };
        if (fbo) fbo.rows.forEach(r => { touch(r.article).fbo += +r.qty || 0; });
        Object.entries(fbs).forEach(([slot, s]) => s.rows.forEach(r => { touch(r.article).fbs[slot - 1] += +r.qty || 0; }));
        const list = [...per.values()].map(x => ({ ...x, total: x.fbo + x.fbs.reduce((a, b) => a + b, 0) })).sort((a, b) => b.total - a.total).slice(0, 40);
        const used = [1, 2, 3, 4, 5].filter(i => fbs[i]);
        const head = `<th>Артикул</th>${fbo ? '<th>ФБО</th>' : ''}${used.map(i => `<th>ФБС ${i}</th>`).join('')}<th>Всего</th>`;
        const body = list.map(x => `<tr><td>${esc(x.article)}</td>${fbo ? `<td>${fmt(x.fbo)}</td>` : ''}${used.map(i => `<td>${fmt(x.fbs[i - 1])}</td>`).join('')}<td><b>${fmt(x.total)}</b></td></tr>`).join('');
        return `<div class="wbr-card"><div class="wbr-sec"><h3>Остатки: ФБО и 5 складов ФБС</h3><span class="wbr-sub">Показаны последние загруженные не позже ${esc(ruDay(S.day))}</span></div>
          <div class="wbr-wh">${cards.join('')}</div>
          <div style="overflow-x:auto"><table class="wbr-tbl"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>
          ${per.size > 40 ? `<p class="wbr-sub" style="margin-top:8px">Показаны 40 артикулов с наибольшим остатком из ${per.size}.</p>` : ''}</div>`;
    }

    function chartBlock() {
        const dim = daysInMonth(S.ym);
        const vals = [];
        let max = 0;
        for (let d = 1; d <= dim; d++) {
            const iso = `${S.ym}-${pad2(d)}`;
            const dy = S.uploads.find(u => u.report_type === 'dynamics' && u.report_date === iso);
            const fn = S.uploads.find(u => u.report_type === 'fin' && u.report_date === iso);
            const o = dy ? +dy.summary.ordered_sum || 0 : 0;
            const s = fn ? (+fn.summary.sales_sum || 0) - (+fn.summary.returns_sum || 0) : 0;
            vals.push({ d, iso, o, s });
            max = Math.max(max, o, s);
        }
        if (!max) return '';
        const cols = vals.map(v => `<div class="wbr-col ${v.iso === S.day ? 'is-sel' : ''}" data-wbr-day="${v.iso}" title="${ruDay(v.iso)}: заказы ${fmt(v.o)}, реализация ${fmt(v.s)}"><div><i style="height:${Math.round(v.o / max * 100)}%;background:#f97316"></i><i style="height:${Math.round(v.s / max * 100)}%;background:#3b82f6"></i></div><small>${v.d}</small></div>`).join('');
        return `<div class="wbr-card"><div class="wbr-sec"><h3>Динамика по дням</h3><span class="wbr-legend" style="margin:0"><span><i style="background:#f97316"></i>Заказы</span><span><i style="background:#3b82f6"></i>Реализация (финотчёт)</span></span></div><div class="wbr-chart">${cols}</div></div>`;
    }

    function render() {
        const el = getRoot();
        if (!el) return;
        if (!S.cab) { el.innerHTML = head() + '<div class="wbr-card"><div class="wbr-empty">Выберите кабинет в шапке страницы.</div></div>'; bind(el); return; }
        el.innerHTML = head() + monthStrip() + slotsBlock() + summaryBlock() + productsBlock() + stocksBlock() + chartBlock();
        bind(el);
    }

    let pendingPick = null;
    function bind(el) {
        const input = el.querySelector('[data-wbr-file]');
        const drop = el.querySelector('[data-wbr-drop]');
        const openPicker = (forced) => { pendingPick = forced || null; input.value = ''; input.click(); };
        if (input) input.onchange = () => { const f = pendingPick; pendingPick = null; handleFiles(input.files, f); };
        const over = (node, on) => node && node.classList.toggle(node.classList.contains('wbr-slot') ? 'is-over' : 'is-over', on);
        const wireDrop = (node, forced) => {
            node.addEventListener('dragover', (e) => { e.preventDefault(); over(node, true); });
            node.addEventListener('dragleave', () => over(node, false));
            node.addEventListener('drop', (e) => { e.preventDefault(); over(node, false); handleFiles(e.dataTransfer.files, forced); });
        };
        if (drop) { drop.onclick = () => openPicker(null); wireDrop(drop, null); }
        el.querySelectorAll('[data-wbr-slotdrop]').forEach(n => wireDrop(n, { type: n.getAttribute('data-wbr-slotdrop') }));
        el.onclick = (e) => {
            const t = e.target;
            const day = t.closest('[data-wbr-day]');
            if (day) { S.day = day.getAttribute('data-wbr-day'); S.msg = null; loadDay().then(render).catch(() => render()); render(); return; }
            const mon = t.closest('[data-wbr-month]');
            if (mon) {
                const y = +S.ym.slice(0, 4), m = +S.ym.slice(5, 7) - 1 + (+mon.getAttribute('data-wbr-month'));
                const d = new Date(Date.UTC(y, m, 1));
                S.ym = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
                S.day = `${S.ym}-01`;
                reload();
                return;
            }
            const pick = t.closest('[data-wbr-pick]');
            if (pick) { const [type, slot] = pick.getAttribute('data-wbr-pick').split(':'); openPicker({ type, slot: +slot || 0 }); return; }
            const fbs = t.closest('[data-wbr-fbs]');
            if (fbs) { openPicker({ type: 'stock_fbs', slot: +fbs.getAttribute('data-wbr-fbs') }); return; }
            const del = t.closest('[data-wbr-del]');
            if (del) { const [type, slot] = del.getAttribute('data-wbr-del').split(':'); removeUpload(type, +slot); return; }
            if (t.closest('[data-wbr-clear]')) {
                const n = prompt('Какой склад убрать? Введите номер от 1 до 5');
                if (n && /^[1-5]$/.test(n.trim())) removeUpload('stock_fbs', +n.trim());
                return;
            }
            const per = t.closest('[data-wbr-period]');
            if (per) { S.period = per.getAttribute('data-wbr-period'); render(); return; }
            if (t.closest('[data-wbr-all]')) { S.all = !S.all; render(); }
        };
    }

    // ───── запуск ─────
    function relabelNav() {
        document.querySelectorAll('.nav-item[onclick*="showTab(\'summary\'"] .nav-item-label').forEach(l => { l.textContent = 'Отчёты WB'; });
    }

    function boot() {
        const tab = document.getElementById('tab-summary');
        if (!tab) return;
        ensureStyle();
        relabelNav();
        const ensure = () => {
            if (!tab.classList.contains('active')) return;
            const cab = root.currentCabinetId || null;
            if (!S.day) {
                S.day = new Date(Date.now() + 6 * 3600000 - 86400000).toISOString().slice(0, 10);
                S.ym = S.day.slice(0, 7);
            }
            if (!S.loaded || cab !== S.cab) {
                S.cab = cab; S.loaded = false;
                if (!cab) { render(); return; }
                render();
                reload();
            } else if (!document.getElementById('wbr-root')) render();
        };
        new MutationObserver(ensure).observe(tab, { attributes: true, attributeFilter: ['class'] });
        document.addEventListener('click', () => setTimeout(ensure, 120), true);
        ensure();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();

    root.WbReports = { state: S, reload, render, handleFiles };
})(typeof window !== 'undefined' ? window : globalThis);

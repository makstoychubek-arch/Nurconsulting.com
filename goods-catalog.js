/**
 * Каталог «Товары» для ИП Уркунбаев / Zevina 1.
 * Порядок разделов — как в таблице остатков.
 * ФБО/ФБС — живые wb_stocks.
 * В пути и в плане для Уркунбаева — из таблицы (поставка Бишкек→Россия), не из WB.
 * Правки пользователя (manual_data.goods_transit / goods_plan) перекрывают таблицу.
 */
(function (root) {
    const ZEVINA1_SECTIONS = [{"name":"Свитера","items":[{"name":"Свитер-айвори","nmId":1218782505,"transit":3500,"plan":0},{"name":"Свитер-бордо","nmId":1218802103,"transit":1000,"plan":0},{"name":"Свитер-шоко","nmId":1218796940,"transit":1700,"plan":0},{"name":"Свитер-серый","nmId":1218799336,"transit":800,"plan":0}]},{"name":"Костюм укороч","items":[{"name":"укороч_костюм_брючный_коричневый","nmId":296564448,"transit":761,"plan":3000},{"name":"укороч_костюм_брючный_черный","nmId":247350276,"transit":1704,"plan":3000},{"name":"укороч_костюм_брючный_красный","nmId":262697143,"transit":203,"plan":1500},{"name":"укороч_костюм_брючный_серый","nmId":247350377,"transit":790,"plan":1000},{"name":"укороч_костюм_брючный_бардо","nmId":262714507,"transit":579,"plan":1000},{"name":"укороч_костюм_брючный_электрик","nmId":296564447,"transit":341,"plan":0},{"name":"укороч_костюм_брючный_бежевый","nmId":262760469,"transit":438,"plan":0},{"name":"укороч_костюм_брючный_темносиний","nmId":892565628,"transit":412,"plan":1000},{"name":"укороч_костюм_брючный_белый","nmId":435735287,"transit":34,"plan":0}]},{"name":"Костюм оверсайз","items":[{"name":"костюм_оверсайз_красный","nmId":391116477,"transit":391,"plan":0},{"name":"костюм_оверсайз_бордовый","nmId":296556346,"transit":24,"plan":0},{"name":"костюм_оверсайз_бежевый","nmId":296556350,"transit":55,"plan":0},{"name":"костюм_оверсайз_шоколад","nmId":296556347,"transit":677,"plan":1500},{"name":"костюм_оверсайз_черный","nmId":295201148,"transit":1095,"plan":1500},{"name":"костюм_оверсайз_электрик","nmId":296556348,"transit":5,"plan":0},{"name":"костюм_оверсайз_серый","nmId":391116472,"transit":349,"plan":700},{"name":"костюм_оверсайз_темносин","nmId":399607068,"transit":389,"plan":700},{"name":"костюм_оверсайз_белый","nmId":435743074,"transit":32,"plan":0}]},{"name":"Пиджак оверсайз","items":[{"name":"пиджак серый","nmId":247347214,"transit":26,"plan":0},{"name":"пиджак_Беж_неоаал","nmId":429715568,"transit":70,"plan":0},{"name":"пиджак_шоко2","nmId":287679331,"transit":32,"plan":0},{"name":"пиджак_электрик2","nmId":287679857,"transit":47,"plan":0},{"name":"пиджак_NEW_красный","nmId":409845462,"transit":22,"plan":0},{"name":"пиджак черный","nmId":247347924,"transit":34,"plan":0},{"name":"пиджак_бургунди2","nmId":287679332,"transit":38,"plan":0},{"name":"пиджак_NEW_темносин","nmId":409845463,"transit":114,"plan":0},{"name":"пиджак_белый2","nmId":287679856,"transit":50,"plan":0}]},{"name":"Рич","items":[{"name":"Спорт_костюм_sport_rich_серый","nmId":539401905,"transit":0,"plan":0},{"name":"Спорт_костюм_sport_rich_шоко","nmId":539908484,"transit":0,"plan":0},{"name":"Спорт_костюм_sport_rich_айвори","nmId":539908473,"transit":0,"plan":0},{"name":"Спорт_костюм_sport_rich_синий","nmId":539908479,"transit":0,"plan":0},{"name":"Спорт_костюм_sport_rich_бордо","nmId":539908481,"transit":0,"plan":0},{"name":"Спорт_костюм_sport_rich_новый_бежевый","nmId":603633471,"transit":0,"plan":0},{"name":"Спорт_костюм_sport_rich_черный","nmId":539908477,"transit":0,"plan":0}]},{"name":"Костюм велюр","items":[{"name":"двойка_костюм_велюр_черный","nmId":705387379,"transit":0,"plan":0},{"name":"двойка_костюм_велюр_темно-синий","nmId":705387385,"transit":0,"plan":0},{"name":"двойка_костюм_велюр_розовый","nmId":705387381,"transit":0,"plan":0},{"name":"двойка_костюм_велюр_серый","nmId":705387382,"transit":0,"plan":0},{"name":"двойка_костюм_велюр_изумруд","nmId":705387380,"transit":0,"plan":0},{"name":"двойка_костюм_велюр_хакки","nmId":705387383,"transit":0,"plan":0},{"name":"двойка_костюм_велюр_капучино","nmId":705381484,"transit":0,"plan":0},{"name":"двойка_костюм_велюр_ коралловый","nmId":705387384,"transit":0,"plan":0},{"name":"двойка_костюм_велюр_марсала","nmId":705387388,"transit":0,"plan":0},{"name":"двойка_костюм_велюр_красный","nmId":705387387,"transit":0,"plan":0},{"name":"двойка_костюм_велюр_молочный","nmId":705387386,"transit":0,"plan":0}]},{"name":"Костюм велюр спорт","items":[{"name":"Спорт_костюм_велюр_черный","nmId":597838497,"transit":0,"plan":0},{"name":"Спорт_костюм_велюр_капучино","nmId":604201351,"transit":0,"plan":0},{"name":"Спорт_костюм_велюр_розовый","nmId":604201359,"transit":0,"plan":0},{"name":"Спорт_костюм_велюр_сирень","nmId":604201358,"transit":0,"plan":0},{"name":"Спорт_костюм_велюр_серый","nmId":604201350,"transit":0,"plan":0},{"name":"Спорт_костюм_велюр_изумруд","nmId":604201361,"transit":0,"plan":0},{"name":"Спорт_костюм_велюр_КОРАЛ","nmId":664192264,"transit":0,"plan":0},{"name":"Спорт_костюм_велюр_хаки","nmId":604201352,"transit":0,"plan":0},{"name":"Спорт_костюм_велюр_бордовый","nmId":604201353,"transit":0,"plan":0},{"name":"Спорт_костюм_велюр_темносин","nmId":604201356,"transit":0,"plan":0}]},{"name":"Пиджак Овальные","items":[{"name":"Пиджак овал серый1","nmId":247348946,"transit":0,"plan":0},{"name":"Пиджак овал серый 2","nmId":391102728,"transit":0,"plan":0},{"name":"Пиджак овал красный","nmId":499378334,"transit":0,"plan":0},{"name":"Пиджак овал черный","nmId":247348479,"transit":0,"plan":0},{"name":"Пиджак овал бардовый","nmId":280128269,"transit":0,"plan":0},{"name":"Пиджак овал синий","nmId":391102730,"transit":0,"plan":0},{"name":"Пиджак овал шоколад","nmId":280129304,"transit":0,"plan":0},{"name":"Пиджак овал серый 3","nmId":499380531,"transit":0,"plan":0},{"name":"Пиджак овал бежевый","nmId":391102732,"transit":0,"plan":0},{"name":"Пиджак овал ментол","nmId":391102729,"transit":0,"plan":0}]},{"name":"Укороченный пиджак","items":[{"name":"пиджак_КОРОТ_шоко","nmId":307425700,"transit":0,"plan":0},{"name":"пиджак_КОРОТ_изумруд","nmId":307425705,"transit":0,"plan":0},{"name":"пиджак_КОРОТ_черный","nmId":307425697,"transit":0,"plan":0},{"name":"пиджак_КОРОТ_электрик","nmId":307425699,"transit":0,"plan":0},{"name":"пиджак_КОРОТ_голубой","nmId":307425707,"transit":0,"plan":0},{"name":"пиджак_КОРОТ_серый","nmId":307425704,"transit":0,"plan":0},{"name":"пиджак_КОРОТ_бордо","nmId":307425701,"transit":0,"plan":0},{"name":"пиджак_КОРОТ_темносин","nmId":307425706,"transit":0,"plan":0},{"name":"пиджак_КОРОТ_бежевый","nmId":307425698,"transit":0,"plan":0},{"name":"пиджак_КОРОТ_белый","nmId":435746744,"transit":0,"plan":0}]},{"name":"Костюм велюр","items":[{"name":"костюм_велюр серый","nmId":633661202,"transit":0,"plan":0},{"name":"костюм_велюр изумруд","nmId":633661207,"transit":0,"plan":0},{"name":"костюм_велюр черный","nmId":633639148,"transit":0,"plan":0},{"name":"костюм_велюр розовый","nmId":766251143,"transit":0,"plan":0},{"name":"костюм_велюр синий","nmId":766251142,"transit":0,"plan":0},{"name":"костюм_велюр капучинно","nmId":633661203,"transit":0,"plan":0},{"name":"костюм_велюр сиреневый","nmId":633661205,"transit":0,"plan":0},{"name":"костюм_велюр корал","nmId":633661208,"transit":0,"plan":0}]},{"name":"Костюмы OLDMONEY","items":[{"name":"костНОВ_жакет_светло-серый","nmId":495053631,"transit":0,"plan":0},{"name":"костНОВ_жакет_бежевый","nmId":495053632,"transit":0,"plan":0},{"name":"костНОВ_жакет_бордо","nmId":495053634,"transit":0,"plan":0},{"name":"костНОВ_жакет_черный","nmId":495053627,"transit":0,"plan":0},{"name":"костНОВ_жакет_темно-синий","nmId":495053638,"transit":0,"plan":0},{"name":"костНОВ_жакет_темно-серый","nmId":495053633,"transit":0,"plan":0},{"name":"костНОВ_жакет_красный","nmId":495053630,"transit":0,"plan":0},{"name":"костНОВ_жакет_шоко","nmId":495053629,"transit":0,"plan":0}]},{"name":"Костюм Originals","items":[{"name":"Спорт_костюм_originals 1987_черный","nmId":539916083,"transit":0,"plan":0},{"name":"Спорт_костюм_originals 1987_бордо","nmId":539916085,"transit":0,"plan":0},{"name":"Спорт_костюм_originals 1987_айвори","nmId":539916078,"transit":0,"plan":0},{"name":"Спорт_костюм_originals 1987_новый_бежевый","nmId":611441510,"transit":0,"plan":0},{"name":"Спорт_костюм_originals 1987_синий","nmId":539916080,"transit":0,"plan":0},{"name":"Спорт_костюм_originals 1987_серый","nmId":539401904,"transit":0,"plan":0}]},{"name":"Бомбер","items":[{"name":"бомбер черный","nmId":262651910,"transit":0,"plan":0},{"name":"бомбер бежевый","nmId":249656298,"transit":0,"plan":0},{"name":"бомбер корич","nmId":249650166,"transit":0,"plan":0},{"name":"бомбер бордо","nmId":262659615,"transit":0,"plan":0},{"name":"бомбер графит","nmId":605813197,"transit":0,"plan":0},{"name":"бомбер серый","nmId":249656107,"transit":0,"plan":0}]},{"name":"Двойка юбка","items":[{"name":"Двойка_юбка_синий полоска","nmId":629645154,"transit":0,"plan":0},{"name":"Двойка_юбка_черный полоска","nmId":629645155,"transit":0,"plan":0},{"name":"Двойка_юбка_шоколад полоска","nmId":629645153,"transit":0,"plan":0},{"name":"Двойка_юбка_коричневый елечка","nmId":629645151,"transit":0,"plan":0},{"name":"Двойка_юбка_серый полоска","nmId":629645152,"transit":0,"plan":0},{"name":"Двойка_юбка_серый елечка","nmId":629645150,"transit":0,"plan":0}]},{"name":"Куртка фуфайка","items":[{"name":"Куртка_фуфайка_белый","nmId":547613172,"transit":0,"plan":0},{"name":"Куртка_фуфайка_кофе","nmId":547613173,"transit":0,"plan":0}]},{"name":"Полупальто","items":[{"name":"полупальто_горч","nmId":271001367,"transit":0,"plan":0},{"name":"полупальто_темнобеж","nmId":271001364,"transit":0,"plan":0},{"name":"полупальто_светлобеж","nmId":271001369,"transit":0,"plan":0},{"name":"полупальто_темносин","nmId":271001368,"transit":0,"plan":0}]},{"name":"Платье Риджак","items":[{"name":"Платье_Пиджак_красный","nmId":495055922,"transit":0,"plan":0},{"name":"Платье_Пиджак_черный","nmId":495055925,"transit":0,"plan":0},{"name":"Платье_Пиджак_СветлоСер","nmId":495055921,"transit":0,"plan":0},{"name":"Платье_Пиджак_бордо","nmId":495055924,"transit":0,"plan":0},{"name":"Платье_Пиджак_мятный","nmId":629846440,"transit":0,"plan":0},{"name":"Платье_Пиджак_ТемноСин","nmId":495055919,"transit":0,"plan":0},{"name":"Платье_Пиджак_шоко","nmId":495055918,"transit":0,"plan":0}]}];

    function isZevina1Cabinet(name) {
        const raw = String(name || '');
        if (/zevina\s*2|зевин[аa]?\s*2/i.test(raw)) return false;
        return /zevina\s*1|зевин[аa]?\s*1|уркунбаев/i.test(raw) ||
            (/zevina|зевин/i.test(raw) && !/2/.test(raw));
    }

    function num(v) {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    }

    function hasManualQty(v) {
        return v !== undefined && v !== null && v !== '';
    }

    function resolveSheetQty(manualVal, catalogVal, useCatalog) {
        if (hasManualQty(manualVal)) return num(manualVal);
        return useCatalog ? num(catalogVal) : 0;
    }

    function parseQty(raw) {
        const t = String(raw ?? '').replace(/\s/g, '').replace(',', '.');
        if (!t) return 0;
        const n = Number(t);
        return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
    }

    function stockOf(row) {
        const fbo = num(row && row.fbo);
        const fbs = num(row && row.fbs);
        const transit = num(row && row.transit);
        const plan = num(row && row.plan);
        return {
            fbo, fbs, transit, plan,
            warehouse: fbo + fbs,
            total: fbo + fbs + transit + plan,
        };
    }

    function emptyLive(nmId, name, item, meta) {
        return {
            nmId: Number(nmId),
            sellerArticle: name || '',
            category: '',
            fbo: 0,
            fbs: 0,
            transit: num(item && item.transit),
            plan: num(item && item.plan),
            cabinetId: (meta && meta.cabinetId) || '',
            cabinetName: (meta && meta.cabinetName) || '',
        };
    }

    function stampCabinet(row, meta) {
        if (!row.cabinetId && meta && meta.cabinetId) row.cabinetId = meta.cabinetId;
        if (!row.cabinetName && meta && meta.cabinetName) row.cabinetName = meta.cabinetName;
        return row;
    }

    function groupByCatalog(liveRows, sections, meta) {
        const byNm = new Map();
        (liveRows || []).forEach((r) => {
            const id = Number(r.nmId);
            if (!id) return;
            const prev = byNm.get(id);
            if (!prev) {
                byNm.set(id, {
                    ...r,
                    nmId: id,
                    fbo: num(r.fbo),
                    fbs: num(r.fbs),
                    transit: num(r.transit),
                    plan: num(r.plan),
                    transitManual: !!r.transitManual,
                    planManual: !!r.planManual,
                });
                return;
            }
            prev.fbo += num(r.fbo);
            prev.fbs += num(r.fbs);
            if (!prev.sellerArticle && r.sellerArticle) prev.sellerArticle = r.sellerArticle;
            if (r.transitManual) {
                prev.transit = num(r.transit);
                prev.transitManual = true;
            }
            if (r.planManual) {
                prev.plan = num(r.plan);
                prev.planManual = true;
            }
        });
        const used = new Set();
        const groups = [];
        (sections || ZEVINA1_SECTIONS).forEach((sec, idx) => {
            const items = (sec.items || []).map((it) => {
                used.add(it.nmId);
                const live = byNm.get(it.nmId);
                const row = live ? { ...live } : emptyLive(it.nmId, it.name, it, meta);
                row.sellerArticle = it.name || row.sellerArticle;
                row.category = sec.name;
                row.transit = resolveSheetQty(live && live.transitManual ? live.transit : undefined, it.transit, true);
                row.plan = resolveSheetQty(live && live.planManual ? live.plan : undefined, it.plan, true);
                if (live && live.transitManual) row.transitManual = true;
                if (live && live.planManual) row.planManual = true;
                return stampCabinet(row, meta);
            });
            groups.push({ key: idx + ':' + sec.name, name: sec.name, items });
        });
        const extra = [...byNm.values()].filter((r) => !used.has(Number(r.nmId)));
        extra.forEach((r) => {
            r.transit = resolveSheetQty(r.transitManual ? r.transit : undefined, 0, false);
            r.plan = resolveSheetQty(r.planManual ? r.plan : undefined, 0, false);
            stampCabinet(r, meta);
        });
        extra.sort((a, b) => String(a.sellerArticle || '').localeCompare(String(b.sellerArticle || ''), 'ru') || a.nmId - b.nmId);
        if (extra.length) groups.push({ key: 'other', name: 'Прочие', items: extra });
        return groups;
    }

    function groupByCategory(liveRows, meta) {
        const map = new Map();
        (liveRows || []).forEach((r) => {
            const cat = String(r.category || '').trim() || 'Без раздела';
            if (!map.has(cat)) map.set(cat, []);
            const row = {
                ...r,
                fbo: num(r.fbo),
                fbs: num(r.fbs),
                transit: resolveSheetQty(r.transitManual ? r.transit : undefined, 0, false),
                plan: resolveSheetQty(r.planManual ? r.plan : undefined, 0, false),
            };
            map.get(cat).push(stampCabinet(row, meta));
        });
        const names = [...map.keys()].sort((a, b) => {
            if (a === 'Без раздела') return 1;
            if (b === 'Без раздела') return -1;
            return a.localeCompare(b, 'ru');
        });
        return names.map((name) => {
            const items = map.get(name).slice().sort((a, b) =>
                String(a.sellerArticle || '').localeCompare(String(b.sellerArticle || ''), 'ru') || Number(a.nmId) - Number(b.nmId)
            );
            return { key: name, name, items };
        });
    }

    function groupGoods(liveRows, cabinetName, meta) {
        const info = { cabinetName: cabinetName || (meta && meta.cabinetName) || '', ...(meta || {}) };
        if (isZevina1Cabinet(info.cabinetName || cabinetName)) return groupByCatalog(liveRows, ZEVINA1_SECTIONS, info);
        return groupByCategory(liveRows, info);
    }

    function flattenGroups(groups) {
        return (groups || []).flatMap((g) => g.items || []);
    }

    function sumItems(items) {
        return (items || []).reduce((acc, row) => {
            const s = stockOf(row);
            acc.fbo += s.fbo;
            acc.fbs += s.fbs;
            acc.transit += s.transit;
            acc.plan += s.plan;
            acc.total += s.total;
            return acc;
        }, { fbo: 0, fbs: 0, transit: 0, plan: 0, total: 0 });
    }

    function filterGroups(groups, q) {
        const needle = String(q || '').trim().toLowerCase();
        if (!needle) return groups;
        return (groups || []).map((g) => ({
            ...g,
            items: g.items.filter((r) =>
                String(r.nmId).includes(needle) ||
                String(r.sellerArticle || '').toLowerCase().includes(needle) ||
                String(g.name || '').toLowerCase().includes(needle)
            ),
        })).filter((g) => g.items.length);
    }

    const GOODS_COLS = [
        { id: 'art', label: 'Артикул', locked: true },
        { id: 'nm', label: 'WB' },
        { id: 'fbo', label: 'ФБО' },
        { id: 'fbs', label: 'ФБС' },
        { id: 'transit', label: 'В пути' },
        { id: 'plan', label: 'В плане' },
        { id: 'total', label: 'Итого' },
    ];

    function visibleCols(hiddenCols) {
        const hide = hiddenCols && typeof hiddenCols === 'object' ? hiddenCols : {};
        return GOODS_COLS.filter((c) => c.locked || !hide[c.id]);
    }

    function hideGroups(groups, hiddenSections) {
        const hide = hiddenSections && typeof hiddenSections === 'object' ? hiddenSections : {};
        return (groups || []).filter((g) => !hide[g.key] && !hide[g.name]);
    }

    function csvCell(v) {
        const s = String(v ?? '');
        if (/[;"\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
        return s;
    }

    function cellExportValue(row, colId) {
        if (colId === 'art') return row.sellerArticle || '';
        if (colId === 'nm') return row.nmId || '';
        const s = stockOf(row);
        if (colId === 'fbo') return s.fbo;
        if (colId === 'fbs') return s.fbs;
        if (colId === 'transit') return s.transit;
        if (colId === 'plan') return s.plan;
        if (colId === 'total') return s.total;
        return '';
    }

    function exportExcelCsv(groups, opts) {
        const cols = visibleCols(opts && opts.hiddenCols);
        const sep = ';';
        const lines = [cols.map((c) => csvCell(c.label)).join(sep)];
        (groups || []).forEach((g) => {
            lines.push(cols.map((c, i) => csvCell(i === 0 ? g.name : '')).join(sep));
            (g.items || []).forEach((row) => {
                lines.push(cols.map((c) => csvCell(cellExportValue(row, c.id))).join(sep));
            });
            const tot = sumItems(g.items);
            lines.push(cols.map((c) => {
                if (c.id === 'art') return csvCell('Итого');
                if (c.id === 'nm') return '';
                return csvCell(tot[c.id] ?? '');
            }).join(sep));
        });
        const grand = sumItems(flattenGroups(groups));
        lines.push(cols.map((c) => {
            if (c.id === 'art') return csvCell('ВСЕГО');
            if (c.id === 'nm') return '';
            return csvCell(grand[c.id] ?? '');
        }).join(sep));
        return '\uFEFF' + lines.join('\n');
    }

    function readManualQty(md, key) {
        if (!md || typeof md !== 'object') return undefined;
        if (!Object.prototype.hasOwnProperty.call(md, key)) return undefined;
        return md[key];
    }

    function warehouseQty(row) {
        return num(row && row.fbo) + num(row && row.fbs);
    }

    const MONTHS_RU = [
        'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
    ];

    function bishkekYmd(date) {
        const src = date instanceof Date ? date : (date ? new Date(date) : new Date());
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Bishkek',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(src);
    }

    function bishkekParts(date) {
        const ymd = bishkekYmd(date);
        const parts = ymd.split('-');
        return { ymd, y: Number(parts[0]), m: Number(parts[1]), d: Number(parts[2]) };
    }

    function monthDayKeys(year, month) {
        const y = Number(year);
        const m = Number(month);
        const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
        const days = [];
        for (let day = 1; day <= last; day++) {
            days.push(y + '-' + String(m).padStart(2, '0') + '-' + String(day).padStart(2, '0'));
        }
        return days;
    }

    function monthTitleRu(year, month) {
        return (MONTHS_RU[Number(month) - 1] || '') + ' ' + Number(year);
    }

    function dayLabel(ymd) {
        const p = String(ymd || '').slice(0, 10).split('-');
        if (p.length < 3) return '';
        return p[2] + '.' + p[1];
    }

    function dailyKey(nmId, date) {
        return Number(nmId) + '|' + String(date || '').slice(0, 10);
    }

    function indexDailyStocks(rows) {
        const map = Object.create(null);
        (rows || []).forEach((r) => {
            const nm = Number(r && (r.nm_id != null ? r.nm_id : r.nmId));
            const date = String((r && r.date) || '').slice(0, 10);
            if (!nm || !date) return;
            map[dailyKey(nm, date)] = {
                qty: num(r.qty),
                fbo: num(r.fbo),
                fbs: num(r.fbs),
            };
        });
        return map;
    }

    function dailyQty(index, nmId, date) {
        const row = index && index[dailyKey(nmId, date)];
        return row ? row.qty : null;
    }

    function sparkValues(index, nmIds, dates) {
        const ids = (nmIds || []).map(Number).filter(Boolean);
        return (dates || []).map((date) => {
            let any = false;
            let sum = 0;
            ids.forEach((id) => {
                const v = dailyQty(index, id, date);
                if (v != null) {
                    any = true;
                    sum += v;
                }
            });
            return any ? sum : null;
        });
    }

    function sparklineSvg(values, w, h) {
        const width = Number(w) || 120;
        const height = Number(h) || 20;
        const pts = [];
        (values || []).forEach((v, i) => {
            if (v == null || v === '') return;
            const n = Number(v);
            if (!Number.isFinite(n)) return;
            pts.push({ i, n });
        });
        if (!pts.length) return '';
        const nums = pts.map((p) => p.n);
        const max = Math.max.apply(null, nums);
        const min = Math.min.apply(null, nums);
        const range = max - min || 1;
        const n = Math.max((values || []).length, 1);
        const xOf = (i) => (i / Math.max(n - 1, 1)) * (width - 2) + 1;
        const yOf = (val) => height - 2 - ((val - min) / range) * (height - 4);
        if (pts.length === 1) {
            const x = xOf(pts[0].i).toFixed(1);
            const y = yOf(pts[0].n).toFixed(1);
            return `<svg class="gg-spark" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><circle cx="${x}" cy="${y}" r="2.2" fill="var(--green)"/></svg>`;
        }
        const line = pts.map((p) => xOf(p.i).toFixed(1) + ',' + yOf(p.n).toFixed(1)).join(' ');
        return `<svg class="gg-spark" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><polyline fill="none" stroke="var(--green)" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" points="${line}"/></svg>`;
    }

    const GoodsCatalog = {
        ZEVINA1_SECTIONS,
        isZevina1Cabinet,
        num,
        hasManualQty,
        resolveSheetQty,
        parseQty,
        stockOf,
        groupByCatalog,
        groupByCategory,
        groupGoods,
        flattenGroups,
        sumItems,
        filterGroups,
        hideGroups,
        visibleCols,
        csvCell,
        exportExcelCsv,
        GOODS_COLS,
        readManualQty,
        warehouseQty,
        bishkekYmd,
        bishkekParts,
        monthDayKeys,
        monthTitleRu,
        dayLabel,
        dailyKey,
        indexDailyStocks,
        dailyQty,
        sparkValues,
        sparklineSvg,
        MONTHS_RU,
    };
    root.GoodsCatalog = GoodsCatalog;
    if (typeof module !== 'undefined' && module.exports) module.exports = GoodsCatalog;
})(typeof window !== 'undefined' ? window : globalThis);

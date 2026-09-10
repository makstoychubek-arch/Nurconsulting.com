/**
 * Каталог «Товары» для ИП Уркунбаев / Zevina 1.
 * Порядок разделов и артикулов — как в таблице остатков.
 * Цифры ФБО/ФБС/в пути берутся из wb_stocks, не из файла.
 */
(function (root) {
    const ZEVINA1_SECTIONS = [{"name":"Свитера","items":[{"name":"Свитер-айвори","nmId":1218782505,"plan":0},{"name":"Свитер-бордо","nmId":1218802103,"plan":0},{"name":"Свитер-шоко","nmId":1218796940,"plan":0},{"name":"Свитер-серый","nmId":1218799336,"plan":0}]},{"name":"Костюм укороч","items":[{"name":"укороч_костюм_брючный_коричневый","nmId":296564448,"plan":3000},{"name":"укороч_костюм_брючный_черный","nmId":247350276,"plan":3000},{"name":"укороч_костюм_брючный_красный","nmId":262697143,"plan":1500},{"name":"укороч_костюм_брючный_серый","nmId":247350377,"plan":1000},{"name":"укороч_костюм_брючный_бардо","nmId":262714507,"plan":1000},{"name":"укороч_костюм_брючный_электрик","nmId":296564447,"plan":0},{"name":"укороч_костюм_брючный_бежевый","nmId":262760469,"plan":0},{"name":"укороч_костюм_брючный_темносиний","nmId":892565628,"plan":1000},{"name":"укороч_костюм_брючный_белый","nmId":435735287,"plan":0}]},{"name":"Костюм оверсайз","items":[{"name":"костюм_оверсайз_красный","nmId":391116477,"plan":0},{"name":"костюм_оверсайз_бордовый","nmId":296556346,"plan":0},{"name":"костюм_оверсайз_бежевый","nmId":296556350,"plan":0},{"name":"костюм_оверсайз_шоколад","nmId":296556347,"plan":1500},{"name":"костюм_оверсайз_черный","nmId":295201148,"plan":1500},{"name":"костюм_оверсайз_электрик","nmId":296556348,"plan":0},{"name":"костюм_оверсайз_серый","nmId":391116472,"plan":700},{"name":"костюм_оверсайз_темносин","nmId":399607068,"plan":700},{"name":"костюм_оверсайз_белый","nmId":435743074,"plan":0}]},{"name":"Пиджак оверсайз","items":[{"name":"пиджак серый","nmId":247347214,"plan":0},{"name":"пиджак_Беж_неоаал","nmId":429715568,"plan":0},{"name":"пиджак_шоко2","nmId":287679331,"plan":0},{"name":"пиджак_электрик2","nmId":287679857,"plan":0},{"name":"пиджак_NEW_красный","nmId":409845462,"plan":0},{"name":"пиджак черный","nmId":247347924,"plan":0},{"name":"пиджак_бургунди2","nmId":287679332,"plan":0},{"name":"пиджак_NEW_темносин","nmId":409845463,"plan":0},{"name":"пиджак_белый2","nmId":287679856,"plan":0}]},{"name":"Рич","items":[{"name":"Спорт_костюм_sport_rich_серый","nmId":539401905,"plan":0},{"name":"Спорт_костюм_sport_rich_шоко","nmId":539908484,"plan":0},{"name":"Спорт_костюм_sport_rich_айвори","nmId":539908473,"plan":0},{"name":"Спорт_костюм_sport_rich_синий","nmId":539908479,"plan":0},{"name":"Спорт_костюм_sport_rich_бордо","nmId":539908481,"plan":0},{"name":"Спорт_костюм_sport_rich_новый_бежевый","nmId":603633471,"plan":0},{"name":"Спорт_костюм_sport_rich_черный","nmId":539908477,"plan":0}]},{"name":"Костюм велюр","items":[{"name":"двойка_костюм_велюр_черный","nmId":705387379,"plan":0},{"name":"двойка_костюм_велюр_темно-синий","nmId":705387385,"plan":0},{"name":"двойка_костюм_велюр_розовый","nmId":705387381,"plan":0},{"name":"двойка_костюм_велюр_серый","nmId":705387382,"plan":0},{"name":"двойка_костюм_велюр_изумруд","nmId":705387380,"plan":0},{"name":"двойка_костюм_велюр_хакки","nmId":705387383,"plan":0},{"name":"двойка_костюм_велюр_капучино","nmId":705381484,"plan":0},{"name":"двойка_костюм_велюр_ коралловый","nmId":705387384,"plan":0},{"name":"двойка_костюм_велюр_марсала","nmId":705387388,"plan":0},{"name":"двойка_костюм_велюр_красный","nmId":705387387,"plan":0},{"name":"двойка_костюм_велюр_молочный","nmId":705387386,"plan":0}]},{"name":"Костюм велюр спорт","items":[{"name":"Спорт_костюм_велюр_черный","nmId":597838497,"plan":0},{"name":"Спорт_костюм_велюр_капучино","nmId":604201351,"plan":0},{"name":"Спорт_костюм_велюр_розовый","nmId":604201359,"plan":0},{"name":"Спорт_костюм_велюр_сирень","nmId":604201358,"plan":0},{"name":"Спорт_костюм_велюр_серый","nmId":604201350,"plan":0},{"name":"Спорт_костюм_велюр_изумруд","nmId":604201361,"plan":0},{"name":"Спорт_костюм_велюр_КОРАЛ","nmId":664192264,"plan":0},{"name":"Спорт_костюм_велюр_хаки","nmId":604201352,"plan":0},{"name":"Спорт_костюм_велюр_бордовый","nmId":604201353,"plan":0},{"name":"Спорт_костюм_велюр_темносин","nmId":604201356,"plan":0}]},{"name":"Пиджак Овальные","items":[{"name":"Пиджак овал серый1","nmId":247348946,"plan":0},{"name":"Пиджак овал серый 2","nmId":391102728,"plan":0},{"name":"Пиджак овал красный","nmId":499378334,"plan":0},{"name":"Пиджак овал черный","nmId":247348479,"plan":0},{"name":"Пиджак овал бардовый","nmId":280128269,"plan":0},{"name":"Пиджак овал синий","nmId":391102730,"plan":0},{"name":"Пиджак овал шоколад","nmId":280129304,"plan":0},{"name":"Пиджак овал серый 3","nmId":499380531,"plan":0},{"name":"Пиджак овал бежевый","nmId":391102732,"plan":0},{"name":"Пиджак овал ментол","nmId":391102729,"plan":0}]},{"name":"Укороченный пиджак","items":[{"name":"пиджак_КОРОТ_шоко","nmId":307425700,"plan":0},{"name":"пиджак_КОРОТ_изумруд","nmId":307425705,"plan":0},{"name":"пиджак_КОРОТ_черный","nmId":307425697,"plan":0},{"name":"пиджак_КОРОТ_электрик","nmId":307425699,"plan":0},{"name":"пиджак_КОРОТ_голубой","nmId":307425707,"plan":0},{"name":"пиджак_КОРОТ_серый","nmId":307425704,"plan":0},{"name":"пиджак_КОРОТ_бордо","nmId":307425701,"plan":0},{"name":"пиджак_КОРОТ_темносин","nmId":307425706,"plan":0},{"name":"пиджак_КОРОТ_бежевый","nmId":307425698,"plan":0},{"name":"пиджак_КОРОТ_белый","nmId":435746744,"plan":0}]},{"name":"Костюм велюр","items":[{"name":"костюм_велюр серый","nmId":633661202,"plan":0},{"name":"костюм_велюр изумруд","nmId":633661207,"plan":0},{"name":"костюм_велюр черный","nmId":633639148,"plan":0},{"name":"костюм_велюр розовый","nmId":766251143,"plan":0},{"name":"костюм_велюр синий","nmId":766251142,"plan":0},{"name":"костюм_велюр капучинно","nmId":633661203,"plan":0},{"name":"костюм_велюр сиреневый","nmId":633661205,"plan":0},{"name":"костюм_велюр корал","nmId":633661208,"plan":0}]},{"name":"Костюмы OLDMONEY","items":[{"name":"костНОВ_жакет_светло-серый","nmId":495053631,"plan":0},{"name":"костНОВ_жакет_бежевый","nmId":495053632,"plan":0},{"name":"костНОВ_жакет_бордо","nmId":495053634,"plan":0},{"name":"костНОВ_жакет_черный","nmId":495053627,"plan":0},{"name":"костНОВ_жакет_темно-синий","nmId":495053638,"plan":0},{"name":"костНОВ_жакет_темно-серый","nmId":495053633,"plan":0},{"name":"костНОВ_жакет_красный","nmId":495053630,"plan":0},{"name":"костНОВ_жакет_шоко","nmId":495053629,"plan":0}]},{"name":"Костюм Originals","items":[{"name":"Спорт_костюм_originals 1987_черный","nmId":539916083,"plan":0},{"name":"Спорт_костюм_originals 1987_бордо","nmId":539916085,"plan":0},{"name":"Спорт_костюм_originals 1987_айвори","nmId":539916078,"plan":0},{"name":"Спорт_костюм_originals 1987_новый_бежевый","nmId":611441510,"plan":0},{"name":"Спорт_костюм_originals 1987_синий","nmId":539916080,"plan":0},{"name":"Спорт_костюм_originals 1987_серый","nmId":539401904,"plan":0}]},{"name":"Бомбер","items":[{"name":"бомбер черный","nmId":262651910,"plan":0},{"name":"бомбер бежевый","nmId":249656298,"plan":0},{"name":"бомбер корич","nmId":249650166,"plan":0},{"name":"бомбер бордо","nmId":262659615,"plan":0},{"name":"бомбер графит","nmId":605813197,"plan":0},{"name":"бомбер серый","nmId":249656107,"plan":0}]},{"name":"Двойка юбка","items":[{"name":"Двойка_юбка_синий полоска","nmId":629645154,"plan":0},{"name":"Двойка_юбка_черный полоска","nmId":629645155,"plan":0},{"name":"Двойка_юбка_шоколад полоска","nmId":629645153,"plan":0},{"name":"Двойка_юбка_коричневый елечка","nmId":629645151,"plan":0},{"name":"Двойка_юбка_серый полоска","nmId":629645152,"plan":0},{"name":"Двойка_юбка_серый елечка","nmId":629645150,"plan":0}]},{"name":"Куртка фуфайка","items":[{"name":"Куртка_фуфайка_белый","nmId":547613172,"plan":0},{"name":"Куртка_фуфайка_кофе","nmId":547613173,"plan":0}]},{"name":"Полупальто","items":[{"name":"полупальто_горч","nmId":271001367,"plan":0},{"name":"полупальто_темнобеж","nmId":271001364,"plan":0},{"name":"полупальто_светлобеж","nmId":271001369,"plan":0},{"name":"полупальто_темносин","nmId":271001368,"plan":0}]},{"name":"Платье Риджак","items":[{"name":"Платье_Пиджак_красный","nmId":495055922,"plan":0},{"name":"Платье_Пиджак_черный","nmId":495055925,"plan":0},{"name":"Платье_Пиджак_СветлоСер","nmId":495055921,"plan":0},{"name":"Платье_Пиджак_бордо","nmId":495055924,"plan":0},{"name":"Платье_Пиджак_мятный","nmId":629846440,"plan":0},{"name":"Платье_Пиджак_ТемноСин","nmId":495055919,"plan":0},{"name":"Платье_Пиджак_шоко","nmId":495055918,"plan":0}]}];

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

    function emptyLive(nmId, name, plan) {
        return {
            nmId: Number(nmId),
            sellerArticle: name || '',
            category: '',
            fbo: 0,
            fbs: 0,
            transit: 0,
            plan: num(plan),
            cabinetId: '',
            cabinetName: '',
        };
    }

    function groupByCatalog(liveRows, sections) {
        const byNm = new Map();
        (liveRows || []).forEach((r) => {
            const id = Number(r.nmId);
            if (!id) return;
            const prev = byNm.get(id);
            if (!prev) {
                byNm.set(id, { ...r, nmId: id, fbo: num(r.fbo), fbs: num(r.fbs), transit: num(r.transit), plan: num(r.plan) });
                return;
            }
            prev.fbo += num(r.fbo);
            prev.fbs += num(r.fbs);
            prev.transit += num(r.transit);
            if (!prev.sellerArticle && r.sellerArticle) prev.sellerArticle = r.sellerArticle;
        });
        const used = new Set();
        const groups = [];
        (sections || ZEVINA1_SECTIONS).forEach((sec, idx) => {
            const items = (sec.items || []).map((it) => {
                used.add(it.nmId);
                const live = byNm.get(it.nmId);
                const row = live ? { ...live } : emptyLive(it.nmId, it.name, it.plan);
                row.sellerArticle = it.name || row.sellerArticle;
                row.category = sec.name;
                if (!num(row.plan) && num(it.plan)) row.plan = num(it.plan);
                return row;
            });
            groups.push({ key: idx + ':' + sec.name, name: sec.name, items });
        });
        const extra = [...byNm.values()].filter((r) => !used.has(Number(r.nmId)));
        extra.sort((a, b) => String(a.sellerArticle || '').localeCompare(String(b.sellerArticle || ''), 'ru') || a.nmId - b.nmId);
        if (extra.length) groups.push({ key: 'other', name: 'Прочие', items: extra });
        return groups;
    }

    function groupByCategory(liveRows) {
        const map = new Map();
        (liveRows || []).forEach((r) => {
            const cat = String(r.category || '').trim() || 'Без раздела';
            if (!map.has(cat)) map.set(cat, []);
            map.get(cat).push({ ...r, fbo: num(r.fbo), fbs: num(r.fbs), transit: num(r.transit), plan: num(r.plan) });
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

    function groupGoods(liveRows, cabinetName) {
        if (isZevina1Cabinet(cabinetName)) return groupByCatalog(liveRows, ZEVINA1_SECTIONS);
        return groupByCategory(liveRows);
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

    const GoodsCatalog = {
        ZEVINA1_SECTIONS,
        isZevina1Cabinet,
        stockOf,
        groupByCatalog,
        groupByCategory,
        groupGoods,
        sumItems,
        filterGroups,
    };
    root.GoodsCatalog = GoodsCatalog;
    if (typeof module !== 'undefined' && module.exports) module.exports = GoodsCatalog;
})(typeof window !== 'undefined' ? window : globalThis);

'use strict';
/**
 * Разбор архива боевой edge-функции Supabase (ESZIP 2.x), чтобы достать исходники,
 * когда их нет в репозитории. Берём только модули проекта (functions/...), без esm.sh и deno.land.
 *
 * Формат: "ESZIP2.3" | u32 длина опций | опции | u32 длина заголовка | заголовок | данные.
 * Запись заголовка: u32 длина имени | имя | тип (0 модуль, 1 перенаправление) и для модуля
 * u32 смещение исходника | u32 размер | u32 смещение карты | u32 размер карты | u8 тип модуля.
 * Исходники начинаются после заголовка и ещё 8 байт служебных данных.
 */

const MAGIC = 'ESZIP2.';

function parseEszip(buf) {
    if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf);
    if (buf.slice(0, MAGIC.length).toString('latin1') !== MAGIC) throw new Error('не ESZIP');
    const optLen = buf.readUInt32BE(8);
    const headerLenAt = 12 + optLen;
    const hl = buf.readUInt32BE(headerLenAt);
    const headerStart = headerLenAt + 4;
    const header = buf.slice(headerStart, headerStart + hl);
    const dataStart = headerStart + hl + 4 + 4; // хэш заголовка и длина блока исходников
    const modules = [];
    let i = 0;
    while (i + 4 <= header.length) {
        const n = header.readUInt32BE(i); i += 4;
        if (n === 0 || n > 4000 || i + n > header.length) break;
        const specifier = header.slice(i, i + n).toString('utf8'); i += n;
        const kind = header[i]; i += 1;
        if (kind === 0) {
            const off = header.readUInt32BE(i), size = header.readUInt32BE(i + 4);
            i += 16; // смещение/размер исходника и карты
            i += 1;  // тип модуля
            modules.push({ specifier, off, size });
        } else if (kind === 1) {
            const n2 = header.readUInt32BE(i); i += 4 + n2;
        } else break;
    }
    return modules.map((m) => ({
        specifier: m.specifier,
        source: buf.slice(dataStart + m.off, dataStart + m.off + m.size).toString('utf8'),
    }));
}

/**
 * Только файлы проекта. Имена внутри архива разные, в зависимости от того, чем задеплоена функция:
 * functions/<slug>/index.ts, source/<slug>/index.ts, <slug>/index.ts (и _shared рядом).
 * Приводим к виду <slug>/index.ts и _shared/x.ts.
 */
function normalizeSpecifier(spec) {
    return spec
        .replace(/^file:\/\/\/.*?\/(?:supabase\/)?functions\//, '')
        .replace(/^supabase\/functions\//, '')
        .replace(/^functions\//, '')
        .replace(/^source\//, '');
}

function projectModules(buf) {
    return parseEszip(buf)
        .filter((m) => !/^https?:/.test(m.specifier) && !m.specifier.startsWith('---'))
        .map((m) => ({ specifier: normalizeSpecifier(m.specifier), source: m.source }));
}

module.exports = { parseEszip, projectModules };

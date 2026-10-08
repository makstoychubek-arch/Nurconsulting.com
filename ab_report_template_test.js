/**
 * Утверждённый шаблон отчёта А/Б в Telegram (docs/ab-telegram-report.md): логотип, «/ АБ ТЕСТ», кабинет справа,
 * фото 3:4, колонка значений, без подписи. Тест ловит случайные правки макета.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const png = fs.readFileSync(path.join(__dirname, 'supabase/functions/_shared/ab-test-report-png.ts'), 'utf8');
const fn = fs.readFileSync(path.join(__dirname, 'supabase/functions/ab-test-rotate/index.ts'), 'utf8');

assert.ok(/const NR_LOGO_PNG_B64\s*=\s*'iVBOR/.test(png), 'настоящий логотип NR встроен в картинку');
assert.ok(png.includes("'/ АБ ТЕСТ'"), 'надпись «/ АБ ТЕСТ» рядом с логотипом');
assert.ok(png.includes('model.cabinetName'), 'справа название кабинета');
assert.ok(png.includes('* 4 / 3'), 'фото вариантов в формате 3:4');
assert.ok(png.includes('function textW') && !/textAlign\s*=/.test(png), 'выравнивание без textAlign (библиотека его игнорирует)');
for (const label of ['CTR', 'CR клик→корзина', 'CR1 корзина→заказ', 'Показы', 'Клики', 'В корзину', 'Заказов', 'На сумму', 'Затраты', 'CPC', 'CPV (показ)', 'На ВБ', 'Ротаций']) {
    assert.ok(png.includes(`['${label}'`), `в таблице есть строка «${label}»`);
}
assert.ok(/const caption = '';/.test(fn), 'подпись под картинкой пустая');
assert.ok(fn.includes('cabinetLegalName(') && fn.includes("timeZone: 'Asia/Bishkek'"), 'юр. название кабинета и время по Бишкеку');

console.log('ab_report_template_test: ok');

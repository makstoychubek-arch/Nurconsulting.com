// Локальный предпросмотр карточек ФФ. Запуск: deno run -A scripts/render-ff-account-sample.ts /tmp/out-dir
import { renderFfAccountPng } from '../supabase/functions/_shared/ff-account-card-png.ts';

const dir = Deno.args[0] || '/tmp';
await Deno.writeFile(`${dir}/ff-urk.png`, await renderFfAccountPng({
    cabinet: 'ИП Уркунбаев К.А.', dateLabel: '11 ноября 2026', dayTotal: 3200, shipLine: '44 шт × 50 = 2 200 ₽',
    storageLine: '1 000 ₽ (по 12.11)', penalty: 1200, debt: 482058, sinceLabel: 'с 27.10', note: 'Хранение отменено с 13.11. Оплаты и штрафы ФФ вычтены.',
}));
await Deno.writeFile(`${dir}/ff-bei.png`, await renderFfAccountPng({
    cabinet: 'ИП Бейшеев А.Д.', dateLabel: '11 ноября 2026', dayTotal: 2834, shipLine: '18 шт × 150 = 2 700 ₽',
    storageLine: '335 шт × 0,4 = 134 ₽', penalty: 0, debt: 32229, sinceLabel: 'с 27.10', note: 'Оплачено до 26.10. Оплаты вы вводите на сайте.',
}));
console.log('готово:', dir);

// Локальный предпросмотр карточек ФФ. Запуск: deno run -A scripts/render-ff-account-sample.ts /tmp/out-dir
import { renderFfAccountPng } from '../supabase/functions/_shared/ff-account-card-png.ts';

const dir = Deno.args[0] || '/tmp';
await Deno.writeFile(`${dir}/ff-urk.png`, await renderFfAccountPng({
    cabinet: 'ИП Уркунбаев К.А.', dateLabel: '11 ноября 2026', dayTotal: 3200, shipSub: '44 шт × 50', ship: 2200, storage: 1000, boxSub: '0 кор.', box: 0, extra: 0, penalty: 1200, debt: 482058, sinceLabel: 'с 27.10',
}));
await Deno.writeFile(`${dir}/ff-bei.png`, await renderFfAccountPng({
    cabinet: 'ИП Бейшеев А.Д.', dateLabel: '11 ноября 2026', dayTotal: 2834, shipSub: '18 шт × 100', ship: 1800, storage: 134, boxSub: '0 кор.', box: 0, extra: 900, extraSub: 'вакуумирование 18 × 50', penalty: 0, debt: 32229, sinceLabel: 'с 27.10',
}));
console.log('готово:', dir);

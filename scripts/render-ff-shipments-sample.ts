// Локальный предпросмотр карточки «Отправки FBS» для ФФ. Запуск: deno run -A scripts/render-ff-shipments-sample.ts /tmp/out-dir
import { renderFfShipmentsPng } from '../supabase/functions/_shared/ff-shipments-card-png.ts';

const dir = Deno.args[0] || '/tmp';
await Deno.writeFile(`${dir}/ff-shipments-card.png`, await renderFfShipmentsPng({
    ffName: 'АМАН ФФ',
    dateLabel: '11 ноября 2026',
    rows: [
        { cabinetId: 'a', cabinet: 'ИП Бейшеев А.Д.', sub: 'Куртка-черный1', count: 18, rate: 150, sum: 2700, mixedRates: false },
        { cabinetId: 'b', cabinet: 'ИП Уркунбаев К.А.', sub: '12 артикулов', count: 44, rate: 50, sum: 2200, mixedRates: false },
    ],
    total: { count: 62, sum: 4900 },
}));
await Deno.writeFile(`${dir}/ff-shipments-card-empty.png`, await renderFfShipmentsPng({
    ffName: 'АМАН ФФ', dateLabel: '12 ноября 2026', rows: [], total: { count: 0, sum: 0 },
}));
console.log('готово:', dir);

// Локальный предпросмотр рекламной карточки. Запуск: deno run -A scripts/render-ads-card-sample.ts /tmp/out-dir
import { renderAdCardPng } from '../supabase/functions/_shared/ads-card-png.ts';
import { addStat, buildAdCard, emptyStat } from '../supabase/functions/_shared/ads-report.ts';

const dir = Deno.args[0] || '/tmp';
const day = addStat(emptyStat(), { spend: 2060, carts: 56, orders: 15, clicks: 207, impressions: 6960, revenue: 59866 });
const prev = addStat(emptyStat(), { spend: 3256, carts: 54, orders: 16, clicks: 294, impressions: 13762, revenue: 66034 });
await Deno.writeFile(`${dir}/ads-card.png`, await renderAdCardPng({ cabinet: 'ИП Уркунбаев К.А.', dateLabel: '11 ноября 2026', m: buildAdCard(day, prev) }));
const up = addStat(emptyStat(), { spend: 6188, carts: 76, orders: 20, clicks: 622, impressions: 16689, revenue: 135595 });
await Deno.writeFile(`${dir}/ads-card-up.png`, await renderAdCardPng({ cabinet: 'ИП Бейшеев А.Д.', dateLabel: '11 ноября 2026', m: buildAdCard(up, addStat(emptyStat(), { spend: 5000 })) }));
console.log('готово:', dir);

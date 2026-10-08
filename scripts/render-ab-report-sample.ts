// Локальный предпросмотр картинки отчёта А/Б для Telegram (шаблон: docs/ab-telegram-report.md).
// Запуск: deno run -A scripts/render-ab-report-sample.ts /tmp/ab-card.png
import { buildAbReportCard } from '../supabase/functions/_shared/ab-test-report-card.ts';
import { renderAbReportPng } from '../supabase/functions/_shared/ab-test-report-png.ts';

const U = 'https://fiukyfyhotctvfdidktx.supabase.co/storage/v1/object/public/abtest-photos/4fb87d8f-da1e-472d-8da8-7a16d5e58839';
const model = buildAbReportCard({
    title: 'Куртка зимняя прямого кроя',
    nmId: 1544472467,
    cabinetName: 'ИП Бейшеев А.Д.',
    campaignLabel: '1544472467 Куртка Поиск (40130137)',
    startedAtStr: '06.10.2026, 16:08',
    finishedAtStr: '06.10.2026, 18:50',
    durationStr: '2 ч 41 мин',
    reason: 'winner_determined',
    reportUrl: 'https://nurcon.kg/ab-testing?test=4fb87d8f',
    variants: [
        { variant_label: '1', photo_url: `${U}/1.webp`, impressions: 1448, clicks: 85, atbs: 5, orders: 3, revenue: 18600, ad_spend: 1248, minutes_active: 68, is_currently_on_wb: true },
        { variant_label: '2', photo_url: `${U}/2.png`, impressions: 822, clicks: 34, atbs: 7, orders: 0, revenue: 0, ad_spend: 709, minutes_active: 40 },
        { variant_label: '3', photo_url: `${U}/3.png`, impressions: 1092, clicks: 49, atbs: 3, orders: 0, revenue: 0, ad_spend: 941, minutes_active: 30 },
    ],
});
const out = Deno.args[0] || '/tmp/ab-card.png';
await Deno.writeFile(out, await renderAbReportPng(model));
console.log('готово:', out);

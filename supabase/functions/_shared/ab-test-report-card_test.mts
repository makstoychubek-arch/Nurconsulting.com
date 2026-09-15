import assert from 'node:assert/strict';
import {
    buildAbReportCard,
    demoAbReportCard,
    formatAbReportCaption,
    reasonLabel,
    renderAbReportCardSvg,
    verdictFromProb,
    WB_MAIN_PHOTO_SLOT,
} from './ab-test-report-card.ts';
import { mainPhotoChanged, wbBasketPhotoUrl } from './wb-main-photo.ts';

assert.equal(WB_MAIN_PHOTO_SLOT, 1);
assert.equal(reasonLabel('impressions_cap'), 'набраны показы поровну, РК на паузе');
assert.ok(reasonLabel('winner_determined').includes('победитель'));
assert.equal(verdictFromProb(0.91).text.startsWith('уверенно лучше'), true);
assert.equal(verdictFromProb(0.5).stars, '★★☆');

const model = buildAbReportCard({
    title: 'Свитер oversize',
    nmId: 555,
    campaignLabel: 'тест стр (11)',
    finishedAtStr: '15.09.2026, 12:00',
    reason: 'impressions_cap',
    reportUrl: 'https://nurcon.kg/ab-testing?test=abc',
    variants: [
        { id: '1', variant_label: 'A', impressions: 2000, clicks: 40, atbs: 8, orders: 2, revenue: 4000, ad_spend: 500, is_currently_on_wb: false },
        { id: '2', variant_label: 'B', impressions: 2000, clicks: 90, atbs: 20, orders: 9, revenue: 18000, ad_spend: 480, is_currently_on_wb: true },
        { id: '3', variant_label: 'C', impressions: 2000, clicks: 10, atbs: 1, orders: 0, revenue: 0, ad_spend: 510, is_currently_on_wb: false },
    ],
    probs: new Map([['A', 0.08], ['B', 0.9], ['C', 0.02]]),
});

assert.equal(model.leaderLabel, 'B');
assert.equal(model.variants[1].isLeader, true);
assert.equal(model.variants[1].isLive, true);
assert.equal(model.variants[2].isLoser, true);
assert.ok(Math.abs(model.variants[1].ctr - 4.5) < 0.01);
assert.ok(model.variants[1].delta != null && model.variants[1].delta > 0);
assert.ok(model.verdictText.includes('уверенно лучше'));

const svg = renderAbReportCardSvg(model);
assert.ok(svg.includes('Свитер oversize'));
assert.ok(svg.includes('4.50%'));
assert.ok(svg.includes('уверенно лучше'));
assert.ok(svg.includes('Сейчас на ВБ'));
assert.ok(svg.includes('явно проигрывает'));
assert.ok(svg.includes(`слот ${WB_MAIN_PHOTO_SLOT}`));

const caption = formatAbReportCaption(model);
assert.ok(caption.includes('арт. 555'));
assert.ok(caption.includes('тест стр'));
assert.ok(caption.includes('nurcon.kg'));

const demo = demoAbReportCard();
assert.equal(demo.preview, true);
assert.equal(demo.variants.length, 4);
assert.ok(renderAbReportCardSvg(demo).includes('Демо'));

assert.equal(
    wbBasketPhotoUrl(12, 215543210, 1),
    'https://basket-12.wbbasket.ru/vol2155/part215543/215543210/images/big/1.webp',
);
assert.equal(
    wbBasketPhotoUrl(3, 123456, 2).endsWith('/images/big/2.webp'),
    true,
);

const changed = mainPhotoChanged({ sha: 'aaa' }, { sha: 'bbb' }, { sha: 'c' }, { sha: 'c' });
assert.equal(changed.ok, true);
assert.equal(changed.slot1Changed, true);
assert.equal(changed.slot2Stable, true);

const same = mainPhotoChanged({ sha: 'aaa' }, { sha: 'aaa' }, { sha: 'c' }, { sha: 'c' });
assert.equal(same.ok, false);
assert.equal(same.slot1Changed, false);

console.log('ab-test-report-card_test ok');

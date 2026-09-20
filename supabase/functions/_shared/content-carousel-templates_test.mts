import assert from 'node:assert/strict';
import { planCarouselSlides } from './content-carousel.ts';
import {
    formatSlidePrice,
    infoFactRows,
    isSatoriSafeHtml,
    slideSatoriHtml,
    slidesSatoriHtml,
    SLIDE_THEME,
    templateKinds,
} from './content-carousel-templates.ts';

assert.ok(/4.590/.test(formatSlidePrice(4590)));
assert.equal(formatSlidePrice(null), '');

const plan = planCarouselSlides({
    photos: [1, 2, 3, 4, 5].map((n) => `https://img/${n}.jpg`),
    title: 'Пиджак серый',
    nmId: 247347214,
    composition: '80% вискоза, 20% полиэстер',
    brand: 'Zevina',
    price: 4590,
    vendorCode: 'ZV-1',
    description: 'Классический пиджак. Подходит для офиса.',
});
const htmls = slidesSatoriHtml(plan);
assert.equal(htmls.length, plan.length);
htmls.forEach((html, i) => {
    assert.equal(isSatoriSafeHtml(html), true, `slide ${plan[i].kind} must be satori-safe`);
    assert.ok(!/display:\s*grid/i.test(html), `no css grid on ${plan[i].kind}`);
});
assert.ok(htmls[0].includes('Zevina'));
assert.ok(htmls[0].includes('img/') || htmls[0].includes('Нет фото'));
assert.ok(htmls[5].includes('247347214'));
assert.ok(htmls[5].includes('вискоза'));
assert.ok(htmls[5].includes('4') && htmls[5].includes('590'));
assert.ok(htmls[6].includes('Zevina'));
assert.ok(htmls[6].includes('nmId 247347214'));

const facts = infoFactRows(plan[5]);
assert.deepEqual(facts.map((f) => f.label), ['Артикул', 'Код', 'Цена', 'Бренд', 'Состав']);
assert.ok(templateKinds().includes('cover'));
assert.equal(SLIDE_THEME.accent, '#066FD1');
assert.ok(slideSatoriHtml({ ...plan[0], photos: [] }).includes('Нет фото'));

console.log('content-carousel-templates_test: ok');

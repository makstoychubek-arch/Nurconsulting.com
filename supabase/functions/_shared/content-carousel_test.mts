import assert from 'node:assert/strict';
import {
    collageCells,
    parseWbCard,
    pickCardPrice,
    pickComposition,
    planCarouselSlides,
    SLIDE_H,
    SLIDE_W,
    uniqUrls,
} from './content-carousel.ts';

assert.equal(SLIDE_W, 1080);
assert.equal(SLIDE_H, 1350);
assert.equal(SLIDE_W / SLIDE_H, 0.8);

const plan = planCarouselSlides({
    photos: ['https://img/1.jpg', 'https://img/2.jpg', 'https://img/3.jpg'],
    extraPhotos: ['https://img/4.jpg'],
    title: 'Пиджак серый',
    nmId: 247347214,
    composition: '80% вискоза, 20% полиэстер',
    brand: 'Zevina',
    price: 4590,
});
assert.equal(plan.length, 4);
assert.deepEqual(plan.map((s) => s.kind), ['cover', 'collage', 'info', 'brand']);
assert.deepEqual(plan[0].photos, ['https://img/1.jpg']);
assert.equal(plan[1].photos.length, 4);
assert.equal(plan[2].composition.includes('вискоза'), true);
assert.equal(plan[3].brand, 'Zevina');
plan.forEach((s) => {
    assert.equal(s.width, 1080);
    assert.equal(s.height, 1350);
});

const cells = collageCells();
assert.equal(cells.length, 4);
assert.equal(cells[0].x < cells[1].x, true);
assert.equal(cells[0].y < cells[2].y, true);

const card = parseWbCard({
    nmID: 1,
    title: 'Свитер',
    vendorCode: 'sw-1',
    brand: 'NR',
    photos: [{ big: '//img/a.jpg' }, { c516x688: 'https://img/b.jpg' }],
    sizes: [{ price: 1990 }],
    options: [{ name: 'Состав', value: 'хлопок' }],
});
assert.equal(card.nmId, 1);
assert.deepEqual(card.photos, ['https://img/a.jpg', 'https://img/b.jpg']);
assert.equal(card.price, 1990);
assert.equal(pickComposition(card as unknown as Record<string, unknown>), '');
assert.equal(pickComposition({ options: [{ name: 'Состав', value: 'лён' }] }), 'лён');
assert.equal(pickCardPrice({ sizes: [{ discountedPrice: 10 }] }), 10);
assert.deepEqual(uniqUrls(['a', 'a', '//x.com/p']), ['a', 'https://x.com/p']);

console.log('content-carousel_test: ok');

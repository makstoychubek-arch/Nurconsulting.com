import assert from 'node:assert/strict';
import {
    bindExactArticlePhotos,
    collageCells,
    layoutSeoOverlays,
    parseGptOverlayJson,
    parseWbCard,
    photosForNmId,
    pickCardDescription,
    pickCardPrice,
    pickComposition,
    planCarouselSlides,
    dedupeSeoText,
    shortSeo,
    SLIDE_H,
    SLIDE_W,
    uniqUrls,
    pickCardByNmId,
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
assert.equal(plan.length, 7);
assert.deepEqual(plan.map((s) => s.kind), ['cover', 'collage', 'photo', 'photo', 'photo', 'info', 'brand']);
assert.deepEqual(plan[0].photos, ['https://img/1.jpg']);
assert.equal(plan[1].photos.length, 4);
assert.equal(plan[2].kind, 'photo');
assert.equal(plan[2].photos.length, 1);
assert.equal(plan[5].composition.includes('вискоза'), true);
assert.equal(plan[6].brand, 'Zevina');
plan.forEach((s) => {
    assert.equal(s.width, 1080);
    assert.equal(s.height, 1350);
});

const many = planCarouselSlides({
    photos: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `https://img/${n}.jpg`),
    nmId: 247347214,
    title: 'Костюм',
});
assert.deepEqual(many.map((s) => s.kind), ['cover', 'collage', 'photo', 'photo', 'photo', 'info', 'brand']);
assert.deepEqual(many[2].photos, ['https://img/6.jpg']);
assert.deepEqual(many[3].photos, ['https://img/7.jpg']);
assert.deepEqual(many[4].photos, ['https://img/8.jpg']);

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

const mixed = [
    { nmID: 111, title: 'похожий', photos: [{ big: 'https://img/wrong.jpg' }] },
    { nmID: 247347214, title: 'нужный', photos: [{ big: 'https://img/right.jpg' }] },
];
assert.equal(pickCardByNmId(mixed, 247347214)?.photos[0], 'https://img/right.jpg');
assert.equal(pickCardByNmId(mixed, 999), null);
assert.equal(pickCardByNmId(mixed, '111')?.nmId, 111);

assert.deepEqual(photosForNmId([
    'https://basket-16.wbbasket.ru/vol1/part1/111111/images/big/1.webp',
    'https://basket-16.wbbasket.ru/vol2473/part247347/247347214/images/big/1.webp',
], 247347214), [
    'https://basket-16.wbbasket.ru/vol2473/part247347/247347214/images/big/1.webp',
]);
assert.deepEqual(photosForNmId(['https://x'], 0), []);

const similarDropped = planCarouselSlides({
    photos: [
        'https://basket-16.wbbasket.ru/vol1/part1/111111/images/big/1.webp',
        'https://basket-16.wbbasket.ru/vol2473/part247347/247347214/images/big/1.webp',
    ],
    extraPhotos: ['https://cdn/extra.jpg'],
    nmId: 247347214,
    title: 'нужный',
});
assert.equal(similarDropped[0].photos[0].includes('247347214'), true);
assert.equal(similarDropped[0].photos.some((u) => u.includes('/111111/')), false);

const exactBound = bindExactArticlePhotos({
    nmId: 247347214,
    cardPhotos: ['https://basket-16.wbbasket.ru/vol2473/part247347/247347214/images/big/1.webp'],
    articlePhoto: 'https://basket-16.wbbasket.ru/vol1/part1/999999/images/big/1.webp',
});
assert.ok(exactBound.every((u) => u.includes('/247347214/')));
assert.ok(exactBound.some((u) => u.endsWith('/2.webp')));

assert.equal(pickCardDescription({
    description: 'Классический брючный костюм. Пиджак с подкладкой. Брюки прямого кроя.',
}), 'Классический брючный костюм. Пиджак с подкладкой. Брюки прямого кроя.');
assert.equal(parseWbCard({
    nmID: 1, title: 'Костюм', description: 'Пиджак и брюки. Идеален в офис.',
}).description.includes('офис'), true);

const seoPlan = planCarouselSlides({
    photos: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `https://img/${n}.jpg`),
    nmId: 247347214,
    title: 'Костюм классический',
    composition: 'полиэстер, спандекс',
    brand: 'ZEVINA',
    description: 'Классический брючный костюм с укороченным пиджаком. Прямые брюки держат стрелку. Подходит для офиса и вечера.',
});
assert.equal(seoPlan[0].headline.includes('Костюм'), true);
assert.ok(seoPlan[0].line.length > 8, 'cover gets a hook from SEO description');
assert.equal(seoPlan[1].headline, '');
assert.equal(seoPlan[1].line, '');
assert.ok(seoPlan[2].headline || seoPlan[2].line, 'first photo slide gets a SEO fact');
assert.equal(seoPlan[5].headline, '');
assert.equal(seoPlan[6].headline, '');
assert.equal((seoPlan[0].headline.match(/костюм/gi) || []).length <= 1, true);

const laid = layoutSeoOverlays(
    ['cover', 'collage', 'photo', 'photo', 'info', 'brand'],
    { title: 'Костюм', description: 'Первое предложение про крой. Второе про ткань и посадку.', composition: 'вискоза' },
);
assert.equal(laid[0].headline, 'Костюм');
assert.equal(laid[1].headline, '');
assert.ok(laid[2].headline || laid[2].line);

const gpt = parseGptOverlayJson(
    '{"overlays":[{"kind":"cover","headline":"Костюм ZEVINA","line":"Укороченный пиджак"},{"kind":"photo","headline":"Прямые брюки","line":"держат стрелку"}]}',
    ['cover', 'collage', 'photo', 'info'],
    [
        { headline: 'fb-cover', line: '' },
        { headline: '', line: '' },
        { headline: 'fb-photo', line: '' },
        { headline: '', line: '' },
    ],
);
assert.equal(gpt[0].headline, 'Костюм ZEVINA');
assert.equal(gpt[1].headline, '');
assert.equal(gpt[2].headline, 'Прямые брюки');
assert.deepEqual(parseGptOverlayJson('not-json', ['cover'], [{ headline: 'keep', line: 'x' }]), [{ headline: 'keep', line: 'x' }]);

assert.equal(dedupeSeoText('Костюм женский костюм брючный костюм'), 'Костюм женский брючный');
assert.equal(shortSeo('Костюм костюм'), 'Костюм');
{
    const stuffed = layoutSeoOverlays(['cover', 'photo'], {
        title: 'Костюм женский костюм брючный костюм',
        description: 'Костюм классический для офиса. Прямые брюки держат стрелку.',
    });
    assert.equal((stuffed[0].headline.match(/костюм/gi) || []).length, 1);
    assert.equal(/костюм/i.test(stuffed[0].line), false);
    assert.ok(stuffed[0].headline.length <= 32);
}
assert.equal(parseGptOverlayJson(
    '{"overlays":[{"kind":"cover","headline":"Костюм костюм женский","line":"костюм в офис"}]}',
    ['cover'],
    [{ headline: 'x', line: '' }],
)[0].headline, 'Костюм женский');

console.log('content-carousel_test: ok');

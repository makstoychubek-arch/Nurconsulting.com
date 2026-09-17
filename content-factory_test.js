'use strict';
const assert = require('node:assert/strict');
const CF = require('./content-factory.js');

assert.equal(CF.SLIDE_W, 1080);
assert.equal(CF.SLIDE_H, 1350);
assert.equal(CF.computePayout(4000, 12000, 10000, 1500), 5500);
assert.equal(CF.computePayout(4000, 10000, 10000, 1500), 4000);
assert.equal(CF.monthStart(new Date(2026, 8, 17)), '2026-09-01');

const card = CF.parseWbCard({
    nmID: 247347214,
    title: 'Пиджак серый',
    photos: [{ big: '//basket-12.wbbasket.ru/x/big/1.webp' }],
    sizes: [{ price: 4590 }],
    options: [{ name: 'Состав', value: 'вискоза' }],
    brand: 'Zevina',
});
assert.equal(card.nmId, 247347214);
assert.equal(card.photos[0].startsWith('https:'), true);
assert.equal(card.price, 4590);
assert.equal(card.composition, 'вискоза');

const slides = CF.planCarouselSlides({
    photos: card.photos,
    extraPhotos: ['https://cdn/extra.jpg'],
    title: card.title,
    nmId: card.nmId,
    composition: card.composition,
    brand: card.brand,
    price: card.price,
});
assert.deepEqual(slides.map((s) => s.kind), ['cover', 'collage', 'info', 'brand']);
assert.equal(slides[1].photos.length, 4);

const posts = [
    { id: '1', platform: 'instagram', status: 'published', blogger_id: 'b1', publish_at: '2026-09-10T10:00:00', views: 100, article_id: 1 },
    { id: '2', platform: 'tiktok', status: 'draft', blogger_id: 'b2', publish_at: '2026-09-11T10:00:00', views: 500, article_id: 2 },
    { id: '3', platform: 'instagram', status: 'error', blogger_id: 'b1', publish_at: '2026-08-01T10:00:00', views: 9, article_id: 1 },
];
assert.equal(CF.filterPosts(posts, { platform: 'instagram', blogger: '', status: '' }).length, 2);
assert.equal(CF.filterPosts(posts, { platform: '', blogger: 'b1', status: 'published' }).length, 1);
assert.equal(CF.topPosts(posts, 1)[0].id, '2');

assert.equal(CF.pickCardByNmId([
    { nmID: 1, photos: [{ big: 'https://a' }] },
    { nmID: 2, photos: [{ big: 'https://b' }] },
], 2).photos[0], 'https://b');
assert.equal(CF.pickCardByNmId([{ nmID: 1, photos: [{ big: 'https://a' }] }], 99), null);

assert.equal(CF.nmIdFromPhotoUrl('https://basket-16.wbbasket.ru/vol2473/part247347/247347214/images/big/1.webp'), 247347214);
assert.equal(CF.photoUrlFitsNmId('https://basket-16.wbbasket.ru/vol1/part1/111111/images/big/1.webp', 247347214), false);
assert.deepEqual(CF.photosForNmId([
    'https://basket-16.wbbasket.ru/vol1/part1/111111/images/big/1.webp',
    'https://basket-16.wbbasket.ru/vol2473/part247347/247347214/images/big/1.webp',
    'https://cdn/extra.jpg',
], 247347214), [
    'https://basket-16.wbbasket.ru/vol2473/part247347/247347214/images/big/1.webp',
    'https://cdn/extra.jpg',
]);
assert.deepEqual(CF.photosForNmId(['https://x'], 0), []);

const mixedCard = CF.parseWbCard({
    nmID: 247347214,
    photos: [
        { big: 'https://basket-16.wbbasket.ru/vol1/part1/111111/images/big/1.webp' },
        { big: 'https://basket-16.wbbasket.ru/vol2473/part247347/247347214/images/big/1.webp' },
    ],
});
assert.deepEqual(mixedCard.photos, [
    'https://basket-16.wbbasket.ru/vol2473/part247347/247347214/images/big/1.webp',
]);

const bound = CF.bindExactArticlePhotos({
    nmId: 247347214,
    cardPhotos: [
        'https://basket-16.wbbasket.ru/vol2473/part247347/247347214/images/big/1.webp',
        'https://basket-16.wbbasket.ru/vol1/part1/111111/images/big/1.webp',
    ],
    articlePhoto: 'https://cdn/local.jpg',
    gallery: ['https://basket-16.wbbasket.ru/vol2473/part247347/247347214/images/big/3.webp'],
});
assert.ok(bound.every((u) => !u.includes('/111111/')));
assert.ok(bound[0].includes('247347214'));
assert.ok(bound.some((u) => u.endsWith('/2.webp')), 'same-nmId basket slots fill the collage');
assert.deepEqual(CF.galleryUrlsFromManual({
    cached_gallery_urls: {
        2: 'https://basket-16.wbbasket.ru/vol2473/part247347/247347214/images/big/2.webp',
        1: 'https://basket-16.wbbasket.ru/vol1/part1/111111/images/big/1.webp',
    },
}, 247347214), [
    'https://basket-16.wbbasket.ru/vol2473/part247347/247347214/images/big/2.webp',
]);

const grouped = CF.groupPostsByDay(posts, 2026, 8);
assert.equal((grouped['2026-09-10'] || []).length, 1);
assert.equal((grouped['2026-09-11'] || []).length, 1);

const cells = CF.calendarCells(2026, 8);
assert.equal(cells.filter((d) => d === 1).length, 1);
assert.equal(cells.filter(Boolean).length, 30);

const stats = CF.viewsByPlatform(posts, '2026-09-01', '2026-09-30');
assert.equal(stats.totals.instagram, 100);
assert.equal(stats.totals.tiktok, 500);
assert.ok(stats.days.includes('2026-09-10'));

console.log('content-factory_test: ok');

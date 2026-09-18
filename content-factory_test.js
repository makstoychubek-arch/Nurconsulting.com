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
assert.equal(CF.parseWbCard({
    nmID: 1,
    title: 'Костюм',
    description: 'Классический брючный костюм. Пиджак с подкладкой.',
}).description.includes('Пиджак'), true);

const slides = CF.planCarouselSlides({
    photos: card.photos,
    extraPhotos: ['https://cdn/extra.jpg'],
    title: card.title,
    nmId: card.nmId,
    composition: card.composition,
    brand: card.brand,
    price: card.price,
});
assert.deepEqual(slides.map((s) => s.kind), ['cover', 'collage', 'photo', 'photo', 'photo', 'info', 'brand']);
assert.equal(slides[1].photos.length, 4);
assert.equal(slides[2].kind, 'photo');
assert.equal(slides[2].photos.length, 1);
assert.equal(slides[3].photos.length, 1);
assert.equal(slides[4].photos.length, 1);

const many = CF.planCarouselSlides({
    photos: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => 'https://img/' + n + '.jpg'),
    title: 'Костюм',
    nmId: 247347214,
});
assert.deepEqual(many.map((s) => s.kind), ['cover', 'collage', 'photo', 'photo', 'photo', 'info', 'brand']);
assert.deepEqual(many[2].photos, ['https://img/6.jpg']);
assert.deepEqual(many[3].photos, ['https://img/7.jpg']);
assert.deepEqual(many[4].photos, ['https://img/8.jpg']);

const seoSlides = CF.planCarouselSlides({
    photos: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => 'https://img/' + n + '.jpg'),
    title: 'Костюм классический',
    nmId: 247347214,
    composition: 'полиэстер, спандекс',
    brand: 'ZEVINA',
    description: 'Классический брючный костюм с укороченным пиджаком. Прямые брюки держат стрелку. Подходит для офиса и вечера.',
});
assert.ok(seoSlides[0].headline.includes('Костюм'));
assert.ok(seoSlides[0].line.length > 8);
assert.equal(seoSlides[1].headline, '');
assert.ok(seoSlides[2].headline || seoSlides[2].line);
assert.deepEqual(CF.parseGptOverlayJson('{"overlays":[{"kind":"cover","headline":"Костюм","line":"офис"}]}', ['cover'], [{ headline: 'x', line: '' }])[0], { headline: 'Костюм', line: 'офис' });

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

assert.equal(CF.FN_TIMEOUT_MS, 4000);
assert.equal(CF.QUERY_TIMEOUT_MS, 8000);

async function extra() {
    assert.equal(await CF.withTimeout(Promise.resolve(9), 200), 9);
    const t0 = Date.now();
    let timedOut = false;
    await CF.withTimeout(new Promise(() => {}), 20).then(
        () => { throw new Error('expected timeout'); },
        (e) => {
            timedOut = true;
            assert.match(String(e && e.message), /Таймаут/);
        },
    );
    assert.equal(timedOut, true);
    assert.ok(Date.now() - t0 < 150, 'withTimeout must fail fast');

    CF.ensureReady(null, 'cab-a', null, {});
    assert.equal(CF.needsReload(), true);
    CF._state.loadedCab = 'cab-a';
    assert.equal(CF.needsReload(), false);
    CF.ensureReady(null, 'cab-b', null, {});
    assert.equal(CF.needsReload(), true);
    assert.equal(CF._state.loadedCab, '');

    let queries = 0;
    const hang = {
        from() {
            queries += 1;
            const q = {};
            q.select = () => q;
            q.eq = () => q;
            q.order = () => q;
            q.then = (ok, no) => new Promise(() => {}).then(ok, no);
            return q;
        },
    };
    CF.ensureReady(hang, 'cab-hang', null, { queryTimeoutMs: 30 });
    const t1 = Date.now();
    await CF.open();
    const openMs = Date.now() - t1;
    assert.ok(openMs < 80, 'open() must not wait for supabase, waited ' + openMs + 'ms');
    assert.ok(queries >= 1, 'reload starts in background');
    assert.equal(CF._state.loadedCab, '');

    CF._state.loadedCab = 'cab-hang';
    const before = queries;
    const t2 = Date.now();
    await CF.open();
    assert.ok(Date.now() - t2 < 50);
    assert.equal(queries, before, 'cached cabinet does not reload');

    const origFetch = global.fetch;
    let fetches = 0;
    global.fetch = function () {
        fetches += 1;
        return new Promise(() => {});
    };
    const root = {
        innerHTML: '',
        addEventListener() {},
        contains() { return false; },
        querySelectorAll() { return []; },
    };
    global.document = {
        getElementById(id) { return id === 'cf-root' ? root : null; },
        activeElement: null,
    };
    try {
        CF.ensureReady(hang, 'cab-ui', null, { queryTimeoutMs: 40 });
        const t3 = Date.now();
        await CF.open();
        assert.ok(Date.now() - t3 < 80, 'paint-first open stayed instant');
        assert.equal(fetches, 0, 'open must not hit content-ig-oauth');
        assert.ok(root.innerHTML.includes('cf-nav'));
        assert.ok(root.innerHTML.includes('Календарь'));
        assert.ok(!/Загрузка/.test(root.innerHTML));
        assert.ok(!root.innerHTML.includes('cf-pipe'));
        assert.ok(!root.innerHTML.includes('developers.facebook'));
        assert.ok(!root.innerHTML.includes('FACEBOOK_APP'));
        assert.ok(!root.innerHTML.includes('Instagram Graph API'));
        assert.ok(!root.innerHTML.includes('Схема публикации'));
        assert.ok(!root.innerHTML.includes('без похожих'));
    } finally {
        global.fetch = origFetch;
        delete global.document;
    }
}

extra().then(() => {
    console.log('content-factory_test: ok');
}).catch((err) => {
    console.error(err);
    process.exit(1);
});

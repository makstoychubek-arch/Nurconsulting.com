import assert from 'node:assert/strict';
import { buildImageList, getOzonCards, parseCardImages, setOzonMainPhoto } from './ozon-photo.ts';

const items = [{ id: 7, offer_id: 'a_42', primary_image: ['https://x/p.jpg'], images: ['https://x/1.jpg', 'https://x/p.jpg', 'https://x/2.jpg'] }, { id: 8, offer_id: 'a_44', primary_image: [], images: ['https://x/9.jpg', 'https://x/8.jpg'] }];
const cards = parseCardImages(items);
assert.equal(cards[0].primary, 'https://x/p.jpg');
assert.deepEqual(cards[0].rest, ['https://x/1.jpg', 'https://x/2.jpg'], 'главная в остальных не повторяется');
assert.equal(cards[1].primary, 'https://x/9.jpg', 'без primary_image главной считается первая');
assert.deepEqual(cards[1].rest, ['https://x/8.jpg']);

assert.deepEqual(buildImageList('https://x/n.jpg', ['https://x/1.jpg', 'https://x/n.jpg', 'https://x/1.jpg']), ['https://x/n.jpg', 'https://x/1.jpg']);
assert.equal(buildImageList('https://x/n.jpg', Array.from({ length: 30 }, (_, i) => 'https://x/' + i)).length, 15, 'не больше 15');

const sent: { path: string; body: any }[] = [];
const ok = (obj: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(obj) });
const fetchFn = async (url: string, init: { body?: string }) => {
    const path = url.replace('https://api-seller.ozon.ru', '');
    sent.push({ path, body: JSON.parse(init.body || '{}') });
    if (path === '/v3/product/info/list') return ok({ items });
    return ok({ result: { pictures: [{ product_id: 7, state: 'uploaded', is_primary: true }] } });
};
const creds = { clientId: 'c', apiKey: 'k' };
assert.equal((await getOzonCards(creds, [7, 8], fetchFn)).length, 2);
const r = await setOzonMainPhoto(creds, 7, 'https://x/n.jpg', ['https://x/1.jpg'], fetchFn);
assert.equal(r.ok, true);
const w = sent.find((s) => s.path === '/v1/product/pictures/import')!;
assert.deepEqual(w.body.images, ['https://x/n.jpg', 'https://x/1.jpg']);
assert.equal(w.body.product_id, 7);
assert.equal((await setOzonMainPhoto(creds, 0, 'x', [], fetchFn)).ok, false, 'без product_id не пишем');
const bad = await setOzonMainPhoto(creds, 7, 'https://x/n.jpg', [], async () => ok({ result: { pictures: [{ state: 'error_download' }] } }));
assert.equal(bad.ok, false);
console.log('ozon-photo_test: ok');

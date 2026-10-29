/* NR Space — network-first shell, offline fallback for navigations only. */
const CACHE = 'nr-space-pwa-v5';
// Фото карточек с WB: WB отдаёт их с кэшем всего на сутки. Храним у себя и показываем сразу, свежую копию подтягиваем в фоне.
const PHOTOS = 'nr-photos-v1';
const PHOTO_MAX = 900;
const isWbPhoto = (u) => /(^|\.)wbbasket\.ru$/.test(u.hostname) && u.pathname.indexOf('/images/') >= 0;
const PRECACHE = [
    '/offline.html',
    '/nr-fox.js',
    '/manifest.json',
    '/favicon.ico',
    '/icons/logo-nr.svg',
    '/icons/favicon.png',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/icon-512-maskable.png',
    '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE)
            .then((cache) => cache.addAll(PRECACHE))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== PHOTOS).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (isWbPhoto(url)) {
        event.respondWith(photoSwr(event, req));
        return;
    }
    if (url.origin !== self.location.origin) return;

    if (req.mode === 'navigate') {
        event.respondWith(
            fetch(req).catch(() => caches.match('/offline.html'))
        );
        return;
    }

    if (
        url.pathname === '/offline.html' ||
        url.pathname === '/manifest.json' ||
        url.pathname.startsWith('/icons/') ||
        url.pathname.startsWith('/splash/')
    ) {
        event.respondWith(
            caches.match(req).then((hit) => hit || fetch(req).then((res) => {
                const copy = res.clone();
                caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
                return res;
            }))
        );
    }
});

async function photoSwr(event, req) {
    const cache = await caches.open(PHOTOS);
    const hit = await cache.match(req.url);
    const net = fetch(req.url, { mode: 'cors', referrerPolicy: 'no-referrer' }).then(async (res) => {
        if (res && res.ok) {
            await cache.put(req.url, res.clone());
            const keys = await cache.keys();
            if (keys.length > PHOTO_MAX) await Promise.all(keys.slice(0, keys.length - PHOTO_MAX).map((k) => cache.delete(k)));
        }
        return res;
    }).catch(() => null);
    if (hit) { event.waitUntil(net); return hit; }
    const res = await net;
    return res || fetch(req);
}

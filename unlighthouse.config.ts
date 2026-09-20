const site = process.env.PERF_SITE || 'http://127.0.0.1:4173';

export default {
    site,
    scanner: {
        crawler: false,
        sitemap: false,
        samples: 1,
        maxRoutes: 12,
        throttle: false,
    },
    urls: [
        '/',
        '/login',
        '/space',
        '/rnp',
        '/goods',
        '/content',
        '/reports',
        '/advertising',
        '/ab-testing',
        '/dashboard.html',
    ],
};

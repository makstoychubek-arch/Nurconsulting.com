module.exports = {
    ci: {
        collect: {
            url: [
                process.env.PERF_SITE ? `${process.env.PERF_SITE}/` : 'http://127.0.0.1:4173/',
                process.env.PERF_SITE ? `${process.env.PERF_SITE}/login` : 'http://127.0.0.1:4173/login',
                process.env.PERF_SITE ? `${process.env.PERF_SITE}/space` : 'http://127.0.0.1:4173/space',
            ],
            numberOfRuns: 1,
            settings: {
                preset: 'desktop',
                chromeFlags: '--headless --no-sandbox --disable-gpu',
            },
        },
        assert: {
            assertions: {
                'categories:performance': ['warn', { minScore: 0.5 }],
                'categories:accessibility': ['warn', { minScore: 0.7 }],
                'first-contentful-paint': ['warn', { maxNumericValue: 4000 }],
                'cumulative-layout-shift': ['warn', { maxNumericValue: 0.25 }],
            },
        },
        upload: {
            target: 'filesystem',
            outputDir: '.lighthouseci',
        },
    },
};

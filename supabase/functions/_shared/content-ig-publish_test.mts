import assert from 'node:assert/strict';
import {
    buildIgPublishSteps,
    parseGraphBody,
    parseIgDryRun,
    runIgPublish,
    type IgHttpResult,
} from './content-ig-publish.ts';

assert.equal(parseIgDryRun(null, {}), false);
assert.equal(parseIgDryRun('true', {}), true);
assert.equal(parseIgDryRun('true', { dry_run: false }), false);
assert.equal(parseIgDryRun(null, { dry_run: true }), true);

const carousel = buildIgPublishSteps(['u1', 'u2', 'u3', 'u4'], 'hello');
assert.equal(carousel.filter((s) => s.type === 'container').length, 4);
assert.equal(carousel.some((s) => s.type === 'carousel'), true);
assert.equal(carousel[carousel.length - 1].type, 'publish');

const single = buildIgPublishSteps(['only']);
assert.equal(single[0].type, 'single');
assert.deepEqual(buildIgPublishSteps([]), []);

assert.equal(parseGraphBody(200, { id: '10' }).ok, true);
assert.equal(parseGraphBody(400, { error: { message: 'bad media' } }).ok, false);
assert.equal(parseGraphBody(429, { error: { message: 'rate' } }).retry, true);

{
    const calls: Array<{ path: string; body: Record<string, string> }> = [];
    const result = await runIgPublish({
        dryRun: true,
        igUserId: 'ig1',
        token: 'tok',
        slideUrls: ['https://cdn/a.png', 'https://cdn/b.png'],
        caption: 'cap',
        postGraph: async (path, body) => {
            calls.push({ path, body });
            return { ok: true, id: 'x', status: 200 };
        },
    });
    assert.equal(result.dryRun, true);
    assert.equal(result.wouldPublish, true);
    assert.equal(result.published, false);
    assert.deepEqual(calls, [], 'dry_run must not call Graph API');
}

{
    const calls: string[] = [];
    const result = await runIgPublish({
        dryRun: false,
        igUserId: '17841',
        token: 'LLT',
        slideUrls: ['https://cdn/1.png', 'https://cdn/2.png'],
        caption: 'sale',
        postGraph: async (path, body): Promise<IgHttpResult> => {
            calls.push(path);
            if (path.endsWith('/media') && body.is_carousel_item === 'true') {
                return { ok: true, id: `c${calls.length}`, status: 200 };
            }
            if (path.endsWith('/media') && body.media_type === 'CAROUSEL') {
                assert.ok(String(body.children).includes(','));
                return { ok: true, id: 'car1', status: 200 };
            }
            if (path.endsWith('/media_publish')) {
                assert.equal(body.creation_id, 'car1');
                return { ok: true, id: 'media9', permalink: 'https://ig/p/x', status: 200 };
            }
            return { ok: false, error: 'unexpected ' + path, status: 400 };
        },
    });
    assert.equal(result.published, true);
    assert.equal(result.mediaId, 'media9');
    assert.equal(result.permalink, 'https://ig/p/x');
    assert.equal(calls.filter((p) => p.endsWith('/media')).length, 3);
    assert.equal(calls.some((p) => p.endsWith('/media_publish')), true);
}

{
    const result = await runIgPublish({
        dryRun: false,
        igUserId: '17841',
        token: 'LLT',
        slideUrls: ['https://cdn/1.png'],
        postGraph: async (path, body) => {
            if (path.endsWith('/media')) return { ok: false, error: 'image_url is invalid', status: 400 };
            return { ok: true, id: 'nope', status: 200 };
        },
    });
    assert.equal(result.published, false);
    assert.match(String(result.error), /invalid/);
}

console.log('content-ig-publish_test: ok');

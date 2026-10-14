import assert from 'node:assert/strict';
import {
    buildIgPublishSteps,
    makeWaitContainer,
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


// сторис: на каждый слайд — свой контейнер STORIES и публикация
{
    const calls: Array<[string, Record<string, string>]> = [];
    const res = await runIgPublish({
        dryRun: false, igUserId: 'u1', token: 't', slideUrls: ['https://a/1.png', 'https://a/2.png'], kind: 'story', caption: 'не используется',
        postGraph: async (path, body) => { calls.push([path, body]); return path.endsWith('/media') ? { ok: true, id: 'c' + calls.length, status: 200 } : { ok: true, id: 'm' + calls.length, status: 200 }; },
    });
    assert.equal(res.published, true);
    assert.equal(calls.filter(([p]) => p.endsWith('/media')).length, 2);
    assert.equal(calls.filter(([p]) => p.endsWith('/media_publish')).length, 2);
    assert.ok(calls.every(([p, b]) => !p.endsWith('/media') || b.media_type === 'STORIES'));
    assert.ok(calls.every(([, b]) => !('caption' in b)));
    console.log('story publish: ok');
}

// Ожидание контейнера: ждём FINISHED, на ERROR сразу отказ, без ответа — отказ после попыток
{
    const seq = ['IN_PROGRESS', 'IN_PROGRESS', 'FINISHED'];
    let i = 0;
    const f = (async () => new Response(JSON.stringify({ status_code: seq[Math.min(i++, seq.length - 1)] }))) as typeof fetch;
    const noSleep = async () => {};
    assert.equal(await makeWaitContainer(f, 't', { sleep: noSleep })('c1'), true);
    assert.equal(i, 3);
    const bad = (async () => new Response(JSON.stringify({ status_code: 'ERROR' }))) as typeof fetch;
    assert.equal(await makeWaitContainer(bad, 't', { sleep: noSleep })('c2'), false);
    const slow = (async () => new Response(JSON.stringify({ status_code: 'IN_PROGRESS' }))) as typeof fetch;
    assert.equal(await makeWaitContainer(slow, 't', { tries: 3, sleep: noSleep })('c3'), false);
    console.log('wait container: ok');
}

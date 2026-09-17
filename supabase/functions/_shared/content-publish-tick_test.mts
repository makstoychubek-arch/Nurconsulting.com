import assert from 'node:assert/strict';
import {
    isDuePost,
    runContentPublishTick,
    slideUrlsOf,
    type ContentPostRow,
    type TickDeps,
} from './content-publish-tick.ts';

const NOW = new Date('2026-09-17T10:00:00.000Z');
const DUE: ContentPostRow = {
    id: 'p1',
    cabinet_id: 'cab-a',
    platform: 'instagram',
    status: 'scheduled',
    publish_at: '2026-09-17T09:59:00.000Z',
    slide_urls: ['https://cdn/a.png', 'https://cdn/b.png'],
    caption: 'hi',
};
const FUTURE: ContentPostRow = { ...DUE, id: 'p2', publish_at: '2026-09-17T12:00:00.000Z' };
const TIKTOK: ContentPostRow = { ...DUE, id: 'p3', platform: 'tiktok' };

assert.equal(isDuePost(DUE, NOW), true);
assert.equal(isDuePost(FUTURE, NOW), false);
assert.equal(isDuePost({ ...DUE, status: 'draft' }, NOW), false);
assert.deepEqual(slideUrlsOf(DUE), ['https://cdn/a.png', 'https://cdn/b.png']);
assert.deepEqual(slideUrlsOf({ ...DUE, slide_urls: [], file_url: 'https://cdn/x.png' }), ['https://cdn/x.png']);

function baseDeps(over: Partial<TickDeps> = {}): TickDeps & { graph: number; claimed: string[] } {
    const graph = { n: 0 };
    const claimed: string[] = [];
    const deps: TickDeps & { graph: number; claimed: string[] } = {
        now: NOW,
        dryRun: false,
        listDue: async () => [DUE, FUTURE, TIKTOK],
        claim: async (id) => { claimed.push(id); return true; },
        finish: async () => {},
        loadIg: async () => ({ token: 'LLT', igUserId: 'ig1' }),
        postGraph: async (path) => {
            graph.n += 1;
            if (path.endsWith('/media_publish')) return { ok: true, id: 'm1', permalink: 'https://ig/p', status: 200 };
            return { ok: true, id: 'c' + graph.n, status: 200 };
        },
        graph: 0,
        claimed,
        ...over,
    };
    Object.defineProperty(deps, 'graph', { get: () => graph.n });
    return deps;
}

{
    const claimed: string[] = [];
    let graph = 0;
    const result = await runContentPublishTick({
        now: NOW,
        dryRun: true,
        listDue: async () => [DUE, FUTURE, TIKTOK],
        claim: async (id) => { claimed.push(id); return true; },
        finish: async () => {},
        loadIg: async () => ({ token: 'LLT', igUserId: 'ig1' }),
        postGraph: async () => { graph += 1; return { ok: true, id: 'x', status: 200 }; },
    });
    assert.equal(result.dryRun, true);
    assert.equal(result.due, 2, 'tiktok+instagram due, future skipped by isDue in list filter... wait listDue returns all, isDue filters');
    assert.equal(result.wouldPublish, 1);
    assert.equal(result.published, 0);
    assert.equal(result.skipped, 1, 'tiktok is manual');
    assert.deepEqual(claimed, []);
    assert.equal(graph, 0, 'dry_run must not call Graph');
    assert.equal(result.results.find((r) => r.id === 'p1')?.action, 'would_publish');
    assert.equal(result.results.find((r) => r.id === 'p3')?.action, 'manual');
}

{
    const finished: Array<{ id: string; status: string }> = [];
    const result = await runContentPublishTick({
        now: NOW,
        dryRun: false,
        listDue: async () => [DUE],
        claim: async () => true,
        finish: async (id, patch) => { finished.push({ id, status: patch.status }); },
        loadIg: async () => ({ token: 'LLT', igUserId: 'ig1' }),
        postGraph: async (path) => {
            if (path.endsWith('/media_publish')) return { ok: true, id: 'm1', permalink: 'https://ig/p', status: 200 };
            return { ok: true, id: 'c1', status: 200 };
        },
    });
    assert.equal(result.published, 1);
    assert.equal(finished[0].status, 'published');
}

{
    const finished: Array<{ status: string; error?: string | null }> = [];
    const result = await runContentPublishTick({
        now: NOW,
        dryRun: false,
        listDue: async () => [DUE],
        claim: async () => true,
        finish: async (_id, patch) => { finished.push({ status: patch.status, error: patch.error_text }); },
        loadIg: async () => null,
        postGraph: async () => ({ ok: true, id: 'x', status: 200 }),
    });
    assert.equal(result.failed, 1);
    assert.equal(finished[0].status, 'error');
    assert.match(String(finished[0].error), /Instagram/);
}

console.log('content-publish-tick_test: ok');

/**
 * Mock tests for the /adv/* WB advertising proxy namespace.
 * Covers getBids, setBids (DRY_RUN on/off) and 401 handling.
 */
import assert from 'node:assert/strict';
import {
    ADV_HELPERS,
    ADVERT_API_HOST,
    executeAdvRequest,
    getBids,
    parseDryRun,
    setBids,
    type AdvCallContext,
} from './wb-adv-proxy.ts';

const TOKEN = 'wb-adv-secret-token-never-leak';
const CABINET = '11111111-2222-3333-4444-555555555555';

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

function baseCtx(overrides: Partial<AdvCallContext>): AdvCallContext {
    return {
        cabinetId: CABINET,
        token: TOKEN,
        tokenKey: 'secret-1',
        dryRun: true,
        reqPerMin: 10_000,
        sleepFn: async () => {},
        fetchFn: async () => jsonResponse(200, {}),
        onAuthFailure: async () => {
            throw new Error('onAuthFailure should not run');
        },
        ...overrides,
    };
}

// Official OpenAPI sample for POST /adv/v0/normquery/get-bids
const GET_BIDS_WB = {
    bids: [
        {
            advert_id: 1825035,
            bid: 700,
            bid_kopecks: 70000,
            currency: 'RUB',
            nm_id: 983512347,
            norm_query: 'Фраза 1',
        },
    ],
};

const SET_BIDS_PAYLOAD = {
    bids: [{ advertId: 1825035, nmId: 983512347, normQuery: 'Фраза 1', bidMinorUnits: 70000 }],
};

async function testGetBids() {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const result = await getBids(baseCtx({
        fetchFn: async (url, init) => {
            calls.push({ url: String(url), init: init || {} });
            return jsonResponse(200, GET_BIDS_WB);
        },
    }), { items: [{ advert_id: 1825035, nm_id: 983512347 }] });

    assert.equal(calls.length, 1, 'getBids must call WB once');
    assert.equal(calls[0].url, `${ADVERT_API_HOST}${ADV_HELPERS.getBids.path}`);
    assert.equal(calls[0].init.method, 'POST');
    const headers = new Headers(calls[0].init.headers);
    assert.equal(headers.get('Authorization'), TOKEN);
    assert.equal(result.status, 200);
    assert.deepEqual(result.data, GET_BIDS_WB);
    assert.equal(JSON.stringify(result.data).includes(TOKEN), false, 'token must not leak in getBids response');
}

async function testSetBidsDryRun() {
    let called = false;
    const result = await setBids(baseCtx({
        dryRun: true,
        fetchFn: async () => {
            called = true;
            return jsonResponse(200, { ok: true });
        },
    }), SET_BIDS_PAYLOAD);

    assert.equal(called, false, 'DRY_RUN must not call WB');
    assert.equal(result.status, 200);
    assert.deepEqual(result.data, { dry_run: true, payload: SET_BIDS_PAYLOAD });
}

async function testSetBidsLive() {
    const calls: Array<{ url: string; method?: string; body: unknown; auth: string | null }> = [];
    const wb = {
        success: [{ advertId: 1825035, nmId: 983512347, normQuery: 'Фраза 1', currency: 'RUB' }],
        failed: [],
    };
    const result = await setBids(baseCtx({
        dryRun: false,
        fetchFn: async (url, init) => {
            const headers = new Headers(init?.headers);
            calls.push({
                url: String(url),
                method: init?.method,
                body: JSON.parse(String(init?.body || '{}')),
                auth: headers.get('Authorization'),
            });
            return jsonResponse(200, wb);
        },
    }), SET_BIDS_PAYLOAD);

    assert.equal(calls.length, 1, 'live setBids must call WB once');
    assert.equal(calls[0].url, `${ADVERT_API_HOST}${ADV_HELPERS.setBids.path}`);
    assert.equal(calls[0].method, 'POST');
    assert.equal(calls[0].auth, TOKEN);
    assert.deepEqual(calls[0].body, SET_BIDS_PAYLOAD);
    assert.equal(result.status, 200);
    assert.deepEqual(result.data, wb);
    assert.equal(JSON.stringify(result.data).includes(TOKEN), false, 'token must not leak in setBids response');
}

async function testUnauthorized() {
    let marked = 0;
    const calls: string[] = [];
    const result = await getBids(baseCtx({
        fetchFn: async (url) => {
            calls.push(String(url));
            return jsonResponse(401, { error: 'unauthorized' });
        },
        onAuthFailure: async () => {
            marked += 1;
        },
    }), { items: [{ advert_id: 1, nm_id: 2 }] });

    assert.equal(calls.length, 1, '401 must not be retried');
    assert.equal(marked, 1, '401 must flip cabinets.adv_token_valid via onAuthFailure');
    assert.equal(result.status, 401);
    assert.equal((result.data as { code: string }).code, 'ADV_TOKEN_INVALID');
    assert.equal((result.data as { cabinet_id: string }).cabinet_id, CABINET);
    assert.equal(JSON.stringify(result.data).includes(TOKEN), false, 'token must not leak on 401');
}

async function testGenericSetBidsPathDryRun() {
    let called = false;
    const result = await executeAdvRequest(baseCtx({
        dryRun: true,
        fetchFn: async () => {
            called = true;
            return jsonResponse(200, {});
        },
    }), {
        path: '/adv/v0/normquery/bids',
        method: 'POST',
        body: SET_BIDS_PAYLOAD,
    });
    assert.equal(called, false);
    assert.deepEqual(result.data, { dry_run: true, payload: SET_BIDS_PAYLOAD });
}

assert.equal(parseDryRun(undefined), true);
assert.equal(parseDryRun(''), true);
assert.equal(parseDryRun('false'), false);

await testGetBids();
await testSetBidsDryRun();
await testSetBidsLive();
await testUnauthorized();
await testGenericSetBidsPathDryRun();
console.log('wb-adv-proxy_test: ok');

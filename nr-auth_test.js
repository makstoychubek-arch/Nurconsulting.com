/**
 * Node smoke-test for nr-auth.js (jsdom-less: stub window/localStorage).
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const store = new Map();
const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    get length() { return store.size; },
    key: (i) => Array.from(store.keys())[i] || null,
};
const sessionStorage = new Map();
const sessionStore = {
    getItem: (k) => (sessionStorage.has(k) ? sessionStorage.get(k) : null),
    setItem: (k, v) => { sessionStorage.set(k, String(v)); },
    removeItem: (k) => { sessionStorage.delete(k); },
};

const windowStub = {
    location: { search: '', pathname: '/' },
    localStorage: localStorage,
    sessionStorage: sessionStore,
    addEventListener: function () {},
};
global.window = windowStub;
global.localStorage = localStorage;
global.sessionStorage = sessionStore;
global.console = console;

const src = fs.readFileSync(path.join(__dirname, 'nr-auth.js'), 'utf8');
eval(src);

const NrAuth = windowStub.NrAuth;
assert.ok(NrAuth, 'NrAuth exported');

assert.strictEqual(NrAuth.isAuthTokenError({ message: 'Invalid Refresh Token' }), true);
assert.strictEqual(NrAuth.isAuthTokenError({ message: 'AuthSessionMissingError' }), true);
assert.strictEqual(NrAuth.isAuthTokenError({ message: 'network timeout' }), false);

assert.strictEqual(NrAuth.isWbTokenError('WB token not configured for this cabinet'), true);
assert.strictEqual(NrAuth.isWbTokenError('invalid_token'), true);
assert.strictEqual(NrAuth.isWbTokenError('rate limit'), false);

localStorage.setItem('sb-fiukyfyhotctvfdidktx-auth-token', '{"access_token":"dead"}');
localStorage.setItem('nr_auth_broken', '1');
NrAuth.prepareAuthStorage();
assert.strictEqual(localStorage.getItem('sb-fiukyfyhotctvfdidktx-auth-token'), null, 'broken auth storage cleared');

async function runRecover() {
    const fakeClient = {
        auth: {
            async getSession() {
                return { data: { session: null }, error: { message: 'Invalid Refresh Token' } };
            },
            async signOut() { this.signedOut = true; },
        },
    };
    localStorage.setItem('sb-fiukyfyhotctvfdidktx-auth-token', '{"refresh_token":"x"}');
    const session = await NrAuth.recoverBrokenSession(fakeClient);
    assert.strictEqual(session, null);
    assert.strictEqual(fakeClient.auth.signedOut, true);
    assert.strictEqual(localStorage.getItem('sb-fiukyfyhotctvfdidktx-auth-token'), null);
    assert.strictEqual(localStorage.getItem('nr_auth_broken'), '1');
}

runRecover().then(() => {
    assert.strictEqual(console.__nrPublicMuted, undefined, 'node/test must not mute console');

    const origLog = console.log;
    const origError = console.error;
    windowStub.document = {};
    windowStub.location.pathname = '/';
    NrAuth.installPublicConsoleMute();
    assert.strictEqual(console.__nrPublicMuted, true);
    assert.notStrictEqual(console.log, origLog);
    console.log('secret should stay hidden');
    console.error('token leak should stay hidden');
    console.log = origLog;
    console.error = origError;
    delete console.__nrPublicMuted;

    windowStub.location.pathname = '/space';
    NrAuth.installPublicConsoleMute();
    assert.strictEqual(console.__nrPublicMuted, undefined, '/space must keep console for dashboard errors');
    assert.strictEqual(NrAuth.isAppShellPath(), true);

    windowStub.location.pathname = '/ab-testing';
    assert.strictEqual(NrAuth.isAppShellPath(), true);
    windowStub.location.pathname = '/rnp';
    assert.strictEqual(NrAuth.isAppShellPath(), true);
    windowStub.location.pathname = '/';
    assert.strictEqual(NrAuth.isAppShellPath(), false);

    localStorage.setItem('nr_debug', '1');
    assert.strictEqual(NrAuth.isDebugOn(), true);
    localStorage.removeItem('nr_debug');

    origLog('nr-auth_test: ok');
}).catch((e) => {
    console.error(e);
    process.exit(1);
});

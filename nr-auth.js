/**
 * Общая обработка сессии NR Space.
 * Битый refresh-токен в localStorage даёт AuthApiError на каждом заходе —
 * чистим его до createClient и после неудачного getSession.
 */
(function (global) {
    var AUTH_KEY_RE = /^sb-.*-auth-token/;
    var BROKEN_RE = /refresh token|invalid jwt|jwt expired|session not found|AuthSessionMissing|Invalid Refresh Token|invalid claim/i;
    var WB_TOKEN_RE = /wb token|invalid token|invalid_token|token not configured|token contains invalid|некорректн\w* токен|проверьте токен/i;

    function isAuthTokenError(err) {
        if (!err) return false;
        var msg = err.message || err.error_description || err.code || String(err);
        return BROKEN_RE.test(msg);
    }

    function isWbTokenError(err) {
        if (!err) return false;
        var msg = typeof err === 'string' ? err : (err.message || err.error || String(err));
        return WB_TOKEN_RE.test(msg);
    }

    function textFromArgs(args) {
        var text = '';
        try {
            for (var i = 0; i < args.length; i++) {
                var a = args[i];
                if (a && a.message) text += a.message + ' ';
                else text += String(a) + ' ';
            }
        } catch (_) {}
        return text;
    }

    function installAuthConsoleMute() {
        if (console.__nrAuthMuted) return;
        console.__nrAuthMuted = true;
        var err = console.error;
        var warn = console.warn;
        function quiet(method) {
            return function () {
                var text = textFromArgs(arguments);
                if (isAuthTokenError({ message: text }) || isWbTokenError(text)) return;
                return method.apply(console, arguments);
            };
        }
        console.error = quiet(err);
        console.warn = quiet(warn);
    }

    function ls() {
        try { return global.localStorage || localStorage; } catch (_) { return null; }
    }

    function ss() {
        try { return global.sessionStorage || sessionStorage; } catch (_) { return null; }
    }

    function clearSupabaseAuthStorage() {
        var storage = ls();
        if (!storage) return;
        try {
            var keys = [];
            for (var i = 0; i < storage.length; i++) {
                var k = storage.key(i);
                if (k && AUTH_KEY_RE.test(k)) keys.push(k);
            }
            keys.forEach(function (k) { storage.removeItem(k); });
        } catch (_) {}
    }

    function shouldPurgeBeforeInit() {
        try {
            var session = ss();
            var storage = ls();
            if (session && session.getItem('nr_logged_out') === '1') return true;
            if (storage && storage.getItem('nr_auth_broken') === '1') return true;
            var params = new URLSearchParams(global.location.search);
            if (params.get('logged_out') === '1') return true;
        } catch (_) {}
        return false;
    }

    function markAuthBroken() {
        try { var storage = ls(); if (storage) storage.setItem('nr_auth_broken', '1'); } catch (_) {}
    }

    function clearAuthBroken() {
        try { var storage = ls(); if (storage) storage.removeItem('nr_auth_broken'); } catch (_) {}
    }

    function prepareAuthStorage() {
        if (shouldPurgeBeforeInit()) clearSupabaseAuthStorage();
    }

    async function recoverBrokenSession(client) {
        if (!client || !client.auth) return null;
        try {
            var res = await client.auth.getSession();
            if (res.error && isAuthTokenError(res.error)) {
                markAuthBroken();
                try { await client.auth.signOut({ scope: 'local' }); } catch (_) {}
                clearSupabaseAuthStorage();
                return null;
            }
            if (res.data && res.data.session) {
                clearAuthBroken();
                return res.data.session;
            }
            return null;
        } catch (e) {
            if (isAuthTokenError(e)) {
                markAuthBroken();
                try { await client.auth.signOut({ scope: 'local' }); } catch (_) {}
                clearSupabaseAuthStorage();
            }
            return null;
        }
    }

    function createClient(supabaseLib, url, key) {
        installAuthConsoleMute();
        prepareAuthStorage();
        return supabaseLib.createClient(url, key, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        });
    }

    global.NrAuth = {
        isAuthTokenError: isAuthTokenError,
        isWbTokenError: isWbTokenError,
        clearSupabaseAuthStorage: clearSupabaseAuthStorage,
        prepareAuthStorage: prepareAuthStorage,
        recoverBrokenSession: recoverBrokenSession,
        createClient: createClient,
        markAuthBroken: markAuthBroken,
        clearAuthBroken: clearAuthBroken
    };
})(window);

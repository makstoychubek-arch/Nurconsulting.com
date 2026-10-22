/**
 * Общая заглушка для браузерных проверок кабинета: статический сервер, подмена входа (сессия в localStorage)
 * и ответы Supabase из тестовых данных. Наружу сеть не ходит.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webp': 'image/webp' };

const USER_ID = '11111111-1111-1111-1111-111111111111';
const ADMIN_ID = '2f7d8960-0df4-4a17-be70-f2cb2ac0032e'; // совпадает с SUPER_ADMIN_ID в dashboard.html
const CAB = 'cccccccc-0000-0000-0000-000000000001';

function serve() {
    return new Promise((resolve) => {
        const srv = http.createServer((req, res) => {
            let p = decodeURIComponent(req.url.split('?')[0]);
            if (p === '/') p = '/index.html';
            if (p === '/login') p = '/login.html';
            if (p === '/space') p = '/dashboard.html';
            const f = path.join(ROOT, p);
            if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
            res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
            res.end(fs.readFileSync(f));
        }).listen(0, () => resolve(srv));
    });
}

/**
 * opts: { userId, email, tables: {имя: строки}, rpcs: {имя: значение}, functions: {имя: (body) => ответ | Promise}, latencyMs }
 * Возвращает { ctx, page, errors, calls } — calls: список запросов к edge-функциям и записям в базу.
 */
async function openApp(browser, base, opts = {}) {
    const userId = opts.userId || USER_ID;
    const email = opts.email || 'qa@example.test';
    const ctx = await browser.newContext(opts.phone
        ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148' }
        : { viewport: { width: 1400, height: 900 } });
    const now = Math.floor(Date.now() / 1000);
    const user = { id: userId, aud: 'authenticated', role: 'authenticated', email, app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const jwt = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: userId, role: 'authenticated', exp: now + 3600, aud: 'authenticated' }) + '.sig';
    const session = { access_token: jwt, refresh_token: 'rt', token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, user };
    await ctx.addInitScript(([k, v]) => {
        try { localStorage.setItem(k, JSON.stringify(v)); localStorage.setItem('nr_welcome_v1', '1'); } catch (e) {}
    }, ['sb-fiukyfyhotctvfdidktx-auth-token', session]);

    const tables = opts.tables || {};
    const rpcs = Object.assign({ is_staff: true, has_paid_access: true, is_super_admin: false }, opts.rpcs || {});
    const calls = [];
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    await ctx.route(/supabase\.co/, async (r) => {
        const req = r.request();
        const u = new URL(req.url());
        if (opts.latencyMs) await sleep(opts.latencyMs);
        if (u.pathname === '/auth/v1/user') return r.fulfill({ json: user });
        if (u.pathname.startsWith('/functions/v1/')) {
            const name = u.pathname.split('/').pop();
            let body = {};
            try { body = JSON.parse(req.postData() || '{}'); } catch (e) {}
            calls.push({ kind: 'fn', name, body, at: Date.now() });
            const h = (opts.functions || {})[name];
            const out = h ? await h(body) : {};
            if (out && out.__status) return r.fulfill({ status: out.__status, json: out.body || {} });
            return r.fulfill({ json: out });
        }
        if (u.pathname.startsWith('/rest/v1/rpc/')) {
            const n = u.pathname.split('/').pop();
            return r.fulfill({ json: n in rpcs ? rpcs[n] : (n === 'viewer_cabinets' || n.startsWith('rnp_') ? [] : null) });
        }
        if (u.pathname.startsWith('/rest/v1/')) {
            const t = u.pathname.split('/').pop();
            if (req.method() !== 'GET') { calls.push({ kind: 'write', table: t, method: req.method(), at: Date.now() }); return r.fulfill({ status: 204, body: '' }); }
            calls.push({ kind: 'read', table: t, at: Date.now() });
            const rows = tables[t] || [];
            const single = /vnd.pgrst.object/.test(req.headers().accept || '');
            return r.fulfill({ json: single ? (rows[0] || null) : rows, headers: { 'content-range': '0-' + Math.max(0, rows.length - 1) + '/' + rows.length } });
        }
        return r.fulfill({ json: {} });
    });
    // Всё остальное снаружи (шрифты, WB) в песочнице недоступно, режем сразу.
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => (/supabase\.co/.test(r.request().url()) ? r.fallback() : r.abort()));

    const page = await ctx.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message || e)));
    await page.goto(base + '/space');
    await page.waitForFunction(() => typeof showTab === 'function');
    return { ctx, page, errors, calls };
}

module.exports = { serve, openApp, chromium, USER_ID, ADMIN_ID, CAB };

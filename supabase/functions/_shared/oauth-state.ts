/** Подписанный state для OAuth: JSON + HMAC-SHA256. Без подписи любой мог подставить чужой cabinet_id в колбэк. */

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
    let s = '';
    bytes.forEach((b) => { s += String.fromCharCode(b); });
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Uint8Array {
    const pad = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
    const bin = atob(pad);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
    return await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function signOAuthState(secret: string, payload: Record<string, unknown>, now = Date.now()): Promise<string> {
    const body = b64url(enc.encode(JSON.stringify({ ...payload, t: now })));
    const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(body)));
    return `${body}.${b64url(sig)}`;
}

export async function verifyOAuthState(
    secret: string,
    state: string,
    maxAgeMs = 15 * 60_000,
    now = Date.now(),
): Promise<Record<string, unknown> | null> {
    if (!secret) return null;
    const parts = String(state || '').split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
    try {
        const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), fromB64url(parts[1]), enc.encode(parts[0]));
        if (!ok) return null;
        const payload = JSON.parse(new TextDecoder().decode(fromB64url(parts[0])));
        const t = Number(payload?.t);
        if (!Number.isFinite(t) || now - t > maxAgeMs || t - now > 60_000) return null;
        return payload;
    } catch {
        return null;
    }
}

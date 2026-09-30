// Шифрование секретов клиента (токен WB) перед записью в базу.
//
// AES-256-GCM через WebCrypto. Ключ — 32 байта в base64 из переменной
// окружения Edge Functions AKYLAI_ENC_KEY; в базе и в коде его нет.
// Формат: "v1.<iv base64url>.<шифртекст base64url>".
// Работает и в Deno, и в Node (тесты) — оба дают globalThis.crypto.subtle.

const PREFIX = 'v1';

function b64urlEncode(bytes: Uint8Array): string {
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(text: string): Uint8Array {
    const norm = text.replace(/-/g, '+').replace(/_/g, '/');
    const pad = norm + '='.repeat((4 - (norm.length % 4)) % 4);
    const bin = atob(pad);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

export async function importSecretKey(base64Key: string): Promise<CryptoKey> {
    const raw = b64urlDecode(String(base64Key || '').trim());
    if (raw.length !== 32) throw new Error('secret key must be 32 bytes (base64)');
    return await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptSecret(plain: string, key: CryptoKey): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = new TextEncoder().encode(plain);
    const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data));
    return `${PREFIX}.${b64urlEncode(iv)}.${b64urlEncode(cipher)}`;
}

export async function decryptSecret(boxed: string, key: CryptoKey): Promise<string> {
    const [ver, ivPart, dataPart] = String(boxed || '').split('.');
    if (ver !== PREFIX || !ivPart || !dataPart) throw new Error('bad secret format');
    const plain = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: b64urlDecode(ivPart) },
        key,
        b64urlDecode(dataPart),
    );
    return new TextDecoder().decode(plain);
}

/** SHA-256 в hex — храним только хэш одноразового кода, не сам код. */
export async function sha256Hex(text: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Случайный код для ссылки t.me/<бот>?start=<код>: только [A-Za-z0-9_-], до 64 символов. */
export function randomLinkCode(bytes = 24): string {
    return b64urlEncode(crypto.getRandomValues(new Uint8Array(bytes)));
}

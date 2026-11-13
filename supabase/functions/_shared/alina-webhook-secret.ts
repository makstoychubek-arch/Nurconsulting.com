export async function alinaWebhookSecret(botId: 'alina' | 'alina2'): Promise<string> {
    const configured = Deno.env.get('ALINA_WEBHOOK_SECRET')?.trim();
    const seed = configured || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
    if (!seed) throw new Error('Alina webhook signing key is unavailable');
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw', encoder.encode(seed), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`nr-space/telegram-webhook/${botId}`));
    return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

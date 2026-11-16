// Запасная модель: Gemini через OpenAI-совместимый адрес Google. Включается секретом GEMINI_API_KEY в Supabase
// (Edge Functions → Secrets). Без ключа функции работают как раньше (шаблон ответа, обычная раскладка карусели).
// Модель по умолчанию — «gemini-flash-lite-latest» (бесплатный лимит у Flash Lite выше), переопределяется GEMINI_MODEL.
export type ChatMsg = { role: string; content: string };

export function geminiConfigured(): boolean {
    return (Deno.env.get('GEMINI_API_KEY') ?? '').trim().length > 0;
}

export function geminiRequest(messages: ChatMsg[], opts: { temperature?: number; maxTokens?: number; json?: boolean } = {}) {
    const key = (Deno.env.get('GEMINI_API_KEY') ?? '').trim();
    const base = (Deno.env.get('GEMINI_BASE_URL') ?? 'https://generativelanguage.googleapis.com/v1beta/openai').replace(/\/$/, '');
    const body: Record<string, unknown> = {
        model: (Deno.env.get('GEMINI_MODEL') ?? 'gemini-flash-lite-latest').trim(),
        messages,
        temperature: opts.temperature ?? 0.4,
    };
    if (opts.maxTokens) body.max_tokens = opts.maxTokens;
    if (opts.json) body.response_format = { type: 'json_object' };
    return { url: `${base}/chat/completions`, init: { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) } as RequestInit };
}

/** Один вызов Gemini. Не бросает ошибок: при сбое возвращает ok=false. */
export async function geminiChat(messages: ChatMsg[], opts: { temperature?: number; maxTokens?: number; json?: boolean; timeoutMs?: number } = {}): Promise<{ ok: boolean; text: string; promptTokens: number; completionTokens: number; error: string }> {
    if (!geminiConfigured()) return { ok: false, text: '', promptTokens: 0, completionTokens: 0, error: 'no_gemini_key' };
    try {
        const { url, init } = geminiRequest(messages, opts);
        const res = await fetch(url, { ...init, signal: AbortSignal.timeout(opts.timeoutMs ?? 25000) });
        const data = await res.json().catch(() => null);
        if (!res.ok) return { ok: false, text: '', promptTokens: 0, completionTokens: 0, error: `gemini_${res.status}` };
        return {
            ok: true, text: String(data?.choices?.[0]?.message?.content ?? '').trim(),
            promptTokens: Number(data?.usage?.prompt_tokens) || 0, completionTokens: Number(data?.usage?.completion_tokens) || 0, error: '',
        };
    } catch (e) {
        return { ok: false, text: '', promptTokens: 0, completionTokens: 0, error: String((e as Error)?.message || e).slice(0, 120) };
    }
}

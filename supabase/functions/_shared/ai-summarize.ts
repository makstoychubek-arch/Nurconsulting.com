// Дешёкое AI-резюме (gpt-4o-mini). Если ключа нет — вызывающий код использует эвристику.
//
// Secrets:
//   OPENAI_API_KEY   — ключ OpenAI (или совместимого API)
//   OPENAI_MODEL     — по умолчанию gpt-4o-mini
//   OPENAI_BASE_URL  — по умолчанию https://api.openai.com/v1

export type AiSummarizeResult = {
    summary: string;
    via: 'ai' | 'none';
};

export async function summarizeForTelegram(opts: {
    title: string;
    body: string;
    maxChars?: number;
}): Promise<AiSummarizeResult> {
    const apiKey = (Deno.env.get('OPENAI_API_KEY') ?? '').trim();
    if (!apiKey) return { summary: '', via: 'none' };

    const model = (Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini').trim();
    const baseUrl = (Deno.env.get('OPENAI_BASE_URL') ?? 'https://api.openai.com/v1').replace(/\/$/, '');
    const maxChars = opts.maxChars ?? 360;
    const body = opts.body.replace(/\s+/g, ' ').trim().slice(0, 6000);

    const system = [
        'Ты редактор Telegram-канала для продавцов Wildberries и Ozon.',
        'Сожми новость: суть, даты/сроки, что меняется, что сделать продавцу.',
        'Формат: 2–3 коротких предложения ИЛИ 3–4 буллета (•).',
        'Без приветствий, без «уважаемые партнёры», без ссылки на источник.',
        `Лимит: до ${maxChars} символов. Только текст резюме на русском.`,
    ].join(' ');

    const user = `Заголовок: ${opts.title.trim()}\n\nТекст новости:\n${body}`;

    try {
        const res = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model,
                temperature: 0.2,
                max_tokens: 220,
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: user },
                ],
            }),
            signal: AbortSignal.timeout(20000),
        });

        const raw = await res.text();
        if (!res.ok) {
            console.warn('[ai-summarize] API error:', res.status, raw.slice(0, 300));
            return { summary: '', via: 'none' };
        }

        let data: { choices?: Array<{ message?: { content?: string } }> };
        try {
            data = JSON.parse(raw);
        } catch {
            return { summary: '', via: 'none' };
        }

        const text = String(data?.choices?.[0]?.message?.content ?? '').trim();
        if (!text) return { summary: '', via: 'none' };

        return { summary: clampSummary(text, maxChars), via: 'ai' };
    } catch (e) {
        console.warn('[ai-summarize] request failed:', String(e));
        return { summary: '', via: 'none' };
    }
}

function clampSummary(s: string, max: number): string {
    const clean = s.replace(/^["']|["']$/g, '').trim();
    if (clean.length <= max) return clean;
    const cut = clean.slice(0, max);
    const lastBreak = Math.max(cut.lastIndexOf('\n'), cut.lastIndexOf('. '), cut.lastIndexOf(' '));
    const base = lastBreak > max * 0.55 ? cut.slice(0, lastBreak) : cut;
    return base.trimEnd() + '…';
}

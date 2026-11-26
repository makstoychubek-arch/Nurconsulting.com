// Алина 2.0: понимание коротких ответов клиента на вопрос Алины («Да😍», «ага конечно», «согласна 😊», «давайте»). Если шаблон (регулярка) ответ не узнал,
// дешёвая модель решает: согласие, отказ или другое. Работает только на коротких ответах и только когда Алина перед этим задала вопрос.
import { secretOrEnv } from './integration-secrets.ts';
import { llmBudgetOk, openAiErrorCode, recordLlmUsage } from './llm-usage.ts';

import { parseAnswerKind, worthClassifying, type AnswerKind } from './alina-intent-core.ts';
export { parseAnswerKind, worthClassifying, type AnswerKind };

export async function classifyAnswer(question: string, answer: string): Promise<AnswerKind> {
  if ((Deno.env.get('ALINA_INTENT') ?? '1') === '0' || !worthClassifying(answer)) return 'other';
  const apiKey = await secretOrEnv('OPENAI_API_KEY');
  if (!apiKey || !await llmBudgetOk()) return 'other';
  const model = (Deno.env.get('ALINA_INTENT_MODEL') || 'gpt-4o-mini').trim();
  const baseUrl = (Deno.env.get('OPENAI_BASE_URL') ?? 'https://api.openai.com/v1').replace(/\/$/, '');
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, temperature: 0, max_tokens: 20, response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Менеджер задал клиенту вопрос. Определи, как клиент ответил именно на ЭТОТ вопрос. "yes": клиент согласен, берёт, подтверждает (в том числе эмодзи, «давайте», «хорошо, давайте», «ага»). "no": отказ, «не надо», «не успею». "other": всё остальное (встречный вопрос, «подумаю», «напишу завтра», новая тема). Верни только JSON {"answer":"yes|no|other"}.' },
          { role: 'user', content: JSON.stringify({ question: question.slice(0, 300), answer: answer.slice(0, 120) }) },
        ],
      }),
      signal: AbortSignal.timeout(5000),
    });
    const raw = await res.text();
    if (!res.ok) { await recordLlmUsage(model, null, openAiErrorCode(res.status, raw), 'intent'); return 'other'; }
    const data = JSON.parse(raw);
    await recordLlmUsage(model, data?.usage, null, 'intent');
    return parseAnswerKind(JSON.parse(String(data?.choices?.[0]?.message?.content ?? '{}')).answer);
  } catch {
    return 'other';
  }
}

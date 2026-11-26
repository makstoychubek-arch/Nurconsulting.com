// «Очеловечивание» ответов Алины (владелец, 24 ноября 2026): шаблонную реплику ChatGPT переписывает живее, факты остаются как были.
// Факты (числа, «названия в кавычках», @логины, ссылки) проверяет код: если что-то пропало или появилось новое, уходит исходный текст.
import { pickExamples } from './alina-examples.ts';
import { secretOrEnv } from './integration-secrets.ts';
import { llmBudgetOk, openAiErrorCode, recordLlmUsage } from './llm-usage.ts';

/** Что нельзя менять при переписывании: ключи, ТЗ, ссылки, логины, длинные тексты с условиями. */
export function skipHumanize(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 320) return true;
  if (/https?:\/\/|t\.me\/|@\w{3,}/i.test(t)) return true;
  if (/ключ|ТЗ|реквизит|номер карты|iban|\d{8,}/i.test(t)) return true;
  // Реплики, где важно, кто что делает (фото ШК, пункт выдачи, отзыв, интеграция, оплата): ИИ путал роли («ждите фото» вместо «пришлёте»), не переписываем.
  if (/штрихкод|\bШК\b|пункт\S*\s+выдач|отзыв|интеграци|оплат|выплат|заказ\S*\s+(?:приде|прибуд)|напомн/i.test(t)) return true;
  return false;
}

/** Факты в тексте: числа, слова в «ёлочках», @логины. */
export function factsOf(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/«[^»]+»/g)) out.push(m[0].toLowerCase());
  for (const m of text.matchAll(/@\w+/g)) out.push(m[0].toLowerCase());
  for (const m of text.matchAll(/\d+/g)) out.push(m[0]);
  return out;
}

/** Все факты исходного текста есть в переписанном, и новых чисел или названий нет. */
export function factsOk(original: string, rewritten: string): boolean {
  const a = factsOf(original).sort(), b = factsOf(rewritten).sort();
  if (a.length !== b.length) return false;
  return a.every((x, i) => x === b[i]);
}

const STYLES = ['очень коротко и по делу', 'тепло и просто', 'дружелюбно, как подруге', 'спокойно и деловито', 'чуть живее, с лёгкой интонацией', 'нейтрально, как в переписке в мессенджере'];

export async function humanizeReplies(replies: string[], clientText: string): Promise<string[]> {
  if ((Deno.env.get('ALINA_HUMANIZE') ?? '1') === '0') return replies;
  const idx = replies.map((r, i) => (skipHumanize(r) ? -1 : i)).filter((i) => i >= 0);
  if (!idx.length) return replies;
  const apiKey = await secretOrEnv('OPENAI_API_KEY');
  if (!apiKey || !await llmBudgetOk()) return replies;
  const model = (Deno.env.get('ALINA_BRAIN_MODEL') || Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini').trim();
  const baseUrl = (Deno.env.get('OPENAI_BASE_URL') ?? 'https://api.openai.com/v1').replace(/\/$/, '');
  const system = [
    'Ты редактор живой речи менеджера раздач в Telegram. Перепиши каждую реплику так, как написал бы живой человек: коротко, тепло, без канцелярита и повторов, на «вы».',
    'Нельзя: менять факты, числа, даты, названия в «ёлочках», логины, добавлять обещания и новые сведения, убирать вопрос или просьбу, делать текст длиннее исходного больше чем на треть.',
    'Делай КОРОЧЕ: одна-две короткие фразы, без вводных («к сожалению», «пожалуйста»), без извинений и канцелярита. Не проси писать слово «да»: просто задай вопрос.',
    `Каждый раз формулируй по-новому, не повторяй свои прошлые обороты и шаблонные начала («Отлично!», «Поняла», «Хорошо»). Стиль этой реплики: ${STYLES[Math.floor(Math.random() * STYLES.length)]}.`,
    'Эмодзи не больше одного на реплику, можно без него. Не начинай каждую реплику одинаково. Не используй «Здравствуйте» повторно, если это не первое сообщение.',
    'Верни ТОЛЬКО JSON {"replies":["...", ...]} с тем же числом реплик и в том же порядке.',
    '',
    'Образцы тона из реальных чатов:',
    ...pickExamples(clientText, 8).map(([q, a]) => `Клиент: ${q}\nМенеджер: ${a}`),
  ].join('\n');
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, temperature: 0.9, max_tokens: 400, response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: JSON.stringify({ client: clientText.slice(0, 400), replies: idx.map((i) => replies[i]) }) },
        ],
      }),
      signal: AbortSignal.timeout(8000),
    });
    const raw = await res.text();
    if (!res.ok) { await recordLlmUsage(model, null, openAiErrorCode(res.status, raw), 'humanize'); return replies; }
    const data = JSON.parse(raw);
    await recordLlmUsage(model, data?.usage, null, 'humanize');
    const parsed = JSON.parse(String(data?.choices?.[0]?.message?.content ?? '{}'));
    const out: unknown = parsed.replies;
    if (!Array.isArray(out) || out.length !== idx.length) return replies;
    const result = [...replies];
    idx.forEach((i, k) => {
      const t = String(out[k] ?? '').trim();
      if (t && !/^(null|none|undefined)$/i.test(t) && t.length <= Math.ceil(replies[i].length * 1.4) + 20 && factsOk(replies[i], t)) result[i] = t;
    });
    return result;
  } catch {
    return replies; // сбой или таймаут: уходит исходный текст
  }
}

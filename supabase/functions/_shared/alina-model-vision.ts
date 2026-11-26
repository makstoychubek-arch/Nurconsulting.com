// Алина 2.0: клиент прислал картинку модели (скрин «вот эта») вместо названия. Сравниваем с нашими фото шести моделей и называем модель сами,
// чтобы не переспрашивать то, что человек уже показал (25 ноября 2026, Марина Лутиева).
import { PAJAMA_PHOTOS } from './alina-pajama-photo-assets.ts';
import { downloadTelegramFile } from './alina-vision.ts';
import { secretOrEnv } from './integration-secrets.ts';
import { llmBudgetOk, openAiErrorCode, recordLlmUsage } from './llm-usage.ts';
import { parseModelAnswer } from './alina-model-vision-core.ts';

function b64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s);
}

/** Название модели с картинки клиента или null (не уверены / картинка не наша). */
export async function identifyModelFromPhoto(botToken: string, fileId: string): Promise<string | null> {
  if ((Deno.env.get('ALINA_MODEL_VISION') ?? '1') === '0') return null;
  const apiKey = await secretOrEnv('OPENAI_API_KEY');
  if (!apiKey || !await llmBudgetOk()) return null;
  const file = await downloadTelegramFile(botToken, fileId);
  if (!file) return null;
  const names = PAJAMA_PHOTOS.map((p) => p.caption);
  const baseUrl = (Deno.env.get('OPENAI_BASE_URL') ?? 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = (Deno.env.get('ALINA_VISION_MODEL') || 'gpt-4o').trim();
  const content: unknown[] = [
    { type: 'text', text: `Клиент прислал картинку пижамы. Ниже она (первая), затем наши модели под номерами 1..${names.length}: ${names.map((n, i) => `${i + 1}) ${n}`).join('; ')}. Какая из наших моделей на первой картинке? Различай формат (3в1: футболка, шорты и штаны; 2в1: два предмета) и цвет. Если картинка не пижама, это другой товар или не уверен, верни 0. Ответ только JSON {"model": число, "confidence": от 0 до 1}.` },
    { type: 'image_url', image_url: { url: `data:${file.mime};base64,${b64(file.bytes)}`, detail: 'high' } },
  ];
  PAJAMA_PHOTOS.forEach((p) => content.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${p.b64}`, detail: 'low' } }));
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, temperature: 0, max_tokens: 40, response_format: { type: 'json_object' }, messages: [{ role: 'user', content }] }),
      signal: AbortSignal.timeout(25000),
    });
    const raw = await res.text();
    if (!res.ok) { await recordLlmUsage(model, null, openAiErrorCode(res.status, raw), 'model_vision'); return null; }
    const data = JSON.parse(raw);
    await recordLlmUsage(model, data?.usage, null, 'model_vision');
    return parseModelAnswer(String(data?.choices?.[0]?.message?.content ?? ''), names);
  } catch {
    return null;
  }
}

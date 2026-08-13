// Разбор скринов клиентов Алины (Telegram photo → OpenAI Vision).
// Если ключа нет / ошибка API — возвращаем ok:null → вызывающий код идёт как раньше.

export type ScreenStage =
  | 'ad'
  | 'product'
  | 'cart'
  | 'order'
  | 'pickup'
  | 'review'
  | 'other';

export type VisionResult = {
  /** true = скрин ок, false = нет, null = не смогли прочитать */
  ok: boolean | null;
  kind: ScreenStage;
  search_query: string | null;
  article: string | null;
  product_hint: string | null;
  price: string | null;
  pvz: string | null;
  delivery_date: string | null;
  has_our_product: boolean | null;
  competitors_count: number | null;
  notes: string;
  /** Короткая реплика клиенту, если ok=false */
  client_reply: string | null;
  via: 'ai' | 'none';
};

export async function downloadTelegramFile(
  botToken: string,
  fileId: string,
): Promise<{ bytes: Uint8Array; mime: string } | null> {
  try {
    const metaRes = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`,
      { signal: AbortSignal.timeout(15000) },
    );
    const meta = await metaRes.json().catch(() => null);
    const path = meta?.result?.file_path;
    if (!meta?.ok || !path) return null;
    const fileRes = await fetch(
      `https://api.telegram.org/file/bot${botToken}/${path}`,
      { signal: AbortSignal.timeout(30000) },
    );
    if (!fileRes.ok) return null;
    const buf = new Uint8Array(await fileRes.arrayBuffer());
    if (!buf.length || buf.length > 8_000_000) return null;
    const lower = String(path).toLowerCase();
    const mime = lower.endsWith('.png')
      ? 'image/png'
      : lower.endsWith('.webp')
      ? 'image/webp'
      : 'image/jpeg';
    return { bytes: buf, mime };
  } catch (e) {
    console.warn('[alina-vision] download', e);
    return null;
  }
}

function b64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s);
}

export async function analyzeAlinaScreenshot(opts: {
  imageBytes: Uint8Array;
  mime: string;
  stage: ScreenStage;
  expectKeyword?: string | null;
  expectProduct?: string | null;
  expectArticle?: string | null;
}): Promise<VisionResult> {
  const empty: VisionResult = {
    ok: null,
    kind: opts.stage,
    search_query: null,
    article: null,
    product_hint: null,
    price: null,
    pvz: null,
    delivery_date: null,
    has_our_product: null,
    competitors_count: null,
    notes: '',
    client_reply: null,
    via: 'none',
  };

  const apiKey = (Deno.env.get('OPENAI_API_KEY') ?? '').trim();
  if (!apiKey) return empty;

  const model = (Deno.env.get('OPENAI_VISION_MODEL') ||
    Deno.env.get('OPENAI_MODEL') ||
    'gpt-4o-mini').trim();
  const baseUrl = (Deno.env.get('OPENAI_BASE_URL') ?? 'https://api.openai.com/v1')
    .replace(/\/$/, '');

  const expect = [
    opts.expectKeyword ? `ожидаемый ключ поиска: «${opts.expectKeyword}»` : '',
    opts.expectProduct ? `наш товар: «${opts.expectProduct}»` : '',
    opts.expectArticle ? `наш артикул: ${opts.expectArticle}` : '',
  ].filter(Boolean).join('; ');

  const stageHint: Record<ScreenStage, string> = {
    ad: 'Это скрин объявления о раздаче/кэшбеке/бартере. Определи товар (фонарь/вырез, цвет) и артикул если есть.',
    product:
      'Скрин поиска WB/Ozon: строка запроса сверху + карточки. Нужен наш товар в выдаче и ключ в строке поиска.',
    cart: 'Скрин корзины: наш товар + конкуренты (2–3), желательно бренд в избранном.',
    order: 'Скрин оформленного заказа: цена, ПВЗ/город, дата получения.',
    pickup: 'Скрин получения / ПВЗ / статус «получен».',
    review: 'Черновик или опубликованный отзыв / фото товара / ШК.',
    other: 'Определи, что на скрине.',
  };

  const system = [
    'Ты помощник менеджера раздач Wildberries. Смотришь скриншот клиента.',
    'Ответь ТОЛЬКО JSON без markdown:',
    '{"ok":true|false,"kind":"ad|product|cart|order|pickup|review|other",',
    '"search_query":string|null,"article":string|null,"product_hint":string|null,',
    '"price":string|null,"pvz":string|null,"delivery_date":string|null,',
    '"has_our_product":true|false|null,"competitors_count":number|null,',
    '"notes":"кратко","client_reply":"короткая реплика клиенту на русском если ok=false, иначе null"}',
    'ok=true только если скрин подходит под этап. client_reply — как живой менеджер, 1 предложение.',
    stageHint[opts.stage],
    expect ? `Контекст: ${expect}` : '',
  ].filter(Boolean).join('\n');

  const dataUrl = `data:${opts.mime};base64,${b64(opts.imageBytes)}`;

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 400,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: [
              { type: 'text', text: `Этап: ${opts.stage}. Проверь скрин.` },
              { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(45000),
    });
    const raw = await res.text();
    if (!res.ok) {
      console.warn('[alina-vision] API', res.status, raw.slice(0, 240));
      return empty;
    }
    let data: { choices?: Array<{ message?: { content?: string } }> };
    try {
      data = JSON.parse(raw);
    } catch {
      return empty;
    }
    const content = String(data?.choices?.[0]?.message?.content ?? '').trim();
    if (!content) return empty;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content);
    } catch {
      return empty;
    }

    const okRaw = parsed.ok;
    const ok = typeof okRaw === 'boolean' ? okRaw : null;
    return {
      ok,
      kind: (String(parsed.kind || opts.stage) as ScreenStage) || opts.stage,
      search_query: parsed.search_query != null ? String(parsed.search_query) : null,
      article: parsed.article != null ? String(parsed.article).replace(/\D/g, '') || null : null,
      product_hint: parsed.product_hint != null ? String(parsed.product_hint) : null,
      price: parsed.price != null ? String(parsed.price) : null,
      pvz: parsed.pvz != null ? String(parsed.pvz) : null,
      delivery_date: parsed.delivery_date != null ? String(parsed.delivery_date) : null,
      has_our_product: typeof parsed.has_our_product === 'boolean'
        ? parsed.has_our_product
        : null,
      competitors_count: Number.isFinite(Number(parsed.competitors_count))
        ? Number(parsed.competitors_count)
        : null,
      notes: String(parsed.notes || '').slice(0, 400),
      client_reply: parsed.client_reply != null
        ? String(parsed.client_reply).slice(0, 280)
        : null,
      via: 'ai',
    };
  } catch (e) {
    console.warn('[alina-vision] fail', e);
    return empty;
  }
}

/** Эвристика: если vision сказал ок=null — не блокируем; если false — отклоняем. */
export function visionBlocks(v: VisionResult | null | undefined): boolean {
  return Boolean(v && v.via === 'ai' && v.ok === false);
}

export function visionRejectReply(v: VisionResult, fallback: string): string {
  return (v.client_reply || fallback).trim();
}

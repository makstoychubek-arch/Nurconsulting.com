// «Мозг» Алины: понимает свободный текст клиента и отвечает как живой менеджер.
// CRM-статусы и слоты по-прежнему решает state-machine; мозг — смысл + формулировка.

export type BrainAction =
  | 'reply_only' // просто ответить, статус не менять
  | 'pick_product' // выбрать товар из списка и открыть сделку
  | 'continue_flow' // пусть state-machine обработает как обычно
  | 'send_tz'
  | 'send_key'
  | 'close';

export type BrainResult = {
  action: BrainAction;
  reply: string | null;
  product_name: string | null;
  deal_type: 'cashback' | 'barter' | null;
  via: 'ai' | 'none';
};

export async function alinaBrain(opts: {
  text: string;
  hasPhoto: boolean;
  status: string;
  dealType?: string | null;
  productName?: string | null;
  keyword?: string | null;
  openProducts: string[];
  campaignOpen: boolean;
  slotsLeft?: number | null;
  cashbackPct?: number | null;
  orderDeadline?: string | null;
  knowledge?: string | null;
  visionNote?: string | null;
}): Promise<BrainResult> {
  const empty: BrainResult = {
    action: 'continue_flow',
    reply: null,
    product_name: null,
    deal_type: null,
    via: 'none',
  };

  const apiKey = (Deno.env.get('OPENAI_API_KEY') ?? '').trim();
  if (!apiKey) return empty;
  if (!opts.text.trim() && !opts.hasPhoto) return empty;

  const model = (Deno.env.get('ALINA_BRAIN_MODEL') ||
    Deno.env.get('OPENAI_MODEL') ||
    'gpt-4o-mini').trim();
  const baseUrl = (Deno.env.get('OPENAI_BASE_URL') ?? 'https://api.openai.com/v1')
    .replace(/\/$/, '');

  const products = opts.openProducts.filter(Boolean).slice(0, 12);
  const system = [
    'Ты менеджер раздач @Wildberries_OZON_barter (не бот «Алина»).',
    'Пишешь клиентам в Telegram: коротко, по-человечески, на «вы» или мягко, 1–3 предложения.',
    'Без лекций про устройство кэшбека/бартера. Без «как ИИ». Без канцелярита.',
    'Можно 1 эмодзи 🙌/✅/👍 максимум.',
    '',
    'Верни ТОЛЬКО JSON:',
    '{"action":"reply_only|pick_product|continue_flow|send_tz|send_key|close",',
    '"reply":"текст клиенту или null",',
    '"product_name":"точное имя из списка или null",',
    '"deal_type":"cashback|barter|null"}',
    '',
    'Правила action:',
    '- pick_product — клиент назвал/выбрал товар из списка (или цвет/модель однозначно).',
    '- reply_only — вопрос/сомнение/«сколько кэшбек», «как искать», «не нашла», болтовня; ответь по делу + мягко верни к шагу.',
    '- continue_flow — клиент явно на шаге воронки (скрин, реквизиты, ок/дальше) — текст reply можно null.',
    '- send_tz / send_key — просит ТЗ или ключ.',
    '- close — мест нет и клиент новый (редко).',
    '',
    'Факты (не выдумывай другое):',
    `статус диалога: ${opts.status}`,
    `сделка: ${opts.dealType || 'ещё не выбрана'}`,
    `товар клиента: ${opts.productName || '—'}`,
    `ключ: ${opts.keyword || '—'}`,
    `раздача открыта: ${opts.campaignOpen ? 'да' : 'нет'}, мест: ${opts.slotsLeft ?? '—'}`,
    `кэшбек: ${opts.cashbackPct ?? 70}%`,
    `срок заказа: ${opts.orderDeadline || '—'}`,
    `открытые объявления: ${products.join(' | ') || '—'}`,
    opts.knowledge ? `план:\n${opts.knowledge.slice(0, 900)}` : '',
    opts.visionNote ? `что увидели на последнем скрине: ${opts.visionNote}` : '',
    opts.hasPhoto ? 'клиент прислал фото/скрин' : '',
    '',
    'Если спрашивают условия кэшбека — коротко: % и «после выполнения ТЗ / 16 дней после получения», без простыни.',
    'Если не нашли товар — подскажи перепроверить ключ, сортировку «популярные», без артикула вслух если не просят.',
    'product_name бери ТОЛЬКО из списка открытых объявлений (или null).',
  ].filter(Boolean).join('\n');

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        max_tokens: 280,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: (opts.text || (opts.hasPhoto ? '[клиент прислал скрин]' : '')).slice(0, 1200),
          },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });
    const raw = await res.text();
    if (!res.ok) {
      console.warn('[alina-brain]', res.status, raw.slice(0, 200));
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

    const actionRaw = String(parsed.action || 'continue_flow');
    const allowed: BrainAction[] = [
      'reply_only',
      'pick_product',
      'continue_flow',
      'send_tz',
      'send_key',
      'close',
    ];
    const action = (allowed.includes(actionRaw as BrainAction)
      ? actionRaw
      : 'continue_flow') as BrainAction;

    let product_name = parsed.product_name != null
      ? String(parsed.product_name).trim()
      : null;
    if (product_name) {
      const hit = products.find((p) =>
        p.toLowerCase() === product_name!.toLowerCase() ||
        p.toLowerCase().includes(product_name!.toLowerCase()) ||
        product_name!.toLowerCase().includes(p.toLowerCase())
      );
      product_name = hit || null;
      if (!hit) {
        // модель выдумала — не открываем сделку по фейку
        if (action === 'pick_product') {
          return {
            action: 'reply_only',
            reply: parsed.reply != null
              ? String(parsed.reply).slice(0, 500)
              : 'Уточните, пожалуйста, какое объявление — название и цвет 🙌',
            product_name: null,
            deal_type: null,
            via: 'ai',
          };
        }
      }
    }

    let deal_type: 'cashback' | 'barter' | null = null;
    const dt = String(parsed.deal_type || '').toLowerCase();
    if (dt === 'cashback' || dt === 'barter') deal_type = dt;

    return {
      action,
      reply: parsed.reply != null ? String(parsed.reply).slice(0, 700) : null,
      product_name,
      deal_type,
      via: 'ai',
    };
  } catch (e) {
    console.warn('[alina-brain] fail', e);
    return empty;
  }
}

/** Когда звать мозг: вопросы, тупик, свободный текст не под regex. */
export function shouldUseBrain(opts: {
  text: string;
  status: string;
  hasPhoto: boolean;
  matchedProduct: boolean;
}): boolean {
  const t = opts.text.trim();
  if (!t && opts.hasPhoto) return false; // фото разбирает vision/CRM
  if (opts.matchedProduct) return false;

  if (
    /[?]|(сколько|как\b|когда|почему|зачем|можно ли|условия|кэшбек|кешбек|бартер|не\s*наш|не\s*нашл|не\s*вижу|подскаж|фильтр|размер|цвет|артикул|доступн|мест|актуальн|что\s+за|а\s+это)/i
      .test(t)
  ) {
    return true;
  }

  if (['new', 'ask_ad', 'ask_type', 'closed', 'done'].includes(opts.status)) {
    // свободный текст на входе / после — мозг лучше regex
    if (t.length >= 2 && !/^(стоп|пауза|продолжить|start|тз|ключ)$/i.test(t)) {
      return true;
    }
  }

  // mid-flow: текст есть, но не похоже на ожидаемый шаг
  if (
    [
      'key_sent',
      'wait_product',
      'wait_cart',
      'wait_order',
      'wait_bank',
      'wait_pickup',
      'wait_review',
      'wait_reels',
      'tz_sent',
    ].includes(opts.status) &&
    t.length >= 4 &&
    !opts.hasPhoto
  ) {
    return true;
  }

  return false;
}

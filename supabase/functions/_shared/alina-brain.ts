// «Мозг» Алины: понимает свободный текст клиента и отвечает как живой менеджер.
// CRM-статусы и слоты по-прежнему решает state-machine; мозг — смысл + формулировка.
import { secretOrEnv } from './integration-secrets.ts';
import { pickExamples } from './alina-examples.ts';
import { llmBudgetOk, openAiErrorCode, recordLlmUsage } from './llm-usage.ts';

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
  /** Свободные места по моделям и датам и брони клиента (режим строк). Это единственный источник фактов о местах. */
  placesFact?: string | null;
  /** Последние сообщения диалога (клиент, менеджер, Алина), чтобы отвечать по контексту. */
  history?: string | null;
}): Promise<BrainResult> {
  const empty: BrainResult = {
    action: 'continue_flow',
    reply: null,
    product_name: null,
    deal_type: null,
    via: 'none',
  };

  const apiKey = await secretOrEnv('OPENAI_API_KEY');
  if (!apiKey) return empty;
  if (!opts.text.trim() && !opts.hasPhoto) return empty;
  if (!await llmBudgetOk()) return empty; // бюджет месяца израсходован: отвечаем по шаблонам

  const model = (Deno.env.get('ALINA_BRAIN_MODEL') ||
    Deno.env.get('OPENAI_MODEL') ||
    'gpt-4o-mini').trim();
  const baseUrl = (Deno.env.get('OPENAI_BASE_URL') ?? 'https://api.openai.com/v1')
    .replace(/\/$/, '');

  const products = opts.openProducts.filter(Boolean).slice(0, 12);
  const system = [
    'Ты менеджер раздач @Wildberries_OZON_barter (не бот «Алина»).',
    'Пишешь клиентам в Telegram: очень коротко, по-человечески, на «вы», обычно одна фраза до 12 слов, максимум две. Без вводных и извинений.',
    'Не проси клиента писать слово «да» и не предлагай «скажите да, я сделаю»: это выдаёт бота. Задай обычный вопрос или ответь по делу.',
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
    `открытые модели сегодня: ${products.join(' | ') || '—'}`,
    opts.knowledge ? `план:\n${opts.knowledge.slice(0, 900)}` : '',
    opts.visionNote ? `что увидели на последнем скрине: ${opts.visionNote}` : '',
    opts.hasPhoto ? 'клиент прислал фото/скрин' : '',
    opts.history ? `Последние сообщения диалога (контекст; не повторяй то, что уже сказано; если клиент отвечает на вопрос менеджера, поблагодари и иди дальше):\n${opts.history.slice(-1800)}` : '',
    opts.placesFact ? `МЕСТА (единственный источник, другого не выдумывай):\n${opts.placesFact}` : '',
    '',
    'Факты о товаре (из карточек и фото владельца, других фактов о товаре не выдумывай; чего здесь нет, говори «уточню у менеджера»):',
    '- Пижама 2в1: футболка оверсайз и шорты на мягкой резинке с воланом по низу. Цвета: шоколадный, бордовый, белый.',
    '- Пижама 3в1: один комплект, три образа: со штанами (для зимы), с шортами (для лета), три вещи по цене одной пижамы (футболка, шорты, брюки). Цвета: шоколадный, бордовый, молочный, розовый меланж «лапша вишня».',
    '- Формат сейчас только бартер, кэшбека нет. На вопрос про кэш или кэшбек отвечай, что кэшбека нет, формат бартер, и спроси, какая модель интересует.',
    '- Участвуют только блогеры из России: заказ на пункт выдачи в России, перевод на российский банк через СБП. Если клиент не из России, вежливо скажи, что сотрудничаем только с блогерами из России.',
    '- Условия: заказ нужно сделать сегодня до 22:00 МСК, оплату переводим через СБП через 3 дня после заказа (если успели до 22:00 МСК). Товар не возвращать. Поиск на Wildberries (WB), по ключу из сообщения. Бренд не называем, фильтры шлёт система.',
    '- Пример фото отзыва и правила отзыва: отзыв согласуем с менеджером (дата, фото, текст), сразу не оставлять; если нужного нет в фактах, говори «уточню у менеджера».',
    '- Состав: 100% хлопок, трикотаж. Размеры 40–58, пижама идёт в размер.',
    '',
    'Жёсткие правила:',
    '- Менеджер пишет клиенту первым; клиент отвечает, ты сверяешь логин, модель, цвет и дату.',
    '- Сообщай об отправке, записи и оплате только после подтверждения соответствующего действия системой. Ничего не обещай сама.',
    '- Места и брони записывает только система. Ты можешь сказать, что места есть или нет, ТОЛЬКО по блоку МЕСТА. Не обещай бронь сама: если нужно забронировать, action=continue_flow.',
    '- Если ответ зависит от менеджера (деньги, исключения, споры), скажи «уточню у менеджера и вернусь» и не придумывай.',
    '- Бренд никогда не называй. На вопрос про бренд отвечай: бренд называть не нужно, клиент присылает скрин поиска по ключу, а мы сами по фото определяем, наш ли это товар.',
    '- Размер: пижама идёт в размер, не маломерит и не большемерит. Если клиент хочет посвободнее, советуй взять на размер побольше. Ответ про размер, например: «Они в размер, если хотите чуть свободнее, то берите побольше на размер».',
    '- Клиент мог написать с опечатками или другими словами: понимай по смыслу, как в примерах ниже.',
    '',
    'Образцы тона и смысла из реальных чатов (не копируй дословно, подставляй факты из блока выше):',
    ...pickExamples(opts.text, 14).map(([q, a]) => `Клиент: ${q}\nАлина: ${a}`),
    '',
    'ВАЖНО по режиму: если в плане «только кэшбек» — на вопрос про бартер НЕ говори что бартер есть. Скажи что сейчас только кэшбек.',
    'Приветствие без «чем могу помочь». Спрашивай модель и расцветку.',
    'Если просят цвет которого нет в открытых сегодня — скажи что нет и предложи из списка открытых.',
    'Если спрашивают условия кэшбека — коротко: % и «после выполнения ТЗ / 16 дней после получения», без простыни.',
    'Если не нашли товар — подскажи перепроверить ключ, сортировку «популярные», без артикула вслух если не просят.',
    'Если просят фото товара — НЕ говори «не можем». action=continue_flow (фото шлёт система отдельно) или reply_only «сейчас пришлю».',
    'Артикул клиенту НЕ называй никогда. По фото искать нельзя — только по ключу.',
    'Ты НЕ видишь картинки и НЕ можешь подтвердить «это наш товар». На «она?», «это ваш?», «точно ваш?» ответ один: «Сейчас уточню у менеджера». Не говори «да, наш».',
    'Если клиент нашёл или заказал не тот товар: коротко извинись («Просим поискать ещё, извините за ошибку») и дай ориентир по цене: наша цена от 1500 до 4000 ₽. Артикул не называй.',
    'Если «не могу найти» — action=continue_flow (система спросит про фильтры). Бренд в фильтрах не давать.',
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
      await recordLlmUsage(model, null, openAiErrorCode(res.status, raw));
      return empty;
    }
    let data: { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
    try {
      data = JSON.parse(raw);
    } catch {
      return empty;
    }
    await recordLlmUsage(model, data?.usage);
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
            reply: (parsed.reply != null && !/^\s*(null|none|undefined|nan|n\/a|-)?\s*$/i.test(String(parsed.reply)))
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
      reply: safeProductClaim((parsed.reply != null && !/^\s*(null|none|undefined|nan|n\/a|-)?\s*$/i.test(String(parsed.reply))) ? String(parsed.reply).slice(0, 700) : null),
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
    /[?]|(сколько|как(?=$|[\s,.:;!?])|когда|почему|зачем|можно ли|условия|кэшбек|кешбек|бартер|не\s*наш|не\s*нашл|не\s*вижу|подскаж|фильтр|размер|цвет|артикул|доступн|мест|актуальн|что\s+за|а\s+это)/i
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


/** Мозг не видит картинки: «да, это наш товар» подтверждает только скрин-проверка (vision), иначе передаём менеджеру. */
export function safeProductClaim(reply: string | null): string | null {
  if (!reply) return reply;
  if (/(^|[\s,.!])(да,?\s*)?(это\s+)?наш(а|е|и)?\s+(товар|пижам)|да,?\s+наш[\s.!,]|(^|\s)наш\s+товар/i.test(reply) && !/не\s+наш/i.test(reply)) {
    return 'Сейчас уточню у менеджера и вернусь 🙌';
  }
  return reply;
}

// Генерация ответа продавца на отзыв WB (OpenAI).
//
// Secrets:
//   OPENAI_API_KEY        — ключ OpenAI
//   OPENAI_REVIEW_MODEL   — модель (см. REVIEW_MODEL_OPTIONS ниже)
//   OPENAI_BASE_URL       — по умолчанию https://api.openai.com/v1
//   REVIEW_REPLY_MAX_CHARS — лимит символов ответа (по умолчанию 500)
export const REVIEW_MODEL_OPTIONS = [
  {
    id: 'gpt-4o-mini',
    label: 'GPT-4o mini',
    note: 'Дёшево, быстро — для потока отзывов'
  },
  {
    id: 'gpt-4o',
    label: 'GPT-4o',
    note: 'Умнее, лучше русский и тон — рекомендуем'
  },
  {
    id: 'gpt-4.1-mini',
    label: 'GPT-4.1 mini',
    note: 'Новее mini, чуть лучше качество'
  },
  {
    id: 'gpt-4.1',
    label: 'GPT-4.1',
    note: 'Максимум качества для сложных негативных отзывов'
  }
];
/** Смысл отзыва важнее звёзд: 5★ + «большая, синтетика» = негатив */ export function detectReviewSentiment(ctx) {
  const blob = [
    ctx.text,
    ctx.pros,
    ctx.cons
  ].filter(Boolean).join(' ').toLowerCase();
  const hasText = blob.replace(/[—\-().★\s]/g, '').length > 3 && !/^только оценка/.test(blob);
  if (!hasText) {
    if (ctx.rating <= 2) return 'negative';
    if (ctx.rating === 3) return 'neutral';
    return 'positive';
  }
  const negative = [
    /не понрав/,
    /разочар/,
    /плох/,
    /ужас/,
    /брак/,
    /верну/,
    /возврат/,
    /больш(?:ая|ой|ие)/,
    /маломер/,
    /не подош/,
    /не сел/,
    /не села/,
    /синтетик/,
    /деш[её]в/,
    /жаль/,
    /некач/,
    /обман/,
    /ожидан/,
    /минус/,
    /хуже/,
    /кошмар/,
    /отказ/,
    /не совет/
  ];
  const positive = [
    /понрав/,
    /отличн/,
    /супер/,
    /рекоменд/,
    /качеств/,
    /спасиб/,
    /класс/,
    /идеальн/,
    /довол/,
    /красив/,
    /удобн/,
    /мягк/,
    /прекрас/
  ];
  let neg = ctx.cons?.trim() ? 2 : 0;
  let pos = ctx.pros?.trim() ? 2 : 0;
  for (const p of negative)if (p.test(blob)) neg++;
  for (const p of positive)if (p.test(blob)) pos++;
  if (ctx.orderStatus && /return|cancel|refusal|reject/i.test(ctx.orderStatus)) neg += 2;
  if (neg > pos) return 'negative';
  if (pos > neg && ctx.rating >= 4) return 'positive';
  if (ctx.rating <= 3) return 'negative';
  if (ctx.rating === 4 && neg > 0) return 'neutral';
  return pos > 0 ? 'positive' : ctx.rating >= 4 ? 'positive' : 'neutral';
}
function sentimentLabel(s) {
  if (s === 'negative') return 'негативный (по смыслу текста)';
  if (s === 'neutral') return 'нейтральный / смешанный';
  return 'позитивный';
}
export async function generateReviewReply(ctx) {
  const apiKey = (Deno.env.get('OPENAI_API_KEY') ?? '').trim();
  const model = (Deno.env.get('OPENAI_REVIEW_MODEL') ?? 'gpt-4o').trim();
  const maxChars = Number(Deno.env.get('REVIEW_REPLY_MAX_CHARS')) || 500;
  if (!apiKey) {
    return {
      reply: templateReply(ctx, maxChars),
      model: 'template',
      via: 'template'
    };
  }
  const sentiment = detectReviewSentiment(ctx);
  const system = [
    'Ты менеджер магазина на Wildberries. Пишешь официальный ответ продавца на отзыв покупателя.',
    'Правила:',
    '— Только русский, без «Уважаемый покупатель» и без подписи магазина.',
    '— ОБЯЗАТЕЛЬНО начни ответ с имени покупателя (только имя, без фамилии): «Елена, спасибо…», «Николай, благодарим…».',
    '— Если имени нет — начни с «Здравствуйте,».',
    '— 2–4 коротких предложения, живой но деловой тон.',
    '— ГЛАВНОЕ: ориентируйся на СМЫСЛ отзыва (текст, pros, cons) и поле «Тон», а НЕ только на звёзды.',
    '— Если 5★, но текст негативный — сожаление, эмпатия, готовность помочь; НЕ пиши «рады что понравилось».',
    '— Если отзыв без текста (только оценка) — кратко поблагодари за оценку N★.',
    '— Если статус заказа «Отказ/возврат» — учитывай, что товар не оставили; тон сдержанный, без «ждём снова».',
    '— Упомяни суть отзыва (за что благодаришь или что исправите).',
    '— Если есть pros/cons — отреагируй на них.',
    '— Позитивный тон: благодарность, приглашение снова (если не было отказа).',
    '— Негативный тон: извинение, эмпатия, предложение написать в чат продавца на WB.',
    '— Без эмодзи, без markdown, без кавычек вокруг всего ответа.',
    `— Не больше ${maxChars} символов.`
  ].join('\n');
  const parts = [
    `Кабинет: ${ctx.cabinetName}`,
    `Товар: ${ctx.productName}${ctx.nmId ? ` (арт. ${ctx.nmId})` : ''}`,
    ctx.brandName ? `Бренд: ${ctx.brandName}` : '',
    `Оценка: ${ctx.rating}/5`,
    `Тон (по смыслу): ${sentimentLabel(sentiment)}`,
    ctx.orderStatus ? `Статус заказа WB: ${ctx.orderStatus}` : '',
    ctx.userName ? `Покупатель: ${ctx.userName}` : '',
    ctx.text ? `Текст: ${ctx.text}` : 'Текст: (пусто, только оценка)',
    ctx.pros ? `Плюсы: ${ctx.pros}` : '',
    ctx.cons ? `Минусы: ${ctx.cons}` : ''
  ].filter(Boolean);
  try {
    const baseUrl = (Deno.env.get('OPENAI_BASE_URL') ?? 'https://api.openai.com/v1').replace(/\/$/, '');
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: 280,
        messages: [
          {
            role: 'system',
            content: system
          },
          {
            role: 'user',
            content: parts.join('\n')
          }
        ]
      }),
      signal: AbortSignal.timeout(25000)
    });
    const raw = await res.text();
    if (!res.ok) {
      console.warn('[ai-review-reply] API error:', res.status, raw.slice(0, 200));
      return {
        reply: templateReply(ctx, maxChars),
        model: 'template',
        via: 'template'
      };
    }
    const data = JSON.parse(raw);
    const text = String(data?.choices?.[0]?.message?.content ?? '').trim();
    if (!text) return {
      reply: templateReply(ctx, maxChars),
      model: 'template',
      via: 'template'
    };
    return {
      reply: ensureReplyStartsWithName(clamp(text.replace(/^["']|["']$/g, ''), maxChars), ctx.userName),
      model,
      via: 'ai'
    };
  } catch (e) {
    console.warn('[ai-review-reply] failed:', String(e));
    return {
      reply: templateReply(ctx, maxChars),
      model: 'template',
      via: 'template'
    };
  }
}
function templateReply(ctx, max) {
  const sentiment = detectReviewSentiment(ctx);
  const refused = ctx.orderStatus && /return|cancel|refusal|reject/i.test(ctx.orderStatus);
  const emptyText = !ctx.text?.trim() && !ctx.pros?.trim() && !ctx.cons?.trim();
  if (emptyText) {
    if (ctx.rating >= 4) {
      return clamp(ensureReplyStartsWithName(`Спасибо за оценку ${ctx.rating}★! Будем рады видеть вас снова.`, ctx.userName), max);
    }
    return clamp(ensureReplyStartsWithName('Спасибо за обратную связь. Если что-то не устроило — напишите в чат продавца на WB, поможем.', ctx.userName), max);
  }
  if (sentiment === 'negative' || refused) {
    return clamp(ensureReplyStartsWithName('Жаль, что покупка не оправдала ожиданий. Приносим извинения — напишите, пожалуйста, в чат продавца на WB, постараемся помочь.', ctx.userName), max);
  }
  if (sentiment === 'neutral') {
    return clamp(ensureReplyStartsWithName('Спасибо за отзыв! Учтём ваши замечания и постараемся стать лучше.', ctx.userName), max);
  }
  return clamp(ensureReplyStartsWithName('Спасибо за отзыв! Рады, что вам понравился товар. Будем ждать вас снова.', ctx.userName), max);
}
/** Первое имя из «Елена» / «Елена П.» */ export function formatBuyerFirstName(raw) {
  if (!raw?.trim()) return '';
  return raw.trim().split(/\s+/)[0].replace(/[.,!?]+$/, '');
}
/** «Елена, спасибо…» — если модель не начала с имени */ export function ensureReplyStartsWithName(reply, userName) {
  const first = formatBuyerFirstName(userName);
  const trimmed = reply.trim();
  if (!first) {
    if (/^здравствуйте[,!]/i.test(trimmed)) return trimmed;
    return `Здравствуйте, ${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`;
  }
  if (new RegExp(`^${first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[,!\\s]`, 'i').test(trimmed)) {
    return trimmed;
  }
  const rest = trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
  return `${first}, ${rest}`;
}
function clamp(s, max) {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const dot = cut.lastIndexOf('. ');
  return (dot > max * 0.5 ? cut.slice(0, dot + 1) : cut).trimEnd();
}

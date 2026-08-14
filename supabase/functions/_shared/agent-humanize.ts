/**
 * Пост-обработка ответов: убрать канцелярит и поддакивание,
 * чтобы в чате звучало как живой человек.
 */

const BANNED_OPENERS = [
  /^(полностью\s+соглас[а-яё]+\.?)\s*/iu,
  /^(как\s+(сказал[аи]|отметил[аи])\s+\S+[.,]?\s*)/iu,
  /^(коллега\s+передал[аи][:.]?\s*)/iu,
  /^(принято\s+к\s+сведению[.!]?\s*)/iu,
  /^(чем\s+могу\s+помочь[?.!]?\s*)/iu,
  /^(я\s+(как\s+)?(ии|модель|ассистент|бот)[^.]*[.!]?\s*)/iu,
  /^(с\s+удовольствием\s+(помогу|подскажу)[.!]?\s*)/iu,
  /^(разумеется[,.]?\s*)/iu,
  /^(безусловно[,.]?\s*)/iu,
  /^(в\s+данном\s+случае[,.]?\s*)/iu,
  /^(хочу\s+отметить[,.]?\s*)/iu,
  /^(следует\s+отметить[,.]?\s*)/iu,
  /^(ок[,.]?\s*понял[аи]?[.!]?\s*)/iu,
  /^(спасибо\s+за\s+(информацию|уточнение)[.!]?\s*)/iu,
];

const BANNED_LINES = [
  /^полностью соглас/iu,
  /^как (уже )?сказал/iu,
  /^коллега передал/iu,
  /^принято к сведению/iu,
  /^чем могу помочь/iu,
  /^я (ии|модель|языковая|нейросеть|бот)/iu,
  /^надеюсь[, ]+это помогло/iu,
  /^если есть ещё вопросы/iu,
  /^обращайтесь[, ]+если/iu,
];

/** Убрать шаблонные зачины/строки; вернуть очищенный текст. */
export function humanizeAgentReply(raw: string): string {
  let t = String(raw || '').replace(/\r/g, '').trim();
  if (!t) return t;

  for (const re of BANNED_OPENERS) {
    t = t.replace(re, '');
  }

  const lines = t.split('\n').map((l) => l.trimEnd());
  const kept = lines.filter((l) => {
    const s = l.trim();
    if (!s) return true;
    return !BANNED_LINES.some((re) => re.test(s));
  });

  t = kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  // слишком длинные «эссе» в тимчате — обрежем мягко по строкам
  const maxLines = 8;
  const parts = t.split('\n');
  if (parts.length > maxLines) {
    t = parts.slice(0, maxLines).join('\n').trim();
  }

  // пусто после чистки — короткая живая заглушка
  if (!t) t = 'ага';
  return t.slice(0, 3500);
}

/** Есть ли в тексте ссылка / «посмотрите это». */
export function looksLikeSharedLink(text: string): boolean {
  const t = String(text || '');
  if (/https?:\/\/\S+/i.test(t)) return true;
  if (/t\.me\/\S+/i.test(t)) return true;
  return /(глянь|смотрите|смотри|кинул[аи]?|скинул[аи]?)\s+(ссылк|новост|стать|пост)/i.test(t);
}

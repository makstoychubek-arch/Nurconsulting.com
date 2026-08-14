/**
 * Пост-обработка: вычистить AI/бот-теллы, чтобы ответ звучал как человек в ТГ.
 */

import { maybeValencePrefix } from './agent-voice.ts';

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
  /^(ок[,.]\s+)/iu,
  /^(смотрю[,.!]?\s*)/iu,
  /^(глянул[аи]?[,.!]?\s*)/iu,
  /^(принято[.!]?\s+)/iu,
  /^(конечно[,.]?\s*)/iu,
  /^(отличный\s+вопрос[.!]?\s*)/iu,
  /^(давайте\s+(разберём|посмотрим|проверим)[,.!]?\s*)/iu,
  /^(важно\s+отметить[,.!]?\s*)/iu,
  /^(стоит\s+(отметить|подчеркнуть)[,.!]?\s*)/iu,
  /^(таким\s+образом[,.!]?\s*)/iu,
  /^(подводя\s+итог[,.!]?\s*)/iu,
  /^(итого[,.!]?\s*[:：]?\s*)/iu,
  /^(вот\s+что\s+я\s+(нашёл|нашла|вижу)[,.!]?\s*)/iu,
  /^(конечно[!.,]?\s*)/iu,
  /^(certainly[!.,]?\s*)/iu,
  /^(sure[!.,]?\s*)/iu,
  /^(i'?d\s+be\s+happy\s+to[.!]?\s*)/iu,
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
  /^если будут вопросы/iu,
  /^обращайтесь[, ]+если/iu,
  /^дайте знать[, ]+если/iu,
  /^с удовольствием/iu,
  /^давайте разбер/iu,
  /^подводя итог/iu,
  /^таким образом/iu,
];

const BANNED_PHRASES = [
  /как\s+(искусственный\s+интеллект|языковая\s+модель|ии-?ассистент)/giu,
  /я\s+не\s+могу\s+чувствовать/giu,
  /в\s+качестве\s+ассистента/giu,
  /надеюсь[, ]+это\s+поможет[^.!?\n]*[.!?]?/giu,
  /если\s+(у\s+вас\s+)?(есть|будут)\s+(ещё\s+)?вопросы[^.!?\n]*[.!?]?/giu,
  /не\s+стесняйтесь\s+(спрашивать|обращаться)[^.!?\n]*[.!?]?/giu,
  /дайте\s+знать[, ]+если[^.!?\n]*[.!?]?/giu,
];

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(?<!\w)\*([^*\n]+)\*(?!\w)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^>\s?/gm, '')
    .replace(/^[-•]\s+/gm, '')
    .replace(/^\d+[.)]\s+/gm, '')
    .replace(/\s+—\s+/g, ' — ')
    .replace(/—/g, '—');
}

function limitEmojis(text: string, max = 1): string {
  let n = 0;
  return text.replace(/\p{Extended_Pictographic}/gu, (m) => {
    n += 1;
    return n <= max ? m : '';
  }).replace(/[ \t]{2,}/g, ' ');
}

/** Убрать шаблонные зачины/строки/markdown; вернуть очищенный текст. */
export function humanizeAgentReply(raw: string, opts?: { valence?: boolean }): string {
  let t = String(raw || '').replace(/\r/g, '').trim();
  if (!t) return t;

  t = stripMarkdown(t);

  for (const re of BANNED_OPENERS) {
    t = t.replace(re, '');
  }
  for (const re of BANNED_PHRASES) {
    t = t.replace(re, '');
  }

  const lines = t.split('\n').map((l) => l.trimEnd());
  const kept = lines.filter((l) => {
    const s = l.trim();
    if (!s) return true;
    return !BANNED_LINES.some((re) => re.test(s));
  });

  t = kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  t = limitEmojis(t, 1);

  // эссе в тимчате — мягко режем
  const maxLines = 6;
  const parts = t.split('\n');
  if (parts.length > maxLines) {
    t = parts.slice(0, maxLines).join('\n').trim();
  }

  if (!t) t = 'ага';

  if (opts?.valence !== false) {
    t = maybeValencePrefix(t);
  }

  return t.slice(0, 2200);
}

/** Есть ли в тексте ссылка / «посмотрите это». */
export function looksLikeSharedLink(text: string): boolean {
  const t = String(text || '');
  if (/https?:\/\/\S+/i.test(t)) return true;
  if (/t\.me\/\S+/i.test(t)) return true;
  return /(глянь|смотрите|смотри|кинул[аи]?|скинул[аи]?)\s+(ссылк|новост|стать|пост)/i.test(t);
}

/**
 * Короткие человеческие реакции без LLM — как в живом чате.
 * Agent-distinct ack + optional Telegram reaction (👍/🔥/👀).
 */

import { pick } from './agent-voice.ts';

/** «спасибо» / «ок» / «понял» без задачи — короткий живой ack. */
export function isShortSocialAck(text: string): boolean {
  const t = String(text || '')
    .replace(/@\w+/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!t || t.length > 40) return false;
  return /^(спасибо|спс|благодарю|пасиб|ок|ok|окей|понял[аи]?|ясно|супер|класс|норм|отлично|хорошо|ага|угу|йо)$/i
    .test(t) ||
    /^(спасибо|спс|ок|понял[аи]?|ясно)\s+(всем|команде|саул[еэ]|амина|антон|алина|муха|карина)?$/i
      .test(t);
}

export function shortSocialAckReply(agent: string): string {
  return planSocialAck(agent, 'ок').text;
}

export type SocialAckPlan = {
  text: string;
  /** Telegram reaction emoji на сообщение владельца */
  reactionEmoji?: string;
  /** микро-задержка перед ответом (мс) */
  delayMs: number;
};

/** План ack: свой голос агента + иногда реакция вместо/вместе с текстом. */
export function planSocialAck(agent: string, userText: string): SocialAckPlan {
  const t = String(userText || '').toLowerCase();
  const thanks = /спасибо|спс|благодар|пасиб/i.test(t);
  const positive = /супер|класс|отлично|норм|хорошо/i.test(t);

  const byAgent: Record<string, string[]> = {
    karina: thanks
      ? ['ага', 'на связи', 'есть', 'ок', 'угу']
      : ['ага', 'ок', 'есть', 'поняла', 'угу', 'норм', 'ща'],
    saule: thanks
      ? ['ага', 'ок', 'есть', 'угу']
      : ['ага', 'ок', 'есть', 'угу', 'хорошо', 'гляну если что'],
    amina: thanks
      ? ['ок', 'ага', 'есть']
      : ['ок', 'ага', 'есть', 'угу', 'на месте'],
    anton: thanks
      ? ['ок', 'ага', 'угу']
      : ['ок', 'ага', 'угу', 'есть', 'принято'],
    alina: thanks
      ? ['ага', 'ок', 'есть']
      : ['ага', 'ок', 'есть', 'хорошо', 'на связи'],
    muha: thanks
      ? ['ок', 'ага', 'йо']
      : ['ок', 'ага', 'есть', 'йо', 'норм'],
  };

  const text = pick(byAgent[agent] || ['ага', 'ок', 'есть']);

  let reactionEmoji: string | undefined;
  if (thanks) {
    reactionEmoji = pick(['👍', '🔥', '❤']);
  } else if (positive) {
    reactionEmoji = Math.random() < 0.7 ? pick(['👍', '🔥', '👀']) : undefined;
  } else if (Math.random() < 0.5) {
    reactionEmoji = pick(['👍', '👀']);
  }

  // иногда только реакция + очень короткий текст; иногда чуть дольше «печатает»
  const delayMs = thanks
    ? 220 + Math.floor(Math.random() * 480)
    : 320 + Math.floor(Math.random() * 900);

  return { text, reactionEmoji, delayMs };
}

/** Просьба «короче» / «без воды». */
export function wantsShorterStyle(text: string): boolean {
  return /короч[её]|без\s+воды|тезис|в\s+двух\s+словах|кратко|коротко\s+только/i
    .test(String(text || ''));
}

export function shorterStyleHint(): string {
  return 'Владелец просит КОРОЧЕ: максимум 1–2 строки, только суть, без вступлений.';
}

/** Дешёвый «факт» для name-ping без холодного WB — ощущение присутствия. */
export function cheapNamePingFact(agent: string): string | undefined {
  if (Math.random() > 0.42) return undefined;
  const byAgent: Record<string, string[]> = {
    karina: [
      'Команда на месте',
      'Могу сразу развести по зоне',
    ],
    saule: [
      'Отчёты по кабинетам под рукой',
      'Могу сразу по заказам/выкупам',
    ],
    amina: [
      'РК по кабинетам вижу',
      'Могу список или старт/паузу',
    ],
    anton: [
      'FBS/склады на связи',
      'Кидай кабинет — гляну остаток',
    ],
    alina: [
      'Таблица раздач открыта',
      'Слоты/клиенты — на месте',
    ],
    muha: [
      'Готов к ТЗ на кадр',
      'Визуал — кидай коротко',
    ],
  };
  const list = byAgent[agent];
  if (!list?.length) return undefined;
  return pick(list);
}

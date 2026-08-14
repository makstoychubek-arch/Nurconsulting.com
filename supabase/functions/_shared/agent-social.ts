/**
 * Короткие человеческие реакции без LLM — как в живом чате.
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
  const byAgent: Record<string, string[]> = {
    karina: ['ага', 'ок', 'есть', 'поняла', 'угу', 'норм'],
    saule: ['ага', 'ок', 'есть', 'угу', 'хорошо'],
    amina: ['ок', 'ага', 'есть', 'угу'],
    anton: ['ок', 'ага', 'угу', 'есть'],
    alina: ['ага', 'ок', 'есть', 'хорошо'],
    muha: ['ок', 'ага', 'есть', 'йо'],
  };
  return pick(byAgent[agent] || ['ага', 'ок', 'есть']);
}

/** Просьба «короче» / «без воды». */
export function wantsShorterStyle(text: string): boolean {
  return /короч[её]|без\s+воды|тезис|в\s+двух\s+словах|кратко|коротко\s+только/i
    .test(String(text || ''));
}

export function shorterStyleHint(): string {
  return 'Владелец просит КОРОЧЕ: максимум 1–2 строки, только суть, без вступлений.';
}

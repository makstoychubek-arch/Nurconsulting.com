/**
 * Разбивка ответа на несколько пузырей Telegram — как пишут люди,
 * а не одна «простыня» от ассистента.
 */

import { isStructuredAgentReport } from './agent-humanize.ts';

/** Разрезать текст на 1–3 коротких сообщения. */
export function splitHumanBubbles(text: string, maxBubbles = 3): string[] {
  const t = String(text || '').replace(/\r/g, '').trim();
  if (!t) return [];

  // сводка конкурентов / топ-3 — одним сообщением (иначе хвост с топом отрезается)
  if (isStructuredAgentReport(t) && t.length <= 3900) {
    return [t];
  }

  let parts = t.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);

  // одна простыня с переносами — режем по строкам, если длинно
  if (parts.length === 1 && t.includes('\n') && t.length >= 70) {
    parts = t.split('\n').map((s) => s.trim()).filter(Boolean);
  }

  // слишком мелко дробить короткие ответы не надо
  if (parts.length <= 1) return [t];

  if (parts.length > maxBubbles) {
    const head = parts.slice(0, maxBubbles - 1);
    const rest = parts.slice(maxBubbles - 1).join('\n');
    parts = [...head, rest];
  }

  // пузырь не длиннее ~420 символов — иначе дорежем хвост в следующий
  const out: string[] = [];
  for (const p of parts) {
    if (p.length <= 420 || out.length >= maxBubbles - 1) {
      out.push(p);
      continue;
    }
    const cut = p.slice(0, 400);
    const sp = cut.lastIndexOf(' ');
    out.push((sp > 120 ? cut.slice(0, sp) : cut).trim());
    const rem = p.slice(sp > 120 ? sp : 400).trim();
    if (rem) out.push(rem);
  }

  // никогда не отбрасываем хвост: лишнее склеиваем в последний пузырь
  if (out.length > maxBubbles) {
    const head = out.slice(0, maxBubbles - 1);
    const rest = out.slice(maxBubbles - 1).join('\n').trim();
    return [...head, rest].filter(Boolean);
  }
  return out.filter(Boolean);
}

/** Задержка «печатает эту строку» ~ по длине (cps + jitter). */
export function bubbleTypeDelayMs(len: number): number {
  const cps = 11 + Math.random() * 7;
  const jitter = 220 + Math.floor(Math.random() * 650);
  return Math.min(4000, Math.max(320, Math.floor((Math.max(1, len) / cps) * 1000) + jitter));
}

/** Пауза между пузырями одного человека. */
export function interBubbleDelayMs(): number {
  return 480 + Math.floor(Math.random() * 1500);
}

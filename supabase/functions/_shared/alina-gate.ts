/**
 * Входные правила Алины до основного сценария: часы работы и темы, которые уходят менеджеру.
 * Чистая логика без сети и базы: время, настройки и признак «уже отвечала вне часов» передаются снаружи.
 */

export type GateSettings = {
  hoursOn: boolean;
  hoursFrom: string; // «09:00»
  hoursTo: string; // «22:00»
  offHoursText: string; // с подстановками {от} и {до}
  topicsOff: string[]; // выключенные темы
  managerGroup: number; // 0 = группа по умолчанию (задаёт вызывающий код)
};

export type Topic = { id: string; label: string; re: RegExp; question: string };

/** Темы, по которым Алина не отвечает сама, а спрашивает менеджера. Порядок важен: первая подошедшая выигрывает. */
export const ALINA_TOPICS: Topic[] = [
  { id: 'other_item', label: 'Заказал другой вариант', re: /(?:не тот|другой) артикул|заказал[аи]? не ту модель/i, question: 'Клиент заказал другой вариант. Можно ли принять заказ или нужна замена?' },
  { id: 'payout_missing', label: 'Выплата не пришла', re: /(?:не приш(?:[её]л|ла|ло|ли)|задержал[аи]?ся).{0,24}(?:перевод|выплат|кэш|кеш|денег|деньги)|(?:перевод|выплат|кэш|кеш|деньги).{0,24}не приш(?:[её]л|ла|ло|ли)/i, question: 'Клиент сообщает, что выплата не поступила. Проверьте статус перевода.' },
  { id: 'payout_when', label: 'Когда выплата', re: /когда.{0,32}(?:перевед|выплат|поступят деньги|придут деньги)|(?:через сколько|как долго).{0,24}(?:выплат|перевод|ждать деньги)/i, question: 'Клиент спрашивает, когда будет выплата. Уточните дату перевода.' },
  { id: 'receipt', label: 'Чек перевода', re: /где чек|пришлите чек|чек перевода/i, question: 'Клиент просит чек перевода.' },
  { id: 'manager', label: 'Позвать менеджера', re: /позовите менеджера|можно (?:поговорить с менеджером|человека)|хочу (?:связаться|поговорить) с менеджером/i, question: 'Клиент просит подключить менеджера. Посмотрите исходный диалог.' },
];

export function detectTopic(text: string, topicsOff: string[] = []): Topic | null {
  const t = String(text || '').replace(/\s+/g, ' ');
  for (const topic of ALINA_TOPICS) {
    if (topicsOff.includes(topic.id)) continue;
    if (topic.re.test(t)) return topic;
  }
  return null;
}

export const DEFAULT_OFF_TEXT = 'Сейчас нерабочее время. Я на связи с {от} до {до} по Москве. Напишите мне после {от}, отвечу сразу.';

/** «09:00» → минуты от полуночи; null, если формат неверный. */
export function parseHm(raw: string): number | null {
  const m = String(raw || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  return h >= 0 && h <= 24 && min >= 0 && min < 60 && !(h === 24 && min > 0) ? h * 60 + min : null;
}

export function mskMinutes(nowMs: number): number {
  const d = new Date(nowMs + 3 * 3600_000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** Рабочее ли время (по Москве). Окно через полночь допускается; одинаковые границы значат «круглосуточно». */
export function isWorkingTime(nowMs: number, from: string, to: string): boolean {
  const a = parseHm(from), b = parseHm(to);
  if (a == null || b == null || a === b) return true;
  const m = mskMinutes(nowMs);
  return a < b ? m >= a && m < b : m >= a || m < b;
}

export function offHoursReply(template: string, from: string, to: string): string {
  const t = (template || '').trim() || DEFAULT_OFF_TEXT;
  return t.replace(/\{от\}/g, from).replace(/\{до\}/g, to).slice(0, 400);
}

export type GateResult =
  | { kind: 'pass' }
  | { kind: 'offhours'; reply: string | null } // reply = null: уже отвечали в это окно, молчим
  | { kind: 'escalate'; topic: string; question: string; reply: string };

export function gate(input: {
  text: string;
  nowMs: number;
  settings: GateSettings;
  alreadyToldOffHours: boolean;
  holdReply: string; // «Минутку, уточню.» с именем, готовит вызывающий код
  hasManagerGroup: boolean; // есть ли куда отправить вопрос
}): GateResult {
  const s = input.settings;
  // Вне часов вопросы менеджерам не уходят: клиент получает сообщение о времени работы и пишет позже.
  const topic = input.hasManagerGroup ? detectTopic(input.text, s.topicsOff) : null;
  if (s.hoursOn && !isWorkingTime(input.nowMs, s.hoursFrom, s.hoursTo)) {
    return { kind: 'offhours', reply: input.alreadyToldOffHours ? null : offHoursReply(s.offHoursText, s.hoursFrom, s.hoursTo) };
  }
  if (topic) {
    const quote = String(input.text).replace(/\s+/g, ' ').trim().slice(0, 200);
    return { kind: 'escalate', topic: topic.id, question: `${topic.question}\nСообщение клиента: «${quote}»`, reply: input.holdReply };
  }
  return { kind: 'pass' };
}

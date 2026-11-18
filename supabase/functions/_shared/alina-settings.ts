/**
 * Настройки Алины с сайта («Продвижение → Алина»). Хранятся в таблице alina_settings (ключ → значение).
 * Читаются с кэшем 30 секунд; если таблицы или значения нет, действуют значения по умолчанию, поведение прежнее.
 */
import { getAdminClient } from './alina-db.ts';

export type AlinaSettings = {
  read: boolean; // отмечать сообщение клиента прочитанным
  typing: boolean; // индикатор «печатает…»
  pauseMaxSec: number; // максимум паузы «печатает», секунды
  useName: boolean; // обращаться по имени
  phrases: string[]; // варианты фразы «уточняю»
  remindMin: number; // напомнить менеджерам, минут
  reactions: boolean; // итог реакцией ❤ / 👎
  copyButton: boolean; // кнопка «Скопировать @логин»
  admitLimit: number; // новых клиентов за период, 0 = без лимита (читает и функция базы alina_admit_chat)
  admitHours: number; // период лимита, часы
  llmBudgetUsd: number; // месячный бюджет ChatGPT в долларах, 0 = без ограничения
  hoursOn: boolean; // отвечать только в рабочие часы (по Москве)
  hoursFrom: string; // начало, «09:00»
  hoursTo: string; // конец, «22:00»
  offHoursText: string; // сообщение вне часов, подстановки {от} и {до}
  topicsOff: string[]; // темы, по которым менеджеру НЕ пишем (id из alina-gate.ts)
  managerGroup: number; // группа менеджеров (отрицательный номер), 0 = по умолчанию
};

export const ALINA_DEFAULTS: AlinaSettings = {
  read: true,
  typing: true,
  pauseMaxSec: 3,
  useName: true,
  phrases: ['Минутку, уточню.', 'Секунду, сейчас уточню.', 'Сейчас спрошу и вернусь к вам.'],
  remindMin: 10,
  reactions: true,
  copyButton: true,
  admitLimit: 30,
  admitHours: 3,
  llmBudgetUsd: 0,
  hoursOn: false,
  hoursFrom: '09:00',
  hoursTo: '22:00',
  offHoursText: '',
  topicsOff: [],
  managerGroup: 0,
};

function bool(v: unknown, d: boolean): boolean {
  return typeof v === 'boolean' ? v : d;
}

function num(v: unknown, d: number, min: number, max: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
}

function hm(v: unknown, d: string): string {
  const m = String(v ?? '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return d;
  const h = Number(m[1]), min = Number(m[2]);
  return h >= 0 && h <= 23 && min >= 0 && min < 60 ? `${String(h).padStart(2, '0')}:${m[2]}` : d;
}

/** Номер группы Telegram: отрицательное целое; всё остальное значит «по умолчанию» (0). */
function groupId(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').trim());
  return Number.isSafeInteger(n) && n < 0 ? n : 0;
}

/** Приводит значения из базы к допустимым: неверное заменяется значением по умолчанию, числа обрезаются по границам. */
export function normalizeAlinaSettings(raw: Record<string, unknown> | null | undefined): AlinaSettings {
  const r = raw || {};
  const phrases = Array.isArray(r.phrases)
    ? r.phrases.map((p) => String(p ?? '').trim().slice(0, 120)).filter(Boolean).slice(0, 12)
    : [];
  return {
    read: bool(r.read, ALINA_DEFAULTS.read),
    typing: bool(r.typing, ALINA_DEFAULTS.typing),
    pauseMaxSec: num(r.pauseMaxSec, ALINA_DEFAULTS.pauseMaxSec, 1, 6),
    useName: bool(r.useName, ALINA_DEFAULTS.useName),
    phrases: phrases.length ? phrases : [...ALINA_DEFAULTS.phrases],
    remindMin: Math.round(num(r.remindMin, ALINA_DEFAULTS.remindMin, 1, 120)),
    reactions: bool(r.reactions, ALINA_DEFAULTS.reactions),
    copyButton: bool(r.copyButton, ALINA_DEFAULTS.copyButton),
    admitLimit: Math.round(num(r.admitLimit, ALINA_DEFAULTS.admitLimit, 0, 100000)),
    admitHours: Math.round(num(r.admitHours, ALINA_DEFAULTS.admitHours, 1, 72)),
    llmBudgetUsd: Math.round(num(r.llmBudgetUsd, ALINA_DEFAULTS.llmBudgetUsd, 0, 100000) * 100) / 100,
    hoursOn: bool(r.hoursOn, ALINA_DEFAULTS.hoursOn),
    hoursFrom: hm(r.hoursFrom, ALINA_DEFAULTS.hoursFrom),
    hoursTo: hm(r.hoursTo, ALINA_DEFAULTS.hoursTo),
    offHoursText: typeof r.offHoursText === 'string' ? r.offHoursText.trim().slice(0, 400) : '',
    topicsOff: Array.isArray(r.topicsOff) ? [...new Set(r.topicsOff.map((x) => String(x)).filter((x) => /^[a-z_]{1,30}$/.test(x)))].slice(0, 20) : [],
    managerGroup: groupId(r.managerGroup),
  };
}

const TTL_MS = 30_000;
let cache: { at: number; value: AlinaSettings } | null = null;

export async function loadAlinaSettings(now = Date.now()): Promise<AlinaSettings> {
  if (cache && now - cache.at < TTL_MS) return cache.value;
  try {
    const { data, error } = await getAdminClient().from('alina_settings').select('key,value');
    if (error) throw error;
    const raw: Record<string, unknown> = {};
    for (const row of (data || []) as Array<{ key: string; value: unknown }>) raw[row.key] = row.value;
    cache = { at: now, value: normalizeAlinaSettings(raw) };
  } catch {
    // Таблицы ещё нет или база недоступна: последнее удачное значение, иначе значения по умолчанию.
    cache = { at: now, value: cache?.value ?? { ...ALINA_DEFAULTS, phrases: [...ALINA_DEFAULTS.phrases] } };
  }
  return cache.value;
}

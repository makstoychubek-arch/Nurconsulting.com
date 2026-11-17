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
};

function bool(v: unknown, d: boolean): boolean {
  return typeof v === 'boolean' ? v : d;
}

function num(v: unknown, d: number, min: number, max: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
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

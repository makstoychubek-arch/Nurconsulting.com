// Утреннее согласование плана дня (владелец, 25 ноября 2026): Алина в 09:00 МСК пишет в группу менеджеров план мест на сегодня;
// пока владелец не ответит реплаем «ок», места на сегодня клиентам не отдаём. Состояние: alina_settings.dayPlan { day, status, message_id }.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const mskDayKey = (now = Date.now()): string => {
  const m = new Date(now + 3 * 3600_000);
  return `${String(m.getUTCDate()).padStart(2, '0')}.${String(m.getUTCMonth() + 1).padStart(2, '0')}.${m.getUTCFullYear()}`;
};

type DayPlan = {
  day?: string;
  status?: 'pending' | 'approved';
  message_id?: number | null;
  next?: { day: string; status: 'approved' };
};

export function isDayPlanApproved(plan: DayPlan, day: string): boolean {
  return (plan.day === day && plan.status === 'approved') ||
    (plan.next?.day === day && plan.next.status === 'approved');
}

async function readPlan(db: SupabaseClient): Promise<DayPlan> {
  const { data } = await db.from('alina_settings').select('value').eq('key', 'dayPlan').maybeSingle();
  return ((data as { value?: DayPlan } | null)?.value) || {};
}

/** План на сегодня (по МСК) согласован? Если база не отвечает, не блокируем клиентов. */
export async function dayApproved(db: SupabaseClient): Promise<boolean> {
  try {
    const p = await readPlan(db);
    return isDayPlanApproved(p, mskDayKey());
  } catch { return true; }
}

export const isOkText = (t: string): boolean => /^\s*(ок|ok|окей|окэй|согласовано|согласен|согласна)[\s.!)]*$/i.test(t);

/** Реплай «ок» на сообщение с планом в группе менеджеров: день согласован. */
export async function tryApproveDay(
  db: SupabaseClient,
  update: { message?: { text?: string; chat?: { id?: number }; reply_to_message?: { message_id?: number } } },
  groupId: number | null,
  botToken: string,
): Promise<boolean> {
  const m = update?.message;
  if (!m || !groupId || m.chat?.id !== groupId || !isOkText(String(m.text || ''))) return false;
  const p = await readPlan(db);
  if (p.status !== 'pending' || p.day !== mskDayKey() || !p.message_id || m.reply_to_message?.message_id !== p.message_id) return false;
  await db.from('alina_settings').upsert({ key: 'dayPlan', value: { ...p, status: 'approved', approved_at: new Date().toISOString() } });
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({ chat_id: groupId, text: `План на ${p.day} принят, места на сегодня открыты ✅` }),
  }).catch(() => null);
  return true;
}

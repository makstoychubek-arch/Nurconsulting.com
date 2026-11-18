/**
 * «Песочница» Алины на сайте: сообщение клиента проходит через настоящий сценарий, но без Telegram и без записи в рабочую таблицу.
 * Диалог идёт под отрицательным chat_id администратора (source_account = sandbox). Все зависимости снаружи, логику можно проверять без сети.
 */

export type Reply = { replies: string[]; photos?: Array<{ url?: string; bytes?: Uint8Array; mime?: string; caption?: string }>; escalate?: { topic: string; question: string; group: number } };

export type Deps = {
  handle: (opts: { chatId: number; userId: number; username: string; fullName: string; text: string; hasPhoto: boolean; botToken: null; sourceAccount: 'sandbox'; nowMs?: number }) => Promise<Reply>;
  leadState: (chatId: number) => Promise<{ status: string | null; deal_type: string | null; product_name: string | null } | null>;
  reset: (chatId: number) => Promise<boolean>;
  now: () => number;
  /** Тексты Алины со стандартным содержимым (для редактора на сайте). */
  texts: () => Array<{ id: string; group: string; label: string; vars: string[]; text: string }>;
};

export type Result = { status: number; body: Record<string, unknown> };

const MAX_TEXT = 1500;
const MAX_PHOTO_BYTES = 600_000;

/** Отрицательный номер чата песочницы, свой у каждого администратора, не пересекается с настоящими чатами. */
export function sandboxChatId(userId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < userId.length; i++) h = Math.imul(h ^ userId.charCodeAt(i), 0x01000193) >>> 0;
  return -(1_000_000_000 + (h % 1_000_000_000));
}

function cleanLogin(raw: unknown): string {
  const s = String(raw ?? '').trim().replace(/^@+/, '').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 32);
  return s || 'sandbox_client';
}

/** «14:30» → сегодняшний момент по Москве; null, если поле пустое или неверное. */
export function mskToday(hm: string, nowMs: number): number | null {
  const m = String(hm || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  const d = new Date(nowMs + 3 * 3600_000);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), Number(m[1]), Number(m[2])) - 3 * 3600_000;
}

function toDataUrl(bytes: Uint8Array, mime: string): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return `data:${mime || 'image/jpeg'};base64,${btoa(bin)}`;
}

const fail = (status: number, error: string): Result => ({ status, body: { ok: false, error } });

export async function handleSandbox(body: Record<string, unknown>, userId: string, deps: Deps): Promise<Result> {
  const action = String(body.action || 'send');
  const chatId = sandboxChatId(userId);

  if (action === 'texts') return { status: 200, body: { ok: true, texts: deps.texts() } };

  if (action === 'state') return { status: 200, body: { ok: true, lead: await deps.leadState(chatId) } };

  if (action === 'reset') {
    if (!await deps.reset(chatId)) return fail(500, 'Не удалось начать диалог заново. Повторите.');
    return { status: 200, body: { ok: true, lead: null } };
  }

  if (action === 'send') {
    const text = String(body.text ?? '').trim().slice(0, MAX_TEXT);
    if (!text) return fail(400, 'Напишите сообщение.');
    const started = deps.now();
    let reply: Reply;
    try {
      reply = await deps.handle({
        chatId, userId: chatId, username: cleanLogin(body.username), fullName: 'Тест', text, hasPhoto: false, botToken: null, sourceAccount: 'sandbox',
        nowMs: mskToday(String(body.now_msk || ''), started) ?? undefined,
      });
    } catch {
      return fail(500, 'Алина не смогла ответить. Это сбой сценария, диалог не потерян.');
    }
    const photos = (reply.photos || []).map((p) => {
      if (p.url) return { url: p.url, caption: p.caption || '' };
      if (p.bytes && p.bytes.length <= MAX_PHOTO_BYTES) return { url: toDataUrl(p.bytes, p.mime || 'image/jpeg'), caption: p.caption || '' };
      return { url: '', caption: p.caption || 'Фото товара (слишком большое для предпросмотра)' };
    });
    return { status: 200, body: { ok: true, replies: reply.replies || [], photos, ms: deps.now() - started, lead: await deps.leadState(chatId), escalate: reply.escalate ? { topic: reply.escalate.topic, question: reply.escalate.question } : null } };
  }

  return fail(400, 'Неизвестное действие.');
}

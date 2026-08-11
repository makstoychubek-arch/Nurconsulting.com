// Алина · самовыкупы: диалог с клиентом → Supabase → Google Sheet.
// В командном чате — короткая статистика.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type SelfbuyStatus = 'new' | 'ask_order' | 'ask_review' | 'ask_bank' | 'done' | 'paused';

export type SelfbuyLead = {
  id: string;
  telegram_user_id: number;
  chat_id: number;
  username: string | null;
  full_name: string | null;
  phone: string | null;
  order_received_at: string | null;
  review_planned_at: string | null;
  bank_details: string | null;
  status: SelfbuyStatus;
  source_account: string;
  sheet_row: number | null;
};

const GREETING =
  'Здравствуйте! Я Алина, менеджер по самовыкупам NR Space.\n' +
  'Чтобы оформить выплату, ответьте на несколько вопросов.\n\n' +
  '1/3 Когда вы получите (или уже получили) заказ? Напишите дату.';

function admin(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
}

/** Чаты, где Алина ведёт клиентов (канал/группа/второй акк). */
export function getAlinaClientChatIds(): Set<number> {
  const raw = (Deno.env.get('ALINA_CLIENT_CHAT_IDS') || '').trim();
  const ids = new Set<number>();
  for (const p of raw.split(/[,\s]+/).filter(Boolean)) {
    const n = Number(p);
    if (Number.isFinite(n)) ids.add(n);
  }
  return ids;
}

export function isAlinaClientContext(chat: {
  id: number;
  type?: string;
}): boolean {
  if (chat.type === 'private') return true;
  return getAlinaClientChatIds().has(Number(chat.id));
}

export async function handleAlinaClientMessage(opts: {
  chatId: number;
  userId: number;
  username?: string;
  fullName?: string;
  text: string;
  sourceAccount?: string;
}): Promise<string> {
  const db = admin();
  const source = opts.sourceAccount || 'main';
  const text = opts.text.trim();

  let lead = await getOrCreateLead(db, opts, source);

  // Команды клиента
  if (/^(стоп|pause|пауза)$/i.test(text)) {
    await updateLead(db, lead.id, { status: 'paused' });
    await syncLeadToSheet(db, lead.id);
    return 'Ок, поставила диалог на паузу. Напишите «продолжить», когда будете готовы.';
  }
  if (/^(продолжить|start|старт)$/i.test(text) && lead.status === 'paused') {
    const next = nextStatus(lead);
    await updateLead(db, lead.id, { status: next });
    return questionForStatus(next);
  }

  if (lead.status === 'paused') {
    return 'Диалог на паузе. Напишите «продолжить», чтобы вернуться к вопросам.';
  }

  if (lead.status === 'new') {
    await updateLead(db, lead.id, {
      status: 'ask_order',
      full_name: opts.fullName || lead.full_name,
      username: opts.username || lead.username,
      last_client_text: text,
    });
    await logEvent(db, lead.id, opts.chatId, 'greeted', { text });
    await syncLeadToSheet(db, lead.id);
    return GREETING;
  }

  if (lead.status === 'ask_order') {
    await updateLead(db, lead.id, {
      order_received_at: text.slice(0, 200),
      status: 'ask_review',
      last_client_text: text,
    });
    await logEvent(db, lead.id, opts.chatId, 'order_date', { text });
    await syncLeadToSheet(db, lead.id);
    return 'Приняла.\n2/3 Когда планируете написать отзыв? Укажите дату.';
  }

  if (lead.status === 'ask_review') {
    await updateLead(db, lead.id, {
      review_planned_at: text.slice(0, 200),
      status: 'ask_bank',
      last_client_text: text,
    });
    await logEvent(db, lead.id, opts.chatId, 'review_date', { text });
    await syncLeadToSheet(db, lead.id);
    return (
      'Приняла.\n3/3 Пришлите банковские реквизиты для выплаты:\n' +
      'ФИО получателя, банк, номер карты или счёт/телефон для перевода.'
    );
  }

  if (lead.status === 'ask_bank') {
    if (text.length < 8) {
      return 'Нужны полные реквизиты: ФИО, банк, карта или счёт.';
    }
    await updateLead(db, lead.id, {
      bank_details: text.slice(0, 1000),
      status: 'done',
      last_client_text: text,
    });
    await logEvent(db, lead.id, opts.chatId, 'bank_done', { text });
    await syncLeadToSheet(db, lead.id);
    return (
      'Спасибо, данные зафиксированы.\n' +
      'Дата заказа, дата отзыва и реквизиты сохранены. Свяжемся по выплате.'
    );
  }

  if (lead.status === 'done') {
    if (/^реквизит/i.test(text)) {
      const details = text.replace(/^реквизит[аы]?\s*:?\s*/i, '').trim();
      if (details.length < 8) {
        return 'Пришлите реквизиты после слова «реквизиты:» — ФИО, банк, карта/счёт.';
      }
      await updateLead(db, lead.id, {
        bank_details: details.slice(0, 1000),
        last_client_text: text,
      });
      await logEvent(db, lead.id, opts.chatId, 'bank_update', { text });
      await syncLeadToSheet(db, lead.id);
      return 'Реквизиты обновила в таблице. Спасибо!';
    }
    await updateLead(db, lead.id, {
      notes: ((lead as { notes?: string }).notes || '') + `\n[+ ${text.slice(0, 200)}]`,
      last_client_text: text,
    });
    await syncLeadToSheet(db, lead.id);
    return 'Ваши данные уже в таблице. Если нужно изменить реквизиты — пришлите новые одной сообщением, начиная с «реквизиты:».';
  }

  // fallback
  await updateLead(db, lead.id, { status: 'ask_order', last_client_text: text });
  return GREETING;
}

function nextStatus(lead: SelfbuyLead): SelfbuyStatus {
  if (!lead.order_received_at) return 'ask_order';
  if (!lead.review_planned_at) return 'ask_review';
  if (!lead.bank_details) return 'ask_bank';
  return 'done';
}

function questionForStatus(status: SelfbuyStatus): string {
  switch (status) {
    case 'ask_order':
      return '1/3 Когда вы получите (или уже получили) заказ? Напишите дату.';
    case 'ask_review':
      return '2/3 Когда планируете написать отзыв? Укажите дату.';
    case 'ask_bank':
      return '3/3 Пришлите банковские реквизиты (ФИО, банк, карта/счёт).';
    case 'done':
      return 'Все данные уже собраны. Спасибо!';
    default:
      return GREETING;
  }
}

async function getOrCreateLead(
  db: SupabaseClient,
  opts: {
    chatId: number;
    userId: number;
    username?: string;
    fullName?: string;
  },
  source: string,
): Promise<SelfbuyLead> {
  const { data: existing } = await db
    .from('alina_selfbuy_leads')
    .select('*')
    .eq('telegram_user_id', opts.userId)
    .eq('chat_id', opts.chatId)
    .maybeSingle();
  if (existing) return existing as SelfbuyLead;

  const { data: created, error } = await db
    .from('alina_selfbuy_leads')
    .insert({
      telegram_user_id: opts.userId,
      chat_id: opts.chatId,
      username: opts.username || null,
      full_name: opts.fullName || null,
      status: 'new',
      source_account: source,
    })
    .select('*')
    .single();
  if (error) throw new Error(`alina lead insert: ${error.message}`);
  return created as SelfbuyLead;
}

async function updateLead(
  db: SupabaseClient,
  id: string,
  patch: Record<string, unknown>,
) {
  const { error } = await db
    .from('alina_selfbuy_leads')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(`alina lead update: ${error.message}`);
}

async function logEvent(
  db: SupabaseClient,
  leadId: string,
  chatId: number,
  eventType: string,
  payload: Record<string, unknown>,
) {
  await db.from('alina_selfbuy_events').insert({
    lead_id: leadId,
    chat_id: chatId,
    event_type: eventType,
    payload,
  });
}

/** Статистика для командного чата. */
export async function alinaSelfbuyStatsText(): Promise<string> {
  const db = admin();
  const { data, error } = await db
    .from('alina_selfbuy_leads')
    .select('status, source_account, created_at');
  if (error) return `Не удалось прочитать таблицу: ${error.message}`;
  const rows = data || [];
  const total = rows.length;
  const done = rows.filter((r) => r.status === 'done').length;
  const inProgress = rows.filter((r) =>
    ['new', 'ask_order', 'ask_review', 'ask_bank'].includes(r.status)
  ).length;
  const paused = rows.filter((r) => r.status === 'paused').length;
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = rows.filter((r) => String(r.created_at).slice(0, 10) === today).length;
  const bySource = new Map<string, number>();
  for (const r of rows) {
    const s = String(r.source_account || 'main');
    bySource.set(s, (bySource.get(s) || 0) + 1);
  }
  const src = [...bySource.entries()].map(([k, v]) => `${k}: ${v}`).join(', ') || '—';

  return [
    'Алина · самовыкупы',
    `Всего клиентов: ${total}`,
    `В работе: ${inProgress}`,
    `Завершено (данные собраны): ${done}`,
    `Пауза: ${paused}`,
    `Новых сегодня: ${todayCount}`,
    `По аккаунтам: ${src}`,
  ].join('\n');
}

export function isAlinaStatsQuestion(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes('самовыкуп') ||
    t.includes('сколько клиент') ||
    t.includes('сколько лид') ||
    (t.includes('статус') && (t.includes('алин') || t.includes('выкуп'))) ||
    (t.includes('сколько') && t.includes('выкуп'))
  );
}

// ── Google Sheets ───────────────────────────────────────────────────────────

async function syncLeadToSheet(db: SupabaseClient, leadId: string) {
  const sheetId = (Deno.env.get('ALINA_SHEET_ID') || '').trim();
  const saJson = (Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON') || '').trim();
  if (!sheetId || !saJson) {
    console.log('[alina-selfbuy] sheets skip: no ALINA_SHEET_ID / GOOGLE_SERVICE_ACCOUNT_JSON');
    return;
  }

  const { data: lead } = await db.from('alina_selfbuy_leads').select('*').eq('id', leadId).maybeSingle();
  if (!lead) return;

  try {
    const token = await googleAccessToken(saJson);
    const values = [[
      lead.updated_at || lead.created_at,
      String(lead.telegram_user_id),
      lead.username || '',
      lead.full_name || '',
      lead.order_received_at || '',
      lead.review_planned_at || '',
      lead.bank_details || '',
      lead.status,
      lead.source_account,
      String(lead.chat_id),
    ]];

    if (lead.sheet_row) {
      // update row
      const range = `Sheet1!A${lead.sheet_row}:J${lead.sheet_row}`;
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values }),
        },
      );
      if (!res.ok) console.error('[alina-selfbuy] sheet update', await res.text());
      return;
    }

    // append
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values }),
      },
    );
    const body = await res.json();
    if (!res.ok) {
      console.error('[alina-selfbuy] sheet append', JSON.stringify(body).slice(0, 300));
      return;
    }
    // updatedRange like "Sheet1!A12:J12"
    const updated = String(body?.updates?.updatedRange || '');
    const m = updated.match(/![A-Z]+(\d+)/);
    if (m) {
      await db.from('alina_selfbuy_leads').update({ sheet_row: Number(m[1]) }).eq('id', leadId);
    }
  } catch (e) {
    console.error('[alina-selfbuy] sheet sync', e);
  }
}

async function googleAccessToken(saJson: string): Promise<string> {
  const sa = JSON.parse(saJson);
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const enc = (obj: unknown) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(obj))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  const unsigned = `${enc(header)}.${enc(claim)}`;
  const key = await importPkcs8(sa.private_key);
  const sig = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    new TextEncoder().encode(unsigned),
  );
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  const jwt = `${unsigned}.${sigB64}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`google token: ${JSON.stringify(data).slice(0, 200)}`);
  return data.access_token as string;
}

async function importPkcs8(pem: string): Promise<CryptoKey> {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    'pkcs8',
    raw,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

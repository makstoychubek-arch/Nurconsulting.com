/**
 * Диалог Карины: приглашения и доступы в кабинет WB (User Management API).
 * POST /api/v1/invite · GET /api/v1/users · DELETE /api/v1/user
 */

import { getAdminClient } from './supabase-admin.ts';
import {
  cancelOtherPending,
  getActivePending,
  isCancelText,
  isConfirmText,
  resolveCabinet,
} from './agent-actions.ts';
import { setChatFocus } from './agent-chat-focus.ts';
import {
  cabinetTokenById,
  createUserInvite,
  deleteCabinetUser,
  listCabinetUsers,
  normalizeRuPhone,
} from './agent-wb-api.ts';
import { pick } from './agent-voice.ts';

export const USERS_ACTION = 'wb_users';
export const USERS_AGENT = 'karina';

export type UsersReply = { handled: boolean; reply?: string };

type UsersPayload = {
  kind?: 'invite' | 'list' | 'revoke';
  step?: string;
  cabinetId?: string;
  cabinetName?: string;
  phone?: string;
  position?: string;
  userId?: number;
  userLabel?: string;
};

function admin() {
  return getAdminClient();
}

function ownerOk(tgUserId: number): boolean {
  const raw = (Deno.env.get('AGENT_OWNER_TG_IDS') || '').trim();
  if (!raw) return true;
  const ids = new Set(
    raw.split(/[,\s]+/).filter(Boolean).map(Number).filter((n) => Number.isFinite(n)),
  );
  return ids.has(tgUserId);
}

export function wantsUserInvite(text: string): boolean {
  const t = String(text || '').toLowerCase().replace(/ё/g, 'е');
  return (
    /(приглас|инвайт|invite)/i.test(t) ||
    /(добав[ьи]|завед[иь]).{0,24}(человек|сотрудник|пользовател|менеджер|в\s+кабинет)/i
      .test(t) ||
    /(человек|сотрудник|пользовател).{0,20}(в\s+кабинет|добав|приглас)/i.test(t)
  );
}

export function wantsUserList(text: string): boolean {
  const t = String(text || '').toLowerCase().replace(/ё/g, 'е');
  return (
    /(кто\s+в\s+кабинете|список\s+(доступ|пользовател|сотрудник)|пользователи\s+кабинета|доступы\s+кабинета)/i
      .test(t) ||
    /(покажи|список).{0,16}(доступ|пользовател|сотрудник)/i.test(t)
  );
}

export function wantsUserRevoke(text: string): boolean {
  const t = String(text || '').toLowerCase().replace(/ё/g, 'е');
  return (
    /(удал[иь]|убери|отзови|закрой).{0,20}(доступ|пользовател|сотрудник)/i.test(t) ||
    /(забери|сними).{0,12}доступ/i.test(t)
  );
}

export function wantsWbUsersWork(text: string): boolean {
  return wantsUserInvite(text) || wantsUserList(text) || wantsUserRevoke(text);
}

export function isUsersDialogPending(
  pending: { agent_key?: string; action_type?: string } | null,
): boolean {
  return Boolean(
    pending &&
      pending.agent_key === USERS_AGENT &&
      pending.action_type === USERS_ACTION,
  );
}

async function savePending(
  chatId: number,
  tgUserId: number,
  cabinet: { id: string; name: string } | null,
  payload: UsersPayload,
  status: 'awaiting_selection' | 'awaiting_confirm' = 'awaiting_selection',
) {
  const db = admin();
  await cancelOtherPending(db, chatId);
  await db.from('agent_pending_actions').insert({
    chat_id: chatId,
    agent_key: USERS_AGENT,
    action_type: USERS_ACTION,
    status,
    cabinet_id: cabinet?.id || null,
    cabinet_name: cabinet?.name || null,
    proposed_by_tg: tgUserId,
    payload,
    expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
  });
  await setChatFocus(chatId, USERS_AGENT, 'wb_users', 25);
}

async function patchPending(id: string, payload: UsersPayload, status?: string) {
  const upd: Record<string, unknown> = {
    payload,
    updated_at: new Date().toISOString(),
  };
  if (status) upd.status = status;
  await admin().from('agent_pending_actions').update(upd).eq('id', id);
}

async function finishPending(id: string, resultText: string) {
  await admin()
    .from('agent_pending_actions')
    .update({
      status: 'done',
      result_text: resultText,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
}

function extractPhone(text: string): string | null {
  return normalizeRuPhone(text);
}

export async function startWbUsersDialog(opts: {
  chatId: number;
  tgUserId: number;
  text: string;
}): Promise<UsersReply> {
  const text = opts.text.trim();
  if (!wantsWbUsersWork(text)) return { handled: false };

  const kind: UsersPayload['kind'] = wantsUserInvite(text)
    ? 'invite'
    : wantsUserRevoke(text)
    ? 'revoke'
    : 'list';

  const resolved = await resolveCabinet(text);
  if (!resolved.match) {
    const names = resolved.candidates.map((c) => c.name).join(', ');
    return {
      handled: true,
      reply: pick([
        `В какой кабинет? ${names || 'Zevina 1 / Baza / …'}`,
        `Кабинет: ${names || 'зевина 1, элиум…'}`,
      ]),
    };
  }

  const tok = await cabinetTokenById(resolved.match.id);
  if (!tok) {
    return {
      handled: true,
      reply: `${resolved.match.name}: нет токена. Для доступов нужен токен владельца с категорией Users.`,
    };
  }

  if (kind === 'list') {
    const users = await listCabinetUsers(tok.token, false);
    const invited = await listCabinetUsers(tok.token, true);
    if (!users.length && !invited.length) {
      return {
        handled: true,
        reply: `${resolved.match.name}: пользователей не вижу (или токен без категории Users).`,
      };
    }
    const lines = [
      `${resolved.match.name} · доступы`,
      ...users.slice(0, 20).map((u, i) =>
        `${i + 1}) ${u.name}${u.phone ? ' · ' + u.phone : ''}${u.role ? ' · ' + u.role : ''} · id ${u.id}`
      ),
    ];
    if (invited.length) {
      lines.push('', 'Приглашения:', ...invited.slice(0, 10).map((u) =>
        `• ${u.name || 'ожидает'} · ${u.phone || '—'} · id ${u.id}`
      ));
    }
    return { handled: true, reply: lines.join('\n') };
  }

  if (kind === 'invite') {
    const phone = extractPhone(text);
    if (!phone) {
      await savePending(opts.chatId, opts.tgUserId, resolved.match, {
        kind: 'invite',
        step: 'await_phone',
        cabinetId: resolved.match.id,
        cabinetName: resolved.match.name,
      });
      return {
        handled: true,
        reply: pick([
          `${resolved.match.name}: кинь номер телефона человека (79…)`,
          `Ок, ${resolved.match.name}. Номер в формате 79001234567`,
        ]),
      };
    }
    const payload: UsersPayload = {
      kind: 'invite',
      step: 'await_confirm',
      cabinetId: resolved.match.id,
      cabinetName: resolved.match.name,
      phone,
      position: 'Сотрудник',
    };
    await savePending(opts.chatId, opts.tgUserId, resolved.match, payload, 'awaiting_confirm');
    return {
      handled: true,
      reply: [
        `Приглашение в ${resolved.match.name}`,
        `тел. ${phone}`,
        '',
        '«да» — сгенерирую ссылку. «отмена» — стоп.',
      ].join('\n'),
    };
  }

  // revoke
  await savePending(opts.chatId, opts.tgUserId, resolved.match, {
    kind: 'revoke',
    step: 'await_user',
    cabinetId: resolved.match.id,
    cabinetName: resolved.match.name,
  });
  const users = await listCabinetUsers(tok.token, false);
  if (!users.length) {
    return { handled: true, reply: `${resolved.match.name}: некого удалять / список пуст.` };
  }
  return {
    handled: true,
    reply: [
      `${resolved.match.name}: кого убрать? Напиши номер из списка или id`,
      ...users.slice(0, 15).map((u, i) =>
        `${i + 1}) ${u.name}${u.phone ? ' · ' + u.phone : ''} · id ${u.id}`
      ),
    ].join('\n'),
  };
}

export async function continueWbUsersDialog(opts: {
  chatId: number;
  tgUserId: number;
  text: string;
}): Promise<UsersReply> {
  const pending = await getActivePending(opts.chatId);
  if (!isUsersDialogPending(pending)) return { handled: false };

  const text = opts.text.trim();
  const p = { ...(pending!.payload as UsersPayload) };

  if (isCancelText(text)) {
    await admin()
      .from('agent_pending_actions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', pending!.id);
    return { handled: true, reply: pick(['Ок, отмена', 'Стоп', 'Не трогаю']) };
  }

  if (p.step === 'await_phone') {
    const phone = extractPhone(text);
    if (!phone) {
      return { handled: true, reply: 'Номер не разобрала. Пример: 79001234567' };
    }
    p.phone = phone;
    p.step = 'await_confirm';
    await patchPending(pending!.id, p, 'awaiting_confirm');
    return {
      handled: true,
      reply: [
        `Приглашение в ${p.cabinetName}`,
        `тел. ${phone}`,
        '',
        '«да» — сделаю ссылку.',
      ].join('\n'),
    };
  }

  if (p.step === 'await_user') {
    if (!p.cabinetId) return { handled: true, reply: 'Нет кабинета.' };
    const tok = await cabinetTokenById(p.cabinetId);
    if (!tok) return { handled: true, reply: 'Нет токена.' };
    const users = await listCabinetUsers(tok.token, false);
    const asNum = Number(text.replace(/\D/g, ''));
    let user = users.find((u) => u.id === asNum);
    if (!user) {
      const idx = Number(text.trim());
      if (Number.isFinite(idx) && idx >= 1 && idx <= users.length) {
        user = users[idx - 1];
      }
    }
    if (!user) {
      return { handled: true, reply: 'Не нашла. Напиши номер из списка или id.' };
    }
    p.userId = user.id;
    p.userLabel = `${user.name} · ${user.phone || user.id}`;
    p.step = 'await_confirm';
    await patchPending(pending!.id, p, 'awaiting_confirm');
    return {
      handled: true,
      reply: `Убрать доступ: ${p.userLabel} из ${p.cabinetName}?\n«да» / «отмена»`,
    };
  }

  if (p.step === 'await_confirm' || pending!.status === 'awaiting_confirm') {
    if (!isConfirmText(text)) {
      return { handled: true, reply: 'Нужно «да» или «отмена».' };
    }
    if (!ownerOk(opts.tgUserId)) {
      return { handled: true, reply: 'Подтверждать может только владелец.' };
    }
    if (!p.cabinetId) return { handled: true, reply: 'Нет кабинета.' };
    const tok = await cabinetTokenById(p.cabinetId);
    if (!tok) return { handled: true, reply: 'Нет токена WB.' };

    if (p.kind === 'invite' && p.phone) {
      const inv = await createUserInvite(tok.token, p.phone, p.position || 'Сотрудник');
      if (!inv.ok || !inv.inviteUrl) {
        const msg = `Не вышло приглашение: ${inv.errorText || 'нет ссылки'}. Нужен токен владельца с категорией Users.`;
        await finishPending(pending!.id, msg);
        return { handled: true, reply: msg };
      }
      const msg = [
        pick(['Готово', 'Ссылка есть', 'Приглашение создала']),
        `${p.cabinetName} · ${p.phone}`,
        inv.inviteUrl,
        inv.inviteID ? `id: ${inv.inviteID}` : null,
        'Отправь человеку — пусть перейдёт и примет.',
      ].filter(Boolean).join('\n');
      await finishPending(pending!.id, msg);
      return { handled: true, reply: msg };
    }

    if (p.kind === 'revoke' && p.userId) {
      const del = await deleteCabinetUser(tok.token, p.userId);
      const msg = del.ok
        ? `Убрала доступ: ${p.userLabel || p.userId} · ${p.cabinetName}`
        : `Не вышло: ${del.errorText}`;
      await finishPending(pending!.id, msg);
      return { handled: true, reply: msg };
    }
  }

  return { handled: true, reply: 'Шаг сбился — «отмена» и заново.' };
}

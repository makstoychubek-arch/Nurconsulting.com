/**
 * Тим-чат (-1004460164885): Карина туда пишет утренний РНП, но входящие
 * раньше отбрасывались как unknown_chat. «Сгенерируйте ссылку» / «Алоо»
 * должны получать ответ, без спама на каждую реплику.
 */

import {
    accessItemsForExistingUser,
    accessPresetItems,
    accessPresetLabel,
    findWbUserByPhone,
    isAlreadyAddedInviteError,
    normalizeWbInvitePhone,
    parseAccessPreset,
    updateWbUserAccess,
    USERS_API,
    userIdOf,
    wbError,
    wbSend,
    type AccessPreset,
} from './wb-agent-wow.ts';

export type TeamChatKind = 'invite' | 'ping' | 'ignored';

export type TeamCabinet = { id: string; name: string; wb_token?: string | null };

export function isTeamChatId(chatId: string, teamChatId: string): boolean {
    const norm = (v: string) => String(v || '').trim().replace(/^-/, '');
    const a = String(chatId || '').trim();
    const b = String(teamChatId || '').trim();
    if (!a || !b) return false;
    return a === b || norm(a) === norm(b);
}

export function isTeamInviteAsk(text: string): boolean {
    const t = String(text || '').toLowerCase().replace(/ё/g, 'е');
    if (!t.trim()) return false;
    if (/пригласит/.test(t)) return true;
    if (/сгенерир/.test(t) && /ссылк/.test(t)) return true;
    if (/дай(те)?\s+ссылк/.test(t)) return true;
    return false;
}

export function isTeamPing(text: string): boolean {
    const t = String(text || '').toLowerCase().replace(/ё/g, 'е').trim();
    if (!t || t.length > 48) return false;
    const words = t.split(/\s+/).filter(Boolean);
    if (words.length > 4) return false;
    if (/^(ало+|алло+|ау+|эй+|привет|хай|hello|hi|карина|ответь)\W*$/i.test(t)) return true;
    if (/ты\s*тут|жива|на\s*месте/.test(t)) return true;
    if (/^(твари|алоо)\W*$/i.test(t)) return true;
    return false;
}

export function classifyTeamChat(text: string): TeamChatKind {
    if (isTeamInviteAsk(text)) return 'invite';
    if (isTeamPing(text)) return 'ping';
    return 'ignored';
}

export function extractInvitePhone(text: string): { phone: string; countryName: string } | null {
    const whole = normalizeWbInvitePhone(text);
    if (whole && /\d{9,}/.test(text)) return whole;
    const chunks = String(text || '').match(/\+?\d[\d\s()-]{8,}\d/g) || [];
    for (const chunk of chunks) {
        const parsed = normalizeWbInvitePhone(chunk);
        if (parsed) return parsed;
    }
    return null;
}

export function extractCabinetHint(text: string): 'baza' | 'elium' | 'zevina1' | 'zevina2' | null {
    const t = String(text || '').toLowerCase().replace(/ё/g, 'е');
    if (/zevina\s*2|зевин[аa]?\s*2|айлин|ailin/.test(t)) return 'zevina2';
    if (/zevina|зевин|уркунбаев/.test(t)) return 'zevina1';
    if (/elium|элиум|айзада/.test(t)) return 'elium';
    if (/\bbaza\b|база|бейшеев/.test(t)) return 'baza';
    return null;
}

export function cabinetMatchesHint(name: string, hint: string | null): boolean {
    const n = String(name || '');
    if (!hint) return false;
    if (hint === 'zevina2') return /zevina\s*2|зевин[аa]?\s*2|айлин|ailin/i.test(n);
    if (hint === 'zevina1') {
        if (/zevina\s*2|зевин[аa]?\s*2|айлин|ailin/i.test(n)) return false;
        return /zevina|зевин|уркунбаев/i.test(n);
    }
    if (hint === 'elium') return /elium|элиум|айзада/i.test(n);
    if (hint === 'baza') return /^baza$/i.test(n.trim()) || /бейшеев|\bbaza\b/i.test(n);
    return false;
}

export function teamInviteHint(): string {
    return [
        'На месте. Для пригласительной нужны кабинет и телефон сотрудника.',
        'Пример: пригласительная Baza 996700123456',
        'Кабинеты: Baza, Elium, Zevina 1, Zevina 2.',
    ].join('\n');
}

export function teamPingReply(): string {
    return teamInviteHint();
}

function pickInviteUrl(data: Record<string, unknown>): string {
    const nested = data.invite && typeof data.invite === 'object' ? data.invite as Record<string, unknown> : {};
    const inner = data.data && typeof data.data === 'object' ? data.data as Record<string, unknown> : {};
    return String(
        data.inviteUrl || data.invite_url || data.url || data.link
        || nested.inviteUrl || nested.url || nested.link
        || inner.inviteUrl || inner.invite_url || inner.url
        || '',
    ).trim();
}

function sanitizeWbToken(raw: unknown): string {
    if (typeof raw !== 'string') return '';
    return raw.replace(/^\uFEFF/, '').replace(/\s+/g, '').trim();
}

export async function createWbInviteLink(
    token: string,
    phoneRaw: string,
    position = 'Сотрудник',
    preset: AccessPreset = 'standard',
): Promise<{ ok: true; updated: boolean; url?: string; phone: string; countryName: string; label: string } | { ok: false; error: string }> {
    const phone = normalizeWbInvitePhone(phoneRaw);
    if (!phone) return { ok: false, error: 'Нужен телефон с кодом страны: 996…, 79…, 375…' };
    const access = accessPresetItems(preset);
    const body: Record<string, unknown> = { invite: { phoneNumber: phone.phone, position } };
    if (access?.length) body.access = access;
    const res = await wbSend(`${USERS_API}/api/v1/invite`, token, 'POST', body);
    if (!res.ok) {
        const err = wbError(res);
        if (isAlreadyAddedInviteError(err)) {
            const found = await findWbUserByPhone(token, phone.phone);
            if (found.error) return { ok: false, error: found.error };
            const userId = found.user ? userIdOf(found.user) : 0;
            if (!userId) {
                return { ok: false, error: 'Этот номер уже приглашён. Пусть примет ссылку, потом сменим права.' };
            }
            const upd = await updateWbUserAccess(token, userId, accessItemsForExistingUser(preset));
            if (!upd.ok) return { ok: false, error: wbError(upd) };
            return {
                ok: true,
                updated: true,
                phone: phone.phone,
                countryName: phone.countryName,
                label: accessPresetLabel(preset),
            };
        }
        return { ok: false, error: err };
    }
    const data = (res.data && typeof res.data === 'object' ? res.data : {}) as Record<string, unknown>;
    const url = pickInviteUrl(data);
    if (!url) return { ok: false, error: 'WB не вернул ссылку. Проверьте категорию «Пользователи» у токена.' };
    return {
        ok: true,
        updated: false,
        url,
        phone: phone.phone,
        countryName: phone.countryName,
        label: accessPresetLabel(preset),
    };
}

export async function replyTeamChat(opts: {
    text: string;
    cabinets: TeamCabinet[];
}): Promise<{ kind: TeamChatKind | 'invite_ok' | 'invite_err'; text: string | null }> {
    const kind = classifyTeamChat(opts.text);
    if (kind === 'ignored') return { kind: 'ignored', text: null };
    if (kind === 'ping') return { kind: 'ping', text: teamPingReply() };

    const phone = extractInvitePhone(opts.text);
    const hint = extractCabinetHint(opts.text);
    const preset = parseAccessPreset(opts.text) || 'standard';
    if (!phone || !hint) return { kind: 'invite', text: teamInviteHint() };

    const cab = (opts.cabinets || []).find((c) => cabinetMatchesHint(c.name, hint));
    const token = sanitizeWbToken(cab?.wb_token);
    if (!cab || !token) {
        return { kind: 'invite_err', text: `Не нашла кабинет «${hint}» с токеном WB.` };
    }
    const made = await createWbInviteLink(token, phone.phone, 'Сотрудник', preset);
    if (!made.ok) return { kind: 'invite_err', text: `Не вышло: ${made.error}` };
    if (made.updated) {
        return {
            kind: 'invite_ok',
            text: `Этот номер уже в кабинете ${cab.name}. Права: ${made.label}.`,
        };
    }
    return {
        kind: 'invite_ok',
        text: [
            `Готово · ${cab.name} · ${made.countryName} ${made.phone}`,
            `Доступ: ${made.label}`,
            made.url || '',
            'Отправьте сотруднику — ссылка живёт недолго.',
        ].filter(Boolean).join('\n'),
    };
}

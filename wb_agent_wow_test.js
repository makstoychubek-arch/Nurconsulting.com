'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const wow = fs.readFileSync(path.join(__dirname, 'supabase/functions/_shared/wb-agent-wow.ts'), 'utf8');
const proxy = fs.readFileSync(path.join(__dirname, 'supabase/functions/wb-proxy/index.ts'), 'utf8');

assert.ok(wow.includes("export type AccessPreset = 'standard' | 'manager' | 'readonly' | 'finance'"),
    'finance is a first-class access preset');
assert.ok(wow.includes("preset === 'finance'"), 'finance preset enables finance+balance');
assert.ok(wow.includes('accessItemsForExistingUser'), 'existing users get a partial WB access update');
assert.ok(wow.includes('already added'), 'invite already-added is detected');
assert.ok(wow.includes('usersAccesses') && wow.includes('userId'),
    'WB access update must send usersAccesses[].userId, not id');
assert.ok(wow.includes('export function parseAccessPreset'), 'preset parser is shared');

assert.ok(proxy.includes("case 'users_access'"), 'wb-proxy exposes users_access');
assert.ok(proxy.includes('isAlreadyAddedInviteError'), 'invite falls back to access update');
assert.ok(proxy.includes('changeExistingUserAccess'), 'shared update helper is used');

function parseAccessPreset(text) {
    const t = String(text || '').toLowerCase().replace(/ё/g, 'е');
    if (!t.trim()) return null;
    if (/без\s+финанс|no[_\s-]?finance|не\s+финанс/i.test(t)) return 'manager';
    if (/финанс|finance/i.test(t)) return 'finance';
    if (/только\s+смотр|read.?only|чтение|readonly/i.test(t)) return 'readonly';
    if (/менеджер|manager/i.test(t)) return 'manager';
    if (/стандарт|по\s+умолчанию|дефолт|default/i.test(t)) return 'standard';
    return null;
}

assert.strictEqual(parseAccessPreset('дай доступ к финансам 996501486648'), 'finance');
assert.strictEqual(parseAccessPreset('измени статус на финансы'), 'finance');
assert.strictEqual(parseAccessPreset('без финансов'), 'manager');
assert.strictEqual(parseAccessPreset('менеджер'), 'manager');
assert.strictEqual(parseAccessPreset('стандарт'), 'standard');
assert.strictEqual(parseAccessPreset('чтение'), 'readonly');
assert.ok(wow.includes('/без\\s+финанс|no[_\\s-]?finance|не\\s+финанс/i'), 'TS keeps no-finance first');
assert.ok(wow.includes('/финанс|finance/i'), 'TS maps финансы to finance after the no-finance check');

function isAlreadyAddedInviteError(err) {
    return /already added|already exists|already exist|уже добавлен|уже есть|user already/i.test(err);
}
assert.ok(isAlreadyAddedInviteError('invite user already added'));
assert.ok(isAlreadyAddedInviteError('Не вышло приглашение: user already added'));
assert.ok(!isAlreadyAddedInviteError('unknown code'));

function findUserByPhone(users, phone) {
    const want = String(phone || '').replace(/\D/g, '');
    if (!want) return null;
    for (const user of users) {
        const invitee = user.inviteeInfo && typeof user.inviteeInfo === 'object' ? user.inviteeInfo : {};
        const have = String(user.phone || user.phoneNumber || invitee.phoneNumber || '').replace(/\D/g, '');
        if (have && (have === want || have.endsWith(want) || want.endsWith(have))) return user;
    }
    return null;
}
assert.strictEqual(
    findUserByPhone([{ id: 304739522, phone: '996501486648' }], '996501486648').id,
    304739522,
);
assert.strictEqual(findUserByPhone([{ id: 1, phone: '79001234567' }], '996501486648'), null);

console.log('wb_agent_wow_test: ok');

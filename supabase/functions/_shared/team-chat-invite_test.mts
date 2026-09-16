import assert from 'node:assert/strict';
import {
    cabinetMatchesHint,
    classifyTeamChat,
    extractCabinetHint,
    extractInvitePhone,
    isTeamChatId,
    isTeamInviteAsk,
    isTeamPing,
    replyTeamChat,
} from './team-chat-invite.ts';

assert.equal(isTeamChatId('-1004460164885', '-1004460164885'), true);
assert.equal(isTeamChatId('1004460164885', '-1004460164885'), true);
assert.equal(isTeamChatId('-100111', '-1004460164885'), false);

assert.equal(isTeamInviteAsk('сгенерируйте ссылку'), true);
assert.equal(isTeamInviteAsk('Пригласительную'), true);
assert.equal(isTeamInviteAsk('пригласительная Baza 996700123456'), true);
assert.equal(isTeamInviteAsk('привет как дела'), false);

assert.equal(isTeamPing('Алоо'), true);
assert.equal(isTeamPing('твари'), true);
assert.equal(isTeamPing('карина'), true);
assert.equal(isTeamPing('Когда откроете модуль, цифры уже будут'), false);

assert.equal(classifyTeamChat('сгенерируйте ссылку'), 'invite');
assert.equal(classifyTeamChat('Алоо'), 'ping');
assert.equal(classifyTeamChat('можно открывать РНП'), 'ignored');

assert.equal(extractCabinetHint('пригласительная Baza 996700123456'), 'baza');
assert.equal(extractCabinetHint('Zevina 2'), 'zevina2');
assert.equal(extractCabinetHint('Elium'), 'elium');
assert.equal(extractInvitePhone('пригласительная Baza 996700123456')?.phone, '996700123456');

assert.equal(cabinetMatchesHint('Baza', 'baza'), true);
assert.equal(cabinetMatchesHint('Zevina 1', 'zevina1'), true);
assert.equal(cabinetMatchesHint('Zevina 2', 'zevina1'), false);
assert.equal(cabinetMatchesHint('Zevina 2', 'zevina2'), true);

const hint = await replyTeamChat({ text: 'Пригласительную', cabinets: [] });
assert.equal(hint.kind, 'invite');
assert.match(String(hint.text), /996700123456/);

const ping = await replyTeamChat({ text: 'Алоо', cabinets: [] });
assert.equal(ping.kind, 'ping');
assert.match(String(ping.text), /пригласительн/i);

const skip = await replyTeamChat({ text: 'можно открывать РНП', cabinets: [] });
assert.equal(skip.kind, 'ignored');
assert.equal(skip.text, null);

console.log('team-chat-invite_test: ok');

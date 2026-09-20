/**
 * Telegram webhook: реплай «завтра» → ответ на WB, чужие чаты молчат.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = __dirname;
const router = fs.readFileSync(path.join(root, 'supabase/functions/telegram-router/index.ts'), 'utf8');
const apply = fs.readFileSync(path.join(root, 'supabase/functions/_shared/wb-restock-apply.ts'), 'utf8');
const shared = fs.readFileSync(path.join(root, 'supabase/functions/_shared/wb-restock-reply.ts'), 'utf8');
const html = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');

assert.ok(router.includes('applyRestockTelegramReply'), 'router uses shared restock apply');
assert.ok(router.includes('unwrapTelegramMessage'), 'router reads Telegram update');
assert.ok(apply.includes("'👎'"), 'unclear reply gets a thumbs-down, not a chat message');
assert.ok(shared.includes('setMessageReaction') && apply.includes("'❤'"),
    'success is a heart reaction, not a chat message');
assert.ok(shared.includes('function peelCardAndAnswer') && shared.includes('external_reply') && shared.includes('business_message'),
    'reply matching must read quote / business / mashed card+answer');
assert.ok(shared.includes('wasViewed: true') && shared.includes('function isAlreadyAnsweredWb'),
    'WB PATCH marks the question viewed and treats already-answered as success');
assert.ok(router.includes('setTelegramReaction'), 'router hearts via shared helper');
assert.ok(!router.includes('Ушло на WB'), 'must not write status text after a reply');
assert.ok(!router.includes('Готово. На WB ушёл ответ'), 'must not dump the WB letter into the chat');
assert.ok(!router.includes('Не смог ответить на WB'), 'must not paste WB error URLs');
assert.ok(apply.includes(".in('status', ['pending', 'answered'])"),
    'reply can edit an auto-answered card, not only pending');
assert.ok(apply.includes('already_answered'), 'already-sent cards can still receive a heart');
assert.ok(!router.includes('-1004460164885'), 'router must not hardcode the team chat');

assert.ok(html.includes('Или ответьте в Telegram коротко: завтра / да / 170'),
    'agents questions panel hints the Telegram reply');
assert.ok(html.includes('placeholder="Ответ покупателю или в Telegram: завтра / да / 170"'),
    'question textarea mentions Telegram');

console.log('telegram_router_test: ok');

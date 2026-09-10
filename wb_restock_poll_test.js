/**
 * Опрос вопросов WB о поступлении и карточка в чат отзывов, не в тим.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = __dirname;
const poll = fs.readFileSync(path.join(root, 'supabase/functions/wb-restock-poll/index.ts'), 'utf8');
const router = fs.readFileSync(path.join(root, 'supabase/functions/telegram-router/index.ts'), 'utf8');
const admin = fs.readFileSync(path.join(root, 'supabase/functions/telegram-admin/index.ts'), 'utf8');
const shared = fs.readFileSync(path.join(root, 'supabase/functions/_shared/wb-restock-reply.ts'), 'utf8');
const mig = fs.readFileSync(path.join(root, 'supabase/migrations/20260910120000_wb_restock_questions.sql'), 'utf8');
const cfg = fs.readFileSync(path.join(root, 'supabase/config.toml'), 'utf8');
const docs = fs.readFileSync(path.join(root, 'docs/wb-restock-reply.md'), 'utf8');

assert.ok(poll.includes('isServiceAuthorized'), 'poll accepts cron JWT');
assert.ok(poll.includes("channel: 'reviews'"), 'poll uses reviews gate');
assert.ok(poll.includes('TELEGRAM_CHAT_REVIEWS'), 'poll does not fall back to team chat');
assert.ok(!poll.includes('TEAM_TELEGRAM_CHAT_ID'), 'poll must not hardcode team chat');
assert.ok(poll.includes('questions?isAnswered=false'), 'poll lists unanswered WB questions');
assert.ok(poll.includes('wb_restock_questions'), 'poll stores pending cards');
assert.ok(poll.includes('formatRestockTelegramCard'), 'poll sends restock card');

assert.ok(router.includes('verify') || cfg.includes('verify_jwt = false'), 'router is callable without user JWT');
assert.ok(cfg.includes('[functions.telegram-router]') && cfg.includes('verify_jwt = false'),
    'config.toml disables JWT for Telegram webhook');
assert.ok(router.includes('X-Telegram-Bot-Api-Secret-Token'), 'router checks webhook secret');
assert.ok(router.includes('questions/answer'), 'router posts the WB answer');
assert.ok(router.includes('buildWbRestockAnswer'), 'router uses the hello+when template');
assert.ok(router.includes('unknown_chat'), 'router ignores chats that are not reviews');

assert.ok(admin.includes("action === 'set_webhook'"), 'admin can point notify bot at the router');
assert.ok(admin.includes('telegram-router?bot='), 'webhook path is telegram-router');

assert.ok(shared.includes('Здравствуйте, этот товар будет в наличии'), 'WB template is fixed');
assert.ok(shared.includes('#nrq'), 'card carries question id');

assert.ok(mig.includes('wb_restock_questions'), 'migration creates queue table');
assert.ok(mig.includes('wb_restock_poll') && mig.includes("'*/10 * * * *'"), 'cron every 10 minutes');
assert.ok(mig.includes('telegram-router?bot=notify'), 'notify webhook path stored');

assert.ok(docs.includes('через неделю'), 'user-facing doc explains the reply');
assert.ok(docs.includes('TELEGRAM_CHAT_REVIEWS'), 'doc names the reviews chat');
assert.ok(docs.includes('telegram-webhook'), 'replies go through the live notify webhook');
assert.ok(fs.existsSync(path.join(root, 'supabase/functions/_shared/wb-restock-apply.ts')),
    'shared apply helper posts the WB answer');

console.log('wb_restock_poll_test: ok');

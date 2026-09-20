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
const apply = fs.readFileSync(path.join(root, 'supabase/functions/_shared/wb-restock-apply.ts'), 'utf8');
const webhook = fs.readFileSync(path.join(root, 'supabase/functions/telegram-webhook/index.ts'), 'utf8');
const proxy = fs.readFileSync(path.join(root, 'supabase/functions/wb-proxy/index.ts'), 'utf8');
const mig = fs.readFileSync(path.join(root, 'supabase/migrations/20260910120000_wb_restock_questions.sql'), 'utf8');
const cfg = fs.readFileSync(path.join(root, 'supabase/config.toml'), 'utf8');
const docs = fs.readFileSync(path.join(root, 'docs/wb-restock-reply.md'), 'utf8');

assert.ok(poll.includes('isServiceAuthorized'), 'poll accepts cron JWT');
assert.ok(!poll.includes('shouldSendTelegram'), 'auto-answers ignore telegram mute for every cabinet');
assert.ok(poll.includes('TELEGRAM_CHAT_REVIEWS'), 'poll does not fall back to team chat');
assert.ok(!poll.includes('TEAM_TELEGRAM_CHAT_ID'), 'poll must not hardcode team chat');
assert.ok(poll.includes('/api/v1/new-feedbacks-questions'),
    'poll starts with official getV1NewFeedbacksQuestions ping');
assert.ok(poll.includes('parseNewFeedbacksQuestions'), 'poll parses hasNewQuestions flags');
assert.ok(poll.includes('questions?isAnswered=false'), 'poll lists unanswered WB questions');
assert.ok(poll.includes('listAllUnansweredQuestions') && poll.includes('QUESTION_PAGE'),
    'poll pages through every unanswered question, not only the first 50');
assert.ok(poll.includes('collectOpenQuestions'), 'auto-answer does not drop questions older than 45 days');
assert.ok(!/take=50&skip=0/.test(poll) || poll.includes('skip=${skip}'),
    'poll increments skip across WB pages');
assert.ok(poll.includes('wb_restock_questions'), 'poll stores pending cards');
assert.ok(poll.includes('formatRestockTelegramCard'), 'poll keeps a manual card if WB PATCH fails');
assert.ok(poll.includes('formatAutoAnswerTelegramCard'), 'poll tags the owner after an auto-answer');
assert.ok(poll.includes('sendPhoto'), 'auto-answer card is a product photo like reviews');
assert.ok(poll.includes('renderQuestionAnswerReportPng'), 'auto-answer sends a review-style report PNG');
assert.ok(poll.includes('question-report.png'), 'report PNG is uploaded as a Telegram photo');
assert.ok(poll.includes('formatAutoAnswerMatchCaption'), 'PNG caption stays matchable for a reply edit');
assert.ok(poll.includes('editMessageCaption'), 'photo cards update caption in place');
assert.ok(poll.includes('rnp_articles') && poll.includes('photo_url'),
    'cover photo comes from rnp_articles then WB basket');
assert.ok(poll.includes('resolveWbCardPhotoUrl'), 'missing cover falls back to WB basket probe');
assert.ok(poll.includes('buildAutoQuestionAnswer'), 'poll auto-answers every open question');
assert.ok(poll.includes('auto_answered'), 'poll reports how many questions were auto-answered');
assert.ok(shared.includes('collectOpenQuestions'), 'all unanswered questions are collected, not only restock');
assert.ok(!poll.includes('через несколько дней'), 'auto template must not invent a restock date');

assert.ok(router.includes('verify') || cfg.includes('verify_jwt = false'), 'router is callable without user JWT');
assert.ok(cfg.includes('[functions.telegram-router]') && cfg.includes('verify_jwt = false'),
    'config.toml disables JWT for Telegram webhook');
assert.ok(router.includes('X-Telegram-Bot-Api-Secret-Token'), 'router checks webhook secret');
assert.ok(router.includes('applyRestockTelegramReply'), 'router answers restock via shared apply');
assert.ok(apply.includes('answerWbQuestion'), 'apply answers via official PATCH /questions');
assert.ok(!router.includes('questions/answer') && !apply.includes('questions/answer'),
    'old POST /questions/answer path is gone');
assert.ok(shared.includes('buildWbRestockAnswer'), 'hello+when template is shared');
assert.ok(router.includes('unknown_chat'), 'router ignores chats that are not reviews');
assert.ok(shared.includes('setMessageReaction') && apply.includes("'❤'"),
    'success is a heart on the reply, no text');
assert.ok(router.includes('setTelegramReaction'), 'router hearts via shared reaction helper');
assert.ok(!router.includes('Ушло на WB') && !router.includes('готово'),
    'must not write a status message after a restock reply');
assert.ok(poll.includes('resend_question_id'), 'poll can duplicate one pending card');
assert.ok(poll.includes('editMessageText'), 'resend shortens the existing Telegram card in place');
assert.ok(poll.includes('apply_question_id'), 'poll can apply an already given restock date');
assert.ok(poll.includes('body.answer') || poll.includes("body.answer"), 'poll apply can reuse a custom answer already written');
assert.ok(poll.includes('setTelegramReaction') && shared.includes('setMessageReaction'),
    'poll can put a heart on the Telegram reply');
assert.ok(poll.includes('heart_message_id'), 'poll can put a heart on an existing reply');
assert.ok(poll.includes('delete_message_id'), 'poll can delete a leftover Karina status message');
assert.ok(!apply.includes('завтра / через неделю / через 2 недели') || apply.includes("'👎'"),
    'unclear restock reply is a thumbs-down, not a chat message');
assert.ok(shared.includes('toLocaleLowerCase'), 'WB when-phrase is lowercased');
assert.ok(poll.includes('answerWbQuestion'), 'poll apply uses official PATCH');

assert.ok(admin.includes("action === 'set_webhook'"), 'admin can point notify bot at the router');
assert.ok(admin.includes('telegram-router?bot='), 'webhook path is telegram-router');

assert.ok(shared.includes('Здравствуйте! Этот товар будет в наличии'), 'WB template greets first');
assert.ok(shared.includes("state: 'wbRu'"), 'question answer uses official PATCH body');
assert.ok(shared.includes('поступление'), 'card is a short restock line');
assert.ok(shared.includes('parseRestockCardMeta') && shared.includes('#nrq'),
    'old #nrq cards still parse; new cards stay short without the tag');
assert.ok(!/RESTOCK_CARD_MARK \$\{/.test(shared) && !shared.includes('lines.push(`${RESTOCK_CARD_MARK}'),
    'new restock card does not print #nrq');
assert.ok(!/Ответьте реплаем/.test(shared), 'card must not explain how to reply');

assert.ok(mig.includes('wb_restock_questions'), 'migration creates queue table');
assert.ok(mig.includes('wb_restock_poll') && mig.includes("'*/10 * * * *'"), 'cron every 10 minutes');
assert.ok(mig.includes('telegram-router?bot=notify'), 'notify webhook path stored');

assert.ok(apply.includes('answerWbQuestion'), 'Karina webhook answers via PATCH /questions');
assert.ok(!apply.includes('questions/answer'), 'live webhook must not use POST /questions/answer');
assert.ok(!apply.includes('Не смог ответить на WB'), 'must not paste WB OpenAPI links into the chat');
assert.ok(webhook.includes('applyRestockTelegramReply'),
    'telegram-webhook is the live Karina path');
assert.ok(apply.includes("'❤'"), 'Karina confirms a send with a heart');
assert.ok(apply.includes('already_answered'), 'retry on an already-sent card still gets a heart');
assert.ok(apply.includes('unmatched'), 'unknown restock card reply gets a thumbs-down, not silence');
assert.ok(apply.includes("['pending', 'answered']"), 'reply can edit an already auto-answered card');
assert.ok(apply.includes('isRestockInboundCandidate'), 'bot replies to a restock card are not dropped');
assert.ok(webhook.indexOf('applyRestockTelegramReply') < webhook.indexOf("if (from?.is_bot) return"),
    'restock runs before the generic bot-message skip');
assert.ok(!apply.includes('Ушло на WB'), 'must not echo status text into the chat');
assert.ok(webhook.includes('KARINA_BOT_TOKEN'), 'restock replies are sent as Karina');
assert.ok(cfg.includes('[functions.telegram-webhook]') && cfg.includes('verify_jwt = false'),
    'telegram-webhook accepts Telegram without user JWT');
assert.ok(proxy.includes('answerWbQuestion'), 'site Agents tab answers via official PATCH');
assert.ok(!proxy.includes('questions/answer'), 'live wb-proxy must not POST /questions/answer');

assert.ok(docs.includes('через неделю'), 'user-facing doc explains the reply');
assert.ok(docs.includes('автоответ'), 'doc explains auto-answers');
assert.ok(docs.includes('фото'), 'doc says the card includes the product photo');
assert.ok(docs.includes('TELEGRAM_CHAT_REVIEWS'), 'doc names the reviews chat');
assert.ok(docs.includes('telegram-router'), 'doc names Karina webhook path');
assert.ok(shared.includes('isRestockCardText'), 'short restock cards match without #nrq');
assert.ok(shared.includes('автоответ'), 'auto-answer cards stay matchable as restock cards');
assert.ok(shared.includes('buildAutoQuestionAnswer') && shared.includes('в ближайшее время'),
    'auto restock answer does not invent a date');
assert.ok(shared.includes('resolveStaffAnswer') && shared.includes('greetBuyerAnswer'),
    'short staff replies are expanded into a buyer letter');

console.log('wb_restock_poll_test: ok');

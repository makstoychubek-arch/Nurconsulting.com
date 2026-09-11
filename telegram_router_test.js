/**
 * Telegram webhook: реплай «завтра» → ответ на WB, чужие чаты молчат.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = __dirname;
const router = fs.readFileSync(path.join(root, 'supabase/functions/telegram-router/index.ts'), 'utf8');
const apply = fs.readFileSync(path.join(root, 'supabase/functions/_shared/wb-restock-apply.ts'), 'utf8');
const html = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');

assert.ok(router.includes('applyRestockTelegramReply'), 'router uses shared inbound apply');
assert.ok(apply.includes('unwrapTelegramMessage'), 'apply reads Telegram update');
assert.ok(apply.includes('завтра / через неделю / через 2 недели'),
    'hint when reply has no when-phrase');
assert.ok(apply.includes('Готово. На WB ушёл ответ'), 'confirms in Telegram after WB');
assert.ok(apply.includes(".eq('status', 'pending')"),
    'only pending questions are answered');
assert.ok(!router.includes('-1004460164885'), 'router must not hardcode the team chat');

assert.ok(html.includes('Или ответьте в Telegram реплаем: завтра / через неделю / через 2 недели'),
    'agents questions panel hints the Telegram reply');
assert.ok(html.includes('placeholder="Ответ покупателю или в Telegram: завтра / через неделю"'),
    'question textarea mentions Telegram');

console.log('telegram_router_test: ok');

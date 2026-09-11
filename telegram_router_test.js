/**
 * Telegram webhook: реплай «завтра» → ответ на WB, чужие чаты молчат.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = __dirname;
const router = fs.readFileSync(path.join(root, 'supabase/functions/telegram-router/index.ts'), 'utf8');
const html = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');

assert.ok(router.includes('decideRestockInbound'), 'router uses shared inbound decision');
assert.ok(router.includes('unwrapTelegramMessage'), 'router reads Telegram update');
assert.ok(router.includes('завтра / через неделю / через 2 недели'),
    'hint when reply has no when-phrase');
assert.ok(router.includes('restockStatusText'), 'success is the words Ушло на WB');
assert.ok(!router.includes("'❤'"), 'must not confirm a send with only a heart');
assert.ok(!router.includes('Готово. На WB ушёл ответ'), 'must not dump the WB letter into the chat');
assert.ok(!router.includes('Не смог ответить на WB'), 'must not paste WB error URLs');
assert.ok(router.includes('status: \'pending\'' ) || router.includes(".eq('status', 'pending')"),
    'only pending questions are answered');
assert.ok(!router.includes('-1004460164885'), 'router must not hardcode the team chat');

assert.ok(html.includes('Или ответьте в Telegram реплаем: завтра / через неделю / через 2 недели'),
    'agents questions panel hints the Telegram reply');
assert.ok(html.includes('placeholder="Ответ покупателю или в Telegram: завтра / через неделю"'),
    'question textarea mentions Telegram');

console.log('telegram_router_test: ok');

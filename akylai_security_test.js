/**
 * Статические проверки безопасности сценария «новый клиент → Акылай».
 * Живую проверку «клиент A не видит строк клиента B» делает SQL-скрипт
 * supabase/tests/akylai_rls_check.sql (его запускают в SQL Editor).
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const sql = read('supabase/migrations/20260930120000_akylai_agent.sql');
const fn = (name) => read(`supabase/functions/${name}/index.ts`);

// ── 1. Все новые таблицы — с RLS ──
const tables = [...sql.matchAll(/create table if not exists public\.(\w+)/g)].map((m) => m[1]);
assert.deepStrictEqual(
    tables.sort(),
    ['agent_logs', 'ai_usage', 'akylai_chats', 'akylai_links', 'akylai_replies', 'akylai_settings', 'cabinet_secrets'].sort(),
    'expected Akylai tables',
);
for (const t of tables) {
    assert.ok(sql.includes(`alter table public.${t} enable row level security;`), `${t}: RLS enabled`);
    assert.ok(sql.includes(`revoke all on public.${t} from anon, authenticated;`), `${t}: default grants revoked`);
}

// ── 2. Секреты (токен WB, chat_id, одноразовые коды) — без политик и без грантов клиенту ──
for (const t of ['cabinet_secrets', 'akylai_links', 'akylai_chats']) {
    assert.ok(!new RegExp(`create policy \\w+ on public\\.${t}\\b`).test(sql), `${t}: no policies at all`);
    assert.ok(!new RegExp(`grant [^;]* on public\\.${t}\\b`).test(sql), `${t}: nothing granted to clients`);
}

// ── 3. Клиент видит только свой кабинет; логи и расход — только команда ──
assert.ok(/create or replace function public\.akylai_owns\(cid uuid\)[\s\S]*?c\.user_id = auth\.uid\(\)/.test(sql),
    'owner check is strictly cabinets.user_id = auth.uid()');
for (const t of ['akylai_settings', 'akylai_replies']) {
    const m = sql.match(new RegExp(`create policy \\w+ on public\\.${t} for select\\s+using \\(([^;]+)\\);`));
    assert.ok(m, `${t}: select policy exists`);
    assert.strictEqual(m[1].trim(), 'public.akylai_owns(cabinet_id) or public.akylai_is_staff()', `${t}: owner or staff only`);
}
for (const t of ['agent_logs', 'ai_usage']) {
    const m = sql.match(new RegExp(`create policy \\w+ on public\\.${t} for select using \\(([^;]+)\\);`));
    assert.ok(m && m[1].trim() === 'public.akylai_is_staff()', `${t}: staff only`);
}
assert.ok(!/create policy [^;]* for (insert|update|delete|all)/i.test(sql), 'clients never write Akylai tables directly');
assert.ok(/grant select \(id, cabinet_id, rating, product_name, feedback_text, reply_text, status, created_at, published_at\)\s+on public\.akylai_replies to authenticated/.test(sql),
    'replies: client columns exclude tg_message_id');
for (const f of ['akylai_add_usage(uuid, bigint, bigint)', 'akylai_bump_published(uuid)']) {
    assert.ok(sql.includes(`revoke all on function public.${f} from public, anon, authenticated;`), `${f}: not callable by clients`);
}

// ── 4. Регистрация и автоактивация не добавляют клиента в team_staff ──
const allSql = fs.readdirSync(path.join(__dirname, 'supabase/migrations'))
    .filter((f) => f.endsWith('.sql'))
    .map((f) => read(`supabase/migrations/${f}`));
for (const body of allSql) {
    const trig = body.match(/function public\.handle_new_user_space\(\)[\s\S]*?\$\$;/);
    if (trig) assert.ok(!/team_staff/.test(trig[0]), 'signup trigger never touches team_staff');
}
assert.ok(!/team_staff/.test(sql.replace(/--.*$/gm, '').replace(/is_team_member/g, '')), 'Akylai migration never writes team_staff');
for (const name of ['akylai-connect', 'akylai-status', 'akylai-bot', 'akylai-reviews', 'onboard-cabinet']) {
    const code = fn(name);
    assert.ok(!/from\('team_staff'\)\.(insert|upsert)/.test(code) && !/from\('allowed_users'\)\.(insert|upsert)/.test(code),
        `${name}: never adds the client to team_staff / allowed_users`);
}
const onboard = fn('onboard-cabinet');
assert.ok(!/\.update\(\{ status: 'active'/.test(onboard), 'onboard-cabinet no longer auto-activates the space');
assert.ok(!/error: (updErr|insErr)\??\.message/.test(onboard) && !/error: String\(e\)/.test(onboard),
    'onboard-cabinet returns no raw database errors');

// ── 5. Edge Functions проверяют JWT и принадлежность кабинета ──
for (const name of ['akylai-connect', 'akylai-status', 'akylai-admin']) {
    const code = fn(name);
    assert.ok(code.includes('await userFromRequest(req)') && /if \(!user\) return/.test(code), `${name}: requires a user JWT`);
}
assert.ok(fn('akylai-status').includes('ownAkylaiCabinet(admin, userId)') || fn('akylai-status').includes('ownAkylaiCabinet(admin, user.id)'),
    'akylai-status acts only on the caller\'s own cabinet');
assert.ok(fn('akylai-admin').includes('isStaffUser(admin, user)') && fn('akylai-admin').includes('403'), 'akylai-admin: staff only');
assert.ok(fn('akylai-reviews').includes('isServiceAuthorized(req'), 'akylai-reviews: service_role only');
const bot = fn('akylai-bot');
assert.ok(bot.includes("env('AKYLAI_WEBHOOK_SECRET')") && bot.includes('if (!secret || got !== secret)'), 'bot webhook requires the secret');
assert.ok((bot.match(/chatOwnsCabinet\(admin, chatId/g) || []).length >= 3, 'every bot button checks the chat owns the cabinet');
assert.ok(read('supabase/config.toml').includes('[functions.akylai-bot]\nverify_jwt = false'), 'only the bot webhook skips JWT');

// ── 6. Секреты — только из окружения ──
const server = read('supabase/functions/_shared/akylai-server.ts');
for (const v of ['AKYLAI_BOT_TOKEN', 'AKYLAI_NR_CHAT_ID', 'AKYLAI_ENC_KEY', 'OPENAI_API_KEY']) {
    assert.ok(server.includes(`env('${v}')`), `${v} comes from Edge Function env`);
}
const all = ['akylai-connect', 'akylai-status', 'akylai-bot', 'akylai-reviews', 'akylai-admin'].map(fn).join('\n') + server;
assert.ok(!/\d{8,10}:[A-Za-z0-9_-]{30,}/.test(all), 'no Telegram bot token in code');
assert.ok(!/sk-[A-Za-z0-9]{20,}/.test(all), 'no OpenAI key in code');
assert.ok(fn('akylai-connect').includes("from('cabinet_secrets').upsert") && fn('akylai-connect').includes('encryptSecret(token, key)'),
    'token is saved encrypted');
assert.ok(!/insert\(\{[^}]*wb_token:/.test(fn('akylai-connect')), 'akylai-connect never writes the plain token into cabinets');
assert.ok(fn('admin-space').includes('moveAkylaiTokens(admin, targetUserId)'),
    'token moves into the cabinet only via admin-space on approval');

// ── 7. Ошибки API не показываются на экране ──
for (const name of ['akylai-connect', 'akylai-status', 'akylai-admin']) {
    const code = fn(name);
    const responses = code.match(/json\(\{[^;]*\}\s*(?:,\s*\d+)?\)/g) || [];
    for (const r of responses) {
        assert.ok(!/\.(message|text)\b/.test(r.replace(/akylaiErrorMessage\([^)]*\)/g, '')), `${name}: response carries no raw error: ${r}`);
    }
}
const html = read('dashboard.html');
const ui = html.slice(html.indexOf('/* ===== Акылай: мастер'), html.indexOf('</script>', html.indexOf('/* ===== Акылай: мастер')));
assert.ok(ui.length > 1000, 'Akylai UI script is present');
assert.ok(!/out\.error|\.errorText|res\.status|e\.message/.test(ui), 'Akylai UI never shows raw errors');
assert.ok(!/localStorage|sessionStorage/.test(ui), 'wizard state is not stored in the browser, it is derived from the DB');

// ── 8. Сценарий на странице ──
assert.ok(html.includes('id="tab-akylai"') && html.includes('data-agent="akylai"'), 'Агенты page with Akylai card');
for (const n of ['Манас', 'Марлен', 'Изат', 'Дастан']) {
    assert.ok(new RegExp(`<span class="ak-soon">Скоро</span><img[^>]*><b>${n}</b>`).test(html), `${n}: «Скоро», not clickable`);
}
assert.ok((html.match(/class="ak-agent" disabled/g) || []).length === 4, 'only Akylai is clickable');
assert.ok(ui.includes('Я отвечаю на отзывы покупателей и присылаю ответы вам в Telegram на проверку.'), 'greeting');
assert.ok(!/вопрос/i.test(ui.match(/renderHello\(\) \{[\s\S]*?\n    \}/)[0]), 'greeting does not mention questions');
assert.ok(/input: true/.test(ui) && ui.includes("const input = last"), 'token field only on the last slide');
assert.ok(ui.includes('«Персональный»') && ui.includes('«Вопросы и отзывы»') && ui.includes('«Только на чтение» не ставьте') && ui.includes('срок действия'),
    'slides explain type, category, read-only and expiry');
assert.ok(!/Проверить<\/button>/.test(ui) && ui.includes("addEventListener('paste'"), 'no «check» button: token is checked automatically');
for (const f of ['akylai-smile.svg', 'akylai-serious.svg', 'akylai-neutral.svg']) {
    assert.ok(fs.existsSync(path.join(__dirname, 'img/agents', f)), `avatar ${f} exists`);
}
assert.ok(html.includes("if (onboardingMode) showTab('akylai', null);"), 'new client lands on Агенты after login');

console.log('akylai_security_test: ok');

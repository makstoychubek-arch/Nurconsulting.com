// Сквозная проверка входных правил Алины (часы работы, темы менеджеру) в настоящем handleAlinaClientMessage
// на поддельной базе (PostgREST). Запуск: deno run -A supabase/alina-test/gate-int.ts
import { assertEquals } from 'jsr:@std/assert@1';

const settings: Record<string, unknown> = {};
const events: Array<Record<string, unknown>> = [];
const server = Deno.serve({ port: 0, onListen: () => {} }, async (req) => {
  const url = new URL(req.url);
  const table = url.pathname.split('/').pop() || '';
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
  if (req.method === 'POST') { if (table === 'alina_selfbuy_events') events.push(await req.json()); return new Response(null, { status: 201 }); }
  if (table === 'alina_settings') return json(Object.entries(settings).map(([key, value]) => ({ key, value })));
  if (table === 'telegram_bots') return json([{ is_enabled: false, deleted_at: null }]);
  if (table === 'alina_selfbuy_events') {
    const type = (url.searchParams.get('event_type') || '').replace('eq.', '');
    return json(events.filter((e) => e.event_type === type).map((_, i) => ({ id: String(i) })));
  }
  return json([]);
});
Deno.env.set('SUPABASE_URL', `http://127.0.0.1:${(server.addr as Deno.NetAddr).port}`);
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test');

const { handleAlinaClientMessage } = await import('../functions/_shared/alina-selfbuy.ts');
const msk = (hm: string) => Date.parse(`2026-11-18T${hm}:00+03:00`);
const send = (text: string, hm: string) => handleAlinaClientMessage({ chatId: -1, userId: -1, username: 'tester', fullName: 'Мара Тест', text, nowMs: msk(hm), sourceAccount: 'sandbox' });

// 1. вне часов: один ответ, потом молчание
// Настройки читаются с кэшем 30 с, поэтому задаём всё до первого сообщения.
Object.assign(settings, { hoursOn: true, hoursFrom: '09:00', hoursTo: '22:00', managerGroup: -1007777 });
let r = await send('Здравствуйте', '23:30');
assertEquals(r.replies.length, 1); assertEquals(r.replies[0], 'Сейчас нерабочее время. Я на связи с 09:00 до 22:00 по Москве. Напишите мне после 09:00, отвечу сразу.');
assertEquals(events.at(-1)?.event_type, 'offhours_sent');
r = await send('Есть кто?', '23:40');
assertEquals(r.replies, [], 'второе сообщение вне часов: тишина'); assertEquals(events.at(-1)?.event_type, 'offhours_skip');
r = await send('Можно поговорить с менеджером?', '23:50');
assertEquals(r.escalate, undefined, 'вне часов вопросы менеджерам не уходят');

// 2. в рабочие часы: вопрос менеджеру
r = await send('Можно поговорить с менеджером?', '12:00');
assertEquals(r.escalate?.topic, 'manager'); assertEquals(r.escalate?.group, -1007777, 'группа из настроек');
assertEquals(r.replies.length, 1); assertEquals(r.replies[0].startsWith('Мара, '), true, 'ответ «уточню» с именем клиента');
assertEquals(r.escalate?.question.includes('Сообщение клиента: «Можно поговорить с менеджером?»'), true);
assertEquals(events.at(-1)?.event_type, 'manager_escalated');

// 3. другая тема
assertEquals((await send('где чек', '12:00')).escalate?.topic, 'receipt');
server.shutdown();
console.log('PASS: входные правила Алины в настоящем сценарии (часы работы, темы менеджеру)');
Deno.exit(0);

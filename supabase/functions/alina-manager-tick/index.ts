// Раз в минуту: обращения к менеджерам без ответа дольше 10 минут. Вызывается по расписанию, JWT включён.
import { remindAlinaManager } from '../_shared/alina-manager.ts';

Deno.serve(async () => {
    try {
        const sent = await remindAlinaManager((Deno.env.get('ALINA_BOT_TOKEN') || '').trim());
        return new Response(JSON.stringify({ ok: true, reminded: sent }), { headers: { 'Content-Type': 'application/json' } });
    } catch {
        console.error('[alina-manager-tick] failed');
        return new Response(JSON.stringify({ ok: false }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
});

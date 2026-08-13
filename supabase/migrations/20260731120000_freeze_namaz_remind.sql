-- Заморозка намаз-бота «Карина»: снимаем минутный pg_cron.
-- Код функции namaz-remind и таблица namaz_bot_events остаются —
-- чтобы включить снова: вернуть cron.schedule и убрать FROZEN в index.ts.

do $block$
declare
  jid bigint;
begin
  for jid in select jobid from cron.job where jobname = 'namaz-remind-bishkek'
  loop
    perform cron.unschedule(jid);
  end loop;
end $block$;

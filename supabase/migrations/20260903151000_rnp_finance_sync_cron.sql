-- pg_cron: ночной синк финотчёта и платного хранения для РНП.
-- Функция rnp-finance-sync без cabinet_id идёт по всем кабинетам с токеном
-- за последние 8 дней, укладываясь в бюджет времени; периоды со статусом done
-- (< 6 ч) повторно не запрашиваются, поэтому несколько запусков ночью подряд
-- безопасны — каждый догоняет то, что не успел предыдущий (лимит WB 1 req/мин).
-- Перед запуском замените REPLACE_ME_SERVICE_ROLE_KEY на service_role.

do $block$
declare jid bigint;
begin
  for jid in select jobid from cron.job where jobname in ('rnp-finance-sync-night')
  loop perform cron.unschedule(jid); end loop;
end $block$;

-- 01:10, 02:10, 03:10 UTC = 07:10 / 08:10 / 09:10 Бишкек — до начала рабочего дня
select cron.schedule(
  'rnp-finance-sync-night',
  '10 1,2,3 * * *',
  $$
  select net.http_post(
    url     := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/rnp-finance-sync',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer REPLACE_ME_SERVICE_ROLE_KEY'
    ),
    body    := '{"mode":"sync"}'::jsonb
  );
  $$
);

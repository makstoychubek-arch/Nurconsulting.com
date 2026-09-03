-- Финотчёт должен доходить до всех кабинетов, не только до первого в списке.
-- Несколько запусков за ночь: первый проход — finance (хранение пропускается),
-- следующие — storage у тех, у кого finance уже done.
-- Перед применением замените REPLACE_ME_SERVICE_ROLE_KEY на service_role.

do $block$
declare jid bigint;
begin
  for jid in select jobid from cron.job where jobname in ('rnp-finance-sync-night')
  loop perform cron.unschedule(jid); end loop;
end $block$;

-- 00:10–05:10 UTC каждый час = 06:10–11:10 Бишкек
select cron.schedule(
  'rnp-finance-sync-night',
  '10 0-5 * * *',
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

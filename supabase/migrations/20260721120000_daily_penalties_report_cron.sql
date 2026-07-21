-- pg_cron: ежедневный отчёт по штрафам/удержаниям в Telegram в 09:00 UTC
-- (15:00 Бишкек), за предыдущий день. REPLACE_ME_SERVICE_ROLE_KEY — из Dashboard.

do $block$
declare
  jid bigint;
begin
  for jid in select jobid from cron.job where jobname = 'daily-penalties-report-15-bishkek'
  loop
    perform cron.unschedule(jid);
  end loop;
end $block$;

select cron.schedule(
  'daily-penalties-report-15-bishkek',
  '0 9 * * *',
  $$
  select net.http_post(
    url     := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/daily-penalties-report',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer REPLACE_ME_SERVICE_ROLE_KEY'
    ),
    body    := '{}'::jsonb
  );
  $$
);

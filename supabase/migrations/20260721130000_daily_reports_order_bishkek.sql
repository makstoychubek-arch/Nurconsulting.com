-- Продажи в 09:00 UTC (15:00 Бишkek), штрафы в 09:10 UTC (15:10 Бишkek) —
-- сначала все отчёты по продажам, потом штрафы.

do $block$
declare jid bigint;
begin
  for jid in select jobid from cron.job where jobname = 'daily-sales-report-15-bishkek'
  loop perform cron.unschedule(jid); end loop;
  for jid in select jobid from cron.job where jobname = 'daily-penalties-report-15-bishkek'
  loop perform cron.unschedule(jid); end loop;
end $block$;

select cron.schedule(
  'daily-sales-report-15-bishkek',
  '0 9 * * *',
  $$
  select net.http_post(
    url     := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/daily-sales-report',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer REPLACE_ME_SERVICE_ROLE_KEY'
    ),
    body    := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'daily-penalties-report-15-bishkek',
  '10 9 * * *',
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

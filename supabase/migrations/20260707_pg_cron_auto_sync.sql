-- pg_cron: автосинк WB каждые 4ч + РНП ежедневно 14:30 Бишкек (08:30 UTC)
-- Перед запуском замените REPLACE_ME_SERVICE_ROLE_KEY на service_role из Dashboard → Settings → API

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $block$
declare
  jid bigint;
begin
  for jid in select jobid from cron.job where jobname in ('auto-sync-4h', 'rnp-daily-bish')
  loop
    perform cron.unschedule(jid);
  end loop;
end $block$;

select cron.schedule(
  'auto-sync-4h',
  '0 */4 * * *',
  $$
  select net.http_post(
    url     := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/auto-sync',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer REPLACE_ME_SERVICE_ROLE_KEY'
    ),
    body    := '{"mode":"full"}'::jsonb
  );
  $$
);

select cron.schedule(
  'rnp-daily-bish',
  '30 8 * * *',
  $$
  select net.http_post(
    url     := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/auto-sync',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer REPLACE_ME_SERVICE_ROLE_KEY'
    ),
    body    := '{"mode":"rnp"}'::jsonb
  );
  $$
);

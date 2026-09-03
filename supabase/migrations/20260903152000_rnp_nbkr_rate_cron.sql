-- pg_cron: официальный курс RUB→KGS с НБКР раз в сутки.
-- Внешний источник (nbkr.kg), лимиты WB не тратит. Ручной курс в
-- exchange_rates на ту же дату не перетирается (см. syncNbkrRate).
-- Перед запуском замените REPLACE_ME_SERVICE_ROLE_KEY на service_role.

do $block$
declare jid bigint;
begin
  for jid in select jobid from cron.job where jobname in ('rnp-nbkr-rate-daily')
  loop perform cron.unschedule(jid); end loop;
end $block$;

-- 10:15 UTC = 16:15 Бишкек — НБКР к этому часу уже публикует дневной курс.
-- Не пересекается с ночным rnp-finance-sync-night (01:10–03:10 UTC).
select cron.schedule(
  'rnp-nbkr-rate-daily',
  '15 10 * * *',
  $$
  select net.http_post(
    url     := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/rnp-finance-sync',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer REPLACE_ME_SERVICE_ROLE_KEY'
    ),
    body    := '{"mode":"rate"}'::jsonb
  );
  $$
);

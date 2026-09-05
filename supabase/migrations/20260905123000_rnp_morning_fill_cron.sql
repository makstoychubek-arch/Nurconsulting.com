-- Утреннее заполнение РНП по кабинетам (Бишкек):
--   06:00 Zevina, 07:15 Baza, 08:00 Elium.
-- Bearer копируется с рабочего cron auto-sync-4h, чтобы в git не класть ключ.

do $block$
declare
  tok text;
  hdr jsonb;
  jid bigint;
begin
  select (regexp_match(command, 'Bearer ([A-Za-z0-9._-]+)'))[1]
    into tok
  from cron.job
  where command like '%Bearer%'
    and jobname in ('auto-sync-4h', 'daily-penalties-report-07-bishkek', 'rnp-finance-sync-night')
  limit 1;

  if tok is null or length(tok) < 20 then
    raise notice 'rnp-morning-fill: нет Bearer у существующих cron — пропускаю schedule';
    return;
  end if;

  hdr := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || tok
  );

  for jid in select jobid from cron.job
    where jobname in (
      'rnp-morning-zevina-06-bishkek',
      'rnp-morning-baza-07-bishkek',
      'rnp-morning-elium-08-bishkek',
      'rnp-daily-bish'
    )
  loop
    perform cron.unschedule(jid);
  end loop;

  perform cron.schedule(
    'rnp-morning-zevina-06-bishkek',
    '0 0 * * *',
    format($c$
      select net.http_post(
        url     := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/rnp-morning-fill',
        headers := %L::jsonb,
        body    := '{"group":"zevina"}'::jsonb
      );
    $c$, hdr::text)
  );

  perform cron.schedule(
    'rnp-morning-baza-07-bishkek',
    '15 1 * * *',
    format($c$
      select net.http_post(
        url     := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/rnp-morning-fill',
        headers := %L::jsonb,
        body    := '{"group":"baza"}'::jsonb
      );
    $c$, hdr::text)
  );

  perform cron.schedule(
    'rnp-morning-elium-08-bishkek',
    '0 2 * * *',
    format($c$
      select net.http_post(
        url     := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/rnp-morning-fill',
        headers := %L::jsonb,
        body    := '{"group":"elium"}'::jsonb
      );
    $c$, hdr::text)
  );
end
$block$;

select 'rnp-morning-fill crons scheduled' as status;

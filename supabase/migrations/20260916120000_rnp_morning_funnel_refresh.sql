-- Повтор воронки WB в 09:00–09:30 Бишкек, когда вчерашний день карточки уже
-- стабилен (06:00 МСК). Без Telegram: утренние 06/07/08 уже написали в тим.
-- Bearer копируется с рабочего cron, ключ в git не кладём.

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
    and jobname in (
      'auto-sync-4h',
      'rnp-morning-zevina-06-bishkek',
      'rnp-finance-sync-night',
      'daily-penalties-report-07-bishkek'
    )
  limit 1;

  if tok is null or length(tok) < 20 then
    raise notice 'rnp-morning-funnel-refresh: нет Bearer у существующих cron — пропускаю schedule';
    return;
  end if;

  hdr := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || tok
  );

  for jid in select jobid from cron.job
    where jobname in (
      'rnp-morning-funnel-zevina-09-bishkek',
      'rnp-morning-funnel-baza-09-bishkek',
      'rnp-morning-funnel-elium-09-bishkek'
    )
  loop
    perform cron.unschedule(jid);
  end loop;

  perform cron.schedule(
    'rnp-morning-funnel-zevina-09-bishkek',
    '0 3 * * *',
    format($c$
      select net.http_post(
        url     := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/rnp-morning-fill',
        headers := %L::jsonb,
        body    := '{"group":"zevina","funnel_only":true,"notify":false}'::jsonb
      );
    $c$, hdr::text)
  );

  perform cron.schedule(
    'rnp-morning-funnel-baza-09-bishkek',
    '15 3 * * *',
    format($c$
      select net.http_post(
        url     := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/rnp-morning-fill',
        headers := %L::jsonb,
        body    := '{"group":"baza","funnel_only":true,"notify":false}'::jsonb
      );
    $c$, hdr::text)
  );

  perform cron.schedule(
    'rnp-morning-funnel-elium-09-bishkek',
    '30 3 * * *',
    format($c$
      select net.http_post(
        url     := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/rnp-morning-fill',
        headers := %L::jsonb,
        body    := '{"group":"elium","funnel_only":true,"notify":false}'::jsonb
      );
    $c$, hdr::text)
  );
end
$block$;

select 'rnp-morning-funnel-refresh crons scheduled' as status;

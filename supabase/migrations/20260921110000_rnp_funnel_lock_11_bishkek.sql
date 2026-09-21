-- Вчерашняя воронка WB на карточке стабилизируется к 11:00 Бишкек,
-- не к 09:00. Утренний fill в 06/07/08 пишет count из statistics-api
-- (66 вместо 47). Этот прогон funnel_only перезаписывает вчера
-- Корзина × Заказы% — то же число, что в Excel «План/факт».
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
      'rnp-morning-zevina-0620-bishkek',
      'rnp-morning-zevina-06-bishkek',
      'rnp-finance-sync-night',
      'daily-penalties-report-07-bishkek'
    )
  limit 1;

  if tok is null or length(tok) < 20 then
    raise notice 'rnp-funnel-lock-11: нет Bearer у существующих cron — пропускаю schedule';
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
      'rnp-morning-funnel-elium-09-bishkek',
      'rnp-morning-funnel-zevina-11-bishkek',
      'rnp-morning-funnel-baza-11-bishkek',
      'rnp-morning-funnel-elium-11-bishkek'
    )
  loop
    perform cron.unschedule(jid);
  end loop;

  perform cron.schedule(
    'rnp-morning-funnel-zevina-11-bishkek',
    '0 5 * * *',
    format($c$
      select net.http_post(
        url     := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/rnp-morning-fill',
        headers := %L::jsonb,
        body    := '{"group":"zevina","funnel_only":true,"notify":false}'::jsonb
      );
    $c$, hdr::text)
  );

  perform cron.schedule(
    'rnp-morning-funnel-baza-11-bishkek',
    '15 5 * * *',
    format($c$
      select net.http_post(
        url     := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/rnp-morning-fill',
        headers := %L::jsonb,
        body    := '{"group":"baza","funnel_only":true,"notify":false}'::jsonb
      );
    $c$, hdr::text)
  );

  perform cron.schedule(
    'rnp-morning-funnel-elium-11-bishkek',
    '30 5 * * *',
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

select 'rnp-funnel-lock-11 crons scheduled' as status;

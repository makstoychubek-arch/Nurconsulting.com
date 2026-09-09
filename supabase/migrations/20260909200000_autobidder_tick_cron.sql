-- pg_cron: autobidder_tick каждые 5 мин. DRY_RUN по умолчанию в функции.
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
      'sync_campaigns',
      'rnp-morning-zevina-06-bishkek'
    )
  limit 1;

  if tok is null or length(tok) < 20 then
    raise notice 'autobidder_tick: нет Bearer у существующих cron — пропускаю schedule';
    return;
  end if;

  hdr := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || tok
  );

  for jid in select jobid from cron.job where jobname = 'autobidder_tick'
  loop
    perform cron.unschedule(jid);
  end loop;

  perform cron.schedule(
    'autobidder_tick',
    '*/5 * * * *',
    format($c$
      select net.http_post(
        url     := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/autobidder-tick',
        headers := %L::jsonb,
        body    := '{}'::jsonb
      );
    $c$, hdr::text)
  );
end
$block$;

select 'autobidder_tick cron scheduled' as status;

-- pg_cron: синк кампаний/кластеров, дневная статистика, чистка снапшотов.
-- docs/autobidder.md §6, §11.3. Bearer копируется с рабочего cron, ключ в git не кладём.

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
      'daily-penalties-report-07-bishkek',
      'rnp-finance-sync-night',
      'rnp-morning-zevina-06-bishkek'
    )
  limit 1;

  if tok is null or length(tok) < 20 then
    raise notice 'adv-sync-crons: нет Bearer у существующих cron — пропускаю schedule';
    return;
  end if;

  hdr := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || tok
  );

  for jid in select jobid from cron.job
    where jobname in ('sync_campaigns', 'sync_daily_stats', 'cleanup_snapshots')
  loop
    perform cron.unschedule(jid);
  end loop;

  -- каждые 30 мин
  perform cron.schedule(
    'sync_campaigns',
    '*/30 * * * *',
    format($c$
      select net.http_post(
        url     := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/sync-campaigns',
        headers := %L::jsonb,
        body    := '{}'::jsonb
      );
    $c$, hdr::text)
  );

  -- 06:00 Бишкек = 00:00 UTC
  perform cron.schedule(
    'sync_daily_stats',
    '0 0 * * *',
    format($c$
      select net.http_post(
        url     := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/sync-daily-stats',
        headers := %L::jsonb,
        body    := '{}'::jsonb
      );
    $c$, hdr::text)
  );

  -- 03:00 Бишкек = 21:00 UTC
  perform cron.schedule(
    'cleanup_snapshots',
    '0 21 * * *',
    format($c$
      select net.http_post(
        url     := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/cleanup-snapshots',
        headers := %L::jsonb,
        body    := '{}'::jsonb
      );
    $c$, hdr::text)
  );
end
$block$;

select 'adv sync crons scheduled' as status;

-- Zevina 06:00 Бишкек совпадает с auto-sync-4h (0 */4) и sync_daily_stats
-- (00:00 UTC). Два кабинета Зевины ловят 429 на supplier/orders, воронка
-- ещё и не укладывается в лимит функции — в тиме «начинаю» без «готово».
-- Сдвиг на 06:20: auto-sync уже отпустил токены, Карина успевает дописать.
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
      'rnp-morning-baza-07-bishkek',
      'rnp-finance-sync-night',
      'daily-penalties-report-07-bishkek'
    )
  limit 1;

  if tok is null or length(tok) < 20 then
    raise notice 'rnp-morning-zevina-shift: нет Bearer у существующих cron — пропускаю schedule';
    return;
  end if;

  hdr := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || tok
  );

  for jid in select jobid from cron.job
    where jobname in (
      'rnp-morning-zevina-06-bishkek',
      'rnp-morning-zevina-0620-bishkek'
    )
  loop
    perform cron.unschedule(jid);
  end loop;

  perform cron.schedule(
    'rnp-morning-zevina-0620-bishkek',
    '20 0 * * *',
    format($c$
      select net.http_post(
        url     := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/rnp-morning-fill',
        headers := %L::jsonb,
        body    := '{"group":"zevina","funnel":false}'::jsonb
      );
    $c$, hdr::text)
  );
end
$block$;

select 'rnp-morning-zevina shifted to 06:20 Bishkek' as status;

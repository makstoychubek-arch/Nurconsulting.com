-- Остатки по дням: контрольный снимок в 11:00 Бишкек (05:00 UTC).
-- Утро (06–08) уже пишет день после заливки РНП. Этот cron дописывает
-- кабинеты, которые утро пропустило. Повтор ту же дату не меняет.

do $block$
declare
  jid bigint;
begin
  for jid in select jobid from cron.job
    where jobname in ('goods-daily-stocks-11-bishkek')
  loop
    perform cron.unschedule(jid);
  end loop;

  perform cron.schedule(
    'goods-daily-stocks-11-bishkek',
    '0 5 * * *',
    $c$select public.snapshot_goods_daily_stocks(null, null, null);$c$
  );
end
$block$;

select 'goods-daily-stocks-11-bishkek scheduled at 11:00 Bishkek' as status;

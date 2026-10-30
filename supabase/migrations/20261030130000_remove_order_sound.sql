-- Звук новых заказов удалён с сайта: отключаем ежеминутный опрос WB и убираем таблицу событий.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'orders-watch-1m') then
    perform cron.unschedule('orders-watch-1m');
  end if;
end $$;
drop table if exists public.order_events;

-- Дашборд: первый заход после простоя считался до 7 секунд (холодный кэш базы, Zevina 1), прогретый 50-150 мс.
-- Раз в 4 минуты читаем те же таблицы и окно в 70 дней, чтобы нужные страницы оставались в памяти базы.
create or replace function public.warm_dashboard_cache() returns void
language sql security definer set search_path to 'public' as $$
  select count(*) from public.wb_orders where order_date >= current_date - 70;
  select count(*) from public.rnp_daily_data where date >= current_date - 70;
  select count(*) from public.wb_stocks;
$$;
revoke all on function public.warm_dashboard_cache() from public, anon, authenticated;
select cron.schedule('dashboard-cache-warmup', '*/4 * * * *', $$select public.warm_dashboard_cache();$$);

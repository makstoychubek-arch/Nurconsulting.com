-- Тяжёлая функция снимка остатков не должна вызываться без входа и обычными пользователями: только cron/сервис.
revoke execute on function public.snapshot_goods_daily_stocks() from public, anon, authenticated;
grant execute on function public.snapshot_goods_daily_stocks() to service_role;

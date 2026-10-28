-- Снимок остатков вызывается из кабинета (вошедший пользователь) и cron/сервисом; анониму он не нужен.
revoke execute on function public.snapshot_goods_daily_stocks(date, uuid, bigint[]) from public, anon;
grant execute on function public.snapshot_goods_daily_stocks(date, uuid, bigint[]) to authenticated, service_role;

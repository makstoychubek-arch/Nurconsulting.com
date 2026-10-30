-- Звук заказов теперь работает через опрос раз в 20 секунд, подписка Realtime не нужна (постоянное чтение журнала изменений нагружало базу).
do $$
begin
  if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'order_events') then
    alter publication supabase_realtime drop table public.order_events;
  end if;
end $$;

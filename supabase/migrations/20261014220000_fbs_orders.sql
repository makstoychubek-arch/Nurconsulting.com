-- Заказы FBS с номером склада продавца (ФФ): позволяют точно отнести отправки и штрафы на конкретный ФФ.
-- Наполняет edge-функция ff-orders-sync (раз в час, WB отдаёт заказы не старше 30 дней).
create table if not exists public.fbs_orders (
    cabinet_id    uuid not null references public.cabinets(id) on delete cascade,
    order_id      bigint not null,
    rid           text,
    nm_id         bigint,
    warehouse_id  bigint,
    ff_name       text,
    created_at    timestamptz,
    order_date    date,
    synced_at     timestamptz not null default now(),
    primary key (cabinet_id, order_id)
);
create index if not exists fbs_orders_cab_date_idx on public.fbs_orders (cabinet_id, order_date);
create index if not exists fbs_orders_cab_nm_date_idx on public.fbs_orders (cabinet_id, nm_id, order_date);
alter table public.fbs_orders enable row level security;
drop policy if exists fbs_orders_sel on public.fbs_orders;
create policy fbs_orders_sel on public.fbs_orders for select to authenticated using (cabinet_id in (select public.current_user_view_cabinet_ids()));
revoke all on public.fbs_orders from anon;
grant select on public.fbs_orders to authenticated;
grant all on public.fbs_orders to service_role;

-- pg_cron раз в час: берём готовую команду orders-watch (там уже ключ сервера) и меняем адрес функции — ключ в репозиторий не попадает.
do $block$
declare jid bigint; cmd text;
begin
  for jid in select jobid from cron.job where jobname = 'ff-orders-sync-hourly' loop perform cron.unschedule(jid); end loop;
  select replace(command, 'orders-watch', 'ff-orders-sync') into cmd from cron.job where jobname = 'orders-watch-1m';
  if cmd is not null then perform cron.schedule('ff-orders-sync-hourly', '17 * * * *', cmd); end if;
end $block$;

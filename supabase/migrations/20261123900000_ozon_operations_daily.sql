-- Операции Ozon по дням и видам (хранение, услуги и другие списания из транзакций продавца): источник для сверки РНП с балансом.
create table if not exists public.ozon_operations_daily (
    cabinet_id uuid not null references public.cabinets(id) on delete cascade,
    d date not null,
    op_type text not null,
    op_name text,
    amount numeric not null default 0,
    cnt int not null default 0,
    synced_at timestamptz not null default now(),
    primary key (cabinet_id, d, op_type)
);
alter table public.ozon_operations_daily enable row level security;
drop policy if exists ozon_operations_daily_read on public.ozon_operations_daily;
create policy ozon_operations_daily_read on public.ozon_operations_daily for select to authenticated using (public.can_view_cabinet(cabinet_id::text));
-- ночное расписание (команда берётся у существующей ночной задачи ozon)
do $$
declare base text;
begin
    select command into base from cron.job where jobname = 'ozon-night-finance' limit 1;
    if base is null then raise notice 'ozon-night-finance не найдена, задача не добавлена'; return; end if;
    perform cron.unschedule(jobname) from cron.job where jobname = 'ozon-night-operations';
    perform cron.schedule('ozon-night-operations', '55 22 * * *', replace(base, '{"parts":["finance"],"days":60}', '{"parts":["operations"],"days":60}'));
end $$;

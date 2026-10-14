-- Учёт отправки и хранения ФФ в РНП — настройка по кабинету (на дашборде они учитываются всегда).
-- У клиентов, которые уже заложили отправку в себестоимость (Zevina), выключено, чтобы не считать дважды.
alter table public.ff_settings add column if not exists rnp_ff_costs boolean not null default true;
alter table public.ff_settings drop column if exists ship_in_cost;

insert into public.ff_settings (cabinet_id, rnp_ff_costs)
select id, false from public.cabinets where name in ('Zevina 1', 'Zevina 2')
on conflict (cabinet_id) do update set rnp_ff_costs = false, updated_at = now();

-- Отправка и хранение ФФ в РНП учитываются отдельно. У Zevina отправка уже в себестоимости, хранение — нет.
alter table public.ff_settings add column if not exists rnp_ship_costs boolean not null default true;
alter table public.ff_settings add column if not exists rnp_storage_costs boolean not null default true;
update public.ff_settings set rnp_ship_costs = rnp_ff_costs, rnp_storage_costs = true;
alter table public.ff_settings drop column if exists rnp_ff_costs;

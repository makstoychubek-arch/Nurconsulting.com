-- Настройки фулфилмента по кабинету. ship_in_cost: стоимость отправки ФФ уже входит в себестоимость товаров,
-- поэтому в прибыли и РНП её второй раз не вычитаем (в «Выплатить» ФФ она остаётся — это реальные деньги ФФ).
-- По умолчанию (нет строки) считается, что отправка в себестоимости.
create table if not exists public.ff_settings (
    cabinet_id    uuid primary key references public.cabinets(id) on delete cascade,
    ship_in_cost  boolean not null default true,
    updated_at    timestamptz not null default now()
);
alter table public.ff_settings enable row level security;
drop policy if exists ff_settings_sel on public.ff_settings;
create policy ff_settings_sel on public.ff_settings for select to authenticated
    using (cabinet_id in (select public.current_user_view_cabinet_ids()));
drop policy if exists ff_settings_ins on public.ff_settings;
create policy ff_settings_ins on public.ff_settings for insert to authenticated
    with check (cabinet_id in (select public.current_user_cabinet_ids()));
drop policy if exists ff_settings_upd on public.ff_settings;
create policy ff_settings_upd on public.ff_settings for update to authenticated
    using (cabinet_id in (select public.current_user_cabinet_ids()))
    with check (cabinet_id in (select public.current_user_cabinet_ids()));
grant select, insert, update on public.ff_settings to authenticated;
grant all on public.ff_settings to service_role;

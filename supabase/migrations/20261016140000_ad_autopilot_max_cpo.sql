-- Потолок цены заказа для автопилота рекламы (сом): ставка снижается, если заказ дороже.
-- Для всех кабинетов по умолчанию 450. Safe to re-run.
alter table public.ad_autopilot_settings
    add column if not exists max_cpo numeric not null default 450 check (max_cpo > 0);

-- Строка настроек для каждого кабинета, где её ещё нет: автопилот выключен, пробный режим, потолок 450.
insert into public.ad_autopilot_settings (cabinet_id, enabled, dry_run, max_cpo)
select c.id, false, true, 450 from public.cabinets c
on conflict (cabinet_id) do nothing;

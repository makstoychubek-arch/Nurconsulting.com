-- Фокус автобиддера: adv_enabled (не путать с adv_token_valid).
-- Zevina 2 выключаем из джобов, токен в Vault оставляем.
-- nm_id в adv_campaigns может быть пустым, если WB не отдал карточку.

alter table public.cabinets
  add column if not exists adv_enabled boolean not null default true;

comment on column public.cabinets.adv_enabled is
  'Включать кабинет в sync_campaigns / sync_daily_stats / autobidder_tick. Токен не трогает.';

update public.cabinets
set adv_enabled = false
where name = 'Zevina 2';

alter table public.adv_campaigns
  alter column nm_id drop not null;

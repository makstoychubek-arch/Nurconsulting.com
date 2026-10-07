-- Аудит безопасности: токены WB/Ozon больше не читаются из браузера.
-- Edge-функции работают через service_role и не затронуты; клиент получает только признаки *_set.
alter table public.cabinets
  add column if not exists wb_token_set boolean generated always as (coalesce(length(wb_token), 0) > 50) stored,
  add column if not exists ozon_api_key_set boolean generated always as (coalesce(length(ozon_api_key), 0) > 0) stored;

revoke select on public.cabinets from anon, authenticated;
grant select (
  id, name, created_at, user_id, last_full_orders_sync_at, orders_backfilled_to, orders_filled_until,
  orders_rescan_to, funnel_rescan_to, ozon_client_id, adv_token_secret_id, adv_token_valid,
  adv_token_checked_at, adv_daily_budget_cap, adv_group_id, adv_enabled, nr_managed,
  wb_token_set, ozon_api_key_set
) on public.cabinets to authenticated;

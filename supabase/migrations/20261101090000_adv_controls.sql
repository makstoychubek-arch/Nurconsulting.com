-- Окно кампании: очередь adv_ops получает «завершить» и «зоны показов», а кэш кампаний хранит зоны и даты из WB.
-- Дневного лимита и автопополнения в публичном API WB нет, поэтому для них типов операций нет (docs/adv-controls-api.md).
alter table public.adv_ops drop constraint if exists adv_ops_kind_check;
alter table public.adv_ops add constraint adv_ops_kind_check
    check (kind in ('set_bid', 'add_nm', 'remove_nm', 'create', 'finish', 'set_zones'));

alter table public.adv_campaigns add column if not exists placements jsonb;          -- {"search":bool,"recommendations":bool} из settings.placements
alter table public.adv_campaigns add column if not exists wb_created_at timestamptz; -- timestamps.created
alter table public.adv_campaigns add column if not exists wb_started_at timestamptz; -- timestamps.started (null, если не запускали)
comment on column public.adv_campaigns.placements is 'Зоны показов кампании: search и recommendations (WB v2/adverts, settings.placements).';

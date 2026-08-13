-- Алина: бартер / кэшбек — расширенные поля лида + активный оффер (слоты, ключ).

alter table public.alina_selfbuy_leads
  add column if not exists deal_type text,
  add column if not exists keyword text,
  add column if not exists cashback_pct int,
  add column if not exists product_name text,
  add column if not exists order_price text,
  add column if not exists pickup_at text,
  add column if not exists review_note text,
  add column if not exists reels_url text,
  add column if not exists screens_done text default '';

create table if not exists public.alina_campaign (
  id              uuid primary key default gen_random_uuid(),
  is_open         boolean not null default false,
  deal_type       text not null default 'cashback', -- cashback | barter | both
  product_name    text,
  keyword         text,
  cashback_pct    int default 70,
  slots_left      int default 0,
  order_deadline  text,
  notes           text,
  updated_at      timestamptz not null default now()
);

alter table public.alina_campaign enable row level security;
drop policy if exists "alina_campaign_deny" on public.alina_campaign;
create policy "alina_campaign_deny" on public.alina_campaign
  for all using (false) with check (false);

-- Стартовый оффер (закрыт, пока не откроете командой)
insert into public.alina_campaign (is_open, deal_type, product_name, cashback_pct, slots_left)
select false, 'cashback', null, 70, 0
where not exists (select 1 from public.alina_campaign);
